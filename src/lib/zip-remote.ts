/**
 * Remote ZIP parser using HTTP Range requests.
 *
 * ZIP files have a Central Directory at the end that lists all entries
 * (names, sizes, compression method, byte offsets) without the actual file data.
 *
 * This module:
 * 1. Fetches only the last ~64KB to find + parse the Central Directory
 * 2. Builds the file listing from that (~KB of transfer for any size ZIP)
 * 3. Fetches individual files on-demand using Range requests when previewing
 *
 * This means a 12GB ZIP only needs ~100KB to display the file tree.
 */

import { inflateSync } from "fflate";
import { ZipEntry, PreviewState, MIME_MAP, FILE_SIZE_LIMITS } from "./types";
import { getExtension, getPreviewType } from "./utils";

/* ── ZIP format constants ─────────────────────────────────── */

const EOCD_SIGNATURE = 0x06054b50;
const EOCD64_SIGNATURE = 0x06064b50;
const EOCD64_LOCATOR_SIGNATURE = 0x07064b50;
const CD_SIGNATURE = 0x02014b50;

const COMPRESSION_STORED = 0;
const COMPRESSION_DEFLATE = 8;

/** A single entry parsed from the Central Directory */
export interface RemoteZipEntry {
    path: string;
    name: string;
    isDirectory: boolean;
    compressedSize: number;
    uncompressedSize: number;
    compressionMethod: number;
    /** Byte offset of the Local File Header in the ZIP */
    localHeaderOffset: number;
    lastModified: Date;
}

/** Handle for fetching individual files from a remote ZIP */
export interface RemoteZipHandle {
    url: string; // The fetch URL (may be proxied)
    fileSize: number;
    entries: RemoteZipEntry[];
    /** Whether we're going through the CORS proxy */
    proxied: boolean;
}

/* ── Helpers ──────────────────────────────────────────────── */

function readU16(buf: Uint8Array, off: number): number {
    return buf[off] | (buf[off + 1] << 8);
}

function readU32(buf: Uint8Array, off: number): number {
    return (
        (buf[off] |
            (buf[off + 1] << 8) |
            (buf[off + 2] << 16) |
            (buf[off + 3] << 24)) >>>
        0
    );
}

function readU64(buf: Uint8Array, off: number): number {
    // JS can handle up to 2^53 safely — good enough for file sizes
    const lo = readU32(buf, off);
    const hi = readU32(buf, off + 4);
    return hi * 0x100000000 + lo;
}

function dosToDate(date: number, time: number): Date {
    return new Date(
        ((date >> 9) & 0x7f) + 1980,
        ((date >> 5) & 0x0f) - 1,
        date & 0x1f,
        (time >> 11) & 0x1f,
        (time >> 5) & 0x3f,
        (time & 0x1f) * 2,
    );
}

/**
 * Fetch a byte range from a URL.
 * Returns the bytes and the total file size (from Content-Range header).
 */
async function fetchRange(
    url: string,
    start: number,
    end: number,
): Promise<{ data: Uint8Array; totalSize: number }> {
    // Handle suffix range (negative start = "last N bytes")
    let rangeValue: string;
    if (start < 0) {
        // Suffix range: "bytes=-65557" means "last 65557 bytes"
        rangeValue = `bytes=${start}`;
    } else {
        rangeValue = `bytes=${start}-${end}`;
    }

    const controller = new AbortController();
    const res = await fetch(url, {
        headers: { Range: rangeValue },
        signal: controller.signal,
    });

    if (res.status === 206) {
        // Partial content — parse total size from Content-Range
        const cr = res.headers.get("content-range") || "";
        const match = cr.match(/\/(\d+)/);
        const totalSize = match ? parseInt(match[1], 10) : 0;
        const buf = new Uint8Array(await res.arrayBuffer());
        return { data: buf, totalSize };
    }

    // Not a 206 — abort to prevent streaming the full file
    controller.abort();

    if (res.ok) {
        // Server ignored Range and sent the whole file
        throw new Error("RANGE_NOT_SUPPORTED");
    }

    throw new Error(`Range request failed: ${res.status} ${res.statusText}`);
}

