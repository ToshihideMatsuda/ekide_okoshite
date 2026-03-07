import React, { useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSessionStore } from '../../src/store/sessionStore';
import { useMyRouteStore } from '../../src/store/myRouteStore';
import { useTranslation } from '../../src/i18n';
import { SESSION_DURATION_MS } from '../../src/constants/config';

export default function HomeScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { activeSession, error, clearError, cancelSession } = useSessionStore();
  const { routes, loadRoutes } = useMyRouteStore();
  const hasMyRoutes = routes.length > 0;

  useEffect(() => {
    loadRoutes();
  }, []);

  const handleStartSession = useCallback(async () => {
    if (activeSession) {
      const elapsed = Date.now() - new Date(activeSession.startedAt).getTime();
      if (elapsed >= SESSION_DURATION_MS) {
        await cancelSession(activeSession.id);
        router.push('/session/new');
        return;
      }
      Alert.alert(
        t('home.sessionActiveTitle'),
        t('home.sessionActiveMessage'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('home.goToSession'), onPress: () => router.push('/session/active') },
        ]
      );
      return;
    }
    router.push('/session/new');
  }, [activeSession, cancelSession, router, t]);

  React.useEffect(() => {
    if (error) {
      Alert.alert(t('common.error'), error, [{ text: t('common.ok'), onPress: clearError }]);
    }
  }, [error, clearError, t]);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <TouchableOpacity style={styles.startButton} onPress={handleStartSession} activeOpacity={0.85}>
          <Ionicons name="train" size={32} color="#fff" />
          <Text style={styles.startButtonText}>{t('home.startSession')}</Text>
          <Text style={styles.startButtonSub}>{t('home.startSessionSub')}</Text>
        </TouchableOpacity>

        {/* マイルートボタン（保存済みルートがある場合） */}
        {hasMyRoutes && (
          <TouchableOpacity
            style={styles.myRoutesButton}
            onPress={() => router.push('/session/my-routes')}
            activeOpacity={0.85}
          >
            <Ionicons name="bookmark-outline" size={20} color="#1565C0" />
            <Text style={styles.myRoutesButtonText}>{t('home.myRoutes')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  startButton: {
    backgroundColor: '#1565C0',
    borderRadius: 16,
    paddingVertical: 32,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },
  startButtonSub: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
  },
  myRoutesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 16,
    borderWidth: 2,
    borderColor: '#1565C0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  myRoutesButtonText: {
    color: '#1565C0',
    fontSize: 18,
    fontWeight: '700',
  },
});
