#!/usr/bin/env node
/* ===== ترياق — أداة إصدار رموز التفعيل =====
   المفتاح الخاص يبقى عندك ولا يوزَّع أبداً. من دونه لا يستطيع أحد توليد رمز صالح.

   ١) توليد مفتاحك (مرة واحدة فقط، ثم احفظ الملف في مكان آمن):
        node tools/license.js keygen
      يُنشئ tools/tiryaq-key.json ويطبع المفتاح العام.

   ٢) تثبيت المفتاح العام داخل التطبيق:
        node tools/license.js install
      يكتب المفتاح العام في lic.js قبل بناء النسخة.

   ٣) إصدار رمز لزبون (يعطيك رمز جهازه من شاشة التفعيل):
        node tools/license.js issue AB12-CD34-EF56 "صيدلية النور" 12
      (12 = عدد الأشهر · استعمل 0 لاشتراك مفتوح · و * بدل رمز الجهاز لرمز يعمل على أي جهاز)

   ٤) فحص رمز:
        node tools/license.js check TRQ.xxx.yyy AB12-CD34-EF56
*/
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const KEYFILE = path.join(__dirname, "tiryaq-key.json");
const LICJS   = path.join(__dirname, "..", "lic.js");
const b64u = b => Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function keygen() {
  if (fs.existsSync(KEYFILE)) {
    console.log("موجود أصلاً: " + KEYFILE + "\nاحذفه يدوياً إن أردت مفتاحاً جديداً (كل الرموز القديمة ستبطل).");
    return;
  }
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const pub = publicKey.export({ type: "spki", format: "der" });
  const raw = pub.slice(pub.length - 65).toString("hex");            /* 04 + X + Y */
  fs.writeFileSync(KEYFILE, JSON.stringify({
    priv: privateKey.export({ type: "pkcs8", format: "pem" }), pub: raw, at: new Date().toISOString()
  }, null, 2));
  fs.chmodSync(KEYFILE, 0o600);
  console.log("أُنشئ المفتاح: " + KEYFILE);
  console.log("المفتاح العام:\n" + raw);
  console.log("\nاحفظ نسخة من هذا الملف خارج الحاسبة. فقدانه يعني تعطّل إصدار الرموز.");
}
function key() {
  if (!fs.existsSync(KEYFILE)) { console.error("لا يوجد مفتاح — شغّل: node tools/license.js keygen"); process.exit(1); }
  return JSON.parse(fs.readFileSync(KEYFILE, "utf8"));
}
function install() {
  const k = key();
  const src = fs.readFileSync(LICJS, "utf8");
  const out = src.replace(/var TRQ_PUB = "[0-9a-fA-F]*";/, 'var TRQ_PUB = "' + k.pub + '";');
  if (out === src) { console.error("لم أجد سطر TRQ_PUB في lic.js"); process.exit(1); }
  fs.writeFileSync(LICJS, out);
  console.log("ثُبّت المفتاح العام في lic.js");
}
function issue(device, shop, months, note) {
  const k = key();
  let until = "*";
  if (Number(months)) {
    const d = new Date(); d.setMonth(d.getMonth() + Number(months));
    until = d.toISOString().slice(0, 10);
  }
  const pay = { d: (device || "*").toUpperCase(), s: shop || "", u: until, t: new Date().toISOString().slice(0, 10) };
  if (note) pay.n = note;
  const p64 = b64u(Buffer.from(JSON.stringify(pay), "utf8"));
  const sig = crypto.sign("sha256", Buffer.from(p64, "utf8"),
                          { key: k.priv, dsaEncoding: "ieee-p1363" });
  const code = "TRQ." + p64 + "." + b64u(sig);
  console.log("\nالصيدلية : " + (shop || "—"));
  console.log("الجهاز   : " + pay.d);
  console.log("ينتهي    : " + (until === "*" ? "مفتوح" : until));
  console.log("\nالرمز (أرسله للزبون كما هو):\n\n" + code + "\n");
  const log = path.join(__dirname, "issued.log");
  fs.appendFileSync(log, [new Date().toISOString(), pay.d, shop || "", until, code].join("\t") + "\n");
  console.log("سُجّل في " + log);
  return code;
}
function check(code, device) {
  const L = require(path.join(__dirname, "..", "lic.js"));
  L.setPub(key().pub);
  const r = L.trqCheckLicense(code, (device || "*").toUpperCase());
  console.log(r.ok ? "الرمز صالح ✓ " + JSON.stringify(r.pay) : "الرمز غير صالح ✗ " + r.why);
}

const [cmd, a, b, c, d] = process.argv.slice(2);
if (cmd === "keygen") keygen();
else if (cmd === "install") install();
else if (cmd === "issue") issue(a, b, c, d);
else if (cmd === "check") check(a, b);
else console.log(fs.readFileSync(__filename, "utf8").split("*/")[0].split("/* =====")[1]);
