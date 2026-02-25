"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { ZipState, ZipEntry, FILE_SIZE_LIMITS } from "@/lib/types";
import { parseZipFromFile, parseZipFromUrl } from "@/lib/zip-handler";
import type { Unzipped, RemoteZipHandle } from "@/lib/zip-handler";
import {
    scanAllFiles,
    getSecuritySummary,
    SecurityScanResult,
} from "@/lib/magic-bytes";
import { Header } from "./header";
import { DropZone } from "./drop-zone";
import { UrlInput } from "./url-input";
import { ProgressBar } from "./progress-bar";
import { FileExplorer } from "./file-explorer";
import { PreviewPanel } from "./preview-panel";
import { StatsBar } from "./stats-bar";
import { ErrorBanner } from "./error-banner";
import { ProjectDashboard } from "./project-dashboard";
import { GridBackground } from "./grid-background";
import { isValidUrl } from "@/lib/utils";
import { FolderTree, Eye } from "lucide-react";

const INITIAL_STATE: ZipState = {
    status: "idle",
    fileName: "",
    totalSize: 0,
    entries: [],
    tree: { name: "", path: "", isDirectory: true, children: [] },
    error: null,
    loadMethod: null,
    supportsRangeRequests: false,
    progress: 0,
    progressMessage: "",
};

