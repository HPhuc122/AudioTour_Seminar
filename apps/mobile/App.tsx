import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { Button, Modal, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { QrScanner } from "./src/native/QrScanner";

export default function App() {
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
  const [lastQrCode, setLastQrCode] = useState<string | null>(null);

  const handleQrCodeScanned = (code: string) => {
    setLastQrCode(code);
    setIsQrScannerOpen(false);
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.screen} edges={["top", "right", "bottom", "left"]}>
        <View style={styles.content}>
          <Text accessibilityRole="header" style={styles.title}>
            AudioTour
          </Text>
          <Text style={styles.subtitle}>Khám phá hành trình theo cách của bạn</Text>
          <View style={styles.qrButton}>
            <Button title="Quét mã QR" onPress={() => setIsQrScannerOpen(true)} />
          </View>
          {lastQrCode && <Text style={styles.scanResult}>Mã đã quét: {lastQrCode}</Text>}
        </View>
        <Modal animationType="slide" onRequestClose={() => setIsQrScannerOpen(false)} visible={isQrScannerOpen}>
          <SafeAreaView style={styles.modalScreen} edges={["top", "right", "bottom", "left"]}>
            <QrScanner onClose={() => setIsQrScannerOpen(false)} onCodeScanned={handleQrCodeScanned} />
          </SafeAreaView>
        </Modal>
        <StatusBar style="dark" />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F7FDF9",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    color: "#173B2A",
    fontSize: 32,
    fontWeight: "700",
  },
  subtitle: {
    color: "#456253",
    fontSize: 16,
    marginTop: 12,
    textAlign: "center",
  },
  qrButton: {
    marginTop: 32,
  },
  scanResult: {
    color: "#173B2A",
    marginTop: 20,
    textAlign: "center",
  },
  modalScreen: {
    backgroundColor: "#F7FDF9",
    flex: 1,
  },
});