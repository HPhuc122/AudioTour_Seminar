import type { PublicPoi } from '../types';
export type Position = { latitude: number; longitude: number; accuracy: number };
export function distance(a: Pick<Position, 'latitude' | 'longitude'>, b: Pick<Position, 'latitude' | 'longitude'>) {
  const rad = Math.PI / 180; const lat = (b.latitude - a.latitude) * rad; const lon = (b.longitude - a.longitude) * rad;
  const h = Math.sin(lat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(lon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
type Fence = { enteredAt: number | null; lastTrigger: number; triggered: boolean; outsideAt: number | null };
export class GeofenceEngine {
  private states = new Map<number, Fence>();
  reset() { this.states.clear(); }
  update(pois: PublicPoi[], position: Position, now: number): { entered: number[]; exited: number[]; triggers: PublicPoi[] } {
    const entered: number[] = []; const exited: number[] = []; const triggers: PublicPoi[] = [];
    if (!Number.isFinite(position.accuracy) || position.accuracy > 100) return { entered, exited, triggers };
    for (const poi of pois) {
      if (!Number.isFinite(poi.latitude) || !Number.isFinite(poi.longitude)) continue;
      const state = this.states.get(poi.id) || { enteredAt: null, lastTrigger: -Infinity, triggered: false, outsideAt: null };
      const d = distance(position, poi); const radius = poi.radiusMeters ?? 50;
      if (position.accuracy > radius) continue;
      if (d <= radius) {
        state.outsideAt = null;
        if (state.enteredAt === null) { state.enteredAt = now; entered.push(poi.id); }
        if (!state.triggered && now - state.enteredAt >= Math.max(2000, (poi.minDwellSeconds ?? 3) * 1000) && now - state.lastTrigger >= (poi.cooldownSeconds ?? 120) * 1000) { state.triggered = true; state.lastTrigger = now; triggers.push(poi); }
      } else if (d > radius + Math.max(10, position.accuracy)) {
        if (state.enteredAt !== null) { state.outsideAt ??= now; if (now - state.outsideAt >= 2000) { exited.push(poi.id); state.enteredAt = null; state.triggered = false; state.outsideAt = null; } }
      }
      this.states.set(poi.id, state);
    }
    triggers.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || distance(position, a) - distance(position, b));
    return { entered, exited, triggers };
  }
}
