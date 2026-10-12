import { expect, test, type Page } from '@playwright/test';
async function session(page: Page, role: string) {
 await page.addInitScript(role => sessionStorage.setItem('audiotour:session', JSON.stringify({ username: 'manager', role, accessToken: 'test-token', expiresAtUtc: new Date(Date.now() + 3600000).toISOString() })), role);
}
async function mockApi(page: Page) {
 await page.route('**/api/v1/**', route => {
  const path = new URL(route.request().url()).pathname;
  const data = path.endsWith('/pois') ? { items: [{ Id: 1, Code: 'POI-1', Name: 'Test POI', Latitude: 11.733, Longitude: 109.19, RadiusMeters: 50 }], total: 1 } : path.endsWith('/users') ? [] : path.includes('grouped') ? [] : path.includes('summary') ? { pois: 1, tours: 0, plays: 0, devices: 0 } : path.includes('web-duration') ? { durationSeconds: 0, ttsPlays: null } : [];
  return route.fulfill({ json: { success: true, data } });
 });
}
test('root and management pages require login', async ({ page }) => {
 for (const path of ['/', '/admin', '/admin/pois', '/admin/map', '/admin/users']) { await page.goto(path); await expect(page).toHaveURL(/\/login$/); await expect(page.getByRole('heading', { name: 'Đăng nhập quản trị' })).toBeVisible(); }
 await expect(page.getByRole('link', { name: /web tham quan/ })).toHaveCount(0);
});
test('visitor routes are unavailable', async ({ page }) => {
 const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
 for (const path of ['/pois', '/pois/1', '/tours', '/tours/1', '/map', '/qr', '/qr/ABC', '/access']) { await page.goto(path); await expect(page.getByRole('heading', { name: 'Không tìm thấy trang' })).toBeVisible(); await expect(page.locator('audio')).toHaveCount(0); }
 expect(errors).toEqual([]);
});
test('visitor role cannot open management or request management data', async ({ page }) => {
 await session(page, 'Visitor'); let requests = 0; page.on('request', r => { if (r.url().includes('/api/')) requests++; });
 await page.goto('/admin/pois'); await expect(page.getByRole('heading', { name: 'Không có quyền quản trị' })).toBeVisible(); expect(requests).toBe(0);
});
test('content manager cannot open users even through direct URL', async ({ page }) => {
 await session(page, 'ContentAdmin'); let requests = 0; page.on('request', r => { if (/\/api\/v1\/(users|roles)(\?|$)/.test(r.url())) requests++; });
 await page.goto('/admin/users'); await expect(page.getByRole('heading', { name: 'Không có quyền quản lý người dùng' })).toBeVisible(); await expect(page.getByRole('link', { name: 'Người dùng', exact: true })).toHaveCount(0); expect(requests).toBe(0);
});
test('analytics viewer can read POIs and map but cannot edit', async ({ page }) => {
 await session(page, 'AnalyticsViewer'); await mockApi(page);
 await page.goto('/admin/pois'); await expect(page.getByText('Test POI', { exact: true })).toBeVisible(); await expect(page.getByRole('button', { name: 'Thêm mới' })).toHaveCount(0); await expect(page.getByRole('button', { name: 'Sửa', exact: true })).toHaveCount(0);
 await page.goto('/admin/map'); await page.getByLabel('Chọn POI').selectOption('1'); await expect(page.getByRole('heading', { name: 'Test POI' })).toBeVisible(); await expect(page.getByRole('button', { name: 'Lưu vị trí POI' })).toHaveCount(0);
});
test('manager can save POI coordinates and radius on map', async ({ page }) => {
 await session(page, 'TourOperator'); await mockApi(page);
 await page.goto('/admin/map'); await page.getByLabel('Chọn POI').selectOption('1'); await page.getByLabel('Vĩ độ', { exact: true }).fill('11.75'); await page.getByLabel('Kinh độ', { exact: true }).fill('109.2'); await page.getByLabel('Bán kính (m)', { exact: true }).fill('80');
 const request = page.waitForRequest(r => r.method() === 'PUT' && r.url().endsWith('/pois/1')); await page.getByRole('button', { name: 'Lưu vị trí POI' }).click(); expect((await request).postDataJSON()).toEqual({ Latitude: 11.75, Longitude: 109.2, RadiusMeters: 80 });
});
test('admin navigation includes image and user management', async ({ page }) => {
 await session(page, 'Admin'); await mockApi(page); await page.goto('/admin/users'); await expect(page.getByRole('heading', { name: 'Quản lý người dùng' })).toBeVisible(); await expect(page.getByRole('link', { name: 'Hình ảnh', exact: true })).toBeVisible(); await page.getByRole('link', { name: 'Hình ảnh', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Quản lý hình ảnh' })).toBeVisible(); await expect(page.getByRole('link', { name: /web tham quan|Quét QR/ })).toHaveCount(0);
});
test('live gateway permissions', async ({ request }) => {
 test.skip(!process.env.AUDIOTOUR_LIVE, 'Set AUDIOTOUR_LIVE=1 with gateway and SQL Server running.');
 const admin = await request.get('/api/v1/pois'); expect(admin.status()).toBe(401);
});
