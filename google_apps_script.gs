/**
 * Mikan Review DB - Google Apps Script Backend (Unified Version)
 * 
 * 使い方:
 * 1. このコードをGASエディタに貼り付けて保存（Ctrl+S）します。
 * 2. 下の SHEET_ID の部分にご自身のスプレッドシートのIDを貼り付けてください。
 * 3. 上部のツールバーで「testConnection」を選択して「実行」し、承認を完了させます。
 * 4. 「デプロイ」 > 「新しいデプロイ」 > 「ウェブアプリ」を選択。
 * 5. アクセスできるユーザーを「全員（Anyone）」に設定してデプロイします。
 * 6. 発行されたURLをアプリの設定画面に貼り付けてください。
 */

// --- 設定エリア ---
// スプレッドシートのURLから ID（https://docs.google.com/spreadsheets/d/ここ/edit の部分）を貼り付けてください
const SHEET_ID = "ここにスプレッドシートのIDを貼り付け"; 
const PASSCODE = "mikan"; 

function getSheet() {
  if (SHEET_ID.includes("ここに")) {
    throw new Error("スプレッドシートのIDが設定されていません。プログラムの冒頭を確認してください。");
  }
  return SpreadsheetApp.openById(SHEET_ID).getActiveSheet();
}

// 接続テスト用（エディタでこれを選択して「実行」してください）
function testConnection() {
  try {
    const sheet = getSheet();
    Logger.log("接続成功！シート名: " + sheet.getName());
  } catch (e) {
    Logger.log("【エラー】" + e.message);
  }
}

// すべての通信（読み・書き）を受け取ります
function doGet(e) {
  try {
    const action = e.parameter.action;
    const sheet = getSheet();
    
    // --- 保存処理 (action=save) ---
    if (action === "save") {
      const payload = JSON.parse(e.parameter.data);
      if (payload.passcode !== PASSCODE) throw new Error("Unauthorized: パスコードが一致しません");
      
      sheet.clear();
      const headers = ["ID", "日付", "評価者", "品種", "甘味", "酸味", "剥きやすさ", "コク", "食感", "感想・メモ"];
      sheet.appendRow(headers);
      
      if (payload.reviews && Array.isArray(payload.reviews)) {
        payload.reviews.forEach(r => {
          sheet.appendRow([
            r.id, r.date, (r.member || ""), (r.variety || ""), 
            (r.sweetness || 0), (r.acidity || 0), (r.peelability || 0), 
            (r.richness || 0), (r.membrane || 0), (r.memo || "")
          ]);
        });
      }
      return createResponse({ success: true, count: (payload.reviews || []).length }, e.parameter.callback);
    }
    
    // --- 読み込み処理 (action=load または指定なし) ---
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return createResponse([], e.parameter.callback); // ヘッダーのみの場合などは空配列

    const headers = data[0];
    const rows = data.slice(1);
    const result = rows.map(row => {
      let obj = {};
      headers.forEach((header, i) => {
        const map = { "ID": "id", "日付": "date", "評価者": "member", "品種": "variety", "甘味": "sweetness", "酸味": "acidity", "剥きやすさ": "peelability", "コク": "richness", "食感": "membrane", "感想・メモ": "memo" };
        const key = map[header] || header;
        obj[key] = row[i];
      });
      return obj;
    });
    return createResponse(result, e.parameter.callback);

  } catch (err) {
    return createResponse({ error: err.toString() }, e.parameter.callback);
  }
}

// ブラウザや環境によってPOSTで送られてくる場合もあるため、doGetに転送します
function doPost(e) {
  return doGet(e);
}

function createResponse(data, callback) {
  const json = JSON.stringify(data);
  // JSONP（コールバック指定がある場合）と通常のJSONの両方に対応
  if (callback) {
    return ContentService.createTextOutput(callback + '(' + json + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}
