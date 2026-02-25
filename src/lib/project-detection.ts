/**
 * Smart Project Detection
 *
 * Analyzes the file structure of a ZIP to detect what kind of
 * project or content it contains, and provides a summary dashboard.
 */

import { ZipEntry } from "./types";
import { getExtension } from "./utils";

export type ProjectType =
    | "nodejs"
    | "python"
    | "rust"
    | "go"
    | "java"
    | "dotnet"
    | "ruby"
    | "php"
    | "swift"
    | "flutter"
    | "react"
    | "nextjs"
    | "vue"
    | "svelte"
    | "angular"
    | "photo-album"
    | "video-collection"
    | "audio-collection"
    | "font-pack"
    | "document-bundle"
    | "dataset"
    | "unknown";

export interface ProjectInfo {
    type: ProjectType;
    label: string;
    icon: string;
    description: string;
    /** Key files that triggered this detection */
    markers: string[];
    /** Parsed metadata (e.g., dependencies from package.json) */
    metadata?: Record<string, unknown>;
}

interface DetectionRule {
    type: ProjectType;
    label: string;
    icon: string;
    description: string;
    /** File patterns that indicate this project type */
    markerFiles: string[];
    /** Minimum number of marker files needed */
    minMarkers?: number;
    /** Priority — higher wins when multiple match */
    priority: number;
}

const DETECTION_RULES: DetectionRule[] = [
    // ── Frameworks (higher priority) ─────────────────────────
    {
        type: "nextjs",
        label: "Next.js Project",
        icon: "▲",
        description: "React framework with server-side rendering",
        markerFiles: [
            "next.config.js",
            "next.config.ts",
            "next.config.mjs",
            ".next/",
        ],
        priority: 90,
    },
    {
        type: "vue",
        label: "Vue.js Project",
        icon: "💚",
        description: "Progressive JavaScript framework",
        markerFiles: [
            "vue.config.js",
            "vite.config.ts",
            "nuxt.config.ts",
            "nuxt.config.js",
        ],
        priority: 85,
    },
    {
        type: "svelte",
        label: "Svelte Project",
        icon: "🔥",
        description: "Cybernetically enhanced web apps",
        markerFiles: ["svelte.config.js", "svelte.config.ts"],
        priority: 85,
    },
    {
        type: "angular",
        label: "Angular Project",
        icon: "🅰️",
        description: "Platform for building web apps",
        markerFiles: ["angular.json", ".angular/"],
        priority: 85,
    },
    {
        type: "react",
        label: "React Project",
        icon: "⚛️",
        description: "JavaScript library for building UIs",
        markerFiles: ["src/App.tsx", "src/App.jsx", "src/App.js"],
        priority: 80,
    },
    {
        type: "flutter",
        label: "Flutter Project",
        icon: "🐦",
        description: "Cross-platform UI toolkit",
        markerFiles: ["pubspec.yaml", "lib/main.dart"],
        priority: 85,
    },

    // ── Languages ────────────────────────────────────────────
    {
        type: "nodejs",
        label: "Node.js Project",
        icon: "📦",
        description: "JavaScript/TypeScript project",
        markerFiles: ["package.json"],
        priority: 70,
    },
    {
        type: "python",
        label: "Python Project",
        icon: "🐍",
        description: "Python project",
        markerFiles: [
            "requirements.txt",
            "Pipfile",
            "pyproject.toml",
            "setup.py",
            "setup.cfg",
        ],
        priority: 70,
    },
    {
        type: "rust",
        label: "Rust Project",
        icon: "🦀",
        description: "Systems programming language",
        markerFiles: ["Cargo.toml"],
        priority: 70,
    },
    {
        type: "go",
        label: "Go Project",
        icon: "🐹",
        description: "Go programming language",
        markerFiles: ["go.mod", "go.sum"],
        priority: 70,
    },
    {
        type: "java",
        label: "Java Project",
        icon: "☕",
        description: "Java application",
        markerFiles: ["pom.xml", "build.gradle", "build.gradle.kts"],
        priority: 70,
    },
    {
        type: "dotnet",
        label: ".NET Project",
        icon: "🔷",
        description: ".NET application",
        markerFiles: ["*.csproj", "*.sln", "*.fsproj"],
        priority: 70,
    },
    {
        type: "ruby",
        label: "Ruby Project",
        icon: "💎",
        description: "Ruby application",
        markerFiles: ["Gemfile", "Rakefile"],
        priority: 70,
    },
    {
        type: "php",
        label: "PHP Project",
        icon: "🐘",
        description: "PHP application",
        markerFiles: ["composer.json"],
        priority: 70,
    },
    {
        type: "swift",
        label: "Swift Project",
        icon: "🍎",
        description: "Swift application",
        markerFiles: ["Package.swift", "*.xcodeproj/"],
        priority: 70,
    },
];

