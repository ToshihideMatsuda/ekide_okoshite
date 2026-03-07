import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Modal,
  AppState,
  ActivityIndicator,
  FlatList,
  Dimensions,
  Platform,
  Animated,
  Easing,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import Slider from '@react-native-community/slider';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSessionStore } from '../../src/store/sessionStore';
import { useMyRouteStore } from '../../src/store/myRouteStore';
import RouteMapView from '../../src/components/RouteMapView';
import { useTranslation } from '../../src/i18n';
import { useGraphStore } from '../../src/store/graphStore';
import { calculateMultipleRoutes, RouteResult } from '../../src/services/routing';
import { SESSION_DURATION_MS, DEFAULT_DETECTION_RADIUS, MIN_DETECTION_RADIUS, MAX_DETECTION_RADIUS, DETECTION_RADIUS_STEP, ENABLE_DEBUG_CONTROLS } from '../../src/constants/config';
import { computeGeofenceStations } from '../../src/services/geofence';
import { detectSubwayStations } from '../../src/services/subwayDetection';
import { useHeadphoneDetection, setHeadphoneConnectionOverride } from '../../src/hooks/useHeadphoneDetection';
import { sendAlarmNotification, playAlarmSound, stopAlarmSound, isAlarmActive } from '../../src/services/notification';
import { LocationModule } from '../../src/modules/LocationModule';
import { SoundType, Station } from '../../src/types';
import { LongPressEvent } from 'react-native-maps';

/** GPS精度が「はっきりとした⚫︎」と見なすしきい値（メートル） */
const GPS_PRECISION_THRESHOLD = 100;

