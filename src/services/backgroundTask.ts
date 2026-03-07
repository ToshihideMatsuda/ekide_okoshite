import { LocationModule, GeofenceEnterEvent } from '../modules/LocationModule';
import { getSession, updateSessionStatus } from './stationDb';
import { sendAlarmNotification, playAlarmSound } from './notification';
import { unregisterSessionGeofences } from './geofence';
import { useSessionStore } from '../store/sessionStore';

type GeofenceRegionData = {
  sessionId: string;
  stationId: string;
  stationName: string;
  isDestination: boolean;
};

/**
 * ジオフェンス侵入イベントを JS レイヤーで処理する。
 *
 * Swift の LocationModule が onGeofenceEnter を emit した際に呼ばれる。
 * アプリがフォアグラウンドにある場合はここでアラーム音を再生する。
 * バックグラウンド（アプリがサスペンド／終了）時は Swift 側が
 * UNUserNotificationCenter で通知を直接送信するため、JS 側の処理は不要。
 */
async function handleGeofenceEnter(event: GeofenceEnterEvent): Promise<void> {
  let regionData: GeofenceRegionData;
  try {
    regionData = JSON.parse(event.identifier) as GeofenceRegionData;
  } catch {
    console.error('region identifier のパースに失敗:', event.identifier);
    return;
  }

  const { sessionId, stationName, isDestination } = regionData;

  try {
    const session = await getSession(sessionId);
    if (!session || session.status !== 'active') return;

    if (isDestination) {
      // 目的駅に到着 → アラーム発火
      await sendAlarmNotification(session, stationName, { isDestination: true });
      await playAlarmSound(session);
      // セッションを completed に更新
      await updateSessionStatus(session.id, 'completed', new Date().toISOString());
      await unregisterSessionGeofences();
      // active.tsx に到着を通知して arrived 画面へ遷移させる
      useSessionStore.getState().triggerArrival(stationName);
    } else {
      // 乗り換え駅に到着 → アラーム発火（セッションは継続）
      await sendAlarmNotification(session, stationName, { isDestination: false });
      await playAlarmSound(session);
    }
  } catch (err) {
    console.error('アラーム発火処理エラー:', err);
  }
}

/**
 * CLMonitor（iOS 18）からの onGeofenceEnter イベントを購読する。
 * この関数はアプリ起動時（_layout.tsx）に一度だけ呼び出す必要がある。
 *
 * バックグラウンドでのアラーム通知は Swift (LocationModule.swift) が担うため、
 * ここでは JS が動作しているフォアグラウンド時の処理を行う。
 */
export function defineGeofencingTask(): void {
  LocationModule.addGeofenceEnterListener((event) => {
    handleGeofenceEnter(event).catch((err) =>
      console.error('ジオフェンスイベント処理エラー:', err)
    );
  });
}
