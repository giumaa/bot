#!/usr/bin/env python3
"""Rico promo soundtrack — music and sound design synthesized from audio/cues.json.

cues.json is exported from web/timeline.js (render/export-cues.mjs), the same timeline that drives the
animation, so every whoosh, key click and chime lands on its frame. Everything is synthesized here
(numpy/scipy): no samples, fully reproducible.

Music: D minor at 120 BPM, warm pads, Karplus-Strong plucks, FM bells, soft half-time drums and a
darbuka (maqsum) layer in the features section. The sonic logo is the harmonic-minor pickup
A–B♭–C♯ → D (the augmented second gives it a North-African colour) landing on each logo bloom.

usage: python3 audio/synth.py [cues.json] [out.wav]
"""
import json
import os
import sys

import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48000
HERE = os.path.dirname(os.path.abspath(__file__))
CUES = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'cues.json')
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, 'soundtrack.wav')

D = json.load(open(CUES))
DUR = float(D['duration'])
BEAT = float(D['beat'])
BAR = float(D['bar'])
STEP = BEAT / 4  # 16th note
M = D['music']
N_TOTAL = int((DUR + 6) * SR)  # room for tails, trimmed at the end


# =====================================================================================================
# basics
# =====================================================================================================
def rng(seed):
    return np.random.default_rng(seed)


NOTE_IDX = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}


def nf(name):
    """'C#5' / 'Bb4' / 'D5' → Hz (A4 = 440)"""
    letter = name[0]
    acc = 0
    rest = name[1:]
    if rest and rest[0] in '#b':
        acc = 1 if rest[0] == '#' else -1
        rest = rest[1:]
    octave = int(rest)
    midi = 12 * (octave + 1) + NOTE_IDX[letter] + acc
    return 440.0 * 2 ** ((midi - 69) / 12)


def db(x):
    return 10 ** (x / 20)


def tvec(n):
    return np.arange(n) / SR


def sos(kind, f, order=2):
    if kind == 'bp':
        return signal.butter(order, [f[0], f[1]], btype='bandpass', fs=SR, output='sos')
    return signal.butter(order, f, btype={'lp': 'lowpass', 'hp': 'highpass'}[kind], fs=SR, output='sos')


def lp(x, f, order=2):
    return signal.sosfilt(sos('lp', f, order), x, axis=0)


def hp(x, f, order=2):
    return signal.sosfilt(sos('hp', f, order), x, axis=0)


def bp(x, lo, hi, order=2):
    return signal.sosfilt(sos('bp', (lo, hi), order), x, axis=0)


def noise(n, seed):
    return rng(seed).standard_normal(n)


def fade(x, fin=0.002, fout=0.01):
    x = x.copy()
    a = min(len(x), max(1, int(fin * SR)))
    b = min(len(x), max(1, int(fout * SR)))
    w = np.ones(len(x))
    w[:a] = np.sin(np.linspace(0, np.pi / 2, a)) ** 2
    w[len(x) - b:] *= np.cos(np.linspace(0, np.pi / 2, b)) ** 2
    return x * (w if x.ndim == 1 else w[:, None])


def expenv(n, tau, attack=0.002):
    t = tvec(n)
    e = np.exp(-t / tau)
    a = max(1, int(attack * SR))
    e[:a] *= np.linspace(0, 1, a)
    return e


def pan2(x, p):
    """mono → stereo, equal-power pan (-1 left … +1 right)"""
    a = (np.clip(p, -1, 1) + 1) * np.pi / 4
    return np.stack([x * np.cos(a), x * np.sin(a)], axis=1)


def stereo(x):
    return x if x.ndim == 2 else np.stack([x, x], axis=1) * 0.7071


def pan_sweep(x, p0, p1):
    p = np.linspace(p0, p1, len(x))
    a = (np.clip(p, -1, 1) + 1) * np.pi / 4
    return np.stack([x * np.cos(a), x * np.sin(a)], axis=1)


def norm(x, peak=0.9):
    m = np.max(np.abs(x)) + 1e-12
    return x * (peak / m)


