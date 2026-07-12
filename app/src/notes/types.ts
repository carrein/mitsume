/** Plain-JSON shapes of the Yjs notes doc (what toJSON() yields). */

export type CanvasMeta = {
  id: string;
  /** Basil icon name shown in the CanvasBar (see constants/icon-paths). */
  icon: string;
  createdAt: number;
};

/**
 * One image placed on a canvas. x/y/w/h are world coordinates (grid-snapped);
 * z stacks newest-on-top. Bytes live in the blob store keyed by SHA-256 —
 * the doc only ever references hashes (originals are kept server-side for
 * future view/export; the canvas renders the display rendition).
 */
export type CanvasItem = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  displayHash: string;
  /** Mime of the display rendition (its bytes may be re-encoded WebP). */
  displayMime: string;
  /** Natural pixel size of the display rendition. */
  displayW: number;
  displayH: number;
  originalHash: string;
  originalMime: string;
  originalSize: number;
};

/** toJSON() of a canvas's items map: itemId → item. */
export type CanvasItems = Record<string, CanvasItem>;

/** The blob-derived fields of a CanvasItem (position/z added by the caller). */
export type IngestedImage = Pick<
  CanvasItem,
  | 'displayHash'
  | 'displayMime'
  | 'displayW'
  | 'displayH'
  | 'originalHash'
  | 'originalMime'
  | 'originalSize'
>;
