import * as Y from 'yjs';

import { DEFAULT_CANVAS_ID, createNotesStore } from './store';

import type { CanvasItem } from './types';

const makeItem = (overrides: Partial<CanvasItem> = {}): CanvasItem => ({
  id: 'item-1',
  x: 0,
  y: 0,
  w: 64,
  h: 64,
  z: 1,
  displayHash: 'display-hash',
  displayMime: 'image/webp',
  displayW: 64,
  displayH: 64,
  originalHash: 'original-hash',
  originalMime: 'image/png',
  originalSize: 1234,
  ...overrides,
});

describe('createNotesStore', () => {
  it('seeds the default canvas idempotently', () => {
    const store = createNotesStore(new Y.Doc());
    store.ensureDefaultCanvas();
    store.ensureDefaultCanvas();
    expect(store.listCanvases()).toHaveLength(1);
    expect(store.listCanvases()[0].id).toBe(DEFAULT_CANVAS_ID);
  });

  it('creates canvases and lists them in creation order', () => {
    const store = createNotesStore(new Y.Doc());
    store.ensureDefaultCanvas();
    const a = store.createCanvas('heart', 1000);
    const b = store.createCanvas('cart', 2000);
    // default canvas was seeded with Date.now(), so a (1000) and b (2000) sort first
    const listed = store.listCanvases().map((c) => c.id);
    expect(listed).toEqual([a, b, DEFAULT_CANVAS_ID]);
    expect(store.listCanvases()[0].icon).toBe('heart');
  });

  it('round-trips item add / get / update / delete', () => {
    const store = createNotesStore(new Y.Doc());
    store.ensureDefaultCanvas();
    store.addItem(DEFAULT_CANVAS_ID, makeItem());
    expect(store.getItem(DEFAULT_CANVAS_ID, 'item-1')).toMatchObject({
      x: 0,
      displayHash: 'display-hash',
    });
    store.updateItem(DEFAULT_CANVAS_ID, 'item-1', { x: 96, y: 32 });
    expect(store.getItem(DEFAULT_CANVAS_ID, 'item-1')).toMatchObject({
      x: 96,
      y: 32,
      w: 64,
    });
    store.deleteItem(DEFAULT_CANVAS_ID, 'item-1');
    expect(store.getItem(DEFAULT_CANVAS_ID, 'item-1')).toBeUndefined();
  });

  it('computes nextZ above all existing items', () => {
    const store = createNotesStore(new Y.Doc());
    store.ensureDefaultCanvas();
    expect(store.nextZ(DEFAULT_CANVAS_ID)).toBe(1);
    store.addItem(DEFAULT_CANVAS_ID, makeItem({ id: 'a', z: 5 }));
    store.addItem(DEFAULT_CANVAS_ID, makeItem({ id: 'b', z: 2 }));
    expect(store.nextZ(DEFAULT_CANVAS_ID)).toBe(6);
  });

  it('counts blob references across all canvases', () => {
    const store = createNotesStore(new Y.Doc());
    store.ensureDefaultCanvas();
    const other = store.createCanvas('disc');
    store.addItem(DEFAULT_CANVAS_ID, makeItem({ id: 'a' }));
    store.addItem(other, makeItem({ id: 'b' }));
    store.addItem(
      other,
      makeItem({ id: 'c', displayHash: 'unique', originalHash: 'unique-orig' })
    );
    expect(store.referencesToHash('display-hash')).toBe(2);
    expect(store.referencesToHash('original-hash')).toBe(2);
    expect(store.referencesToHash('unique')).toBe(1);
    expect(store.referencesToHash('nope')).toBe(0);
  });

  describe('undo', () => {
    it('undoes and redoes UI item operations', () => {
      const store = createNotesStore(new Y.Doc());
      store.ensureDefaultCanvas();
      const undo = store.createUndoManager(DEFAULT_CANVAS_ID);
      store.addItem(DEFAULT_CANVAS_ID, makeItem());
      undo.undo();
      expect(store.getItem(DEFAULT_CANVAS_ID, 'item-1')).toBeUndefined();
      undo.redo();
      expect(store.getItem(DEFAULT_CANVAS_ID, 'item-1')).toMatchObject({
        w: 64,
      });
    });

    it('restores a deleted item with all fields on undo', () => {
      const store = createNotesStore(new Y.Doc());
      store.ensureDefaultCanvas();
      const undo = store.createUndoManager(DEFAULT_CANVAS_ID);
      store.addItem(DEFAULT_CANVAS_ID, makeItem({ x: 128 }));
      undo.stopCapturing();
      store.deleteItem(DEFAULT_CANVAS_ID, 'item-1');
      undo.undo();
      expect(store.getItem(DEFAULT_CANVAS_ID, 'item-1')).toMatchObject({
        x: 128,
        originalHash: 'original-hash',
      });
    });

    it('keeps separate undo steps across stopCapturing boundaries', () => {
      const store = createNotesStore(new Y.Doc());
      store.ensureDefaultCanvas();
      const undo = store.createUndoManager(DEFAULT_CANVAS_ID);
      store.addItem(DEFAULT_CANVAS_ID, makeItem());
      undo.stopCapturing();
      store.updateItem(DEFAULT_CANVAS_ID, 'item-1', { x: 96 });
      undo.undo(); // reverts only the move
      expect(store.getItem(DEFAULT_CANVAS_ID, 'item-1')).toMatchObject({
        x: 0,
      });
    });

    it('ignores changes made outside the UI origin', () => {
      const store = createNotesStore(new Y.Doc());
      store.ensureDefaultCanvas();
      const undo = store.createUndoManager(DEFAULT_CANVAS_ID);
      // Simulates a provider/remote write: no UI origin on the transaction.
      store.doc.transact(() => {
        const yItem = new Y.Map<unknown>();
        for (const [key, value] of Object.entries(makeItem()))
          yItem.set(key, value);
        store.itemsMapFor(DEFAULT_CANVAS_ID).set('item-1', yItem);
      });
      expect(undo.canUndo()).toBe(false);
      undo.undo();
      expect(store.getItem(DEFAULT_CANVAS_ID, 'item-1')).toBeDefined();
    });

    it('scopes undo to its own canvas', () => {
      const store = createNotesStore(new Y.Doc());
      store.ensureDefaultCanvas();
      const other = store.createCanvas('brain');
      const undoDefault = store.createUndoManager(DEFAULT_CANVAS_ID);
      store.addItem(other, makeItem());
      expect(undoDefault.canUndo()).toBe(false);
      undoDefault.undo();
      expect(store.getItem(other, 'item-1')).toBeDefined();
    });
  });
});
