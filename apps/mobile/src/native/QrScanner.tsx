import { CameraView, useCameraPermissions } from "expo-camera";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Button,
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
        <Text style={styles.description}>Đang kiểm tra quyền camera…</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.fallback}>
        <Text accessibilityRole="header" style={styles.title}>
          Nhập mã QR
        </Text>
        <Text style={styles.description}>
          Bạn có thể nhập mã trên vé hoặc bảng thông tin nếu không dùng camera.
        </Text>
        {permission.canAskAgain && (
          <View style={styles.buttonSpacing}>
            <Button title="Cho phép dùng camera" onPress={() => void requestPermission()} />
          </View>
        )}
        <TextInput
          accessibilityLabel="Mã QR"
          autoCapitalize="characters"
          autoCorrect={false}
          onChangeText={setManualCode}
          placeholder="Nhập mã QR"
          style={styles.input}
          value={manualCode}
        />
        <View style={styles.buttonSpacing}>
          <Button title="Xác nhận mã" disabled={!manualCode.trim()} onPress={() => submitCode(manualCode)} />
        </View>
        <Button color="#456253" title="Đóng" onPress={onClose} />
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
        <Text style={styles.cameraTitle}>Đưa mã QR vào khung hình</Text>
        <View style={styles.scanFrame} />
        <View style={styles.closeButton}>
          <Button color="#FFFFFF" title="Đóng" onPress={onClose} />
        </View>
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
    backgroundColor: "#F7FDF9",
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  title: {
    color: "#173B2A",
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
    borderColor: "#9CCCB0",
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
    marginTop: 24,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  buttonSpacing: {
    marginTop: 16,
  },
  cameraScreen: {
    backgroundColor: "#000000",
    flex: 1,
  },
  cameraOverlay: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  cameraTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 24,
    textAlign: "center",
  },
  scanFrame: {
    borderColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 3,
    height: 250,
    width: 250,
  },
  closeButton: {
    marginTop: 32,
  },
});