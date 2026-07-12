import { IndexeddbPersistence } from 'y-indexeddb';
import type * as Y from 'yjs';

/**
 * Local-first cache of the notes doc. Resolves once previously stored updates
 * have been loaded — render after this to avoid flashing an empty canvas
 * (and to keep the default-canvas seed from racing the loaded state).
 */
export function attachLocalPersistence(doc: Y.Doc): Promise<void> {
  const provider = new IndexeddbPersistence('mitsume-notes', doc);
  return provider.whenSynced.then(() => undefined);
}
