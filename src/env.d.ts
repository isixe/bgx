/// <reference types="astro/client" />

interface Window {
  bgx?: {
    saveImages: (
      files: { filename: string; bytes: Uint8Array }[],
      title?: string,
    ) => Promise<{ canceled: boolean; saved: number; error?: string }>;
    saveFile: (
      file: { filename: string; bytes: Uint8Array },
      title?: string,
    ) => Promise<{ canceled: boolean; saved: boolean; error?: string }>;
  };
}
