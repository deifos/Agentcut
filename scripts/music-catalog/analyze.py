"""Measure and tag every song of the hosted music library, offline, so agents can pick by energy, tempo, mood
and shape instead of by name. Writes lib/music-analysis.json (shipped) and scripts/music-catalog/out/raw.json.

Needs the earshot venv (CLAP + librosa):
    E:/projects/earshot/.venv/Scripts/python.exe -I scripts/music-catalog/analyze.py [music dir]
Songs missing from the dir are downloaded from the hosted library into scripts/music-catalog/cache/.
Re-runs reuse raw.json; delete it to re-measure.
"""
import hashlib
import json
import os
import re
import sys
import urllib.parse
import urllib.request

import librosa
import numpy as np
import pyloudnorm

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
HERE = os.path.join(ROOT, 'scripts', 'music-catalog')
CDN = 'https://media.vladpalacio.com/screenslick-music/'
SR = 22050
HOP = 512
SPARK = '▁▂▃▄▅▆▇█'


def catalog():
    src = open(os.path.join(ROOT, 'lib', 'music-tracks.ts'), encoding='utf-8').read()
    out = []
    for m in re.finditer(r'id: "([^"]+)",\s*name: "(?:[^"\\]|\\.)*",\s*filename: "((?:[^"\\]|\\.)*)"', src):
        out.append((m.group(1), json.loads('"' + m.group(2) + '"')))
    return out


def local_file(music_dir, filename):
    for d in (music_dir, os.path.join(HERE, 'cache')):
        if d and os.path.exists(os.path.join(d, filename)):
            return os.path.join(d, filename)
    os.makedirs(os.path.join(HERE, 'cache'), exist_ok=True)
    path = os.path.join(HERE, 'cache', filename)
    req = urllib.request.Request(CDN + urllib.parse.quote(filename), headers={'User-Agent': 'agentcut-music-catalog'})
    with urllib.request.urlopen(req, timeout=120) as r, open(path, 'wb') as f:
        f.write(r.read())
    return path


def autocorr_at(env, lag):
    x = env - env.mean()
    ac0 = float(np.dot(x, x)) or 1.0
    return max(float(np.dot(x[l:], x[:-l])) / ac0 for l in (lag - 1, lag, lag + 1) if 0 < l < len(x))


def measure(path):
    y, _ = librosa.load(path, sr=SR, mono=True)
    dur = len(y) / SR
    oe = librosa.onset.onset_strength(y=y, sr=SR, hop_length=HOP)
    tempo, beats = librosa.beat.beat_track(onset_envelope=oe, sr=SR, hop_length=HOP)
    bpm = float(np.atleast_1d(tempo)[0])
    fps = SR / HOP
    pulse = autocorr_at(oe, int(round(60 / bpm * fps))) if bpm > 0 else 0.0
    onsets = librosa.onset.onset_detect(onset_envelope=oe, sr=SR, hop_length=HOP)
    # Level over time: RMS in dB per second (smoothed over 3 s), the song's energy curve.
    rms = librosa.feature.rms(y=y, frame_length=2048, hop_length=HOP)[0]
    per_s = np.array([rms[int(i * fps):int((i + 1) * fps)].mean() for i in range(int(dur))]) if dur >= 1 else rms[:1]
    db = 20 * np.log10(per_s + 1e-6)
    smooth = np.convolve(np.pad(db, 1, mode='edge'), np.ones(3) / 3, mode='valid') if len(db) >= 3 else db
    cent = librosa.feature.spectral_centroid(y=y, sr=SR, hop_length=HOP)[0]
    yl, _ = librosa.load(path, sr=44100, mono=False)
    lufs = float(pyloudnorm.Meter(44100).integrated_loudness(np.atleast_2d(yl).T))
    return {
        'seconds': round(dur, 1), 'bpm': round(bpm, 1), 'pulse': round(pulse, 3),
        'onsetsPerS': round(len(onsets) / max(dur, 1), 2), 'lufs': round(lufs, 1),
        'centroidHz': round(float(np.median(cent))), 'curveDb': [round(float(v), 1) for v in smooth],
    }


def settle_octave(path, bpm):
    """Above 140 bpm a tracker often counts a half-time groove twice: keep the slower tempo when the onsets
    repeat at least as strongly at it."""
    if bpm <= 140:
        return bpm
    y, _ = librosa.load(path, sr=SR, mono=True)
    oe = librosa.onset.onset_strength(y=y, sr=SR, hop_length=HOP)
    fps = SR / HOP
    at = lambda b: autocorr_at(oe, int(round(60 / b * fps)))
    return bpm / 2 if at(bpm / 2) >= at(bpm) else bpm


def digest(path):
    with open(path, 'rb') as f:
        return hashlib.md5(f.read()).hexdigest()


def shape(curve):
    """intro length, big entrances (drops), ending and a 12-step sparkline from the per-second level curve"""
    c = np.array(curve)
    if len(c) < 8:
        return {'introS': 0, 'drops': [], 'ending': 'hard', 'shape': ''}
    # The intro ends when the level first holds near the song's full level for 3 s.
    full = np.percentile(c, 75)
    held = [i for i in range(len(c) - 2) if (c[i:i + 3] >= full - 1.5).all()]
    intro = held[0] if held else 0
    jumps = [(float(c[i + 2] - c[max(0, i - 2)]), i + 1) for i in range(2, len(c) - 2)]
    drops = []
    for size, t in sorted(jumps, reverse=True):
        if size < 4 or len(drops) == 3:
            break
        if all(abs(t - d) > 8 for d in drops):
            drops.append(t)
    tail = c[-4:]
    ending = 'fade' if tail[-1] < np.median(c) - 10 and tail[0] - tail[-1] > 6 else 'hard' if tail[-1] > np.median(c) - 4 else 'ring-out'
    lo, hi = np.percentile(c, 5), c.max()
    seg = np.array_split(c, 12)
    spark = ''.join(SPARK[int(np.clip((s.mean() - lo) / max(hi - lo, 1e-6), 0, 0.999) * len(SPARK))] for s in seg)
    return {'introS': intro, 'drops': sorted(drops), 'ending': ending, 'shape': spark}


