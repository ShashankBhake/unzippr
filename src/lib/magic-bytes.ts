/**
 * Magic Byte Sniffing — Security X-Ray
 *
 * Checks the first few bytes of a file to determine its TRUE file type,
 * independent of its extension. Flags files where the extension doesn't
 * match the actual content (e.g., an .exe disguised as a .pdf).
 */

interface MagicSignature {
    bytes: number[];
    offset?: number;
    type: string;
    mime: string;
    category: "safe" | "executable" | "archive" | "media" | "document";
}

const MAGIC_SIGNATURES: MagicSignature[] = [
    // ── Executables (dangerous) ──────────────────────────────
    {
        bytes: [0x4d, 0x5a],
        type: "Windows Executable (EXE/DLL)",
        mime: "application/x-msdownload",
        category: "executable",
    },
    {
        bytes: [0x7f, 0x45, 0x4c, 0x46],
        type: "Linux Executable (ELF)",
        mime: "application/x-elf",
        category: "executable",
    },
    {
        bytes: [0xfe, 0xed, 0xfa, 0xce],
        type: "macOS Executable (Mach-O 32)",
        mime: "application/x-mach-binary",
        category: "executable",
    },
    {
        bytes: [0xfe, 0xed, 0xfa, 0xcf],
        type: "macOS Executable (Mach-O 64)",
        mime: "application/x-mach-binary",
        category: "executable",
    },
    {
        bytes: [0xcf, 0xfa, 0xed, 0xfe],
        type: "macOS Executable (Mach-O 64 LE)",
        mime: "application/x-mach-binary",
        category: "executable",
    },
    {
        bytes: [0xca, 0xfe, 0xba, 0xbe],
        type: "Java Class / macOS Universal",
        mime: "application/java-vm",
        category: "executable",
    },
    {
        bytes: [0x23, 0x21],
        type: "Script (Shebang)",
        mime: "text/x-script",
        category: "executable",
    },

    // ── Archives ─────────────────────────────────────────────
    {
        bytes: [0x50, 0x4b, 0x03, 0x04],
        type: "ZIP Archive",
        mime: "application/zip",
        category: "archive",
    },
    {
        bytes: [0x50, 0x4b, 0x05, 0x06],
        type: "ZIP Archive (empty)",
        mime: "application/zip",
        category: "archive",
    },
    {
        bytes: [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07],
        type: "RAR Archive",
        mime: "application/x-rar-compressed",
        category: "archive",
    },
    {
        bytes: [0x1f, 0x8b],
        type: "GZIP Archive",
        mime: "application/gzip",
        category: "archive",
    },
    {
        bytes: [0x42, 0x5a, 0x68],
        type: "BZIP2 Archive",
        mime: "application/x-bzip2",
        category: "archive",
    },
    {
        bytes: [0xfd, 0x37, 0x7a, 0x58, 0x5a],
        type: "XZ Archive",
        mime: "application/x-xz",
        category: "archive",
    },
    {
        bytes: [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c],
        type: "7-Zip Archive",
        mime: "application/x-7z-compressed",
        category: "archive",
    },

    // ── Images ───────────────────────────────────────────────
    {
        bytes: [0xff, 0xd8, 0xff],
        type: "JPEG Image",
        mime: "image/jpeg",
        category: "media",
    },
    {
        bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
        type: "PNG Image",
        mime: "image/png",
        category: "media",
    },
    {
        bytes: [0x47, 0x49, 0x46, 0x38],
        type: "GIF Image",
        mime: "image/gif",
        category: "media",
    },
    {
        bytes: [0x42, 0x4d],
        type: "BMP Image",
        mime: "image/bmp",
        category: "media",
    },
    {
        bytes: [0x52, 0x49, 0x46, 0x46],
        type: "RIFF (WebP/AVI/WAV)",
        mime: "application/octet-stream",
        category: "media",
    },
    {
        bytes: [0x00, 0x00, 0x01, 0x00],
        type: "ICO Image",
        mime: "image/x-icon",
        category: "media",
    },

    // ── Video ────────────────────────────────────────────────
    {
        bytes: [0x1a, 0x45, 0xdf, 0xa3],
        type: "Matroska/WebM Video",
        mime: "video/x-matroska",
        category: "media",
    },
    {
        bytes: [0x00, 0x00, 0x00],
        type: "MP4/MOV Video (ftyp)",
        mime: "video/mp4",
        category: "media",
    }, // simplified — real check below
    {
        bytes: [0x46, 0x4c, 0x56, 0x01],
        type: "FLV Video",
        mime: "video/x-flv",
        category: "media",
    },

    // ── Audio ────────────────────────────────────────────────
    {
        bytes: [0x49, 0x44, 0x33],
        type: "MP3 Audio (ID3)",
        mime: "audio/mpeg",
        category: "media",
    },
    {
        bytes: [0xff, 0xfb],
        type: "MP3 Audio",
        mime: "audio/mpeg",
        category: "media",
    },
    {
        bytes: [0xff, 0xf3],
        type: "MP3 Audio",
        mime: "audio/mpeg",
        category: "media",
    },
    {
        bytes: [0xff, 0xf2],
        type: "MP3 Audio",
        mime: "audio/mpeg",
        category: "media",
    },
    {
        bytes: [0x66, 0x4c, 0x61, 0x43],
        type: "FLAC Audio",
        mime: "audio/flac",
        category: "media",
    },
    {
        bytes: [0x4f, 0x67, 0x67, 0x53],
        type: "OGG Audio/Video",
        mime: "audio/ogg",
        category: "media",
    },

    // ── Documents ────────────────────────────────────────────
    {
        bytes: [0x25, 0x50, 0x44, 0x46],
        type: "PDF Document",
        mime: "application/pdf",
        category: "document",
    },
    {
        bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1],
        type: "MS Office (Legacy DOC/XLS/PPT)",
        mime: "application/msword",
        category: "document",
    },

    // ── Fonts ────────────────────────────────────────────────
    {
        bytes: [0x00, 0x01, 0x00, 0x00],
        type: "TrueType Font",
        mime: "font/ttf",
        category: "safe",
    },
    {
        bytes: [0x4f, 0x54, 0x54, 0x4f],
        type: "OpenType Font",
        mime: "font/otf",
        category: "safe",
    },
    {
        bytes: [0x77, 0x4f, 0x46, 0x46],
        type: "WOFF Font",
        mime: "font/woff",
        category: "safe",
    },
    {
        bytes: [0x77, 0x4f, 0x46, 0x32],
        type: "WOFF2 Font",
        mime: "font/woff2",
        category: "safe",
    },
];

