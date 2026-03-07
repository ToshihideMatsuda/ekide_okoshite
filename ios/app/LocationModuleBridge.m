#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

// Swift の LocationModule を Objective-C/React Native ブリッジに公開する
@interface RCT_EXTERN_MODULE(LocationModule, RCTEventEmitter)

// 「常に許可」権限を CLServiceSession (iOS 18) で要求する
RCT_EXTERN_METHOD(requestPermission:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

// CLLocationUpdate.liveUpdates() で現在地を取得する
RCT_EXTERN_METHOD(getCurrentLocation:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

// CLMonitor で円形ジオフェンスを登録し、バックグラウンド監視を開始する
RCT_EXTERN_METHOD(startMonitoring:(NSArray *)regions
                  sessionJson:(NSString *)sessionJson
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

// CLMonitor の全条件を削除してバックグラウンドセッションを終了する
RCT_EXTERN_METHOD(stopMonitoring:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

// バックグラウンドで再生中のアラーム音を停止する
RCT_EXTERN_METHOD(stopAlarm:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

@end