def stft_shape(x, gain_fn, nper=2048):
    """zero-phase time-varying EQ: gain_fn(times[F], freqs[K]) → gain[K, F]"""
    f, tt, Z = signal.stft(x, fs=SR, nperseg=nper, noverlap=nper * 3 // 4, boundary='even')
    G = gain_fn(tt, f)
    _, y = signal.istft(Z * G, fs=SR, nperseg=nper, noverlap=nper * 3 // 4, boundary=True)
    y = y[: len(x)]
    if len(y) < len(x):
        y = np.pad(y, (0, len(x) - len(y)))
    return y


def band_mask(tt, f, fc_fn, width_oct=1.0):
    """log-gaussian band centred on fc(t) (Hz)"""
    fc = np.maximum(fc_fn(tt), 20.0)
    lf = np.log2(np.maximum(f, 1.0))[:, None]
    lc = np.log2(fc)[None, :]
    return np.exp(-0.5 * ((lf - lc) / (width_oct / 2.355)) ** 2)


class Bus:
    def __init__(self, n=N_TOTAL):
        self.x = np.zeros((n, 2))

    def add(self, sig, t, gain_db=0.0, pan=0.0):
        s = pan2(sig, pan) if sig.ndim == 1 else sig
        s = s * db(gain_db)
        i = int(round(t * SR))
        if i < 0:
            s = s[-i:]
            i = 0
        j = min(len(self.x), i + len(s))
        if j > i:
            self.x[i:j] += s[: j - i]


# =====================================================================================================
# reverb + delay
# =====================================================================================================
def make_ir(t60, seed, predelay=0.014, hi_damp=0.45, length=None, width=1.0):
    n = int((length or t60 * 1.25) * SR)
    t = tvec(n)
    chans = []
    for c in range(2):
        nz = noise(n, seed + c)
        low = lp(nz, 700)
        mid = bp(nz, 700, 4000)
        high = hp(nz, 4000)
        ir = low * np.exp(-6.9 * t / t60) + mid * np.exp(-6.9 * t / (t60 * 0.75)) + high * np.exp(-6.9 * t / (t60 * hi_damp))
        ir *= 1 - np.exp(-t / 0.006)  # soft onset
        chans.append(ir)
    ir = np.stack(chans, axis=1)
    mid_ = ir.mean(axis=1, keepdims=True)
    ir = mid_ + (ir - mid_) * width
    pd = int(predelay * SR)
    ir = np.vstack([np.zeros((pd, 2)), ir])
    # early reflections
    for k, (ms, g) in enumerate([(9, 0.5), (15, 0.38), (23, 0.3), (31, 0.24), (43, 0.18), (57, 0.12)]):
        i = int(ms / 1000 * SR)
        ir[i, k % 2] += g * 3.0
    ir /= np.sqrt(np.sum(ir ** 2) / 2)
    return ir


def reverb(x, ir, wet):
    y = np.stack([signal.fftconvolve(x[:, c], ir[:, c])[: len(x)] for c in range(2)], axis=1)
    return y * wet


def pingpong(x, delay, fb=0.35, repeats=5, damp=3500.0):
    """dotted-eighth ping-pong delay (stereo in → stereo out, wet only)"""
    d = int(delay * SR)
    out = np.zeros_like(x)
    mono = x.mean(axis=1)
    cur = mono
    for k in range(1, repeats + 1):
        cur = lp(cur, damp, 1) * fb
        sh = np.zeros_like(mono)
        sh[k * d:] = cur[: len(mono) - k * d]
        out[:, k % 2] += sh
    return out


# =====================================================================================================
# instruments
# =====================================================================================================
_tables = {}


def wavetable(k_max, tilt=1.15):
    key = (k_max, tilt)
    if key not in _tables:
        ph = np.linspace(0, 2 * np.pi, 4096, endpoint=False)
        tab = sum(np.sin(k * ph) / k ** tilt for k in range(1, k_max + 1))
        _tables[key] = tab / np.max(np.abs(tab))
    return _tables[key]


def osc(f, n, detune=0.0, vib_cents=4.0, vib_rate=0.23, seed=0, top=4500.0, tilt=1.15):
    """band-limited saw-ish voice via wavetable, with slow vibrato"""
    r = rng(seed)
    f0 = f * 2 ** (detune / 1200)
    t = tvec(n)
    vib = 2 ** ((vib_cents * np.sin(2 * np.pi * vib_rate * t + r.uniform(0, 6.28))) / 1200)
    phase = np.cumsum(f0 * vib) / SR + r.uniform(0, 1)
    k = int(max(1, min(18, top // f0)))
    tab = wavetable(k, tilt)
    idx = (phase % 1.0) * 4096
    i0 = idx.astype(np.int64) % 4096
    frac = idx - np.floor(idx)
    return tab[i0] * (1 - frac) + tab[(i0 + 1) % 4096] * frac


def pad_segment(notes, dur, seed, attack=0.6, release=1.4):
    n = int((dur + release) * SR)
    out = np.zeros((n, 2))
    voices = 0
    for i, nm in enumerate(notes):
        f = nf(nm)
        for j, dc in enumerate((-8.0, 0.0, 8.0)):
            v = osc(f, n, dc, seed=seed * 100 + i * 10 + j)
            out += pan2(v, (-0.55, 0.0, 0.55)[j] * (0.6 + 0.4 * (i % 2)))
            voices += 1
    out /= voices ** 0.5
    t = tvec(n)
    env = np.minimum(1.0, t / attack) ** 1.5
    env = np.where(t > dur, np.exp(-(t - dur) / (release / 4)), env)
    out *= env[:, None]
    return out


def bass_note(f, dur, seed=0):
    n = int((dur + 0.12) * SR)
    t = tvec(n)
    ph = 2 * np.pi * f * t
    x = np.sin(ph) + 0.22 * np.sin(2 * ph) + 0.07 * np.sin(3 * ph)
    env = np.minimum(1, t / 0.008) * np.where(t > dur, np.exp(-(t - dur) / 0.04), 1.0) * (0.75 + 0.25 * np.exp(-t / 0.25))
    x = np.tanh(1.4 * x * env) / np.tanh(1.4)
    return lp(x, 900)


def pluck(f, dur=2.4, bright=0.55, decay=0.9965, seed=0, body=True):
    """Karplus–Strong with fractional-delay tuning (oud/kanun-ish when bright)"""
    n = int(dur * SR)
    L = SR / f - 0.5
    N = int(np.floor(L))
    frac = L - N
    exc = noise(N + 1, seed)
    exc = lp(exc, 1500 + 7000 * bright, 1)
    exc -= exc.mean()
    x = np.zeros(n)
    x[: N + 1] = exc * np.hanning(N + 1)
    a = np.zeros(N + 2)
    a[0] = 1.0
    a[N] = -decay * (1 - frac) * 0.5 - decay * 0.25
    a[N + 1] = -decay * frac * 0.5 - decay * 0.25
    y = signal.lfilter([1.0], a, x)
    y = hp(y, 70, 1)
    if body:  # a little wooden body resonance
        y = y + 0.35 * bp(y, 220, 600, 1) + 0.2 * bp(y, 1800, 3200, 1)
    y *= np.exp(-tvec(n) / (dur * 0.45))
    return fade(norm(y, 0.8), 0.001, 0.05)


def bell(f, dur=2.8, ratio=3.5, index=2.4, decay=1.1, seed=0, bright=1.0):
    n = int(dur * SR)
    t = tvec(n)
    I = index * bright * np.exp(-t / 0.45)
    car = np.sin(2 * np.pi * f * t + I * np.sin(2 * np.pi * f * ratio * t))
    part = 0.28 * np.sin(2 * np.pi * f * 2.756 * t) * np.exp(-t / (decay * 0.35))
    x = (car * np.exp(-t / decay) + part) * np.minimum(1, t / 0.002)
    return fade(x * 0.6, 0.001, 0.08)


def kick(seed=0, punch=1.0):
    n = int(0.6 * SR)
    t = tvec(n)
    f = 46 + 120 * np.exp(-t / 0.028)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.3)
    click = hp(noise(n, seed), 2500) * np.exp(-t / 0.0025) * 0.25 * punch
    x = np.tanh(1.8 * (body + click)) / np.tanh(1.8)
    return fade(x, 0.0005, 0.05)


def clap(seed=0):
    n = int(0.45 * SR)
    t = tvec(n)
    nz = noise(n, seed)
    env = np.zeros(n)
    for k, d in enumerate((0.0, 0.009, 0.019)):
        tt = np.clip(t - d, 0, None)
        env += (t >= d) * np.exp(-tt / 0.0045) * (0.8 + 0.2 * k)
    env += (t >= 0.019) * np.exp(-np.clip(t - 0.019, 0, None) / 0.11) * 0.45
    x = bp(nz * env, 900, 3000)
    return fade(norm(x, 0.8), 0.0005, 0.05)


def hat(seed=0, open_=False):
    n = int((0.35 if open_ else 0.09) * SR)
    x = hp(noise(n, seed), 7000, 3) * expenv(n, 0.16 if open_ else 0.028, 0.0008)
    return fade(norm(x, 0.7), 0.0005, 0.02)


def shaker(seed=0):
    n = int(0.12 * SR)
    t = tvec(n)
    env = np.minimum(1, t / 0.008) * np.exp(-t / 0.045)
    x = bp(noise(n, seed), 4500, 11000, 2) * env
    return fade(norm(x, 0.6), 0.001, 0.02)


def doum(seed=0):
    n = int(0.5 * SR)
    t = tvec(n)
    f = 70 + 30 * np.exp(-t / 0.05)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.2)
    x += lp(noise(n, seed), 500) * np.exp(-t / 0.02) * 0.25
    return fade(norm(x, 0.8), 0.0005, 0.04)


def tak(seed=0):
    n = int(0.18 * SR)
    t = tvec(n)
    x = bp(noise(n, seed), 2200, 6500) * np.exp(-t / 0.011)
    x += np.sin(2 * np.pi * 1020 * t) * np.exp(-t / 0.028) * 0.35
    return fade(norm(x, 0.75), 0.0004, 0.02)


# =====================================================================================================
# sound effects (each returns stereo; peak ≈ 0.8 before the cue gain)
# =====================================================================================================
def sfx_ink_tick(c):
    s = int(c.get('seed', 0))
    r = rng(500 + s)
    n = int(0.09 * SR)
    t = tvec(n)
    f = nf('A6')  # in key (D minor): every glyph rings the same soft note
    x = bp(noise(n, 900 + s), 2500, 7000) * np.exp(-t / 0.0035)
    x += 0.5 * np.sin(2 * np.pi * f * t) * np.exp(-t / 0.012)
    x += 0.18 * np.sin(2 * np.pi * f * 2.01 * t) * np.exp(-t / 0.008)
    return pan2(fade(norm(x, 0.7), 0.0004, 0.01), (r.random() - 0.5) * 0.5)


def sfx_whoosh(c):
    dur = float(c.get('dur', 0.8))
    big = c.get('size') == 'big'
    n = int(dur * SR)
    x = noise(n, int(dur * 1000) + (7 if big else 3))
    lo, hi = (160, 2600) if big else (450, 4200)

    def fc(tt):
        u = np.clip(tt / dur, 0, 1)
        return lo * (hi / lo) ** (np.sin(np.pi * u) ** 1.3)

    y = stft_shape(x, lambda tt, f: band_mask(tt, f, fc, 1.6 if big else 1.25))
    u = np.linspace(0, 1, n)
    env = np.sin(np.pi * np.clip(u, 0, 1)) ** 1.6
    y = y * env
    if big:  # low air underneath
        y += lp(noise(n, 77), 220) * env * 0.6
    st = pan_sweep(norm(y, 0.8), float(c.get('from', 0)), float(c.get('to', 0)))
    return fade(st, 0.005, 0.03)


def sfx_swish(c):
    dur = float(c.get('dur', 0.6))
    n = int(dur * SR)
    x = noise(n, 31 + int(dur * 100))

    def fc(tt):
        u = np.clip(tt / dur, 0, 1)
        return 7000 * (1800 / 7000) ** u

    y = stft_shape(x, lambda tt, f: band_mask(tt, f, fc, 1.1))
    u = np.linspace(0, 1, n)
    env = np.minimum(1, u / 0.18) * (1 - u) ** 1.5
    st = pan_sweep(norm(y * env, 0.7), float(c.get('from', 0)), float(c.get('to', 0)))
    return fade(st, 0.004, 0.03)


def sfx_riser(c):
    dur = float(c.get('dur', 1.6))
    n = int(dur * SR)
    t = tvec(n)
    u = t / dur
    x = noise(n, 1201)
    y = stft_shape(x, lambda tt, f: band_mask(tt, f, lambda q: 300 * (9000 / 300) ** np.clip(q / dur, 0, 1) ** 1.4, 1.4))
    tones = np.zeros(n)
    for k, nm in enumerate(('D3', 'A3', 'D4', 'A4')):
        f0 = nf(nm)
        f = f0 * 2 ** (u ** 1.6)  # each rises an octave → lands on D/A again
        tones += np.sin(2 * np.pi * np.cumsum(f) / SR) * (0.6 if k < 2 else 0.35)
    env = u ** 2.6
    out = (norm(y, 0.6) * 0.8 + norm(tones, 0.5) * 0.55) * env
    st = np.stack([out * (1 + 0.15 * np.sin(2 * np.pi * 0.7 * t)), out * (1 - 0.15 * np.sin(2 * np.pi * 0.7 * t))], axis=1)
    return fade(st, 0.01, 0.006)


def sfx_trace(c):
    dur = float(c.get('dur', 1.0))
    n = int((dur + 0.6) * SR)
    out = np.zeros((n, 2))
    r = rng(int(dur * 1000) + 5)
    notes = ['D6', 'F6', 'A6', 'C7', 'D7', 'E7', 'F7', 'A7']
    k = 0
    tt = 0.0
    while tt < dur:
        u = tt / dur
        speed = 0.35 + 1.8 * np.sin(np.pi * u)  # follows the pen: fastest mid-stroke
        f = nf(notes[int(r.integers(0, len(notes)))])
        b = bell(f, 0.5, ratio=2.0, index=1.2, decay=0.12, seed=k)
        out[int(tt * SR): int(tt * SR) + len(b)] += pan2(b, r.uniform(-0.7, 0.7))[: n - int(tt * SR)] * (0.25 + 0.5 * np.sin(np.pi * u))
        tt += 0.06 / speed * (0.6 + 0.8 * r.random())
        k += 1
    sizzle = hp(noise(n, 88), 6000) * np.clip(np.sin(np.pi * np.clip(tvec(n) / dur, 0, 1)), 0, None) * 0.08
    out += stereo(sizzle)
    return fade(norm(out, 0.7), 0.01, 0.2)


def sfx_bloom(c):
    small = bool(c.get('small'))
    n = int((3.6 if not small else 3.0) * SR)
    t = tvec(n)
    # sub boom
    f = 32 + 36 * np.exp(-t / 0.22)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / (1.1 if not small else 0.7)) * np.minimum(1, t / 0.004)
    # body / air burst
    body = lp(noise(n, 4), 900) * np.exp(-t / 0.18) * 0.5
    air = hp(noise(n, 5), 5000) * np.exp(-t / 0.6) * 0.12
    # chime cluster (D minor add9), slightly spread in time
    chime = np.zeros((n, 2))
    for k, (nm, p, dt) in enumerate((('D5', -0.3, 0.0), ('A5', 0.3, 0.012), ('D6', -0.1, 0.02), ('E6', 0.25, 0.03), ('F6', -0.35, 0.04))):
        b = bell(nf(nm), 3.2, ratio=3.5 if k % 2 else 2.0, index=2.0, decay=1.6 if not small else 1.1, seed=k)
        i = int(dt * SR)
        chime[i: i + len(b)] += pan2(b, p)[: n - i]
    out = stereo(norm(sub, 1.0) * (0.95 if not small else 0.6)) + stereo(body + air) + chime * 0.42
    return fade(out, 0.001, 0.4)


def sfx_shine(c):
    dur = float(c.get('dur', 0.9))
    n = int((dur + 1.2) * SR)
    out = np.zeros((n, 2))
    for k, (nm, at) in enumerate((('A6', 0.1), ('D7', 0.28), ('F7', 0.42))):
        b = bell(nf(nm), 1.2, ratio=2.0, index=1.0, decay=0.45, seed=40 + k)
        i = int(at * SR)
        out[i: i + len(b)] += pan2(b, -0.4 + 0.4 * k)[: n - i] * (0.7 - 0.15 * k)
    x = hp(noise(n, 41), 5000)
    u = np.clip(tvec(n) / dur, 0, 1)
    out += stereo(x * np.sin(np.pi * u) ** 2 * 0.12)
    return fade(norm(out, 0.6), 0.005, 0.2)


def sfx_settle(c):
    n = int(0.6 * SR)
    t = tvec(n)
    f = 62 + 40 * np.exp(-t / 0.05)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.16)
    x += lp(noise(n, 9), 1200) * np.exp(-t / 0.02) * 0.3
    return stereo(fade(norm(x, 0.8), 0.002, 0.05))


def sfx_ui_pop(c):
    f = nf(c.get('note', 'A5'))
    n = int(0.35 * SR)
    t = tvec(n)
    fr = f * (0.72 + 0.28 * (1 - np.exp(-t / 0.012)))
    x = np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-t / 0.075)
    x += 0.25 * np.sin(2 * np.pi * np.cumsum(fr * 2) / SR) * np.exp(-t / 0.03)
    x += hp(noise(n, 13), 3000) * np.exp(-t / 0.002) * 0.15
    return stereo(fade(norm(x, 0.75), 0.0008, 0.03))


