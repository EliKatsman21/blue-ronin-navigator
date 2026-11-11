// Tiny static server for site/ used by the e2e tests. /api/* answers 503 so the app
// runs its offline / degraded paths (the real functions only run on Netlify).
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";
const SITE = fileURLToPath(new URL("../site/", import.meta.url));
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".mp3": "audio/mpeg", ".svg": "image/svg+xml", ".css": "text/css" };
const port = Number(process.env.PORT || 4173);
createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (path.startsWith("/api/") || path.startsWith("/.netlify/")) { res.writeHead(503, { "content-type": "application/json" }); return res.end('{"error":"offline test server"}'); }
  const file = normalize(join(SITE, path.endsWith("/") ? path + "index.html" : path));
  if (!file.startsWith(SITE)) { res.writeHead(403); return res.end(); }
  try { const body = await readFile(file); res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream" }); res.end(body); }
  catch { res.writeHead(404); res.end("not found"); }
}).listen(port, () => console.log(`site on http://localhost:${port}`));
