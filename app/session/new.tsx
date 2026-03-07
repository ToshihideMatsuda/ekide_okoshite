import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Station, SoundType } from '../../src/types';
import StationSearchInput from '../../src/components/StationSearchInput';
import { getCurrentLocation, findNearestStation } from '../../src/services/nearestStation';
import {
  DEFAULT_DETECTION_RADIUS,
  MIN_DETECTION_RADIUS,
  MAX_DETECTION_RADIUS,
  DETECTION_RADIUS_STEP,
  DEFAULT_VOLUME,
} from '../../src/constants/config';
import { buildGraph, calculateRoute } from '../../src/services/routing';
import { useGraphStore } from '../../src/store/graphStore';
import { useTranslation } from '../../src/i18n';
import { useHeadphoneDetection } from '../../src/hooks/useHeadphoneDetection';
import { useSessionStore } from '../../src/store/sessionStore';

export default function NewSessionScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { setGraph } = useGraphStore();
  const { startSession } = useSessionStore();
  const { isHeadphonesConnected, isChecking } = useHeadphoneDetection();
  const [originStation, setOriginStation] = useState<Station | null>(null);
  const [destinationStation, setDestinationStation] = useState<Station | null>(null);
  const [soundType, setSoundType] = useState<SoundType>('vibration');
  const [detectionRadius, setDetectionRadius] = useState(DEFAULT_DETECTION_RADIUS);
  const [isLocating, setIsLocating] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    (async () => {
      setIsLocating(true);
      try {
        const loc = await getCurrentLocation();
        if (loc) {
          setCurrentLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
          const nearest = await findNearestStation(loc.coords.latitude, loc.coords.longitude);
          if (nearest) setOriginStation(nearest);
        }
      } catch {
        // ユーザーが手動入力
      } finally {
        setIsLocating(false);
      }
    })();
  }, []);

  const hasInitialized = useRef(false);

  // 初回チェック完了時にイヤホン・ヘッドホン接続中ならアラーム音をデフォルトに設定
  useEffect(() => {
    if (!isChecking && !hasInitialized.current) {
      hasInitialized.current = true;
      if (isHeadphonesConnected) {
        setSoundType('alarm');
      }
    }
  }, [isChecking, isHeadphonesConnected]);

  // イヤホン・ヘッドホン接続状態が変わったとき、未接続ならバイブに強制切り替え
  useEffect(() => {
    if (!isChecking && !isHeadphonesConnected && soundType === 'alarm') {
      setSoundType('vibration');
    }
  }, [isHeadphonesConnected, isChecking]);

  const soundLabels: Record<SoundType, string> = {
    alarm: t('session.new.soundAlarm'),
    music: t('session.new.soundMusic'),
    vibration: t('session.new.soundVibration'),
  };

  const handleSoundSelect = (type: SoundType) => {
    if (type === 'alarm' && !isHeadphonesConnected) return;
    setSoundType(type);
  };

  const handleStart = async () => {
    if (!originStation) {
      Alert.alert(t('common.error'), t('session.new.errorNoOrigin'));
      return;
    }
    if (!destinationStation) {
      Alert.alert(t('common.error'), t('session.new.errorNoDest'));
      return;
    }
    if (originStation.id === destinationStation.id) {
      Alert.alert(t('common.error'), t('session.new.errorSameStation'));
      return;
    }

    setIsStarting(true);
    try {
      const graph = await buildGraph();
      setGraph(graph);
      const { route, allStations } = await calculateRoute(graph, originStation.id, destinationStation.id);

      await startSession({
        originStation,
        destinationStation,
        route,
        allStations,
        detectionRadius,
        soundType,
        volume: DEFAULT_VOLUME,
      });

      router.push('/session/active');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('session.new.calcErrorFallback');
      Alert.alert(t('session.new.calcErrorTitle'), message);
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* 出発駅 */}
      <View style={styles.section}>
        {isLocating ? (
          <View style={styles.locatingRow}>
            <ActivityIndicator size="small" color="#1565C0" />
            <Text style={styles.locatingText}>{t('session.new.locating')}</Text>
          </View>
        ) : (
          <StationSearchInput
            label={t('session.new.origin')}
            value={originStation}
            onSelect={setOriginStation}
            onClear={() => setOriginStation(null)}
            placeholder={t('session.new.originPlaceholder')}
            currentLocation={currentLocation}
          />
        )}
      </View>

      {/* 目的地 */}
      <View style={styles.section}>
        <StationSearchInput
          label={t('session.new.destination')}
          value={destinationStation}
          onSelect={setDestinationStation}
          onClear={() => setDestinationStation(null)}
          placeholder={t('session.new.destPlaceholder')}
          currentLocation={currentLocation}
        />
      </View>

      {/* サウンド */}
      <View style={styles.section}>
        <Text style={styles.label}>{t('session.new.sound')}</Text>

        {/* イヤホン・ヘッドホン状態表示 */}
        {!isChecking && (
          <View style={[styles.headphoneStatus, isHeadphonesConnected ? styles.headphoneConnected : styles.headphoneDisconnected]}>
            <Ionicons
              name={isHeadphonesConnected ? 'headset' : 'headset-outline'}
              size={14}
              color={isHeadphonesConnected ? '#2E7D32' : '#795548'}
            />
            <Text style={[styles.headphoneStatusText, isHeadphonesConnected ? styles.headphoneConnectedText : styles.headphoneDisconnectedText]}>
              {isHeadphonesConnected
                ? t('session.new.headphoneConnected')
                : t('session.new.headphoneNotConnected')}
            </Text>
          </View>
        )}

        <View style={styles.soundOptions}>
          {(['alarm', /* 'music', */ 'vibration'] as SoundType[]).map((type) => {
            const disabled = type === 'alarm' && !isHeadphonesConnected;
            return (
              <TouchableOpacity
                key={type}
                style={[
                  styles.soundOption,
                  soundType === type && styles.soundOptionSelected,
                  disabled && styles.soundOptionDisabled,
                ]}
                onPress={() => handleSoundSelect(type)}
                disabled={disabled}
              >
                <Ionicons
                  name={
                    type === 'alarm'
                      ? 'alarm-outline'
                      : type === 'music'
                        ? 'musical-notes-outline'
                        : 'phone-portrait-outline'
                  }
                  size={20}
                  color={
                    disabled
                      ? '#bbb'
                      : soundType === type
                        ? '#fff'
                        : '#1565C0'
                  }
                />
                <Text style={[
                  styles.soundText,
                  soundType === type && styles.soundTextSelected,
                  disabled && styles.soundTextDisabled,
                ]}>
                  {soundLabels[type]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* 駅検出半径 */}
      <View style={styles.section}>
        <View style={styles.radiusHeader}>
          <Text style={styles.label}>{t('session.new.radius')}</Text>
          <Text style={styles.radiusValue}>{detectionRadius} m</Text>
        </View>
        <Slider
          style={styles.slider}
          minimumValue={MIN_DETECTION_RADIUS}
          maximumValue={MAX_DETECTION_RADIUS}
          step={DETECTION_RADIUS_STEP}
          value={detectionRadius}
          onValueChange={(v) => setDetectionRadius(Math.round(v))}
          minimumTrackTintColor="#1565C0"
          maximumTrackTintColor="#ddd"
          thumbTintColor="#1565C0"
        />
        <View style={styles.radiusTicks}>
          {[100, 200, 300, 400, 500, 600, 700, 800, 900, 1000].map((v) => (
            <Text
              key={v}
              style={[styles.radiusTick, detectionRadius === v && styles.radiusTickActive]}
            >
              {v === 100 || v === 500 || v === 1000 ? `${v}` : '·'}
            </Text>
          ))}
        </View>
        <Text style={styles.radiusHint}>{t('session.new.radiusHint')}</Text>
      </View>

      {/* 開始ボタン */}
      <TouchableOpacity
        style={[
          styles.confirmButton,
          (isStarting || !originStation || !destinationStation) && styles.buttonDisabled,
        ]}
        onPress={handleStart}
        disabled={isStarting || !originStation || !destinationStation}
      >
        {isStarting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Text style={styles.confirmButtonText}>{t('session.new.confirm')}</Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { paddingBottom: 40 },
  section: {
    backgroundColor: '#fff',
    marginTop: 16,
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
  },
  locatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  locatingText: { fontSize: 14, color: '#888' },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 10 },
  headphoneStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  headphoneConnected: { backgroundColor: '#E8F5E9' },
  headphoneDisconnected: { backgroundColor: '#FFF8E1' },
  headphoneStatusText: { fontSize: 12 },
  headphoneConnectedText: { color: '#2E7D32' },
  headphoneDisconnectedText: { color: '#795548' },
  soundOptions: { flexDirection: 'row', gap: 8 },
  soundOption: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1.5,
    borderColor: '#1565C0',
    borderRadius: 10,
    paddingVertical: 10,
  },
  soundOptionSelected: { backgroundColor: '#1565C0' },
  soundOptionDisabled: { borderColor: '#ddd', backgroundColor: '#f5f5f5' },
  soundText: { fontSize: 12, color: '#1565C0', textAlign: 'center' },
  soundTextSelected: { color: '#fff' },
  soundTextDisabled: { color: '#bbb' },
  radiusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  radiusValue: { fontSize: 20, fontWeight: '700', color: '#1565C0' },
  slider: { width: '100%', height: 40 },
  radiusTicks: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginTop: -4,
    marginBottom: 4,
  },
  radiusTick: { fontSize: 11, color: '#ccc', textAlign: 'center', width: 28 },
  radiusTickActive: { color: '#1565C0', fontWeight: '700' },
  radiusHint: { fontSize: 12, color: '#aaa', marginTop: 2 },
  confirmButton: {
    flexDirection: 'row',
    backgroundColor: '#1565C0',
    marginHorizontal: 16,
    marginTop: 24,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonDisabled: { backgroundColor: '#90CAF9' },
  confirmButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
