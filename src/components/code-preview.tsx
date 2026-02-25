"use client";

import React, { useMemo } from "react";
import SyntaxHighlighter from "react-syntax-highlighter";
import {
    atomOneDark,
    atomOneLight,
} from "react-syntax-highlighter/dist/esm/styles/hljs";
import { useTheme } from "./theme-provider";
import { Copy, Check } from "lucide-react";

interface CodePreviewProps {
    code: string;
    language: string;
    fileName: string;
}

export function CodePreview({ code, language, fileName }: CodePreviewProps) {
    const { theme } = useTheme();
    const [copied, setCopied] = React.useState(false);

    const lines = useMemo(() => code.split("\n").length, [code]);
    const truncated = lines > 5000;
    const displayCode = truncated
        ? code.split("\n").slice(0, 5000).join("\n")
        : code;

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // fallback
        }
    };

    return (
        <div className="flex flex-col h-full">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50">
                <div className="flex items-center gap-3 text-xs text-neutral-500">
                    <span className="font-mono">{language}</span>
                    <span>·</span>
                    <span>{lines.toLocaleString()} lines</span>
                </div>
                <button
                    onClick={handleCopy}
                    className="btn-ghost text-xs gap-1.5"
                >
                    {copied ? (
                        <>
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="text-emerald-500">Copied!</span>
                        </>
                    ) : (
                        <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy</span>
                        </>
                    )}
                </button>
            </div>

            {/* Code content */}
            <div className="flex-1 overflow-auto">
                <SyntaxHighlighter
                    language={language}
                    style={theme === "dark" ? atomOneDark : atomOneLight}
                    showLineNumbers
                    lineNumberStyle={{
                        minWidth: "3em",
                        paddingRight: "1em",
                        color: theme === "dark" ? "#555" : "#bbb",
                        fontSize: "0.75rem",
                    }}
                    customStyle={{
                        margin: 0,
                        padding: "1rem 0",
                        background: "transparent",
                        fontSize: "0.8125rem",
                        lineHeight: "1.6",
                    }}
                    codeTagProps={{
                        style: {
                            fontFamily:
                                '"JetBrains Mono", "Fira Code", monospace',
                        },
                    }}
                >
                    {displayCode}
                </SyntaxHighlighter>

                {truncated && (
                    <div className="px-4 py-3 bg-amber-50 dark:bg-amber-950/30 border-t border-amber-200 dark:border-amber-900/50 text-xs text-amber-600 dark:text-amber-400">
                        ⚠️ File truncated at 5,000 lines. Download the file to
                        see the full content.
                    </div>
                )}
            </div>
        </div>
    );
}
