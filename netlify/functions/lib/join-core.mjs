/* Waitlist rules with no dependencies, so the unit tests can import them directly. */
import { randomInt } from "node:crypto";
export const NEED = 3; // friends for a month of Pro
export const SRCS = ["ig", "yt", "wa", "tt", "fb", "app", "qr", "press", "friend", "site"];
export const cleanSrc = s => SRCS.includes(s) ? s : "site";
/* lower-cased, trimmed, plain address or null */
export function cleanEmail(x) {
  const e = String(x ?? "").trim().toLowerCase();
  if (e.length < 6 || e.length > 254 || /[\s<>"'\\,;]/.test(e)) return null;
  return /^[a-z0-9._%+-]{1,64}@[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(e) && !e.includes("..") ? e : null;
}
export const cleanName = x => String(x ?? "").replace(/[\u0000-\u001F\u007F<>‪-‮⁦-⁩]/g, "").trim().slice(0, 40);
const ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I/L
export const newRef = () => Array.from({ length: 6 }, () => ALPHA[randomInt(ALPHA.length)]).join("");
export const isRef = c => typeof c === "string" && /^[A-HJKMNP-Z2-9]{6}$/.test(c);
