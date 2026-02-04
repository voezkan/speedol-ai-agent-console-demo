import express from "express";
import fs from "fs";
import path from "path";
import OpenAI from "openai";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(process.cwd(), "public")));

function loadJson(relPath) {
  const p = path.join(process.cwd(), relPath);
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

const PRODUCTS = loadJson("data/products.json");
const VEHICLES = loadJson("data/vehicles.json");
const ORDERS = loadJson("data/orders.json");
const TRAFFIC = loadJson("data/traffic.json");
const SOCIAL = loadJson("data/social.json");

function safeText(s, max = 25000) {
  if (!s) return "";
  return String(s).slice(0, max);
}

function sum(arr, key) {
  return arr.reduce((a, x) => a + (Number(x[key]) || 0), 0);
}

function groupBy(arr, key) {
  const m = new Map();
  for (const x of arr) {
    const k = x[key];
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(x);
  }
  return m;
}

function lastNDates(n) {
  const last = TRAFFIC[TRAFFIC.length - 1]?.date;
  const end = last ? new Date(last) : new Date();
  const dates = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

function pickRange(range) {
  const n = range === "today" ? 1 : range === "7d" ? 7 : range === "30d" ? 30 : 7;
  const wanted = new Set(lastNDates(n));
  const orders = ORDERS.filter(o => wanted.has(o.date));
  const traffic = TRAFFIC.filter(t => wanted.has(t.date));
  const social = SOCIAL.filter(s => wanted.has(s.date));
  return { n, orders, traffic, social, dates: [...wanted].sort() };
}

function computeKpis({ orders, traffic }) {
  const revenue = sum(orders, "revenue_eur");
  const orderCount = orders.length;
  const aov = orderCount ? revenue / orderCount : 0;

  const sessions = sum(traffic, "sessions");
  const purchases = sum(traffic, "purchases");
  const checkouts = sum(traffic, "checkouts");
  const addToCart = sum(traffic, "add_to_cart");

  const conversion = sessions ? purchases / sessions : 0;
  const cartAbandon = addToCart ? 1 - (checkouts / addToCart) : 0;

  const returns = orders.filter(o => o.returned).length;
  const returnRate = orderCount ? returns / orderCount : 0;

  return {
    revenue: Number(revenue.toFixed(2)),
    orders: orderCount,
    aov: Number(aov.toFixed(2)),
    conversion: Number((conversion * 100).toFixed(2)),
    cartAbandon: Number((cartAbandon * 100).toFixed(2)),
    returnRate: Number((returnRate * 100).toFixed(2)),
  };
}

function seriesByDate(dates, orders, traffic, social) {
  const ordersByDate = groupBy(orders, "date");
  const trafficByDate = groupBy(traffic, "date");
  const socialByDate = groupBy(social, "date");

  return dates.map(date => {
    const o = ordersByDate.get(date) || [];
    const t = trafficByDate.get(date) || [];
    const s = socialByDate.get(date) || [];
    return {
      date,
      revenue: Number(sum(o, "revenue_eur").toFixed(2)),
      orders: o.length,
      sessions: sum(t, "sessions"),
      purchases: sum(t, "purchases"),
      socialClicks: sum(s, "clicks"),
      socialEngagements: sum(s, "engagements"),
    };
  });
}

function topCategories(orders) {
  const byCat = groupBy(orders, "category");
  const arr = [...byCat.entries()].map(([category, rows]) => ({
    category,
    revenue: Number(sum(rows, "revenue_eur").toFixed(2)),
    orders: rows.length,
    returnRate: rows.length ? Number(((rows.filter(r => r.returned).length / rows.length) * 100).toFixed(2)) : 0,
  }));
  return arr.sort((a,b) => b.revenue - a.revenue).slice(0, 5);
}

function topSegments(orders) {
  const bySeg = groupBy(orders, "customer_segment");
  const arr = [...bySeg.entries()].map(([segment, rows]) => ({
    segment,
    revenue: Number(sum(rows, "revenue_eur").toFixed(2)),
    orders: rows.length,
  }));
  return arr.sort((a,b) => b.revenue - a.revenue).slice(0, 5);
}

function generateActions({ kpis, categories, series }) {
  const actions = [];
  const last = series[series.length - 1] || {};
  const prev = series[series.length - 2] || last;
  const revDelta = prev.revenue ? ((last.revenue - prev.revenue) / prev.revenue) * 100 : 0;

  if (revDelta > 8) actions.push({ prio: "High", title: "Kampanya momentumunu koru", detail: `Düne göre ciro +%${revDelta.toFixed(1)}. Hafta sonu kampanyasını aynı hedef kitleyle tekrar et.` });
  if (kpis.cartAbandon > 22) actions.push({ prio: "High", title: "Sepet terkini düşür", detail: `Sepet terk oranı %${kpis.cartAbandon}. Checkout adımlarını azalt, güven rozetlerini öne çıkar.` });
  if (kpis.returnRate > 7) actions.push({ prio: "Medium", title: "İade riskini azalt", detail: `İade oranı %${kpis.returnRate}. Ürün sayfalarında uyumluluk ve kullanım notlarını güçlendir.` });

  const topCat = categories[0];
  if (topCat) actions.push({ prio: "Medium", title: `${topCat.category} kategorisini vitrine al`, detail: `En yüksek gelir: ${topCat.category}. Ana sayfada öneri bloklarına taşı.` });

  actions.push({ prio: "Low", title: "Instagram içerik planını oluştur", detail: "Social Media Agent ile 7 günlük Reels/Post planı üret ve en iyi paylaşım saatlerine göre sırala." });
  return actions.slice(0, 5);
}

async function aiSummarize({ range, kpis, categories, actions, series }) {
  if (!process.env.OPENAI_API_KEY) {
    const topCat = categories[0]?.category || "Kategori";
    return {
      summary:
        `Seçilen aralık (${range}) için ciro ${kpis.revenue}€. Sipariş: ${kpis.orders}. Dönüşüm: %${kpis.conversion}. ` +
        `Sepet terk: %${kpis.cartAbandon}. En iyi kategori: ${topCat}. ` +
        `Aksiyon: ${actions[0]?.title || "—"}.`,
      mode: "fallback",
    };
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    instructions:
      "Sen bir e-ticaret AI Agent'ısın. KPI ve trend verilerini 3-5 cümlede yönetici dilinde özetle. " +
      "En fazla 3 aksiyon öner. Kısa, net Türkçe yaz. PII isteme.",
    input: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              `Aralık: ${range}\nKPI: ${JSON.stringify(kpis)}\n` +
              `Kategoriler: ${JSON.stringify(categories)}\n` +
              `Seri (son 7 gün örnek): ${safeText(JSON.stringify(series.slice(-7)))}\n` +
              `Aksiyonlar: ${JSON.stringify(actions)}\n\n` +
              "Çıktı formatı JSON olsun: {summary:string, actions:[{prio,title,detail}]}"
          }
        ]
      }
    ],
  });

  const text = (response.output_text || "").trim();
  try {
    const parsed = JSON.parse(text);
    return { ...parsed, mode: "ai" };
  } catch {
    return { summary: text, mode: "ai" };
  }
}

