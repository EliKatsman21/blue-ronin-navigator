/* The weekend brief fan-out, handed from the scheduled function to a background function (perf round 2.8).
   Scheduled functions stop after 30 s (Netlify docs, "Scheduled functions have a 30 second execution limit");
   1,000 subscribers at 20 in flight are about 10-15 s on a good day but up to ~250 s if push services are slow
   (5 s timeout each), so the sending runs in brief-send-background (up to 15 minutes).

   The scheduled function computes the brief once, stores it as a one-time job job:<32 hex> in the "brn" store and
   POSTs only that id to the background function. The background function takes the job (read, then delete) and
   sends. Nobody outside can start a broadcast: an id is 128 random bits, known only to the server, used once,
   and older than JOB_TTL it is ignored.

   Hand-off outcomes (L1 + R1, security review and QA, 2026-11-13 final). The job blob is the lock: whoever takes it
   (read, then delete) sends; a job is never sent twice by this code.
   - A definite status other than 202: the scheduled function takes the job back at once and sends inline.
   - 202, or the trigger fetch THREW (the background function may already have the request): the scheduled function
     waits CONFIRM_MS and looks. Job gone = the background function took it. Job still there = it never ran: the
     scheduled function takes the job back and sends inline, stopping new sends at its deadline (within the 30 s).
   - Both log a "sent" line with counts (ok / gone / fail), and the watch record (ops store, key "brief") lets the
     monitor open an incident when a brief was queued but no send was recorded within WATCH_MS.
   Pure: store, trigger, sender, clock and wait are passed in. */
import { randomBytes } from "node:crypto";
import { pickMessage, cleanChap } from "./brief-chapter.mjs";

export const JOB_TTL = 36e5, CONFIRM_MS = 8000, INLINE_DEADLINE_MS = 26000, WATCH_MS = 20 * 6e4;
export const MODES = { friday: { pref: "friday", tag: "brief-", name: "תדריך שישי" }, saturday: { pref: "saturday", tag: "morning-", name: "עדכון שבת בבוקר" } };
const ID = /^[a-f0-9]{32}$/;
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* each rider gets the brief for the built-in chapter they chose (best chapter when none or unknown) */
export const briefPayload = job => rec => { const m = pickMessage(job.messages, cleanChap(rec.chap)); return { title: m.title, body: m.body, tag: MODES[job.mode].tag + job.sat, url: "./#brief" }; };

export async function queueJob(store, b, mode, now) {
  const id = randomBytes(16).toString("hex");
  await store.setJSON("job:" + id, { mode, messages: b.messages, sat: b.sat, title: b.title, t: now });
  return id;
}
/* read and delete: a job runs once. null for a bad id, a missing, expired or malformed job */
export async function takeJob(store, id, now) {
  if (typeof id !== "string" || !ID.test(id)) return null;
  const k = "job:" + id, j = await store.get(k, { type: "json" }).catch(() => null); if (!j) return null;
  await store.delete(k);
  return MODES[j.mode] && j.messages && j.messages.best && now - j.t <= JOB_TTL ? j : null;
}
/* trigger(id) -> Response (202 = the background function accepted it); send(job, deadline) -> the sendAll result.
   start = when the scheduled run began (the deadline counts from it). Result: { queued, how, ...counts }
   how: "background" (taken by it) | "inline" (refused hand-off) | "fallback" (accepted or unsure, never ran) | "lost" */
export async function dispatchBrief({ store, b, mode, now, trigger, send, start = now, clock = Date.now, wait = sleep, confirmMs = CONFIRM_MS }) {
  const id = await queueJob(store, b, mode, now), deadline = start + INLINE_DEADLINE_MS;
  let status = 0, threw = false; try { status = (await trigger(id)).status; } catch (e) { threw = true; }
  if (!threw && status !== 202) {
    const job = await takeJob(store, id, now);
    return job ? { queued: false, how: "inline", status, ...(await send(job, deadline)) } : { queued: true, how: "background" };
  }
  await wait(Math.max(0, Math.min(confirmMs, deadline - 2000 - clock()))); /* never past the scheduled limit */
  const job = await takeJob(store, id, clock()); /* null = the background function took it (or is sending it) */
  if (!job) return { queued: true, how: "background", unsure: threw || undefined };
  return { queued: false, how: "fallback", threw: threw || undefined, ...(await send(job, deadline)) };
}

/* the watch record in the ops store: queued by the scheduled run, sent by whoever sent it */
export async function noteQueued(ops, mode, now) { await ops.setJSON("brief", { mode, queued: now, sent: 0 }).catch(() => { }); }
export async function noteSent(ops, mode, now, r, queuedAt) {
  await ops.setJSON("brief", { mode, queued: queuedAt || now, sent: now, n: { sent: r.sent | 0, gone: r.gone | 0, failed: r.failed | 0, cut: r.cut | 0, total: r.total | 0 } }).catch(() => { });
}
/* the ops-log line for a brief that went out */
export const sentLine = (mode, r) => `${MODES[mode].name} נשלח: ${r.sent | 0} הגיעו, ${r.gone | 0} הוסרו (לא קיימים), ${r.failed | 0} נכשלו, מתוך ${r.total | 0}${r.cut ? ` · ${r.cut} לא נשלחו (נגמר הזמן)` : ""}`;
/* the monitor's check: a brief queued more than WATCH_MS ago with no send recorded. Looks back one day at most. */
export function briefWatch(rec, now) {
  if (!rec || !rec.queued || rec.sent || now - rec.queued < WATCH_MS || now - rec.queued > 864e5) return { ok: true, detail: rec && rec.sent ? `${MODES[rec.mode] ? MODES[rec.mode].name : "תדריך"} האחרון נשלח ל־${(rec.n && rec.n.sent) | 0}` : "אין תדריך ממתין" };
  return { ok: false, detail: `${MODES[rec.mode] ? MODES[rec.mode].name : "תדריך"} הועבר לשליחה לפני ${Math.round((now - rec.queued) / 6e4)} דק׳ ולא נרשמה שליחה` };
}
