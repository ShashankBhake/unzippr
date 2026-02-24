import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
    title: "unzippr — Peek Inside ZIP Files Online",
    description:
        "Explore ZIP file contents instantly in your browser. No download required. Supports direct URLs with streaming.",
    keywords: [
        "zip",
        "unzip",
        "file explorer",
        "online",
        "browser",
        "streaming",
    ],
    icons: {
        icon: "/favicon.jpeg",
    },
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className="min-h-screen antialiased">
                <ThemeProvider>{children}</ThemeProvider>
            </body>
        </html>
    );
}
