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
    Hash,
    Braces,
    Terminal,
    Database,
    Globe,
    Paintbrush,
    Box,
    Cpu,
    BookOpen,
    Shield,
    Cog,
    FileKey,
} from "lucide-react";
import { getExtension } from "@/lib/utils";

interface FileIconProps {
    name: string;
    isDirectory: boolean;
    isExpanded?: boolean;
    className?: string;
}

const ICON_COLORS: Record<string, string> = {
    // JavaScript/TypeScript
    ".js": "text-yellow-500",
    ".jsx": "text-yellow-500",
    ".mjs": "text-yellow-500",
    ".cjs": "text-yellow-500",
    ".ts": "text-blue-500",
    ".tsx": "text-blue-500",
    ".mts": "text-blue-500",
    ".cts": "text-blue-500",

    // Python
    ".py": "text-green-500",
    ".pyi": "text-green-400",
    ".pyx": "text-green-500",
    ".pyw": "text-green-500",

    // Ruby
    ".rb": "text-red-500",
    ".erb": "text-red-400",
    ".rake": "text-red-500",
    ".gemspec": "text-red-500",

    // Go
    ".go": "text-cyan-500",

    // Rust
    ".rs": "text-orange-500",

    // Java / JVM
    ".java": "text-orange-600",
    ".kt": "text-purple-500",
    ".kts": "text-purple-500",
    ".scala": "text-red-600",
    ".sc": "text-red-600",
    ".groovy": "text-blue-400",
    ".gvy": "text-blue-400",
    ".gradle": "text-teal-500",
    ".clj": "text-green-600",
    ".cljs": "text-green-600",
    ".cljc": "text-green-600",
    ".edn": "text-green-500",

    // .NET
    ".cs": "text-purple-500",
    ".fs": "text-blue-500",
    ".fsx": "text-blue-500",
    ".fsi": "text-blue-500",

    // Apple
    ".swift": "text-orange-500",
    ".m": "text-blue-500",
    ".mm": "text-blue-500",

    // C/C++
    ".c": "text-blue-600",
    ".cpp": "text-blue-600",
    ".cc": "text-blue-600",
    ".cxx": "text-blue-600",
    ".h": "text-purple-400",
    ".hpp": "text-purple-400",
    ".hxx": "text-purple-400",

    // PHP
    ".php": "text-indigo-500",

    // Lua
    ".lua": "text-blue-400",

    // Functional
    ".hs": "text-purple-600",
    ".lhs": "text-purple-600",
    ".ml": "text-orange-500",
    ".mli": "text-orange-400",
    ".elm": "text-cyan-500",
    ".purs": "text-neutral-500",

    // Elixir / Erlang
    ".ex": "text-purple-500",
    ".exs": "text-purple-400",
    ".erl": "text-red-600",
    ".hrl": "text-red-500",

    // Modern Systems
    ".zig": "text-amber-500",
    ".nim": "text-yellow-600",
    ".nims": "text-yellow-600",
    ".cr": "text-neutral-500",
    ".d": "text-red-500",
    ".v": "text-blue-500",
    ".sv": "text-blue-500",
    ".vhd": "text-green-600",
    ".vhdl": "text-green-600",

    // Dart / Flutter
    ".dart": "text-blue-500",

    // Julia
    ".jl": "text-purple-500",

    // Perl
    ".pl": "text-blue-400",
    ".pm": "text-blue-400",

    // R
    ".r": "text-blue-500",

    // Shell
    ".sh": "text-green-500",
    ".bash": "text-green-500",
    ".zsh": "text-green-500",
    ".fish": "text-green-400",
    ".ps1": "text-blue-600",
    ".bat": "text-green-600",
    ".cmd": "text-green-600",

    // Web
    ".html": "text-orange-500",
    ".htm": "text-orange-500",
    ".css": "text-blue-400",
    ".scss": "text-pink-500",
    ".sass": "text-pink-500",
    ".less": "text-blue-500",
    ".styl": "text-green-500",
    ".vue": "text-emerald-500",
    ".svelte": "text-orange-600",
    ".astro": "text-orange-500",

    // Templates
    ".ejs": "text-yellow-600",
    ".hbs": "text-orange-400",
    ".mustache": "text-orange-400",
    ".pug": "text-amber-600",
    ".jade": "text-amber-600",
    ".haml": "text-neutral-500",
    ".twig": "text-green-400",
    ".liquid": "text-blue-400",
    ".njk": "text-green-500",
    ".slim": "text-orange-400",

    // Data / Config
    ".json": "text-yellow-600",
    ".jsonc": "text-yellow-600",
    ".json5": "text-yellow-600",
    ".jsonl": "text-yellow-600",
    ".yaml": "text-red-400",
    ".yml": "text-red-400",
    ".xml": "text-orange-400",
    ".plist": "text-neutral-500",
    ".toml": "text-neutral-500",
    ".ini": "text-neutral-500",
    ".cfg": "text-neutral-500",
    ".conf": "text-neutral-500",
    ".csv": "text-green-600",
    ".tsv": "text-green-600",
    ".sql": "text-blue-500",

    // Markup / Docs
    ".env": "text-yellow-600",
    ".gitignore": "text-neutral-500",
    ".dockerignore": "text-blue-500",
    ".md": "text-blue-500",
    ".mdx": "text-blue-500",
    ".txt": "text-neutral-500",
    ".log": "text-neutral-400",

    // Schema / API
    ".graphql": "text-pink-500",
    ".gql": "text-pink-500",
    ".proto": "text-blue-500",
    ".prisma": "text-teal-500",
    ".thrift": "text-green-500",

    // Infrastructure
    ".dockerfile": "text-blue-500",
    ".tf": "text-purple-500",
    ".hcl": "text-purple-500",
    ".nix": "text-blue-400",

    // Lisp family
    ".lisp": "text-neutral-500",
    ".cl": "text-neutral-500",
    ".el": "text-purple-500",
    ".rkt": "text-red-500",
    ".scm": "text-red-400",
    ".ss": "text-red-400",

    // Build
    ".cmake": "text-red-500",
    ".makefile": "text-orange-500",
    ".mk": "text-orange-500",
    ".mak": "text-orange-500",

    // Assembly
    ".asm": "text-blue-700",
    ".s": "text-blue-700",
    ".nasm": "text-blue-700",
    ".wasm": "text-purple-600",
    ".wat": "text-purple-600",

    // Shaders
    ".glsl": "text-green-500",
    ".hlsl": "text-green-500",
    ".wgsl": "text-green-500",
    ".frag": "text-green-400",
    ".vert": "text-green-400",

    // Blockchain
    ".sol": "text-neutral-500",
    ".vy": "text-blue-500",

    // Legacy
    ".cob": "text-blue-800",
    ".cbl": "text-blue-800",
    ".f": "text-neutral-500",
    ".f90": "text-neutral-500",
    ".f95": "text-neutral-500",
    ".pas": "text-blue-600",
    ".dpr": "text-red-500",
    ".ada": "text-green-600",
    ".adb": "text-green-600",
    ".ads": "text-green-600",

    // LaTeX
    ".tex": "text-teal-600",
    ".bib": "text-teal-500",
    ".sty": "text-teal-500",
    ".cls": "text-teal-500",
    ".ltx": "text-teal-600",

    // Media — Images
    ".png": "text-emerald-500",
    ".jpg": "text-emerald-500",
    ".jpeg": "text-emerald-500",
    ".gif": "text-purple-500",
    ".svg": "text-amber-500",
    ".webp": "text-emerald-500",
    ".avif": "text-emerald-500",
    ".bmp": "text-emerald-500",
    ".ico": "text-emerald-500",

    // Media — Video
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

    // Media — Audio
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

    // PDF
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

    // Fonts
    ".woff": "text-red-400",
    ".woff2": "text-red-400",
    ".ttf": "text-red-400",
    ".otf": "text-red-400",
    ".eot": "text-red-400",

    // Archives
    ".zip": "text-amber-600",
    ".tar": "text-amber-600",
    ".gz": "text-amber-600",
    ".rar": "text-amber-600",
    ".7z": "text-amber-600",

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
        return <Box className={`${className} text-blue-500`} />;
    }
    if (lower.includes(".lock")) {
        return <Lock className={`${className} text-yellow-600`} />;
    }
    if (lower === ".gitignore" || lower === ".gitattributes") {
        return <GitBranch className={`${className} text-orange-500`} />;
    }
    if (lower === "makefile" || lower === "gnumakefile") {
        return <Cog className={`${className} text-orange-500`} />;
    }
    if (lower === "license" || lower === "licence" || lower === "license.md") {
        return <FileCheck className={`${className} text-green-500`} />;
    }
    if (lower === ".env" || lower.startsWith(".env.")) {
        return <FileKey className={`${className} text-yellow-600`} />;
    }

    // By extension — specific icons per language family
    const shellExts = [".sh", ".bash", ".zsh", ".fish", ".ps1", ".bat", ".cmd"];
    const htmlExts = [
        ".html",
        ".htm",
        ".vue",
        ".svelte",
        ".astro",
        ".ejs",
        ".hbs",
        ".mustache",
        ".pug",
        ".jade",
        ".haml",
        ".slim",
        ".twig",
        ".liquid",
        ".njk",
        ".erb",
    ];
    const cssExts = [".css", ".scss", ".sass", ".less", ".styl", ".postcss"];
    const jsonExts = [".json", ".jsonc", ".json5", ".jsonl"];
    const sqlExts = [".sql", ".prisma"];
    const configExts = [
        ".yaml",
        ".yml",
        ".toml",
        ".ini",
        ".cfg",
        ".conf",
        ".tf",
        ".hcl",
        ".nix",
        ".dhall",
        ".cue",
    ];
    const shaderExts = [".glsl", ".hlsl", ".wgsl", ".frag", ".vert", ".comp"];
    const asmExts = [".asm", ".s", ".nasm", ".wasm", ".wat"];
    const texExts = [".tex", ".bib", ".sty", ".cls", ".ltx"];
    const schemaExts = [
        ".graphql",
        ".gql",
        ".proto",
        ".thrift",
        ".avdl",
        ".capnp",
        ".flatbuffers",
        ".fbs",
        ".smithy",
    ];

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
    const dataExts = [".csv", ".tsv", ".xlsx", ".xls", ".ods", ".numbers"];
    const docExts = [".docx", ".doc", ".odt", ".rtf", ".pages"];
    const presentationExts = [".pptx", ".ppt", ".odp", ".key"];
    const fontExts = [".woff", ".woff2", ".ttf", ".otf", ".eot"];

    if (imageExts.includes(ext))
        return <FileImage className={`${className} ${color}`} />;
    if (videoExts.includes(ext))
        return <FileVideo className={`${className} ${color}`} />;
    if (audioExts.includes(ext))
        return <FileAudio className={`${className} ${color}`} />;
    if (archiveExts.includes(ext))
        return <FileArchive className={`${className} ${color}`} />;
    if (jsonExts.includes(ext))
        return <Braces className={`${className} ${color}`} />;
    if (dataExts.includes(ext))
        return <FileSpreadsheet className={`${className} ${color}`} />;
    if (docExts.includes(ext))
        return <FileText className={`${className} ${color}`} />;
    if (presentationExts.includes(ext))
        return <Presentation className={`${className} ${color}`} />;
    if (fontExts.includes(ext))
        return <FileType className={`${className} ${color}`} />;
    if (shellExts.includes(ext))
        return <Terminal className={`${className} ${color}`} />;
    if (htmlExts.includes(ext))
        return <Globe className={`${className} ${color}`} />;
    if (cssExts.includes(ext))
        return <Paintbrush className={`${className} ${color}`} />;
    if (sqlExts.includes(ext))
        return <Database className={`${className} ${color}`} />;
    if (configExts.includes(ext))
        return <Settings className={`${className} ${color}`} />;
    if (texExts.includes(ext))
        return <BookOpen className={`${className} ${color}`} />;
    if (schemaExts.includes(ext))
        return <Hash className={`${className} ${color}`} />;
    if (shaderExts.includes(ext))
        return <Cpu className={`${className} ${color}`} />;
    if (asmExts.includes(ext))
        return <Cpu className={`${className} ${color}`} />;
    if (ext === ".pdf") return <FileType className={`${className} ${color}`} />;
    if (ext === ".md" || ext === ".mdx") {
        return <BookOpen className={`${className} ${color}`} />;
    }
    if (ext === ".txt" || ext === ".log") {
        return <FileText className={`${className} ${color}`} />;
    }
    if (ext === ".xml" || ext === ".plist") {
        return <FileCode2 className={`${className} ${color}`} />;
    }
    if (ext === ".sol" || ext === ".vy" || ext === ".move") {
        return <Shield className={`${className} ${color}`} />;
    }

    // Any other code extension — generic code icon
    const allCodeExts = [
        ".js",
        ".jsx",
        ".ts",
        ".tsx",
        ".mjs",
        ".cjs",
        ".mts",
        ".cts",
        ".py",
        ".pyi",
        ".pyx",
        ".rb",
        ".go",
        ".rs",
        ".java",
        ".kt",
        ".kts",
        ".swift",
        ".c",
        ".cpp",
        ".cc",
        ".cxx",
        ".h",
        ".hpp",
        ".hxx",
        ".cs",
        ".fs",
        ".fsx",
        ".fsi",
        ".php",
        ".lua",
        ".r",
        ".dart",
        ".scala",
        ".sc",
        ".clj",
        ".cljs",
        ".cljc",
        ".edn",
        ".ex",
        ".exs",
        ".erl",
        ".hrl",
        ".hs",
        ".lhs",
        ".ml",
        ".mli",
        ".elm",
        ".purs",
        ".pl",
        ".pm",
        ".t",
        ".m",
        ".mm",
        ".groovy",
        ".gvy",
        ".gradle",
        ".v",
        ".sv",
        ".vhd",
        ".vhdl",
        ".d",
        ".nim",
        ".nims",
        ".zig",
        ".cr",
        ".jl",
        ".rkt",
        ".scm",
        ".ss",
        ".lisp",
        ".cl",
        ".el",
        ".cmake",
        ".makefile",
        ".mk",
        ".mak",
        ".cob",
        ".cbl",
        ".f",
        ".f90",
        ".f95",
        ".f03",
        ".pas",
        ".pp",
        ".dpr",
        ".ada",
        ".adb",
        ".ads",
        ".pkl",
    ];
    if (allCodeExts.includes(ext))
        return <FileCode2 className={`${className} ${color}`} />;

    return <File className={`${className} ${color}`} />;
}
