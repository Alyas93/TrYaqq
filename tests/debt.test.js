/* ===== ترياق — اختبارات الديون والأقساط =====
   تشغيل:  node tests/debt.test.js
   تبني بيئة متصفح وهمية، تحمّل app.js، وتنفّذ دورة دين كاملة:
   بيع بالدين ← تسديد جزئي ← تسديد كامل ← دفعة زائدة ← أقساط ← مرتجع. */
const fs = require("fs"), vm = require("vm"), path = require("path");
const ROOT = path.join(__dirname, "..");

let PASS = 0, FAIL = 0;
const eq = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { PASS++; console.log("  ✓ " + label); }
  else { FAIL++; console.log("  ✗ " + label + "\n      المتوقع: " + JSON.stringify(want) + "\n      الناتج:  " + JSON.stringify(got)); }
};
const ok = (label, cond) => eq(label, !!cond, true);

function boot(opts) {
  opts = opts || {};
  const store = Object.assign({}, opts.store || {});
  const els = {};
  const mkEl = id => ({
    id, value: "", innerHTML: "", textContent: "", style: {}, dataset: {},
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    appendChild() {}, addEventListener() {}, click() {}, focus() {},
    closest: () => null, querySelectorAll: () => [], remove() {}
  });
  const localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { if (opts.failKey && k === opts.failKey) throw new Error("Quota"); store[k] = String(v); },
    removeItem: k => { delete store[k]; }
  };
  const ctx = {
    console, setTimeout, clearTimeout, Date, Math, JSON, localStorage,
    document: {
      getElementById: id => els[id] || (els[id] = mkEl(id)),
      querySelector: () => null, querySelectorAll: () => [],
      addEventListener() {}, createElement: () => mkEl("t"),
      head: mkEl("h"), body: Object.assign(mkEl("b"), { classList: { add() {}, remove() {}, toggle() {}, contains: () => false } })
    },
    navigator: {}, location: { protocol: "file:" },
    URL: { createObjectURL: () => "", revokeObjectURL() {} },
    Blob: function () {}, File: function () {},
    scrollTo() {}, alert() {}, prompt: () => "",
    confirm: () => (opts.confirm === undefined ? true : opts.confirm)
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext("var SEED={rows:[]},PRICES={rows:[]},DOSES={oral:[],emerg:[],iv:[],fluid:[],age:[]};function toast(t){globalThis.LASTTOAST=t}", ctx);
  ctx.atob = s => Buffer.from(String(s), "base64").toString("binary");
  ctx.btoa = s => Buffer.from(String(s), "binary").toString("base64");
  ctx.TextDecoder = TextDecoder;
  vm.runInContext(fs.readFileSync(path.join(ROOT, "lic.js"), "utf8"), ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "app.js"), "utf8"), ctx);
  vm.runInContext(`
    ["renderHome","renderStock","renderCart","renderCust","renderPurch","renderWH","renderPlans",
     "renderUsers","renderDebt","renderTickets","renderAlerts","renderFavs","showReceipt","showVoucher",
     "renderGuide","renderDose","drawSug","drawQuota","applyPerms","renderLate"].forEach(f => { globalThis[f] = function(){}; });
    buildItems();
    globalThis.T = {
      cust: () => CUST, plans: () => PLANS, inv: () => INVOICES, items: () => ITEMS,
      custAdd, custPay, planAdd, planPay, findCust, debtRowsRaw: () => CUST,
      addToCart, doPay, refund, setPay: p => { PAYM = p; }, me: v => { ME = v; },
      lateRows, monthReport, ymOf
    };`, ctx);
  ctx.T.el = id => ctx.document.getElementById(id);
  ctx.T.raw = store;
  ctx.T.ctx = ctx;
  return ctx.T;
}
const stock = () => JSON.stringify([{ n: "Adol 500", b: "111", sc: "Paracetamol", k: 500, p: 1000, q: 20, min: 3 }]);
const base = () => ({ "ph.extra": stock(), "ph.cfg": JSON.stringify({ shop: "صيدلية الاختبار", cur: "د.ع", late: 30 }) });
const adol = T => T.items().find(x => x.n === "Adol 500");
const bal = (T, n) => (T.findCust(n) || {}).bal;

