import { useTranslator } from "./i18n"
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type QrScannerProps = {
  onCodeScanned: (code: string) => void;
  onClose: () => void;
};

export function QrScanner({ onCodeScanned, onClose }: QrScannerProps) {
  const t = useTranslator()

  const [permission, requestPermission] = useCameraPermissions();
  const [manualCode, setManualCode] = useState("");
  const requestedPermission = useRef(false);
  const scanned = useRef(false);

  useEffect(() => {
    if (!permission || permission.granted || !permission.canAskAgain || requestedPermission.current) return;

    requestedPermission.current = true;
    void requestPermission();
  }, [permission, requestPermission]);

  const submitCode = (code: string) => {
    const trimmedCode = code.trim();
    if (!trimmedCode || scanned.current) return;

    scanned.current = true;
    onCodeScanned(trimmedCode);
  };

  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#15803D" />
        <Text style={styles.description}>{t("Đang kiểm tra quyền camera…")}</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.fallback}>
        <Text accessibilityRole="header" style={styles.title}>
          {t("Nhập mã QR")}</Text>
        <Text style={styles.description}>
          {t("Bạn có thể nhập mã trên vé hoặc bảng thông tin nếu không dùng camera.")}</Text>
        {permission.canAskAgain && (
          <View style={styles.buttonSpacing}>
            <Pressable onPress={() => void requestPermission()} style={styles.primary}><Text style={styles.primaryText}>{t("Cho phép dùng camera")}</Text></Pressable>
          </View>
        )}
        <TextInput
          accessibilityLabel={t("Mã QR")}
          autoCapitalize="characters"
          autoCorrect={false}
          onChangeText={setManualCode}
          placeholder={t("Nhập mã QR")}
          style={styles.input}
          value={manualCode}
        />
        <View style={styles.buttonSpacing}>
          <Pressable accessibilityRole="button" disabled={!manualCode.trim()} onPress={() => submitCode(manualCode)} style={[styles.primary, !manualCode.trim() && styles.disabled]}><Text style={styles.primaryText}>{t("Xác nhận mã")}</Text></Pressable>
        </View>
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.closeFallback}><Text style={styles.closeFallbackText}>{t("Đóng")}</Text></Pressable>
      </View>
    );
  }

  return (
    <View style={styles.cameraScreen}>
      <CameraView
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={({ data }) => submitCode(data)}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.cameraOverlay}>
        <Text style={styles.cameraEyebrow}>AUDIOTOUR</Text>
        <Text style={styles.cameraTitle}>{t("Đưa mã QR vào khung hình")}</Text>
        <View style={styles.scanFrame}><Ionicons name="qr-code-outline" size={64} color="#FFFFFF66" /></View>
        <Text style={styles.cameraHint}>{t("Đặt mã QR trong khung để bắt đầu thuyết minh")}</Text>
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.closeButton}><Ionicons name="close" size={20} color="#FFFFFF" /><Text style={styles.closeText}>{t("Đóng")}</Text></Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  fallback: {
    backgroundColor: "#F5FAFA",
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  title: {
    color: "#0F2124",
    fontSize: 28,
    fontWeight: "700",
  },
  description: {
    color: "#456253",
    fontSize: 16,
    lineHeight: 24,
    marginTop: 12,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderColor: "#D6E9E9",
    borderRadius: 16,
    borderWidth: 1,
    fontSize: 16,
    marginTop: 24,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  buttonSpacing: {
    marginTop: 16,
  },
  primary: { backgroundColor: "#058578", borderRadius: 15, minHeight: 50, alignItems: "center", justifyContent: "center" },
  primaryText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  disabled: { opacity: .45 },
  closeFallback: { alignItems: "center", padding: 16, marginTop: 10 },
  closeFallbackText: { color: "#058578", fontSize: 15, fontWeight: "700" },
  cameraScreen: {
    backgroundColor: "#000000",
    flex: 1,
  },
  cameraOverlay: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#001E2466",
  },
  cameraEyebrow: { color: "#B2EEE4", fontSize: 12, fontWeight: "800", letterSpacing: 2, marginBottom: 8 },
  cameraTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 24,
    textAlign: "center",
  },
  scanFrame: {
    borderColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 3,
    height: 260,
    width: 260,
    alignItems: "center",
    justifyContent: "center",
  },
  cameraHint: { color: "#E0F7F5", textAlign: "center", fontSize: 13, lineHeight: 19, marginTop: 22, maxWidth: 270 },
  closeButton: {
    marginTop: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 16,
    backgroundColor: "#FFFFFF33",
    paddingHorizontal: 24,
    minHeight: 46,
  },
  closeText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
});