/* ── Central Directory parsing ────────────────────────────── */

/**
 * Find the End of Central Directory record in a buffer.
 * The EOCD is at least 22 bytes and can have a variable-length comment.
 */
function findEOCD(buf: Uint8Array): number {
    // Search backwards for the EOCD signature
    for (let i = buf.length - 22; i >= 0 && i >= buf.length - 65557; i--) {
        if (readU32(buf, i) === EOCD_SIGNATURE) {
            return i;
        }
    }
    return -1;
}

/**
 * Parse the Central Directory from a remote ZIP using range requests.
 * @param url - The URL to fetch from (may be proxied)
 * @param onProgress - Optional progress callback
 * @param knownFileSize - If we already know the file size from a HEAD, pass it to skip extra requests
 */
export async function parseRemoteZip(
    url: string,
    onProgress?: (msg: string) => void,
    knownFileSize?: number,
): Promise<RemoteZipHandle> {
    onProgress?.("Fetching ZIP metadata...");

    // Step 1: Fetch the last 64KB to find the EOCD
    // (EOCD is at least 22 bytes, comment can be up to 65535 bytes)
    const tailSize = 65557;
    let tailData: Uint8Array;
    let fileSize: number;

    if (knownFileSize && knownFileSize > 0) {
        // We already know the file size — go straight to absolute range
        fileSize = knownFileSize;
        const start = Math.max(0, fileSize - tailSize);
        const result = await fetchRange(url, start, fileSize - 1);
        tailData = result.data;
        // Update fileSize from Content-Range if available (more accurate)
        if (result.totalSize > 0) fileSize = result.totalSize;
    } else {
        // Don't know file size — try suffix range first, then HEAD + absolute
        try {
            const result = await fetchRange(url, -tailSize, -1);
            tailData = result.data;
            fileSize = result.totalSize;
        } catch {
            // Try absolute range: first need file size via HEAD
            try {
                const headRes = await fetch(url, { method: "HEAD" });
                const cl = headRes.headers.get("content-length");
                if (!cl) throw new Error("Cannot determine file size");
                fileSize = parseInt(cl, 10);

                const start = Math.max(0, fileSize - tailSize);
                const result = await fetchRange(url, start, fileSize - 1);
                tailData = result.data;
            } catch (err) {
                if (
                    err instanceof Error &&
                    err.message === "RANGE_NOT_SUPPORTED"
                ) {
                    throw new Error("RANGE_NOT_SUPPORTED");
                }
                throw err;
            }
        }
    }

    onProgress?.("Parsing ZIP structure...");

    // Step 2: Find the EOCD
    const eocdOffset = findEOCD(tailData);
    if (eocdOffset === -1) {
        throw new Error(
            "Not a valid ZIP file — could not find End of Central Directory",
        );
    }

    // Step 3: Read EOCD fields
    let cdOffset: number;
    let cdSize: number;
    let totalEntries: number;

    // Check for ZIP64
    const eocd64LocatorPos = eocdOffset - 20;
    const isZip64 =
        eocd64LocatorPos >= 0 &&
        readU32(tailData, eocd64LocatorPos) === EOCD64_LOCATOR_SIGNATURE;

    if (isZip64) {
        // Read ZIP64 EOCD locator to find the ZIP64 EOCD record
        const eocd64AbsOffset = readU64(tailData, eocd64LocatorPos + 8);

        // We may need to fetch the ZIP64 EOCD record if it's not in our tail buffer
        const tailStartInFile = fileSize - tailData.length;
        const eocd64RelOffset = eocd64AbsOffset - tailStartInFile;

        let eocd64Buf: Uint8Array;
        if (eocd64RelOffset >= 0 && eocd64RelOffset + 56 <= tailData.length) {
            eocd64Buf = tailData;
        } else {
            // Need to fetch it
            const result = await fetchRange(
                url,
                Number(eocd64AbsOffset),
                Number(eocd64AbsOffset) + 55,
            );
            eocd64Buf = result.data;
        }

        const eocd64Off = eocd64RelOffset >= 0 ? eocd64RelOffset : 0;
        if (readU32(eocd64Buf, eocd64Off) !== EOCD64_SIGNATURE) {
            throw new Error("Invalid ZIP64 EOCD record");
        }

        totalEntries = readU64(eocd64Buf, eocd64Off + 32);
        cdSize = readU64(eocd64Buf, eocd64Off + 40);
        cdOffset = readU64(eocd64Buf, eocd64Off + 48);
    } else {
        // Standard EOCD
        totalEntries = readU16(tailData, eocdOffset + 10);
        cdSize = readU32(tailData, eocdOffset + 12);
        cdOffset = readU32(tailData, eocdOffset + 16);
    }

    onProgress?.(`Found ${totalEntries} entries, fetching directory...`);

    // Step 4: Fetch the Central Directory if it's not already in our tail buffer
    const tailStartInFile = fileSize - tailData.length;
    let cdBuf: Uint8Array;
    let cdBufStart: number; // absolute file offset of cdBuf[0]

    if (cdOffset >= tailStartInFile && cdOffset + cdSize <= fileSize) {
        // CD is within our tail buffer
        const relStart = cdOffset - tailStartInFile;
        cdBuf = tailData.subarray(relStart, relStart + cdSize);
        cdBufStart = cdOffset;
    } else {
        // Need to fetch the CD separately
        const result = await fetchRange(url, cdOffset, cdOffset + cdSize - 1);
        cdBuf = result.data;
        cdBufStart = cdOffset;
    }

    // Step 5: Parse CD entries
    const entries: RemoteZipEntry[] = [];
    let pos = 0;

    for (let i = 0; i < totalEntries && pos + 46 <= cdBuf.length; i++) {
        const sig = readU32(cdBuf, pos);
        if (sig !== CD_SIGNATURE) break;

        const compressionMethod = readU16(cdBuf, pos + 10);
        const modTime = readU16(cdBuf, pos + 12);
        const modDate = readU16(cdBuf, pos + 14);
        let compressedSize = readU32(cdBuf, pos + 20);
        let uncompressedSize = readU32(cdBuf, pos + 24);
        const fileNameLen = readU16(cdBuf, pos + 28);
        const extraLen = readU16(cdBuf, pos + 30);
        const commentLen = readU16(cdBuf, pos + 32);
        let localHeaderOffset = readU32(cdBuf, pos + 42);

        const fileNameBytes = cdBuf.subarray(pos + 46, pos + 46 + fileNameLen);
        const path = new TextDecoder().decode(fileNameBytes);

        // ZIP64 extra field handling
        if (
            compressedSize === 0xffffffff ||
            uncompressedSize === 0xffffffff ||
            localHeaderOffset === 0xffffffff
        ) {
            // Parse ZIP64 extended information extra field
            const extraStart = pos + 46 + fileNameLen;
            const extraEnd = extraStart + extraLen;
            let ePos = extraStart;
            while (ePos + 4 <= extraEnd) {
                const headerId = readU16(cdBuf, ePos);
                const dataSize = readU16(cdBuf, ePos + 2);
                if (headerId === 0x0001) {
                    // ZIP64 extended info
                    let fieldOff = ePos + 4;
                    if (
                        uncompressedSize === 0xffffffff &&
                        fieldOff + 8 <= ePos + 4 + dataSize
                    ) {
                        uncompressedSize = readU64(cdBuf, fieldOff);
                        fieldOff += 8;
                    }
                    if (
                        compressedSize === 0xffffffff &&
                        fieldOff + 8 <= ePos + 4 + dataSize
                    ) {
                        compressedSize = readU64(cdBuf, fieldOff);
                        fieldOff += 8;
                    }
                    if (
                        localHeaderOffset === 0xffffffff &&
                        fieldOff + 8 <= ePos + 4 + dataSize
                    ) {
                        localHeaderOffset = readU64(cdBuf, fieldOff);
                    }
                    break;
                }
                ePos += 4 + dataSize;
            }
        }

        const isDirectory = path.endsWith("/");
        const name = path.split("/").filter(Boolean).pop() || path;

        entries.push({
            path,
            name,
            isDirectory,
            compressedSize,
            uncompressedSize,
            compressionMethod,
            localHeaderOffset,
            lastModified: dosToDate(modDate, modTime),
        });

        pos += 46 + fileNameLen + extraLen + commentLen;
    }

    onProgress?.(`Parsed ${entries.length} entries`);

    return {
        url,
        fileSize,
        entries,
        proxied: url.startsWith("/api/proxy"),
    };
}

