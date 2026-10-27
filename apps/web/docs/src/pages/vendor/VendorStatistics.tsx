import { useCallback, useState, type FormEvent } from 'react';
import { PageTitle, State } from '../../components/States';
import { useSession } from '../../contexts/Session';
import { useResource } from '../../hooks/useResource';
import { api } from '../../services/api';

type Statistics = {
  summary: { plays: number; durationSeconds: number };
  dates: { groupKey: string; plays: number }[];
  popular: { poiId: number; groupKey: string; plays: number }[];
};

export function VendorStatistics() {
  const { session } = useSession();
  const token = session!.accessToken;
  const [range, setRange] = useState({ startDate: '', endDate: '' });
  const [formError, setFormError] = useState('');

  const stats = useResource(
    useCallback(() => {
      const query = new URLSearchParams(
        Object.entries(range).filter(([, value]) => value),
      );
      return api.admin<Statistics>(`cms/statistics?${query}`, token);
    }, [range, token]),
  );

  function applyRange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const startDate = String(form.get('startDate') || '');
    const endDate = String(form.get('endDate') || '');
    if (startDate && endDate && endDate < startDate) {
      setFormError('Ngày kết thúc phải từ ngày bắt đầu trở đi.');
      return;
    }
    setFormError('');
    setRange({ startDate, endDate });
  }

  return (
    <>
      <PageTitle eyebrow="HIỆU QUẢ NỘI DUNG" title="Thống kê của tôi" />
      <p className="vendor-intro">
        Thống kê được giới hạn theo các POI bạn sở hữu hoặc được cấp quyền.
        Nhật ký kích hoạt không đồng nghĩa với lượt nghe hoàn tất.
      </p>

      <section className="panel vendor-panel">
        <form className="vendor-date-filter" onSubmit={applyRange}>
          <label>
            Từ ngày (UTC)
            <input defaultValue={range.startDate} name="startDate" type="date" />
          </label>
          <label>
            Đến ngày (UTC)
            <input defaultValue={range.endDate} name="endDate" type="date" />
          </label>
          <button className="primary">Lọc thống kê</button>
        </form>
        {formError && <p className="error" role="alert">{formError}</p>}

        <State
          loading={stats.loading}
          error={stats.error}
          retry={() => void stats.reload()}
        />

        {stats.data ? (
          <>
            <div className="vendor-stat-grid vendor-stat-grid-compact">
              <div className="vendor-stat-card">
                <span>Lượt ghi nhận</span>
                <strong>{stats.data.summary.plays.toLocaleString('vi-VN')}</strong>
                <small>Không nhất thiết là lượt nghe hoàn tất</small>
              </div>
              <div className="vendor-stat-card">
                <span>Thời lượng được ghi nhận</span>
                <strong>
                  {Math.round(stats.data.summary.durationSeconds / 60).toLocaleString('vi-VN')}
                </strong>
                <small>Phút · phụ thuộc dữ liệu log hiện có</small>
              </div>
              <div className="vendor-stat-card">
                <span>Địa điểm có dữ liệu</span>
                <strong>{stats.data.popular.length.toLocaleString('vi-VN')}</strong>
                <small>Trong phạm vi tài khoản</small>
              </div>
            </div>

            <div className="vendor-stat-tables">
              <section>
                <h2>Lượt ghi nhận theo ngày</h2>
                {stats.data.dates.length ? (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr><th>Ngày</th><th>Lượt</th></tr>
                      </thead>
                      <tbody>
                        {stats.data.dates.map((item) => (
                          <tr key={item.groupKey}>
                            <td>{item.groupKey.slice(0, 10)}</td>
                            <td>{item.plays.toLocaleString('vi-VN')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <p>Chưa có dữ liệu trong khoảng thời gian này.</p>}
              </section>
              <section>
                <h2>Địa điểm được quan tâm</h2>
                {stats.data.popular.length ? (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr><th>Địa điểm</th><th>Lượt</th></tr>
                      </thead>
                      <tbody>
                        {stats.data.popular.map((item) => (
                          <tr key={`${item.poiId}-${item.groupKey}`}>
                            <td>{item.groupKey}</td>
                            <td>{item.plays.toLocaleString('vi-VN')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <p>Chưa có dữ liệu trong khoảng thời gian này.</p>}
              </section>
            </div>
          </>
        ) : null}
      </section>
    </>
  );
}
