"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
    Info,
    Camera,
    MapPin,
    Ruler,
    Clock,
    HardDrive,
    FileType,
    Hash,
    Aperture,
    Sun,
    Zap,
    Palette,
    User,
    Smartphone,
    ChevronDown,
    ChevronRight,
    X,
} from "lucide-react";
import type { Unzipped } from "@/lib/zip-handler";
import { ZipEntry, MIME_MAP } from "@/lib/types";
import { formatBytes, getExtension } from "@/lib/utils";
import {
    buildFileMetadata,
    type FileMetadata,
    type ExifData,
} from "@/lib/metadata";

interface MetadataPanelProps {
    entry: ZipEntry;
    unzipped: Unzipped | null;
    onClose: () => void;
}

export function MetadataPanel({
    entry,
    unzipped,
    onClose,
}: MetadataPanelProps) {
    const [metadata, setMetadata] = useState<FileMetadata | null>(null);

    const ext = useMemo(() => getExtension(entry.path), [entry.path]);
    const mime = MIME_MAP[ext] || "application/octet-stream";

    useEffect(() => {
        const data = unzipped?.[entry.path] ?? null;
        const meta = buildFileMetadata(entry, data, ext, mime);
        setMetadata(meta);
    }, [entry, unzipped, ext, mime]);

    if (!metadata) return null;

    return (
        <div className="flex flex-col h-full bg-white dark:bg-neutral-950 border-l border-neutral-200 dark:border-neutral-800">
            {/* Header */}
            <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                    <Info className="w-4 h-4 text-brand-500 shrink-0" />
                    <span className="text-xs sm:text-sm font-medium truncate">
                        File Info
                    </span>
                </div>
                <button
                    onClick={onClose}
                    className="p-1 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                    <X className="w-3.5 h-3.5 text-neutral-500" />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4">
                {/* General Info */}
                <MetadataSection title="General" defaultOpen>
                    <MetadataRow
                        icon={<FileType className="w-3.5 h-3.5" />}
                        label="Type"
                        value={metadata.extension.toUpperCase()}
                    />
                    <MetadataRow
                        icon={<Hash className="w-3.5 h-3.5" />}
                        label="MIME"
                        value={metadata.mimeType}
                        mono
                    />
                    <MetadataRow
                        icon={<HardDrive className="w-3.5 h-3.5" />}
                        label="Size"
                        value={formatBytes(metadata.size)}
                    />
                    <MetadataRow
                        icon={<HardDrive className="w-3.5 h-3.5" />}
                        label="Compressed"
                        value={formatBytes(metadata.compressedSize)}
                    />
                    {metadata.compressionRatio !== null &&
                        metadata.compressionRatio > 0 && (
                            <MetadataRow
                                icon={<HardDrive className="w-3.5 h-3.5" />}
                                label="Saved"
                                value={`${metadata.compressionRatio}%`}
                                valueColor="text-emerald-600 dark:text-emerald-400"
                            />
                        )}
                    <MetadataRow
                        icon={<Clock className="w-3.5 h-3.5" />}
                        label="Modified"
                        value={metadata.lastModified.toLocaleString()}
                    />
                </MetadataSection>

                {/* Image dimensions */}
                {metadata.dimensions && (
                    <MetadataSection title="Image" defaultOpen>
                        <MetadataRow
                            icon={<Ruler className="w-3.5 h-3.5" />}
                            label="Dimensions"
                            value={`${metadata.dimensions.width} × ${metadata.dimensions.height}`}
                        />
                        <MetadataRow
                            icon={<Ruler className="w-3.5 h-3.5" />}
                            label="Megapixels"
                            value={`${((metadata.dimensions.width * metadata.dimensions.height) / 1_000_000).toFixed(1)} MP`}
                        />
                        <MetadataRow
                            icon={<Ruler className="w-3.5 h-3.5" />}
                            label="Aspect Ratio"
                            value={getAspectRatio(
                                metadata.dimensions.width,
                                metadata.dimensions.height,
                            )}
                        />
                    </MetadataSection>
                )}

                {/* EXIF Camera Info */}
                {metadata.exif && (
                    <>
                        <ExifCameraSection exif={metadata.exif} />
                        <ExifSettingsSection exif={metadata.exif} />
                        {(metadata.exif.gpsLatitude !== undefined ||
                            metadata.exif.gpsLongitude !== undefined) && (
                            <ExifGPSSection exif={metadata.exif} />
                        )}
                    </>
                )}

                {/* Text/Code info */}
                {metadata.lineCount !== undefined && (
                    <MetadataSection title="Text" defaultOpen>
                        <MetadataRow
                            icon={<Hash className="w-3.5 h-3.5" />}
                            label="Lines"
                            value={metadata.lineCount.toLocaleString()}
                        />
                        {metadata.encoding && (
                            <MetadataRow
                                icon={<FileType className="w-3.5 h-3.5" />}
                                label="Encoding"
                                value={metadata.encoding}
                            />
                        )}
                    </MetadataSection>
                )}

                {/* Full path */}
                <MetadataSection title="Path">
                    <p className="text-[10px] sm:text-xs text-neutral-500 dark:text-neutral-400 font-mono break-all leading-relaxed">
                        {metadata.filePath}
                    </p>
                </MetadataSection>
            </div>
        </div>
    );
}

