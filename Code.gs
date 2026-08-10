/**
 * Life Competency UP TO GROW — Backend (Google Apps Script)
 * เวอร์ชันปรับปรุงประสิทธิภาพ · ใช้แทนไฟล์เดิมได้ทันที
 *
 * วิธีติดตั้ง / อัปเดต
 * 1. เปิด Google Sheet ที่ใช้อยู่ > เมนู ส่วนขยาย (Extensions) > Apps Script
 * 2. ลบโค้ดเดิมทั้งหมด แล้ววางไฟล์นี้ลงไป > กดบันทึก
 * 3. Deploy > Manage deployments > กดรูปดินสอ > Version: New version > Deploy
 *    (ลิงก์ /exec เดิมใช้ได้ต่อ ไม่ต้องเปลี่ยนใน index.html)
 *
 * ตั้งค่า Deploy ให้ถูก
 *    Execute as     : Me (บัญชีของครู)
 *    Who has access : Anyone   <-- สำคัญ ถ้าเลือกอย่างอื่นนักเรียนจะส่งไม่ได้
 *
 * ─────────────────────────────────────────────────────────────
 * สิ่งที่เปลี่ยนจากเวอร์ชันเดิม และเหตุผล
 *
 * 1. ค้นหาแถวโดยอ่านเฉพาะคอลัมน์ key
 *    เดิมใช้ getDataRange().getValues() ซึ่งดึงคอลัมน์ json ที่ใหญ่มาก
 *    (แถวละ 10-17 KB) เข้ามาทุกครั้งแม้จะแค่หาแถวเดียว
 *    ทำให้ตอนนักเรียนกดส่งพร้อมกันทั้งห้อง ระบบช้าและอาจส่งไม่สำเร็จ
 *
 * 2. แยกชีตเก็บข้อมูลเช็คอินใจออกจากชีตภารกิจ
 *    เช็คอินใจเพิ่มสัปดาห์ละ 15 แถวตลอดปี ถ้าเก็บรวมกันจะทำให้
 *    การอ่านข้อมูลภารกิจช้าลงเรื่อย ๆ โดยไม่จำเป็น
 *
 * 3. เพิ่มคำสั่ง saveMany  บันทึกหลายรายการในครั้งเดียว
 *    เดิมถ้ามีข้อมูลค้างส่ง 3 รายการ ต้องยิง 3 ครั้ง ครั้งละ 2-3 วินาที
 *
 * 4. เพิ่มตัวกรอง prefix ในคำสั่ง all  และเพิ่มคำสั่ง list
 *    ทำให้หน้าครูดึงเฉพาะข้อมูลที่ต้องใช้ ไม่ต้องโหลดทั้งชีต
 *
 * 5. รองรับข้อมูลเดิมทั้งหมด คำสั่งเก่าใช้ได้เหมือนเดิมทุกอย่าง
 *    หน้าเว็บเวอร์ชันเก่าที่ยังไม่ได้อัปเดตก็ยังทำงานได้ปกติ
 * ─────────────────────────────────────────────────────────────
 */

var SHEET_MAIN  = 'responses';   // ภารกิจ ภารกิจด่วน และการตั้งค่า
var SHEET_PULSE = 'pulse';       // เช็คอินใจรายสัปดาห์
var HEADERS     = ['key', 'name', 'updated', 'json'];
var PULSE_PREFIX = 'lc:pulse:';

/* ---------- ชีต ---------- */
function sheet_(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
  }
  return sh;
}

/** เลือกชีตตามชนิดของ key */
function sheetForKey_(key) {
  return sheet_(String(key).indexOf(PULSE_PREFIX) === 0 ? SHEET_PULSE : SHEET_MAIN);
}

/**
 * หาเลขแถวของ key โดยอ่านเฉพาะคอลัมน์ A
 * จุดสำคัญของการปรับปรุง เพราะไม่ดึงคอลัมน์ json ที่ใหญ่เข้ามาด้วย
 * คืนค่า -1 ถ้าไม่พบ
 */
