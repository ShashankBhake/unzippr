"use client";

import React, {
    useEffect,
    useState,
    useMemo,
    useCallback,
    useRef,
} from "react";
import {
    Loader2,
    Download,
    AlertTriangle,
    Eye,
    FileCode2,
    Play,
    Pause,
    SkipBack,
    SkipForward,
    Volume2,
    VolumeX,
    FileText,
    Sheet,
    Presentation,
    Maximize,
    Minimize,
    PictureInPicture2,
    Settings,
    Info,
    Table,
    AlignLeft,
} from "lucide-react";
import {
    ZipEntry,
    PreviewState,
    FILE_SIZE_LIMITS,
    LANGUAGE_MAP,
} from "@/lib/types";
import {
    extractFileForPreview,
    extractFileForDownload,
} from "@/lib/zip-handler";
import type { Unzipped } from "@/lib/zip-handler";
import { formatBytes, getExtension, getPreviewType } from "@/lib/utils";
import { FileIcon } from "./file-icon";
import { CodePreview } from "./code-preview";
import { MetadataPanel } from "./metadata-panel";

interface PreviewPanelProps {
    entry: ZipEntry;
    unzipped: Unzipped | null;
}

export function PreviewPanel({ entry, unzipped }: PreviewPanelProps) {
    const [preview, setPreview] = useState<PreviewState>({
        status: "idle",
        entry: null,
        type: "unsupported",
        content: null,
        blobUrl: null,
        error: null,
    });
    const [showMetadata, setShowMetadata] = useState(false);

    const previewType = useMemo(() => getPreviewType(entry.path), [entry.path]);
    const ext = useMemo(() => getExtension(entry.path), [entry.path]);
    const language = LANGUAGE_MAP[ext] || "text";

    useEffect(() => {
        // Clean up previous blob URL
        if (preview.blobUrl) {
            URL.revokeObjectURL(preview.blobUrl);
        }

        if (!unzipped) {
            setPreview({
                status: "error",
                entry,
                type: previewType,
                content: null,
                blobUrl: null,
                error: "File buffer not available. Try uploading the file again.",
            });
            return;
        }

        if (entry.size > FILE_SIZE_LIMITS.PREVIEW) {
            setPreview({
                status: "error",
                entry,
                type: previewType,
                content: null,
                blobUrl: null,
                error: `File too large for preview (${formatBytes(entry.size)}). Maximum preview size is ${formatBytes(FILE_SIZE_LIMITS.PREVIEW)}.`,
            });
            return;
        }

        if (previewType === "unsupported") {
            setPreview({
                status: "loaded",
                entry,
                type: "unsupported",
                content: null,
                blobUrl: null,
                error: null,
            });
            return;
        }

        setPreview({
            status: "loading",
            entry,
            type: previewType,
            content: null,
            blobUrl: null,
            error: null,
        });

        // Use setTimeout to avoid blocking the UI
        const timer = setTimeout(() => {
            const result = extractFileForPreview(unzipped, entry.path);
            setPreview({ ...result, entry, type: previewType });
        }, 50);

        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [entry.path, unzipped]);

    const handleDownload = useCallback(() => {
        if (!unzipped) return;
        const url = extractFileForDownload(unzipped, entry.path);
        if (url) {
            const a = document.createElement("a");
            a.href = url;
            a.download = entry.name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    }, [unzipped, entry]);

    return (
        <div className="flex flex-col h-full">
            {/* Preview header */}
            <div className="flex items-center gap-2 sm:gap-3 px-2.5 sm:px-4 py-2 sm:py-2.5 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30 shrink-0">
                <FileIcon
                    name={entry.name}
                    isDirectory={false}
                    className="w-4 h-4 shrink-0"
                />
                <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-xs sm:text-sm font-medium truncate">
                        {entry.name}
                    </span>
                    <span className="text-[10px] text-neutral-400 dark:text-neutral-500 truncate">
                        {entry.path} · {formatBytes(entry.size)}
                    </span>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                    <span className="badge-info items-center gap-1 hidden sm:flex">
                        <Eye className="w-3 h-3" />
                        {previewType}
                    </span>
                    <button
                        onClick={() => setShowMetadata(!showMetadata)}
                        className={`btn-ghost text-xs py-1.5 px-2 ${showMetadata ? "text-brand-500 bg-brand-50 dark:bg-brand-950/30" : ""}`}
                        title="File metadata"
                    >
                        <Info className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={handleDownload}
                        className="btn-secondary text-xs py-1.5 px-2 sm:px-3"
                    >
                        <Download className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Download</span>
                    </button>
                </div>
            </div>

            {/* Preview content + Metadata sidebar */}
            <div className="flex-1 flex overflow-hidden min-h-0">
                {/* Preview content */}
                <div
                    className={`flex-1 overflow-auto min-h-0 min-w-0 ${showMetadata ? "hidden sm:block" : ""}`}
                >
                    {preview.status === "loading" && (
                        <div className="flex flex-col items-center justify-center h-full gap-3">
                            <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
                            <p className="text-sm text-neutral-400">
                                Loading preview...
                            </p>
                        </div>
                    )}

                    {preview.status === "error" && (
                        <div className="flex flex-col items-center justify-center h-full gap-3 p-8">
                            <AlertTriangle className="w-10 h-10 text-amber-500" />
                            <p className="text-sm text-neutral-500 text-center max-w-md">
                                {preview.error}
                            </p>
                            <button
                                onClick={handleDownload}
                                className="btn-secondary text-xs mt-2"
                            >
                                <Download className="w-3.5 h-3.5" />
                                Download file instead
                            </button>
                        </div>
                    )}

                    {preview.status === "loaded" &&
                        previewType === "unsupported" && (
                            <div className="flex flex-col items-center justify-center h-full gap-3 p-8">
                                <FileCode2 className="w-12 h-12 text-neutral-300 dark:text-neutral-600" />
                                <div className="text-center">
                                    <p className="text-sm font-medium text-neutral-500">
                                        No preview available
                                    </p>
                                    <p className="text-xs text-neutral-400 mt-1">
                                        {ext
                                            ? `${ext.toUpperCase()} files`
                                            : "This file type"}{" "}
                                        can&apos;t be previewed
                                    </p>
                                </div>
                                <button
                                    onClick={handleDownload}
                                    className="btn-secondary text-xs mt-2"
                                >
                                    <Download className="w-3.5 h-3.5" />
                                    Download file
                                </button>
                            </div>
                        )}

                    {/* Image preview */}
                    {preview.status === "loaded" &&
                        previewType === "image" &&
                        preview.blobUrl && (
                            <div className="flex items-center justify-center h-full p-8 bg-[repeating-conic-gradient(#80808015_0%_25%,transparent_0%_50%)] bg-[length:20px_20px]">
                                <img
                                    src={preview.blobUrl}
                                    alt={entry.name}
                                    className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                                />
                            </div>
                        )}

                    {/* Text / Code preview */}
                    {preview.status === "loaded" &&
                        (previewType === "text" || previewType === "code") &&
                        preview.content !== null && (
                            <CodePreview
                                code={preview.content}
                                language={language}
                                fileName={entry.name}
                            />
                        )}

                    {/* Video preview — enhanced player */}
                    {preview.status === "loaded" &&
                        previewType === "video" &&
                        preview.blobUrl && (
                            <VideoPlayer
                                src={preview.blobUrl}
                                fileName={entry.name}
                                fileSize={entry.size}
                            />
                        )}

                    {/* Audio preview — polished player */}
                    {preview.status === "loaded" &&
                        previewType === "audio" &&
                        preview.blobUrl && (
                            <AudioPlayer
                                src={preview.blobUrl}
                                fileName={entry.name}
                                fileSize={entry.size}
                                ext={ext}
                            />
                        )}

                    {/* PDF preview */}
                    {preview.status === "loaded" &&
                        previewType === "pdf" &&
                        preview.blobUrl && (
                            <iframe
                                src={preview.blobUrl}
                                className="w-full h-full border-0"
                                title={entry.name}
                            />
                        )}

                    {/* Document preview (DOCX) */}
                    {preview.status === "loaded" &&
                        previewType === "document" && (
                            <DocumentPreview
                                content={preview.content}
                                fileName={entry.name}
                                ext={ext}
                                onDownload={handleDownload}
                            />
                        )}

                    {/* Spreadsheet preview (XLSX) */}
                    {preview.status === "loaded" &&
                        previewType === "spreadsheet" && (
                            <SpreadsheetPreview
                                content={preview.content}
                                fileName={entry.name}
                                ext={ext}
                                onDownload={handleDownload}
                            />
                        )}

                    {/* Presentation preview (PPTX) */}
                    {preview.status === "loaded" &&
                        previewType === "presentation" && (
                            <PresentationPreview
                                content={preview.content}
                                fileName={entry.name}
                                ext={ext}
                                onDownload={handleDownload}
                            />
                        )}
                </div>

                {/* Metadata sidebar */}
                {showMetadata && (
                    <div className="w-full sm:w-72 lg:w-80 shrink-0 overflow-hidden">
                        <MetadataPanel
                            entry={entry}
                            unzipped={unzipped}
                            onClose={() => setShowMetadata(false)}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

/* ─────────────────────── Audio Player ─────────────────────── */

function AudioPlayer({
    src,
    fileName,
    fileSize,
    ext,
}: {
    src: string;
    fileName: string;
    fileSize: number;
    ext: string;
}) {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);

    const formatTime = (t: number) => {
        if (!isFinite(t) || isNaN(t)) return "0:00";
        const mins = Math.floor(t / 60);
        const secs = Math.floor(t % 60);
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    const togglePlay = () => {
        const audio = audioRef.current;
        if (!audio) return;
        if (isPlaying) {
            audio.pause();
        } else {
            audio.play();
        }
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const audio = audioRef.current;
        if (!audio) return;
        const t = parseFloat(e.target.value);
        audio.currentTime = t;
        setCurrentTime(t);
    };

    const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = parseFloat(e.target.value);
        setVolume(v);
        if (audioRef.current) {
            audioRef.current.volume = v;
        }
        setIsMuted(v === 0);
    };

    const toggleMute = () => {
        if (audioRef.current) {
            if (isMuted) {
                audioRef.current.volume = volume || 0.5;
                setIsMuted(false);
                if (volume === 0) setVolume(0.5);
            } else {
                audioRef.current.volume = 0;
                setIsMuted(true);
            }
        }
    };

    const skip = (seconds: number) => {
        if (audioRef.current) {
            audioRef.current.currentTime = Math.max(
                0,
                Math.min(duration, audioRef.current.currentTime + seconds),
            );
        }
    };

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

    return (
        <div className="flex flex-col items-center justify-center h-full p-4 sm:p-8">
            <audio
                ref={audioRef}
                src={src}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onTimeUpdate={() =>
                    setCurrentTime(audioRef.current?.currentTime || 0)
                }
                onLoadedMetadata={() =>
                    setDuration(audioRef.current?.duration || 0)
                }
                onEnded={() => setIsPlaying(false)}
            />

            {/* Card */}
            <div className="w-full max-w-sm">
                {/* Album art placeholder */}
                <div className="relative mx-auto w-32 h-32 sm:w-48 sm:h-48 mb-5 sm:mb-8">
                    <div className="absolute inset-0 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-pink-500 shadow-xl shadow-violet-500/25 dark:shadow-violet-500/15" />
                    <div className="absolute inset-0 rounded-2xl sm:rounded-3xl flex items-center justify-center">
                        <div className="text-center">
                            <FileIcon
                                name={fileName}
                                isDirectory={false}
                                className="w-10 h-10 sm:w-16 sm:h-16 text-white/90 mx-auto"
                            />
                            <p className="text-white/70 text-[10px] sm:text-xs font-medium mt-1 sm:mt-2 uppercase tracking-wider">
                                {ext.replace(".", "")}
                            </p>
                        </div>
                    </div>
                    {/* Spinning ring when playing */}
                    {isPlaying && (
                        <div
                            className="absolute -inset-2 rounded-[1.75rem] border-2 border-violet-400/30 dark:border-violet-400/20 animate-spin"
                            style={{ animationDuration: "8s" }}
                        />
                    )}
                </div>

                {/* Song info */}
                <div className="text-center mb-4 sm:mb-6">
                    <h3 className="text-sm sm:text-base font-semibold truncate">
                        {fileName}
                    </h3>
                    <p className="text-[10px] sm:text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
                        {formatBytes(fileSize)} ·{" "}
                        {ext.replace(".", "").toUpperCase()}
                    </p>
                </div>

                {/* Progress bar */}
                <div className="mb-3 sm:mb-4">
                    <div className="relative h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden group cursor-pointer">
                        <div
                            className="absolute inset-y-0 left-0 bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full transition-all duration-150"
                            style={{ width: `${progress}%` }}
                        />
                        <input
                            type="range"
                            min={0}
                            max={duration || 0}
                            step={0.1}
                            value={currentTime}
                            onChange={handleSeek}
                            className="absolute inset-0 w-full opacity-0 cursor-pointer"
                        />
                    </div>
                    <div className="flex justify-between mt-1.5 text-[10px] tabular-nums text-neutral-400 dark:text-neutral-500">
                        <span>{formatTime(currentTime)}</span>
                        <span>{formatTime(duration)}</span>
                    </div>
                </div>

                {/* Controls */}
                <div className="flex items-center justify-center gap-3 sm:gap-4 mb-4 sm:mb-6">
                    <button
                        onClick={() => skip(-10)}
                        className="p-1.5 sm:p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-neutral-500 dark:text-neutral-400"
                        title="Back 10s"
                    >
                        <SkipBack className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>

                    <button
                        onClick={togglePlay}
                        className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 text-white flex items-center justify-center shadow-lg shadow-violet-500/30 dark:shadow-violet-500/20 transition-all active:scale-95"
                    >
                        {isPlaying ? (
                            <Pause
                                className="w-5 h-5 sm:w-6 sm:h-6"
                                fill="currentColor"
                            />
                        ) : (
                            <Play
                                className="w-5 h-5 sm:w-6 sm:h-6 ml-0.5"
                                fill="currentColor"
                            />
                        )}
                    </button>

                    <button
                        onClick={() => skip(10)}
                        className="p-1.5 sm:p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-neutral-500 dark:text-neutral-400"
                        title="Forward 10s"
                    >
                        <SkipForward className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                </div>

                {/* Volume */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={toggleMute}
                        className="p-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-neutral-500 dark:text-neutral-400"
                    >
                        {isMuted ? (
                            <VolumeX className="w-4 h-4" />
                        ) : (
                            <Volume2 className="w-4 h-4" />
                        )}
                    </button>
                    <div className="flex-1 relative h-1 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                        <div
                            className="absolute inset-y-0 left-0 bg-neutral-400 dark:bg-neutral-500 rounded-full"
                            style={{
                                width: `${isMuted ? 0 : volume * 100}%`,
                            }}
                        />
                        <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.01}
                            value={isMuted ? 0 : volume}
                            onChange={handleVolume}
                            className="absolute inset-0 w-full opacity-0 cursor-pointer"
                        />
                    </div>
                    <span className="text-[10px] tabular-nums text-neutral-400 dark:text-neutral-500 w-8 text-right">
                        {Math.round((isMuted ? 0 : volume) * 100)}%
                    </span>
                </div>
            </div>
        </div>
    );
}

/* ─────────────────────── Video Player ─────────────────────── */

const PLAYBACK_SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

function VideoPlayer({
    src,
    fileName,
    fileSize,
}: {
    src: string;
    fileName: string;
    fileSize: number;
}) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [showSpeedMenu, setShowSpeedMenu] = useState(false);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const [buffered, setBuffered] = useState(0);
    const [videoReady, setVideoReady] = useState(false);

    const formatTime = (t: number) => {
        if (!isFinite(t) || isNaN(t)) return "0:00";
        const hrs = Math.floor(t / 3600);
        const mins = Math.floor((t % 3600) / 60);
        const secs = Math.floor(t % 60);
        if (hrs > 0)
            return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

    const togglePlay = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;
        if (isPlaying) {
            video.pause();
        } else {
            video.play();
        }
    }, [isPlaying]);

    const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        const video = videoRef.current;
        if (!video) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const pct = Math.max(
            0,
            Math.min(1, (e.clientX - rect.left) / rect.width),
        );
        video.currentTime = pct * (video.duration || 0);
    }, []);

    const handleVolumeChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const v = parseFloat(e.target.value);
            setVolume(v);
            if (videoRef.current) videoRef.current.volume = v;
            setIsMuted(v === 0);
        },
        [],
    );

    const toggleMute = useCallback(() => {
        if (videoRef.current) {
            if (isMuted) {
                videoRef.current.volume = volume || 0.5;
                setIsMuted(false);
                if (volume === 0) setVolume(0.5);
            } else {
                videoRef.current.volume = 0;
                setIsMuted(true);
            }
        }
    }, [isMuted, volume]);

    const skip = useCallback((seconds: number) => {
        if (videoRef.current) {
            videoRef.current.currentTime = Math.max(
                0,
                Math.min(
                    videoRef.current.duration || 0,
                    videoRef.current.currentTime + seconds,
                ),
            );
        }
    }, []);

    const toggleFullscreen = useCallback(async () => {
        const container = containerRef.current;
        if (!container) return;
        try {
            if (document.fullscreenElement) {
                await document.exitFullscreen();
            } else {
                await container.requestFullscreen();
            }
        } catch {
            // Fullscreen not supported
        }
    }, []);

    const togglePiP = useCallback(async () => {
        const video = videoRef.current;
        if (!video) return;
        try {
            if (document.pictureInPictureElement) {
                await document.exitPictureInPicture();
            } else {
                await video.requestPictureInPicture();
            }
        } catch {
            // PiP not supported
        }
    }, []);

    const changeSpeed = useCallback((speed: number) => {
        setPlaybackSpeed(speed);
        if (videoRef.current) videoRef.current.playbackRate = speed;
        setShowSpeedMenu(false);
    }, []);

    // Auto-hide controls after 3s of no mouse activity
    const resetControlsTimer = useCallback(() => {
        setShowControls(true);
        if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
        if (isPlaying) {
            controlsTimerRef.current = setTimeout(() => {
                setShowControls(false);
                setShowSpeedMenu(false);
            }, 3000);
        }
    }, [isPlaying]);

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener("fullscreenchange", handleFullscreenChange);
        return () =>
            document.removeEventListener(
                "fullscreenchange",
                handleFullscreenChange,
            );
    }, []);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement) return;
            switch (e.key) {
                case " ":
                case "k":
                    e.preventDefault();
                    togglePlay();
                    break;
                case "ArrowLeft":
                    e.preventDefault();
                    skip(-5);
                    break;
                case "ArrowRight":
                    e.preventDefault();
                    skip(5);
                    break;
                case "ArrowUp":
                    e.preventDefault();
                    setVolume((v) => {
                        const nv = Math.min(1, v + 0.1);
                        if (videoRef.current) videoRef.current.volume = nv;
                        setIsMuted(false);
                        return nv;
                    });
                    break;
                case "ArrowDown":
                    e.preventDefault();
                    setVolume((v) => {
                        const nv = Math.max(0, v - 0.1);
                        if (videoRef.current) videoRef.current.volume = nv;
                        setIsMuted(nv === 0);
                        return nv;
                    });
                    break;
                case "f":
                    e.preventDefault();
                    toggleFullscreen();
                    break;
                case "m":
                    e.preventDefault();
                    toggleMute();
                    break;
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [togglePlay, skip, toggleFullscreen, toggleMute]);

    return (
        <div className="relative w-full h-full min-h-0">
            <div
                ref={containerRef}
                className="absolute inset-0 flex items-center justify-center bg-black group cursor-pointer select-none overflow-hidden"
                onMouseMove={resetControlsTimer}
                onMouseLeave={() => isPlaying && setShowControls(false)}
                onClick={(e) => {
                    // Ignore clicks on controls
                    if ((e.target as HTMLElement).closest("[data-controls]"))
                        return;
                    togglePlay();
                    resetControlsTimer();
                }}
            >
                <video
                    ref={videoRef}
                    src={src}
                    className="w-full h-full object-contain"
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => {
                        setIsPlaying(false);
                        setShowControls(true);
                    }}
                    onTimeUpdate={() =>
                        setCurrentTime(videoRef.current?.currentTime || 0)
                    }
                    onLoadedMetadata={() => {
                        setDuration(videoRef.current?.duration || 0);
                        setVideoReady(true);
                    }}
                    onEnded={() => {
                        setIsPlaying(false);
                        setShowControls(true);
                    }}
                    onProgress={() => {
                        const video = videoRef.current;
                        if (video && video.buffered.length > 0) {
                            setBuffered(
                                video.buffered.end(video.buffered.length - 1),
                            );
                        }
                    }}
                    playsInline
                />

                {/* Play overlay when paused */}
                {!isPlaying && videoReady && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
                            <Play
                                className="w-7 h-7 sm:w-9 sm:h-9 text-white ml-1"
                                fill="currentColor"
                            />
                        </div>
                    </div>
                )}

                {/* Top bar — file info */}
                <div
                    data-controls
                    className={`absolute top-0 left-0 right-0 px-3 sm:px-4 py-2 sm:py-3 bg-gradient-to-b from-black/70 to-transparent transition-opacity duration-300 ${
                        showControls
                            ? "opacity-100"
                            : "opacity-0 pointer-events-none"
                    }`}
                >
                    <p className="text-white/90 text-xs sm:text-sm font-medium truncate">
                        {fileName}
                    </p>
                    <p className="text-white/50 text-[10px] sm:text-xs">
                        {formatBytes(fileSize)}
                    </p>
                </div>

                {/* Bottom controls */}
                <div
                    data-controls
                    className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-8 sm:pt-12 pb-2 sm:pb-3 px-2 sm:px-4 transition-opacity duration-300 ${
                        showControls
                            ? "opacity-100"
                            : "opacity-0 pointer-events-none"
                    }`}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Progress bar */}
                    <div
                        className="relative h-1 sm:h-1.5 bg-white/20 rounded-full cursor-pointer group/seek mb-2 sm:mb-3"
                        onClick={handleSeek}
                    >
                        {/* Buffered */}
                        <div
                            className="absolute inset-y-0 left-0 bg-white/20 rounded-full"
                            style={{
                                width: `${duration > 0 ? (buffered / duration) * 100 : 0}%`,
                            }}
                        />
                        {/* Progress */}
                        <div
                            className="absolute inset-y-0 left-0 bg-brand-500 rounded-full transition-all duration-100"
                            style={{ width: `${progress}%` }}
                        />
                        {/* Thumb */}
                        <div
                            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 sm:w-3.5 sm:h-3.5 bg-brand-500 rounded-full opacity-0 group-hover/seek:opacity-100 transition-opacity shadow-lg"
                            style={{ left: `${progress}%`, marginLeft: "-6px" }}
                        />
                    </div>

                    {/* Controls row */}
                    <div className="flex items-center gap-1 sm:gap-2">
                        {/* Play/Pause */}
                        <button
                            onClick={togglePlay}
                            className="p-1 sm:p-1.5 rounded-md hover:bg-white/10 transition-colors text-white"
                        >
                            {isPlaying ? (
                                <Pause
                                    className="w-4 h-4 sm:w-5 sm:h-5"
                                    fill="currentColor"
                                />
                            ) : (
                                <Play
                                    className="w-4 h-4 sm:w-5 sm:h-5"
                                    fill="currentColor"
                                />
                            )}
                        </button>

                        {/* Skip buttons */}
                        <button
                            onClick={() => skip(-10)}
                            className="p-1 sm:p-1.5 rounded-md hover:bg-white/10 transition-colors text-white/80 hidden sm:block"
                            title="Back 10s"
                        >
                            <SkipBack className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => skip(10)}
                            className="p-1 sm:p-1.5 rounded-md hover:bg-white/10 transition-colors text-white/80 hidden sm:block"
                            title="Forward 10s"
                        >
                            <SkipForward className="w-4 h-4" />
                        </button>

                        {/* Volume */}
                        <div className="flex items-center gap-1 group/vol">
                            <button
                                onClick={toggleMute}
                                className="p-1 sm:p-1.5 rounded-md hover:bg-white/10 transition-colors text-white/80"
                            >
                                {isMuted || volume === 0 ? (
                                    <VolumeX className="w-4 h-4" />
                                ) : (
                                    <Volume2 className="w-4 h-4" />
                                )}
                            </button>
                            <div className="w-0 group-hover/vol:w-16 sm:group-hover/vol:w-20 overflow-hidden transition-all duration-200">
                                <div className="relative h-1 bg-white/20 rounded-full w-16 sm:w-20">
                                    <div
                                        className="absolute inset-y-0 left-0 bg-white/70 rounded-full"
                                        style={{
                                            width: `${isMuted ? 0 : volume * 100}%`,
                                        }}
                                    />
                                    <input
                                        type="range"
                                        min={0}
                                        max={1}
                                        step={0.01}
                                        value={isMuted ? 0 : volume}
                                        onChange={handleVolumeChange}
                                        className="absolute inset-0 w-full opacity-0 cursor-pointer"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Time */}
                        <span className="text-white/70 text-[10px] sm:text-xs tabular-nums ml-1">
                            {formatTime(currentTime)} / {formatTime(duration)}
                        </span>

                        <div className="flex-1" />

                        {/* Speed */}
                        <div className="relative">
                            <button
                                onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                                className="p-1 sm:p-1.5 rounded-md hover:bg-white/10 transition-colors text-white/80 text-[10px] sm:text-xs font-medium min-w-[32px] text-center"
                                title="Playback speed"
                            >
                                {playbackSpeed === 1 ? (
                                    <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                ) : (
                                    `${playbackSpeed}×`
                                )}
                            </button>
                            {showSpeedMenu && (
                                <div className="absolute bottom-full right-0 mb-1 py-1 bg-neutral-900/95 backdrop-blur-sm rounded-lg border border-white/10 shadow-xl min-w-[80px]">
                                    {PLAYBACK_SPEEDS.map((speed) => (
                                        <button
                                            key={speed}
                                            onClick={() => changeSpeed(speed)}
                                            className={`block w-full px-3 py-1 text-left text-[10px] sm:text-xs transition-colors ${
                                                playbackSpeed === speed
                                                    ? "text-brand-400 bg-white/10"
                                                    : "text-white/70 hover:bg-white/5 hover:text-white"
                                            }`}
                                        >
                                            {speed}×
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* PiP */}
                        <button
                            onClick={togglePiP}
                            className="p-1 sm:p-1.5 rounded-md hover:bg-white/10 transition-colors text-white/80 hidden sm:block"
                            title="Picture in Picture"
                        >
                            <PictureInPicture2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </button>

                        {/* Fullscreen */}
                        <button
                            onClick={toggleFullscreen}
                            className="p-1 sm:p-1.5 rounded-md hover:bg-white/10 transition-colors text-white/80"
                            title="Fullscreen"
                        >
                            {isFullscreen ? (
                                <Minimize className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            ) : (
                                <Maximize className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ─────────────────── Document Preview (DOCX) ─────────────────── */

function DocumentPreview({
    content,
    fileName,
    ext,
    onDownload,
}: {
    content: string | null;
    fileName: string;
    ext: string;
    onDownload: () => void;
}) {
    if (!content) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-3 sm:gap-4 p-4 sm:p-8">
                <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center">
                    <FileText className="w-7 h-7 sm:w-10 sm:h-10 text-blue-500" />
                </div>
                <div className="text-center">
                    <p className="text-xs sm:text-sm font-medium text-neutral-600 dark:text-neutral-300">
                        {fileName}
                    </p>
                    <p className="text-[10px] sm:text-xs text-neutral-400 mt-1">
                        {ext.toUpperCase()} document — text extraction not
                        available for this format
                    </p>
                </div>
                <button onClick={onDownload} className="btn-primary text-xs">
                    <Download className="w-3.5 h-3.5" />
                    Download to view
                </button>
            </div>
        );
    }

    // Try to parse as rich JSON (from extractDocxRich)
    let richParagraphs: Array<{
        type: "paragraph" | "heading" | "list-item";
        level?: number;
        runs: Array<{
            text: string;
            bold?: boolean;
            italic?: boolean;
            underline?: boolean;
        }>;
    }> | null = null;

    try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].runs) {
            richParagraphs = parsed;
        }
    } catch {
        // Not JSON — fall back to plain text rendering
    }

    const renderRun = (
        run: {
            text: string;
            bold?: boolean;
            italic?: boolean;
            underline?: boolean;
        },
        key: number,
    ) => {
        let className = "";
        if (run.bold) className += " font-bold";
        if (run.italic) className += " italic";
        if (run.underline) className += " underline";
        return className ? (
            <span key={key} className={className.trim()}>
                {run.text}
            </span>
        ) : (
            <React.Fragment key={key}>{run.text}</React.Fragment>
        );
    };

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center gap-2 px-3 sm:px-4 py-2 border-b border-neutral-200 dark:border-neutral-800 bg-blue-50/50 dark:bg-blue-950/20">
                <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                <span className="text-[10px] sm:text-xs font-medium text-blue-600 dark:text-blue-400 truncate">
                    Document preview (formatting may differ from original)
                </span>
            </div>
            <div className="flex-1 overflow-auto p-3 sm:p-6">
                <div className="max-w-3xl mx-auto bg-white dark:bg-neutral-900/70 rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-700 px-6 sm:px-12 py-6 sm:py-10 min-h-[600px]">
                    {richParagraphs ? (
                        <div className="space-y-1">
                            {richParagraphs.map((para, i) => {
                                const runsContent = para.runs.map((r, j) =>
                                    renderRun(r, j),
                                );

                                if (para.type === "heading") {
                                    const level = para.level || 1;
                                    if (level === 1) {
                                        return (
                                            <h1
                                                key={i}
                                                className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-6 mb-2 first:mt-0"
                                            >
                                                {runsContent}
                                            </h1>
                                        );
                                    }
                                    if (level === 2) {
                                        return (
                                            <h2
                                                key={i}
                                                className="text-lg sm:text-xl font-semibold text-neutral-800 dark:text-neutral-200 mt-5 mb-2 first:mt-0"
                                            >
                                                {runsContent}
                                            </h2>
                                        );
                                    }
                                    if (level === 3) {
                                        return (
                                            <h3
                                                key={i}
                                                className="text-base sm:text-lg font-semibold text-neutral-800 dark:text-neutral-200 mt-4 mb-1.5 first:mt-0"
                                            >
                                                {runsContent}
                                            </h3>
                                        );
                                    }
                                    return (
                                        <h4
                                            key={i}
                                            className="text-sm sm:text-base font-semibold text-neutral-700 dark:text-neutral-300 mt-3 mb-1 first:mt-0"
                                        >
                                            {runsContent}
                                        </h4>
                                    );
                                }

                                if (para.type === "list-item") {
                                    const indent = (para.level || 0) * 20;
                                    return (
                                        <div
                                            key={i}
                                            className="flex gap-2 text-xs sm:text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed py-0.5"
                                            style={{ paddingLeft: indent }}
                                        >
                                            <span className="text-neutral-400 select-none shrink-0">
                                                •
                                            </span>
                                            <span>{runsContent}</span>
                                        </div>
                                    );
                                }

                                // Regular paragraph
                                return (
                                    <p
                                        key={i}
                                        className="text-xs sm:text-sm leading-relaxed text-neutral-700 dark:text-neutral-300 py-0.5"
                                    >
                                        {runsContent}
                                    </p>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {content.split("\n\n").map((para, i) => (
                                <p
                                    key={i}
                                    className="text-xs sm:text-sm leading-relaxed text-neutral-700 dark:text-neutral-300"
                                >
                                    {para}
                                </p>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

/* ─────────────────── Spreadsheet Preview (XLSX/CSV/TSV) ─────────────────── */

function SpreadsheetPreview({
    content,
    fileName,
    ext,
    onDownload,
}: {
    content: string | null;
    fileName: string;
    ext: string;
    onDownload: () => void;
}) {
    const [viewMode, setViewMode] = useState<"table" | "text">("table");

    if (!content) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-3 sm:gap-4 p-4 sm:p-8">
                <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl bg-green-50 dark:bg-green-950/40 flex items-center justify-center">
                    <Sheet className="w-7 h-7 sm:w-10 sm:h-10 text-green-500" />
                </div>
                <div className="text-center">
                    <p className="text-xs sm:text-sm font-medium text-neutral-600 dark:text-neutral-300">
                        {fileName}
                    </p>
                    <p className="text-[10px] sm:text-xs text-neutral-400 mt-1">
                        {ext.toUpperCase()} spreadsheet — preview not available
                        for this format
                    </p>
                </div>
                <button onClick={onDownload} className="btn-primary text-xs">
                    <Download className="w-3.5 h-3.5" />
                    Download to view
                </button>
            </div>
        );
    }

    const rows = content.split("\n").filter(r => r.trim()).map((row) => row.split("\t"));
    const maxCols = Math.max(...rows.map((r) => r.length));
    const isCSV = ext === ".csv" || ext === ".tsv";

    return (
        <div className="flex flex-col h-full">
            {/* Header bar with toggle */}
            <div className="flex items-center gap-2 px-3 sm:px-4 py-2 border-b border-neutral-200 dark:border-neutral-800 bg-green-50/50 dark:bg-green-950/20">
                <Sheet className="w-4 h-4 text-green-500 shrink-0" />
                <span className="text-[10px] sm:text-xs font-medium text-green-600 dark:text-green-400 truncate">
                    {isCSV ? `${ext.replace(".", "").toUpperCase()} data` : "Spreadsheet data — Sheet 1"} · {rows.length} rows · {maxCols} col{maxCols !== 1 ? "s" : ""}
                </span>
                <div className="flex-1" />
                {/* Table / Text toggle */}
                <div className="flex items-center rounded-md border border-neutral-200 dark:border-neutral-700 overflow-hidden shrink-0">
                    <button
                        onClick={() => setViewMode("table")}
                        className={`flex items-center gap-1 px-2 py-1 text-[10px] sm:text-xs font-medium transition-colors ${
                            viewMode === "table"
                                ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400"
                                : "text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                        }`}
                        title="Table view"
                    >
                        <Table className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        <span className="hidden sm:inline">Table</span>
                    </button>
                    <button
                        onClick={() => setViewMode("text")}
                        className={`flex items-center gap-1 px-2 py-1 text-[10px] sm:text-xs font-medium transition-colors ${
                            viewMode === "text"
                                ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400"
                                : "text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                        }`}
                        title="Raw text view"
                    >
                        <AlignLeft className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        <span className="hidden sm:inline">Text</span>
                    </button>
                </div>
            </div>

            {/* Content area */}
            {viewMode === "table" ? (
                <div className="flex-1 overflow-auto">
                    <table className="w-full text-xs border-collapse">
                        <thead className="sticky top-0 z-10">
                            <tr className="bg-neutral-100 dark:bg-neutral-800">
                                <th className="px-1.5 sm:px-2 py-1.5 text-center font-medium text-neutral-400 dark:text-neutral-500 border-b border-r border-neutral-200 dark:border-neutral-700 w-8 sm:w-10">
                                    #
                                </th>
                                {Array.from({ length: maxCols }, (_, i) => (
                                    <th
                                        key={i}
                                        className="px-2 sm:px-3 py-1.5 text-left font-medium text-neutral-500 dark:text-neutral-400 border-b border-r border-neutral-200 dark:border-neutral-700 min-w-[60px] sm:min-w-[100px]"
                                    >
                                        {String.fromCharCode(65 + (i % 26))}
                                        {i >= 26
                                            ? String.fromCharCode(
                                                  65 + Math.floor(i / 26) - 1,
                                              )
                                            : ""}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row, rowIdx) => (
                                <tr
                                    key={rowIdx}
                                    className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                                >
                                    <td className="px-1.5 sm:px-2 py-1 text-center font-mono text-[10px] text-neutral-400 dark:text-neutral-600 border-b border-r border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/50">
                                        {rowIdx + 1}
                                    </td>
                                    {Array.from(
                                        { length: maxCols },
                                        (_, colIdx) => (
                                            <td
                                                key={colIdx}
                                                className="px-2 sm:px-3 py-1 border-b border-r border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 whitespace-nowrap max-w-[200px] sm:max-w-none truncate"
                                            >
                                                {row[colIdx] || ""}
                                            </td>
                                        ),
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="flex-1 overflow-auto p-3 sm:p-4">
                    <pre className="text-[10px] sm:text-xs font-mono text-neutral-700 dark:text-neutral-300 whitespace-pre leading-relaxed">
                        {content}
                    </pre>
                </div>
            )}
        </div>
    );
}

/* ─────────────────── Presentation Preview (PPTX) ─────────────────── */

function PresentationPreview({
    content,
    fileName,
    ext,
    onDownload,
}: {
    content: string | null;
    fileName: string;
    ext: string;
    onDownload: () => void;
}) {
    if (!content) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-3 sm:gap-4 p-4 sm:p-8">
                <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl bg-orange-50 dark:bg-orange-950/40 flex items-center justify-center">
                    <Presentation className="w-7 h-7 sm:w-10 sm:h-10 text-orange-500" />
                </div>
                <div className="text-center">
                    <p className="text-xs sm:text-sm font-medium text-neutral-600 dark:text-neutral-300">
                        {fileName}
                    </p>
                    <p className="text-[10px] sm:text-xs text-neutral-400 mt-1">
                        {ext.toUpperCase()} presentation — preview not available
                        for this format
                    </p>
                </div>
                <button onClick={onDownload} className="btn-primary text-xs">
                    <Download className="w-3.5 h-3.5" />
                    Download to view
                </button>
            </div>
        );
    }

    // Try to parse as rich JSON (from extractPptxRich)
    let richSlides: Array<{
        slideNumber: number;
        textBoxes: Array<{
            paragraphs: Array<{
                runs: Array<{
                    text: string;
                    bold?: boolean;
                    italic?: boolean;
                    fontSize?: number;
                }>;
            }>;
        }>;
    }> | null = null;

    try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].textBoxes) {
            richSlides = parsed;
        }
    } catch {
        // Not JSON — legacy format fallback
    }

    if (richSlides) {
        return (
            <div className="flex flex-col h-full">
                <div className="flex items-center gap-2 px-3 sm:px-4 py-2 border-b border-neutral-200 dark:border-neutral-800 bg-orange-50/50 dark:bg-orange-950/20">
                    <Presentation className="w-4 h-4 text-orange-500 shrink-0" />
                    <span className="text-[10px] sm:text-xs font-medium text-orange-600 dark:text-orange-400 truncate">
                        Presentation preview · {richSlides.length} slide
                        {richSlides.length !== 1 ? "s" : ""}
                    </span>
                </div>
                <div className="flex-1 overflow-auto p-3 sm:p-6 bg-neutral-100 dark:bg-neutral-900/50">
                    <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
                        {richSlides.map((slide) => (
                            <div key={slide.slideNumber} className="group">
                                {/* Slide label */}
                                <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
                                    <span className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
                                        Slide {slide.slideNumber}
                                    </span>
                                    <div className="flex-1 h-px bg-neutral-200 dark:bg-neutral-800" />
                                </div>
                                {/* Slide card — 16:9 aspect ratio */}
                                <div
                                    className="relative w-full bg-white dark:bg-neutral-800 rounded-lg sm:rounded-xl shadow-md border border-neutral-200 dark:border-neutral-700 overflow-hidden"
                                    style={{ aspectRatio: "16/9" }}
                                >
                                    <div className="absolute inset-0 p-4 sm:p-8 flex flex-col justify-center overflow-auto">
                                        {slide.textBoxes.map((box, bi) => (
                                            <div
                                                key={bi}
                                                className={
                                                    bi === 0
                                                        ? "mb-3 sm:mb-6"
                                                        : "mb-2 sm:mb-4"
                                                }
                                            >
                                                {box.paragraphs.map(
                                                    (para, pi) => {
                                                        // Determine if this is a title (first text box, first paragraph, or large font)
                                                        const isTitle =
                                                            bi === 0 &&
                                                            pi === 0;
                                                        const maxFontSize =
                                                            Math.max(
                                                                ...para.runs.map(
                                                                    (r) =>
                                                                        r.fontSize ||
                                                                        0,
                                                                ),
                                                            );
                                                        const isLargeText =
                                                            maxFontSize >= 24;

                                                        if (
                                                            isTitle ||
                                                            isLargeText
                                                        ) {
                                                            return (
                                                                <p
                                                                    key={pi}
                                                                    className="text-base sm:text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-1 sm:mb-2"
                                                                >
                                                                    {para.runs.map(
                                                                        (
                                                                            r,
                                                                            ri,
                                                                        ) => {
                                                                            let cls =
                                                                                "";
                                                                            if (
                                                                                r.italic
                                                                            )
                                                                                cls +=
                                                                                    " italic";
                                                                            return cls ? (
                                                                                <span
                                                                                    key={
                                                                                        ri
                                                                                    }
                                                                                    className={cls.trim()}
                                                                                >
                                                                                    {
                                                                                        r.text
                                                                                    }
                                                                                </span>
                                                                            ) : (
                                                                                <React.Fragment
                                                                                    key={
                                                                                        ri
                                                                                    }
                                                                                >
                                                                                    {
                                                                                        r.text
                                                                                    }
                                                                                </React.Fragment>
                                                                            );
                                                                        },
                                                                    )}
                                                                </p>
                                                            );
                                                        }

                                                        // Subtitle or body text
                                                        const isSubtitle =
                                                            bi === 0 &&
                                                            pi === 1;
                                                        return (
                                                            <p
                                                                key={pi}
                                                                className={`${isSubtitle ? "text-sm sm:text-lg text-neutral-500 dark:text-neutral-400" : "text-xs sm:text-sm text-neutral-700 dark:text-neutral-300"} leading-relaxed mb-0.5 sm:mb-1`}
                                                            >
                                                                {para.runs.map(
                                                                    (r, ri) => {
                                                                        let cls =
                                                                            "";
                                                                        if (
                                                                            r.bold
                                                                        )
                                                                            cls +=
                                                                                " font-semibold";
                                                                        if (
                                                                            r.italic
                                                                        )
                                                                            cls +=
                                                                                " italic";
                                                                        return cls ? (
                                                                            <span
                                                                                key={
                                                                                    ri
                                                                                }
                                                                                className={cls.trim()}
                                                                            >
                                                                                {
                                                                                    r.text
                                                                                }
                                                                            </span>
                                                                        ) : (
                                                                            <React.Fragment
                                                                                key={
                                                                                    ri
                                                                                }
                                                                            >
                                                                                {
                                                                                    r.text
                                                                                }
                                                                            </React.Fragment>
                                                                        );
                                                                    },
                                                                )}
                                                            </p>
                                                        );
                                                    },
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // Fallback: plain text slides
    const slides = content.split(/--- Slide \d+ ---/).filter((s) => s.trim());
    const slideHeaders = content.match(/--- Slide \d+ ---/g) || [];

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center gap-2 px-3 sm:px-4 py-2 border-b border-neutral-200 dark:border-neutral-800 bg-orange-50/50 dark:bg-orange-950/20">
                <Presentation className="w-4 h-4 text-orange-500 shrink-0" />
                <span className="text-[10px] sm:text-xs font-medium text-orange-600 dark:text-orange-400 truncate">
                    Presentation text content · {slides.length} slide
                    {slides.length !== 1 ? "s" : ""}
                </span>
            </div>
            <div className="flex-1 overflow-auto p-3 sm:p-6">
                <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6">
                    {slides.map((slideContent, i) => (
                        <div
                            key={i}
                            className="rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden"
                        >
                            <div className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-orange-50 dark:bg-orange-950/30 border-b border-neutral-200 dark:border-neutral-700">
                                <span className="text-[10px] sm:text-xs font-semibold text-orange-600 dark:text-orange-400">
                                    {slideHeaders[i] || `Slide ${i + 1}`}
                                </span>
                            </div>
                            <div className="p-3 sm:p-4 space-y-1.5 bg-white dark:bg-neutral-900/50">
                                {slideContent
                                    .trim()
                                    .split("\n")
                                    .map((line, j) => (
                                        <p
                                            key={j}
                                            className={`text-xs sm:text-sm text-neutral-700 dark:text-neutral-300 ${
                                                j === 0
                                                    ? "font-semibold text-sm sm:text-base"
                                                    : ""
                                            }`}
                                        >
                                            {line}
                                        </p>
                                    ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