def sfx_click(c):
    n = int(0.16 * SR)
    t = tvec(n)
    out = np.zeros(n)
    for k, (at, g, fr) in enumerate(((0.0, 1.0, 3400), (0.058, 0.55, 2700))):
        i = int(at * SR)
        m = n - i
        tt = tvec(m)
        s = hp(noise(m, 60 + k), 2000) * np.exp(-tt / 0.0012) * 0.8
        s += np.sin(2 * np.pi * fr * tt) * np.exp(-tt / 0.005) * 0.6
        s += np.sin(2 * np.pi * 900 * tt) * np.exp(-tt / 0.008) * 0.35
        out[i:] += s * g
    return stereo(fade(norm(out, 0.75), 0.0003, 0.02))


def sfx_key(c):
    s = int(c.get('seed', 0))
    r = rng(2000 + s)
    space = c.get('kind') == 'space'
    n = int(0.2 * SR)
    t = tvec(n)
    f = (175 if space else 255) * (1 + 0.16 * (r.random() - 0.5))
    thock = np.sin(2 * np.pi * f * t) * np.exp(-t / (0.03 if space else 0.018))
    thock += bp(noise(n, 3000 + s), 350, 1600) * np.exp(-t / (0.014 if space else 0.009)) * 0.8
    clk = hp(noise(n, 4000 + s), 3500) * np.exp(-t / 0.0016) * 0.55
    x = thock * 0.9 + clk
    rel = int((0.075 + 0.03 * r.random()) * SR)  # key release
    x[rel:] += (hp(noise(n - rel, 5000 + s), 3000) * np.exp(-tvec(n - rel) / 0.0014) * 0.25)[: n - rel]
    g = 0.8 + 0.4 * r.random()
    return pan2(fade(norm(x, 0.75) * g, 0.0003, 0.02), (r.random() - 0.5) * 0.3)