function findRow_(sh, key) {
  var last = sh.getLastRow();
  if (last < 2) return -1;
  var keys = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < keys.length; i++) {
    if (keys[i][0] === key) return i + 2;
  }
  return -1;
}

/** อ่านทุกแถวของชีต กรองด้วย prefix ถ้าระบุ */
function readRows_(sh, prefix, withJson) {
  var last = sh.getLastRow();
  if (last < 2) return [];
  var vals = sh.getRange(2, 1, last - 1, 4).getValues();
  var out = [];
  for (var i = 0; i < vals.length; i++) {
    var k = vals[i][0];
    if (!k) continue;
    if (prefix && String(k).indexOf(prefix) !== 0) continue;
    if (withJson) out.push({ key: k, name: vals[i][1], json: vals[i][3] });
    else          out.push({ key: k, name: vals[i][1], updated: vals[i][2] });
  }
  return out;
}

/** เขียนหรืออัปเดตหนึ่งรายการ */
function writeOne_(key, name, json) {
  if (!key) return false;
  var sh  = sheetForKey_(key);
  var row = findRow_(sh, key);
  var values = [key, name || '', new Date(), json];
  if (row > 0) sh.getRange(row, 1, 1, 4).setValues([values]);
  else         sh.appendRow(values);
  return true;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  return json_({ ok: true, msg: 'UP TO GROW backend พร้อมใช้งาน', version: 2 });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    var req = JSON.parse(e.postData.contents);

    // เรียก AI ไม่ต้องล็อกและไม่ยุ่งกับชีต
    if (req.action === 'coach') return json_(coach_(req));

    lock.waitLock(25000);

    /* ---------- บันทึกรายการเดียว ---------- */
    if (req.action === 'save') {
      writeOne_(req.key, req.name, req.json);
      return json_({ ok: true });
    }

    /* ---------- บันทึกหลายรายการในครั้งเดียว ---------- */
    if (req.action === 'saveMany') {
      var items = req.items || [];
      var saved = 0;
      for (var i = 0; i < items.length; i++) {
        if (writeOne_(items[i].key, items[i].name, items[i].json)) saved++;
      }
      return json_({ ok: true, saved: saved });
    }

    /* ---------- อ่านรายการเดียว ---------- */
    if (req.action === 'get') {
      var sh  = sheetForKey_(req.key);
      var row = findRow_(sh, req.key);
      if (row > 0) return json_({ ok: true, json: sh.getRange(row, 4).getValue() });

      // เผื่อข้อมูลเช็คอินใจเดิมที่เคยบันทึกไว้ในชีต responses ก่อนแยกชีต
      if (String(req.key).indexOf(PULSE_PREFIX) === 0) {
        var m = sheet_(SHEET_MAIN);
        var r2 = findRow_(m, req.key);
        if (r2 > 0) return json_({ ok: true, json: m.getRange(r2, 4).getValue() });
      }
      return json_({ ok: true, json: null });
    }

    /* ---------- อ่านหลายรายการ กรองด้วย prefix ได้ ---------- */
    if (req.action === 'all') {
      var prefix = req.prefix || '';
      var rows;
      if (prefix.indexOf(PULSE_PREFIX) === 0) {
        rows = readRows_(sheet_(SHEET_PULSE), prefix, true)
                 .concat(readRows_(sheet_(SHEET_MAIN), prefix, true));
      } else if (prefix) {
        rows = readRows_(sheet_(SHEET_MAIN), prefix, true);
      } else {
        // ไม่ระบุ prefix คืนทุกชีตเพื่อให้เข้ากันได้กับหน้าเว็บเวอร์ชันเก่า
        rows = readRows_(sheet_(SHEET_MAIN), '', true)
                 .concat(readRows_(sheet_(SHEET_PULSE), '', true));
      }
      return json_({ ok: true, rows: rows });
    }

    /* ---------- รายการคีย์อย่างเดียว ไม่เอา json ใช้เช็คว่าใครส่งแล้ว ---------- */
    if (req.action === 'list') {
      var p = req.prefix || '';
      var ls = readRows_(sheet_(SHEET_MAIN), p, false)
                 .concat(readRows_(sheet_(SHEET_PULSE), p, false));
      return json_({ ok: true, rows: ls });
    }

    return json_({ ok: false, error: 'ไม่รู้จักคำสั่ง ' + req.action });

  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}

