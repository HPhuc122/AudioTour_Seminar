import type { Session } from '../types';

export const vendorDemoToken = 'audiotour:vendor-local-demo';
export const vendorDemoSession: Session = {
  accessToken: vendorDemoToken,
  expiresAtUtc: '2099-01-01T00:00:00Z',
  userId: 0,
  username: 'Chủ sạp demo',
  role: 'Vendor',
};

const pois = [
  {
    Id: 1,
    Code: 'DEMO-01',
    Name: 'Sạp hải sản Vịnh Hy',
    Category: 'Ẩm thực',
    Description: 'Thưởng thức hải sản địa phương và tìm hiểu câu chuyện làng chài Vịnh Hy.',
    ShortDescription: 'Hải sản địa phương bên vịnh.',
    Latitude: 11.733,
    Longitude: 109.19,
    RadiusMeters: 50,
    Priority: 1,
    CooldownSeconds: 120,
    MinDwellSeconds: 3,
    IsActive: true,
    LifecycleStatus: 3,
    ReviewStatus: 'Approved',
    SubmissionStatus: 'Approved',
  },
  {
    Id: 2,
    Code: 'DEMO-02',
    Name: 'Điểm ngắm vịnh',
    Category: 'Tham quan',
    Description: 'Điểm dừng ngắm cảnh vịnh và khám phá hệ sinh thái biển.',
    ShortDescription: 'Góc nhìn toàn cảnh Vịnh Hy.',
    Latitude: 11.736,
    Longitude: 109.193,
    RadiusMeters: 80,
    Priority: 1,
    CooldownSeconds: 120,
    MinDwellSeconds: 3,
    IsActive: true,
    LifecycleStatus: 3,
    ReviewStatus: 'Approved',
    SubmissionStatus: 'Approved',
  },
];

const submissions = [
  { Id: 101, Resource: 'narrations', EntityId: 1, Status: 'Pending', Operation: 'update', SubmittedAt: '2026-10-20T08:30:00Z' },
  { Id: 102, Resource: 'poi-translations', EntityId: 1, Status: 'Rejected', Operation: 'update', SubmittedAt: '2026-10-19T04:15:00Z', RejectionReason: 'Vui lòng bổ sung bản dịch tên địa điểm chính xác hơn.' },
  { Id: 103, Resource: 'pois', EntityId: 2, Status: 'Approved', Operation: 'update', SubmittedAt: '2026-10-17T02:00:00Z' },
];

function page<T>(items: T[], url: URL) {
  const pageNumber = Math.max(1, Number(url.searchParams.get('page') || 1));
  const pageSize = Math.max(1, Number(url.searchParams.get('pageSize') || 50));

  return {
    items: items.slice((pageNumber - 1) * pageSize, pageNumber * pageSize),
    total: items.length,
    page: pageNumber,
    pageSize,
  };
}