console.log("\n■ دورة دين كاملة");
{
  const T = boot({ store: base() });
  T.addToCart(adol(T), 5);                       /* 5,000 */
  T.setPay("دين"); T.el("cust").value = "أبو علي"; T.el("tendered").value = ""; T.doPay();
  eq("الدين بعد البيع", bal(T, "أبو علي"), 5000);
  eq("المخزون نقص", adol(T).q, 15);
  eq("حركة واحدة في السجل", T.findCust("أبو علي").log.length, 1);

  T.custPay(T.findCust("أبو علي"), 2000);        /* تسديد جزئي */
  eq("بعد تسديد جزئي", bal(T, "أبو علي"), 3000);
  T.custPay(T.findCust("أبو علي"), 3000);        /* تسديد كامل */
  eq("مسدَّد بالكامل", bal(T, "أبو علي"), 0);
  eq("ثلاث حركات", T.findCust("أبو علي").log.length, 3);
  eq("مجموع السجل = الرصيد", T.findCust("أبو علي").log.reduce((a, l) => a + l.amt, 0), 0);
}

console.log("\n■ مدخلات خاطئة في التسديد");
{
  const T = boot({ store: base() });
  T.custAdd("أم حسن", 10000, "فاتورة");
  T.custPay(T.findCust("أم حسن"), -5000);        /* سالب: كان يزيد الدين */
  eq("المبلغ السالب مرفوض", bal(T, "أم حسن"), 10000);
  T.custPay(T.findCust("أم حسن"), "أبجد");
  eq("النص مرفوض", bal(T, "أم حسن"), 10000);
  T.custPay(T.findCust("أم حسن"), 0);
  eq("الصفر مرفوض", bal(T, "أم حسن"), 10000);
  T.custPay(T.findCust("أم حسن"), 2500.6);      /* 2500.6 → 2501 */
  eq("الكسر يُقرَّب", bal(T, "أم حسن"), 7499);
}

console.log("\n■ دفعة أكبر من الدين");
{
  const T = boot({ store: base() });
  T.custAdd("كريم", 4000, "فاتورة");
  const no = boot({ store: base(), confirm: false });
  no.custAdd("كريم", 4000, "فاتورة");
  no.custPay(no.findCust("كريم"), 10000);
  eq("الرفض يمنع التسجيل", bal(no, "كريم"), 4000);
  T.custPay(T.findCust("كريم"), 10000);          /* بعد التأكيد */
  eq("الفائض رصيد للزبون", bal(T, "كريم"), -6000);
}

console.log("\n■ الأقساط");
{
  const T = boot({ store: base() });
  T.planAdd("سعد", 10000, 3, 30);
  T.custAdd("سعد", 10000, "أقساط");
  const items = T.plans()[0].items;
  eq("ثلاثة أقساط", items.length, 3);
  eq("مجموع الأقساط = أصل الدين", items.reduce((a, q) => a + q.amt, 0), 10000);
  eq("الكسر في القسط الأخير", items.map(q => q.amt), [3333, 3333, 3334]);
  ok("تواريخ الاستحقاق متصاعدة", items[0].due < items[1].due && items[1].due < items[2].due);

  T.planPay(0, 0, 3333);
  eq("القسط الأول مسدَّد", T.plans()[0].items[0].paid, 3333);
  eq("الدين نقص بالمقدار نفسه", bal(T, "سعد"), 6667);
  const paid = T.planPay(0, 1, 99999);           /* أكبر من القسط */
  eq("التسديد لا يتجاوز القسط", paid, 3333);
  eq("القسط الثاني لم يتضخّم", T.plans()[0].items[1].paid, 3333);
  eq("الدين بعد قسطين", bal(T, "سعد"), 3334);
  T.planPay(0, 2, -500);
  eq("السالب مرفوض في الأقساط", bal(T, "سعد"), 3334);
  T.planPay(0, 2, 3334);
  eq("الدين صفر بعد كل الأقساط", bal(T, "سعد"), 0);
  eq("كل الأقساط مسدَّدة", T.plans()[0].items.every(q => q.paid >= q.amt), true);
}

