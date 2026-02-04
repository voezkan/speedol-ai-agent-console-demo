const $ = (id) => document.getElementById(id);

let RANGE = "7d";
let INSIGHTS = null;
let PRODUCTS = [];


const DEMO_FLOW = [
  {
    view: "overview",
    title: "AI Overview",
    tag: "1/5",
    text: "AI’nin tek ekranda KPI özeti + aksiyon listesi. 'Sorun/Fikir/Çözüm' paneli burada."
  },
  {
    view: "sales",
    title: "Sales Analyst Agent",
    tag: "2/5",
    text: "Ne oldu? Neden olabilir? Ne yapalım? Kategori + segment içgörüleri."
  },
  {
    view: "reporting",
    title: "Reporting Agent",
    tag: "3/5",
    text: "KPI raporu ve yönetici özeti. Raporlamayı otomatikleştirme mesajı."
  },
  {
    view: "social",
    title: "Social Media Agent",
    tag: "4/5",
    text: "Hedef kitle varsayımı + 7 günlük içerik planı + örnek post metni."
  },
  {
    view: "sources",
    title: "Data Sources",
    tag: "5/5",
    text: "Sistem içi/dışı veri kaynakları. Demo’da JSON ile simülasyon; gerçek projede API/DB."
  }
];

let demoOpen = false;
let demoIndex = 0;

function renderDemoSteps() {
  const wrap = $("demoSteps");
  if (!wrap) return;
  wrap.innerHTML = "";
  DEMO_FLOW.forEach((s, i) => {
    const div = document.createElement("div");
    div.className = "dstep" + (i === demoIndex ? " active" : "");
    div.innerHTML = `
      <div class="h">
        <div class="n">${s.title}</div>
        <div class="tag">${s.tag}</div>
      </div>
      <div class="p">${s.text}</div>
    `;
    wrap.appendChild(div);
  });
  $("demoPrev").disabled = demoIndex === 0;
  $("demoNext").textContent = demoIndex === DEMO_FLOW.length - 1 ? "Bitir" : "Devam";
}

function openDemo() {
  demoOpen = true;
  demoIndex = 0;
  $("demoOverlay").classList.add("show");
  $("demoOverlay").setAttribute("aria-hidden", "false");
  renderDemoSteps();
  goDemoStep();
}

function closeDemo() {
  demoOpen = false;
  $("demoOverlay").classList.remove("show");
  $("demoOverlay").setAttribute("aria-hidden", "true");
}

function goDemoStep() {
  const s = DEMO_FLOW[demoIndex];
  if (!s) return;
  setView(s.view);
  window.scrollTo({ top: 0, behavior: "smooth" });
  renderDemoSteps();
}

async function api(url, opts) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function fmtEUR(x) {
  const n = Number(x || 0);
  return n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}
function fmtNum(x) {
  const n = Number(x || 0);
  return n.toLocaleString("de-DE");
}
function fmtPct(x) {
  const n = Number(x || 0);
  return `${n.toFixed(2)}%`;
}

function setRangeButtons(range) {
  document.querySelectorAll(".segbtn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.range === range);
  });
}

function setView(view) {
  document.querySelectorAll(".navitem").forEach(b => b.classList.toggle("active", b.dataset.view === view));
  document.querySelectorAll(".view").forEach(v => v.classList.remove("show"));
  const el = document.getElementById(`view-${view}`);
  if (el) el.classList.add("show");
}

function chip(text) {
  const span = document.createElement("span");
  span.className = "chip";
  span.textContent = text;
  return span;
}

function renderKPIs(k) {
  const grid = $("kpiGrid");
  grid.innerHTML = "";
  const items = [
    { label: "Ciro", val: fmtEUR(k.revenue), sub: "Seçili aralık" },
    { label: "Sipariş", val: fmtNum(k.orders), sub: "Toplam" },
    { label: "Dönüşüm", val: fmtPct(k.conversion), sub: "purchases/sessions" },
    { label: "Sepet terk", val: fmtPct(k.cartAbandon), sub: "add_to_cart → checkout" },
  ];
  for (const it of items) {
    const div = document.createElement("div");
    div.className = "kpi";
    div.innerHTML = `<div class="k">${it.label}</div><div class="v">${it.val}</div><div class="s">${it.sub}</div>`;
    grid.appendChild(div);
  }
}

