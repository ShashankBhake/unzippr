/**
 * Client-side file metadata extraction.
 * Includes a lightweight EXIF parser for JPEG/TIFF images,
 * image dimension detection, and general file metadata.
 */

export interface FileMetadata {
    // General
    fileName: string;
    filePath: string;
    extension: string;
    mimeType: string;
    size: number;
    compressedSize: number;
    lastModified: Date;
    compressionRatio: number | null;

    // Image-specific
    dimensions?: { width: number; height: number };
    exif?: ExifData;

    // Video/Audio-specific
    mediaDuration?: number;
    mediaCodec?: string;

    // Text/Code-specific
    lineCount?: number;
    encoding?: string;
}

export interface ExifData {
    make?: string;
    model?: string;
    software?: string;
    dateTime?: string;
    dateTimeOriginal?: string;
    exposureTime?: string;
    fNumber?: string;
    iso?: number;
    focalLength?: string;
    flash?: string;
    whiteBalance?: string;
    orientation?: number;
    imageWidth?: number;
    imageHeight?: number;
    colorSpace?: string;
    gpsLatitude?: number;
    gpsLongitude?: number;
    gpsAltitude?: number;
    artist?: string;
    copyright?: string;
    description?: string;
    lensModel?: string;
    [key: string]: string | number | undefined;
}

// EXIF tag IDs → human-readable names
const EXIF_TAGS: Record<number, { name: string; key: keyof ExifData }> = {
    // IFD0 / Image tags
    0x010f: { name: "Make", key: "make" },
    0x0110: { name: "Model", key: "model" },
    0x0112: { name: "Orientation", key: "orientation" },
    0x011a: { name: "X Resolution", key: "imageWidth" },
    0x011b: { name: "Y Resolution", key: "imageHeight" },
    0x0131: { name: "Software", key: "software" },
    0x0132: { name: "DateTime", key: "dateTime" },
    0x013b: { name: "Artist", key: "artist" },
    0x8298: { name: "Copyright", key: "copyright" },
    0x010e: { name: "ImageDescription", key: "description" },

    // EXIF sub-IFD tags
    0x829a: { name: "ExposureTime", key: "exposureTime" },
    0x829d: { name: "FNumber", key: "fNumber" },
    0x8827: { name: "ISO", key: "iso" },
    0x9003: { name: "DateTimeOriginal", key: "dateTimeOriginal" },
    0x920a: { name: "FocalLength", key: "focalLength" },
    0x9209: { name: "Flash", key: "flash" },
    0xa001: { name: "ColorSpace", key: "colorSpace" },
    0xa002: { name: "ExifImageWidth", key: "imageWidth" },
    0xa003: { name: "ExifImageHeight", key: "imageHeight" },
    0xa405: { name: "FocalLengthIn35mmFilm", key: "focalLength" },
    0xa406: { name: "WhiteBalance", key: "whiteBalance" },
    0xa434: { name: "LensModel", key: "lensModel" },
};

const EXIF_IFD_POINTER = 0x8769;
const GPS_IFD_POINTER = 0x8825;

/**
 * Extract EXIF data from a JPEG byte array.
 * Lightweight pure-JS parser — no dependencies.
 */
export function extractExif(data: Uint8Array): ExifData | null {
    try {
        // JPEG starts with FF D8
        if (data[0] !== 0xff || data[1] !== 0xd8) return null;

        let offset = 2;
        while (offset < data.length - 1) {
            if (data[offset] !== 0xff) return null;

            const marker = data[offset + 1];

            // APP1 marker (EXIF)
            if (marker === 0xe1) {
                const length = (data[offset + 2] << 8) | data[offset + 3];
                const exifStart = offset + 4;

                // Check for "Exif\0\0"
                if (
                    data[exifStart] === 0x45 && // E
                    data[exifStart + 1] === 0x78 && // x
                    data[exifStart + 2] === 0x69 && // i
                    data[exifStart + 3] === 0x66 && // f
                    data[exifStart + 4] === 0x00 &&
                    data[exifStart + 5] === 0x00
                ) {
                    return parseExifData(data, exifStart + 6);
                }

                offset += 2 + length;
                continue;
            }

            // SOS (Start of Scan) — no more metadata after this
            if (marker === 0xda) break;

            // Skip other markers
            if (marker === 0xd0 || marker === 0xd9) {
                offset += 2;
            } else {
                const length = (data[offset + 2] << 8) | data[offset + 3];
                offset += 2 + length;
            }
        }

        return null;
    } catch {
        return null;
    }
}

