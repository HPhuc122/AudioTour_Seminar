import type { ApiResponse } from '@audiotour/api-client';
import type { PublicPoi, PublicTour, Page, Language, Session, AccessStartResult, AccessValidation, Row } from '../types';
export const baseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
export class ApiError extends Error { constructor(message: string, public status: number) { super(message); } }
export async function request<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers, signal: init.signal || AbortSignal.timeout(30000) });
  const body = await response.json().catch(() => null) as (ApiResponse<T> & { detail?: unknown }) | null;
  if (!response.ok || !body?.success) {
    if (token && response.status === 401) window.dispatchEvent(new Event('audiotour:unauthorized'));
    const detail = typeof body?.detail === 'string' ? body.detail : body?.detail ? JSON.stringify(body.detail) : undefined;
    throw new ApiError(detail || body?.message || `Không thể tải dữ liệu (${response.status}).`, response.status);
  }
  return body.data;
}
export const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });
export const guestHeaders = (token: string): HeadersInit => ({ 'X-Guest-Access-Token': token });
export const api = {
  login: (username: string, password: string) => request<Session>('/api/v1/auth/login', json('POST', { username, password })),
  languages: () => request<Language[]>('/api/v1/languages?activeOnly=true'),
  pois: (lang: string, page = 1, search = '') => request<Page<PublicPoi>>(`/api/v1/public/pois?lang=${encodeURIComponent(lang)}&page=${page}&pageSize=24&search=${encodeURIComponent(search)}`),
  allPois: async (lang: string, signal?: AbortSignal) => {
    const items: PublicPoi[] = []; let page = 1; let total = Infinity;
    while (items.length < total) { const data = await request<Page<PublicPoi>>(`/api/v1/public/pois?lang=${encodeURIComponent(lang)}&page=${page++}&pageSize=100`, { signal }); total = data.total; items.push(...data.items); if (!data.items.length) break; }
    return items;
  },
  poi: (id: number, lang: string) => request<PublicPoi>(`/api/v1/public/pois/${id}?lang=${encodeURIComponent(lang)}`),
  tours: (lang: string) => request<PublicTour[]>(`/api/v1/public/tours?lang=${encodeURIComponent(lang)}`),
  tour: (id: number, lang: string) => request<PublicTour>(`/api/v1/public/tours/${id}?lang=${encodeURIComponent(lang)}`),
  startTarget: (targetType: 'poi' | 'tour', targetId: number) => request<AccessStartResult>('/api/v1/public/access/start-target', json('POST', { targetType, targetId })),
  startQr: (qrCode: string) => request<AccessStartResult>('/api/v1/public/access/start', json('POST', { qrCode })),
  resolveQr: (code: string) => request<{ targetType: 'poi' | 'tour'; targetId: number }>(`/api/v1/qr/resolve/${encodeURIComponent(code)}`),
  validate: (token: string) => request<AccessValidation>('/api/v1/public/access/validate', { headers: guestHeaders(token) }),
  authorizedPoi: (id: number, lang: string, token: string) => request<PublicPoi>(`/api/v1/public/web-narration/pois/${id}?languageCode=${encodeURIComponent(lang)}`, { headers: guestHeaders(token) }),
  playLog: (trackId: number, lang: string, triggerType: string, seconds: number) => request('/api/v1/public/audio/' + trackId + '/play-log?languageCode=' + encodeURIComponent(lang) + '&triggerType=' + triggerType + '&durationPlayedSeconds=' + Math.floor(seconds), { method: 'POST' }),
  ttsLog: (poiId: number, lang: string, triggerType: string, seconds: number, token: string) => request('/api/v1/public/web-narration/play-log', { ...json('POST', { poiId, languageCode: lang, triggerType, durationPlayedSeconds: Math.floor(seconds) }), headers: guestHeaders(token) }),
  image: (id: number) => `${baseUrl}/api/v1/public/media/images/${id}`,
  admin: <T,>(path: string, token: string, init?: RequestInit) => request<T>(`/api/v1/${path}`, init, token),
  audioBlob: async (id: number, token: string) => {
    const response = await fetch(`${baseUrl}/api/v1/public/audio/${id}`, { headers: guestHeaders(token), signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new ApiError('Không thể mở audio. Hãy kiểm tra quyền truy cập.', response.status);
    return response.blob();
  },
  upload: (file: File, poiId: number, token: string) => { const body = new FormData(); body.append('file', file); return request<Row>(`/api/v1/media/upload?poiId=${poiId}${file.type.startsWith('image/') ? '&imageCategory=Highlight' : ''}`, { method: 'POST', body }, token); },
};
