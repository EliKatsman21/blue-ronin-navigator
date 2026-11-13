/* /go — one link for every social bio. Counts which channel the visit came from (?src=ig|yt|wa|wa-brief|tt|fb):
   a number per channel, nothing about the visitor. Once per browser session. */
(() => {
  "use strict";
  const SRCS = ["ig", "yt", "wa", "wa-brief", "tt", "fb", "qr", "press"], s = new URLSearchParams(location.search).get("src");
  if (!SRCS.includes(s)) return;
  const j = document.getElementById("gJoin"), a = document.getElementById("gApp");
  if (j) j.href = "join?src=" + s; if (a) a.href = "./?source=go-" + s;
  try { if (sessionStorage.getItem("brn:go")) return; sessionStorage.setItem("brn:go", "1"); } catch (e) { }
  try { fetch("/api/join", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ hit: "go", src: s }), keepalive: true }).catch(() => { }); } catch (e) { }
})();
