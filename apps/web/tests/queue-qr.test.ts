import { describe, expect, it } from 'vitest';
import { UniqueQueue } from '../docs/src/lib/queue';
import { parseQr } from '../docs/src/lib/qr';
describe('narration queue', () => {
  it('deduplicates and preserves FIFO ordering', () => { const q = new UniqueQueue<{ id: number }>(); expect(q.add({ id: 1 })).toBe(true); expect(q.add({ id: 1 })).toBe(false); q.add({ id: 2 }); expect(q.shift()?.id).toBe(1); expect(q.shift()?.id).toBe(2); expect(q.shift()).toBeUndefined(); });
  it('clears all pending items', () => { const q = new UniqueQueue<{ id: number }>(); q.add({ id: 1 }); q.clear(); expect(q.size).toBe(0); });
});
describe('QR parser', () => {
  it('accepts plain codes and same-origin public URLs', () => { expect(parseQr(' AB-1 ', 'https://tour.test')).toBe('AB-1'); expect(parseQr('https://tour.test/qr/POI%201', 'https://tour.test')).toBe('POI 1'); });
  it('rejects foreign redirects and unrelated paths', () => { expect(() => parseQr('https://evil.test/qr/a', 'https://tour.test')).toThrow(); expect(() => parseQr('https://tour.test/admin', 'https://tour.test')).toThrow(); expect(() => parseQr('', 'https://tour.test')).toThrow(); });
});
