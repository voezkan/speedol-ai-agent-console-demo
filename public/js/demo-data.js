/**
 * Demo data wiring for all agents.
 * Attaches a single global object so the UI can read it without extra build steps.
 */
(function () {
  window.demoData = {
    orders: {
      totalRevenue: 2535.90,
      orders: 78,
      aov: 32.50,
      conversion: 2.86,
      cartAbandonment: 45.03,
      refundsRate: 2.95
    },
    traffic: {
      sessions: 2730,
      daily: [210, 360, 402, 315, 280, 610, 553],
      sources: { organic: 42, ads: 38, social: 20 }
    },
    products: {
      topCategory: "Motor Yağı",
      lowPerformance: "Filtre",
      criticalStock: "Antifriz",
      categories: [
        { name: "Motor Yağı", revenue: 2060.10 },
        { name: "Filtre", revenue: 258.00 },
        { name: "Antifriz", revenue: 217.80 }
      ]
    },
    social: {
      bestChannel: "Instagram",
      engagementLift: 34,
      contentIdeas: [
        "7 günlük bakım ipuçları serisi",
        "Kışa hazırlık: antifriz kontrol listesi",
        "Motor yağı değişimi: 30 sn Reels",
        "Sık sorulan sorular (FAQ) carousel"
      ]
    },
    external: {
      trends: [
        { topic: "Motor Yağı", direction: "up", note: "Son 7 günde ilgi artışı" },
        { topic: "Filtre", direction: "down", note: "İlgi düşüşü, kampanya öner" },
        { topic: "Antifriz", direction: "flat", note: "Stabil" }
      ],
      competitorPrices: [
        { competitor: "Rakip X", signal: "indirim", note: "Bazı SKU'larda fiyat indirimi (mock)" }
      ]
    }
  };
})();
