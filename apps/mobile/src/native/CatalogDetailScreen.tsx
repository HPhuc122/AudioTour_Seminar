import { Button, ScrollView, StyleSheet, Text, View } from "react-native"
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
}: Props) {
  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
      <Button color="#456253" title="Quay lại danh sách" onPress={onBack} />
      {kind === "poi" && (
        <PoiImages images={detail.images} name={detail.name} />
      )}
      <Text style={styles.kind}>{kind === "poi" ? "POI" : "TOUR"}</Text>
      <Text accessibilityRole="header" style={styles.title}>
        {detail.name}
      </Text>
      <Text style={styles.code}>{detail.code}</Text>
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
          "Nội dung đang được cập nhật."}
      </Text>
      {kind === "poi" ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Thông tin địa điểm</Text>
          <Text style={styles.row}>
            Loại: {detail.category || "Chưa phân loại"}
          </Text>
          {typeof detail.latitude === "number" &&
            typeof detail.longitude === "number" && (
              <Text style={styles.row}>
                Tọa độ: {detail.latitude.toFixed(5)},{" "}
                {detail.longitude.toFixed(5)}
              </Text>
            )}
          {detail.radiusMeters != null && (
            <Text style={styles.row}>Bán kính: {detail.radiusMeters} m</Text>
          )}
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Hành trình</Text>
          <Text style={styles.row}>
            Thời lượng dự kiến: {detail.estimatedMinutes ?? "—"} phút
          </Text>
          <Text style={styles.row}>
            Số điểm dừng: {detail.pois?.length ?? 0}
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
  screen: { backgroundColor: "#F7FDF9", flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  kind: { color: "#15803D", fontSize: 12, fontWeight: "800", marginTop: 28 },
  title: { color: "#173B2A", fontSize: 29, fontWeight: "800", marginTop: 6 },
  code: { color: "#6B8777", fontSize: 12, marginTop: 5 },
  description: {
    color: "#456253",
    fontSize: 16,
    lineHeight: 25,
    marginTop: 20,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderColor: "#C8EAD8",
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 24,
    padding: 18,
  },
  cardTitle: {
    color: "#173B2A",
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 8,
  },
  row: { color: "#456253", lineHeight: 22, marginTop: 5 },
  stop: { color: "#173B2A", lineHeight: 22, marginTop: 8 },
})
