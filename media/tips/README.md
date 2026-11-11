# Safety tips series: "הרונין לא ממהר"

The YouTube channel description promises "◆ טיפים לרכיבה בטוחה ומחושבת". This folder is that promise:
12 ready episodes of 37–42 s, one per week, for YouTube Shorts, Instagram Reels, TikTok and the Facebook page.

## Files
- `episodes.py`: the source. Every episode, scene, narration line, on-screen text, illustration brief and source lives here.
  Edit only this file, then run `python3 media/tips/build.py`.
- `episodes.json`: generated. Scene timings (`t0`/`t1`), narration, text, art brief, sources, per-channel CTA links. The video code reads this.
- `pages/NN-slug.md`: generated. One readable page per episode (scenes table, caption, hashtags, links, sources).
- `voiceover/NN-slug.txt`: generated. Narration only, one paragraph per scene, ready for a TTS tool or for Eli to record.

## The series idea
- Name: **הרונין לא ממהר**. Every episode ends on the same line: "הרונין לא ממהר. הוא חוזר הביתה."
- One tip, one picture, one number where a real number exists. No scare footage, no crashes, no speed.
- The first second is the hook (a short, surprising sentence on screen and in the voice). Viewers decide in 1–2 seconds.
- The app appears only where it genuinely helps with the tip (an `app` scene, 5–8 s), never as an ad break.
  Safety features are shown as free (they are never paywalled); Pro features carry the Pro badge.
- Every number has a source in the episode page. If a fact can't be sourced, it becomes advice, not a number.

## Look
- 1080×1920, 30 fps, H.264. A 16:9 cut is not needed for Shorts; use the same file everywhere.
- Background: the app's dark map navy. Lines and road in the brand blue (#4F8BFF on dark), hazards and highlights in sun-orange,
  danger in a muted red, only in diagrams. Same palette as `media/brand/`.
- Type: Karantina for the big headline and numbers (as in the logo), Assistant (body font of the app) for everything else.
  Hebrew RTL, right-aligned, max two lines of on-screen text, safe zone: keep text out of the bottom 380 px and the right 140 px
  (platform buttons and captions sit there).
- Illustrations: flat vector pictograms, top-down roads (like the map), a faceless ronin rider silhouette. Drawn in code (SVG → PNG
  frames), not AI-generated images: consistent, sharp, no brand or logo mistakes. Each scene's `art` field is the brief.
- Motion: one simple move per scene (a line draws, a number counts up, a cone sweeps). Cuts on the scene boundaries in the JSON.
- `app` scenes: real screen captures of blueronin.app (phone, dark theme, demo route), never a speedometer showing a high speed.
- Captions: the narration is also burnt in as small subtitles above the safe zone (most people watch muted).

## Voice
- Hebrew, calm, low, unhurried, about 2.3 words a second (the JSON's `vo_words` / `total` stays near that).
- Options: Eli records on the phone in a quiet room (best and most personal; the voice can stay anonymous), or a Hebrew TTS voice
  (ElevenLabs, Azure `he-IL`, Google Cloud `he-IL`; check the current terms for commercial use). Keep the same voice for the whole series.
- Music: one quiet ambient track from the platform library or a royalty-free source, -24 dB under the voice. Note the source in the issue.

## Weekly routine (about 30 minutes of Eli's time)
1. **Sunday:** open the GitHub issue for the episode (label `video`, title `Tips NN: <title>`), link the page in `pages/`.
2. **Sunday:** voice. Record `voiceover/NN-slug.txt` (one take per paragraph) or generate it with TTS. Save as `media/tips/audio/NN-slug.m4a`
   (audio is not committed; keep it in Drive).
3. **Monday, in Claude Code:** paste the prompt below. Claude draws the key frames first; Eli approves or comments; then the full render.
4. **Monday:** screen captures for the `app` scene if the episode has one (or ask Claude to film the app with the demo route).
5. **Tuesday 19:30:** upload. Same video to YouTube Shorts, Instagram Reels (shared to the Facebook page), TikTok. Caption and hashtags
   from the page; each channel's link from "קישור לכל ערוץ" goes in the comment / bio / link sticker.
6. **Thursday 18:00:** the WhatsApp weekend brief links that week's episode.
7. **Next Monday:** write the 48-hour numbers into the issue (views, average watch %, follows, `?src=` visits from admin), then close it.

### Prompt for Claude Code
```
Make tips episode NN from media/tips/episodes.json, following media/tips/README.md (look, safe zone, fonts, palette)
and the video-making skill. Voice: media/tips/audio/NN-slug.m4a (fit scene durations to the audio if it runs longer).
App scene: <path to screen capture, or "film blueronin.app with the demo route">.
First show me one key frame per scene, then render to media/renders/tips-NN-slug.mp4 with burnt-in Hebrew subtitles.
```

## Calendar
Episodes follow the season: rain and cold in winter, group riding before the launch ride, heat in spring. Dates are in `episodes.py`.

| # | Date | Episode | CTA |
|---|---|---|---|
| 1 | 2026-11-24 | גשם ראשון | WhatsApp |
| 2 | 2026-12-01 | הנהג שלא ראה אותך | waitlist |
| 3 | 2026-12-08 | קור ורטיבות | WhatsApp |
| 4 | 2026-12-15 | בלימת חירום | waitlist |
| 5 | 2026-12-22 | בעלי חיים בלילה | WhatsApp |
| 6 | 2026-12-29 | מבט מוביל בפניות | waitlist |
| 7 | 2027-01-05 | לפני שיוצאים | waitlist |
| 8 | 2027-01-12 | השמש בעיניים | waitlist |
| 9 | 2027-01-19 | רוכבים חדשים | waitlist |
| 10 | 2027-01-26 | פקקים ושוליים | waitlist |
| 11 | 2027-03-09 | רכיבה בקבוצה (before the 13.3 launch ride) | waitlist |
| 12 | 2027-04-27 | חום, שתייה וציוד | WhatsApp |

The February gap and the weeks after episode 11 are for launch content and for repeats: a winning episode can be re-cut
(new hook, same body) and posted again after 6–8 weeks.

## Rules that keep the channel safe
- No real crash footage, no riding over the limit, no wheelies, no number plates or faces of other people.
- No medical advice beyond "stop, shade, drink". No legal advice beyond what the source says.
- When a source changes (a new Or Yarok or הרלב״ד report), update the number in `episodes.py` and rebuild before the episode goes out.
- Comments asking for help in an emergency: answer with 101 (מד״א) and 100 (משטרה), not with app features.

## Main sources
הרלב״ד 2025 report and trends bulletin, Or Yarok, IIHS (left-turn crashes 2023, ABS 2013 and 2023), the Hurt Report (USC, 1981),
Israeli road-safety coverage in ynet, Walla and ice. Full links per episode in `pages/`.
