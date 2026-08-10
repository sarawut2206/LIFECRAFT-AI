/**
 * Life Competency UP TO GROW — Backend (Google Apps Script)
 * ใช้คู่กับ uptogrow-web.html
 *
 * วิธีติดตั้ง
 * 1. สร้าง Google Sheet ใหม่ 1 ไฟล์ ตั้งชื่ออะไรก็ได้ เช่น UPTOGROW-M4-4
 * 2. เมนู ส่วนขยาย (Extensions) > Apps Script
 * 3. ลบโค้ดเดิมทั้งหมด แล้ววางไฟล์นี้ลงไป
 * 4. กด Deploy > New deployment > เลือกชนิด Web app
 *      Execute as        : Me (บัญชีของครู)
 *      Who has access    : Anyone   <-- สำคัญมาก ถ้าเลือก Anyone with Google account นักเรียนจะส่งไม่ได้
 * 5. คัดลอกลิงก์ที่ลงท้ายด้วย /exec ไปวางในไฟล์ uptogrow-web.html ตรงบรรทัด const API = '...'
 * 6. ถ้าแก้โค้ดนี้ภายหลัง ต้อง Deploy > Manage deployments > แก้ไข > New version ทุกครั้ง
 */

var SHEET_NAME = 'responses';

/* ====== ถ้าต้องการให้ AI Coach ทำงานจริงบนเว็บ ให้ใส่ API key ตรงนี้ ======
   ถ้าเว้นว่างไว้ ระบบจะใช้คลังคำถามสำรองในหน้าเว็บแทน ซึ่งกิจกรรมยังเดินได้ปกติ
   key จะอยู่บนเซิร์ฟเวอร์ของ Apps Script ไม่ถูกเปิดเผยให้นักเรียนเห็น       */
var ANTHROPIC_API_KEY = '';

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(['key', 'name', 'updated', 'json']);
    sh.setFrozenRows(1);
  }
  return sh;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  return json_({ ok: true, msg: 'UP TO GROW backend พร้อมใช้งาน' });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    var req = JSON.parse(e.postData.contents);

    if (req.action === 'coach') return json_(coach_(req));

    lock.waitLock(20000);
    var sh = sheet_();
    var data = sh.getDataRange().getValues();

    if (req.action === 'save') {
      var row = -1;
      for (var i = 1; i < data.length; i++) {
        if (data[i][0] === req.key) { row = i + 1; break; }
      }
      var values = [req.key, req.name || '', new Date(), req.json];
      if (row > 0) sh.getRange(row, 1, 1, 4).setValues([values]);
      else sh.appendRow(values);
      return json_({ ok: true });
    }

    if (req.action === 'get') {
      for (var j = 1; j < data.length; j++) {
        if (data[j][0] === req.key) return json_({ ok: true, json: data[j][3] });
      }
      return json_({ ok: true, json: null });
    }

    if (req.action === 'all') {
      var rows = [];
      for (var k = 1; k < data.length; k++) {
        rows.push({ key: data[k][0], name: data[k][1], json: data[k][3] });
      }
      return json_({ ok: true, rows: rows });
    }

    return json_({ ok: false, error: 'ไม่รู้จักคำสั่ง ' + req.action });

  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}

function coach_(req) {
  if (!ANTHROPIC_API_KEY) return { ok: false, error: 'ยังไม่ได้ตั้งค่า API key' };
  try {
    var res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      payload: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 300,
        system: req.system,
        messages: [{ role: 'user', content: req.prompt }]
      }),
      muteHttpExceptions: true
    });
    var data = JSON.parse(res.getContentText());
    var text = (data.content || []).filter(function (b) { return b.type === 'text'; })
      .map(function (b) { return b.text; }).join('\n');
    return { ok: true, reply: text };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/** รันฟังก์ชันนี้ครั้งเดียวเพื่อทดสอบว่า Sheet ถูกสร้างถูกต้อง */
function testSetup() {
  var sh = sheet_();
  sh.appendRow(['lc:test', 'ทดสอบระบบ', new Date(), '{"name":"ทดสอบระบบ"}']);
  Logger.log('สร้างชีตและเขียนแถวทดสอบเรียบร้อย ให้ลบแถว lc:test ออกก่อนใช้จริง');
}
