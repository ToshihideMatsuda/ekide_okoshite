/**
 * iOS 18+ Core Location ネイティブモジュールの TypeScript ラッパー。
 *
 * 対応 API:
 *  - CLServiceSession          : 権限管理 (iOS 18)
 *  - CLLocationUpdate.liveUpdates : 非同期ストリーム位置取得 (iOS 17)
 *  - CLMonitor                 : 円形ジオフェンス監視 (iOS 17)
 *  - CLBackgroundActivitySession  : バックグラウンド位置情報維持 (iOS 17)
 */
import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const NativeLocation = NativeModules.LocationModule as {
  requestPermission: () => Promise<void>;
  getCurrentLocation: () => Promise<LocationResult>;
  startMonitoring: (regions: GeofenceRegion[], sessionJson: string) => Promise<void>;
  stopMonitoring: () => Promise<void>;
  stopAlarm: () => Promise<void>;
} | undefined;

export type LocationResult = {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
};

export type GeofenceRegion = {
  identifier: string;
  latitude: number;
  longitude: number;
  radius: number;
};

export type GeofenceEnterEvent = {
  identifier: string;
};

const throwIfUnavailable = () => {
  if (!NativeLocation) {
    throw new Error('LocationModule は iOS のみで使用できます');
  }
};

export const LocationModule = {
  /**
   * CLServiceSession で「常に許可」権限を要求する (iOS 18)。
   * セッションが存在する間、OS が権限ダイアログを自動管理する。
   */
  requestPermission(): Promise<void> {
    throwIfUnavailable();
    return NativeLocation!.requestPermission();
  },

  /**
   * CLLocationUpdate.liveUpdates() で現在地を取得する (iOS 17)。
   */
  getCurrentLocation(): Promise<LocationResult> {
    throwIfUnavailable();
    return NativeLocation!.getCurrentLocation();
  },

  /**
   * CLMonitor で円形ジオフェンスを登録し、バックグラウンド監視を開始する (iOS 17/18)。
   *
   * @param regions ジオフェンス領域の配列
   * @param sessionJson バックグラウンド通知用セッション情報 (soundType など) の JSON 文字列
   */
  startMonitoring(regions: GeofenceRegion[], sessionJson: string): Promise<void> {
    throwIfUnavailable();
    return NativeLocation!.startMonitoring(regions, sessionJson);
  },

  /**
   * CLMonitor の全条件を削除し、バックグラウンドセッションを終了する。
   */
  stopMonitoring(): Promise<void> {
    throwIfUnavailable();
    return NativeLocation!.stopMonitoring();
  },

  /**
   * Swift 側で再生中のバックグラウンドアラーム音を停止する。
   * JS 側の stopAlarmSound() と合わせて呼び出すこと。
   */
  stopAlarm(): Promise<void> {
    if (Platform.OS !== 'ios' || !NativeLocation) return Promise.resolve();
    return NativeLocation.stopAlarm();
  },

  /**
   * ジオフェンス侵入イベントのリスナーを登録する。
   * フォアグラウンド時に JS レイヤーでアラーム再生などの処理を行う。
   */
  addGeofenceEnterListener(
    callback: (event: GeofenceEnterEvent) => void
  ): { remove: () => void } {
    if (Platform.OS !== 'ios' || !NativeLocation) {
      return { remove: () => {} };
    }
    const emitter = new NativeEventEmitter(
      NativeModules.LocationModule
    );
    return emitter.addListener('onGeofenceEnter', callback);
  },
};