function prioClass(p) {
  const x = String(p || "").toLowerCase();
  if (x.includes("high")) return "high";
  if (x.includes("medium")) return "medium";
  return "low";
}

function renderActions(actions) {
  const wrap = $("actionList");
  wrap.innerHTML = "";
  (actions || []).forEach(a => {
    const div = document.createElement("div");
    div.className = "action";
    div.innerHTML = `
      <div class="top">
        <span class="prio ${prioClass(a.prio)}">${a.prio}</span>
        <div class="title">${a.title}</div>
      </div>
      <div class="detail">${a.detail}</div>
    `;
    wrap.appendChild(div);
  });
}

function renderTopCategories(cats) {
  const wrap = $("topCats");
  wrap.innerHTML = "";
  (cats || []).slice(0, 3).forEach(c => wrap.appendChild(chip(`${c.category} • ${fmtEUR(c.revenue)}`)));
}

function svgLineChart({ series, yKey, labelLeft, valueFmt }) {
  const w = 900, h = 300, pad = 34;
  const ys = series.map(s => Number(s[yKey] || 0));
  const yMin = Math.min(...ys, 0);
  const yMax = Math.max(...ys, 1);
  const xScale = (i) => pad + (i / Math.max(1, series.length - 1)) * (w - pad * 2);
  const yScale = (v) => (h - pad) - ((v - yMin) / (yMax - yMin || 1)) * (h - pad * 2);

  let d = "";
  series.forEach((s, i) => {
    const x = xScale(i);
    const y = yScale(Number(s[yKey] || 0));
    d += (i === 0 ? "M" : "L") + x.toFixed(1) + " " + y.toFixed(1) + " ";
  });

  const last = series[series.length - 1] || {};
  const lastVal = Number(last[yKey] || 0);
  const idxs = [0, Math.floor((series.length - 1) / 2), series.length - 1].filter((v,i,a)=>a.indexOf(v)===i);
  const xLabels = idxs.map(i => {
    const date = (series[i]?.date || "").slice(5);
    return `<text x="${xScale(i)}" y="${h - 10}" text-anchor="middle" font-size="12" fill="rgba(234,240,255,.55)">${date}</text>`;
  }).join("");

  return `
  <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
    <defs>
      <linearGradient id="g1" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="rgba(37,99,235,.95)"/>
        <stop offset="100%" stop-color="rgba(124,58,237,.95)"/>
      </linearGradient>
    </defs>
    <line x1="${pad}" y1="${h-pad}" x2="${w-pad}" y2="${h-pad}" stroke="rgba(255,255,255,.12)" />
    <path d="${d}" fill="none" stroke="url(#g1)" stroke-width="4" stroke-linecap="round" />
    <circle cx="${xScale(series.length-1)}" cy="${yScale(lastVal)}" r="6" fill="rgba(34,197,94,.9)"/>
    <text x="${pad}" y="${pad}" font-size="12" fill="rgba(234,240,255,.55)">${labelLeft}</text>
    <text x="${w-pad}" y="${pad}" text-anchor="end" font-size="14" fill="rgba(234,240,255,.80)">${valueFmt(lastVal)}</text>
    ${xLabels}
  </svg>`;
}

function renderCharts(series) {
  $("chartRevenue").innerHTML = svgLineChart({ series, yKey: "revenue", labelLeft: "Ciro", valueFmt: (v)=>fmtEUR(v) });
  $("chartTraffic").innerHTML = svgLineChart({ series, yKey: "sessions", labelLeft: "Oturum", valueFmt: (v)=>fmtNum(v) });
}

