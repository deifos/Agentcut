"""Charcoal-sketch textures (fixed seeds, grayscale only — the mascot is the only colour in the film).

assets/paper/sketch-paper.jpg     1920x1080 drawing paper: tooth, fibres, soft charcoal smudges at the edges
assets/paper/grain-{0,1,2}.png    transparent charcoal dust overlays, swapped on threes for "boiling" paper
assets/paper/smudge.png           a soft charcoal smear (eraser / shading patches)
"""
import numpy as np
from PIL import Image, ImageFilter
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "assets" / "paper"
OUT.mkdir(parents=True, exist_ok=True)
W, H = 1920, 1080


def blur(a, r):
    im = Image.fromarray(np.clip(a * 255, 0, 255).astype(np.uint8))
    return np.asarray(im.filter(ImageFilter.GaussianBlur(r)), dtype=np.float32) / 255


def paper():
    rng = np.random.default_rng(7)
    base = np.full((H, W), 0.915, np.float32)
    # paper tooth: fine noise + medium mottling
    base += (rng.random((H, W)) - 0.5) * 0.05
    base += (blur(rng.random((H, W)), 6) - 0.5) * 0.10
    base += (blur(rng.random((H, W)), 40) - 0.5) * 0.18
    # fibres
    fib = np.zeros((H, W), np.float32)
    for _ in range(1600):
        x, y = rng.integers(0, W), rng.integers(0, H)
        ang = rng.random() * np.pi
        ln = rng.integers(8, 40)
        for t in range(ln):
            xx, yy = int(x + np.cos(ang) * t), int(y + np.sin(ang) * t)
            if 0 <= xx < W and 0 <= yy < H:
                fib[yy, xx] = 1
    base -= blur(fib, 0.7) * 0.06
    # charcoal smudges toward the edges
    yy, xx = np.mgrid[0:H, 0:W]
    d = np.sqrt(((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2)
    vign = np.clip((d - 0.75) / 0.6, 0, 1) ** 1.6
    smudge = blur(rng.random((H, W)), 30)
    base -= vign * (0.10 + smudge * 0.12)
    g = np.clip(base, 0, 1)
    rgb = np.stack([g * 0.995 + 0.004, g * 0.99 + 0.002, g * 0.975], -1)  # faint warm paper
    Image.fromarray((rgb * 255).astype(np.uint8)).save(OUT / "sketch-paper.jpg", quality=92)


def grain(seed):
    rng = np.random.default_rng(100 + seed)
    a = np.zeros((H, W), np.float32)
    n = 9000
    xs, ys = rng.integers(0, W, n), rng.integers(0, H, n)
    a[ys, xs] = rng.random(n) * 0.9
    a = blur(a, 0.6) * 3
    # a few long faint charcoal scratches
    for _ in range(14):
        x, y = rng.integers(0, W), rng.integers(0, H)
        ang = rng.random() * np.pi
        ln = rng.integers(40, 180)
        for t in range(ln):
            xx, yy = int(x + np.cos(ang) * t), int(y + np.sin(ang) * t)
            if 0 <= xx < W and 0 <= yy < H:
                a[yy, xx] = max(a[yy, xx], 0.25)
    alpha = np.clip(a, 0, 1)
    rgba = np.zeros((H, W, 4), np.uint8)
    rgba[..., :3] = 40
    rgba[..., 3] = (alpha * 255).astype(np.uint8)
    Image.fromarray(rgba).save(OUT / f"grain-{seed}.png")


def smudge():
    rng = np.random.default_rng(3)
    S = 600
    yy, xx = np.mgrid[0:S, 0:S]
    d = np.sqrt(((xx - S / 2) / (S / 2)) ** 2 + ((yy - S / 2) / (S * 0.32)) ** 2)
    a = np.clip(1 - d, 0, 1) ** 1.2
    streak = blur(rng.random((S, S)), 2)
    streak = np.asarray(Image.fromarray((streak * 255).astype(np.uint8)).resize((S, S // 8)).resize((S, S)), np.float32) / 255
    a = a * (0.55 + streak * 0.6)
    a = blur(np.clip(a, 0, 1), 6)
    rgba = np.zeros((S, S, 4), np.uint8)
    rgba[..., :3] = 35
    rgba[..., 3] = (np.clip(a, 0, 1) * 200).astype(np.uint8)
    Image.fromarray(rgba).save(OUT / "smudge.png")


paper()
for s in range(3):
    grain(s)
smudge()
print("ok")
