/* ===== ترياق — اختبارات نقطة البيع الآلية =====
   تشغيل:  node tests/pos.test.js
   تبني بيئة متصفح وهمية، تحمّل app.js كما هو، ثم تنفّذ سيناريوهات بيع حقيقية
   وتتحقق من المخزون والفواتير والديون بعد كل خطوة. */
const fs = require("fs"), vm = require("vm"), path = require("path");
const ROOT = path.join(__dirname, "..");

let PASS = 0, FAIL = 0;
const eq = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { PASS++; console.log("  ✓ " + label); }
  else { FAIL++; console.log("  ✗ " + label + "\n      المتوقع: " + JSON.stringify(want) + "\n      الناتج:  " + JSON.stringify(got)); }
};
const ok = (label, cond) => eq(label, !!cond, true);

/* ---------- بيئة متصفح مصغّرة ---------- */
function boot(opts) {
  opts = opts || {};
  const store = Object.assign({}, opts.store || {});
  const els = {};
  const mkEl = id => ({
    id, value: "", innerHTML: "", textContent: "", style: {}, dataset: {},
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    appendChild() {}, addEventListener() {}, removeEventListener() {}, click() {}, focus() {},
    closest: () => null, querySelectorAll: () => [], remove() {}
  });
  const localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => {
      if (opts.failKey && k === opts.failKey) throw new Error("QuotaExceeded");
      store[k] = String(v);
    },
    removeItem: k => { delete store[k]; }
  };
  const ctx = {
    console, setTimeout, clearTimeout, Date, Math, JSON, localStorage,
    document: {
      getElementById: id => els[id] || (els[id] = mkEl(id)),
      querySelector: () => null, querySelectorAll: () => [],
      addEventListener() {}, createElement: () => mkEl("tmp"),
      head: mkEl("head"), body: Object.assign(mkEl("body"), { classList: { add() {}, remove() {}, toggle() {}, contains: () => false } })
    },
    navigator: {}, location: { protocol: "file:" },
    URL: { createObjectURL: () => "", revokeObjectURL() {} },
    Blob: function () {}, File: function () {},
    scrollTo() {}, alert() {}, confirm: () => (opts.confirm === undefined ? true : opts.confirm), prompt: () => ""
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext("var SEED={rows:[]},PRICES={rows:[]},DOSES={oral:[],emerg:[],iv:[],fluid:[],age:[]};function toast(t){globalThis.LASTTOAST=t}", ctx);
  ctx.atob = str => Buffer.from(String(str), "base64").toString("binary");
  ctx.btoa = str => Buffer.from(String(str), "binary").toString("base64");
  ctx.TextDecoder = TextDecoder;
  if (!process.env.TIRYAQ_APP) vm.runInContext(fs.readFileSync(path.join(ROOT, "lic.js"), "utf8"), ctx);   /* النسخة المبنية تحوي lic.js أصلاً */
  vm.runInContext(fs.readFileSync(path.join(ROOT, process.env.TIRYAQ_APP || "app.js"), "utf8"), ctx);
  /* تعطيل الرسم — الاختبار على المنطق لا على الواجهة */
  vm.runInContext(`
    ["renderHome","renderStock","renderCart","renderCust","renderPurch","renderWH","renderPlans",
     "renderUsers","renderDebt","renderTickets","renderAlerts","renderFavs","showReceipt",
     "renderGuide","renderDose","drawSug","drawQuota","applyPerms"].forEach(f => { globalThis[f] = function(){}; });
    buildItems();
    globalThis.T = {
      items: () => ITEMS, cart: () => CART, inv: () => INVOICES, cust: () => CUST,
      setCart: c => { CART = c; }, setDisc: d => { DISC = d; }, setPay: p => { PAYM = p; },
      addToCart, doPay, refund, takeStock, giveStock, lineUnits, nextInvNo,
      onCode, cartTotal, buildItems, txn, custAdd, renderCartHTML: null,
      store: () => JSON.parse(JSON.stringify(PATCH)), me: v => { ME = v; }
    };`, ctx);
  ctx.T.els = els;
  ctx.T.el = id => ctx.document.getElementById(id);
  ctx.T.raw = store;
  ctx.T.ctx = ctx;
  return ctx.T;
}
const items = () => [
  { n: "Adol 500", b: "111", sc: "Paracetamol", k: 500, p: 1000, p2: 900, p3: 800, q: 10, min: 3 },
  { n: "Amoxil 500", b: "222", b2: "999222", sc: "Amoxicillin", k: 2000, p: 3000, q: 5, min: 2,
    bt: [{ l: "A", e: "01/12/2027", q: 3 }, { l: "B", e: "01/03/2027", q: 2 }] },
  { n: "Zinc syrup", b: "333", sc: "Zinc", k: 1000, p: 2000, q: 4, min: 2, u2: "شريط", u2q: 10, u2p: 250 }
];
const base = () => ({ "ph.extra": JSON.stringify(items()), "ph.cfg": JSON.stringify({ shop: "اختبار", cur: "د.ع" }) });
const find = (T, n) => T.items().find(x => x.n === n);

