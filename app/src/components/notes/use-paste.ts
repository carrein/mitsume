import type { IngestedImage } from '@/notes/types';

/** Native twin of use-paste.web.ts: clipboard image paste is web-only in V1. */
export function usePasteImages(
  _onIngested: (image: IngestedImage, index: number) => void
): void {}
