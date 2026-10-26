import { useCallback, useState, type ReactNode } from 'react';
import { api, json } from '../../services/api';
import { useResource } from '../../hooks/useResource';
import { Editor } from '../../components/Editor';
import { State } from '../../components/States';
import { ReviewStatus } from '../../components/ReviewStatus';
import { ContentPreviewDialog, type ContentPreviewKind } from '../../components/ContentPreviewDialog';
import { Filters, Pagination } from '../../components/AdminTable';
import type { Field, Page, Row } from '../../types';

type Resource = 'media' | 'narrations' | 'audio' | 'poi-translations';
const titles: Record<Resource, string> = { media: 'Hình ảnh', narrations: 'Thuyết minh', audio: 'Âm thanh', 'poi-translations': 'Bản dịch' };
export function RelatedContent({ action, empty, poiId, resource, token }: {
  action?: ReactNode; empty: string; poiId: number; resource: Resource; token: string;
}) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [editing, setEditing] = useState<Row | null>();
  const [preview, setPreview] = useState<Row>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const query = new URLSearchParams({ poiId: String(poiId), page: String(page), pageSize: '20', search, status, ...(resource === 'media' ? { fileType: 'image' } : {}) }).toString();
  const data = useResource(useCallback(() => api.admin<Page<Row>>(`cms/catalog/${resource}?${query}`, token), [resource, query, token]));
  const languages = useResource(useCallback(() => resource !== 'media' ? api.languages(token) : Promise.resolve([]), [resource, token]));
  const kind: ContentPreviewKind = resource === 'poi-translations' ? 'translations' : resource;
  const fields: Field[] = [
    { key: resource === 'poi-translations' ? 'Name' : 'Title', label: resource === 'poi-translations' ? 'Tên địa điểm' : 'Tiêu đề', required: true, maxLength: 200 },
    { key: 'LanguageCode', label: 'Ngôn ngữ', type: 'select', required: true, default: 'vi', options: languages.data?.map(l => ({ value: l.code, label: l.nativeName || l.name })) },
    ...(resource === 'narrations' ? [{ key: 'TextContent', label: 'Nội dung thuyết minh', type: 'textarea' as const, required: true }] : []),
    ...(resource === 'poi-translations' ? [{ key: 'ShortDescription', label: 'Mô tả ngắn' }, { key: 'Description', label: 'Nội dung bản dịch', type: 'textarea' as const, required: true }] : []),
  ];
  async function remove(row: Row) {
    if (busy || !window.confirm('Gửi yêu cầu xóa nội dung này? Bản công khai được giữ nguyên đến khi Admin duyệt.')) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await api.admin(`${resource}/${row.Id}`, token, { method: 'DELETE' });
      setMessage('Đã gửi yêu cầu xóa để Admin duyệt.');
      await data.reload();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không gửi được yêu cầu xóa.'); }
    finally { setBusy(false); }
  }
  async function replaceImage(row: Row, file: File) {
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const body = new FormData(); body.append('file', file);
      await api.admin(`media/${row.Id}/replacement`, token, { method: 'POST', body });
      setMessage('Đã gửi ảnh thay thế để duyệt. Ảnh công khai được giữ nguyên.');
      await data.reload();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thay được ảnh.'); }
    finally { setBusy(false); }
  }
  return <section className="panel vendor-panel">
    <div className="vendor-section-heading"><h2>{titles[resource]}</h2><div className="row-actions">{action}{['narrations', 'poi-translations'].includes(resource) && <button className="primary" disabled={busy || languages.loading || !!languages.error} onClick={() => setEditing(null)}>{resource === 'narrations' ? 'Thêm thuyết minh' : 'Thêm bản dịch'}</button>}</div></div>
    <Filters search={search} onSearch={s => { setSearch(s); setPage(1); }} status={status} onStatus={s => { setStatus(s); setPage(1); }}/>
    {resource !== 'media' && <State error={languages.error} retry={() => void languages.reload()}/>}
    {message && <p className="notice" role="status">{message}</p>}{error && <p className="error" role="alert">{error}</p>}
    <State loading={data.loading} error={data.error} retry={() => void data.reload()}/>
    {!data.loading && !data.error && !data.data?.items.length && <p>{empty}</p>}
    {!data.loading && !data.error && data.data?.items.map(row => <article className="vendor-content-row" key={String(row.Id)}>
      <div className="vendor-content-main"><strong>{row.Title || row.Name || row.OriginalFileName || `#${row.Id}`}</strong><small>{row.LanguageCode || row.ContentType}</small><p className="vendor-content-preview">{row.TextContent || row.Description || row.ShortDescription}</p><ReviewStatus row={row}/></div>
      <div className="row-actions">
        <button onClick={() => setPreview(row)}>Xem trước</button>
        {resource !== 'media' && <button disabled={busy || languages.loading || !!languages.error} onClick={() => setEditing(row)}>Chỉnh sửa và gửi duyệt</button>}
        {resource === 'media' && <label className="upload replace-image">Thay ảnh<input aria-label={`Thay ảnh ${row.OriginalFileName || row.Id}`} type="file" accept="image/*" disabled={busy} onChange={e => { const file = e.target.files?.[0]; if (file) void replaceImage(row, file); e.target.value = ''; }}/></label>}
        <button disabled={busy} onClick={() => void remove(row)}>Yêu cầu xóa</button>
      </div>
    </article>)}
    <Pagination page={page} total={data.data?.total} size={20} busy={busy || data.loading} onPage={setPage}/>
    {preview && <ContentPreviewDialog row={preview} kind={kind} token={token} canAutomate={false} onClose={() => setPreview(undefined)}/>}
    {editing !== undefined && <Editor title={`${editing ? 'Sửa' : 'Thêm'} ${titles[resource].toLowerCase()} và gửi duyệt`} fields={fields} initial={editing || undefined} onClose={() => setEditing(undefined)} onSave={async values => {
      const path = editing && resource === 'narrations' ? `narrations/${editing.Id}/content` : `${resource}${editing ? '/' + editing.Id : ''}`;
      await api.admin(path, token, json(editing ? 'PUT' : 'POST', { ...values, ...(resource === 'narrations' ? { PoiId: poiId } : { POIId: poiId }) }));
      setMessage('Đã gửi nội dung để Admin duyệt. Bản công khai được giữ nguyên.');
      await data.reload();
    }}/>}
  </section>;
}
