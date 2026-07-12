import * as Y from 'yjs';

import { createNoteId } from '@/utils/note-id';

import type { CanvasItem, CanvasMeta } from './types';

/**
 * Transaction origin for user-initiated item edits. UndoManagers track ONLY
 * this origin, so provider-applied updates and setup writes (canvas creation)
 * are never undoable. Matched by reference — always import this constant.
 */
export const UI_ORIGIN = Symbol('mitsume-ui');

export const DEFAULT_CANVAS_ID = 'default';
export const DEFAULT_CANVAS_ICON = 'book';

type YCanvas = Y.Map<unknown>;
type YItem = Y.Map<unknown>;

/**
 * All access to the notes doc. Canvases live in a root map keyed by id; each
 * canvas is a Y.Map { icon, createdAt, items: Y.Map<itemId, Y.Map> }. Items
 * are nested maps so a move rewrites only x/y (small updates, precise undo).
 */
export function createNotesStore(doc: Y.Doc) {
  const canvases = doc.getMap<YCanvas>('canvases');

  const transactUI = (fn: () => void) => doc.transact(fn, UI_ORIGIN);

  const canvasFor = (canvasId: string): YCanvas => {
    const canvas = canvases.get(canvasId);
    if (!canvas) throw new Error(`unknown canvas: ${canvasId}`);
    return canvas;
  };

  const itemsMapFor = (canvasId: string): Y.Map<YItem> =>
    canvasFor(canvasId).get('items') as Y.Map<YItem>;

  const putCanvas = (id: string, icon: string, createdAt: number) => {
    const canvas = new Y.Map<unknown>();
    canvas.set('icon', icon);
    canvas.set('createdAt', createdAt);
    canvas.set('items', new Y.Map<YItem>());
    canvases.set(id, canvas);
  };

  /**
   * Seeds the default canvas under a FIXED key, outside the undo origin.
   * Fixed key means concurrent first-boots converge on one canvas instead of
   * duplicating (Y.Map same-key sets merge; sequence types would not).
   */
  const ensureDefaultCanvas = () => {
    if (canvases.has(DEFAULT_CANVAS_ID)) return;
    doc.transact(() =>
      putCanvas(DEFAULT_CANVAS_ID, DEFAULT_CANVAS_ICON, Date.now())
    );
  };

  /** Creates a canvas and returns its id. Not undoable by design. */
  const createCanvas = (icon: string, now: number = Date.now()): string => {
    const id = createNoteId(now);
    doc.transact(() => putCanvas(id, icon, now));
    return id;
  };

  const listCanvases = (): CanvasMeta[] =>
    Array.from(canvases.entries())
      .map(([id, canvas]) => ({
        id,
        icon: canvas.get('icon') as string,
        createdAt: canvas.get('createdAt') as number,
      }))
      .sort((a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : 1));

  const getItem = (canvasId: string, itemId: string): CanvasItem | undefined =>
    (itemsMapFor(canvasId).get(itemId)?.toJSON() as CanvasItem) ?? undefined;

  const addItem = (canvasId: string, item: CanvasItem) =>
    transactUI(() => {
      const yItem = new Y.Map<unknown>();
      for (const [key, value] of Object.entries(item)) yItem.set(key, value);
      itemsMapFor(canvasId).set(item.id, yItem);
    });

  const updateItem = (
    canvasId: string,
    itemId: string,
    patch: Partial<CanvasItem>
  ) =>
    transactUI(() => {
      const yItem = itemsMapFor(canvasId).get(itemId);
      if (!yItem) return;
      for (const [key, value] of Object.entries(patch))
        if (value !== undefined) yItem.set(key, value);
    });

  const deleteItem = (canvasId: string, itemId: string) =>
    transactUI(() => itemsMapFor(canvasId).delete(itemId));

  /** Stacking value for a newly added item: above everything present. */
  const nextZ = (canvasId: string): number => {
    let max = 0;
    for (const yItem of itemsMapFor(canvasId).values())
      max = Math.max(max, (yItem.get('z') as number) ?? 0);
    return max + 1;
  };

  /**
   * How many items (across ALL canvases) reference a blob hash. Blob bytes
   * may only be deleted when this drops to zero.
   */
  const referencesToHash = (hash: string): number => {
    let count = 0;
    for (const canvas of canvases.values()) {
      const items = canvas.get('items') as Y.Map<YItem>;
      for (const yItem of items.values())
        if (
          yItem.get('displayHash') === hash ||
          yItem.get('originalHash') === hash
        )
          count += 1;
    }
    return count;
  };

  /**
   * Undo/redo scoped to one canvas's items; recreate on canvas switch. Call
   * stopCapturing() at each gesture start so quick successive ops stay
   * separate undo steps (default captureTimeout merges within 500ms).
   */
  const createUndoManager = (canvasId: string): Y.UndoManager =>
    new Y.UndoManager(itemsMapFor(canvasId), {
      trackedOrigins: new Set([UI_ORIGIN]),
    });

  return {
    doc,
    canvases,
    transactUI,
    ensureDefaultCanvas,
    createCanvas,
    listCanvases,
    itemsMapFor,
    getItem,
    addItem,
    updateItem,
    deleteItem,
    nextZ,
    referencesToHash,
    createUndoManager,
  };
}

export type NotesStore = ReturnType<typeof createNotesStore>;
