/* ===== ترياق — فحص النسخة المبنية داخل متصفح وهمي =====
   يحمّل dist/tiryaq.html كما يحمّله كروم، ويتأكد أن التطبيق أقلع فعلاً.
   تشغيل:  node tests/build.smoke.js  [مسار الملف] */
const fs = require("fs"), path = require("path");
const { JSDOM, VirtualConsole } = require("jsdom");
const file = process.argv[2] || path.join(__dirname, "..", "dist", "tiryaq.html");

let PASS = 0, FAIL = 0;
const eq = (l, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? (PASS++, console.log("  ✓ " + l))
     : (FAIL++, console.log("  ✗ " + l + "\n      المتوقع: " + JSON.stringify(want) + "\n      الناتج:  " + JSON.stringify(got)));
};
const errs = [];
const vc = new VirtualConsole();
const IGNORE = /scrollTo|Not implemented/;
vc.on("jsdomError", e => { const m = e.message + " :: " + (e.detail || ""); if (!IGNORE.test(m)) errs.push(m); });
vc.on("error", (...a) => errs.push(a.join(" ")));

const raw = fs.readFileSync(file, "utf8");
if (/<script src=/.test(raw)) {
  console.log("\nهذا الملف يشير إلى سكربتات خارجية — هذا الفحص للنسخة المبنية وحدها.");
  console.log("شغّل أولاً:  node tools/build.js --pack --obfuscate");
  process.exit(2);
}
console.log("\n■ إقلاع " + path.basename(file) + " (" + Math.round(fs.statSync(file).size / 1024) + " ك.ب)");
const dom = new JSDOM(fs.readFileSync(file, "utf8"), {
  runScripts: "dangerously", pretendToBeVisual: true, url: "https://example.github.io/tiryaq/",
  virtualConsole: vc
});
const w = dom.window;
setTimeout(() => {
  w.document.dispatchEvent(new w.Event("DOMContentLoaded", { bubbles: true }));
  w.dispatchEvent(new w.Event("load"));
  setTimeout(check, 300);
}, 200);

function check() {
  eq("لا أخطاء أثناء التحميل", errs.slice(0, 3), []);
  eq("بيانات الأصناف محمّلة", typeof w.SEED === "object" && w.SEED.rows.length > 1000, true);
  eq("دليل الأسعار محمّل", typeof w.PRICES === "object" && w.PRICES.rows.length > 1000, true);
  eq("جرع الأطفال محمّلة", typeof w.DOSES === "object" && w.DOSES.oral.length > 10, true);
  eq("المكتبات موجودة", [typeof w.ZXing, typeof w.fflate].map(t => t !== "undefined"), [true, true]);
  const kItems = (w.document.getElementById("k-items").textContent || "").replace(/[^\d]/g, "");
  eq("عدّاد الأصناف في الرئيسية", Number(kItems) > 1000, true);
  eq("عدّاد المتوفر ظاهر", (w.document.getElementById("k-avail").textContent || "").length > 0, true);
  eq("شاشة الإقلاع اختفت", w.document.getElementById("boot").classList.contains("off"), true);
  eq("الشاشة الرئيسية ظاهرة", w.document.getElementById("pg-home").classList.contains("on"), true);
  eq("الترويسة فيها اسم", (w.document.getElementById("shopname").textContent || "").length > 0, true);
  eq("التفعيل يعمل بالتجربة", w.document.body.classList.contains("locked"), false);
  eq("عدّاد التجربة ظاهر", /تجربة/.test(w.document.getElementById("lictag").textContent), true);
  const q = w.document.getElementById("q");
  q.value = "para";
  q.dispatchEvent(new w.Event("input", { bubbles: true }));
  setTimeout(() => {
    eq("البحث يعطي نتائج", (w.document.getElementById("sug").innerHTML || "").length > 20, true);
    console.log("\n════════════════════════════\nنجح " + PASS + " · فشل " + FAIL);
    if (errs.length) console.log("\nأول خطأ:\n" + errs[0].slice(0, 400));
    process.exit(FAIL ? 1 : 0);
  }, 200);
}
