/**
 * Generates a sortable, collision-resistant id for notes and attachments.
 * Timestamp prefix keeps ids roughly chronological; random suffix avoids
 * collisions across devices that create notes while offline.
 */
export function createNoteId(now: number = Date.now()): string {
  const time = now.toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `${time}-${rand}`;
}
