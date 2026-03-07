// ジオフェンス半径（メートル）設定可能範囲（100〜1000m）
export const DEFAULT_DETECTION_RADIUS = 500;
export const MIN_DETECTION_RADIUS = 100;
export const MAX_DETECTION_RADIUS = 1000;
export const DETECTION_RADIUS_STEP = 100;

// バックグラウンドタスク名
export const GEOFENCE_TASK_NAME = 'STATION_ALARM_GEOFENCE_TASK';

// iOSジオフェンス最大登録数
export const IOS_MAX_GEOFENCE_REGIONS = 20;

// アラーム音量デフォルト値（expo-av の上限は 1.0）
export const DEFAULT_VOLUME = 1.0;

// セッション有効時間（ミリ秒）
export const SESSION_DURATION_MS = 3 * 60 * 60 * 1000; // 3時間

// デバッグUI/擬似イベント機能の有効化フラグ
// 注意: コミット時は必ず false に戻すこと
export const ENABLE_DEBUG_CONTROLS = false;
