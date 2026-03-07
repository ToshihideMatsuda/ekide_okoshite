import React, { useEffect, useState } from 'react';
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

export default function AlarmFiredScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ stationName?: string; sessionId?: string }>();
  const { activeSession, completeSession } = useSessionStore();
  const { incrementCompletedSessions } = useAdStore();
  const [isDismissing, setIsDismissing] = useState(false);

  const stationName =
    params.stationName ?? activeSession?.destinationStation.name ?? '';

  useEffect(() => {
    // アプリが前面に出た時点でアラーム・バイブをすべて停止
    stopAlarmSound();
  }, []);

  const handleDismiss = async () => {
    if (isDismissing) return;
    setIsDismissing(true);

    await stopAlarmSound();
    await cancelAllNotifications();

    const sessionId = params.sessionId ?? activeSession?.id;
    if (sessionId) {
      await completeSession(sessionId);
    }

    await incrementCompletedSessions();
    router.replace('/');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        <View style={styles.iconContainer}>
          <Ionicons name="notifications" size={80} color="#fff" />
        </View>

        <Text style={styles.title}>{t('alarm.fired.title')}</Text>
        <Text style={styles.stationName}>
          {stationName}{t('alarm.fired.stationSuffix')}
        </Text>
        <Text style={styles.subtitle}>{t('alarm.fired.subtitle')}</Text>

        <TouchableOpacity style={styles.dismissButton} onPress={handleDismiss} activeOpacity={0.85} disabled={isDismissing}>
          <Ionicons name="checkmark-circle-outline" size={28} color="#1565C0" />
          <Text style={styles.dismissText}>{t('alarm.fired.dismiss')}</Text>
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1565C0',
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
    color: 'rgba(255,255,255,0.75)',
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
    color: '#1565C0',
  },
});
