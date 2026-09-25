"""Procedural sound effects for 'Checkmate' (48 kHz stereo WAV).
python3 synth_sfx.py <outdir>
"""
import os, sys
import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48000
rng = np.random.default_rng(7)


def t_(dur):
    return np.arange(int(dur * SR)) / SR


def white(n):
    return rng.standard_normal(n)


def pink(n):
    # Voss-ish via filtering white noise
    b = [0.049922035, -0.095993537, 0.050612699, -0.004408786]
    a = [1, -2.494956002, 2.017265875, -0.522189400]
    return signal.lfilter(b, a, white(n)) * 8


def brown(n):
    x = np.cumsum(white(n))
    x = signal.lfilter([1, -1], [1, -0.999], x)
    return x / (np.abs(x).max() + 1e-9)


def filt(x, kind, f, order=4):
    sos = signal.butter(order, f, btype=kind, fs=SR, output='sos')
    return signal.sosfilt(sos, x, axis=0)


def env_exp(n, tau, attack=0.002):
    t = np.arange(n) / SR
    e = np.exp(-t / tau)
    a = int(attack * SR)
    if a > 0:
        e[:a] *= np.linspace(0, 1, a)
    return e


def stereo(x, width=0.0, delay_ms=0.0):
    if x.ndim == 2:
        return x
    d = int(delay_ms * SR / 1000)
    l = x.copy()
    r = np.roll(x, d) if d else x.copy()
    if width > 0:
        dec = filt(white(len(x)), 'lowpass', 2000) * 0.0
        r = r + dec
    return np.stack([l, r], axis=1)


def reverb(x, secs=2.5, mix=0.3, bright=6000, predelay=0.02):
    n = int(secs * SR)
    ir = np.stack([white(n), white(n)], axis=1) * np.exp(-np.arange(n) / (secs * SR / 6.9))[:, None]
    ir = filt(ir, 'lowpass', bright, 2)
    pd = int(predelay * SR)
    ir = np.concatenate([np.zeros((pd, 2)), ir])
    ir /= np.sqrt((ir ** 2).sum(axis=0, keepdims=True)) + 1e-9
    xs = stereo(x)
    wet = np.stack([signal.fftconvolve(xs[:, c], ir[:, c]) for c in range(2)], axis=1)
    out = np.zeros_like(wet)
    out[:len(xs)] += xs * (1 - mix)
    out += wet * mix
    return out


def norm(x, peak=0.89):
    return x / (np.abs(x).max() + 1e-9) * peak


def save(outdir, name, x, peak=0.89):
    x = stereo(x)
    x = norm(x, peak)
    wavfile.write(os.path.join(outdir, name + '.wav'), SR, (x * 32767).astype(np.int16))
    print('wrote', name, f'{len(x)/SR:.2f}s')


