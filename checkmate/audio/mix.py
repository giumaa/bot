"""Mix the fallback soundtrack from the SFX pack using the cue sheet (times in seconds).
python3 mix.py <sfxdir> <out.wav>
"""
import sys, os
import numpy as np
from scipy.io import wavfile

SR = 48000
CUT = 24.42      # hard cut to black (frame 586)
CLICK = 25.65    # chess piece click on black
END = 29.5

# (file, start_seconds, gain_db, fade_out_at or None)
CUES = [
    ('storm_bed', 0.0, -6, CUT), ('drone_bed', 0.0, -9, CUT),
    ('thunder_far', 1.9, -8, None),
    ('whistle_fall_long', 5.17 - 1.9, -10, None), ('impact_med', 5.17, -3, None), ('debris_rattle', 5.3, -12, None),
    ('impact_far', 5.92, -14, None),
    ('thunder_close', 6.17, -4, None),
    ('whistle_fall', 6.58 - 1.4, -9, None), ('impact_med', 6.58, -2, None), ('debris_rattle', 6.7, -10, None),
    ('impact_far', 7.33, -13, None),
    ('whistle_fall_long', 7.92 - 1.9, -5, None), ('impact_big', 7.92, 0, None), ('debris_rattle', 8.0, -4, None), ('tinnitus', 8.05, -14, None),
    ('impact_far', 8.83, -14, None),
    ('whistle_fall', 9.42 - 1.4, -8, None), ('impact_med', 9.42, -1, None), ('debris_rattle', 9.55, -9, None),
    ('thunder_far', 10.9, -6, None),
    ('whoosh_turn', 11.1, -14, None),
    ('rumble_quake', 11.6, -2, CUT), ('crack_creep', 12.55, -3, None), ('heartbeat', 12.3, -2, None),
    ('thunder_close', 13.25, -7, None), ('thunder_far', 14.0, -6, None),
    ('whoosh_turn', 15.25, -6, None), ('braam', 16.25, -1, None), ('debris_rattle', 16.5, -8, None),
    ('thunder_close', 17.83, -2, None), ('impact_big', 18.3, -6, None),
    ('stone_groan', 19.25, -3, None), ('stone_groan', 20.1, -2, None),
    ('riser_fall', CUT - 4.2, -2, None), ('thunder_far', 21.04, -6, None), ('thunder_close', 22.83, -3, None),
    ('rumble_quake', 18.5, -3, CUT),
    ('chess_click', CLICK, -1, None),
]


def load(d, name):
    sr, x = wavfile.read(os.path.join(d, name + '.wav'))
    x = x.astype(np.float32) / 32768.0
    return x if x.ndim == 2 else np.stack([x, x], 1)


def main():
    d, out = sys.argv[1], sys.argv[2]
    n = int(END * SR)
    mix = np.zeros((n, 2), np.float32)
    for name, st, db, fade in CUES:
        x = load(d, name) * (10 ** (db / 20))
        s = int(st * SR)
        if s < 0:
            x = x[-s:]; s = 0
        e = min(n, s + len(x))
        seg = x[:e - s].copy()
        if fade is not None:
            fs = int(fade * SR) - s
            if 0 <= fs < len(seg):
                seg[fs:] = 0
        mix[s:e] += seg
    # hard cut: silence everything between the cut and the click
    c0, c1 = int(CUT * SR), int(CLICK * SR)
    mix[c0:c1] = 0
    mix[c1:] = mix[c1:] * 1.0
    # gentle master limiter
    peak = np.abs(mix).max()
    mix = np.tanh(mix / max(peak, 1e-6) * 1.6) / np.tanh(1.6) * 0.92
    wavfile.write(out, SR, (mix * 32767).astype(np.int16))
    print('mixed', out, END, 's')


if __name__ == '__main__':
    main()