/* ================= السيناريوهات ================= */
console.log("\n■ بيع نقدي");
{
  const T = boot({ store: base() });
  T.addToCart(find(T, "Adol 500"), 3);
  T.el("tendered").value = "5000";
  T.doPay();
  eq("المخزون نقص 3", find(T, "Adol 500").q, 7);
  eq("فاتورة واحدة", T.inv().length, 1);
  eq("رقم الفاتورة 1", T.inv()[0].no, 1);
  eq("الإجمالي 3000", T.inv()[0].total, 3000);
  eq("الباقي 2000", T.inv()[0].change, 2000);
  eq("الكلفة محفوظة للتقارير", T.inv()[0].lines[0].k, 500);
  eq("السلة فُرغت", T.cart().length, 0);
  eq("لا دين", T.cust().length, 0);
}

console.log("\n■ بيع بالدين بلا اسم زبون (كان يُخرج البضاعة بلا فاتورة)");
{
  const T = boot({ store: base() });
  T.addToCart(find(T, "Adol 500"), 2);
  T.setPay("دين");
  T.doPay();
  eq("المخزون لم يُمَس", find(T, "Adol 500").q, 10);
  eq("لا فاتورة", T.inv().length, 0);
  eq("السلة كما هي", T.cart().length, 1);
}

console.log("\n■ بيع بالدين باسم زبون");
{
  const T = boot({ store: base() });
  T.addToCart(find(T, "Amoxil 500"), 2);
  T.setPay("دين");
  T.el("cust").value = "أبو علي";
  T.doPay();
  eq("المخزون نقص", find(T, "Amoxil 500").q, 3);
  eq("الدين 6000", T.cust()[0].bal, 6000);
  eq("الفاتورة تسجّل المتبقي", T.inv()[0].owed, 6000);
  eq("FEFO: التشغيلة القريبة أولاً", find(T, "Amoxil 500").bt, [{ l: "A", e: "01/12/2027", q: 3 }]);
}

console.log("\n■ دفعة جزئية نقداً بلا اسم");
{
  const T = boot({ store: base() });
  T.addToCart(find(T, "Adol 500"), 3);
  T.el("tendered").value = "1000";
  T.doPay();
  eq("لا بيع بأقل من المطلوب", T.inv().length, 0);
  eq("المخزون سليم", find(T, "Adol 500").q, 10);
}

console.log("\n■ بيع أكثر من المتوفر — والمستخدم يرفض");
{
  const T = boot({ store: base(), confirm: false });
  T.addToCart(find(T, "Adol 500"), 50);
  T.el("tendered").value = "50000";
  T.doPay();
  eq("لا فاتورة", T.inv().length, 0);
  eq("المخزون سليم", find(T, "Adol 500").q, 10);
}

console.log("\n■ المرتجع");
{
  const T = boot({ store: base() });
  T.addToCart(find(T, "Amoxil 500"), 2);
  T.setPay("دين"); T.el("cust").value = "أبو علي";
  T.doPay();
  T.refund(1);
  eq("المخزون عاد", find(T, "Amoxil 500").q, 5);
  eq("الدين صفر بعد المرتجع", T.cust()[0].bal, 0);
  eq("قيد مرتجع", T.inv()[1].kind, "مرتجع");
  eq("رقم المرتجع 2", T.inv()[1].no, 2);
  T.refund(1);
  eq("لا مرتجع مكرر", T.inv().length, 2);
  eq("المخزون لم يتضخّم", find(T, "Amoxil 500").q, 5);
}