# ---------------------------------------------------------------- sounds
def storm_bed(dur=32.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros((n, 2))
    for c, seed in enumerate((0.0, 1.7)):
        w = pink(n)
        gust = 0.55 + 0.45 * np.sin(2 * np.pi * (0.07 * t + seed)) * np.sin(2 * np.pi * (0.023 * t + seed * 2))
        # moving band-pass for wind howl: blend two static bands by gust
        lo = filt(w, 'bandpass', [180, 700], 2)
        hi = filt(w, 'bandpass', [500, 1800], 2)
        wind = lo * (1 - gust) * 0.8 + hi * gust * 0.6
        rain = filt(white(n), 'highpass', 3500, 2) * 0.16
        drops = np.zeros(n)
        idx = rng.integers(0, n, int(dur * 900))
        drops[idx] = rng.uniform(-1, 1, len(idx))
        drops = filt(drops, 'bandpass', [2500, 9000], 2) * 0.9
        rumble = filt(brown(n), 'lowpass', 90, 2) * 1.6
        out[:, c] = wind * gust + rain + drops + rumble
    return out


def thunder(close=False, dur=6.0):
    n = int(dur * SR)
    x = np.zeros(n)
    if close:
        crack = filt(white(int(0.25 * SR)), 'highpass', 900, 2) * env_exp(int(0.25 * SR), 0.05, 0.0005)
        x[:len(crack)] += crack * 1.6
        # crackle tail
        k = np.zeros(int(0.8 * SR))
        idx = rng.integers(0, len(k), 500)
        k[idx] = rng.uniform(-1, 1, 500) * np.exp(-idx / (0.25 * SR))
        x[:len(k)] += filt(k, 'bandpass', [600, 6000], 2) * 2.5
    rum = filt(brown(n), 'lowpass', 160 if close else 110, 3)
    e = np.zeros(n)
    t0 = 0.02 if close else 0.25
    for k in range(6):
        start = t0 + k * rng.uniform(0.25, 0.7)
        s = int(start * SR)
        if s < n:
            e[s:] += np.exp(-(np.arange(n - s) / SR) / rng.uniform(0.6, 1.6)) * rng.uniform(0.4, 1.0)
    a = int(0.08 * SR)
    e[:a] *= np.linspace(0, 1, a)
    x += rum * e * (1.4 if close else 1.0)
    return reverb(x, secs=3.5, mix=0.35, bright=3000)


def whistle_fall(dur=1.4, f0=1900, f1=380):
    t = t_(dur)
    f = f0 * (f1 / f0) ** (t / dur)
    ph = 2 * np.pi * np.cumsum(f) / SR
    tone = np.sin(ph) * 0.5 + 0.2 * np.sin(2 * ph)
    air = filt(white(len(t)), 'bandpass', [800, 5000], 2) * 0.6
    amp = (t / dur) ** 1.6
    x = (tone * 0.55 + air) * amp
    x[-int(0.01 * SR):] *= np.linspace(1, 0, int(0.01 * SR))
    xs = np.stack([x * np.linspace(0.6, 1.0, len(x)), x * np.linspace(1.0, 0.8, len(x))], axis=1)
    return reverb(xs, 1.2, 0.2, 7000)


def impact(size=1.0, dur=4.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    fsub = 55 * size ** -0.2 * (1 + 1.5 * np.exp(-t / 0.05))
    sub = np.sin(2 * np.pi * np.cumsum(fsub) / SR) * env_exp(n, 0.55 * size, 0.001)
    body = filt(white(n), 'lowpass', 380, 3) * env_exp(n, 0.28 * size, 0.001) * 2.2
    crack = filt(white(n), 'bandpass', [1200, 7000], 2) * env_exp(n, 0.03, 0.0003) * 1.5
    x = sub * 1.5 + body + crack
    # crumble / debris grains
    k = np.zeros(n)
    m = int(900 * size)
    idx = (rng.exponential(0.5 * size, m) * SR).astype(int) + int(0.05 * SR)
    idx = idx[idx < n]
    k[idx] = rng.uniform(-1, 1, len(idx)) * np.exp(-idx / (1.2 * SR))
    x += filt(k, 'bandpass', [300, 5000], 2) * 3.0
    x = np.tanh(x * 1.2)
    return reverb(x, 3.0, 0.3, 4000)


def debris_rattle(dur=2.5):
    n = int(dur * SR)
    k = np.zeros(n)
    idx = (rng.exponential(0.5, 400) * SR).astype(int)
    idx = idx[idx < n]
    k[idx] = rng.uniform(-1, 1, len(idx))
    x = filt(k, 'bandpass', [900, 8000], 2) * 3 * np.exp(-np.arange(n) / SR / 1.0)
    return reverb(x, 1.5, 0.25)


def crack_creep(dur=3.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    # accelerating crackles, getting closer (brighter, louder)
    tt = 0.0
    while tt < dur - 0.05:
        s = int(tt * SR)
        L = int(rng.uniform(0.004, 0.02) * SR)
        g = rng.uniform(0.3, 1.0) * (0.3 + 0.7 * tt / dur)
        x[s:s + L] += white(L) * np.exp(-np.arange(L) / (0.004 * SR)) * g
        tt += rng.exponential(0.035 * (1.4 - tt / dur))
    x = filt(x, 'bandpass', [700, 9000], 2) * 2
    groan = filt(brown(n), 'lowpass', 120, 2) * np.linspace(0.2, 1, n) * 0.8
    return reverb(x + groan, 1.6, 0.25, 6000)


def rumble_quake(dur=12.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = filt(brown(n), 'lowpass', 70, 4) * 3
    sub = np.sin(2 * np.pi * 31 * t + 2 * np.sin(2 * np.pi * 0.7 * t)) * 0.6
    grit = filt(white(n), 'bandpass', [200, 900], 2) * 0.25 * (0.5 + 0.5 * np.sin(2 * np.pi * 3.1 * t))
    e = np.clip(t / (dur * 0.55), 0, 1) ** 1.5
    e[-int(1.5 * SR):] *= np.linspace(1, 0.3, int(1.5 * SR))
    return stereo((x + sub + grit) * e)


def heartbeat(dur=4.5, bpm0=62, bpm1=96):
    n = int(dur * SR)
    x = np.zeros(n)
    tt = 0.1
    while tt < dur - 0.4:
        bpm = bpm0 + (bpm1 - bpm0) * tt / dur
        for off, g in ((0.0, 1.0), (0.23, 0.7)):
            s = int((tt + off) * SR)
            L = int(0.18 * SR)
            if s + L < n:
                tl = np.arange(L) / SR
                x[s:s + L] += np.sin(2 * np.pi * (48 + 30 * np.exp(-tl / 0.02)) * tl) * np.exp(-tl / 0.05) * g
        tt += 60.0 / bpm
    return stereo(filt(x, 'lowpass', 180, 2))


def braam(dur=4.5, root=55.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for mult in (1.0, 1.5, 2.0, 0.5):
        for det in (-0.35, 0.0, 0.4):
            f = root * mult * (1 + det / 100)
            x += signal.sawtooth(2 * np.pi * f * t + rng.uniform(0, 6)) * (0.6 if mult != 1.0 else 1.0)
    cutoff_env = 200 + 2600 * np.exp(-t / 0.9) * np.clip(t / 0.08, 0, 1)
    # time-varying lowpass via block processing
    out = np.zeros(n)
    B = 1024
    zi = None
    for s in range(0, n, B):
        fc = float(np.clip(cutoff_env[s], 60, 20000))
        sos = signal.butter(2, fc, 'lowpass', fs=SR, output='sos')
        if zi is None:
            zi = signal.sosfilt_zi(sos) * 0
        out[s:s + B], zi = signal.sosfilt(sos, x[s:s + B], zi=zi)
    a = np.clip(t / 0.03, 0, 1) * np.exp(-t / 2.2)
    out = np.tanh(out * 0.35) * a
    sub = np.sin(2 * np.pi * root / 2 * t) * np.exp(-t / 1.8) * 0.7
    return reverb(out + sub, 3.5, 0.35, 3000)


def riser(dur=4.2):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    B = 2048
    w = white(n)
    zi = None
    for s in range(0, n, B):
        fc = 200 * (40 ** (t[s] / dur))
        sos = signal.butter(2, [fc * 0.7, fc * 1.3], 'bandpass', fs=SR, output='sos')
        if zi is None:
            zi = signal.sosfilt_zi(sos) * 0
        x[s:s + B], zi = signal.sosfilt(sos, w[s:s + B], zi=zi)
    tone = np.sin(2 * np.pi * np.cumsum(60 * (8 ** (t / dur))) / SR) * 0.35
    sub = np.sin(2 * np.pi * 36 * t) * 0.5
    e = (t / dur) ** 2.2
    return reverb((x * 2 + tone + sub) * e, 2.0, 0.25)


def stone_groan(dur=1.8):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = 38 + 10 * np.sin(2 * np.pi * 0.9 * t) + 4 * filt(white(n), 'lowpass', 8, 1) * 20
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = signal.sawtooth(ph) * (0.6 + 0.4 * (filt(white(n), 'lowpass', 30, 1) * 30).clip(-1, 1))
    x = filt(x, 'bandpass', [60, 900], 2)
    e = np.sin(np.pi * t / dur) ** 0.7
    return reverb(x * e * 2, 2.5, 0.35, 2500)


def whoosh(dur=0.9):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    w = white(n)
    B = 1024
    zi = None
    for s in range(0, n, B):
        u = t[s] / dur
        fc = 300 + 2500 * np.sin(np.pi * u)
        sos = signal.butter(2, [fc * 0.6, fc * 1.4], 'bandpass', fs=SR, output='sos')
        if zi is None:
            zi = signal.sosfilt_zi(sos) * 0
        x[s:s + B], zi = signal.sosfilt(sos, w[s:s + B], zi=zi)
    e = np.sin(np.pi * t / dur) ** 2
    xs = np.stack([x * e * np.linspace(1, 0.3, n), x * e * np.linspace(0.3, 1, n)], axis=1)
    return xs


def chess_click(dur=1.4):
    n = int(dur * SR)
    t = np.arange(n) / SR
    imp = np.zeros(n)
    imp[0] = 1.0
    imp[int(0.0012 * SR)] = -0.6
    x = np.zeros(n)
    for f, q, g, tau in ((2350, 18, 1.0, 0.018), (1180, 12, 0.8, 0.03), (4100, 25, 0.5, 0.01), (620, 8, 0.5, 0.04)):
        b, a = signal.iirpeak(f, q, fs=SR)
        x += signal.lfilter(b, a, imp) * g * np.exp(-t / tau) * 40
    click = filt(white(int(0.004 * SR)), 'highpass', 3000, 2) * 0.5
    x[:len(click)] += click
    return reverb(x, 1.2, 0.18, 9000, predelay=0.008)


def tinnitus(dur=2.4):
    t = t_(dur)
    x = np.sin(2 * np.pi * 6400 * t) * np.exp(-t / 0.9) * np.clip(t / 0.05, 0, 1)
    return stereo(x * 0.5)


def drone(dur=26.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros((n, 2))
    notes = [36.71, 55.0, 73.42, 87.31]  # D1 A1 D2 F2 (minor)
    for c in range(2):
        x = np.zeros(n)
        for i, f in enumerate(notes):
            det = 1 + rng.uniform(-0.004, 0.004)
            lfo = 0.6 + 0.4 * np.sin(2 * np.pi * (0.05 + 0.03 * i) * t + rng.uniform(0, 6))
            x += signal.sawtooth(2 * np.pi * f * det * t + rng.uniform(0, 6)) * lfo * (1.0 if i < 2 else 0.5)
        x = filt(x, 'lowpass', 420, 4)
        # slow tension rise
        e = 0.35 + 0.65 * (t / dur) ** 1.5
        out[:, c] = x * e
    shimmer = filt(white(n), 'bandpass', [3000, 6000], 2) * 0.03 * (t / dur)
    out += shimmer[:, None]
    fade = int(3 * SR)
    out[:fade] *= np.linspace(0, 1, fade)[:, None]
    return reverb(out, 4.0, 0.3, 2500)


if __name__ == '__main__':
    od = sys.argv[1] if len(sys.argv) > 1 else 'sfx'
    os.makedirs(od, exist_ok=True)
    save(od, 'storm_bed', storm_bed(), 0.5)
    save(od, 'thunder_far', thunder(False))
    save(od, 'thunder_close', thunder(True))
    save(od, 'whistle_fall', whistle_fall())
    save(od, 'whistle_fall_long', whistle_fall(1.9, 2300, 300))
    save(od, 'impact_big', impact(1.3))
    save(od, 'impact_med', impact(0.9))
    save(od, 'impact_far', filt(impact(1.0), 'lowpass', 900, 2))
    save(od, 'debris_rattle', debris_rattle())
    save(od, 'crack_creep', crack_creep())
    save(od, 'rumble_quake', rumble_quake())
    save(od, 'heartbeat', heartbeat())
    save(od, 'braam', braam())
    save(od, 'riser_fall', riser())
    save(od, 'stone_groan', stone_groan())
    save(od, 'whoosh_turn', whoosh())
    save(od, 'chess_click', chess_click())
    save(od, 'tinnitus', tinnitus())
    save(od, 'drone_bed', drone(), 0.6)
