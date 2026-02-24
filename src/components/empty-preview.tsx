"use client";

import { MousePointerClick, FileSearch } from "lucide-react";

interface EmptyPreviewProps {
    fileCount: number;
}

export function EmptyPreview({ fileCount }: EmptyPreviewProps) {
    return (
        <div className="flex flex-col items-center justify-center h-full gap-3 sm:gap-4 p-4 sm:p-8 text-center">
            <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl bg-neutral-100 dark:bg-neutral-800/50 flex items-center justify-center">
                <FileSearch className="w-7 h-7 sm:w-10 sm:h-10 text-neutral-300 dark:text-neutral-600" />
            </div>
            <div className="space-y-1 sm:space-y-1.5">
                <p className="text-xs sm:text-sm font-medium text-neutral-500 dark:text-neutral-400">
                    Select a file to preview
                </p>
                <p className="text-[10px] sm:text-xs text-neutral-400 dark:text-neutral-500 max-w-xs">
                    Click any file in the sidebar to preview it. Supports
                    images, code, text, video, audio, and PDFs.
                </p>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-neutral-400 dark:text-neutral-500 mt-1 sm:mt-2">
                <MousePointerClick className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span>
                    {fileCount} file{fileCount !== 1 ? "s" : ""} available
                </span>
            </div>
        </div>
    );
}
