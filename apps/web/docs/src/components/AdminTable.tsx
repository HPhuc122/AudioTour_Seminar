import { useState, type ReactNode } from 'react';
export const reviewLabels: Record<string, string> = { Pending: 'Chờ duyệt', Approved: 'Đã duyệt', Rejected: 'Bị từ chối', Superseded: 'Đã thay bằng bản mới' };
export const roleLabels: Record<string, string> = { Admin: 'Quản trị viên', SuperAdmin: 'Quản trị cấp cao', Vendor: 'Chủ sạp', ContentAdmin: 'Quản lý nội dung', TourOperator: 'Điều hành tour', AnalyticsViewer: 'Xem thống kê', Guest: 'Khách' };
export function Filters({ search, onSearch, status, onStatus, options = reviewLabels, children }: { search: string; onSearch: (s: string) => void; status?: string; onStatus?: (s: string) => void; options?: Record<string, string>; children?: ReactNode }) {
  const [input, setInput] = useState(search);
  return <form className="table-toolbar admin-filters" onSubmit={e => { e.preventDefault(); onSearch(input.trim()); }}><label>Tìm kiếm<input aria-label="Tìm kiếm" name="search" placeholder="Tên, mã hoặc tài khoản…" value={input} onChange={e => setInput(e.target.value)}/></label>{onStatus && <label>Trạng thái<select aria-label="Trạng thái" value={status} onChange={e => onStatus(e.target.value)}><option value="">Tất cả</option>{Object.entries(options).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>}{children}<button type="submit">Tìm kiếm</button></form>;
}
export function Pagination({ page, total = 0, size = 25, busy, onPage }: { page: number; total?: number; size?: number; busy?: boolean; onPage: (p: number) => void }) {
  return <div className="pagination"><span>{total.toLocaleString('vi-VN')} bản ghi · Trang {page}/{Math.max(1, Math.ceil(total / size))}</span><button disabled={page <= 1 || busy} onClick={() => onPage(page - 1)}>Trước</button><button disabled={page * size >= total || busy} onClick={() => onPage(page + 1)}>Sau</button></div>;
}
export function ConfirmDialog({ title, description, busy, error, onConfirm, onClose }: { title: string; description: string; busy: boolean; error?: string; onConfirm: () => void; onClose: () => void }) {
  return <div className="modal-backdrop"><section className="modal confirm-modal" role="dialog" aria-modal="true" aria-label={title}><h2>{title}</h2><p>{description}</p>{error && <p className="error" role="alert">{error}</p>}<div className="form-actions"><button disabled={busy} onClick={onClose}>Hủy</button><button className="primary" disabled={busy} onClick={onConfirm}>{busy ? 'Đang xử lý…' : 'Xác nhận duyệt'}</button></div></section></div>;
}
