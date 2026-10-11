import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { PublicPoi } from '../types';
import type { Position } from '../lib/geofence';
export function PoiMap({ pois, position, onSelect, weights, route }: { pois: PublicPoi[]; position?: Position; onSelect?: (poi: PublicPoi) => void; weights?: Record<number, number>; route?: [number, number][] }) {
  const container = useRef<HTMLDivElement>(null); const map = useRef<L.Map | null>(null); const fit = useRef(false);
  useEffect(() => { const instance = L.map(container.current!, { scrollWheelZoom: false }).setView([11.733, 109.19], 13); L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors', maxZoom: 19 }).addTo(instance); map.current = instance; const observer = new ResizeObserver(() => instance.invalidateSize()); observer.observe(container.current!); return () => { observer.disconnect(); instance.remove(); map.current = null; fit.current = false; }; }, []);
  useEffect(() => { if (!map.current) return; const group = L.layerGroup().addTo(map.current); const points: L.LatLngTuple[] = [];
    for (const poi of pois) { if (!Number.isFinite(poi.latitude) || !Number.isFinite(poi.longitude)) continue; const coords: L.LatLngTuple = [poi.latitude, poi.longitude]; points.push(coords); L.circle(coords, { radius: poi.radiusMeters || 50, color: '#137e68', weight: 1, fillOpacity: 0.08 }).addTo(group); const button = document.createElement('button'); button.className = 'map-popup-button'; button.textContent = poi.name; button.onclick = () => onSelect?.(poi); L.circleMarker(coords, { radius: weights ? Math.min(28, 6 + Math.sqrt(weights[poi.id] || 0) * 2) : 8, color: '#fff', weight: 2, fillColor: weights ? '#e68b3b' : '#0c6b58', fillOpacity: 0.9 }).bindPopup(button).addTo(group); }
    if (points.length && !fit.current) { map.current.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 15 }); fit.current = true; }
    if (route?.length) L.polyline(route, { color: '#407bbc', weight: 5 }).addTo(group);
    return () => { group.remove(); };
  }, [pois, onSelect, weights, route]);
  useEffect(() => { if (!position || !map.current) return; const group = L.layerGroup().addTo(map.current); L.circle([position.latitude, position.longitude], { radius: position.accuracy, color: '#367fd1', weight: 1, fillOpacity: 0.12 }).addTo(group); L.circleMarker([position.latitude, position.longitude], { radius: 7, color: '#fff', fillColor: '#367fd1', fillOpacity: 1, weight: 3 }).bindTooltip('Vị trí của bạn').addTo(group); return () => { group.remove(); }; }, [position]);
  return <div ref={container} className="poi-map" aria-label="Bản đồ địa điểm"/>;
}
