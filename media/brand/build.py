#!/usr/bin/env python3
"""Brand assets for the social channels, drawn as vectors from the app icon (site/icons/icon-512.png):
same sun, road and night sky, rendered sharp at each platform's size. Needs rsvg-convert and the
Karantina + Assistant fonts. Usage: python3 media/brand/build.py OUT_DIR  (renders stay out of git)."""
import subprocess, sys, os
OUT = sys.argv[1] if len(sys.argv) > 1 else "out"
os.makedirs(OUT, exist_ok=True)
DEFS = """<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0A111E"/><stop offset=".45" stop-color="#0A111E"/><stop offset="1" stop-color="#2E2321"/></linearGradient>
<radialGradient id="glow" cx=".5" cy="1.12" r=".72"><stop offset="0" stop-color="#7A4A28" stop-opacity=".95"/><stop offset=".55" stop-color="#5A3A26" stop-opacity=".5"/><stop offset="1" stop-color="#2E2321" stop-opacity="0"/></radialGradient>
</defs>"""
ROAD = "M58 331 C95 345 108 382 142 380 C188 377 238 262 300 262 C352 262 396 346 452 362"
def mark(scale=1.0, cx=256, cy=256):
    """the sun + road, on a 512 grid, scaled around its centre and moved to (cx, cy)"""
    return f"""<g transform="translate({cx} {cy}) scale({scale}) translate(-256 -256)">
<circle cx="317" cy="184" r="66" fill="#FFA24A"/>
<path d="{ROAD}" fill="none" stroke="#0A111E" stroke-width="56"/>
<path d="{ROAD}" fill="none" stroke="#5C8DFF" stroke-width="38"/></g>"""
def bg(w, h): return f'<rect width="{w}" height="{h}" fill="url(#sky)"/><rect width="{w}" height="{h}" fill="url(#glow)"/>'
def svg(w, h, body, vb=None): return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="{vb or f"0 0 {w} {h}"}">{DEFS}{body}</svg>'
def render(name, s, w, h):
    p = os.path.join(OUT, name); open(p + ".svg", "w").write(s)
    subprocess.run(["rsvg-convert", "-w", str(w), "-h", str(h), p + ".svg", "-o", p + ".png"], check=True); os.remove(p + ".svg"); print(p + ".png")
# Profile pictures: every platform crops to a circle, so the mark sits inside the central 80%.
prof = svg(512, 512, bg(512, 512) + mark(0.84, 256, 262))
for name, px in [("profile-instagram-1080", 1080), ("profile-youtube-800", 800), ("profile-whatsapp-640", 640), ("profile-tiktok-1080", 1080), ("profile-facebook-1080", 1080), ("profile-master-2048", 2048)]:
    render(name, prof, px, px)
WORD = lambda x, y, size, anchor="middle": f'<text x="{x}" y="{y}" text-anchor="{anchor}" font-family="Karantina" font-weight="700" font-size="{size}" fill="#E6ECF4" letter-spacing="{size*0.02:.1f}">BLUE <tspan fill="#5C8DFF">RONIN</tspan></text>'
SLOGAN = lambda x, y, size, anchor="middle": f'<text x="{x}" y="{y}" text-anchor="{anchor}" direction="rtl" unicode-bidi="embed" font-family="Assistant" font-weight="600" font-size="{size}" fill="#B9C6D8">כל הארץ. שני גלגלים. דרך אחת.</text>'
# YouTube banner 2560x1440; only the central 1546x423 shows on every device, so everything lives there.
yt = bg(2560, 1440) + mark(0.74, 1280 - 520, 716) + WORD(1280 + 150, 742, 250) + SLOGAN(1280 + 150, 836, 62)
render("banner-youtube-2560x1440", svg(2560, 1440, yt), 2560, 1440)
# Facebook cover 1640x624 (2x of 820x312); phones crop the sides, so content stays in the central 1100.
fb = bg(1640, 624) + mark(0.62, 820 - 400, 318) + WORD(820 + 130, 338, 190) + SLOGAN(820 + 130, 412, 46)
render("cover-facebook-1640x624", svg(1640, 624, fb), 1640, 624)
# Story-highlight / video cover base 1080x1920 and a square post base, for later templates.
render("cover-vertical-1080x1920", svg(1080, 1920, bg(1080, 1920) + mark(1.25, 540, 800) + WORD(540, 1290, 210) + SLOGAN(540, 1380, 56)), 1080, 1920)
# Link preview (WhatsApp, Facebook, Telegram) for /join and /go: 1200x630, copied to site/icons/og.png.
render("og-1200x630", svg(1200, 630, bg(1200, 630) + mark(0.6, 600 - 330, 318) + WORD(600 + 110, 336, 170) + SLOGAN(600 + 110, 408, 42)), 1200, 630)
