import type { Camera } from './canvas-math';

/**
 * Per-canvas viewport (pan+zoom) and last-active canvas id, in localStorage.
 * Device-local state on purpose — it would be noise in the synced doc.
 * Native has no localStorage; everything degrades to no-ops there (V1).
 */

const cameraKey = (canvasId: string) => `mitsume-notes:viewport:${canvasId}`;
const ACTIVE_KEY = 'mitsume-notes:active-canvas';
const SAVE_DEBOUNCE_MS = 300;

const storage = (): Storage | null =>
  typeof localStorage === 'undefined' ? null : localStorage;

export function loadCamera(canvasId: string): Camera | null {
  try {
    const raw = storage()?.getItem(cameraKey(canvasId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Camera>;
    if (
      typeof parsed.x === 'number' &&
      typeof parsed.y === 'number' &&
      typeof parsed.zoom === 'number'
    )
      return { x: parsed.x, y: parsed.y, zoom: parsed.zoom };
  } catch {
    // corrupt entry — fall through to default viewport
  }
  return null;
}

export function saveCameraNow(canvasId: string, camera: Camera): void {
  try {
    storage()?.setItem(cameraKey(canvasId), JSON.stringify(camera));
  } catch {
    // quota/private mode — viewport memory is best-effort
  }
}

const timers = new Map<string, ReturnType<typeof setTimeout>>();

export function saveCameraDebounced(canvasId: string, camera: Camera): void {
  const pending = timers.get(canvasId);
  if (pending) clearTimeout(pending);
  timers.set(
    canvasId,
    setTimeout(() => {
      timers.delete(canvasId);
      saveCameraNow(canvasId, camera);
    }, SAVE_DEBOUNCE_MS)
  );
}

export function loadActiveCanvas(): string | null {
  return storage()?.getItem(ACTIVE_KEY) ?? null;
}

export function saveActiveCanvas(canvasId: string): void {
  try {
    storage()?.setItem(ACTIVE_KEY, canvasId);
  } catch {
    // best-effort
  }
}
