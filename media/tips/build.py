#!/usr/bin/env python3
"""Build the tips series files from episodes.py: episodes.json (for the video code), pages/NN-slug.md (a readable
page per episode) and voiceover/NN-slug.txt (the narration, one scene per paragraph). Run from anywhere:
python3 media/tips/build.py"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from episodes import E, S

CTA = {"wa": ("תדריך סופ״ש בוואטסאפ", "blueronin.app/go"), "join": ("רשימת ההמתנה להשקה", "blueronin.app/join")}
SRC = {"ig": "Instagram", "tt": "TikTok", "yt": "YouTube Shorts", "fb": "Facebook"}

def words(t): return len(t.replace("\n", " ").split())

def main():
    out = []
    for e in E:
        t, scenes = 0, []
        for s in e["scenes"]:
            scenes.append(dict(s, t0=t, t1=t + s["dur"], src=[dict(id=k, title=S[k][0], url=S[k][1]) for k in s.get("src", [])])); t += s["dur"]
        cta_t, cta_path = CTA[e["cta"]]
        out.append(dict(e, scenes=scenes, total=t, vo_words=sum(words(s["vo"]) for s in e["scenes"]),
                        cta_text=cta_t, cta_links={k: f"{cta_path}?src={k}" for k in SRC},
                        sources=[dict(id=k, title=S[k][0], url=S[k][1]) for k in e["sources"]]))
    os.makedirs(os.path.join(HERE, "pages"), exist_ok=True); os.makedirs(os.path.join(HERE, "voiceover"), exist_ok=True)
    with open(os.path.join(HERE, "episodes.json"), "w", encoding="utf-8") as f:
        json.dump(dict(series="הרונין לא ממהר", format=dict(w=1080, h=1920, fps=30), episodes=out), f, ensure_ascii=False, indent=1)
    for e in out:
        name = f"{e['n']:02d}-{e['slug']}"
        with open(os.path.join(HERE, "voiceover", name + ".txt"), "w", encoding="utf-8") as f:
            f.write("\n\n".join(s["vo"] for s in e["scenes"]) + "\n")
        L = [f"# {e['n']:02d} · {e['title']}", "", f"**פרסום:** {e['date']} (שלישי, 19:30) · **אורך:** {e['total']} שנ׳ · **קריינות:** {e['vo_words']} מילים",
             f"**וו (שנייה ראשונה):** {e['hook']}", f"**קריאה לפעולה:** {e['cta_text']}", ""]
        if e["app_tie"]: L += [f"**באפליקציה:** {e['app_tie']}", ""]
        L += ["## סצנות", "", "| זמן | סוג | טקסט על המסך | קריינות | איור |", "|---|---|---|---|---|"]
        for s in e["scenes"]:
            L.append(f"| {s['t0']}–{s['t1']} | {s['kind']} | {s['text'].replace(chr(10), ' / ')} | {s['vo']} | {s['art']} |")
        L += ["", "## כיתוב לפוסט", "", e["caption"], "", " ".join("#" + x for x in e["tags"]), "", "## קישור לכל ערוץ", ""]
        L += [f"- {SRC[k]}: {v}" for k, v in e["cta_links"].items()]
        L += ["", "## מקורות", ""] + ([f"- [{s['title']}]({s['url']})" for s in e["sources"]] or ["- טיפ מעשי בלי נתון מספרי."]) + [""]
        with open(os.path.join(HERE, "pages", name + ".md"), "w", encoding="utf-8") as f: f.write("\n".join(L))
    print(f"{len(out)} episodes → episodes.json, pages/, voiceover/")

if __name__ == "__main__": main()
