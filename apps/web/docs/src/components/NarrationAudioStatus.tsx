import { useCallback } from 'react';
import { api } from '../services/api';
import { useResource } from '../hooks/useResource';
import { State } from './States';

type Job = { Id: number; NarrationId: number; SourceVersion: number; LanguageCode: string; Status: string; ready: boolean };
type Status = { schemaReady: boolean; automatic: boolean; ttsConfigured: boolean; translationConfigured: boolean; jobs: Job[]; total: number };
const labels: Record<string, string> = { Queued: 'Chờ tạo giọng', Processing: 'Đang tạo giọng', Succeeded: 'Đã tạo giọng', Failed: 'Tạo giọng thất bại', Superseded: 'Đã có văn bản mới' };

export function NarrationAudioStatus({ token, poiId }: { token: string; poiId: number }) {
  const data = useResource(useCallback(() => api.admin<Status>(`cms/automation/status?pageSize=20${poiId ? `&poiId=${poiId}` : ''}`, token), [token, poiId]));
  return <section className="panel">
    <div className="section-title"><h2>Tạo giọng từ văn bản</h2><button disabled={data.loading} onClick={() => void data.reload()}>Cập nhật trạng thái</button></div>
    <p>Nhập văn bản thuyết minh → gửi Admin duyệt → hệ thống tạo giọng nói → Mobile phát audio. Bản đang công khai được giữ đến khi audio mới tạo thành công.</p>
    <State loading={data.loading} error={data.error} retry={() => void data.reload()}/>
    {data.data && <>
      {(!data.data.schemaReady || !data.data.ttsConfigured || !data.data.automatic) && <p className="notice" role="status">Chưa sẵn sàng tạo giọng tự động. Cần cấu hình dịch vụ chuyển văn bản thành giọng nói và bật xử lý nền trên máy chủ.</p>}
      {!data.data.translationConfigured && <p className="notice">Chưa cấu hình dịch tự động. Audio ngoại ngữ cần dịch vụ dịch văn bản; tiếng Việt dùng trực tiếp văn bản nguồn.</p>}
      {!data.data.jobs?.length && <p>Chưa có yêu cầu tạo giọng. Yêu cầu được tạo khi Admin duyệt văn bản thuyết minh.</p>}
      {data.data.jobs?.map(job => <article className="list-item" key={job.Id}>
        <div><strong>Thuyết minh #{job.NarrationId} · bản {job.SourceVersion} · {job.LanguageCode}</strong><p>{labels[job.Status] || job.Status}{job.Status === 'Succeeded' && !job.ready ? ' · File chưa sẵn sàng' : ''}</p></div>
      </article>)}
      {data.data.total > 20 && <p>Hiển thị 20 yêu cầu mới nhất. Chọn địa điểm để xem đúng nội dung cần kiểm tra.</p>}
    </>}
  </section>;
}
