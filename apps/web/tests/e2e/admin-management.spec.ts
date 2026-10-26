import { expect, test, type Page } from '@playwright/test';
async function setup(page: Page) {
  await page.addInitScript(() => sessionStorage.setItem('audiotour:session', JSON.stringify({ userId: 1, username: 'admin', role: 'Admin', accessToken: 'test.header.signature', expiresAtUtc: new Date(Date.now() + 3600000).toISOString() })));
  const writes: { method: string; path: string; body: Record<string, unknown> }[] = [];
  const poi = { Id: 1, Code: 'POI-1', Name: 'Bãi biển', Latitude: 11.7, Longitude: 109.1, RadiusMeters: 50, ReviewStatus: 'Approved' };
  const user = { Id: 12, id: 12, username: 'vendor', email: 'vendor@example.test', roleId: 3, role: 'Vendor', isActive: true };
  let grants: Record<string, unknown>[] = [];
  let rows = [user];
  let tourPois = [{ POIId: 1, Name: 'Bãi biển' }, { POIId: 2, Name: 'Bến cá' }];
  await page.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname;
    expect(request.headers().authorization).toBe('Bearer test.header.signature');
    if (request.method() !== 'GET') {
      const body = request.postData() ? request.postDataJSON() : {};
      writes.push({ method: request.method(), path, body });
      if (path.endsWith('/users')) rows = [...rows, { ...user, ...body, Id: 13, id: 13 }];
      if (path.endsWith('/users/12')) rows = rows.map(row => row.Id === 12 ? { ...row, ...body } : row);
      if (path.includes('/grants/')) grants = request.method() === 'DELETE' ? [] : [{ UserId: 12 }];
      if (path.endsWith('/pois/reorder')) tourPois = body.items.map((item: { poiId: number }) => tourPois.find(p => p.POIId === item.poiId)!);
      return route.fulfill({ json: { success: true, data: body } });
    }
    const data = path.endsWith('/catalog/users') ? { items: rows, total: rows.length }
      : path.endsWith('/users') ? rows
      : path.endsWith('/roles') ? [{ id: 3, name: 'Vendor' }, { id: 1, name: 'Admin' }]
      : path.includes('/grants/') ? grants
      : path.endsWith('/web/tours/1/content') ? { tour: { Id: 1, Code: 'TOUR-1' }, translations: [], pois: tourPois }
      : path.endsWith('/languages') ? [{ code: 'vi', nativeName: 'Tiếng Việt' }, { code: 'en', nativeName: 'English' }]
      : path.endsWith('/catalog/audio') ? { items: [{ Id: 5, POIId: 1, Title: 'Thuyết minh cũ', LanguageCode: 'vi', DurationSeconds: 60, IsActive: true, FileUrl: 'uploads/audio/real.wav' }], total: 1 }
      : { items: [poi], total: 1 };
    return route.fulfill({ json: { success: true, data } });
  });
  return writes;
}

test('Admin creates a Vendor and disables an existing account', async ({ page }) => {
  const writes = await setup(page); await page.goto('/admin/users');
  await page.getByRole('button', { name: 'Thêm mới', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Tên đăng nhập').fill('vendor-moi');
  await dialog.getByLabel('Email').fill('new@example.test');
  await dialog.getByLabel('Mật khẩu', { exact: false }).fill('Example-password-123');
  await dialog.getByLabel('Vai trò').selectOption('3');
  await dialog.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(dialog).toHaveCount(0);
  expect(writes[0]).toMatchObject({ method: 'POST', path: '/api/v1/users', body: { username: 'vendor-moi', roleId: 3 } });
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Vô hiệu hóa', exact: true }).first().click();
  await expect(page.getByRole('status')).toContainText('Đã vô hiệu hóa');
  expect(writes[1]).toMatchObject({ method: 'PUT', path: '/api/v1/users/12', body: { isActive: false } });
});

test('Admin grants and revokes a Vendor access to a POI', async ({ page }) => {
  const writes = await setup(page); await page.goto('/admin/pois');
  await page.getByRole('button', { name: 'Phân quyền', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Phân quyền nội dung' });
  await dialog.getByLabel('Tài khoản được cấp quyền').selectOption('12');
  await dialog.getByRole('button', { name: 'Cấp quyền', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Thu hồi' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Thu hồi' }).click();
  await expect(dialog.getByRole('button', { name: 'Thu hồi' })).toHaveCount(0);
  expect(writes.map(w => [w.method, w.path])).toEqual([['PUT', '/api/v1/cms/grants/pois/1/12'], ['DELETE', '/api/v1/cms/grants/pois/1/12']]);
});

test('Admin submits tour POI order and a tour translation for review', async ({ page }) => {
  const writes = await setup(page); await page.goto('/admin/tours/1');
  await page.getByRole('button', { name: 'Xuống', exact: true }).first().click();
  await expect(page.getByRole('status')).toContainText('Thứ tự đang công khai được giữ nguyên');
  expect(writes[0].body).toEqual({ items: [{ poiId: 2, orderIndex: 0 }, { poiId: 1, orderIndex: 1 }] });
  await page.getByRole('button', { name: 'Thêm bản dịch', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Bản dịch tour' });
  await dialog.getByLabel('Tên tour').fill('Tour biển');
  await dialog.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(dialog).toHaveCount(0);
  expect(writes[1]).toMatchObject({ method: 'POST', path: '/api/v1/tours/1/translations', body: { LanguageCode: 'vi', Name: 'Tour biển' } });
});

test('Admin edits audio metadata without rewriting its uploaded file', async ({ page }) => {
  const writes = await setup(page); await page.goto('/admin/audio');
  await page.getByRole('button', { name: 'Sửa', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Thông tin audio' });
  await dialog.getByLabel('Tên audio').fill('Thuyết minh đã sửa');
  await dialog.getByLabel('Ngôn ngữ').selectOption('en');
  await dialog.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(dialog).toHaveCount(0);
  expect(writes[0]).toMatchObject({ method: 'PUT', path: '/api/v1/audio/5', body: { Title: 'Thuyết minh đã sửa', LanguageCode: 'en', POIId: 1 } });
  expect(writes[0].body).not.toHaveProperty('FileUrl');
});

test('switching Admin resources resets the previous search and page', async ({ page }) => {
  await setup(page); await page.goto('/admin/pois');
  await page.getByLabel('Tìm kiếm', { exact: true }).fill('POI-1');
  await page.getByRole('button', { name: 'Tìm kiếm', exact: true }).click();
  const request = page.waitForRequest(r => r.url().includes('/cms/catalog/tours?'));
  await page.getByRole('link', { name: 'Tour tham quan', exact: true }).click();
  const url = new URL((await request).url());
  expect(url.searchParams.get('search')).toBe(''); expect(url.searchParams.get('page')).toBe('1');
  await expect(page.getByLabel('Tìm kiếm', { exact: true })).toHaveValue('');
});
