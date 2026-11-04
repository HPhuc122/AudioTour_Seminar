import { useCallback, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, json } from '../../services/api';
import { useSession, writeRoles } from '../../contexts/Session';
import { useResource } from '../../hooks/useResource';
import { PageTitle, State } from '../../components/States';
import { Editor } from '../../components/Editor';
import { ReviewStatus } from '../../components/ReviewStatus';
import { ContentPreviewDialog, type ContentPreviewKind } from '../../components/ContentPreviewDialog';
import { Filters, Pagination } from '../../components/AdminTable';
import { NarrationAudioStatus } from '../../components/NarrationAudioStatus';
import { PoiPicker } from '../../components/PoiPicker';
import type { Row, Field, Page } from '../../types';

const translationFields: Field[] = [{ key: 'LanguageCode', label: 'Mã ngôn ngữ', required: true, default: 'vi' }, { key: 'Name', label: 'Tên địa điểm', required: true }, { key: 'ShortDescription', label: 'Mô tả ngắn' }, { key: 'Description', label: 'Văn bản giới thiệu', type: 'textarea', required: true }];
const narrationFields: Field[] = [{ key: 'Title', label: 'Tiêu đề', required: true }, { key: 'LanguageCode', label: 'Ngôn ngữ', default: 'vi', required: true }, { key: 'Voice', label: 'Giọng đọc', default: 'vi-VN' }, { key: 'TextContent', label: 'Văn bản giới thiệu', type: 'textarea', required: true }];
const titles = { translations: 'Nội dung đa ngôn ngữ', audio: 'Thư viện audio', media: 'Quản lý hình ảnh', narrations: 'Nội dung thuyết minh' };
export function ContentPage({ mode }: { mode: keyof typeof titles }) {
  const { session } = useSession(); const token = session!.accessToken; const canWrite = writeRoles.includes(session!.role);
  const [params] = useSearchParams(); const [poi, setPoi] = useState(Number(params.get('poi')) || 0);
  const [search, setSearch] = useState(''); const [status, setStatus] = useState(''); const [page, setPage] = useState(1); const [editing, setEditing] = useState<Row | null>(); const [selected, setSelected] = useState<{ row: Row; kind: ContentPreviewKind }>();
  const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  const path = mode === 'translations' ? 'poi-translations' : mode === 'narrations' ? 'narrations' : mode === 'media' ? 'media' : 'audio';
  const query = new URLSearchParams({ search, status, page: String(page), pageSize: '25', ...(poi ? { poiId: String(poi) } : {}), ...(mode === 'media' ? { fileType: 'image' } : {}) });
  const queryString = query.toString();
  const data = useResource(useCallback(() => api.admin<Page<Row>>(`cms/catalog/${path}?${queryString}`, token), [path, queryString, token]));
  const languages = useResource(useCallback(() => api.languages(token), [token]));
  async function upload(file: File) {
    setBusy(true); setError(''); setMessage('');
    try {
      await api.upload(file, poi, token);
      setMessage('Đã tải file thật lên và gửi duyệt.'); await data.reload();
    } catch (e) { setError(e instanceof Error ? e.message : 'Tải file thất bại.'); } finally { setBusy(false); }
  }
  async function replaceMedia(row: Row, file: File) {
    setBusy(true); setError(''); try { const body = new FormData(); body.append('file', file); await api.admin(`media/${row.Id}/replacement`, token, { method: 'POST', body }); setMessage('Đã gửi file thay thế để duyệt. File đang công khai được giữ nguyên.'); await data.reload(); } catch (e) { setError(e instanceof Error ? e.message : 'Không gửi được file thay thế.'); } finally { setBusy(false); }
  }
  async function remove(row: Row) {
    if (!confirm('Gửi yêu cầu xóa để Admin duyệt?')) return;
    setError(''); setBusy(true); try { await api.admin(`${path}/${row.Id}`, token, { method: 'DELETE' }); setMessage('Đã gửi yêu cầu xóa để duyệt.'); await data.reload(); } catch (e) { setError(e instanceof Error ? e.message : 'Không gửi được yêu cầu.'); } finally { setBusy(false); }
  }
  const editorFields = (mode === 'narrations' ? narrationFields : translationFields).map(f => f.key === 'LanguageCode' ? { ...f, type: 'select' as const, options: languages.data?.map(l => ({ value: l.code, label: l.nativeName || l.name })) } : f);
  return <><PageTitle title={titles[mode]}><div className="row-actions">{canWrite && mode === 'audio' && <><Link className="button primary" to={`/admin/narrations${poi ? '?poi=' + poi : ''}`}>Nhập văn bản thuyết minh</Link></>}</div></PageTitle><p className="notice">Văn bản thuyết minh được gửi Admin duyệt trước khi chuyển thành giọng nói. Chọn POI để quản lý nội dung. Audio được tạo tự động từ văn bản đã duyệt.</p><section className="panel"><PoiPicker token={token} value={poi} all onChange={id => { setPoi(id); setPage(1); setSelected(undefined); }}/><State error={languages.error} retry={() => void languages.reload()}/><Filters search={search} onSearch={s => { setSearch(s); setPage(1); }} status={status} onStatus={s => { setStatus(s); setPage(1); }}/><div className="section-title"><h2>{poi ? `POI #${poi}` : 'Nội dung của các POI'}</h2>{canWrite && mode !== 'media' && mode !== 'audio' && <button disabled={!poi || languages.loading || !!languages.error} onClick={() => setEditing(null)}>Thêm {mode === 'narrations' ? 'thuyết minh' : 'bản dịch'}</button>}{canWrite && mode === 'media' && <label className="upload">{busy ? 'Đang tải file…' : mode === 'media' ? 'Tải ảnh lên' : 'Tải file audio lên'}<input type="file" accept={mode === 'media' ? 'image/*' : 'audio/*'} disabled={!poi || busy} onChange={e => { if (e.target.files?.[0]) void upload(e.target.files[0]); e.target.value = ''; }}/></label>}</div>{message && <p className="notice" role="status">{message}</p>}{error && <p className="error" role="alert">{error}</p>}<State loading={data.loading} error={data.error} retry={() => void data.reload()} empty={!data.loading && !data.error && !data.data?.items.length}/>{!data.loading && !data.error && !!data.data?.items.length && <div className="table-scroll content-table-scroll"><table className="content-table"><thead><tr><th>Nội dung</th><th>POI</th><th>Ngôn ngữ / định dạng</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{data.data.items.map(row => <tr key={String(row.Id)}><td><strong>{row.Name || row.Title || row.OriginalFileName}</strong><small className="block">#{row.Id}</small></td><td>#{row.PoiId || row.POIId}</td><td>{row.LanguageCode || row.ContentType}</td><td><ReviewStatus row={row}/></td><td><div className="row-actions content-row-actions"><button onClick={() => setSelected({ row, kind: mode })}>Xem trước</button>{mode === 'audio' && row.FileUrl && <button onClick={() => setSelected({ row, kind: mode })}>Nghe file</button>}{canWrite && mode !== 'media' && mode !== 'audio' && <button disabled={languages.loading || !!languages.error} onClick={() => setEditing(row)}>Sửa</button>}{canWrite && mode === 'media' && <label className="upload replace-image">Thay ảnh<input type="file" accept="image/*" disabled={busy} onChange={e => { if (e.target.files?.[0]) void replaceMedia(row, e.target.files[0]); e.target.value = ''; }}/></label>}{canWrite && mode !== 'audio' && <button disabled={busy} onClick={() => void remove(row)}>Xóa</button>}</div></td></tr>)}</tbody></table></div>}<Pagination page={page} total={data.data?.total} busy={data.loading} onPage={setPage}/></section>
    {selected && <ContentPreviewDialog row={selected.row} kind={selected.kind} token={token} onClose={() => setSelected(undefined)}/>}
    {(mode === 'audio' || mode === 'narrations') && <NarrationAudioStatus token={token} poiId={poi}/>}

    {mode !== 'audio' && editing !== undefined && <Editor title={mode === 'narrations' ? 'Thuyết minh gửi duyệt' : 'Bản dịch POI'} fields={editorFields} initial={editing || undefined} onClose={() => setEditing(undefined)} onSave={async row => { const parent = Number(editing?.PoiId || editing?.POIId || poi); if (!parent) throw new Error('Chọn POI trước khi thêm nội dung.'); await api.admin(mode === 'narrations' && editing?.Id ? `narrations/${editing.Id}/content` : `${path}${editing?.Id ? '/' + editing.Id : ''}`, token, json(editing?.Id ? 'PUT' : 'POST', { ...row, ...(mode === 'narrations' ? { PoiId: parent } : { POIId: parent }), ...(editing?.FileSizeBytes ? { FileSizeBytes: editing.FileSizeBytes } : {}) })); setMessage('Đã gửi nội dung vào hàng đợi duyệt.'); await data.reload(); }}/>}</>;
}
