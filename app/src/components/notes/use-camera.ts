/* eslint-disable react-hooks/immutability --
 * The CameraApi methods mutate reanimated shared values (`sv.value = …`) —
 * the library's documented API. They are created once inside useMemo but run
 * ONLY in event context (gesture callbacks, wheel handler), never during
 * render; the rule can't see through the closures.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedReaction,
  useSharedValue,
  withDecay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { clampZoom, projectDecay } from '@/notes/canvas-math';
import {
  loadCamera,
  saveCameraDebounced,
  saveCameraNow,
} from '@/notes/viewport-memory';

import type { Camera, Point } from '@/notes/canvas-math';
import type { SharedValue } from 'react-native-reanimated';

const GLIDE_MS = 140;
const GLIDE_EASING = Easing.out(Easing.cubic);
/** Focused landing: slight underdamp (ζ≈0.9) — carry past, come back. */
const FOCUS_SPRING = { mass: 1, damping: 24, stiffness: 180 };
/** Releases slower than this (px/s) keep plain decay. 0 = every release. */
const FOCUS_MIN_VELOCITY = 0;

export type CameraApi = {
  /** Immediate pan (1:1 during a drag). */
  panBy: (dx: number, dy: number) => void;
  /**
   * Momentum after a pan release (px/s): decays with friction, or — when the
   * resolver turns the projected rest camera into a content-framing one —
   * springs onto that target with the release velocity.
   */
  fling: (
    vx: number,
    vy: number,
    resolveTarget?: (naturalEnd: Camera) => Camera | null
  ) => void;
  /** Direct anchored zoom (trackpad/touch pinch — continuous input). */
  pinchAt: (anchor: Point, scaleChange: number) => void;
  /** Animated anchored zoom by a factor (mouse-wheel ticks compound). */
  glideZoomBy: (anchor: Point, factor: number) => void;
  /** Animated anchored zoom to an absolute value (buttons / reset). */
  glideZoomTo: (anchor: Point, zoom: number) => void;
  /** Cancel pan momentum (before a new drag/pinch takes over). */
  stopPan: () => void;
  /** Cancel every camera animation. */
  stopAll: () => void;
  /** Plain-JS camera for imperative math (paste placement, gesture ÷ zoom). */
  snapshot: () => Camera;
};

/**
 * The canvas camera on reanimated shared values (screen = world·zoom + t).
 * Motion comes from the library: withDecay for fling momentum (retargeted to
 * withSpring when the caller's resolver finds content near the projected
 * landing — see chooseFocusTarget), withTiming for wheel/button zoom glides —
 * all rAF-driven, so they suspend in hidden documents (which is also why they
 * can't run under a headless/backgrounded verification pane; see the
 * feel-pass plan). Cursor anchoring stays EXACT
 * under any easing: a reaction applies the zoom invariant incrementally per
 * frame — t = anchor − (anchor − t)·(z/zPrev) — which is zoomAtPoint's step
 * form. Persistence piggybacks on a reaction into the existing debounced save.
 */
export function useCamera(canvasId: string): {
  tx: SharedValue<number>;
  ty: SharedValue<number>;
  zoom: SharedValue<number>;
  zoomPercent: number;
  api: CameraApi;
} {
  const [initial] = useState<Camera>(
    () => loadCamera(canvasId) ?? { x: 0, y: 0, zoom: 1 }
  );
  const tx = useSharedValue(initial.x);
  const ty = useSharedValue(initial.y);
  const zoom = useSharedValue(initial.zoom);
  const anchorX = useSharedValue(0);
  const anchorY = useSharedValue(0);
  const [zoomPercent, setZoomPercent] = useState(
    Math.round(initial.zoom * 100)
  );

  // Exact anchoring: every zoom change (glide frame or pinch event) shifts the
  // translation so the world point under the anchor stays fixed on screen.
  useAnimatedReaction(
    () => zoom.value,
    (z, prev) => {
      if (prev === null || z === prev) return;
      const r = z / prev;
      tx.value = anchorX.value - (anchorX.value - tx.value) * r;
      ty.value = anchorY.value - (anchorY.value - ty.value) * r;
    }
  );

  // Mirror the rounded percentage for the ZoomControl label.
  useAnimatedReaction(
    () => Math.round(zoom.value * 100),
    (pct, prev) => {
      if (prev !== null && pct !== prev) runOnJS(setZoomPercent)(pct);
    }
  );

  // Persist the viewport whenever the camera moves (debounced in JS).
  useAnimatedReaction(
    () => [tx.value, ty.value, zoom.value] as const,
    (cam, prev) => {
      if (prev !== null)
        runOnJS(saveCameraDebounced)(canvasId, {
          x: cam[0],
          y: cam[1],
          zoom: cam[2],
        });
    }
  );

  const api = useMemo<CameraApi>(() => {
    // Wheel ticks compound into one glide target; reset when the glide lands.
    let glideTarget: number | null = null;
    const clearGlideTarget = () => {
      glideTarget = null;
    };
    const startGlide = (anchor: Point, target: number) => {
      cancelAnimation(tx);
      cancelAnimation(ty);
      anchorX.value = anchor.x;
      anchorY.value = anchor.y;
      glideTarget = clampZoom(target);
      zoom.value = withTiming(
        glideTarget,
        { duration: GLIDE_MS, easing: GLIDE_EASING },
        (finished) => {
          if (finished) runOnJS(clearGlideTarget)();
        }
      );
    };
    return {
      panBy: (dx, dy) => {
        tx.value += dx;
        ty.value += dy;
      },
      fling: (vx, vy, resolveTarget) => {
        const target =
          resolveTarget && Math.hypot(vx, vy) >= FOCUS_MIN_VELOCITY
            ? resolveTarget({
                x: tx.value + projectDecay(vx),
                y: ty.value + projectDecay(vy),
                zoom: zoom.value,
              })
            : null;
        if (target) {
          tx.value = withSpring(target.x, { ...FOCUS_SPRING, velocity: vx });
          ty.value = withSpring(target.y, { ...FOCUS_SPRING, velocity: vy });
        } else {
          tx.value = withDecay({ velocity: vx });
          ty.value = withDecay({ velocity: vy });
        }
      },
      pinchAt: (anchor, scaleChange) => {
        cancelAnimation(tx);
        cancelAnimation(ty);
        cancelAnimation(zoom);
        glideTarget = null;
        anchorX.value = anchor.x;
        anchorY.value = anchor.y;
        zoom.value = clampZoom(zoom.value * scaleChange);
      },
      glideZoomBy: (anchor, factor) => {
        startGlide(anchor, (glideTarget ?? zoom.value) * factor);
      },
      glideZoomTo: (anchor, target) => {
        startGlide(anchor, target);
      },
      stopPan: () => {
        cancelAnimation(tx);
        cancelAnimation(ty);
      },
      stopAll: () => {
        cancelAnimation(tx);
        cancelAnimation(ty);
        cancelAnimation(zoom);
        glideTarget = null;
      },
      snapshot: () => ({ x: tx.value, y: ty.value, zoom: zoom.value }),
    };
    // Shared values are stable per mount; canvasId is fixed via key-remount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Final save on unmount (canvas switch).
  useEffect(
    () => () => {
      saveCameraNow(canvasId, {
        x: tx.value,
        y: ty.value,
        zoom: zoom.value,
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canvasId]
  );

  return { tx, ty, zoom, zoomPercent, api };
}
