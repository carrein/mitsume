/**
 * Wide-layout pane split: the calendar pane snaps to one of three preset
 * fractions of the screen; notes takes the rest. Persisted in localStorage —
 * device-local by design, and native has no localStorage so it degrades to
 * the default there (wide layout is rare on phones anyway).
 */

export type SplitRatio = '1/2' | '2/5' | '1/3';

export const DEFAULT_SPLIT: SplitRatio = '1/3';

/** Calendar-pane fraction of the screen for each preset. */
export const SPLIT_FRACTIONS: Record<SplitRatio, number> = {
  '1/2': 1 / 2,
  '2/5': 2 / 5,
  '1/3': 1 / 3,
};

/** Integer flex pairs realizing each fraction (hit strip adds no net width,
 * so these stay exact — and dodge RN Web percentage-width quirks). */
export const PANE_FLEX: Record<
  SplitRatio,
  { notes: number; calendar: number }
> = {
  '1/2': { notes: 1, calendar: 1 },
  '2/5': { notes: 3, calendar: 2 },
  '1/3': { notes: 2, calendar: 1 },
};

/** Nearest preset to a dragged calendar fraction (nearest-neighbor also
 * clamps out-of-range values to the closest edge preset). */
export function snapCalendarFraction(fraction: number): SplitRatio {
  if (!Number.isFinite(fraction)) return DEFAULT_SPLIT;
  let best: SplitRatio = DEFAULT_SPLIT;
  let bestDistance = Infinity;
  for (const ratio of Object.keys(SPLIT_FRACTIONS) as SplitRatio[]) {
    const distance = Math.abs(fraction - SPLIT_FRACTIONS[ratio]);
    if (distance < bestDistance) {
      best = ratio;
      bestDistance = distance;
    }
  }
  return best;
}

export function parseSplitRatio(raw: string | null): SplitRatio | null {
  return raw !== null && raw in SPLIT_FRACTIONS ? (raw as SplitRatio) : null;
}

const KEY = 'mitsume-home:split-ratio';

const storage = (): Storage | null =>
  typeof localStorage === 'undefined' ? null : localStorage;

export function loadSplitRatio(): SplitRatio {
  try {
    return parseSplitRatio(storage()?.getItem(KEY) ?? null) ?? DEFAULT_SPLIT;
  } catch {
    return DEFAULT_SPLIT;
  }
}

export function saveSplitRatio(ratio: SplitRatio): void {
  try {
    storage()?.setItem(KEY, ratio);
  } catch {
    // quota/private mode — split memory is best-effort
  }
}
