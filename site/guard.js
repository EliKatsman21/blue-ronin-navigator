/* Blue Ronin · boot guard and field error reporter. Loads before everything else.
   1. Any uncaught error is sent (anonymously, rate-limited) to /api/errlog, so a crash on a rider's phone
      reaches us with its stack instead of becoming a silent dead screen.
   2. The intro can never trap the rider: it ends by itself after a few seconds whatever happens.
   3. If the app did not finish starting, a recovery card offers "try again" and "repair" (clears the app's
      cached files, never the rider's data). */
(() => {
  const VER = "2.8.0", t0 = Date.now(), crumbs = [], sent = new Set(); let nSent = 0;
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
  addEventListener("error", e => { if (!e.message && e.target && e.target !== window) { const s = e.target.src || e.target.href || ""; if (/unpkg|cdnjs|vendor\/|app\.js|logic\.js|data\.js/.test(s)) { report("load", "failed to load " + s.replace(/^https?:\/\/[^/]+/, ""), s, 0, ""); fatal("load"); } return; }
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
/* Viewport fit. iOS 26 home-screen apps can report a layout viewport about one status bar shorter than the
   screen, so every layer pinned to bottom:0 (map, sheet, intro, ride board) stops ~45px above the edge and
   the page background shows under it. The body is the containing block for all fixed layers (contain:layout
   in index.html) and gets its height from here: the largest trustworthy reading of the real window. In a
   normal browser tab, and wherever the readings agree, this is just innerHeight, so nothing changes.
   --sab is the bottom inset: when we had to reach past the reported viewport and iOS reports no inset,
   keep controls clear of the home indicator ourselves. */
(() => {
  const de = document.documentElement, G = window.BRG || {};
  const iPhone = /iPhone|iPod/.test(navigator.userAgent);
  const standalone = () => { try { return matchMedia("(display-mode: standalone)").matches || navigator.standalone === true; } catch (e) { return false; } };
  const measure = css => {
    const b = document.body; if (!b) return 0;
    const p = document.createElement("div"); p.setAttribute("aria-hidden", "true");
    p.style.cssText = "position:absolute;left:0;top:0;width:1px;visibility:hidden;pointer-events:none;height:" + css;
    b.appendChild(p); const h = p.getBoundingClientRect().height; p.remove(); return h || 0;
  };
  let last = "";
  function fit() {
    try {
      const ih = innerHeight, iw = innerWidth; let h = ih, why = "ih", sabMin = 0;
      if (standalone()) {
        const portrait = ih >= iw, scr = portrait ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height);
        for (const c of [de.clientHeight, measure("100lvh"), measure("100vh")]) if (c > h && c <= scr + 1) { h = c; why = "unit"; }
        const kb = window.visualViewport && visualViewport.height < ih - 120;
        if (iPhone && !kb && scr - h > 20 && scr - h <= 90 && measure("env(safe-area-inset-top,0px)") > 0) { h = scr; why = "screen"; }
        if (why !== "ih" && measure("env(safe-area-inset-bottom,0px)") < 1) sabMin = portrait ? 34 : 21;
      }
      h = Math.round(h);
      const key = h + "|" + sabMin; if (key === last) return; last = key;
      de.style.setProperty("--app-h", h + "px");
      de.style.setProperty("--sab-min", sabMin + "px");
      G.vp = { h, why, ih, sabMin };
      if (why !== "ih" && G.crumb) G.crumb("vp " + why + " " + ih + "->" + h);
      dispatchEvent(new Event("br:viewport"));
    } catch (e) { }
  }
  fit();
  addEventListener("DOMContentLoaded", fit); addEventListener("load", fit); addEventListener("pageshow", fit); addEventListener("resize", fit);
  addEventListener("orientationchange", () => { fit(); setTimeout(fit, 350); setTimeout(fit, 900); });
  if (window.visualViewport) visualViewport.addEventListener("resize", fit);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) setTimeout(fit, 60); });
  G.fitViewport = fit;
})();
