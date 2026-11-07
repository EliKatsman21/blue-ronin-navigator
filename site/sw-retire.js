/* Served as /sw.js on the retired address (blueronin-north-map.netlify.app) only, see netlify.toml.
   A phone that still has the old app installed picks this up on its next update check: it clears the old
   caches, removes itself and sends the open window to the permanent address. Nothing on blueronin.app uses it. */
const HOME = "https://blueronin.app";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil((async () => {
  try { for (const k of await caches.keys()) await caches.delete(k); } catch (err) { }
  try { await self.registration.unregister(); } catch (err) { }
  try { for (const c of await self.clients.matchAll({ type: "window", includeUncontrolled: true })) { const u = new URL(c.url); c.navigate(HOME + u.pathname + u.search + u.hash).catch(() => { }); } } catch (err) { }
})()));
