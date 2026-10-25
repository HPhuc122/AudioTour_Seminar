import { useCallback, useState, type FormEvent, type ReactNode } from 'react';
import {
  ArrowLeft,
  ClipboardList,
  Download,
  ImagePlus,
  MapPin,
  Plus,
  RefreshCw,
} from 'lucide-react';
import QRCode from 'qrcode';
import {
  Link,
  Navigate,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { AudioUploadDialog } from '../../components/AudioUploadDialog';
import { MediaPreview } from '../../components/MediaPreview';
import { ReviewStatus } from '../../components/ReviewStatus';
import { PageTitle, State } from '../../components/States';
import { useSession } from '../../contexts/Session';
import { useResource } from '../../hooks/useResource';
import { api, json } from '../../services/api';
import type { Page, Row } from '../../types';

const pageSize = 20;

function statusLabel(row: Row) {
  return row.SubmissionStatus || row.ReviewStatus || row.ApprovalStatus
    ? <ReviewStatus row={row} />
    : <span className="badge">Chưa gửi duyệt</span>;
}

export function VendorPoiList() {
  const { session } = useSession();
  const token = session!.accessToken;
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const page = Math.max(1, Number(searchParams.get('page') || 1));

  const data = useResource(
    useCallback(() => {
      const query = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        search,
        status,
      });
      return api.admin<Page<Row>>(`cms/catalog/pois?${query}`, token);
    }, [page, search, status, token]),
  );

  function updateQuery(next: { search?: string; status?: string; page?: number }) {
    const params = new URLSearchParams(searchParams);
    if (next.search !== undefined) {
      if (next.search) {
        params.set('search', next.search);
      } else {
        params.delete('search');
      }
      params.delete('page');
    }
    if (next.status !== undefined) {
      if (next.status) {
        params.set('status', next.status);
      } else {
        params.delete('status');
      }
      params.delete('page');
    }
    if (next.page !== undefined) {
      if (next.page > 1) {
        params.set('page', String(next.page));
      } else {
        params.delete('page');
      }
    }
    setSearchParams(params);
  }

  return (
    <>
      <PageTitle eyebrow="QUẢN LÝ NỘI DUNG" title="Địa điểm của tôi">
        <Link className="primary button" to="/vendor/pois/new">
          <Plus size={18} />
          Tạo địa điểm
        </Link>
      </PageTitle>

      <section className="panel vendor-panel">
        <div className="vendor-toolbar">
          <label>
            Tìm địa điểm
            <input
              placeholder="Nhập tên hoặc mã địa điểm"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                updateQuery({ search: event.target.value });
              }}
            />
          </label>
          <label>
            Trạng thái gửi duyệt
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                updateQuery({ status: event.target.value });
              }}
            >
              <option value="">Tất cả trạng thái</option>
              <option value="Pending">Chờ duyệt</option>
              <option value="Approved">Đã duyệt</option>
              <option value="Rejected">Bị từ chối</option>
            </select>
          </label>
          <button
            aria-label="Tải lại danh sách"
            onClick={() => void data.reload()}
          >
            <RefreshCw size={16} />
            Làm mới
          </button>
        </div>

        <State
          loading={data.loading}
          error={data.error}
          retry={() => void data.reload()}
          empty={!data.loading && !data.error && !data.data?.items.length}
        />

        {data.data?.items.length ? (
          <>
            <div className="vendor-poi-grid">
              {data.data.items.map((poi) => (
                <article className="vendor-poi-card" key={String(poi.Id)}>
                  <div className="vendor-poi-card-top">
                    <span className="vendor-poi-symbol">
                      <MapPin size={20} />
                    </span>
                    {statusLabel(poi)}
                  </div>
                  <h2>{String(poi.Name || 'Chưa đặt tên')}</h2>
                  <p className="vendor-poi-code">
                    {String(poi.Code || `POI #${poi.Id}`)}
                    {poi.Category ? ` · ${String(poi.Category)}` : ''}
                  </p>
                  <p className="vendor-poi-description">
                    {String(poi.ShortDescription || poi.Description || 'Chưa có mô tả.')}
                  </p>
                  <div className="vendor-poi-card-footer">
                    <span>
                      Bán kính: {String(poi.RadiusMeters ?? '—')} m
                    </span>
                    <Link to={`/vendor/pois/${poi.Id}`}>Mở chi tiết</Link>
                  </div>
                </article>
              ))}
            </div>

            <div className="vendor-pagination">
              <button
                disabled={page <= 1 || data.loading}
                onClick={() => updateQuery({ page: page - 1 })}
              >
                Trang trước
              </button>
              <span>
                Trang {page} · {data.data.total.toLocaleString('vi-VN')} địa điểm
              </span>
              <button
                disabled={page * pageSize >= data.data.total || data.loading}
                onClick={() => updateQuery({ page: page + 1 })}
              >
                Trang sau
              </button>
            </div>
          </>
        ) : null}
      </section>
    </>
  );
}

