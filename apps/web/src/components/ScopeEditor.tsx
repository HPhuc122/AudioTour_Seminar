import { useCallback, useState } from 'react';
import { useSession } from '../contexts/Session';
import { useResource } from '../hooks/useResource';
import { api } from '../services/api';
import { State } from './States';
import type { Row } from '../types';

export function ScopeEditor({ resource, id, onClose }: { resource: string; id: number; onClose: () => void }) {
  const { session } = useSession(); const token = session!.accessToken; const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const grants = useResource(useCallback(() => api.admin<Row[]>(`cms/grants/${resource}/${id}`, token), [resource, id, token]));
  const users = useResource(useCallback(() => api.admin<Row[]>('users', token), [token]));
  async function change(userId: string, method: string) {
    setBusy(true); setError('');
    try { await api.admin(`cms/grants/${resource}/${id}/${userId}`, token, { method }); await grants.reload(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Không cập nhật được quyền'); } finally { setBusy(false); }
  }
  return <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-label="Phân quyền nội dung"><h2>Phân quyền {resource === 'pois' ? 'POI' : 'Tour'} #{id}</h2><p>Chủ sở hữu có quyền mặc định. Cấp thêm quyền quản lý cho tài khoản bên dưới.</p><State loading={grants.loading || users.loading} error={grants.error || users.error}/>{error && <p className="error" role="alert">{error}</p>}{grants.data?.map(row => <article className="list-item" key={String(row.UserId)}><span>{String(users.data?.find(u => u.id === row.UserId)?.username || row.UserId)}</span><button disabled={busy} onClick={() => void change(String(row.UserId), 'DELETE')}>Thu hồi</button></article>)}<form onSubmit={e => { e.preventDefault(); void change(String(new FormData(e.currentTarget).get('user')), 'PUT'); }}><label>Tài khoản được cấp quyền<select name="user" required><option value="">Chọn Chủ sạp / người biên tập</option>{users.data?.filter(u => u.isActive && ['Vendor', 'ContentAdmin', 'TourOperator'].includes(String(u.role))).map(u => <option key={String(u.id)} value={String(u.id)}>{u.username} · {u.role}</option>)}</select></label><div className="form-actions"><button type="button" disabled={busy} onClick={onClose}>Đóng</button><button className="primary" disabled={busy || users.loading}>Cấp quyền</button></div></form></section></div>;
}
