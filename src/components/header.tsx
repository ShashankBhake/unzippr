"use client";

import { useTheme } from "./theme-provider";
import { Package, Sun, Moon, RotateCcw, Github } from "lucide-react";

interface HeaderProps {
    onReset?: () => void;
}

export function Header({ onReset }: HeaderProps) {
    const { theme, toggle } = useTheme();

    return (
        <header className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-neutral-200 dark:border-neutral-800 glass-strong sticky top-0 z-50">
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                    <img
                        src="/favicon.jpeg"
                        alt="unzippr"
                        className="w-8 h-8 rounded-lg object-cover"
                    />
                    <span className="text-lg font-bold tracking-tight">
                        unzippr
                    </span>
                </div>
            </div>

            <div className="flex items-center gap-1">
                {onReset && (
                    <button
                        onClick={onReset}
                        className="btn-ghost"
                        title="Open another file"
                    >
                        <RotateCcw className="w-4 h-4" />
                        <span className="hidden sm:inline">New file</span>
                    </button>
                )}

                <a
                    href="https://github.com/ShashankBhake/unzippr"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-ghost"
                    title="GitHub"
                >
                    <Github className="w-4 h-4" />
                </a>

                <button
                    onClick={toggle}
                    className="btn-ghost"
                    title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
                >
                    {theme === "dark" ? (
                        <Sun className="w-4 h-4" />
                    ) : (
                        <Moon className="w-4 h-4" />
                    )}
                </button>
            </div>
        </header>
    );
}
