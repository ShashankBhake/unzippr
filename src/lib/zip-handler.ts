import { unzipSync, Unzipped } from "fflate";
import {
    ZipEntry,
    ZipState,
    PreviewState,
    FILE_SIZE_LIMITS,
    MIME_MAP,
} from "./types";
import {
    buildTree,
    getExtension,
    getPreviewType,
    getFilenameFromUrl,
} from "./utils";
import {
    parseRemoteZip,
    remoteEntriesToZipEntries,
    type RemoteZipHandle,
} from "./zip-remote";

export type { Unzipped } from "fflate";
export type { RemoteZipHandle } from "./zip-remote";

type ProgressCallback = (progress: number, message: string) => void;

/**
 * Threshold above which we use Range-based parsing instead of downloading
 * the entire ZIP. 20MB — below this, full download is fast enough.
 */
const RANGE_PARSE_THRESHOLD = 20 * 1024 * 1024;

/** Result returned after parsing a ZIP, includes the parsed data for reuse */
export interface ParseResult {
    state: ZipState;
    /** Full in-memory unzipped data (null when using remote/range mode) */
    unzipped: Unzipped | null;
    /** Handle for on-demand extraction via Range requests (null for local files / small downloads) */
    remoteHandle: RemoteZipHandle | null;
}

/**
 * Parse a ZIP file from a File object (drag & drop / file picker)
 */
export async function parseZipFromFile(
    file: File,
    onProgress: ProgressCallback,
): Promise<ParseResult> {
    if (file.size > FILE_SIZE_LIMITS.UPLOAD) {
        return {
            state: {
                status: "error",
                fileName: file.name,
                totalSize: file.size,
                entries: [],
                tree: { name: "", path: "", isDirectory: true, children: [] },
                error: `File too large. Maximum upload size is ${FILE_SIZE_LIMITS.UPLOAD / 1024 / 1024}MB. Your file is ${(file.size / 1024 / 1024).toFixed(1)}MB.`,
                loadMethod: "file",
                supportsRangeRequests: false,
                progress: 0,
                progressMessage: "",
            },
            unzipped: null,
            remoteHandle: null,
        };
    }

    onProgress(10, "Reading file...");

    const buffer = await file.arrayBuffer();
    onProgress(50, "Parsing ZIP structure...");

    try {
        const unzipped = unzipSync(new Uint8Array(buffer));
        onProgress(90, "Building file tree...");

        const entries = buildEntries(unzipped);
        const tree = buildTree(entries, file.name.replace(/\.zip$/i, ""));

        onProgress(100, "Done!");

        return {
            state: {
                status: "loaded",
                fileName: file.name,
                totalSize: file.size,
                entries,
                tree,
                error: null,
                loadMethod: "file",
                supportsRangeRequests: false,
                progress: 100,
                progressMessage: "Done!",
            },
            unzipped,
            remoteHandle: null,
        };
    } catch (err) {
        return {
            state: {
                status: "error",
                fileName: file.name,
                totalSize: file.size,
                entries: [],
                tree: { name: "", path: "", isDirectory: true, children: [] },
                error: `Failed to parse ZIP: ${err instanceof Error ? err.message : "Unknown error"}. Make sure this is a valid ZIP file.`,
                loadMethod: "file",
                supportsRangeRequests: false,
                progress: 0,
                progressMessage: "",
            },
            unzipped: null,
            remoteHandle: null,
        };
    }
}

/**
 * Internal: download a URL with streaming progress and parse as ZIP.
 */