def clap_tags(paths):
    sys.path.insert(0, 'E:/projects/earshot')
    from earshot import vocab
    v = vocab.get()
    cats = {k: v.cats[k] for k in ('music_genre', 'music_mood', 'instruments')}
    extra = ['singing vocals', 'an instrumental track with no vocals']
    terms = [t for ts in cats.values() for t in ts] + extra
    A = vocab.embed_files(paths, max_win=12)
    Z = np.array([[r['z'] for r in row] for row in v.scores(A, terms)])
    return terms, cats, Z


def label(term):
    return re.sub(r'^(a|an) ', '', re.sub(r' (music|beat|pattern)$', '', term.replace(' music', '')))


def main():
    music_dir = sys.argv[1] if len(sys.argv) > 1 else None
    os.makedirs(os.path.join(HERE, 'out'), exist_ok=True)
    raw_path = os.path.join(HERE, 'out', 'raw.json')
    raw = json.load(open(raw_path, encoding='utf-8')) if os.path.exists(raw_path) else {}
    songs = catalog()[:int(os.environ.get("LIMIT") or 10**9)]
    paths = {}
    for i, (sid, filename) in enumerate(songs, 1):
        paths[sid] = local_file(music_dir, filename)
        if sid not in raw:
            raw[sid] = measure(paths[sid])
            print(f'{i}/{len(songs)} {sid} {raw[sid]["bpm"]} bpm', file=sys.stderr, flush=True)
            if i % 10 == 0:
                json.dump(raw, open(raw_path, 'w', encoding='utf-8'))
        if 'octaveChecked' not in raw[sid]:
            raw[sid]['bpm'] = round(settle_octave(paths[sid], raw[sid]['bpm']), 1)
            raw[sid]['octaveChecked'] = True
        if 'md5' not in raw[sid]:
            raw[sid]['md5'] = digest(paths[sid])
    json.dump(raw, open(raw_path, 'w', encoding='utf-8'))

    ids = [sid for sid, _ in songs]
    print('CLAP tags...', file=sys.stderr, flush=True)
    terms, cats, Z = clap_tags([paths[i] for i in ids])
    col = {t: j for j, t in enumerate(terms)}
    # How each song stands out against the rest of the library, per term (CLAP's music terms are unvalidated
    # in absolute terms; relative to 235 songs of the same kind they separate well).
    R = (Z - Z.mean(0)) / (Z.std(0) + 1e-9)

    def pct(values):
        order = np.argsort(np.argsort(values))
        return order / max(len(values) - 1, 1)

    m = [raw[i] for i in ids]
    energy_score = (
        pct([x['onsetsPerS'] for x in m]) + pct([x['lufs'] for x in m]) + pct([x['bpm'] for x in m]) * 0.5
        + pct([x['pulse'] for x in m]) * 0.5 + pct([x['centroidHz'] for x in m]) * 0.5
        + pct(Z[:, col['energetic and driving music']] - Z[:, col['calm and relaxing music']])
    )
    energy = np.ceil(pct(energy_score) * 5).clip(1, 5).astype(int)
    pulse = pct([x['pulse'] for x in m])

    # The same audio under two names: the first id keeps it, later ones point at it.
    first = {}
    for sid in ids:
        first.setdefault(raw[sid]['md5'], sid)

    out = {}
    for k, sid in enumerate(ids):
        x = raw[sid]

        def best(cat, n):
            js = [col[t] for t in cats[cat]]
            # What the song sounds like most (as earshot describe ranks it), kept only where it is at least
            # as true of this song as of the library's typical song.
            ranked = sorted(js, key=lambda j: -Z[k, j])
            return [label(terms[j]) for j in ranked if Z[k, j] >= 2.0 and R[k, j] >= 0][:n]

        vocal = Z[k, col['singing vocals']] - Z[k, col['an instrumental track with no vocals']]
        # Relative to the library: almost every song here has a clear pulse.
        beat = 'steady' if pulse[k] >= 0.5 else 'light' if pulse[k] >= 0.2 else 'loose'
        out[sid] = {
            'bpm': round(x['bpm']), 'energy': int(energy[k]), 'beat': beat,
            'vocals': bool(vocal > 1.0 and R[k, col['singing vocals']] > 1.0),
            'moods': best('music_mood', 3), 'genres': best('music_genre', 2), 'instruments': best('instruments', 3),
            **shape(x['curveDb']),
        }
        if first[x['md5']] != sid:
            out[sid]['sameAs'] = first[x['md5']]
    dest = os.path.join(ROOT, 'lib', 'music-analysis.json')
    with open(dest, 'w', encoding='utf-8', newline='\n') as f:
        f.write('{\n' + ',\n'.join(f'  {json.dumps(k)}: {json.dumps(v, ensure_ascii=False)}' for k, v in out.items()) + '\n}\n')
    print(f'wrote {len(out)} songs to {dest}', file=sys.stderr)


if __name__ == '__main__':
    main()
