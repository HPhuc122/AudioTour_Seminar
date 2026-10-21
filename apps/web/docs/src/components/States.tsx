import type { ReactNode } from 'react';
import { LoaderCircle, AlertCircle, Compass } from 'lucide-react';
export function State({ loading, error, empty, retry }: { loading?: boolean; error?: string; empty?: boolean; retry?: () => void }) {
  if (loading) return <div className="state" role="status"><LoaderCircle className="spin"/><p>Đang tải dữ liệu…</p></div>;
  if (error) return <div className="state error" role="alert"><AlertCircle/><p>{error}</p>{retry && <button onClick={retry}>Thử lại</button>}</div>;
  if (empty) return <div className="state"><Compass/><h3>Chưa có dữ liệu</h3><p>Nội dung sẽ xuất hiện khi được thêm và xuất bản.</p></div>;
  return null;
}
export function PageTitle({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) { return <div className="page-title"><div><span className="eyebrow">{eyebrow || 'AUDIOTOUR'}</span><h1>{title}</h1></div>{children}</div>; }
