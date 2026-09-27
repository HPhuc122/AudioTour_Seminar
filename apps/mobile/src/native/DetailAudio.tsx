import { useEffect, useRef, useState } from "react"
import { ActivityIndicator, Button, StyleSheet, Text, View } from "react-native"
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio"
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
  useEffect(() => {
    if (status.isLoaded && !status.error && !started.current) {
      started.current = true
      player.play()
    }
  }, [player, status.isLoaded, status.error])
  return (
    <View style={styles.player}>
      <Text style={styles.track}>{track.title}</Text>
      <Text style={styles.text}>
        {time(status.currentTime)} /{" "}
        {time(status.duration || track.durationSeconds || 0)}
      </Text>
      {(!status.isLoaded || status.isBuffering) && !status.error && (
        <ActivityIndicator color="#15803D" />
      )}
      {status.error ? (
        <>
          <Text accessibilityRole="alert" style={styles.error}>
            Không thể phát audio. Vui lòng thử lại.
          </Text>
          <Button title="Thử lại" onPress={onRetry} />
        </>
      ) : (
        <Button
          disabled={!status.isLoaded}
          title={
            status.playing
              ? "Tạm dừng"
              : status.didJustFinish
                ? "Nghe lại"
                : "Phát audio"
          }
          onPress={() => {
            void (async () => {
              if (status.playing) player.pause()
              else {
                if (status.didJustFinish) await player.seekTo(0)
                player.play()
              }
            })()
          }}
        />
      )}
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
    return () => {
      mounted.current = false
    }
  }, [])

  async function start(automatic = false) {
    if (busy.current) return
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
          if (mounted.current) {
            setLocked(true)
            if (!automatic) onScan()
          }
          return
        }
        const access = qrCode
          ? await audioTourApi.startGuestAccess(qrCode)
          : await audioTourApi.startTargetAccess(kind, detail.id)
        if (access.requiresPayment) {
          if (mounted.current) {
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
      if (mounted.current) {
        setLocked(false)
        setTrackIndex(0)
        setSession({ accessToken: token, tracks })
      }
    } catch (reason) {
      if (mounted.current)
        setError(
          reason instanceof Error ? reason.message : "Không thể mở audio.",
        )
    } finally {
      busy.current = false
      if (mounted.current) setLoading(false)
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