/** Detect project type from entries */
export function detectProject(entries: ZipEntry[]): ProjectInfo {
    // Normalize paths — strip common root prefix
    const paths = new Set(
        entries.map((e) => {
            // Remove leading folder if all entries share one
            const parts = e.path.split("/").filter(Boolean);
            return parts.length > 1 ? parts.slice(1).join("/") : e.path;
        }),
    );
    const fullPaths = new Set(entries.map((e) => e.path));

    // Also keep the raw paths for glob matching
    const allPaths = new Set([...paths, ...fullPaths]);

    // Try detection rules
    let bestMatch: { rule: DetectionRule; markers: string[] } | null = null;

    for (const rule of DETECTION_RULES) {
        const foundMarkers: string[] = [];
        for (const marker of rule.markerFiles) {
            if (marker.includes("*")) {
                // Glob pattern — check suffix
                const suffix = marker.replace("*", "");
                for (const p of allPaths) {
                    if (p.endsWith(suffix) || p.includes(suffix)) {
                        foundMarkers.push(p);
                        break;
                    }
                }
            } else {
                // Exact match (or path ends with marker)
                for (const p of allPaths) {
                    if (
                        p === marker ||
                        p.endsWith("/" + marker) ||
                        p.endsWith(marker)
                    ) {
                        foundMarkers.push(marker);
                        break;
                    }
                }
            }
        }

        const minRequired = rule.minMarkers || 1;
        if (foundMarkers.length >= minRequired) {
            if (!bestMatch || rule.priority > bestMatch.rule.priority) {
                bestMatch = { rule, markers: foundMarkers };
            }
        }
    }

    if (bestMatch) {
        return {
            type: bestMatch.rule.type,
            label: bestMatch.rule.label,
            icon: bestMatch.rule.icon,
            description: bestMatch.rule.description,
            markers: bestMatch.markers,
        };
    }

    // ── Content-type detection (media albums, datasets, etc.) ──
    const files = entries.filter((e) => !e.isDirectory);
    const exts = files.map((f) => getExtension(f.path));
    const total = exts.length;

    if (total === 0) {
        return {
            type: "unknown",
            label: "Empty Archive",
            icon: "📭",
            description: "No files found",
            markers: [],
        };
    }

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
        ".tiff",
        ".raw",
        ".cr2",
        ".nef",
    ]);
    const videoExts = new Set([
        ".mp4",
        ".mkv",
        ".avi",
        ".mov",
        ".webm",
        ".flv",
        ".wmv",
        ".m4v",
    ]);
    const audioExts = new Set([
        ".mp3",
        ".wav",
        ".flac",
        ".aac",
        ".m4a",
        ".ogg",
        ".opus",
        ".wma",
    ]);
    const fontExts = new Set([".ttf", ".otf", ".woff", ".woff2", ".eot"]);
    const docExts = new Set([
        ".pdf",
        ".doc",
        ".docx",
        ".xls",
        ".xlsx",
        ".ppt",
        ".pptx",
        ".odt",
    ]);
    const dataExts = new Set([
        ".csv",
        ".tsv",
        ".json",
        ".xml",
        ".sql",
        ".parquet",
        ".sqlite",
    ]);

    const counts = {
        images: exts.filter((e) => imageExts.has(e)).length,
        videos: exts.filter((e) => videoExts.has(e)).length,
        audio: exts.filter((e) => audioExts.has(e)).length,
        fonts: exts.filter((e) => fontExts.has(e)).length,
        docs: exts.filter((e) => docExts.has(e)).length,
        data: exts.filter((e) => dataExts.has(e)).length,
    };

    const threshold = 0.6; // 60% of files

    if (counts.images / total >= threshold) {
        return {
            type: "photo-album",
            label: "Photo Album",
            icon: "🖼️",
            description: `${counts.images} images detected`,
            markers: [],
        };
    }
    if (counts.videos / total >= threshold) {
        return {
            type: "video-collection",
            label: "Video Collection",
            icon: "🎬",
            description: `${counts.videos} videos detected`,
            markers: [],
        };
    }
    if (counts.audio / total >= threshold) {
        return {
            type: "audio-collection",
            label: "Music Collection",
            icon: "🎵",
            description: `${counts.audio} audio files detected`,
            markers: [],
        };
    }
    if (counts.fonts / total >= threshold) {
        return {
            type: "font-pack",
            label: "Font Pack",
            icon: "🔤",
            description: `${counts.fonts} fonts detected`,
            markers: [],
        };
    }
    if (counts.docs / total >= threshold) {
        return {
            type: "document-bundle",
            label: "Document Bundle",
            icon: "📄",
            description: `${counts.docs} documents detected`,
            markers: [],
        };
    }
    if (counts.data / total >= threshold) {
        return {
            type: "dataset",
            label: "Dataset",
            icon: "📊",
            description: `${counts.data} data files detected`,
            markers: [],
        };
    }

    return {
        type: "unknown",
        label: "File Archive",
        icon: "📦",
        description: "Mixed content archive",
        markers: [],
    };
}

