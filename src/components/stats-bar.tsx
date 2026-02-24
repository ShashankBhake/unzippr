"use client";

import {
    FileArchive,
    Files,
    FolderOpen,
    HardDrive,
    TrendingDown,
    X,
} from "lucide-react";
import { ZipState } from "@/lib/types";
import {
    formatBytes,
    countTreeItems,
    getTotalSize,
    getTotalCompressedSize,
    getCompressionRatio,
} from "@/lib/utils";

interface StatsBarProps {
    zipState: ZipState;
    onReset: () => void;
}

export function StatsBar({ zipState, onReset }: StatsBarProps) {
    const { files, directories } = countTreeItems(zipState.entries);
    const totalSize = getTotalSize(zipState.entries);
    const compressedSize = getTotalCompressedSize(zipState.entries);
    const ratio = getCompressionRatio(totalSize, compressedSize);

    return (
        <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-2 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-900/50 overflow-x-auto shrink-0">
            <div className="flex items-center gap-1.5 sm:gap-2 mr-1 sm:mr-2 shrink-0">
                <FileArchive className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand-500" />
                <span className="text-xs sm:text-sm font-semibold truncate max-w-[120px] sm:max-w-[200px]">
                    {zipState.fileName}
                </span>
            </div>

            <div className="h-4 w-px bg-neutral-200 dark:bg-neutral-700 shrink-0" />

            <div className="flex items-center gap-2 sm:gap-4 text-[10px] sm:text-xs text-neutral-500 dark:text-neutral-400 shrink-0">
                <span className="flex items-center gap-1">
                    <Files className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    {files}
                    <span className="hidden sm:inline">
                        {" "}
                        file{files !== 1 ? "s" : ""}
                    </span>
                </span>
                <span className="hidden sm:flex items-center gap-1">
                    <FolderOpen className="w-3.5 h-3.5" />
                    {directories} folder{directories !== 1 ? "s" : ""}
                </span>
                <span className="flex items-center gap-1">
                    <HardDrive className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    {formatBytes(totalSize)}
                </span>
                {ratio > 0 && (
                    <span className="hidden md:flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                        <TrendingDown className="w-3.5 h-3.5" />
                        {ratio}% compressed
                    </span>
                )}
                {zipState.loadMethod === "url" && (
                    <span className="badge-info">URL</span>
                )}
            </div>

            <div className="flex-1" />

            <button
                onClick={onReset}
                className="btn-ghost shrink-0 text-xs"
                title="Close and open another file"
            >
                <X className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Close</span>
            </button>
        </div>
    );
}
