import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native"
import type { PublicPoiSummary, PublicTourSummary } from "./api"
import { PoiImage } from "./PoiImages"

type Props = {
  isLoading: boolean
  kind: "poi" | "tour"
  onMenu: () => void
  onSelect: (id: number) => void
  pois: PublicPoiSummary[]
  tours: PublicTourSummary[]
}

export function CatalogListScreen({
  isLoading,
  kind,
  onMenu,
  onSelect,
  pois,
  tours,
}: Props) {
  const entries = kind === "poi" ? pois : tours
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={onMenu} style={styles.menuButton}>
          <Text style={styles.menuIcon}>☰</Text>
        </Pressable>
        <Text style={styles.title}>
          {kind === "poi" ? "Danh sách POI" : "Danh sách Tour"}
        </Text>
      </View>
      {isLoading ? (
        <ActivityIndicator color="#15803D" style={styles.loading} />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {entries.length === 0 ? (
            <Text style={styles.empty}>Chưa có nội dung công khai.</Text>
          ) : (
            entries.map((entry) => (
              <Pressable
                key={entry.id}
                onPress={() => onSelect(entry.id)}
                style={styles.card}
              >
                {kind === "poi" ? (
                  <View style={styles.thumbnail}>
                    <PoiImage
                      id={(entry as PublicPoiSummary).thumbnailImageId}
                      label={entry.name}
                    />
                  </View>
                ) : (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>TOUR</Text>
                  </View>
                )}
                <View style={styles.cardBody}>
                  <Text style={styles.code}>{entry.code}</Text>
                  <Text style={styles.name}>{entry.name}</Text>
                  <Text numberOfLines={2} style={styles.description}>
                    {entry.description ||
                      (kind === "poi"
                        ? (entry as PublicPoiSummary).shortDescription
                        : undefined) ||
                      "Nội dung đang được cập nhật."}
                  </Text>
                  <Text style={styles.meta}>
                    {kind === "tour"
                      ? `${(entry as PublicTourSummary).estimatedMinutes ?? "—"} phút`
                      : (entry as PublicPoiSummary).category || "Địa điểm"}
                  </Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            ))
          )}
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  thumbnail: { width: 88, height: 96, borderRadius: 12, overflow: "hidden" },
  screen: { backgroundColor: "#F7FDF9", flex: 1 },
  header: {
    alignItems: "center",
    flexDirection: "row",
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  menuButton: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#C8EAD8",
    borderRadius: 12,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    marginRight: 14,
    width: 44,
  },
  menuIcon: { color: "#173B2A", fontSize: 22 },
  title: { color: "#173B2A", fontSize: 24, fontWeight: "800" },
  loading: { marginTop: 36 },
  list: { padding: 18, paddingTop: 4 },
  empty: { color: "#6B8777", padding: 30, textAlign: "center" },
  card: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#C8EAD8",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    marginBottom: 12,
    padding: 14,
  },
  badge: {
    alignItems: "center",
    backgroundColor: "#DCFCE7",
    borderRadius: 12,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  badgeText: { color: "#15803D", fontSize: 11, fontWeight: "800" },
  cardBody: { flex: 1, marginLeft: 13 },
  code: { color: "#15803D", fontSize: 10, fontWeight: "700" },
  name: { color: "#173B2A", fontSize: 17, fontWeight: "700", marginTop: 3 },
  description: { color: "#6B8777", fontSize: 13, lineHeight: 18, marginTop: 5 },
  meta: { color: "#456253", fontSize: 12, fontWeight: "600", marginTop: 7 },
  chevron: { color: "#15803D", fontSize: 30, marginLeft: 8 },
})
