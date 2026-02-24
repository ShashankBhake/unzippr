"use client";

import { X, AlertTriangle } from "lucide-react";

interface ErrorBannerProps {
    message: string;
    onDismiss: () => void;
}

export function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
    return (
        <div className="animate-slide-up rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-4">
            <div className="flex gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                    <p className="text-sm text-red-700 dark:text-red-300">
                        {message}
                    </p>
                </div>
                <button
                    onClick={onDismiss}
                    className="shrink-0 text-red-400 hover:text-red-600 dark:text-red-500 dark:hover:text-red-300 transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}
