#!/usr/bin/env node
/* ===== ترياق — أداة البناء =====
   تجمع التطبيق كله في ملف HTML واحد جاهز للتحويل إلى APK.

     node tools/build.js                 بناء عادي (قابل للقراءة — للتطوير)
     node tools/build.js --pack          تعمية بيانات الأدوية (base64 + XOR)
     node tools/build.js --obfuscate     تشويش كود التطبيق
     node tools/build.js --pack --obfuscate --min      النسخة التجارية

   الناتج: dist/tiryaq.html  و  dist/app.built.js (لتشغيل الاختبارات عليه)

   تحذير صريح: أي ملف HTML يعمل على جهاز الزبون يمكن فتحه ودراسته.
   التشويش يرفع الكلفة على من يحاول النسخ، ولا يمنعه. الحماية الحقيقية
   هي رمز التفعيل الموقّع (tools/license.js) وخادم الذكاء والتحديثات.
*/
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, ".."), DIST = path.join(ROOT, "dist");
const args = process.argv.slice(2);
const has = f => args.includes(f);
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");
const kb = n => Math.round(n / 1024) + " ك.ب";

/* ---------- تعمية بيانات الأدوية ---------- */
function packData(src, tag) {
  /* داخل eval تبقى const محبوسة في نطاقه ولا يراها بقية السكربتات،
     فنحوّل تعريفات المستوى الأعلى إلى var لتصبح عامة. */
  src = src.replace(/^[ \t]*const[ \t]+([A-Z_][A-Z0-9_]*)[ \t]*=/gm, "var $1 =");
  const key = "tiryaq" + tag.length;
  const bytes = Buffer.from(src, "utf8");
  const out = Buffer.alloc(bytes.length);
  for (let i = 0; i < bytes.length; i++) out[i] = bytes[i] ^ key.charCodeAt(i % key.length);
  return '(function(){var k="' + key + '",b=atob("' + out.toString("base64") + '"),o="";' +
         'for(var i=0;i<b.length;i++)o+=String.fromCharCode(b.charCodeAt(i)^k.charCodeAt(i%k.length));' +
         'return o})()';
}

(async () => {
  let html = read("index.html");
  const srcs = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
  let appCode = "", report = [];

  for (const src of srcs) {
    let code = read(src);
    report.push([src, code.length]);
    if (src === "app.js" || src === "lic.js") {
      appCode += "\n;" + code;
      html = html.replace('<script src="' + src + '"></script>', () => "");
      continue;
    }
    if (has("--pack") && src.startsWith("data/")) {
      /* eval غير المباشر ينفّذ في النطاق العام فتصبح const SEED مرئية لبقية السكربتات؛
         eval المباشر يحبسها داخل نفسه فيقلع التطبيق فارغاً. */
      code = "(0,eval)(" + packData(code, src) + ");";
    }
    /* الاستبدال بدالة: محتوى المكتبات فيه $& و $' وهي رموز خاصة في نص الاستبدال
       وكانت تُفسد بقية الملف. */
    const inline = "<script>" + code.replace(/<\/script>/gi, "<\\/script>") + "</script>";
    html = html.replace('<script src="' + src + '"></script>', () => inline);
  }

  /* التشويش والتصغير */
  if (has("--obfuscate")) {
    let ob;
    try { ob = require("javascript-obfuscator"); }
    catch (e) { console.error("ثبّت الأداة أولاً:  npm i javascript-obfuscator"); process.exit(1); }
    console.log("جارٍ التشويش… (قد يستغرق دقيقة)");
    appCode = ob.obfuscate(appCode, {
      compact: true, controlFlowFlattening: false,      /* التسطيح يبطئ الواجهة */
      deadCodeInjection: false, stringArray: true,
      stringArrayEncoding: ["base64"], stringArrayThreshold: 0.75,
      identifierNamesGenerator: "mangled", numbersToExpressions: true,
      selfDefending: has("--selfdefend"), simplify: true,
      splitStrings: true, splitStringsChunkLength: 12,
      unicodeEscapeSequence: false
    }).getObfuscatedCode();
  } else if (has("--min")) {
    const { minify } = require("terser");
    appCode = (await minify(appCode, { compress: true, mangle: true })).code;
  }

  const tail = "<script>" + appCode.replace(/<\/script>/gi, "<\\/script>") + "</script>\n</body>";
  html = html.replace(/@@APP@@[^@]+@@/g, "").replace("</body>", () => tail);
  if (has("--min")) {
    html = html.replace(/<!--[\s\S]*?-->/g, "")
               .replace(/\n\s*\n/g, "\n");
  }

  fs.mkdirSync(DIST, { recursive: true });
  fs.writeFileSync(path.join(DIST, "tiryaq.html"), html);
  fs.writeFileSync(path.join(DIST, "app.built.js"), appCode);

  console.log("\nالمكوّنات:");
  report.forEach(([f, n]) => console.log("  " + f.padEnd(24) + kb(n)));
  console.log("\nالناتج: dist/tiryaq.html  " + kb(html.length));
  console.log("        dist/app.built.js " + kb(appCode.length));
  console.log("\nللاختبار على النسخة المبنية:  TIRYAQ_APP=dist/app.built.js node tests/pos.test.js");
})();
