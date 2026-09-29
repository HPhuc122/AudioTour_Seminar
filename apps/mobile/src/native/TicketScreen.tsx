import { useEffect, useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { useTranslator } from "./i18n"

export function TicketScreen({ remainingSeconds, onScan, onExplore }: { remainingSeconds: number | null; onScan: () => void; onExplore: () => void }) {
  const t = useTranslator()
  const [remaining, setRemaining] = useState(remainingSeconds)
  useEffect(() => setRemaining(remainingSeconds), [remainingSeconds])
  useEffect(() => {
    if (remaining === null || remaining <= 0) return
    const timer = setInterval(() => setRemaining(value => value === null ? null : Math.max(0, value - 1)), 1000)
    return () => clearInterval(timer)
  }, [remaining === null || remaining <= 0])
  const valid = remaining !== null && remaining > 0
  const time = valid ? [Math.floor(remaining / 3600), Math.floor((remaining % 3600) / 60), remaining % 60].map(value => String(value).padStart(2, "0")).join(":") : null
  return <View style={styles.screen}>
    <Text accessibilityRole="header" style={styles.title}>{t("Vé audio của bạn")}</Text>
    <Text style={styles.subtitle}>{t("Thời gian truy cập thuyết minh")}</Text>
    <View style={styles.card}><Text style={styles.brand}>AUDIOTOUR</Text><Text style={styles.cardTitle}>{valid ? t("Vé đang hoạt động") : t("Chưa có vé đang hoạt động")}</Text>
      <Text style={styles.time}>{time ?? "--:--:--"}</Text><Text style={styles.note}>{valid ? t("Thời gian còn lại") : t("Quét QR tại địa điểm để bắt đầu nghe thuyết minh.")}</Text>
    </View>
    <Pressable accessibilityRole="button" onPress={onScan} style={styles.primary}><Text style={styles.primaryText}>{t("Quét QR")}</Text></Pressable>
    <Pressable accessibilityRole="button" onPress={onExplore} style={styles.secondary}><Text style={styles.secondaryText}>{t("Khám phá địa điểm")}  ›</Text></Pressable>
  </View>
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F5FAFA", padding: 20 }, title: { color: "#0F2124", fontSize: 26, fontWeight: "800", marginTop: 12 }, subtitle: { color: "#667A7D", fontSize: 14, marginTop: 5, marginBottom: 24 },
  card: { backgroundColor: "#046F70", borderRadius: 24, padding: 24, minHeight: 210, justifyContent: "space-between" }, brand: { color: "#C7F5EB", fontSize: 12, fontWeight: "800", letterSpacing: 2 }, cardTitle: { color: "#FFFFFF", fontSize: 20, fontWeight: "800", marginTop: 15 }, time: { color: "#FFFFFF", fontSize: 34, fontWeight: "800", marginTop: 16 }, note: { color: "#D5F4EE", fontSize: 13, marginTop: 5 },
  primary: { backgroundColor: "#058578", minHeight: 52, borderRadius: 16, alignItems: "center", justifyContent: "center", marginTop: 24 }, primaryText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  secondary: { minHeight: 52, alignItems: "center", justifyContent: "center", marginTop: 8 }, secondaryText: { color: "#058578", fontSize: 14, fontWeight: "700" },
})
