import Foundation
import CoreLocation
import UserNotifications
import React
import AVFoundation

// MARK: - AlarmAudioPlayer

final class AlarmAudioPlayer {
    static let shared = AlarmAudioPlayer()
    private init() {}

    private var player: AVAudioPlayer?
    private var stopTask: Task<Void, Never>?

    func start() {
        stop()
        guard let url = Bundle.main.url(forResource: "Clock-Alarm04-01(Mid)", withExtension: "mp3") else { return }
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)
            try AVAudioSession.sharedInstance().setActive(true)
            let p = try AVAudioPlayer(contentsOf: url)
            p.numberOfLoops = -1
            p.play()
            player = p
            stopTask = Task { [weak self] in
                try? await Task.sleep(nanoseconds: 30_000_000_000)
                self?.stop()
            }
        } catch {}
    }

    func stop() {
        stopTask?.cancel()
        stopTask = nil
        player?.stop()
        player = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
}

// MARK: - CLLocationModule

/// iOS 18+ Core Location モジュール。
/// CLServiceSession による権限管理、CLLocationUpdate によるストリーム位置取得、
/// CLMonitor による円形ジオフェンス監視を React Native に公開する。
@objc(LocationModule)
class CLLocationModule: RCTEventEmitter {

    // MARK: - Properties

    private var serviceSession: CLServiceSession?
    private var monitor: CLMonitor?
    private var monitorTask: Task<Void, Never>?
    private var hasListeners = false

    // MARK: - RCTEventEmitter

    override static func requiresMainQueueSetup() -> Bool { false }

    override func supportedEvents() -> [String]! {
        return ["onGeofenceEnter"]
    }

    override func startObserving() { hasListeners = true }
    override func stopObserving() { hasListeners = false }

    // MARK: - Permission (CLServiceSession / iOS 18)

    /// CLServiceSession を生成して「常に許可」権限を要求する。
    /// iOS 18 以降ではセッションの生存期間中、OSが自動的に権限ダイアログを管理する。
    @objc func requestPermission(
        _ resolve: @escaping RCTPromiseResolveBlock,
        reject _: @escaping RCTPromiseRejectBlock
    ) {
        serviceSession = CLServiceSession(authorization: .always)
        resolve(nil)
    }

    // MARK: - Current Location (CLLocationUpdate / iOS 17)

    /// CLLocationUpdate.liveUpdates() の非同期ストリームから最初の有効な位置を返す。
    @objc func getCurrentLocation(
        _ resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        Task {
            do {
                for try await update in CLLocationUpdate.liveUpdates() {
                    guard let location = update.location else { continue }
                    resolve([
                        "latitude": location.coordinate.latitude,
                        "longitude": location.coordinate.longitude,
                        "accuracy": location.horizontalAccuracy,
                        "timestamp": location.timestamp.timeIntervalSince1970,
                    ] as [String: Any])
                    return
                }
                reject("LOCATION_ERROR", "位置情報を取得できませんでした", nil)
            } catch {
                reject("LOCATION_ERROR", error.localizedDescription, error)
            }
        }
    }

    // MARK: - Geofencing (CLMonitor / iOS 17)

    /// CLMonitor で円形ジオフェンスを登録し、バックグラウンド監視を開始する。
    ///
    /// - Parameter regions: [{identifier, latitude, longitude, radius}] の配列
    /// - Parameter sessionJson: バックグラウンド通知用のセッション情報 JSON 文字列
    @objc func startMonitoring(
        _ regions: [[String: Any]],
        sessionJson: String,
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        // バックグラウンドでも参照できるよう UserDefaults に保存
        UserDefaults.standard.set(sessionJson, forKey: "LocationModule.activeSessionJson")

        Task {
            await stopMonitoringInternal()

            // 同名で CLMonitor を取得（再起動後も永続）
            let clMonitor = await CLMonitor("StationAlarmMonitor")
            monitor = clMonitor

            for region in regions {
                guard
                    let identifier = region["identifier"] as? String,
                    let lat = region["latitude"] as? Double,
                    let lon = region["longitude"] as? Double,
                    let radius = region["radius"] as? Double
                else { continue }

                let condition = CLMonitor.CircularGeographicCondition(
                    center: CLLocationCoordinate2D(latitude: lat, longitude: lon),
                    radius: radius
                )
                await clMonitor.add(condition, identifier: identifier)
            }

            // イベントを非同期で購読
            monitorTask = Task {
                do {
                    for try await event in await clMonitor.events where event.state == .satisfied {
                        await self.handleGeofenceEnter(identifier: event.identifier)
                    }
                } catch {
                    // モニタリング停止時やキャンセル時は正常終了として無視
                }
            }

            resolve(nil)
        }
    }

    /// CLMonitor の全条件を削除してバックグラウンドセッションを終了する。
    @objc func stopMonitoring(
        _ resolve: @escaping RCTPromiseResolveBlock,
        reject _: @escaping RCTPromiseRejectBlock
    ) {
        Task {
            await stopMonitoringInternal()
            UserDefaults.standard.removeObject(forKey: "LocationModule.activeSessionJson")
            resolve(nil)
        }
    }

    // MARK: - Private

    private func stopMonitoringInternal() async {
        monitorTask?.cancel()
        monitorTask = nil

        if let m = monitor {
            for id in await m.identifiers {
                await m.remove(id)
            }
            monitor = nil
        }

        // CLServiceSession を解放して位置情報インジケーターを消す
        serviceSession = nil
    }

    // MARK: - Stop Alarm (JS から呼び出し可能)

    @objc func stopAlarm(
        _ resolve: @escaping RCTPromiseResolveBlock,
        reject _: @escaping RCTPromiseRejectBlock
    ) {
        AlarmAudioPlayer.shared.stop()
        resolve(nil)
    }

    // MARK: - Geofence Event

    /// ジオフェンス侵入時の処理。Swift から直接通知を送信する（バックグラウンド対応）。
    private func handleGeofenceEnter(identifier: String) async {
        guard
            let data = identifier.data(using: .utf8),
            let info = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let stationName = info["stationName"] as? String,
            let isDestination = info["isDestination"] as? Bool
        else { return }

        let soundType = activeSessionSoundType()

        let content = UNMutableNotificationContent()
        content.title = isDestination ? "目的地に到着しました" : "乗換駅に近づいています"
        content.body = "\(stationName)に近づいています"
        content.interruptionLevel = .timeSensitive

        if soundType == "vibration" {
            content.sound = UNNotificationSound.default
        } else {
            content.sound = UNNotificationSound(
                named: UNNotificationSoundName("Clock-Alarm04-01(Mid).mp3")
            )
        }

        let request = UNNotificationRequest(
            identifier: UUID().uuidString,
            content: content,
            trigger: nil
        )
        try? await UNUserNotificationCenter.current().add(request)

        // バックグラウンド時のみ Swift 側でアラーム音をループ再生
        if soundType != "vibration" {
            let isBackground = await MainActor.run {
                UIApplication.shared.applicationState != .active
            }
            if isBackground {
                AlarmAudioPlayer.shared.start()
            }
        }

        // JS レイヤーへイベント送信（フォアグラウンド時）
        if hasListeners {
            sendEvent(withName: "onGeofenceEnter", body: ["identifier": identifier])
        }
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

    deinit {
        monitorTask?.cancel()
        AlarmAudioPlayer.shared.stop()
    }
}
