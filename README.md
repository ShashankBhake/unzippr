# unzippr

A minimal, stylish web app that lets you explore ZIP file contents without downloading them. Supports direct file upload and URL input with streaming download progress.

## Limits

| Input Method        | Max Size |
| ------------------- | -------- |
| File Upload         | 200 MB   |
| URL                 | 500 MB   |
| Single File Preview | 25 MB    |

Nah, I'm kidding with these limits. Try me :)

## Features

- 📁 **Drag & Drop** or file picker to open local ZIP files
- 🔗 **URL Input** — paste a direct download link to explore remote ZIPs
- 🌲 **File Tree** — collapsible, nested tree view with file type icons
- 👁️ **Preview Panel** — inline previews for images, code, text, video, audio, and PDFs
- 🎨 **Syntax Highlighting** — code files rendered with proper language highlighting
- 📊 **Stats Bar** — file count, total size, compression ratio at a glance
- 🔍 **Search** — quickly find files within the archive
- 💾 **Download Individual Files** — extract and download single files
- 🔗 **Shareable Links** — `?url=...` query parameter support
- 🌗 **Dark/Light Mode** — auto-detects system preference with manual toggle
- 🔒 **100% Client-Side** — nothing is uploaded to any server
- ⚡ **Fast** — powered by fflate for blazing-fast ZIP parsing

## Tech Stack

- **Next.js 14** (App Router)
- **Tailwind CSS** (with custom design system)
- **TypeScript**
- **fflate** (ZIP parsing)
- **lucide-react** (icons)
- **react-syntax-highlighter** (code preview)

## Getting Started

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build
npm start
```

Open [http://localhost:3000](http://localhost:3000) to use the app.

## Deployment

Deploy to Vercel in one click — no backend needed since everything runs client-side.

## License

MIT
