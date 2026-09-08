/* ===== ترياق — قواعد حساب الجرع للأطفال =====
   كل سطر يحمل قاعدته الظاهرة للصيدلي: v = المقدار لكل كيلوغرام، f = عدد المرات باليوم.
   u: وحدة العرض (cc أو unit). ck: يحتاج تأكيد الصيدلاني قبل الاعتماد.
   القيم مستخرجة من حاسبة المستخدم نفسها (وزن ٢ كغم للشراب و٦ كغم للحقن). */
const DOSES = {
  oral: [
    { n: "Adol 120mg/5ml",              sc: "Paracetamol",   v: 0.42,  f: 4 },
    { n: "Adol 125mg/5ml",              sc: "Paracetamol",   v: 0.4,   f: 4 },
    { n: "Adol 250mg/5ml",              sc: "Paracetamol",   v: 0.2,   f: 4 },
    { n: "Ibuprofen 40mg/1ml",          sc: "Ibuprofen",     v: 0.25,  f: 3 },
    { n: "Ibuprofen 100mg/5ml",         sc: "Ibuprofen",     v: 0.5,   f: 3 },
    { n: "Ponstan suspension 50mg/5ml", sc: "Mefenamic acid",v: 0.8,   f: 3 },
    { n: "Amoxil 125mg/5ml",            sc: "Amoxicillin",   v: 0.5,   f: 3 },
    { n: "Amoxil 250mg/5ml",            sc: "Amoxicillin",   v: 0.25,  f: 3 },
    { n: "Ampiclox 125mg/5ml",          sc: "Ampicillin/Cloxacillin", v: 2, f: 4 },
    { n: "Ampiclox 250mg/5ml",          sc: "Ampicillin/Cloxacillin", v: 1, f: 4 },
    { n: "Erythromycin 125mg/5ml",      sc: "Erythromycin",  v: 0.37,  f: 4 },
    { n: "Erythromycin 250mg/5ml",      sc: "Erythromycin",  v: 0.18,  f: 4 },
    { n: "Azithromycin 100mg/5ml",      sc: "Azithromycin",  v: 0.5,   f: 1 },
    { n: "Azithromycin 200mg/5ml",      sc: "Azithromycin",  v: 0.25,  f: 1 },
    { n: "Flagyl 125mg/5ml",            sc: "Metronidazole", v: 0.6,   f: 3 },
    { n: "Flagyl 200mg/5ml",            sc: "Metronidazole", v: 0.375, f: 3 },
    { n: "Keflex 125mg/5ml",            sc: "Cephalexin",    v: 0.5,   f: 4 },
    { n: "Keflex 250mg/5ml",            sc: "Cephalexin",    v: 0.25,  f: 4 },
    { n: "Suprax 100mg/5ml",            sc: "Cefixime",      v: 0.4,   f: 1, note: "مرة واحدة، أو تُقسم على جرعتين" },
    { n: "Bactrim (TMP/SMX) 240mg/5ml", sc: "Co-trimoxazole",v: 0.5,   f: 2 },
    { n: "Cefodox 100mg/5ml",           sc: "Cefpodoxime",   v: 0.5,   f: 2 },
    { n: "Co-amoxiclav 312mg/5ml",      sc: "Co-amoxiclav",  v: 0.5,   f: 2 },
    { n: "Co-amoxiclav 457mg/5ml",      sc: "Co-amoxiclav",  v: 0.5,   f: 2 },
    { n: "Sefarin 125mg/5ml",           sc: "Cefdinir",      v: 0.56,  f: 1, note: "مرة واحدة، أو تُقسم على جرعتين" },
    { n: "Zofran / De-vomit 4mg/5ml",   sc: "Ondansetron",   v: 0.5,   f: 3 },
    { n: "Dexon 0.5mg/5ml",             sc: "Dexamethasone", v: 1,     f: 4 },
    { n: "Butadiene (salbutamol) 2mg/5ml", sc: "Salbutamol", v: 0.25,  f: 3 },
    { n: "Bronquium Elixir 120ml",      sc: "",              v: 0.56,  f: 3 }
  ],

  emerg: [
    { n: "Normal Saline bolus",          v: 20,   u: "cc", per: "مل/ساعة",  f: 0 },
    { n: "Maintenance fluid (G.S)",      v: 100,  u: "cc", per: "مل/٢٤ساعة", f: 0 },
    { n: "Paracetamol vial",             v: 1.5,  f: 4 },
    { n: "Paracetamol amp",              v: 0.1,  f: 4 },
    { n: "De-vomit amp (8mg/4ml)",       v: 0.1,  f: 3 },
    { n: "H.C vial (100mg + 2ml N.S)",   v: 0.1,  f: 4 },
    { n: "Allermine amp (10mg/1ml)",     v: 0.05, f: 4 },
    { n: "Decadron amp",                 v: 0.05, f: 2 },
    { n: "Lasix amp (20mg/2ml)",         v: 0.1,  f: 2 },
    { n: "Voltarin amp (75mg/3ml)",      v: 0.08, f: 1, note: "عضلي IM" },
    { n: "Zantac amp (50mg/2ml)",        v: 0.16, f: 2 },
    { n: "Adrenalin (1:1000) 1mg/1ml",   v: 0.01, f: 0, unit2: 100 },
    { n: "Atropine amp 0.6mg/1ml",       v: 0.0333, f: 0, unit2: 100 },
    { n: "Aminophylline 250mg/10cc",     v: 0.2,  f: 0, note: "+ 30cc N.S خلال ٣٠ دقيقة" },
    { n: "Valium amp 10mg/2cc — وريدي",  v: 4,    u: "unit", f: 0, note: "+2cc N.S ببطء ٣–٥ دقائق" },
    { n: "Valium amp — شرجي",            v: 8,    u: "unit", f: 0, note: "أو بأنبوب معدي صغير" },
    { n: "Luminal 40mg/1ml — Bolus",     v: 37.5, u: "unit", f: 0, note: "+2cc N.S ببطء ٣–٥ دقائق" },
    { n: "Luminal 200mg/1ml — Bolus",    v: 7.5,  u: "unit", f: 0, note: "+2cc N.S ببطء ٣–٥ دقائق" },
    { n: "Luminal 40mg/1ml — صيانة",     v: 6.25, u: "unit", f: 2 },
    { n: "Luminal 200mg/1ml — صيانة",    v: 1.25, u: "unit", f: 2 },
    { n: "Phenytoin 250mg/5ml — Bolus",  v: 30,   u: "unit", f: 0, note: "+10cc N.S ببطء ٢٠ دقيقة" },
    { n: "Phenytoin 250mg/5ml — صيانة",  v: 5,    u: "unit", f: 2, note: "+10cc N.S ببطء ٢٠ دقيقة" },
    { n: "Midazolam 15mg/3ml",           v: 1,    u: "cc", per: "مل/ساعة", f: 0,
      note: "أضف 1cc ميدازولام إلى 49cc N.S — مضخة مِحقنة" }
  ],

  iv: [
    { n: "Ampicillin vial 500mg + 5cc N.S",        v: 0.5,   f: 2 },
    { n: "Amoxil vial 500mg + 5cc",                v: 0.25,  f: 2 },
    { n: "Ceftriaxone vial 1g + 10cc N.S",         v: 0.5,   f: 1, note: "مرة واحدة، أو تُقسم على جرعتين" },
    { n: "Claforan vial 1g + 10cc N.S",            v: 0.5,   f: 2 },
    { n: "Garamycin amp 80mg/2ml + 6cc N.S",       v: 0.25,  f: 2 },
    { n: "Garamycin amp 20mg/2ml",                 v: 0.25,  f: 2 },
    { n: "Flagyl bottle 500mg/100ml",              v: 2,     f: 3 },
    { n: "Ceftazidime vial 1g + 10cc",             v: 0.5,   f: 3 },
    { n: "Acyclovir vial 250mg + 5cc",             v: 0.2,   f: 3 },
    { n: "Amikacin amp 100mg/2cc",                 v: 0.15,  f: 2 },
    { n: "Amikacin amp 500mg/2cc + 3cc N.S",       v: 0.075, f: 2 },
    { n: "Protec vial 1g + 10cc N.S",              v: 0.5,   f: 2 },
    { n: "Vancomycin vial 500 + 5cc N.S",          v: 0.1333, f: 3, unit2: 100,
      note: "+ 30cc N.S خلال ساعة" },
    { n: "MERONEM vial 500mg + 5cc N.S",           v: 0.2,   f: 2, note: "حديثي الولادة — + 20cc N.S خلال ٣٠ دقيقة" }
  ],

  fluid: [
    { n: "Whole blood",       v: 20, u: "cc", per: "مل خلال ٤ ساعات", f: 0, ck: 1 },
    { n: "Packed RBCs",       v: 10, u: "cc", per: "مل خلال ٤ ساعات", f: 0, ck: 1 },
    { n: "Plasma",            v: 10, u: "cc", per: "مل خلال ٤ ساعات", f: 0, ck: 1 },
    { n: "Calcium gluconate 10% (1ml=100mg)", v: 0.5, f: 4, ck: 1,
      note: "تسريب — كل 1cc يُخفَّف بـ10ml G/W" }
  ],

  /* جرع ثابتة حسب العمر لا تعتمد على الوزن */
  age: [
    { n: "Prospan syrup",            rows: ["١–٦ سنوات: 2.5 مل ×2", "٦–١٢ سنة: 5 مل ×2", "فوق ١٢ سنة: 5 مل ×3"] },
    { n: "Solvodin syrup",           rows: ["٦–١٢ سنة: 5 مل ×2", "فوق ١٢ سنة: 10 مل ×3"] },
    { n: "Tussilet syrup",           rows: ["٦–١٢ شهر: 2 مل ×2", "فوق ١٢ شهر: 5 مل ×3"] },
    { n: "Coldin syrup 100ml",       rows: ["دون ٦ سنوات: 5 مل ×4", "فوق ٦ سنوات: 10 مل ×4"] },
    { n: "Chlorpheniramine 2mg/5ml", rows: ["٢–٦ سنوات: 2.5 مل ×4"] },
    { n: "Loratidine 5mg/5ml",       rows: ["٢–١١ سنة: 5 مل ×1"] },
    { n: "Desloratadine 2.5mg/5ml",  rows: ["٦–١٢ شهر: 2 مل ×1", "١–٥ سنوات: 2.5 مل ×1", "فوق ٥ سنوات: 5 مل ×1"] }
  ]
};
