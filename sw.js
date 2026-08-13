/* Life Competency UP TO GROW — Service Worker
 *
 * กลยุทธ์แคช
 *  1. หน้าเว็บ (navigate)  : network-first แล้ว fallback เป็นแคช
 *     เพื่อให้ครูได้เวอร์ชันใหม่เสมอเมื่อออนไลน์ และยังเปิดได้เมื่อออฟไลน์
 *  2. ไฟล์คงที่ (ไอคอน/manifest) : stale-while-revalidate
 *  3. ฟอนต์ Google          : cache-first (เปลี่ยนน้อย และจำเป็นต่อการอ่านภาษาไทย)
 *  4. Google Apps Script    : ไม่แคชเด็ดขาด ต้องผ่านเครือข่ายจริงเสมอ
 *     เพราะเป็นข้อมูลคะแนนนักเรียน หากแคชจะทำให้ครูเห็นข้อมูลเก่า
 *
 * หมายเหตุ: คำตอบของนักเรียนเก็บใน localStorage ของแอปอยู่แล้ว
 * Service Worker จึงไม่แตะข้อมูลผู้เรียน ทำหน้าที่แคชเฉพาะตัวโปรแกรม
 */

/* v5 (12 ส.ค. 2569) เพิ่มแบบสังเกตพฤติกรรมของครู 9 ด้าน และตารางความเที่ยงตรงเชิงสภาพ
   v6 (12 ส.ค. 2569) เพิ่มหลักฐานความสำเร็จ 5 ด้าน และโมดูลติดตามการลงมือทำ */
/* v7 (12 ส.ค. 2569) เพิ่มภารกิจรายวัน จ-ศ + รายงานรายสัปดาห์/เดือน/ภาคเรียน
   v8 (12 ส.ค. 2569) เพิ่มระบบภารกิจต่อเนื่อง 4 ชั้น วัน-สัปดาห์-เดือน-เทอม
   v9 (13 ส.ค. 2569) แถบเมนูบนสุด + หน้าแรกใหม่ + หน้าภารกิจรายวันตามปฏิทิน
   v10 (13 ส.ค. 2569) ภารกิจรายวันเป็นสถานการณ์ครบ 5 วัน + ลิงก์/QR ทุกภารกิจ
   v11 (13 ส.ค. 2569) ภารกิจรายวันครบ 8 ขั้นใน 10 นาที + หน้าเลือกบทบาท (นักเรียน/ครู/ผู้บริหาร)
        + เช็คอินใจก่อนเข้าทุกภารกิจ · ลิงก์ภารกิจข้ามหน้าเลือกบทบาทเข้าภารกิจทันที
   v12 (13 ส.ค. 2569) เช็คอินใจเปลี่ยนจากรายสัปดาห์เป็น "รายวัน" 30 วินาที
        + แดชบอร์ดครูรายวัน + สรุประดับโรงเรียนรายวัน + CSV เช็คอินรายวัน
   v13 (13 ส.ค. 2569) แบบวัดกลับเป็น 10 ข้อ (เต็ม 40) ให้ตรงกับรายงาน
        + กิจกรรม 8 ขั้นไม่เกิน 20 นาทีรวมแบบวัด + ปรับข้ออ้างพระบรมราโชบายและบทบาท AI ให้ไม่เกินหลักฐาน
   v14 (13 ส.ค. 2569) แยกเป็น 3 แอปตามบทบาท + หน้าพัฒนาการของนักเรียน (My Growth)
        + Civic Competency Heatmap + แนวโน้มระดับโรงเรียน + ผลตามวัตถุประสงค์ 2 ข้อ
   v15 (13 ส.ค. 2569) ภารกิจด่วนเลือกเป้าหมายการเรียนรู้ได้ + AI สร้างให้ตรงหัวข้อและเป้าหมาย
        + แก้เกณฑ์สำรองให้ต่างกันตามสมรรถนะ (เดิมใช้ชุดเดียวกันหมด)
   v16 (13 ส.ค. 2569) School Demo View: สาธิตการขยายผลระดับโรงเรียน 79 ห้อง ม.1–ม.6
        ข้อมูลจำลองอยู่ในหน่วยความจำเท่านั้น ไม่เขียนลงเครื่อง ไม่ส่งขึ้น Sheet ไม่ปนข้อมูลจริง
   v17 (13 ส.ค. 2569) Teacher Demo View: สาธิตว่า "ครูเห็นอะไร" ด้วยห้องจำลอง 40 คนกลางคาบ
        ใช้หลักความปลอดภัยข้อมูลชุดเดียวกับ v16 · เชื่อมสองมุมมองสาธิตครู↔ผู้บริหารถึงกัน
   v18 (13 ส.ค. 2569) Student Demo View: สตอรีบอร์ด 5 จอที่นักเรียนเห็นจริง (อ่านอย่างเดียว)
        + หน้าใส่ API key ส่งเข้า Apps Script ให้เอง ไม่ต้องเปิด Apps Script ตั้งค่าเอง
        + แถบเตือนโหมดสาธิตขึ้นเฉพาะหน้าที่แสดงข้อมูลผู้เรียน ไม่ขึ้นรบกวนทุกหน้า
   v19 (13 ส.ค. 2569) แก้หน้าใส่ API key ค้างที่ "กำลังตรวจสอบ" เมื่อตรวจไม่สำเร็จ
        เปลี่ยนเป็นบอกสาเหตุพร้อมวิธี deploy Code.gs ให้ครูทำตามได้เอง */
