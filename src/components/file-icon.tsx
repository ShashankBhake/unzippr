"use client";

import {
    File,
    FileText,
    FileCode2,
    FileImage,
    FileVideo,
    FileAudio,
    FileType,
    FileJson,
    FolderOpen,
    Folder,
    FileArchive,
    FileSpreadsheet,
    Settings,
    Lock,
    GitBranch,
    Presentation,
    FileCheck,
} from "lucide-react";
import { getExtension } from "@/lib/utils";

interface FileIconProps {
    name: string;
    isDirectory: boolean;
    isExpanded?: boolean;
    className?: string;
}

const ICON_COLORS: Record<string, string> = {
    // Code
    ".js": "text-yellow-500",
    ".jsx": "text-yellow-500",
    ".ts": "text-blue-500",
    ".tsx": "text-blue-500",
    ".py": "text-green-500",
    ".rb": "text-red-500",
    ".go": "text-cyan-500",
    ".rs": "text-orange-500",
    ".java": "text-orange-600",
    ".swift": "text-orange-500",
    ".c": "text-blue-600",
    ".cpp": "text-blue-600",
    ".cs": "text-purple-500",
    ".php": "text-indigo-500",
    ".html": "text-orange-500",
    ".css": "text-blue-400",
    ".scss": "text-pink-500",
    ".vue": "text-emerald-500",
    ".svelte": "text-orange-600",

    // Data
    ".json": "text-yellow-600",
    ".yaml": "text-red-400",
    ".yml": "text-red-400",
    ".xml": "text-orange-400",
    ".toml": "text-neutral-500",
    ".csv": "text-green-600",
    ".sql": "text-blue-500",

    // Config
    ".env": "text-yellow-600",
    ".gitignore": "text-neutral-500",
    ".dockerignore": "text-blue-500",

    // Docs
    ".md": "text-blue-500",
    ".mdx": "text-blue-500",
    ".txt": "text-neutral-500",

    // Media
    ".png": "text-emerald-500",
    ".jpg": "text-emerald-500",
    ".jpeg": "text-emerald-500",
    ".gif": "text-purple-500",
    ".svg": "text-amber-500",
    ".webp": "text-emerald-500",
    ".avif": "text-emerald-500",
    ".bmp": "text-emerald-500",
    ".ico": "text-emerald-500",
    ".mp4": "text-pink-500",
    ".webm": "text-pink-500",
    ".mov": "text-pink-500",
    ".avi": "text-pink-500",
    ".mkv": "text-pink-500",
    ".flv": "text-pink-500",
    ".wmv": "text-pink-500",
    ".m4v": "text-pink-500",
    ".3gp": "text-pink-500",
    ".mpg": "text-pink-500",
    ".mpeg": "text-pink-500",
    ".mp3": "text-violet-500",
    ".wav": "text-violet-500",
    ".flac": "text-violet-500",
    ".aac": "text-violet-500",
    ".m4a": "text-violet-500",
    ".ogg": "text-violet-500",
    ".opus": "text-violet-500",
    ".wma": "text-violet-500",
    ".aiff": "text-violet-500",
    ".mid": "text-violet-400",
    ".midi": "text-violet-400",
    ".pdf": "text-red-500",

    // Documents
    ".docx": "text-blue-600",
    ".doc": "text-blue-600",
    ".odt": "text-blue-600",
    ".rtf": "text-blue-500",
    ".pages": "text-orange-500",

    // Spreadsheets
    ".xlsx": "text-green-600",
    ".xls": "text-green-600",
    ".ods": "text-green-600",
    ".numbers": "text-green-500",

    // Presentations
    ".pptx": "text-orange-500",
    ".ppt": "text-orange-500",
    ".odp": "text-orange-500",
    ".key": "text-blue-500",

    // LaTeX
    ".tex": "text-teal-600",
    ".bib": "text-teal-500",
    ".sty": "text-teal-500",
    ".cls": "text-teal-500",
    ".ltx": "text-teal-600",

    // Archives
    ".zip": "text-amber-600",
    ".tar": "text-amber-600",
    ".gz": "text-amber-600",

    // Lock files
    ".lock": "text-yellow-600",
};

