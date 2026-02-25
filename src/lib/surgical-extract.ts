/**
 * Surgical Extraction — Create a new ZIP from selected files.
 *
 * Uses fflate's zipSync to build a new ZIP on the client
 * containing only the user-selected files.
 */

import { zipSync, Zippable } from "fflate";
import type { Unzipped } from "fflate";
import type { RemoteZipHandle } from "./zip-remote";
import { getExtension } from "./utils";
import { MIME_MAP } from "./types";

/**
 * Build a new ZIP from selected file paths using in-memory data.
 * Returns a downloadable blob URL.
 */
export function createZipFromSelection(
    unzipped: Unzipped,
    selectedPaths: string[],
    archiveName: string,
): string | null {
    if (selectedPaths.length === 0) return null;

    const zippable: Zippable = {};

    for (const path of selectedPaths) {
        const data = unzipped[path];
        if (!data) continue; // skip directories or missing files
        // Preserve directory structure in the new ZIP
        zippable[path] = data;
    }

    if (Object.keys(zippable).length === 0) return null;

    const zipped = zipSync(zippable);
    const blob = new Blob([zipped as BlobPart], { type: "application/zip" });
    return URL.createObjectURL(blob);
}

/**
 * Download a blob URL as a file.
 */
export function downloadBlobUrl(url: string, filename: string): void {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Download a single file from local ZIP (not as a ZIP, just the raw file).
 */
export function downloadSingleFile(unzipped: Unzipped, path: string): void {
    const data = unzipped[path];
    if (!data) return;

    const ext = getExtension(path);
    const mime = MIME_MAP[ext] || "application/octet-stream";
    const blob = new Blob([data as BlobPart], { type: mime });
    const url = URL.createObjectURL(blob);
    const fileName = path.split("/").pop() || path;
    downloadBlobUrl(url, fileName);
}

/**
 * Download a single file from a remote ZIP (not as a ZIP, just the raw file).
 */
export async function downloadSingleRemoteFile(
    handle: RemoteZipHandle,
    path: string,
): Promise<void> {
    const { downloadRemoteFile } = await import("./zip-remote");
    const url = await downloadRemoteFile(handle, path);
    if (!url) {
        alert(
            "This file is too large to extract in the browser. Download the full ZIP instead.",
        );
        return;
    }
    if (url.startsWith("__STREAM__")) {
        const streamUrl = url.slice("__STREAM__".length);
        window.open(streamUrl, "_blank");
    } else {
        const fileName = path.split("/").pop() || path;
        downloadBlobUrl(url, fileName);
    }
}

/**
 * Build a ZIP from selected remote files (fetches each on-demand).
 * Returns a blob URL for download.
 */
export async function createZipFromRemoteSelection(
    handle: RemoteZipHandle,
    selectedPaths: string[],
    archiveName: string,
    onProgress?: (current: number, total: number) => void,
): Promise<string | null> {
    if (selectedPaths.length === 0) return null;

    // Dynamic import to avoid circular deps
    const { extractRemoteFileRaw } = await import("./zip-remote");

    const zippable: Zippable = {};
    let done = 0;

    for (const path of selectedPaths) {
        onProgress?.(done, selectedPaths.length);
        try {
            const data = await extractRemoteFileRaw(handle, path);
            if (data) {
                zippable[path] = data;
            }
        } catch {
            // Skip files that fail to download
            console.warn(`[surgical] Failed to fetch: ${path}`);
        }
        done++;
    }

    onProgress?.(done, selectedPaths.length);

    if (Object.keys(zippable).length === 0) return null;

    const zipped = zipSync(zippable);
    const blob = new Blob([zipped as BlobPart], { type: "application/zip" });
    return URL.createObjectURL(blob);
}
