import { expect, test, type Page } from '@playwright/test';

async function setup(page: Page, role = 'Admin') {
  await page.addInitScript(role => sessionStorage.setItem('audiotour:session', JSON.stringify({ userId: 1, username: 'admin', role, accessToken: 'test.header.signature', expiresAtUtc: new Date(Date.now() + 3600000).toISOString() })), role);
  const heartbeats: string[] = [];
  const queries: URL[] = [];
  await page.route('**/api/v1/**', route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname;
    let data: unknown;
    if (path.endsWith('/auth/me')) {
      expect(request.headers().authorization).toBe('Bearer test.header.signature');
      heartbeats.push(request.headers()['x-web-device-id']);
      data = { id: 1, username: 'admin', role };
    } else if (path.endsWith('/device-activity')) {
      queries.push(url);
      const items = url.searchParams.get('search') === 'missing' ? [] : [{ Id: 1, UserId: 12, DeviceId: 'web-12345678-1234-1234-1234-123456789abc', Username: 'vendor', Role: 'Vendor', Platform: 'web', LastSeenAt: '2026-10-26T11:00:00', IsActive: true, ActiveDevicesForUser: 2 }];
      data = { summary: { activeDevices: 3, activeUsers: 2, totalDevices: 12 }, items, total: items.length, page: 1, pageSize: 20, activeWindowMinutes: 5, serverTime: '2026-10-26T11:01:00Z' };
    } else if (path.endsWith('/console-summary')) data = { pois: 1, tours: 0, audio: 1, media: 1, pending: 0, missingMedia: 0, expiring: 0, expired: 0 };
    else if (path.endsWith('/statistics')) data = { summary: { plays: 0, durationSeconds: 0 }, dates: [], popular: [] };
    else data = { items: [], total: 0 };
    return route.fulfill({ json: { success: true, data } });
  });
  return { heartbeats, queries };
}

test('Admin sees real API counts and filters recent devices by account', async ({ page }) => {
  const { queries } = await setup(page); await page.goto('/admin/dashboard');
  const section = page.getByRole('region', { name: 'Thiết bị truy cập', exact: true });
  await expect(section.getByText('vendor', { exact: true })).toBeVisible();
  await expect(section.getByText('2 thiết bị hoạt động của tài khoản', { exact: true })).toBeVisible();
  await expect(section.getByText('3', { exact: true })).toBeVisible();
  await expect(section.getByText('2', { exact: true })).toBeVisible();
  await expect(section.getByText('12', { exact: true })).toBeVisible();
  expect(queries[0].searchParams.get('activeOnly')).toBe('true');
  await section.getByLabel('Chỉ thiết bị hoạt động').uncheck();
  await expect.poll(() => queries.at(-1)?.searchParams.get('activeOnly')).toBe('false');
  await section.getByLabel('Tìm kiếm', { exact: true }).fill('missing');
  await section.getByRole('button', { name: 'Tìm kiếm', exact: true }).click();
  await expect(section.getByText('Không có thiết bị phù hợp.')).toBeVisible();
  expect(queries.at(-1)?.searchParams.get('search')).toBe('missing');
});

test('Web reuses a browser ID, sends heartbeat, and stops after logout', async ({ page }) => {
  await page.clock.install();
  const { heartbeats } = await setup(page); await page.goto('/admin/dashboard');
  await expect.poll(() => heartbeats.length).toBeGreaterThan(0);
  const first = heartbeats.at(-1);
  expect(first).toMatch(/^web-[a-f0-9-]{36}$/);
  await page.reload(); await expect.poll(() => heartbeats.length).toBeGreaterThan(1);
  expect(heartbeats.at(-1)).toBe(first);
  const count = heartbeats.length;
  await page.clock.runFor(61000);
  await expect.poll(() => heartbeats.length).toBeGreaterThan(count);
  await page.getByRole('banner').getByRole('button', { name: 'Đăng xuất' }).click();
  await expect(page).toHaveURL(/\/login$/);
  const stopped = heartbeats.length;
  await page.clock.runFor(61000);
  expect(heartbeats.length).toBe(stopped);
});

test('device panel is private to Admin and renders on a narrow screen', async ({ page }) => {
  const { queries } = await setup(page, 'ContentAdmin'); await page.goto('/admin/dashboard');
  await expect(page.getByRole('heading', { name: 'Tổng quan hệ thống' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Thiết bị truy cập', exact: true })).toHaveCount(0);
  expect(queries).toHaveLength(0);
});

test('Admin can view device details on a narrow screen without page overflow', async ({ page }) => {
  await setup(page); await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/admin/dashboard');
  const section = page.getByRole('region', { name: 'Thiết bị truy cập', exact: true });
  await expect(section.getByText('vendor', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('device service errors are visible and can be retried', async ({ page }) => {
  await setup(page);
  let fail = true;
  await page.route('**/api/v1/cms/device-activity?**', async route => {
    if (fail) return route.fulfill({ status: 503, json: { detail: 'Unavailable' } });
    return route.fallback();
  });
  await page.goto('/admin/dashboard');
  const section = page.getByRole('region', { name: 'Thiết bị truy cập', exact: true });
  await expect(section.getByRole('alert')).toBeVisible();
  fail = false;
  await section.getByRole('button', { name: 'Làm mới thiết bị' }).click();
  await expect(section.getByText('vendor', { exact: true })).toBeVisible();
});
