"use client";

import React, { useState, useCallback } from "react";
import {
    FileArchive,
    Files,
    FolderOpen,
    HardDrive,
    TrendingDown,
    X,
    CheckSquare,
    Square,
    Download,
    Loader2,
} from "lucide-react";
import { ZipState } from "@/lib/types";
import {
    formatBytes,
    countTreeItems,
    getTotalSize,
    getTotalCompressedSize,
    getCompressionRatio,
} from "@/lib/utils";
import { SecurityBadge } from "./security-badge";
import { SecurityScanResult, getSecuritySummary } from "@/lib/magic-bytes";
import {
    createZipFromSelection,
    createZipFromRemoteSelection,
    downloadBlobUrl,
    downloadSingleFile,
    downloadSingleRemoteFile,
} from "@/lib/surgical-extract";
import type { Unzipped, RemoteZipHandle } from "@/lib/zip-handler";

interface StatsBarProps {
    zipState: ZipState;
    onReset: () => void;
    securityResults: Map<string, SecurityScanResult> | null;
    selectMode: boolean;
    onToggleSelectMode: () => void;
    selectedPaths: Set<string>;
    onToggleSelectAll: () => void;
    unzipped: Unzipped | null;
    remoteHandle: RemoteZipHandle | null;
    sourceUrl: string | null;
}

