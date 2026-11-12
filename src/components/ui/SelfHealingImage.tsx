import type { ImgHTMLAttributes, ReactNode } from 'react';
import { useImageSrc } from '../../hooks/useImageSrc';

interface SelfHealingImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  fallback?: ReactNode;
}

export function SelfHealingImage({ src, onError, fallback, ...rest }: SelfHealingImageProps) {
  const healed = useImageSrc(src);

  if (healed.failed && fallback) {
    return <>{fallback}</>;
  }

  return (
    <img
      {...rest}
      src={healed.src}
      onError={(event) => {
        onError?.(event);
        healed.onError();
      }}
    />
  );
}
