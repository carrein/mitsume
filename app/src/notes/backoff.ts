/** Pure retry math for the blob uploader (see uploader.web.ts). */

export const BACKOFF_BASE_MS = 5_000;
export const BACKOFF_MAX_MS = 10 * 60_000;

/** Exponential backoff with jitter: [0.5, 1.0] × capped exponential. */
export function backoffDelayMs(
  attempt: number,
  random: () => number = Math.random
): number {
  const exp = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** attempt);
  return Math.round(exp * (0.5 + random() * 0.5));
}
