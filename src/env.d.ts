/// <reference types="astro/client" />

declare module 'modern-rembg' {
  export function removeBackground(
    imageSource: string,
    options?: {
      model?: string;
      resolution?: number;
    },
  ): Promise<Blob>;
}

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
