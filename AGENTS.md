# PROJECT KNOWLEDGE BASE

**Generated:** 2026-04-17
**Branch:** main

## OVERVIEW
Astro + React background removal web app using ONNX runtime-web (U2Net/U2Netp/ISNet Anime models). Client-side inference only.

## STRUCTURE
```
bgx/
├── src/
│   ├── components/    # React UI components
│   ├── lib/          # ONNX integration, models config
│   ├── pages/        # Astro routes (index.astro)
│   ├── stores/      # Zustand state (appStore.ts)
│   └── layouts/     # Astro layouts
├── public/models/   # ONNX model files (*.onnx)
├── astro.config.mjs  # Astro + React + Tailwind config
└── package.json     # Dependencies
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Image processing | `src/lib/useRemoveBackground.ts` | Core removal hook using modern-rembg |
| Model selection | `src/lib/models.ts` | Model configs (u2netp, u2net, isnet-anime) |
| State management | `src/stores/appStore.ts` | Zustand store for app state |
| UI components | `src/components/*.tsx` | React components (ImageUploader, ExportPanel, etc.) |

## CONVENTIONS
- React components use `.tsx`, Astro pages use `.astro`
- Zustand store with TypeScript interfaces in `appStore.ts`
- Path aliases configured: `@/*` → `src/*`
- Tailwind for styling, `clsx` not used (inline template literals)

## ANTI-PATTERNS (THIS PROJECT)
- No CI/CD workflows (no `.github/workflows`)
- No ESLint/Prettier config - uses Astro defaults
- No tests configured
- No TypeScript strict mode overrides

## COMMANDS
```bash
npm run dev      # Start dev server at localhost:4321
npm run build   # Build to ./dist/
npm run preview # Preview production build
```

## NOTES
- Uses COOP/COEP headers for SharedArrayBuffer support (required for ONNX WASM threading)
- Vite optimizeDeps excludes `onnxruntime-web` - loaded at runtime
- Supports image paste (Ctrl+V), drag-drop, file picker
- Only one route (`/`) - SPA behavior via React components