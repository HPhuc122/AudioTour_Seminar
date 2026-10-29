import { useTranslator } from "./i18n"
import { useEffect, useRef, useState } from "react"
import { ActivityIndicator, Alert, AppState, Button, StyleSheet, Text, View } from "react-native"
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio"
import Slider from "@react-native-community/slider"
import { ApiError, audioTourApi, type AccessPackage, type PublicTargetDetail } from "./api"
import { loadPaidAccessSession, savePaidAccessSession } from "./paidAccessStore"

type Track = NonNullable<PublicTargetDetail["audioTracks"]>[number]
type Session = {
  accessToken: string
  tracks: Track[]
}
const time = (seconds: number) =>
  `${Math.floor(Math.max(0, seconds) / 60)}:${String(Math.floor(Math.max(0, seconds)) % 60).padStart(2, "0")}`

function Player({
  token,
  track,
  languageCode,
  triggerType,
  onRetry,
}: {
  token: string
  track: Track
  languageCode: string
  triggerType: "qr" | "gps" | "manual"
  onRetry: () => void
}) {
  const t = useTranslator()

  const player = useAudioPlayer(
    audioTourApi.getAudioSource(track.audioTrackId, token, track.title),
    { updateInterval: 250 },
  )
  const status = useAudioPlayerStatus(player)
  const started = useRef(false)
  const mounted = useRef(true)
  const seekingRef = useRef(false)
  const [seeking, setSeeking] = useState(false)
  const [preview, setPreview] = useState<number | null>(null)
  const [controlError, setControlError] = useState<string | null>(null)
  const listenedMs = useRef(0)
  const lastTickMs = useRef<number | null>(null)
  const wasPlaying = useRef(false)
  const duration = Math.max(0, status.duration || track.durationSeconds || 0)
  const position = Math.min(duration, Math.max(0, preview ?? status.currentTime))
  const finished = status.didJustFinish || (duration > 0 && status.currentTime >= duration)
  const disabled = !status.isLoaded || Boolean(status.error) || seeking
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      if (wasPlaying.current && lastTickMs.current !== null && AppState.currentState === "active")
        listenedMs.current += Math.min(1000, Math.max(0, Date.now() - lastTickMs.current))
      const listenedSeconds = Math.floor(listenedMs.current / 1000)
      if (listenedSeconds > 0)
        void audioTourApi.recordPlay(track.audioTrackId, languageCode, triggerType, listenedSeconds, token).catch(() => {})
    }
  }, [])
  useEffect(() => {
    const now = Date.now()
    if (wasPlaying.current && lastTickMs.current !== null)
      listenedMs.current += Math.min(2000, Math.max(0, now - lastTickMs.current))
    lastTickMs.current = now
    wasPlaying.current = status.playing && status.isLoaded && !status.isBuffering && !status.error && !seekingRef.current && AppState.currentState === "active"
  }, [status.currentTime, status.playing, status.isLoaded, status.isBuffering, status.error])
  useEffect(() => {
    if (status.isLoaded && !status.error && !started.current && AppState.currentState === "active") {
      started.current = true
      player.play()
    }
  }, [player, status.isLoaded, status.error])
  async function seek(value: number) {
    if (disabled || seekingRef.current || duration <= 0) return
    seekingRef.current = true
    setSeeking(true)
    setControlError(null)
    try {
      await player.seekTo(Math.max(0, Math.min(duration, value)))
    } catch {
      if (mounted.current) setControlError(t("Không thể tua audio. Vui lòng thử lại."))
    } finally {
      seekingRef.current = false
      if (mounted.current) { setSeeking(false); setPreview(null) }
    }
  }
  async function toggle() {
    if (disabled || seekingRef.current) return
    setControlError(null)
    try {
      if (status.playing) player.pause()
      else {
        if (finished) await player.seekTo(0)
        if (mounted.current && AppState.currentState === "active") player.play()
      }
    } catch {
      if (mounted.current) setControlError(t("Không thể điều khiển audio. Vui lòng thử lại."))
    }
  }
  return (
    <View style={styles.player}>
      <Text style={styles.track}>{track.title}</Text>
      <Text style={styles.text}>{time(position)} / {time(duration)}</Text>
      <Slider
        accessibilityLabel="Tua audio"
        minimumValue={0}
        maximumValue={duration || 1}
        value={position}
        disabled={disabled || duration <= 0}
        minimumTrackTintColor="#15803D"
        maximumTrackTintColor="#C8EAD8"
        thumbTintColor="#15803D"
        onSlidingStart={setPreview}
        onValueChange={setPreview}
        onSlidingComplete={(value) => void seek(value)}
        style={styles.slider}
      />
      {(!status.isLoaded || status.isBuffering || seeking) && !status.error && <ActivityIndicator color="#15803D" />}
      {status.error ? (
        <>
          <Text accessibilityRole="alert" style={styles.error}>{t("Không thể phát audio. Vui lòng thử lại.")}</Text>
          <Button title={t("Thử lại")} onPress={onRetry} />
        </>
      ) : (
        <>
          <View style={styles.controls}>
            <Button title={t("−5 giây")} accessibilityLabel={t("Lùi 5 giây")} disabled={disabled || duration <= 0 || position <= 0} onPress={() => void seek(status.currentTime - 5)} />
            <Button title={t("+5 giây")} accessibilityLabel={t("Tiến 5 giây")} disabled={disabled || duration <= 0 || position >= duration} onPress={() => void seek(status.currentTime + 5)} />
          </View>
          <Button disabled={disabled} title={status.playing ? t("Tạm dừng") : finished ? t("Nghe lại") : t("Phát audio")} onPress={() => void toggle()} />
          {finished && !status.playing && <Text style={styles.text}>{t("Đã hết bài. Chọn bài khác hoặc bấm Nghe lại.")}</Text>}
        </>
      )}
      {controlError && <Text accessibilityRole="alert" style={styles.error}>{t(controlError)}</Text>}
    </View>
  )
}

