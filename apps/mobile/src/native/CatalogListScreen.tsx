import { useTranslator } from "./i18n"
import { useEffect, useState } from "react"
import {
  ActivityIndicator,
  Pressable,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
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
  poiTotal: number
  hasMorePois: boolean
  loadingMorePois: boolean
  morePoisError: string | null
  onLoadMorePois: () => void
}

export function CatalogListScreen({
  languageCode,
  isLoading,
  kind,
  onMenu,
  onSelect,
  pois,
  tours,
  poiTotal,
  hasMorePois,
  loadingMorePois,
  morePoisError,
  onLoadMorePois,
}: Props) {
  const t = useTranslator()

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
          if (!cancelled) setResult({ key: searchKey, entries: [], error: reason instanceof Error ? reason.message : t("Không thể tìm kiếm. Vui lòng thử lại.") })
        }
      })()
    }, 300)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [term, languageCode, kind, searchKey])
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={onMenu} style={styles.menuButton}>
          <Text style={styles.menuIcon}>‹</Text>
        </Pressable>
        <Text style={styles.title}>
          {kind === "poi" ? t("Danh sách POI") : t("Danh sách Tour")}
        </Text>
      </View>
      <View style={styles.searchBox}>
        <TextInput
          accessibilityLabel={kind === "poi" ? t("Tìm POI theo tên") : t("Tìm Tour theo tên")}
          placeholder={kind === "poi" ? t("Tìm POI theo tên…") : t("Tìm Tour theo tên…")}
          placeholderTextColor="#6B8777"
          value={query}
          onChangeText={setQuery}
          maxLength={200}
          returnKeyType="search"
          autoCorrect={false}
          style={styles.searchInput}
        />
        {query.length > 0 && <Pressable accessibilityRole="button" accessibilityLabel={t("Xóa từ khóa")} onPress={() => setQuery("")} style={styles.clearSearch}><Text style={styles.clearText}>×</Text></Pressable>}
      </View>
      {searchError ? <View style={styles.searchNotice}><Text accessibilityRole="alert" style={styles.error}>{t(searchError)}</Text><Pressable onPress={() => setRetry(value => value + 1)} style={styles.retryButton}><Text style={styles.retryText}>{t("Thử lại")}</Text></Pressable></View> : null}
      {isLoading || searching ? (
        <ActivityIndicator color="#15803D" style={styles.loading} />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(entry) => `${kind}:${entry.id}`}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>{searchError ? "" : term ? t("Không tìm thấy {0} có tên chứa “{1}”.", t(kind === "poi" ? "POI" : "Tour"), term) : t("Chưa có nội dung công khai.")}</Text>}
          renderItem={({ item: entry }) => (
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
                    <Text style={styles.badgeText}>{t("TOUR")}</Text>
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
                      t("Nội dung đang được cập nhật.")}
                  </Text>
                  <Text style={styles.meta}>
                    {kind === "tour"
                      ? t("{0} phút", (entry as PublicTourSummary).estimatedMinutes ?? "—")
                      : (entry as PublicPoiSummary).category || t("Địa điểm")}
                  </Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
          )}
          ListFooterComponent={!term && kind === "poi" ? <View style={styles.footer}>
            <Text style={styles.meta}>{t("Đã tải {0}/{1} POI", pois.length, poiTotal)}</Text>
            {morePoisError && <Text accessibilityRole="alert" style={styles.error}>{t(morePoisError)}</Text>}
            {(hasMorePois || morePoisError) && <Pressable accessibilityRole="button" disabled={loadingMorePois} onPress={onLoadMorePois} style={styles.retryButton}><Text style={styles.retryText}>{loadingMorePois ? t("Đang tải thêm…") : morePoisError ? t("Thử lại") : t("Tải thêm POI")}</Text></Pressable>}
          </View> : null}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  footer: { gap: 10, paddingVertical: 16, alignItems: "center" },
  retryButton: { backgroundColor: "#E0F7F0", borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12, alignSelf: "flex-start", marginTop: 8 },
  retryText: { color: "#058578", fontWeight: "700" },
  searchBox: { flexDirection: "row", alignItems: "center", marginHorizontal: 20, marginBottom: 14, borderWidth: 1, borderColor: "#D6E9E9", borderRadius: 16, backgroundColor: "white" },
  searchInput: { flex: 1, minWidth: 0, padding: 12, fontSize: 16, color: "#173B2A" },
  clearSearch: { width: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  clearText: { fontSize: 26, color: "#456253" },
  searchNotice: { paddingHorizontal: 18, marginBottom: 8 },
  error: { color: "#B42318" },
  thumbnail: { width: 88, height: 96, borderRadius: 12, overflow: "hidden" },
  screen: { backgroundColor: "#F5FAFA", flex: 1 },
  header: {
    alignItems: "center",
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  menuButton: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#D6E9E9",
    borderRadius: 12,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    marginRight: 14,
    width: 44,
  },
  menuIcon: { color: "#058578", fontSize: 30, lineHeight: 34 },
  title: { color: "#0F2124", fontSize: 24, fontWeight: "800" },
  loading: { marginTop: 36 },
  list: { padding: 20, paddingTop: 4 },
  empty: { color: "#6B8777", padding: 30, textAlign: "center" },
  card: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    flexDirection: "row",
    marginBottom: 12,
    padding: 14,
    elevation: 2,
    shadowColor: "#233",
    shadowOpacity: .06,
    shadowRadius: 10,
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