console.log("\n■ الوحدة الثانوية (بيع شريط من علبة)");
{
  const T = boot({ store: base() });
  const it = find(T, "Zinc syrup");
  T.addToCart(it, 1);
  const line = T.cart()[0];
  line.u2 = true; line.f = 1 / 10; line.price = 250; line.q = 5;   /* ٥ أشرطة */
  eq("الخصم نصف علبة", T.lineUnits(line), 0.5);
  T.el("tendered").value = "2000";
  T.doPay();
  eq("المخزون 3.5 علبة", find(T, "Zinc syrup").q, 3.5);
  eq("الإجمالي 1250", T.inv()[0].total, 1250);
}

console.log("\n■ التشغيلات لا تعود بعد إعادة فتح التطبيق");
{
  const T = boot({ store: base() });
  T.addToCart(find(T, "Amoxil 500"), 5);
  T.el("tendered").value = "15000";
  T.doPay();
  eq("لا تشغيلات", find(T, "Amoxil 500").bt, []);
  const T2 = boot({ store: T.raw });                    /* إعادة تشغيل بنفس التخزين */
  eq("بعد إعادة الفتح تبقى فارغة", find(T2, "Amoxil 500").bt, []);
  eq("الرصيد صفر", find(T2, "Amoxil 500").q, 0);
}

console.log("\n■ ترقيم الفواتير لا يتكرر بعد استعادة نسخة أقدم");
{
  const T = boot({ store: base() });
  for (let i = 0; i < 3; i++) {
    T.addToCart(find(T, "Adol 500"), 1); T.el("tendered").value = "1000"; T.doPay();
  }
  eq("ثلاث فواتير 1..3", T.inv().map(v => v.no), [1, 2, 3]);
  const raw = T.raw;
  raw["ph.inv"] = JSON.stringify(JSON.parse(raw["ph.inv"]).slice(0, 1));   /* استعادة نسخة فيها فاتورة واحدة */
  const T2 = boot({ store: raw });
  T2.addToCart(find(T2, "Adol 500"), 1); T2.el("tendered").value = "1000"; T2.doPay();
  eq("الرقم الجديد 4 لا 2", T2.inv()[T2.inv().length - 1].no, 4);
}

console.log("\n■ تراجع ذرّي عند امتلاء الذاكرة");
{
  const T = boot({ store: base(), failKey: "ph.inv" });
  T.addToCart(find(T, "Adol 500"), 4);
  T.el("tendered").value = "4000";
  T.doPay();
  eq("لا فاتورة", T.inv().length, 0);
  eq("المخزون رجع كما كان", find(T, "Adol 500").q, 10);
}

console.log("\n■ الباركود");
{
  const T = boot({ store: base() });
  T.ctx.SCANMODE = "sale";
  vm.runInContext('SCANMODE="sale"; onCode("999222");', T.ctx);      /* باركود ثانوي */
  eq("الباركود الثانوي يضيف للسلة", T.cart().length && T.cart()[0].n, "Amoxil 500");
  vm.runInContext('CART=[]; SCANMODE="sale"; onCode("0000111");', T.ctx);   /* أصفار بادئة */
  eq("الأصفار البادئة تُطابق", T.cart().length && T.cart()[0].n, "Adol 500");
}

console.log("\n■ حماية من حقن HTML في أسماء الأصناف");
{
  const bad = items(); bad[0].n = '<img src=x onerror=alert(1)>';
  const T = boot({ store: { "ph.extra": JSON.stringify(bad), "ph.cfg": JSON.stringify({ shop: "x", cur: "د.ع" }) } });
  const out = vm.runInContext('esc(ITEMS[0].n)', T.ctx);
  ok("الوسوم مُهرَّبة", out.indexOf("<img") === -1 && out.indexOf("&lt;img") === 0);
}

console.log("\n■ التقريب لأقرب 250");
{
  const st = base(); st["ph.cfg"] = JSON.stringify({ shop: "x", cur: "د.ع", round: 250 });
  const T = boot({ store: st });
  const it = find(T, "Adol 500");
  T.addToCart(it, 1);
  T.cart()[0].price = 1120;
  eq("1120 ← 1250 أو 1000", T.cartTotal() % 250, 0);
}

