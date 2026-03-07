# 駅で起こして — 設計書

## プロジェクト概要

**アプリ名**: 駅で起こして
**サブタイトル**: 寝過ごし防止アプリ。乗車中に目的駅を登録しておくと、近づいたときにアラーム/通知で起こしてくれる。
**プラットフォーム**: iOS / Android（React Native + Expo SDK 54）

---

## セッションフロー

```
アプリ起動
  ↓
GPS取得 → 現在地から最寄駅を自動算出
  ↓
目的地駅を入力（駅名検索）
    ※ ホーム画面でマイルートボタン表示（保存済みがある場合）→ タップで即セッション開始
  ↓
ダイクストラ法で経路計算（最大5ルート）
  ↓
マップ＋カード表示（スワイプで代替ルート切り替え）
  ・[終了] ボタン（左上）         → セッション終了
  ・[保存] ボタン（カード内）      → マイルート保存
  ↓
目的駅のジオフェンスに入る → アラーム発火（alarm/fired.tsx）
  ↓
ユーザーが停止 → 到着おめでとう画面（alarm/arrived.tsx）
  ↓
セッション終了・ジオフェンス解除 → ホームへ戻る
```

---

## 技術スタック

| 領域 | 技術 |
|------|------|
| フレームワーク | React Native (Expo SDK 54) |
| 言語 | TypeScript |
| ナビゲーション | Expo Router v6 |
| 状態管理 | Zustand |
| ローカルDB | expo-sqlite |
| 位置情報・ジオフェンス | expo-location + iOS CLMonitor（カスタムネイティブ） |
| 通知・アラーム | expo-notifications + Swift AlarmAudioPlayer |
| 音楽再生 | expo-av |
| 地図 | react-native-maps |
| 駅データ | 駅データ.jp CSV → SQLite（新幹線除外） |
| 経路計算 | ダイクストラ法（自前実装） |

---

## ディレクトリ構成

```
app/
  (tabs)/
    index.tsx           # ホーム: セッション開始 + マイルートボタン（保存済みがある場合）
    settings.tsx        # 設定
  session/
    new.tsx             # 出発・目的地入力、経路計算、セッション開始
    active.tsx          # セッション中: マップ、ルートスワイプ、終了/保存
    route-edit.tsx      # 経路編集（現在UI非表示）
    my-routes.tsx       # マイルート一覧: タップで即座にセッション開始
  alarm/
    fired.tsx           # アラーム発火画面（フルスクリーン / バックグラウンド起動時）
    arrived.tsx         # 到着おめでとう画面（アラーム停止・セッション完了・ホームへ）
src/
  components/
    RatingDialog.tsx         # 評価ダイアログ
    RouteMapView.tsx         # 経路表示マップ
    SessionCard.tsx          # 履歴カード
    StationSearchInput.tsx   # 駅名検索入力
    SubwayWarningBanner.tsx  # 地下鉄GPS精度警告
  services/
    routing.ts          # ダイクストラ経路計算
    geofence.ts         # ジオフェンス登録・解除
    nearestStation.ts   # GPS → 最寄駅算出
    notification.ts     # 通知・アラーム制御
    stationDb.ts        # セッション SQLite CRUD
    subwayDetection.ts  # 地下鉄区間検出
  store/
    sessionStore.ts     # アクティブセッション状態（Zustand）
    adStore.ts          # 評価・完了数状態（Zustand + AsyncStorage）
    myRouteStore.ts     # 保存済みルート（Zustand + AsyncStorage）
    graphStore.ts       # 路線グラフキャッシュ（Zustand）
  providers/            # 交通データプロバイダ（EkidataProvider 等）
  i18n/                 # 国際化（ja.ts / en.ts）
  types/index.ts        # 主要型定義
  constants/config.ts   # 定数（検出半径等）
```

---

## データモデル

### Station

```typescript
type Station = {
  id: string;            // ekidata: stationCd, GTFS: stop_id, OSM: node_id
  groupId?: string;      // 同一物理駅グループID（乗り換え判定用）
  name: string;
  lineId: string;
  lineName: string;
  lineNames?: string[];
  latitude: number;
  longitude: number;
  source?: 'ekidata' | 'gtfs' | 'osm';
};
```

### Session

```typescript
type Session = {
  id: string;
  originStation: Station;
  destinationStation: Station;
  route: Station[];          // 主要駅（出発・乗り換え・目的）
  allStations?: Station[];   // ポリライン描画用全駅
  detectionRadius: number;   // 100〜1000m（デフォルト500m）
  soundType: 'alarm' | 'music' | 'vibration';
  soundUri?: string;
  volume: number;            // 0.0〜1.0
  status: 'active' | 'completed' | 'cancelled';
  startedAt: string;
  completedAt?: string;
};
```

### MyRoute

```typescript
// src/store/myRouteStore.ts
type MyRoute = {
  id: string;
  name: string;              // 自動: "{出発} → {目的地}"
  originStation: Station;
  destinationStation: Station;
  route: Station[];
  allStations?: Station[];
  savedAt: string;
};
```

---

---

## バックグラウンド処理

- **ジオフェンス実装**: iOS CLMonitor（iOS 17+）カスタムネイティブモジュール `LocationModule`。`expo-task-manager` は不使用。
- **登録対象**: 目的駅・乗り換え駅のみ（iOS上限20件対応）。超過時は目的駅側を優先。
- `stopAlarmSound()` でJS/Swift双方を一括停止。
- ジオフェンスは **iOS専用**（Androidでは何もしない）。

### アラーム動作（状態別）

| アプリ状態 | 担当 |
|-----------|------|
| フォアグラウンド | JS（expo-av） |
| バックグラウンド / ロック画面 | Swift（AlarmAudioPlayer） |
| Kill後 | AppDelegate → CLMonitor 再購読 → AlarmAudioPlayer |

- `SoundType='vibration'` はUI表示「通知のみ（音なし）」（iOS制限でバイブ繰り返し不可）

---

## 翻訳（i18n）

`src/i18n/translations/ja.ts` に追加したキーは必ず `en.ts` にも追加すること。
型は `TranslationKey = keyof typeof ja` で管理されている。
（`i18n/index.ts` に既存の型エラーあり: `en` のリテラル型が `ja` と一致しないという構造的問題で変更前から存在）

---

## デバッグフラグ運用

- デバッグUI・擬似イベント機能は `src/constants/config.ts` の `ENABLE_DEBUG_CONTROLS` で制御する。
- `ENABLE_DEBUG_CONTROLS` は **false のままコミットすること**。
- もし true でコミットされていた場合は、必ず false に戻すこと。

---

## バージョン管理（app.json）

| 変更種別 | `version` | `runtimeVersion` |
|---------|-----------|-----------------|
| JS変更 → OTA配信 | 上げない | 上げない |
| JS変更 → ストア申請 | **上げる** | 上げない |
| ネイティブ変更 → ストア申請 | **上げる** | **上げる** |

`runtimeVersion` はネイティブ変更時に必ず上げること（古いバイナリへの壊れたJS配信を防ぐ）。

---

## 注意事項

- **地下鉄GPS精度**: 地下区間ではWi-Fi・基地局測位にフォールバック。UIで地下鉄警告を表示する。
- **セッション中のGPS**: 高精度GPS使用。待機中は Significant Location Change モードに切り替える。
- **駅データバージョン管理**: 起動時にデータバージョンをチェックし必要時にSQLiteを再構築する。
- **既知の型エラー（修正不要）**: `src/i18n/index.ts`（en/ja リテラル型不一致）、`src/services/notification.ts`（expo-notifications API バージョン差異）
