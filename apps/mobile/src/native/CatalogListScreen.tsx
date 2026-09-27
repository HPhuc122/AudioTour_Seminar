import { useEffect, useState } from "react"
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  Button,
  View,
} from "react-native"
import { audioTourApi, type PublicPoiSummary, type PublicTourSummary } from "./api"
import { PoiImage } from "./PoiImages"

type Props = {
  languageCode: string
  isLoading: boolean
  kind: "poi" | "tour"
  onMenu: () => void
  onSelect: (id: number) => void
  pois: PublicPoiSummary[]
  tours: PublicTourSummary[]
}

export function CatalogListScreen({
  languageCode,
  isLoading,
  kind,
  onMenu,
  onSelect,
  pois,
  tours,
}: Props) {
  const [query, setQuery] = useState("")
  const [retry, setRetry] = useState(0)
  const [result, setResult] = useState<{
    key: string
    entries: (PublicPoiSummary | PublicTourSummary)[]
    error?: string
  } | null>(null)
  const term = query.trim()
  const searchKey = JSON.stringify([kind, languageCode, term, retry])
  const searching = Boolean(term) && result?.key !== searchKey
  const searchError = term && result?.key === searchKey ? result.error : undefined
  const entries = term ? (result?.key === searchKey ? result.entries : []) : (kind === "poi" ? pois : tours)
  useEffect(() => {
    if (!term || !languageCode) return
    let cancelled = false
    const timer = setTimeout(() => {
      void (async () => {
        try {
          let matches: (PublicPoiSummary | PublicTourSummary)[]
          if (kind === "tour") {
            matches = await audioTourApi.listTours(languageCode, term)
          } else {
            const first = await audioTourApi.listPois(languageCode, term)
            matches = [...first.items]
            for (let page = 2; matches.length < first.total; page++) {
              if (cancelled) return
              const next = await audioTourApi.listPois(languageCode, term, page)
              if (!next.items.length) break
              matches.push(...next.items)
            }
          }
          if (!cancelled) setResult({ key: searchKey, entries: matches })
        } catch (reason) {
          if (!cancelled) setResult({ key: searchKey, entries: [], error: reason instanceof Error ? reason.message : "Không thể tìm kiếm. Vui lòng thử lại." })
        }
      })()
    }, 300)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [term, languageCode, kind, searchKey])
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
      <View style={styles.searchBox}>
        <TextInput
          accessibilityLabel={kind === "poi" ? "Tìm POI theo tên" : "Tìm Tour theo tên"}
          placeholder={kind === "poi" ? "Tìm POI theo tên…" : "Tìm Tour theo tên…"}
          placeholderTextColor="#6B8777"
          value={query}
          onChangeText={setQuery}
          maxLength={200}
          returnKeyType="search"
          autoCorrect={false}
          style={styles.searchInput}
        />
        {query.length > 0 && <Pressable accessibilityRole="button" accessibilityLabel="Xóa từ khóa" onPress={() => setQuery("")} style={styles.clearSearch}><Text style={styles.clearText}>×</Text></Pressable>}
      </View>
      {searchError ? <View style={styles.searchNotice}><Text accessibilityRole="alert" style={styles.error}>{searchError}</Text><Button title="Thử lại" onPress={() => setRetry((value) => value + 1)}/></View> : null}
      {isLoading || searching ? (
        <ActivityIndicator color="#15803D" style={styles.loading} />
      ) : (
        <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={styles.list}>
          {entries.length === 0 ? (
            <Text style={styles.empty}>{searchError ? "" : term ? `Không tìm thấy ${kind === "poi" ? "POI" : "Tour"} có tên chứa “${term}”.` : "Chưa có nội dung công khai."}</Text>
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
  searchBox: { flexDirection: "row", alignItems: "center", marginHorizontal: 18, marginBottom: 14, borderWidth: 1, borderColor: "#C8EAD8", borderRadius: 12, backgroundColor: "white" },
  searchInput: { flex: 1, minWidth: 0, padding: 12, fontSize: 16, color: "#173B2A" },
  clearSearch: { width: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  clearText: { fontSize: 26, color: "#456253" },
  searchNotice: { paddingHorizontal: 18, marginBottom: 8 },
  error: { color: "#B42318" },
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
