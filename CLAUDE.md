# CLAUDE.md

## コマンド

```bash
expo start / expo run:ios / expo run:android
npm run generate-ekidata   # 駅データCSV → SQLite変換
npx tsc --noEmit           # 型チェック（後述の既知エラーあり）
```

---

## 非自明な制約・注意事項

### デバッグフラグ運用
- デバッグ状態は `src/constants/config.ts` の `ENABLE_DEBUG_CONTROLS` で制御する（Xcodeビルド種別では判定しない）。
- `ENABLE_DEBUG_CONTROLS` は **false のままコミットすること**。
- コミットに true が含まれていた場合は、必ず false に戻すこと。
- Codexで作業する場合も、この `CLAUDE.md` の内容を参照して従うこと。

### ジオフェンス
- iOS CLMonitor（iOS 17+）カスタムネイティブモジュール実装。`expo-task-manager` は不使用。
- **登録上限20件**。超過時は目的駅側を優先して切り詰める（`computeGeofenceStations`）。
- ジオフェンスは **iOS専用**。Androidでは何もしない。
- `stopAlarmSound()` はJS・Swift両方を止める。片方だけでは不完全。

### アラーム動作
- フォアグラウンド → JS（expo-av）
- バックグラウンド/ロック → Swift（AlarmAudioPlayer）
- Kill後 → AppDelegate が `.location` 起動を検知して CLMonitor に再購読
- `SoundType='vibration'` はUI表示「通知のみ（音なし）」（iOS制限でバイブ繰り返し不可）

### 経路計算
- グラフノードは `groupId`（同一物理駅を束ねたID）。`stationCd` 直接ではない。
- `active.tsx` 起動時、複数ルートを非同期でバックグラウンド計算（`calculateMultipleRoutes`）。初回表示には初期ルートのみ使う。
- `route-edit.tsx` での乗り継ぎ追加時は `dijkstra()` で前後両セグメントの到達可能性を個別検証する。後続が切断される場合は警告→ユーザーOKで以降を削除。

### プレミアム
- 提供しない

### 翻訳
- キーを `ja.ts` に追加したら必ず `en.ts` にも追加すること。
- `i18n/index.ts` に既存の型エラーあり（en のリテラル型が ja と一致しない構造的問題）。修正不要。

### その他既知エラー（修正不要）
- `notification.ts` — expo-notifications の型バージョン不一致（動作には影響なし）

### バージョン管理
- ネイティブ変更時は `app.json` の `runtimeVersion` も必ず上げる（古いバイナリに壊れたJSが配信されるのを防ぐため）。
- React Nativeのバージョンは `version.json` に記載する。1.0.xのx部分をインクリメントすること
