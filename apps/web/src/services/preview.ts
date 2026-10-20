import type { Session } from '../types';

export const previewToken = 'audiotour:local-preview';
export const previewSession: Session = { accessToken: previewToken, expiresAtUtc: '2099-01-01T00:00:00Z', userId: 0, username: 'Xem thử', role: 'AnalyticsViewer' };
const pois = [
  { Id: 1, Code: 'DEMO-01', Name: 'Sạp hải sản Vịnh Hy', Category: 'Ẩm thực', Latitude: 11.733, Longitude: 109.19, RadiusMeters: 50, Priority: 1, IsActive: true, LifecycleStatus: 3 },
  { Id: 2, Code: 'DEMO-02', Name: 'Điểm ngắm vịnh', Category: 'Tham quan', Latitude: 11.736, Longitude: 109.193, RadiusMeters: 80, Priority: 1, IsActive: true, LifecycleStatus: 3 },
];
const tours = [{ Id: 1, Code: 'DEMO-TOUR', DefaultLanguage: 'vi', EstimatedMinutes: 45, IsActive: true }];
const translations = [{ Id: 1, LanguageCode: 'vi', Name: 'Sạp hải sản Vịnh Hy', Description: 'Nội dung thuyết minh mẫu giới thiệu địa điểm.' }, { Id: 2, LanguageCode: 'en', Name: 'Vinh Hy seafood stall', Description: 'Sample narration introducing this location.' }];
const media = [{ Id: 1, OriginalFileName: 'vinh-hy-demo.jpg', FileType: 'Image', ContentType: 'image/jpeg', ApprovalStatus: 'Approved' }];
const audio = [{ Id: 1, Title: 'Thuyết minh mẫu', LanguageCode: 'vi', AudioType: 'tts', TTSText: 'Chào mừng bạn đến với Vịnh Hy. Đây là nội dung mẫu để kiểm tra giao diện quản trị.', IsActive: true }];

/** Local fixtures only: never send preview credentials to the backend. */
export function previewData<T>(path: string, init: RequestInit = {}): T {
  if ((init.method || 'GET').toUpperCase() !== 'GET') throw new Error('Hãy đăng nhập để thay đổi dữ liệu thật.');
  const url = new URL(path, 'https://preview.local');
  const key = url.pathname.replace(/^\/api\/v1\//, '');
  const page = (items: unknown[]) => ({ items, total: items.length, page: 1, pageSize: 50 });
  let data: unknown;
  if (key === 'pois') data = page(pois);
  else if (key === 'tours') data = page(tours);
  else if (key === 'qr') data = page([{ Id: 1, Code: 'DEMO-QR-01', Name: 'QR mẫu', PoiId: 1, TourId: null, PriceAmount: 0, AccessDurationMinutes: 60 }]);
  else if (key === 'users') data = [{ id: 1, username: 'quanly_mau', email: 'demo@example.com', role: 'ContentAdmin', isActive: true }];
  else if (key.startsWith('poi-translations/by-poi/')) data = translations;
  else if (key.startsWith('audio/by-poi/')) data = audio;
  else if (key.startsWith('media/by-poi/')) data = media;
  else if (key.startsWith('narrations/by-poi/')) data = [{ Id: 1, PoiId: 1, Title: 'Thuyết minh mẫu', TextContent: 'Nội dung mẫu đang chờ duyệt.', LanguageCode: 'vi', ReviewStatus: 'Pending' }];
  else if (key === 'cms/submissions') data = page(url.searchParams.get('status') === 'Pending' ? [{ Id: 1, Resource: 'poi-translations', EntityId: 1, BaseVersion: 1, Status: 'Pending', Operation: 'update', PayloadJson: JSON.stringify({ Name: 'Tên địa điểm mẫu đang chờ duyệt', Description: 'Nội dung mẫu cho trang duyệt.' }) }] : []);
  else if (/^pois\/\d+$/.test(key)) data = pois.find(p => p.Id === Number(key.split('/')[1])) || pois[0];
  else if (/^tours\/\d+$/.test(key)) data = tours[0];
  else if (/^poi-translations\/\d+$/.test(key)) data = { ...translations[0], POIId: 1 };
  else if (/^web\/tours\/\d+\/content$/.test(key)) data = { tour: tours[0], translations: [{ Id: 1, LanguageCode: 'vi', Name: 'Khám phá Vịnh Hy', Description: 'Tour mẫu gồm hai điểm dừng.' }], pois: pois.map((p, i) => ({ ...p, POIId: p.Id, OrderIndex: i })) };
  else if (key === 'analytics/summary') data = { pois: 2, tours: 1, plays: 128, devices: 32 };
  else if (key === 'analytics/web-duration') data = { durationSeconds: 3840, ttsPlays: null };
  else if (key === 'analytics/grouped') data = url.searchParams.get('groupBy') === 'poi' ? [{ groupKey: 1, plays: 80 }, { groupKey: 2, plays: 48 }] : [{ groupKey: '2026-10-10', plays: 48 }, { groupKey: '2026-10-09', plays: 80 }];
  else throw new Error('Chức năng này cần đăng nhập để tải dữ liệu thật.');
  return structuredClone(data) as T;
}
