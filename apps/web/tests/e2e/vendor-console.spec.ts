import { expect, test, type Page } from '@playwright/test';

async function setup(page: Page, role = 'Vendor') {
  await page.addInitScript(role => sessionStorage.setItem('audiotour:session', JSON.stringify({ userId: 12, username: 'chu-sap', role, accessToken: 'test.header.signature', expiresAtUtc: new Date(Date.now() + 3600000).toISOString() })), role);
  const writes: { path: string; method: string; body: Record<string, unknown> }[] = [];
  const poi = { Id: 1, Code: 'SAP-1', Name: 'Sạp hải sản', Latitude: 11.7, Longitude: 109.1, RadiusMeters: 50, Description: 'Giới thiệu sạp', ReviewStatus: 'Approved' };
  let translation = { Id: 3, POIId: 1, LanguageCode: 'en', Name: 'Seafood stall', Description: 'Fresh seafood', SubmissionId: 7, SubmissionStatus: 'Rejected', RejectionReason: 'Cần bổ sung nội dung' };
  let submission = { Id: 7, Resource: 'poi-translations', EntityId: 3, Status: 'Rejected', Operation: 'update', RejectionReason: 'Cần bổ sung nội dung', SubmittedAt: '2026-10-26T10:00:00Z' };
  await page.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname;
    expect(request.headers().authorization).toBe('Bearer test.header.signature');
    if (request.method() !== 'GET') {
      const body = request.headers()['content-type']?.includes('application/json') ? request.postDataJSON() : {};
      writes.push({ path, method: request.method(), body });
      if (path.endsWith('/poi-translations/3') && request.method() === 'PUT') translation = { ...translation, ...body, SubmissionStatus: 'Pending' };
      if (path.endsWith('/resubmit')) submission = { ...submission, Status: 'Pending', RejectionReason: '' };
      return route.fulfill({ json: { success: true, data: { Id: 3, ...body } } });
    }
    if (path.endsWith('/preview') || path.endsWith('/stream')) return route.fulfill({ status: 404 });
    let data: unknown = { items: [], total: 0 };
    if (path.endsWith('/languages')) data = [{ code: 'vi', name: 'Tiếng Việt', nativeName: 'Tiếng Việt' }, { code: 'en', name: 'English', nativeName: 'English' }];
    else if (path.endsWith('/pois/1')) data = poi;
    else if (path.endsWith('/catalog/pois')) data = { items: [poi], total: 1 };
    else if (path.endsWith('/catalog/poi-translations')) data = { items: [translation], total: 1 };
    else if (path.endsWith('/catalog/media')) data = { items: [{ Id: 4, PoiId: 1, OriginalFileName: 'anh-sap.png', ContentType: 'image/png', SubmissionId: 8, ReviewStatus: 'Pending' }], total: 1 };
    else if (path.endsWith('/review-queue')) data = { items: [submission], total: 1 };
    else if (path.endsWith('/review-dossier/7')) data = { submission, canonical: { ...translation, Description: 'Bản đang công khai' }, proposed: translation, submitter: { Username: 'chu-sap' } };
    else if (path.endsWith('/console-summary')) data = { pois: 1, media: 1, missingMedia: 1, expiring: 0, expired: 0 };
    else if (path.endsWith('/statistics')) data = { summary: { plays: 5, durationSeconds: 120 }, dates: [{ groupKey: '2026-10-26', plays: 5 }], popular: [{ poiId: 1, groupKey: 'Sạp hải sản', plays: 5 }] };
    return route.fulfill({ json: { success: true, data } });
  });
  return writes;
}

test('Vendor creates a POI without granting publication or ownership fields', async ({ page }) => {
  const writes = await setup(page); await page.goto('/vendor/pois/new');
  await page.getByLabel('Mã địa điểm').fill('SAP-2');
  await page.getByLabel('Tên địa điểm').fill('Sạp mới');
  await page.getByLabel('Vĩ độ').fill('11.7'); await page.getByLabel('Kinh độ').fill('109.1');
  await page.getByRole('button', { name: 'Lưu và gửi duyệt' }).click();
  await expect(page).toHaveURL(/\/vendor\/pois$/);
  expect(writes).toHaveLength(1);
  expect(writes[0]).toMatchObject({ path: '/api/v1/pois', method: 'POST', body: { Code: 'SAP-2', Name: 'Sạp mới', Latitude: 11.7, Longitude: 109.1, RadiusMeters: 50 } });
  for (const field of ['UserId', 'ReviewStatus', 'ApprovalStatus', 'LifecycleStatus']) expect(writes[0].body).not.toHaveProperty(field);
});

