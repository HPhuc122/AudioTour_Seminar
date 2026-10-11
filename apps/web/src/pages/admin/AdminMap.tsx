import { useCallback, useState } from 'react';
import { api } from '../../services/api';
import { useSession } from '../../contexts/Session';
import { useResource } from '../../hooks/useResource';
import { PoiMap } from '../../components/PoiMap';
import { PageTitle, State } from '../../components/States';
import type { Row, Page, PublicPoi } from '../../types';
export function AdminMap() {
  const { session } = useSession(); const [selected, setSelected] = useState<PublicPoi>(); const [weighted, setWeighted] = useState(false);
  const data = useResource(useCallback(async () => { let page = 1; const rows: Row[] = []; while (true) { const result = await api.admin<Page<Row>>(`pois?page=${page++}&pageSize=500`, session!.accessToken); rows.push(...result.items); if (rows.length >= result.total || !result.items.length) break; } const stats = await api.admin<{ groupKey: number; plays: number }[]>('analytics/grouped?groupBy=poi', session!.accessToken); return { pois: rows.map(r => ({ id: Number(r.Id), code: String(r.Code), name: String(r.Name || r.Code), latitude: Number(r.Latitude), longitude: Number(r.Longitude), radiusMeters: Number(r.RadiusMeters), priority: Number(r.Priority) })), weights: Object.fromEntries(stats.map(s => [s.groupKey, s.plays])) }; }, [session]));
  return <><PageTitle title="Bản đồ quản lý POI"><label className="check"><input type="checkbox" checked={weighted} onChange={e => setWeighted(e.target.checked)}/>Kích thước theo lượt nghe</label></PageTitle><State loading={data.loading} error={data.error} retry={() => void data.reload()}/>{data.data && <section className="panel map-panel"><PoiMap pois={data.data.pois} onSelect={setSelected} weights={weighted ? data.data.weights : undefined}/>{selected && <div className="map-detail"><h2>{selected.name}</h2><p>POI #{selected.id} · {selected.latitude}, {selected.longitude} · Bán kính {selected.radiusMeters} m</p></div>}<p className="muted">Vòng xanh: vùng kích hoạt. Vòng cam: tổng lượt nghe tại địa điểm, không phải tọa độ khách tham quan.</p></section>}</>;
}