function parseExifData(data: Uint8Array, tiffStart: number): ExifData | null {
    const result: ExifData = {};

    // Byte order: "II" (little-endian) or "MM" (big-endian)
    const isLittleEndian =
        data[tiffStart] === 0x49 && data[tiffStart + 1] === 0x49;

    const read16 = (off: number): number => {
        const abs = tiffStart + off;
        return isLittleEndian
            ? data[abs] | (data[abs + 1] << 8)
            : (data[abs] << 8) | data[abs + 1];
    };

    const read32 = (off: number): number => {
        const abs = tiffStart + off;
        return isLittleEndian
            ? data[abs] |
                  (data[abs + 1] << 8) |
                  (data[abs + 2] << 16) |
                  (data[abs + 3] << 24)
            : (data[abs] << 24) |
                  (data[abs + 1] << 16) |
                  (data[abs + 2] << 8) |
                  data[abs + 3];
    };

    const readString = (off: number, length: number): string => {
        const abs = tiffStart + off;
        let str = "";
        for (let i = 0; i < length - 1; i++) {
            const ch = data[abs + i];
            if (ch === 0) break;
            str += String.fromCharCode(ch);
        }
        return str.trim();
    };

    const readRational = (off: number): number => {
        const num = read32(off);
        const den = read32(off + 4);
        return den === 0 ? 0 : num / den;
    };

    function parseIFD(ifdOffset: number, isGPS = false) {
        if (ifdOffset >= data.length - tiffStart) return;

        const entryCount = read16(ifdOffset);
        if (entryCount > 500) return; // Sanity check

        for (let i = 0; i < entryCount; i++) {
            const entryOffset = ifdOffset + 2 + i * 12;
            if (entryOffset + 12 > data.length - tiffStart) break;

            const tag = read16(entryOffset);
            const type = read16(entryOffset + 2);
            const count = read32(entryOffset + 4);
            const valueOffset = entryOffset + 8;

            // Follow sub-IFD pointers
            if (tag === EXIF_IFD_POINTER) {
                const subIfdOffset = read32(valueOffset);
                parseIFD(subIfdOffset);
                continue;
            }
            if (tag === GPS_IFD_POINTER) {
                const gpsIfdOffset = read32(valueOffset);
                parseIFD(gpsIfdOffset, true);
                continue;
            }

            // GPS tags
            if (isGPS) {
                parseGPSTag(tag, type, count, valueOffset);
                continue;
            }

            const tagInfo = EXIF_TAGS[tag];
            if (!tagInfo) continue;

            const value = readTagValue(type, count, valueOffset);
            if (value !== null && value !== undefined) {
                (result as Record<string, unknown>)[tagInfo.key] = value;
            }
        }
    }

    function parseGPSTag(
        tag: number,
        type: number,
        count: number,
        valueOffset: number,
    ) {
        // GPS Latitude
        if (tag === 0x0002 && type === 5 && count === 3) {
            const dataOffset = read32(valueOffset);
            const deg = readRational(dataOffset);
            const min = readRational(dataOffset + 8);
            const sec = readRational(dataOffset + 16);
            result.gpsLatitude = deg + min / 60 + sec / 3600;
        }
        // GPS Latitude Ref
        if (tag === 0x0001) {
            const ref = String.fromCharCode(data[tiffStart + valueOffset]);
            if (
                ref === "S" &&
                result.gpsLatitude !== undefined &&
                result.gpsLatitude > 0
            ) {
                result.gpsLatitude = -result.gpsLatitude;
            }
        }
        // GPS Longitude
        if (tag === 0x0004 && type === 5 && count === 3) {
            const dataOffset = read32(valueOffset);
            const deg = readRational(dataOffset);
            const min = readRational(dataOffset + 8);
            const sec = readRational(dataOffset + 16);
            result.gpsLongitude = deg + min / 60 + sec / 3600;
        }
        // GPS Longitude Ref
        if (tag === 0x0003) {
            const ref = String.fromCharCode(data[tiffStart + valueOffset]);
            if (
                ref === "W" &&
                result.gpsLongitude !== undefined &&
                result.gpsLongitude > 0
            ) {
                result.gpsLongitude = -result.gpsLongitude;
            }
        }
        // GPS Altitude
        if (tag === 0x0006 && type === 5) {
            const dataOffset = read32(valueOffset);
            result.gpsAltitude = readRational(dataOffset);
        }
    }

    function readTagValue(
        type: number,
        count: number,
        valueOffset: number,
    ): string | number | null {
        // Type 1: BYTE
        if (type === 1) return data[tiffStart + valueOffset];
        // Type 2: ASCII
        if (type === 2) {
            const dataSize = count;
            if (dataSize <= 4) {
                return readString(valueOffset, count);
            }
            const stringOffset = read32(valueOffset);
            return readString(stringOffset, count);
        }
        // Type 3: SHORT
        if (type === 3) return read16(valueOffset);
        // Type 4: LONG
        if (type === 4) return read32(valueOffset);
        // Type 5: RATIONAL (unsigned)
        if (type === 5) {
            const dataOffset = read32(valueOffset);
            const rational = readRational(dataOffset);
            // Format nicely for common tags
            return rational;
        }
        // Type 7: UNDEFINED (treat as byte)
        if (type === 7 && count <= 4) return data[tiffStart + valueOffset];
        // Type 10: SRATIONAL
        if (type === 10) {
            const dataOffset = read32(valueOffset);
            return readRational(dataOffset);
        }

        return null;
    }

    // Start parsing from first IFD
    const ifdOffset = read32(4); // Offset to first IFD
    parseIFD(ifdOffset);

    // Format some fields nicely
    if (typeof result.exposureTime === "number") {
        const et = result.exposureTime;
        result.exposureTime = et < 1 ? `1/${Math.round(1 / et)}s` : `${et}s`;
    }
    if (typeof result.fNumber === "number") {
        result.fNumber = `f/${(result.fNumber as number).toFixed(1)}`;
    }
    if (typeof result.focalLength === "number") {
        result.focalLength = `${(result.focalLength as number).toFixed(1)}mm`;
    }
    if (result.flash !== undefined) {
        const flashVal =
            typeof result.flash === "number" ? result.flash : undefined;
        if (flashVal !== undefined) {
            result.flash = flashVal & 1 ? "Fired" : "Did not fire";
        }
    }
    if (result.whiteBalance !== undefined) {
        const wb =
            typeof result.whiteBalance === "number"
                ? result.whiteBalance
                : undefined;
        if (wb !== undefined) {
            result.whiteBalance = wb === 0 ? "Auto" : "Manual";
        }
    }
    if (result.colorSpace !== undefined) {
        const cs =
            typeof result.colorSpace === "number"
                ? result.colorSpace
                : undefined;
        if (cs !== undefined) {
            result.colorSpace =
                cs === 1 ? "sRGB" : cs === 0xffff ? "Uncalibrated" : `${cs}`;
        }
    }

    return Object.keys(result).length > 0 ? result : null;
}

