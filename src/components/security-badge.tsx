"use client";

import React, { useState } from "react";
import {
    Shield,
    ShieldAlert,
    ShieldCheck,
    ShieldX,
    X,
    AlertTriangle,
    CheckCircle,
} from "lucide-react";
import { SecurityScanResult, SecurityLevel } from "@/lib/magic-bytes";

interface SecurityBadgeProps {
    summary: {
        totalScanned: number;
        safe: number;
        warnings: number;
        dangers: number;
        level: SecurityLevel;
    };
    results: Map<string, SecurityScanResult>;
}

export function SecurityBadge({ summary, results }: SecurityBadgeProps) {
    const [showPanel, setShowPanel] = useState(false);

    const badgeClass =
        summary.level === "danger"
            ? "badge-danger cursor-pointer"
            : summary.level === "warning"
              ? "badge-warning cursor-pointer"
              : "badge-success cursor-pointer";

    const icon =
        summary.level === "danger" ? (
            <ShieldX className="w-3 h-3" />
        ) : summary.level === "warning" ? (
            <ShieldAlert className="w-3 h-3" />
        ) : (
            <ShieldCheck className="w-3 h-3" />
        );

    const label =
        summary.level === "danger"
            ? `${summary.dangers} threat${summary.dangers !== 1 ? "s" : ""}`
            : summary.level === "warning"
              ? `${summary.warnings} warning${summary.warnings !== 1 ? "s" : ""}`
              : "Safe";

    return (
        <>
            <button
                onClick={() => setShowPanel(!showPanel)}
                className={badgeClass}
                title={`Security scan: ${summary.totalScanned} files scanned — ${summary.safe} safe, ${summary.warnings} warnings, ${summary.dangers} threats`}
            >
                {icon}
                <span>{label}</span>
            </button>

            {/* Floating panel */}
            {showPanel && (
                <div
                    className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/20 dark:bg-black/40"
                    onClick={() => setShowPanel(false)}
                >
                    <div
                        className="bg-white dark:bg-neutral-900 rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-700 w-full max-w-lg max-h-[70vh] flex flex-col animate-fade-in"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center gap-2 px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
                            <Shield className="w-4 h-4 text-brand-500" />
                            <h3 className="text-sm font-semibold flex-1">
                                Security X-Ray
                            </h3>
                            <div className="flex items-center gap-2 text-[10px]">
                                {summary.dangers > 0 && (
                                    <span className="badge-danger">
                                        {summary.dangers} danger
                                        {summary.dangers !== 1 ? "s" : ""}
                                    </span>
                                )}
                                {summary.warnings > 0 && (
                                    <span className="badge-warning">
                                        {summary.warnings} warning
                                        {summary.warnings !== 1 ? "s" : ""}
                                    </span>
                                )}
                                <span className="badge-success">
                                    {summary.safe} safe
                                </span>
                            </div>
                            <button
                                onClick={() => setShowPanel(false)}
                                className="btn-ghost p-1"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        {/* Results list */}
                        <div className="overflow-y-auto p-2 flex-1">
                            {/* Dangers first, then warnings */}
                            {Array.from(results.entries())
                                .filter(([, r]) => r.level !== "safe")
                                .sort((a, b) => {
                                    const order = {
                                        danger: 0,
                                        warning: 1,
                                        safe: 2,
                                    };
                                    return (
                                        order[a[1].level] - order[b[1].level]
                                    );
                                })
                                .map(([path, result]) => (
                                    <div
                                        key={path}
                                        className={`flex items-start gap-2 px-3 py-2 rounded-lg mb-1 text-xs ${
                                            result.level === "danger"
                                                ? "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400"
                                                : "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400"
                                        }`}
                                    >
                                        {result.level === "danger" ? (
                                            <ShieldX className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                        ) : (
                                            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                        )}
                                        <div className="min-w-0 flex-1">
                                            <p className="font-medium truncate">
                                                {path.split("/").pop()}
                                            </p>
                                            <p className="text-[10px] opacity-75 truncate">
                                                {path}
                                            </p>
                                            <p className="mt-0.5">
                                                {result.message}
                                            </p>
                                            {result.detectedType && (
                                                <p className="text-[10px] opacity-60 mt-0.5">
                                                    Detected:{" "}
                                                    {result.detectedType}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            {summary.warnings === 0 &&
                                summary.dangers === 0 && (
                                    <div className="flex flex-col items-center justify-center py-8 gap-2 text-neutral-400">
                                        <CheckCircle className="w-8 h-8 text-emerald-500" />
                                        <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                                            All files look safe
                                        </p>
                                        <p className="text-xs">
                                            {summary.totalScanned} files
                                            scanned, no issues found
                                        </p>
                                    </div>
                                )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
