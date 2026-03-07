#import <React/RCTBridgeModule.h>
#import <AVFoundation/AVFoundation.h>

@interface HeadphoneDetectionModule : NSObject <RCTBridgeModule>
@end

@implementation HeadphoneDetectionModule

RCT_EXPORT_MODULE(HeadphoneDetection)

+ (BOOL)requiresMainQueueSetup {
  return NO;
}

RCT_EXPORT_METHOD(isHeadphonesConnected:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    AVAudioSession *session = [AVAudioSession sharedInstance];
    BOOL isConnected = NO;
    for (AVAudioSessionPortDescription *output in session.currentRoute.outputs) {
      if ([output.portType isEqualToString:AVAudioSessionPortHeadphones] ||
          [output.portType isEqualToString:AVAudioSessionPortBluetoothA2DP] ||
          [output.portType isEqualToString:AVAudioSessionPortBluetoothHFP] ||
          [output.portType isEqualToString:AVAudioSessionPortBluetoothLE]) {
        isConnected = YES;
        break;
      }
    }
    resolve(@(isConnected));
  });
}

@end
