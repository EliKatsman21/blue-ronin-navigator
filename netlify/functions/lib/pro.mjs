/* Blue Ronin Pro entitlements. A Pro pass is a small signed token kept on the rider's device:
   base64url(JSON {cid, exp, src, code?}) + "." + HMAC. Sources: a one-time 7-day trial per device,
   or a code the admin issues (founders, beta testers, giveaways). Real payments (Play Billing / Stripe)
   will mint the same token later, so the app doesn't change when billing opens. */
import { getStore } from "@netlify/blobs";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { secret, b64u } from "./admin.mjs";

export const proStore = () => getStore({ name: "brn-pro", consistency: "strong" });
const fromB64u = s => Buffer.from(String(s).replace(/-/g, "+").replace(/_/g, "/"), "base64");
export const TRIAL_DAYS = 7;
export const cidOk = c => /^[0-9a-f]{16}$/.test(String(c || ""));

export async function sign(p) {
  const body = b64u(JSON.stringify(p));
  return body + "." + b64u(createHmac("sha256", await secret()).update("pro|" + body).digest());
}
export async function verify(tok) {
  const [body, sig] = String(tok || "").split("."); if (!body || !sig) return null;
  const want = Buffer.from(b64u(createHmac("sha256", await secret()).update("pro|" + body).digest())), got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  let p; try { p = JSON.parse(fromB64u(body).toString()); } catch (e) { return null; }
  if (p.code) { const codes = (await proStore().get("codes", { type: "json" })) || {}; if (!codes[p.code] || codes[p.code].revoked) return null; }
  return p;
}
const ALPH = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const newCode = () => "BR-" + Array.from(randomBytes(8), (b, i) => ALPH[b % ALPH.length] + (i === 3 ? "-" : "")).join("");
