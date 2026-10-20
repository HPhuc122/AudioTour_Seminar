export function parseQr(input: string, origin: string) {
  const trimmed = input.trim();
  if (!trimmed) throw new Error('Mã QR đang trống.');
  if (/^https?:\/\//i.test(trimmed)) { const url = new URL(trimmed); if (url.origin !== origin) throw new Error('Mã QR không thuộc web AudioTour này.'); const match = url.pathname.match(/^\/qr\/([^/]+)\/?$/); if (!match) throw new Error('Đường dẫn QR không hợp lệ.'); return decodeURIComponent(match[1]); }
  if (trimmed.length > 200 || /[\r\n]/.test(trimmed)) throw new Error('Mã QR không hợp lệ.');
  return trimmed;
}
