# みかんレビュー - AI Assistant Guide

このドキュメント（`AGENTS.md`）は、AIアシスタントがこのプロジェクトの構成や仕様を素早くかつ正確に理解するためのガイドラインです。

---

## 🍊 プロジェクト概要
🍊 みかんの品種ごとに「甘味・酸味・剥きやすさ・コク・食感」を5段階で評価し、レビューを蓄積するWebアプリ（PWA対応）。サーバーやDBは持たず、**ブラウザの `localStorage` にデータを保存し、CSVとしてエクスポート/インポートする**シンプルな構成です。

## 🛠 コア技術スタック
- **Frontend**: HTML5 / CSS3 / Vanilla JavaScript（フレームワーク不使用）
- **データ保存**: `localStorage`（キー: `mikan_reviews`、JSON配列）
- **ホスティング**: GitHub Pages（`https://naoyamashita.github.io/mikan-reviews/`）

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
ID, 日付, 品種, 甘味, 酸味, 剥きやすさ, コク, 食感, 感想・メモ
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

### 4. デプロイ手順
コードを修正した場合は以下を実行してWebに反映させてください:
```bash
git add -A && git commit -m "変更内容" && git push
```
GitHub Pagesへの反映には数分かかる場合があります。

## 🔮 今後の拡張アイデア
- 品種ごとの平均スコア集計・ランキング表示
- グラフ（レーダーチャート）での可視化
- 写真の添付
