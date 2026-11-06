/* Admin core: auth (scrypt password + TOTP 2FA), signed sessions, throttling, audit log,
   and the validated remote-content document every rider's app reads.

   Threat model, in short:
   - Only one admin. No password ever leaves the server; only a scrypt hash is stored.
   - First setup needs a one-time code from a Netlify env var (ADMIN_SETUP_CODE), so nobody who
     merely finds /admin can claim it. Recovery uses ADMIN_RESET_CODE the same way.
   - Sessions are HMAC-signed, httpOnly, Secure, SameSite=Strict cookies scoped to /api/admin,
     12 h long, and revocable all at once (session version).
   - Every write needs a custom header and a same-origin Origin, so cross-site forms can't post.
   - Login and setup are throttled per IP (hashed, never stored raw) and globally.
   - Every admin action lands in an append-only audit log (last 400 entries). */
import { getStore } from "@netlify/blobs";
import { createHmac, randomBytes, scrypt as _scrypt, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";
const scrypt = promisify(_scrypt);

export const store = () => getStore({ name: "brn-admin", consistency: "strong" });
const SESSION_H = 12;
const COOKIE = "brn_admin";

/* ---------- small helpers ---------- */
export const b64u = b => Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64u = s => Buffer.from(String(s).replace(/-/g, "+").replace(/_/g, "/"), "base64");
export const json = (o, status = 200, headers = {}) => new Response(JSON.stringify(o), { status, headers: Object.assign({ "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }, headers) });
const eq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && timingSafeEqual(x, y); };
export const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function secret() {
  const s = store(); let k = await s.get("secret");
  if (!k) { k = b64u(randomBytes(32)); await s.set("secret", k); }
  return k;
}
export const ipOf = req => req.headers.get("x-nf-client-connection-ip") || req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "0";
export async function ipHash(req) { return createHash("sha256").update((await secret()) + "|" + ipOf(req)).digest("hex").slice(0, 16); }

/* ---------- passwords ---------- */
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
export async function hashPw(pw, salt = randomBytes(16)) { const h = await scrypt(String(pw).normalize("NFKC"), salt, 32, SCRYPT); return { salt: b64u(salt), hash: b64u(h) }; }
export async function checkPw(pw, rec) { const h = await scrypt(String(pw).normalize("NFKC"), fromB64u(rec.salt), 32, SCRYPT); return eq(b64u(h), rec.hash); }
export function pwProblem(pw) {
  if (typeof pw !== "string") return "סיסמה חסרה";
  if (pw.length < 12) return "לפחות 12 תווים";
  if (pw.length > 200) return "ארוכה מדי";
  if (new Set(pw).size < 6) return "מגוונת יותר, בבקשה";
  return null;
}

/* ---------- TOTP (RFC 6238, SHA-1, 6 digits, 30 s) ---------- */
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function b32encode(buf) { let bits = 0, val = 0, out = ""; for (const byte of buf) { val = (val << 8) | byte; bits += 8; while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; } } if (bits > 0) out += B32[(val << (5 - bits)) & 31]; return out; }
function b32decode(s) { let bits = 0, val = 0; const out = []; for (const ch of s.replace(/=+$/, "").toUpperCase()) { const i = B32.indexOf(ch); if (i < 0) continue; val = (val << 5) | i; bits += 5; if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; } } return Buffer.from(out); }
function hotp(key, counter) {
  const c = Buffer.alloc(8); c.writeBigUInt64BE(BigInt(counter));
  const h = createHmac("sha1", key).update(c).digest(); const o = h[h.length - 1] & 15;
  return String(((h.readUInt32BE(o) & 0x7fffffff) % 1e6)).padStart(6, "0");
}
/* Returns the matched time step (for replay protection) or -1. */
export function totpStep(secretB32, code, lastStep = -1) {
  if (!/^\d{6}$/.test(String(code || ""))) return -1;
  const key = b32decode(secretB32), now = Math.floor(Date.now() / 30000);
  for (const d of [0, -1, 1]) { const step = now + d; if (step > lastStep && eq(hotp(key, step), code)) return step; }
  return -1;
}
export const otpauth = (secretB32, label = "admin") => `otpauth://totp/${encodeURIComponent("Blue Ronin:" + label)}?secret=${secretB32}&issuer=${encodeURIComponent("Blue Ronin")}&algorithm=SHA1&digits=6&period=30`;

/* ---------- sessions ---------- */
export async function issue(auth) {
  const now = Date.now(); const payload = b64u(JSON.stringify({ sv: auth.sv || 1, iat: now, exp: now + SESSION_H * 3600e3, n: b64u(randomBytes(9)) }));
  const sig = b64u(createHmac("sha256", await secret()).update(payload).digest());
  return `${COOKIE}=${payload}.${sig}; Path=/api/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_H * 3600}`;
}
export const clearCookie = `${COOKIE}=; Path=/api/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
export async function session(req, auth) {
  const m = (req.headers.get("cookie") || "").match(new RegExp(`(?:^|; )${COOKIE}=([^;]+)`)); if (!m || !auth || !auth.active) return null;
  const [payload, sig] = m[1].split("."); if (!payload || !sig) return null;
  const want = b64u(createHmac("sha256", await secret()).update(payload).digest()); if (!eq(want, sig)) return null;
  let p; try { p = JSON.parse(fromB64u(payload).toString()); } catch (e) { return null; }
  if (p.exp < Date.now() || p.sv !== (auth.sv || 1)) return null;
  return p;
}

/* ---------- CSRF / origin ---------- */
export function sameOrigin(req) {
  if (req.method === "GET" || req.method === "HEAD") return true;
  if (req.headers.get("x-brn-admin") !== "1") return false;
  const o = req.headers.get("origin"); if (!o) return true;
  try { return new URL(o).host === new URL(req.url).host; } catch (e) { return false; }
}

/* ---------- throttling (login, setup, password) ---------- */
const WIN = 15 * 6e4;
export async function throttled(req) {
  const t = (await store().get("throttle", { type: "json" })) || []; const now = Date.now(), ip = await ipHash(req);
  const recent = t.filter(x => now - x.t < WIN);
  return recent.filter(x => x.ip === ip).length >= 5 || recent.length >= 25;
}
export async function failed(req, what) {
  const s = store(); const now = Date.now(); const ip = await ipHash(req);
  const t = ((await s.get("throttle", { type: "json" })) || []).filter(x => now - x.t < WIN); t.push({ t: now, ip, what });
  await s.setJSON("throttle", t.slice(-200)); await audit("fail:" + what, { ip });
}
export async function cleared(req) { const s = store(); const ip = await ipHash(req); const t = ((await s.get("throttle", { type: "json" })) || []).filter(x => x.ip !== ip); await s.setJSON("throttle", t); }

/* ---------- audit ---------- */
export async function audit(action, detail = {}) {
  const s = store(); const log = (await s.get("audit", { type: "json" })) || [];
  log.push({ t: Date.now(), a: action, d: detail }); await s.setJSON("audit", log.slice(-400));
}

/* ---------- remote content (what riders' apps read) ---------- */
export const CONTENT_DEFAULT = {
  v: 0, updated: 0,
  announce: { on: false, text: "", level: "info", until: "", link: "" },
  maintenance: { on: false, text: "" },
  chapters: {},
  notes: {},
  flags: { fly: true, builder: true, fuelVotes: true, photos: true, feedback: true },
  featured: "",
  hazards: []
};
const str = (x, n) => String(x ?? "").replace(/[\u0000-\u0008\u000B-\u001F\u007F‪-‮⁦-⁩]/g, "").trim().slice(0, n);
const id = x => /^[a-z0-9_]{1,24}$/i.test(String(x)) ? String(x) : null;
const url = x => { const s = str(x, 300); if (!s) return ""; try { const u = new URL(s); return u.protocol === "https:" ? u.href : ""; } catch (e) { return ""; } };
const date = x => /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(String(x || "")) ? String(x) : "";
/* Whitelist every field: unknown keys are dropped, lengths capped, types forced. */
export function cleanContent(c) {
  c = c && typeof c === "object" ? c : {}; const d = CONTENT_DEFAULT, out = JSON.parse(JSON.stringify(d));
  const a = c.announce || {}; out.announce = { on: !!a.on, text: str(a.text, 280), level: ["info", "warn", "alert"].includes(a.level) ? a.level : "info", until: date(a.until), link: url(a.link) };
  const m = c.maintenance || {}; out.maintenance = { on: !!m.on, text: str(m.text, 280) };
  for (const [k, v] of Object.entries(c.chapters || {}).slice(0, 40)) { const k2 = id(k); if (!k2 || !v) continue; const e = { hidden: !!v.hidden, alert: str(v.alert, 200) }; if (e.hidden || e.alert) out.chapters[k2] = e; }
  for (const [k, v] of Object.entries(c.notes || {}).slice(0, 200)) { if (!/^[a-z0-9_]{1,24}:[a-z0-9_]{1,24}$/i.test(k)) continue; const t = str(v, 300); if (t) out.notes[k] = t; }
  for (const f of Object.keys(d.flags)) out.flags[f] = c.flags && typeof c.flags[f] === "boolean" ? c.flags[f] : d.flags[f];
  out.featured = id(c.featured) || "";
  out.hazards = (Array.isArray(c.hazards) ? c.hazards : []).slice(0, 60).map(h => ({
    id: id(h.id) || b64u(randomBytes(6)).replace(/[-_]/g, "x"), lat: +(+h.lat).toFixed(5), lon: +(+h.lon).toFixed(5),
    text: str(h.text, 140), kind: ["closure", "gravel", "works", "police", "info"].includes(h.kind) ? h.kind : "info", until: date(h.until)
  })).filter(h => h.lat > 29 && h.lat < 33.6 && h.lon > 34 && h.lon < 36.2 && h.text);
  return out;
}
export async function getContent() { return Object.assign({}, CONTENT_DEFAULT, (await store().get("content", { type: "json" })) || {}); }
/* What riders get: expired announcements and hazards are dropped on the way out. */
export function publicContent(c) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());
  const live = u => !u || u.slice(0, 10) >= today;
  return Object.assign({}, c, { announce: c.announce.on && live(c.announce.until) ? c.announce : { on: false }, hazards: c.hazards.filter(h => live(h.until)) });
}

/* Message history riders can reopen from the bell: announcements and push broadcasts, newest last. */
export async function addHistory(item) {
  const s = store(); const h = (await s.get("history", { type: "json" })) || [];
  h.push(Object.assign({ id: b64u(randomBytes(6)), t: Date.now() }, item)); await s.setJSON("history", h.slice(-40));
}
export async function getHistory() { return (await store().get("history", { type: "json" })) || []; }
