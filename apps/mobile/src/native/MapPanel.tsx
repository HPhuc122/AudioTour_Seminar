import { useTranslator, type Translator } from "./i18n"
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, AppState, Button, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import * as Location from "expo-location";
import { audioTourApi, type MapPoint, type MapRoute, type PublicPoiSummary, type PublicTargetDetail, type TravelMode } from "./api";
import { DetailAudio } from "./DetailAudio";
import { MAP_HTML } from "./mapHtml";
export type MapTarget = {
    kind: "poi" | "tour";
    detail: PublicTargetDetail;
};
type Endpoint = MapPoint & {
    label: string;
};
type Props = {
    pois: PublicPoiSummary[];
    languageCode: string;
    target: MapTarget | null;
    onScan: () => void;
    onDetail: (id: number) => void;
};
const validPoint = (point: {
    latitude?: number;
    longitude?: number;
}): point is MapPoint => Number.isFinite(point.latitude) && Number.isFinite(point.longitude) && Math.abs(point.latitude!) <= 90 && Math.abs(point.longitude!) <= 180;
const distance = (meters: number) => meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
const duration = (seconds: number, t: Translator) => { const mins = Math.max(1, Math.ceil(seconds / 60)); return mins < 60 ? t("{0} phút", mins) : t("{0} giờ {1} phút", Math.floor(mins / 60), mins % 60); };
export function MapPanel({ pois, languageCode, target, onScan, onDetail }: Props) {
  const t = useTranslator()

    const web = useRef<WebView>(null);
    const mounted = useRef(true);
    const routeRequest = useRef(0);
    const detailRequest = useRef(0);
    const locationRequest = useRef(0);
    const subscription = useRef<Location.LocationSubscription | null>(null);
    const [ready, setReady] = useState(false);
    const [webKey, setWebKey] = useState(0);
    const [mapError, setMapError] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [locationError, setLocationError] = useState<string | null>(null);
    const [location, setLocation] = useState<(MapPoint & {
        accuracy: number;
    }) | null>(null);
    const [locating, setLocating] = useState(false);
    const [mode, setMode] = useState<TravelMode>("walking");
    const [from, setFrom] = useState<Endpoint | null>(null);
    const [to, setTo] = useState<Endpoint | null>(null);
    const [picker, setPicker] = useState<"from" | "to" | null>(null);
    const [pinMode, setPinMode] = useState<"from" | "to" | null>(null);
    const [route, setRoute] = useState<MapRoute | null>(null);
    const [routing, setRouting] = useState(false);
    const [tour, setTour] = useState<PublicTargetDetail | null>(target?.kind === "tour" ? target.detail : null);
    const [selected, setSelected] = useState<PublicTargetDetail | null>(null);
    const [loadingPoi, setLoadingPoi] = useState(false);
    const [focus, setFocus] = useState<MapPoint[]>(target?.kind === "poi" && validPoint(target.detail) ? [target.detail] : []);
    const [fitKey, setFitKey] = useState(0);
    const mapPois = useMemo(() => pois.filter((poi): poi is PublicPoiSummary & MapPoint => validPoint(poi)), [pois]);
    function clearRoute() { routeRequest.current++; setRoute(null); setRouting(false); setError(null); }
    function choose(which: "from" | "to", point: Endpoint) {
        clearRoute();
        setTour(null);
        setPicker(null);
        setPinMode(null);
        if (which === "from")
            setFrom(point);
        else
            setTo(point);
        setFocus([point]);
        setFitKey((v) => v + 1);
    }
    function chooseSelectedPoi(which: "from" | "to") {
        if (!selected || !validPoint(selected))
            return;
        const other = which === "from" ? "to" : "from";
        const otherPoint = which === "from" ? to : from;
        choose(which, { ...selected, label: selected.name });
        detailRequest.current++;
        setSelected(null);
        if (!otherPoint)
            setPicker(other);
    }
    async function locate(endpoint?: "from" | "to") {
        const request = ++locationRequest.current;
        setLocating(true);
        setLocationError(null);
        try {
            const permission = await Location.requestForegroundPermissionsAsync();
            if (permission.status !== "granted")
                throw new Error(t("Chưa có quyền vị trí. Bạn vẫn có thể chọn POI hoặc ghim; bật quyền trong Cài đặt để dùng vị trí hiện tại."));
            if (!await Location.hasServicesEnabledAsync())
                throw new Error(t("Hãy bật GPS/dịch vụ vị trí trên điện thoại."));
            let timeout: ReturnType<typeof setTimeout> | undefined;
            const result = await Promise.race([
                Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
                new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error(t("GPS chưa xác định được vị trí. Hãy ra nơi thoáng và thử lại."))), 20000); }),
            ]).finally(() => { if (timeout)
                clearTimeout(timeout); });
            if (!mounted.current || request !== locationRequest.current || AppState.currentState !== "active")
                return;
            const point = { latitude: result.coords.latitude, longitude: result.coords.longitude, accuracy: result.coords.accuracy ?? 0 };
            setLocation(point);
            if (endpoint)
                choose(endpoint, { ...point, label: t("Vị trí hiện tại") });
            else {
                setFocus([point]);
                setFitKey((v) => v + 1);
            }
            subscription.current?.remove();
            const watcher = await Location.watchPositionAsync({ accuracy: Location.Accuracy.Balanced, distanceInterval: 10, timeInterval: 10000 }, (next) => {
                if (mounted.current && AppState.currentState === "active")
                    setLocation({ latitude: next.coords.latitude, longitude: next.coords.longitude, accuracy: next.coords.accuracy ?? 0 });
            });
            if (!mounted.current || request !== locationRequest.current || AppState.currentState !== "active")
                watcher.remove();
            else
                subscription.current = watcher;
        }
        catch (reason) {
            if (mounted.current && request === locationRequest.current)
                setLocationError(reason instanceof Error ? reason.message : t("Không lấy được vị trí. Vui lòng thử lại."));
        }
        finally {
            if (mounted.current && request === locationRequest.current)
                setLocating(false);
        }
    }
    useEffect(() => {
        mounted.current = true;
        const listener = AppState.addEventListener("change", (state) => {
            if (state === "background") {
                locationRequest.current++;
                subscription.current?.remove();
                subscription.current = null;
                setLocating(false);
            }
        });
        return () => { mounted.current = false; routeRequest.current++; detailRequest.current++; locationRequest.current++; subscription.current?.remove(); listener.remove(); };
    }, []);
    async function calculate(tourDetail = tour, travelMode = mode) {
        const request = ++routeRequest.current;
        setRoute(null);
        setError(null);
        setRouting(true);
        setFocus([]);
        try {
            if (!tourDetail && (!from || !to))
                throw new Error(t("Chọn điểm đi và điểm đến trước khi tìm đường."));
            const result = tourDetail ? await audioTourApi.getTourRoute(tourDetail.id, travelMode) : await audioTourApi.getDirections([from!, to!], travelMode);
            if (mounted.current && request === routeRequest.current) {
                setRoute(result);
                setFitKey((v) => v + 1);
            }
        }
        catch (reason) {
            if (mounted.current && request === routeRequest.current)
                setError(reason instanceof Error ? reason.message : t("Không tìm được đường."));
        }
        finally {
            if (mounted.current && request === routeRequest.current)
                setRouting(false);
        }
    }
    useEffect(() => { if (tour)
        void calculate(tour, mode); }, [tour?.id, mode]);
    useEffect(() => { if (!ready && !mapError) {
        const timeout = setTimeout(() => setMapError(t("Tải bản đồ quá lâu. Kiểm tra Internet và thử lại.")), 20000);
        return () => clearTimeout(timeout);
    } }, [ready, mapError, webKey]);
    useEffect(() => {
        if (!ready)
            return;
        const stops = tour?.pois?.filter(validPoint) ?? [];
        const data = { pois: mapPois, from: tour ? stops[0] : from, to: tour ? stops[stops.length - 1] : to, route: route?.latLngs, location, selectedId: selected?.id, focus, fitKey: `${fitKey}:${mapPois.length}` };
        web.current?.injectJavaScript(`window.updateMap&&window.updateMap(${JSON.stringify(data).replace(/</g, "\\u003c")});true;`);
    }, [ready, mapPois, from, to, route, location, selected?.id, focus, fitKey, tour]);
    async function selectPoi(id: number) {
        const poi = mapPois.find((item) => item.id === id);
        if (!poi)
            return;
        if (pinMode) {
            choose(pinMode, { ...poi, label: poi.name });
            return;
        }
        const request = ++detailRequest.current;
        setSelected(null);
        setLoadingPoi(true);
        setError(null);
        try {
            const detail = await audioTourApi.getPoi(id, languageCode);
            if (mounted.current && request === detailRequest.current)
                setSelected(detail);
        }
        catch (reason) {
            if (mounted.current && request === detailRequest.current)
                setError(reason instanceof Error ? reason.message : t("Không tải được POI."));
        }
        finally {
            if (mounted.current && request === detailRequest.current)
                setLoadingPoi(false);
        }
    }
    return <View style={styles.root}>
    <View style={styles.controls}>
      <View style={styles.row}>{(["walking", "driving"] as TravelMode[]).map((value) => <Pressable accessibilityRole="button" accessibilityState={{ selected: mode === value }} key={value} style={[styles.mode, mode === value && styles.active]} onPress={() => { if (mode !== value) {
        clearRoute();
        setMode(value);
    } }}><Text style={styles.modeText}>{value === "walking" ? t("Đi bộ") : t("Ô tô")}</Text></Pressable>)}<Button title={locating ? t("Đang định vị…") : t("Vị trí tôi")} disabled={locating} onPress={() => void locate()}/></View>
      {tour ? <View style={styles.row}><Text style={styles.tourName} numberOfLines={2}>{t("Tour: {0}", tour.name)}</Text><Button title={t("Đổi tuyến")} onPress={() => { clearRoute(); setTour(null); }}/></View> : <View style={styles.row}>
        <Pressable accessibilityRole="button" onPress={() => setPicker("from")} style={styles.endpoint}><Text numberOfLines={1}>A · {from?.label ?? t("Chọn điểm đi")}</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t("Đảo điểm đi và đến")} onPress={() => { clearRoute(); setFrom(to); setTo(from); }} style={styles.swap}><Text>⇄</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => setPicker("to")} style={styles.endpoint}><Text numberOfLines={1}>B · {to?.label ?? t("Chọn điểm đến")}</Text></Pressable>
      </View>}
      <View style={styles.row}><Button title={routing ? t("Đang tìm đường…") : t("Tìm đường")} disabled={routing || (!tour && (!from || !to))} onPress={() => void calculate()}/>{route && <Text style={styles.summary}>{distance(route.routeDistanceMeters)} · {duration(route.durationSeconds, t)}</Text>}</View>
      {route && <Text style={styles.note}>{t("Thời gian ước tính, chưa tính giao thông trực tiếp. © OpenRouteService / HeiGIT")}</Text>}
      {pinMode && <View style={styles.row}><Text style={styles.hint}>{t("Chạm POI hoặc bản đồ để chọn {0}.", pinMode === "from" ? t("điểm đi A") : t("điểm đến B"))}</Text><Button title={t("Hủy")} onPress={() => setPinMode(null)}/></View>}
      {locationError && <View><Text accessibilityRole="alert" style={styles.error}>{t(locationError)}</Text><Button title={t("Mở cài đặt quyền")} onPress={() => void Linking.openSettings()}/></View>}
      {error && <Text accessibilityRole="alert" style={styles.error}>{t(error)}</Text>}
    </View>
    <View style={styles.canvas}>
      <WebView ref={web} key={webKey} source={{ html: MAP_HTML, baseUrl: "https://audiotour.local/" }} originWhitelist={["*"]} applicationNameForUserAgent="AudioTour/1.0" javaScriptEnabled geolocationEnabled={false} allowFileAccess={false} mixedContentMode="never" setSupportMultipleWindows={false} style={styles.web} onShouldStartLoadWithRequest={(request) => { if (request.url === "about:blank" || request.url.startsWith("https://audiotour.local/"))
        return true; if (request.url.startsWith("https://www.openstreetmap.org/copyright"))
        void Linking.openURL(request.url); return false; }} onError={() => setMapError(t("Không tải được bản đồ. Vui lòng thử lại."))} onMessage={(event) => { try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === "ready") {
            setReady(true);
            setMapError(null);
        }
        else if (data.type === "error")
            setMapError(t("Không tải được bản đồ. Kiểm tra Internet và thử lại."));
        else if (data.type === "tileError")
            setMapError(t("Không tải được nền bản đồ. Kiểm tra Internet và thử lại."));
        else if (data.type === "tileLoaded")
            setMapError(null);
        else if (data.type === "poi" && Number.isInteger(data.id))
            void selectPoi(data.id);
        else if (data.type === "pin" && validPoint(data) && pinMode)
            choose(pinMode, { latitude: data.latitude, longitude: data.longitude, label: `${data.latitude.toFixed(4)}, ${data.longitude.toFixed(4)}` });
    }
    catch { /* Ignore invalid bridge messages. */ } }}/>
      {!ready && !mapError && <ActivityIndicator style={styles.mapLoading} color="#15803D"/>}
      {mapError && <View style={styles.mapNotice}><Text style={styles.error}>{t(mapError)}</Text><Button title={t("Tải lại bản đồ")} onPress={() => { setReady(false); setMapError(null); setWebKey((v) => v + 1); }}/></View>}
      {!mapPois.length && ready && <Text style={styles.empty}>{t("Chưa có POI có tọa độ.")}</Text>}
    </View>
    {loadingPoi && <ActivityIndicator color="#15803D"/>}
    {selected && <ScrollView style={styles.poiSheet} contentContainerStyle={styles.sheetContent}>
      <View style={styles.row}><Text style={styles.tourName}>{selected.name}</Text><Button title={t("Đóng")} onPress={() => { detailRequest.current++; setSelected(null); }}/></View>
      <Button title={t("Chi tiết")} onPress={() => onDetail(selected.id)}/>
      <View style={styles.row}>
        <View style={styles.poiAction}><Button title={t("Điểm bắt đầu")} disabled={!validPoint(selected)} onPress={() => chooseSelectedPoi("from")}/></View>
        <View style={styles.poiAction}><Button title={t("Điểm đến")} disabled={!validPoint(selected)} onPress={() => chooseSelectedPoi("to")}/></View>
      </View>
      <DetailAudio key={`${selected.id}:${languageCode}`} detail={selected} kind="poi" languageCode={languageCode} autoStart onScan={onScan}/>
    </ScrollView>}
    <Modal visible={picker !== null} animationType="slide" onRequestClose={() => setPicker(null)}><SafeAreaView style={styles.modal}>
      <Text style={styles.title}>{picker === "from" ? t("Chọn điểm đi A") : t("Chọn điểm đến B")}</Text>
      <Button title={t("Đóng")} onPress={() => setPicker(null)}/>
      <Button title={t("Vị trí hiện tại")} disabled={locating} onPress={() => { const which = picker; setPicker(null); if (which)
        void locate(which); }}/>
      <Button title={t("Chọn POI / ghim trên bản đồ")} onPress={() => { detailRequest.current++; setLoadingPoi(false); setPinMode(picker); setPicker(null); setSelected(null); }}/>
      <ScrollView>{mapPois.map((poi) => <Pressable key={poi.id} accessibilityRole="button" style={styles.poiOption} onPress={() => { if (picker)
        choose(picker, { ...poi, label: poi.name }); }}><Text style={styles.optionText}>{poi.name}</Text></Pressable>)}</ScrollView>
    </SafeAreaView></Modal>
  </View>;
}
const styles = StyleSheet.create({
    poiAction: { flex: 1 },
    root: { flex: 1, marginTop: 12, minHeight: 280, backgroundColor: "white", borderRadius: 16, overflow: "hidden" }, controls: { padding: 8, gap: 5 }, row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 }, mode: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, backgroundColor: "#edf7f1" }, active: { backgroundColor: "#bbf7d0" }, modeText: { color: "#173b2a", fontWeight: "700" }, endpoint: { flex: 1, backgroundColor: "#f0f5f2", borderRadius: 8, padding: 10 }, swap: { padding: 10 }, tourName: { flex: 1, color: "#173b2a", fontWeight: "700", fontSize: 16 }, summary: { color: "#173b2a", fontSize: 16, fontWeight: "700", flex: 1 }, note: { fontSize: 10, color: "#62766b" }, hint: { flex: 1, color: "#173b2a", fontSize: 12 }, error: { color: "#b42318", fontSize: 12, lineHeight: 17 }, canvas: { flex: 1, minHeight: 160 }, web: { flex: 1, backgroundColor: "#e8f0e9" }, mapLoading: { position: "absolute", alignSelf: "center", top: "45%" }, mapNotice: { position: "absolute", top: 8, left: 8, right: 8, backgroundColor: "white", padding: 10, borderRadius: 8 }, empty: { position: "absolute", top: 8, alignSelf: "center", backgroundColor: "white", padding: 8 }, poiSheet: { maxHeight: 230, borderTopWidth: 1, borderColor: "#dce8e0" }, sheetContent: { padding: 10 }, modal: { flex: 1, padding: 20, backgroundColor: "#f7fdf9" }, title: { fontSize: 22, fontWeight: "700", color: "#173b2a", marginBottom: 16 }, poiOption: { padding: 16, borderBottomWidth: 1, borderColor: "#dce8e0" }, optionText: { fontSize: 16, color: "#173b2a" },
});
