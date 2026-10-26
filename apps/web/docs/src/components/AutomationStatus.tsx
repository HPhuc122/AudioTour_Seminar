import { useCallback, useEffect, useState } from 'react';
import { api, json } from '../services/api';
import { adminRoles, useSession } from '../contexts/Session';
import { useResource } from '../hooks/useResource';
import { State } from './States';

type Job = { Id: number; PoiId: number; NarrationId: number; SourceVersion: number; LanguageCode: string; Status: string; Attempts: number; MaxAttempts: number; ErrorCode?: string; ErrorMessage?: string; ready?: boolean };
type Status = { schemaReady: boolean; automatic: boolean; missingConfiguration: string[]; jobs: Job[]; total: number };
const labels: Record<string, string> = { Queued: 'Chờ xử lý', Processing: 'Đang xử lý', Succeeded: 'Hoàn tất', Failed: 'Thất bại', Superseded: 'Đã thay bằng phiên bản mới' };
function jobMessage(job: Job) {
  if (!job.ErrorCode && !job.ErrorMessage) return '—';
  if (['MissingConfiguration', 'AdapterConfiguration', 'AzureAuthentication', 'AdapterAuthentication'].includes(job.ErrorCode || '')) return 'Dịch vụ xử lý chưa sẵn sàng. Vui lòng liên hệ quản trị viên.';
  if (job.ErrorCode === 'ProviderResultUnknown') return 'Cần kiểm tra kết quả trước khi xử lý lại.';
  if (job.ErrorCode === 'IdempotencyConflict') return 'Phiên bản nội dung cần được kiểm tra lại.';
  if (job.Status === 'Queued') return 'Đang chờ thử lại.';
  return 'Chưa xử lý được nội dung. Vui lòng thử lại.';
}

export function AutomationStatus({ poiId }: { poiId?: number }) {
  const { session } = useSession();
  const token = session!.accessToken;
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState<number>();
  const [error, setError] = useState('');
  const data = useResource(useCallback(() => api.admin<Status>(`cms/automation/status?page=${page}&pageSize=25${poiId ? `&poiId=${poiId}` : ''}`, token), [page, poiId, token]));
  const reload = data.reload;
  useEffect(() => { const timer = setInterval(() => void reload(), 10000); return () => clearInterval(timer); }, [reload]);
  return <section className="panel"><div className="section-title"><h2>Dịch và tạo giọng đọc theo ngôn ngữ</h2><button onClick={() => void reload()}>Làm mới</button></div>
    <p>Văn bản được duyệt một lần. Mỗi ngôn ngữ được công khai khi cả bản dịch và âm thanh hoàn tất; trong lúc chờ vẫn giữ bản cũ.</p>
    <State loading={data.loading} error={data.error} retry={() => void reload()}/>
    {error && <p className="error" role="alert">{error}</p>}
    {data.data && <>
      {!data.data.schemaReady && <p className="error">Dịch vụ xử lý nội dung chưa sẵn sàng. Vui lòng liên hệ quản trị viên.</p>}
      {data.data.schemaReady && (!data.data.automatic || data.data.missingConfiguration.length > 0) && <p className="notice">Dịch và tạo giọng đọc đang chờ kích hoạt. Nội dung đã duyệt được giữ lại và sẽ xử lý khi dịch vụ sẵn sàng.</p>}
      {data.data.jobs.length ? <div className="table-scroll"><table><thead><tr><th>POI / thuyết minh</th><th>Ngôn ngữ</th><th>Trạng thái</th><th>Số lần thử</th><th>Thông tin</th><th>Thao tác</th></tr></thead><tbody>{data.data.jobs.map(job => <tr key={job.Id}>
        <td>POI #{job.PoiId} · Thuyết minh #{job.NarrationId}<small className="block">Phiên bản {job.SourceVersion} · Tác vụ #{job.Id}</small></td>
        <td>{job.LanguageCode}</td><td>{labels[job.Status] || job.Status}{job.Status === 'Succeeded' && !job.ready && <small className="block">Tệp chưa khả dụng hoặc đã được thay bằng phiên bản mới</small>}</td><td>{job.Attempts}/{job.MaxAttempts}</td><td>{jobMessage(job)}</td>
        <td>{job.Status === 'Failed' && adminRoles.includes(session!.role) && !['ProviderResultUnknown', 'IdempotencyConflict'].includes(job.ErrorCode || '') && <button disabled={busy !== undefined || !data.data?.automatic || !!data.data?.missingConfiguration.length} onClick={async () => { setBusy(job.Id); setError(''); try { await api.admin(`cms/automation/jobs/${job.Id}/retry`, token, json('POST', {})); await reload(); } catch { setError('Chưa thể xử lý lại nội dung. Vui lòng thử lại sau.'); } finally { setBusy(undefined); } }}>{busy === job.Id ? 'Đang gửi…' : 'Chạy lại'}</button>}</td>
      </tr>)}</tbody></table></div> : <p>Chưa có tác vụ. Tác vụ sẽ được tạo khi Admin duyệt thuyết minh.</p>}
      <div className="row-actions"><button disabled={page === 1 || data.loading} onClick={() => setPage(value => value - 1)}>Trước</button><span>Trang {page}</span><button disabled={page * 25 >= data.data.total || data.loading} onClick={() => setPage(value => value + 1)}>Sau</button></div>
    </>}
  </section>;
}
