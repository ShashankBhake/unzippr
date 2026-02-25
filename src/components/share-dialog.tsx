import React from "react";
import { Loader2, Check, Link } from "lucide-react";

interface ShareDialogProps {
    open: boolean;
    onClose: () => void;
    link: string | null;
    loading: boolean;
    copied: boolean;
    onCopy: () => void;
}

export function ShareDialog({
    open,
    onClose,
    link,
    loading,
    copied,
    onCopy,
}: ShareDialogProps) {
    const inputRef = React.useRef<HTMLInputElement>(null);
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 p-6 w-[95vw] max-w-md relative animate-fade-in">
                <button
                    className="absolute top-2 right-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 text-2xl font-bold px-2 py-1 rounded-full focus:outline-none"
                    onClick={onClose}
                    aria-label="Close"
                >
                    ×
                </button>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-brand-600 dark:text-brand-400">
                    <Link className="w-5 h-5" /> Share Link
                </h2>
                <div className="mb-5 relative">
                    <input
                        ref={inputRef}
                        type="text"
                        className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 text-sm text-neutral-700 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-brand-400 transition shadow-sm pr-12"
                        value={link || (loading ? "Generating link..." : "")}
                        readOnly
                        disabled={loading}
                        onClick={() => {
                            if (inputRef.current) inputRef.current.select();
                        }}
                    />
                    {copied && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500 text-xs font-semibold animate-fade-in">
                            Copied!
                        </span>
                    )}
                </div>
                <button
                    className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-brand-500 text-white font-semibold text-base shadow transition disabled:opacity-60 disabled:cursor-not-allowed ${copied ? "bg-emerald-500" : ""}`}
                    onClick={onCopy}
                    disabled={loading || !link}
                >
                    {loading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : copied ? (
                        <Check className="w-5 h-5" />
                    ) : (
                        <Link className="w-5 h-5" />
                    )}
                    {copied ? "Copied!" : "Copy Link"}
                </button>
                <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-4 text-center select-none">
                    Anyone with this link can download the file directly.
                </p>
            </div>
        </div>
    );
}
