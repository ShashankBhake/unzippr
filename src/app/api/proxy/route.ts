import { NextRequest, NextResponse } from "next/server";
import { inflateRaw } from "zlib";
import { promisify } from "util";

const inflateRawAsync = promisify(inflateRaw);

/**
 * CORS proxy for fetching ZIP files from URLs that don't support CORS.
 * Supports Range requests — forwards the Range header to upstream and streams back.
 * Also supports HEAD requests for checking file size and range support.
 *
 * Usage:
 *   GET  /api/proxy?url=https://example.com/file.zip
 *   GET  /api/proxy?url=...  (with Range header for partial content)
 *   HEAD /api/proxy?url=...  (to check size + range support)
 */

function validateUrl(url: string | null): string {
    if (!url) throw new Error("Missing 'url' query parameter");
    // Try to parse — but be lenient with special chars like [ ] in paths
    // which are common in file index URLs
    try {
        const parsed = new URL(url);
        if (!["http:", "https:"].includes(parsed.protocol)) {
            throw new Error("Invalid protocol — must be HTTP or HTTPS");
        }
    } catch (e) {
        // If URL() rejects it, try encoding brackets and retrying
        const sanitized = url.replace(/\[/g, "%5B").replace(/\]/g, "%5D");
        try {
            const parsed = new URL(sanitized);
            if (!["http:", "https:"].includes(parsed.protocol)) {
                throw new Error("Invalid protocol — must be HTTP or HTTPS");
            }
            return sanitized;
        } catch {
            throw new Error(`Invalid URL: ${(e as Error).message}`);
        }
    }
    return url;
}

const UPSTREAM_HEADERS: HeadersInit = {
    "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    Accept: "*/*",
    "Accept-Language": "en-US,en;q=0.9",
};

function corsHeaders(upstream: Response, isHeadRequest = false): Headers {
    const headers = new Headers();
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set(
        "Access-Control-Expose-Headers",
        "Content-Length, Content-Range, Accept-Ranges, Content-Disposition, X-File-Size, X-Range-Support",
    );
    // Forward relevant upstream headers
    for (const key of [
        "content-type",
        "content-length",
        "content-range",
        "accept-ranges",
        "content-disposition",
    ]) {
        const val = upstream.headers.get(key);
        if (val) headers.set(key, val);
    }
    const contentRange = upstream.headers.get("content-range");
    if (contentRange) {
        // A Content-Range header means the server supports range requests
        if (!headers.has("Accept-Ranges")) {
            headers.set("Accept-Ranges", "bytes");
        }
        // For HEAD requests: override Content-Length with the TOTAL file size
        // so the client knows how big the file is.
        // For GET requests: DON'T override — the upstream Content-Length is
        // already correct for the actual range body being returned.
        if (isHeadRequest) {
            const match = contentRange.match(/\/(\d+)/);
            if (match) {
                headers.set("Content-Length", match[1]);
            }
        }
    }
    if (!headers.has("Content-Type")) {
        headers.set("Content-Type", "application/octet-stream");
    }
    return headers;
}

/** Handle CORS preflight */
export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
            "Access-Control-Allow-Headers": "Range",
            "Access-Control-Expose-Headers":
                "Content-Length, Content-Range, Accept-Ranges, Content-Disposition, X-File-Size, X-Range-Support",
            "Access-Control-Max-Age": "86400",
        },
    });
}

