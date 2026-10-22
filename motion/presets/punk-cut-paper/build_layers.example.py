# Builds layers.json from the lyric cue table (word frames from screenslick_studio_transcribe, corrected by hand).
# Run once to seed the timeline; after that the timeline is edited directly (hand edits win).
import json, sys, os

HERE = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.dirname(HERE)
words = json.load(open(os.path.join(HERE, "transcribe.json")))["words"]

# (start frame of first word, text with *accents*, motif or photo spec, optional overrides)
# word timings come from whisper; text is the corrected lyric.
LINES = [
    # Example cue table (replace with the new song's lines). Frames are the first sung word of each line.
    # verse 1
    (629, "Coffee in my hands, *sunrise coming through", {"motif": "sun"}),
    (750, "Cooking up *magic, nothing left to prove", {"motif": "pot"}),
    (828, "Taking it *bold and I'm ready to roll", {"motif": "wheel"}),
    (941, "Friends and family *cheering, filling up my soul", {"motif": "cheer"}),
    # chorus
    (1136, "*Shining like the summer", {"photo": {"treatment": "xerox", "zoom": 1.35}}),
    (1220, "Brighter than the *day", {"motif": "sun"}),
    (1305, "No more hiding *years, I've earned every one", {"motif": "calendar"}),
    # gang shout
    (2096, "*HEY!", {"shout": True}),
    # outro
    (5840, "*Happy *birthday to me", {"motif": "cake"}),
    (6055, "Living *wild and free", {"motif": "chain"}),
]

def wordframes(start, n_words, until):
    """Pick the whisper word start frames for this line (skips ♪ and noise)."""
    real = [w for w in words if w["text"].strip() not in ("♪", "[MUSIC]") and not w["text"].strip().startswith("(")]
    real.sort(key=lambda w: w["fromFrame"])
    i = next((k for k, w in enumerate(real) if w["fromFrame"] >= start - 3), None)
    out = []
    while i is not None and i < len(real) and len(out) < n_words and real[i]["fromFrame"] < until:
        fr = real[i]["fromFrame"]
        if not out or fr >= out[-1]:
            out.append(fr)
        i += 1
    return out

clips_lyr, clips_pic, clips_shout = [], [], []
for li, (start, text, spec) in enumerate(LINES):
    nxt = LINES[li + 1][0] if li + 1 < len(LINES) else 6300
    toks = text.split()
    fr = wordframes(start, len(toks), nxt)
    # pad missing words evenly
    last = fr[-1] if fr else start
    while len(fr) < len(toks):
        last += 7
        fr.append(last)
    fr[0] = start
    for k in range(1, len(fr)):  # whisper duplicates words in repeats: keep >= 5f between word slaps
        fr[k] = max(fr[k], fr[k - 1] + 5)
    side = "left" if li % 2 == 0 else "right"
    lead = 6
    cfrom = start - lead
    end = min(nxt - 4, max(fr[-1] + 45, start + 60))
    if li + 1 == len(LINES):
        end = 6215
    dur = end - cfrom
    wl = [{"t": t, "at": max(0, f - cfrom)} for t, f in zip(toks, fr)]
    shout = spec.get("shout")
    cid = f"lyr-{li+1:02d}"
    props = {"words": wl, "side": "center" if shout else side, "seed": li + 1}
    if shout:
        props.update({"letters": True, "stagger": 1, "size": 260})
        wl[0]["at"] = lead
    clips_lyr.append({"id": cid, "name": text.replace("*", ""), "from": cfrom, "duration": dur, "scene": "Ransom", "props": props,
                      "note": f"first sung word at f{start}; words slap on whisper word starts"})
    pfrom = start - 10
    pdur = end + 4 - pfrom
    if "photo" in spec:
        p = {"side": "center" if shout else side, "seed": li + 7, "rot": (-5 if li % 2 else 4), "from": ("bottom" if li % 3 == 0 else ("left" if side == "right" else "right"))}
        p.update(spec["photo"])
        clips_pic.append({"id": f"pic-{li+1:02d}", "name": "photo", "from": pfrom, "duration": pdur, "scene": "Photo", "props": p,
                          "note": "photo lands with the hook line"})
    if "motif" in spec:
        clips_pic.append({"id": f"mot-{li+1:02d}", "name": spec["motif"], "from": pfrom, "duration": pdur, "scene": "Motif",
                          "props": {"kind": spec["motif"], "side": side, "seed": li + 3}, "note": f"illustrates '{text.replace('*','')}'"})