/* ─── Reusable sub-components ─── */

function MetadataSection({
    title,
    defaultOpen = false,
    children,
}: {
    title: string;
    defaultOpen?: boolean;
    children: React.ReactNode;
}) {
    const [open, setOpen] = useState(defaultOpen);

    return (
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 overflow-hidden">
            <button
                onClick={() => setOpen(!open)}
                className="flex items-center gap-2 w-full px-3 py-2 text-left text-xs font-semibold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors"
            >
                {open ? (
                    <ChevronDown className="w-3 h-3 text-neutral-400" />
                ) : (
                    <ChevronRight className="w-3 h-3 text-neutral-400" />
                )}
                {title}
            </button>
            {open && (
                <div className="px-3 pb-2.5 pt-0.5 space-y-1.5 border-t border-neutral-100 dark:border-neutral-800/50">
                    {children}
                </div>
            )}
        </div>
    );
}

function MetadataRow({
    icon,
    label,
    value,
    mono = false,
    valueColor,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
    mono?: boolean;
    valueColor?: string;
}) {
    return (
        <div className="flex items-start gap-2 text-[10px] sm:text-xs">
            <span className="text-neutral-400 dark:text-neutral-500 mt-0.5 shrink-0">
                {icon}
            </span>
            <span className="text-neutral-500 dark:text-neutral-400 shrink-0 min-w-[70px] sm:min-w-[80px]">
                {label}
            </span>
            <span
                className={`${valueColor || "text-neutral-700 dark:text-neutral-200"} ${mono ? "font-mono" : ""} break-all`}
            >
                {value}
            </span>
        </div>
    );
}

/* ─── EXIF sections ─── */

function ExifCameraSection({ exif }: { exif: ExifData }) {
    const hasCamera =
        exif.make || exif.model || exif.lensModel || exif.software;
    if (!hasCamera) return null;

    return (
        <MetadataSection title="Camera" defaultOpen>
            {exif.make && (
                <MetadataRow
                    icon={<Smartphone className="w-3.5 h-3.5" />}
                    label="Make"
                    value={exif.make}
                />
            )}
            {exif.model && (
                <MetadataRow
                    icon={<Camera className="w-3.5 h-3.5" />}
                    label="Model"
                    value={exif.model}
                />
            )}
            {exif.lensModel && (
                <MetadataRow
                    icon={<Camera className="w-3.5 h-3.5" />}
                    label="Lens"
                    value={exif.lensModel}
                />
            )}
            {exif.software && (
                <MetadataRow
                    icon={<Info className="w-3.5 h-3.5" />}
                    label="Software"
                    value={exif.software}
                />
            )}
            {exif.artist && (
                <MetadataRow
                    icon={<User className="w-3.5 h-3.5" />}
                    label="Artist"
                    value={exif.artist}
                />
            )}
            {exif.copyright && (
                <MetadataRow
                    icon={<User className="w-3.5 h-3.5" />}
                    label="Copyright"
                    value={exif.copyright}
                />
            )}
        </MetadataSection>
    );
}

