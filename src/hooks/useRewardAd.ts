import { useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import {
  ADMOB_REWARD_UNIT_ID_IOS,
  ADMOB_REWARD_UNIT_ID_ANDROID,
} from '../constants/config';

let RewardedAd: any = null;
let RewardedAdEventType: any = null;
let AdEventType: any = null;
let TestIds: any = null;

try {
  const ads = require('react-native-google-mobile-ads');
  RewardedAd = ads.RewardedAd;
  RewardedAdEventType = ads.RewardedAdEventType;
  AdEventType = ads.AdEventType;
  TestIds = ads.TestIds;
} catch {
  // Expo Go 等でネイティブモジュールが利用できない場合は無視
}

const getUnitId = () => {
  if (__DEV__ && TestIds) return TestIds.REWARDED;
  return Platform.OS === 'ios'
    ? ADMOB_REWARD_UNIT_ID_IOS
    : ADMOB_REWARD_UNIT_ID_ANDROID;
};

/**
 * リワード広告フック
 *
 * 使い方:
 *   const { showRewardAd } = useRewardAd();
 *   await showRewardAd(); // 広告を表示（閉じるまで待機）
 */
export function useRewardAd() {
  const adRef = useRef<any>(null);
  const resolveRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!RewardedAd || !RewardedAdEventType || !AdEventType) return;

    const ad = RewardedAd.createForAdRequest(getUnitId(), {
      requestNonPersonalizedAdsOnly: true,
    });
    adRef.current = ad;
    ad.load();

    const unsubClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
      resolveRef.current?.();
      resolveRef.current = null;
      ad.load();
    });

    const unsubError = ad.addAdEventListener(AdEventType.ERROR, () => {
      resolveRef.current?.();
      resolveRef.current = null;
    });

    return () => {
      unsubClosed();
      unsubError();
    };
  }, []);

  /**
   * リワード広告を表示して閉じるまで await する。
   * 広告がロードされていない場合は最大3秒待機する。
   * ロード失敗時はスキップして続行。
   */
  const showRewardAd = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      const ad = adRef.current;

      if (!RewardedAd || !RewardedAdEventType || !AdEventType || !ad) {
        resolve();
        return;
      }

      const tryShow = () => {
        resolveRef.current = resolve;
        ad.show();
      };

      if (ad.loaded) {
        tryShow();
        return;
      }

      let timeoutId: ReturnType<typeof setTimeout>;
      const unsubLoaded = ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
        clearTimeout(timeoutId);
        unsubLoaded();
        tryShow();
      });
      timeoutId = setTimeout(() => {
        unsubLoaded();
        resolve();
      }, 3000);
    });
  }, []);

  return { showRewardAd };
}
