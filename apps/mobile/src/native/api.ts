type ApiEnvelope<T,> = {
  success: boolean

  message: string

  data: T
}

export type GuestAccessResult = {
  requiresPayment: boolean

  status: string

  accessToken?: string

  expiresAt?: string

  accessDurationMinutes: number
}

export type ApiLanguage = {
  code: string

  name: string

  nativeName: string

  isActive: boolean

  sortOrder: number
}

export type ApiQrTarget = {
  targetType: "poi" | "tour"

  targetId: number

  requiresPayment: boolean
}

export type PublicPoiSummary = {
  thumbnailImageId?: number | null
  id: number
  code: string
  name: string
  shortDescription?: string
  description?: string
  latitude?: number
  longitude?: number
  radiusMeters?: number
  category?: string
}

export type PublicTourSummary = {
  id: number
  code: string
  name: string
  description?: string
  estimatedMinutes?: number
}

export type PublicPoiList = {
  items: PublicPoiSummary[]
  page: number
  pageSize: number
  total: number
}

export type PublicTargetDetail = {
  id: number

  code: string

  name: string

  shortDescription?: string

  description?: string

  latitude?: number

  longitude?: number

  radiusMeters?: number

  category?: string
  estimatedMinutes?: number
  pois?: Array<PublicPoiSummary & {
    audioTracks?: PublicTargetDetail["audioTracks"]
    narrationText?: string
    orderIndex?: number
  }>
  audioTracks?: Array<{
    id: number

    audioTrackId: number

    languageCode: string

    title: string

    audioType: string

    durationSeconds?: number

    mimeType?: string

    isAvailable: boolean
  }>

  images?: Array<{
    id: number

    imageCategory?: string
  }>
}

const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, "")

function getBaseUrl(): string {
  if (!baseUrl) {
    throw new Error(
      "Thiếu EXPO_PUBLIC_API_BASE_URL. Hãy cấu hình URL API trước khi quét QR.",
    )
  }

  return baseUrl
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getBaseUrl()}${path}`, init)

  const body = (await response.json()) as ApiEnvelope<T> & { detail?: string }

  if (!response.ok || !body.success) {
    throw new ApiError(
      typeof body.detail === "string"
        ? body.detail
        : body.message || "Không thể tải dữ liệu từ AudioTour.",
      response.status,
    )
  }

  return body.data
}

async function requestRoute(path: string, init?: RequestInit): Promise<MapRoute> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try { return await request<MapRoute>(path, { ...init, signal: controller.signal }); }
  catch (reason) {
    if (controller.signal.aborted) throw new Error("Tìm đường quá lâu. Kiểm tra kết nối và thử lại.");
    throw reason;
  } finally { clearTimeout(timeout); }
}

export const audioTourApi = {
  getDirections: (points: MapPoint[], mode: TravelMode) => requestRoute("/api/v1/public/routes/directions", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ points: points.map(({ latitude, longitude }) => ({ latitude, longitude })), mode }),
  }),
  getTourRoute: (id: number, mode: TravelMode) => requestRoute(`/api/v1/public/routes/tours/${id}?mode=${mode}`),
  getImageUrl: (id: number) =>
    `${getBaseUrl()}/api/v1/public/media/images/${id}`,
  startTargetAccess: (targetType: "poi" | "tour", targetId: number) =>
    request<GuestAccessResult>("/api/v1/public/access/start-target", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType, targetId }),
    }),
  getAudioTour: (id: number, languageCode: string, accessToken: string) =>
    request<PublicTargetDetail>(
      `/api/v1/public/audio-tour/tours/${id}?languageCode=${encodeURIComponent(languageCode)}`,
      { headers: { "X-Guest-Access-Token": accessToken } },
    ),
  getLanguages: () =>
    request<ApiLanguage[]>("/api/v1/languages?activeOnly=true"),

  resolveQr: (code: string) =>
    request<ApiQrTarget>(`/api/v1/qr/resolve/${encodeURIComponent(code)}`),

  getPoi: (id: number, languageCode: string) =>
    request<PublicTargetDetail>(
      `/api/v1/public/pois/${id}?lang=${encodeURIComponent(languageCode)}`,
    ),

  getTour: (id: number, languageCode: string) =>
    request<PublicTargetDetail>(
      `/api/v1/public/tours/${id}?lang=${encodeURIComponent(languageCode)}`,
    ),
  listPois: (languageCode: string) =>
    request<PublicPoiList>(
      `/api/v1/public/pois?page=1&pageSize=100&lang=${encodeURIComponent(languageCode)}`,
    ),
  listTours: (languageCode: string) =>
    request<PublicTourSummary[]>(
      `/api/v1/public/tours?lang=${encodeURIComponent(languageCode)}`,
    ),
  startGuestAccess: (qrCode: string) =>
    request<GuestAccessResult>("/api/v1/public/access/start", {
      body: JSON.stringify({ qrCode }),

      headers: { "Content-Type": "application/json" },

      method: "POST",
    }),

  getAudioPoi: (
    id: number,
    languageCode: string,
    accessToken: string,
    triggerType: "qr" | "manual" = "qr",
  ) =>
    request<PublicTargetDetail>(
      `/api/v1/public/audio-tour/pois/${id}?languageCode=${encodeURIComponent(languageCode)}&triggerType=${triggerType}`,
      { headers: { "X-Guest-Access-Token": accessToken } },
    ),

  getAudioSource: (
    audioTrackId: number,
    accessToken: string,
    title: string,
  ) => ({
    headers: { "X-Guest-Access-Token": accessToken },

    name: title,

    uri: `${getBaseUrl()}/api/v1/public/audio/${audioTrackId}`,
  }),
  validateGuestAccess: (accessToken: string) =>
    request<{
      isValid: boolean
      status: string
      expiresAt?: string
      remainingSeconds: number
    }>("/api/v1/public/access/validate", {
      headers: { "X-Guest-Access-Token": accessToken },
    }),
}

export type MapPoint = { latitude: number; longitude: number };
export type TravelMode = "walking" | "driving";
export type MapRoute = {
  mode: TravelMode;
  routeDistanceMeters: number;
  durationSeconds: number;
  latLngs: MapPoint[];
  attribution: string;
};
