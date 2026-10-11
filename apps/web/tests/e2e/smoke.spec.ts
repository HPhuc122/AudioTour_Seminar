import { expect, test } from '@playwright/test';
test('public navigation, unavailable API states and admin guard', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/'); await expect(page.getByRole('heading', { name: /Khám phá địa điểm/ })).toBeVisible();
  await page.getByRole('link', { name: 'Địa điểm', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Địa điểm & câu chuyện' })).toBeVisible();
  await page.goto('/tours'); await expect(page.getByRole('heading', { name: 'Những hành trình đáng nhớ' })).toBeVisible();
  await page.goto('/qr'); await expect(page.getByRole('heading', { name: 'Quét mã QR', exact: true })).toBeVisible();
  await page.goto('/map'); await expect(page.getByRole('heading', { name: 'Bản đồ khám phá' })).toBeVisible();
  await page.goto('/admin/pois'); await expect(page).toHaveURL(/\/login$/); await expect(page.getByRole('heading', { name: 'Đăng nhập quản trị' })).toBeVisible();
  expect(errors).toEqual([]);
});
test('mobile-width public navigation remains usable', async ({ page }) => { await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/'); await page.getByRole('link', { name: 'Quét QR', exact: true }).click(); await expect(page.getByRole('button', { name: 'Mở camera quét QR' })).toBeVisible(); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); });
test('live gateway integration', async ({ request }) => {
  test.skip(!process.env.AUDIOTOUR_LIVE, 'Set AUDIOTOUR_LIVE=1 after starting gateway and SQL Server.');
  const languages = await request.get('/api/v1/languages?activeOnly=true'); expect(languages.ok()).toBe(true); expect((await languages.json()).success).toBe(true);
  const pois = await request.get('/api/v1/public/pois?lang=vi&page=1&pageSize=24'); expect(pois.ok()).toBe(true); const body = await pois.json(); expect(body.success).toBe(true); expect(Array.isArray(body.data.items)).toBe(true);
  const admin = await request.get('/api/v1/pois'); expect(admin.status()).toBe(401);
});