/** Well-known dangerous file extensions */
const DANGEROUS_EXTENSIONS = new Set([
    ".exe",
    ".dll",
    ".sys",
    ".com",
    ".bat",
    ".cmd",
    ".ps1",
    ".vbs",
    ".vbe",
    ".js",
    ".jse",
    ".wsf",
    ".wsh",
    ".msi",
    ".msp",
    ".mst",
    ".scr",
    ".cpl",
    ".inf",
    ".reg",
    ".rgs",
    ".pif",
    ".lnk",
    ".url",
    ".hta",
    ".jar",
    ".class",
    ".sh",
    ".bash",
    ".app",
    ".action",
    ".command",
    ".workflow",
    ".csh",
    ".ksh",
]);

/** Extensions that commonly match specific magic bytes */
const EXTENSION_TO_EXPECTED_MIME: Record<string, string[]> = {
    ".jpg": ["image/jpeg"],
    ".jpeg": ["image/jpeg"],
    ".png": ["image/png"],
    ".gif": ["image/gif"],
    ".bmp": ["image/bmp"],
    ".webp": ["application/octet-stream"], // RIFF container
    ".ico": ["image/x-icon"],
    ".pdf": ["application/pdf"],
    ".mp3": ["audio/mpeg"],
    ".flac": ["audio/flac"],
    ".ogg": ["audio/ogg"],
    ".mp4": ["video/mp4"],
    ".mkv": ["video/x-matroska"],
    ".webm": ["video/x-matroska"],
    ".avi": ["application/octet-stream"], // RIFF container
    ".wav": ["application/octet-stream"], // RIFF container
    ".flv": ["video/x-flv"],
    ".exe": ["application/x-msdownload"],
    ".dll": ["application/x-msdownload"],
    ".zip": ["application/zip"],
    ".rar": ["application/x-rar-compressed"],
    ".gz": ["application/gzip"],
    ".7z": ["application/x-7z-compressed"],
    ".docx": ["application/zip"],
    ".xlsx": ["application/zip"],
    ".pptx": ["application/zip"],
    ".ttf": ["font/ttf"],
    ".otf": ["font/otf"],
    ".woff": ["font/woff"],
    ".woff2": ["font/woff2"],
};

export type SecurityLevel = "safe" | "warning" | "danger";

export interface SecurityScanResult {
    level: SecurityLevel;
    /** True file type detected from magic bytes */
    detectedType: string | null;
    /** The extension claims this type */
    claimedExtension: string;
    /** Is the extension dangerous by itself? */
    isDangerousExtension: boolean;
    /** Does the content match the extension? */
    extensionMismatch: boolean;
    /** Human-readable message */
    message: string;
}

/**
 * Detect the true file type by reading magic bytes.
 */