def sfx_send(c):
    n = int(0.45 * SR)
    t = tvec(n)
    f = 420 * (1250 / 420) ** np.clip(t / 0.13, 0, 1) ** 0.8
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.minimum(1, t / 0.01) * np.exp(-np.clip(t - 0.05, 0, None) / 0.09)
    air = stft_shape(noise(n, 17), lambda tt, ff: band_mask(tt, ff, lambda q: 1500 * (6500 / 1500) ** np.clip(q / 0.25, 0, 1), 1.2))
    air *= np.sin(np.pi * np.clip(t / 0.3, 0, 1)) ** 2
    x = norm(tone, 0.6) * 0.75 + norm(air, 0.5) * 0.5
    return pan_sweep(fade(x, 0.002, 0.05), 0.1, -0.25)


def sfx_tick(c):
    n = int(0.12 * SR)
    t = tvec(n)
    x = np.sin(2 * np.pi * 2650 * t) * np.exp(-t / 0.018) + hp(noise(n, 23), 3000) * np.exp(-t / 0.0015) * 0.4
    return stereo(fade(norm(x, 0.6), 0.0004, 0.02))


def sfx_chime(c):
    notes = c.get('notes', ['A5', 'D6'])
    n = int(2.4 * SR)
    out = np.zeros((n, 2))
    for k, nm in enumerate(notes):
        b = bell(nf(nm), 2.2, ratio=2.0, index=1.5, decay=0.85, seed=70 + k)
        i = int(k * 0.07 * SR)
        out[i: i + len(b)] += pan2(b, (-0.25 + 0.5 * (k / max(1, len(notes) - 1))) if len(notes) > 1 else 0)[: n - i]
    return fade(norm(out, 0.7), 0.001, 0.3)


