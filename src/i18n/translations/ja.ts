const ja = {
  // 共通
  'common.ok': 'OK',
  'common.cancel': 'キャンセル',
  'common.error': 'エラー',
  'common.loading': '読み込み中...',
  'common.reset': 'リセット',
  'common.done': '完了',
  'common.failed': '処理に失敗しました。',

  // アプリ全体
  'app.title': '駅で起こして',

  // タブ
  'tabs.home': 'ホーム',
  'tabs.history': '履歴',
  'tabs.settings': '設定',

  // 履歴画面
  'history.screenTitle': '履歴',

  // ホーム画面
  'home.startSession': '「駅で起こして」開始',
  'home.startSessionSub': '目的駅を設定して寝過ごし防止',
  'home.noHistory': 'まだ履歴がありません',
  'home.sessionActiveTitle': '「駅で起こして」実施中',
  'home.sessionActiveMessage': 'すでに「駅で起こして」が進行中です。「駅で起こして」画面に移動しますか？',
  'home.goToSession': '移動する',

  // セッション開始画面（イヤホン検出）
  'session.new.headphoneConnected': 'イヤホン・ヘッドホン接続中',
  'session.new.headphoneNotConnected': 'イヤホン・ヘッドホン未接続 - アラーム音は利用できません',

  // セッション開始画面
  'session.new.screenTitle': '経路を設定する',
  'session.new.locating': '現在地から最寄駅を取得中...',
  'session.new.origin': '出発駅',
  'session.new.destination': '目的地',
  'session.new.originPlaceholder': '出発駅を入力',
  'session.new.destPlaceholder': '目的駅を入力',
  'session.new.sound': 'サウンド',
  'session.new.soundAlarm': 'アラーム音',
  'session.new.soundMusic': '音楽',
  'session.new.soundVibration': '通知のみ（音なし）',
  'session.new.radius': '駅検出半径',
  'session.new.radiusHint': '地下鉄や都市部は大きめ推奨',
  'session.new.confirm': '開始する',
  'session.new.errorNoOrigin': '出発駅を設定してください。',
  'session.new.errorNoDest': '目的地を設定してください。',
  'session.new.errorSameStation': '出発駅と目的駅が同じです。',
  'session.new.calcErrorTitle': '経路計算エラー',
  'session.new.calcErrorFallback': '経路計算に失敗しました。',

  // 経路確認画面
  'session.confirm.screenTitle': '経路確認  この駅で起こします！',
  'session.confirm.heading': '経路を確認してください',
  'session.confirm.totalStations': '全{count}駅',
  'session.confirm.detectionRadius': '検出半径: {radius}m',
  'session.confirm.soundLabel': 'サウンド: {type}',
  'session.confirm.start': '開始',
  'session.confirm.noRoute': '経路データが見つかりません。',
  'session.confirm.startErrorFallback': '「駅で起こして」の開始に失敗しました。',
  'session.confirm.routeIndex': '経路 {current} / {total}',

  // セッション中画面
  'session.active.route': '経路  この駅で起こします！',
  'session.active.screenTitle': '「駅で起こして」実施中',
  'session.active.status': '「駅で起こして」実施中',
  'session.active.originLabel': '出発',
  'session.active.destinationLabel': '目的地',
  'session.active.stationsCount': '経路: {count}駅',
  'session.active.detectionRadius': '検出半径: {radius}m',
  'session.active.countdown': '有効時間',
  'session.active.end': '終了',
  'session.active.endTitle': '終了',
  'session.active.endMessage': '「駅で起こして」を終了して駅の登録を解除しますか？',
  'session.active.endConfirm': '終了する',
  'session.active.soundLabel': 'サウンド',
  'session.active.radius': '駅検出半径',
  'session.active.headphoneConnected': 'イヤホン・ヘッドホン接続中',
  'session.active.headphoneNotConnected': '未接続',
  'session.active.alarmNote': 'イヤホン・ヘッドホンが切断された場合は自動でバイブに切り替わります',
  'session.active.debugTitle': 'DEBUG CONTROLS',
  'session.active.debugSubway': '地下鉄状態 {state}',
  'session.active.debugGpsLowAccuracy': '位置情報: 不安定 {state}',
  'session.active.debugHeadphone': 'イヤホン {state}',
  'session.active.debugArrive': '目的地到着',
  'session.active.debugTapMove': '現在地ロングタップ移動 {state}',
  'session.active.safetySafe': '位置情報: 良好',
  'session.active.safetySafeBody': '到着検知が期待できる状態です。',
  'session.active.safetyDanger': '位置情報: 不安定',
  'session.active.safetyDangerBody': '地下区間では到着検知を技術的に保証できません。',
  'session.active.safetyDangerAction': '地上区間に戻るまで本機能は補助用途としてお使いください。',
  'session.active.gpsDangerAlert': '位置情報が不安定なため、駅を正しく検知できない可能性があります。',
  'session.active.subwayDangerStrong': '地下区間では到着検知を技術的に保証できません',
  'session.active.subwayDebugForced': 'デバッグ: 地下鉄区間として強制し、危険状態で判定中',

  // アラーム発火画面
  'alarm.fired.title': '駅に近づいています！',
  'alarm.fired.stationSuffix': '駅',
  'alarm.fired.subtitle': 'そろそろ起きる準備をしてください',
  'alarm.fired.dismiss': '起きた！（停止）',

  // 到着画面
  'alarm.arrived.title': '目的地に到着しました！',
  'alarm.arrived.stationSuffix': '駅',
  'alarm.arrived.dismiss': '閉じる',

  // 設定画面
  'settings.arrivalCount': '目的地到着 {count}回',
  'settings.screenTitle': '設定',
  'settings.sectionData': 'データ',
  'settings.reimport': '駅データを再インポート',
  'settings.reimportSub': '駅データ.jp CSVを再読み込みします',
  'settings.reimportTitle': 'データベースをリセット',
  'settings.reimportMessage': '駅データを再インポートします。次回起動時に自動で再取得されます。\n\nよろしいですか？',
  'settings.reimportDone': '次回起動時に駅データを再インポートします。',
  'settings.sectionAbout': 'アプリについて',
  'settings.privacy': 'プライバシーポリシー',
  'settings.terms': '利用規約',
  'settings.version': 'バージョン',
  'settings.sectionLanguage': '言語 / Language',
  'settings.langJa': '日本語',
  'settings.langEn': 'English',
  'settings.reimportConfirm': 'リセット',
  'settings.sectionNotices': '注意事項',
  'settings.noticeText':
    '• バックグラウンドでの位置情報取得はバッテリーを消費します。\n\n• iOSでは最大20個の駅が同時に登録できます。経路が20駅を超えた場合、目的駅付近の駅のみ登録されます。\n\n• 地下鉄などGPS精度が下がる環境では、検出半径を大きめに設定することを推奨します。\n\n• 駅データは駅データ.jp（https://ekidata.jp/）を使用しています。新幹線は対象外です。',

  // 駅名検索コンポーネント
  'stationSearch.placeholder': '駅名を入力',
  'stationSearch.noResult': '「{keyword}」に一致する駅が見つかりませんでした',

  // セッション履歴カード
  'sessionCard.statusActive': '「駅で起こして」実施中',
  'sessionCard.statusCompleted': '完了',
  'sessionCard.statusCancelled': 'キャンセル',
  'sessionCard.stations': '{count}駅',
  'sessionCard.deleteTitle': '履歴を削除',
  'sessionCard.deleteMessage': 'この履歴を削除しますか？',
  'sessionCard.delete': '削除',

  // 通知
  'notification.title': '🚉 駅に近づいています！',
  'notification.body': '{station}に近づいています。起きてください！',

  // 地下鉄警告
  'subway.warningTitle': '地下区間を含む経路です',
  'subway.warningBody': '地下鉄などGPSが届きにくい区間では、検出の精度が低下する可能性があります。',
  'subway.warningStations': '対象駅: {stations}',

  // 経路編集
  'routeEdit.screenTitle': '経路を編集',
  'routeEdit.addTransfer': '乗り継ぎ駅を追加',
  'routeEdit.confirm': '編集を確定',
  'routeEdit.cancel': 'キャンセル',
  'routeEdit.origin': '出発（固定）',
  'routeEdit.destination': '目的地（固定）',
  'routeEdit.transfer': '乗り継ぎ',
  'routeEdit.unreachable': '選択した駅に到達できません。別の駅を選んでください。',
  'routeEdit.truncateWarning': '後続の乗り継ぎ駅・目的地に到達できないため削除されます。よろしいですか？',
  'routeEdit.applied': '経路を更新しました',
  'routeEdit.applying': '経路を再計算中...',

  // セッション中 - 経路編集・保存
  'session.active.editRoute': '経路編集',
  'session.active.saveRoute': '保存',
  'session.active.routeSaved': 'マイルートに保存しました',

  // マイルート
  'myRoute.screenTitle': 'マイルート',
  'myRoute.empty': 'まだ保存されたルートがありません',
  'myRoute.startButton': 'このルートで開始',
  'myRoute.deleteTitle': '削除',
  'myRoute.deleteMessage': 'このマイルートを削除しますか？',
  'myRoute.delete': '削除',
  'myRoute.starting': '開始中...',
  'myRoute.duplicateTitle': 'すでに登録済み',
  'myRoute.duplicateMessage': '同じ経路（出発・乗り継ぎ・目的地）がマイルートにすでに登録されています。',

  // ホーム
  'home.myRoutes': 'マイルート',

  // プライバシーポリシー
  'privacy.screenTitle': 'プライバシーポリシー',
  'privacy.updated': '最終更新日: 2026年3月5日',
  'privacy.section1Title': '1. 収集する情報',
  'privacy.section1Body': '本アプリは位置情報（GPS）のみを利用します。現在地の最寄駅算出と、目的駅への接近検知（ジオフェンス）のためにバックグラウンドを含めて取得します。',
  'privacy.section2Title': '2. 情報の利用目的',
  'privacy.section2Body': '位置情報はアラームのトリガー（目的駅への接近検知）のためにのみ使用します。それ以外の目的には使用しません。',
  'privacy.section3Title': '3. データの保存・送信',
  'privacy.section3Body': 'すべてのデータはお使いのデバイス内にのみ保存されます。外部サーバーへの送信や第三者への提供は一切行いません。',
  'privacy.section4Title': '4. 広告・解析',
  'privacy.section4Body': '本アプリには広告は表示されません。また、解析ツールや行動トラッキングは使用していません。',
  'privacy.section5Title': '5. お問い合わせ',
  'privacy.section5Body': 'プライバシーポリシーに関するご質問は、App Storeのレビューよりご連絡ください。',

  // エラー
  'error.loadSessions': '「駅で起こして」履歴の読み込みに失敗しました',
  'error.startSession': '「駅で起こして」の開始に失敗しました',
  'error.completeSession': '「駅で起こして」の完了処理に失敗しました',
  'error.cancelSession': '「駅で起こして」のキャンセルに失敗しました',
  'error.deleteSession': '履歴の削除に失敗しました',
  'error.noRoute': '経路が見つかりませんでした。駅の組み合わせを確認してください。',
} as const;

export type TranslationKey = keyof typeof ja;
export default ja;