# intro title (letters land on strong beats from f108)
intro = [
    {"id": "title", "name": "HAPPY BIRTHDAY SAM", "from": 100, "duration": 495, "scene": "Ransom",
     "props": {"words": [{"t": "*HAPPY", "at": 8}, {"t": "*BIRTHDAY", "at": 74}, {"t": "*SAM", "at": 180}], "side": "left", "seed": 53, "stagger": 13, "size": 165},
     "note": "intro: one letter per strong beat (13f grid from f108); the name lands f280"},
]
intro += [
    {"id": "title-outro", "name": "HAPPY BIRTHDAY SAM (finale)", "from": 6205, "duration": 419, "scene": "Ransom",
     "props": {"words": [{"t": "*HAPPY", "at": 8}, {"t": "*BIRTHDAY", "at": 26}, {"t": "*SAM", "at": 52}], "side": "left", "seed": 77, "stagger": 3, "size": 165},
     "note": "finale after the last sung word (f6165); holds to the end"},
]
intro_pic = [
    {"id": "pic-outro", "name": "photo (finale)", "from": 6215, "duration": 409, "scene": "Photo",
     "props": {"side": "left", "treatment": "color", "zoom": 1.05, "rot": -4, "from": "right", "seed": 21}, "note": "finale photo"},
    {"id": "mot-outro-53", "name": "53 badge (finale)", "from": 6290, "duration": 334, "scene": "Motif",
     "props": {"kind": "badge53", "side": "left", "seed": 9, "x": 0.58, "y": 0.8, "scale": 0.45, "mobile": {"x": 0.76, "y": 0.43, "scale": 0.36}}, "note": "53 stamp"},
    {"id": "pic-intro", "name": "photo", "from": 320, "duration": 275, "scene": "Photo",
     "props": {"side": "left", "treatment": "color", "zoom": 1.05, "rot": 5, "from": "right", "seed": 11}, "note": "photo slaps in after the name"},
    {"id": "mot-intro-53", "name": "53 badge", "from": 430, "duration": 165, "scene": "Motif",
     "props": {"kind": "badge53", "side": "left", "seed": 4, "x": 0.6, "y": 0.78, "scale": 0.45, "mobile": {"x": 0.76, "y": 0.43, "scale": 0.36}}, "note": "53 stamp"},
]

SECTIONS = [  # (from, to, colors, cutEvery, energy)
    (0, 600, ["#FFD21F", "#141312"], 8, 0.4),
    (600, 1080, ["#13A89A", "#FFD21F", "#141312"], 4, 0.5),
    (1080, 2080, ["#E2332A", "#FFD21F", "#141312", "#FF4F9A"], 2, 0.9),
    (2080, 2510, ["#FF4F9A", "#141312", "#FFD21F"], 1, 1.0),
    (2510, 3200, ["#2A5FD8", "#F07A22", "#141312"], 4, 0.5),
    (3200, 4100, ["#E2332A", "#FFD21F", "#141312", "#13A89A"], 2, 0.9),
    (4100, 5220, ["#FF4F9A", "#2A5FD8", "#141312"], 4, 0.6),
    (5220, 5830, ["#E2332A", "#FFD21F", "#FF4F9A", "#141312"], 1, 1.0),
    (5830, 6624, ["#F07A22", "#FFD21F", "#141312"], 4, 0.6),
]
bg = [{"id": f"bg-{i+1}", "name": f"Backdrop {i+1}", "from": a, "duration": b - a, "scene": "Backdrop",
       "props": {"colors": c, "cutEvery": n, "energy": e, "seed": i + 1}, "note": f"re-cuts every {n} strong beats"}
      for i, (a, b, c, n, e) in enumerate(SECTIONS)]

layers = {
    "version": 1,
    "tracks": [
        {"id": "xerox", "name": "Xerox overlay", "kind": "scene", "clips": [
            {"id": "xerox", "name": "Grain + copier edges", "from": 0, "duration": 6624, "scene": "Xerox", "props": {"grain": 0.28, "edges": 0.5, "flash": 0.05}}]},
        {"id": "lyrics", "name": "Lyrics", "kind": "scene", "clips": sorted(intro + clips_lyr, key=lambda c: c["from"])},
        {"id": "pictures", "name": "Motifs + photos", "kind": "scene", "clips": sorted(intro_pic + clips_pic, key=lambda c: c["from"])},
        {"id": "backdrop", "name": "Backdrop", "kind": "scene", "clips": bg},
        {"id": "music", "name": "Song", "kind": "audio", "clips": [
            {"id": "song", "name": "song", "from": 0, "duration": 6624, "src": "assets/song.mp3", "volume": 1, "role": "music"}]},
    ],
    "markers": [
        {"id": "m-v1", "frame": 600, "label": "Verse 1", "kind": "section"},
        {"id": "m-c1", "frame": 1080, "label": "Chorus 1", "kind": "section"},
        {"id": "m-hey", "frame": 2080, "label": "HEY! break", "kind": "section"},
        {"id": "m-v2", "frame": 2510, "label": "Verse 2", "kind": "section"},
        {"id": "m-c2", "frame": 3200, "label": "Chorus 2", "kind": "section"},
        {"id": "m-br", "frame": 4100, "label": "Bridge", "kind": "section"},
        {"id": "m-c3", "frame": 5220, "label": "Final chorus", "kind": "section"},
        {"id": "m-out", "frame": 5830, "label": "Outro", "kind": "section"},
    ],
}
only = sys.argv[1] if len(sys.argv) > 1 else None
if only:  # partial build: keep clips that start before frame N
    N = int(only)
    for t in layers["tracks"]:
        if t["id"] in ("lyrics", "pictures"):
            t["clips"] = [c for c in t["clips"] if c["from"] < N]
json.dump(layers, open(os.path.join(PROJ, "layers.json"), "w"), indent=1)
print("lyrics", len(clips_lyr), "pics", len(clips_pic))
for c in clips_lyr:
    print(c["id"], c["from"], c["duration"], [w["at"] for w in c["props"]["words"]], c["name"])