function detectType(data: Uint8Array): MagicSignature | null {
    if (data.length < 4) return null;

    // Check for MP4/MOV (ftyp box at offset 4)
    if (data.length >= 8) {
        const ftyp = String.fromCharCode(data[4], data[5], data[6], data[7]);
        if (ftyp === "ftyp") {
            return {
                bytes: [],
                type: "MP4/MOV Video",
                mime: "video/mp4",
                category: "media",
            };
        }
    }

    for (const sig of MAGIC_SIGNATURES) {
        const offset = sig.offset || 0;
        if (data.length < offset + sig.bytes.length) continue;

        let match = true;
        for (let i = 0; i < sig.bytes.length; i++) {
            if (data[offset + i] !== sig.bytes[i]) {
                match = false;
                break;
            }
        }
        if (match) return sig;
    }

    return null;
}

/**
 * Scan a file's magic bytes and compare against its extension.
 */
export function scanFile(
    data: Uint8Array,
    fileName: string,
    extension: string,
): SecurityScanResult {
    const ext = extension.toLowerCase();
    const isDangerousExtension = DANGEROUS_EXTENSIONS.has(ext);
    const detected = detectType(data);

    // If we can't detect the type, check extension only
    if (!detected) {
        if (isDangerousExtension) {
            return {
                level: "danger",
                detectedType: null,
                claimedExtension: ext,
                isDangerousExtension: true,
                extensionMismatch: false,
                message: `⚠️ Potentially dangerous file type (${ext})`,
            };
        }
        return {
            level: "safe",
            detectedType: null,
            claimedExtension: ext,
            isDangerousExtension: false,
            extensionMismatch: false,
            message: "No issues detected",
        };
    }

    // Check if the detected type matches what the extension claims
    const expectedMimes = EXTENSION_TO_EXPECTED_MIME[ext];
    const extensionMismatch = expectedMimes
        ? !expectedMimes.includes(detected.mime)
        : false;

    // Executable content disguised as something else = DANGER
    if (detected.category === "executable" && !isDangerousExtension) {
        return {
            level: "danger",
            detectedType: detected.type,
            claimedExtension: ext,
            isDangerousExtension: false,
            extensionMismatch: true,
            message: `🚨 MASQUERADING FILE: Claims to be "${ext}" but is actually "${detected.type}"`,
        };
    }

    // Known dangerous extension with matching executable content
    if (isDangerousExtension && detected.category === "executable") {
        return {
            level: "warning",
            detectedType: detected.type,
            claimedExtension: ext,
            isDangerousExtension: true,
            extensionMismatch: false,
            message: `⚠️ Executable file: ${detected.type}`,
        };
    }

    // Extension mismatch but not an executable — suspicious
    if (extensionMismatch) {
        return {
            level: "warning",
            detectedType: detected.type,
            claimedExtension: ext,
            isDangerousExtension: false,
            extensionMismatch: true,
            message: `Extension mismatch: "${ext}" but content is "${detected.type}"`,
        };
    }

    return {
        level: "safe",
        detectedType: detected.type,
        claimedExtension: ext,
        isDangerousExtension: false,
        extensionMismatch: false,
        message: `✓ Verified: ${detected.type}`,
    };
}

/**
 * Scan all files in a ZIP and return aggregated results.
 * Only needs the first 16 bytes of each file.
 */
export function scanAllFiles(
    entries: Array<{ path: string; name: string; isDirectory: boolean }>,
    getFirstBytes: (path: string) => Uint8Array | null,
): Map<string, SecurityScanResult> {
    const results = new Map<string, SecurityScanResult>();

    for (const entry of entries) {
        if (entry.isDirectory) continue;

        const ext = "." + (entry.name.split(".").pop()?.toLowerCase() || "");
        const data = getFirstBytes(entry.path);

        if (data) {
            results.set(entry.path, scanFile(data, entry.name, ext));
        } else {
            // Can't read bytes — just check extension
            const isDangerous = DANGEROUS_EXTENSIONS.has(ext);
            results.set(entry.path, {
                level: isDangerous ? "danger" : "safe",
                detectedType: null,
                claimedExtension: ext,
                isDangerousExtension: isDangerous,
                extensionMismatch: false,
                message: isDangerous
                    ? `⚠️ Potentially dangerous (${ext})`
                    : "No issues detected",
            });
        }
    }

    return results;
}

/**
 * Get aggregate security summary for the ZIP.
 */
export function getSecuritySummary(results: Map<string, SecurityScanResult>): {
    totalScanned: number;
    safe: number;
    warnings: number;
    dangers: number;
    level: SecurityLevel;
} {
    let safe = 0,
        warnings = 0,
        dangers = 0;
    for (const r of results.values()) {
        if (r.level === "safe") safe++;
        else if (r.level === "warning") warnings++;
        else dangers++;
    }
    return {
        totalScanned: results.size,
        safe,
        warnings,
        dangers,
        level: dangers > 0 ? "danger" : warnings > 0 ? "warning" : "safe",
    };
}
