/// <reference types="astro/client" />

declare module 'modern-rembg' {
  export function removeBackground(
    imageSource: string,
    options?: {
      model?: string;
      resolution?: number;
    }
  ): Promise<Blob>;
}
