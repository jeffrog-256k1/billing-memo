# Billing Memo

[English](README.md) · [한국어](README.ko.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [Español](README.es.md)

**すべてのツールを、ひとつの台帳に。** クラウド、ホスティング、DB、メール、API、サブスク費用をローカルで管理します。

[Windows v0.3.0 をダウンロード](https://github.com/jeffrog-256k1/billing-memo/releases/latest) · [Web アプリ](https://jeffrog-256k1.github.io/billing-memo/) · [サンプルを見る](https://jeffrog-256k1.github.io/billing-memo/?demo=1)

![初回の空の台帳](assets/empty.png)

## 空の台帳から、ひとつの画面で管理

1. 初回は**空の台帳**です。デスクトップ版にデモモードやサンプル契約はありません。
2. サービス名、金額、通貨、周期、最初の請求日を登録します。請求リンクは任意、プロジェクト・分類・メモは必要なときに展開します。
3. **自分の台帳**でサービスの追加・編集、月の切り替え、月額請求・支払済み・残り見積もりをまとめて確認できます。
4. 支払い後に実額を記録し、**台帳ツール**から JSON をバックアップ・復元します。

![明示的に選んだ架空のデータ](assets/overview.png)

Web 版も初回は空です。ツールメニューや上のリンクから選んだ場合だけデモを表示します。デモの編集は一時的で、自分の台帳を上書きしません。「自分の台帳を開く」で保存済みの項目に戻ります。サンプルは実際の料金ではありません。

## 軽量な Windows アプリ

0.3 は Electron を **Tauri とシステムの WebView2** に置き換えました。ローカル Web UI を使いますが、Chromium/Node を同梱しません。WebView2 導入後はオフラインで使えます。未導入・旧バージョンの場合はインストーラーが別途ダウンロードします。そのサイズは小型インストーラーの容量に含まれません。

Windows 10/11 x64 向けです。インストーラー、または ZIP を展開して **Billing Memo.exe** を実行します。ZIP も WebView2 が必要です。保存先は **%APPDATA%/app.leejungjae.billingmemo/ledger.json** で、USB 内にデータを保持する方式ではありません。未署名のため Windows に発行元/SmartScreen の通知が出る場合があります。SHA256SUMS.txt を同梱し、自動更新は行いません。

0.2 からの更新前に旧版を閉じ、JSON をバックアップしてください。初回に旧版の標準プロファイルから保存済み台帳のコピーを試みます。元ファイルを変更せず、デモは取り込みません。失敗時は通知し、JSON で復元できます。0.1/0.2 のバックアップは互換です。[デスクトップガイド](docs/DESKTOP.md)

## 3 つのページ

- **自分の台帳：** サービス、請求リンク、月合計、支払い状態、検索とプロジェクト/分類/状態フィルター、予算、折りたたみ式の 6 か月予測。上部の月合計はリストの絞り込みに関係なく全件です。
- **支払いカレンダー：** 期日、日付フィルター、月別 CSV、未払い請求の ICS リマインダー。
- **期間レポート：** 開始日〜終了日（両端を含む）、期間合計、月別金額、平均、分類・プロジェクトの絞り込み、明細と月別 CSV。実際の支払日か請求予定日で集計します。最大 120 暦月、平均には空の月と一部の日だけの月も含まれます。

## 計算と保存

月払い・年払い・単発・従量に対応します。従量は **月の合計見積もりを手入力**し、API 計測はしません。31 日請求は短い月の末日になり、翌月は 31 日に戻ります。年額は請求月に全額計上し、経常費用の月換算だけ 12 で割ります。

月合計は支払済み実額と未払い見積もりの和です。1 月請求を 2 月に払うと、台帳では 1 月、実際の支払日レポートでは 2 月に含めます。編集・停止・削除後も支払い記録を保持します。編集は過去を含めた未払い見積もりに反映します。サービスごとに月 1 件で、追加取引は単発項目として登録します。

USD・KRW・EUR・JPY・CNY・GBP を最小通貨単位の整数で保存します。KRW/JPY は小数なし。手動為替が未入力なら通貨別合計と部分換算を表示します。表示通貨の変更で為替と予算をリセットします。自動更新・過去の為替参照はありません。

デスクトップはローカル JSON、Web はブラウザーの localStorage です。ログイン・サーバー・同期はなく、相互移行は JSON で行います。復元は確認後に対象台帳を置き換えます。ブラウザーデータの削除で Web 台帳も消えます。保存失敗や破損は表示し、自動初期化しません。

上限：サービス 500 件、支払い記録 5,000 件、台帳/JSON 2 MiB、2000〜2199 年、名称 80 文字、メモ 2,000 文字。金額は非負、1 件 1,000 億最小通貨単位まで。認証情報を含まない HTTPS のみ許可します。データは暗号化されません。パスワード・API キー・カード情報を保存しないでください。自動引落し・請求書連携・バックグラウンド通知はなく、ICS 通知はカレンダーアプリが処理します。

## Development

Node.js 22.12+ and npm:

```sh
git clone https://github.com/jeffrog-256k1/billing-memo.git
cd billing-memo
npm ci
npm run dev
```

```sh
npm test
npm run build
npx playwright install chromium
npm run test:browser
npm run test:reports
npm run format:check
```

The local dev command builds and previews the production CSP; rerun after source changes. Windows builds also require stable Rust, MSVC C++ Build Tools and WebView2. See [desktop build instructions](docs/DESKTOP.md). No provider keys are needed.

[Contributing](CONTRIBUTING.md) · [Security](SECURITY.md) · [Dependencies](THIRD_PARTY_NOTICES.md)

Built by [jeffrog-256k1](https://github.com/jeffrog-256k1) · [leejungjae.app](https://leejungjae.app)
