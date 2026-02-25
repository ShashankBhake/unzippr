"use client";

import React, { useState, useMemo, useCallback } from "react";
import {
    Search,
    ChevronRight,
    ChevronDown,
    ShieldAlert,
    ShieldX,
    CheckSquare2,
    Square,
} from "lucide-react";
import { TreeNode, ZipEntry } from "@/lib/types";
import { formatBytes, searchEntries } from "@/lib/utils";
import { FileIcon } from "./file-icon";
import { SecurityScanResult } from "@/lib/magic-bytes";

interface FileExplorerProps {
    tree: TreeNode;
    entries: ZipEntry[];
    selectedPath: string | null;
    searchQuery: string;
    onSearchChange: (query: string) => void;
    onSelect: (entry: ZipEntry) => void;
    selectMode?: boolean;
    selectedPaths?: Set<string>;
    onToggleSelect?: (path: string) => void;
    securityResults?: Map<string, SecurityScanResult> | null;
}

export function FileExplorer({
    tree,
    entries,
    selectedPath,
    searchQuery,
    onSearchChange,
    onSelect,
    selectMode = false,
    selectedPaths,
    onToggleSelect,
    securityResults,
}: FileExplorerProps) {
    const searchResults = useMemo(() => {
        if (!searchQuery.trim()) return null;
        return searchEntries(entries, searchQuery);
    }, [entries, searchQuery]);

    return (
        <div className="flex flex-col h-full min-h-0">
            {/* Search */}
            <div className="p-3 border-b border-neutral-200 dark:border-neutral-800">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder="Search files..."
                        className="input-base pl-9 py-2 text-xs"
                    />
                </div>
            </div>

            {/* File list */}
            <div className="flex-1 overflow-y-auto py-2 px-1">
                {searchResults ? (
                    <SearchResultsList
                        results={searchResults}
                        selectedPath={selectedPath}
                        onSelect={onSelect}
                        query={searchQuery}
                        selectMode={selectMode}
                        selectedPaths={selectedPaths}
                        onToggleSelect={onToggleSelect}
                        securityResults={securityResults}
                    />
                ) : (
                    <TreeView
                        node={tree}
                        selectedPath={selectedPath}
                        onSelect={onSelect}
                        depth={0}
                        selectMode={selectMode}
                        selectedPaths={selectedPaths}
                        onToggleSelect={onToggleSelect}
                        securityResults={securityResults}
                    />
                )}
            </div>
        </div>
    );
}

// --- Security indicator ---
function SecurityIndicator({ result }: { result?: SecurityScanResult }) {
    if (!result || result.level === "safe") return null;
    if (result.level === "danger") {
        return (
            <span title={result.message}>
                <ShieldX className="w-3 h-3 text-red-500 shrink-0" />
            </span>
        );
    }
    return (
        <span title={result.message}>
            <ShieldAlert className="w-3 h-3 text-amber-500 shrink-0" />
        </span>
    );
}

// --- Tree View ---

interface TreeViewProps {
    node: TreeNode;
    selectedPath: string | null;
    onSelect: (entry: ZipEntry) => void;
    depth: number;
    selectMode?: boolean;
    selectedPaths?: Set<string>;
    onToggleSelect?: (path: string) => void;
    securityResults?: Map<string, SecurityScanResult> | null;
}

