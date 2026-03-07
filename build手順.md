
### Xcodeビルドの手順

1. **プロジェクトを「ネイティブ化」する**
ターミナルで以下のコマンドを実行します。これにより `ios` フォルダが作成され、中に `.xcworkspace` ファイルが生成されます。
```bash
npx expo prebuild

```


2. **Xcodeで開く**
生成された `ios/app.xcworkspace`（プロジェクト名）をXcodeで開きます。

3. **署名（Signing）の設定**
Xcodeの「Signing & Capabilities」タブで、自分のApple Developer Teamを選択し、エラー（Redistribution Certificateがない等）が出ていないか確認します。

4. **アーカイブとアップロード**
* Xcode上部のデバイス選択で **「Any iOS Device (arm64)」** を選択。
* メニューの **Product > Archive** を実行。
* ビルド完了後、ウィンドウが開くので **Distribute App > TestFlight & App Store** を選択して指示に従います。



---

### EAS Build と Xcodeビルドの比較

| 特徴 | EAS Build (推奨) | Xcodeビルド |
| --- | --- | --- |
| **PC負荷** | ほぼゼロ（Expoのサーバーで実行） | 高い（自分のMacのファンが回ります） |
| **環境構築** | 不要 | CocoaPodsやXcodeのバージョン管理が必要 |
| **自動化** | `eas.json` で設定を完結できる | Xcodeの設定画面をポチポチする必要がある |
| **安心感** | Expoが最適な設定を自動で行う | 自分で証明書周りのエラーを解く必要がある |

### Expoだけでのビルド

```bash
eas build --profile production --platform ios --local
```
自動でビルドが進み、App Store Connectにアップロードされる。

2. ビルドされたバイナリをストアに提出（アップロード）する
ビルドが完了したら、そのバイナリをAppleのサーバーへ送ります。

```bash
eas submit --profile production --platform ios

> Provide a path to a local app binary file を選択
```