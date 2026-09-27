type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T;
};

export type ApiLanguage = {
  code: string;
  name: string;
  nativeName: string;
  isActive: boolean;
  sortOrder: number;
};

export type ApiQrTarget = {
  targetType: "poi" | "tour";
  targetId: number;
  requiresPayment: boolean;
};

export type PublicTargetDetail = {
  id: number;
  code: string;
  name: string;
  shortDescription?: string;
  description?: string;
  latitude?: number;
  longitude?: number;
  radiusMeters?: number;
  category?: string;
  audioTracks?: Array<{
    id: number;
    audioTrackId: number;
    languageCode: string;
    title: string;
    audioType: string;
    durationSeconds?: number;
    mimeType?: string;
    isAvailable: boolean;
  }>;
  images?: Array<{
    id: number;
    imageCategory?: string;
  }>;
};

const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, "");

function getBaseUrl(): string {
  if (!baseUrl) {
    throw new Error("Thiếu EXPO_PUBLIC_API_BASE_URL. Hãy cấu hình URL API trước khi quét QR.");
  }

  return baseUrl;
}

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${getBaseUrl()}${path}`);
  const body = (await response.json()) as ApiEnvelope<T>;

  if (!response.ok || !body.success) {
    throw new Error(body.message || "Không thể tải dữ liệu từ AudioTour.");
  }

  return body.data;
}

export const audioTourApi = {
  getLanguages: () => request<ApiLanguage[]>("/api/v1/languages?activeOnly=true"),
  resolveQr: (code: string) => request<ApiQrTarget>(`/api/v1/qr/resolve/${encodeURIComponent(code)}`),
  getPoi: (id: number, languageCode: string) => request<PublicTargetDetail>(`/api/v1/public/pois/${id}?lang=${encodeURIComponent(languageCode)}`),
  getTour: (id: number, languageCode: string) => request<PublicTargetDetail>(`/api/v1/public/tours/${id}?lang=${encodeURIComponent(languageCode)}`),
};
