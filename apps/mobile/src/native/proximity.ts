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
      (position.accuracy != null && (!Number.isFinite(position.accuracy) || position.accuracy > 100))) return null

  let closest: PublicPoiSummary | null = null
  let closestDistance = Infinity
  for (const poi of pois) {
    if (!Number.isFinite(poi.latitude) || !Number.isFinite(poi.longitude) ||
        Math.abs(poi.latitude!) > 90 || Math.abs(poi.longitude!) > 180 ||
        !Number.isFinite(poi.radiusMeters) || (poi.radiusMeters ?? 0) <= 0) continue
    const meters = distanceMeters(position, { latitude: poi.latitude!, longitude: poi.longitude! })
    if (meters <= poi.radiusMeters! && meters < closestDistance) {
      closest = poi
      closestDistance = meters
    }
  }
  return closest
}

export const NEARBY_COOLDOWN_MS = 5 * 60 * 1000

export function canTriggerNearby(lastTriggeredAt: number | undefined, now: number): boolean {
  return lastTriggeredAt === undefined || now - lastTriggeredAt >= NEARBY_COOLDOWN_MS
}
