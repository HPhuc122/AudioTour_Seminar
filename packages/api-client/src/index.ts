export type ApiResponse<T> = { success: boolean; message: string; data: T };

export type Tour = { id: number; code: string; name: string; description?: string; estimatedMinutes?: number };
export type Poi = { id: number; code: string; name: string; latitude: number; longitude: number; category?: string };
export type LoginResult = { accessToken: string; expiresAtUtc: string; userId: number; username: string; role: string };

export class AudioTourApiClient {
  constructor(private readonly baseUrl: string) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, { headers: { "Content-Type": "application/json", ...init?.headers }, ...init });
    const body = (await response.json()) as ApiResponse<T>;
    if (!response.ok || !body.success) throw new Error(body.message || "API request failed");
    return body.data;
  }

  login(username: string, password: string) {
    return this.request<LoginResult>("/api/v1/auth/login", { method: "POST", body: JSON.stringify({ username, password }) });
  }

  registerDevice(deviceId: string, platform: string, appVersion?: string, osVersion?: string) {
    return this.request<void>("/api/v1/auth/register-device", { method: "POST", body: JSON.stringify({ deviceId, platform, appVersion, osVersion }) });
  }

  getTours(lang = "vi") { return this.request<Tour[]>(`/api/v1/public/tours?lang=${encodeURIComponent(lang)}`); }
  getTour(id: number, lang = "vi") { return this.request<Tour>(`/api/v1/public/tours/${id}?lang=${encodeURIComponent(lang)}`); }
  getPois(lang = "vi") { return this.request<Poi[]>(`/api/v1/public/pois?lang=${encodeURIComponent(lang)}`); }
}
