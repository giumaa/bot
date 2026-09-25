"""Cue sheet for the ChatCut sound design (24 fps). Prints edit_item adds grouped by lane."""
import json
FPS, CUT, CLICK = 24, 586, 616
A = {  # ChatCut asset ids (uploaded from audio/sfx)
    'storm_bed': '0005234147', 'drone_bed': '3a3dabfc2e', 'impact_big': 'a2ee7c9100', 'impact_med': '260023c1c9',
    'impact_far': 'ff37123542', 'whistle_fall': '8aa29a8ddc', 'whistle_fall_long': 'f5742bc392', 'debris_rattle': '4920a410bd',
    'crack_creep': '326ba31852', 'rumble_quake': '7260d68af7', 'heartbeat': 'e5e8f22689', 'braam': '7612a64ae3',
    'riser_fall': '3755eb3964', 'stone_groan': '2d29836d41', 'whoosh_turn': '86635b0f00', 'chess_click': 'e31c4cd4c3',
    'tinnitus': 'cbe6614d09', 'thunder_close': '000f287aba', 'thunder_far': '29d5006f41',
    'lib_taiko': 'library:sound:taiko-hit', 'lib_thunder': 'library:sound:dramatic-thunder-roll',
    'lib_whoosh': 'library:sound:deep-short-whoosh',
}
LEN = {'storm_bed': 32.0, 'drone_bed': 30.02, 'impact_big': 7.02, 'impact_med': 7.02, 'impact_far': 7.02, 'whistle_fall': 2.62,
       'whistle_fall_long': 3.12, 'debris_rattle': 4.02, 'crack_creep': 4.62, 'rumble_quake': 12.0, 'heartbeat': 4.5,
       'braam': 8.02, 'riser_fall': 6.22, 'stone_groan': 4.32, 'whoosh_turn': 0.9, 'chess_click': 2.61, 'tinnitus': 2.4,
       'thunder_close': 9.52, 'thunder_far': 9.52, 'lib_taiko': 3.0, 'lib_thunder': 6.0, 'lib_whoosh': 1.0}
# (name, start_seconds, dB, fade_in_s)
CUES = [
    ('storm_bed', 0.0, -5, 1.2), ('drone_bed', 0.0, -8, 2.0),
    ('thunder_far', 1.9, -6, 0), ('whistle_fall_long', 5.17 - 1.9, -9, 0), ('impact_med', 5.17, -3, 0),
    ('debris_rattle', 5.3, -11, 0), ('impact_far', 5.92, -13, 0), ('thunder_close', 6.17, -3, 0),
    ('whistle_fall', 6.58 - 1.4, -8, 0), ('impact_med', 6.58, -2, 0), ('debris_rattle', 6.7, -9, 0),
    ('impact_far', 7.33, -12, 0), ('whistle_fall_long', 7.92 - 1.9, -4, 0), ('impact_big', 7.92, 0, 0),
    ('debris_rattle', 8.0, -3, 0), ('tinnitus', 8.05, -24, 0.05), ('impact_far', 8.83, -13, 0),
    ('whistle_fall', 9.42 - 1.4, -7, 0), ('impact_med', 9.42, -1, 0), ('debris_rattle', 9.55, -8, 0),
    ('thunder_far', 10.9, -5, 0), ('whoosh_turn', 11.1, -16, 0),
    ('rumble_quake', 11.6, -1, 1.0), ('heartbeat', 12.3, -1, 0.2), ('crack_creep', 12.55, -2, 0),
    ('thunder_close', 13.25, -6, 0), ('thunder_far', 14.0, -5, 0),
    ('whoosh_turn', 15.25, -7, 0), ('lib_whoosh', 15.3, -4, 0),
    ('braam', 16.25, 0, 0), ('lib_taiko', 16.25, -3, 0), ('debris_rattle', 16.5, -7, 0),
    ('thunder_close', 17.83, -1, 0), ('lib_thunder', 17.9, -4, 0), ('impact_big', 18.3, -5, 0),
    ('rumble_quake', 18.5, -2, 0.5), ('stone_groan', 19.25, -2, 0), ('stone_groan', 20.1, -1, 0),
    ('riser_fall', 586 / 24 - 4.2, -1, 0), ('thunder_far', 21.04, -5, 0), ('thunder_close', 22.83, -2, 0),
    ('chess_click', CLICK / 24, 0, 0),
]


def plan():
    items = []
    for name, st, db, fi in CUES:
        f0 = round(st * FPS)
        cap = {'impact_big': 4.0, 'impact_med': 3.2, 'impact_far': 2.6, 'thunder_close': 5.5, 'thunder_far': 5.0,
               'debris_rattle': 2.4, 'braam': 6.0, 'lib_thunder': 5.0}.get(name)
        dur = round(min(LEN[name], cap or 99) * FPS)
        if name != 'chess_click' and f0 + dur > CUT:
            dur = CUT - f0
        items.append(dict(name=name, f0=f0, dur=dur, db=db, fi=fi))
    lanes = []
    for it in sorted(items, key=lambda x: x['f0']):
        for li, end in enumerate(lanes):
            if it['f0'] >= end:
                it['lane'] = li; lanes[li] = it['f0'] + it['dur']; break
        else:
            it['lane'] = len(lanes); lanes.append(it['f0'] + it['dur'])
    return items, len(lanes)


if __name__ == '__main__':
    items, n = plan()
    print('lanes', n)
    out = {}
    for it in items:
        add = {'type': 'audio', 'assetId': A[it['name']], 'fromFrame': it['f0'], 'durationInFrames': it['dur'],
               'decibelAdjustment': it['db']}
        if it['fi']:
            add['audioFadeIn'] = it['fi']
        if it['f0'] + it['dur'] == CUT:
            add['audioFadeOut'] = 0.04
        elif it['name'] not in ('chess_click', 'whistle_fall', 'whistle_fall_long', 'whoosh_turn', 'lib_whoosh', 'tinnitus'):
            add['audioFadeOut'] = 0.7
        out.setdefault(it['lane'], []).append(add)
    print(json.dumps(out))
