import type * as Y from 'yjs';

/**
 * Native fallback: no IndexedDB exists on Hermes, so the doc stays in memory
 * and the sync server is the only persistence (web override: persistence.web.ts).
 */
export function attachLocalPersistence(_doc: Y.Doc): Promise<void> {
  return Promise.resolve();
}
