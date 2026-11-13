# Blue Ronin Navigator

נביגטור לרוכבי דו־גלגלי בכל ישראל (BLUE RONIN · ישראל): ניווט יומיומי עם תנועה חיה, מסלולי סוף שבוע
(פרקים) עם תדריך מזג אוויר, מצב רכיבה, ובטיחות (SOS, זיהוי נפילה, שיתוף מיקום) שתמיד בחינם.
אפליקציית ווב (PWA) בכתובת https://blueronin.app, עם שרת קטן ב־Netlify.

מצב הפרויקט, החלטות ותקלות: `docs/STATUS.md` (מקור האמת). כללי העבודה לקוד: `CLAUDE.md`.
איך אלי ו־Claude עובדים יחד: `docs/WORKFLOW.md`.

## איך משחררים גרסה
- עובדים על `dev` (או ענף `feat/…` / `fix/…`). כל דחיפה ל־`main` היא פריסה לאוויר ועולה כ־15 קרדיטים של Netlify,
  ולכן רק כשאלי מחליט על סבב ("יוצאים לסבב"). ענפים אחרים לא נבנים ב־Netlify בכלל.
- לפני כל דחיפה: `scripts/check.sh` ירוק. רשימת השחרור המלאה ב־`CLAUDE.md`.
- האפליקציה בודקת גרסה חדשה בכל פתיחה ומתעדכנת לבד, גם אצל מי שהתקין אותה למסך הבית.

## מבנה
- `site/`: האפליקציה. סדר הטעינה ב־`index.html`: `guard.js` (שומר אתחול ודיווח תקלות מהשטח) ← `intro.js`
  ← MapLibre ו־SunCalc מ־`site/vendor/` (מאוחסנים אצלנו, בלי תלות ב־CDN) ← `geo.js` ← `data.js` (פרקים, בתי קפה,
  אכיפה) ← `bikes.js` ← `logic.js` ← `app.js`. גם: `sw.js` (עבודה בלי רשת), `admin.html/js` (ממשק ניהול),
  `live.html/js` (מיקום חי), `join.html` (רשימת המתנה), `go.html` (קישור לביוגרפיות), `privacy.html`, `terms.html`,
  `accessibility.html` (הצהרת נגישות).
- `netlify/functions/`: השרת. קוד משותף ב־`lib/`. עיקרי:
  - `geo`, `traffic`: חיפוש כתובות ותנועה חיה מ־HERE (בתקציב חודשי).
  - `wx`: מזג אוויר מ־Open-Meteo דרך מטמון משותף. `osm*`: דלק, קפה, מצלמות ומוסכים מ־OpenStreetMap.
  - `vapid`, `subscribe`, `test-push`, `brief-friday`, `brief-saturday`, `brief`: התראות ותדריך שבת. כל מנוי מקבל
    את התדריך של הפרק המובנה שבחר (או את הפרק הטוב ביותר אם לא בחר).
  - `sos`, `live`, `group`, `xfer`: חירום, מיקום חי, רכיבה בקבוצה, העברת נתונים מוצפנת בין מכשירים.
  - `admin`, `content`, `feedback`, `errlog`, `ping`, `health-scan`: ניהול, משוב, דיווחי תקלות ובקרה.
  - `join`, `pro`: רשימת ההמתנה ו־Blue Ronin Pro.
- `tests/`: הבדיקות, עם `package.json` משלהן (מחוץ לשורש כדי שהבנייה ב־Netlify תישאר קלה).
- `scripts/`: `check.sh` (כל הבדיקות), `bump-version.sh` (העלאת גרסה בשחרור).
- `media/`: הפקת וידאו ותוכן (תסריטים, לוחות תכנון). קבצי רינדור לא נכנסים ל־git.

## בדיקות
`scripts/check.sh` מריץ הכול; `scripts/check.sh --unit` רק את המהירות.
- `tests/unit/` (node:test): גרסאות תואמות, כל קובץ נטען, קבצי האופליין קיימים, תחנות הפרקים בתוך ישראל,
  אין מפתחות בקוד, הגנות `netlify.toml`, תדריך לפי פרק, ספריות ה־vendor תואמות לגרסאות הנעולות.
- `tests/e2e/` (Playwright, Chromium, טלפון ומחשב): האפליקציה עולה בלי רשת ובלי CDN, כל לשונית מציגה תוכן, אין
  שגיאות לא מטופלות, ובדיקת נגישות אוטומטית (axe, WCAG 2.0/2.1 AA) בכל הלשוניות ובדפים הציבוריים.
- GitHub Actions מריץ את אותן בדיקות בכל דחיפה ל־`dev` ובכל PR, בחינם ובלי קרדיטים של Netlify.

## מפתחות (רק ב־Netlify, Environment variables, אף פעם לא בקוד)
`HERE_API_KEY`, `HERE_MONTHLY_CAP`, `HERE_GEO_CAP`, `MAPILLARY_TOKEN`, `ADMIN_SETUP_CODE`
(ו־`ADMIN_RESET_CODE` רק בזמן שחזור). אחרי שינוי משתנה צריך פריסה לאוויר כדי שהשרת יראה אותו.

## עריכת התוכן
פרקים, עצירות, בתי קפה וקטעי אכיפה נמצאים ב־`site/data.js`. משנים עצירות בפרק: מעלים את ה־`rv` שלו,
כדי שהמסלול יחושב מחדש אצל כולם. הודעות, מפגעים, הסתרת פרקים ומתגים: בממשק הניהול (`/admin.html`), בלי קוד.

## מקורות נתונים
מפה: OpenFreeMap ו־OpenStreetMap (ODbL). תנועה וחיפוש: HERE. מזג אוויר וגבהים: Open-Meteo (CC BY 4.0).
מכ״ם: RainViewer. ניתוב: OSRM. תבליט: Mapzen / AWS. שקיעה וזריחה: SunCalc. תמונות: Mapillary ו־Wikimedia Commons.
