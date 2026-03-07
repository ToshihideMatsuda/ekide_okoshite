/**
 * GPS座標から最寄駅を算出するサービス。
 *
 * TransitDataProvider を通じてデータソースに依存しない形で
 * 最寄駅を検索する。
 *
 * 位置情報の取得には iOS 18 の CLLocationUpdate.liveUpdates() を利用する
 * ネイティブモジュール（LocationModule）を使用する。
 */
import { LocationModule } from '../modules/LocationModule';
import { Station } from '../types';
import { getProvider } from '../providers';

/**
 * 現在地から最寄り駅を返す。
 * 半径 radiusKm 以内の駅を取得し、最も近い駅を返す。
 */
export async function findNearestStation(
  latitude: number,
  longitude: number,
  radiusKm = 5
): Promise<Station | null> {
  const provider = getProvider();
  await provider.initialize();
  return provider.findNearestStation(latitude, longitude, radiusKm);
}

/**
 * 現在地のGPS座標を取得する。
 * CLLocationUpdate.liveUpdates()（iOS 17+）で最初の有効な位置を返す。
 */
export async function getCurrentLocation(): Promise<{
  coords: { latitude: number; longitude: number };
} | null> {
  try {
    const result = await LocationModule.getCurrentLocation();
    return {
      coords: {
        latitude: result.latitude,
        longitude: result.longitude,
      },
    };
  } catch {
    return null;
  }
}

/**
 * 位置情報権限を要求する。
 * CLServiceSession（iOS 18）が「常に許可」権限を管理する。
 */
export async function requestLocationPermission(): Promise<boolean> {
  try {
    await LocationModule.requestPermission();
    return true;
  } catch {
    return false;
  }
}

/**
 * バックグラウンド位置情報権限の確認。
 * iOS 18 では CLServiceSession がセッション中の権限を自動管理するため、
 * 常に true を返す（権限が拒否された場合は startMonitoring がエラーとなる）。
 */
export async function checkBackgroundLocationPermission(): Promise<boolean> {
  return true;
}
