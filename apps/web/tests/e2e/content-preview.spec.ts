import { expect, test, type Page } from '@playwright/test';

// These responses are isolated UI test fixtures, never a fallback for real media.
async function setup(page: Page, { submission = false, status = 200, file = true } = {}) {
  await page.addInitScript(() => sessionStorage.setItem('audiotour:session', JSON.stringify({ userId: 1, username: 'admin-test', role: 'Admin', accessToken: 'test.header.signature', expiresAtUtc: new Date(Date.now() + 3600000).toISOString() })));
  const streams: string[] = [];
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/stream') || path.endsWith('/preview')) {
      expect(!!route.request().headers().authorization).toBe(true);
      streams.push(path);
      if (status !== 200) return route.fulfill({ status });
      if (path.includes('/media/images/')) return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="green"/></svg>' });
      // A small valid WAV for testing browser controls and resource cleanup only.
      const wav = Buffer.alloc(1644);
      wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
      wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
      wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32);
      wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(1600, 40);
      return route.fulfill({ contentType: 'audio/wav', body: wav });
    }
    const rows = Array.from({ length: 25 }, (_, i) => ({ Id: i + 1, POIId: 1, Title: `Nội dung ${i + 1}`, OriginalFileName: `Ảnh ${i + 1}`, LanguageCode: 'vi', TextContent: `Thuyết minh dòng ${i + 1}`, Description: `Bản dịch dòng ${i + 1}`, ShortDescription: 'Mô tả ngắn', ReviewStatus: 'Approved', ...(file ? { FileUrl: 'uploads/audio/ui-test.wav' } : { TTSText: 'Văn bản chưa có audio' }), ...(submission ? { SubmissionId: 101 + i } : {}) }));
    const data = path.endsWith('/languages') ? [{ code: 'vi', nativeName: 'Tiếng Việt' }]
      : path.endsWith('/catalog/pois') ? { items: [{ Id: 1, Name: 'Địa điểm' }], total: 1 }
      : { items: rows, total: rows.length };
    return route.fulfill({ json: { success: true, data } });
  });
  return streams;
}

for (const [mode, text] of [['narrations', 'Thuyết minh dòng'], ['translations', 'Bản dịch dòng']]) {
  test(`${mode}: preview opens over a long table, closes and restores focus`, async ({ page }) => {
    await setup(page); await page.goto(`/admin/${mode}`);
    const trigger = page.getByRole('button', { name: 'Xem trước', exact: true }).nth(1);
    await trigger.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible(); await expect(dialog).toBeInViewport();
    await expect(dialog.getByText(`${text} 2`, { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Xem trước', exact: true }).last()).not.toBeInViewport();
    await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused();
    await page.getByRole('button', { name: 'Xem trước', exact: true }).first().click();
    await expect(dialog.getByText(`${text} 1`, { exact: true })).toBeVisible();
    await dialog.getByRole('button', { name: 'Đóng xem trước' }).click();
    await expect(dialog).toHaveCount(0);
  });
}

test('images stay in the dialog and table actions remain horizontal on narrow screens', async ({ page }) => {
  const streams = await setup(page);
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 900 }); await page.goto('/admin/media');
    const row = page.locator('tbody tr').first();
    const actions = row.locator('.content-row-actions');
    await expect(actions).toBeVisible();
    expect(await actions.evaluate(el => {
      const boxes = Array.from(el.children, child => child.getBoundingClientRect());
      const center = boxes[0].top + boxes[0].height / 2;
      return boxes.every(box => Math.abs(box.top + box.height / 2 - center) < 2 && box.height < 45);
    })).toBe(true);
    if (width === 390) expect(await page.locator('.content-table-scroll').evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true);
    await row.getByRole('button', { name: 'Xem trước' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeInViewport();
    await expect(dialog.getByRole('img')).toBeVisible();
    await expect.poll(() => dialog.getByRole('img').evaluate((el: HTMLImageElement) => el.naturalWidth)).toBe(80);
    if (width === 390) await page.screenshot({ path: test.info().outputPath('preview-mobile.png') });
    await dialog.getByRole('button', { name: 'Đóng xem trước' }).click();
  }
  expect([...new Set(streams)]).toEqual(['/api/v1/cms/media/images/1/stream']);
});

for (const submission of [false, true]) {
  test(`audio opens a player using the ${submission ? 'submission' : 'track'} endpoint`, async ({ page }) => {
    const streams = await setup(page, { submission }); await page.goto('/admin/audio');
    await page.getByRole('button', { name: 'Nghe file', exact: true }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeInViewport();
    const audio = dialog.locator('audio[controls]');
    await expect(audio).toBeVisible();
    await expect.poll(() => audio.evaluate((el: HTMLAudioElement) => el.readyState)).toBeGreaterThan(0);
    const url = await audio.getAttribute('src');
    await dialog.getByRole('button', { name: 'Đóng xem trước' }).click();
    await expect(page.locator('audio')).toHaveCount(0);
    expect(await page.evaluate(async src => { try { await fetch(src!); return false; } catch { return true; } }, url)).toBe(true);
    await page.getByRole('button', { name: 'Xem trước', exact: true }).first().click();
    await expect(dialog.locator('audio[controls]')).toBeVisible();
    expect([...new Set(streams)]).toEqual([submission ? '/api/v1/cms/submissions/101/preview' : '/api/v1/cms/audio-preview/1/stream']);
  });
}

for (const mode of ['media', 'audio']) for (const status of [404, 403]) {
  test(`${mode} HTTP ${status} is visible in the dialog without fallback media`, async ({ page }) => {
    const streams = await setup(page, { submission: true, status }); await page.goto(`/admin/${mode}`);
    await page.getByRole('button', { name: mode === 'audio' ? 'Nghe file' : 'Xem trước', exact: true }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('alert')).toContainText(`HTTP ${status}`);
    await expect(dialog.locator('audio, img')).toHaveCount(0);
    expect([...new Set(streams)]).toEqual(['/api/v1/cms/submissions/101/preview']);
  });
}

test('audio with text only explains that a real file is required', async ({ page }) => {
  const streams = await setup(page, { file: false }); await page.goto('/admin/audio');
  await page.getByRole('button', { name: 'Xem trước', exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Bản ghi chưa có file âm thanh.', { exact: false })).toBeVisible();
  await expect(dialog.locator('audio')).toHaveCount(0); expect(streams).toEqual([]);
});
