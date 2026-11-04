import type { PublicPoiSummary } from "./api"

export type NearbyPosition = { latitude: number; longitude: number; accuracy?: number }

const radians = (degrees: number) => degrees * Math.PI / 180

export function distanceMeters(a: NearbyPosition, b: NearbyPosition): number {
  const lat = radians(b.latitude - a.latitude)
  const lon = radians(b.longitude - a.longitude)
  const arc = Math.sin(lat / 2) ** 2 + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(lon / 2) ** 2
  return 6371000 * 2 * Math.asin(Math.min(1, Math.sqrt(arc)))
}

export function nearestPoiWithinRadius(pois: PublicPoiSummary[], position: NearbyPosition): PublicPoiSummary | null {
  if (!Number.isFinite(position.latitude) || !Number.isFinite(position.longitude) ||
      Math.abs(position.latitude) > 90 || Math.abs(position.longitude) > 180 ||
      (position.accuracy != null && (!Number.isFinite(position.accuracy) || position.accuracy < 0 || position.accuracy > 100))) return null

  let closest: PublicPoiSummary | null = null
  let closestDistance = Infinity
  for (const poi of pois) {
    if (!Number.isFinite(poi.latitude) || !Number.isFinite(poi.longitude) ||
        Math.abs(poi.latitude!) > 90 || Math.abs(poi.longitude!) > 180 ||
        !Number.isFinite(poi.radiusMeters) || (poi.radiusMeters ?? 0) <= 0 ||
        (position.accuracy != null && position.accuracy > poi.radiusMeters!)) continue
    const meters = distanceMeters(position, { latitude: poi.latitude!, longitude: poi.longitude! })
    if (meters <= poi.radiusMeters! && meters < closestDistance) {
      closest = poi
      closestDistance = meters
    }
  }
  return closest
}

export const NEARBY_COOLDOWN_MS = 5 * 60 * 1000

export function canTriggerNearby(lastTriggeredAt: number | undefined, now: number, cooldownSeconds = NEARBY_COOLDOWN_MS / 1000): boolean {
  const cooldown = Number.isFinite(cooldownSeconds) && cooldownSeconds >= 0 ? cooldownSeconds * 1000 : NEARBY_COOLDOWN_MS
  return lastTriggeredAt === undefined || now - lastTriggeredAt >= cooldown
}

// Foreground dwell detection: invalid/stale fixes and long gaps break continuity.
export class ProximityMonitor {
  private candidate: { id: number; enteredAt: number; lastFixAt: number } | null = null

  reset() { this.candidate = null }

  update(pois: PublicPoiSummary[], position: NearbyPosition, now: number, fixAt = now): PublicPoiSummary | null {
    if (!Number.isFinite(fixAt) || now - fixAt > 30000 || fixAt > now + 1000) { this.reset(); return null }
    const poi = nearestPoiWithinRadius(pois, position)
    if (!poi) { this.reset(); return null }
    if (!this.candidate || this.candidate.id !== poi.id || fixAt < this.candidate.lastFixAt || fixAt - this.candidate.lastFixAt > 30000)
      this.candidate = { id: poi.id, enteredAt: fixAt, lastFixAt: fixAt }
    this.candidate.lastFixAt = fixAt
    const dwell = Number.isFinite(poi.minDwellSeconds) && poi.minDwellSeconds! >= 0 ? poi.minDwellSeconds! : 5
    return fixAt - this.candidate.enteredAt >= dwell * 1000 ? poi : null
  }
}
