import Expo
import React
import ReactAppDependencyProvider
import CoreLocation
import UserNotifications

@UIApplicationMain
public class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  // アプリ kill 後に位置情報起因で再起動されたときの CLMonitor 再購読タスク
  private var locationRelaunchTask: Task<Void, Never>?

  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory
    bindReactNativeFactory(factory)

#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif

    // アプリが位置情報起因でバックグラウンド再起動された場合、CLMonitor に再購読してアラームを発火
    if launchOptions?[.location] != nil {
      locationRelaunchTask = Task { await self.handleLocationRelaunch() }
    }

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  // MARK: - Kill 後の位置情報再起動ハンドリング

  /// CLMonitor("StationAlarmMonitor") に再購読し、発火したジオフェンスのアラームを処理する。
  private func handleLocationRelaunch() async {
    let monitor = await CLMonitor("StationAlarmMonitor")
    do {
      for try await event in await monitor.events where event.state == .satisfied {
        await fireAlarmForIdentifier(event.identifier)
        break // 1件処理したら終了（kill 後再起動時は通常1件）
      }
    } catch {}
    locationRelaunchTask = nil
  }

  /// 通知送信 + AlarmAudioPlayer でアラーム音をループ再生する。
  private func fireAlarmForIdentifier(_ identifier: String) async {
    guard
      let data = identifier.data(using: .utf8),
      let info = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
      let stationName = info["stationName"] as? String,
      let isDestination = info["isDestination"] as? Bool,
      let sessionId = info["sessionId"] as? String
    else { return }

    // 古いジオフェンスが CLMonitor に残っている場合は無視する
    guard activeSessionId() == sessionId else { return }

    let soundType = activeSessionSoundType()

    let content = UNMutableNotificationContent()
    content.title = isDestination ? "目的地に到着しました" : "乗換駅に近づいています"
    content.body = "\(stationName)に近づいています"
    content.interruptionLevel = .timeSensitive
    content.sound = soundType == "vibration"
      ? .default
      : UNNotificationSound(named: UNNotificationSoundName("Clock-Alarm04-01(Mid).mp3"))

    let request = UNNotificationRequest(identifier: UUID().uuidString, content: content, trigger: nil)
    try? await UNUserNotificationCenter.current().add(request)

    if soundType != "vibration" {
      AlarmAudioPlayer.shared.start()
    }
  }

  /// UserDefaults からアクティブセッションの ID を取得する。
  private func activeSessionId() -> String? {
    guard
      let json = UserDefaults.standard.string(forKey: "LocationModule.activeSessionJson"),
      let data = json.data(using: .utf8),
      let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
      let sessionId = obj["id"] as? String
    else { return nil }
    return sessionId
  }

  /// UserDefaults からアクティブセッションの soundType を取得する。
  private func activeSessionSoundType() -> String {
    guard
      let json = UserDefaults.standard.string(forKey: "LocationModule.activeSessionJson"),
      let data = json.data(using: .utf8),
      let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
      let soundType = obj["soundType"] as? String
    else { return "vibration" }
    return soundType
  }

  // Linking API
  public override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    return super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options)
  }

  // Universal Links
  public override func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    let result = RCTLinkingManager.application(application, continue: userActivity, restorationHandler: restorationHandler)
    return super.application(application, continue: userActivity, restorationHandler: restorationHandler) || result
  }
}

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  // Extension point for config-plugins

  override func sourceURL(for bridge: RCTBridge) -> URL? {
    // needed to return the correct URL for expo-dev-client.
    bridge.bundleURL ?? bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
