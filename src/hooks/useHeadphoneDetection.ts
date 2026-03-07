import { useState, useEffect, useCallback } from 'react';
import { NativeModules } from 'react-native';

const { HeadphoneDetection } = NativeModules;
let headphoneConnectionOverride: boolean | null = null;

/**
 * デバッグ用: イヤホン接続状態の擬似値を設定する。
 * null を指定すると実機状態判定に戻る。
 */
export function setHeadphoneConnectionOverride(connected: boolean | null): void {
  headphoneConnectionOverride = connected;
}

/**
 * ネイティブモジュールを使用してイヤホン・ヘッドホンの接続状態を確認する。
 * ネイティブモジュールが利用できない場合は false を返す（安全側のデフォルト）。
 */
export async function checkHeadphonesConnected(): Promise<boolean> {
  if (headphoneConnectionOverride != null) return headphoneConnectionOverride;
  if (!HeadphoneDetection) return false;
  try {
    const result: boolean = await HeadphoneDetection.isHeadphonesConnected();
    return result;
  } catch {
    return false;
  }
}

/**
 * イヤホン・ヘッドホンの接続状態を監視するフック。
 * @param pollInterval ポーリング間隔（ミリ秒）。デフォルト 2000ms
 */
export function useHeadphoneDetection(pollInterval = 2000) {
  const [isHeadphonesConnected, setIsHeadphonesConnected] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  const refresh = useCallback(async () => {
    const connected = await checkHeadphonesConnected();
    setIsHeadphonesConnected(connected);
    setIsChecking(false);
    return connected;
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, pollInterval);
    return () => clearInterval(interval);
  }, [refresh, pollInterval]);

  return { isHeadphonesConnected, isChecking, refresh };
}
