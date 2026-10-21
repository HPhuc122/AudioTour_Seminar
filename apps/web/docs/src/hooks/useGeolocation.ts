import { useEffect, useState } from 'react';
import type { Position } from '../lib/geofence';
export function useGeolocation(enabled: boolean) {
  const [position, setPosition] = useState<Position>(); const [error, setError] = useState(''); const [visible, setVisible] = useState(!document.hidden);
  useEffect(() => { const update = () => setVisible(!document.hidden); document.addEventListener('visibilitychange', update); return () => document.removeEventListener('visibilitychange', update); }, []);
  useEffect(() => { if (!enabled || !visible) { setPosition(undefined); return; } if (!navigator.geolocation) { setError('Trình duyệt không hỗ trợ GPS.'); return; } setError(''); const id = navigator.geolocation.watchPosition(p => { setPosition({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy }); setError(''); }, e => { setPosition(undefined); setError(e.code === 1 ? 'Bạn chưa cấp quyền vị trí. Có thể dùng QR để nghe.' : 'Không lấy được vị trí. Hãy thử lại ngoài trời.'); }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }); return () => navigator.geolocation.clearWatch(id); }, [enabled, visible]);
  return { position, error, visible };
}
