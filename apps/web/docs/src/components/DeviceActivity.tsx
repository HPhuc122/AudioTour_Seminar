import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api';
import { useResource } from '../hooks/useResource';
import { Filters, Pagination, roleLabels } from './AdminTable';
import { State } from './States';

type Device = { Id: number; DeviceId: string; UserId: number | null; Username: string | null; Role: string | null; Platform: string; AppVersion: string | null; OsVersion: string | null; LastSeenAt: string; IsActive: boolean; ActiveDevicesForUser: number };
type Activity = { summary: { totalDevices: number; activeDevices: number; activeUsers: number }; items: Device[]; total: number; page: number; pageSize: number; activeWindowMinutes: number; serverTime: string };
function dateLabel(value: string) {
  // SQL Server datetime2 is UTC but its JSON representation has no suffix.
  return new Date(/(?:Z|[+-]\d\d:\d\d)$/i.test(value) ? value : value + 'Z').toLocaleString('vi-VN');
}
export function DeviceActivity({ token }: { token: string }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [activeOnly, setActiveOnly] = useState(true);
  const query = new URLSearchParams({ page: String(page), pageSize: '20', search, activeOnly: String(activeOnly) }).toString();
  const data = useResource(useCallback(() => api.admin<Activity>(`cms/device-activity?${query}`, token), [query, token]));
  const reload = data.reload;
  useEffect(() => {
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void reload(); }, 30000);
    return () => clearInterval(timer);
  }, [reload]);
  return <section className="panel device-activity" aria-label="Thiết bị truy cập">
    <div className="section-title"><h2>Thiết bị truy cập</h2><button onClick={() => void reload()}>Làm mới thiết bị</button></div>
    <p>Hoạt động trong 5 phút gần nhất. Web gửi tín hiệu mỗi phút khi tab hiển thị; bảng tự cập nhật mỗi 30 giây. Sau khi đóng tab hoặc đăng xuất, thiết bị có thể còn trong khoảng 5 phút này.</p>
    <State loading={data.loading} error={data.error} retry={() => void reload()}/>
    {data.data && <div className="device-stats" aria-label="Thống kê thiết bị">
      <div><span>Thiết bị hoạt động</span><strong>{data.data.summary.activeDevices.toLocaleString('vi-VN')}</strong></div>
      <div><span>Tài khoản hoạt động</span><strong>{data.data.summary.activeUsers.toLocaleString('vi-VN')}</strong></div>
      <div><span>Thiết bị đã ghi nhận</span><strong>{data.data.summary.totalDevices.toLocaleString('vi-VN')}</strong></div>
    </div>}
    <Filters search={search} onSearch={value => { setSearch(value); setPage(1); }}><label className="check"><input type="checkbox" checked={activeOnly} onChange={e => { setActiveOnly(e.target.checked); setPage(1); }}/>Chỉ thiết bị hoạt động</label></Filters>
    {!data.loading && !data.error && data.data && <>
      {data.data.items.length ? <div className="table-scroll"><table><thead><tr><th>Tài khoản</th><th>Thiết bị / trình duyệt</th><th>Nền tảng</th><th>Truy cập gần nhất</th><th>Trạng thái</th></tr></thead><tbody>{data.data.items.map(device => <tr key={device.Id}>
        <td><strong>{device.Username || 'Khách chưa đăng nhập'}</strong><small>{device.Role ? roleLabels[device.Role] || device.Role : 'Khách'}</small>{device.UserId != null && <small>{device.ActiveDevicesForUser} thiết bị hoạt động của tài khoản</small>}</td>
        <td>{device.DeviceId}<small>{[device.OsVersion, device.AppVersion].filter(Boolean).join(' · ')}</small></td>
        <td>{device.Platform === 'web' ? 'Web' : device.Platform}</td><td>{dateLabel(device.LastSeenAt)}</td>
        <td><span className={`badge ${device.IsActive ? 'success' : ''}`}>{device.IsActive ? 'Hoạt động gần đây' : 'Không hoạt động gần đây'}</span></td>
      </tr>)}</tbody></table></div> : <p>Không có thiết bị phù hợp.</p>}
      <Pagination page={page} total={data.data.total} size={20} onPage={setPage}/>
      <small>Cập nhật lúc {dateLabel(data.data.serverTime)}. Chỉ thống kê ứng dụng đã gửi tín hiệu thiết bị; nhiều tab cùng tài khoản trong một trình duyệt được tính một thiết bị.</small>
    </>}
  </section>;
}
