import { useCallback } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  ClipboardList,
  MapPin,
  Plus,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageTitle, State } from '../../components/States';
import { useSession } from '../../contexts/Session';
import { useResource } from '../../hooks/useResource';
import { api } from '../../services/api';
import type { Page, Row } from '../../types';

type Summary = {
  pois: number;
  media: number;
  missingMedia: number;
  expiring: number;
  expired: number;
};

export function VendorDashboard() {
  const { session } = useSession();
  const token = session!.accessToken;

  const summary = useResource(
    useCallback(
      () => api.admin<Summary>('cms/console-summary', token),
      [token],
    ),
  );
  const submissions = useResource(
    useCallback(
      () =>
        api.admin<Page<Row>>(
          'cms/review-queue?status=Pending&page=1&pageSize=1',
          token,
        ),
      [token],
    ),
  );
  const pois = useResource(
    useCallback(
      () =>
        api.admin<Page<Row>>(
          'cms/catalog/pois?page=1&pageSize=5&search=',
          token,
        ),
      [token],
    ),
  );
  const expiring = summary.data?.expiring ?? 0;
  const expired = summary.data?.expired ?? 0;

  return (
    <>
      <PageTitle eyebrow="KHU VỰC CHỦ SẠP" title="Tổng quan sạp">
        <Link className="primary button" to="/vendor/pois/new">
          <Plus size={18} />
          Thêm địa điểm
        </Link>
      </PageTitle>

      <p className="vendor-intro">
        Quản lý các địa điểm thuộc tài khoản của bạn, cập nhật nội dung và theo
        dõi tiến trình xét duyệt. Nội dung đã được duyệt mới được hiển thị cho
        khách tham quan.
      </p>

      {summary.error && (
        <State
          error={summary.error}
          retry={() => void summary.reload()}
        />
      )}
      {submissions.error && (
        <State
          error={submissions.error}
          retry={() => void submissions.reload()}
        />
      )}

      <div className="vendor-stat-grid">
        <Link className="vendor-stat-card" to="/vendor/pois">
          <span className="vendor-stat-icon">
            <MapPin size={20} />
          </span>
          <span>Địa điểm của tôi</span>
          <strong>
            {summary.loading ? '—' : (summary.data?.pois ?? 0).toLocaleString('vi-VN')}
          </strong>
          <small>Trong phạm vi tài khoản</small>
        </Link>

        <Link className="vendor-stat-card" to="/vendor/submissions">
          <span className="vendor-stat-icon">
            <ClipboardList size={20} />
          </span>
          <span>Đang chờ duyệt</span>
          <strong>
            {submissions.loading
              ? '—'
              : (submissions.data?.total ?? 0).toLocaleString('vi-VN')}
          </strong>
          <small>Hồ sơ nội dung của bạn</small>
        </Link>

        <Link className="vendor-stat-card" to="/vendor/pois">
          <span className="vendor-stat-icon">
            <AlertTriangle size={20} />
          </span>
          <span>File media cần kiểm tra</span>
          <strong>
            {summary.loading
              ? '—'
              : (summary.data?.missingMedia ?? 0).toLocaleString('vi-VN')}
          </strong>
          <small>File bị thiếu trên máy chủ</small>
        </Link>
      </div>

      {expiring > 0 || expired > 0 ? (
        <div className="vendor-notice" role="status">
          <AlertTriangle size={20} />
          <p>
            Có {expiring} địa điểm sắp hết hạn và {expired} địa điểm đã hết hạn.
            Thời hạn do Admin quản
            lý; trang Chủ sạp hiện chỉ hiển thị thông báo.
          </p>
        </div>
      ) : null}

      <section className="panel vendor-panel">
        <div className="vendor-section-heading">
          <div>
            <span className="eyebrow">NỘI DUNG</span>
            <h2>Địa điểm gần đây</h2>
          </div>
          <Link to="/vendor/pois">
            Xem tất cả <ArrowRight size={16} />
          </Link>
        </div>

        <State
          loading={pois.loading}
          error={pois.error}
          retry={() => void pois.reload()}
          empty={!pois.loading && !pois.error && !pois.data?.items.length}
        />

        {pois.data?.items.length ? (
          <div className="vendor-recent-list">
            {pois.data.items.map((poi) => (
              <Link
                className="vendor-recent-item"
                key={String(poi.Id)}
                to={`/vendor/pois/${poi.Id}`}
              >
                <span className="vendor-recent-pin">
                  <MapPin size={18} />
                </span>
                <span className="vendor-recent-copy">
                  <strong>{String(poi.Name || poi.Code || `POI #${poi.Id}`)}</strong>
                  <small>
                    {String(poi.Category || 'Chưa phân loại')} · Mã{' '}
                    {String(poi.Code || poi.Id)}
                  </small>
                </span>
                <ArrowRight size={17} />
              </Link>
            ))}
          </div>
        ) : null}
      </section>

    </>
  );
}
