export type ApiResponse<T> = { success: boolean; message: string; data: T };

export type Tour = { id: number; code: string; name: string; description?: string; estimatedMinutes?: number; pois?: Poi[] };
export type Poi = {
  id: number;
  code: string;
  name: string;
  shortDescription?: string;
  description?: string;
  narrationText?: string;
  latitude: number;
  longitude: number;
  imageUrl?: string;
  category?: string;
  orderIndex?: number;
  audioTracks?: AudioTrack[];
};
export type AudioTrack = { id: number; audioTrackId: number; languageCode: string; title: string; audioType: string; durationSeconds?: number; fileSizeBytes?: number; mimeType?: string; isAvailable: boolean };
export type Language = { code: string; name: string; nativeName: string; isActive: boolean; sortOrder: number };
export type QrLocation = { id: number; code: string; name?: string; poiId?: number; tourId?: number; requiresPayment: boolean; priceAmount: number; accessDurationMinutes: number };
export type AccessStartResult = { qr: QrLocation; requiresPayment: boolean; amount: number; currency: string; accessDurationMinutes: number; paymentSessionId?: number; status: string; accessToken?: string; expiresAt?: string };
export type PaymentResult = { status: string; accessToken?: string; expiresAt?: string; qrLocationId?: number; poiId?: number; tourId?: number };
export type AccessValidation = { isValid: boolean; status: string; expiresAt?: string; remainingSeconds: number; qrLocationId?: number; poiId?: number; tourId?: number };
export type PublicPackage = { code: string; name?: string; requiresPayment: boolean; priceAmount: number; accessDurationMinutes: number; publicQrUrl: string };
export type RouteResult = { fromPoiId: number; toPoiId: number; directDistanceMeters: number; routeDistanceMeters: number; durationSeconds: number; latLngs: Array<{ latitude: number; longitude: number }> };
export type LoginResult = { accessToken: string; expiresAtUtc: string; userId: number; username: string; role: string };

type QueryValue = string | number | boolean | undefined | null;

export class AudioTourApiClient {
  constructor(private readonly baseUrl: string) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, { headers: { "Content-Type": "application/json", ...init?.headers }, ...init });
    const body = (await response.json()) as ApiResponse<T>;
    if (!response.ok || !body.success) throw new Error(body.message || "API request failed");
    return body.data;
  }

  private query(path: string, params: Record<string, QueryValue>) {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
    });
    const queryString = search.toString();
    return queryString ? `${path}?${queryString}` : path;
  }

  login(username: string, password: string) {
    return this.request<LoginResult>("/api/v1/auth/login", { method: "POST", body: JSON.stringify({ username, password }) });
  }

  registerDevice(deviceId: string, platform: string, appVersion?: string, osVersion?: string) {
    return this.request<void>("/api/v1/auth/register-device", { method: "POST", body: JSON.stringify({ deviceId, platform, appVersion, osVersion }) });
  }

  getTours(lang = "vi") { return this.request<Tour[]>(this.query("/api/v1/public/tours", { lang })); }
  getTour(id: number, lang = "vi") { return this.request<Tour>(this.query(`/api/v1/public/tours/${id}`, { lang })); }
  getPois(params: { lang?: string; page?: number; pageSize?: number; search?: string; category?: string } = {}) { return this.request<{ items: Poi[]; page: number; pageSize: number; total: number }>(this.query("/api/v1/public/pois", { lang: params.lang ?? "vi", page: params.page, pageSize: params.pageSize, search: params.search, category: params.category })); }
  getPoi(id: number, lang = "vi") { return this.request<Poi>(this.query(`/api/v1/public/pois/${id}`, { lang })); }

  getQrByCode(code: string) { return this.request<QrLocation>(`/api/v1/qr/code/${encodeURIComponent(code)}`); }
  resolveQr(code: string) { return this.request<QrLocation & { targetType: "poi" | "tour"; targetId: number }>(`/api/v1/qr/resolve/${encodeURIComponent(code)}`); }
  getPackages() { return this.request<PublicPackage[]>("/api/v1/public/packages"); }
  getLanguages(activeOnly = true) { return this.request<Language[]>(this.query("/api/v1/languages", { activeOnly })); }

  startAccess(qrCode: string, deviceId?: string) {
    return this.request<AccessStartResult>("/api/v1/public/access/start", { method: "POST", headers: deviceId ? { "X-Guest-Device-Id": deviceId } : undefined, body: JSON.stringify({ qrCode }) });
  }

  simulatePayment(paymentSessionId: number, success = true) {
    return this.request<PaymentResult>("/api/v1/public/access/simulate-payment", { method: "POST", body: JSON.stringify({ paymentSessionId, success }) });
  }

  validateAccess(accessToken: string) {
    return this.request<AccessValidation>("/api/v1/public/access/validate", { headers: { "X-Guest-Access-Token": accessToken } });
  }

  getAudioTour(tourId: number, accessToken: string, languageCode = "vi") {
    return this.request<Tour>(this.query(`/api/v1/public/audio-tour/tours/${tourId}`, { languageCode }), { headers: { "X-Guest-Access-Token": accessToken } });
  }

  getAudioPoi(poiId: number, accessToken: string, languageCode = "vi", triggerType = "manual", deviceId?: string) {
    return this.request<Poi>(this.query(`/api/v1/public/audio-tour/pois/${poiId}`, { languageCode, triggerType }), { headers: { "X-Guest-Access-Token": accessToken, ...(deviceId ? { "X-Guest-Device-Id": deviceId } : {}) } });
  }

  recordAudioPlay(audioTrackId: number, params: { languageCode?: string; triggerType?: string; durationPlayedSeconds?: number; deviceId?: string } = {}) {
    return this.request<{ recorded: boolean }>(this.query(`/api/v1/public/audio/${audioTrackId}/play-log`, { languageCode: params.languageCode ?? "vi", triggerType: params.triggerType ?? "manual", durationPlayedSeconds: params.durationPlayedSeconds }), { method: "POST", headers: params.deviceId ? { "X-Guest-Device-Id": params.deviceId } : undefined });
  }

  getPoiToPoiRoute(fromPoiId: number, toPoiId: number) { return this.request<RouteResult>(this.query("/api/v1/public/routes/poi-to-poi", { fromPoiId, toPoiId })); }
  getNearestPoiRoute(fromPoiId: number) { return this.request<RouteResult>(this.query("/api/v1/public/routes/nearest-poi", { fromPoiId })); }

  audioUrl(audioTrackId: number) { return `${this.baseUrl}/api/v1/public/audio/${audioTrackId}`; }
  imageUrl(mediaFileId: number) { return `${this.baseUrl}/api/v1/public/media/images/${mediaFileId}`; }
}
