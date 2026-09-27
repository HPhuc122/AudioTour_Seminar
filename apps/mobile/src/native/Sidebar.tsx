import { useTranslator } from "./i18n"
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

export type AppSection = "dashboard" | "pois" | "tours";

type SidebarProps = {
  activeSection: AppSection;
  onClose: () => void;
  onNavigate: (section: AppSection) => void;
  onOpenQr: () => void;
  onOpenLanguage: () => void;
  languageLabel: string;
  visible: boolean;
};

const items: Array<{ id: AppSection; label: string; icon: string }> = [
  { id: "dashboard", label: "Dashboard", icon: "⌂" },
  { id: "pois", label: "POI", icon: "●" },
  { id: "tours", label: "Tour", icon: "◎" },
];

export function Sidebar({ activeSection, onClose, onNavigate, onOpenQr, onOpenLanguage, languageLabel, visible }: SidebarProps) {
  const t = useTranslator()

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.overlay}>
        <View style={styles.drawer}>
          <Text style={styles.brand}>AudioTour</Text>
          <Text style={styles.caption}>{t("Khách vãng lai")}</Text>
          <View style={styles.menu}>
            {items.map((item) => (
              <Pressable key={item.id} onPress={() => onNavigate(item.id)} style={[styles.item, activeSection === item.id && styles.activeItem]}>
                <Text style={styles.icon}>{item.icon}</Text>
                <Text style={[styles.label, activeSection === item.id && styles.activeLabel]}>{item.label}</Text>
              </Pressable>
            ))}
            <Pressable onPress={onOpenQr} style={styles.item}>
              <Text style={styles.icon}>▦</Text><Text style={styles.label}>{t("Quét QR")}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={t("Ngôn ngữ: {0}", languageLabel)} onPress={onOpenLanguage} style={styles.item}>
              <Text style={styles.icon}>◎</Text>
              <View style={{ flex: 1 }}><Text style={styles.label}>{t("Ngôn ngữ")}</Text><Text style={styles.caption}>{languageLabel}</Text></View>
            </Pressable>
          </View>
        </View>
        <Pressable accessibilityLabel={t("Đóng menu")} onPress={onClose} style={styles.backdrop} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, flexDirection: "row" },
  drawer: { backgroundColor: "#F7FDF9", paddingHorizontal: 20, paddingTop: 58, width: "78%" },
  backdrop: { backgroundColor: "rgba(15,45,30,0.45)", flex: 1 },
  brand: { color: "#173B2A", fontSize: 28, fontWeight: "800" },
  caption: { color: "#6B8777", marginTop: 4 },
  menu: { marginTop: 34 },
  item: { alignItems: "center", borderRadius: 14, flexDirection: "row", marginBottom: 8, padding: 15 },
  activeItem: { backgroundColor: "#DCFCE7" },
  icon: { color: "#15803D", fontSize: 20, marginRight: 14, textAlign: "center", width: 24 },
  label: { color: "#456253", fontSize: 16, fontWeight: "600" },
  activeLabel: { color: "#166534", fontWeight: "800" },
});
