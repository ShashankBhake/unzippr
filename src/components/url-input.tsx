"use client";

import React, { useState, useCallback } from "react";
import { Link2, ArrowRight, Loader2 } from "lucide-react";
import { isValidUrl } from "@/lib/utils";

interface UrlInputProps {
    onSubmit: (url: string) => void;
    disabled: boolean;
}

export function UrlInput({ onSubmit, disabled }: UrlInputProps) {
    const [url, setUrl] = useState("");
    const [error, setError] = useState("");

    const handleSubmit = useCallback(
        (e: React.FormEvent) => {
            e.preventDefault();
            const trimmed = url.trim();
            if (!trimmed) return;

            if (!isValidUrl(trimmed)) {
                setError("Please enter a valid HTTP or HTTPS URL");
                return;
            }

            setError("");
            onSubmit(trimmed);
        },
        [url, onSubmit],
    );

    return (
        <form onSubmit={handleSubmit} className="space-y-2">
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Link2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                    <input
                        type="text"
                        value={url}
                        onChange={(e) => {
                            setUrl(e.target.value);
                            if (error) setError("");
                        }}
                        placeholder="https://example.com/archive.zip"
                        className="input-base pl-10"
                        disabled={disabled}
                    />
                </div>
                <button
                    type="submit"
                    disabled={disabled || !url.trim()}
                    className="btn-primary"
                >
                    {disabled ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <>
                            <span className="hidden sm:inline">Explore</span>
                            <ArrowRight className="w-4 h-4" />
                        </>
                    )}
                </button>
            </div>
            {error && (
                <p className="text-xs text-red-500 dark:text-red-400 pl-1">
                    {error}
                </p>
            )}
        </form>
    );
}