export function FileIcon({
    name,
    isDirectory,
    isExpanded,
    className = "w-4 h-4",
}: FileIconProps) {
    if (isDirectory) {
        return isExpanded ? (
            <FolderOpen className={`${className} text-amber-500`} />
        ) : (
            <Folder className={`${className} text-amber-500`} />
        );
    }

    const ext = getExtension(name);
    const lower = name.toLowerCase();
    const color = ICON_COLORS[ext] || "text-neutral-400 dark:text-neutral-500";

    // Special filenames
    if (lower === "dockerfile" || lower.endsWith(".dockerfile")) {
        return <Settings className={`${className} text-blue-500`} />;
    }
    if (lower.includes(".lock")) {
        return <Lock className={`${className} text-yellow-600`} />;
    }
    if (lower === ".gitignore" || lower === ".gitattributes") {
        return <GitBranch className={`${className} text-orange-500`} />;
    }

    // By extension category
    const imageExts = [
        ".png",
        ".jpg",
        ".jpeg",
        ".gif",
        ".svg",
        ".webp",
        ".bmp",
        ".ico",
        ".avif",
    ];
    const videoExts = [
        ".mp4",
        ".webm",
        ".ogg",
        ".mov",
        ".avi",
        ".mkv",
        ".flv",
        ".wmv",
        ".m4v",
        ".3gp",
        ".3g2",
        ".mpg",
        ".mpeg",
    ];
    const audioExts = [
        ".mp3",
        ".wav",
        ".flac",
        ".aac",
        ".m4a",
        ".oga",
        ".opus",
        ".wma",
        ".aiff",
        ".aif",
        ".mid",
        ".midi",
        ".amr",
    ];
    const archiveExts = [".zip", ".tar", ".gz", ".rar", ".7z"];
    const codeExts = [
        ".js",
        ".jsx",
        ".ts",
        ".tsx",
        ".py",
        ".rb",
        ".go",
        ".rs",
        ".java",
        ".swift",
        ".c",
        ".cpp",
        ".h",
        ".cs",
        ".php",
        ".lua",
        ".sh",
        ".html",
        ".css",
        ".scss",
        ".sass",
        ".less",
        ".vue",
        ".svelte",
    ];
    const dataExts = [".csv", ".tsv", ".xlsx", ".xls", ".ods", ".numbers"];
    const jsonExts = [".json"];
    const docExts = [".docx", ".doc", ".odt", ".rtf", ".pages"];
    const presentationExts = [".pptx", ".ppt", ".odp", ".key"];

    if (imageExts.includes(ext))
        return <FileImage className={`${className} ${color}`} />;
    if (videoExts.includes(ext))
        return <FileVideo className={`${className} ${color}`} />;
    if (audioExts.includes(ext))
        return <FileAudio className={`${className} ${color}`} />;
    if (archiveExts.includes(ext))
        return <FileArchive className={`${className} ${color}`} />;
    if (jsonExts.includes(ext))
        return <FileJson className={`${className} ${color}`} />;
    if (dataExts.includes(ext))
        return <FileSpreadsheet className={`${className} ${color}`} />;
    if (docExts.includes(ext))
        return <FileText className={`${className} ${color}`} />;
    if (presentationExts.includes(ext))
        return <Presentation className={`${className} ${color}`} />;
    if (codeExts.includes(ext))
        return <FileCode2 className={`${className} ${color}`} />;
    if (ext === ".pdf") return <FileType className={`${className} ${color}`} />;
    if (ext === ".md" || ext === ".mdx" || ext === ".txt") {
        return <FileText className={`${className} ${color}`} />;
    }

    return <File className={`${className} ${color}`} />;
}
