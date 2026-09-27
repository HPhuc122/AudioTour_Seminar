import { useEffect, useRef, useState } from "react"
import { ActivityIndicator, AppState, Button, StyleSheet, Text, View } from "react-native"
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio"
import Slider from "@react-native-community/slider"
import { ApiError, audioTourApi, type PublicTargetDetail } from "./api"
import { loadPaidAccessSession } from "./paidAccessStore"

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
  onRetry,
}: {
  token: string
  track: Track
  onRetry: () => void
}) {
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
  const duration = Math.max(0, status.duration || track.durationSeconds || 0)
  const position = Math.min(duration, Math.max(0, preview ?? status.currentTime))
  const finished = status.didJustFinish || (duration > 0 && status.currentTime >= duration)
  const disabled = !status.isLoaded || Boolean(status.error) || seeking
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])
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
      if (mounted.current) setControlError("Không thể tua audio. Vui lòng thử lại.")
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
      if (mounted.current) setControlError("Không thể điều khiển audio. Vui lòng thử lại.")
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
          <Text accessibilityRole="alert" style={styles.error}>Không thể phát audio. Vui lòng thử lại.</Text>
          <Button title="Thử lại" onPress={onRetry} />
        </>
      ) : (
        <>
          <View style={styles.controls}>
            <Button title="−5 giây" accessibilityLabel="Lùi 5 giây" disabled={disabled || duration <= 0 || position <= 0} onPress={() => void seek(status.currentTime - 5)} />
            <Button title="+5 giây" accessibilityLabel="Tiến 5 giây" disabled={disabled || duration <= 0 || position >= duration} onPress={() => void seek(status.currentTime + 5)} />
          </View>
          <Button disabled={disabled} title={status.playing ? "Tạm dừng" : finished ? "Nghe lại" : "Phát audio"} onPress={() => void toggle()} />
          {finished && !status.playing && <Text style={styles.text}>Đã hết bài. Chọn bài khác hoặc bấm Nghe lại.</Text>}
        </>
      )}
      {controlError && <Text accessibilityRole="alert" style={styles.error}>{controlError}</Text>}
    </View>
  )
}

export function DetailAudio({
  detail,
  kind,
  languageCode,
  qrCode,
  autoStart = false,
  requiresPayment = false,
  onScan,
}: {
  detail: PublicTargetDetail
  kind: "poi" | "tour"
  languageCode: string
  qrCode?: string
  autoStart?: boolean
  requiresPayment?: boolean
  onScan: () => void
}) {
  const [session, setSession] = useState<Session | null>(null)
  const [trackIndex, setTrackIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [locked, setLocked] = useState(requiresPayment)
  const startRequest = useRef(0)
  const busy = useRef(false)
  const mounted = useRef(true)
  const autoRequested = useRef(false)
  const publicTracks =
    kind === "poi"
      ? detail.audioTracks
      : detail.pois?.flatMap((poi) => poi.audioTracks ?? [])
  const hasTracks = publicTracks?.some((track) => track.isAvailable)

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

  async function start(automatic = false) {
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
            if (!automatic) onScan()
          }
          return
        }
        const access = qrCode
          ? await audioTourApi.startGuestAccess(qrCode)
          : await audioTourApi.startTargetAccess(kind, detail.id)
        if (access.requiresPayment) {
          if (isCurrent()) {
            setLocked(true)
            onScan()
          }
          return
        }
        token = access.accessToken
        if (!token)
          throw new Error("Không thể tạo phiên nghe. Vui lòng thử lại.")
        protectedDetail = await getAudio(token)
      }
      const tracks =
        (kind === "poi"
          ? protectedDetail?.audioTracks
          : protectedDetail?.pois?.flatMap((poi) => poi.audioTracks ?? [])
        )?.filter((track) => track.isAvailable) ?? []
      if (!tracks.length)
        throw new Error("Chưa có audio khả dụng cho ngôn ngữ này.")
      if (isCurrent()) {
        setLocked(false)
        setTrackIndex(0)
        setSession({ accessToken: token, tracks })
      }
    } catch (reason) {
      if (isCurrent())
        setError(
          reason instanceof Error ? reason.message : "Không thể mở audio.",
        )
    } finally {
      if (request === startRequest.current) {
        busy.current = false
        if (mounted.current) setLoading(false)
      }
    }
  }

  useEffect(() => {
    if (autoStart && hasTracks && !autoRequested.current) {
      autoRequested.current = true
      void start(true)
    }
  }, [autoStart, hasTracks])

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Thuyết minh audio · {languageCode}</Text>
      {!hasTracks ? (
        <Text style={styles.text}>
          Chưa có audio khả dụng cho ngôn ngữ này.
        </Text>
      ) : (
        <>
          {session ? (
            <>
              <Player
                key={`${session.accessToken}:${trackIndex}`}
                token={session.accessToken}
                track={session.tracks[trackIndex]}
                onRetry={() => void start()}
              />
              {kind === "tour" && (
                <View style={styles.playlist}>
                  <Text style={styles.text}>Bài {trackIndex + 1} / {session.tracks.length}</Text>
                  <View style={styles.controls}>
                    <Button title="Bài trước" disabled={trackIndex === 0} onPress={() => setTrackIndex((index) => Math.max(0, index - 1))} />
                    <Button title="Bài sau" disabled={trackIndex === session.tracks.length - 1} onPress={() => setTrackIndex((index) => Math.min(session.tracks.length - 1, index + 1))} />
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
                  ? "Audio trả phí cần quyền nghe hợp lệ. Quét QR tại điểm tham quan để mở quyền nghe."
                  : "Bấm phát để nghe thuyết minh."}
              </Text>
              <Button
                disabled={loading}
                title={
                  loading
                    ? "Đang chuẩn bị audio…"
                    : error
                      ? "Thử lại"
                      : "Phát audio"
                }
                onPress={() => void start()}
              />
              {locked && <Button title="Quét QR" onPress={onScan} />}
            </>
          )}
          {loading && <ActivityIndicator color="#15803D" />}
          {error && (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          )}
        </>
      )}
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
  title: { color: "#173B2A", fontSize: 17, fontWeight: "700" },
  text: { color: "#456253", lineHeight: 22, marginVertical: 12 },
  error: { color: "#B42318", marginTop: 12 },
  player: { marginTop: 12 },
  track: { color: "#173B2A", fontWeight: "600" },
  playlist: { marginTop: 12, gap: 6 },
})