async function fetchAndParseZip(
    fetchUrl: string,
    fileName: string,
    onProgress: ProgressCallback,
    expectedSize?: number,
): Promise<{ state: ZipState; unzipped: Unzipped }> {
    const response = await fetch(fetchUrl, {
        redirect: "follow",
    });
    if (!response.ok) {
        // If the proxy returned a JSON error, extract the message
        let detail = `${response.status} ${response.statusText}`;
        try {
            const ct = response.headers.get("content-type") || "";
            if (ct.includes("application/json")) {
                const body = await response.json();
                if (body.error) detail = body.error;
            }
        } catch {
            // ignore parse errors
        }
        throw new Error(`Download failed: ${detail}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
        throw new Error("Unable to stream response");
    }

    const totalBytes =
        expectedSize ||
        parseInt(response.headers.get("content-length") || "0", 10) ||
        undefined;
    const chunks: Uint8Array[] = [];
    let receivedBytes = 0;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        receivedBytes += value.length;

        if (totalBytes) {
            const pct = Math.round(10 + (receivedBytes / totalBytes) * 70);
            onProgress(
                pct,
                `Downloading... ${(receivedBytes / 1024 / 1024).toFixed(1)}MB / ${(totalBytes / 1024 / 1024).toFixed(1)}MB`,
            );
        } else {
            onProgress(
                50,
                `Downloading... ${(receivedBytes / 1024 / 1024).toFixed(1)}MB`,
            );
        }
    }

    onProgress(80, "Parsing ZIP structure...");

    const fullBuffer = new Uint8Array(receivedBytes);
    let offset = 0;
    for (const chunk of chunks) {
        fullBuffer.set(chunk, offset);
        offset += chunk.length;
    }

    const unzipped = unzipSync(fullBuffer);
    onProgress(95, "Building file tree...");

    const entries = buildEntries(unzipped);
    const tree = buildTree(entries, fileName.replace(/\.zip$/i, ""));

    onProgress(100, "Done!");

    return {
        state: {
            status: "loaded",
            fileName,
            totalSize: receivedBytes,
            entries,
            tree,
            error: null,
            loadMethod: "url",
            supportsRangeRequests: false,
            progress: 100,
            progressMessage: "Done!",
        },
        unzipped,
    };
}

/**
 * Parse a ZIP file from a URL. Uses Range-based parsing for large files,
 * full download for small ones. Tries direct fetch first, falls back to proxy for CORS.
 */
export async function parseZipFromUrl(
    url: string,
    onProgress: ProgressCallback,
): Promise<ParseResult> {
    const fileName = getFilenameFromUrl(url);

    onProgress(5, "Checking server capabilities...");

    // ── Step 1: Try direct HEAD to check capabilities ────────────────
    let fetchBaseUrl = url;
    let proxied = false;
    let contentLength = 0;
    let supportsRange = false;

    try {
        const headRes = await fetch(url, { method: "HEAD" });
        if (headRes.ok) {
            contentLength = parseInt(
                headRes.headers.get("content-length") || "0",
                10,
            );
            const acceptRanges = (
                headRes.headers.get("accept-ranges") || ""
            ).toLowerCase();
            supportsRange = acceptRanges.includes("bytes") && contentLength > 0;
        } else {
            // HEAD returned non-OK — fall through to proxy
            throw new Error("DIRECT_FAILED");
        }
    } catch {
        // Direct fetch failed for ANY reason (CORS, network, HEAD not supported, etc.)
        // Always try through proxy — never give up here
        onProgress(8, "Direct access failed. Trying proxy...");
        fetchBaseUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
        proxied = true;

        try {
            const headController = new AbortController();
            const headTimeout = setTimeout(() => headController.abort(), 15000);
            const proxyHeadRes = await fetch(fetchBaseUrl, {
                method: "HEAD",
                signal: headController.signal,
            });
            clearTimeout(headTimeout);
            console.log(
                "[unzippr] Proxy HEAD status:",
                proxyHeadRes.status,
                "headers:",
                Object.fromEntries(proxyHeadRes.headers.entries()),
            );
            if (proxyHeadRes.ok) {
                // Try standard headers first, then custom fallback headers
                contentLength = parseInt(
                    proxyHeadRes.headers.get("content-length") ||
                        proxyHeadRes.headers.get("x-file-size") ||
                        "0",
                    10,
                );
                const acceptRanges = (
                    proxyHeadRes.headers.get("accept-ranges") || ""
                ).toLowerCase();
                const xRangeSupport =
                    proxyHeadRes.headers.get("x-range-support");
                supportsRange =
                    (acceptRanges.includes("bytes") ||
                        xRangeSupport === "true") &&
                    contentLength > 0;
            }
            // If HEAD returned non-OK, that's fine — we'll just skip range detection
            // and proceed with a full download via GET (which is more widely supported)
        } catch (headErr) {
            // HEAD through proxy failed or timed out — try a GET range probe instead
            console.log("[unzippr] Proxy HEAD failed:", headErr);
            // Attempt a range probe to get both size and range support info
            try {
                const probeController = new AbortController();
                const probeTimeout = setTimeout(
                    () => probeController.abort(),
                    10000,
                );
                const probeRes = await fetch(fetchBaseUrl, {
                    method: "GET",
                    signal: probeController.signal,
                    headers: { Range: "bytes=0-0" },
                });
                clearTimeout(probeTimeout);
                console.log("[unzippr] Fallback range probe:", probeRes.status);
                if (probeRes.status === 206) {
                    supportsRange = true;
                    const cr = probeRes.headers.get("content-range");
                    const m = cr?.match(/\/(\d+)/);
                    if (m) contentLength = parseInt(m[1], 10);
                }
                probeController.abort();
            } catch {
                console.log("[unzippr] Fallback range probe also failed");
            }
        }
    }

    // ── Step 2: Decide strategy — Range-based or full download ────────

    console.log("[unzippr] After HEAD:", {
        proxied,
        contentLength,
        supportsRange,
        fetchBaseUrl: fetchBaseUrl.substring(0, 80),
    });

    // If file is large but range support wasn't detected from headers,
    // do a quick probe — try fetching 1 byte with Range to check
    if (!supportsRange && contentLength > RANGE_PARSE_THRESHOLD) {
        onProgress(8, "Probing range request support...");
        try {
            const probeRes = await fetch(fetchBaseUrl, {
                method: "GET",
                headers: { Range: "bytes=0-0" },
            });
            console.log(
                "[unzippr] Range probe response:",
                probeRes.status,
                Object.fromEntries(probeRes.headers.entries()),
            );
            if (probeRes.status === 206) {
                supportsRange = true;
                // Also try to get content length from Content-Range if we didn't have it
                if (!contentLength) {
                    const cr = probeRes.headers.get("content-range");
                    const m = cr?.match(/\/(\d+)/);
                    if (m) contentLength = parseInt(m[1], 10);
                }
            }
            try {
                await probeRes.body?.cancel();
            } catch {
                /* ignore */
            }
        } catch (probeErr) {
            console.log("[unzippr] Range probe failed:", probeErr);
        }
    }

    console.log("[unzippr] Decision:", {
        supportsRange,
        contentLength,
        threshold: RANGE_PARSE_THRESHOLD,
        useLazy: supportsRange && contentLength > RANGE_PARSE_THRESHOLD,
    });

    const useLazyParsing =
        supportsRange && contentLength > RANGE_PARSE_THRESHOLD;

    if (useLazyParsing) {
        // ── Range-based parsing: only download Central Directory ──────
        onProgress(
            10,
            `Large file (${(contentLength / 1024 / 1024).toFixed(0)}MB). Using smart parsing — only fetching file listing...`,
        );

        try {
            const handle = await parseRemoteZip(
                fetchBaseUrl,
                (msg) => onProgress(15, msg),
                contentLength,
            );

            const entries = remoteEntriesToZipEntries(handle.entries);
            const tree = buildTree(entries, fileName.replace(/\.zip$/i, ""));

            onProgress(100, "Done!");

            return {
                state: {
                    status: "loaded",
                    fileName,
                    totalSize: handle.fileSize,
                    entries,
                    tree,
                    error: null,
                    loadMethod: "url",
                    supportsRangeRequests: true,
                    progress: 100,
                    progressMessage: "Done!",
                },
                unzipped: null,
                remoteHandle: handle,
            };
        } catch (rangeErr) {
            // Range parsing failed — fall through to full download
            const msg =
                rangeErr instanceof Error ? rangeErr.message : "Unknown error";
            if (msg === "RANGE_NOT_SUPPORTED") {
                onProgress(
                    10,
                    "Range requests not supported, downloading full file...",
                );
            } else {
                onProgress(
                    10,
                    `Smart parsing failed (${msg}), downloading full file...`,
                );
            }
        }
    }

    // ── Full download path ───────────────────────────────────────────
    onProgress(
        10,
        supportsRange ? "Server supports streaming!" : "Downloading file...",
    );

    try {
        const { state, unzipped } = await fetchAndParseZip(
            fetchBaseUrl,
            fileName,
            onProgress,
            contentLength || undefined,
        );

        // For URL-loaded ZIPs: also create a remoteHandle if the server
        // supports Range requests. This enables the share button (direct
        // download links) even for small ZIPs that were fully downloaded.
        let remoteHandle: RemoteZipHandle | null = null;
        if (supportsRange && contentLength > 0) {
            try {
                remoteHandle = await parseRemoteZip(
                    fetchBaseUrl,
                    () => {}, // silent — no progress needed
                    contentLength,
                );
            } catch {
                // Non-critical — share just won't work
            }
        }

        return { state, unzipped, remoteHandle };
    } catch (fetchErr) {
        const fetchMessage =
            fetchErr instanceof Error ? fetchErr.message : "Unknown error";
        return {
            state: {
                status: "error",
                fileName,
                totalSize: contentLength,
                entries: [],
                tree: { name: "", path: "", isDirectory: true, children: [] },
                error: `Failed to download and parse ZIP: ${fetchMessage}`,
                loadMethod: "url",
                supportsRangeRequests: supportsRange,
                progress: 0,
                progressMessage: "",
            },
            unzipped: null,
            remoteHandle: null,
        };
    }
}

/**
 * Extract a single file from a pre-parsed Unzipped object for preview.
 * No re-parsing needed — uses the already-decompressed data.
 */
export function extractFileForPreview(
    unzipped: Unzipped,
    entryPath: string,
): PreviewState {
    try {
        const data = unzipped[entryPath];

        if (!data) {
            return {
                status: "error",
                entry: null,
                type: "unsupported",
                content: null,
                blobUrl: null,
                error: "File not found in archive",
            };
        }

        const ext = getExtension(entryPath);
        const previewType = getPreviewType(entryPath);
        const mime = MIME_MAP[ext] || "application/octet-stream";

        if (previewType === "text" || previewType === "code") {
            const decoder = new TextDecoder("utf-8");
            const text = decoder.decode(data);
            return {
                status: "loaded",
                entry: null,
                type: previewType,
                content: text,
                blobUrl: null,
                error: null,
            };
        }

        // Office documents — extract text from OOXML (ZIP of XMLs)
        // CSV/TSV — read as text directly for spreadsheet rendering
        if (
            previewType === "document" ||
            previewType === "spreadsheet" ||
            previewType === "presentation"
        ) {
            // CSV/TSV: decode as UTF-8 text, return tab-separated format
            if (ext === ".csv" || ext === ".tsv") {
                const decoder = new TextDecoder("utf-8");
                const text = decoder.decode(data);
                if (ext === ".csv") {
                    // Convert CSV to TSV for consistent rendering
                    const tsvLines = parseCsvToTsv(text);
                    return {
                        status: "loaded",
                        entry: null,
                        type: previewType,
                        content: tsvLines,
                        blobUrl: null,
                        error: null,
                    };
                }
                // TSV is already tab-separated
                return {
                    status: "loaded",
                    entry: null,
                    type: previewType,
                    content: text,
                    blobUrl: null,
                    error: null,
                };
            }

            const content = extractOfficeTextFromData(data, ext);
            if (content !== null) {
                return {
                    status: "loaded",
                    entry: null,
                    type: previewType,
                    content,
                    blobUrl: null,
                    error: null,
                };
            }
            // Fallback: offer download
            return {
                status: "loaded",
                entry: null,
                type: previewType,
                content: null,
                blobUrl: null,
                error: null,
            };
        }

        if (
            previewType === "image" ||
            previewType === "video" ||
            previewType === "audio" ||
            previewType === "pdf" ||
            previewType === "font"
        ) {
            const blob = new Blob([new Uint8Array(data)], { type: mime });
            const blobUrl = URL.createObjectURL(blob);
            return {
                status: "loaded",
                entry: null,
                type: previewType,
                content: null,
                blobUrl,
                error: null,
            };
        }

        return {
            status: "loaded",
            entry: null,
            type: "unsupported",
            content: null,
            blobUrl: null,
            error: null,
        };
    } catch (err) {
        return {
            status: "error",
            entry: null,
            type: "unsupported",
            content: null,
            blobUrl: null,
            error: `Preview failed: ${err instanceof Error ? err.message : "Unknown error"}`,
        };
    }
}

/**
 * Extract human-readable text from Office Open XML files.
 * DOCX, XLSX, PPTX are ZIP archives with XML content inside.
 * Returns structured content (JSON for rich rendering, TSV for spreadsheets).
 */
export function extractOfficeTextFromData(
    fileData: Uint8Array,
    ext: string,
): string | null {
    try {
        const inner = unzipSync(fileData);

        if (ext === ".docx") {
            return extractDocxRich(inner);
        }
        if (ext === ".xlsx") {
            return extractXlsxText(inner);
        }
        if (ext === ".pptx") {
            return extractPptxRich(inner);
        }

        // For .doc, .xls, .ppt (legacy binary), .odt, .rtf — can't easily parse
        return null;
    } catch {
        return null;
    }
}

/**
 * DOCX rich extraction: paragraphs with style info (heading, bold, italic, lists).
 * Returns JSON: Array of { type, level?, runs: [{text, bold, italic, underline}] }
 */
function extractDocxRich(inner: Unzipped): string | null {
    const docXml = inner["word/document.xml"];
    if (!docXml) return null;

    const xml = new TextDecoder().decode(docXml);

    // Also try to read styles to detect heading style names
    const stylesXml = inner["word/styles.xml"];
    const headingStyles = new Set<string>();
    if (stylesXml) {
        const stylesStr = new TextDecoder().decode(stylesXml);
        // Find styles whose name starts with "heading" or "Heading"
        const styleRegex =
            /<w:style[^>]*w:styleId="([^"]*)"[^>]*>[\s\S]*?<\/w:style>/g;
        let sm;
        while ((sm = styleRegex.exec(stylesStr)) !== null) {
            const styleId = sm[1];
            const block = sm[0];
            if (
                /name\s+w:val="[Hh]eading/i.test(block) ||
                /^[Hh]eading\d?$/.test(styleId)
            ) {
                headingStyles.add(styleId);
            }
        }
    }

    interface DocRun {
        text: string;
        bold?: boolean;
        italic?: boolean;
        underline?: boolean;
    }
    interface DocParagraph {
        type: "paragraph" | "heading" | "list-item";
        level?: number;
        runs: DocRun[];
    }

    const paragraphs: DocParagraph[] = [];
    const paraSplits = xml.split(/<w:p[\s>]/);

    for (let i = 1; i < paraSplits.length; i++) {
        const paraBlock = paraSplits[i].split(/<\/w:p>/)[0] || "";

        // Determine paragraph type
        let type: DocParagraph["type"] = "paragraph";
        let level: number | undefined;

        // Check for heading style
        const pStyleMatch = paraBlock.match(/<w:pStyle\s+w:val="([^"]*)"/);
        if (pStyleMatch) {
            const styleId = pStyleMatch[1];
            if (
                headingStyles.has(styleId) ||
                /^[Hh]eading(\d)?$/.test(styleId)
            ) {
                type = "heading";
                const levelMatch = styleId.match(/(\d)$/);
                level = levelMatch ? parseInt(levelMatch[1], 10) : 1;
            }
            // List detection
            if (/^List/i.test(styleId)) {
                type = "list-item";
            }
        }

        // Check for numbering (list items)
        if (/<w:numId/.test(paraBlock)) {
            type = "list-item";
            const ilvlMatch = paraBlock.match(/<w:ilvl\s+w:val="(\d+)"/);
            level = ilvlMatch ? parseInt(ilvlMatch[1], 10) : 0;
        }

        // Extract runs
        const runs: DocRun[] = [];
        const runRegex = /<w:r[\s>]([\s\S]*?)<\/w:r>/g;
        let runMatch;
        while ((runMatch = runRegex.exec(paraBlock)) !== null) {
            const runBlock = runMatch[1];

            // Get run properties
            const bold =
                /<w:b[\s/>]/.test(runBlock) &&
                !/<w:b\s+w:val="(false|0)"/.test(runBlock);
            const italic =
                /<w:i[\s/>]/.test(runBlock) &&
                !/<w:i\s+w:val="(false|0)"/.test(runBlock);
            const underline =
                /<w:u[\s]/.test(runBlock) &&
                !/<w:u\s+w:val="none"/.test(runBlock);

            // Get text
            const textParts: string[] = [];
            const tRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
            let tMatch;
            while ((tMatch = tRegex.exec(runBlock)) !== null) {
                textParts.push(tMatch[1]);
            }
            // Also check for tab and break
            if (/<w:tab\s*\/>/.test(runBlock)) textParts.push("\t");
            if (/<w:br\s*\/>/.test(runBlock)) textParts.push("\n");

            if (textParts.length > 0) {
                runs.push({
                    text: textParts.join(""),
                    ...(bold && { bold: true }),
                    ...(italic && { italic: true }),
                    ...(underline && { underline: true }),
                });
            }
        }

        if (runs.length > 0) {
            paragraphs.push({
                type,
                ...(level !== undefined && { level }),
                runs,
            });
        }
    }

    if (paragraphs.length === 0) return null;
    // Return as JSON — the DocPreview component will parse and render this
    return JSON.stringify(paragraphs);
}

function extractXlsxText(inner: Unzipped): string | null {
    // First get shared strings
    const sharedStringsXml = inner["xl/sharedStrings.xml"];
    const sharedStrings: string[] = [];

    if (sharedStringsXml) {
        const xml = new TextDecoder().decode(sharedStringsXml);
        const siRegex = /<si>([\s\S]*?)<\/si>/g;
        let siMatch;
        while ((siMatch = siRegex.exec(xml)) !== null) {
            const tRegex = /<t[^>]*>([^<]*)<\/t>/g;
            let tMatch;
            const parts: string[] = [];
            while ((tMatch = tRegex.exec(siMatch[1])) !== null) {
                parts.push(tMatch[1]);
            }
            sharedStrings.push(parts.join(""));
        }
    }

    const lines: string[] = [];
    const sheet1 = inner["xl/worksheets/sheet1.xml"];
    if (!sheet1) return null;

    const sheetXml = new TextDecoder().decode(sheet1);
    const rowRegex = /<row[^>]*>([\s\S]*?)<\/row>/g;
    let rowMatch;

    while ((rowMatch = rowRegex.exec(sheetXml)) !== null) {
        const cells: string[] = [];
        const cellRegex =
            /<c[^>]*(?:t="([^"]*)")?[^>]*>[\s\S]*?(?:<v>([^<]*)<\/v>)?[\s\S]*?<\/c>/g;
        let cellMatch;

        while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
            const type = cellMatch[1];
            const value = cellMatch[2] || "";

            if (
                type === "s" &&
                sharedStrings[parseInt(value, 10)] !== undefined
            ) {
                cells.push(sharedStrings[parseInt(value, 10)]);
            } else {
                cells.push(value);
            }
        }

        if (cells.length > 0) {
            lines.push(cells.join("\t"));
        }
    }

    return lines.join("\n") || null;
}

/**
 * PPTX rich extraction: slides with structured text and text-box groupings.
 * Returns JSON: Array of { slideNumber, textBoxes: [{paragraphs: [{text, bold, italic, fontSize}]}] }
 */
function extractPptxRich(inner: Unzipped): string | null {
    interface PptRun {
        text: string;
        bold?: boolean;
        italic?: boolean;
        fontSize?: number;
    }
    interface PptParagraph {
        runs: PptRun[];
    }
    interface PptTextBox {
        paragraphs: PptParagraph[];
    }
    interface PptSlide {
        slideNumber: number;
        textBoxes: PptTextBox[];
    }

    const slides: PptSlide[] = [];

    for (let i = 1; i <= 200; i++) {
        const slideData = inner[`ppt/slides/slide${i}.xml`];
        if (!slideData) break;

        const xml = new TextDecoder().decode(slideData);

        const textBoxes: PptTextBox[] = [];

        // Split by shape tree items that contain text bodies
        const txBodyRegex = /<p:txBody>([\s\S]*?)<\/p:txBody>/g;
        let txMatch;

        while ((txMatch = txBodyRegex.exec(xml)) !== null) {
            const txBody = txMatch[1];
            const paragraphs: PptParagraph[] = [];

            // Split paragraphs
            const paraRegex = /<a:p>([\s\S]*?)<\/a:p>/g;
            let paraMatch;

            while ((paraMatch = paraRegex.exec(txBody)) !== null) {
                const paraContent = paraMatch[1];
                const runs: PptRun[] = [];

                // Extract runs
                const runRegex = /<a:r>([\s\S]*?)<\/a:r>/g;
                let runMatch;

                while ((runMatch = runRegex.exec(paraContent)) !== null) {
                    const runBlock = runMatch[1];

                    const bold = /\bb="1"/.test(runBlock);
                    const italic = /\bi="1"/.test(runBlock);
                    const fontSizeMatch = runBlock.match(/sz="(\d+)"/);
                    const fontSize = fontSizeMatch
                        ? parseInt(fontSizeMatch[1], 10) / 100
                        : undefined;

                    const tMatch = runBlock.match(/<a:t>([^<]*)<\/a:t>/);
                    if (tMatch && tMatch[1].trim()) {
                        runs.push({
                            text: tMatch[1],
                            ...(bold && { bold: true }),
                            ...(italic && { italic: true }),
                            ...(fontSize && { fontSize }),
                        });
                    }
                }

                if (runs.length > 0) {
                    paragraphs.push({ runs });
                }
            }

            if (paragraphs.length > 0) {
                textBoxes.push({ paragraphs });
            }
        }

        if (textBoxes.length > 0) {
            slides.push({ slideNumber: i, textBoxes });
        }
    }

    if (slides.length === 0) return null;
    return JSON.stringify(slides);
}

/**
 * Create a download Blob URL for a single file from the pre-parsed Unzipped object.
 */
export function extractFileForDownload(
    unzipped: Unzipped,
    entryPath: string,
): string | null {
    try {
        const data = unzipped[entryPath];
        if (!data) return null;
        const ext = getExtension(entryPath);
        const mime = MIME_MAP[ext] || "application/octet-stream";
        const blob = new Blob([new Uint8Array(data)], { type: mime });
        return URL.createObjectURL(blob);
    } catch {
        return null;
    }
}

// --- Internal helpers ---

function buildEntries(unzipped: Unzipped): ZipEntry[] {
    const entries: ZipEntry[] = [];

    for (const path of Object.keys(unzipped)) {
        const data = unzipped[path];
        const isDirectory = path.endsWith("/");
        const name = path.split("/").filter(Boolean).pop() || path;

        entries.push({
            path,
            name,
            isDirectory,
            size: data.length,
            compressedSize: data.length, // fflate unzipSync doesn't give compressed size directly
            lastModified: new Date(), // fflate doesn't expose mod times in basic unzip
        });
    }

    return entries;
}

/**
 * Parse CSV text into TSV format (tab-separated) for consistent spreadsheet rendering.
 * Handles quoted fields, embedded commas, and escaped quotes.
 */
export function parseCsvToTsv(csv: string): string {
    const lines: string[] = [];
    const rows = parseCsvRows(csv);
    for (const row of rows) {
        lines.push(row.join("\t"));
    }
    return lines.join("\n");
}

function parseCsvRows(csv: string): string[][] {
    const rows: string[][] = [];
    let i = 0;
    const len = csv.length;

    while (i < len) {
        const row: string[] = [];
        // Parse each field in the row
        while (i < len) {
            if (csv[i] === '"') {
                // Quoted field
                i++; // skip opening quote
                let field = "";
                while (i < len) {
                    if (csv[i] === '"') {
                        if (i + 1 < len && csv[i + 1] === '"') {
                            // Escaped quote
                            field += '"';
                            i += 2;
                        } else {
                            // End of quoted field
                            i++; // skip closing quote
                            break;
                        }
                    } else {
                        field += csv[i];
                        i++;
                    }
                }
                row.push(field);
                // Skip comma or newline after field
                if (i < len && csv[i] === ",") {
                    i++;
                } else if (i < len && (csv[i] === "\n" || csv[i] === "\r")) {
                    if (csv[i] === "\r" && i + 1 < len && csv[i + 1] === "\n")
                        i++;
                    i++;
                    break;
                }
            } else {
                // Unquoted field
                let field = "";
                while (
                    i < len &&
                    csv[i] !== "," &&
                    csv[i] !== "\n" &&
                    csv[i] !== "\r"
                ) {
                    field += csv[i];
                    i++;
                }
                row.push(field);
                if (i < len && csv[i] === ",") {
                    i++;
                } else if (i < len && (csv[i] === "\n" || csv[i] === "\r")) {
                    if (csv[i] === "\r" && i + 1 < len && csv[i + 1] === "\n")
                        i++;
                    i++;
                    break;
                }
            }
        }
        if (row.length > 0) {
            rows.push(row);
        }
    }
    return rows;
}
