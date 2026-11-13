/* Media that rides along with a rider's feedback: up to PHOTOS_MAX photos (jpeg/webp, made small on the phone)
   and one voice note. Checked by magic bytes, not by what the client claims. Pure: no storage here.
   Keys in the store are <id>-p, <id>-p1 … <id>-p3 for photos (the first keeps the old key "p", so older
   reports and the admin inbox stay valid) and <id>-a for the voice note. */
export const IMG_MAX = 600 * 1024, IMG_TOTAL = 1400 * 1024, AUD_MAX = 700 * 1024, PHOTOS_MAX = 4;
export const BODY_MAX = 2_900_000; // characters of JSON: 4 photos within IMG_TOTAL + a voice note, base64
export const MEDIA_KEY = /^(p[1-3]?|a)$/;
export const photoKey = i => i === 0 ? "p" : "p" + i;
export const sniff = buf => {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.slice(0, 4).toString() === "RIFF" && buf.slice(8, 12).toString() === "WEBP") return "image/webp";
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return "audio/webm";
  if (buf.slice(4, 8).toString() === "ftyp") return "audio/mp4";
  if (buf.slice(0, 4).toString() === "OggS") return "audio/ogg";
  return null;
};
/* L6, a second line behind the phone (which re-encodes every photo on a canvas, so it never sends EXIF):
   drop the JPEG APP1 (Exif / XMP: GPS, camera serial) and APP13 (IPTC) segments before a photo is stored.
   Returns the cleaned buffer; null when the file holds EXIF but its segments cannot be walked (refused). */
export function stripJpegMeta(buf) {
  if (!(buf[0] === 0xff && buf[1] === 0xd8)) return buf;
  const out = [buf.subarray(0, 2)]; let i = 2;
  while (i + 1 < buf.length) {
    if (buf[i] !== 0xff) break;
    const mk = buf[i + 1];
    if (mk === 0xff) { i++; continue; } /* fill byte */
    if (mk === 0xda || mk === 0xd9) { out.push(buf.subarray(i)); return Buffer.concat(out); } /* image data: copy the rest */
    if (mk === 0x01 || (mk >= 0xd0 && mk <= 0xd7)) { out.push(buf.subarray(i, i + 2)); i += 2; continue; }
    if (i + 3 >= buf.length) break;
    const len = (buf[i + 2] << 8) | buf[i + 3]; if (len < 2 || i + 2 + len > buf.length) break;
    if (mk !== 0xe1 && mk !== 0xed) out.push(buf.subarray(i, i + 2 + len));
    i += 2 + len;
  }
  /* not a walkable JPEG: keep it only if there is nothing like EXIF / XMP / IPTC inside */
  return /Exif\x00|http:\/\/ns\.adobe\.com\/xap|Photoshop 3\.0/.test(buf.toString("latin1")) ? null : buf;
}

/* Headers for serving a stored file to the admin (security review L3): our own content type, never sniffed,
   no script can run, shown inline under a fixed file name, and only to our own origin. */
const EXT = { "image/jpeg": "jpg", "image/webp": "webp", "audio/webm": "webm", "audio/mp4": "m4a", "audio/ogg": "ogg" };
export const mediaHeaders = ct => {
  const type = EXT[ct] ? ct : "application/octet-stream";
  return { "content-type": type, "content-disposition": `inline; filename="report.${EXT[ct] || "bin"}"`, "cross-origin-resource-policy": "same-origin",
    "cache-control": "private, no-store", "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'; sandbox" };
};
const decode = (s, max) => { if (typeof s !== "string" || !s) return null; const b = Buffer.from(s.replace(/^data:[^,]*,/, ""), "base64"); return b.length && b.length <= max ? b : null; };
/* body.photos (array) or the older body.photo (one). Returns { items: [{ k, buf, ct }] } or { error }. */
export function collectMedia(body) {
  const raw = Array.isArray(body.photos) ? body.photos : body.photo ? [body.photo] : [];
  if (raw.length > PHOTOS_MAX) return { error: `עד ${PHOTOS_MAX} תמונות בדיווח` };
  const items = []; let total = 0;
  for (const s of raw) {
    let buf = decode(s, IMG_MAX); if (!buf) return { error: "תמונה גדולה מדי" };
    const ct = sniff(buf); if (!ct || !ct.startsWith("image/")) return { error: "התמונה לא נתמכת" };
    if (ct === "image/jpeg") { const c = stripJpegMeta(buf); if (!c) return { error: "התמונה לא נתמכת" }; buf = c; }
    total += buf.length; if (total > IMG_TOTAL) return { error: "התמונות גדולות מדי" };
    items.push({ k: photoKey(items.length), buf, ct });
  }
  if (body.voice) {
    const buf = decode(body.voice, AUD_MAX); if (!buf) return { error: "ההקלטה ארוכה מדי" };
    const ct = sniff(buf); if (!ct || !ct.startsWith("audio/")) return { error: "ההקלטה לא נתמכת" };
    items.push({ k: "a", buf, ct });
  }
  return { items };
}
