"use client";

import React, { useMemo } from "react";
import {
    MousePointerClick,
    FileSearch,
    FolderTree,
    Files,
    HardDrive,
    Package,
    Code2,
    Image,
    Film,
    Music,
    FileText,
    Database,
    Type,
} from "lucide-react";
import { ZipEntry } from "@/lib/types";
import { formatBytes, getExtension } from "@/lib/utils";
import {
    detectProject,
    ProjectInfo,
    parsePackageJson,
    parseRequirementsTxt,
    parseCargoToml,
} from "@/lib/project-detection";
import type { Unzipped } from "@/lib/zip-handler";

interface ProjectDashboardProps {
    entries: ZipEntry[];
    unzipped: Unzipped | null;
    fileCount: number;
    onSelectEntry?: (entry: ZipEntry) => void;
}

export function ProjectDashboard({
    entries,
    unzipped,
    fileCount,
    onSelectEntry,
}: ProjectDashboardProps) {
    const project = useMemo(() => detectProject(entries), [entries]);

    const stats = useMemo(() => {
        const files = entries.filter((e) => !e.isDirectory);
        const extCounts = new Map<string, number>();
        const categoryCounts = {
            images: 0,
            video: 0,
            audio: 0,
            code: 0,
            docs: 0,
            data: 0,
            fonts: 0,
            other: 0,
        };

        const imageExts = new Set([
            ".png",
            ".jpg",
            ".jpeg",
            ".gif",
            ".webp",
            ".bmp",
            ".svg",
            ".avif",
            ".ico",
        ]);
        const videoExts = new Set([
            ".mp4",
            ".mkv",
            ".avi",
            ".mov",
            ".webm",
            ".flv",
        ]);
        const audioExts = new Set([
            ".mp3",
            ".wav",
            ".flac",
            ".aac",
            ".m4a",
            ".ogg",
        ]);
        const codeExts = new Set([
            ".js",
            ".ts",
            ".jsx",
            ".tsx",
            ".py",
            ".rb",
            ".go",
            ".rs",
            ".java",
            ".c",
            ".cpp",
            ".h",
            ".cs",
            ".php",
            ".html",
            ".css",
            ".scss",
            ".vue",
            ".svelte",
        ]);
        const docExts = new Set([
            ".pdf",
            ".doc",
            ".docx",
            ".xls",
            ".xlsx",
            ".ppt",
            ".pptx",
            ".md",
            ".txt",
        ]);
        const dataExts = new Set([
            ".json",
            ".xml",
            ".yaml",
            ".yml",
            ".csv",
            ".tsv",
            ".sql",
        ]);
        const fontExts = new Set([".ttf", ".otf", ".woff", ".woff2"]);

        for (const f of files) {
            const ext = getExtension(f.path) || "(none)";
            extCounts.set(ext, (extCounts.get(ext) || 0) + 1);

            if (imageExts.has(ext)) categoryCounts.images++;
            else if (videoExts.has(ext)) categoryCounts.video++;
            else if (audioExts.has(ext)) categoryCounts.audio++;
            else if (codeExts.has(ext)) categoryCounts.code++;
            else if (docExts.has(ext)) categoryCounts.docs++;
            else if (dataExts.has(ext)) categoryCounts.data++;
            else if (fontExts.has(ext)) categoryCounts.fonts++;
            else categoryCounts.other++;
        }

        // Top 8 extensions
        const topExts = Array.from(extCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8);

        const totalSize = files.reduce((s, f) => s + f.size, 0);
        const largestFiles = [...files]
            .sort((a, b) => b.size - a.size)
            .slice(0, 5);
        const dirCount = entries.filter((e) => e.isDirectory).length;

        return {
            files: files.length,
            dirCount,
            totalSize,
            topExts,
            categoryCounts,
            largestFiles,
        };
    }, [entries]);

    // Try to parse project metadata
    const metadata = useMemo(() => {
        if (!unzipped) return null;
        const result: Record<string, unknown> = {};

        // Look for package.json
        for (const key of Object.keys(unzipped)) {
            const lower = key.toLowerCase();
            if (
                lower.endsWith("package.json") &&
                lower.split("/").length <= 3
            ) {
                try {
                    const text = new TextDecoder().decode(unzipped[key]);
                    const parsed = parsePackageJson(text);
                    if (parsed) result.packageJson = parsed;
                } catch {
                    /* ignore */
                }
                break;
            }
        }

        // Look for requirements.txt
        for (const key of Object.keys(unzipped)) {
            const lower = key.toLowerCase();
            if (
                lower.endsWith("requirements.txt") &&
                lower.split("/").length <= 3
            ) {
                try {
                    const text = new TextDecoder().decode(unzipped[key]);
                    result.requirements = parseRequirementsTxt(text);
                } catch {
                    /* ignore */
                }
                break;
            }
        }

        // Look for Cargo.toml
        for (const key of Object.keys(unzipped)) {
            const lower = key.toLowerCase();
            if (lower.endsWith("cargo.toml") && lower.split("/").length <= 3) {
                try {
                    const text = new TextDecoder().decode(unzipped[key]);
                    const parsed = parseCargoToml(text);
                    if (parsed) result.cargoToml = parsed;
                } catch {
                    /* ignore */
                }
                break;
            }
        }

        return Object.keys(result).length > 0 ? result : null;
    }, [unzipped]);

    const categoryIcons: Record<string, React.ReactNode> = {
        images: <Image className="w-3.5 h-3.5" />,
        video: <Film className="w-3.5 h-3.5" />,
        audio: <Music className="w-3.5 h-3.5" />,
        code: <Code2 className="w-3.5 h-3.5" />,
        docs: <FileText className="w-3.5 h-3.5" />,
        data: <Database className="w-3.5 h-3.5" />,
        fonts: <Type className="w-3.5 h-3.5" />,
        other: <Files className="w-3.5 h-3.5" />,
    };

    const categoryLabels: Record<string, string> = {
        images: "Images",
        video: "Video",
        audio: "Audio",
        code: "Code",
        docs: "Documents",
        data: "Data",
        fonts: "Fonts",
        other: "Other",
    };

    const activeCategories = Object.entries(stats.categoryCounts).filter(
        ([, c]) => c > 0,
    );

    return (
        <div className="flex flex-col h-full overflow-y-auto">
            <div className="max-w-2xl mx-auto w-full p-4 sm:p-6 space-y-5">
                {/* Project Identity */}
                <div className="text-center space-y-2 pb-4 border-b border-neutral-200 dark:border-neutral-800">
                    <div className="text-3xl sm:text-4xl">{project.icon}</div>
                    <h2 className="text-base sm:text-lg font-bold">
                        {project.label}
                    </h2>
                    <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
                        {project.description}
                    </p>
                    {project.markers.length > 0 && (
                        <div className="flex flex-wrap items-center justify-center gap-1 mt-2">
                            {project.markers.map((m) => (
                                <span
                                    key={m}
                                    className="badge-info text-[10px]"
                                >
                                    {m}
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {/* Quick Stats Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                    <StatCard
                        icon={<Files className="w-4 h-4" />}
                        label="Files"
                        value={String(stats.files)}
                    />
                    <StatCard
                        icon={<FolderTree className="w-4 h-4" />}
                        label="Folders"
                        value={String(stats.dirCount)}
                    />
                    <StatCard
                        icon={<HardDrive className="w-4 h-4" />}
                        label="Total Size"
                        value={formatBytes(stats.totalSize)}
                    />
                    <StatCard
                        icon={<Package className="w-4 h-4" />}
                        label="Extensions"
                        value={String(stats.topExts.length) + " types"}
                    />
                </div>

                {/* Content Breakdown */}
                {activeCategories.length > 0 && (
                    <div>
                        <h3 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-2">
                            Content Breakdown
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                            {activeCategories.map(([cat, count]) => (
                                <div
                                    key={cat}
                                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 text-xs"
                                >
                                    <span className="text-neutral-400 dark:text-neutral-500">
                                        {categoryIcons[cat]}
                                    </span>
                                    <span className="truncate">
                                        {categoryLabels[cat]}
                                    </span>
                                    <span className="ml-auto font-medium tabular-nums">
                                        {count}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Top Extensions */}
                {stats.topExts.length > 0 && (
                    <div>
                        <h3 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-2">
                            File Types
                        </h3>
                        <div className="flex flex-wrap gap-1.5">
                            {stats.topExts.map(([ext, count]) => (
                                <span
                                    key={ext}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-neutral-100 dark:bg-neutral-800 text-[10px] sm:text-xs"
                                >
                                    <span className="font-mono font-medium">
                                        {ext}
                                    </span>
                                    <span className="text-neutral-400 dark:text-neutral-500">
                                        ×{count}
                                    </span>
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Largest Files */}
                {stats.largestFiles.length > 0 && (
                    <div>
                        <h3 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-2">
                            Largest Files
                        </h3>
                        <div className="space-y-1">
                            {stats.largestFiles.map((f) => (
                                <button
                                    key={f.path}
                                    onClick={() => onSelectEntry?.(f)}
                                    className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs text-left transition-colors"
                                >
                                    <span className="truncate flex-1 text-neutral-700 dark:text-neutral-300">
                                        {f.name}
                                    </span>
                                    <span className="shrink-0 tabular-nums text-neutral-400 dark:text-neutral-500">
                                        {formatBytes(f.size)}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Project Metadata */}
                {metadata && (
                    <div>
                        <h3 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-2">
                            Project Info
                        </h3>
                        {metadata.packageJson ? (
                            <PackageJsonCard
                                data={
                                    metadata.packageJson as Record<
                                        string,
                                        unknown
                                    >
                                }
                            />
                        ) : null}
                        {metadata.requirements ? (
                            <DependencyList
                                title="Python Dependencies"
                                icon="🐍"
                                deps={metadata.requirements as string[]}
                            />
                        ) : null}
                        {metadata.cargoToml ? (
                            <CargoTomlCard
                                data={
                                    metadata.cargoToml as Record<
                                        string,
                                        unknown
                                    >
                                }
                            />
                        ) : null}
                    </div>
                )}

                {/* CTA */}
                <div className="flex items-center justify-center gap-1.5 text-[10px] sm:text-xs text-neutral-400 dark:text-neutral-500 pt-2">
                    <MousePointerClick className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    <span>Select a file in the sidebar to preview it</span>
                </div>
            </div>
        </div>
    );
}

/* ── Sub-components ─────────────────────────────────────── */

function StatCard({
    icon,
    label,
    value,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
}) {
    return (
        <div className="flex flex-col items-center gap-1 px-3 py-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200/50 dark:border-neutral-700/50">
            <div className="text-neutral-400 dark:text-neutral-500">{icon}</div>
            <div className="text-sm font-bold tabular-nums">{value}</div>
            <div className="text-[10px] text-neutral-400 dark:text-neutral-500">
                {label}
            </div>
        </div>
    );
}

function PackageJsonCard({ data }: { data: Record<string, unknown> }) {
    const deps = (data.dependencies as string[]) || [];
    const devDeps = (data.devDependencies as string[]) || [];
    const scripts = (data.scripts as string[]) || [];
    const name = (data.name as string) || "package.json";
    const version = data.version as string | undefined;
    const description = data.description as string | undefined;
    const license = data.license as string | undefined;

    return (
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden mb-2">
            <div className="px-3 py-2 bg-neutral-50 dark:bg-neutral-800/80 flex items-center gap-2 border-b border-neutral-200 dark:border-neutral-700">
                <span>📦</span>
                <span className="text-xs font-semibold">{name}</span>
                {version && (
                    <span className="badge-info text-[10px]">v{version}</span>
                )}
            </div>
            <div className="p-3 space-y-2 text-xs">
                {description && (
                    <p className="text-neutral-500 dark:text-neutral-400">
                        {description}
                    </p>
                )}
                {license && (
                    <p className="text-[10px] text-neutral-400">
                        License: {license}
                    </p>
                )}
                {deps.length > 0 && (
                    <div>
                        <p className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500 mb-1">
                            Dependencies ({deps.length})
                        </p>
                        <div className="flex flex-wrap gap-1">
                            {deps.slice(0, 20).map((d) => (
                                <span
                                    key={d}
                                    className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 text-[10px]"
                                >
                                    {d}
                                </span>
                            ))}
                            {deps.length > 20 && (
                                <span className="text-[10px] text-neutral-400">
                                    +{deps.length - 20} more
                                </span>
                            )}
                        </div>
                    </div>
                )}
                {devDeps.length > 0 && (
                    <div>
                        <p className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500 mb-1">
                            Dev Dependencies ({devDeps.length})
                        </p>
                        <div className="flex flex-wrap gap-1">
                            {devDeps.slice(0, 15).map((d) => (
                                <span
                                    key={d}
                                    className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 text-[10px]"
                                >
                                    {d}
                                </span>
                            ))}
                            {devDeps.length > 15 && (
                                <span className="text-[10px] text-neutral-400">
                                    +{devDeps.length - 15} more
                                </span>
                            )}
                        </div>
                    </div>
                )}
                {scripts.length > 0 && (
                    <div>
                        <p className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500 mb-1">
                            Scripts
                        </p>
                        <div className="flex flex-wrap gap-1">
                            {scripts.map((s) => (
                                <span
                                    key={s}
                                    className="px-1.5 py-0.5 rounded bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-400 text-[10px] font-mono"
                                >
                                    {s}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function DependencyList({
    title,
    icon,
    deps,
}: {
    title: string;
    icon: string;
    deps: string[];
}) {
    return (
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden mb-2">
            <div className="px-3 py-2 bg-neutral-50 dark:bg-neutral-800/80 flex items-center gap-2 border-b border-neutral-200 dark:border-neutral-700">
                <span>{icon}</span>
                <span className="text-xs font-semibold">{title}</span>
                <span className="badge-info text-[10px]">{deps.length}</span>
            </div>
            <div className="p-3">
                <div className="flex flex-wrap gap-1">
                    {deps.slice(0, 30).map((d) => (
                        <span
                            key={d}
                            className="px-1.5 py-0.5 rounded bg-yellow-50 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-400 text-[10px]"
                        >
                            {d}
                        </span>
                    ))}
                    {deps.length > 30 && (
                        <span className="text-[10px] text-neutral-400">
                            +{deps.length - 30} more
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

function CargoTomlCard({ data }: { data: Record<string, unknown> }) {
    const deps = (data.dependencies as string[]) || [];
    const name = (data.name as string) || "Cargo.toml";
    const version = data.version as string | undefined;
    const description = data.description as string | undefined;

    return (
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden mb-2">
            <div className="px-3 py-2 bg-neutral-50 dark:bg-neutral-800/80 flex items-center gap-2 border-b border-neutral-200 dark:border-neutral-700">
                <span>🦀</span>
                <span className="text-xs font-semibold">{name}</span>
                {version && (
                    <span className="badge-info text-[10px]">v{version}</span>
                )}
            </div>
            <div className="p-3 space-y-2 text-xs">
                {description && (
                    <p className="text-neutral-500 dark:text-neutral-400">
                        {description}
                    </p>
                )}
                {deps.length > 0 && (
                    <div>
                        <p className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500 mb-1">
                            Dependencies ({deps.length})
                        </p>
                        <div className="flex flex-wrap gap-1">
                            {deps.map((d) => (
                                <span
                                    key={d}
                                    className="px-1.5 py-0.5 rounded bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 text-[10px]"
                                >
                                    {d}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
