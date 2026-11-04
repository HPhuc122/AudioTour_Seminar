import { expect, test, type Page } from '@playwright/test';
async function setup(page: Page) {
  await page.addInitScript(() => sessionStorage.setItem('audiotour:session', JSON.stringify({ userId: 1, username: 'admin-test', role: 'Admin', accessToken: 'test.header.signature', expiresAtUtc: new Date(Date.now() + 3600000).toISOString() })));
  await page.route('**/api/v1/**', route => {
    const url = new URL(route.request().url()); const path = url.pathname;
    if (path.endsWith('/device-activity')) return route.fulfill({ json: { success: true, data: { summary: { totalDevices: 0, activeDevices: 0, activeUsers: 0 }, items: [], total: 0, page: 1, pageSize: 20, activeWindowMinutes: 5, serverTime: new Date().toISOString() } } });
    const poi = { Id: 1, Name: 'POI từ API', Code: 'REAL', ReviewStatus: 'Approved', Latitude: 10.76, Longitude: 106.7, RadiusMeters: 50, LifecycleStatus: 3, ValidFrom: null, ValidUntil: null };
    const data = path.includes('/catalog/') ? { items: url.searchParams.get('search') ? [] : [poi], total: url.searchParams.get('search') ? 0 : 60 } : path.endsWith('/console-summary') ? { pois: 23, tours: 8, audio: 20, media: 46, pending: 87, missingMedia: 46 } : path.endsWith('/statistics') ? { summary: { plays: 0, durationSeconds: 0 }, dates: [], popular: [] } : path.endsWith('/languages') ? [{ code: 'vi', name: 'Vietnamese', nativeName: 'Vietnamese' }] : { items: [], total: 0 };
    return route.fulfill({ json: { success: true, data } });
  });
}
test('catalog search, status and pagination are sent to backend', async ({ page }) => {
  await setup(page); await page.goto('/admin/pois');
  await expect(page.getByText('POI từ API', { exact: true })).toBeVisible();
  const next = page.waitForRequest(r => r.url().includes('/cms/catalog/pois') && new URL(r.url()).searchParams.get('page') === '2');
  await page.getByRole('button', { name: 'Sau', exact: true }).click(); await next;
  const filter = page.waitForRequest(r => new URL(r.url()).searchParams.get('status') === 'Pending');
  await page.getByLabel('Trạng thái', { exact: true }).selectOption('Pending'); await filter;
  await page.getByLabel('Tìm kiếm', { exact: true }).fill('Không có');
  const search = page.waitForRequest(r => new URL(r.url()).searchParams.get('search') === 'Không có');
  await page.getByRole('button', { name: 'Tìm kiếm', exact: true }).click(); await search;
  await expect(page.getByRole('heading', { name: 'Chưa có dữ liệu' })).toBeVisible();
});
test('removed business and unconfigured screens have no links, routes or API requests', async ({ page }) => {
  await setup(page);
  const obsoleteRequests: string[] = [];
  page.on('request', request => { if (/\/cms\/(transactions|validity|vendors|capabilities|automation)(\/|\?|$)/.test(request.url())) obsoleteRequests.push(request.url()); });
  await page.goto('/admin/dashboard');
  for (const path of ['transactions', 'vendors', 'validity', 'settings', 'automation']) {
    await expect(page.locator(`a[href="/admin/${path}"]`)).toHaveCount(0);
  }
  await expect(page.getByRole('link', { name: 'Địa điểm', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Người dùng', exact: true })).toBeVisible();
  for (const path of ['transactions', 'vendors', 'validity', 'settings', 'automation']) {
    await page.goto(`/admin/${path}`);
    await expect(page.getByRole('heading', { name: 'Không tìm thấy trang' })).toBeVisible();
  }
  expect(obsoleteRequests).toEqual([]);
});

test('POI editor retains DB validity fields and submits them as a review proposal', async ({ page }) => {
  await setup(page); await page.goto('/admin/pois'); await page.getByRole('button', { name: 'Sửa', exact: true }).click();
  await page.getByLabel('Bắt đầu (giờ địa phương)').fill('2027-02-01T10:00'); await page.getByLabel('Kết thúc (giờ địa phương)').fill('2027-01-01T10:00');
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click(); await expect(page.getByRole('alert')).toContainText('Ngày kết thúc phải sau');
  await page.getByLabel('Kết thúc (giờ địa phương)').fill('2027-03-01T10:00');
  const request = page.waitForRequest(r => r.url().endsWith('/api/v1/pois/1') && r.method() === 'PUT');
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click(); const body = (await request).postDataJSON(); expect(body.ValidFrom).toMatch(/Z$/); expect(body.ValidUntil).toMatch(/Z$/);
  await expect(page.getByRole('status').filter({ hasText: 'hàng đợi duyệt' })).toContainText('hàng đợi duyệt');
});
test('dashboard works at desktop and tablet sizes with real API-shaped counts', async ({ page }) => {
  await setup(page);
  for (const width of [1440, 1024, 768]) {
    await page.setViewportSize({ width, height: 900 }); await page.goto('/admin/dashboard');
    await expect(page.getByRole('heading', { name: 'Tổng quan hệ thống' })).toBeVisible();
    await expect(page.getByText('46 tệp đính kèm không thể truy cập.')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});
