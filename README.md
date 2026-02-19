# crx-box-direct-link

Box の一覧画面で、各行に「直リンクをコピー」ボタンを追加する Chrome Extension (Manifest V3) です。

- フォルダ行: `https://<tenant>.app.box.com/folder/{id}`
- ファイル行: `https://<tenant>.app.box.com/file/{id}`
- 表示位置: ファイル名/フォルダ名セルの右端に専用アイコンを追加
- 行メニュー（その他のオプション）では `ダウンロード` の上に `直リンクをコピー` を追加
- UIメッセージは `ja` ロケールで日本語、それ以外で英語を表示

## 使い方

1. Chrome で `chrome://extensions` を開く
2. 「デベロッパー モード」を有効化
3. 「パッケージ化されていない拡張機能を読み込む」からこのディレクトリを選択
4. Box 一覧画面を開き、行のアクション列で「直リンクをコピー」を押す

## 実装メモ

- 一覧行セレクタ: `.ReactVirtualized__Table__row.table-row[data-testid^="ListViewTableRow-"]`
- ID 抽出:
  - フォルダ: `data-resin-folder_id`
  - ファイル: `data-resin-file_id`
  - フォールバック: `a.item-link` の `href`
- UI 変化に追従するため `MutationObserver` + 定期スキャンでボタンを再注入
- 見た目は共有リンクと区別できるよう、青系グラデーションの独自アイコンで表示
- クリック時は成功/失敗に応じてボタン色を変え、クリックしたアイコン付近にトーストを短時間表示

## 制約

- 現在は Box のリストビューを対象にしています
- Box 側の DOM 構造が変わると調整が必要です
