# E-Ticaret AI Agent Console (Demo)

Bu proje, e-ticaret operasyonlarını yöneten **AI Agent** yaklaşımının çalışan prototipidir.
Demo veriler `data/` altında simüle edilmiştir. Mimari gerçek hayatta API/DB entegrasyonuna uygundur.

## Local çalıştırma
```bash
npm install
npm start
```
Tarayıcı: http://localhost:3000

> Port çakışırsa:
```bat
set PORT=3001
npm start
```

## Render deploy (önerilen)
Render’da **Web Service (Node)** olarak deploy edin.

- Build Command: `npm install`
- Start Command: `npm start`

### Opsiyonel: AI modu
`OPENAI_API_KEY` tanımlarsanız bazı özet/yorum alanları gerçek modelle çalışacak şekilde genişletilebilir.
Tanımlamazsanız demo/fallback mod çalışır.

## Sunum ipucu
Demo Flow: AI Overview → Sales Analyst → Reporting → Social Media → Data Sources
