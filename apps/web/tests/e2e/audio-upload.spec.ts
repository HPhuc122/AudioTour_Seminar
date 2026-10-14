import { expect, test, type Page } from '@playwright/test';
async function setup(page: Page, failOnce = false) {
  await page.addInitScript(() => sessionStorage.setItem('audiotour:session', JSON.stringify({ userId: 1, username: 'admin-test', role: 'Admin', accessToken: 'test-token', expiresAtUtc: new Date(Date.now() + 3600000).toISOString() })));
  let uploads = 0; let creates = 0; const rows: Record<string, unknown>[] = [];
  await page.route('**/api/v1/**', async route => {
    const request = route.request(); const url = new URL(request.url()); const path = url.pathname;
    let data: unknown;
    if (path.endsWith('/languages')) data = [{ code: 'vi', nativeName: 'Tiếng Việt' }, { code: 'en', nativeName: 'English' }];
    else if (path.endsWith('/catalog/pois')) data = { items: [{ Id: 1, Name: 'Bãi biển' }], total: 1 };
    else if (path.endsWith('/media/upload')) {
      uploads++; expect(url.searchParams.get('poiId')).toBe('1'); expect(request.headers()['content-type']).toContain('multipart/form-data');
      data = { Id: 15, RelativePath: 'uploads/audio/test.wav', ContentType: 'audio/wav', FileSize: 204, ReviewStatus: 'Pending' };
    } else if (path.endsWith('/audio') && request.method() === 'POST') {
      creates++; const payload = request.postDataJSON(); expect(payload.POIId).toBe(1); expect(payload.AudioType).toBe('prerecorded'); expect(payload.FileUrl).toBe('uploads/audio/test.wav');
      if (failOnce && creates === 1) return route.fulfill({ status: 409, json: { detail: 'Chưa lưu được bản ghi audio' } });
      rows.push({ ...payload, Id: 16, ReviewStatus: 'Pending' }); data = rows[0];
    } else data = { items: path.endsWith('/catalog/audio') ? rows : [], total: rows.length };
    return route.fulfill({ json: { success: true, data } });
  });
  return () => ({ uploads, creates });
}
async function selectFile(page: Page) {
  await page.getByRole('button', { name: 'Thêm file âm thanh' }).click();
  const dialog = page.getByRole('dialog', { name: 'Thêm file âm thanh' });
  await dialog.getByRole('combobox', { name: 'Địa điểm của audio' }).selectOption('1');
  await dialog.getByLabel('File âm thanh', { exact: true }).setInputFiles({ name: 'Gioi-thieu.wav', mimeType: 'audio/wav', buffer: Buffer.alloc(204) });
  await dialog.getByLabel('Tên audio', { exact: true }).fill('Giới thiệu bãi biển');
  await dialog.getByRole('combobox', { name: 'Ngôn ngữ', exact: true }).selectOption('en');
  return dialog;
}
test('adds uploaded audio to the library with POI and language', async ({ page }) => {
  const counts = await setup(page); await page.goto('/admin/audio'); const dialog = await selectFile(page);
  await dialog.getByRole('button', { name: 'Lưu vào thư viện' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Giới thiệu bãi biển', { exact: true })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Đã thêm file vào thư viện audio');
  await expect(page.getByRole('cell', { name: 'Chờ duyệt', exact: true })).toBeVisible();
  expect(counts()).toEqual({ uploads: 1, creates: 1 });
});
test('retrying audio creation reuses uploaded file', async ({ page }) => {
  const counts = await setup(page, true); await page.goto('/admin/audio'); const dialog = await selectFile(page);
  await dialog.getByRole('button', { name: 'Lưu vào thư viện' }).click();
  await expect(dialog.getByRole('alert')).toContainText('File đã tải lên được giữ lại');
  await dialog.getByRole('button', { name: 'Lưu vào thư viện' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(counts()).toEqual({ uploads: 1, creates: 2 });
});