/**
 * Convert RemoteZipEntry[] to ZipEntry[] for the UI.
 */
export function remoteEntriesToZipEntries(
    entries: RemoteZipEntry[],
): ZipEntry[] {
    return entries.map((e) => ({
        path: e.path,
        name: e.name,
        isDirectory: e.isDirectory,
        size: e.uncompressedSize,
        compressedSize: e.compressedSize,
        lastModified: e.lastModified,
    }));
}

/**
 * Fetch and decompress a single file from a remote ZIP on-demand.
 * Only downloads the exact bytes needed for that one file.
 */
export async function extractRemoteFile(
    handle: RemoteZipHandle,
    entryPath: string,
): Promise<PreviewState> {
    const entry = handle.entries.find((e) => e.path === entryPath);
    if (!entry) {
        return {
            status: "error",
            entry: null,
            type: "unsupported",
            content: null,
            blobUrl: null,
            error: "File not found in archive",
        };
    }

    if (entry.isDirectory) {
        return {
            status: "loaded",
            entry: null,
            type: "unsupported",
            content: null,
            blobUrl: null,
            error: null,
        };
    }

    if (entry.uncompressedSize > FILE_SIZE_LIMITS.PREVIEW) {
        return {
            status: "error",
            entry: null,
            type: "unsupported",
            content: null,
            blobUrl: null,
            error: `File too large for preview (${(entry.uncompressedSize / 1024 / 1024).toFixed(1)}MB). Download instead.`,
        };
    }

    if (
        entry.compressionMethod !== COMPRESSION_STORED &&
        entry.compressionMethod !== COMPRESSION_DEFLATE
    ) {
        return {
            status: "error",
            entry: null,
            type: "unsupported",
            content: null,
            blobUrl: null,
            error: `Unsupported compression method (${entry.compressionMethod}). Download the file instead.`,
        };
    }

    try {
        // Step 1: Read the Local File Header to get the actual data offset
        // Local File Header is 30 bytes + variable filename + extra field
        // We read 30 + 256 bytes to cover the variable part
        const lfhSize = 30 + 512;
        const { data: lfhBuf } = await fetchRange(
            handle.url,
            entry.localHeaderOffset,
            entry.localHeaderOffset + lfhSize - 1,
        );

        // Verify Local File Header signature
        const lfhSig = readU32(lfhBuf, 0);
        if (lfhSig !== 0x04034b50) {
            throw new Error("Invalid Local File Header");
        }

        const lfhFileNameLen = readU16(lfhBuf, 26);
        const lfhExtraLen = readU16(lfhBuf, 28);
        const dataStart =
            entry.localHeaderOffset + 30 + lfhFileNameLen + lfhExtraLen;
        const dataEnd = dataStart + entry.compressedSize - 1;

        // Step 2: Fetch the compressed file data
        const { data: compressedData } = await fetchRange(
            handle.url,
            dataStart,
            dataEnd,
        );

        // Step 3: Decompress if needed
        let fileData: Uint8Array;
        if (entry.compressionMethod === COMPRESSION_STORED) {
            fileData = compressedData;
        } else {
            // DEFLATE
            fileData = inflateSync(compressedData, {
                out: new Uint8Array(entry.uncompressedSize),
            });
        }

        // Step 4: Build PreviewState (same logic as extractFileForPreview)
        const ext = getExtension(entryPath);
        const previewType = getPreviewType(entryPath);
        const mime = MIME_MAP[ext] || "application/octet-stream";

        if (previewType === "text" || previewType === "code") {
            return {
                status: "loaded",
                entry: null,
                type: previewType,
                content: new TextDecoder("utf-8").decode(fileData),
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
            const blob = new Blob([fileData as BlobPart], { type: mime });
            return {
                status: "loaded",
                entry: null,
                type: previewType,
                content: null,
                blobUrl: URL.createObjectURL(blob),
                error: null,
            };
        }

        // For document/spreadsheet/presentation — handle OOXML and CSV/TSV
        if (
            previewType === "document" ||
            previewType === "spreadsheet" ||
            previewType === "presentation"
        ) {
            // CSV/TSV: decode as text directly
            if (ext === ".csv" || ext === ".tsv") {
                const text = new TextDecoder("utf-8").decode(fileData);
                if (ext === ".csv") {
                    // Convert CSV to TSV for consistent rendering (import from zip-handler)
                    const { parseCsvToTsv } = await import("./zip-handler");
                    return {
                        status: "loaded",
                        entry: null,
                        type: previewType,
                        content: parseCsvToTsv(text),
                        blobUrl: null,
                        error: null,
                    };
                }
                return {
                    status: "loaded",
                    entry: null,
                    type: previewType,
                    content: text,
                    blobUrl: null,
                    error: null,
                };
            }

            // OOXML (DOCX/XLSX/PPTX) and similar ZIP-based formats:
            // These are ZIP-inside-ZIP — use unzipSync + extractOfficeText from zip-handler
            if (
                [
                    ".docx",
                    ".xlsx",
                    ".pptx",
                    ".pages",
                    ".numbers",
                    ".key",
                ].includes(ext)
            ) {
                try {
                    const { extractOfficeTextFromData } =
                        await import("./zip-handler");
                    const content = extractOfficeTextFromData(fileData, ext);
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
                } catch {
                    // Fall through to download
                }
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

        // Fallback: create blob URL for download
        const blob = new Blob([fileData as BlobPart], { type: mime });
        return {
            status: "loaded",
            entry: null,
            type: previewType,
            content: null,
            blobUrl: URL.createObjectURL(blob),
            error: null,
        };
    } catch (err) {
        return {
            status: "error",
            entry: null,
            type: "unsupported",
            content: null,
            blobUrl: null,
            error: `Failed to fetch file: ${err instanceof Error ? err.message : "Unknown error"}`,
        };
    }
}

/**
 * Size limit for in-browser extraction download (100MB).
 * Files larger than this should be streamed directly.
 */
const DOWNLOAD_SIZE_LIMIT = 100 * 1024 * 1024;

/**
 * Create a download URL for a single file from a remote ZIP.
 *
 * For small files: fetches, decompresses, returns a blob URL.
 * For large STORED files: returns a proxy URL with Range header that the browser can download directly.
 * For large DEFLATE files: returns null (too large to decompress in browser).
 */
export async function downloadRemoteFile(
    handle: RemoteZipHandle,
    entryPath: string,
): Promise<string | null> {
    const entry = handle.entries.find((e) => e.path === entryPath);
    if (!entry || entry.isDirectory) return null;

    try {
        // Step 1: Read the Local File Header to get the actual data offset
        const lfhSize = 30 + 512;
        const { data: lfhBuf } = await fetchRange(
            handle.url,
            entry.localHeaderOffset,
            entry.localHeaderOffset + lfhSize - 1,
        );

        const lfhFileNameLen = readU16(lfhBuf, 26);
        const lfhExtraLen = readU16(lfhBuf, 28);
        const dataStart =
            entry.localHeaderOffset + 30 + lfhFileNameLen + lfhExtraLen;

        // Step 2: For large STORED files, stream directly via proxy
        if (entry.compressedSize > DOWNLOAD_SIZE_LIMIT) {
            if (entry.compressionMethod === COMPRESSION_STORED) {
                // STORED = no compression. We can stream the raw bytes directly
                // via the proxy with start/end query params.
                const dataEnd = dataStart + entry.compressedSize - 1;
                const fileName = entry.name;
                // Build a URL the browser can navigate to for direct download
                const separator = handle.url.includes("?") ? "&" : "?";
                return `__STREAM__${handle.url}${separator}start=${dataStart}&end=${dataEnd}&download=${encodeURIComponent(fileName)}`;
            }
            // DEFLATE + too large = can't decompress in browser
            return null;
        }

        // Step 3: Small enough — fetch and decompress in browser
        const dataEnd = dataStart + entry.compressedSize - 1;
        const { data: compressedData } = await fetchRange(
            handle.url,
            dataStart,
            dataEnd,
        );

        let fileData: Uint8Array;
        if (entry.compressionMethod === COMPRESSION_STORED) {
            fileData = compressedData;
        } else if (entry.compressionMethod === COMPRESSION_DEFLATE) {
            fileData = inflateSync(compressedData, {
                out: new Uint8Array(entry.uncompressedSize),
            });
        } else {
            return null;
        }

        const ext = getExtension(entryPath);
        const mime = MIME_MAP[ext] || "application/octet-stream";
        const blob = new Blob([fileData as BlobPart], { type: mime });
        return URL.createObjectURL(blob);
    } catch {
        return null;
    }
}

/**
 * Fetch and decompress a single file from a remote ZIP, returning raw Uint8Array.
 * Used by surgical extraction to build a new ZIP from selected remote files.
 */
export async function extractRemoteFileRaw(
    handle: RemoteZipHandle,
    entryPath: string,
): Promise<Uint8Array | null> {
    const entry = handle.entries.find((e) => e.path === entryPath);
    if (!entry || entry.isDirectory) return null;

    if (
        entry.compressionMethod !== COMPRESSION_STORED &&
        entry.compressionMethod !== COMPRESSION_DEFLATE
    ) {
        return null;
    }

    try {
        const lfhSize = 30 + 512;
        const { data: lfhBuf } = await fetchRange(
            handle.url,
            entry.localHeaderOffset,
            entry.localHeaderOffset + lfhSize - 1,
        );

        const lfhFileNameLen = readU16(lfhBuf, 26);
        const lfhExtraLen = readU16(lfhBuf, 28);
        const dataStart =
            entry.localHeaderOffset + 30 + lfhFileNameLen + lfhExtraLen;
        const dataEnd = dataStart + entry.compressedSize - 1;

        const { data: compressedData } = await fetchRange(
            handle.url,
            dataStart,
            dataEnd,
        );

        if (entry.compressionMethod === COMPRESSION_STORED) {
            return compressedData;
        }

        return inflateSync(compressedData, {
            out: new Uint8Array(entry.uncompressedSize),
        });
    } catch {
        return null;
    }
}

/**
 * Build a streaming proxy URL for a STORED media file inside a remote ZIP.
 * This allows <video> and <audio> elements to stream directly from the
 * proxy with Range request support (seeking, buffering, etc.).
 *
 * Uses the proxy's media streaming mode which translates the browser's
 * Range requests (relative to the virtual file) into absolute byte ranges
 * within the upstream ZIP file.
 *
 * Returns null if the entry is not STORED or not found.
 */
export async function getStreamingMediaUrl(
    handle: RemoteZipHandle,
    entryPath: string,
): Promise<string | null> {
    const entry = handle.entries.find((e) => e.path === entryPath);
    if (!entry || entry.isDirectory) return null;

    // Only STORED files can be streamed directly — DEFLATE needs decompression
    if (entry.compressionMethod !== COMPRESSION_STORED) return null;

    try {
        // Read Local File Header to find data offset
        const lfhSize = 30 + 512;
        const { data: lfhBuf } = await fetchRange(
            handle.url,
            entry.localHeaderOffset,
            entry.localHeaderOffset + lfhSize - 1,
        );

        const lfhSig = readU32(lfhBuf, 0);
        if (lfhSig !== 0x04034b50) return null;

        const lfhFileNameLen = readU16(lfhBuf, 26);
        const lfhExtraLen = readU16(lfhBuf, 28);
        const dataStart =
            entry.localHeaderOffset + 30 + lfhFileNameLen + lfhExtraLen;
        const dataEnd = dataStart + entry.compressedSize - 1;

        // Determine MIME type for the Content-Type header
        const ext = getExtension(entryPath);
        const mimeType = MIME_MAP[ext] || "application/octet-stream";

        // Build proxy URL with media streaming mode
        // The proxy will translate browser Range requests into ZIP byte ranges
        const separator = handle.url.includes("?") ? "&" : "?";
        return `${handle.url}${separator}start=${dataStart}&end=${dataEnd}&media=1&type=${encodeURIComponent(mimeType)}`;
    } catch {
        return null;
    }
}

/**
 * Build a direct download URL for a file inside a remote ZIP.
 * This generates a shareable proxy link that anyone can use to download
 * the individual file directly.
 *
 * For STORED files: uses start/end/download params (raw byte serving).
 * For DEFLATE files: uses start/end/download/inflate=1&size=N params
 *   so the proxy fetches compressed bytes and decompresses server-side.
 *
 * Returns null if the compression method is unsupported or the entry is not found.
 */
export async function getDirectFileUrl(
    handle: RemoteZipHandle,
    entryPath: string,
): Promise<string | null> {
    const entry = handle.entries.find((e) => e.path === entryPath);
    if (!entry || entry.isDirectory) return null;

    // Only STORED and DEFLATE are supported
    if (
        entry.compressionMethod !== COMPRESSION_STORED &&
        entry.compressionMethod !== COMPRESSION_DEFLATE
    ) {
        return null;
    }

    try {
        // Read Local File Header to find data offset
        const lfhSize = 30 + 512;
        const { data: lfhBuf } = await fetchRange(
            handle.url,
            entry.localHeaderOffset,
            entry.localHeaderOffset + lfhSize - 1,
        );

        const lfhSig = readU32(lfhBuf, 0);
        if (lfhSig !== 0x04034b50) return null;

        const lfhFileNameLen = readU16(lfhBuf, 26);
        const lfhExtraLen = readU16(lfhBuf, 28);
        const dataStart =
            entry.localHeaderOffset + 30 + lfhFileNameLen + lfhExtraLen;
        const dataEnd = dataStart + entry.compressedSize - 1;

        // Build an absolute proxy URL with start/end/download params
        const separator = handle.url.includes("?") ? "&" : "?";
        let shareUrl = `${handle.url}${separator}start=${dataStart}&end=${dataEnd}&download=${encodeURIComponent(entry.name)}`;

        // For DEFLATE files, add inflate flag so the proxy decompresses server-side
        if (entry.compressionMethod === COMPRESSION_DEFLATE) {
            shareUrl += `&inflate=1&size=${entry.uncompressedSize}`;
        }

        return shareUrl;
    } catch {
        return null;
    }
}
