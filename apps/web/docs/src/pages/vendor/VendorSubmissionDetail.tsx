import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { State } from '../../components/States';
import { ReviewStatus } from '../../components/ReviewStatus';
import { MediaPreview } from '../../components/MediaPreview';
import { useResource } from '../../hooks/useResource';
import { api } from '../../services/api';
import type { Row } from '../../types';

export const submissionNames: Record<string, string> = { pois: 'Địa điểm', media: 'Hình ảnh / tệp', audio: 'Âm thanh', narrations: 'Thuyết minh', 'poi-translations': 'Bản dịch địa điểm', tours: 'Tour', 'tour-translations': 'Bản dịch tour' };
type Dossier = { submission: Row; canonical: Row; proposed: Row };
const fields: Record<string, string> = { Code: 'Mã', Name: 'Tên', Title: 'Tiêu đề', LanguageCode: 'Ngôn ngữ', ShortDescription: 'Mô tả ngắn', Description: 'Giới thiệu', TextContent: 'Thuyết minh', TTSText: 'Văn bản đọc', OriginalFileName: 'Tên tệp', Latitude: 'Vĩ độ', Longitude: 'Kinh độ', RadiusMeters: 'Bán kính (m)', Priority: 'Độ ưu tiên', CooldownSeconds: 'Thời gian chờ phát lại', MinDwellSeconds: 'Thời gian trong vùng' };
export function VendorSubmissionDetail({ id, token, onClose }: { id: number; token: string; onClose: () => void }) {
  const detail = useResource(useCallback(() => api.admin<Dossier>(`cms/review-dossier/${id}`, token), [id, token]));
  const dossier = detail.data;
  const poiId = dossier && (dossier.submission.Resource === 'pois' ? dossier.submission.EntityId : dossier.proposed.PoiId || dossier.proposed.POIId);
  const tab = dossier && ({ media: 'images', audio: 'audio', narrations: 'narrations', 'poi-translations': 'translations' }[String(dossier.submission.Resource)] || 'overview');
  return <section className="panel dossier" aria-label={`Hồ sơ gửi duyệt ${id}`}>
    <div className="section-title"><h2>Chi tiết hồ sơ #{id}</h2><button onClick={onClose}>Đóng hồ sơ</button></div>
    <State loading={detail.loading} error={detail.error} retry={() => void detail.reload()}/>
    {dossier && <>
      <p>{submissionNames[String(dossier.submission.Resource)] || 'Nội dung'} · {dossier.submission.Operation === 'delete' ? 'Yêu cầu xóa' : 'Đề xuất nội dung'}</p>
      <ReviewStatus row={{ SubmissionStatus: dossier.submission.Status, RejectionReason: dossier.submission.RejectionReason }}/>
      <div className="table-scroll"><table className="comparison"><thead><tr><th>Thông tin</th><th>Bản hiện tại</th><th>Nội dung gửi duyệt</th></tr></thead><tbody>{Object.entries(fields).filter(([key]) => dossier.proposed[key] != null || dossier.canonical[key] != null).map(([key, label]) => <tr key={key}><th>{label}</th><td>{String(dossier.canonical[key] ?? '—')}</td><td className={dossier.proposed[key] !== dossier.canonical[key] ? 'changed-value' : ''}>{String(dossier.proposed[key] ?? '—')}</td></tr>)}</tbody></table></div>
      {(dossier.submission.Resource === 'media' || (dossier.submission.Resource === 'audio' && dossier.proposed.FileUrl)) && <MediaPreview token={token} path={`cms/submissions/${id}/preview`} image={String(dossier.proposed.FileType).toLowerCase() === 'image' || String(dossier.proposed.ContentType).startsWith('image/')}/>}
      {poiId && <Link className="button" to={dossier.submission.Resource === 'pois' ? `/vendor/pois/${poiId}/edit` : `/vendor/pois/${poiId}?tab=${tab}`}>Mở nội dung để chỉnh sửa</Link>}
    </>}
  </section>;
}
