import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, Download } from 'lucide-react';
import QRCode from 'qrcode';
import { useSession, writeRoles, adminRoles } from '../../contexts/Session';
import { useResource } from '../../hooks/useResource';
import { api, json } from '../../services/api';
import type { Row, Page } from '../../types';
import { PageTitle, State } from '../../components/States';
import { Editor } from '../../components/Editor';
import { ReviewStatus } from '../../components/ReviewStatus';
import { ScopeEditor } from '../../components/ScopeEditor';
import { configs } from './resourceConfig';
import { Filters, Pagination, roleLabels } from '../../components/AdminTable';
export function ResourcePage({ resource }: { resource: string }) {
  const { session, preview } = useSession(); const token = session!.accessToken; const config = configs[resource];
  const [scopeRow, setScopeRow] = useState<Row>(); const [page, setPage] = useState(1); const [search, setSearch] = useState(''); const [editing, setEditing] = useState<Row | null>(); const [actionError, setActionError] = useState(''); const [busyId, setBusyId] = useState<string>('');
  const [status, setStatus] = useState(''); const [active, setActive] = useState(''); const [message, setMessage] = useState('');
  const allowed = ['users', 'languages'].includes(resource) ? adminRoles.includes(session!.role) : writeRoles.includes(session!.role);
  const load = useCallback(() => api.admin<Page<Row>>(`cms/catalog/${resource}?${new URLSearchParams({ page: String(page), pageSize: '25', search, status, active })}`, token), [resource, page, token, search, status, active]);
  const data = useResource(load);
  const roles = useResource(useCallback(() => resource === 'users' && allowed ? api.admin<Row[]>('roles', token) : Promise.resolve([]), [resource, allowed, token]));
  const fields = config.fields.filter(f => resource !== 'pois' || adminRoles.includes(session!.role) || f.key !== 'LifecycleStatus').map(f => f.key === 'roleId' ? { ...f, options: roles.data?.map(r => ({ value: String(r.id), label: roleLabels[String(r.name)] || String(r.name) })) } : f.key === 'password' ? { ...f, required: !editing } : f);
  async function save(row: Row) {
    if (resource === 'qr' && (!!row.PoiId === !!row.TourId)) throw new Error('Chọn đúng một đích: POI hoặc tour.');
    if (resource === 'pois' && row.LifecycleStatus !== undefined) row.LifecycleStatus = Number(row.LifecycleStatus);
    if (resource === 'users') { row.roleId = Number(row.roleId); if (!editing && !row.password) throw new Error('Tài khoản mới cần mật khẩu.'); }
    const id = editing?.Id ?? editing?.id ?? (resource === 'languages' ? editing?.Code : undefined);
    await api.admin((resource === 'languages' ? 'cms/languages' : resource) + (id ? `/${encodeURIComponent(String(id))}` : ''), token, json(id ? 'PUT' : 'POST', row));
    setMessage(['users', 'languages', 'qr'].includes(resource) ? 'Đã lưu thông tin.' : 'Đã gửi thay đổi vào hàng đợi duyệt.'); await data.reload();
  }
  async function remove(row: Row) {
    if (!window.confirm(`Xác nhận ${resource === 'users' ? 'vô hiệu hóa' : 'xóa'} ${row.Name || row.Code || row.username}?`)) return;
    const id = row.Id ?? row.id; setBusyId(String(id)); setActionError('');
    try { await api.admin(`${resource}/${id}`, token, resource === 'users' ? json('PUT', { isActive: false }) : { method: 'DELETE' }); setMessage(resource === 'users' ? 'Đã vô hiệu hóa tài khoản.' : 'Đã gửi yêu cầu xóa.'); await data.reload(); }
    catch (e) { setActionError(e instanceof Error ? e.message : 'Thao tác thất bại'); } finally { setBusyId(''); }
  }
  async function downloadQr(row: Row) { try { const url = String(row.Code); const href = await QRCode.toDataURL(url, { width: 600, margin: 2 }); const a = document.createElement('a'); a.href = href; a.download = `qr-${String(row.Id)}.png`; a.click(); } catch (e) { setActionError(e instanceof Error ? e.message : 'Không tạo được QR.'); } }
  const rows = data.data?.items || [];
  const publicationLabels = Object.fromEntries((configs.pois.fields.find(f => f.key === 'LifecycleStatus')?.options || []).map(o => [o.value, o.label.replace(/\s*\(\d+\)$/, '')]));
  return <><PageTitle eyebrow="QUẢN LÝ NỘI DUNG" title={config.title}>{allowed && <button className="primary" onClick={() => setEditing(null)}><Plus size={18}/>Thêm mới</button>}</PageTitle><section className="panel"><Filters search={search} onSearch={s => { setSearch(s); setPage(1); }} status={status} onStatus={['qr', 'languages'].includes(resource) ? undefined : s => { setStatus(s); setPage(1); }} options={resource === 'users' ? roleLabels : undefined}><label>Hoạt động<select value={active} onChange={e => { setActive(e.target.value); setPage(1); }}><option value="">Tất cả</option><option value="true">Đang hoạt động</option><option value="false">Ngừng hoạt động</option></select></label></Filters>{message && <p className="notice" role="status">{message}</p>}{actionError && <p className="error" role="alert">{actionError}</p>}<State loading={data.loading} error={data.error} retry={() => void data.reload()} empty={!data.loading && !data.error && !rows.length}/>{!!rows.length && <div className="table-scroll"><table><thead><tr>{config.columns.map(([key, label]) => <th key={key}>{label}</th>)}{['pois', 'tours'].includes(resource) && <th>Duyệt nội dung</th>}<th>Thao tác</th></tr></thead><tbody>{rows.map(row => <tr key={String(row.Id ?? row.id ?? row.Code)}>{config.columns.map(([key]) => <td key={key}>{typeof row[key] === 'boolean' ? <span className={`badge ${row[key] ? 'success' : ''}`}>{row[key] ? 'Có' : 'Không'}</span> : key === 'role' ? (roleLabels[String(row[key])] || String(row[key])) : key === 'LifecycleStatus' ? (publicationLabels[String(row[key])] || String(row[key] ?? '—')) : String(row[key] ?? '—')}</td>)}{['pois', 'tours'].includes(resource) && <td><ReviewStatus row={row}/></td>}<td><div className="row-actions">{!preview && adminRoles.includes(session!.role) && ['pois','tours'].includes(resource) && <button onClick={() => setScopeRow(row)}>Phân quyền</button>}{resource === 'tours' && <Link to={`/admin/tours/${row.Id}`}>Nội dung & POI</Link>}{resource === 'qr' && <button aria-label="Tải mã QR" onClick={() => void downloadQr(row)}><Download size={16}/></button>}{allowed && <><button aria-label="Sửa" onClick={() => setEditing(row)}><Pencil size={16}/></button>{resource !== 'languages' && <button aria-label={resource === 'users' ? 'Vô hiệu hóa' : 'Xóa'} disabled={busyId === String(row.Id ?? row.id)} onClick={() => void remove(row)}><Trash2 size={16}/></button>}</>}</div></td></tr>)}</tbody></table></div>}<Pagination page={page} total={data.data?.total} busy={data.loading} onPage={setPage}/></section>{scopeRow && <ScopeEditor resource={resource} id={Number(scopeRow.Id)} onClose={() => setScopeRow(undefined)}/>} {editing !== undefined && <Editor title={editing ? 'Sửa thông tin' : 'Thêm mới'} fields={fields} initial={editing || undefined} onSave={save} onClose={() => setEditing(undefined)}/>}</>;
}
