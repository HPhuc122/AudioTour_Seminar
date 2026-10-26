import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../docs/src/services/api';
import { isValidSession } from '../docs/src/lib/session';

afterEach(() => vi.unstubAllGlobals());

describe('authenticated application data', () => {
  it('loads management data from the service with the signed-in token', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: { items: [], total: 0 } }), { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    expect(await api.admin('cms/catalog/pois', 'header.payload.signature')).toEqual({ items: [], total: 0 });
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe('/api/v1/cms/catalog/pois');
    expect(options.headers.get('Authorization')).toBe('Bearer header.payload.signature');
  });
  it('shows an unavailable service rather than substituting local data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: false, detail: 'SQLSERVER_DATABASE connection failed' }), { status: 503 })));
    await expect(api.admin('cms/catalog/pois', 'header.payload.signature')).rejects.toThrow('Dịch vụ chưa sẵn sàng');
  });
  it('preserves actionable form validation messages', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: false, detail: 'Ngày kết thúc phải sau ngày bắt đầu.' }), { status: 422 })));
    await expect(api.admin('cms/validity/1', 'header.payload.signature')).rejects.toThrow('Ngày kết thúc phải sau ngày bắt đầu.');
  });
  it('reports connection errors in the application language', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(api.admin('cms/catalog/pois', 'header.payload.signature')).rejects.toThrow('Không thể kết nối dịch vụ');
  });
  it('distinguishes incorrect credentials from an expired session', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: false, detail: 'Invalid username or password' }), { status: 401 })));
    await expect(api.login('account', 'incorrect')).rejects.toThrow('Tên đăng nhập hoặc mật khẩu không đúng.');
  });
});

describe('persisted sign-in session', () => {
  const session = { accessToken: 'header.payload.signature', username: 'account', userId: 1, role: 'Admin', expiresAtUtc: '2099-01-01T00:00:00Z', refreshToken: '' };
  it('accepts an unexpired server session', () => {
    expect(isValidSession(session)).toBe(true);
  });
  it.each([null, {}, { ...session, accessToken: 'local-session' }, { ...session, userId: 0 }, { ...session, expiresAtUtc: '2000-01-01T00:00:00Z' }, { ...session, expiresAtUtc: 'invalid' }])('rejects invalid, local or expired session state', value => {
    expect(isValidSession(value)).toBe(false);
  });
});
