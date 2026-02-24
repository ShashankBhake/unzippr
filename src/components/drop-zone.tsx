"use client";

import React, { useCallback, useRef, useState } from "react";
import { Upload, FileArchive } from "lucide-react";

interface DropZoneProps {
    onFileSelect: (file: File) => void;
    disabled: boolean;
}

export function DropZone({ onFileSelect, disabled }: DropZoneProps) {
    const [isDragging, setIsDragging] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const dragCounter = useRef(0);

    const handleDragEnter = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current++;
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current--;
        if (dragCounter.current === 0) {
            setIsDragging(false);
        }
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(false);
            dragCounter.current = 0;

            if (disabled) return;

            const files = e.dataTransfer.files;
            if (files.length > 0) {
                const file = files[0];
                if (
                    file.name.toLowerCase().endsWith(".zip") ||
                    file.type === "application/zip" ||
                    file.type === "application/x-zip-compressed"
                ) {
                    onFileSelect(file);
                }
            }
        },
        [disabled, onFileSelect],
    );

    const handleFileInput = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (file) {
                onFileSelect(file);
            }
            // Reset input so same file can be selected again
            if (inputRef.current) inputRef.current.value = "";
        },
        [onFileSelect],
    );

    return (
        <div
            className={`drop-zone ${isDragging ? "drop-zone-active" : ""} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => !disabled && inputRef.current?.click()}
        >
            <input
                ref={inputRef}
                type="file"
                accept=".zip,application/zip,application/x-zip-compressed"
                className="hidden"
                onChange={handleFileInput}
                disabled={disabled}
            />

            <div
                className={`w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl flex items-center justify-center transition-colors duration-300 ${
                    isDragging
                        ? "bg-brand-100 dark:bg-brand-900/40"
                        : "bg-neutral-100 dark:bg-neutral-800"
                }`}
            >
                {isDragging ? (
                    <FileArchive className="w-6 h-6 sm:w-8 sm:h-8 text-brand-500" />
                ) : (
                    <Upload className="w-6 h-6 sm:w-8 sm:h-8 text-neutral-400 dark:text-neutral-500" />
                )}
            </div>

            <div className="space-y-1">
                <p className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
                    {isDragging
                        ? "Drop your ZIP file here"
                        : "Drag & drop a ZIP file here"}
                </p>
                <p className="text-xs text-neutral-400 dark:text-neutral-500">
                    or{" "}
                    <span className="text-brand-500 hover:text-brand-600 font-medium">
                        click to browse
                    </span>
                </p>
            </div>
        </div>
    );
}
