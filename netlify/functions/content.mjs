/* GET /api/content — the admin-managed layer every rider's app applies on top of the built-in data:
   announcement, maintenance notice, hidden chapters and chapter alerts, stop-note overrides,
   feature switches, the featured ride and road hazards. Read-only for everyone. */
import { getContent, publicContent, getHistory } from "./lib/admin.mjs";
export default async () => {
  const c = publicContent(await getContent()); c.history = (await getHistory()).slice(-30);
  return Response.json(c, { headers: { "cache-control": "no-cache", "netlify-cdn-cache-control": "public, s-maxage=5" } });
};
export const config = { path: "/api/content" };
