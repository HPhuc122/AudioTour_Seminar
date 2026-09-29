import { useEffect, useState } from "react"
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import type { PublicPoiSummary, PublicTourSummary } from "./api"
import { useTranslator } from "./i18n"
import { PoiImage } from "./PoiImages"

type Props = {
  languageCode: string | null
  languageLabel: string
  loading: boolean
  pois: PublicPoiSummary[]
  tours: PublicTourSummary[]
  remainingSeconds: number | null
  onLanguage: () => void
  onScan: () => void
  onPois: () => void
  onTours: () => void
  onPoi: (id: number) => void
  onTour: (id: number) => void
}

function TicketStatus({ seconds }: { seconds: number | null }) {
  const t = useTranslator()
  const [remaining, setRemaining] = useState(seconds)
  useEffect(() => setRemaining(seconds), [seconds])
  useEffect(() => {
    if (remaining === null || remaining <= 0) return
    const timer = setInterval(() => setRemaining(value => value === null ? null : Math.max(0, value - 1)), 1000)
    return () => clearInterval(timer)
  }, [remaining === null || remaining <= 0])
  if (remaining === null || remaining <= 0) return null
  const time = [Math.floor(remaining / 3600), Math.floor((remaining % 3600) / 60), remaining % 60]
    .map(value => String(value).padStart(2, "0")).join(":")
  return <View style={styles.ticket}><Text style={styles.ticketText}>{t("Vé audio còn hiệu lực")} · {time}</Text></View>
}

