/* Blue Ronin · boot guard and field error reporter. Loads before everything else.
   1. Any uncaught error is sent (anonymously, rate-limited) to /api/errlog, so a crash on a rider's phone
      reaches us with its stack instead of becoming a silent dead screen.
   2. The intro can never trap the rider: it ends by itself after a few seconds whatever happens.
   3. If the app did not finish starting, a recovery card offers "try again" and "repair" (clears the app's
      cached files, never the rider's data). */
(() => {
  const VER = "2.3.0", t0 = Date.now(), crumbs = [], sent = new Set(); let nSent = 0;
  const G = window.BRG = { crumb: c => { crumbs.push(((Date.now() - t0) / 1000).toFixed(1) + "s " + String(c).slice(0, 50)); if (crumbs.length > 30) crumbs.shift(); }, booted: false, report };
  const sa = () => { try { return matchMedia("(display-mode: standalone)").matches || !!navigator.standalone; } catch (e) { return false; } };
  function report(kind, msg, src, line, stack) {
    try {
      const key = kind + "|" + msg + "|" + line; if (sent.has(key) || nSent >= 6) return; sent.add(key); nSent++;
      const tab = document.querySelector(".tab[aria-selected=true]");
      const body = JSON.stringify({ kind, msg: String(msg || "").slice(0, 300), src: String(src || "").slice(0, 160), line: line || 0, stack: String(stack || "").slice(0, 1500), ver: VER, ua: navigator.userAgent, sa: sa(), path: location.pathname, tab: tab ? tab.dataset.t : "", crumbs, boot: !G.booted });
      if (navigator.sendBeacon) navigator.sendBeacon("/api/errlog", new Blob([body], { type: "application/json" })); else fetch("/api/errlog", { method: "POST", body, keepalive: true }).catch(() => { });
    } catch (e) { }
  }
  addEventListener("error", e => { if (!e.message && e.target && e.target !== window) { const s = e.target.src || e.target.href || ""; if (/unpkg|cdnjs|app\.js|logic\.js|data\.js/.test(s)) { report("load", "failed to load " + s.replace(/^https?:\/\/[^/]+/, ""), s, 0, ""); fatal("load"); } return; }
    report("error", e.message, e.filename, e.lineno, e.error && e.error.stack); if (!G.booted) fatal("error"); }, true);
  addEventListener("unhandledrejection", e => { const r = e.reason || {}; report("promise", r.message || String(r), "", 0, r.stack); });
  function endIntro() { const i = document.getElementById("intro"); if (i && !i.classList.contains("out")) i.classList.add("out"); }
  let shown = false;
  function fatal(why) { if (G.booted || shown) return; setTimeout(() => { if (!G.booted) recovery(why); }, Math.max(0, 2600 - (Date.now() - t0))); }
  function recovery(why) {
    if (shown || G.booted) return; shown = true; endIntro();
    const d = document.createElement("div"); d.className = "bootfail"; d.setAttribute("role", "alertdialog");
    const inApp = /FBAN|FBAV|Instagram|WhatsApp|Line\/|; wv\)/.test(navigator.userAgent);
    d.innerHTML = `<div class="bf"><b>האפליקציה לא עלתה כמו שצריך</b><p>${why === "map" ? "הדפדפן הזה לא מצליח להציג את המפה." : why === "load" ? "חלק מהקבצים לא נטענו. בדרך כלל זו קליטה חלשה." : "משהו השתבש בזמן הפתיחה. דיווח נשלח אלינו אוטומטית."}${inApp ? " נראה שזה דפדפן בתוך אפליקציה אחרת: פתחו את הקישור בדפדפן הרגיל (שלוש נקודות ← פתיחה בדפדפן)." : ""}</p><p class="s">הנתונים שלכם שמורים ולא נמחקים.</p><button type="button" id="bfRetry">ניסיון חוזר</button><button type="button" id="bfFix" class="sec">תיקון ופתיחה מחדש</button></div>`;
    document.body.appendChild(d);
    d.querySelector("#bfRetry").onclick = () => location.reload();
    d.querySelector("#bfFix").onclick = async () => { try { const regs = await navigator.serviceWorker.getRegistrations(); await Promise.all(regs.map(r => r.unregister())); } catch (e) { } try { const ks = await caches.keys(); await Promise.all(ks.map(k => caches.delete(k))); } catch (e) { } location.reload(); };
  }
  G.fatal = recovery;
  /* the intro never outlives 6 s; the app gets 12 s to say it started */
  setTimeout(endIntro, 6000);
  setTimeout(() => { if (!G.booted) { report("boot", "not booted after 12s", "", 0, ""); recovery("slow"); } }, 12000);
  G.crumb("guard");
})();
