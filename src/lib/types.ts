export interface ZipEntry {
    path: string;
    name: string;
    isDirectory: boolean;
    size: number;
    compressedSize: number;
    lastModified: Date;
}

export interface TreeNode {
    name: string;
    path: string;
    isDirectory: boolean;
    entry?: ZipEntry;
    children: TreeNode[];
    isExpanded?: boolean;
}

export interface ZipState {
    status: "idle" | "loading" | "loaded" | "error";
    fileName: string;
    totalSize: number;
    entries: ZipEntry[];
    tree: TreeNode;
    error: string | null;
    loadMethod: "file" | "url" | null;
    supportsRangeRequests: boolean;
    progress: number; // 0 - 100
    progressMessage: string;
}

export interface PreviewState {
    status: "idle" | "loading" | "loaded" | "error";
    entry: ZipEntry | null;
    type: PreviewType;
    content: string | null;
    blobUrl: string | null;
    error: string | null;
}

export type PreviewType =
    | "image"
    | "text"
    | "code"
    | "video"
    | "audio"
    | "pdf"
    | "font"
    | "document"
    | "spreadsheet"
    | "presentation"
    | "unsupported";

export const FILE_SIZE_LIMITS = {
    UPLOAD: 200 * 1024 * 1024, // 200MB
    URL: 500 * 1024 * 1024, // 500MB
    PREVIEW: 25 * 1024 * 1024, // 25MB per file preview
} as const;

export const EXTENSION_MAP: Record<string, PreviewType> = {
    // Images
    ".png": "image",
    ".jpg": "image",
    ".jpeg": "image",
    ".gif": "image",
    ".svg": "image",
    ".webp": "image",
    ".bmp": "image",
    ".ico": "image",
    ".avif": "image",

    // Video
    ".mp4": "video",
    ".webm": "video",
    ".mov": "video",
    ".avi": "video",
    ".mkv": "video",
    ".flv": "video",
    ".wmv": "video",
    ".m4v": "video",
    ".3gp": "video",
    ".3g2": "video",
    ".mpg": "video",
    ".mpeg": "video",

    // Audio
    ".mp3": "audio",
    ".wav": "audio",
    ".flac": "audio",
    ".aac": "audio",
    ".m4a": "audio",
    ".ogg": "audio",
    ".oga": "audio",
    ".opus": "audio",
    ".wma": "audio",
    ".aiff": "audio",
    ".aif": "audio",
    ".mid": "audio",
    ".midi": "audio",
    ".amr": "audio",
    ".pcm": "audio",

    // PDF
    ".pdf": "pdf",

    // Documents (Office Open XML & legacy)
    ".docx": "document",
    ".doc": "document",
    ".odt": "document",
    ".rtf": "document",
    ".pages": "document",

    // Spreadsheets
    ".xlsx": "spreadsheet",
    ".xls": "spreadsheet",
    ".ods": "spreadsheet",
    ".csv": "spreadsheet",
    ".tsv": "spreadsheet",
    ".numbers": "spreadsheet",

    // Presentations
    ".pptx": "presentation",
    ".ppt": "presentation",
    ".odp": "presentation",
    ".key": "presentation",

    // Code
    ".js": "code",
    ".jsx": "code",
    ".ts": "code",
    ".tsx": "code",
    ".py": "code",
    ".rb": "code",
    ".go": "code",
    ".rs": "code",
    ".java": "code",
    ".kt": "code",
    ".swift": "code",
    ".c": "code",
    ".cpp": "code",
    ".h": "code",
    ".hpp": "code",
    ".cs": "code",
    ".php": "code",
    ".lua": "code",
    ".r": "code",
    ".sql": "code",
    ".sh": "code",
    ".bash": "code",
    ".zsh": "code",
    ".fish": "code",
    ".ps1": "code",
    ".bat": "code",
    ".cmd": "code",
    ".html": "code",
    ".htm": "code",
    ".css": "code",
    ".scss": "code",
    ".sass": "code",
    ".less": "code",
    ".vue": "code",
    ".svelte": "code",
    ".astro": "code",
    ".yaml": "code",
    ".yml": "code",
    ".toml": "code",
    ".ini": "code",
    ".cfg": "code",
    ".conf": "code",
    ".dockerfile": "code",
    ".graphql": "code",
    ".gql": "code",
    ".proto": "code",
    ".tex": "code",
    ".bib": "code",
    ".sty": "code",
    ".cls": "code",
    ".ltx": "code",

    // Text
    ".txt": "text",
    ".md": "text",
    ".mdx": "text",
    ".json": "code",
    ".xml": "code",
    ".log": "text",
    ".env": "text",
    ".gitignore": "text",
    ".editorconfig": "text",
    ".prettierrc": "code",
    ".eslintrc": "code",

    // Font
    ".woff": "font",
    ".woff2": "font",
    ".ttf": "font",
    ".otf": "font",
    ".eot": "font",
};

