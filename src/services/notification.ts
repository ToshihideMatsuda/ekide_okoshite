import * as Notifications from 'expo-notifications';
import { Audio } from 'expo-av';
import { Platform, Vibration } from 'react-native';
import { Session } from '../types';
import { t } from '../i18n';
import { checkHeadphonesConnected } from '../hooks/useHeadphoneDetection';
import { LocationModule } from '../modules/LocationModule';

let currentSound: Audio.Sound | null = null;
// iOS は Vibration.vibrate() がパターン繰り返し非対応のためインターバルで代替
let vibrationInterval: ReturnType<typeof setInterval> | null = null;
// アラーム・バイブの最大再生時間（30秒）後に自動停止するタイマー
let autoStopTimer: ReturnType<typeof setTimeout> | null = null;
const ALARM_MAX_DURATION_MS = 30_000;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  if (existingStatus === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function setupNotificationChannel(): Promise<void> {
  if (Platform.OS === 'android') {
    // アラーム用チャンネル（サウンドあり）
    await Notifications.setNotificationChannelAsync('station-alarm', {
      name: '駅アラーム',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
      sound: 'Clock-Alarm05-1(Mid)-Loud.mp3',
    });
    // バイブ専用チャンネル（サウンドなし）
    await Notifications.setNotificationChannelAsync('station-alarm-vibration', {
      name: '駅アラーム（バイブ）',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 200, 500],
      lightColor: '#FF231F7C',
      sound: null,
    });
  }
}

export async function sendAlarmNotification(
  session: Session,
  stationName: string,
  options: { isTest?: boolean; isDestination?: boolean } = {}
): Promise<void> {
  const isTest = options.isTest ?? false;
  const isDestination = options.isDestination ?? false;
  // アラーム設定時はイヤホン・ヘッドホン接続を確認し、未接続の場合はバイブに切り替え
  let effectiveSoundType = session.soundType;
  if (session.soundType === 'alarm') {
    const headphonesConnected = await checkHeadphonesConnected();
    if (!headphonesConnected) {
      effectiveSoundType = 'vibration';
    }
  }
  const isVibration = effectiveSoundType === 'vibration';
  // iOS: sound: false にすると振動も無効になる。バイブモードでは sound キー自体を省略して
  //       システムデフォルト通知音＋振動を発生させる（undefined を渡すと nil エラーになる）。
  // Android: バイブ専用チャンネルがサウンドなし振動を担うため false でよい。
  const soundContent = isVibration
    ? (Platform.OS === 'android' ? { sound: false as const, vibrate: [0, 500, 200, 500] } : {})
    : { sound: 'Clock-Alarm05-1(Mid)-Loud.mp3' };

  await Notifications.scheduleNotificationAsync({
    content: {
      title: t('notification.title'),
      body: t('notification.body', { station: stationName }),
      ...soundContent,
      data: { sessionId: session.id, stationName, isDestination, ...(isTest && { isTest: true }) },
      priority: 'max',
    },
    trigger: null,
    // Android: soundType に応じて適切なチャンネルを選択
    ...(Platform.OS === 'android' && {
      channelId: isVibration ? 'station-alarm-vibration' : 'station-alarm',
    }),
  });
}

export async function playAlarmSound(session: Session): Promise<void> {
  try {
    await stopAlarmSound();
    if (session.soundType === 'vibration') {
      // Android: パターン繰り返し対応
      // iOS: パターン・繰り返し非対応のためインターバルで定期振動
      if (Platform.OS === 'android') {
        Vibration.vibrate([0, 500, 200, 500], true);
      } else {
        Vibration.vibrate();
        vibrationInterval = setInterval(() => Vibration.vibrate(), 1500);
      }
      autoStopTimer = setTimeout(() => stopAlarmSound(), ALARM_MAX_DURATION_MS);
      return;
    }

    // アラーム設定時はイヤホン・ヘッドホン接続を確認し、未接続の場合はスキップ（バイブのみ）
    if (session.soundType === 'alarm') {
      const headphonesConnected = await checkHeadphonesConnected();
      if (!headphonesConnected) return;
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: true,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: false,
    });

    let soundUri: string | number;
    if (session.soundType === 'music' && session.soundUri) {
      soundUri = { uri: session.soundUri } as unknown as number;
    } else {
      soundUri = require('../../assets/sounds/Clock-Alarm05-1(Mid)-Loud.mp3');
    }

    const { sound } = await Audio.Sound.createAsync(
      soundUri as Parameters<typeof Audio.Sound.createAsync>[0],
      { shouldPlay: true, isLooping: true, volume: session.volume }
    );
    currentSound = sound;
    // アラーム・音楽モードでもバイブレーションを追加（バイブ設定と同じ間隔）
    if (Platform.OS === 'android') {
      Vibration.vibrate([0, 500, 200, 500], true);
    } else {
      Vibration.vibrate();
      vibrationInterval = setInterval(() => Vibration.vibrate(), 1500);
    }
    autoStopTimer = setTimeout(() => stopAlarmSound(), ALARM_MAX_DURATION_MS);
  } catch (error) {
    console.error('アラーム音の再生に失敗しました:', error);
  }
}

export async function stopAlarmSound(): Promise<void> {
  // 自動停止タイマーをキャンセル
  if (autoStopTimer) {
    clearTimeout(autoStopTimer);
    autoStopTimer = null;
  }
  // バイブレーション停止
  if (vibrationInterval) {
    clearInterval(vibrationInterval);
    vibrationInterval = null;
  }
  Vibration.cancel();

  if (currentSound) {
    try {
      await currentSound.stopAsync();
      await currentSound.unloadAsync();
    } catch (error) {
      console.error('アラーム音の停止に失敗しました:', error);
    } finally {
      currentSound = null;
    }
  }

  // Swift 側のバックグラウンドアラーム音も停止
  try {
    await LocationModule.stopAlarm();
  } catch {
    // iOS 以外や停止失敗は無視
  }
}

export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/** サウンドまたはバイブレーションが再生中かどうかを返す */
export function isAlarmActive(): boolean {
  return currentSound !== null || vibrationInterval !== null;
}
