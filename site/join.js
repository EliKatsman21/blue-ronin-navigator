/* /join — the launch waitlist. Talks to /api/join; remembers the rider's own code on this device so a
   return visit shows how many friends joined. No tracking, no cookies. */
(() => {
  "use strict";
  const $ = id => document.getElementById(id), q = new URLSearchParams(location.search);
  const KEY = "brn:join", SRCS = ["ig", "yt", "wa", "wa-brief", "tt", "fb", "app", "qr", "press", "friend", "site"];
  const ref = /^[A-HJKMNP-Z2-9]{6}$/.test(q.get("r") || "") ? q.get("r") : "";
  const src = SRCS.includes(q.get("src")) ? q.get("src") : ref ? "friend" : "site";
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { return null; } };
  const save = v => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { } };
  const say = t => { $("jErr").textContent = t || ""; };
  function done(d) {
    const need = d.need || 3, refs = Math.min(d.refs || 0, need), link = `https://blueronin.app/join?r=${d.code}`;
    $("jf").hidden = true; $("jDone").hidden = false;
    $("jNum").textContent = d.n ? "#" + d.n : ""; $("jHello").textContent = d.again ? "כבר נרשמתם. הנה המצב שלכם." : "אתם ברשימה.";
    $("jDots").innerHTML = Array.from({ length: need }, (_, i) => `<i class="${i < refs ? "on" : ""}"></i>`).join(""); $("jDots").setAttribute("aria-label", `${refs} מתוך ${need}`);
    $("jRefs").textContent = refs >= need ? "שלושה חברים הצטרפו. חודש Pro מחכה לכם בהשקה." : `${refs} מתוך ${need} חברים הצטרפו דרך הקישור שלכם.`;
    $("jLink").textContent = link;
    const msg = `מצאתי אפליקציית ניווט ישראלית לרוכבים: מסלולי סופ״ש, דלק לפי הדגם, SOS. נרשמים כאן להשקה: ${link}`;
    $("jWa").href = "https://wa.me/?text=" + encodeURIComponent(msg);
    $("jCopy").onclick = async () => { try { await navigator.clipboard.writeText(link); $("jCopy").textContent = "הועתק"; } catch (e) { const r = document.createRange(); r.selectNodeContents($("jLink")); const s = getSelection(); s.removeAllRanges(); s.addRange(r); $("jCopy").textContent = "סמנו והעתיקו"; } setTimeout(() => { $("jCopy").textContent = "העתקת הקישור"; }, 2200); };
  }
  $("jf").addEventListener("submit", async e => {
    e.preventDefault(); say("");
    const email = $("jEmail").value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { say("כתובת המייל לא נראית תקינה"); $("jEmail").focus(); return; }
    if (!$("jOk").checked) { say("צריך לסמן את ההסכמה כדי שנוכל לשלוח את ההזמנה"); $("jOk").focus(); return; }
    const btn = $("jGo"); btn.disabled = true; btn.textContent = "רגע…";
    try {
      const res = await fetch("/api/join", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, name: $("jName").value, website: $("jWeb").value, ref, src, consent: true }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.code) throw new Error(d.error || "ההרשמה לא הצליחה כרגע. נסו שוב בעוד רגע.");
      save({ code: d.code, n: d.n }); done(d);
    } catch (err) { say(err && err.message && !/fetch|network|load/i.test(err.message) ? err.message : "אין חיבור כרגע. נסו שוב בעוד רגע."); btn.disabled = false; btn.textContent = "שמרו לי מקום"; }
  });
  const mine = load();
  if (mine && mine.code) {
    done({ code: mine.code, n: mine.n, refs: 0, again: true });
    fetch("/api/join?c=" + mine.code).then(r => r.ok ? r.json() : null).then(d => { if (d) done({ code: mine.code, n: mine.n, refs: d.refs, need: d.need, again: true }); }).catch(() => { });
  }
})();
