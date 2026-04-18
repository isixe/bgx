# PROJECT KNOWLEDGE BASE

**Generated:** 2026-04-18
**Branch:** main

## OVERVIEW
Astro + React background removal web app using ONNX runtime-web (U2Net/U2Netp/ISNet Anime models). Client-side inference only.

## STRUCTURE
```
bgx/
├── src/
│   ├── components/    # React UI (features/, layout/, ui/)
│   ├── config/        # Model configurations
│   ├── hooks/         # Custom React hooks
│   ├── lib/           # i18n (en.ts, zh.ts)
│   ├── layouts/       # Astro layouts
│   ├── pages/         # Astro routes (index.astro)
│   ├── providers/    # App providers
│   ├── stores/       # Zustand state (appStore.ts)
│   ├── types/        # TypeScript declarations
│   └── utils/        # Utility functions
├── public/models/    # ONNX model files (*.onnx)
├── astro.config.mjs  # Astro + React + Tailwind config
└── package.json      # Dependencies (uses pnpm)
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Image processing | `src/hooks/useRemoveBackground.ts` | Core removal hook using modern-rembg |
| Model selection | `src/config/models.ts` | Model configs (u2netp, u2net, isnet-anime) |
| State management | `src/stores/appStore.ts` | Zustand store for app state |
| UI components | `src/components/features/*.tsx` | React components (ImageUploader, ExportPanel, etc.) |
| i18n | `src/lib/i18n/` | Language files (en.ts, zh.ts) |
| Language switch | `src/components/ui/LanguageSwitcher.tsx` | Language toggle UI |

## CONVENTIONS
- React components use `.tsx`, Astro pages use `.astro`
- Zustand store with TypeScript interfaces in `appStore.ts`
- Path aliases configured: `@/*` → `src/*`
- Tailwind for styling, inline template literals (no `clsx`)
- Uses pnpm (not npm) - pnpm-lock.yaml present

## ANTI-PATTERNS (THIS PROJECT)
- No CI/CD workflows (no `.github/workflows`)
- No ESLint/Prettier config - uses Astro defaults
- No tests configured (no vitest/jest)
- No TypeScript strict mode overrides
- Model config at `src/config/` instead of `src/lib/` (deviation)
- Hooks at `src/hooks/` instead of `src/lib/` (deviation)
- Duplicate AppProvider: both `src/providers/AppProvider.tsx` and `src/components/layout/AppProvider.tsx`

## COMMANDS
```bash
pnpm dev      # Start dev server at localhost:4321
pnpm build    # Build to ./dist/
pnpm preview  # Preview production build
```

## NOTES
- Uses COOP/COEP headers for SharedArrayBuffer support (required for ONNX WASM threading)
- Vite optimizeDeps excludes `onnxruntime-web` - loaded at runtime
- Supports image paste (Ctrl+V), drag-drop, file picker
- Only one route (`/`) - SPA behavior via React components
- Two AppProvider components exist - verify which is active