function renderTables() {
  const cats = INSIGHTS?.categories || [];
  const catWrap = $("tblCategories");
  catWrap.innerHTML = "";

  const head = document.createElement("div");
  head.className = "trow thead";
  head.innerHTML = `<div class="tcell">Kategori</div><div class="tcell">Gelir</div><div class="tcell">Sipariş</div><div class="tcell">İade %</div>`;
  catWrap.appendChild(head);

  cats.forEach(c => {
    const row = document.createElement("div");
    row.className = "trow";
    row.innerHTML = `<div class="tcell">${c.category}</div><div class="tcell">${fmtEUR(c.revenue)}</div><div class="tcell">${fmtNum(c.orders)}</div><div class="tcell">${fmtPct(c.returnRate)}</div>`;
    catWrap.appendChild(row);
  });

  const segs = INSIGHTS?.segments || [];
  const segWrap = $("tblSegments");
  segWrap.innerHTML = "";
  const head2 = document.createElement("div");
  head2.className = "trow thead";
  head2.innerHTML = `<div class="tcell">Segment</div><div class="tcell">Gelir</div><div class="tcell">Sipariş</div><div class="tcell">—</div>`;
  segWrap.appendChild(head2);

  segs.forEach(s => {
    const row = document.createElement("div");
    row.className = "trow";
    row.innerHTML = `<div class="tcell">${s.segment}</div><div class="tcell">${fmtEUR(s.revenue)}</div><div class="tcell">${fmtNum(s.orders)}</div><div class="tcell"></div>`;
    segWrap.appendChild(row);
  });
}

function makeSalesAgentText() {
  const k = INSIGHTS.kpis;
  const topCat = INSIGHTS.categories?.[0]?.category || "—";
  const topSeg = INSIGHTS.segments?.[0]?.segment || "—";
  const a0 = INSIGHTS.actions?.[0]?.title || "—";
  return `
<strong>Ne oldu?</strong> Seçilen aralıkta ciro ${fmtEUR(k.revenue)} ve sipariş ${fmtNum(k.orders)}. Dönüşüm ${fmtPct(k.conversion)}.<br><br>
<strong>Neden olabilir?</strong> En yüksek katkı ${topCat} kategorisinde. En güçlü segment: ${topSeg}.<br><br>
<strong>Ne yapalım?</strong> İlk aksiyon: ${a0}. Ayrıca sepet terk oranı ${fmtPct(k.cartAbandon)} olduğu için checkout iyileştirmesi önerilir.
  `.trim();
}

function makeReportAgentText() {
  const k = INSIGHTS.kpis;
  return `
Bu rapor seçilen aralık için otomatik özetlendi. Ciro ${fmtEUR(k.revenue)}, sipariş ${fmtNum(k.orders)}, AOV ${fmtEUR(k.aov)}.
Dönüşüm ${fmtPct(k.conversion)}, sepet terk ${fmtPct(k.cartAbandon)}, iade ${fmtPct(k.returnRate)}.
Öneri: Aksiyonlar listesindeki ilk 2 maddeyi uygulayıp 7 gün sonra KPI değişimini karşılaştır.
  `.trim();
}

function renderReporting() {
  const k = INSIGHTS.kpis;
  const wrap = $("reportGrid");
  wrap.innerHTML = "";

  const items = [
    ["Ciro", fmtEUR(k.revenue)],
    ["Sipariş", fmtNum(k.orders)],
    ["AOV", fmtEUR(k.aov)],
    ["Dönüşüm", fmtPct(k.conversion)],
    ["Sepet Terk", fmtPct(k.cartAbandon)],
    ["İade Oranı", fmtPct(k.returnRate)],
  ];

  const grid = document.createElement("div");
  grid.className = "kpi-grid";
  grid.style.gridTemplateColumns = "repeat(3, minmax(0, 1fr))";
  items.forEach(([label, val]) => {
    const div = document.createElement("div");
    div.className = "kpi";
    div.innerHTML = `<div class="k">${label}</div><div class="v">${val}</div><div class="s">KPI</div>`;
    grid.appendChild(div);
  });
  wrap.appendChild(grid);

  $("agentReportText").innerHTML = makeReportAgentText();
}

