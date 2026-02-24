import { NextRequest, NextResponse } from "next/server";

/**
 * CORS proxy for fetching ZIP files from URLs that don't support CORS.
 * This runs on the server (Next.js API route) to bypass browser CORS restrictions.
 *
 * Usage: /api/proxy?url=https://example.com/file.zip
 *
 * Security: Only allows fetching .zip files and limits response size.
 */

const MAX_SIZE = 500 * 1024 * 1024; // 500MB

export async function GET(request: NextRequest) {
    const url = request.nextUrl.searchParams.get("url");

    if (!url) {
        return NextResponse.json(
            { error: "Missing 'url' query parameter" },
            { status: 400 },
        );
    }

    // Validate URL
    let parsedUrl: URL;
    try {
        parsedUrl = new URL(url);
        if (!["http:", "https:"].includes(parsedUrl.protocol)) {
            throw new Error("Invalid protocol");
        }
    } catch {
        return NextResponse.json(
            { error: "Invalid URL. Must be an HTTP or HTTPS URL." },
            { status: 400 },
        );
    }

    try {
        // HEAD check first
        const headRes = await fetch(url, { method: "HEAD" });
        const contentLength = parseInt(
            headRes.headers.get("content-length") || "0",
            10,
        );

        if (contentLength > MAX_SIZE) {
            return NextResponse.json(
                {
                    error: `File too large (${(contentLength / 1024 / 1024).toFixed(1)}MB). Max is ${MAX_SIZE / 1024 / 1024}MB.`,
                },
                { status: 413 },
            );
        }

        // Stream the file through
        const response = await fetch(url);
        if (!response.ok) {
            return NextResponse.json(
                { error: `Upstream server returned ${response.status}` },
                { status: 502 },
            );
        }

        const headers = new Headers();
        headers.set(
            "Content-Type",
            response.headers.get("content-type") || "application/octet-stream",
        );
        if (response.headers.get("content-length")) {
            headers.set(
                "Content-Length",
                response.headers.get("content-length")!,
            );
        }
        headers.set(
            "Accept-Ranges",
            response.headers.get("accept-ranges") || "none",
        );
        headers.set("Access-Control-Allow-Origin", "*");

        return new NextResponse(response.body, {
            status: 200,
            headers,
        });
    } catch (err) {
        return NextResponse.json(
            {
                error: `Failed to fetch: ${err instanceof Error ? err.message : "Unknown error"}`,
            },
            { status: 502 },
        );
    }
}
