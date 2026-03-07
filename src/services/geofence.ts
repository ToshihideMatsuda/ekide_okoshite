import { Platform } from 'react-native';
import { IOS_MAX_GEOFENCE_REGIONS } from '../constants/config';
import { Session, Station } from '../types';
import { LocationModule, GeofenceRegion } from '../modules/LocationModule';

/**
 * 経路と目的駅IDからジオフェンス対象駅を計算する。
 * 「降車駅（目的地）」と「乗り換え駅」を返す。
 */
export function computeGeofenceStations(route: Station[], destinationId: string): Station[] {
  const transferIds = new Set<string>();
  for (let i = 1; i < route.length; i++) {
    if (route[i].lineId !== route[i - 1].lineId) {
      transferIds.add(route[i - 1].id);
      transferIds.add(route[i].id);
    }
  }
  return route.filter((s) => s.id === destinationId || transferIds.has(s.id));
}

/**
 * 経路からジオフェンスに登録する重要駅を選定する。
 *
 * デフォルトは「降車駅（目的地）」と「乗り換え駅」のみ登録する。
 * 乗り換え駅は経路中で路線ID(lineId)が変わる境界の両駅として判定する。
 * iOS の最大20件制限を超える場合は目的駅に近い側を優先して切り詰める。
 */
function selectStationsForGeofence(session: Session): Station[] {
  const route = session.route;
  const destId = session.destinationStation.id;

  // 降車駅と乗り換え駅のみ抽出（経路順を維持）
  const keyStations = computeGeofenceStations(route, destId);

  // iOS の上限を超える場合は目的駅に近い側（末尾）を優先
  if (Platform.OS === 'ios' && keyStations.length > IOS_MAX_GEOFENCE_REGIONS) {
    return keyStations.slice(keyStations.length - IOS_MAX_GEOFENCE_REGIONS);
  }

  return keyStations;
}

/**
 * セッションのジオフェンスを登録する（iOS 18: CLMonitor 使用）。
 *
 * CLMonitor.CircularGeographicCondition で降車駅と乗り換え駅を監視する。
 * CLBackgroundActivitySession がバックグラウンド位置情報の維持を担う。
 */
export async function registerSessionGeofences(session: Session): Promise<void> {
  if (Platform.OS !== 'ios') return;

  const stations = selectStationsForGeofence(session);

  const regions: GeofenceRegion[] = stations.map((station) => ({
    identifier: JSON.stringify({
      sessionId: session.id,
      stationId: station.id,
      stationName: station.name,
      isDestination: station.id === session.destinationStation.id,
    }),
    latitude: station.latitude,
    longitude: station.longitude,
    radius: session.detectionRadius,
  }));

  // バックグラウンド通知用にセッション情報を Swift 側へ渡す
  const sessionJson = JSON.stringify({
    id: session.id,
    soundType: session.soundType,
    volume: session.volume,
  });

  await LocationModule.startMonitoring(regions, sessionJson);
}

/** セッションのジオフェンスをすべて解除する（CLMonitor の全条件を削除）*/
export async function unregisterSessionGeofences(): Promise<void> {
  if (Platform.OS !== 'ios') return;
  await LocationModule.stopMonitoring();
}