function genSocialPlan(persona, platform) {
  const topics = {
    fp: [
      { t: "Fiyat/performans: doğru ürün seçimi", f: "Reels" },
      { t: "3 hata: yanlış seçim", f: "Post" },
      { t: "AI ile 30 sn'de öneri", f: "Story" },
      { t: "Bakım ipucu: periyodik kontrol", f: "Reels" },
      { t: "Kampanya: paket fırsatı", f: "Post" },
      { t: "Soru-cevap: iade/kargo", f: "Story" },
      { t: "Hafta sonu hatırlatma + CTA", f: "Reels" },
    ],
    premium: [
      { t: "Premium bakım: kalite farkı", f: "Reels" },
      { t: "Spesifikasyon nedir?", f: "Post" },
      { t: "Uzun ömür: bakım rutini", f: "Story" },
      { t: "Güven: kaynak & kalite", f: "Reels" },
      { t: "Premium paket", f: "Post" },
      { t: "Müşteri yorumu (demo)", f: "Story" },
      { t: "Hafta sonu CTA", f: "Reels" },
    ],
    trend: [
      { t: "Hızlı ipucu: doğru seçim", f: "Reels" },
      { t: "Myth busting", f: "Post" },
      { t: "AI öneri challenge", f: "Story" },
      { t: "Kısa checklist", f: "Reels" },
      { t: "Mini kampanya", f: "Post" },
      { t: "Anket: hangisi?", f: "Story" },
      { t: "Hafta sonu CTA", f: "Reels" },
    ],
    b2b: [
      { t: "Filo bakımı: maliyet düşürme", f: "Post" },
      { t: "Toplu alım avantajları", f: "Reels" },
      { t: "KPI: iade ve stok yönetimi", f: "Post" },
      { t: "AI ile otomatik rapor", f: "Reels" },
      { t: "Teklif iste", f: "Story" },
      { t: "Case study (demo)", f: "Post" },
      { t: "Hafta sonu hatırlatma", f: "Story" },
    ],
  };

  const list = topics[persona] || topics.fp;
  const today = new Date();
  const days = ["Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi","Pazar"];
  const plan = list.map((x, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const day = days[d.getDay() === 0 ? 6 : d.getDay()-1];
    return { day, ...x, cta: "Aracını seç, öneriyi al." };
  });

  const bestTimes = persona === "b2b" ? ["10:00", "12:30", "16:30"] : ["18:30", "19:30", "21:00"];
  const copy = `
<strong>${platform} için örnek metin</strong><br><br>
E‑ticaret operasyonlarını tek panelden yönet. <strong>AI Agent</strong> ile satış analizi, raporlama ve içerik planını dakikalar içinde çıkar.<br><br>
<strong>CTA:</strong> Demo paneli incele.
  `.trim();

  return { plan, bestTimes, copy };
}

function renderSocial(persona="fp", platform="Instagram") {
  const { plan, bestTimes, copy } = genSocialPlan(persona, platform);

  const timesWrap = $("bestTimes");
  timesWrap.innerHTML = "";
  bestTimes.forEach(t => timesWrap.appendChild(chip(t)));

  const planWrap = $("planList");
  planWrap.innerHTML = "";
  plan.forEach(p => {
    const div = document.createElement("div");
    div.className = "planitem";
    div.innerHTML = `<div class="d">${p.day} • ${p.f}</div><div class="t">${p.t}</div><div class="s">CTA: ${p.cta}</div>`;
    planWrap.appendChild(div);
  });

  $("socialCopy").innerHTML = copy;
}

function renderReco() {
  const seg = $("recoSegment").value;
  const goal = $("recoGoal").value;
  const oils = PRODUCTS.filter(p => p.category === "Motor Yağı").slice(0, 3);

  $("recoWhy").innerHTML = `
Bu öneriler <strong>${seg}</strong> segmentine ve hedefe (<strong>${goal}</strong>) göre hazırlanmıştır.
Gerçek projede davranış (tıklama/sepete ekleme), satış geçmişi ve ürün özellikleri birlikte kullanılır.
Demo’da kategori motor yağıdır; mantık kategori bağımsızdır.
  `.trim();

  const wrap = $("recoCards");
  wrap.innerHTML = "";
  oils.forEach((p, i) => {
    const reason = i === 0 ? "En dengeli seçenek, stok yeterli." : i === 1 ? "Upsell için uygun, spesifikasyon güçlü." : "Yeni kullanıcı için net seçim, fiyat/performans.";
    const div = document.createElement("div");
    div.className = "rcard";
    div.innerHTML = `
      <div class="rthumb">${p.image ? `<img src="${p.image}" alt="${p.name}">` : ""}</div>
      <div class="rbody">
        <div class="rname">${p.name}</div>
        <div class="rmeta">
          <span class="chip">${p.viscosity || "—"}</span>
          <span class="chip">${p.sizeL ? p.sizeL + "L" : "—"}</span>
          <span class="chip">${fmtEUR(p.priceEUR)}</span>
        </div>
        <div class="rreason">Gerekçe: ${reason}</div>
      </div>
    `;
    wrap.appendChild(div);
  });
}

