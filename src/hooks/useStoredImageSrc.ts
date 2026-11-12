import { useEffect, useRef, useState } from 'react';
import { releaseImageUrl, renewImageUrl } from '../utils/imageStore';

export interface StoredImageSrc {
  src: string | null;
  failed: boolean;
}

// 把逻辑 key（可能已经被撤销的 blob: URL 字符串）换成当前可用的 URL：
// key 变化或组件卸载时立刻撤销，字节继续留在 IndexedDB 里，内存只留正在显示的那两张。
export function useStoredImageSrc(key: string | null | undefined): StoredImageSrc {
  const [resolved, setResolved] = useState<{ key: string; url: string } | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const heldRef = useRef<{ key: string; url: string } | null>(null);

  useEffect(() => {
    if (!key) {
      return;
    }

    let active = true;

    void renewImageUrl(key).then((url) => {
      if (!active) {
        if (url) {
          releaseImageUrl(url);
        }
        return;
      }
      if (!url) {
        setFailedKey(key);
        return;
      }
      heldRef.current = { key, url };
      setResolved({ key, url });
    });

    return () => {
      active = false;
      if (heldRef.current) {
        releaseImageUrl(heldRef.current.url);
        heldRef.current = null;
      }
    };
  }, [key]);

  const src = resolved && resolved.key === key ? resolved.url : null;

  return { src, failed: !src && failedKey === key };
}
