import { useEffect, useState } from 'react';

import { acquireBlobUrl, releaseBlobUrl } from './blob-source';

/**
 * Resolve a blob hash to a renderable image URI (object URL on web, direct
 * server URL on native). Null while loading or when the blob is unavailable
 * (the item renders a placeholder). Acquire/release are balanced across
 * mount, unmount, and late resolution after unmount.
 */
export function useBlobUrl(hash: string): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    let acquired = false;
    void acquireBlobUrl(hash).then((resolved) => {
      if (!live) {
        if (resolved) releaseBlobUrl(hash);
        return;
      }
      acquired = Boolean(resolved);
      setUrl(resolved);
    });
    return () => {
      live = false;
      if (acquired) releaseBlobUrl(hash);
    };
  }, [hash]);
  return url;
}