function renderStore() {
  const wrap = $("storeGrid");
  wrap.innerHTML = "";
  PRODUCTS.slice(0, 6).forEach(p => {
    const div = document.createElement("div");
    div.className = "scard";
    div.innerHTML = `
      <div class="sthumb">${p.image ? `<img src="${p.image}" alt="${p.name}">` : ""}</div>
      <div class="sbody">
        <div class="sname">${p.name}</div>
        <div class="smeta">
          <span class="chip">${p.category}</span>
          ${p.viscosity ? `<span class="chip">${p.viscosity}</span>` : ""}
          ${p.sizeL ? `<span class="chip">${p.sizeL}L</span>` : ""}
        </div>
        <div class="sprice">${fmtEUR(p.priceEUR)}</div>
        <div class="tiny">SKU: ${p.sku} • Stok: ${p.stock ?? "—"}</div>
      </div>
    `;
    wrap.appendChild(div);
  });
}

async function loadInsights() {
  $("aiSummary").textContent = "Yükleniyor…";
  const data = await api(`/api/insights?range=${encodeURIComponent(RANGE)}`);
  INSIGHTS = data;

  $("pillAI").textContent = data.aiMode === "ai" ? "AI: aktif" : "AI: fallback";
  $("pillAI").style.background = data.aiMode === "ai" ? "rgba(34,197,94,.12)" : "rgba(249,115,22,.12)";
  $("pillAI").style.borderColor = data.aiMode === "ai" ? "rgba(34,197,94,.25)" : "rgba(249,115,22,.25)";
  $("aiModeLine").textContent = `Mod: ${data.aiMode.toUpperCase()} • Aralık: ${data.range}`;

  $("lastUpdated").textContent = new Date().toLocaleString("de-DE");

  renderKPIs(data.kpis);
  renderActions(data.actions);
  renderTopCategories(data.categories);
  $("aiSummary").textContent = data.aiSummary || "Özet hazır.";
  renderCharts(data.series);

  $("agentSalesText").innerHTML = makeSalesAgentText();
  renderTables();
  renderReporting();
}

async function loadSources() {
  let s = null;
  try {
    s = await api("/api/datasets");
  } catch (e) {
    s = null;
  }
  // fallback demo data if backend not reachable or returns empty
  if (!s || (!Array.isArray(s.internal) && !Array.isArray(s.external))) {
    s = {
      internal: [
        "Siparişler: tarih, tutar, ürün, adet",
        "Ürün kataloğu: kategori, fiyat, stok",
        "Kullanıcı davranışı: add_to_cart, checkout, abandon",
        "Kampanya performansı: indirim, kupon, dönüşüm"
      ],
      external: [
        "Trend sinyali: talep artış/düşüş (mock)",
        "Sosyal etkileşim: beğeni, yorum, paylaşım (mock)",
        "Reklam performansı: spend, CTR, CVR (mock)",
        "Rakip sinyali: fiyat/kampanya (mock)"
      ],
      note: "Bu ekranda gösterilen veriler demo amaçlı simüle edilmiştir. Gerçek sistemde e-ticaret altyapısı, reklam platformları ve üçüncü parti API’lerden canlı alınabilir."
    };
  }

// If backend returns only filenames, enrich them for mentor-friendly demo output
  const enrich = (arr) => {
    const map = {
      "orders.json": { text: "orders.json — Sipariş geçmişi (tarih, ürün, adet, ciro, kanal) • Demo KPI: 30g sipariş 78, ciro 2.535,90€, AOV 32,50€", agents: ["Sales", "Reporting", "Recommendation"] },
      "traffic.json": { text: "traffic.json — Trafik & oturum (kaynak, cihaz, sayfa) • Demo KPI: 2.730 oturum, dönüşüm %2,86, sepet terk %45,03", agents: ["Reporting", "Social"] },
      "products.json": { text: "products.json — Ürün kataloğu (kategori, fiyat, stok, marj) • Demo: En iyi kategori Motor Yağı, düşük performans Filtre, kritik stok Antifriz", agents: ["Sales", "Recommendation"] },
      "vehicles.json": { text: "vehicles.json — Uyumluluk verisi (araç ↔ ürün) • Demo: yanlış ürün riskini düşürür", agents: ["Recommendation"] },
      "social.json": { text: "social.json — Sosyal etkileşim & içerik performansı (mock) • Demo: Instagram +%34 etkileşim", agents: ["Social"] },
      "trends (mock)": { text: "trends (mock) — Trend sinyali (talep artış/düşüş) • Demo: Motor Yağı ↑, Filtre ↓", agents: ["Sales", "Social"] },
      "competitor prices (mock)": { text: "competitor prices (mock) — Rakip fiyat/kampanya sinyali • Demo: Rakip X indirim algılandı", agents: ["Sales", "Reporting"] },
    };
    return (arr || []).map(x => map[x] ? map[x] : { text: x, agents: [] });
  };

  const a = $("srcInternal");
  const b = $("srcExternal");
  renderSourceItems(a, enrich(s.internal));
  renderSourceItems(b, enrich(s.external));
  $("srcNote").textContent = s.note || "";
}