export function StatsBar({
    zipState,
    onReset,
    securityResults,
    selectMode,
    onToggleSelectMode,
    selectedPaths,
    onToggleSelectAll,
    unzipped,
    remoteHandle,
    sourceUrl,
}: StatsBarProps) {
    const { files, directories } = countTreeItems(zipState.entries);
    const totalSize = getTotalSize(zipState.entries);
    const compressedSize = getTotalCompressedSize(zipState.entries);
    const ratio = getCompressionRatio(totalSize, compressedSize);
    const [extracting, setExtracting] = useState(false);

    const securitySummary = securityResults
        ? getSecuritySummary(securityResults)
        : null;

    const handleExtractSelected = useCallback(async () => {
        if (selectedPaths.size === 0) return;
        setExtracting(true);

        const allFiles = zipState.entries.filter((e) => !e.isDirectory);
        const paths = Array.from(selectedPaths);

        try {
            // Case 1: Single file — download as individual file (not ZIP)
            if (paths.length === 1) {
                if (unzipped) {
                    downloadSingleFile(unzipped, paths[0]);
                } else if (remoteHandle) {
                    await downloadSingleRemoteFile(remoteHandle, paths[0]);
                }
                return;
            }

            // Case 2: All files selected — if loaded from URL, just download the original ZIP
            if (paths.length === allFiles.length && sourceUrl) {
                window.open(sourceUrl, "_blank");
                return;
            }

            // Case 3: Selective download — warn for large selections
            const totalSelectedSize = allFiles
                .filter((f) => selectedPaths.has(f.path))
                .reduce((sum, f) => sum + f.size, 0);

            const isLarge =
                totalSelectedSize > 200 * 1024 * 1024 || paths.length > 50;

            if (isLarge) {
                const proceed = window.confirm(
                    `You're about to download ${paths.length} files (${formatBytes(totalSelectedSize)}).\n\n` +
                        `This may take a while for large ZIP files or large selections — each file is fetched and re-zipped individually.\n\n` +
                        `Continue?`,
                );
                if (!proceed) return;
            }

            const archiveName =
                zipState.fileName.replace(/\.zip$/i, "") + "-selection.zip";

            let url: string | null = null;

            if (unzipped) {
                url = createZipFromSelection(unzipped, paths, archiveName);
            } else if (remoteHandle) {
                url = await createZipFromRemoteSelection(
                    remoteHandle,
                    paths,
                    archiveName,
                );
            }

            if (url) {
                downloadBlobUrl(url, archiveName);
            }
        } catch (err) {
            console.error("[surgical] extraction failed:", err);
        } finally {
            setExtracting(false);
        }
    }, [
        selectedPaths,
        zipState.fileName,
        zipState.entries,
        unzipped,
        remoteHandle,
        sourceUrl,
    ]);

    return (
        <div className="flex flex-wrap md:flex-nowrap items-center gap-x-2 gap-y-1.5 sm:gap-x-2 px-2 sm:px-4 py-2 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-900/50 overflow-x-auto shrink-0 text-xs">
            <div className="flex items-center gap-1.5 sm:gap-2 mr-1 sm:mr-2 shrink-0 min-w-0">
                <FileArchive className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand-500" />
                <span className="font-semibold truncate max-w-[90vw] sm:max-w-[200px]">
                    {zipState.fileName}
                </span>
            </div>

            <div className="hidden md:block h-4 w-px bg-neutral-200 dark:bg-neutral-700 shrink-0" />

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 sm:gap-x-4 text-[10px] sm:text-xs text-neutral-500 dark:text-neutral-400 shrink-0 min-w-0">
                <span className="flex items-center gap-1 min-w-0">
                    <Files className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    {files}
                    <span className="hidden sm:inline">
                        {" "}
                        file{files !== 1 ? "s" : ""}
                    </span>
                </span>
                <span className="hidden sm:flex items-center gap-1 min-w-0">
                    <FolderOpen className="w-3.5 h-3.5" />
                    {directories} folder{directories !== 1 ? "s" : ""}
                </span>
                <span className="flex items-center gap-1 min-w-0">
                    <HardDrive className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    {formatBytes(totalSize)}
                </span>
                {ratio > 0 && (
                    <span className="hidden md:flex items-center gap-1 text-emerald-600 dark:text-emerald-400 min-w-0">
                        <TrendingDown className="w-3.5 h-3.5" />
                        {ratio}% compressed
                    </span>
                )}
                {zipState.loadMethod === "url" && (
                    <span className="badge-info">URL</span>
                )}
                {zipState.supportsRangeRequests && (
                    <span
                        className="badge-success"
                        title="Only file listing was downloaded. Individual files are fetched on-demand when you click them."
                    >
                        ⚡ Smart mode
                    </span>
                )}
                {securitySummary && securityResults && (
                    <SecurityBadge
                        summary={securitySummary}
                        results={securityResults}
                    />
                )}
            </div>

            <div className="flex-1 min-w-0" />

            {/* Surgical extraction controls */}
            <div className="flex items-center gap-1 shrink-0 mt-1 md:mt-0">
                <button
                    onClick={onToggleSelectMode}
                    className={`btn-ghost shrink-0 text-xs ${selectMode ? "text-brand-500 bg-brand-50 dark:bg-brand-950/30" : ""}`}
                    title={
                        selectMode
                            ? "Exit select mode"
                            : "Select files to extract"
                    }
                >
                    {selectMode ? (
                        <CheckSquare className="w-3.5 h-3.5" />
                    ) : (
                        <Square className="w-3.5 h-3.5" />
                    )}
                    <span className="hidden sm:inline">
                        {selectMode ? "Selecting" : "Select"}
                    </span>
                </button>

                {selectMode && (
                    <>
                        <button
                            onClick={onToggleSelectAll}
                            className="btn-ghost shrink-0 text-[10px] sm:text-xs"
                            title="Toggle select all"
                        >
                            {selectedPaths.size === files ? "None" : "All"}
                        </button>
                        {selectedPaths.size > 0 && (
                            <button
                                onClick={handleExtractSelected}
                                disabled={extracting}
                                className="btn-secondary shrink-0 text-xs"
                                title={`Download ${selectedPaths.size} selected files as a new ZIP`}
                            >
                                {extracting ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                    <Download className="w-3.5 h-3.5" />
                                )}
                                <span className="hidden sm:inline">
                                    {selectedPaths.size} file
                                    {selectedPaths.size !== 1 ? "s" : ""}
                                </span>
                            </button>
                        )}
                    </>
                )}
            </div>

            <button
                onClick={onReset}
                className="btn-ghost shrink-0 text-xs mt-1 md:mt-0"
                title="Close and open another file"
            >
                <X className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Close</span>
            </button>
        </div>
    );
}
