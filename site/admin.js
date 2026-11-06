/* Blue Ronin · admin console. Talks only to /api/admin/* (cookie session + custom header). */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const { CHAPTERS } = window.BRD;
  const TZ = "Asia/Jerusalem";
  const fmt = ts => ts ? new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(new Date(ts)) : "—";
  const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
  const addDays = n => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(Date.now() + n * 864e5));
  const toast = (m, ms = 2600) => { const t = $("toast"); t.textContent = m; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, ms); };

  async function api(method, path, body) {
    const r = await fetch("/api/admin/" + path, { method, credentials: "same-origin", headers: { "x-brn-admin": "1", "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    let j = {}; try { j = await r.json(); } catch (e) { }
    if (r.status === 401 && j.error === "auth") { S.authed = false; showLogin(); throw new Error("נדרשת כניסה מחדש"); }
    if (!r.ok) { const e = new Error(j.error || "שגיאה " + r.status); e.status = r.status; e.data = j; throw e; }
    return j;
  }

  const I = {
    gauge: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 16a8 8 0 1 1 16 0"/><path d="m12 16 4-5"/></svg>',
    mega: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 10v4h4l7 4V6l-7 4z"/><path d="M18 9a4 4 0 0 1 0 6"/></svg>',
    route: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5"/></svg>',
    haz: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01" stroke-linecap="round"/></svg>',
    inbox: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 13h5l1.5 3h5L16 13h5"/><path d="M5 5h14l2 8v6H3v-6z"/></svg>',
    fuel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 20V5.5A1.5 1.5 0 0 1 6.5 4h6A1.5 1.5 0 0 1 14 5.5V20M3.5 20h12M7.5 7h4v3.5h-4z"/><path d="M14 9.5h1.5A1.5 1.5 0 0 1 17 11v4.5a1.3 1.3 0 0 0 2.6 0V8.5L17 6"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3 4 6v6c0 4.5 3.4 8.2 8 9 4.6-.8 8-4.5 8-9V6z"/><path d="m9 12 2 2 4-4" stroke-linecap="round"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>'
  };
  const VIEWS = [["overview", "סקירה", I.gauge], ["notice", "הודעות", I.mega], ["chapters", "פרקים", I.route], ["hazards", "מפגעים", I.haz], ["inbox", "תיבה", I.inbox], ["fuel", "דלק", I.fuel], ["pro", "Pro", I.star], ["system", "מערכת", I.shield]];
  const S = { authed: false, view: location.hash.slice(1) || "overview", content: null, draft: null, stats: null, feedback: null, fuel: null, audit: null, map: null };
  if (!VIEWS.some(v => v[0] === S.view)) S.view = "overview";
  const clone = o => JSON.parse(JSON.stringify(o));
  const dirty = () => S.content && JSON.stringify(S.draft) !== JSON.stringify(S.content);

  /* ---------------- gate: setup and login ---------------- */
  async function boot() {
    let s; try { s = await (await fetch("/api/admin/session", { credentials: "same-origin" })).json(); } catch (e) { $("gate").hidden = false; $("gate").innerHTML = `<div class="card"><h2>אין חיבור לשרת</h2><p class="muted">נסו שוב כשיש קליטה.</p></div>`; return; }
    if (s.authed) return enter();
    if (s.needsSetup) showSetup(s); else showLogin(s);
  }
  const gate = html => { $("app").hidden = true; $("who").hidden = true; $("saveBar").hidden = true; const g = $("gate"); g.hidden = false; g.innerHTML = `<div class="card">${html}</div>`; return g; };

  function showSetup(s) {
    if (!s.setupCode) { gate(`<div class="lock">${I.lock}</div><h2>הקמת מנהל מערכת</h2><p class="muted">כדי להקים את חשבון המנהל צריך קוד הקמה חד־פעמי. הוא מוגדר ב־Netlify כמשתנה הסביבה <span class="mono">ADMIN_SETUP_CODE</span>.</p>`); return; }
    const g = gate(`<div class="lock">${I.lock}</div><div class="steps"><i class="on"></i><i></i></div><h2>הקמת מנהל מערכת</h2>
      <p class="muted small" style="margin:0">פעם אחת בלבד. אחרי ההקמה הקוד החד־פעמי כבר לא פותח כלום.</p>
      <form id="f1" class="list" autocomplete="off">
        <label class="f">קוד הקמה<input id="code" type="password" required autocomplete="one-time-code" dir="ltr"></label>
        <label class="f">סיסמה חדשה (לפחות 12 תווים)<input id="pw" type="password" required minlength="12" autocomplete="new-password" dir="ltr"></label>
        <label class="f">שוב את הסיסמה<input id="pw2" type="password" required minlength="12" autocomplete="new-password" dir="ltr"></label>
        <div class="err" id="err"></div><button class="btn primary" type="submit">המשך לאימות דו־שלבי</button></form>`);
    g.querySelector("#f1").onsubmit = async e => {
      e.preventDefault(); const code = $("code").value.trim(), pw = $("pw").value;
      if (pw !== $("pw2").value) { $("err").textContent = "הסיסמאות לא זהות"; return; }
      try { const r = await api("POST", "setup", { code, password: pw }); setupStep2(code, r); } catch (err) { $("err").textContent = err.message; }
    };
  }
  function setupStep2(code, r) {
    let qr = ""; try { const q = qrcode(0, "M"); q.addData(r.uri); q.make(); qr = q.createSvgTag({ cellSize: 4, margin: 2, scalable: true }); } catch (e) { }
    const g = gate(`<div class="steps"><i class="on"></i><i class="on"></i></div><h2>אימות דו־שלבי</h2>
      <p class="muted small" style="margin:0">סרקו באפליקציית אימות (Google Authenticator, Microsoft Authenticator, 1Password). בטלפון אפשר גם ללחוץ על הקישור.</p>
      ${qr ? `<div class="qr">${qr}</div>` : ""}<a class="btn" href="${esc(r.uri)}">פתיחה באפליקציית האימות</a>
      <div class="small muted">או הקלדה ידנית של המפתח:</div><div class="secret">${esc(r.secret.replace(/(.{4})/g, "$1 ").trim())}</div>
      <form id="f2" class="list"><label class="f">הקוד בן 6 הספרות מהאפליקציה<input id="otp" class="code" inputmode="numeric" pattern="\\d{6}" maxlength="6" required autocomplete="one-time-code"></label><div class="err" id="err"></div><button class="btn primary" type="submit">סיום והתחברות</button></form>`);
    $("otp").focus();
    g.querySelector("#f2").onsubmit = async e => { e.preventDefault(); try { await api("POST", "setup/confirm", { code, totp: $("otp").value.trim() }); toast("המנהל הוקם. ברוך הבא לבקרה."); enter(); } catch (err) { $("err").textContent = err.message; } };
  }
  function showLogin(s) {
    const g = gate(`<div class="lock">${I.lock}</div><h2>כניסת מנהל</h2>
      <form id="fl" class="list"><label class="f">סיסמה<input id="pw" type="password" required autocomplete="current-password" dir="ltr"></label>
      <label class="f">קוד מאפליקציית האימות<input id="otp" class="code" inputmode="numeric" pattern="\\d{6}" maxlength="6" required autocomplete="one-time-code"></label>
      <div class="err" id="err"></div><button class="btn primary" type="submit">כניסה</button></form>
      <details class="small muted"><summary>איבדתי את הטלפון או את הסיסמה</summary><p>מגדירים ב־Netlify משתנה סביבה <span class="mono">ADMIN_RESET_CODE</span> (לפחות 8 תווים), פורסים מחדש ופותחים את <a href="#reset">מסך השחזור</a>. אחרי השחזור מוחקים את המשתנה.</p></details>`);
    $("pw").focus();
    g.querySelector("#fl").onsubmit = async e => { e.preventDefault(); const btn = e.submitter; btn.disabled = true; try { await api("POST", "login", { password: $("pw").value, totp: $("otp").value.trim() }); enter(); } catch (err) { $("err").textContent = err.message; $("otp").value = ""; } btn.disabled = false; };
    if (s && s.resetCode && location.hash === "#reset") showSetup({ setupCode: true });
  }
  addEventListener("hashchange", () => { if (location.hash === "#reset" && !S.authed) showSetup({ setupCode: true }); });

  /* ---------------- console ---------------- */
  async function enter() {
    S.authed = true; $("gate").hidden = true; $("app").hidden = false; $("who").hidden = false; $("toApp").hidden = true;
    try { const [c, st] = await Promise.all([api("GET", "content"), api("GET", "stats")]); S.content = c; S.draft = clone(c); S.stats = st; } catch (e) { toast(e.message); return; }
    renderNav(); show(S.view);
  }
  function renderNav() {
    const n = S.stats ? S.stats.feedbackNew : 0;
    $("nav").innerHTML = VIEWS.map(([k, t, ic]) => `<button type="button" data-v="${k}" ${k === S.view ? 'aria-current="page"' : ""}>${ic}<span class="t">${t}</span>${k === "inbox" && n ? `<span class="badge">${n}</span>` : ""}</button>`).join("");
    $("nav").querySelectorAll("[data-v]").forEach(b => b.onclick = () => show(b.dataset.v));
    $("whoTxt").textContent = S.stats && S.stats.lastLogin ? "מנהל · " + fmt(S.stats.lastLogin) : "מנהל";
  }
  function show(v) {
    S.view = v; history.replaceState(null, "", "#" + v);
    $("nav").querySelectorAll("[data-v]").forEach(b => { if (b.dataset.v !== v) b.removeAttribute("aria-current"); else b.setAttribute("aria-current", "page"); });
    ({ overview, notice, chapters, hazards, inbox, fuel, pro, system })[v]();
    scrollTo({ top: 0 });
  }
  const V = html => { $("views").innerHTML = `<section class="view">${html}</section>`; return $("views"); };
  function syncSave() {
    const d = dirty(); $("saveBar").hidden = !d;
    if (d) { const n = diffCount(); $("saveTxt").textContent = `${n} שינויים מחכים לפרסום`; }
  }
  function diffCount() { let n = 0; const a = S.content, b = S.draft; for (const k of ["announce", "maintenance", "chapters", "notes", "flags", "featured", "hazards"]) if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) n++; return n; }
  $("discard").onclick = () => { S.draft = clone(S.content); syncSave(); show(S.view); };
  $("publish").onclick = async () => {
    const btn = $("publish"); btn.disabled = true;
    try { const r = await api("PUT", "content", { baseV: S.content.v, content: S.draft, what: S.view }); S.content = r; S.draft = clone(r); syncSave(); toast(`פורסם. גרסה ${r.v} תגיע לרוכבים תוך דקה.`); show(S.view); }
    catch (e) { if (e.status === 409) { toast("מישהו עדכן בינתיים. נטען מחדש."); S.content = e.data.current; S.draft = clone(e.data.current); show(S.view); syncSave(); } else toast(e.message); }
    btn.disabled = false;
  };
  addEventListener("beforeunload", e => { if (dirty()) { e.preventDefault(); e.returnValue = ""; } });
  $("logout").onclick = async () => { try { await api("POST", "logout"); } catch (e) { } S.authed = false; $("toApp").hidden = false; showLogin(); };

  /* ---------- overview ---------- */
  function overview() {
    const st = S.stats || {}; const days = st.days || {};
    const last = Array.from({ length: 30 }, (_, i) => addDays(i - 29)); const vals = last.map(d => days[d] || 0); const mx = Math.max(1, ...vals);
    const sum = n => vals.slice(-n).reduce((a, b) => a + b, 0);
    const c = S.content;
    V(`<div class="head"><h2>סקירה</h2></div>
      <div class="kpis">
        <div class="kpi"><div class="k">פתיחות היום</div><div class="v">${days[today()] || 0}</div></div>
        <div class="kpi"><div class="k">7 ימים</div><div class="v">${sum(7)}</div></div>
        <div class="kpi"><div class="k">30 ימים</div><div class="v">${sum(30)}</div></div>
        <div class="kpi"><div class="k">מנויי התראות</div><div class="v">${st.subs ?? 0}</div></div>
        <div class="kpi ${st.feedbackNew ? "warn" : ""}"><div class="k">דיווחים חדשים</div><div class="v">${st.feedbackNew ?? 0}<small> / ${st.feedbackAll ?? 0}</small></div></div>
        <div class="kpi"><div class="k">תחנות עם אימות רוכבים</div><div class="v">${st.stations ?? 0}<small> · ${st.votes ?? 0} סימונים</small></div></div>
        <div class="kpi ${st.fails24 >= 5 ? "bad" : ""}"><div class="k">כניסות שנכשלו ב־24 ש׳</div><div class="v">${st.fails24 ?? 0}</div></div>
      </div>
      <div class="card"><div class="head"><h3>מכשירים פעילים ביום · 30 יום</h3><span class="small muted">ספירה אנונימית, פעם ביום לכל מכשיר</span></div>
        <div class="bars" role="img" aria-label="פתיחות יומיות ב־30 הימים האחרונים">${vals.map((v, i) => `<i class="${i === 29 ? "today" : ""}" style="height:${Math.max(2, v / mx * 100)}%" title="${last[i]}: ${v}"></i>`).join("")}</div>
        <div class="row small muted" style="justify-content:space-between"><span>${last[0].slice(5)}</span><span>היום</span></div></div>
      <div class="grid2">
        <div class="card"><h3>מה הרוכבים רואים עכשיו</h3><div id="pubState" class="small muted">בודק את מה שמוגש לאפליקציה…</div>
          ${c.maintenance.on ? `<div class="note alert">מצב תחזוקה פעיל: ${esc(c.maintenance.text || "ללא טקסט")}</div>` : ""}
          ${c.announce.on ? `<div class="note ${c.announce.level}">${esc(c.announce.text)}${c.announce.until ? ` <span class="muted small">עד ${esc(c.announce.until)}</span>` : ""}</div>` : `<div class="small muted">אין הודעה פעילה.</div>`}
          <div class="small">פרקים מוסתרים: <b>${Object.values(c.chapters).filter(x => x.hidden).length}</b> · התראות פרק: <b>${Object.values(c.chapters).filter(x => x.alert).length}</b> · מפגעים: <b>${c.hazards.length}</b> · הערות שנערכו: <b>${Object.keys(c.notes).length}</b></div>
          <div class="small muted">גרסת תוכן ${c.v} · עודכנה ${fmt(c.updated)}</div></div>
        <div class="card"><h3>אבטחה</h3><div class="small">כניסה אחרונה: <b>${fmt(st.lastLogin)}</b></div><div class="small">סיסמה הוחלפה: <b>${fmt(st.pwChanged)}</b></div><div class="small muted">סיסמה + קוד מאפליקציית אימות, ניסיונות כושלים נחסמים לרבע שעה, וכל פעולה נרשמת ביומן.</div><div class="row"><button type="button" class="btn sm" data-go="system">יומן ואבטחה</button></div></div>
      </div>`);
    $("views").querySelectorAll("[data-go]").forEach(b => b.onclick = () => show(b.dataset.go));
    fetch("/api/content?t=" + Date.now(), { cache: "no-store" }).then(r => r.json()).then(p => { const el = $("pubState"); if (!el) return; const a = S.content.announce;
      el.innerHTML = p.v !== S.content.v ? `<span style="color:var(--caution)">האפליקציה עדיין מקבלת גרסה ${p.v}. רעננו בעוד כמה שניות.</span>` : a.on && !p.announce.on ? `<span style="color:var(--no)">ההודעה פעילה אבל לא מוצגת: תאריך הסיום (${esc(a.until)}) כבר עבר.</span>` : `<span style="color:var(--go)">מוגש לרוכבים: גרסה ${p.v}${p.announce.on ? ", כולל ההודעה" : ""}.</span>`; }).catch(() => { });
  }

  /* ---------- notices: announcement, maintenance, push ---------- */
  function notice() {
    const a = S.draft.announce, m = S.draft.maintenance;
    const el = V(`<div class="head"><h2>הודעות</h2></div>
      <div class="card"><div class="head"><h3>הודעה בראש האפליקציה</h3><label class="sw"><input type="checkbox" id="aOn" ${a.on ? "checked" : ""}>פעילה</label></div>
        <label class="f">טקסט (עד 280 תווים)<textarea id="aText" maxlength="280" placeholder="למשל: כביש 98 סגור בשבת בין צומת עין זיוון לגשר בנות יעקב">${esc(a.text)}</textarea></label>
        <div class="grid2"><label class="f">סוג<select id="aLvl"><option value="info">מידע</option><option value="warn">אזהרה</option><option value="alert">חשוב מאוד</option></select></label>
        <label class="f">פעילה עד (כולל)<input type="date" id="aUntil" value="${esc(a.until)}"></label></div>
        <label class="f">קישור (לא חובה, https בלבד)<input id="aLink" dir="ltr" value="${esc(a.link)}" placeholder="https://"></label>
        <div class="small muted">תצוגה מקדימה:</div><div class="note ${a.level}" id="aPrev">${esc(a.text) || "<span class='muted'>ריק</span>"}</div></div>
      <div class="card"><div class="head"><h3>מצב תחזוקה</h3><label class="sw"><input type="checkbox" id="mOn" ${m.on ? "checked" : ""}>פעיל</label></div>
        <p class="small muted" style="margin:0">מציג לכל הרוכבים חלון עם ההודעה. המפה נשארת זמינה מתחתיו. משתמשים בזה רק כשמשהו שבור.</p>
        <label class="f">טקסט<textarea id="mText" maxlength="280">${esc(m.text)}</textarea></label></div>
      <div class="card"><h3>התראה לכל הטלפונים</h3><p class="small muted" style="margin:0">נשלחת מיד לכל ${S.stats ? S.stats.subs : ""} המנויים. לא נשמרת כטיוטה ואין ביטול. מוגבל לשידור אחד בכל 10 דקות.</p>
        <label class="f">כותרת (עד 60)<input id="pT" maxlength="60"></label><label class="f">טקסט (עד 180)<textarea id="pB" maxlength="180"></textarea></label>
        <label class="f">לאישור, הקלידו <b>שלח</b><input id="pC" autocomplete="off"></label><div class="row"><button type="button" class="btn primary" id="pGo">שליחה עכשיו</button><span class="small muted" id="pRes"></span></div></div>
      <div class="card"><div class="head"><h3>היסטוריית הודעות</h3><span class="small muted">מה שהרוכבים רואים בפעמון 🔔</span></div><div class="list" id="hList"><div class="small muted">טוען…</div></div></div>`);
    loadHistory();
    $("aLvl").value = a.level;
    const up = () => { a.on = $("aOn").checked; a.text = $("aText").value; a.level = $("aLvl").value; a.until = $("aUntil").value; a.link = $("aLink").value.trim(); m.on = $("mOn").checked; m.text = $("mText").value;
      $("aPrev").className = "note " + a.level; $("aPrev").textContent = a.text || "ריק"; syncSave(); };
    el.querySelectorAll("input,textarea,select").forEach(x => { if (!x.id.startsWith("p")) x.oninput = x.onchange = up; });
    $("pGo").onclick = async () => { if (!confirmInline($("pGo"), "בטוח? זה יגיע לכולם")) return; try { const r = await api("POST", "broadcast", { title: $("pT").value, body: $("pB").value, confirm: $("pC").value.trim() }); $("pRes").textContent = `נשלח ל־${r.sent} מתוך ${r.total}${r.gone ? ` · ${r.gone} מנויים ישנים נוקו` : ""}`; $("pC").value = ""; } catch (e) { $("pRes").textContent = e.message; } };
  }
  async function loadHistory() {
    const box = $("hList"); if (!box) return; let items = [];
    try { items = (await api("GET", "history")).items; } catch (e) { box.innerHTML = `<div class="small muted">${esc(e.message)}</div>`; return; }
    if (!$("hList")) return;
    box.innerHTML = items.length ? items.map(x => `<div class="item"><div class="meta"><span class="tag">${x.kind === "push" ? "התראה" : "הודעה"}</span><span>${fmt(x.t)}</span></div><div>${x.title ? `<b>${esc(x.title)}</b> · ` : ""}${esc(x.text)}</div><div class="row"><button type="button" class="btn sm danger" data-hd="${esc(x.id)}">הסרה מההיסטוריה</button></div></div>`).join("") : `<div class="small muted">עוד אין. כל הודעה שמתפרסמת וכל התראה שנשלחת נשמרות כאן ומוצגות לרוכבים בפעמון.</div>`;
    box.querySelectorAll("[data-hd]").forEach(b => b.onclick = async () => { if (!confirmInline(b, "להסיר?")) return; try { await api("POST", "history/delete", { id: b.dataset.hd }); toast("הוסר. הרוכבים יראו את השינוי תוך דקות"); loadHistory(); } catch (e) { toast(e.message); } });
  }
  /* Two-tap confirm on the button itself (no browser dialogs). */
  function confirmInline(btn, msg) { if (btn.dataset.armed === "1") { btn.dataset.armed = ""; btn.textContent = btn.dataset.lbl; return true; } btn.dataset.lbl = btn.textContent; btn.dataset.armed = "1"; btn.textContent = msg; setTimeout(() => { if (btn.dataset.armed === "1") { btn.dataset.armed = ""; btn.textContent = btn.dataset.lbl; } }, 4000); return false; }

  /* ---------- chapters ---------- */
  function chapters() {
    const D = S.draft; const built = CHAPTERS;
    const el = V(`<div class="head"><h2>פרקים</h2><span class="small muted">הסתרה, התראה לפרק, מסלול מומלץ ועריכת הטקסט של כל עצירה</span></div>
      <div class="card"><label class="f">המסלול המומלץ השבוע (תגית בתדריך)<select id="feat"><option value="">ללא</option>${built.map(c => `<option value="${c.id}">${esc(c.title)}</option>`).join("")}</select></label></div>
      <div class="list">${built.map((c, i) => { const x = D.chapters[c.id] || {}; return `<details class="chap" data-c="${c.id}"><summary><span class="n">${i + 1}</span>${esc(c.title)}<span class="st">${x.hidden ? '<span class="tag bug">מוסתר</span>' : ""}${x.alert ? '<span class="tag hazard">התראה</span>' : ""}</span></summary><div class="body">
        <label class="sw"><input type="checkbox" data-hide ${x.hidden ? "checked" : ""}>להסתיר את הפרק מהרוכבים</label>
        <label class="f">התראה בראש הפרק (למשל עבודות, סגירה, מצב ביטחוני)<input data-alert maxlength="200" value="${esc(x.alert || "")}"></label>
        ${c.combo ? `<div class="small muted">פרק משולב: העצירות נערכות בפרקים 1 עד 3.</div>` : c.stops.map(s => { const k = c.id + ":" + s.id; const v = D.notes[k]; return `<div class="stopnote"><b>${esc(s.name)}</b><textarea data-note="${k}" maxlength="300" placeholder="${esc(s.note)}">${esc(v || "")}</textarea><span class="small muted">${v ? "נערך. ריקון מחזיר את הטקסט המקורי." : "ריק = הטקסט המקורי (מוצג באפור)."}</span></div>`; }).join("")}
      </div></details>`; }).join("")}</div>`);
    $("feat").value = D.featured || ""; $("feat").onchange = e => { D.featured = e.target.value; syncSave(); };
    el.querySelectorAll(".chap").forEach(d => {
      const id = d.dataset.c; const get = () => D.chapters[id] || (D.chapters[id] = { hidden: false, alert: "" });
      const tidy = () => { const x = D.chapters[id]; if (x && !x.hidden && !x.alert) delete D.chapters[id]; syncSave(); };
      d.querySelector("[data-hide]").onchange = e => { get().hidden = e.target.checked; tidy(); };
      d.querySelector("[data-alert]").oninput = e => { get().alert = e.target.value; tidy(); };
      d.querySelectorAll("[data-note]").forEach(t => t.oninput = () => { const v = t.value.trim(); if (v) D.notes[t.dataset.note] = t.value; else delete D.notes[t.dataset.note]; syncSave(); });
    });
  }

  /* ---------- hazards ---------- */
  const HZ = { closure: "כביש סגור", gravel: "חצץ / שמן", works: "עבודות", police: "אכיפה", info: "מידע" };
  function hazards() {
    const D = S.draft;
    const el = V(`<div class="head"><h2>מפגעים ועדכוני דרך</h2><span class="small muted">נקודות שמופיעות לכל הרוכבים על המפה, ובמצב רכיבה מקבלים התראה קולית לפני ההגעה</span></div>
      <div class="card"><div id="hzMap"></div><div class="small muted">לחיצה על המפה בוחרת מיקום. אפשר גם להדביק קישור מגוגל מפות או Waze.</div>
        <div class="grid2"><label class="f">מיקום<input id="hLL" dir="ltr" placeholder="32.79, 35.53 או קישור"></label><label class="f">סוג<select id="hK">${Object.entries(HZ).map(([k, t]) => `<option value="${k}">${t}</option>`).join("")}</select></label></div>
        <label class="f">תיאור (עד 140)<input id="hT" maxlength="140" placeholder="למשל: חצץ בעיקול השני בירידה ממצפה עופר"></label>
        <div class="grid2"><label class="f">בתוקף עד (כולל)<input type="date" id="hU" value="${addDays(1)}"></label><div class="row" style="align-items:end"><button type="button" class="btn primary" id="hAdd">הוספה לטיוטה</button></div></div></div>
      <div class="card"><h3>פעילים בטיוטה (${D.hazards.length})</h3><div class="list" id="hList">${D.hazards.length ? D.hazards.map((h, i) => `<div class="item"><div class="row" style="justify-content:space-between"><b>${esc(h.text)}</b><button type="button" class="btn sm danger" data-del="${i}">הסרה</button></div><div class="meta"><span class="tag hazard">${HZ[h.kind]}</span><span class="mono">${h.lat}, ${h.lon}</span>${h.until ? `<span>עד ${esc(h.until)}</span>` : ""}${h.until && h.until < today() ? '<span class="tag bug">פג תוקף</span>' : ""}</div></div>`).join("") : '<div class="small muted">אין מפגעים.</div>'}</div></div>`);
    let pick = null;
    const parse = s => { const m = String(s).match(/(-?\d{1,2}\.\d+)\s*[, ]\s*(-?\d{1,3}\.\d+)/) || String(s).match(/ll=(-?\d+\.\d+)%2C(-?\d+\.\d+)/); return m ? [+m[1], +m[2]] : null; };
    try {
      const map = new maplibregl.Map({ container: "hzMap", style: "https://tiles.openfreemap.org/styles/" + (matchMedia("(prefers-color-scheme: light)").matches ? "liberty" : "dark"), center: [35.3, 32.6], zoom: 7.6, attributionControl: { compact: true } });
      const mk = new maplibregl.Marker({ color: "#FFB547" });
      const dots = D.hazards.map(h => new maplibregl.Marker({ color: "#FF6A63", scale: 0.7 }).setLngLat([h.lon, h.lat]).addTo(map));
      map.on("click", e => { pick = [+e.lngLat.lat.toFixed(5), +e.lngLat.lng.toFixed(5)]; $("hLL").value = pick.join(", "); mk.setLngLat([pick[1], pick[0]]).addTo(map); });
      $("hLL").oninput = () => { const p = parse($("hLL").value); if (p) { pick = p; mk.setLngLat([p[1], p[0]]).addTo(map); map.easeTo({ center: [p[1], p[0]], zoom: 12 }); } };
      S.map = map; void dots;
    } catch (e) { $("hzMap").outerHTML = '<div class="small muted">המפה לא נטענה. אפשר להזין מיקום ידנית.</div>'; $("hLL").oninput = () => { pick = parse($("hLL").value); }; }
    $("hAdd").onclick = () => {
      const p = pick || parse($("hLL").value), t = $("hT").value.trim();
      if (!p) return toast("חסר מיקום"); if (!t) return toast("חסר תיאור");
      if (!(p[0] > 29 && p[0] < 33.6 && p[1] > 34 && p[1] < 36.2)) return toast("המיקום מחוץ לישראל");
      D.hazards.push({ id: Math.random().toString(36).slice(2, 10), lat: p[0], lon: p[1], text: t, kind: $("hK").value, until: $("hU").value }); syncSave(); hazards();
    };
    el.querySelectorAll("[data-del]").forEach(b => b.onclick = () => { D.hazards.splice(+b.dataset.del, 1); syncSave(); hazards(); });
  }

  /* ---------- inbox ---------- */
  const KIND = { bug: "תקלה", idea: "רעיון", data: "מידע שגוי", hazard: "דיווח דרך", other: "אחר", pro: "Pro" };
  const STAT = { new: "חדש", open: "בטיפול", done: "טופל" };
  async function inbox(filter = S.inboxFilter || "active") {
    S.inboxFilter = filter;
    V(`<div class="head"><h2>תיבת דיווחים</h2></div><p class="small muted">כל מה שרוכבים שולחים מהאפליקציה. שום דבר מכאן לא מוצג לרוכבים אחרים עד שמאשרים.</p><div class="list"><div class="small muted">טוען…</div></div>`);
    try { S.feedback = (await api("GET", "feedback")).items; } catch (e) { return; }
    const items = S.feedback.filter(x => filter === "all" || (filter === "active" ? x.status !== "done" : x.status === filter));
    const el = V(`<div class="head"><h2>תיבת דיווחים</h2><div class="row"><button type="button" class="btn sm danger" id="fPurge" hidden></button><select id="fF"><option value="active">פתוחים</option><option value="new">חדשים</option><option value="done">טופלו</option><option value="all">הכול</option></select></div></div>
      <div class="list">${items.length ? items.map(x => `<div class="item"><div class="meta"><span class="tag ${x.kind}">${KIND[x.kind] || x.kind}</span><span class="tag ${x.status === "new" ? "new" : ""}">${STAT[x.status]}</span><span>${fmt(x.t)}</span>${x.chap ? `<span>פרק ${esc(x.chap)}</span>` : ""}${x.ver ? `<span class="mono">v${esc(x.ver)}</span>` : ""}</div>
        <div style="white-space:pre-wrap">${esc(x.text)}</div>${x.lat ? `<div class="meta"><a class="mono" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${x.lat},${x.lon}">${x.lat}, ${x.lon}</a></div>` : ""}
        <div class="row">${x.status !== "open" ? `<button type="button" class="btn sm" data-s="${x.id}|open">בטיפול</button>` : ""}${x.status !== "done" ? `<button type="button" class="btn sm" data-s="${x.id}|done">טופל</button>` : ""}${x.lat ? `<button type="button" class="btn sm" data-pub="${x.id}">פרסום כמפגע ל־48 ש׳</button>` : ""}<button type="button" class="btn sm danger" data-del="${x.id}">מחיקה</button></div><div class="row delask" data-ask="${x.id}" hidden><b class="small" style="color:var(--no)">למחוק לצמיתות?</b><button type="button" class="btn sm danger" data-s="${x.id}|delete">כן, למחוק</button><button type="button" class="btn sm" data-no="${x.id}">ביטול</button></div></div>`).join("") : '<div class="card small muted">אין כאן כלום. שקט בכביש.</div>'}</div>`);
    $("fF").value = filter; $("fF").onchange = e => inbox(e.target.value);
    const doneN = S.feedback.filter(x => x.status === "done").length;
    if ($("fPurge")) { $("fPurge").hidden = !doneN; $("fPurge").textContent = `מחיקת ${doneN} שטופלו`; $("fPurge").onclick = async () => { if (!confirmInline($("fPurge"), `בטוח? ${doneN} פריטים יימחקו`)) return; try { const r = await api("POST", "feedback/purge"); toast(`נמחקו ${r.removed}`); S.stats = await api("GET", "stats"); renderNav(); inbox(filter); } catch (e) { toast(e.message); } }; }
    el.querySelectorAll("[data-del]").forEach(b => b.onclick = () => { const a = el.querySelector(`[data-ask="${b.dataset.del}"]`); a.hidden = false; b.hidden = true; });
    el.querySelectorAll("[data-no]").forEach(b => b.onclick = () => { el.querySelector(`[data-ask="${b.dataset.no}"]`).hidden = true; el.querySelector(`[data-del="${b.dataset.no}"]`).hidden = false; });
    el.querySelectorAll("[data-s]").forEach(b => b.onclick = async () => { const [id, s] = b.dataset.s.split("|"); b.disabled = true; try { await api("POST", "feedback/status", { id, status: s }); if (s === "delete") toast("נמחק"); S.stats = await api("GET", "stats"); renderNav(); inbox(filter); } catch (e) { b.disabled = false; toast(e.message); } });
    el.querySelectorAll("[data-pub]").forEach(b => b.onclick = async () => {
      const x = S.feedback.find(f => f.id === b.dataset.pub); S.draft.hazards.push({ id: "fb" + x.id.slice(0, 8), lat: x.lat, lon: x.lon, text: x.text.slice(0, 140), kind: /חצץ|שמן/.test(x.text) ? "gravel" : /סגור|חסימה/.test(x.text) ? "closure" : /עבודות/.test(x.text) ? "works" : /ניידת|מצלמה|לייזר|ממל/.test(x.text) ? "police" : "info", until: addDays(2) });
      syncSave(); try { await api("POST", "feedback/status", { id: x.id, status: "done" }); } catch (e) { } toast("נוסף לטיוטת המפגעים. לחצו ׳פרסום׳ למטה."); inbox(filter);
    });
  }

  /* ---------- fuel moderation ---------- */
  async function fuel() {
    V(`<div class="head"><h2>אימות רוכבים בתחנות דלק</h2></div><div class="small muted">טוען…</div>`);
    try { S.fuel = (await api("GET", "fuel")).rows; } catch (e) { return; }
    const el = V(`<div class="head"><h2>אימות רוכבים בתחנות דלק</h2><span class="small muted">כל רוכב מחזיק סימון אחד לכל שאלה. אם תחנה הותקפה בסימונים שגויים, מאפסים אותה.</span></div>
      <div class="card scroll"><table class="tbl"><thead><tr><th>תחנה (OSM)</th><th>רוכבים</th><th>פתוח/סגור בשבת</th><th>98 כן/לא</th><th>אחרון</th><th></th></tr></thead><tbody>
      ${S.fuel.length ? S.fuel.map(r => `<tr><td><a class="mono" target="_blank" rel="noopener" href="https://www.openstreetmap.org/${{ n: "node", w: "way", r: "relation" }[r.id[0]]}/${r.id.slice(1)}">${r.id}</a></td><td>${r.riders}</td><td>${r.open} / ${r.closed}</td><td>${r.y98} / ${r.n98}</td><td>${fmt(r.last)}</td><td><button type="button" class="btn sm danger" data-r="${r.id}">איפוס</button></td></tr>`).join("") : '<tr><td colspan="6" class="muted">עוד אין סימונים.</td></tr>'}</tbody></table></div>`);
    el.querySelectorAll("[data-r]").forEach(b => b.onclick = async () => { if (!confirmInline(b, "לאפס?")) return; try { await api("POST", "fuel/reset", { id: b.dataset.r }); toast("אופס"); fuel(); } catch (e) { toast(e.message); } });
  }

  /* ---------- Blue Ronin Pro: codes, trials, demand ---------- */
  async function pro() {
    V(`<div class="head"><h2>Blue Ronin Pro</h2></div><div class="small muted">טוען…</div>`);
    let d; try { d = await api("GET", "pro"); } catch (e) { return; }
    const live = d.codes.filter(c => !c.revoked), used = live.reduce((a, c) => a + (c.used || 0), 0);
    const el = V(`<div class="head"><h2>Blue Ronin Pro</h2><span class="small muted">עד שהתשלום בגוגל פליי נפתח, Pro ניתן בניסיון של 7 ימים או בקוד ממך</span></div>
      <div class="kpis"><div class="kpi"><span class="k">ניסיונות שהופעלו</span><div class="v">${d.trials}</div></div><div class="kpi"><span class="k">שריון שנתי ₪99</span><div class="v">${d.interest.yearly || 0}</div></div><div class="kpi"><span class="k">שריון חודשי</span><div class="v">${d.interest.monthly || 0}</div></div><div class="kpi"><span class="k">מימושי קודים</span><div class="v">${used}</div></div></div>
      <div class="card"><h3>הנפקת קודים</h3><p class="small muted" style="margin:0">לחברי קבוצה, בודקי בטא, הגרלות ושיתופי פעולה. כל קוד נותן Pro למספר ימים, ואפשר להגביל כמה מכשירים יממשו אותו.</p>
        <div class="grid2"><label class="f">כמה קודים<input id="cN" type="number" min="1" max="50" value="1"></label><label class="f">ימי Pro לכל מימוש<input id="cD" type="number" min="1" max="730" value="30"></label>
        <label class="f">מימושים לכל קוד<input id="cM" type="number" min="1" max="1000" value="1"></label><label class="f">תווית (למי)<input id="cL" maxlength="60" placeholder="למשל: קבוצת רוכבי הגליל"></label></div>
        <div class="row"><button type="button" class="btn primary" id="cGo">הנפקה</button></div><div id="cOut"></div></div>
      <div class="card scroll"><h3>קודים</h3><table class="tbl"><thead><tr><th>קוד</th><th>תווית</th><th>ימים</th><th>מומשו</th><th>נוצר</th><th></th></tr></thead><tbody>
      ${d.codes.length ? d.codes.map(c => `<tr${c.revoked ? ' style="opacity:.45"' : ""}><td class="mono" dir="ltr">${esc(c.code)}</td><td>${esc(c.label || "")}</td><td>${c.days}</td><td>${c.used} / ${c.max}</td><td>${fmt(c.created)}</td><td>${c.revoked ? "בוטל" : `<button type="button" class="btn sm danger" data-rv="${esc(c.code)}">ביטול</button>`}</td></tr>`).join("") : `<tr><td colspan="6" class="muted">עוד לא הונפקו קודים</td></tr>`}</tbody></table></div>
      <p class="small muted">ביטול קוד מבטל גם את ה־Pro של מי שכבר מימש אותו, בבדיקה הבאה של האפליקציה (עד 6 שעות). שריונים מגיעים גם לתיבת הדיווחים בסוג ״Pro״.</p>`);
    const showCodes = codes => {
      $("cOut").innerHTML = `<label class="f">הקודים החדשים (להעתקה)<textarea readonly dir="ltr" class="mono" rows="${Math.min(8, codes.length + 1)}">${esc(codes.join("\n"))}</textarea></label><div class="row"><button type="button" class="btn sm" id="cCopy">העתקה</button></div>`;
      $("cCopy").onclick = () => navigator.clipboard.writeText(codes.join("\n")).then(() => toast("הועתק")).catch(() => { $("cOut").querySelector("textarea").select(); });
    };
    if (S.newCodes) { showCodes(S.newCodes); S.newCodes = null; }
    $("cGo").onclick = async () => { $("cGo").disabled = true; try { const r = await api("POST", "pro/codes", { count: +$("cN").value, days: +$("cD").value, max: +$("cM").value, label: $("cL").value });
      toast(`הונפקו ${r.codes.length} קודים`); S.newCodes = r.codes; return pro(); } catch (e) { toast(e.message); } $("cGo").disabled = false; };
    el.querySelectorAll("[data-rv]").forEach(b => b.onclick = async () => { if (!confirmInline(b, "לבטל?")) return; try { await api("POST", "pro/revoke", { code: b.dataset.rv }); toast("הקוד בוטל"); pro(); } catch (e) { toast(e.message); } });
  }

  /* ---------- system: feature switches, security, audit ---------- */
  const FLAGS = { move: ["מעבר לכתובת blueronin.app", "באנר בכתובת הישנה שמעביר כל רוכב לכתובת החדשה יחד עם הנתונים שלו. מדליקים רק כשהדומיין החדש עובד"], fly: ["מעוף ציפור", "כפתור המעוף והאנימציה"], builder: ["בניית מסלול אישי", "יצירה, שמירה ושיתוף של מסלולים"], fuelVotes: ["אימות רוכבים בתחנות", "כפתורי פתוח בשבת / יש 98"], photos: ["תמונות מקומות", "Mapillary ו־Wikimedia בחלונות"], feedback: ["דיווח מהאפליקציה", "טופס התקלות והרעיונות בלשונית כלים"] };
  const ACT = { login: "כניסה", setup: "הקמה", reset: "שחזור", content: "פרסום תוכן", broadcast: "שידור התראה", password: "החלפת סיסמה", "logout-all": "ניתוק כל ההתחברויות", "fuel-reset": "איפוס תחנה", feedback: "טיפול בדיווח", "feedback-purge": "ניקוי דיווחים שטופלו", "fail:login": "כניסה נכשלה", "fail:setup": "הקמה נכשלה", "fail:setup-totp": "קוד אימות שגוי בהקמה", "fail:password": "החלפת סיסמה נכשלה" };
  async function system() {
    const D = S.draft;
    const el = V(`<div class="head"><h2>מערכת</h2></div>
      <div class="card"><h3>מתגי פיצ׳רים</h3><p class="small muted" style="margin:0">מכבים פיצ׳ר לכולם בלי לגעת בקוד, למשל אם משהו שבור. נכנס לתוקף אחרי פרסום.</p>
        ${Object.entries(FLAGS).map(([k, [t, d]]) => `<label class="sw"><input type="checkbox" data-flag="${k}" ${D.flags[k] ? "checked" : ""}><span>${t}<br><span class="small muted" style="font-weight:400">${d}</span></span></label>`).join("")}</div>
      <div class="grid2">
        <div class="card"><h3>החלפת סיסמה</h3><form id="fp" class="list" autocomplete="off"><label class="f">סיסמה נוכחית<input type="password" id="cp" autocomplete="current-password" dir="ltr" required></label><label class="f">סיסמה חדשה (12+)<input type="password" id="np" minlength="12" autocomplete="new-password" dir="ltr" required></label><label class="f">קוד אימות<input id="ct" class="code" inputmode="numeric" maxlength="6" required autocomplete="one-time-code"></label><div class="err" id="perr"></div><button class="btn primary" type="submit">עדכון</button></form></div>
        <div class="card"><h3>חירום</h3><p class="small muted" style="margin:0">מנתק מיד כל דפדפן שמחובר כמנהל, כולל זה. שימושי אם טלפון אבד.</p><button type="button" class="btn danger" id="la">ניתוק כל ההתחברויות</button>
          <h3 style="margin-top:6px">כלים</h3><div class="row"><a class="btn sm" target="_blank" rel="noopener" href="https://app.netlify.com/projects/blueronin-north-map/overview">Netlify</a><a class="btn sm" target="_blank" rel="noopener" href="https://github.com/EliKatsman21/blue-ronin-navigator">GitHub</a><a class="btn sm" href="/api/content" target="_blank" rel="noopener">התוכן הציבורי (JSON)</a></div></div>
      </div>
      <div class="card"><h3>יומן פעולות</h3><div class="scroll"><table class="tbl"><thead><tr><th>מתי</th><th>פעולה</th><th>פרטים</th></tr></thead><tbody id="aud"><tr><td colspan="3" class="muted">טוען…</td></tr></tbody></table></div></div>`);
    el.querySelectorAll("[data-flag]").forEach(x => x.onchange = () => { D.flags[x.dataset.flag] = x.checked; syncSave(); });
    $("fp").onsubmit = async e => { e.preventDefault(); try { await api("POST", "password", { current: $("cp").value, next: $("np").value, totp: $("ct").value.trim() }); toast("הסיסמה עודכנה. התחברויות אחרות נותקו."); system(); } catch (err) { $("perr").textContent = err.message; } };
    $("la").onclick = async () => { if (!confirmInline($("la"), "בטוח? גם אתה תנותק")) return; try { await api("POST", "logout-all"); } catch (e) { } S.authed = false; showLogin(); };
    try { const a = (await api("GET", "audit")).items; $("aud").innerHTML = a.map(x => `<tr><td>${fmt(x.t)}</td><td>${x.a.startsWith("fail") ? `<b style="color:var(--no)">${ACT[x.a] || x.a}</b>` : ACT[x.a] || esc(x.a)}</td><td class="small muted">${esc(Object.entries(x.d || {}).filter(([k]) => k !== "ip").map(([k, v]) => `${k}: ${v}`).join(" · "))}${x.d && x.d.ip ? ` <span class="mono">#${esc(x.d.ip.slice(0, 6))}</span>` : ""}</td></tr>`).join("") || '<tr><td colspan="3" class="muted">ריק</td></tr>'; } catch (e) { }
  }

  boot();
})();
