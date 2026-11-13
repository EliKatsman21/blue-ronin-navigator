/* The weekend brief fan-out, handed from the scheduled function to a background function (perf round 2.8).
   Scheduled functions stop after 30 s (Netlify docs, "Scheduled functions have a 30 second execution limit");
   1,000 subscribers at 20 in flight are about 10-15 s on a good day but up to ~250 s if push services are slow
   (5 s timeout each), so the sending runs in brief-send-background (up to 15 minutes).

   The scheduled function computes the brief once, stores it as a one-time job job:<32 hex> in the "brn" store and
   POSTs only that id to the background function. The background function takes the job (read, then delete) and
   sends. Nobody outside can start a broadcast: an id is 128 random bits, known only to the server, used once,
   and older than JOB_TTL it is ignored. If the background function answers with a definite status other than 202,
   the scheduled function takes the job itself and sends inline (what it did before). If the trigger fetch THROWS,
   the background function may already have the request (a reset on the response), so nothing is sent inline: the
   job is left for it, and the result says so (unsure), to be logged (L1, security review 2026-11-13 final: a brief
   is never sent twice). Pure: store, trigger and sender are passed in. */
import { randomBytes } from "node:crypto";
import { pickMessage, cleanChap } from "./brief-chapter.mjs";

export const JOB_TTL = 36e5;
export const MODES = { friday: { pref: "friday", tag: "brief-" }, saturday: { pref: "saturday", tag: "morning-" } };
const ID = /^[a-f0-9]{32}$/;

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
/* trigger(id) -> Response (202 = the background function took it); send(job) -> the sendAll result */
export async function dispatchBrief({ store, b, mode, now, trigger, send }) {
  const id = await queueJob(store, b, mode, now);
  let status = 0; try { status = (await trigger(id)).status; } catch (e) { return { queued: true, unsure: true }; }
  if (status === 202) return { queued: true };
  const job = await takeJob(store, id, now);
  return job ? { queued: false, ...(await send(job)) } : { queued: true }; /* gone = the background function has it */
}
