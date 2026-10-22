"""The one cue sheet -> layers.json.  python scripts/build_layers.py

Music: Lyria take 1, 152 BPM, beat 11.84 f, bar 47.37 f; bar k starts at BAR(k) = 2.1 + 47.37k (drop on bar 5 = f239).
Voice clips: `at` = frame of the first spoken word; clip from = at - measured onset (VOICE_ONSET, seconds).
SFX: `at` = cue frame; from = at - onset frames (scenes/lib/sfx-onsets.json); gain from target LUFS.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FPS = 30
BAR = lambda k: round(2.1 + 47.37 * k)
END = 1950

VOICE = {  # file: (onset s, speech end s, file length s)
    "v1-hook-take1": (0.25, 5.00, 5.28),
    "v2a-posting-take1": (0.24, 2.74, 3.08),
    "v2b-schedule-take1": (0.29, 2.82, 3.24),
    "v3a-threads-take1": (0.25, 2.20, 2.44),
    "v3b-approve-take1": (0.13, 3.16, 3.44),
    "v4a-copypaste-take1": (0.30, 3.92, 4.28),
    "v4b-agents-take1": (0.27, 4.07, 4.32),
    "v5a-blog-take1": (0.29, 2.74, 3.08),
    "v5b-plan-take2": (0.18, 4.89, 5.20),
    "v6a-stuck-take1": (0.22, 1.64, 1.96),
    "v6b-ideas-take1": (0.26, 3.14, 3.44),
    "v7-end-take1": (0.18, 5.42, 5.60),
}

# ---- scenes -------------------------------------------------------------------------------------
SCENES = []  # (id, scene, from, to, props, note)


def scene(id, name, start, end, props, note):
    SCENES.append(dict(id=id, scene=name, start=start, end=end, props=props, note=note))


VO = []  # (id, file, at, note)
SFX = []  # (id, name, at, gain, note)

# Hook 0 - 247 (drop at bar 5 = 239)
scene("hook", "Hook", 0, BAR(5) + 8, dict(
    t1=29, t2=69, t3=109, tShake=150, tMascot=196, tDrop=BAR(5),
    l1="10 clients.", l2="10 calendars.", l3="1 very tired team.",
    clients=["Fernhill", "Northwind", "Lumen", "Oak & Co", "Pixel Pup", "Brew Lab", "Kite", "Nova", "Mesa", "Juniper"],
), "comic page draws one panel per phrase; colour mascot jumps on the drop (bar 5)")
VO.append(("vo-1", "v1-hook-take1", 29, "'Ten' on panel 1 (f29)"))


def painfix(id, name, k0, kFix, k1, voA, voB, props, note, lead=12, tail=8):
    """pain starts on bar k0, the mascot crosses on bar kFix, next beat on bar k1."""
    s, x, e = BAR(k0), BAR(kFix), BAR(k1)
    props = dict(tSwipe=x - s, tPainText=lead + 4, tFixText=x - s + 8, **props)
    scene(id, name, s, e + tail, props, note)
    VO.append((f"vo-{id}-a", voA, s + lead + 4, f"pain line, first word = pain caption (bar {k0} + {lead + 4}f)"))
    VO.append((f"vo-{id}-b", voB, x + 8, f"fix line, first word 8f after the mascot's swipe (bar {kFix})"))


painfix("posting", "Posting", 5, 8, 11, "v2a-posting-take1", "v2b-schedule-take1", dict(
    painText="Posting by hand, brand by brand?", fixText="One calendar. Every client.",
    brands=["Fernhill", "Northwind", "Lumen", "Oak & Co", "Kite"], times=["9:00", "9:15", "9:30", "9:45", "10:00"],
    tabs=["Fernhill", "Northwind", "Lumen"], tTaps=40, tapEvery=16, tCards=14, cardEvery=5,
    cards=[dict(r=0, c=0, brand="Fernhill"), dict(r=0, c=2, brand="Lumen"), dict(r=1, c=1, brand="Northwind"),
           dict(r=1, c=4, brand="Fernhill"), dict(r=2, c=0, brand="Lumen"), dict(r=2, c=3, brand="Northwind"),
           dict(r=2, c=5, brand="Fernhill"), dict(r=3, c=2, brand="Northwind"), dict(r=3, c=6, brand="Lumen")],
    enterFrom=[960, 958],
), "pain: tapping POST on five phones; fix: one calendar, cards land in cells")

painfix("approvals", "Approvals", 11, 14, 17, "v3a-threads-take1", "v3b-approve-take1", dict(
    painText="Approvals lost in email threads?", fixText="Review + approve in one place.",
    subjects=["Re: Re: Fwd: final_v7", "RE: approved??", "Fwd: new version (2)", "Re: which one?", "Re: Re: Re: feedback", "Fwd: FINAL final"],
    client="Fernhill Bakery", comment="Love it! Good to go.", tPress=40, tStamp=46,
), "pain: envelopes + tangled thread; fix: review panel, Approve pressed (on 'approve'), stamp")

painfix("agents", "Agents", 17, 20, 23, "v4a-copypaste-take1", "v4b-agents-take1", dict(
    painText="Copy. Paste. Five tools. Repeat?", fixText="Your AI agents. Access you approve.",
    tools=["Docs", "Sheets", "Scheduler", "Chat", "Email"], agents=["Claude", "ChatGPT", "OpenClaw", "Hermes"],
    footnote="Claude + ChatGPT connect over MCP · OpenClaw + Hermes: custom setup, not yet tested",
    tLocks=80,
), "pain: AI chat -> five tools by copy/paste; fix: agents wired into Rolino, padlock on every line ('access you approve')", lead=6)

painfix("blog", "Blog", 23, 26, 30, "v5a-blog-take1", "v5b-plan-take2", dict(
    painText="A blog that hasn't moved in months?", fixText="Articles planned + drafted.",
    months=["April", "May", "June", "July", "Aug"],
    rows=[dict(day="Tue 27 Oct", title="How to keep sourdough fresh", status="Draft ready"),
          dict(day="Thu 29 Oct", title="5 autumn loaves to try", status="Drafting"),
          dict(day="Tue 3 Nov", title="Behind the oven at 5 a.m.", status="Planned")],
    tApprove=103, approveText="You approve before anything goes live.",
), "pain: dusty blog, months crossed out; fix: blog plan rows, approval box ticked on 'approve' (fix +103)", lead=6)

painfix("ideas", "Ideas", 30, 32, 35, "v6a-stuck-take1", "v6b-ideas-take1", dict(
    painText="Stuck on what to post next?", fixText="Ideas from your own data.",
    ideas=[dict(kind="Blog", title="How to keep sourdough fresh"), dict(kind="Instagram", title="Behind the oven reel"),
           dict(kind="Page", title="Holiday pre-orders")],
    tSearch=44, tAnalytics=60, tIdeas=78,
), "pain: blank page, pencil tapping; fix: Search + Analytics charts (on their words) -> idea cards", lead=6)
# fix timings (fl) are frames after the swipe: the fix line starts at fl 8, so word at file frame w lands at fl 8 + w - onset.

scene("end", "EndCard", BAR(35), END, dict(
    title="ROLINO", line="Every client's content, in one workspace.", url="getrolino.com",
    tTitle=16, tLine=45, tUrl=140, tHit=1897 - BAR(35),
), "end card on the final chorus (bar 35); URL on 'get rolino dot com'; rays on the last bar (f1897)")
VO.append(("vo-end", "v7-end-take1", BAR(35) + 16, "'Rolino' as ROLINO letters on"))

# ---- SFX (target LUFS per cue; gain = 10^((target - file LUFS)/20), capped at 1) ------------------------
LUFS = json.loads((ROOT / "scenes/lib/sfx-lufs.json").read_text(encoding="utf-8"))


def sfx(id, name, at, target, note):
    g = min(1.0, round(10 ** ((target - LUFS[name]) / 20), 3))
    SFX.append((id, name, at, g, note))


sfx("sfx-pencil-p1", "pencil-stroke", 29, -27, "panel 1 caption writes on")
sfx("sfx-pencil-p2", "pencil-stroke", 69, -27, "panel 2 caption")
sfx("sfx-pencil-p3", "pencil-stroke", 109, -27, "panel 3 caption")
sfx("sfx-pop-mascot", "comic-pop", 196, -24, "colour mascot pops up in the gutter")
sfx("sfx-blow", "page-turn", BAR(5), -22, "comic page blows away on the drop")
beats = [("posting", 5, 8), ("approvals", 11, 14), ("agents", 17, 20), ("blog", 23, 26), ("ideas", 30, 32)]
for id, k0, kx in beats:
    s, x = BAR(k0), BAR(kx)
    sfx(f"sfx-{id}-draw", "pencil-stroke", s, -28, "pain sketch draws on")
    sfx(f"sfx-{id}-swipe", "page-turn", x - 4, -21, "mascot dash erases the pain (centre on the bar line)")
    sfx(f"sfx-{id}-redraw", "pencil-stroke", x, -27, "fix redraws behind the mascot")
for i in range(5):
    sfx(f"sfx-posting-tap{i + 1}", "mouse-click", BAR(5) + 40 + i * 16, -29, f"POST tapped on phone {i + 1}")
for i in range(0, 9, 2):
    sfx(f"sfx-posting-card{i + 1}", ["paper-tap-1", "paper-tap-2", "paper-tap-4"][i % 3], BAR(8) + 14 + i * 5, -30, "calendar card lands")
sfx("sfx-approve-click", "mouse-click", BAR(14) + 40, -25, "Approve pressed (on 'approve')")
sfx("sfx-approve-stamp", "rubber-stamp", BAR(14) + 46, -21, "APPROVED stamp lands")
for i in range(4):
    sfx(f"sfx-agents-lock{i + 1}", f"tab-click-{i % 3 + 1}", BAR(20) + 80 + i * 6, -28, "padlock + check on an agent line ('access you approve')")
sfx("sfx-blog-check", "pencil-stroke", BAR(26) + 103, -26, "approval box ticked on 'approve'")
for i in range(3):
    sfx(f"sfx-ideas-card{i + 1}", ["paper-tap-2", "paper-tap-4", "paper-tap-1"][i], BAR(32) + 78 + i * 7, -28, "idea card lands")
sfx("sfx-end-pop", "comic-pop", BAR(35), -23, "mascot lands on the end card")
sfx("sfx-end-url", "tab-click-2", BAR(35) + 140, -27, "URL box draws on 'get rolino dot com'")
sfx("sfx-end-hit", "paper-slap-3", 1897, -21, "pencil rays on the last bar")


# ---- build ----------------------------------------------------------------------------------------
def main():
    onsets = json.loads((ROOT / "scenes/lib/sfx-onsets.json").read_text(encoding="utf-8"))
    tracks = []
    tracks.append(dict(id="grain", name="Charcoal grain", kind="scene", clips=[dict(
        id="grain", name="Grain (boils on threes)", **{"from": 0}, duration=END, scene="Grain", props=dict(opacity=0.55),
        note="charcoal dust swapped on threes over the whole film")]))
    tracks.append(dict(id="scenes", name="Scenes", kind="scene", clips=[dict(
        id=s["id"], name=s["scene"], **{"from": s["start"]}, duration=s["end"] - s["start"], scene=s["scene"], props=s["props"], note=s["note"],
    ) for s in SCENES]))
    tracks.append(dict(id="paper", name="Paper", kind="scene", clips=[dict(
        id="paper", name="Drawing paper", **{"from": 0}, duration=END, scene="Paper", props={}, note="paper under everything")]))
    vclips = []
    for id, file, at, note in VO:
        on, _, ln = VOICE[file]
        vclips.append(dict(id=id, name=file, **{"from": at - round(on * FPS)}, duration=round(ln * FPS), src=f"assets/voice/{file}.wav",
                           volume=1, role="voice", note=note))
    tracks.append(dict(id="voice", name="Voice (Gemini Puck)", kind="audio", clips=vclips))
    tracks.append(dict(id="music", name="Music", kind="audio", clips=[dict(
        id="music", name="Synth-pop (Lyria take 1, 152 BPM)", **{"from": 0}, duration=END, src=MUSIC, volume=MUSIC_VOL, role="music",
        fadeOut=20, note="drop on bar 5 = f239; final chorus bar 35 = f1660")]))
    sclips = []
    for id, name, at, gain, note in SFX:
        src = f"assets/sfx/{name}.wav"
        o = onsets.get(src, {"onsetMs": 0, "frames": 30})
        sclips.append(dict(id=id, name=name, **{"from": at - round(o["onsetMs"] / 1000 * FPS)}, duration=o["frames"], src=src,
                           volume=gain, role="sfx", note=note))
    sclips.sort(key=lambda c: c["from"])
    # split overlapping sfx over two tracks
    a, b = [], []
    for c in sclips:
        (a if not a or a[-1]["from"] + a[-1]["duration"] <= c["from"] else b).append(c)
    tracks.append(dict(id="sfx", name="SFX", kind="audio", clips=a))
    tracks.append(dict(id="sfx-2", name="SFX 2", kind="audio", clips=b))
    markers = [dict(id="m-drop", frame=BAR(5), label="Drop", kind="beat")]
    for s in SCENES:
        markers.append(dict(id=f"m-{s['id']}", frame=s["start"], label=s["scene"], kind="section"))
    for k, v in EXTRA_MARKERS:
        markers.append(dict(id=k, frame=v[0], label=v[1], kind="cue"))
    (ROOT / "layers.json").write_text(json.dumps(dict(version=1, tracks=tracks, markers=markers), indent=1, ensure_ascii=False), encoding="utf-8")
    pj = json.loads((ROOT / "project.json").read_text(encoding="utf-8"))
    pj["durationInFrames"] = END
    (ROOT / "project.json").write_text(json.dumps(pj, indent=2, ensure_ascii=False), encoding="utf-8")
    print("ok", len(SCENES), "scenes", len(vclips), "voice", len(sclips), "sfx")


MUSIC = "assets/music/score-duck-b.wav"
MUSIC_VOL = 0.45
EXTRA_MARKERS = [(f'm-swipe-{k}', (BAR(k), 'Mascot swipe')) for k in (8, 14, 20, 26, 32)] + [
    ('m-mascot', (196, 'Mascot appears')), ('m-approve', (BAR(14) + 40, 'Approve')), ('m-url', (BAR(35) + 140, 'URL')), ('m-final', (1897, 'Final bar'))]

if __name__ == "__main__":
    main()
