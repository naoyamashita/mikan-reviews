/**
 * Mikan Review DB - Google Apps Script Backend
 * 
 * 使い方:
 * 1. Googleスプレッドシートを作成し、1行目に以下のヘッダーを入力します。
 *    ID, 日付, 評価者, 品種, 甘味, 酸味, 剥きやすさ, コク, 食感, 感想・メモ
 * 2. 「拡張機能」 > 「Apps Script」を開き、このコードを貼り付けて保存します。
 * 3. 「デプロイ」 > 「新しいデプロイ」 > 「ウェブアプリ」を選択。
 * 4. アクセスできるユーザーを「全員」に設定してデプロイします。
 * 5. 発行されたURLをアプリの設定画面に貼り付けてください。
 */

const PASSCODE = "mikan"; // アプリ側のパスコードと一致させてください

function doGet(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const rows = data.slice(1);
  
  const result = rows.map(row => {
    let obj = {};
    headers.forEach((header, i) => {
      const key = mapHeaderToKey(header);
      obj[key] = row[i];
    });
    return obj;
  });
  
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const params = JSON.parse(e.postData.contents);
    const reviews = params.reviews;
    const passcode = params.passcode;
    
    if (passcode !== PASSCODE) {
      return ContentService.createTextOutput(JSON.stringify({ error: "Unauthorized" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    sheet.clear();
    
    const headers = ["ID", "日付", "評価者", "品種", "甘味", "酸味", "剥きやすさ", "コク", "食感", "感想・メモ"];
    sheet.appendRow(headers);
    
    reviews.forEach(r => {
      sheet.appendRow([
        r.id,
        r.date,
        r.member,
        r.variety,
        r.sweetness,
        r.acidity,
        r.peelability,
        r.richness,
        r.membrane,
        r.memo
      ]);
    });
    
    return ContentService.createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function mapHeaderToKey(header) {
  const map = {
    "ID": "id",
    "日付": "date",
    "評価者": "member",
    "品種": "variety",
    "甘味": "sweetness",
    "酸味": "acidity",
    "剥きやすさ": "peelability",
    "コク": "richness",
    "食感": "membrane",
    "感想・メモ": "memo"
  };
  return map[header] || header;
}
