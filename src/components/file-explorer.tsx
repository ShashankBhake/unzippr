"use client";

import React, { useState, useMemo, useCallback } from "react";
import { Search, ChevronRight, ChevronDown } from "lucide-react";
import { TreeNode, ZipEntry } from "@/lib/types";
import { formatBytes, searchEntries } from "@/lib/utils";
import { FileIcon } from "./file-icon";

interface FileExplorerProps {
    tree: TreeNode;
    entries: ZipEntry[];
    selectedPath: string | null;
    searchQuery: string;
    onSearchChange: (query: string) => void;
    onSelect: (entry: ZipEntry) => void;
}

export function FileExplorer({
    tree,
    entries,
    selectedPath,
    searchQuery,
    onSearchChange,
    onSelect,
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
                    />
                ) : (
                    <TreeView
                        node={tree}
                        selectedPath={selectedPath}
                        onSelect={onSelect}
                        depth={0}
                    />
                )}
            </div>
        </div>
    );
}

// --- Tree View ---

interface TreeViewProps {
    node: TreeNode;
    selectedPath: string | null;
    onSelect: (entry: ZipEntry) => void;
    depth: number;
}

function TreeView({ node, selectedPath, onSelect, depth }: TreeViewProps) {
    const [expanded, setExpanded] = useState(node.isExpanded ?? depth < 1);

    const handleClick = useCallback(() => {
        if (node.isDirectory) {
            setExpanded((e) => !e);
        } else if (node.entry) {
            onSelect(node.entry);
        }
    }, [node, onSelect]);

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
                    />
                ))}
            </div>
        );
    }

    const isSelected = selectedPath === node.path;

    return (
        <div>
            <div
                className={`tree-item ${isSelected ? "tree-item-active" : ""}`}
                style={{ paddingLeft: `${(depth - 1) * 16 + 8}px` }}
                onClick={handleClick}
                title={node.path}
            >
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
                    <span className="w-4" />
                )}

                <FileIcon
                    name={node.name}
                    isDirectory={node.isDirectory}
                    isExpanded={expanded}
                    className="w-4 h-4 shrink-0"
                />

                <span className="truncate text-xs">{node.name}</span>

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
}

function SearchResultsList({
    results,
    selectedPath,
    onSelect,
    query,
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
            {results.map((entry) => (
                <div
                    key={entry.path}
                    className={`tree-item ${selectedPath === entry.path ? "tree-item-active" : ""}`}
                    onClick={() => onSelect(entry)}
                    title={entry.path}
                >
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
                    <span className="ml-auto text-[10px] text-neutral-400 shrink-0 tabular-nums">
                        {formatBytes(entry.size)}
                    </span>
                </div>
            ))}
        </div>
    );
}
