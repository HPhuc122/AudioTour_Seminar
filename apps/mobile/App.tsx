import { appendPois, hasMorePois } from "./src/native/poiPagination"
import { UiLanguageContext, createTranslator } from "./src/native/i18n"
import { StatusBar } from "expo-status-bar"

import { useEffect, useRef, useState } from "react"
import {
  ActivityIndicator,
  Button,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native"

import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context"

import { CatalogDetailScreen } from "./src/native/CatalogDetailScreen"
import { CatalogListScreen } from "./src/native/CatalogListScreen"
import { HomeScreen } from "./src/native/HomeScreen"
import { BottomNavigation, type Tab } from "./src/native/BottomNavigation"
import { TicketScreen } from "./src/native/TicketScreen"
import { MapPanel, type MapTarget } from "./src/native/MapPanel"
import { QrScanner } from "./src/native/QrScanner"
import { audioTourApi } from "./src/native/api"
import type {
  ApiLanguage,
  ApiQrTarget,
  PublicPoiSummary,
  PublicPoiList,
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
  const [activeSection, setActiveSection] = useState<"dashboard" | "pois" | "tours">("dashboard")
  const [activeTab, setActiveTab] = useState<Tab>("home")
  const detailOrigin = useRef<"home" | "map" | "list">("list")
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false)
  const [languages, setLanguages] = useState<ApiLanguage[]>([])
  const languageRequest = useRef(0)
  const errorSource = useRef<"languages" | "catalog" | "detail" | null>(null)
  const retryAction = useRef<(() => Promise<void>) | null>(null)
  const catalogRequest = useRef(0)
  const detailRequest = useRef(0)
  const [isLanguagePickerOpen, setIsLanguagePickerOpen] = useState(false)
  const [languagePickerError, setLanguagePickerError] = useState<string | null>(null)
  const [languageCode, setLanguageCode] = useState<string | null>(null)
  const t = createTranslator(languageCode)
  const [pendingQrVisit, setPendingQrVisit] = useState<PendingQrVisit | null>(
    null,
  )
  const [pois, setPois] = useState<PublicPoiSummary[]>([])
  const [poiTotal, setPoiTotal] = useState(0)
  const [poiPage, setPoiPage] = useState<PublicPoiList | null>(null)
  const [loadingMorePois, setLoadingMorePois] = useState(false)
  const [morePoisError, setMorePoisError] = useState<string | null>(null)
  const morePoisBusy = useRef(false)
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
  const [loadingLanguages, setLoadingLanguages] = useState(false)
  const [loadingCatalog, setLoadingCatalog] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const isLoading = loadingLanguages || loadingCatalog || loadingDetail
  const [mapTarget, setMapTarget] = useState<MapTarget | null>(null)
  const [detailFromMap, setDetailFromMap] = useState(false)

  const loadLanguages = async () => {
    const request = ++languageRequest.current
    setLoadingLanguages(true)
    setError(null)
    retryAction.current = null
    try {
      const availableLanguages = await audioTourApi.getLanguages()
      if (request !== languageRequest.current) return
      if (!availableLanguages.length) throw new Error("Chưa có ngôn ngữ khả dụng. Vui lòng thử lại sau.")
      setLanguages(availableLanguages)
      setLanguageCode(resolveDeviceLanguage(availableLanguages.map((language) => language.code)))
    } catch (reason) {
      if (request !== languageRequest.current) return
      errorSource.current = "languages"
      retryAction.current = loadLanguages
      setError(reason instanceof Error ? reason.message : "Không thể tải ngôn ngữ.")
    } finally {
      if (request === languageRequest.current) setLoadingLanguages(false)
    }
  }
  useEffect(() => {
    void loadLanguages()
    return () => { languageRequest.current++; catalogRequest.current++; detailRequest.current++ }
  }, [])

  useEffect(() => {
    if (languageCode) void loadCatalog(languageCode)
  }, [languageCode])

  const loadCatalog = async (selectedLanguage: string) => {
    const request = ++catalogRequest.current
    morePoisBusy.current = false
    setLoadingMorePois(false)
    setMorePoisError(null)
    setLoadingCatalog(true)
    setError(null)
    try {
      const [poiPage, tourItems, paidSession] = await Promise.all([
        audioTourApi.listPois(selectedLanguage),
        audioTourApi.listTours(selectedLanguage),
        loadPaidAccessSession(),
      ])
      if (request !== catalogRequest.current) return
      setPois(poiPage.items)
      setPoiPage(poiPage)
      setPoiTotal(poiPage.total)
      setTours(tourItems)
      if (paidSession) {
        const validation = await audioTourApi.validateGuestAccess(
          paidSession.accessToken,
        )
        if (request !== catalogRequest.current) return
        if (validation.isValid)
          setPaidAccessRemainingSeconds(validation.remainingSeconds)
        else {
          await clearPaidAccessSession()
          if (request !== catalogRequest.current) return
          setPaidAccessRemainingSeconds(null)
        }
      } else setPaidAccessRemainingSeconds(null)
    } catch (reason) {
      if (request !== catalogRequest.current) return
      errorSource.current = "catalog"
      retryAction.current = () => loadCatalog(selectedLanguage)
      setError(
        reason instanceof Error
          ? reason.message
          : t("Không thể tải nội dung công khai."),
      )
    } finally {
      if (request === catalogRequest.current) setLoadingCatalog(false)
    }
  }

  const loadMorePois = async () => {
    if (!languageCode || !poiPage || !hasMorePois(poiPage) || loadingCatalog || morePoisBusy.current) return
    const request = catalogRequest.current
    morePoisBusy.current = true
    setLoadingMorePois(true)
    setMorePoisError(null)
    try {
      const next = await audioTourApi.listPois(languageCode, "", poiPage.page + 1)
      if (request !== catalogRequest.current) return
      setPois((current) => appendPois(current, next.items))
      setPoiPage(next)
      setPoiTotal(next.total)
    } catch (reason) {
      if (request === catalogRequest.current)
        setMorePoisError(reason instanceof Error ? reason.message : "Không thể tải nội dung công khai.")
    } finally {
      if (request === catalogRequest.current) {
        morePoisBusy.current = false
        setLoadingMorePois(false)
      }
    }
  }

  const clearDetail = () => {
    detailRequest.current++
    setLoadingDetail(false)
    if (errorSource.current === "detail") {
      retryAction.current = null
      setError(null)
      errorSource.current = null
    }
    setDetail(null)
    setDestination(null)
    setCatalogDetailKind(null)
    setAudioEntryAction(null)
    setQrCode(null)
  }

  const openSection = (section: "dashboard" | "pois" | "tours") => {
    clearDetail()
    setMapTarget(null)
    setDetailFromMap(false)
    setActiveSection(section)
  }

  const openTab = (tab: Tab) => {
    openSection(tab === "search" ? "pois" : tab === "tour" ? "tours" : "dashboard")
    setActiveTab(tab)
  }

  const openCatalogDetail = async (kind: CatalogDetailKind, id: number, fromMap = false) => {
    if (!languageCode) return
    const request = ++detailRequest.current
    setLoadingDetail(true)
    setError(null)
    try {
      const target =
        kind === "poi"
          ? await audioTourApi.getPoi(id, languageCode)
          : await audioTourApi.getTour(id, languageCode)
      if (request !== detailRequest.current) return
      setDetail(target)
      setDetailFromMap(fromMap)
      setCatalogDetailKind(kind)
    } catch (reason) {
      if (request !== detailRequest.current) return
      errorSource.current = "detail"
      retryAction.current = () => openCatalogDetail(kind, id, fromMap)
      setError(
        reason instanceof Error ? reason.message : t("Không thể mở chi tiết."),
      )
    } finally {
      if (request === detailRequest.current) setLoadingDetail(false)
    }
  }

  const openResolvedTarget = async (
    target: ApiQrTarget,
    languageCode: string,
    scannedQrCode: string,
  ) => {
    const request = ++detailRequest.current
    setLoadingDetail(true)

    setError(null)

    try {
      const visit = createQrVisit(target, languageCode)

      const targetDetail =
        visit.destination.screen === "poi-detail"
          ? await audioTourApi.getPoi(visit.destination.id, languageCode)
          : await audioTourApi.getTour(visit.destination.id, languageCode)

      if (request !== detailRequest.current) return
      setDestination(visit.destination)

      setAudioEntryAction(visit.audioEntryAction)

      setQrCode(scannedQrCode)
      setDetail(targetDetail)
      setCatalogDetailKind(null)
      setPendingQrVisit(null)
    } catch (reason) {
      if (request !== detailRequest.current) return
      errorSource.current = "detail"
      retryAction.current = () => openResolvedTarget(target, languageCode, scannedQrCode)
      setError(
        reason instanceof Error ? reason.message : t("Không thể mở nội dung QR."),
      )
    } finally {
      if (request === detailRequest.current) setLoadingDetail(false)
    }
  }

  const handleQrCodeScanned = async (code: string) => {
    detailOrigin.current = activeTab === "map" ? "map" : activeTab === "home" && activeSection === "dashboard" ? "home" : "list"
    setIsQrScannerOpen(false)
    clearDetail()
    setLoadingDetail(true)
    setError(null)
    const request = detailRequest.current

    try {
      const [target, availableLanguages] = await Promise.all([
        audioTourApi.resolveQr(code),
        audioTourApi.getLanguages(),
      ])
      if (request !== detailRequest.current) return
      const selectedLanguage = languageCode && availableLanguages.some((language) => language.code === languageCode)
        ? languageCode
        : resolveDeviceLanguage(availableLanguages.map((language) => language.code))

      if (selectedLanguage) {
        await openResolvedTarget(target, selectedLanguage, code)
      } else {
        setPendingQrVisit({ code, target, languages: availableLanguages })
      }
    } catch (reason) {
      if (request !== detailRequest.current) return
      errorSource.current = "detail"
      retryAction.current = () => handleQrCodeScanned(code)
      setError(
        reason instanceof Error ? reason.message : t("Không thể xử lý mã QR."),
      )
    } finally {
      if (request === detailRequest.current) setLoadingDetail(false)
    }
  }

  const openQr = () => {
    setIsQrScannerOpen(true)
  }

  const chooseLanguage = (code: string) => {
    const pending = pendingQrVisit
    setIsLanguagePickerOpen(false)
    setLanguagePickerError(null)
    setPendingQrVisit(null)
    if (code !== languageCode) {
      catalogRequest.current++
      clearDetail()
      setMapTarget(null)
      setDetailFromMap(false)
      setPois([])
      setTours([])
      setPoiTotal(0)
      setPoiPage(null)
      setMorePoisError(null)
      setLanguageCode(code)
    }
    if (pending) void openResolvedTarget(pending.target, code, pending.code)
  }
  const closeLanguagePicker = () => {
    setIsLanguagePickerOpen(false)
    setPendingQrVisit(null)
    setLanguagePickerError(null)
  }
  const currentLanguage = languages.find((language) => language.code === languageCode)
  const showLanguagePicker =
    isLanguagePickerOpen || (!languageCode && languages.length > 0) || Boolean(pendingQrVisit)

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
          setActiveTab("map")
        }}
        onBack={() => {
          const previousKind = detailKind
          clearDetail()
          if (detailFromMap || detailOrigin.current === "map") { setActiveSection("dashboard"); setActiveTab("map") }
          else if (detailOrigin.current === "home") { setActiveSection("dashboard"); setActiveTab("home") }
          else if (previousKind)
            setActiveSection(previousKind === "poi" ? "pois" : "tours")
          setDetailFromMap(false)
        }}
      />
    ) : activeTab === "ticket" ? (
      <TicketScreen remainingSeconds={paidAccessRemainingSeconds} onScan={openQr} onExplore={() => openTab("search")} />
    ) : activeTab === "map" ? (
      <View style={styles.mapScreen}>
        <View style={styles.mapHeader}><Text style={styles.mapTitle}>{t("Bản đồ khám phá")}</Text></View>
        {languageCode ? <MapPanel key={languageCode} pois={pois} languageCode={languageCode} target={mapTarget} onScan={openQr} onDetail={(id) => { detailOrigin.current = "map"; void openCatalogDetail("poi", id, true) }} /> : <ActivityIndicator color="#058578" />}
      </View>
    ) : activeSection === "dashboard" ? (
      <HomeScreen
        languageCode={languageCode}
        languageLabel={currentLanguage?.nativeName || currentLanguage?.name || languageCode || t("Chưa chọn")}
        loading={isLoading}
        pois={pois}
        tours={tours}
        remainingSeconds={paidAccessRemainingSeconds}
        onLanguage={() => { setLanguagePickerError(null); setIsLanguagePickerOpen(true) }}
        onScan={openQr}
        onPois={() => openTab("search")}
        onTours={() => openTab("tour")}
        onPoi={(id) => { detailOrigin.current = "home"; void openCatalogDetail("poi", id) }}
        onTour={(id) => { detailOrigin.current = "home"; void openCatalogDetail("tour", id) }}
      />
    ) : (
      <CatalogListScreen
        key={`${activeSection}:${languageCode}`}
        languageCode={languageCode ?? ""}
        isLoading={isLoading}
        kind={activeSection === "pois" ? "poi" : "tour"}
        onMenu={() => openTab("home")}
        onSelect={(id) => { detailOrigin.current = "list"; void openCatalogDetail(activeSection === "pois" ? "poi" : "tour", id) }}
        pois={pois}
        tours={tours}
        poiTotal={poiTotal}
        hasMorePois={hasMorePois(poiPage)}
        loadingMorePois={loadingMorePois}
        morePoisError={morePoisError}
        onLoadMorePois={() => void loadMorePois()}
      />
    )

  return (
    <UiLanguageContext.Provider value={languageCode}><SafeAreaProvider>
      <SafeAreaView
        style={styles.screen}
        edges={["top", "right", "bottom", "left"]}
      >
        {content}
        {!detail && <BottomNavigation active={activeTab} onSelect={openTab} onScan={openQr} />}
        {error && !detail && (
          <View style={styles.errorBanner}>
            <Text accessibilityRole="alert" style={styles.error}>
              {t(error)}
            </Text>
            {retryAction.current && <Button title={t("Thử lại")} disabled={isLoading} onPress={() => void retryAction.current?.()} />}
          </View>
        )}
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
          onRequestClose={closeLanguagePicker}
          visible={showLanguagePicker}
        >
          <SafeAreaView
            style={styles.languageScreen}
            edges={["top", "right", "bottom", "left"]}
          >
            <Text accessibilityRole="header" style={styles.languageTitle}>
              {t("Chọn ngôn ngữ")}</Text>
            <Text style={styles.languageDescription}>
              {isLanguagePickerOpen
                ? t("Đổi ngôn ngữ nội dung và audio cho lần sử dụng này. Lần khởi động app sau sẽ dùng ngôn ngữ điện thoại.")
                : t("Ngôn ngữ thiết bị chưa có trong nội dung này. Hãy chọn ngôn ngữ để tiếp tục.")}
            </Text>
            {!languages.length && <View>
              {loadingLanguages ? <ActivityIndicator color="#15803D" /> : <>
                {error && <Text accessibilityRole="alert" style={styles.error}>{t(error)}</Text>}
                <Button title={t("Thử lại")} onPress={() => void loadLanguages()} />
              </>}
            </View>}
            {languagePickerError && <Text accessibilityRole="alert" style={styles.error}>{t(languagePickerError)}</Text>}
            {isLanguagePickerOpen && <Button title={t("Dùng ngôn ngữ điện thoại")} onPress={() => {
              const code = resolveDeviceLanguage(languages.map((language) => language.code))
              if (code) chooseLanguage(code)
              else setLanguagePickerError(t("Ngôn ngữ điện thoại chưa được hỗ trợ. Hãy chọn một ngôn ngữ bên dưới."))
            }} />}
            <ScrollView>
            {(pendingQrVisit?.languages ?? languages).map((language) => (
              <Pressable
                accessibilityRole="button"
                key={language.code}
                accessibilityState={{ selected: language.code === languageCode }}
                onPress={() => chooseLanguage(language.code)}
                style={[styles.languageOption, language.code === languageCode && styles.selectedLanguage]}
              >
                <Text style={styles.languageName}>
                  {language.nativeName || language.name}
                </Text>
                <Text style={styles.languageCode}>{language.code === languageCode ? "✓ " : ""}{language.code}</Text>
              </Pressable>
            ))}
            </ScrollView>
            {(pendingQrVisit || isLanguagePickerOpen) && (
              <View style={styles.closeLanguageButton}>
                <Button
                  color="#456253"
                  title={t("Đóng")}
                  onPress={closeLanguagePicker}
                />
              </View>
            )}
          </SafeAreaView>
        </Modal>
        <StatusBar style="dark" />
      </SafeAreaView>
    </SafeAreaProvider></UiLanguageContext.Provider>
  )
}

const styles = StyleSheet.create({
  mapScreen: { flex: 1, backgroundColor: "#F5FAFA" },
  mapHeader: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 8 },
  mapTitle: { color: "#0F2124", fontSize: 23, fontWeight: "800" },
  selectedLanguage: { borderColor: "#15803D", backgroundColor: "#DCFCE7" },
  screen: {
    flex: 1,

    backgroundColor: "#F7FDF9",
  },

  errorBanner: { bottom: 104, left: 18, position: "absolute", right: 18, zIndex: 2 },
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