/** 2点間の距離をハーバーサイン公式で計算（メートル） */
function calcDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
    Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatCountdown(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_HEIGHT = 165;

export default function ActiveSessionScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  const { activeSession, cancelSession, updateActiveSessionSettings, updateActiveSessionRoute, arrivedStationName, clearArrival, triggerArrival } = useSessionStore();
  const { saveRoute, routes: savedRoutes } = useMyRouteStore();
  const { graph } = useGraphStore();
  const hasCancelledRef = useRef(false);
  /** arrived 画面へ遷移済みかどうか（activeSession が null になっても home へ飛ばないようにするフラグ） */
  const hasNavigatedToArrivedRef = useRef(false);
  const { isHeadphonesConnected, isChecking } = useHeadphoneDetection();
  const flatListRef = useRef<FlatList<RouteResult>>(null);

  // ─── 経路リスト・インデックス ──────────────────────────────
  const initialRoute: RouteResult = useMemo(() => ({
    route: activeSession?.route ?? [],
    allStations: activeSession?.allStations ?? [],
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  const [routes, setRoutes] = useState<RouteResult[]>([initialRoute]);
  const [routeIndex, setRouteIndex] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showDebugModal, setShowDebugModal] = useState(false);
  const [swipeLocked, setSwipeLocked] = useState(false);

  // 複数経路の非同期読み込み（マイルートからの復元時はスキップ）
  useEffect(() => {
    if (!graph || !activeSession) return;
    if (activeSession.isFromMyRoute) return; // 保存済み経路を1件だけ表示
    setIsLoadingMore(true);
    calculateMultipleRoutes(graph, activeSession.originStation.id, activeSession.destinationStation.id)
      .then(allRoutes => {
        if (allRoutes.length > 1) setRoutes(allRoutes);
      })
      .catch(err => console.warn('[MultiRoute]', err))
      .finally(() => setIsLoadingMore(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 現在表示中の経路
  const currentRoute = routes[routeIndex]?.route ?? activeSession?.route ?? [];
  const currentAllStations = routes[routeIndex]?.allStations ?? activeSession?.allStations ?? [];
  const currentOriginId = activeSession?.originStation.id ?? '';
  const currentDestinationId = activeSession?.destinationStation.id ?? '';

  const subwayInfo = useMemo(
    () => detectSubwayStations(currentRoute),
    [currentRoute]
  );

  const subwayStationIds = useMemo(
    () => new Set(subwayInfo.subwayStations.map(s => s.id)),
    [subwayInfo]
  );

  // ─── 実施中モード用ステート ──────────────────────────────────
  const [localSoundType, setLocalSoundType] = useState<SoundType>(activeSession?.soundType ?? 'vibration');
  const [localRadius, setLocalRadius] = useState(activeSession?.detectionRadius ?? DEFAULT_DETECTION_RADIUS);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isTesting, setIsTesting] = useState(() => isAlarmActive());
  const [debugLowAccuracy, setDebugLowAccuracy] = useState(false);
  const [debugHeadphonesConnected, setDebugHeadphonesConnected] = useState<boolean | null>(null);
  const [debugTapMoveEnabled, setDebugTapMoveEnabled] = useState(false);
  const [debugMockLocation, setDebugMockLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [hasGpsReading, setHasGpsReading] = useState(false);
  const [isAlarmRinging, setIsAlarmRinging] = useState(() => isAlarmActive());
  const [remainingSeconds, setRemainingSeconds] = useState<number>(() => {
    if (!activeSession) return 0;
    const elapsed = Date.now() - new Date(activeSession.startedAt).getTime();
    return Math.max(0, Math.floor((SESSION_DURATION_MS - elapsed) / 1000));
  });

  useEffect(() => {
    if (activeSession) {
      setLocalSoundType(activeSession.soundType);
      setLocalRadius(activeSession.detectionRadius);
    }
  }, [activeSession?.id]);

  useEffect(() => {
    if (!ENABLE_DEBUG_CONTROLS) return;
    if (isChecking) return;
    if (debugHeadphonesConnected === null) {
      setDebugHeadphonesConnected(isHeadphonesConnected);
    }
  }, [isChecking, isHeadphonesConnected, debugHeadphonesConnected]);

  useEffect(() => {
    if (!ENABLE_DEBUG_CONTROLS) {
      setHeadphoneConnectionOverride(null);
      return;
    }
    setHeadphoneConnectionOverride(debugHeadphonesConnected);
    return () => setHeadphoneConnectionOverride(null);
  }, [debugHeadphonesConnected, ENABLE_DEBUG_CONTROLS]);

  const effectiveHeadphonesConnected =
    ENABLE_DEBUG_CONTROLS && debugHeadphonesConnected !== null ? debugHeadphonesConnected : isHeadphonesConnected;
  const isMonitoringDanger = hasGpsReading && (gpsAccuracy == null || gpsAccuracy > GPS_PRECISION_THRESHOLD);
  const debugMoveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debugTriggeredGeofenceIdsRef = useRef<Set<string>>(new Set());
  const dangerPulseAnim = useRef(new Animated.Value(0)).current;
  const prevDangerRef = useRef(false);

  useEffect(() => {
    if (!activeSession) return;
    const startedAt = activeSession.startedAt;
    const timer = setInterval(() => {
      const elapsed = Date.now() - new Date(startedAt).getTime();
      const remaining = Math.max(0, Math.floor((SESSION_DURATION_MS - elapsed) / 1000));
      setRemainingSeconds(remaining);
      if (remaining === 0) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [activeSession?.startedAt]);

  useEffect(() => {
    if (remainingSeconds === 0 && activeSession && !hasCancelledRef.current) {
      const elapsed = Date.now() - new Date(activeSession.startedAt).getTime();
      if (elapsed < SESSION_DURATION_MS) return;
      hasCancelledRef.current = true;
      cancelSession(activeSession.id).then(() => router.replace('/'));
    }
  }, [remainingSeconds, activeSession?.id]);

  useEffect(() => {
    if (!activeSession && !hasNavigatedToArrivedRef.current) {
      router.replace('/');
    }
  }, [activeSession]);

  const geofenceStations = useMemo(
    () => activeSession
      ? computeGeofenceStations(activeSession.route, activeSession.destinationStation.id)
      : [],
    [activeSession?.route, activeSession?.destinationStation.id]
  );

  const getEffectiveLocation = useCallback(async () => {
    const base =
      ENABLE_DEBUG_CONTROLS && debugTapMoveEnabled && debugMockLocation
        ? { latitude: debugMockLocation.latitude, longitude: debugMockLocation.longitude, accuracy: 10 }
        : await LocationModule.getCurrentLocation();
    if (ENABLE_DEBUG_CONTROLS && debugLowAccuracy) {
      return { ...base, accuracy: GPS_PRECISION_THRESHOLD + 400 };
    }
    return base;
  }, [debugTapMoveEnabled, debugMockLocation, debugLowAccuracy]);

  /**
   * 到着済み判定を行い、条件が満たされれば arrived 画面へ遷移する。
   * 以下の 2 条件のいずれかで発火:
   *   1. JS 側から配信された通知 (data.sessionId 一致) が Notification Center に残っている場合
   *   2. iOS で GPS が精確 (accuracy < GPS_PRECISION_THRESHOLD) かつ目的地ジオフェンス内の場合
   */
  const checkForArrival = useCallback(async (session: typeof activeSession) => {
    if (!session || hasNavigatedToArrivedRef.current) return;

    // 条件1: 配信済み通知のチェック
    try {
      const presented = await Notifications.getPresentedNotificationsAsync();
      const alarmNotif = presented.find((n) => {
        if (n.request.content.data?.sessionId !== session.id) return false;
        if (n.request.content.data?.isTest) return false;
        return n.request.content.data?.isDestination === true;
      });
      if (alarmNotif) {
        const name =
          (alarmNotif.request.content.data?.stationName as string | undefined) ??
          session.destinationStation.name;
        hasNavigatedToArrivedRef.current = true;
        clearArrival();
        router.push({ pathname: '/alarm/arrived', params: { stationName: name } });
        return;
      }
    } catch {
      // 通知チェック失敗は無視
    }

    // 条件2: GPS 精度 + ジオフェンス内チェック（iOS のみ）
    if (Platform.OS !== 'ios') return;
    try {
      const loc = await getEffectiveLocation();
      if (loc.accuracy <= GPS_PRECISION_THRESHOLD) {
        const dist = calcDistance(
          loc.latitude,
          loc.longitude,
          session.destinationStation.latitude,
          session.destinationStation.longitude
        );
        if (dist <= session.detectionRadius) {
          hasNavigatedToArrivedRef.current = true;
          clearArrival();
          router.push({
            pathname: '/alarm/arrived',
            params: { stationName: session.destinationStation.name },
          });
        }
      }
    } catch {
      // GPS 取得失敗は無視
    }
  }, [getEffectiveLocation]); // eslint-disable-line react-hooks/exhaustive-deps

  // backgroundTask.ts から triggerArrival が呼ばれたときに arrived 画面へ遷移する
  useEffect(() => {
    if (arrivedStationName && !hasNavigatedToArrivedRef.current) {
      hasNavigatedToArrivedRef.current = true;
      clearArrival();
      router.push({ pathname: '/alarm/arrived', params: { stationName: arrivedStationName } });
    }
  }, [arrivedStationName]); // eslint-disable-line react-hooks/exhaustive-deps

  // マウント時にすでに到着済みか確認する
  useEffect(() => {
    checkForArrival(activeSession);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (nextState) => {
      if (nextState === 'active') {
        await stopAlarmSound();
        setIsTesting(false);
        setIsAlarmRinging(false);
        // フォアグラウンドに戻ったとき到着済みか再確認する
        await checkForArrival(useSessionStore.getState().activeSession);
      }
    });
    return () => sub.remove();
  }, [checkForArrival]);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(async () => {
      await stopAlarmSound();
      setIsTesting(false);
      setIsAlarmRinging(false);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setIsAlarmRinging(isAlarmActive());
    }, 500);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!activeSession) return;
    let alive = true;
    const update = async () => {
      try {
        const loc = await getEffectiveLocation();
        if (!alive) return;
        setGpsAccuracy(loc.accuracy);
        setHasGpsReading(true);
      } catch {
        if (!alive) return;
        setGpsAccuracy(null);
        setHasGpsReading(true);
      }
    };
    update();
    const timer = setInterval(update, 5000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [activeSession?.id, getEffectiveLocation]);

  useEffect(() => {
    setGpsAccuracy(null);
    setHasGpsReading(false);
  }, [activeSession?.id]);

  useEffect(() => {
    if (isChecking) return;
    if (!effectiveHeadphonesConnected && localSoundType === 'alarm') {
      setLocalSoundType('vibration');
      if (activeSession) updateActiveSessionSettings('vibration', localRadius).catch(console.error);
    }
  }, [effectiveHeadphonesConnected, isChecking]);

  useEffect(() => {
    if (!isMonitoringDanger) {
      dangerPulseAnim.stopAnimation();
      dangerPulseAnim.setValue(0);
      return;
    }
    Animated.loop(
      Animated.sequence([
        Animated.timing(dangerPulseAnim, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(dangerPulseAnim, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [isMonitoringDanger, dangerPulseAnim]);

  useEffect(() => {
    if (isMonitoringDanger && !prevDangerRef.current) {
      Alert.alert(t('session.active.safetyDanger'), t('session.active.gpsDangerAlert'));
    }
    prevDangerRef.current = isMonitoringDanger;
  }, [isMonitoringDanger, t]);

  useEffect(() => {
    if (!ENABLE_DEBUG_CONTROLS) return;
    if (!debugTapMoveEnabled) return;
    if (debugMockLocation) return;
    LocationModule.getCurrentLocation()
      .then((loc) => setDebugMockLocation({ latitude: loc.latitude, longitude: loc.longitude }))
      .catch(() => {
        // 取得失敗時は初期位置なしで開始
      });
  }, [debugTapMoveEnabled, debugMockLocation]);

  useEffect(() => {
    return () => {
      if (debugMoveTimerRef.current) clearTimeout(debugMoveTimerRef.current);
    };
  }, []);

  useEffect(() => {
    debugTriggeredGeofenceIdsRef.current = new Set();
  }, [activeSession?.id]);

  const handleSoundTypeChange = async (type: SoundType) => {
    if (type === 'alarm' && !effectiveHeadphonesConnected) return;
    setLocalSoundType(type);
    setIsSavingSettings(true);
    try { await updateActiveSessionSettings(type, localRadius); }
    finally { setIsSavingSettings(false); }
  };

  const handleDebugArrivalPress = () => {
    if (!activeSession) return;
    triggerArrival(activeSession.destinationStation.name);
  };

  const handleStopAlarmPress = async () => {
    await stopAlarmSound();
    setIsTesting(false);
    setIsAlarmRinging(false);
  };

  const emulateGeofenceByLocation = useCallback(async (latitude: number, longitude: number) => {
    if (!activeSession) return;
    const candidates = geofenceStations
      .map((station) => ({
        station,
        distance: calcDistance(latitude, longitude, station.latitude, station.longitude),
      }))
      .filter((entry) => entry.distance <= localRadius)
      .sort((a, b) => a.distance - b.distance);
    if (candidates.length === 0) return;

    const target = candidates[0].station;
    if (debugTriggeredGeofenceIdsRef.current.has(target.id)) return;
    debugTriggeredGeofenceIdsRef.current.add(target.id);

    const simulatedSession = { ...activeSession, soundType: localSoundType, detectionRadius: localRadius };
    await sendAlarmNotification(simulatedSession, target.name, { isDestination: target.id === activeSession.destinationStation.id });
    await playAlarmSound(simulatedSession);
    if (target.id === activeSession.destinationStation.id) {
      triggerArrival(target.name);
    }
  }, [activeSession, geofenceStations, localRadius, localSoundType, triggerArrival]);

  const handleMapLongPress = (event: LongPressEvent) => {
    if (!ENABLE_DEBUG_CONTROLS || !debugTapMoveEnabled) return;
    const { latitude, longitude } = event.nativeEvent.coordinate;
    if (debugMoveTimerRef.current) clearTimeout(debugMoveTimerRef.current);
    debugMoveTimerRef.current = setTimeout(() => {
      setDebugMockLocation({ latitude, longitude });
      emulateGeofenceByLocation(latitude, longitude).catch(console.error);
      debugMoveTimerRef.current = null;
    }, 1000);
  };

  const handleRadiusSlidingComplete = async (value: number) => {
    const rounded = Math.round(value);
    setLocalRadius(rounded);
    setIsSavingSettings(true);
    try { await updateActiveSessionSettings(localSoundType, rounded); }
    finally { setIsSavingSettings(false); }
  };

  const handleTestNotification = async () => {
    if (!activeSession) return;
    if (isTesting) {
      await stopAlarmSound();
      setIsTesting(false);
    } else {
      const testSession = { ...activeSession, soundType: localSoundType };
      await sendAlarmNotification(testSession, activeSession.destinationStation.name, { isTest: true, isDestination: true });
      await playAlarmSound(testSession);
      setIsTesting(true);
    }
  };

  const handleEnd = () => {
    if (!activeSession) return;
    Alert.alert(
      t('session.active.endTitle'),
      t('session.active.endMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('session.active.endConfirm'),
          style: 'destructive',
          onPress: async () => {
            await cancelSession(activeSession.id);
            router.dismissAll();
          },
        },
      ]
    );
  };

  const handleRouteChange = async (newIndex: number) => {
    if (newIndex === routeIndex) return;
    setRouteIndex(newIndex);
    const newRouteResult = routes[newIndex];
    if (newRouteResult && activeSession) {
      await updateActiveSessionRoute(newRouteResult.route, newRouteResult.allStations ?? []);
    }
  };

  const handleEditRoutePress = () => {
    router.push('/session/route-edit');
  };

  const handleSaveRoutePress = () => {
    handleSaveRoute();
  };

  const handleSaveRoute = async () => {
    if (!activeSession) return;

    // 駅列のキー（groupId ?? id を連結）で重複チェック
    const routeKey = (stations: typeof currentRoute) =>
      stations.map(s => s.groupId ?? s.id).join(',');
    const newKey = routeKey(currentRoute);
    const isDuplicate = savedRoutes.some(r => routeKey(r.route) === newKey);
    if (isDuplicate) {
      Alert.alert(t('myRoute.duplicateTitle'), t('myRoute.duplicateMessage'));
      return;
    }

    await saveRoute({
      originStation: activeSession.originStation,
      destinationStation: activeSession.destinationStation,
      route: currentRoute,
      allStations: currentAllStations,
    });
    Alert.alert('', t('session.active.routeSaved'));
  };

  const soundLabels: Record<SoundType, string> = {
    alarm: t('session.new.soundAlarm'),
    music: t('session.new.soundMusic'),
    vibration: t('session.new.soundVibration'),
  };

  if (!activeSession) return null;

  // 経路チップ共通レンダラー
  const renderChips = (route: Station[], originId: string, destId: string, subwayIds: Set<string>) => (
    <View style={styles.routeRow}>
      {route.map((station, stIdx) => {
        const isOrigin = stIdx === 0;
        const isDest = stIdx === route.length - 1;
        return (
          <React.Fragment key={station.id}>
            <View style={[
              styles.stationChip,
              isOrigin && styles.originChip,
              isDest && styles.destChip,
            ]}>
              <View style={styles.chipInner}>
                <Text style={[
                  styles.stationChipText,
                  isOrigin && styles.originChipText,
                  isDest && styles.destChipText,
                ]}>
                  {station.name}
                </Text>
                {subwayIds.has(station.id) && (
                  <Ionicons name="warning-outline" size={11} color="#E65100" />
                )}
              </View>
            </View>
            {stIdx < route.length - 1 && (
              <View style={styles.segmentConnector}>
                <Text style={styles.segmentLineName} numberOfLines={1}>
                  {route[stIdx + 1].lineName}
                </Text>
                <Ionicons name="chevron-forward" size={12} color="#bbb" />
              </View>
            )}
          </React.Fragment>
        );
      })}
    </View>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: t('session.active.screenTitle'),
          headerBackVisible: false,
          gestureEnabled: false,
        }}
      />

      {/* マップ領域 */}
      <View style={styles.mapWrapper}>
        <RouteMapView
          style={styles.fullMap}
          route={currentRoute}
          polylineStations={currentAllStations}
          destinationId={currentDestinationId}
          showUserLocation={!(ENABLE_DEBUG_CONTROLS && debugTapMoveEnabled)}
          userLocation={ENABLE_DEBUG_CONTROLS && debugTapMoveEnabled ? debugMockLocation : null}
          onMapLongPress={handleMapLongPress}
          geofenceStations={geofenceStations}
          detectionRadius={localRadius}
          resetButtonBottom={10}
        />

        {isAlarmRinging && (
          <TouchableOpacity style={styles.centerStopButton} onPress={handleStopAlarmPress}>
            <Ionicons name="stop-circle-outline" size={22} color="#fff" />
            <Text style={styles.centerStopButtonText}>止める</Text>
          </TouchableOpacity>
        )}

        <View style={styles.monitorBadgeWrapper}>
          <View style={[styles.monitorStatusPanel, isMonitoringDanger ? styles.monitorStatusDanger : styles.monitorStatusSafe]}>
            {isMonitoringDanger && (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.monitorDangerPulseOverlay,
                  { opacity: dangerPulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.75] }) },
                ]}
              />
            )}
            <View style={styles.monitorStatusHeader}>
              <Ionicons
                name={isMonitoringDanger ? 'warning-outline' : 'shield-checkmark-outline'}
                size={18}
                color={isMonitoringDanger ? '#c62828' : '#2E7D32'}
              />
              <Text style={[styles.monitorStatusTitle, isMonitoringDanger ? styles.monitorStatusTitleDanger : styles.monitorStatusTitleSafe]}>
                {isMonitoringDanger ? t('session.active.safetyDanger') : t('session.active.safetySafe')}
              </Text>
            </View>
          </View>
        </View>

        {/* トップオーバーレイ：終了ボタン */}
        <View style={styles.topOverlay}>
          <TouchableOpacity style={styles.endButton} onPress={handleEnd}>
            <Ionicons name="stop-circle-outline" size={20} color="#e53935" />
            <Text style={styles.endButtonText}>{t('session.active.end')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 下部カード：スワイプで経路選択 */}
      <View style={styles.swipeCardContainer}>
        <FlatList
          ref={flatListRef}
          data={routes}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          bounces={false}
          scrollEnabled={!swipeLocked}
          onMomentumScrollEnd={(e) => {
            const newIndex = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
            handleRouteChange(newIndex);
          }}
          keyExtractor={(_, i) => i.toString()}
          renderItem={({ item, index }) => {
            const cardSubwayInfo = detectSubwayStations(item.route);
            const cardSubwayIds = new Set(cardSubwayInfo.subwayStations.map(s => s.id));
            const effectiveCardHasSubway = cardSubwayInfo.hasSubway;
            const originStation = item.route[0];
            const destStation = item.route[item.route.length - 1];
            return (
              <View style={styles.routeCard}>
                {/* ヘッダー：経路番号（左） + カウントダウン（中央） + ドットインジケーター（右） */}
                <View style={styles.cardHeader}>
                  <Text style={styles.cardRouteIndex}>
                    {t('session.confirm.routeIndex', { current: index + 1, total: routes.length })}
                  </Text>
                  <Text style={styles.cardCountdown}>{formatCountdown(remainingSeconds)}</Text>
                  <View style={styles.dots}>
                    {routes.map((_, j) => (
                      <View key={j} style={[styles.dot, j === index && styles.activeDot]} />
                    ))}
                    {isLoadingMore && (
                      <ActivityIndicator size="small" color="#1565C0" style={{ marginLeft: 4 }} />
                    )}
                  </View>
                </View>

                {/* 出発 → 目的地 */}
                <View style={styles.cardRouteInfo}>
                  <View style={styles.cardStationBlock}>
                    <Text style={styles.cardStationRole}>{t('session.active.originLabel')}</Text>
                    <Text style={styles.cardOriginName} numberOfLines={1}>{originStation?.name ?? ''}</Text>
                  </View>
                  <Ionicons name="arrow-forward" size={18} color="#888" />
                  <View style={styles.cardStationBlock}>
                    <Text style={styles.cardStationRole}>{t('session.active.destinationLabel')}</Text>
                    <Text style={styles.cardDestName} numberOfLines={1}>{destStation?.name ?? ''}</Text>
                  </View>
                </View>

                {/* 経路チップ */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cardChipsScroll}>
                  {renderChips(item.route, currentOriginId, currentDestinationId, cardSubwayIds)}
                </ScrollView>

                {/* 地下鉄注意 */}
                {effectiveCardHasSubway && (
                  <View style={styles.cardSubwayNote}>
                    <Ionicons name="warning-outline" size={11} color="#E65100" />
                    <Text style={styles.cardSubwayNoteText}>
                      {t('session.active.subwayDangerStrong')}
                    </Text>
                  </View>
                )}

                {/* 設定サマリー + 保存 + ⚙️ */}
                <View style={styles.cardSettingsSummary}>
                  <View style={styles.summaryLeft}>
                    <View style={styles.summaryRow}>
                      <Ionicons name="location-outline" size={13} color="#888" />
                      <Text style={styles.summaryText}>{localRadius}m</Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Ionicons name="volume-medium-outline" size={13} color="#888" />
                      <Text style={styles.summaryText}>{soundLabels[localSoundType]}</Text>
                    </View>
                  </View>
                  {ENABLE_DEBUG_CONTROLS && (
                    <TouchableOpacity style={styles.gearButton} onPress={() => setShowDebugModal(true)}>
                      <Ionicons name="bug-outline" size={20} color="#1565C0" />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.gearButton}
                    onPress={() => setSwipeLocked(prev => !prev)}
                  >
                    <Ionicons
                      name={swipeLocked ? 'lock-closed' : 'lock-open-outline'}
                      size={20}
                      color={swipeLocked ? '#1565C0' : '#888'}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.gearButton} onPress={handleSaveRoutePress}>
                    <Ionicons name="save-outline" size={20} color="#1565C0" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setShowSettingsModal(true)} style={styles.gearButton}>
                    <Ionicons name="alarm-outline" size={22} color="#1565C0" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      </View>

      {/* 設定モーダル */}
      <Modal
        visible={showSettingsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSettingsModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowSettingsModal(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
            {/* モーダルヘッダー */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>設定</Text>
              <TouchableOpacity onPress={() => setShowSettingsModal(false)}>
                <Ionicons name="close" size={22} color="#333" />
              </TouchableOpacity>
            </View>

            {/* サウンド設定カード */}
            <View style={styles.settingsCard}>
              <View style={styles.settingsHeader}>
                <Text style={styles.settingsLabel}>{t('session.active.soundLabel')}</Text>
                <View style={[styles.headphoneStatus, effectiveHeadphonesConnected ? styles.headphoneConnected : styles.headphoneDisconnected]}>
                  <Ionicons
                    name={effectiveHeadphonesConnected ? 'headset' : 'headset-outline'}
                    size={12}
                    color={effectiveHeadphonesConnected ? '#2E7D32' : '#795548'}
                  />
                  <Text style={[styles.headphoneText, effectiveHeadphonesConnected ? styles.headphoneConnectedText : styles.headphoneDisconnectedText]}>
                    {effectiveHeadphonesConnected ? t('session.active.headphoneConnected') : t('session.active.headphoneNotConnected')}
                  </Text>
                </View>
              </View>
              <View style={styles.soundOptions}>
                {(['alarm', 'vibration'] as SoundType[]).map(type => {
                  const disabled = type === 'alarm' && !effectiveHeadphonesConnected;
                  const selected = localSoundType === type;
                  return (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.soundOption,
                        selected && styles.soundOptionSelected,
                        disabled && styles.soundOptionDisabled,
                      ]}
                      onPress={() => handleSoundTypeChange(type)}
                      disabled={disabled || isSavingSettings}
                    >
                      <Ionicons
                        name={type === 'alarm' ? 'alarm-outline' : 'phone-portrait-outline'}
                        size={18}
                        color={disabled ? '#bbb' : selected ? '#fff' : '#1565C0'}
                      />
                      <Text style={[
                        styles.soundText,
                        selected && styles.soundTextSelected,
                        disabled && styles.soundTextDisabled,
                      ]}>
                        {soundLabels[type]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {localSoundType === 'alarm' && effectiveHeadphonesConnected && (
                <View style={styles.alarmNote}>
                  <Ionicons name="information-circle-outline" size={13} color="#1565C0" />
                  <Text style={styles.alarmNoteText}>{t('session.active.alarmNote')}</Text>
                </View>
              )}
              <TouchableOpacity
                style={[
                  styles.testButton,
                  isTesting && styles.testButtonStop,
                ]}
                onPress={handleTestNotification}
              >
                <Ionicons
                  name={isTesting ? 'stop-circle-outline' : 'notifications-outline'}
                  size={14}
                  color="#fff"
                />
                <Text style={styles.testButtonText}>
                  {isTesting ? '止める' : '通知をテストする'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* 検出半径設定カード */}
            <View style={styles.settingsCard}>
              <View style={styles.radiusHeader}>
                <Text style={styles.settingsLabel}>{t('session.active.radius')}</Text>
                <Text style={styles.radiusValue}>{localRadius} m</Text>
              </View>
              <Slider
                style={styles.slider}
                minimumValue={MIN_DETECTION_RADIUS}
                maximumValue={MAX_DETECTION_RADIUS}
                step={DETECTION_RADIUS_STEP}
                value={localRadius}
                onValueChange={(v) => setLocalRadius(Math.round(v))}
                onSlidingComplete={handleRadiusSlidingComplete}
                minimumTrackTintColor="#1565C0"
                maximumTrackTintColor="#ddd"
                thumbTintColor="#1565C0"
              />
              <View style={styles.radiusTicks}>
                {[100, 200, 300, 400, 500, 600, 700, 800, 900, 1000].map(v => (
                  <Text key={v} style={[styles.radiusTick, localRadius === v && styles.radiusTickActive]}>
                    {v === 100 || v === 500 || v === 1000 ? `${v}` : '·'}
                  </Text>
                ))}
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {ENABLE_DEBUG_CONTROLS && (
        <Modal
          visible={showDebugModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowDebugModal(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowDebugModal(false)}
          >
            <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t('session.active.debugTitle')}</Text>
                <TouchableOpacity onPress={() => setShowDebugModal(false)}>
                  <Ionicons name="close" size={22} color="#333" />
                </TouchableOpacity>
              </View>

              <View style={styles.settingsCard}>
                <View style={styles.debugButtonsColumn}>
                  <TouchableOpacity
                    style={[styles.debugButtonModal, debugTapMoveEnabled && styles.debugButtonModalActive]}
                    onPress={() => setDebugTapMoveEnabled((prev) => !prev)}
                  >
                    <Text style={[styles.debugButtonModalText, debugTapMoveEnabled && styles.debugButtonModalTextActive]}>
                      {t('session.active.debugTapMove', { state: debugTapMoveEnabled ? 'ON' : 'OFF' })}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.debugButtonModal, debugLowAccuracy && styles.debugButtonModalActive]}
                    onPress={() => setDebugLowAccuracy((prev) => !prev)}
                  >
                    <Text style={[styles.debugButtonModalText, debugLowAccuracy && styles.debugButtonModalTextActive]}>
                      {t('session.active.debugGpsLowAccuracy', { state: debugLowAccuracy ? 'ON' : 'OFF' })}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.debugButtonModal, effectiveHeadphonesConnected && styles.debugButtonModalActive]}
                    onPress={() => setDebugHeadphonesConnected((prev) => !Boolean(prev))}
                  >
                    <Text style={[styles.debugButtonModalText, effectiveHeadphonesConnected && styles.debugButtonModalTextActive]}>
                      {t('session.active.debugHeadphone', { state: effectiveHeadphonesConnected ? 'ON' : 'OFF' })}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.debugButtonModal, styles.debugArrivalButtonModal]}
                    onPress={handleDebugArrivalPress}
                  >
                    <Text style={[styles.debugButtonModalText, styles.debugArrivalButtonModalText]}>
                      {t('session.active.debugArrive')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  mapWrapper: { flex: 1, position: 'relative' },
  fullMap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },

  // ── トップオーバーレイ ──
  topOverlay: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  monitorBadgeWrapper: {
    position: 'absolute',
    top: 16,
    left: 16,
  },
  endButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 42,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e53935',
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  endButtonText: { fontSize: 13, color: '#e53935', fontWeight: '600' },
  monitorStatusPanel: {
    minHeight: 42,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 2,
    backgroundColor: 'rgba(255,255,255,0.95)',
    overflow: 'hidden',
  },
  centerStopButton: {
    position: 'absolute',
    top: '48%',
    left: '50%',
    transform: [{ translateX: -64 }, { translateY: -24 }],
    width: 128,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(198, 40, 40, 0.95)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
  },
  centerStopButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  monitorStatusSafe: {
    borderColor: '#81C784',
  },
  monitorStatusDanger: {
    borderColor: '#ef9a9a',
  },
  monitorStatusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  monitorDangerPulseOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#ff5252',
  },
  monitorStatusTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  monitorStatusTitleSafe: {
    color: '#2E7D32',
  },
  monitorStatusTitleDanger: {
    color: '#c62828',
  },
  editRouteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#1565C0',
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  editRouteButtonText: { fontSize: 14, color: '#1565C0', fontWeight: '600' },

  // ── 下部カード共通 ──
  swipeCardContainer: {
    height: CARD_HEIGHT,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.10,
    shadowRadius: 6,
    elevation: 10,
    overflow: 'hidden',
  },
  routeCard: {
    width: SCREEN_WIDTH,
    height: CARD_HEIGHT,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  cardRouteIndex: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1565C0',
    minWidth: 60,
  },
  cardCountdown: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1565C0',
    letterSpacing: 1,
    flex: 1,
    textAlign: 'center',
  },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 60, justifyContent: 'flex-end' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#ccc' },
  activeDot: { backgroundColor: '#1565C0', width: 8, height: 8, borderRadius: 4 },
  cardRouteInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 8,
  },
  cardStationBlock: { flex: 1, alignItems: 'center' },
  cardStationRole: { fontSize: 10, color: '#888', marginBottom: 1 },
  cardOriginName: { fontSize: 15, fontWeight: '700', color: '#2E7D32', textAlign: 'center' },
  cardDestName: { fontSize: 15, fontWeight: '700', color: '#c62828', textAlign: 'center' },
  cardChipsScroll: { flexGrow: 0, marginBottom: 4 },
  cardSubwayNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  cardSubwayNoteText: {
    fontSize: 10,
    color: '#E65100',
  },
  cardSettingsSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    marginHorizontal: 15,
    gap: 6,
  },
  debugButtonsColumn: {
    gap: 8,
  },
  debugButtonModal: {
    borderWidth: 1,
    borderColor: '#B0BEC5',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  debugButtonModalActive: {
    borderColor: '#1565C0',
    backgroundColor: '#E3F2FD',
  },
  debugButtonModalText: {
    fontSize: 13,
    color: '#546E7A',
    fontWeight: '600',
  },
  debugButtonModalTextActive: {
    color: '#1565C0',
  },
  debugArrivalButtonModal: {
    borderColor: '#ef9a9a',
    backgroundColor: '#ffebee',
  },
  debugArrivalButtonModalText: {
    color: '#c62828',
  },
  summaryLeft: {
    flexDirection: 'row',
    gap: 12,
    flex: 1,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  summaryText: { fontSize: 12, color: '#666' },
  gearButton: { padding: 4 },

  // チップ共通
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stationChip: {
    backgroundColor: '#FFF9C4',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  originChip: { backgroundColor: '#E8F5E9' },
  destChip: { backgroundColor: '#FFCDD2' },
  chipInner: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  stationChipText: { fontSize: 13, color: '#F57F17' },
  originChipText: { color: '#2E7D32', fontWeight: '700' },
  destChipText: { color: '#c62828', fontWeight: '700' },
  segmentConnector: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2, gap: 1 },
  segmentLineName: { fontSize: 9, color: '#888', maxWidth: 64, textAlign: 'center' },

  // ── 設定モーダル ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#f4f4f8',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingHorizontal: 16,
    paddingBottom: 36,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#1a1a1a' },

  // 設定カード（モーダル内）
  settingsCard: {
    backgroundColor: '#fff',
    marginBottom: 10,
    borderRadius: 12,
    padding: 14,
  },
  settingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  settingsLabel: { fontSize: 14, fontWeight: '600', color: '#444' },
  headphoneStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  headphoneConnected: { backgroundColor: '#E8F5E9' },
  headphoneDisconnected: { backgroundColor: '#FFF8E1' },
  headphoneText: { fontSize: 11 },
  headphoneConnectedText: { color: '#2E7D32' },
  headphoneDisconnectedText: { color: '#795548' },
  soundOptions: { flexDirection: 'row', gap: 8 },
  soundOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: '#1565C0',
    borderRadius: 10,
    paddingVertical: 9,
  },
  soundOptionSelected: { backgroundColor: '#1565C0' },
  soundOptionDisabled: { borderColor: '#ddd', backgroundColor: '#f0f0f0' },
  soundText: { fontSize: 13, color: '#1565C0' },
  soundTextSelected: { color: '#fff' },
  soundTextDisabled: { color: '#bbb' },
  alarmNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
    marginTop: 8,
    paddingHorizontal: 2,
  },
  alarmNoteText: { fontSize: 11, color: '#1565C0', flex: 1, lineHeight: 16 },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#1565C0',
  },
  testButtonStop: { backgroundColor: '#c62828' },
  testButtonText: { fontSize: 13, color: '#fff', fontWeight: '600' },
  radiusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  radiusValue: { fontSize: 18, fontWeight: '700', color: '#1565C0' },
  slider: { width: '100%', height: 40 },
  radiusTicks: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginTop: -4,
  },
  radiusTick: { fontSize: 11, color: '#ccc', textAlign: 'center', width: 28 },
  radiusTickActive: { color: '#1565C0', fontWeight: '700' },

});
