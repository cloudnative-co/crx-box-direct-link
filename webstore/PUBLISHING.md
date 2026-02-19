# Chrome Web Store 公開手順

## 1. 事前確認

- `manifest.json` の `version` を更新
- 変更内容を手動確認（Box 一覧でコピー動作、メニュー注入、トースト表示）
- `webstore/SECURITY-REVIEW-2026-02-19.md` の観点で再チェック
- 提出ZIPを生成

```bash
./scripts/build-webstore-zip.sh
```

## 2. Developer Dashboard で新規公開

1. Chrome Developer Dashboard を開く
2. `Add new item` で ZIP をアップロード
3. `Store listing` タブを入力
4. `Privacy` タブを入力
5. `Distribution` を設定
6. `Submit for review`

## 3. Store listing で必要な素材

- Store icon: `128x128`（`assets/icons/icon128.png`）
- Screenshot: 最低1枚（推奨5枚、`1280x800` または `640x400`）
- Small promo tile: `440x280`（PNG/JPEG）
- Marquee promo tile: `1400x560`（任意）

## 4. Privacy タブ入力方針（本拡張）

- 単一目的: Box 一覧で直リンクをコピーする
- 外部送信: なし
- 認証情報収集: なし
- サーバー通信: なし（コンテンツスクリプトのみ）
- ユーザーデータの収集・販売: なし

## 5. レビューで落ちにくくするための注意

- ストア説明に「Box へログイン済みであること」を明記
- UI と説明の機能一致（単一目的）
- 不要な permission を追加しない
- リリースノートに変更点を記載

## 参考（公式）

- Publish in the Chrome Web Store: https://developer.chrome.com/docs/webstore/publish/
- Complete your listing information: https://developer.chrome.com/docs/webstore/cws-dashboard-listing
- Fill out the privacy fields: https://developer.chrome.com/docs/webstore/cws-dashboard-privacy/
- Configure extension icons: https://developer.chrome.com/docs/extensions/develop/ui/configure-icons
- Quality guidelines (single purpose): https://developer.chrome.com/docs/webstore/program-policies/quality-guidelines