/**
 * Parse package.json content and extract useful metadata.
 */
export function parsePackageJson(
    content: string,
): Record<string, unknown> | null {
    try {
        const pkg = JSON.parse(content);
        return {
            name: pkg.name,
            version: pkg.version,
            description: pkg.description,
            dependencies: pkg.dependencies ? Object.keys(pkg.dependencies) : [],
            devDependencies: pkg.devDependencies
                ? Object.keys(pkg.devDependencies)
                : [],
            scripts: pkg.scripts ? Object.keys(pkg.scripts) : [],
            license: pkg.license,
            author:
                typeof pkg.author === "string" ? pkg.author : pkg.author?.name,
        };
    } catch {
        return null;
    }
}

/**
 * Parse requirements.txt and extract dependencies.
 */
export function parseRequirementsTxt(content: string): string[] {
    return content
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#") && !l.startsWith("-"))
        .map((l) => l.split(/[=<>!;@]/, 1)[0].trim())
        .filter(Boolean);
}

/**
 * Parse Cargo.toml for Rust project info.
 */
export function parseCargoToml(
    content: string,
): Record<string, unknown> | null {
    try {
        const lines = content.split("\n");
        const info: Record<string, string> = {};
        let section = "";
        const deps: string[] = [];

        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("[")) {
                section = trimmed.replace(/[\[\]]/g, "");
                continue;
            }
            if (section === "package" && trimmed.includes("=")) {
                const [key, ...rest] = trimmed.split("=");
                info[key.trim()] = rest.join("=").trim().replace(/"/g, "");
            }
            if (section === "dependencies" && trimmed.includes("=")) {
                deps.push(trimmed.split("=")[0].trim());
            }
        }

        return { ...info, dependencies: deps };
    } catch {
        return null;
    }
}
