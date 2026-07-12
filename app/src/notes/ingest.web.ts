import { DISPLAY_WEBP_QUALITY, renditionPlan } from './ingest-plan';
import { putBlob } from './blob-cache';
import { drainUploads } from './uploader';

import type { IngestedImage } from './types';

async function sha256Hex(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    await blob.arrayBuffer()
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Paste pipeline: hash + store the untouched original, derive a display
 * rendition (downscaled WebP unless the original is already small — see
 * ingest-plan), store both locally as pending-upload, kick the uploader.
 */
export async function ingestImage(file: Blob): Promise<IngestedImage> {
  const originalMime = file.type || 'application/octet-stream';
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;

  let display = file;
  let displayW = width;
  let displayH = height;
  const plan = renditionPlan(width, height, originalMime, file.size);
  if (plan.reencode) {
    const canvas = new OffscreenCanvas(plan.w, plan.h);
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(bitmap, 0, 0, plan.w, plan.h);
      // Safari may answer with PNG instead of WebP — trust the result's type.
      display = await canvas.convertToBlob({
        type: 'image/webp',
        quality: DISPLAY_WEBP_QUALITY,
      });
      displayW = plan.w;
      displayH = plan.h;
    }
  }
  bitmap.close();

  const originalHash = await sha256Hex(file);
  const displayHash =
    display === file ? originalHash : await sha256Hex(display);

  await putBlob(originalHash, file, false);
  if (displayHash !== originalHash) await putBlob(displayHash, display, false);
  void drainUploads();

  return {
    displayHash,
    displayMime: display.type || originalMime,
    displayW,
    displayH,
    originalHash,
    originalMime,
    originalSize: file.size,
  };
}
