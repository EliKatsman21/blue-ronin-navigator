/* Blue Ronin Navigator — service worker: offline shell, cached map tiles, network-first live data. */
const SHELL = "brn-shell-v20", TILES = "brn-tiles-v1", DATA = "brn-data-v1";
const SHELL_FILES = ["./", "index.html", "guard.js", "intro.js", "app.js", "bikes.js", "logic.js", "geo.js", "data.js", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/badge-96.png", "sounds/ignition.mp3", "accessibility.html", "vendor/maplibre-gl/4.7.1/maplibre-gl.js", "vendor/maplibre-gl/4.7.1/maplibre-gl.css", "vendor/suncalc/1.9.0/suncalc.js"];
const TILE_HOSTS = ["tiles.openfreemap.org", "s3.amazonaws.com"];
const LIB_HOSTS = ["unpkg.com", "cdnjs.cloudflare.com", "fonts.googleapis.com", "fonts.gstatic.com"];
const DATA_HOSTS = ["api.open-meteo.com", "overpass-api.de", "overpass.kumi.systems", "router.project-osrm.org", "api.rainviewer.com"];

self.addEventListener("install", e => { e.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_FILES)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => ![SHELL, TILES, DATA].includes(k)).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

const cacheFirst = async (req, name) => {
  const c = await caches.open(name); const hit = await c.match(req, { ignoreVary: true }); if (hit) return hit;
  const res = await fetch(req); if (res.ok || res.type === "opaque") c.put(req, res.clone()); return res;
};
const networkFirst = async (req, name) => {
  const c = await caches.open(name);
  try { const res = await fetch(req); if (res.ok) c.put(req, res.clone()); return res; }
  catch (e) { const hit = await c.match(req); if (hit) return hit; throw e; }
};
/* App shell: always try the network first (so every deploy reaches riders on the next open), fall back to cache offline. */
const shellFirst = async req => {
  const c = await caches.open(SHELL);
  try { const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 3500); const res = await fetch(req.url, { signal: ctl.signal, cache: "no-cache", credentials: "same-origin" }); clearTimeout(t); if (res.ok) c.put(req, res.clone()); return res; }
  catch (e) { const hit = await c.match(req, { ignoreSearch: true }); if (hit) return hit; if (req.mode === "navigate") { const idx = await c.match("index.html"); if (idx) return idx; } throw e; }
};
const staleWhileRevalidate = async (req, name) => {
  const c = await caches.open(name); const hit = await c.match(req);
  const net = fetch(req).then(res => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => hit);
  return hit || net;
};

self.addEventListener("fetch", e => {
  const req = e.request; if (req.method !== "GET") return;
  const u = new URL(req.url);
  if (u.hostname === "tiles.openfreemap.org" && (u.pathname.startsWith("/styles/") || /^\/planet\/?$/.test(u.pathname))) return e.respondWith(staleWhileRevalidate(req, TILES));
  if (TILE_HOSTS.includes(u.hostname)) { if (u.hostname === "s3.amazonaws.com" && !u.pathname.startsWith("/elevation-tiles-prod/")) return; return e.respondWith(cacheFirst(req, TILES)); }
  if (LIB_HOSTS.includes(u.hostname)) return e.respondWith(cacheFirst(req, SHELL));
  if (DATA_HOSTS.includes(u.hostname)) return e.respondWith(networkFirst(req, DATA));
  /* vendored libraries: the path carries the version, so the cached copy is always right (no revalidation per boot) */
  if (u.origin === self.location.origin && u.pathname.startsWith("/vendor/")) return e.respondWith(cacheFirst(req, SHELL));
  if (u.origin === self.location.origin) { if (u.pathname.startsWith("/api/") || u.pathname.startsWith("/admin")) return; return e.respondWith(shellFirst(req)); }
});

/* Push: Shabbat briefing and Saturday dawn update. */
self.addEventListener("push", e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || "Blue Ronin", {
    body: d.body || "", tag: d.tag || "brief", renotify: true, dir: "rtl", lang: "he",
    icon: "icons/icon-192.png", badge: "icons/badge-96.png", data: { url: d.url || "./" },
    requireInteraction: !!d.sos, vibrate: d.sos ? [800, 250, 800, 250, 800, 250, 1200] : undefined, silent: false
  }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const target = new URL(e.notification.data && e.notification.data.url || "./", self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(ws => {
    for (const w of ws) if (w.url.startsWith(self.registration.scope)) { w.focus(); return w.navigate ? w.navigate(target) : null; }
    return self.clients.openWindow(target);
  }));
});
