# ストア掲載文案（日本語）

## 拡張名

Box Direct Link Copy

## 概要（短文）

Box の一覧画面で、期限付き共有リンクではなく `/folder/{id}` / `/file/{id}` の直リンクをすばやくコピーできます。

## 詳細説明（長文）

Box 一覧で「共有リンクの作成とコピー」を使うと、`/s/...` 形式の共有リンクが生成されます。
この拡張は、Box の一覧行から `...app.box.com/folder/{id}` / `...app.box.com/file/{id}` を直接コピーするためのツールです。

### 主な機能

- 一覧のファイル名セル右端アイコンから直リンクをコピー
- 行メニュー（その他のオプション）で `ダウンロード` の上に `直リンクをコピー` を追加
- コピー成功/失敗をトーストで表示

### 対応環境

- Box Web アプリの一覧表示（List view）
- `https://app.box.com/*` および `https://*.app.box.com/*`

### 注意

- Box へログイン済みかつ対象アイテムへの権限が必要です
- Box 側の UI 変更により一時的に動作しなくなる場合があります

## カテゴリ候補

Productivity

## サポート URL

https://github.com/cloudnative-co/crx-box-direct-link/issues
