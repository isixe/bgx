# BGX

A free, privacy-first background removal tool powered by AI. All processing happens locally in your browser.

## Features

- **AI-Powered Background Removal** - Uses advanced ONNX models (U2Net, ISNet, BRIA RMBG) for high-quality results
- **Privacy Protected** - 100% client-side processing, images never leave your device
- **Multiple AI Models** - Choose from 9+ specialized models for different use cases
- **Multiple Export Formats** - PNG (transparent), JPG (white background), WebP
- **Drag & Drop / Paste Support** - Upload images via drag-drop, file picker, or Ctrl+V paste
- **Batch Processing Ready** - Process multiple images efficiently
- **Bilingual Support** - English and Chinese interface

## Tech Stack

| Category         | Technology              |
| ---------------- | ----------------------- |
| Framework        | Astro 5.0 + React 18    |
| Language         | TypeScript              |
| Styling          | Tailwind CSS            |
| State Management | Zustand                 |
| AI/ML            | ONNX Runtime Web        |
| UI Components    | Radix UI + Lucide Icons |

## Available Models

| Model               | Resolution | Size   | Best For                     |
| ------------------- | ---------- | ------ | ---------------------------- |
| U2Netp              | 320px      | ~4MB   | Lightweight, fast processing |
| U2Net               | 320px      | ~168MB | High-precision general use   |
| U2Net Human Seg     | 320px      | ~168MB | Portrait photos              |
| Silueta             | 320px      | ~42MB  | Lightweight silhouette       |
| ISNet General       | 1024px     | ~170MB | High-res general use         |
| ISNet Anime         | 1024px     | ~168MB | Anime/illustrations          |
| BRIA RMBG           | 1024px     | ~176MB | Professional quality         |
| BRIA RMBG FP16      | 1024px     | ~88MB  | Balanced quality/size        |
| BRIA RMBG Quantized | 1024px     | ~44MB  | Smallest footprint           |

## Installation

### Clone the Repository

```bash
git clone https://github.com/yourusername/bgx.git
cd bgx
```

### Install Dependencies

```bash
pnpm install
```

### Start Development Server

```bash
pnpm dev
```

The application will be available at `http://localhost:4321`.

## Build for Production

```bash
pnpm build
```

The production build will be output to `./dist/`.

## Project Structure

```
bgx/
├── public/                  # Static assets
│   └── favicon.ico
├── src/
│   ├── components/          # React components
│   │   ├── features/        # Feature components
│   │   │   ├── ExportPanel.tsx
│   │   │   ├── ImagePreview.tsx
│   │   │   ├── ImageUploader.tsx
│   │   │   ├── ModelSelector.tsx
│   │   │   └── ModelsPage.tsx
│   │   ├── layout/          # Layout components
│   │   └── ui/              # UI components
│   ├── config/              # Model configurations
│   │   └── models.ts
│   ├── hooks/               # Custom React hooks
│   │   ├── useLanguage.ts
│   │   └── useRemoveBackground.ts
│   ├── layouts/             # Astro layouts
│   │   └── Layout.astro
│   ├── lib/                 # Utility libraries
│   │   ├── i18n/            # Internationalization
│   │   │   ├── en.ts
│   │   │   ├── zh.ts
│   │   │   └── index.ts
│   │   └── utils.ts
│   ├── pages/               # Astro routes
│   │   └── index.astro
│   ├── providers/           # App providers
│   ├── stores/              # Zustand state management
│   ├── styles/              # Global styles
│   ├── types/               # TypeScript declarations
│   └── utils/               # Helper functions
├── astro.config.mjs         # Astro configuration
├── tailwind.config.mjs      # Tailwind CSS config
├── tsconfig.json            # TypeScript config
└── package.json             # Dependencies
```

## Supported Image Formats

- JPG/JPEG
- PNG
- WebP

**Maximum file size:** 30MB

## Commands

| Command          | Action                               |
| ---------------- | ------------------------------------ |
| `pnpm dev`       | Start dev server at `localhost:4321` |
| `pnpm build`     | Build production site to `./dist/`   |
| `pnpm preview`   | Preview production build             |
| `pnpm astro ...` | Run Astro CLI commands               |

## Desktop App (Electron)

BGX also ships as a cross-platform desktop app. The Electron shell serves the static build through a privileged `app://` protocol with `COOP`/`COEP` headers, so WebAssembly threading (`SharedArrayBuffer`) and all background-removal features work fully offline.

| Command             | Action                                              |
| ------------------- | --------------------------------------------------- |
| `pnpm dev:electron` | Run Astro dev server and open the Electron window   |
| `pnpm start`        | Launch Electron against an existing `./dist/` build |
| `pnpm build:win`    | Build the site and package Windows installers       |

Packaging output goes to `./release/` (never `./dist/`, which belongs to Astro):

- `BGX-<version>-win-x64.exe` - NSIS installer (selectable install directory, desktop shortcut)
- `BGX-<version>-portable.exe` - portable executable (no installation required)
- `win-unpacked/` - unpacked app for direct execution

Other platforms can be packaged by replacing `--win` with `--mac` or `--linux`.

## License

This project is licensed under the [MIT](LICENSE) License.
