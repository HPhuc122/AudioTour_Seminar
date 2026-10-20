import { expect, test, type Page } from '@playwright/test';

async function setup(page: Page, role: string) {
  await page.addInitScript(role => sessionStorage.setItem('audiotour:session', JSON.stringify({ userId: 12, username: 'manager', role, accessToken: 'test-token', expiresAtUtc: new Date(Date.now() + 3600000).toISOString() })), role);
  await page.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname;
    const row = { Id: 1, Name: 'Sạp thử nghiệm', POIId: 1, Code: 'TEST', LanguageCode: 'vi', Description: 'Nội dung cần duyệt', Latitude: 11.7, Longitude: 109.1, RadiusMeters: 50, ReviewStatus: 'Pending' };
    const submission = { Id: 7, Resource: 'poi-translations', EntityId: 1, BaseVersion: 1, Status: 'Pending', Operation: 'update', PayloadJson: JSON.stringify({ Description: 'Nội dung đề xuất mới' }) };
    const data = path.endsWith('/review-queue') ? { items: [submission], total: 1 } : path.includes('/review-dossier/') ? { submission, canonical: row, proposed: { ...row, Description: 'Nội dung đề xuất mới' }, submitter: { Username: 'vendor', Email: 'vendor@example.test' } } : path.endsWith('/pois') ? { items: [row], total: 1 } : path.endsWith('/poi-translations/1') ? row : { items: [], total: 0 };
    return route.fulfill({ json: { success: true, data } });
  });
}
test('Vendor can manage content but has no approval or account controls', async ({ page }) => {
  await setup(page, 'Vendor'); await page.goto('/admin/pois');
  await expect(page.getByRole('button', { name: 'Thêm mới' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Phân quyền', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Người dùng', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Sửa', exact: true }).click();
  await expect(page.getByLabel('Trạng thái xuất bản')).toHaveCount(0);
  await page.goto('/admin/review'); await page.getByRole('button', { name: 'Xem nội dung' }).click();
  await expect(page.getByText('Nội dung đề xuất mới', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Duyệt nội dung', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Từ chối', exact: true })).toHaveCount(0);
});
test('approval requires a concrete confirmation', async ({ page }) => {
  await setup(page, 'Admin'); await page.goto('/admin/review');
  await page.getByRole('button', { name: 'Xem nội dung' }).click();
  let approvals = 0; page.on('request', r => { if (r.url().endsWith('/approve')) approvals++; });
  await page.getByRole('button', { name: 'Duyệt nội dung', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Xác nhận duyệt hồ sơ' })).toBeVisible();
  expect(approvals).toBe(0);
  const request = page.waitForRequest(r => r.url().endsWith('/submissions/7/approve'));
  await page.getByRole('button', { name: 'Xác nhận duyệt', exact: true }).click();
  expect((await request).method()).toBe('POST');
  await expect(page.getByRole('status').filter({ hasText: 'Đã duyệt hồ sơ' })).toContainText('Đã duyệt hồ sơ');
});
test('Admin must supply a reason when rejecting a pending proposal', async ({ page }) => {
  await setup(page, 'Admin'); await page.goto('/admin/review'); await page.getByRole('button', { name: 'Xem nội dung' }).click();
  await expect(page.getByRole('button', { name: 'Duyệt nội dung', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Từ chối', exact: true }).click();
  await page.getByRole('button', { name: 'Xác nhận từ chối' }).click();
  await expect(page.getByLabel('Lý do từ chối')).toBeVisible();
  await page.getByLabel('Lý do từ chối').fill('Cần sửa thông tin địa điểm');
  const request = page.waitForRequest(r => r.url().endsWith('/submissions/7/reject') && r.method() === 'POST');
  await page.getByRole('button', { name: 'Xác nhận từ chối' }).click();
  expect((await request).postDataJSON()).toEqual({ reason: 'Cần sửa thông tin địa điểm' });
});