export function HomeScreen({ languageCode, languageLabel, loading, pois, tours, remainingSeconds, onLanguage, onScan, onPois, onTours, onPoi, onTour }: Props) {
  const t = useTranslator()
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <View style={styles.header}>
      <View style={styles.greeting}>
        <Text style={styles.eyebrow}>{t("Xin chào")}</Text>
        <Text accessibilityRole="header" style={styles.title}>{t("Khám phá Vĩnh Hy")}</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={t("Ngôn ngữ: {0}", languageLabel)} onPress={onLanguage} style={styles.language}>
        <Text style={styles.languageText}>{languageCode?.split("-")[0].toUpperCase() || "VI"}</Text><Text style={styles.languageArrow}>⌄</Text>
      </Pressable>
    </View>

    <View style={styles.hero}>
      <View style={styles.heroGlow} />
      <Text style={styles.heroEyebrow}>AUDIOTOUR</Text>
      <Text style={styles.heroTitle}>{t("Nghe câu chuyện\nở mỗi điểm đến")}</Text>
      <Text style={styles.heroDescription}>{t("Quét QR hoặc chọn địa điểm để nghe thuyết minh theo ngôn ngữ của bạn.")}</Text>
      <Pressable accessibilityRole="button" onPress={onScan} style={styles.heroAction}>
        <Ionicons name="headset-outline" size={18} color="#FFFFFF" /><Text style={styles.heroActionText}>{t("Bắt đầu nghe")}</Text>
      </Pressable>
    </View>

    <TicketStatus seconds={remainingSeconds} />
    <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>{t("Địa điểm nổi bật")}</Text><Pressable accessibilityRole="button" onPress={onPois}><Text style={styles.seeAll}>{t("Xem tất cả")}  ›</Text></Pressable></View>
    {loading && !pois.length ? <ActivityIndicator color="#058578" style={styles.loading} /> : pois.length ? (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.poiRow}>
        {pois.slice(0, 6).map(poi => <Pressable key={poi.id} accessibilityRole="button" onPress={() => onPoi(poi.id)} style={styles.poiCard}>
          <View style={styles.poiCover}><PoiImage id={poi.thumbnailImageId} label={poi.name} /></View>
          <View style={styles.poiInfo}><Text numberOfLines={1} style={styles.poiCategory}>{(poi.category || t("Địa điểm")).toUpperCase()}</Text><Text numberOfLines={1} style={styles.poiName}>{poi.name}</Text><Text numberOfLines={1} style={styles.poiCaption}>{poi.shortDescription || poi.code}</Text></View>
        </Pressable>)}
      </ScrollView>
    ) : <Text style={styles.empty}>{t("Chưa có nội dung công khai.")}</Text>}

    <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>{t("Tour đề xuất")}</Text><Pressable accessibilityRole="button" onPress={onTours}><Text style={styles.seeAll}>{t("Xem thêm")}  ›</Text></Pressable></View>
    {loading && !tours.length ? <ActivityIndicator color="#058578" style={styles.loading} /> : tours.length ? tours.slice(0, 2).map(tour => (
      <Pressable key={tour.id} accessibilityRole="button" onPress={() => onTour(tour.id)} style={styles.tourCard}>
        <View style={styles.tourArt}><Ionicons name="compass-outline" size={32} color="#FFFFFF" /><Text style={styles.tourArtText}>TOUR</Text></View>
        <View style={styles.tourInfo}><Text style={styles.tourBadge}>{t("KHÁM PHÁ")}</Text><Text numberOfLines={2} style={styles.tourName}>{tour.name}</Text><Text style={styles.tourMeta}>{tour.estimatedMinutes ? t("{0} phút", tour.estimatedMinutes) : tour.code}</Text><Text style={styles.tourAction}>{t("Xem hành trình")}  ›</Text></View>
      </Pressable>
    )) : <Text style={styles.empty}>{t("Chưa có nội dung công khai.")}</Text>}
  </ScrollView>
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F5FAFA" }, content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 28 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }, greeting: { flexShrink: 1 },
  eyebrow: { color: "#667A7D", fontSize: 13, fontWeight: "500" }, title: { color: "#0F2124", fontSize: 22, fontWeight: "800", marginTop: 2 },
  language: { minWidth: 54, minHeight: 44, borderRadius: 18, backgroundColor: "#FFFFFF", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginLeft: 8 },
  languageText: { color: "#058578", fontSize: 12, fontWeight: "800" }, languageArrow: { color: "#667A7D", fontSize: 17 },
  hero: { backgroundColor: "#047D78", borderRadius: 24, overflow: "hidden", padding: 20, minHeight: 208, marginBottom: 22, elevation: 4, shadowColor: "#034F5C", shadowOpacity: .16, shadowRadius: 15, shadowOffset: { width: 0, height: 8 } },
  heroGlow: { position: "absolute", width: 260, height: 260, borderRadius: 130, backgroundColor: "#034F5C", right: -96, top: -86, opacity: .75 },
  heroEyebrow: { color: "#C7F5EB", fontSize: 11, fontWeight: "800", letterSpacing: .5 }, heroTitle: { color: "#FFFFFF", fontSize: 28, fontWeight: "800", lineHeight: 33, marginTop: 9 },
  heroDescription: { color: "#E0F7F5", fontSize: 13, lineHeight: 19, marginTop: 9, maxWidth: 290 },
  heroAction: { backgroundColor: "#ffffff30", borderRadius: 16, alignSelf: "flex-start", minHeight: 36, justifyContent: "center", alignItems: "center", flexDirection: "row", gap: 7, paddingHorizontal: 13, marginTop: 12 }, heroActionText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  ticket: { backgroundColor: "#E0F7F0", padding: 12, borderRadius: 14, marginBottom: 16 }, ticketText: { color: "#056B61", fontSize: 12, fontWeight: "700" },
  sectionHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }, sectionTitle: { color: "#0F2124", fontSize: 18, fontWeight: "800" }, seeAll: { color: "#058578", fontSize: 12, fontWeight: "700" },
  poiRow: { gap: 12, paddingBottom: 20, paddingRight: 20 }, poiCard: { backgroundColor: "#FFFFFF", width: 169, borderRadius: 20, overflow: "hidden", elevation: 2, shadowColor: "#233", shadowOpacity: .06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  poiCover: { height: 86, backgroundColor: "#B9E7DF" }, poiInfo: { paddingHorizontal: 12, paddingVertical: 9, minHeight: 76 }, poiCategory: { color: "#058578", fontSize: 10, fontWeight: "800" }, poiName: { color: "#0F2124", fontSize: 14, fontWeight: "800", marginTop: 4 }, poiCaption: { color: "#667A7D", fontSize: 11, marginTop: 4 },
  tourCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 22, padding: 12, marginBottom: 12, gap: 13, elevation: 2, shadowColor: "#233", shadowOpacity: .06, shadowRadius: 12, shadowOffset: { width: 0, height: 5 } },
  tourArt: { width: 88, height: 88, backgroundColor: "#F89A48", borderRadius: 16, alignItems: "center", justifyContent: "center" }, tourArtIcon: { color: "#FFFFFF", fontSize: 32 }, tourArtText: { color: "#FFFFFF", fontSize: 10, fontWeight: "800", letterSpacing: 2 },
  tourInfo: { flex: 1, gap: 4 }, tourBadge: { color: "#DB631F", fontSize: 10, fontWeight: "800" }, tourName: { color: "#0F2124", fontSize: 15, fontWeight: "800" }, tourMeta: { color: "#667A7D", fontSize: 11 }, tourAction: { color: "#058578", fontSize: 11, fontWeight: "700", backgroundColor: "#E0F7F0", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, alignSelf: "flex-start" },
  empty: { color: "#667A7D", paddingVertical: 18 }, loading: { marginBottom: 18 },
})
