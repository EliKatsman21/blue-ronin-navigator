/* Waitlist ("רשימת ההמתנה") shared by /api/join and the admin API.
   One blob per signup (no read-modify-write races):
     e:<emailHash>            { t, email, name, code, ref, src, n }
     c:<code>                 { h: emailHash }
     r:<refCode>:<emailHash>  { t }   one marker per friend who joined through a rider's link
     ip:<ipHash>:<t>          {}      throttle, pruned after a day
   The email is the only personal detail. It is kept to send the launch invitation and nothing else. */
import { getStore } from "@netlify/blobs";
import { createHash } from "node:crypto";
import { secret } from "./admin.mjs";
export const joinStore = () => getStore({ name: "brn-join", consistency: "strong" });
export * from "./join-core.mjs";
export async function emailHash(email) { return createHash("sha256").update((await secret()) + "|join|" + email).digest("hex").slice(0, 24); }
export async function count(prefix) { try { return (await joinStore().list({ prefix })).blobs.length; } catch (e) { return 0; } }
export const refsOf = code => count(`r:${code}:`);
