import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { ActivityIndicator, Button, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { QrScanner } from "./src/native/QrScanner";
import { PoiDetailScreen } from "./src/native/PoiDetailScreen";
import { audioTourApi } from "./src/native/api";
import type { ApiLanguage, ApiQrTarget, PublicTargetDetail } from "./src/native/api";
import { resolveDeviceLanguage } from "./src/native/languageResolution";
import { createQrVisit } from "./src/native/qrFlow";
import type { AudioEntryAction, PublicDetailDestination } from "./src/native/qrFlow";

type PendingQrVisit = {
  code: string;
  target: ApiQrTarget;
  languages: ApiLanguage[];
};

export default function App() {
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
  const [pendingQrVisit, setPendingQrVisit] = useState<PendingQrVisit | null>(null);
  const [destination, setDestination] = useState<PublicDetailDestination | null>(null);
  const [detail, setDetail] = useState<PublicTargetDetail | null>(null);
  const [audioEntryAction, setAudioEntryAction] = useState<AudioEntryAction | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const openResolvedTarget = async (target: ApiQrTarget, languageCode: string, scannedQrCode: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const visit = createQrVisit(target, languageCode);
      const targetDetail = visit.destination.screen === "poi-detail"
        ? await audioTourApi.getPoi(visit.destination.id, languageCode)
        : await audioTourApi.getTour(visit.destination.id, languageCode);
      setDestination(visit.destination);
      setAudioEntryAction(visit.audioEntryAction);
      setQrCode(scannedQrCode);
      setDetail(targetDetail);
      setPendingQrVisit(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể mở nội dung QR.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleQrCodeScanned = async (code: string) => {
    setIsQrScannerOpen(false);
    setIsLoading(true);
    setError(null);
    setDestination(null);
    setDetail(null);
    setAudioEntryAction(null);
    setQrCode(null);

    try {
      const [target, languages] = await Promise.all([audioTourApi.resolveQr(code), audioTourApi.getLanguages()]);
      const languageCode = resolveDeviceLanguage(languages.map((language) => language.code));

      if (languageCode) {
        await openResolvedTarget(target, languageCode, code);
      } else {
        setPendingQrVisit({ code, target, languages });
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể xử lý mã QR.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.screen} edges={["top", "right", "bottom", "left"]}>
        {detail && destination?.screen === "poi-detail" && audioEntryAction && qrCode ? (
          <PoiDetailScreen
            audioEntryAction={audioEntryAction}
            languageCode={destination.languageCode}
            onScanAnother={() => {
              setDetail(null);
              setDestination(null);
              setAudioEntryAction(null);
              setQrCode(null);
              setIsQrScannerOpen(true);
            }}
            poi={detail}
            qrCode={qrCode}
          />
        ) : (
          <View style={styles.content}>
          <Text accessibilityRole="header" style={styles.title}>
            AudioTour
          </Text>
          <Text style={styles.subtitle}>Khám phá hành trình theo cách của bạn</Text>
          <View style={styles.qrButton}>
            <Button title="Quét mã QR" onPress={() => setIsQrScannerOpen(true)} />
          </View>
          {isLoading && <ActivityIndicator color="#15803D" style={styles.loading} />}
          {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
          {detail && destination && (
            <View style={styles.detailCard}>
              <Text style={styles.detailType}>{destination.screen === "poi-detail" ? "Địa điểm" : "Tour"}</Text>
              <Text accessibilityRole="header" style={styles.detailTitle}>{detail.name}</Text>
              {detail.description && <Text style={styles.detailDescription}>{detail.description}</Text>}
              <Text style={styles.languageLabel}>Ngôn ngữ: {destination.languageCode}</Text>
            </View>
          )}
          </View>
        )}
        <Modal animationType="slide" onRequestClose={() => setIsQrScannerOpen(false)} visible={isQrScannerOpen}>
          <SafeAreaView style={styles.modalScreen} edges={["top", "right", "bottom", "left"]}>
            <QrScanner onClose={() => setIsQrScannerOpen(false)} onCodeScanned={handleQrCodeScanned} />
          </SafeAreaView>
        </Modal>
        <Modal animationType="slide" onRequestClose={() => setPendingQrVisit(null)} visible={Boolean(pendingQrVisit)}>
          <SafeAreaView style={styles.languageScreen} edges={["top", "right", "bottom", "left"]}>
            <Text accessibilityRole="header" style={styles.languageTitle}>Chọn ngôn ngữ</Text>
            <Text style={styles.languageDescription}>Ngôn ngữ thiết bị chưa có trong nội dung này.</Text>
            {pendingQrVisit?.languages.map((language) => (
              <Pressable
                accessibilityRole="button"
                key={language.code}
                onPress={() => void openResolvedTarget(pendingQrVisit.target, language.code, pendingQrVisit.code)}
                style={styles.languageOption}
              >
                <Text style={styles.languageName}>{language.nativeName || language.name}</Text>
                <Text style={styles.languageCode}>{language.code}</Text>
              </Pressable>
            ))}
            <View style={styles.closeLanguageButton}>
              <Button color="#456253" title="Đóng" onPress={() => setPendingQrVisit(null)} />
            </View>
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
  loading: {
    marginTop: 20,
  },
  error: {
    color: "#B42318",
    marginTop: 20,
    textAlign: "center",
  },
  detailCard: {
    alignSelf: "stretch",
    backgroundColor: "#FFFFFF",
    borderColor: "#C8EAD8",
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 28,
    padding: 20,
  },
  detailType: {
    color: "#15803D",
    fontSize: 14,
    fontWeight: "600",
  },
  detailTitle: {
    color: "#173B2A",
    fontSize: 22,
    fontWeight: "700",
    marginTop: 6,
  },
  detailDescription: {
    color: "#456253",
    lineHeight: 22,
    marginTop: 10,
  },
  languageLabel: {
    color: "#456253",
    fontSize: 13,
    marginTop: 14,
  },
  modalScreen: {
    backgroundColor: "#F7FDF9",
    flex: 1,
  },
  languageScreen: {
    backgroundColor: "#F7FDF9",
    flex: 1,
    padding: 24,
  },
  languageTitle: {
    color: "#173B2A",
    fontSize: 28,
    fontWeight: "700",
  },
  languageDescription: {
    color: "#456253",
    lineHeight: 22,
    marginBottom: 20,
    marginTop: 10,
  },
  languageOption: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#C8EAD8",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
    padding: 16,
  },
  languageName: {
    color: "#173B2A",
    fontSize: 17,
    fontWeight: "600",
  },
  languageCode: {
    color: "#456253",
  },
  closeLanguageButton: {
    marginTop: 24,
  },
});
