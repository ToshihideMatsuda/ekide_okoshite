import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { stopAlarmSound, cancelAllNotifications } from '../../src/services/notification';
import { useSessionStore } from '../../src/store/sessionStore';
import { useAdStore } from '../../src/store/adStore';
import { useTranslation } from '../../src/i18n';
import RatingDialog from '../../src/components/RatingDialog';

export default function AlarmArrivedScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ stationName?: string }>();
  const { activeSession, completeSession } = useSessionStore();
  const { hasRated, incrementCompletedSessions, setHasRated } = useAdStore();
  const [showRating, setShowRating] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);

  const hasMountedRef = useRef(false);

  const stationName =
    params.stationName ?? activeSession?.destinationStation.name ?? '';

  useEffect(() => {
    if (hasMountedRef.current) return;
    hasMountedRef.current = true;

    (async () => {
      // アラーム音・通知を停止
      await stopAlarmSound();
      await cancelAllNotifications();

      // セッションをまだ store が active として保持している場合は完了させる
      const sessionId = activeSession?.id;
      if (sessionId) {
        try {
          await completeSession(sessionId);
        } catch {
          // DB 側で既に completed になっていても無視
        }
      }

      await incrementCompletedSessions();
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDismiss = async () => {
    if (isDismissing) return;
    setIsDismissing(true);

    // dismissAll() で active・arrived 両 fullScreenModal を一括閉鎖してトップへ戻る。
    // モーダルがない場合（直接起動など）は replace() にフォールバック。
    const navigateHome = () => {
      if (router.canDismiss()) {
        router.dismissAll();
      } else {
        router.replace('/');
      }
    };

    if (!hasRated) {
      // 未評価の場合は評価ダイアログを表示（ナビゲーションはダイアログの送信/スキップ後）
      setShowRating(true);
    } else {
      navigateHome();
    }
  };

  const handleRatingSubmit = async (rating: number, comment: string) => {
    console.log('[Rating] rating:', rating, 'comment:', comment);
    setShowRating(false);
    await setHasRated();
    if (router.canDismiss()) {
      router.dismissAll();
    } else {
      router.replace('/');
    }
  };

  const handleRatingSkip = () => {
    setShowRating(false);
    if (router.canDismiss()) {
      router.dismissAll();
    } else {
      router.replace('/');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        <View style={styles.iconContainer}>
          <Ionicons name="checkmark-circle" size={80} color="#fff" />
        </View>

        <Text style={styles.title}>{t('alarm.arrived.title')}</Text>
        <Text style={styles.stationName}>
          {stationName}{t('alarm.arrived.stationSuffix')}
        </Text>

        <TouchableOpacity
          style={styles.dismissButton}
          onPress={handleDismiss}
          activeOpacity={0.85}
          disabled={isDismissing}
        >
          <Ionicons name="home-outline" size={24} color="#2E7D32" />
          <Text style={styles.dismissText}>{t('alarm.arrived.dismiss')}</Text>
        </TouchableOpacity>
      </View>
      <RatingDialog
        visible={showRating}
        onSubmit={handleRatingSubmit}
        onSkip={handleRatingSkip}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2E7D32',
  },
  inner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  iconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  stationName: {
    fontSize: 36,
    fontWeight: '900',
    color: '#fff',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    marginBottom: 8,
  },
  dismissButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 50,
    paddingHorizontal: 36,
    paddingVertical: 18,
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  dismissText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2E7D32',
  },
});