/** HEAD — check file size and range support without downloading */
export async function HEAD(request: NextRequest) {
    const rawUrl = request.nextUrl.searchParams.get("url");
    let url: string;
    try {
        url = validateUrl(rawUrl);
    } catch (err) {
        return NextResponse.json(
            { error: (err as Error).message },
            { status: 400 },
        );
    }

    try {
        // Build Referer from the target URL's origin
        const headHeaders: Record<string, string> = {
            ...(UPSTREAM_HEADERS as Record<string, string>),
        };
        try {
            const parsed = new URL(url);
            headHeaders["Referer"] = parsed.origin + "/";
        } catch {
            /* ignore */
        }

        // Try HEAD first (with timeout)
        const headController = new AbortController();
        const headTimeout = setTimeout(() => headController.abort(), 10000);
        let response: Response;
        try {
            response = await fetch(url, {
                method: "HEAD",
                redirect: "follow",
                signal: headController.signal,
                headers: headHeaders,
            });
        } finally {
            clearTimeout(headTimeout);
        }

        console.log(
            "[proxy HEAD] upstream HEAD status:",
            response.status,
            "headers:",
            Object.fromEntries(response.headers.entries()),
        );

        // Many file servers (GoIndex, CF Workers, etc.) don't support HEAD properly.
        // Fall back to a ranged GET (just 1 byte) to get headers.
        let rangeProven = false;
        if (!response.ok) {
            // HEAD failed entirely — try ranged GET instead
            const fallbackController = new AbortController();
            const fallbackTimeout = setTimeout(
                () => fallbackController.abort(),
                10000,
            );
            try {
                response = await fetch(url, {
                    method: "GET",
                    redirect: "follow",
                    signal: fallbackController.signal,
                    headers: {
                        ...headHeaders,
                        Range: "bytes=0-0",
                    },
                });
            } finally {
                clearTimeout(fallbackTimeout);
            }
            console.log(
                "[proxy HEAD] fallback GET status:",
                response.status,
                "headers:",
                Object.fromEntries(response.headers.entries()),
            );
            if (response.status === 206) {
                rangeProven = true;
            }
            // Abort to prevent streaming full file if server ignored Range
            fallbackController.abort();
        } else if (!response.headers.get("accept-ranges")) {
            // HEAD succeeded but didn't advertise Accept-Ranges.
            // Do a quick range probe to check if ranges actually work.
            try {
                const probeController = new AbortController();
                const probeTimeout = setTimeout(
                    () => probeController.abort(),
                    5000,
                );
                const probeRes = await fetch(url, {
                    method: "GET",
                    redirect: "follow",
                    signal: probeController.signal,
                    headers: {
                        ...headHeaders,
                        Range: "bytes=0-0",
                    },
                });
                clearTimeout(probeTimeout);
                console.log(
                    "[proxy HEAD] range probe status:",
                    probeRes.status,
                );
                if (probeRes.status === 206) {
                    rangeProven = true;
                }
                // Immediately abort to prevent streaming the full file
                probeController.abort();
            } catch {
                /* probe failed or timed out, that's fine */
            }
        }

        if (!response.ok && response.status !== 206) {
            return NextResponse.json(
                {
                    error: `Upstream: ${response.status} ${response.statusText}`,
                },
                { status: 502 },
            );
        }

        // Drain the body to avoid leaking resources
        try {
            await response.body?.cancel();
        } catch {
            /* ignore */
        }

        const hdrs = corsHeaders(response, true); // isHeadRequest = true
        // If the fallback ranged GET returned 206, that proves range support
        // even if the server didn't explicitly send Accept-Ranges: bytes
        const hasRangeSupport =
            rangeProven || response.headers.get("accept-ranges") === "bytes";
        if (hasRangeSupport) {
            hdrs.set("Accept-Ranges", "bytes");
        }

        // Set custom headers as fallback — Next.js sometimes strips Content-Length from HEAD
        const fileSize = hdrs.get("Content-Length");
        if (fileSize) {
            hdrs.set("X-File-Size", fileSize);
        }
        if (hasRangeSupport) {
            hdrs.set("X-Range-Support", "true");
        }

        console.log(
            "[proxy HEAD] returning headers:",
            Object.fromEntries(hdrs.entries()),
        );

        return new NextResponse(null, {
            status: 200,
            headers: hdrs,
        });
    } catch (err) {
        return NextResponse.json(
            { error: `HEAD failed: ${(err as Error).message}` },
            { status: 502 },
        );
    }
}