console.log("\n■ تراجع ذرّي في تسديد القسط");
{
  const T = boot({ store: base() });             /* نُنشئ الأقساط بحفظ سليم */
  T.planAdd("نور", 6000, 2, 30);
  T.custAdd("نور", 6000, "أقساط");
  const T2 = boot({ store: T.raw, failKey: "ph.plans" });   /* ثم جهاز ذاكرته ممتلئة */
  const before = bal(T2, "نور");
  T2.planPay(0, 0, 3000);
  eq("الدين لم يتغيّر", bal(T2, "نور"), before);
  eq("القسط لم يُسجَّل مسدَّداً", T2.plans()[0].items[0].paid, 0);
}

console.log("\n■ المرتجع يصحّح الدين");
{
  const T = boot({ store: base() });
  T.addToCart(adol(T), 4);                       /* 4,000 ديناً */
  T.setPay("دين"); T.el("cust").value = "حيدر"; T.el("tendered").value = ""; T.doPay();
  T.custPay(T.findCust("حيدر"), 1000);
  eq("بعد تسديد جزئي", bal(T, "حيدر"), 3000);
  T.refund(1);
  eq("المرتجع يخصم كامل دين الفاتورة", bal(T, "حيدر"), -1000);   /* دفع 1000 ولم يأخذ بضاعة */
  eq("المخزون عاد", adol(T).q, 20);
}

console.log("\n■ بيع بدفعة جزئية نقداً + دين");
{
  const T = boot({ store: base() });
  T.addToCart(adol(T), 10);                      /* 10,000 */
  T.setPay("دين"); T.el("cust").value = "عمار"; T.el("tendered").value = "6000"; T.doPay();
  eq("المتبقي دين", bal(T, "عمار"), 4000);
  eq("الفاتورة تسجّل المدفوع", T.inv()[0].paid, 6000);
  eq("والمتبقي", T.inv()[0].owed, 4000);
}

console.log("\n■ قوائم المتأخرين والتقرير");
{
  const old = new Date(Date.now() - 45 * 86400000).toISOString();
  const st = base();
  st["ph.cust"] = JSON.stringify([
    { n: "قديم", phone: "07701112222", bal: 12000, log: [{ at: old, amt: 12000, note: "" }] },
    { n: "حديث", phone: "0770", bal: 3000, log: [{ at: new Date().toISOString(), amt: 3000, note: "" }] },
    { n: "دائن", phone: "", bal: -2000, log: [{ at: old, amt: -2000, note: "" }] }
  ]);
  const T = boot({ store: st });
  eq("المتأخر وحده", T.lateRows().map(x => x.c.n), ["قديم"]);
  const ym = new Date().toISOString().slice(0, 7);
  T.custPay(T.findCust("قديم"), 5000);
  eq("الرصيد بعد التحصيل", bal(T, "قديم"), 7000);
  eq("التحصيل يظهر في تقرير الشهر", T.monthReport(ym).collected, 5000);
  eq("خرج من قائمة المتأخرين بعد الحركة", T.lateRows().length, 0);
}

console.log("\n■ سلامة السجل بعد عمليات كثيرة");
{
  const T = boot({ store: base() });
  for (let i = 0; i < 25; i++) {
    T.custAdd("متعامل", 1000, "فاتورة " + i);
    if (i % 3 === 0) T.custPay(T.findCust("متعامل"), 500);
  }
  const c = T.findCust("متعامل");
  eq("الرصيد = مجموع السجل", c.bal, c.log.reduce((a, l) => a + l.amt, 0));
  eq("الرصيد المتوقع", c.bal, 25000 - 9 * 500);
}

console.log("\n════════════════════════════");
console.log("نجح " + PASS + " · فشل " + FAIL);
process.exit(FAIL ? 1 : 0);