test('Vendor updates a POI through its own detail and editor', async ({ page }) => {
  const writes = await setup(page); await page.goto('/vendor/pois/1');
  await page.getByRole('link', { name: 'Chỉnh sửa thông tin' }).click();
  await expect(page.getByLabel('Tên địa điểm')).toHaveValue('Sạp hải sản');
  await page.getByLabel('Tên địa điểm').fill('Sạp đã sửa');
  await page.getByRole('button', { name: 'Lưu và gửi duyệt' }).click();
  await expect(page).toHaveURL(/\/vendor\/pois$/);
  expect(writes[0]).toMatchObject({ path: '/api/v1/pois/1', method: 'PUT', body: { Name: 'Sạp đã sửa' } });
});

test('Vendor edits a rejected translation and previews the new proposal', async ({ page }) => {
  const writes = await setup(page); await page.goto('/vendor/pois/1?tab=translations');
  await expect(page.getByRole('tab', { name: 'Bản dịch', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { name: 'Chỉnh sửa và gửi duyệt', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nội dung bản dịch').fill('Fresh seafood by the bay');
  await dialog.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(dialog).toHaveCount(0);
  expect(writes[0]).toMatchObject({ path: '/api/v1/poi-translations/3', method: 'PUT', body: { POIId: 1, LanguageCode: 'en', Description: 'Fresh seafood by the bay' } });
  await page.getByRole('button', { name: 'Xem trước', exact: true }).click();
  await expect(page.getByRole('dialog').getByText('Fresh seafood by the bay', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('Vendor previews the pending image, replaces it and requests reviewed deletion', async ({ page }) => {
  const writes = await setup(page); await page.goto('/vendor/pois/1?tab=images');
  const preview = page.waitForRequest(r => r.url().endsWith('/cms/submissions/8/preview'));
  await page.getByRole('button', { name: 'Xem trước', exact: true }).click(); await preview;
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('HTTP 404');
  await page.keyboard.press('Escape');
  await page.getByLabel('Thay ảnh anh-sap.png', { exact: true }).setInputFiles({ name: 'moi.png', mimeType: 'image/png', buffer: Buffer.from('test-image') });
  await expect(page.getByRole('status').filter({ hasText: 'ảnh thay thế' })).toBeVisible();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Yêu cầu xóa' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'yêu cầu xóa' })).toBeVisible();
  expect(writes.map(w => [w.method, w.path])).toEqual([['POST', '/api/v1/media/4/replacement'], ['DELETE', '/api/v1/media/4']]);
});

test('Vendor reviews rejection details, opens the correct editor and resubmits', async ({ page }) => {
  const writes = await setup(page); await page.goto('/vendor/submissions');
  await page.getByLabel('Trạng thái', { exact: true }).selectOption('Rejected');
  await page.getByRole('button', { name: 'Xem nội dung' }).click();
  const dossier = page.getByRole('region', { name: 'Hồ sơ gửi duyệt 7' });
  await expect(dossier.getByText('Fresh seafood', { exact: true })).toBeVisible();
  await expect(dossier.getByText('Cần bổ sung nội dung', { exact: false })).toBeVisible();
  await expect(dossier.getByRole('link', { name: 'Mở nội dung để chỉnh sửa' })).toHaveAttribute('href', '/vendor/pois/1?tab=translations');
  await expect(page.getByRole('button', { name: 'Duyệt nội dung', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Gửi lại', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Đã gửi nội dung lại');
  expect(writes[0]).toMatchObject({ path: '/api/v1/cms/poi-translations/3/resubmit', method: 'POST' });
});

test('Vendor statistics validates the range and keeps filters scoped', async ({ page }) => {
  await setup(page); await page.goto('/vendor/statistics');
  await page.getByLabel('Từ ngày (UTC)').fill('2026-10-26'); await page.getByLabel('Đến ngày (UTC)').fill('2026-10-01');
  await page.getByRole('button', { name: 'Lọc thống kê' }).click();
  await expect(page.getByRole('alert')).toContainText('Ngày kết thúc');
  await page.getByLabel('Đến ngày (UTC)').fill('2026-10-31');
  const filtered = page.waitForRequest(r => r.url().includes('/cms/statistics?') && new URL(r.url()).searchParams.get('endDate') === '2026-10-31');
  await page.getByRole('button', { name: 'Lọc thống kê' }).click(); await filtered;
  await expect(page.getByRole('cell', { name: 'Sạp hải sản' })).toBeVisible();
});

for (const role of ['Vendor', 'Admin']) test(`${role} can sign out on a narrow screen`, async ({ page }) => {
  await setup(page, role); await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(role === 'Vendor' ? '/vendor/pois' : '/admin/pois');
  await page.getByRole('banner').getByRole('button', { name: 'Đăng xuất' }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(await page.evaluate(() => sessionStorage.getItem('audiotour:session'))).toBeNull();
});
