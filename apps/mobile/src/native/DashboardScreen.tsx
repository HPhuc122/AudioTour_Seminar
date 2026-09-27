import { useTranslator } from "./i18n"
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

type Props = { children?: ReactNode; isLoading: boolean; languageCode?: string; onMenu: () => void; paidAccessRemainingSeconds: number | null; poiTotal: number; tourTotal: number };

function formatRemaining(seconds: number | null): string {
  if (seconds === null) return "Chưa có vé";
  const safe = Math.max(0, seconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const rest = safe % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${rest.toString().padStart(2, "0")}`;
}

export function DashboardScreen({ children, isLoading, languageCode, onMenu, paidAccessRemainingSeconds, poiTotal, tourTotal }: Props) {
  const t = useTranslator()

  const [remaining, setRemaining] = useState(paidAccessRemainingSeconds);
  useEffect(() => setRemaining(paidAccessRemainingSeconds), [paidAccessRemainingSeconds]);
  useEffect(() => {
    if (remaining === null || remaining <= 0) return;
    const timer = setInterval(() => setRemaining((value) => value === null ? null : Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [remaining === null || remaining <= 0]);
  return (
    <View style={styles.screen}>
      <View style={styles.header}><Pressable onPress={onMenu} style={styles.menuButton}><Text style={styles.menuIcon}>☰</Text></Pressable><View><Text style={styles.title}>{t("Dashboard")}</Text><Text style={styles.language}>{t("Ngôn ngữ: ")}{languageCode ?? "..."}</Text></View></View>
      {isLoading ? <ActivityIndicator color="#15803D" style={styles.loading} /> : <View style={styles.stats}>
        <View style={styles.statCard}><Text style={styles.statValue}>{tourTotal}</Text><Text style={styles.statLabel}>{t("Tổng Tour")}</Text></View>
        <View style={styles.statCard}><Text style={styles.statValue}>{poiTotal}</Text><Text style={styles.statLabel}>{t("Tổng POI")}</Text></View>
        <View style={styles.statCard}><Text style={styles.timeValue}>{t(formatRemaining(remaining))}</Text><Text style={styles.statLabel}>{t("Audio trả phí")}</Text></View>
      </View>}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: "#F7FDF9", flex: 1, padding: 18 }, header: { alignItems: "center", flexDirection: "row", marginBottom: 18 },
  menuButton: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#C8EAD8", borderRadius: 12, borderWidth: 1, height: 44, justifyContent: "center", marginRight: 14, width: 44 }, menuIcon: { color: "#173B2A", fontSize: 22 },
  title: { color: "#173B2A", fontSize: 25, fontWeight: "800" }, language: { color: "#6B8777", fontSize: 12, marginTop: 2 }, loading: { marginVertical: 22 }, stats: { flexDirection: "row", gap: 8 },
  statCard: { backgroundColor: "#FFFFFF", borderColor: "#C8EAD8", borderRadius: 14, borderWidth: 1, flex: 1, minHeight: 94, paddingHorizontal: 8, paddingVertical: 14 }, statValue: { color: "#15803D", fontSize: 26, fontWeight: "800", textAlign: "center" }, timeValue: { color: "#15803D", fontSize: 15, fontWeight: "800", marginTop: 7, textAlign: "center" }, statLabel: { color: "#6B8777", fontSize: 11, marginTop: 7, textAlign: "center" },
  mapArea: { alignItems: "center", backgroundColor: "#EDF7F1", borderColor: "#B7DCC7", borderRadius: 20, borderStyle: "dashed", borderWidth: 1, flex: 1, justifyContent: "center", marginTop: 18, padding: 24 }, mapTitle: { color: "#456253", fontSize: 18, fontWeight: "700" }, mapDescription: { color: "#6B8777", lineHeight: 20, marginTop: 8, textAlign: "center" },
});
