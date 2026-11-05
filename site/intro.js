/* Intro: wheelie rider + ignition sound (kept out of index.html so the page can run under a strict CSP). */
/* The wheelie rider: rides the road line as it draws itself, lifts the front wheel with the revs
   (the same keyframes as the tachometer needle and the engine sound), sets it down on the decel. */
(() => {
  const intro = document.getElementById("intro"), path = intro.querySelector(".road path"), g = document.getElementById("rider");
  if (!path || !g || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const streaks = document.getElementById("rStreaks"), spR = document.getElementById("rSpR"), spF = document.getElementById("rSpF");
  const bez = (x1, y1, x2, y2) => u => { if (u <= 0) return 0; if (u >= 1) return 1; let s = u; for (let i = 0; i < 8; i++) { const bx = 3 * x1 * s * (1 - s) ** 2 + 3 * x2 * s * s * (1 - s) + s ** 3 - u, dx = 3 * x1 * (1 - s) ** 2 + 6 * (x2 - x1) * s * (1 - s) + 3 * (1 - x2) * s * s; s = Math.min(1, Math.max(0, s - bx / (dx || 1e-6))); } return 3 * y1 * s * (1 - s) ** 2 + 3 * y2 * s * s * (1 - s) + s ** 3; };
  const ne = bez(.3, .1, .2, 1), dr = bez(.25, .1, .25, 1);
  const needle = t => t < .25 ? 0 : t < .925 ? ne((t - .25) / .675) : t < 1.12 ? 1 - (4 / 240) * ne((t - .925) / .195) : t < 1.75 ? (236 / 240) * (1 - ne((t - 1.12) / .63)) : 0;
  const Lp = path.getTotalLength(); const end = path.getPointAtLength(Lp), endB = path.getPointAtLength(Lp - 2); const endAng = Math.atan2(end.y - endB.y, end.x - endB.x);
  const at = s => { if (s <= Lp) { const a = path.getPointAtLength(Math.max(0, s)), b = path.getPointAtLength(Math.min(Lp, Math.max(0, s) + 2)); return [a.x, a.y, Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI]; } const e = s - Lp; return [end.x + Math.cos(endAng) * e, end.y + Math.sin(endAng) * e, endAng * 180 / Math.PI]; };
  const clock = () => { const a = intro.getAnimations({ subtree: true }).find(x => x.animationName === "sweep"); return a && a.currentTime != null ? a.currentTime / 1000 : performance.now() / 1000; };
  let wPrev = 0, last = 0;
  const frame = () => {
    if (intro.classList.contains("out")) return;
    const t = clock(); const f = needle(t);
    /* the rider holds the throttle with the needle: covers most of the road while the revs rise and fall,
       lands near the end of the line as the needle returns, then rides out of frame */
    const tip = 420 * dr((t - .2) / 1.6), u = Math.min(1, Math.max(0, (t - .22) / 1.53));
    const s = t <= 1.75 ? Math.min(tip, Lp * .86 * (1 - Math.pow(1 - u, 1.7))) : Lp * .86 + (t - 1.75) * Lp * .75;
    const [x, y, ang] = at(s);
    let w = 33 * Math.pow(f, 1.15);
    if (t > .925 && t < 1.12) w += 1.6 * Math.sin(2 * Math.PI * 7 * t);
    if (t > 1.55 && t < 2.1) w -= 2.6 * Math.exp(-(t - 1.55) * 9) * Math.sin((t - 1.55) * 30);
    wPrev = w; last = t;
    g.setAttribute("transform", `translate(${x.toFixed(2)} ${(y - 2.4).toFixed(2)}) rotate(${(ang - wPrev).toFixed(2)}) scale(.6)`);
    g.setAttribute("opacity", t < .2 ? 0 : t > 2.25 ? Math.max(0, 1 - (t - 2.25) / .2) : Math.min(1, (t - .2) / .08));
    streaks.setAttribute("opacity", (Math.min(1, f * 1.4) * .85).toFixed(2));
    const spin = (s / 9 * 180 / Math.PI / .6) % 360; spR.setAttribute("transform", `rotate(${spin.toFixed(1)} 0 -9)`); spF.setAttribute("transform", `rotate(${spin.toFixed(1)} 44 -9)`);
    if (t < 3.2 || !last) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  window.BR_riderRestart = () => requestAnimationFrame(frame);
})();

/* Ignition sound, locked to the tachometer needle. Runs before the map library loads.
   Autoplay is allowed for installed apps on Android; elsewhere one tap on the intro starts it. */
(() => {
  const KEY = "brn:introSound";
  let on = true; try { on = JSON.parse(localStorage.getItem(KEY) ?? "true"); } catch (e) { }
  window.BR_introHold = 2350;
  if (!on || matchMedia("(prefers-reduced-motion: reduce)").matches || !window.AudioContext && !window.webkitAudioContext) return;
  try { const last = +sessionStorage.getItem("brn:introAt") || 0; if (Date.now() - last < 15000) return; sessionStorage.setItem("brn:introAt", Date.now()); } catch (e) { }
  const intro = document.getElementById("intro"), btn = document.getElementById("ignBtn");
  const anims = () => intro.getAnimations({ subtree: true }).filter(a => /sweep|nlight|draw/.test(a.animationName || ""));
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const gain = ctx.createGain(); gain.gain.value = 0.85; gain.connect(ctx.destination);
  let buf = null, played = false;
  const ready = fetch("sounds/ignition.mp3").then(r => r.arrayBuffer()).then(b => new Promise((res, rej) => ctx.decodeAudioData(b, res, rej))).then(b => (buf = b)).catch(() => null);
  const play = (offset) => { if (!buf || played) return; played = true; const s = ctx.createBufferSource(); s.buffer = buf; s.connect(gain); s.start(0, Math.max(0, offset)); window.BR_introHold = Math.max(window.BR_introHold, performance.now() + (buf.duration - offset) * 1000 - 500); };
  const elapsed = () => { const a = anims()[0]; return a && a.currentTime != null ? a.currentTime / 1000 : performance.now() / 1000; };
  ready.then(() => {
    if (!buf) return;
    if (ctx.state === "running") { const off = elapsed(); if (off < 1.0) play(off); return; }
    ctx.resume().then(() => { if (ctx.state === "running") { const off = elapsed(); if (off < 1.0) play(off); } }).catch(() => { });
    setTimeout(() => { if (!played && !intro.classList.contains("out")) { btn.hidden = false; window.BR_introHold = Math.max(window.BR_introHold, performance.now() + 1600); } }, 250);
  });
  const ignite = async e => {
    if (played) return; e && e.preventDefault();
    try { await ctx.resume(); } catch (err) { }
    await ready; if (!buf) return;
    btn.hidden = true;
    anims().forEach(a => { a.cancel(); a.play(); });
    play(0); window.BR_riderRestart && window.BR_riderRestart();
  };
  btn.addEventListener("click", ignite);
  intro.addEventListener("pointerdown", e => { if (e.target !== btn && !btn.contains(e.target)) ignite(e); });
})();