const VERSION    = 'v19';
const SHELL      = `uptogrow-shell-${VERSION}`;
const RUNTIME    = `uptogrow-runtime-${VERSION}`;
const FONTS      = `uptogrow-fonts-${VERSION}`;
const KEEP       = [SHELL, RUNTIME, FONTS];

const BASE = new URL('./', self.registration.scope).pathname;

const SHELL_URLS = [
  BASE,
  BASE + 'index.html',
  BASE + 'manifest.webmanifest',
  BASE + 'icons/icon-192.png',
  BASE + 'icons/icon-512.png',
  BASE + 'icons/icon-192-maskable.png',
  BASE + 'icons/icon-512-maskable.png',
  BASE + 'icons/apple-touch-icon.png',
];

/* ---------- ติดตั้ง: ดึงตัวโปรแกรมเก็บไว้ใช้ออฟไลน์ ---------- */
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    // ใช้ reload เพื่อไม่ให้ได้ไฟล์เก่าจาก HTTP cache ของเบราว์เซอร์
    await Promise.allSettled(
      SHELL_URLS.map(u => cache.add(new Request(u, { cache: 'reload' })))
    );
    await self.skipWaiting();
  })());
});

/* ---------- เปิดใช้งาน: ลบแคชเวอร์ชันเก่า ---------- */
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(
      names.filter(n => n.startsWith('uptogrow-') && !KEEP.includes(n))
           .map(n => caches.delete(n))
    );
    if (self.registration.navigationPreload) {
      await self.registration.navigationPreload.enable();
    }
    await self.clients.claim();
  })());
});

/* ---------- ให้หน้าเว็บสั่งอัปเดตทันทีได้ ---------- */
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

const isFont = url =>
  url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';

/* ---------- จัดการทุกคำขอ ---------- */
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // ข้อมูลนักเรียนบน Apps Script ห้ามแคช ปล่อยผ่านตรงเสมอ
  if (url.hostname.endsWith('script.google.com') ||
      url.hostname.endsWith('googleusercontent.com')) return;

  // รับเฉพาะ GET เท่านั้น (POST แคชไม่ได้อยู่แล้ว)
  if (req.method !== 'GET') return;

  // 1) การเปิดหน้าเว็บ
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const preload = await event.preloadResponse;
        if (preload) {
          (await caches.open(SHELL)).put(BASE + 'index.html', preload.clone());
          return preload;
        }
        const fresh = await fetch(req);
        (await caches.open(SHELL)).put(BASE + 'index.html', fresh.clone());
        return fresh;
      } catch (err) {
        const cache = await caches.open(SHELL);
        return (await cache.match(BASE + 'index.html')) ||
               (await cache.match(BASE)) ||
               new Response(
                 '<meta charset="utf-8"><h1>ออฟไลน์</h1>' +
                 '<p>ยังไม่เคยเปิดแอปนี้ขณะออนไลน์ จึงยังไม่มีข้อมูลในเครื่อง ' +
                 'กรุณาเชื่อมต่ออินเทอร์เน็ตหนึ่งครั้งก่อนใช้งานออฟไลน์</p>',
                 { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      }
    })());
    return;
  }

  // 2) ฟอนต์ไทย: cache-first
  if (isFont(url)) {
    event.respondWith((async () => {
      const cache = await caches.open(FONTS);
      const hit = await cache.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
        return res;
      } catch (e) {
        return hit || Response.error();
      }
    })());
    return;
  }

  // 3) ไฟล์อื่นในโดเมนเดียวกัน: stale-while-revalidate
  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      const cache = await caches.open(RUNTIME);
      const hit = await cache.match(req);
      const network = fetch(req).then(res => {
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      }).catch(() => null);
      return hit || (await network) || Response.error();
    })());
  }
});
