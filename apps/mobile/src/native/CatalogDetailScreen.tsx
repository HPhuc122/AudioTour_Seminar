import { useTranslator } from "./i18n"
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import type { PublicTargetDetail } from "./api"
import { DetailAudio } from "./DetailAudio"
import { PoiImages } from "./PoiImages"

type Props = {
  detail: PublicTargetDetail
  kind: "poi" | "tour"
  languageCode: string
  qrCode?: string
  autoStart?: boolean
  requiresPayment?: boolean
  onScan: () => void
  onBack: () => void
  onMap: () => void
}
export function CatalogDetailScreen({
  detail,
  kind,
  languageCode,
  qrCode,
  autoStart,
  requiresPayment,
  onScan,
  onBack,
  onMap,
}: Props) {
  const t = useTranslator()

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
      <Pressable accessibilityRole="button" onPress={onBack} style={styles.back}><Ionicons name="arrow-back" size={20} color="#058578" /><Text style={styles.backText}>{t("Quay lại")}</Text></Pressable>
      {kind === "poi" && (
        <PoiImages images={detail.images} name={detail.name} />
      )}
      <Text style={styles.kind}>{t(kind === "poi" ? "POI" : "TOUR")}</Text>
      <Text accessibilityRole="header" style={styles.title}>
        {detail.name}
      </Text>
      <Text style={styles.code}>{detail.code}</Text>
      <Pressable accessibilityRole="button" onPress={onMap} style={styles.mapButton}><Ionicons name="map-outline" size={19} color="#FFFFFF" /><Text style={styles.mapButtonText}>{t("Xem bản đồ")}</Text></Pressable>
      <DetailAudio
        detail={detail}
        kind={kind}
        languageCode={languageCode}
        qrCode={qrCode}
        autoStart={autoStart}
        requiresPayment={requiresPayment}
        onScan={onScan}
      />
      <Text style={styles.description}>
        {detail.description ||
          detail.shortDescription ||
          t("Nội dung đang được cập nhật.")}
      </Text>
      {kind === "poi" ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t("Thông tin địa điểm")}</Text>
          <Text style={styles.row}>
            {t("Loại: ")}{detail.category || t("Chưa phân loại")}
          </Text>
          {typeof detail.latitude === "number" &&
            typeof detail.longitude === "number" && (
              <Text style={styles.row}>
                {t("Tọa độ: ")}{detail.latitude.toFixed(5)},{" "}
                {detail.longitude.toFixed(5)}
              </Text>
            )}
          {detail.radiusMeters != null && (
            <Text style={styles.row}>{t("Bán kính: ")}{detail.radiusMeters} m</Text>
          )}
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t("Hành trình")}</Text>
          <Text style={styles.row}>
            {t("Thời lượng dự kiến: ")}{detail.estimatedMinutes ?? "—"} {t("phút")}</Text>
          <Text style={styles.row}>
            {t("Số điểm dừng: ")}{detail.pois?.length ?? 0}
          </Text>
          {detail.pois?.map((poi, index) => (
            <Text key={poi.id} style={styles.stop}>
              {index + 1}. {poi.name}
            </Text>
          ))}
        </View>
      )}
    </ScrollView>
  )
}
const styles = StyleSheet.create({
  screen: { backgroundColor: "#F5FAFA", flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  back: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", minHeight: 44, marginBottom: 8 },
  backText: { color: "#058578", fontSize: 14, fontWeight: "700" },
  mapButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, backgroundColor: "#058578", borderRadius: 15, minHeight: 48, marginTop: 18 },
  mapButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  kind: { color: "#058578", fontSize: 12, fontWeight: "800", marginTop: 18 },
  title: { color: "#0F2124", fontSize: 29, fontWeight: "800", marginTop: 6 },
  code: { color: "#667A7D", fontSize: 12, marginTop: 5 },
  description: {
    color: "#4F676A",
    fontSize: 16,
    lineHeight: 25,
    marginTop: 20,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    marginTop: 24,
    padding: 18,
  },
  cardTitle: {
    color: "#0F2124",
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 8,
  },
  row: { color: "#456253", lineHeight: 22, marginTop: 5 },
  stop: { color: "#173B2A", lineHeight: 22, marginTop: 8 },
})