def sfx_stream(c):
    times = c['times']
    t0 = times[0]
    n = int((times[-1] - t0 + 0.3) * SR)
    out = np.zeros((n, 2))
    r = rng(int(t0 * 100))
    for k, tt in enumerate(times):
        m = int(0.03 * SR)
        x = bp(noise(m, 7000 + k + int(t0)), 3000, 8000) * np.exp(-tvec(m) / 0.004)
        x += np.sin(2 * np.pi * (3200 + 600 * r.random()) * tvec(m)) * np.exp(-tvec(m) / 0.006) * 0.3
        i = int((tt - t0) * SR)
        out[i: i + m] += pan2(x * (0.6 + 0.4 * r.random()), r.uniform(-0.35, 0.35))[: n - i]
    return fade(norm(out, 0.6), 0.001, 0.05)


def sfx_marker(c):
    n = int(0.36 * SR)
    t = tvec(n)
    x = stft_shape(noise(n, 91), lambda tt, f: band_mask(tt, f, lambda q: 2200 + 1400 * np.clip(q / 0.36, 0, 1), 0.9))
    env = np.minimum(1, t / 0.03) * np.exp(-np.clip(t - 0.22, 0, None) / 0.04)
    return stereo(fade(norm(x * env, 0.6), 0.003, 0.03))


def sfx_toggle(c):
    n = int(0.25 * SR)
    out = np.zeros(n)
    for k, (at, fr, g) in enumerate(((0.0, 2300, 1.0), (0.055, 1500, 0.7))):
        i = int(at * SR)
        tt = tvec(n - i)
        s = np.sin(2 * np.pi * fr * tt) * np.exp(-tt / 0.012) + hp(noise(n - i, 80 + k), 2500) * np.exp(-tt / 0.0015) * 0.5
        s += np.sin(2 * np.pi * 160 * tt) * np.exp(-tt / 0.02) * 0.3
        out[i:] += s * g
    return stereo(fade(norm(out, 0.7), 0.0004, 0.02))


def sfx_powerdown(c):
    n = int(1.3 * SR)
    t = tvec(n)
    f = 880 * (85 / 880) ** np.clip(t / 0.75, 0, 1) ** 0.9
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.3 * np.sin(2 * np.pi * np.cumsum(f * 1.5) / SR)
    tone *= np.exp(-np.clip(t - 0.55, 0, None) / 0.12) * np.minimum(1, t / 0.01)
    tone = stft_shape(tone, lambda tt, ff: np.clip(1 / (1 + (ff[:, None] / (5000 * (300 / 5000) ** np.clip(tt[None, :] / 0.8, 0, 1))) ** 4), 0, 1))
    thud = np.sin(2 * np.pi * np.cumsum(55 + 35 * np.exp(-np.clip(t - 0.62, 0, None) / 0.05)) / SR) * (t > 0.62) * np.exp(-np.clip(t - 0.62, 0, None) / 0.2)
    breath = lp(noise(n, 33), 1500) * np.exp(-t / 0.3) * 0.15
    x = norm(tone, 0.6) + norm(thud, 0.6) * 0.8 + breath
    return stereo(fade(x, 0.003, 0.1))


def sfx_lock(c):
    n = int(2.4 * SR)
    t = tvec(n)
    f = 70 + 60 * np.exp(-t / 0.03)
    thump = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.15)
    metal = sum(np.sin(2 * np.pi * fr * t) * np.exp(-t / dk) * g for fr, dk, g in ((1130, 0.09, 0.5), (2290, 0.06, 0.35), (3710, 0.04, 0.25), (5230, 0.03, 0.15)))
    metal += hp(noise(n, 44), 3000) * np.exp(-t / 0.004) * 0.4
    ding = bell(nf('A5'), 2.4, ratio=2.0, index=1.4, decay=1.0, seed=45)
    ding2 = bell(nf('D6'), 2.4, ratio=3.5, index=1.0, decay=0.9, seed=46)
    x = stereo(norm(thump, 0.8) * 0.8 + norm(metal, 0.6) * 0.6) + pan2(ding, -0.15) * 0.5 + pan2(ding2, 0.15) * 0.35
    return fade(x, 0.0005, 0.2)


def sfx_check(c):
    f = nf(c.get('note', 'D5'))
    n = int(1.6 * SR)
    t = tvec(n)
    b = bell(f, 1.6, ratio=2.0, index=1.6, decay=0.6, seed=int(f))
    b2 = bell(f * 2, 1.6, ratio=3.0, index=0.8, decay=0.35, seed=int(f) + 1) * 0.35
    tick = np.sin(2 * np.pi * 3000 * t) * np.exp(-t / 0.006) * 0.3
    return stereo(fade(b + b2 + tick, 0.0005, 0.2))


def sfx_slide(c):
    n = int(0.42 * SR)
    t = tvec(n)
    x = stft_shape(noise(n, 61), lambda tt, f: band_mask(tt, f, lambda q: 1500 * (4200 / 1500) ** np.clip(q / 0.28, 0, 1), 1.0))
    x *= np.sin(np.pi * np.clip(t / 0.3, 0, 1)) ** 2
    end = int(0.3 * SR)
    x[end:] += (np.sin(2 * np.pi * 2400 * tvec(n - end)) * np.exp(-tvec(n - end) / 0.01) * 0.5)[: n - end]
    return stereo(fade(norm(x, 0.6), 0.003, 0.03))