/** GET — stream full file or partial content (range request) */
export async function GET(request: NextRequest) {
    const rawUrl = request.nextUrl.searchParams.get("url");
    let url: string;
    try {
        url = validateUrl(rawUrl);
    } catch (err) {
        return NextResponse.json(
            { error: (err as Error).message },
            { status: 400 },
        );
    }

    try {
        // Build upstream request headers
        const upstreamHeaders: Record<string, string> = {
            ...(UPSTREAM_HEADERS as Record<string, string>),
        };

        // Set Referer to the origin of the target URL (many index servers check this)
        try {
            const parsed = new URL(url);
            upstreamHeaders["Referer"] = parsed.origin + "/";
        } catch {
            /* ignore */
        }

        // Forward Range header if present (for partial content / Central Directory reads)
        const rangeHeader = request.headers.get("range");
        // Also support range via query params (for browser-navigated downloads)
        const qStart = request.nextUrl.searchParams.get("start");
        const qEnd = request.nextUrl.searchParams.get("end");
        const downloadName = request.nextUrl.searchParams.get("download");
        // Media streaming mode: maps browser Range requests into sub-ranges
        const mediaMode = request.nextUrl.searchParams.get("media") === "1";

        // MEDIA STREAMING MODE
        // When media=1 is set along with start/end, the proxy acts as a virtual
        // file server. The browser's <video>/<audio> element sends Range requests
        // relative to the virtual file (0 to fileSize). We translate those into
        // absolute byte ranges within the upstream ZIP file.
        if (mediaMode && qStart && qEnd) {
            const dataStart = parseInt(qStart, 10);
            const dataEnd = parseInt(qEnd, 10);
            const virtualFileSize = dataEnd - dataStart + 1;

            // Determine the mime type from the optional type param
            const mimeType =
                request.nextUrl.searchParams.get("type") ||
                "application/octet-stream";

            // Parse the browser's Range header (e.g. "bytes=0-999")
            let reqStart = 0;
            let reqEnd = virtualFileSize - 1;

            if (rangeHeader) {
                const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
                if (match) {
                    if (match[1] !== "") reqStart = parseInt(match[1], 10);
                    if (match[2] !== "") reqEnd = parseInt(match[2], 10);

                    // Clamp to virtual file bounds
                    reqEnd = Math.min(reqEnd, virtualFileSize - 1);
                }
            }

            // Translate to absolute upstream range
            const absStart = dataStart + reqStart;
            const absEnd = dataStart + reqEnd;

            upstreamHeaders["Range"] = `bytes=${absStart}-${absEnd}`;
            console.log(
                `[proxy media] virtual=${reqStart}-${reqEnd}/${virtualFileSize} → upstream=${absStart}-${absEnd}`,
            );

            const response = await fetch(url, {
                redirect: "follow",
                headers: upstreamHeaders,
            });

            if (!response.ok && response.status !== 206) {
                return NextResponse.json(
                    {
                        error: `Upstream: ${response.status} ${response.statusText}`,
                    },
                    { status: 502 },
                );
            }

            const chunkSize = reqEnd - reqStart + 1;

            // Build response headers for the browser's media element
            const mediaHeaders = new Headers();
            mediaHeaders.set("Access-Control-Allow-Origin", "*");
            mediaHeaders.set(
                "Access-Control-Expose-Headers",
                "Content-Length, Content-Range, Accept-Ranges",
            );
            mediaHeaders.set("Accept-Ranges", "bytes");
            mediaHeaders.set("Content-Type", mimeType);
            mediaHeaders.set("Content-Length", String(chunkSize));
            mediaHeaders.set(
                "Content-Range",
                `bytes ${reqStart}-${reqEnd}/${virtualFileSize}`,
            );
            // Allow caching of media chunks
            mediaHeaders.set(
                "Cache-Control",
                "public, max-age=3600, immutable",
            );

            if (rangeHeader) {
                return new NextResponse(response.body, {
                    status: 206,
                    headers: mediaHeaders,
                });
            }

            // No Range header = full file request (initial load)
            mediaHeaders.delete("Content-Range");
            mediaHeaders.set("Content-Length", String(virtualFileSize));
            return new NextResponse(response.body, {
                status: 200,
                headers: mediaHeaders,
            });
        }

        if (rangeHeader) {
            upstreamHeaders["Range"] = rangeHeader;
            console.log("[proxy GET] forwarding Range:", rangeHeader);
        } else if (qStart && qEnd) {
            upstreamHeaders["Range"] = `bytes=${qStart}-${qEnd}`;
            console.log("[proxy GET] query range:", `bytes=${qStart}-${qEnd}`);
        }

        const response = await fetch(url, {
            redirect: "follow",
            headers: upstreamHeaders,
        });

        if (rangeHeader || (qStart && qEnd)) {
            console.log(
                "[proxy GET] upstream response:",
                response.status,
                "content-range:",
                response.headers.get("content-range"),
            );
        }

        if (!response.ok && response.status !== 206) {
            let detail = `${response.status} ${response.statusText}`;
            try {
                const ct = response.headers.get("content-type") || "";
                if (ct.includes("application/json")) {
                    const body = await response.json();
                    if (body.error) detail = body.error;
                }
            } catch {
                /* ignore */
            }
            return NextResponse.json(
                { error: `Upstream: ${detail}` },
                { status: 502 },
            );
        }

        const respHeaders = corsHeaders(response);

        // If this is a browser-navigated download with query range,
        // return 200 (not 206) so the browser treats it as a full download,
        // and set Content-Disposition to trigger save dialog
        if (qStart && qEnd && downloadName) {
            const shouldInflate =
                request.nextUrl.searchParams.get("inflate") === "1";
            const expectedSize = parseInt(
                request.nextUrl.searchParams.get("size") || "0",
                10,
            );

            if (shouldInflate) {
                // DEFLATE mode: fetch compressed bytes, decompress server-side
                // using raw inflate (ZIP uses raw DEFLATE, no zlib header),
                // then send the decompressed result as a download
                try {
                    const compressedBuf = await response.arrayBuffer();
                    const decompressed = await inflateRawAsync(
                        Buffer.from(compressedBuf),
                    );

                    const dlHeaders = new Headers();
                    dlHeaders.set("Access-Control-Allow-Origin", "*");
                    dlHeaders.set(
                        "Content-Disposition",
                        `attachment; filename="${encodeURIComponent(downloadName)}"`,
                    );
                    dlHeaders.set(
                        "Content-Length",
                        String(decompressed.length),
                    );
                    dlHeaders.set("Content-Type", "application/octet-stream");

                    return new NextResponse(decompressed, {
                        status: 200,
                        headers: dlHeaders,
                    });
                } catch (inflateErr) {
                    return NextResponse.json(
                        {
                            error: `Decompression failed: ${inflateErr instanceof Error ? inflateErr.message : "Unknown error"}`,
                        },
                        { status: 500 },
                    );
                }
            }

            respHeaders.set(
                "Content-Disposition",
                `attachment; filename="${encodeURIComponent(downloadName)}"`,
            );
            // Set Content-Length to the actual range size so the browser shows progress
            const rangeSize = parseInt(qEnd, 10) - parseInt(qStart, 10) + 1;
            respHeaders.set("Content-Length", String(rangeSize));
            // Remove Content-Range so browser doesn't treat as partial
            respHeaders.delete("Content-Range");
            return new NextResponse(response.body, {
                status: 200,
                headers: respHeaders,
            });
        }

        return new NextResponse(response.body, {
            status: response.status, // 200 or 206
            headers: respHeaders,
        });
    } catch (err) {
        return NextResponse.json(
            { error: `Fetch failed: ${(err as Error).message}` },
            { status: 502 },
        );
    }
}
