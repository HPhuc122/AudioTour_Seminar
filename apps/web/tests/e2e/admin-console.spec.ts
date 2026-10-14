import { expect, test, type Page } from '@playwright/test';
async function setup(page: Page) {
  await page.addInitScript(() => sessionStorage.setItem('audiotour:session', JSON.stringify({ userId: 1, username: 'admin-test', role: 'Admin', accessToken: 'test-token', expiresAtUtc: new Date(Date.now() + 3600000).toISOString() })));
  await page.route('**/api/v1/**', route => {
    const url = new URL(route.request().url()); const path = url.pathname;
    const poi = { Id: 1, Name: 'POI từ API', Code: 'REAL', ReviewStatus: 'Approved', ValidFrom: null, ValidUntil: null };
    const data = path.endsWith('/transactions') ? { items: [{ Id: 8, Provider: 'SimulatedMoMo', Status: 'Paid', Amount: 50000, Currency: 'VND', IsSimulated: true, EvidenceStatus: 'Chưa có bằng chứng đối soát' }], total: 1 } : path.endsWith('/validity') ? { items: [poi], total: 1 } : path.includes('/catalog/') ? { items: url.searchParams.get('search') ? [] : [poi], total: url.searchParams.get('search') ? 0 : 60 } : path.endsWith('/automation/status') ? { translationConfigured: false, ttsConfigured: false, automatic: false, jobs: [] } : path.endsWith('/console-summary') ? { pois: 23, tours: 8, audio: 20, media: 46, pending: 87, missingMedia: 46, expiring: 0, expired: 0 } : path.endsWith('/statistics') ? { summary: { plays: 0, durationSeconds: 0 }, dates: [], popular: [] } : path.endsWith('/languages') ? [{ code: 'vi', name: 'Tiếng Việt', nativeName: 'Tiếng Việt' }] : { items: [], total: 0 };
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
test('Paid simulation is explicitly unverified and has no confirm-payment action', async ({ page }) => {
  await setup(page); await page.goto('/admin/transactions'); await page.getByRole('button', { name: 'Xem hồ sơ' }).click();
  await expect(page.getByText('Đây là session của nhà cung cấp mô phỏng.')).toBeVisible();
  await expect(page.getByText('Chưa có bằng chứng đối soát', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /thanh toán thành công|đánh dấu đã thanh toán/i })).toHaveCount(0);
});
test('validity form validates order and submits ISO date proposal', async ({ page }) => {
  await setup(page); await page.goto('/admin/validity'); await page.getByRole('button', { name: 'Sửa thời hạn' }).click();
  await page.getByLabel('Bắt đầu (giờ địa phương)').fill('2027-02-01T10:00'); await page.getByLabel('Kết thúc (giờ địa phương)').fill('2027-01-01T10:00');
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click(); await expect(page.getByRole('alert')).toContainText('Ngày kết thúc phải sau');
  await page.getByLabel('Kết thúc (giờ địa phương)').fill('2027-03-01T10:00');
  const request = page.waitForRequest(r => r.url().endsWith('/cms/validity/1') && r.method() === 'PUT');
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click(); const body = (await request).postDataJSON(); expect(body.validFrom).toMatch(/Z$/); expect(body.validUntil).toMatch(/Z$/);
  await expect(page.getByRole('status')).toContainText('hàng đợi duyệt');
});
test('unconfigured generation is disabled', async ({ page }) => {
  await setup(page); await page.goto('/admin/automation'); await expect(page.getByRole('button', { name: 'Tạo và gửi duyệt' })).toBeDisabled();
  await expect(page.getByText('Chưa cấu hình nhà cung cấp dịch/TTS thật.', { exact: false })).toBeVisible();
});
test('dashboard works at desktop and tablet sizes with real API-shaped counts', async ({ page }) => {
  await setup(page);
  for (const width of [1440, 1024, 768]) {
    await page.setViewportSize({ width, height: 900 }); await page.goto('/admin/dashboard');
    await expect(page.getByRole('heading', { name: 'Tổng quan hệ thống' })).toBeVisible();
    await expect(page.getByText('46 file media đang thiếu trên máy.')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});