/**
 * Get image dimensions from raw bytes. Works for JPEG, PNG, GIF, BMP, WebP.
 */
export function getImageDimensions(
    data: Uint8Array,
    ext: string,
): { width: number; height: number } | null {
    try {
        if (ext === ".png") return getPngDimensions(data);
        if (ext === ".jpg" || ext === ".jpeg") return getJpegDimensions(data);
        if (ext === ".gif") return getGifDimensions(data);
        if (ext === ".bmp") return getBmpDimensions(data);
        if (ext === ".webp") return getWebpDimensions(data);
        return null;
    } catch {
        return null;
    }
}

function getPngDimensions(
    data: Uint8Array,
): { width: number; height: number } | null {
    // PNG header: 8 bytes, then IHDR chunk
    if (data.length < 24) return null;
    if (data[0] !== 0x89 || data[1] !== 0x50) return null; // Not PNG
    const width =
        (data[16] << 24) | (data[17] << 16) | (data[18] << 8) | data[19];
    const height =
        (data[20] << 24) | (data[21] << 16) | (data[22] << 8) | data[23];
    return { width, height };
}

function getJpegDimensions(
    data: Uint8Array,
): { width: number; height: number } | null {
    if (data[0] !== 0xff || data[1] !== 0xd8) return null;
    let offset = 2;
    while (offset < data.length - 1) {
        if (data[offset] !== 0xff) return null;
        const marker = data[offset + 1];
        // SOF markers (SOF0, SOF1, SOF2)
        if (marker >= 0xc0 && marker <= 0xc3 && marker !== 0xc4) {
            const height = (data[offset + 5] << 8) | data[offset + 6];
            const width = (data[offset + 7] << 8) | data[offset + 8];
            return { width, height };
        }
        if (marker === 0xda || marker === 0xd9) break;
        const length = (data[offset + 2] << 8) | data[offset + 3];
        offset += 2 + length;
    }
    return null;
}

function getGifDimensions(
    data: Uint8Array,
): { width: number; height: number } | null {
    if (data.length < 10) return null;
    // GIF87a or GIF89a
    if (data[0] !== 0x47 || data[1] !== 0x49 || data[2] !== 0x46) return null;
    const width = data[6] | (data[7] << 8);
    const height = data[8] | (data[9] << 8);
    return { width, height };
}

