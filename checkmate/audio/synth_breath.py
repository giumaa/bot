"""Scared, fast first-person breathing (close-mic): fast breaths, a sharp gasp, panicked breathing.
python3 synth_breath.py <outdir>
"""
import os, sys
import numpy as np
from scipy import signal
from synth_sfx import SR, white, filt, save, reverb

rng = np.random.default_rng(21)


def formant_noise(n, formants, bw=0.18):
    """Aspirated noise shaped by vocal-tract resonances (breath through an open mouth)."""
    w = white(n)
    out = np.zeros(n)
    for f, g in formants:
        lo, hi = f * (1 - bw), f * (1 + bw)
        out += filt(w, 'bandpass', [lo, hi], 2) * g
    return out


def breath(kind, dur, amp=1.0, shake=0.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    if kind == 'in':
        # inhale: brighter, airy, through teeth/lips, slight whistle
        x = formant_noise(n, [(900, 0.5), (1700, 0.8), (3100, 0.9), (5200, 0.5)])
        x += filt(white(n), 'highpass', 6000, 2) * 0.25
        e = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 0.6
        e *= np.clip(t / (0.35 * dur), 0, 1) ** 0.5
    else:
        # exhale: warmer 'haaa', a touch of voiced tremble when scared
        x = formant_noise(n, [(650, 1.0), (1150, 0.8), (2500, 0.45)], 0.22)
        if shake > 0:
            f0 = 150 + 25 * rng.standard_normal() + 10 * np.sin(2 * np.pi * 7 * t)
            ph = 2 * np.pi * np.cumsum(f0) / SR
            voiced = signal.sawtooth(ph) * (0.5 + 0.5 * np.sin(2 * np.pi * 9 * t))
            voiced = filt(voiced, 'bandpass', [300, 2200], 2)
            x += voiced * shake * 0.35
        e = np.exp(-t / (0.45 * dur)) * np.clip(t / 0.03, 0, 1)
    tremolo = 1 + 0.25 * shake * np.sin(2 * np.pi * rng.uniform(8, 12) * t)
    return x * e * tremolo * amp


def sequence(total, period0, period1, shake, gasp_at=None):
    n = int(total * SR)
    out = np.zeros(n)
    tt = 0.05
    while tt < total - 0.2:
        p = period0 + (period1 - period0) * tt / total
        p *= rng.uniform(0.85, 1.15)
        din, dout = p * 0.42, p * 0.5
        s = int(tt * SR)
        b = breath('in', din, rng.uniform(0.7, 1.0), shake)
        out[s:s + len(b)] += b[:max(0, n - s)]
        s2 = int((tt + din * 0.95) * SR)
        b = breath('out', dout, rng.uniform(0.8, 1.1), shake)
        out[s2:s2 + len(b)] += b[:max(0, n - s2)]
        tt += p
    return out


def gasp(dur=1.1):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = breath('in', 0.42, 1.4, 0.8)
    out = np.zeros(n)
    out[:len(x)] += x * np.linspace(0.6, 1.2, len(x))
    # held breath, then a shaky tiny release
    rel = breath('out', 0.35, 0.35, 1.0)
    s = int(0.72 * SR)
    out[s:s + len(rel)] += rel[:n - s]
    return out


def mouth_clicks(x, count):
    n = len(x)
    for _ in range(count):
        s = rng.integers(0, n - 200)
        x[s:s + 60] += filt(white(60), 'highpass', 2500, 2) * np.hanning(60) * 0.25
    return x


if __name__ == '__main__':
    od = sys.argv[1] if len(sys.argv) > 1 else 'sfx'
    os.makedirs(od, exist_ok=True)
    fast = mouth_clicks(sequence(7.0, 0.85, 0.62, 0.35), 6)
    save(od, 'breath_fast_scared', reverb(filt(fast, 'highpass', 90, 2), 0.6, 0.08, 7000), 0.8)
    panic = mouth_clicks(sequence(5.0, 0.55, 0.42, 0.8), 5)
    save(od, 'breath_panic', reverb(filt(panic, 'highpass', 90, 2), 0.6, 0.08, 7000), 0.85)
    save(od, 'breath_gasp', reverb(filt(gasp(), 'highpass', 90, 2), 0.6, 0.1, 7000), 0.85)
    held = sequence(4.0, 1.1, 0.9, 0.5) * np.linspace(0.6, 1.0, int(4.0 * SR))
    save(od, 'breath_held_shaky', reverb(filt(held, 'highpass', 90, 2), 0.6, 0.08, 7000), 0.7)