console.log("\n■ مستويات السعر وسطر الفاتورة");
{
  const T = boot({ store: base() });
  const it = find(T, "Adol 500");
  eq("المستويات الثلاثة", [1,2,3].map(l => vm.runInContext("priceLevel(ITEMS.find(x=>x.n=='Adol 500')," + l + ")", T.ctx)), [1000, 900, 800]);
  eq("مستوى غير مسعّر يرجع للأقرب",
     vm.runInContext("priceLevel({p:1500},3)", T.ctx), 1500);
  T.addToCart(it, 4);
  const l = T.cart()[0];
  eq("يبدأ بالمستوى الأول", [l.lvl, l.price], [1, 1000]);

  /* الخصم مبلغاً ونسبة */
  vm.runInContext("setLineDisc(CART[0], '10%')", T.ctx);
  eq("خصم ١٠٪ من 4000", l.d, 400);
  vm.runInContext("setLineDisc(CART[0], 500)", T.ctx);
  eq("خصم مبلغاً", l.d, 500);
  vm.runInContext("setLineDisc(CART[0], -900)", T.ctx);
  eq("الخصم السالب مرفوض", l.d, 0);
  vm.runInContext("setLineDisc(CART[0], 999999)", T.ctx);
  eq("الخصم لا يتجاوز قيمة السطر", l.d, 4000);

  /* كتابة الإجمالي تشتق السعر */
  vm.runInContext("CART[0].d=0; setLineTotal(CART[0], 3600)", T.ctx);
  eq("السعر مشتق من الإجمالي", l.price, 900);
  eq("الإجمالي مطابق", vm.runInContext("lineTotal(CART[0])", T.ctx), 3600);
  vm.runInContext("CART[0].d=200; setLineTotal(CART[0], 3000)", T.ctx);
  eq("الاشتقاق يحترم الخصم", vm.runInContext("lineTotal(CART[0])", T.ctx), 3000);
}

console.log("\n■ الملاحظة على الوصل");
{
  const T = boot({ store: base() });
  T.addToCart(find(T, "Adol 500"), 2);
  vm.runInContext("CART[0].note='حسب الوصفة'; CART[0].d=300;", T.ctx);
  T.el("tendered").value = "5000";
  T.doPay();
  eq("الملاحظة محفوظة في الفاتورة", T.inv()[0].lines[0].note, "حسب الوصفة");
  eq("الخصم محفوظ", T.inv()[0].lines[0].d, 300);
  eq("الإجمالي بعد خصم السطر", T.inv()[0].total, 1700);
}

console.log("\n■ باركود الوصل (EAN-13 صالح)");
{
  const T = boot({ store: base() });
  const code = vm.runInContext('invBarcode(37)', T.ctx);
  eq("13 خانة", code.length, 13);
  eq("خانة التحقق صحيحة", vm.runInContext('checkDigitOK("' + code + '")', T.ctx), true);
  eq("يعود لرقم الفاتورة", vm.runInContext('invFromBarcode("' + code + '")', T.ctx), 37);
  eq("باركود دواء عادي ليس فاتورة", vm.runInContext('invFromBarcode("6291100010101")', T.ctx), null);
  ok("بتات الباركود مرسومة", vm.runInContext('barsHTML(invBarcode(37),34)', T.ctx).indexOf("rc-bar") > 0);
}

console.log("\n■ الجرد السريع");
{
  const T = boot({ store: base() });
  vm.runInContext('countAdd("111"); countAdd("111"); countAdd("111");', T.ctx);   /* عُدّت 3 والنظام 10 */
  vm.runInContext('countAdd("222", 7);', T.ctx);                                  /* عُدّت 7 والنظام 5 */
  const rows = vm.runInContext('countRows().map(r=>[r.it.n,r.sys,r.got,r.diff])', T.ctx);
  eq("الفروقات محسوبة", rows, [["Adol 500", 10, 3, -7], ["Amoxil 500", 5, 7, 2]]);
  vm.runInContext('countApply()', T.ctx);
  eq("الرصيد صار كما عُدّ", [find(T, "Adol 500").q, find(T, "Amoxil 500").q], [3, 7]);
  eq("الجلسة صُفّرت", vm.runInContext('Object.keys(COUNT).length', T.ctx), 0);
  eq("قيد جرد في سجل المشتريات", vm.runInContext('PURCH[PURCH.length-1].kind', T.ctx), "جرد");
}