def sfx_scan(c):
    dur = float(c.get('dur', 1.1))
    n = int((dur + 0.2) * SR)
    t = tvec(n)
    x = stft_shape(noise(n, 71), lambda tt, f: band_mask(tt, f, lambda q: 900 * (5000 / 900) ** np.clip(q / dur, 0, 1), 0.8))
    x *= (0.75 + 0.25 * np.sin(2 * np.pi * 32 * t)) * np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 0.8
    hum = np.sin(2 * np.pi * 440 * t) * 0.08 * np.sin(np.pi * np.clip(t / dur, 0, 1))
    return stereo(fade(norm(x + hum, 0.6), 0.01, 0.05))


def sfx_fill(c):
    dur = float(c.get('dur', 1.0))
    n = int((dur + 0.4) * SR)
    t = tvec(n)
    f = nf('D5') * (nf('A5') / nf('D5')) ** np.clip(t / dur, 0, 1)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * np.clip(t / dur, 0, 1) * 0.5) ** 2 * np.exp(-np.clip(t - dur, 0, None) / 0.08)
    return stereo(fade(norm(x, 0.5), 0.01, 0.05))


def sfx_dive(c):
    dur = float(c.get('dur', 1.3))
    n = int((dur + 0.8) * SR)
    t = tvec(n)
    u = np.clip(t / dur, 0, 1)
    x = stft_shape(noise(n, 81), lambda tt, f: band_mask(tt, f, lambda q: 180 * (3200 / 180) ** np.clip(q / dur, 0, 1) ** 1.6, 1.8))
    env = u ** 2.2 * np.exp(-np.clip(t - dur, 0, None) / 0.18)
    sub = np.sin(2 * np.pi * np.cumsum(38 + 30 * u) / SR) * u ** 2 * np.exp(-np.clip(t - dur, 0, None) / 0.3)
    out = stereo(norm(x * env, 0.7) + norm(sub, 0.6) * 0.7)
    return fade(out, 0.01, 0.2)


def sfx_slam(c):
    """the hook hit: punchy sub drop + crack + short air tail (opens the reel)"""
    n = int(1.8 * SR)
    t = tvec(n)
    f = 38 + 90 * np.exp(-t / 0.06)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.55) * np.minimum(1, t / 0.002)
    crack = hp(noise(n, 501), 1800) * np.exp(-t / 0.018) * 0.9
    body = bp(noise(n, 502), 120, 900) * np.exp(-t / 0.09) * 0.7
    air = hp(noise(n, 503), 4500) * np.exp(-t / 0.35) * 0.12
    x = np.tanh(1.6 * (norm(sub, 1.0) + crack + body)) / np.tanh(1.6) + air
    st = np.stack([x * 1.0, x * 0.96], axis=1)
    st[:, 1] = np.roll(st[:, 1], int(0.004 * SR))  # a touch of width
    return fade(norm(st, 0.9), 0.0005, 0.3)


def sfx_glitch(c):
    """signal lost: stuttered, bit-crushed bursts (airplane mode on)"""
    dur = float(c.get('dur', 0.45))
    n = int((dur + 0.1) * SR)
    out = np.zeros(n)
    r = rng(611)
    t = 0.0
    k = 0
    while t < dur:
        ln = 0.012 + 0.03 * r.random()
        m = int(ln * SR)
        i = int(t * SR)
        seg = np.sign(np.sin(2 * np.pi * (300 + 2200 * r.random()) * tvec(m))) * 0.5
        seg += bp(noise(m, 620 + k), 800, 6000) * 0.8
        hold = int(1 + 6 * r.random())  # sample-and-hold "bit crush"
        seg = np.repeat(seg[::hold], hold)[:m]
        out[i: i + m] += seg[: n - i] * np.exp(-tvec(m) / (ln * 0.8))[: n - i] * (1 - t / dur * 0.6)
        t += ln + 0.02 * r.random()
        k += 1
    return pan_sweep(fade(norm(lp(out, 7000), 0.6), 0.001, 0.05), -0.3, 0.3)


def sfx_shutter(c):
    """phone camera: two mechanical clicks and a short air breath"""
    n = int(0.4 * SR)
    t = tvec(n)
    out = np.zeros(n)
    for k, at in enumerate((0.0, 0.085)):
        i = int(at * SR)
        tt = tvec(n - i)
        s = hp(noise(n - i, 700 + k), 1500) * np.exp(-tt / 0.004) + np.sin(2 * np.pi * (1900 - 500 * k) * tt) * np.exp(-tt / 0.01) * 0.5
        s += np.sin(2 * np.pi * 220 * tt) * np.exp(-tt / 0.02) * 0.4
        out[i:] += s * (1.0 - 0.3 * k)
    out += bp(noise(n, 710), 2000, 8000) * np.exp(-t / 0.06) * 0.2
    return stereo(fade(norm(out, 0.8), 0.0003, 0.03))


SFX = {k[4:]: v for k, v in globals().items() if k.startswith('sfx_')}


# =====================================================================================================
# music
# =====================================================================================================
PAD = {
    'Dm': ['D3', 'A3', 'D4', 'F4', 'A4'],
    'Bb': ['Bb2', 'F3', 'D4', 'F4', 'Bb4'],
    'F': ['F2', 'C3', 'C4', 'F4', 'A4'],
    'C': ['C3', 'G3', 'C4', 'E4', 'G4'],
    'A': ['A2', 'E3', 'C#4', 'E4', 'A4'],
}
ARP = {
    'Dm': ['D4', 'F4', 'A4', 'D5', 'E5'],
    'Bb': ['Bb3', 'D4', 'F4', 'Bb4', 'C5'],
    'F': ['F4', 'A4', 'C5', 'F5', 'G5'],
    'C': ['C4', 'E4', 'G4', 'C5', 'D5'],
    'A': ['A3', 'C#4', 'E4', 'A4', 'B4'],
}
ROOT = {'Dm': 'D2', 'Bb': 'Bb1', 'F': 'F2', 'C': 'C2', 'A': 'A1'}
ARP_PATTERN = [0, 2, 3, 2, 4, 2, 3, 1]


