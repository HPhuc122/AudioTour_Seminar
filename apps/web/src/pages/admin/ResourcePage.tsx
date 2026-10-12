import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, Search, Download } from 'lucide-react';
import QRCode from 'qrcode';
import { useSession, writeRoles, adminRoles } from '../../contexts/Session';
import { useResource } from '../../hooks/useResource';
import { api, json } from '../../services/api';
import type { Row, Page } from '../../types';
import { PageTitle, State } from '../../components/States';
import { Editor } from '../../components/Editor';
import { configs } from './resourceConfig';
export function ResourcePage({ resource }: { resource: string }) {
  const { session } = useSession(); const token = session!.accessToken; const config = configs[resource];
  const [page, setPage] = useState(1); const [search, setSearch] = useState(''); const [editing, setEditing] = useState<Row | null>(); const [actionError, setActionError] = useState(''); const [busyId, setBusyId] = useState<string>('');
  const allowed = resource === 'users' ? adminRoles.includes(session!.role) : writeRoles.includes(session!.role);
  const load = useCallback(async () => { if (resource === 'users' && !adminRoles.includes(session!.role)) throw new Error('Chỉ Admin được quản lý người dùng.'); const result = await api.admin<Page<Row> | Row[]>(`${resource}?page=${page}&pageSize=50`, token); return Array.isArray(result) ? { items: result, total: result.length, page: 1, pageSize: result.length } : result; }, [resource, page, token, session]);
  const data = useResource(load);
  const roles = useResource(useCallback(() => resource === 'users' && allowed ? api.admin<Row[]>('roles', token) : Promise.resolve([]), [resource, allowed, token]));
  const fields = config.fields.map(f => f.key === 'roleId' ? { ...f, options: roles.data?.map(r => ({ value: String(r.id), label: String(r.name) })) } : f);
  async function save(row: Row) {
    if (resource === 'qr' && (!!row.PoiId === !!row.TourId)) throw new Error('Chọn đúng một đích: POI hoặc tour.');
    if (resource === 'pois') row.LifecycleStatus = Number(row.LifecycleStatus);
    if (resource === 'users') { row.roleId = Number(row.roleId); if (!editing && !row.password) throw new Error('Tài khoản mới cần mật khẩu.'); }
    const id = editing?.Id ?? editing?.id;
    await api.admin(resource + (id ? `/${id}` : ''), token, json(id ? 'PUT' : 'POST', row)); await data.reload();
  }
  async function remove(row: Row) {
    if (!window.confirm(`Xác nhận ${resource === 'users' ? 'vô hiệu hóa' : 'xóa'} ${row.Name || row.Code || row.username}?`)) return;
    const id = row.Id ?? row.id; setBusyId(String(id)); setActionError('');
    try { await api.admin(`${resource}/${id}`, token, resource === 'users' ? json('PUT', { isActive: false }) : { method: 'DELETE' }); await data.reload(); }
    catch (e) { setActionError(e instanceof Error ? e.message : 'Thao tác thất bại'); } finally { setBusyId(''); }
  }
  async function downloadQr(row: Row) { try { const url = String(row.Code); const href = await QRCode.toDataURL(url, { width: 600, margin: 2 }); const a = document.createElement('a'); a.href = href; a.download = `qr-${String(row.Id)}.png`; a.click(); } catch (e) { setActionError(e instanceof Error ? e.message : 'Không tạo được QR.'); } }
  const rows = data.data?.items.filter(row => Object.values(row).some(v => String(v ?? '').toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi')))) || [];
  return <><PageTitle eyebrow="QUẢN LÝ NỘI DUNG" title={config.title}>{allowed && <button className="primary" onClick={() => setEditing(null)}><Plus size={18}/>Thêm mới</button>}</PageTitle><section className="panel"><div className="table-toolbar"><label className="search"><Search size={18}/><input aria-label="Tìm kiếm" placeholder="Tìm trong trang hiện tại…" value={search} onChange={e => setSearch(e.target.value)}/></label><span className="muted">{data.data?.total ?? '—'} bản ghi</span></div>{actionError && <p className="error" role="alert">{actionError}</p>}<State loading={data.loading} error={data.error} retry={() => void data.reload()} empty={!data.loading && !data.error && !rows.length}/>{!!rows.length && <div className="table-scroll"><table><thead><tr>{config.columns.map(([key, label]) => <th key={key}>{label}</th>)}<th>Thao tác</th></tr></thead><tbody>{rows.map(row => <tr key={String(row.Id ?? row.id)}>{config.columns.map(([key]) => <td key={key}>{typeof row[key] === 'boolean' ? <span className={`badge ${row[key] ? 'success' : ''}`}>{row[key] ? 'Có' : 'Không'}</span> : String(row[key] ?? '—')}</td>)}<td><div className="row-actions">{resource === 'tours' && <Link to={`/admin/tours/${row.Id}`}>Nội dung & POI</Link>}{resource === 'qr' && <button aria-label="Tải mã QR" onClick={() => void downloadQr(row)}><Download size={16}/></button>}{allowed && <><button aria-label="Sửa" onClick={() => setEditing(row)}><Pencil size={16}/></button><button aria-label={resource === 'users' ? 'Vô hiệu hóa' : 'Xóa'} disabled={busyId === String(row.Id ?? row.id)} onClick={() => void remove(row)}><Trash2 size={16}/></button></>}</div></td></tr>)}</tbody></table></div>}<div className="pagination"><button disabled={page === 1 || data.loading} onClick={() => setPage(p => p - 1)}>← Trước</button><span>Trang {page}</span><button disabled={data.loading || !data.data || page * 50 >= data.data.total || resource === 'users'} onClick={() => setPage(p => p + 1)}>Sau →</button></div></section>{editing !== undefined && <Editor title={editing ? 'Sửa thông tin' : 'Thêm mới'} fields={fields} initial={editing || undefined} onSave={save} onClose={() => setEditing(undefined)}/>}</>;
}
