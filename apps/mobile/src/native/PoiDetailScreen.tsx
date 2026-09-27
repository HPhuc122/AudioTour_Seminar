import { useState } from "react";
import { Button, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import type { PublicTargetDetail } from "./api";
import type { AudioEntryAction } from "./qrFlow";

type PoiDetailScreenProps = {
  poi: PublicTargetDetail;
  languageCode: string;
  audioEntryAction: AudioEntryAction;
  onScanAnother: () => void;
};

function formatDuration(seconds?: number): string {
  if (!seconds) return "Chưa rõ thời lượng";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return minutes > 0 ? `${minutes}:${remainingSeconds.toString().padStart(2, "0")}` : `${seconds} giây`;
}

export function PoiDetailScreen({
  poi,
  languageCode,
  audioEntryAction,
  onScanAnother,
}: PoiDetailScreenProps) {
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const description = poi.description || poi.shortDescription || "Nội dung giới thiệu đang được cập nhật.";
  const shouldCollapse = description.length > 150;
  const visibleDescription = shouldCollapse && !isDescriptionExpanded
    ? `${description.slice(0, 150).trim()}…`
    : description;
  const availableTracks = poi.audioTracks?.filter((track) => track.isAvailable) ?? [];
  const primaryTrack = availableTracks[0];

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
      <View style={styles.hero}>
        <Text style={styles.heroIcon}>◎</Text>
        <Text style={styles.heroText}>Ảnh địa điểm đang được cập nhật</Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.category}>{poi.category || "Địa điểm"}</Text>
        <Text accessibilityRole="header" style={styles.title}>{poi.name}</Text>
        <Text style={styles.code}>{poi.code}</Text>

        <Text style={styles.description}>{visibleDescription}</Text>
        {shouldCollapse && (
          <Pressable accessibilityRole="button" onPress={() => setIsDescriptionExpanded((value) => !value)}>
            <Text style={styles.expandButton}>{isDescriptionExpanded ? "Thu gọn" : "Xem thêm"}</Text>
          </Pressable>
        )}

        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>Thông tin địa điểm</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Ngôn ngữ</Text>
            <Text style={styles.infoValue}>{languageCode}</Text>
          </View>
          {poi.latitude !== undefined && poi.longitude !== undefined && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Tọa độ</Text>
              <Text style={styles.infoValue}>{poi.latitude.toFixed(5)}, {poi.longitude.toFixed(5)}</Text>
            </View>
          )}
          {poi.radiusMeters !== undefined && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Bán kính nhận diện</Text>
              <Text style={styles.infoValue}>{poi.radiusMeters} m</Text>
            </View>
          )}
        </View>

        <View style={styles.audioCard}>
          <View style={styles.audioHeader}>
            <Text style={styles.sectionTitle}>Thuyết minh audio</Text>
            <Text style={styles.languageBadge}>{languageCode}</Text>
          </View>
          {primaryTrack ? (
            <>
              <Text style={styles.trackTitle}>{primaryTrack.title}</Text>
              <Text style={styles.trackMeta}>{formatDuration(primaryTrack.durationSeconds)} · {primaryTrack.audioType}</Text>
              <View style={styles.lockNotice}>
                <Text style={styles.lockIcon}>🔒</Text>
                <View style={styles.lockText}>
                  <Text style={styles.lockTitle}>
                    {audioEntryAction === "show-payment" ? "Cần mở khóa audio" : "Audio miễn phí chưa kích hoạt"}
                  </Text>
                  <Text style={styles.lockDescription}>
                    {audioEntryAction === "show-payment"
                      ? "Bạn vẫn xem được địa điểm; bước thanh toán chỉ áp dụng khi nghe audio."
                      : "Lát tiếp theo sẽ tạo guest access và phát audio từ API."}
                  </Text>
                </View>
              </View>
            </>
          ) : (
            <Text style={styles.emptyText}>Chưa có audio khả dụng cho ngôn ngữ này.</Text>
          )}
        </View>

        <Button title="Quét mã khác" onPress={onScanAnother} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7FDF9" },
  content: { paddingBottom: 36 },
  hero: {
    alignItems: "center",
    backgroundColor: "#DDF5E7",
    height: 220,
    justifyContent: "center",
    padding: 24,
  },
  heroIcon: { color: "#15803D", fontSize: 58 },
  heroText: { color: "#456253", marginTop: 10, textAlign: "center" },
  body: { padding: 22 },
  category: { color: "#15803D", fontSize: 13, fontWeight: "700", textTransform: "uppercase" },
  title: { color: "#173B2A", fontSize: 30, fontWeight: "800", marginTop: 6 },
  code: { color: "#6B8777", fontSize: 12, marginTop: 5 },
  description: { color: "#456253", fontSize: 16, lineHeight: 25, marginTop: 20 },
  expandButton: { color: "#15803D", fontWeight: "700", marginTop: 8 },
  infoCard: {
    backgroundColor: "#FFFFFF",
    borderColor: "#C8EAD8",
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 24,
    padding: 18,
  },
  sectionTitle: { color: "#173B2A", fontSize: 17, fontWeight: "700" },
  infoRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 13 },
  infoLabel: { color: "#6B8777" },
  infoValue: { color: "#173B2A", fontWeight: "600" },
  audioCard: {
    backgroundColor: "#FFFFFF",
    borderColor: "#C8EAD8",
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 24,
    marginTop: 16,
    padding: 18,
  },
  audioHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  languageBadge: {
    backgroundColor: "#DCFCE7",
    borderRadius: 999,
    color: "#15803D",
    fontSize: 12,
    fontWeight: "700",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  trackTitle: { color: "#173B2A", fontSize: 16, fontWeight: "600", marginTop: 16 },
  trackMeta: { color: "#6B8777", fontSize: 13, marginTop: 5 },
  lockNotice: {
    alignItems: "flex-start",
    backgroundColor: "#FFF4E5",
    borderRadius: 14,
    flexDirection: "row",
    marginTop: 16,
    padding: 14,
  },
  lockIcon: { fontSize: 18, marginRight: 10 },
  lockText: { flex: 1 },
  lockTitle: { color: "#7A4614", fontWeight: "700" },
  lockDescription: { color: "#8A5A2B", fontSize: 13, lineHeight: 19, marginTop: 4 },
  emptyText: { color: "#6B8777", lineHeight: 21, marginTop: 16 },
});