console.log("\n■ مزامنة فرعين");
{
  const T = boot({ store: base() });                       /* الفرع 1 */
  vm.runInContext('CFG.branch=1;', T.ctx);
  T.addToCart(find(T, "Adol 500"), 1); T.el("tendered").value = "1000"; T.doPay();
  const remote = {
    v: 3, br: 2, patch: { "x0": { p: 1500, q: 99, bt: [{ e: "01/01/2030", q: 99 }] } },
    extra: [], inv: [{ no: 1, br: 2, at: new Date().toISOString(), who: "زبون فرع٢",
                       lines: [], sub: 5000, total: 5000, pay: "نقد", kind: "بيع" }],
    cust: [{ n: "أبو علي", phone: "0770", bal: 0,
             log: [{ at: "2026-09-01T10:00:00.000Z", amt: 10000, note: "فاتورة 3" },
                   { at: "2026-09-02T10:00:00.000Z", amt: -4000, note: "تسديد" }] }],
    purch: [], plans: [], wh: [], users: [], held: []
  };
  vm.runInContext("syncMerge(" + JSON.stringify(remote) + ")", T.ctx);
  eq("السعر المشترك وصل", find(T, "Adol 500").p, 1000);       /* المحلي أولوية */
  eq("كمية الفرع الآخر لم تُستورد", find(T, "Adol 500").q, 9);
  eq("فاتورتان بلا تعارض أرقام", T.inv().length, 2);
  eq("رصيد الزبون من السجل", T.cust()[0].bal, 6000);
  vm.runInContext("syncMerge(" + JSON.stringify(remote) + ")", T.ctx);   /* دمج مكرر */
  eq("لا تكرار عند إعادة الدمج", T.inv().length, 2);
  eq("الرصيد لم يتضاعف", T.cust()[0].bal, 6000);
}

console.log("\n■ شاشة الزبون");
{
  const T = boot({ store: base() });
  T.addToCart(find(T, "Adol 500"), 2);
  vm.runInContext('csPush()', T.ctx);
  const d = JSON.parse(T.raw["ph.cs"]);
  eq("المجموع يُبثّ", d.total, 2000);
  eq("السطر يُبثّ", d.lines[0].n, "Adol 500");
  ok("التفقيط موجود", (d.words || "").length > 3);
}

console.log("\n■ التقرير الشهري");
{
  const T = boot({ store: base() });
  vm.runInContext('CFG.branch=1; ME={n:"سالم",role:"مدير"};', T.ctx);
  T.addToCart(find(T, "Adol 500"), 2);        /* بيع 1000 كلفته 500 */
  T.el("tendered").value = "2000"; T.doPay();
  T.addToCart(find(T, "Amoxil 500"), 1);      /* بيع 3000 كلفته 2000، ديناً */
  T.setPay("دين"); T.el("cust").value = "أبو علي"; T.el("tendered").value = ""; T.doPay();
  const ym = new Date().toISOString().slice(0, 7);
  const r = vm.runInContext('monthReport("' + ym + '")', T.ctx);
  eq("عدد الفواتير", r.n, 2);
  eq("إجمالي المبيعات", r.gross, 5000);
  eq("كلفة المبيعات", r.cogs, 3000);
  eq("الربح", r.profit, 2000);
  eq("ديون جديدة", r.opened, 3000);
  eq("مبيعات الكاشير", r.byWho["سالم"], 5000);
  eq("الأكثر ربحاً أولاً", r.items[0].n, "Amoxil 500");
  /* مرتجع يخصم من الربح */
  T.refund(1);
  const r2 = vm.runInContext('monthReport("' + ym + '")', T.ctx);
  eq("الربح بعد المرتجع", r2.profit, 1000);
  eq("قيمة المرتجعات", r2.back, 2000);
}

