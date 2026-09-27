import { useTranslator } from "./i18n"
import { useState } from "react"
import {
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { audioTourApi, type PublicTargetDetail } from "./api"

export function PoiImage({
  id,
  label,
  contain = false,
}: {
  id?: number | null
  label: string
  contain?: boolean
}) {
  const t = useTranslator()

  const [failedId, setFailedId] = useState<number | null>(null)
  return id && failedId !== id ? (
    <Image
      accessibilityLabel={label}
      source={{ uri: audioTourApi.getImageUrl(id) }}
      resizeMode={contain ? "contain" : "cover"}
      style={styles.image}
      onError={() => setFailedId(id)}
    />
  ) : (
    <View style={styles.placeholder}>
      <Text style={styles.empty}>
        {id ? t("Không tải được ảnh") : t("Chưa có ảnh")}
      </Text>
    </View>
  )
}

export function PoiImages({
  images = [],
  name,
}: {
  images?: PublicTargetDetail["images"]
  name: string
}) {
  const t = useTranslator()

  const highlight = images.find(
    (image) => image.imageCategory?.toLowerCase() === "highlight",
  )
  const ordered = highlight
    ? [highlight, ...images.filter((image) => image.id !== highlight.id)]
    : images
  const [selected, setSelected] = useState<number | null>(null)
  const [page, setPage] = useState(0)
  const { width, height } = useWindowDimensions()
  const open = (index: number) => {
    setPage(index)
    setSelected(index)
  }
  return (
    <View style={styles.gallery}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("Xem ảnh {0}", name)}
        disabled={!ordered.length}
        onPress={() => open(0)}
        style={styles.hero}
      >
        <PoiImage id={ordered[0]?.id} label={name} />
        {ordered.length > 0 && (
          <Text style={styles.count}>{ordered.length} {t(" ảnh")}</Text>
        )}
      </Pressable>
      {ordered.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.strip}
        >
          {ordered.slice(1).map((item, index) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={t("Xem ảnh {0} của {1}", index + 2, name)}
              onPress={() => open(index + 1)}
              style={styles.tile}
            >
              <PoiImage id={item.id} label={t("{0}, ảnh {1}", name, index + 2)} />
            </Pressable>
          ))}
        </ScrollView>
      )}
      <Modal
        visible={selected !== null}
        animationType="fade"
        onRequestClose={() => setSelected(null)}
      >
        <SafeAreaView style={styles.viewer}>
          <View style={styles.toolbar}>
            <Text numberOfLines={1} style={styles.caption}>
              {name} · {page + 1}/{ordered.length}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setSelected(null)}
              style={styles.close}
            >
              <Text style={styles.closeText}>{t("Đóng ✕")}</Text>
            </Pressable>
          </View>
          {selected !== null && (
            <FlatList
              key={`${width}:${height}:${selected}`}
              horizontal
              pagingEnabled
              data={ordered}
              initialScrollIndex={page}
              getItemLayout={(_, index) => ({
                length: width,
                offset: width * index,
                index,
              })}
              keyExtractor={(item) => String(item.id)}
              onMomentumScrollEnd={(event) =>
                setPage(Math.round(event.nativeEvent.contentOffset.x / width))
              }
              renderItem={({ item, index }) => (
                <View style={{ width, height: Math.max(160, height - 160) }}>
                  <PoiImage
                    id={item.id}
                    label={t("{0}, ảnh {1}", name, index + 1)}
                    contain
                  />
                </View>
              )}
            />
          )}
        </SafeAreaView>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  gallery: { marginTop: 18 },
  hero: { height: 230, borderRadius: 18, overflow: "hidden" },
  image: { width: "100%", height: "100%" },
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#DDF5E7",
  },
  empty: { color: "#456253", textAlign: "center", padding: 8 },
  count: {
    position: "absolute",
    bottom: 12,
    right: 12,
    color: "white",
    backgroundColor: "#173B2ACC",
    padding: 8,
    borderRadius: 10,
  },
  strip: { gap: 10, paddingVertical: 12 },
  tile: { width: 110, height: 80, borderRadius: 12, overflow: "hidden" },
  viewer: { flex: 1, backgroundColor: "#101713" },
  toolbar: { flexDirection: "row", alignItems: "center", padding: 16 },
  caption: { flex: 1, color: "white", fontSize: 16 },
  close: { padding: 12 },
  closeText: { color: "white", fontWeight: "700" },
})
