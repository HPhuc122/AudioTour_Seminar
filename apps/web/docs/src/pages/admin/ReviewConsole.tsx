import { useCallback, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { adminRoles, useSession, writeRoles } from '../../contexts/Session';
import { api, json } from '../../services/api';
import { useResource } from '../../hooks/useResource';
import { PageTitle, State } from '../../components/States';
import { MediaPreview } from '../../components/MediaPreview';
import { ReviewStatus } from '../../components/ReviewStatus';
import { Filters, Pagination, ConfirmDialog } from '../../components/AdminTable';
import { dateLabel } from './OperationsPage';
import type { Page, Row } from '../../types';
const names: Record<string, string> = { pois: 'Đăng ký / thay đổi POI', tours: 'Tour', media: 'Ảnh / file audio', audio: 'Audio', narrations: 'Văn bản giới thiệu', 'poi-translations': 'Bản dịch POI', 'tour-translations': 'Bản dịch tour' };
const fields: Record<string, string> = { Name: 'Tên', Title: 'Tiêu đề', Code: 'Mã', LanguageCode: 'Ngôn ngữ', Description: 'Nội dung', ShortDescription: 'Mô tả ngắn', TextContent: 'Thuyết minh', TTSText: 'Văn bản đọc', Latitude: 'Vĩ độ', Longitude: 'Kinh độ', RadiusMeters: 'Bán kính (m)', FileUrl: 'File audio', OriginalFileName: 'Tên file', EstimatedMinutes: 'Thời lượng (phút)', ValidFrom: 'Bắt đầu', ValidUntil: 'Kết thúc', _pois: 'Thứ tự POI' };
type Dossier = { submission: Row; canonical: Row; proposed: Row; submitter: { Username: string; Email: string } | null };
export function ReviewPage() {
  const { session } = useSession(); const token = session!.accessToken;
  const canReview = adminRoles.includes(session!.role); const canWrite = writeRoles.includes(session!.role);
  const [params] = useSearchParams();
  const [status, setStatus] = useState('Pending'); const [resource, setResource] = useState(params.get('resource') || ''); const [search, setSearch] = useState(params.get('search') || ''); const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Row>(); const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false); const [rejecting, setRejecting] = useState(false); const [confirming, setConfirming] = useState(false);
  const data = useResource(useCallback(() => api.admin<Page<Row>>(`cms/review-queue?${new URLSearchParams({ status, resource, search, page: String(page), pageSize: '25' })}`, token), [status, resource, search, page, token]));
  const detail = useResource(useCallback(() => selected ? api.admin<Dossier>(`cms/review-dossier/${selected.Id}`, token) : Promise.resolve(null), [selected, token]));
  async function action(kind: 'approve' | 'reject' | 'resubmit', reason?: string) {
    if (!selected) return;
    if (kind === 'reject' && !reason?.trim()) { setError('Cần nhập lý do từ chối.'); return; }
    setBusy(true); setError(''); setMessage('');
    try {
      const path = kind === 'resubmit' ? `cms/${selected.Resource}/${selected.EntityId}/resubmit` : `cms/submissions/${selected.Id}/${kind}`;
      await api.admin(path, token, json('POST', kind === 'reject' ? { reason: reason!.trim() } : {}));
      setMessage(kind === 'approve' ? 'Đã duyệt hồ sơ. Bản công khai được cập nhật.' : kind === 'reject' ? 'Đã từ chối và lưu lý do. Bản công khai trước đó được giữ nguyên.' : 'Đã gửi duyệt lại.');
      setSelected(undefined); setRejecting(false); setConfirming(false); await data.reload();
    } catch (e) { setError(e instanceof Error ? e.message : 'Thao tác thất bại'); } finally { setBusy(false); }
  }
  const item = detail.data?.proposed; const submission = detail.data?.submission || selected;
  const editPath = selected?.Resource === 'pois' ? '/admin/pois' : selected?.Resource === 'tours' || selected?.Resource === 'tour-translations' ? `/admin/tours/${item?.TourId || selected?.EntityId}` : `/admin/${selected?.Resource === 'poi-translations' ? 'translations' : selected?.Resource === 'narrations' ? 'narrations' : selected?.Resource === 'media' ? 'media' : 'audio'}?poi=${item?.PoiId || item?.POIId || ''}`;
  return <>
    <PageTitle title={canReview ? 'Duyệt nội dung' : 'Trạng thái gửi duyệt'}><button onClick={() => void data.reload()}>Làm mới</button></PageTitle>
    <p className="notice">Duyệt từng hồ sơ để công khai nội dung. Với audio, duyệt file đính kèm trước rồi duyệt bản ghi audio. Thay đổi chờ duyệt không thay thế bản đang công khai.</p>
    {message && <p className="notice" role="status">{message}</p>}
    <section className="panel">
      <Filters search={search} onSearch={s => { setSearch(s); setPage(1); setSelected(undefined); }}>
        <label>Trạng thái<select value={status} onChange={e => { setStatus(e.target.value); setPage(1); setSelected(undefined); }}><option value="Pending">Chờ duyệt</option><option value="Rejected">Bị từ chối</option><option value="Approved">Đã duyệt</option><option value="Superseded">Đã thay bằng bản mới</option></select></label>
        <label>Loại hồ sơ<select value={resource} onChange={e => { setResource(e.target.value); setPage(1); setSelected(undefined); }}><option value="">Tất cả</option>{Object.entries(names).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      </Filters>
      <State loading={data.loading} error={data.error} empty={!data.loading && !data.error && !data.data?.items.length} retry={() => void data.reload()}/>
      {!data.loading && !data.error && !!data.data?.items.length && <div className="table-scroll"><table><thead><tr><th>Hồ sơ</th><th>Người gửi</th><th>Ngày gửi</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{data.data.items.map(row => <tr key={String(row.Id)}><td>{names[String(row.Resource)]} #{row.EntityId}<small className="block">Đề xuất #{row.Id} · Phiên bản nền {row.BaseVersion}</small></td><td>{row.SubmittedBy || `Tài khoản #${row.SubmittedByUserId}`}</td><td>{dateLabel(row.SubmittedAt)}</td><td><ReviewStatus row={{ SubmissionStatus: row.Status, RejectionReason: row.RejectionReason }}/></td><td><button disabled={busy} onClick={() => { setSelected(row); setError(''); setRejecting(false); }}>Xem nội dung</button></td></tr>)}</tbody></table></div>}
      <Pagination page={page} total={data.data?.total} busy={data.loading || busy} onPage={setPage}/>
    </section>
    {selected && <section className="panel dossier"><h2>Hồ sơ {names[String(selected.Resource)]} #{selected.EntityId}</h2>
      {submission?.Operation === 'delete' && <p className="error">Đề xuất xóa nội dung. Chỉ xóa khỏi bản công khai sau khi duyệt.</p>}
      <State loading={detail.loading} error={detail.error} retry={() => void detail.reload()}/>
      {item && detail.data && <>
        <p>Người gửi: <strong>{detail.data.submitter?.Username || '—'}</strong> · {detail.data.submitter?.Email}<br/>Gửi lúc: {dateLabel(submission?.SubmittedAt)} · Phiên bản nền: {submission?.BaseVersion}</p>
        <ReviewStatus row={{ SubmissionStatus: submission?.Status || null, RejectionReason: submission?.RejectionReason || null }}/>
        <div className="table-scroll"><table className="comparison"><thead><tr><th>Thông tin</th><th>Bản hiện tại {detail.data.canonical.ReviewStatus === 'Approved' ? '(đã duyệt)' : '(chưa công khai)'}</th><th>Đề xuất</th></tr></thead><tbody>{Object.entries(fields).filter(([key]) => item[key] !== undefined || detail.data?.canonical[key] !== undefined).map(([key, label]) => <tr key={key}><th>{label}</th><td>{String(detail.data?.canonical[key] ?? '—')}</td><td className={JSON.stringify(item[key]) !== JSON.stringify(detail.data?.canonical[key]) ? 'changed-value' : ''}>{key === '_pois' ? JSON.stringify(item[key]) : String(item[key] ?? '—')}</td></tr>)}</tbody></table></div>
        {(selected.Resource === 'media' || (selected.Resource === 'audio' && item.FileUrl)) && <MediaPreview path={`cms/submissions/${selected.Id}/preview`} token={token} image={String(item.ContentType || item.FileType).toLowerCase().startsWith('image')}/>}</>}
      {error && !confirming && <p className="error" role="alert">{error}</p>}
      <div className="row-actions">
        {canReview && submission?.Status === 'Pending' && <><button className="primary" disabled={busy || detail.loading || !!detail.error} onClick={() => { setError(''); setConfirming(true); }}>Duyệt nội dung</button><button disabled={busy || detail.loading} onClick={() => setRejecting(true)}>Từ chối</button></>}
        {canWrite && submission?.Status === 'Rejected' && <><Link to={editPath}>Chỉnh sửa nội dung</Link><button disabled={busy} onClick={() => void action('resubmit')}>Gửi duyệt lại</button></>}
        <button disabled={busy} onClick={() => setSelected(undefined)}>Đóng</button>
      </div>
      {rejecting && <form className="reject-form" onSubmit={e => { e.preventDefault(); void action('reject', String(new FormData(e.currentTarget).get('reason'))); }}><label>Lý do từ chối<textarea name="reason" required minLength={1} maxLength={1000}/></label><p>Thao tác sẽ lưu lý do và giữ nguyên nội dung đã công khai trước đó.</p><button disabled={busy} className="primary">Xác nhận từ chối</button><button type="button" disabled={busy} onClick={() => setRejecting(false)}>Hủy</button></form>}
    </section>}
    {confirming && <ConfirmDialog title="Xác nhận duyệt hồ sơ" description={selected?.Operation === 'delete' ? 'Nội dung sẽ bị gỡ khỏi bản công khai. Bạn đã kiểm tra hồ sơ này?' : 'Nội dung đề xuất sẽ trở thành phiên bản đã duyệt. Bạn đã kiểm tra văn bản và các file đính kèm?'} busy={busy} error={error} onClose={() => setConfirming(false)} onConfirm={() => void action('approve')}/>}</>;
}