export function AppShell() {
    const searchParams = useSearchParams();
    const [zipState, setZipState] = useState<ZipState>(INITIAL_STATE);
    const [selectedEntry, setSelectedEntry] = useState<ZipEntry | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const unzippedRef = useRef<Unzipped | null>(null);
    const remoteHandleRef = useRef<RemoteZipHandle | null>(null);
    // Mobile: which panel is active — "files" or "preview"
    const [mobilePanel, setMobilePanel] = useState<"files" | "preview">(
        "files",
    );
    // Multi-select for surgical extraction
    const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
    const [selectMode, setSelectMode] = useState(false);
    // Security scan
    const [securityResults, setSecurityResults] = useState<Map<
        string,
        SecurityScanResult
    > | null>(null);
    // Source URL for "download original ZIP" shortcut
    const [sourceUrl, setSourceUrl] = useState<string | null>(null);

    // Handle ?url= query param on mount
    useEffect(() => {
        const urlParam = searchParams.get("url");
        if (urlParam && isValidUrl(urlParam)) {
            handleUrlSubmit(urlParam);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleProgress = useCallback((progress: number, message: string) => {
        setZipState((prev) => ({
            ...prev,
            status: "loading",
            progress,
            progressMessage: message,
        }));
    }, []);

    // Run security scan after ZIP is loaded
    const runSecurityScan = useCallback(
        (entries: ZipEntry[], unzipped: Unzipped | null) => {
            if (!unzipped) {
                // Remote mode — scan only by extension (no bytes available)
                const results = scanAllFiles(entries, () => null);
                setSecurityResults(results);
                return;
            }
            // Local mode — scan with actual bytes
            const results = scanAllFiles(entries, (path) => {
                const data = unzipped[path];
                if (!data) return null;
                return data.subarray(0, 16);
            });
            setSecurityResults(results);
        },
        [],
    );

    const handleFileSelect = useCallback(
        async (file: File) => {
            setSelectedEntry(null);
            setSearchQuery("");
            unzippedRef.current = null;
            remoteHandleRef.current = null;
            setSelectedPaths(new Set());
            setSelectMode(false);
            setSecurityResults(null);
            setSourceUrl(null);

            setZipState({
                ...INITIAL_STATE,
                status: "loading",
                fileName: file.name,
                totalSize: file.size,
                loadMethod: "file",
            });

            const { state: result, unzipped } = await parseZipFromFile(
                file,
                handleProgress,
            );
            unzippedRef.current = unzipped;
            setZipState(result);

            // Run security scan
            if (result.status === "loaded" && unzipped) {
                runSecurityScan(result.entries, unzipped);
            }
        },
        [handleProgress, runSecurityScan],
    );

    const handleUrlSubmit = useCallback(
        async (url: string) => {
            setSelectedEntry(null);
            setSearchQuery("");
            unzippedRef.current = null;
            remoteHandleRef.current = null;
            setSelectedPaths(new Set());
            setSelectMode(false);
            setSecurityResults(null);
            setSourceUrl(null);

            setZipState({
                ...INITIAL_STATE,
                status: "loading",
                loadMethod: "url",
            });

            const {
                state: result,
                unzipped,
                remoteHandle,
            } = await parseZipFromUrl(url, handleProgress);
            unzippedRef.current = unzipped;
            remoteHandleRef.current = remoteHandle;

            setZipState(result);
            setSourceUrl(url);

            // Run security scan
            if (result.status === "loaded") {
                runSecurityScan(result.entries, unzipped);
            }

            // Update URL for sharing (deep linking)
            if (typeof window !== "undefined") {
                const newUrl = new URL(window.location.href);
                newUrl.searchParams.set("url", url);
                window.history.replaceState({}, "", newUrl.toString());
            }

            // Handle &path= deep link — auto-select file after load
            if (result.status === "loaded") {
                const pathParam = searchParams.get("path");
                if (pathParam) {
                    const entry = result.entries.find(
                        (e) => e.path === pathParam,
                    );
                    if (entry && !entry.isDirectory) {
                        setSelectedEntry(entry);
                        setMobilePanel("preview");
                    }
                }
            }
        },
        [handleProgress, runSecurityScan, searchParams],
    );

    const handleReset = useCallback(() => {
        setZipState(INITIAL_STATE);
        setSelectedEntry(null);
        setSearchQuery("");
        unzippedRef.current = null;
        remoteHandleRef.current = null;
        setSelectedPaths(new Set());
        setSelectMode(false);
        setSecurityResults(null);
        setSourceUrl(null);

        if (typeof window !== "undefined") {
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.delete("url");
            newUrl.searchParams.delete("path");
            window.history.replaceState({}, "", newUrl.toString());
        }
    }, []);

    const handleEntrySelect = useCallback((entry: ZipEntry) => {
        if (!entry.isDirectory) {
            setSelectedEntry(entry);
            setMobilePanel("preview"); // auto-switch to preview on mobile

            // Deep link: update URL with &path= param
            if (typeof window !== "undefined") {
                const newUrl = new URL(window.location.href);
                newUrl.searchParams.set("path", entry.path);
                window.history.replaceState({}, "", newUrl.toString());
            }
        }
    }, []);

    const handleToggleSelect = useCallback((path: string) => {
        setSelectedPaths((prev) => {
            const next = new Set(prev);
            if (next.has(path)) {
                next.delete(path);
            } else {
                next.add(path);
            }
            return next;
        });
    }, []);

    const handleToggleSelectAll = useCallback(() => {
        const files = zipState.entries.filter((e) => !e.isDirectory);
        setSelectedPaths((prev) => {
            if (prev.size === files.length) {
                return new Set(); // deselect all
            }
            return new Set(files.map((f) => f.path)); // select all
        });
    }, [zipState.entries]);

    const isIdle = zipState.status === "idle";
    const isLoading = zipState.status === "loading";
    const isLoaded = zipState.status === "loaded";
    const isError = zipState.status === "error";

    return (
        <div className="flex flex-col h-screen overflow-hidden">
            <Header onReset={isLoaded ? handleReset : undefined} />

            {/* Landing / Input Section */}
            {(isIdle || isError) && (
                <main className="relative flex-1 flex flex-col items-center justify-center px-3 sm:px-4 py-6 sm:py-12 animate-fade-in overflow-y-auto">
                    <GridBackground />
                    <div className="relative z-10 max-w-2xl w-full space-y-5 sm:space-y-8">
                        {/* Hero text */}
                        <div className="text-center space-y-2 sm:space-y-3">
                            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
                                Peek inside{" "}
                                <span className="text-brand-500">
                                    ZIP files
                                </span>
                            </h1>
                            <p className="text-neutral-500 dark:text-neutral-400 text-sm sm:text-lg max-w-md mx-auto">
                                Explore contents instantly in your browser. No
                                download, no install, no upload to any server.
                            </p>
                        </div>

                        {isError && zipState.error && (
                            <ErrorBanner
                                message={zipState.error}
                                onDismiss={() => setZipState(INITIAL_STATE)}
                            />
                        )}

                        {/* Drop zone */}
                        <DropZone
                            onFileSelect={handleFileSelect}
                            disabled={isLoading}
                        />

                        {/* Divider */}
                        <div className="flex items-center gap-3 sm:gap-4">
                            <div className="flex-1 h-px bg-neutral-200 dark:bg-neutral-800" />
                            <span className="text-[10px] sm:text-xs font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
                                or paste a URL
                            </span>
                            <div className="flex-1 h-px bg-neutral-200 dark:bg-neutral-800" />
                        </div>

                        {/* URL input */}
                        <UrlInput
                            onSubmit={handleUrlSubmit}
                            disabled={isLoading}
                        />

                        {/* Limits info */}
                        <div className="flex flex-col xs:flex-row flex-wrap items-center justify-center gap-1.5 sm:gap-4 text-[11px] sm:text-xs text-neutral-400 dark:text-neutral-500 w-full mt-2">
                            <div className="flex flex-row flex-wrap items-center gap-1.5">
                                <span>
                                    📁 Upload:{" "}
                                    <strong className="text-neutral-600 dark:text-neutral-300">
                                        {FILE_SIZE_LIMITS.UPLOAD / 1024 / 1024}
                                        MB
                                    </strong>
                                </span>
                                <span className="hidden xs:inline">•</span>
                                <span>
                                    🔗 URL:{" "}
                                    <strong className="text-neutral-600 dark:text-neutral-300">
                                        {FILE_SIZE_LIMITS.URL / 1024 / 1024}MB
                                    </strong>
                                </span>
                                <span className="hidden xs:inline">•</span>
                                <span>🔒 Client-side</span>
                            </div>
                        </div>
                    </div>
                </main>
            )}

            {/* Loading state */}
            {isLoading && (
                <main className="relative flex-1 flex flex-col items-center justify-center px-4 py-8 sm:py-12 animate-fade-in">
                    <GridBackground />
                    <div className="relative z-10 max-w-md w-full space-y-6">
                        <ProgressBar
                            progress={zipState.progress}
                            message={zipState.progressMessage}
                            fileName={zipState.fileName}
                        />
                    </div>
                </main>
            )}

            {/* Loaded — Explorer view */}
            {isLoaded && (
                <main className="flex-1 flex flex-col overflow-hidden animate-fade-in">
                    <StatsBar
                        zipState={zipState}
                        onReset={handleReset}
                        securityResults={securityResults}
                        selectMode={selectMode}
                        onToggleSelectMode={() => setSelectMode((m) => !m)}
                        selectedPaths={selectedPaths}
                        onToggleSelectAll={handleToggleSelectAll}
                        unzipped={unzippedRef.current}
                        remoteHandle={remoteHandleRef.current}
                        sourceUrl={sourceUrl}
                    />

                    {/* Mobile tab switcher */}
                    <div className="flex md:hidden border-b border-neutral-200 dark:border-neutral-800 shrink-0">
                        <button
                            onClick={() => setMobilePanel("files")}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-medium transition-colors ${
                                mobilePanel === "files"
                                    ? "text-brand-600 dark:text-brand-400 border-b-2 border-brand-500"
                                    : "text-neutral-500 dark:text-neutral-400"
                            }`}
                        >
                            <FolderTree className="w-3.5 h-3.5" />
                            Files
                        </button>
                        <button
                            onClick={() => setMobilePanel("preview")}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-medium transition-colors ${
                                mobilePanel === "preview"
                                    ? "text-brand-600 dark:text-brand-400 border-b-2 border-brand-500"
                                    : "text-neutral-500 dark:text-neutral-400"
                            }`}
                        >
                            <Eye className="w-3.5 h-3.5" />
                            Preview
                            {selectedEntry && (
                                <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
                            )}
                        </button>
                    </div>

                    {/* Desktop: side-by-side — Mobile: tabbed panels */}
                    <div className="flex-1 flex overflow-hidden">
                        {/* File tree sidebar */}
                        <div
                            className={`md:w-80 xl:w-96 border-r border-neutral-200 dark:border-neutral-800 flex flex-col min-h-0 overflow-hidden ${
                                mobilePanel === "files"
                                    ? "flex w-full"
                                    : "hidden md:flex"
                            }`}
                        >
                            <FileExplorer
                                tree={zipState.tree}
                                entries={zipState.entries}
                                selectedPath={selectedEntry?.path || null}
                                searchQuery={searchQuery}
                                onSearchChange={setSearchQuery}
                                onSelect={handleEntrySelect}
                                selectMode={selectMode}
                                selectedPaths={selectedPaths}
                                onToggleSelect={handleToggleSelect}
                                securityResults={securityResults}
                            />
                        </div>

                        {/* Preview panel */}
                        <div
                            className={`flex-1 min-w-0 min-h-0 overflow-hidden ${
                                mobilePanel === "preview"
                                    ? "flex flex-col w-full"
                                    : "hidden md:flex md:flex-col"
                            }`}
                        >
                            {selectedEntry ? (
                                <PreviewPanel
                                    entry={selectedEntry}
                                    unzipped={unzippedRef.current}
                                    remoteHandle={remoteHandleRef.current}
                                />
                            ) : (
                                <ProjectDashboard
                                    entries={zipState.entries}
                                    unzipped={unzippedRef.current}
                                    fileCount={
                                        zipState.entries.filter(
                                            (e) => !e.isDirectory,
                                        ).length
                                    }
                                    onSelectEntry={handleEntrySelect}
                                />
                            )}
                        </div>
                    </div>
                </main>
            )}
        </div>
    );
}
