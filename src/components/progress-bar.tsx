"use client";

import { FileArchive, Loader2 } from "lucide-react";

interface ProgressBarProps {
    progress: number;
    message: string;
    fileName?: string;
}

export function ProgressBar({ progress, message, fileName }: ProgressBarProps) {
    return (
        <div className="space-y-6 text-center">
            <div className="w-20 h-20 rounded-2xl bg-brand-50 dark:bg-brand-950/40 flex items-center justify-center mx-auto">
                <Loader2 className="w-10 h-10 text-brand-500 animate-spin" />
            </div>

            {fileName && (
                <div className="flex items-center justify-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
                    <FileArchive className="w-4 h-4" />
                    <span className="font-medium truncate max-w-xs">
                        {fileName}
                    </span>
                </div>
            )}

            <div className="space-y-3">
                <div className="w-full h-2 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-brand-500 rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${Math.max(progress, 2)}%` }}
                    />
                </div>

                <div className="flex items-center justify-between text-xs">
                    <span className="text-neutral-500 dark:text-neutral-400">
                        {message || "Starting..."}
                    </span>
                    <span className="text-neutral-400 dark:text-neutral-500 font-mono">
                        {progress}%
                    </span>
                </div>
            </div>
        </div>
    );
}
