import type { ImgHTMLAttributes } from 'react';
import { useImageSrc } from '../../hooks/useImageSrc';

interface SelfHealingImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  src: string;
}

export function SelfHealingImage({ src, onError, ...rest }: SelfHealingImageProps) {
  const healed = useImageSrc(src);

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
