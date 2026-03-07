import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { defineGeofencingTask } from '../src/services/backgroundTask';
import { setupNotificationChannel, requestNotificationPermission } from '../src/services/notification';
import { requestLocationPermission } from '../src/services/nearestStation';
import { initializeStationDb } from '../src/services/stationDb';
import { useSessionStore } from '../src/store/sessionStore';
import { useAdStore } from '../src/store/adStore';
import { useI18nStore, useTranslation } from '../src/i18n';

// ジオフェンスタスクはアプリ起動時に定義する必要がある
defineGeofencingTask();

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const loadSessions = useSessionStore((state) => state.loadSessions);
  const loadAdState = useAdStore((state) => state.loadAdState);
  const hydrate = useI18nStore((state) => state.hydrate);
  const { t } = useTranslation();

  useEffect(() => {
    (async () => {
      try {
        // 言語設定を復元
        await hydrate();

        // 駅データ.jp CSVをSQLiteへインポート（初回のみ）
        await initializeStationDb();

        // 権限リクエスト
        await requestNotificationPermission();
        await requestLocationPermission();

        // 通知チャンネルの設定（Android）
        await setupNotificationChannel();

        // セッション履歴を読み込む
        await loadSessions();

        // 評価状態を読み込む（AsyncStorage から前回値を復元）
        await loadAdState();
      } catch (e) {
        console.warn('初期化エラー:', e);
      } finally {
        await SplashScreen.hideAsync();
      }
    })();
  }, [loadSessions, loadAdState, hydrate]);

  return (
    <>
      <StatusBar style="auto" />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="戻る" options={{ headerShown: false }} />
        <Stack.Screen
          name="session/my-routes"
          options={{ title: t('myRoute.screenTitle'), headerBackTitle: '戻る' }}
        />
        <Stack.Screen
          name="session/new"
          options={{ title: t('session.new.screenTitle'), presentation: 'modal' }}
        />
        <Stack.Screen
          name="session/confirm"
          options={{ title: t('session.confirm.screenTitle') }}
        />
        <Stack.Screen
          name="session/active"
          options={{
            title: t('session.active.screenTitle'),
            headerBackVisible: false,
            gestureEnabled: false,
            presentation: 'fullScreenModal',
          }}
        />
        <Stack.Screen
          name="alarm/fired"
          options={{
            headerShown: false,
            presentation: 'fullScreenModal',
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="alarm/arrived"
          options={{
            headerShown: false,
            presentation: 'fullScreenModal',
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="privacy-policy"
          options={{ title: t('privacy.screenTitle'), headerBackTitle: '戻る' }}
        />
      </Stack>
    </>
  );
}