function TreeView({
    node,
    selectedPath,
    onSelect,
    depth,
    selectMode,
    selectedPaths,
    onToggleSelect,
    securityResults,
}: TreeViewProps) {
    const [expanded, setExpanded] = useState(node.isExpanded ?? depth < 1);

    const handleClick = useCallback(() => {
        if (node.isDirectory) {
            setExpanded((e) => !e);
        } else if (selectMode && onToggleSelect) {
            onToggleSelect(node.path);
        } else if (node.entry) {
            onSelect(node.entry);
        }
    }, [node, onSelect, selectMode, onToggleSelect]);

    // Don't render the root node itself, just its children
    if (depth === 0) {
        return (
            <div>
                {node.children.map((child) => (
                    <TreeView
                        key={child.path}
                        node={child}
                        selectedPath={selectedPath}
                        onSelect={onSelect}
                        depth={depth + 1}
                        selectMode={selectMode}
                        selectedPaths={selectedPaths}
                        onToggleSelect={onToggleSelect}
                        securityResults={securityResults}
                    />
                ))}
            </div>
        );
    }

    const isSelected = selectedPath === node.path;
    const isChecked = selectedPaths?.has(node.path) ?? false;
    const secResult = securityResults?.get(node.path);

    return (
        <div>
            <div
                className={`tree-item ${isSelected ? "tree-item-active" : ""}`}
                style={{ paddingLeft: `${(depth - 1) * 16 + 8}px` }}
                onClick={handleClick}
                title={node.path}
            >
                {/* Checkbox in select mode */}
                {selectMode && !node.isDirectory && (
                    <span className="shrink-0 w-4 h-4 flex items-center justify-center">
                        {isChecked ? (
                            <CheckSquare2 className="w-3.5 h-3.5 text-brand-500" />
                        ) : (
                            <Square className="w-3.5 h-3.5 text-neutral-400" />
                        )}
                    </span>
                )}

                {/* Expand/collapse chevron for directories */}
                {node.isDirectory ? (
                    <span className="shrink-0 w-4 h-4 flex items-center justify-center">
                        {expanded ? (
                            <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
                        ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />
                        )}
                    </span>
                ) : (
                    !selectMode && <span className="w-4" />
                )}

                <FileIcon
                    name={node.name}
                    isDirectory={node.isDirectory}
                    isExpanded={expanded}
                    className="w-4 h-4 shrink-0"
                />

                <span className="truncate text-xs">{node.name}</span>

                {/* Security indicator */}
                <SecurityIndicator result={secResult} />

                {!node.isDirectory && node.entry && (
                    <span className="ml-auto text-[10px] text-neutral-400 dark:text-neutral-500 shrink-0 tabular-nums">
                        {formatBytes(node.entry.size)}
                    </span>
                )}
            </div>

            {node.isDirectory && expanded && (
                <div>
                    {node.children.map((child) => (
                        <TreeView
                            key={child.path}
                            node={child}
                            selectedPath={selectedPath}
                            onSelect={onSelect}
                            depth={depth + 1}
                            selectMode={selectMode}
                            selectedPaths={selectedPaths}
                            onToggleSelect={onToggleSelect}
                            securityResults={securityResults}
                        />
                    ))}
                    {node.children.length === 0 && (
                        <div
                            className="text-xs text-neutral-400 italic py-1"
                            style={{ paddingLeft: `${depth * 16 + 24}px` }}
                        >
                            Empty folder
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// --- Search Results ---

interface SearchResultsListProps {
    results: ZipEntry[];
    selectedPath: string | null;
    onSelect: (entry: ZipEntry) => void;
    query: string;
    selectMode?: boolean;
    selectedPaths?: Set<string>;
    onToggleSelect?: (path: string) => void;
    securityResults?: Map<string, SecurityScanResult> | null;
}

function SearchResultsList({
    results,
    selectedPath,
    onSelect,
    query,
    selectMode,
    selectedPaths,
    onToggleSelect,
    securityResults,
}: SearchResultsListProps) {
    if (results.length === 0) {
        return (
            <div className="text-center py-8 text-sm text-neutral-400">
                <p>No files found for &ldquo;{query}&rdquo;</p>
            </div>
        );
    }

    return (
        <div>
            <div className="px-3 py-1.5 text-[10px] font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
                {results.length} result{results.length !== 1 ? "s" : ""}
            </div>
            {results.map((entry) => {
                const isChecked = selectedPaths?.has(entry.path) ?? false;
                const secResult = securityResults?.get(entry.path);
                return (
                    <div
                        key={entry.path}
                        className={`tree-item ${selectedPath === entry.path ? "tree-item-active" : ""}`}
                        onClick={() => {
                            if (selectMode && onToggleSelect) {
                                onToggleSelect(entry.path);
                            } else {
                                onSelect(entry);
                            }
                        }}
                        title={entry.path}
                    >
                        {selectMode && (
                            <span className="shrink-0 w-4 h-4 flex items-center justify-center">
                                {isChecked ? (
                                    <CheckSquare2 className="w-3.5 h-3.5 text-brand-500" />
                                ) : (
                                    <Square className="w-3.5 h-3.5 text-neutral-400" />
                                )}
                            </span>
                        )}
                        <FileIcon
                            name={entry.name}
                            isDirectory={false}
                            className="w-4 h-4 shrink-0"
                        />
                        <div className="flex flex-col min-w-0">
                            <span className="truncate text-xs font-medium">
                                {entry.name}
                            </span>
                            <span className="truncate text-[10px] text-neutral-400 dark:text-neutral-500">
                                {entry.path}
                            </span>
                        </div>
                        <SecurityIndicator result={secResult} />
                        <span className="ml-auto text-[10px] text-neutral-400 shrink-0 tabular-nums">
                            {formatBytes(entry.size)}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}