app.get("/api/health", (req, res) => res.json({ ok: true, ai: !!process.env.OPENAI_API_KEY }));
app.get("/api/products", (req, res) => res.json(PRODUCTS));
app.get("/api/vehicles", (req, res) => res.json(VEHICLES));

app.get("/api/datasets", (req, res) => {
  res.json({
  internal: [
    "orders.json — Sipariş geçmişi (tarih, ürün, adet, ciro, kanal) • Demo KPI: 30g sipariş 78, ciro 2.535,90€, AOV 32,50€",
    "traffic.json — Trafik & oturum (kaynak, cihaz, sayfa) • Demo KPI: 2.730 oturum, dönüşüm %2,86, sepet terk %45,03",
    "products.json — Ürün kataloğu (kategori, fiyat, stok, marj) • Demo: En iyi kategori Motor Yağı, düşük performans Filtre, kritik stok Antifriz",
    "vehicles.json — Uyumluluk verisi (araç ↔ ürün) • Demo: yanlış ürün riskini düşürür"
  ],
  external: [
    "social.json — Sosyal etkileşim & içerik performansı (mock) • Demo: Instagram +%34 etkileşim",
    "trends (mock) — Trend sinyali (talep artış/düşüş) • Demo: Motor Yağı ↑, Filtre ↓",
    "competitor prices (mock) — Rakip fiyat/kampanya sinyali • Demo: Rakip X indirim algılandı"
  ],
  note: "Bu ekranda gösterilen veriler demo amaçlı simüle edilmiştir. Gerçek sistemde Shopify/WooCommerce, GA4, Meta/Google Ads ve üçüncü parti API’lerden canlı alınır.",
});
});


