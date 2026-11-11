# media: video and content production

Everything needed to make Blue Ronin videos and store assets, except the heavy files.

- `scripts/`: video scripts and voice-over text (one Markdown file per video: `YYYY-MM-slug.md`).
- `storyboards/`: shot-by-shot plans, timing, on-screen text (Hebrew), music notes.
- `shotlists/`: what to film on a ride (location, chapter stop, angle, lens, time of day).
- `assets/`: small reusable files only: logo SVGs, lower-thirds, LUT/preset names, fonts list. Keep each file under ~2 MB.
- `renders/`: local render output. Ignored by git (as are all `.mp4` / `.mov`). Finished videos go to Google Drive;
  link them from the script file and from the issue.

Every video starts as a GitHub issue with the `video` label, so app work and content share one backlog.
App footage can come from the app itself: the 3D replay ("שחזור 3D") and the replay demo give clean, repeatable shots.

## Script file template
```md
# <title>
Issue: #
Format: reel 9:16 / YouTube 16:9 / store video
Goal and audience:
Length:
## Beats
1. 0:00–0:03 hook:
## On-screen text (Hebrew)
## Voice-over
## Shots needed (→ shotlists/)
## Final file (Drive link)
```
