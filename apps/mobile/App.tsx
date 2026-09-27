import { StatusBar } from "expo-status-bar"

import { useEffect, useState } from "react"
import {
  ActivityIndicator,
  Button,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native"

import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context"

import { CatalogDetailScreen } from "./src/native/CatalogDetailScreen"
import { CatalogListScreen } from "./src/native/CatalogListScreen"
import { DashboardScreen } from "./src/native/DashboardScreen"
import { MapPanel, type MapTarget } from "./src/native/MapPanel"
import { QrScanner } from "./src/native/QrScanner"
import { Sidebar } from "./src/native/Sidebar"
import type { AppSection } from "./src/native/Sidebar"
import { audioTourApi } from "./src/native/api"
import type {
  ApiLanguage,
  ApiQrTarget,
  PublicPoiSummary,
  PublicTargetDetail,
  PublicTourSummary,
} from "./src/native/api"
import { resolveDeviceLanguage } from "./src/native/languageResolution"
import {
  clearPaidAccessSession,
  loadPaidAccessSession,
} from "./src/native/paidAccessStore"
import { createQrVisit } from "./src/native/qrFlow"

import type {
  AudioEntryAction,
  PublicDetailDestination,
} from "./src/native/qrFlow"

type PendingQrVisit = {
  code: string

  target: ApiQrTarget

  languages: ApiLanguage[]
}

type CatalogDetailKind = "poi" | "tour"

export default function App() {
  const [activeSection, setActiveSection] = useState<AppSection>("dashboard")
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false)
  const [languages, setLanguages] = useState<ApiLanguage[]>([])
  const [languageCode, setLanguageCode] = useState<string | null>(null)
  const [pendingQrVisit, setPendingQrVisit] = useState<PendingQrVisit | null>(
    null,
  )
  const [pois, setPois] = useState<PublicPoiSummary[]>([])
  const [poiTotal, setPoiTotal] = useState(0)
  const [tours, setTours] = useState<PublicTourSummary[]>([])
  const [paidAccessRemainingSeconds, setPaidAccessRemainingSeconds] =
    useState<number | null>(null)
  const [destination, setDestination] =
    useState<PublicDetailDestination | null>(null)
  const [detail, setDetail] = useState<PublicTargetDetail | null>(null)
  const [catalogDetailKind, setCatalogDetailKind] =
    useState<CatalogDetailKind | null>(null)
  const [audioEntryAction, setAudioEntryAction] =
    useState<AudioEntryAction | null>(null)

  const [qrCode, setQrCode] = useState<string | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [mapTarget, setMapTarget] = useState<MapTarget | null>(null)
  const [detailFromMap, setDetailFromMap] = useState(false)

  useEffect(() => {
    void (async () => {
      try {
        const availableLanguages = await audioTourApi.getLanguages()
        setLanguages(availableLanguages)
        setLanguageCode(
          resolveDeviceLanguage(
            availableLanguages.map((language) => language.code),
          ),
        )
      } catch (reason) {
        setError(
          reason instanceof Error ? reason.message : "Không thể tải ngôn ngữ.",
        )
      }
    })()
  }, [])

  useEffect(() => {
    if (languageCode) void loadCatalog(languageCode)
  }, [languageCode])

  const loadCatalog = async (selectedLanguage: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const [poiPage, tourItems, paidSession] = await Promise.all([
        audioTourApi.listPois(selectedLanguage),
        audioTourApi.listTours(selectedLanguage),
        loadPaidAccessSession(),
      ])
      setPois(poiPage.items)
      setPoiTotal(poiPage.total)
      setTours(tourItems)
      if (paidSession) {
        const validation = await audioTourApi.validateGuestAccess(
          paidSession.accessToken,
        )
        if (validation.isValid)
          setPaidAccessRemainingSeconds(validation.remainingSeconds)
        else {
          await clearPaidAccessSession()
          setPaidAccessRemainingSeconds(null)
        }
      } else setPaidAccessRemainingSeconds(null)
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Không thể tải nội dung công khai.",
      )
    } finally {
      setIsLoading(false)
    }
  }

  const clearDetail = () => {
    setDetail(null)
    setDestination(null)
    setCatalogDetailKind(null)
    setAudioEntryAction(null)
    setQrCode(null)
  }

  const openSection = (section: AppSection) => {
    clearDetail()
    setMapTarget(null)
    setDetailFromMap(false)
    setActiveSection(section)
    setIsSidebarOpen(false)
  }

  const openCatalogDetail = async (kind: CatalogDetailKind, id: number, fromMap = false) => {
    if (!languageCode) return
    setIsLoading(true)
    setError(null)
    try {
      const target =
        kind === "poi"
          ? await audioTourApi.getPoi(id, languageCode)
          : await audioTourApi.getTour(id, languageCode)
      setDetail(target)
      setDetailFromMap(fromMap)
      setCatalogDetailKind(kind)
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Không thể mở chi tiết.",
      )
    } finally {
      setIsLoading(false)
    }
  }

  const openResolvedTarget = async (
    target: ApiQrTarget,
    languageCode: string,
    scannedQrCode: string,
  ) => {
    setIsLoading(true)

    setError(null)

    try {
      const visit = createQrVisit(target, languageCode)

      const targetDetail =
        visit.destination.screen === "poi-detail"
          ? await audioTourApi.getPoi(visit.destination.id, languageCode)
          : await audioTourApi.getTour(visit.destination.id, languageCode)

      setDestination(visit.destination)

      setAudioEntryAction(visit.audioEntryAction)

      setQrCode(scannedQrCode)
      setDetail(targetDetail)
      setCatalogDetailKind(null)
      setPendingQrVisit(null)
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Không thể mở nội dung QR.",
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleQrCodeScanned = async (code: string) => {
    setIsQrScannerOpen(false)
    setIsLoading(true)
    setError(null)
    clearDetail()

    try {
      const [target, availableLanguages] = await Promise.all([
        audioTourApi.resolveQr(code),
        audioTourApi.getLanguages(),
      ])
      const selectedLanguage =
        languageCode ??
        resolveDeviceLanguage(
          availableLanguages.map((language) => language.code),
        )

      if (selectedLanguage) {
        await openResolvedTarget(target, selectedLanguage, code)
      } else {
        setPendingQrVisit({ code, target, languages: availableLanguages })
      }
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Không thể xử lý mã QR.",
      )
    } finally {
      setIsLoading(false)
    }
  }

  const openQr = () => {
    setIsSidebarOpen(false)
    setIsQrScannerOpen(true)
  }

  const showLanguagePicker =
    (!languageCode && languages.length > 0) || Boolean(pendingQrVisit)

  const detailKind =
    catalogDetailKind ?? (destination?.screen === "poi-detail" ? "poi" : "tour")
  const content =
    detail && (catalogDetailKind || destination) ? (
      <CatalogDetailScreen
        key={`${detailKind}:${detail.id}:${destination?.languageCode ?? languageCode}:${qrCode ?? "catalog"}`}
        detail={detail}
        kind={detailKind}
        languageCode={destination?.languageCode ?? languageCode ?? ""}
        qrCode={qrCode ?? undefined}
        autoStart={Boolean(destination)}
        requiresPayment={audioEntryAction === "show-payment"}
        onScan={openQr}
        onMap={() => {
          setMapTarget({ kind: detailKind, detail })
          clearDetail()
          setDetailFromMap(false)
          setActiveSection("dashboard")
        }}
        onBack={() => {
          const previousKind = detailKind
          clearDetail()
          if (detailFromMap) setActiveSection("dashboard")
          else if (previousKind)
            setActiveSection(previousKind === "poi" ? "pois" : "tours")
          setDetailFromMap(false)
        }}
      />
    ) : activeSection === "dashboard" ? (
      <DashboardScreen
        isLoading={isLoading}
        languageCode={languageCode ?? undefined}
        onMenu={() => setIsSidebarOpen(true)}
        paidAccessRemainingSeconds={paidAccessRemainingSeconds}
        poiTotal={poiTotal}
        tourTotal={tours.length}
      >
        {languageCode && <MapPanel pois={pois} languageCode={languageCode} target={mapTarget} onScan={openQr} onDetail={(id) => void openCatalogDetail("poi", id, true)} />}
      </DashboardScreen>
    ) : (
      <CatalogListScreen
        key={activeSection}
        languageCode={languageCode ?? ""}
        isLoading={isLoading}
        kind={activeSection === "pois" ? "poi" : "tour"}
        onMenu={() => setIsSidebarOpen(true)}
        onSelect={(id) =>
          void openCatalogDetail(activeSection === "pois" ? "poi" : "tour", id)
        }
        pois={pois}
        tours={tours}
      />
    )

  return (
    <SafeAreaProvider>
      <SafeAreaView
        style={styles.screen}
        edges={["top", "right", "bottom", "left"]}
      >
        {content}
        {error && !detail && (
          <View style={styles.errorBanner}>
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          </View>
        )}
        <Sidebar
          activeSection={activeSection}
          onClose={() => setIsSidebarOpen(false)}
          onNavigate={openSection}
          onOpenQr={openQr}
          visible={isSidebarOpen}
        />
        <Modal
          animationType="slide"
          onRequestClose={() => setIsQrScannerOpen(false)}
          visible={isQrScannerOpen}
        >
          <SafeAreaView
            style={styles.modalScreen}
            edges={["top", "right", "bottom", "left"]}
          >
            <QrScanner
              onClose={() => setIsQrScannerOpen(false)}
              onCodeScanned={handleQrCodeScanned}
            />
          </SafeAreaView>
        </Modal>
        <Modal
          animationType="slide"
          onRequestClose={() =>
            pendingQrVisit ? setPendingQrVisit(null) : undefined
          }
          visible={showLanguagePicker}
        >
          <SafeAreaView
            style={styles.languageScreen}
            edges={["top", "right", "bottom", "left"]}
          >
            <Text accessibilityRole="header" style={styles.languageTitle}>
              Chọn ngôn ngữ
            </Text>
            <Text style={styles.languageDescription}>
              Ngôn ngữ thiết bị chưa có trong nội dung này.
            </Text>
            {(pendingQrVisit?.languages ?? languages).map((language) => (
              <Pressable
                accessibilityRole="button"
                key={language.code}
                onPress={() => {
                  setLanguageCode(language.code)
                  if (pendingQrVisit)
                    void openResolvedTarget(
                      pendingQrVisit.target,
                      language.code,
                      pendingQrVisit.code,
                    )
                }}
                style={styles.languageOption}
              >
                <Text style={styles.languageName}>
                  {language.nativeName || language.name}
                </Text>
                <Text style={styles.languageCode}>{language.code}</Text>
              </Pressable>
            ))}
            {pendingQrVisit && (
              <View style={styles.closeLanguageButton}>
                <Button
                  color="#456253"
                  title="Đóng"
                  onPress={() => setPendingQrVisit(null)}
                />
              </View>
            )}
          </SafeAreaView>
        </Modal>
        <StatusBar style="dark" />
      </SafeAreaView>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,

    backgroundColor: "#F7FDF9",
  },

  errorBanner: { bottom: 18, left: 18, position: "absolute", right: 18 },
  error: {
    backgroundColor: "#FEE4E2",
    borderRadius: 12,
    color: "#B42318",
    padding: 12,
    textAlign: "center",
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
})
