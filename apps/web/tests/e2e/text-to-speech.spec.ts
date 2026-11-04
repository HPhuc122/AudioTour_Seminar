import { expect, test, type Page } from '@playwright/test';

async function setup(page: Page, role = 'Admin', configured = false) {
  await page.addInitScript(role => sessionStorage.setItem('audiotour:session', JSON.stringify({ userId: 1, username: 'test', role, accessToken: 'test.header.signature', expiresAtUtc: new Date(Date.now() + 3600000).toISOString() })), role);
  const writes: { path: string; body: Record<string, unknown> }[] = [];
  await page.route('**/api/v1/**', async route => {
    const request = route.request(); const path = new URL(request.url()).pathname;
    if (request.method() !== 'GET') writes.push({ path, body: request.postDataJSON() });
    const data = path.endsWith('/languages') ? [{ code: 'vi', nativeName: 'Tiếng Việt' }]
      : path.endsWith('/automation/status') ? { schemaReady: true, automatic: configured, ttsConfigured: configured, translationConfigured: false, jobs: configured ? [{ Id: 1, NarrationId: 5, SourceVersion: 2, LanguageCode: 'vi', Status: 'Queued', ready: false }] : [], total: configured ? 1 : 0 }
      : path.endsWith('/pois/1') ? { Id: 1, Name: 'Quán ăn', ReviewStatus: 'Approved' }
      : path.endsWith('/catalog/pois') ? { items: [{ Id: 1, Name: 'Quán ăn' }], total: 1 }
      : { items: [], total: 0 };
    await route.fulfill({ json: { success: true, data } });
  });
  return writes;
}

for (const role of ['Admin', 'Vendor']) {
  test(`${role} uses approved text instead of uploading audio`, async ({ page }) => {
    const writes = await setup(page, role);
    await page.goto(role === 'Admin' ? '/admin/audio?poi=1' : '/vendor/pois/1?tab=audio');
    await expect(page.getByRole('button', { name: 'Thêm file âm thanh' })).toHaveCount(0);
    await expect(page.locator('input[type=file]')).toHaveCount(0);
    await expect(page.getByRole('status')).toContainText('Chưa sẵn sàng tạo giọng tự động');
    await page.getByRole('link', { name: 'Nhập văn bản thuyết minh' }).click();
    await page.getByRole('button', { name: 'Thêm thuyết minh', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel(/Tiêu đề/).fill('Giới thiệu quán');
    await dialog.locator('textarea').fill('Mời bạn khám phá món ngon Vĩnh Khánh.');
    await dialog.getByRole('button', { name: 'Lưu thay đổi' }).click();
    await expect(dialog).toHaveCount(0);
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({ path: '/api/v1/narrations', body: { PoiId: 1, LanguageCode: 'vi', TextContent: 'Mời bạn khám phá món ngon Vĩnh Khánh.' } });
    expect(writes[0].body).not.toHaveProperty('ReviewStatus');
    expect(writes[0].body).not.toHaveProperty('FileUrl');
  });
}

test('shows generation status and allows refreshing it without creating tracks', async ({ page }) => {
  const writes = await setup(page, 'Admin', true);
  await page.goto('/admin/audio?poi=1');
  await expect(page.getByText('Chờ tạo giọng', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Cập nhật trạng thái' }).click();
  await expect(page.getByText('Chờ tạo giọng', { exact: true })).toBeVisible();
  expect(writes).toHaveLength(0);
});
