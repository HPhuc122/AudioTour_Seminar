import { Pressable, StyleSheet, Text, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useTranslator } from "./i18n"

export type Tab = "home" | "map" | "tour" | "ticket" | "search"
type Props = { active: Tab; onSelect: (tab: Tab) => void; onScan: () => void }

const tabs: Array<{ id: Tab; label: string; icon: keyof typeof Ionicons.glyphMap; selected: keyof typeof Ionicons.glyphMap }> = [
  { id: "home", label: "Trang chủ", icon: "home-outline", selected: "home" },
  { id: "map", label: "Bản đồ", icon: "map-outline", selected: "map" },
  { id: "tour", label: "Tour", icon: "compass-outline", selected: "compass" },
  { id: "ticket", label: "Vé", icon: "ticket-outline", selected: "ticket" },
  { id: "search", label: "Tìm kiếm", icon: "search-outline", selected: "search" },
]

export function BottomNavigation({ active, onSelect, onScan }: Props) {
  const t = useTranslator()
  return <View style={styles.outer}><View style={styles.bar}>
    {tabs.slice(0, 3).map(tab => <Pressable key={tab.id} accessibilityRole="tab" accessibilityState={{ selected: active === tab.id }} onPress={() => onSelect(tab.id)} style={styles.tab}>
      <Ionicons name={active === tab.id ? tab.selected : tab.icon} size={22} color={active === tab.id ? "#058578" : "#71878A"} /><Text style={[styles.label, active === tab.id && styles.active]}>{t(tab.label)}</Text>
    </Pressable>)}
    <Pressable accessibilityRole="button" accessibilityLabel={t("Quét QR")} onPress={onScan} style={styles.qr}><Ionicons name="qr-code-outline" size={28} color="#FFFFFF" /></Pressable>
    {tabs.slice(3).map(tab => <Pressable key={tab.id} accessibilityRole="tab" accessibilityState={{ selected: active === tab.id }} onPress={() => onSelect(tab.id)} style={styles.tab}>
      <Ionicons name={active === tab.id ? tab.selected : tab.icon} size={22} color={active === tab.id ? "#058578" : "#71878A"} /><Text style={[styles.label, active === tab.id && styles.active]}>{t(tab.label)}</Text>
    </Pressable>)}
  </View></View>
}

const styles = StyleSheet.create({
  outer: { backgroundColor: "#F5FAFA", paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 },
  bar: { height: 74, backgroundColor: "#FFFFFF", borderRadius: 24, flexDirection: "row", alignItems: "center", justifyContent: "space-around", elevation: 8, shadowColor: "#173B3B", shadowOpacity: .13, shadowRadius: 16, shadowOffset: { width: 0, height: -3 } },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 54 }, icon: { color: "#71878A", fontSize: 27, lineHeight: 30 },
  label: { color: "#71878A", fontSize: 10, marginTop: 4 }, active: { color: "#058578", fontWeight: "800" },
  qr: { width: 54, height: 54, borderRadius: 27, backgroundColor: "#058578", alignItems: "center", justifyContent: "center", marginTop: -10, elevation: 5, shadowColor: "#05665C", shadowOpacity: .28, shadowRadius: 10, shadowOffset: { width: 0, height: 7 } },
  qrIcon: { color: "#FFFFFF", fontSize: 30, fontWeight: "800" },
})
