#!/usr/bin/env node
/* ===== ترياق — خادم المزامنة المحلي (بلا إنترنت) =====
   جهاز واحد في الصيدلية يشغّله (لابتوب، أو هاتف عبر Termux)، وبقية الأجهزة
   تضع عنوانه في: الإعدادات ← رابط المزامنة.

   التشغيل:   node server/lan.js            (المنفذ 8787)
              node server/lan.js 9000       (منفذ آخر)
   البيانات تُحفظ في ملف tiryaq-sync.json بجانب هذا الملف.

   ملاحظة: هذا خادم لشبكة الصيدلية المغلقة، بلا تشفير ولا مصادقة.
   لا تفتح منفذه على الإنترنت. */

const http = require("http");
const fs   = require("fs");
const os   = require("os");
const path = require("path");

const PORT = Number(process.argv[2]) || 8787;
const FILE = path.join(__dirname, "tiryaq-sync.json");
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type, x-master-key",
  "access-control-allow-methods": "GET, PUT, POST, OPTIONS"
};

function read() {
  try { return fs.readFileSync(FILE, "utf8"); } catch (e) { return "{}"; }
}
function write(body) {
  const tmp = FILE + ".tmp";
  fs.writeFileSync(tmp, body);
  fs.renameSync(tmp, FILE);            /* كتابة ذرّية: لا يبقى ملف نصف مكتوب */
  try { fs.copyFileSync(FILE, FILE.replace(/\.json$/, "-" + new Date().toISOString().slice(0, 10) + ".bak.json")); }
  catch (e) {}
}

http.createServer((req, res) => {
  if (req.method === "OPTIONS") { res.writeHead(204, CORS); return res.end(); }

  if (req.method === "GET") {
    res.writeHead(200, Object.assign({ "content-type": "application/json; charset=utf-8" }, CORS));
    return res.end(read());
  }

  if (req.method === "PUT" || req.method === "POST") {
    let body = "";
    req.on("data", c => {
      body += c;
      if (body.length > 40e6) { req.destroy(); }        /* حد أعلى 40 ميغابايت */
    });
    req.on("end", () => {
      try {
        JSON.parse(body);                                /* لا نحفظ إلا JSON سليماً */
        write(body);
        res.writeHead(200, Object.assign({ "content-type": "application/json" }, CORS));
        res.end(JSON.stringify({ ok: true, at: new Date().toISOString(), size: body.length }));
        console.log(new Date().toLocaleTimeString() + "  ← حُفظت نسخة (" + Math.round(body.length / 1024) + " ك.ب)");
      } catch (e) {
        res.writeHead(400, CORS); res.end(JSON.stringify({ error: "JSON غير صالح" }));
      }
    });
    return;
  }

  res.writeHead(405, CORS); res.end();
}).listen(PORT, () => {
  const ips = [];
  const ni = os.networkInterfaces();
  Object.keys(ni).forEach(k => ni[k].forEach(a => { if (a.family === "IPv4" && !a.internal) ips.push(a.address); }));
  console.log("\nترياق — خادم المزامنة المحلي يعمل على المنفذ " + PORT);
  console.log("ضع أحد هذه العناوين في إعدادات كل جهاز (رابط المزامنة):");
  ips.forEach(ip => console.log("   http://" + ip + ":" + PORT + "/"));
  console.log("\nالبيانات: " + FILE + "\nأوقف الخادم بـ Ctrl+C\n");
});
