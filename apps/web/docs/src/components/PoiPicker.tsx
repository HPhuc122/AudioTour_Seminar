import { useCallback, useState } from 'react';
import { api } from '../services/api';
import { useResource } from '../hooks/useResource';
import { State } from './States';
import type { Page, Row } from '../types';
export function PoiPicker({ token, value, onChange, all = false, label = 'Chọn địa điểm' }: { token: string; value: number; onChange: (id: number) => void; all?: boolean; label?: string }) {
  const [search, setSearch] = useState('');
  const data = useResource(useCallback(() => api.admin<Page<Row>>(`cms/catalog/pois?pageSize=100&search=${encodeURIComponent(search)}`, token), [token, search]));
  return <div className="poi-picker"><label>Tìm địa điểm<input placeholder="Tìm tên hoặc mã POI…" value={search} onChange={e => setSearch(e.target.value)}/></label><label>{label}<select value={value || ''} onChange={e => onChange(Number(e.target.value))}><option value="">{all ? 'Tất cả địa điểm' : 'Chọn POI…'}</option>{value > 0 && !data.data?.items.some(p => Number(p.Id) === value) && <option value={value}>POI #{value}</option>}{data.data?.items.map(p => <option key={String(p.Id)} value={String(p.Id)}>{p.Name || p.Code} · #{p.Id}</option>)}</select></label>{data.data && data.data.total > 100 && <small>Hiển thị 100 kết quả đầu. Nhập tên hoặc mã để tìm chính xác.</small>}<State error={data.error} retry={() => void data.reload()}/></div>;
}