def build_music():
    chords = M['chords']
    drums = M['drums']
    nb = len(chords)
    pad_bus = Bus()
    bass_bus = Bus()
    arp_bus = Bus()
    bell_bus = Bus()
    drum_bus = Bus()
    motif_bus = Bus()
    kick_times = []

    # arrangement knobs (defaults = the 64 s film; the reel overrides them in its MUSIC plan)
    intro_bars = M.get('introBars', 4)
    drop_bar = M.get('dropBar', 16)
    arp_end = M.get('arpEndBar', 30)
    outro_bar = M.get('outroBar', 28)
    quiet = set(M.get('quietBars', list(range(4, 8)) + list(range(20, 24)) + list(range(28, 32))))
    split = set(M.get('padSplit', [4, 28]))
    accents = M.get('accents', [[16.0, ['A5', 'D6']], [34.0, ['D6', 'F6']], [40.0, ['D6']], [48.0, ['D6', 'A6']], [58.0, ['A5', 'D6', 'F6']]])
    light_clap_from = M.get('lightClapFrom', 20)
    pad_attack0 = M.get('padAttack0', 2.6)

    # ---- pads: merge repeated chords into one long note
    segs = []
    for b, ch in enumerate(chords):
        if segs and segs[-1][0] == ch and b not in split:
            segs[-1][2] += 1
        else:
            segs.append([ch, b, 1])
    for k, (ch, b0, nbars) in enumerate(segs):
        t0 = b0 * BAR
        dur = nbars * BAR
        attack = pad_attack0 if b0 == 0 else 0.35
        seg = pad_segment(PAD[ch], dur + 0.15, seed=k + 1, attack=attack, release=1.6 if b0 < outro_bar else 4.0)
        pad_bus.add(seg, t0 - 0.05)

    # ---- bass
    for b, ch in enumerate(chords):
        if b < intro_bars:
            continue
        f = nf(ROOT[ch])
        t0 = b * BAR
        dr = drums[b]
        if dr >= 2:
            for st, ln in ((0, 5.5), (6, 3.5), (10, 5.5)):
                bass_bus.add(bass_note(f, ln * STEP, seed=b * 10 + st), t0 + st * STEP, -1.0 if st else 0.0)
        elif b == drop_bar:
            continue  # the drop: no bass
        else:
            bass_bus.add(bass_note(f, BAR - 0.05, seed=b), t0, -2.0)

    # ---- plucked arpeggio (8ths), skipped in the intro, the drop bar and the final bars
    for b, ch in enumerate(chords):
        if b < intro_bars or b == drop_bar or b >= arp_end:
            continue
        t0 = b * BAR
        lvl = -3.0 if b in quiet else 0.0
        tones = ARP[ch]
        step = 2 if b < outro_bar else 4  # outro: quarter notes
        for i in range(0, 16, step):
            nm = tones[ARP_PATTERN[(i // 2) % 8]]
            acc = 0.0 if i % 8 == 0 else (-2.5 if i % 4 == 0 else -4.5)
            p = pluck(nf(nm), 2.0, bright=0.45, seed=b * 100 + i)
            arp_bus.add(p, t0 + i * STEP, lvl + acc, pan=0.35 * np.sin(i * 0.9 + b))

    # ---- accent bells on section starts
    for t, notes in accents:
        for k, nm in enumerate(notes):
            bell_bus.add(bell(nf(nm), 3.5, ratio=3.5, index=1.6, decay=1.4, seed=int(t * 10) + k), t + k * 0.03, -3.0, pan=-0.3 + 0.6 * k / max(1, len(notes) - 1))
    # reverse swell into the beat's return after the drop
    rev = bell(nf('D5'), 1.8, ratio=2.0, index=2.0, decay=0.9, seed=3)[::-1]
    rev = rev * np.linspace(0, 1, len(rev)) ** 2
    bell_bus.add(rev, M['drop']['end'] - len(rev) / SR, -2.0)

    # ---- sonic logo: A–B♭–C♯ → D (pluck + bell doubling)
    for k, (t, nm) in enumerate(M['motif']):
        last = nm.startswith('D')
        p = pluck(nf(nm), 3.2 if last else 1.4, bright=0.75, decay=0.998 if last else 0.996, seed=900 + k)
        motif_bus.add(p, t, 0.0 if last else -2.0, pan=(-0.15, 0.1, -0.05, 0.0)[k % 4])
        motif_bus.add(bell(nf(nm) * 2, 2.5 if last else 1.0, ratio=2.0, index=1.0, decay=0.9 if last else 0.3, seed=950 + k), t, -9.0 if last else -12.0)

    # ---- drums
    def maqsum(t0, lvl):
        for st, kind in ((0, 'D'), (2, 'T'), (6, 'T'), (8, 'D'), (12, 'T'), (14, 'T')):
            g = lvl + (0 if st in (0, 8) else -3)
            drum_bus.add(doum(st) if kind == 'D' else tak(st + int(t0)), t0 + st * STEP, g + (-4 if kind == 'D' else -8), pan=-0.25 if kind == 'T' else 0.1)

    for b, dr in enumerate(drums):
        t0 = b * BAR
        if dr == 0:
            continue
        for i in range(16):  # 16ths
            tt = t0 + i * STEP + (0.012 if i % 2 else 0)  # tiny swing
            if dr >= 1:
                drum_bus.add(shaker(b * 16 + i), tt, (-17 if i % 4 else -13) - (4 if dr == 1 else 0), pan=0.3)
                if i % 4 == 2:
                    drum_bus.add(hat(b * 16 + i), tt, -11 if dr >= 2 else -14, pan=-0.2)
            if dr >= 2:
                if i in (0, 6, 10):
                    drum_bus.add(kick(b + i, 1.0), t0 + i * STEP, 0.0 if i == 0 else -2.5)
                    kick_times.append(t0 + i * STEP)
                if i == 8:
                    drum_bus.add(clap(b), t0 + i * STEP, -5.0, pan=0.05)
            elif dr == 1 and i == 8 and b >= light_clap_from:
                drum_bus.add(clap(b), t0 + i * STEP, -11.0)
            if dr == 3 and i == 14:
                drum_bus.add(hat(b, open_=True), tt, -13.0, pan=-0.3)
        if dr == 3:
            maqsum(t0, -2.0)

    return pad_bus, bass_bus, arp_bus, bell_bus, drum_bus, motif_bus, kick_times


def sidechain(kick_times, depth_db=-4.0, release=0.22):
    g = np.ones(N_TOTAL)
    t = tvec(N_TOTAL)
    duck = np.zeros(N_TOTAL)
    for kt in kick_times:
        i = int(kt * SR)
        m = min(N_TOTAL - i, int(0.6 * SR))
        if m <= 0:
            continue
        tt = tvec(m)
        duck[i: i + m] = np.maximum(duck[i: i + m], np.exp(-tt / release) * np.minimum(1, tt / 0.004))
    g = db(depth_db * duck)
    return g


def music_eq(x):
    """section brightness + the "internet off" drop (muffled, quieter, then opens up again)"""
    d0 = M['drop']['start']
    d1 = M['drop']['end']

    def cutoff(tt):
        c = np.full_like(tt, 16000.0)
        ie = M.get('introEnd', 8.0)
        if ie > 0:
            intro = tt < ie
            c[intro] = 650 * (9000 / 650) ** np.clip((tt[intro] - (ie - 6.0)) / 6.0, 0, 1) ** 2.2
        drop = (tt >= d0) & (tt < d1)
        u_in = np.clip((tt - d0) / 0.12, 0, 1)
        u_out = np.clip((tt - (d1 - 0.5)) / 0.5, 0, 1)
        c_drop = 16000 * (380 / 16000) ** u_in
        c_drop = c_drop * (16000 / 380) ** (u_out ** 2)
        c[drop] = c_drop[drop]
        return c

    def gain(tt, f):
        c = cutoff(tt)[None, :]
        g = 1 / np.sqrt(1 + (f[:, None] / c) ** 4)
        level = np.ones_like(tt)
        drop = (tt >= d0) & (tt < d1)
        level[drop] = db(-5.0)
        return g * level[None, :]

    return np.stack([stft_shape(x[:, ch], gain, nper=4096) for ch in range(2)], axis=1)


# =====================================================================================================
# mix
# =====================================================================================================
def build_sfx():
    dry = Bus()
    for c in D['cues']:
        fn = SFX.get(c['id'])
        if fn is None:
            print('  ! no generator for', c['id'])
            continue
        s = fn(c)
        p = float(c.get('pan', 0))
        if s.ndim == 2 and p:
            # place a stereo effect toward the requested side, keeping some of its own width
            s = s * 0.4 + pan2(s.mean(axis=1), p) * 0.6 * np.sqrt(2)
            p = 0.0
        dry.add(s, c['t'], float(c.get('gain', 0)), p)
    return dry.x


def limiter(x, ceiling_db=-1.0, release=0.08, lookahead=0.004):
    ceil = db(ceiling_db)
    peak = np.max(np.abs(x), axis=1)
    la = int(lookahead * SR)
    peak = np.concatenate([peak[la:], np.zeros(la)])
    # sliding max over the lookahead window
    from scipy.ndimage import maximum_filter1d

    pk = maximum_filter1d(peak, size=2 * la + 1)
    g_target = np.minimum(1.0, ceil / np.maximum(pk, 1e-9))
    # smooth: instant attack, exponential release
    a = np.exp(-1 / (release * SR))
    g = signal.lfilter([1 - a], [1, -a], g_target)
    g = np.minimum(g, g_target)
    return x * g[:, None]


def main():
    print('music…')
    pad, bass, arp, bells, drums, motif, kicks = build_music()
    sc = sidechain(kicks)
    ir_long = make_ir(2.8, seed=11, predelay=0.02, width=1.0)
    ir_mid = make_ir(1.6, seed=21, predelay=0.012)
    ir_room = make_ir(0.6, seed=31, predelay=0.006, hi_damp=0.6)

    pad_x = lp(pad.x, 2000.0) * db(-13.5) * sc[:, None]  # warm: roll the saw harmonics off
    bass_x = bass.x * db(-13.0) * sc[:, None]
    arp_dry = arp.x * db(-6.0)
    arp_x = arp_dry + pingpong(arp_dry, 0.375, fb=0.38, repeats=5) * 0.55
    bell_x = bells.x * db(-17.0)
    drum_x = drums.x * db(-12.0)
    motif_x = motif.x * db(-3.5)

    for lo, hi in ((16, 30), (7, 10), (48, 56)):
        sect = slice(int(lo * SR), int(hi * SR))
        print(f'  [{lo}-{hi}s] ' + '  '.join(f'{name} {20 * np.log10(np.sqrt(np.mean(x[sect] ** 2)) + 1e-12):6.1f}' for name, x in (('pad', pad_x), ('bass', bass_x), ('arp', arp_x), ('bells', bell_x), ('drums', drum_x), ('motif', motif_x))))
    music = pad_x + bass_x + arp_x + bell_x + drum_x + motif_x
    music += reverb(pad_x + arp_x * 1.2 + bell_x * 1.4 + motif_x * 1.1, ir_long, 0.32)
    music += reverb(drum_x, ir_room, 0.12)
    music = music_eq(music)
    print('sfx…')
    sfx = build_sfx()
    sfx_send = reverb(sfx, ir_mid, 0.16)
    mix = music * db(-3.0) + sfx + sfx_send

    # end: gentle fade with the picture
    t = tvec(N_TOTAL)
    fo0, fo1 = D['keys']['fadeOut']
    fade_end = np.where(t < fo0, 1.0, np.clip(1 - (t - fo0) / (DUR - fo0), 0, 1) ** 1.6)
    mix *= fade_end[:, None]
    mix = mix[: int(DUR * SR)]
    # fade-in guard
    mix[: int(0.02 * SR)] *= np.linspace(0, 1, int(0.02 * SR))[:, None]
    mix = limiter(mix * db(0.0), -1.5)
    peak = np.max(np.abs(mix))
    rms = np.sqrt(np.mean(mix ** 2))
    print(f'peak {20 * np.log10(peak):.2f} dBFS, rms {20 * np.log10(rms):.2f} dBFS, {len(mix) / SR:.2f}s')
    wavfile.write(OUT, SR, mix.astype(np.float32))
    # stems for inspection / re-mixing
    stem_dir = os.path.join(os.path.dirname(OUT), 'stems')
    os.makedirs(stem_dir, exist_ok=True)
    wavfile.write(os.path.join(stem_dir, 'music.wav'), SR, (music * db(-3.0))[: int(DUR * SR)].astype(np.float32))
    wavfile.write(os.path.join(stem_dir, 'sfx.wav'), SR, (sfx + sfx_send)[: int(DUR * SR)].astype(np.float32))
    print('wrote', OUT)


if __name__ == '__main__':
    main()