app.get("/api/insights", async (req, res) => {
  const range = (req.query.range || "7d").toString();
  const { n, orders, traffic, social, dates } = pickRange(range);

  const kpis = computeKpis({ orders, traffic });
  const categories = topCategories(orders);
  const segments = topSegments(orders);
  const series = seriesByDate(dates, orders, traffic, social);
  const actions = generateActions({ kpis, categories, series });

  let ai = { summary: "", mode: "fallback" };
  try {
    ai = await aiSummarize({ range, kpis, categories, actions, series });
  } catch {
    ai = { summary: "", mode: "fallback" };
  }

  const finalActions = (ai.actions && Array.isArray(ai.actions) && ai.actions.length) ? ai.actions : actions;

  res.json({
    range,
    windowDays: n,
    kpis,
    categories,
    segments,
    series,
    actions: finalActions,
    aiSummary: ai.summary || "",
    aiMode: ai.mode,
  });
});

// Keep existing recommend + chat endpoints for demo continuity
function ruleBasedRecommend({ make, model, year, engine, fuel, viscosityPref }) {
  const vehicleKey = `${make} ${model} ${year} ${engine} ${fuel}`.trim().toLowerCase();
  const candidates = PRODUCTS.filter(p => p.category === "Motor Yağı");

  const scored = candidates.map(p => {
    let score = 0;
    if (viscosityPref && p.viscosity?.toLowerCase() === viscosityPref.toLowerCase()) score += 4;
    if (p.recommendedFor?.some(v => v.toLowerCase() === vehicleKey)) score += 6;
    const price = Number(p.priceEUR || 0);
    if (price >= 25 && price <= 80) score += 1;
    return { p, score };
  }).sort((a,b) => b.score - a.score);

  const top = scored.slice(0, 3).map(x => x.p);
  const explanation = top.length
    ? "Araç bilgilerine göre en uygun 3 seçenek listelendi. (Demo: kural tabanlı uyumluluk + viskozite)"
    : "Uygun ürün bulunamadı, lütfen araç bilgisini kontrol et.";

  return { top, explanation, mode: "fallback" };
}

app.post("/api/recommend", async (req, res) => {
  const payload = req.body || {};
  const { make, model, year, engine, fuel, viscosityPref } = payload;

  if (!process.env.OPENAI_API_KEY) {
    return res.json(ruleBasedRecommend({ make, model, year, engine, fuel, viscosityPref }));
  }

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      instructions:
        "Sen e-ticaret Recommendation Agent'ısın. Araç bilgisine göre en uygun 3 motor yağını seç. " +
        "Sadece verilen ürün listesine dayan. Kısa Türkçe yaz. JSON döndür.",
      input: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                `Araç: ${make} ${model} ${year} ${engine} ${fuel}\n` +
                `Viskozite tercihi (varsa): ${viscosityPref || "Yok"}\n\n` +
                `Ürünler JSON:\n${safeText(JSON.stringify(PRODUCTS))}\n\n` +
                "En iyi 3 ürün öner. Format: { top:[{sku,reason}], explanation }"
            }
          ]
        }
      ],
    });

    const text = (response.output_text || "").trim();
    let parsed;
    try { parsed = JSON.parse(text); } catch { parsed = { top: [], explanation: text }; }

    const top = (parsed.top || []).map(item => {
      const prod = PRODUCTS.find(p => p.sku === item.sku) || {};
      return { ...prod, reason: item.reason || "" };
    }).filter(p => p.sku);

    res.json({ top, explanation: parsed.explanation || "AI önerisi hazır.", mode: "ai" });
  } catch (e) {
    res.json(ruleBasedRecommend({ make, model, year, engine, fuel, viscosityPref }));
  }
});

app.post("/api/chat", async (req, res) => {
  const { message } = req.body || {};
  const msg = safeText(message, 1500);

  if (!process.env.OPENAI_API_KEY) {
    return res.json({ reply: "Demo mod: Sales/Reporting/Social/Recommendation sekmelerini gez. Orada AI Agent çıktıları var.", mode: "fallback" });
  }

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      instructions: "Sen bir e-ticaret AI Agent asistanısın. Kısa, net Türkçe yaz. PII isteme.",
      input: msg,
    });
    res.json({ reply: (response.output_text || "").trim() || "Tamam.", mode: "ai" });
  } catch {
    res.json({ reply: "Şu an AI servisine bağlanamadım. Insights ekranını kullanabilirsin.", mode: "fallback" });
  }
});

app.listen(PORT, () => {
  console.log(`✅ AI Agent Console running: http://localhost:${PORT}`);
  console.log(`ℹ️  AI mode: ${process.env.OPENAI_API_KEY ? "OPENAI" : "FALLBACK"}`);
});