/* ====== ถ้าต้องการให้ AI Coach ทำงานจริงบนเว็บ ให้ใส่ API key ตรงนี้ ======
   ถ้าเว้นว่างไว้ ระบบจะใช้คลังคำถามสำรองในหน้าเว็บแทน ซึ่งกิจกรรมยังเดินได้ปกติ
   key อยู่บนเซิร์ฟเวอร์ของ Apps Script ไม่ถูกเปิดเผยให้นักเรียนเห็น
   แนะนำให้เก็บใน File > Project Settings > Script Properties ชื่อ ANTHROPIC_API_KEY
   จะปลอดภัยกว่าการพิมพ์ไว้ในโค้ดโดยตรง                                    */
function apiKey_() {
  try {
    var p = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
    if (p) return p;
  } catch (e) {}
  return '';   // หรือพิมพ์ค่าคีย์ไว้ตรงนี้แทนก็ได้
}

function coach_(req) {
  var key = apiKey_();
  if (!key) return { ok: false, error: 'ยังไม่ได้ตั้งค่า API key' };
  try {
    var res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
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

/* ---------------- เครื่องมือสำหรับครู รันจากเมนู Apps Script ---------------- */

/** ตรวจว่าชีตพร้อมใช้งาน และดูจำนวนข้อมูลปัจจุบัน */
function checkSetup() {
  var m = sheet_(SHEET_MAIN), p = sheet_(SHEET_PULSE);
  Logger.log('ชีต %s : %s แถวข้อมูล', SHEET_MAIN,  Math.max(0, m.getLastRow() - 1));
  Logger.log('ชีต %s : %s แถวข้อมูล', SHEET_PULSE, Math.max(0, p.getLastRow() - 1));
  Logger.log('พร้อมใช้งาน');
}

/**
 * ย้ายข้อมูลเช็คอินใจเดิมจากชีต responses ไปชีต pulse
 * รันครั้งเดียวหลังอัปเดตโค้ด ถ้าเคยใช้เช็คอินใจมาก่อน
 * ถ้ายังไม่เคยใช้ ไม่ต้องรันก็ได้
 */
function migratePulseRows() {
  var m = sheet_(SHEET_MAIN), p = sheet_(SHEET_PULSE);
  var last = m.getLastRow();
  if (last < 2) { Logger.log('ไม่มีข้อมูลให้ย้าย'); return; }
  var vals = m.getRange(2, 1, last - 1, 4).getValues();
  var moved = 0;
  for (var i = vals.length - 1; i >= 0; i--) {      // ไล่จากล่างขึ้นบน เพื่อให้ลบแถวได้ถูกต้อง
    var k = vals[i][0];
    if (k && String(k).indexOf(PULSE_PREFIX) === 0) {
      if (findRow_(p, k) < 0) p.appendRow(vals[i]);
      m.deleteRow(i + 2);
      moved++;
    }
  }
  Logger.log('ย้ายข้อมูลเช็คอินใจแล้ว %s แถว', moved);
}

/** ลบแถวทดสอบที่ขึ้นต้นด้วย lc:test ออกจากทุกชีต */
function cleanTestRows() {
  [SHEET_MAIN, SHEET_PULSE].forEach(function (n) {
    var sh = sheet_(n), last = sh.getLastRow();
    if (last < 2) return;
    var keys = sh.getRange(2, 1, last - 1, 1).getValues();
    for (var i = keys.length - 1; i >= 0; i--) {
      if (String(keys[i][0]).indexOf('lc:test') === 0) sh.deleteRow(i + 2);
    }
  });
  Logger.log('ลบแถวทดสอบเรียบร้อย');
}
