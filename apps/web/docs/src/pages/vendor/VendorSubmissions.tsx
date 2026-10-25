import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageTitle, State } from '../../components/States';
import { ReviewStatus } from '../../components/ReviewStatus';
import { useSession } from '../../contexts/Session';
import { useResource } from '../../hooks/useResource';
import { api, json } from '../../services/api';
import type { Page, Row } from '../../types';

export function VendorSubmissions() {
  const { session } = useSession();
  const token = session!.accessToken;
  const [status, setStatus] = useState('Pending');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<number>();
  const [message, setMessage] = useState('');
  const [actionError, setActionError] = useState('');

  const data = useResource(
    useCallback(
      () =>
        api.admin<Page<Row>>(
          `cms/review-queue?${new URLSearchParams({
            status,
            search,
            page: String(page),
            pageSize: '25',
          })}`,
          token,
        ),
      [status, search, page, token],
    ),
  );

  async function resubmit(row: Row) {
    const id = Number(row.EntityId);
    const resource = String(row.Resource);
    if (!id || !['pois', 'media', 'audio', 'narrations', 'poi-translations'].includes(resource)) {
      setActionError('Không thể gửi lại loại nội dung này từ khu vực Chủ sạp.');
      return;
    }

    setBusyId(Number(row.Id));
    setActionError('');
    setMessage('');
    try {
      await api.admin(
        `cms/${encodeURIComponent(resource)}/${id}/resubmit`,
        token,
        json('POST', {}),
      );
      setMessage('Đã gửi nội dung lại để Admin xem xét.');
      await data.reload();
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Gửi lại thất bại.');
    } finally {
      setBusyId(undefined);
    }
  }

  return (
    <>
      <PageTitle eyebrow="THEO DÕI NỘI DUNG" title="Hồ sơ gửi duyệt">
        <Link className="button" to="/vendor/pois">
          Mở địa điểm của tôi
        </Link>
      </PageTitle>
      <p className="vendor-intro">
        Bạn có thể theo dõi kết quả và gửi lại nội dung bị từ chối. Quyền duyệt
        hoặc từ chối thuộc về Admin.
      </p>

      <section className="panel vendor-panel">
        <div className="vendor-toolbar">
          <label>
            Tìm hồ sơ
            <input
              placeholder="Tên, mã địa điểm hoặc mã hồ sơ"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </label>
          <label>
            Trạng thái
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              <option value="Pending">Chờ duyệt</option>
              <option value="Rejected">Bị từ chối</option>
              <option value="Approved">Đã duyệt</option>
              <option value="Superseded">Đã thay bằng bản mới</option>
            </select>
          </label>
        </div>

        {message && <p className="notice" role="status">{message}</p>}
        {actionError && <p className="error" role="alert">{actionError}</p>}
        <State
          loading={data.loading}
          error={data.error}
          retry={() => void data.reload()}
          empty={!data.loading && !data.error && !data.data?.items.length}
        />
        {data.data?.items.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Nội dung</th>
                  <th>Gửi lúc</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {data.data.items.map((row) => (
                  <tr key={String(row.Id)}>
                    <td>
                      <strong>
                        {String(row.Resource)} · #{String(row.EntityId)}
                      </strong>
                      <small>Hồ sơ #{String(row.Id)}</small>
                    </td>
                    <td>
                      {row.SubmittedAt
                        ? new Date(String(row.SubmittedAt)).toLocaleString('vi-VN')
                        : '—'}
                    </td>
                    <td>
                      <ReviewStatus
                        row={{
                          SubmissionStatus: row.Status as Row[string],
                          RejectionReason: row.RejectionReason as Row[string],
                        }}
                      />
                    </td>
                    <td>
                      {row.Status === 'Rejected' ? (
                        <button
                          disabled={busyId === Number(row.Id)}
                          onClick={() => void resubmit(row)}
                        >
                          {busyId === Number(row.Id) ? 'Đang gửi…' : 'Gửi lại'}
                        </button>
                      ) : (
                        <span className="muted">Theo dõi trạng thái</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {data.data && data.data.total > 25 ? (
          <div className="vendor-pagination">
            <button
              disabled={page <= 1 || data.loading}
              onClick={() => setPage((value) => value - 1)}
            >
              Trang trước
            </button>
            <span>
              Trang {page} · {data.data.total.toLocaleString('vi-VN')} hồ sơ
            </span>
            <button
              disabled={page * 25 >= data.data.total || data.loading}
              onClick={() => setPage((value) => value + 1)}
            >
              Trang sau
            </button>
          </div>
        ) : null}
      </section>
    </>
  );
}
