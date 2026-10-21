import type { Row } from '../types';

export function ReviewStatus({ row }: { row: Row }) {
  const status = String(row.SubmissionStatus || row.ReviewStatus || row.ApprovalStatus || '');
  if (!status) return null;
  const labels: Record<string, string> = { Pending: 'Chờ duyệt', Approved: 'Đã duyệt', Rejected: 'Bị từ chối', Superseded: 'Đã thay bằng bản mới' };
  return <div><span className={`badge ${status === 'Approved' ? 'success' : ''}`}>{labels[status] || status}</span>{row.RejectionReason && <p className="error">Lý do: {row.RejectionReason}</p>}{row.PublicVersion && status !== 'Approved' && <small>Mobile tiếp tục dùng phiên bản đã công khai, nếu có.</small>}</div>;
}
