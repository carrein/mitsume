export type CanvasHotkeys = {
  onDelete: () => void;
  onUndo: () => void;
  onRedo: () => void;
};

/** Native twin of use-hotkeys.web.ts: no hardware keyboard shortcuts in V1. */
export function useCanvasHotkeys(_hotkeys: CanvasHotkeys): void {}
