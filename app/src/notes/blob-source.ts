import { blobsBaseUrl } from '@/config';

/**
 * Native twin of blob-source.web.ts: no object URLs on Hermes — expo-image
 * loads (and disk-caches) blobs straight from the server URL. Requires
 * EXPO_PUBLIC_BLOBS_URL to be baked into the native build.
 */

export async function acquireBlobUrl(hash: string): Promise<string | null> {
  const base = blobsBaseUrl();
  return base ? `${base}${hash}` : null;
}

export function releaseBlobUrl(_hash: string): void {}
