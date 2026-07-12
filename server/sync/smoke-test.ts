/**
 * Smoke test for mitsume-sync: connect two independent clients to the same
 * doc name over websocket, write from A, read from B, then exit 0/1.
 *
 * Start the server first (Node, not bun — see index.ts header):
 *   SQLITE_PATH=/tmp/smoke.sqlite node index.ts
 * Then: bun run smoke-test.ts [expect-existing]
 *   expect-existing: also assert the value is already present on connect
 *   (used after a server restart to prove SQLite persistence).
 */
import { HocuspocusProvider } from '@hocuspocus/provider';
import * as Y from 'yjs';

const URL = process.env.SYNC_URL ?? 'ws://127.0.0.1:1234';
const DOC = 'smoke-doc';
const expectExisting = process.argv[2] === 'expect-existing';

const connect = (doc: Y.Doc) =>
  new Promise<HocuspocusProvider>((resolve, reject) => {
    const provider = new HocuspocusProvider({
      url: URL,
      name: DOC,
      document: doc,
      onSynced: () => resolve(provider),
    });
    setTimeout(() => reject(new Error('sync timeout')), 5000);
  });

const docA = new Y.Doc();
const providerA = await connect(docA);

if (expectExisting) {
  const existing = docA.getMap('smoke').get('key');
  if (existing !== 'value-from-a') {
    console.error(`FAIL: expected persisted value after restart, got ${existing}`);
    process.exit(1);
  }
  console.log('PASS: value survived server restart (SQLite persistence)');
} else {
  docA.getMap('smoke').set('key', 'value-from-a');
  // give the update a moment to reach the server
  await new Promise((r) => setTimeout(r, 300));
}

const docB = new Y.Doc();
const providerB = await connect(docB);
const value = docB.getMap('smoke').get('key');

providerA.destroy();
providerB.destroy();

if (value === 'value-from-a') {
  console.log('PASS: second client received the value via server sync');
  process.exit(0);
}
console.error(`FAIL: second client saw ${value}`);
process.exit(1);