export function DetailAudio({
  detail,
  kind,
  languageCode,
  qrCode,
  autoStart = false,
  triggerType = "manual",
  requiresPayment = false,
  onScan,
  onPackagePurchased,
}: {
  detail: PublicTargetDetail
  kind: "poi" | "tour"
  languageCode: string
  qrCode?: string
  autoStart?: boolean
  triggerType?: "qr" | "gps" | "manual"
  requiresPayment?: boolean
  onScan: () => void
  onPackagePurchased: (expiresAt: string) => void
}) {
  const t = useTranslator()

  const [session, setSession] = useState<Session | null>(null)
  const [trackIndex, setTrackIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [purchaseNotice, setPurchaseNotice] = useState<string | null>(null)
  const [locked, setLocked] = useState(requiresPayment)
  const [accessPackage, setAccessPackage] = useState<AccessPackage | null>(null)
  const [hasActivePackage, setHasActivePackage] = useState(false)
  const [purchaseLoading, setPurchaseLoading] = useState(false)
  const startRequest = useRef(0)
  const busy = useRef(false)
  const buying = useRef(false)
  const mounted = useRef(true)
  const autoRequested = useRef(false)
  const publicTracks =
    kind === "poi"
      ? detail.audioTracks
      : detail.pois?.flatMap((poi) => poi.audioTracks ?? [])
  const hasTracks = publicTracks?.some((track) => track.isAvailable)

  useEffect(() => {
    let current = true
    void (async () => {
      try {
        const packages = await audioTourApi.listAccessPackages()
        const globalPackage = packages.find(
          (item) => item.requiresPayment && item.poiId === null && item.tourId === null,
        )
        if (current) {
          setAccessPackage(globalPackage ?? null)
          setLocked(requiresPayment || Boolean(globalPackage))
        }
        const saved = await loadPaidAccessSession()
        if (saved) {
          const validation = await audioTourApi.validateGuestAccess(saved.accessToken)
          if (current && validation.isValid) {
            setHasActivePackage(true)
            setLocked(false)
          }
        }
      } catch (reason) {
        if (current)
          setError(reason instanceof Error ? reason.message : t("Không thể tải gói truy cập."))
      }
    })()
    return () => { current = false }
  }, [requiresPayment, t])

  useEffect(() => {
    mounted.current = true
    const listener = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        startRequest.current++
        autoRequested.current = true
        busy.current = false
        setLoading(false)
        setSession(null)
      }
    })
    return () => {
      mounted.current = false
      startRequest.current++
      listener.remove()
    }
  }, [])

  async function start() {
    if (busy.current || AppState.currentState !== "active") return
    const request = ++startRequest.current
    const isCurrent = () => mounted.current && request === startRequest.current && AppState.currentState === "active"
    busy.current = true
    setLoading(true)
    setError(null)
    setSession(null)
    const getAudio = (token: string) =>
      kind === "poi"
        ? audioTourApi.getAudioPoi(
            detail.id,
            languageCode,
            token,
            qrCode ? "qr" : "manual",
          )
        : audioTourApi.getAudioTour(detail.id, languageCode, token)
    try {
      let token: string | undefined
      let protectedDetail: PublicTargetDetail | undefined
      const saved = await loadPaidAccessSession()
      if (saved) {
        try {
          protectedDetail = await getAudio(saved.accessToken)
          token = saved.accessToken
        } catch (reason) {
          if (
            !(reason instanceof ApiError) ||
            ![401, 403].includes(reason.status)
          )
            throw reason
        }
      }
      if (!token) {
        // A paid QR must not create a payment session merely by opening its detail.
        if (qrCode && requiresPayment) {
          if (isCurrent()) {
            setLocked(true)
          }
          return
        }
        const access = qrCode
          ? await audioTourApi.startGuestAccess(qrCode)
          : await audioTourApi.startTargetAccess(kind, detail.id)
        if (access.requiresPayment) {
          if (isCurrent()) {
            setLocked(true)
          }
          return
        }
        token = access.accessToken
        if (!token)
          throw new Error(t("Không thể tạo phiên nghe. Vui lòng thử lại."))
        protectedDetail = await getAudio(token)
      }
      const tracks =
        (kind === "poi"
          ? protectedDetail?.audioTracks
          : protectedDetail?.pois?.flatMap((poi) => poi.audioTracks ?? [])
        )?.filter((track) => track.isAvailable) ?? []
      if (!tracks.length)
        throw new Error(t("Chưa có audio khả dụng cho ngôn ngữ này."))
      if (isCurrent()) {
        setLocked(false)
        setTrackIndex(0)
        setSession({ accessToken: token, tracks })
      }
    } catch (reason) {
      if (isCurrent())
        setError(
          reason instanceof Error ? reason.message : t("Không thể mở audio."),
        )
    } finally {
      if (request === startRequest.current) {
        busy.current = false
        if (mounted.current) setLoading(false)
      }
    }
  }

  async function completePackagePurchase() {
    if (!accessPackage || buying.current) return
    buying.current = true
    setPurchaseLoading(true)
    setError(null)
    try {
      const started = await audioTourApi.startGuestAccess(accessPackage.code)
      if (!started.requiresPayment || !started.paymentSessionId)
        throw new Error(t("Gói không tạo được phiên thanh toán mô phỏng."))
      const payment = await audioTourApi.simulatePayment(started.paymentSessionId)
      if (!payment.accessToken || !payment.expiresAt)
        throw new Error(t("Thanh toán mô phỏng chưa hoàn tất."))
      await savePaidAccessSession({ accessToken: payment.accessToken, expiresAt: payment.expiresAt })
      onPackagePurchased(payment.expiresAt)
      setHasActivePackage(true)
      setLocked(false)
      setPurchaseNotice(
        hasTracks
          ? t("Gói đã mở khóa. Nhấn Phát audio khi bạn sẵn sàng.")
          : t("Đã mua gói mô phỏng. Audio chưa có sẵn trong dữ liệu demo."),
      )
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("Không thể mua gói mô phỏng."))
    } finally {
      buying.current = false
      setPurchaseLoading(false)
    }
  }

  function confirmPackagePurchase() {
    if (!accessPackage || purchaseLoading) return
    const price = new Intl.NumberFormat("vi-VN").format(accessPackage.priceAmount)
    Alert.alert(
      t("Mua gói toàn bộ POI"),
      `${accessPackage.name}\n${price} VND · ${t("{0} phút", accessPackage.accessDurationMinutes)}\n${t("Đây là thanh toán mô phỏng; không thu tiền thật.")}`,
      [
        { text: t("Hủy"), style: "cancel" },
        { text: t("Xác nhận mua mô phỏng"), onPress: () => void completePackagePurchase() },
      ],
    )
  }

  useEffect(() => {
    if (autoStart && hasTracks && !autoRequested.current) {
      autoRequested.current = true
      void start()
    }
  }, [autoStart, hasTracks])

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t("Thuyết minh audio · ")}{languageCode}</Text>
      {!hasTracks ? (
        <Text style={styles.text}>
          {t("Chưa có audio khả dụng cho ngôn ngữ này.")}</Text>
      ) : (
        <>
          {session ? (
            <>
              <Player
                key={`${session.accessToken}:${trackIndex}`}
                token={session.accessToken}
                track={session.tracks[trackIndex]}
                languageCode={languageCode}
                triggerType={triggerType}
                onRetry={() => void start()}
              />
              {kind === "tour" && (
                <View style={styles.playlist}>
                  <Text style={styles.text}>{t("Bài ")}{trackIndex + 1} / {session.tracks.length}</Text>
                  <View style={styles.controls}>
                    <Button title={t("Bài trước")} disabled={trackIndex === 0} onPress={() => setTrackIndex((index) => Math.max(0, index - 1))} />
                    <Button title={t("Bài sau")} disabled={trackIndex === session.tracks.length - 1} onPress={() => setTrackIndex((index) => Math.min(session.tracks.length - 1, index + 1))} />
                  </View>
                </View>
              )}
              {session.tracks.length > 1 && (
                <View style={styles.playlist}>
                  {session.tracks.map((track, index) => (
                    <Button
                      key={`${track.audioTrackId}:${index}`}
                      title={`${
                        index === trackIndex ? "▶ " : ""
                      }${index + 1}. ${track.title}`}
                      onPress={() => setTrackIndex(index)}
                    />
                  ))}
                </View>
              )}
            </>
          ) : (
            <>
              <Text style={styles.text}>
                {locked
                  ? t("Audio cần gói truy cập. Mua gói để mở khóa toàn bộ POI trong 60 phút.")
                  : t("Bấm phát để nghe thuyết minh.")}
              </Text>
              <Button
                disabled={loading}
                title={
                  loading
                    ? t("Đang chuẩn bị audio…")
                    : error
                      ? t("Thử lại")
                      : t("Phát audio")
                }
                onPress={() => void start()}
              />
              {locked && <Button title={t("Quét QR khác")} onPress={onScan} />}
            </>
          )}
          {loading && <ActivityIndicator color="#15803D" />}
        </>
      )}
      {accessPackage && !hasActivePackage && (
        <View style={styles.packageBox}>
          <Text style={styles.text}>{t("Một gói mở khóa audio của toàn bộ POI và Tour trong thời hạn gói.")}</Text>
          <Button
            disabled={purchaseLoading || loading}
            title={purchaseLoading ? t("Đang xử lý thanh toán mô phỏng…") : `${t("Mua gói toàn bộ POI")} · ${new Intl.NumberFormat("vi-VN").format(accessPackage.priceAmount)} VND / ${t("{0} phút", accessPackage.accessDurationMinutes)}`}
            onPress={confirmPackagePurchase}
          />
        </View>
      )}
      {hasActivePackage && <Text style={styles.text}>{t("Gói truy cập toàn bộ POI đang hoạt động.")}</Text>}
      {purchaseNotice && <Text style={styles.text}>{purchaseNotice}</Text>}
      {purchaseLoading && <ActivityIndicator color="#15803D" />}
      {error && <Text accessibilityRole="alert" style={styles.error}>{t(error)}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  slider: { width: "100%", height: 44 },
  controls: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 8, marginBottom: 10 },
  card: {
    backgroundColor: "white",
    borderColor: "#C8EAD8",
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
    marginTop: 20,
  },
  packageBox: { gap: 8, marginTop: 12 },
  title: { color: "#173B2A", fontSize: 17, fontWeight: "700" },
  text: { color: "#456253", lineHeight: 22, marginVertical: 12 },
  error: { color: "#B42318", marginTop: 12 },
  player: { marginTop: 12 },
  track: { color: "#173B2A", fontWeight: "600" },
  playlist: { marginTop: 12, gap: 6 },
})