/** Vendor demo fixtures are local-only and never write to the service APIs. */
export function vendorPreviewData<T>(
  path: string,
  init: RequestInit = {},
): T {
  if ((init.method || 'GET').toUpperCase() !== 'GET') {
    throw new Error('Thao tác bị khóa trong chế độ xem thử.');
  }

  const url = new URL(path, 'https://vendor-preview.local');
  const key = url.pathname.replace(/^\/api\/v1\//, '');
  let result: unknown;

  if (key === 'cms/console-summary') {
    result = {
      pois: pois.length,
      tours: 0,
      audio: 1,
      media: 1,
      pending: submissions.filter((item) => item.Status === 'Pending').length,
      missingMedia: 0,
      expiring: 0,
      expired: 0,
    };
  } else if (key === 'cms/statistics') {
    result = {
      summary: { plays: 128, durationSeconds: 3840 },
      dates: [
        { groupKey: '2026-10-20', plays: 48 },
        { groupKey: '2026-10-19', plays: 80 },
      ],
      popular: [
        { poiId: 1, groupKey: pois[0].Name, plays: 80 },
        { poiId: 2, groupKey: pois[1].Name, plays: 48 },
      ],
    };
  } else if (key === 'cms/catalog/pois') {
    const search = (url.searchParams.get('search') || '').toLocaleLowerCase();
    const status = url.searchParams.get('status') || '';
    const filtered = pois.filter((poi) => {
      const matchesSearch = `${poi.Name} ${poi.Code} ${poi.Category}`
        .toLocaleLowerCase()
        .includes(search);
      const matchesStatus =
        !status || (poi.SubmissionStatus || poi.ReviewStatus) === status;
      return matchesSearch && matchesStatus;
    });
    result = page(filtered, url);
  } else if (key === 'cms/review-queue') {
    const status = url.searchParams.get('status') || 'Pending';
    const search = (url.searchParams.get('search') || '').toLocaleLowerCase();
    const filtered = submissions.filter(
      (item) =>
        item.Status === status &&
        `${item.Id} ${item.EntityId} ${item.Resource}`
          .toLocaleLowerCase()
          .includes(search),
    );
    result = page(filtered, url);
  } else if (key === 'cms/catalog/media') {
    result = page(
      [
        {
          Id: 1,
          PoiId: 1,
          OriginalFileName: 'vinh-hy-demo.jpg',
          FileType: 'Image',
          ContentType: 'image/jpeg',
          ApprovalStatus: 'Approved',
        },
      ],
      url,
    );
  } else if (key === 'cms/catalog/audio') {
    result = page(
      [
        {
          Id: 1,
          POIId: 1,
          Title: 'Thuyết minh mẫu',
          LanguageCode: 'vi',
          AudioType: 'tts',
          SubmissionStatus: 'Pending',
        },
      ],
      url,
    );
  } else if (key === 'cms/catalog/narrations') {
    result = page(
      [
        {
          Id: 1,
          PoiId: 1,
          Title: 'Giới thiệu Vịnh Hy',
          TextContent:
            'Vịnh Hy nổi tiếng với cảnh quan thiên nhiên và làng chài ven biển.',
          LanguageCode: 'vi',
          SubmissionStatus: 'Pending',
        },
      ],
      url,
    );
  } else if (key === 'cms/catalog/poi-translations') {
    result = page(
      [
        {
          Id: 1,
          POIId: 1,
          LanguageCode: 'en',
          Name: 'Vinh Hy seafood stall',
          Description: 'Sample narration introducing this location.',
          SubmissionStatus: 'Approved',
        },
      ],
      url,
    );
  } else if (key === 'cms/catalog/qr') {
    result = page(
      [
        {
          Id: 1,
          Code: 'DEMO-QR-01',
          Name: 'Mã tham quan Vịnh Hy',
          PoiId: 1,
          RequiresPayment: false,
        },
      ],
      url,
    );
  } else if (key === 'languages') {
    result = [
      { code: 'vi', name: 'Tiếng Việt', nativeName: 'Tiếng Việt' },
      { code: 'en', name: 'English', nativeName: 'English' },
    ];
  } else if (/^pois\/\d+$/.test(key)) {
    result = pois.find((poi) => poi.Id === Number(key.split('/')[1]));
  } else if (/^cms\/media\/images\/\d+\/stream$/.test(key)) {
    throw new Error('Ảnh minh họa không có file thật trong chế độ xem thử.');
  } else if (/^cms\/audio-preview\/\d+\/stream$/.test(key)) {
    throw new Error('Audio minh họa không có file thật trong chế độ xem thử.');
  } else if (/^cms\/review-dossier\/\d+$/.test(key)) {
    throw new Error('Chi tiết hồ sơ chỉ có trong hệ thống thật.');
  } else {
    throw new Error('Dữ liệu này chưa có trong chế độ xem thử.');
  }

  return structuredClone(result) as T;
}
