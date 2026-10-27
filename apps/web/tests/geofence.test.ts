import { describe, expect, it } from 'vitest';
import { GeofenceEngine, distance } from '../docs/src/lib/geofence';
import type { PublicPoi } from '../docs/src/types';
const poi: PublicPoi = { id: 1, code: 'P1', name: 'POI', latitude: 11.7, longitude: 109.2, radiusMeters: 50, minDwellSeconds: 3, cooldownSeconds: 60 };
const inside = { latitude: 11.7, longitude: 109.2, accuracy: 5 };
const outside = { latitude: 12, longitude: 109.2, accuracy: 5 };
describe('foreground geofencing', () => {
  it('requires dwell and never repeats while inside', () => { const engine = new GeofenceEngine(); expect(engine.update([poi], inside, 0).entered).toEqual([1]); expect(engine.update([poi], inside, 2999).triggers).toEqual([]); expect(engine.update([poi], inside, 3000).triggers).toEqual([poi]); expect(engine.update([poi], inside, 90000).triggers).toEqual([]); });
  it('debounces exits and applies cooldown on re-entry', () => { const e = new GeofenceEngine(); e.update([poi], inside, 0); e.update([poi], inside, 3000); e.update([poi], outside, 5000); expect(e.update([poi], outside, 6999).exited).toEqual([]); expect(e.update([poi], outside, 7000).exited).toEqual([1]); e.update([poi], inside, 8000); expect(e.update([poi], inside, 11000).triggers).toEqual([]); expect(e.update([poi], inside, 63000).triggers).toEqual([poi]); });
  it('does not trigger from an inaccurate fix', () => { const e = new GeofenceEngine(); e.update([poi], { ...inside, accuracy: 200 }, 0); expect(e.update([poi], { ...inside, accuracy: 200 }, 999999).triggers).toEqual([]); expect(e.update([poi], inside, 999999).triggers).toEqual([]); });
  it('prioritizes overlapping POIs', () => { const e = new GeofenceEngine(); const high = { ...poi, id: 2, priority: 10 }; e.update([poi, high], inside, 0); expect(e.update([poi, high], inside, 4000).triggers.map(p => p.id)).toEqual([2, 1]); });
  it('reset prevents stale dwell on tab resume', () => { const e = new GeofenceEngine(); e.update([poi], inside, 0); e.reset(); expect(e.update([poi], inside, 90000).triggers).toEqual([]); });
  it('calculates distance in meters', () => { expect(distance(inside, inside)).toBe(0); expect(distance({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 })).toBeCloseTo(111194.9, 0); });
});
