import { useEffect } from 'react';

export type CanvasHotkeys = {
  onDelete: () => void;
  onUndo: () => void;
  onRedo: () => void;
};

const isEditable = (target: EventTarget | null): boolean => {
  const el = target as HTMLElement | null;
  return Boolean(
    el &&
    (el.tagName === 'INPUT' ||
      el.tagName === 'TEXTAREA' ||
      el.isContentEditable)
  );
};

/**
 * Canvas keyboard shortcuts (document-level, web only): Delete/Backspace
 * removes the selection; mod+Z / mod+shift+Z undo/redo. Skips events aimed
 * at editable elements (e.g. the event editor's inputs).
 */
export function useCanvasHotkeys(hotkeys: CanvasHotkeys): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditable(e.target)) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        hotkeys.onDelete();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) hotkeys.onRedo();
        else hotkeys.onUndo();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [hotkeys]);
}
