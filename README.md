# מערכת דיווח תאונות - גדוד

אתר לדיווח, חיפוש וניתוח תאונות, עם מאגר משותף לכל המשתמשים (Cloudflare KV).

## מבנה

- `src/` - קוד המקור (React). זה מה שעורכים כדי לשנות את האתר.
  - `App.jsx` - כל הלוגיקה והעיצוב
  - `storage.js` - שכבת השמירה (פונה ל-API של ה-Worker)
  - `assets/crest.jpeg` - סמל הגדוד
- `worker.js` - קוד ה-Cloudflare Worker: מגיש את האתר ומטפל ב-API של השמירה (KV)
- `wrangler.jsonc` - הגדרות הפריסה של Cloudflare (כולל חיבור ה-KV)
- `vite.config.js` - בונה את האתר לקובץ יחיד בתוך `public/`

## פיתוח מקומי

```bash
npm install
npm run dev
```

## בנייה

```bash
npm run build   # יוצר את public/index.html
```

## פריסה ל-Cloudflare

הפריסה אוטומטית: כל push ל-main גורם ל-Cloudflare לבנות ולפרוס.
הגדרות ה-build ב-Cloudflare צריכות להיות:
- Build command: `npm install && npm run build`
- Deploy command: `npx wrangler deploy`

## הערה

הנתונים נשמרים ב-KV namespace בשם accidents-db (מחובר כ-ACCIDENTS_KV).
דיווחים משותפים לכל המשתמשים ונשמרים לצמיתות.
