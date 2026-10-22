"""Duck the score under the voice-over.  python scripts/duck_music.py assets/music/<new-name>.wav
Reads the voice clips from layers.json, finds speech in each take (energy gate), lowers the Lyria take by DUCK dB
there (150 ms attack, 400 ms release). Use a new output name on every rerun (the listen tools cache by path),
then point MUSIC in build_layers.py at it and rebuild."""
import json, sys
import numpy as np, soundfile as sf, librosa

DUCK = -14.0; ATT = 0.15; REL = 0.40; FPS = 30
SRC = "assets/music/synthpop-sketch-take1.mp3"
OUT = sys.argv[1]
layers = json.load(open("layers.json", encoding="utf-8"))
voice = next(t for t in layers["tracks"] if t["id"] == "voice")["clips"]
y, sr = librosa.load(SRC, sr=44100, mono=False)
y = y.T  # (n, 2)
mask = np.zeros(len(y))
for v in voice:
    x, vsr = sf.read(v["src"]); x = x if x.ndim == 1 else x.mean(1)
    w = int(0.02 * vsr)
    e = np.array([np.sqrt((x[k:k + w] ** 2).mean()) for k in range(0, len(x) - w, w)])
    db = 20 * np.log10(e + 1e-9)
    on = np.where(db > db.max() - 32)[0]
    if not len(on):
        continue
    s = v["from"] / FPS + on[0] * 0.02; t = v["from"] / FPS + (on[-1] + 1) * 0.02
    mask[int(s * sr):int(t * sr)] = 1
g = np.zeros(len(y)); a = int(ATT * sr); r = int(REL * sr)
idx = np.where(np.diff(np.r_[0, mask, 0]))[0].reshape(-1, 2)
for s, t in idx:
    g[max(0, s - a):s] = np.maximum(g[max(0, s - a):s], np.linspace(0, 1, s - max(0, s - a)))
    g[s:t] = 1
    e = min(len(y), t + r); g[t:e] = np.maximum(g[t:e], np.linspace(1, 0, e - t))
gain = 10 ** (DUCK * g / 20)
sf.write(OUT, y * gain[:, None], sr, subtype="PCM_24")
print("ducked spans (s):", [(round(s / sr, 2), round(t / sr, 2)) for s, t in idx])