function toggleSources() {
  // Toggle visibility for mentor-friendly demo
  const btn = $("btnLoadSources");
  const visible = btn.dataset.visible === "1";
  if (visible) {
    // hide
    $("srcInternal").innerHTML = "";
    $("srcExternal").innerHTML = "";
    $("srcNote").textContent = "—";
    btn.dataset.visible = "0";
    btn.textContent = "Kaynakları Göster";
    return;
  }
  btn.dataset.visible = "1";
  btn.textContent = "Kaynakları Gizle";
  // load & show
  loadSources();
}

function renderSourceItems(targetEl, items) {
  targetEl.innerHTML = "";
  (items || []).forEach(item => {
    const div = document.createElement("div");
    div.className = "li";
    if (typeof item === "string") {
      div.textContent = item;
    } else {
      // item: { text, agents: [] }
      const row = document.createElement("div");
      row.className = "lirow";
      const t = document.createElement("div");
      t.className = "litext";
      t.textContent = item.text || "";
      const badges = document.createElement("div");
      badges.className = "badges";
      (item.agents || []).forEach(a => {
        const b = document.createElement("span");
        b.className = "badge";
        b.textContent = a;
        badges.appendChild(b);
      });
      row.appendChild(t);
      row.appendChild(badges);
      div.appendChild(row);
    }
    targetEl.appendChild(div);
  });
}



async function init() {
  document.querySelectorAll(".navitem").forEach(btn => btn.addEventListener("click", () => setView(btn.dataset.view)));
  document.querySelectorAll(".segbtn").forEach(btn => btn.addEventListener("click", async () => { RANGE = btn.dataset.range; setRangeButtons(RANGE); await loadInsights(); }));
  $("btnRefresh").addEventListener("click", loadInsights);
  $("btnLoadSources").dataset.visible = "0";
  $("btnLoadSources").addEventListener("click", toggleSources);
  $("btnGenPlan").addEventListener("click", () => renderSocial($("persona").value, $("platform").value));
  $("btnReco").addEventListener("click", renderReco);

  

// Demo Flow
$("demoFab").addEventListener("click", openDemo);
$("demoClose").addEventListener("click", closeDemo);
$("demoPrev").addEventListener("click", () => { demoIndex = Math.max(0, demoIndex - 1); goDemoStep(); });
$("demoNext").addEventListener("click", () => {
  if (demoIndex >= DEMO_FLOW.length - 1) return closeDemo();
  demoIndex = Math.min(DEMO_FLOW.length - 1, demoIndex + 1);
  goDemoStep();
});

const health = await api("/api/health");
  $("pillAI").textContent = health.ai ? "AI: aktif" : "AI: fallback";
  $("pillAI").style.background = health.ai ? "rgba(34,197,94,.12)" : "rgba(249,115,22,.12)";
  $("pillAI").style.borderColor = health.ai ? "rgba(34,197,94,.25)" : "rgba(249,115,22,.25)";

  PRODUCTS = await api("/api/products");
  setView("overview");
  setRangeButtons(RANGE);
  renderSocial("fp", "Instagram");
  renderReco();
  renderStore();
  await loadInsights();
}

init().catch(err => {
  console.error(err);
  $("pillAI").textContent = "AI: hata";
  $("aiSummary").textContent = "Sunucu çalışmıyor. Terminalde 'npm start' ile başlat.";
});