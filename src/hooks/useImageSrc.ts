import { useCallback, useRef, useState } from 'react';
import { renewImageUrl } from '../utils/imageStore';

export interface UseImageSrcResult {
  src: string;
  failed: boolean;
  onError: () => void;
}

export function useImageSrc(src: string): UseImageSrcResult {
  const [healed, setHealed] = useState<{ forSrc: string; url: string } | null>(null);
  const [failedFor, setFailedFor] = useState<string | null>(null);
  const attemptedRef = useRef<string | null>(null);

  const onError = useCallback(() => {
    if (attemptedRef.current === src) {
      setFailedFor(src);
      return;
    }
    attemptedRef.current = src;

    void renewImageUrl(src).then((url) => {
      if (url) {
        setHealed({ forSrc: src, url });
        return;
      }
      setFailedFor(src);
    });
  }, [src]);

  return {
    src: healed?.forSrc === src ? healed.url : src,
    failed: failedFor === src,
    onError,
  };
}
