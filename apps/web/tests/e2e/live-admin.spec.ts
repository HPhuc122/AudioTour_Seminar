import { expect, test } from '@playwright/test';
const pages = [['dashboard', 'Tổng quan hệ thống'], ['review', 'Duyệt nội dung'], ['pois', 'Quản lý địa điểm'], ['tours', 'Tour tham quan'], ['translations', 'Nội dung đa ngôn ngữ'], ['media', 'Quản lý hình ảnh'], ['audio', 'Thư viện audio'], ['narrations', 'Nội dung thuyết minh'], ['vendors', 'Hồ sơ chủ sạp'], ['validity', 'Thời hạn sử dụng POI'], ['transactions', 'Giao dịch và thanh toán'], ['users', 'Quản lý người dùng'], ['languages', 'Cấu hình ngôn ngữ'], ['automation', 'Dịch tự động và tạo audio'], ['settings', 'Cấu hình hệ thống']];
for (const [path, title] of pages) {
  test('live Admin: ' + path, async ({ page }) => {
    test.skip(!process.env.AUDIOTOUR_ADMIN_SESSION, 'Run with a short-lived local Admin session.');
    const session = JSON.parse(process.env.AUDIOTOUR_ADMIN_SESSION!);
    await page.addInitScript(session => sessionStorage.setItem('audiotour:session', JSON.stringify(session)), session);
    const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
    const apiErrors: string[] = []; page.on('response', r => { if (r.url().includes('/api/v1/') && r.status() >= 400) apiErrors.push(`${r.status()} ${new URL(r.url()).pathname}`); });
    await page.goto('/admin/' + path); await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await expect(page.getByText('Đang tải dữ liệu…', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByText(/dữ liệu mẫu/i)).toHaveCount(0);
    expect(errors).toEqual([]); expect(apiErrors).toEqual([]);
  });
}
