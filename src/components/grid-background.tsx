"use client";

import React, { useEffect, useRef } from "react";
import { useTheme } from "./theme-provider";

/**
 * Animated square-grid background rendered on <canvas>.
 * Grid lines pulse with a fast radial wave from the center.
 */
export function GridBackground() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { theme } = useTheme();

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        let animId: number;
        let width = 0;
        let height = 0;

        const GAP = 40; // grid cell size in px
        const WAVE_SPEED = 0.003; // fast radial wave
        const WAVE_LENGTH = 200; // wavelength

        const resize = () => {
            const dpr = window.devicePixelRatio || 1;
            const rect = canvas.getBoundingClientRect();
            width = rect.width;
            height = rect.height;
            canvas.width = width * dpr;
            canvas.height = height * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        };

        const draw = (t: number) => {
            ctx.clearRect(0, 0, width, height);

            const isDark = theme === "dark";
            const cx = width / 2;
            const cy = height / 2;
            const maxDist = Math.hypot(cx, cy);

            const cols = Math.ceil(width / GAP) + 1;
            const rows = Math.ceil(height / GAP) + 1;
            const offsetX = (width % GAP) / 2;
            const offsetY = (height % GAP) / 2;

            // Draw vertical lines
            for (let col = 0; col <= cols; col++) {
                const x = offsetX + col * GAP;
                // Sample wave at the midpoint of this line
                const dist = Math.abs(x - cx);
                const wave = Math.sin(
                    (dist / WAVE_LENGTH) * Math.PI * 2 - t * WAVE_SPEED,
                );
                const pulse = (wave + 1) / 2; // 0 → 1

                const edgeFade = Math.min(x / 120, (width - x) / 120, 1);
                const alpha = (0.02 + 0.05 * pulse) * edgeFade;

                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
                ctx.strokeStyle = isDark
                    ? `rgba(140, 160, 255, ${alpha})`
                    : `rgba(60, 80, 180, ${alpha})`;
                ctx.lineWidth = 1;
                ctx.stroke();
            }

            // Draw horizontal lines
            for (let row = 0; row <= rows; row++) {
                const y = offsetY + row * GAP;
                const dist = Math.abs(y - cy);
                const wave = Math.sin(
                    (dist / WAVE_LENGTH) * Math.PI * 2 - t * WAVE_SPEED,
                );
                const pulse = (wave + 1) / 2;

                const edgeFade = Math.min(y / 120, (height - y) / 120, 1);
                const alpha = (0.02 + 0.05 * pulse) * edgeFade;

                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(width, y);
                ctx.strokeStyle = isDark
                    ? `rgba(140, 160, 255, ${alpha})`
                    : `rgba(60, 80, 180, ${alpha})`;
                ctx.lineWidth = 1;
                ctx.stroke();
            }

            // Draw bright squares at intersections near the wave crest
            for (let row = 0; row <= rows; row++) {
                for (let col = 0; col <= cols; col++) {
                    const x = offsetX + col * GAP;
                    const y = offsetY + row * GAP;

                    const dist = Math.hypot(x - cx, y - cy);
                    const wave = Math.sin(
                        (dist / WAVE_LENGTH) * Math.PI * 2 - t * WAVE_SPEED,
                    );
                    const pulse = Math.max(0, wave); // only positive half

                    if (pulse < 0.5) continue; // skip dim intersections for perf

                    const edgeFade = Math.min(
                        x / 120,
                        y / 120,
                        (width - x) / 120,
                        (height - y) / 120,
                        1,
                    );
                    const centerFade = 1 - (dist / maxDist) * 0.3;
                    const intensity = pulse * edgeFade * centerFade;
                    const size = 1.5 + 1.5 * intensity;
                    const alpha = 0.06 + 0.14 * intensity;

                    ctx.fillStyle = isDark
                        ? `rgba(140, 170, 255, ${alpha})`
                        : `rgba(60, 90, 200, ${alpha})`;
                    ctx.fillRect(x - size / 2, y - size / 2, size, size);
                }
            }

            animId = requestAnimationFrame(draw);
        };

        resize();
        animId = requestAnimationFrame(draw);

        window.addEventListener("resize", resize);
        return () => {
            cancelAnimationFrame(animId);
            window.removeEventListener("resize", resize);
        };
    }, [theme]);

    return (
        <canvas
            ref={canvasRef}
            aria-hidden
            className="pointer-events-none absolute inset-0 z-0 h-full w-full"
        />
    );
}