console.log("\n■ متابعة المتأخرين");
{
  const old = new Date(Date.now() - 60 * 86400000).toISOString();
  const st = base();
  st["ph.cust"] = JSON.stringify([
    { n: "أبو علي", phone: "07701234567", bal: 25000, log: [{ at: old, amt: 25000, note: "فاتورة 4" }] },
    { n: "أم حسن", phone: "", bal: 5000, log: [{ at: new Date().toISOString(), amt: 5000, note: "فاتورة 5" }] },
    { n: "مسدَّد", phone: "0770", bal: 0, log: [{ at: old, amt: 0, note: "" }] }
  ]);
  st["ph.cfg"] = JSON.stringify({ shop: "صيدلية النور", cur: "د.ع", late: 30 });
  const T = boot({ store: st });
  const rows = vm.runInContext('lateRows().map(x=>[x.c.n,x.d>=30])', T.ctx);
  eq("المتأخر وحده يظهر", rows, [["أبو علي", true]]);
  const link = vm.runInContext('waLink("07701234567","مرحبا")', T.ctx);
  ok("رقم عراقي بصيغة دولية", link.indexOf("wa.me/9647701234567") > 0);
  const msg = vm.runInContext('lateMsg(CUST[0])', T.ctx);
  ok("الرسالة فيها الاسم والمبلغ والصيدلية",
     msg.indexOf("أبو علي") >= 0 && msg.indexOf("25,000") >= 0 && msg.indexOf("صيدلية النور") >= 0);
}

const LICCODE = "TRQ.eyJkIjoiKiIsInMiOiLZhtiz2K7YqSDYp9iu2KrYqNin2LEiLCJ1IjoiMjAzMS0wOS0wOCIsInQiOiIyMDI2LTA5LTA4In0.WktxM6J4bj_WEat_IjJZ8Pv1VU7IC86_wYgDCubXNrkpWOkCrgy0bX2Wv-pC3ZMMXHIK3DBsDVkxXv07rKihTQ";
console.log("\n■ التجربة ١٢ ساعة والتفعيل");
{
  const H = 3600000;
  const fresh = boot({ store: base() });
  const r0 = vm.runInContext("licCheck()", fresh.ctx);
  eq("نسخة جديدة تعمل", r0.ok, true);
  eq("١٢ ساعة تجربة", r0.trial, 12);

  const st1 = base(); st1["ph.first"] = String(Date.now() - 11.5 * H);
  const near = boot({ store: st1 });
  const r1 = vm.runInContext("licCheck()", near.ctx);
  eq("قبل النهاية بنصف ساعة ما زال يعمل", r1.ok, true);
  eq("المتبقي ساعة أو أقل", r1.trial <= 1, true);

  const st2 = base(); st2["ph.first"] = String(Date.now() - 12.5 * H);
  const done = boot({ store: st2 });
  const r2 = vm.runInContext("licCheck()", done.ctx);
  eq("بعد ١٢ ساعة يُقفل", r2.ok, false);
  ok("سبب واضح", (r2.why || "").indexOf("التجربة") >= 0);

  const st3 = base(); st3["ph.first"] = String(Date.now() - 99 * H);
  st3["ph.lic2"] = JSON.stringify(LICCODE);
  const lic = boot({ store: st3 });
  const r3 = vm.runInContext("licCheck()", lic.ctx);
  eq("الرمز الصالح يفتح النسخة بعد انتهاء التجربة", r3.ok, true);
  eq("اسم الصيدلية من الرمز", r3.pay.s, "نسخة اختبار");

  const st4 = base(); st4["ph.first"] = String(Date.now() - 99 * H);
  st4["ph.lic2"] = JSON.stringify(LICCODE.slice(0, -6) + "ZZZZZ");
  const bad = boot({ store: st4 });
  eq("رمز معبوث به مرفوض", vm.runInContext("licCheck()", bad.ctx).ok, false);

  eq("رقم المزوّد", vm.runInContext("VENDOR_WA", fresh.ctx), "9647874001712");
  eq("اسم المطوّر", vm.runInContext("DEV_NAME", fresh.ctx), "صيدلاني الياس عبدالله");
}

console.log("\n════════════════════════════");
console.log("نجح " + PASS + " · فشل " + FAIL);
process.exit(FAIL ? 1 : 0);