export const LANGUAGE_MAP: Record<string, string> = {
    ".js": "javascript",
    ".jsx": "jsx",
    ".ts": "typescript",
    ".tsx": "tsx",
    ".py": "python",
    ".rb": "ruby",
    ".go": "go",
    ".rs": "rust",
    ".java": "java",
    ".kt": "kotlin",
    ".swift": "swift",
    ".c": "c",
    ".cpp": "cpp",
    ".h": "c",
    ".hpp": "cpp",
    ".cs": "csharp",
    ".php": "php",
    ".lua": "lua",
    ".r": "r",
    ".sql": "sql",
    ".sh": "bash",
    ".bash": "bash",
    ".zsh": "bash",
    ".html": "html",
    ".htm": "html",
    ".css": "css",
    ".scss": "scss",
    ".sass": "sass",
    ".less": "less",
    ".json": "json",
    ".xml": "xml",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".toml": "toml",
    ".md": "markdown",
    ".mdx": "markdown",
    ".graphql": "graphql",
    ".gql": "graphql",
    ".proto": "protobuf",
    ".vue": "html",
    ".svelte": "html",
    ".dockerfile": "dockerfile",
    ".tex": "latex",
    ".bib": "bibtex",
    ".sty": "latex",
    ".cls": "latex",
    ".ltx": "latex",
};

export const MIME_MAP: Record<string, string> = {
    // Images
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
    ".bmp": "image/bmp",
    ".ico": "image/x-icon",
    ".avif": "image/avif",

    // Video
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".ogg": "video/ogg",
    ".mov": "video/quicktime",
    ".avi": "video/x-msvideo",
    ".mkv": "video/x-matroska",
    ".flv": "video/x-flv",
    ".wmv": "video/x-ms-wmv",
    ".m4v": "video/x-m4v",
    ".3gp": "video/3gpp",
    ".3g2": "video/3gpp2",
    ".mpg": "video/mpeg",
    ".mpeg": "video/mpeg",

    // Audio
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".flac": "audio/flac",
    ".aac": "audio/aac",
    ".m4a": "audio/mp4",
    ".oga": "audio/ogg",
    ".opus": "audio/opus",
    ".wma": "audio/x-ms-wma",
    ".aiff": "audio/aiff",
    ".aif": "audio/aiff",
    ".mid": "audio/midi",
    ".midi": "audio/midi",
    ".amr": "audio/amr",
    ".pcm": "audio/pcm",

    // PDF
    ".pdf": "application/pdf",

    // Documents
    ".docx":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".doc": "application/msword",
    ".odt": "application/vnd.oasis.opendocument.text",
    ".rtf": "application/rtf",
    ".pages": "application/vnd.apple.pages",

    // Spreadsheets
    ".xlsx":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".xls": "application/vnd.ms-excel",
    ".ods": "application/vnd.oasis.opendocument.spreadsheet",
    ".csv": "text/csv",
    ".tsv": "text/tab-separated-values",
    ".numbers": "application/vnd.apple.numbers",

    // Presentations
    ".pptx":
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".ppt": "application/vnd.ms-powerpoint",
    ".odp": "application/vnd.oasis.opendocument.presentation",
    ".key": "application/vnd.apple.keynote",

    // Fonts
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".otf": "font/otf",
};