type VendorPoiField = {
  key: string;
  label: string;
  required?: boolean;
  wide?: boolean;
  textarea?: boolean;
  number?: boolean;
};

const formFields: VendorPoiField[] = [
  { key: 'Code', label: 'Mã địa điểm', required: true },
  { key: 'Name', label: 'Tên địa điểm', required: true },
  { key: 'Category', label: 'Danh mục' },
  { key: 'ShortDescription', label: 'Mô tả ngắn', wide: true },
  { key: 'Description', label: 'Giới thiệu', wide: true, textarea: true },
  { key: 'Latitude', label: 'Vĩ độ', required: true, number: true },
  { key: 'Longitude', label: 'Kinh độ', required: true, number: true },
  { key: 'RadiusMeters', label: 'Bán kính kích hoạt (m)', number: true },
  { key: 'Priority', label: 'Độ ưu tiên', number: true },
  { key: 'CooldownSeconds', label: 'Thời gian chờ phát lại (giây)', number: true },
  { key: 'MinDwellSeconds', label: 'Thời gian tối thiểu trong vùng (giây)', number: true },
];

export function VendorPoiEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { session } = useSession();
  const token = session!.accessToken;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const editing = Boolean(id);
  const poi = useResource(
    useCallback(
      () => (id ? api.admin<Row>(`pois/${encodeURIComponent(id)}`, token) : Promise.resolve(null)),
      [id, token],
    ),
  );

  if (poi.error && id) {
    return (
      <>
        <PageTitle title="Không tải được địa điểm" />
        <State error={poi.error} retry={() => void poi.reload()} />
        <Link className="back-link" to="/vendor/pois">
          <ArrowLeft size={16} /> Quay lại danh sách
        </Link>
      </>
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload: Record<string, string | number | null> = {};

    for (const field of formFields) {
      const value = String(form.get(field.key) || '').trim();
      if (field.required && !value) {
        setError(`Vui lòng nhập ${field.label.toLowerCase()}.`);
        return;
      }
      if (field.number) {
        if (!value) {
          payload[field.key] = null;
          continue;
        }
        const number = Number(value);
        if (!Number.isFinite(number)) {
          setError(`${field.label} phải là một số hợp lệ.`);
          return;
        }
        if (
          (field.key === 'Latitude' && (number < -90 || number > 90)) ||
          (field.key === 'Longitude' && (number < -180 || number > 180)) ||
          (field.key === 'RadiusMeters' && number <= 0) ||
          (['Priority', 'CooldownSeconds', 'MinDwellSeconds'].includes(field.key) &&
            number < 0)
        ) {
          setError(`${field.label} không nằm trong giới hạn cho phép.`);
          return;
        }
        payload[field.key] = number;
      } else {
        payload[field.key] = value;
      }
    }

    setSaving(true);
    setError('');
    try {
      if (id) {
        await api.admin(`pois/${encodeURIComponent(id)}`, token, json('PUT', payload));
      } else {
        await api.admin('pois', token, json('POST', payload));
      }
      navigate('/vendor/pois', { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không lưu được địa điểm.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Link className="back-link" to={editing && id ? `/vendor/pois/${id}` : '/vendor/pois'}>
        <ArrowLeft size={16} /> Quay lại
      </Link>
      <PageTitle
        eyebrow="THÔNG TIN ĐỊA ĐIỂM"
        title={editing ? 'Chỉnh sửa địa điểm' : 'Tạo địa điểm mới'}
      />
      <div className="vendor-notice">
        <ClipboardList aria-hidden="true" size={20} />
        <p>
          Thay đổi sẽ được gửi vào quy trình duyệt. Chủ sạp không thể tự duyệt
          hoặc thay đổi trạng thái công khai.
        </p>
      </div>
      {editing && poi.loading ? (
        <State loading />
      ) : (
        <section className="panel vendor-panel">
          <form className="vendor-form" onSubmit={(event) => void submit(event)}>
            <div className="vendor-form-section">
              <h2>Thông tin cơ bản</h2>
              <p>Mô tả rõ ràng giúp khách tham quan nhận biết địa điểm.</p>
              <div className="vendor-form-grid">
                {formFields.slice(0, 5).map((field) => (
                  <label
                    className={field.wide ? 'vendor-field-wide' : ''}
                    key={field.key}
                  >
                    {field.label}
                    {field.required ? ' *' : ''}
                    {field.textarea ? (
                      <textarea
                        defaultValue={String(poi.data?.[field.key] ?? '')}
                        maxLength={4000}
                        name={field.key}
                        required={field.required}
                      />
                    ) : (
                      <input
                        defaultValue={String(poi.data?.[field.key] ?? '')}
                        maxLength={field.key === 'Code' ? 100 : undefined}
                        name={field.key}
                        required={field.required}
                        type="text"
                      />
                    )}
                  </label>
                ))}
              </div>
            </div>

            <div className="vendor-form-section">
              <h2>Vị trí và kích hoạt</h2>
              <p>
                Tọa độ và bán kính được dùng để xác định vùng nhận diện POI
                trong ứng dụng tham quan.
              </p>
              <div className="vendor-form-grid">
                {formFields.slice(5).map((field) => (
                  <label key={field.key}>
                    {field.label}
                    {field.required ? ' *' : ''}
                    <input
                      defaultValue={String(
                        poi.data?.[field.key] ??
                          (field.key === 'RadiusMeters'
                            ? 50
                            : field.key === 'Priority'
                              ? 1
                              : field.key === 'CooldownSeconds'
                                ? 120
                                : field.key === 'MinDwellSeconds'
                                  ? 3
                                  : ''),
                      )}
                      max={
                        field.key === 'Latitude'
                          ? 90
                          : field.key === 'Longitude'
                            ? 180
                            : undefined
                      }
                      min={
                        field.key === 'Latitude'
                          ? -90
                          : field.key === 'Longitude'
                            ? -180
                            : field.key === 'RadiusMeters'
                              ? 1
                              : 0
                      }
                      name={field.key}
                      required={field.required}
                      step={field.key === 'Priority' || field.key.endsWith('Seconds') ? 1 : 'any'}
                      type="number"
                    />
                  </label>
                ))}
              </div>
            </div>

            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}

            <div className="form-actions">
              <Link className="button" to="/vendor/pois">
                Hủy
              </Link>
              <button className="primary" disabled={saving || (editing && poi.loading)}>
                {saving ? 'Đang gửi…' : 'Lưu và gửi duyệt'}
              </button>
            </div>
          </form>
        </section>
      )}
    </>
  );
}

type PoiTab = 'overview' | 'images' | 'narrations' | 'audio' | 'translations' | 'qr' | 'history';

export function VendorPoiDetail() {
  const { id } = useParams();
  const { session, preview } = useSession();
  const token = session!.accessToken;
  const [tab, setTab] = useState<PoiTab>('overview');
  const [uploading, setUploading] = useState(false);
  const [audioDialog, setAudioDialog] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const poi = useResource(
    useCallback(
      () => api.admin<Row>(`pois/${encodeURIComponent(id || '')}`, token),
      [id, token],
    ),
  );

  if (!id) {
    return <Navigate to="/vendor/pois" replace />;
  }

  async function uploadImage(file: File) {
    setUploading(true);
    setError('');
    setMessage('');
    try {
      await api.upload(file, Number(id), token);
      setMessage('Ảnh đã tải lên và được gửi chờ duyệt.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Tải ảnh thất bại.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <Link className="back-link" to="/vendor/pois">
        <ArrowLeft size={16} /> Danh sách địa điểm
      </Link>
      <State
        loading={poi.loading}
        error={poi.error}
        retry={() => void poi.reload()}
      />
      {poi.data ? (
        <>
          <PageTitle
            eyebrow={`ĐỊA ĐIỂM · ${String(poi.data.Code || `#${id}`)}`}
            title={String(poi.data.Name || 'Chi tiết địa điểm')}
          >
            {preview ? (
              <button disabled title="Thao tác bị khóa trong chế độ xem thử">
                Chỉnh sửa thông tin
              </button>
            ) : (
              <Link className="button" to={`/vendor/pois/${id}/edit`}>
                Chỉnh sửa thông tin
              </Link>
            )}
          </PageTitle>

          <div className="vendor-detail-summary panel">
            <div>
              <span className="vendor-poi-symbol">
                <MapPin size={20} />
              </span>
              <div>
                <strong>{String(poi.data.Category || 'Chưa phân loại')}</strong>
                <small>
                  Tọa độ: {String(poi.data.Latitude ?? '—')},{' '}
                  {String(poi.data.Longitude ?? '—')} · Bán kính{' '}
                  {String(poi.data.RadiusMeters ?? '—')} m
                </small>
              </div>
            </div>
            {statusLabel(poi.data)}
          </div>

          <div className="vendor-tabs" role="tablist" aria-label="Nội dung POI">
            {[
              ['overview', 'Giới thiệu'],
              ['images', 'Hình ảnh'],
              ['narrations', 'Thuyết minh'],
              ['audio', 'Âm thanh'],
              ['translations', 'Bản dịch'],
              ['qr', 'Mã QR'],
              ['history', 'Lịch sử gửi duyệt'],
            ].map(([key, label]) => (
              <button
                aria-selected={tab === key}
                className={tab === key ? 'active' : ''}
                key={key}
                onClick={() => {
                  setTab(key as PoiTab);
                  setError('');
                  setMessage('');
                }}
                role="tab"
              >
                {label}
              </button>
            ))}
          </div>

          {message && (
            <p className="notice" role="status">
              {message}
            </p>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}

          {tab === 'overview' && (
            <section className="panel vendor-panel vendor-copy-panel">
              <h2>Nội dung giới thiệu</h2>
              <p>{String(poi.data.Description || 'Chưa có nội dung giới thiệu.')}</p>
              <Link className="button" to={`/vendor/pois/${id}/edit`}>
                Chỉnh sửa và gửi duyệt
              </Link>
              <p className="vendor-hint">
                Bản đang công khai được giữ nguyên cho đến khi Admin duyệt thay
                đổi.
              </p>
            </section>
          )}

          {tab === 'images' && (
            <RelatedContent
              action={!preview ? (
                <label className="vendor-upload-button">
                  <ImagePlus size={17} />
                  {uploading ? 'Đang tải ảnh…' : 'Tải ảnh lên'}
                  <input
                    accept="image/*"
                    disabled={uploading}
                    hidden
                    type="file"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void uploadImage(file);
                      event.target.value = '';
                    }}
                  />
                </label>
              ) : undefined}
              empty="Chưa có hình ảnh cho địa điểm này."
              poiId={Number(id)}
              resource="media"
              token={token}
            />
          )}
          {tab === 'narrations' && (
            <RelatedContent
              empty="Chưa có nội dung thuyết minh."
              poiId={Number(id)}
              resource="narrations"
              token={token}
            />
          )}
          {tab === 'audio' && (
            <RelatedContent
              action={!preview ? (
                <button className="primary" onClick={() => setAudioDialog(true)}>
                  <Plus size={17} /> Thêm file âm thanh
                </button>
              ) : undefined}
              empty="Chưa có file âm thanh."
              poiId={Number(id)}
              resource="audio"
              token={token}
            />
          )}
          {tab === 'translations' && (
            <RelatedContent
              empty="Chưa có bản dịch. Bản dịch hiện chỉ xem được trong khu vực Chủ sạp."
              poiId={Number(id)}
              resource="poi-translations"
              token={token}
            />
          )}
          {tab === 'qr' && (
            <VendorQrContent poiId={Number(id)} token={token} />
          )}
          {tab === 'history' && (
            <SubmissionHistory poiId={Number(id)} token={token} />
          )}

          {audioDialog && !preview && (
            <AudioUploadDialog
              initialPoi={Number(id)}
              lockPoi
              token={token}
              onClose={() => setAudioDialog(false)}
              onSaved={async () => setMessage('Audio đã được tạo và gửi chờ duyệt.')}
            />
          )}
        </>
      ) : null}
    </>
  );
}

function VendorQrContent({ poiId, token }: { poiId: number; token: string }) {
  const [error, setError] = useState('');
  const data = useResource(
    useCallback(
      () =>
        api.admin<Page<Row>>(
          `cms/catalog/qr?poiId=${poiId}&page=1&pageSize=100`,
          token,
        ),
      [poiId, token],
    ),
  );

  async function download(row: Row) {
    setError('');
    try {
      const image = await QRCode.toDataURL(String(row.Code), {
        width: 600,
        margin: 2,
      });
      const link = document.createElement('a');
      link.href = image;
      link.download = `qr-${String(row.Code || row.Id)}.png`;
      link.click();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? `Không tạo được ảnh QR: ${reason.message}`
          : 'Không tạo được ảnh QR.',
      );
    }
  }

  return (
    <section className="panel vendor-panel">
      <div className="vendor-section-heading">
        <div>
          <span className="eyebrow">MÃ ĐÃ ĐƯỢC CẤP CHO POI</span>
          <h2>Mã QR</h2>
        </div>
      </div>
      <p className="vendor-hint">
        Chủ sạp chỉ được xem hoặc tải mã đã cấp. Cấu hình đích, giá và thời
        hạn quyền nghe do Admin quản lý.
      </p>
      {error && <p className="error" role="alert">{error}</p>}
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
                <th>Mã QR</th>
                <th>Tên hiển thị</th>
                <th>Yêu cầu thanh toán</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {data.data.items.map((row) => (
                <tr key={String(row.Id)}>
                  <td>
                    <strong>{String(row.Code || `QR #${row.Id}`)}</strong>
                  </td>
                  <td>{String(row.Name || '—')}</td>
                  <td>{row.RequiresPayment ? 'Có' : 'Không'}</td>
                  <td>
                    <button onClick={() => void download(row)}>
                      <Download size={16} />
                      Tải PNG
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

function RelatedContent({
  action,
  empty,
  poiId,
  resource,
  token,
}: {
  action?: ReactNode;
  empty: string;
  poiId: number;
  resource: 'media' | 'narrations' | 'audio' | 'poi-translations';
  token: string;
}) {
  const query = new URLSearchParams({
    poiId: String(poiId),
    page: '1',
    pageSize: '100',
    ...(resource === 'media' ? { fileType: 'image' } : {}),
  });
  const queryString = query.toString();
  const data = useResource(
    useCallback(
      () => api.admin<Page<Row>>(`cms/catalog/${resource}?${queryString}`, token),
      [queryString, resource, token],
    ),
  );

  return (
    <section className="panel vendor-panel">
      <div className="vendor-section-heading">
        <div>
          <span className="eyebrow">NỘI DUNG TRONG PHẠM VI POI</span>
          <h2>
            {resource === 'media'
              ? 'Hình ảnh'
              : resource === 'narrations'
                ? 'Thuyết minh'
                : resource === 'audio'
                  ? 'Âm thanh'
                  : 'Bản dịch'}
          </h2>
        </div>
        {action}
      </div>
      <State
        loading={data.loading}
        error={data.error}
        retry={() => void data.reload()}
        empty={!data.loading && !data.error && !data.data?.items.length}
      />
      {!data.loading && !data.error && !data.data?.items.length ? (
        <p className="vendor-empty-copy">{empty}</p>
      ) : null}
      {data.data?.items.length ? (
        <div className="vendor-content-list">
          {data.data.items.map((row) => (
            <article className="vendor-content-row" key={String(row.Id)}>
              <div className="vendor-content-main">
                <strong>
                  {String(
                    row.Title ||
                      row.Name ||
                      row.OriginalFileName ||
                      `Nội dung #${row.Id}`,
                  )}
                </strong>
                <small>
                  {String(row.LanguageCode || row.ContentType || 'Nội dung')}
                  {row.SubmissionStatus ? ` · ${String(row.SubmissionStatus)}` : ''}
                </small>
                {resource === 'narrations' && (
                  <p className="vendor-content-preview">
                    {String(row.TextContent || '')}
                  </p>
                )}
                {resource === 'poi-translations' && (
                  <p className="vendor-content-preview">
                    {String(row.Description || row.ShortDescription || '')}
                  </p>
                )}
              </div>
              {resource === 'media' && (
                <MediaPreview
                  image
                  path={`cms/media/images/${row.Id}/stream`}
                  token={token}
                />
              )}
              {resource === 'audio' && row.FileUrl ? (
                <MediaPreview
                  path={`cms/audio-preview/${row.Id}/stream`}
                  token={token}
                />
              ) : null}
              {statusLabel(row)}
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function SubmissionHistory({ poiId, token }: { poiId: number; token: string }) {
  const data = useResource(
    useCallback(
      () =>
        Promise.all(
          ['Pending', 'Rejected', 'Approved', 'Superseded'].map((status) =>
            api.admin<Page<Row>>(
              `cms/review-queue?${new URLSearchParams({
                status,
                search: String(poiId),
                page: '1',
                pageSize: '100',
              })}`,
              token,
            ),
          ),
        ).then((pages) =>
          pages
            .flatMap((page) => page.items)
            .filter(
              (row) =>
                Number(row.EntityId) === poiId &&
                ['pois', 'media', 'audio', 'narrations', 'poi-translations'].includes(
                  String(row.Resource),
                ),
            )
            .sort(
              (a, b) =>
                new Date(String(b.SubmittedAt || '')).getTime() -
                new Date(String(a.SubmittedAt || '')).getTime(),
            ),
        ),
      [poiId, token],
    ),
  );

  return (
    <section className="panel vendor-panel">
      <div className="vendor-section-heading">
        <div>
          <span className="eyebrow">THEO DÕI XỬ LÝ</span>
          <h2>Lịch sử gửi duyệt</h2>
        </div>
      </div>
      <State
        loading={data.loading}
        error={data.error}
        retry={() => void data.reload()}
        empty={!data.loading && !data.error && !data.data?.length}
      />
      {data.data?.map((submission) => (
        <article className="vendor-content-row" key={String(submission.Id)}>
          <div className="vendor-content-main">
            <strong>
              {String(submission.Resource)} · {String(submission.Operation || 'Cập nhật')}
            </strong>
            <small>
              Gửi ngày{' '}
              {submission.SubmittedAt
                ? new Date(String(submission.SubmittedAt)).toLocaleString('vi-VN')
                : '—'}
            </small>
            {submission.RejectionReason ? (
              <p className="error">
                Lý do từ chối: {String(submission.RejectionReason)}
              </p>
            ) : null}
          </div>
          {statusLabel({ SubmissionStatus: submission.Status as Row[string], RejectionReason: submission.RejectionReason as Row[string] })}
          {submission.Status === 'Rejected' && (
            <Link to="/vendor/submissions">Sửa và gửi lại</Link>
          )}
        </article>
      ))}
    </section>
  );
}