function getBmpDimensions(
    data: Uint8Array,
): { width: number; height: number } | null {
    if (data.length < 26) return null;
    if (data[0] !== 0x42 || data[1] !== 0x4d) return null; // BM
    const width =
        data[18] | (data[19] << 8) | (data[20] << 16) | (data[21] << 24);
    const height = Math.abs(
        data[22] | (data[23] << 8) | (data[24] << 16) | (data[25] << 24) | 0,
    );
    return { width, height };
}

function getWebpDimensions(
    data: Uint8Array,
): { width: number; height: number } | null {
    if (data.length < 30) return null;
    // RIFF....WEBP
    if (data[0] !== 0x52 || data[8] !== 0x57) return null;

    // VP8 lossy
    if (
        data[12] === 0x56 &&
        data[13] === 0x50 &&
        data[14] === 0x38 &&
        data[15] === 0x20
    ) {
        const width = (data[26] | (data[27] << 8)) & 0x3fff;
        const height = (data[28] | (data[29] << 8)) & 0x3fff;
        return { width, height };
    }
    // VP8L lossless
    if (
        data[12] === 0x56 &&
        data[13] === 0x50 &&
        data[14] === 0x38 &&
        data[15] === 0x4c
    ) {
        const bits =
            data[21] | (data[22] << 8) | (data[23] << 16) | (data[24] << 24);
        const width = (bits & 0x3fff) + 1;
        const height = ((bits >> 14) & 0x3fff) + 1;
        return { width, height };
    }
    // VP8X extended
    if (
        data[12] === 0x56 &&
        data[13] === 0x50 &&
        data[14] === 0x38 &&
        data[15] === 0x58
    ) {
        const width = 1 + (data[24] | (data[25] << 8) | (data[26] << 16));
        const height = 1 + (data[27] | (data[28] << 8) | (data[29] << 16));
        return { width, height };
    }

    return null;
}

/**
 * Build a complete FileMetadata object from a ZipEntry and its raw data.
 */
export function buildFileMetadata(
    entry: {
        path: string;
        name: string;
        size: number;
        compressedSize: number;
        lastModified: Date;
    },
    data: Uint8Array | null,
    ext: string,
    mimeType: string,
): FileMetadata {
    const meta: FileMetadata = {
        fileName: entry.name,
        filePath: entry.path,
        extension: ext || "(none)",
        mimeType,
        size: entry.size,
        compressedSize: entry.compressedSize,
        lastModified: entry.lastModified,
        compressionRatio:
            entry.size > 0
                ? Math.round((1 - entry.compressedSize / entry.size) * 100)
                : null,
    };

    if (!data) return meta;

    // Image metadata
    const imageExts = [
        ".jpg",
        ".jpeg",
        ".png",
        ".gif",
        ".bmp",
        ".webp",
        ".avif",
        ".svg",
        ".ico",
    ];
    if (imageExts.includes(ext)) {
        const dims = getImageDimensions(data, ext);
        if (dims) {
            meta.dimensions = dims;
        }

        // EXIF for JPEG
        if (ext === ".jpg" || ext === ".jpeg") {
            const exif = extractExif(data);
            if (exif) {
                meta.exif = exif;
                // Use EXIF dimensions if not found via SOF
                if (!meta.dimensions && exif.imageWidth && exif.imageHeight) {
                    meta.dimensions = {
                        width: exif.imageWidth,
                        height: exif.imageHeight,
                    };
                }
            }
        }
    }

    // Text/code: count lines
    const textExts = [
        ".txt",
        ".md",
        ".mdx",
        ".csv",
        ".tsv",
        ".json",
        ".xml",
        ".log",
        ".env",
        ".js",
        ".jsx",
        ".ts",
        ".tsx",
        ".py",
        ".rb",
        ".go",
        ".rs",
        ".java",
        ".kt",
        ".swift",
        ".c",
        ".cpp",
        ".h",
        ".hpp",
        ".cs",
        ".php",
        ".lua",
        ".r",
        ".sql",
        ".sh",
        ".bash",
        ".zsh",
        ".html",
        ".htm",
        ".css",
        ".scss",
        ".yaml",
        ".yml",
        ".toml",
        ".vue",
        ".svelte",
    ];
    if (textExts.includes(ext)) {
        try {
            const text = new TextDecoder("utf-8").decode(data);
            meta.lineCount = text.split("\n").length;
            meta.encoding = "UTF-8";
        } catch {
            // not text
        }
    }

    return meta;
}
