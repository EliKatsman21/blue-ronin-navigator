/* Shared helpers for live location sharing and emergency contacts. */
import { getStore } from "@netlify/blobs";
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
export const liveStore = () => getStore({ name: "brn-live", consistency: "strong" });
export const sosStore = () => getStore({ name: "brn-sos", consistency: "strong" });
export const rid = n => randomBytes(n).toString("base64url").replace(/[-_]/g, "x");
export const hashKey = k => createHash("sha256").update(String(k)).digest("hex");
export const keyOk = (k, h) => { if (typeof k !== "string" || !h) return false; const a = Buffer.from(hashKey(k)), b = Buffer.from(h); return a.length === b.length && timingSafeEqual(a, b); };
export const clean = (x, n) => String(x ?? "").replace(/[\u0000-\u001F\u007F‪-‮⁦-⁩<>]/g, "").trim().slice(0, n);
export const okId = (x, n = 40) => typeof x === "string" && /^[A-Za-z0-9]{8,40}$/.test(x) && x.length <= n;
export const inIL = (lat, lon) => Number.isFinite(lat) && Number.isFinite(lon) && lat > 29 && lat < 33.6 && lon > 34 && lon < 36.2;
export async function body(req, max = 8000) { const t = await req.text(); if (t.length > max) throw Object.assign(new Error("too large"), { status: 413 }); return JSON.parse(t || "{}"); }
export const J = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
