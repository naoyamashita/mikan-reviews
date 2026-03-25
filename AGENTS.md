# みかんレビュー - AI Assistant Guide

このドキュメント（`AGENTS.md`）は、AIアシスタントがこのプロジェクトの構成や仕様を素早くかつ正確に理解するためのガイドラインです。

---

## 🍊 プロジェクト概要
🍊 複数メンバー（2〜3人）で「評価者名」を入力し、みかんのレビューを蓄積するWebアプリ。
同じ品種を別々のメンバーが評価した場合、表示上で自動的に平均値を算出し、コメントを併記して品種ごとにまとめます。
サーバーやDBは持たず、**ブラウザの `localStorage` にデータを保存し、CSVとしてエクスポート/インポートする**シンプルな構成です。

## 🛠 コア技術スタック
- **Frontend**: HTML5 / CSS3 / Vanilla JavaScript（フレームワーク不使用）
- **データ保存**: `localStorage`（キー: `mikan_reviews`）および **`mikan_reviews.csv`（サーバー同期）**
- **ホスティング**: GitHub Pages（静的表示）+ ローカルNode.jsサーバー（データ保存用）

## 📁 ファイル構成

| ファイル | 役割 |
|---|---|
| `index.html` | アプリの構造。入力フォーム＋レビュー一覧 |
| `style.css` | オレンジ系グラスモーフィズムのデザイン |
| `app.js` | ロジック全般（保存・表示・CSV出入力） |
| `manifest.json` | PWA設定（ホーム画面追加用） |
| `apple-touch-icon.png` | iOSホーム画面用アイコン |
| `mikan_reviews.csv` | CSVエクスポートのひな形（ヘッダー定義）|

## ⚙️ 主要な仕様

### 1. データ構造（localStorage）
`localStorage` の `mikan_reviews` キーに以下のJSON配列を保存します:
```json
[
  {
    "id": "1234567890",
    "date": "2026-03-25T07:00:00.000Z",
    "member": "パパ",
    "variety": "温州みかん",
    "sweetness": 4,
    "acidity": 2,
    "peelability": 5,
    "richness": 3,
    "membrane": 4,
    "memo": "甘くて食べやすい"
  }
]
```

### 2. CSVフォーマット
エクスポートCSVのヘッダー列は以下の通りです（順番を変えないこと）:
```
ID, 日付, 評価者, 品種, 甘味, 酸味, 剥きやすさ, コク, 食感, 感想・メモ
```
- ExcelでのBOM問題を避けるため、UTF-8 BOM付きで出力しています。
- インポート時はIDの重複チェックを行い、既存データとのマージが可能です。

### 3. レーダーチャートの軸構成
レーダーチャートは頂点から時計回りに以下の順序で配置されています：
1. **コク** (Top)
2. **甘味** (Top-Right)
3. **食感** (Bottom-Right)
4. **剥きやすさ** (Bottom-Left)
5. **酸味** (Top-Left)

### 4. PWA / キャッシュ対策（重要）
iOSのホーム画面にPWAとして追加されることを前提としています。JS・CSSを改修した際は `index.html` の読み込みURLにクエリパラメータを付与してキャッシュを回避してください:
```html
<link rel="stylesheet" href="style.css?v=2">
<script src="app.js?v=2"></script>
```

### 📡 データ同期（CSVサーバー）
複数端末でデータを共有するために、ローカルで `server.js` を実行します。
```bash
node server.js
```
これにより、ブラウザの `localStorage` だけでなく、同一階層の `mikan_reviews.csv` に自動的に保存・読み込みが行われます。

## ⚙️ 主要な仕様
...
- 品種ごとの平均スコア集計・ランキング表示
- グラフ（レーダーチャート）での可視化
- 写真の添付
