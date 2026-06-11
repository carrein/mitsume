import { createNoteId } from './note-id';

describe('createNoteId', () => {
  it('generates unique ids', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => createNoteId()));
    expect(ids.size).toBe(1000);
  });

  it('sorts chronologically by timestamp prefix', () => {
    const earlier = createNoteId(1000000000000);
    const later = createNoteId(2000000000000);
    expect(earlier < later).toBe(true);
  });
});
