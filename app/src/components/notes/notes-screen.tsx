import { useEffect, useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { requestDurableStorage } from '@/notes/blob-cache';
import { openNotes } from '@/notes/doc';
import { DEFAULT_CANVAS_ID } from '@/notes/store';
import { startUploader } from '@/notes/uploader';
import { useYSnapshot } from '@/notes/use-y-snapshot';
import { loadActiveCanvas, saveActiveCanvas } from '@/notes/viewport-memory';

import { CanvasBar } from './canvas-bar';
import { CanvasView } from './canvas-view';
import { IconPicker } from './icon-picker';

import type { CanvasIconName } from '@/constants/icon-paths';
import type { NotesHandle } from '@/notes/doc';

/**
 * The notes pane: opens the doc (local cache + sync), seeds the default
 * canvas, then renders the CanvasBar + the active canvas. Rendering is gated
 * on the local cache load so the first paint never flashes an empty canvas.
 */
export function NotesScreen() {
  const [handle, setHandle] = useState<NotesHandle | null>(null);
  useEffect(() => {
    let live = true;
    const h = openNotes();
    const syncedOrTimeout = Promise.race([
      h.synced,
      // Offline fallback: don't block first paint forever on an unreachable
      // server — after the grace period, seed locally and merge later.
      new Promise((resolve) => setTimeout(resolve, 4000)),
    ]);
    void Promise.all([h.ready, syncedOrTimeout]).then(() => {
      if (!live) return;
      // Only AFTER the server had its chance to deliver existing state —
      // seeding earlier would rival the server's 'default' canvas (see doc.ts).
      h.store.ensureDefaultCanvas();
      requestDurableStorage();
      startUploader();
      setHandle(h);
    });
    return () => {
      live = false;
    };
  }, []);

  if (!handle) {
    return (
      <ThemedView style={styles.loading}>
        <ThemedText type="small" themeColor="textSecondary">
          Loading notes…
        </ThemedText>
      </ThemedView>
    );
  }
  return <NotesReady handle={handle} />;
}

function NotesReady({ handle }: { handle: NotesHandle }) {
  // Snapshot subscribes this component to canvas additions (from the picker
  // or a remote peer); the store keeps the single sorting rule.
  const snapshot = useYSnapshot<unknown>(handle.store.canvases);
  const canvases = useMemo(
    () => handle.store.listCanvases(),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- snapshot IS the store's change signal
    [handle.store, snapshot]
  );

  const [activeId, setActiveId] = useState(() => {
    const saved = loadActiveCanvas();
    return saved && handle.store.canvases.has(saved)
      ? saved
      : DEFAULT_CANVAS_ID;
  });
  const [pickerOpen, setPickerOpen] = useState(false);

  const selectCanvas = (id: string) => {
    setActiveId(id);
    saveActiveCanvas(id);
  };
  const addCanvas = (icon: CanvasIconName) => {
    setPickerOpen(false);
    selectCanvas(handle.store.createCanvas(icon));
  };

  return (
    <ThemedView style={styles.root}>
      <CanvasBar
        canvases={canvases}
        activeId={activeId}
        onSelect={selectCanvas}
        onAdd={() => setPickerOpen(true)}
      />
      <CanvasView key={activeId} canvasId={activeId} store={handle.store} />
      <IconPicker
        visible={pickerOpen}
        onPick={addCanvas}
        onClose={() => setPickerOpen(false)}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
});