function ExifSettingsSection({ exif }: { exif: ExifData }) {
    const hasSettings =
        exif.exposureTime ||
        exif.fNumber ||
        exif.iso ||
        exif.focalLength ||
        exif.flash ||
        exif.whiteBalance ||
        exif.colorSpace;
    if (!hasSettings) return null;

    return (
        <MetadataSection title="Exposure" defaultOpen>
            {exif.exposureTime && (
                <MetadataRow
                    icon={<Clock className="w-3.5 h-3.5" />}
                    label="Shutter"
                    value={String(exif.exposureTime)}
                />
            )}
            {exif.fNumber && (
                <MetadataRow
                    icon={<Aperture className="w-3.5 h-3.5" />}
                    label="Aperture"
                    value={String(exif.fNumber)}
                />
            )}
            {exif.iso !== undefined && (
                <MetadataRow
                    icon={<Sun className="w-3.5 h-3.5" />}
                    label="ISO"
                    value={String(exif.iso)}
                />
            )}
            {exif.focalLength && (
                <MetadataRow
                    icon={<Camera className="w-3.5 h-3.5" />}
                    label="Focal"
                    value={String(exif.focalLength)}
                />
            )}
            {exif.flash && (
                <MetadataRow
                    icon={<Zap className="w-3.5 h-3.5" />}
                    label="Flash"
                    value={String(exif.flash)}
                />
            )}
            {exif.whiteBalance && (
                <MetadataRow
                    icon={<Palette className="w-3.5 h-3.5" />}
                    label="WB"
                    value={String(exif.whiteBalance)}
                />
            )}
            {exif.colorSpace && (
                <MetadataRow
                    icon={<Palette className="w-3.5 h-3.5" />}
                    label="Color"
                    value={String(exif.colorSpace)}
                />
            )}
            {exif.dateTimeOriginal && (
                <MetadataRow
                    icon={<Clock className="w-3.5 h-3.5" />}
                    label="Taken"
                    value={String(exif.dateTimeOriginal)}
                />
            )}
        </MetadataSection>
    );
}

function ExifGPSSection({ exif }: { exif: ExifData }) {
    return (
        <MetadataSection title="GPS Location" defaultOpen>
            {exif.gpsLatitude !== undefined && (
                <MetadataRow
                    icon={<MapPin className="w-3.5 h-3.5" />}
                    label="Latitude"
                    value={`${exif.gpsLatitude.toFixed(6)}°`}
                    mono
                />
            )}
            {exif.gpsLongitude !== undefined && (
                <MetadataRow
                    icon={<MapPin className="w-3.5 h-3.5" />}
                    label="Longitude"
                    value={`${exif.gpsLongitude.toFixed(6)}°`}
                    mono
                />
            )}
            {exif.gpsAltitude !== undefined && (
                <MetadataRow
                    icon={<MapPin className="w-3.5 h-3.5" />}
                    label="Altitude"
                    value={`${exif.gpsAltitude.toFixed(1)}m`}
                    mono
                />
            )}
            {exif.gpsLatitude !== undefined &&
                exif.gpsLongitude !== undefined && (
                    <a
                        href={`https://www.google.com/maps?q=${exif.gpsLatitude},${exif.gpsLongitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-[10px] sm:text-xs text-brand-500 hover:text-brand-600 font-medium mt-1"
                    >
                        <MapPin className="w-3 h-3" />
                        Open in Google Maps ↗
                    </a>
                )}
        </MetadataSection>
    );
}

/* ─── Helper ─── */

function getAspectRatio(w: number, h: number): string {
    const g = gcd(w, h);
    const rw = w / g;
    const rh = h / g;
    // Simplify common ratios
    if (rw === 16 && rh === 9) return "16:9";
    if (rw === 4 && rh === 3) return "4:3";
    if (rw === 3 && rh === 2) return "3:2";
    if (rw === 1 && rh === 1) return "1:1";
    if (rw === 21 && rh === 9) return "21:9";
    // If too complex, approximate
    if (rw > 100) {
        const ratio = w / h;
        if (Math.abs(ratio - 16 / 9) < 0.05) return "≈ 16:9";
        if (Math.abs(ratio - 4 / 3) < 0.05) return "≈ 4:3";
        if (Math.abs(ratio - 3 / 2) < 0.05) return "≈ 3:2";
        return `${ratio.toFixed(2)}:1`;
    }
    return `${rw}:${rh}`;
}

function gcd(a: number, b: number): number {
    a = Math.abs(a);
    b = Math.abs(b);
    while (b) {
        [a, b] = [b, a % b];
    }
    return a;
}
