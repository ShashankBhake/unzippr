import { ZipEntry, TreeNode, EXTENSION_MAP, PreviewType } from "./types";

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number, decimals = 1): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

/**
 * Format a date to relative or absolute string
 */
export function formatDate(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 30) return `${diffDays} days ago`;
    if (diffDays < 365) {
        const months = Math.floor(diffDays / 30);
        return `${months} month${months > 1 ? "s" : ""} ago`;
    }

    return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}

/**
 * Get the compression ratio as a percentage
 */
export function getCompressionRatio(
    original: number,
    compressed: number,
): number {
    if (original === 0) return 0;
    return Math.round((1 - compressed / original) * 100);
}

/**
 * Get file extension from path
 */
export function getExtension(path: string): string {
    const name = path.split("/").pop() || "";
    // Handle dotfiles like .gitignore
    if (name.startsWith(".") && !name.includes(".", 1)) {
        return "." + name.slice(1);
    }
    const dotIdx = name.lastIndexOf(".");
    if (dotIdx === -1) return "";
    return name.slice(dotIdx).toLowerCase();
}

/**
 * Get the preview type for a file
 */
export function getPreviewType(path: string): PreviewType {
    const ext = getExtension(path);
    const name = path.split("/").pop()?.toLowerCase() || "";

    // Special filenames
    if (
        name === "dockerfile" ||
        name === "makefile" ||
        name === "cmakelists.txt"
    ) {
        return "code";
    }
    if (name === "license" || name === "readme" || name === "changelog") {
        return "text";
    }

    return EXTENSION_MAP[ext] || "unsupported";
}

/**
 * Build a tree structure from flat file entries
 */
export function buildTree(entries: ZipEntry[], rootName: string): TreeNode {
    const root: TreeNode = {
        name: rootName,
        path: "",
        isDirectory: true,
        children: [],
        isExpanded: true,
    };

    const nodeMap = new Map<string, TreeNode>();
    nodeMap.set("", root);

    // Sort entries: directories first, then alphabetically
    const sorted = [...entries].sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
        return a.path.localeCompare(b.path);
    });

    for (const entry of sorted) {
        const parts = entry.path.split("/").filter(Boolean);
        let currentPath = "";

        for (let i = 0; i < parts.length; i++) {
            const parentPath = currentPath;
            currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];
            const isLast = i === parts.length - 1;

            if (!nodeMap.has(currentPath)) {
                const node: TreeNode = {
                    name: parts[i],
                    path: currentPath,
                    isDirectory: isLast ? entry.isDirectory : true,
                    entry: isLast ? entry : undefined,
                    children: [],
                    isExpanded: i === 0, // Expand first level by default
                };

                const parent = nodeMap.get(parentPath);
                if (parent) {
                    parent.children.push(node);
                }
                nodeMap.set(currentPath, node);
            }
        }
    }

    // Sort children: directories first, then by name
    function sortChildren(node: TreeNode) {
        node.children.sort((a, b) => {
            if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
            return a.name.localeCompare(b.name, undefined, { numeric: true });
        });
        node.children.forEach(sortChildren);
    }

    sortChildren(root);
    return root;
}

/**
 * Count files and directories in a tree
 */
export function countTreeItems(entries: ZipEntry[]): {
    files: number;
    directories: number;
} {
    let files = 0;
    let directories = 0;
    for (const entry of entries) {
        if (entry.isDirectory) directories++;
        else files++;
    }
    return { files, directories };
}

/**
 * Get total uncompressed size
 */
export function getTotalSize(entries: ZipEntry[]): number {
    return entries.reduce((acc, e) => acc + e.size, 0);
}

/**
 * Get total compressed size
 */
export function getTotalCompressedSize(entries: ZipEntry[]): number {
    return entries.reduce((acc, e) => acc + e.compressedSize, 0);
}

/**
 * Check if a URL looks valid
 */
export function isValidUrl(str: string): boolean {
    try {
        const url = new URL(str);
        return url.protocol === "http:" || url.protocol === "https:";
    } catch {
        return false;
    }
}

/**
 * Extract a filename from a URL
 */
export function getFilenameFromUrl(url: string): string {
    try {
        const u = new URL(url);
        const pathname = u.pathname;
        const name = pathname.split("/").pop();
        if (name && name.includes(".")) return decodeURIComponent(name);
        return "archive.zip";
    } catch {
        return "archive.zip";
    }
}

/**
 * Debounce a function
 */
export function debounce<T extends (...args: unknown[]) => void>(
    fn: T,
    ms: number,
): (...args: Parameters<T>) => void {
    let timer: ReturnType<typeof setTimeout>;
    return (...args: Parameters<T>) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), ms);
    };
}

/**
 * Search entries by path
 */
export function searchEntries(entries: ZipEntry[], query: string): ZipEntry[] {
    const lower = query.toLowerCase();
    return entries.filter(
        (e) => !e.isDirectory && e.path.toLowerCase().includes(lower),
    );
}
