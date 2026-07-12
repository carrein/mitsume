/**
 * Pure sizing decision for the display rendition of a pasted image.
 * The canvas renders a downscaled WebP copy; the untouched original is
 * stored alongside it for future view/export (user decision).
 */

export const DISPLAY_MAX_EDGE = 2048;
/** Small originals pass through untouched — re-encoding buys nothing. */
export const DISPLAY_MAX_BYTES = 512 * 1024;
export const DISPLAY_WEBP_QUALITY = 0.8;

export type RenditionPlan =
  | { reencode: false }
  | { reencode: true; w: number; h: number };

export function renditionPlan(
  naturalW: number,
  naturalH: number,
  mime: string,
  bytes: number
): RenditionPlan {
  // Re-encoding a GIF would flatten its animation; pass through untouched.
  if (mime === 'image/gif') return { reencode: false };
  const longEdge = Math.max(naturalW, naturalH);
  if (longEdge <= DISPLAY_MAX_EDGE && bytes <= DISPLAY_MAX_BYTES)
    return { reencode: false };
  const scale = Math.min(1, DISPLAY_MAX_EDGE / longEdge);
  return {
    reencode: true,
    w: Math.max(1, Math.round(naturalW * scale)),
    h: Math.max(1, Math.round(naturalH * scale)),
  };
}
