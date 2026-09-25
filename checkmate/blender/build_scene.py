"""Checkmate - procedural Blender scene (first-person, 9:16).

Run:  blender -b -y --python build_scene.py -- <out.blend>
Everything (board, pieces, storm, camera, timing) is generated here.
"""
import bpy, bmesh, math, random, sys
from math import radians, sin, cos, pi, exp
from mathutils import Vector, Matrix, noise

FPS = 24
F_END = 590
H_KING = 165.0
KING_DIST = 80.0
random.seed(11)

# --------------------------------------------------------------------------- helpers
def link(nt, a, b):
    nt.links.new(a, b)

def setin(nt, sock, val):
    if isinstance(val, bpy.types.NodeSocket):
        nt.links.new(val, sock)
    elif val is not None:
        sock.default_value = val

def node(nt, t, **kw):
    n = nt.nodes.new(t)
    for k, v in kw.items():
        setattr(n, k, v)
    return n

def math_(nt, op, a, b=None, c=None, clamp=False):
    n = node(nt, 'ShaderNodeMath', operation=op, use_clamp=clamp)
    setin(nt, n.inputs[0], a)
    if b is not None: setin(nt, n.inputs[1], b)
    if c is not None: setin(nt, n.inputs[2], c)
    return n.outputs[0]

def vmath(nt, op, a, b=None, out='Vector'):
    n = node(nt, 'ShaderNodeVectorMath', operation=op)
    setin(nt, n.inputs[0], a)
    if b is not None: setin(nt, n.inputs[1], b)
    return n.outputs[out]

def maprange(nt, v, fmin, fmax, tmin=0.0, tmax=1.0, interp='SMOOTHSTEP'):
    n = node(nt, 'ShaderNodeMapRange', interpolation_type=interp, clamp=True)
    for s, val in zip(['Value', 'From Min', 'From Max', 'To Min', 'To Max'], [v, fmin, fmax, tmin, tmax]):
        setin(nt, n.inputs[s], val)
    return n.outputs['Result']

def mixc(nt, fac, a, b, blend='MIX'):
    n = node(nt, 'ShaderNodeMix', data_type='RGBA', blend_type=blend)
    setin(nt, n.inputs['Factor_Float'] if 'Factor_Float' in n.inputs else n.inputs[0], fac)
    setin(nt, n.inputs[6], a)
    setin(nt, n.inputs[7], b)
    return n.outputs[2]

def new_mat(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    try:
        m.cycles.emission_sampling = 'NONE'
    except Exception:
        pass
    nt = m.node_tree
    nt.nodes.clear()
    out = node(nt, 'ShaderNodeOutputMaterial')
    return m, nt, out

def add_driver(owner, path, expr, index=-1):
    fc = owner.driver_add(path, index) if index >= 0 else owner.driver_add(path)
    d = fc.driver
    d.type = 'SCRIPTED'
    v = d.variables.new()
    v.name = 'f'
    v.type = 'SINGLE_PROP'
    v.targets[0].id_type = 'SCENE'
    v.targets[0].id = bpy.context.scene
    v.targets[0].data_path = '["flash"]'
    d.expression = expr
    return fc

def fcurves_of(idb):
    from bpy_extras import anim_utils
    ad = idb.animation_data
    cb = anim_utils.action_get_channelbag_for_slot(ad.action, ad.action_slot)
    return cb.fcurves


def set_keys(idb, path, index, frames, values, interp='LINEAR'):
    """Fast keyframe insertion (creates the F-curve via keyframe_insert so 4.4+ action slots are set up)."""
    fc = None
    if idb.animation_data and idb.animation_data.action:
        fc = fcurves_of(idb).find(path, index=index)
    if fc is None:
        try:
            idb.keyframe_insert(path, index=index, frame=frames[0])
        except TypeError:
            idb.keyframe_insert(path, frame=frames[0])
        fc = fcurves_of(idb).find(path, index=max(index, 0))
        fc.keyframe_points.clear()
    n0 = len(fc.keyframe_points)
    fc.keyframe_points.add(len(frames))
    for i, (f, v) in enumerate(zip(frames, values)):
        kp = fc.keyframe_points[n0 + i]
        kp.co = (f, v)
        kp.handle_left = (f - 1, v)
        kp.handle_right = (f + 1, v)
        kp.interpolation = interp
    fc.update()
    return fc


def key(sock_or_obj, path, frame, value, interp=None):
    setattr(sock_or_obj, path, value) if not isinstance(value, (tuple, list)) else setattr(sock_or_obj, path, value)
    sock_or_obj.keyframe_insert(path, frame=frame)

def smooth_shade(me, angle=40):
    me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
    try:
        me.set_sharp_from_angle(angle=radians(angle))
    except Exception:
        pass

# --------------------------------------------------------------------------- scene
def setup_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc['flash'] = 0.0
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.render.fps = FPS
    sc.frame_start, sc.frame_end = 0, F_END
    sc.render.resolution_x, sc.render.resolution_y = 720, 1280
    sc.render.resolution_percentage = 100
    sc.cycles.samples = 8
    sc.cycles.use_adaptive_sampling = True
    sc.cycles.adaptive_threshold = 0.03
    sc.cycles.use_denoising = True
    sc.cycles.denoiser = 'OPENIMAGEDENOISE'
    sc.cycles.max_bounces = 3
    sc.cycles.diffuse_bounces = 1
    sc.cycles.glossy_bounces = 1
    sc.cycles.transmission_bounces = 2
    sc.cycles.volume_bounces = 0
    sc.cycles.transparent_max_bounces = 8
    sc.cycles.sample_clamp_indirect = 4.0
    sc.cycles.volume_step_rate = 4.0
    sc.cycles.volume_max_steps = 48
    sc.cycles.use_light_tree = False
    sc.cycles.use_auto_tile = False
    sc.render.use_motion_blur = True
    sc.render.motion_blur_shutter = 0.5
    sc.render.use_persistent_data = True
    sc.view_settings.view_transform = 'AgX'
    for look in ('AgX - Medium High Contrast', 'Medium High Contrast', 'AgX - Punchy'):
        try:
            sc.view_settings.look = look
            break
        except Exception:
            pass
    sc.view_settings.exposure = 0.6
    vl = sc.view_layers[0]
    vl.use_pass_mist = True
    w = bpy.data.worlds.new('Storm')
    sc.world = w
    w.use_nodes = True
    nt = w.node_tree
    bg = nt.nodes['Background']
    bg.inputs['Color'].default_value = (0.05, 0.06, 0.075, 1)
    add_driver(bg.inputs['Strength'], 'default_value', '0.28+2.2*f')
    w.mist_settings.start = 3.0
    w.mist_settings.depth = 420.0
    w.mist_settings.falloff = 'LINEAR'
    return sc

# --------------------------------------------------------------------------- materials
def marble_color(nt, coord, base, vein, scale, seed_vec=None, vein_amt=1.0):
    """Returns (color_socket, vein_mask_socket)."""
    c = vmath(nt, 'SCALE', coord) if False else coord
    sc_n = node(nt, 'ShaderNodeVectorMath', operation='SCALE')
    setin(nt, sc_n.inputs[0], coord)
    sc_n.inputs['Scale'].default_value = scale
    c = sc_n.outputs[0]
    if seed_vec is not None:
        c = vmath(nt, 'ADD', c, seed_vec)
    nz = node(nt, 'ShaderNodeTexNoise')
    nz.inputs['Scale'].default_value = 0.9
    nz.inputs['Detail'].default_value = 3
    nz.inputs['Roughness'].default_value = 0.6
    setin(nt, nz.inputs['Vector'], c)
    wv = node(nt, 'ShaderNodeTexWave', wave_type='BANDS', bands_direction='DIAGONAL')
    wv.inputs['Scale'].default_value = 0.7
    wv.inputs['Distortion'].default_value = 9.0
    wv.inputs['Detail'].default_value = 5
    wv.inputs['Detail Scale'].default_value = 1.4
    wv.inputs['Detail Roughness'].default_value = 0.62
    setin(nt, wv.inputs['Vector'], c)
    v1 = maprange(nt, wv.outputs['Fac'], 0.0, 0.07, 1.0, 0.0)
    wv2 = node(nt, 'ShaderNodeTexWave', wave_type='BANDS', bands_direction='Z')
    wv2.inputs['Scale'].default_value = 2.3
    wv2.inputs['Distortion'].default_value = 14.0
    wv2.inputs['Detail'].default_value = 3
    wv2.inputs['Detail Roughness'].default_value = 0.7
    setin(nt, wv2.inputs['Vector'], c)
    v2 = math_(nt, 'MULTIPLY', maprange(nt, wv2.outputs['Fac'], 0.0, 0.04, 1.0, 0.0), 0.45)
    veins = math_(nt, 'MAXIMUM', v1, v2)
    veins = math_(nt, 'MULTIPLY', veins, vein_amt, clamp=True)
    cloud = maprange(nt, nz.outputs['Fac'], 0.3, 0.75, 0.0, 1.0)
    basecol = mixc(nt, math_(nt, 'MULTIPLY', cloud, 0.35), base, [x * 0.82 for x in base[:3]] + [1])
    col = mixc(nt, veins, basecol, vein)
    return col, veins


def piece_material(name, white, scale, vein=(0.16, 0.15, 0.14, 1), rough_b=0.16):
    m, nt, out = new_mat(name)
    tc = node(nt, 'ShaderNodeTexCoord')
    if white:
        col, veins = marble_color(nt, tc.outputs['Object'], (0.86, 0.85, 0.82, 1), (0.36, 0.37, 0.4, 1), scale)
        rough = 0.22
    else:
        col, veins = marble_color(nt, tc.outputs['Object'], (0.012, 0.012, 0.014, 1), vein, scale, vein_amt=0.8)
        rough = rough_b
    bs = node(nt, 'ShaderNodeBsdfPrincipled')
    setin(nt, bs.inputs['Base Color'], col)
    setin(nt, bs.inputs['Roughness'], math_(nt, 'ADD', math_(nt, 'MULTIPLY', veins, 0.15), rough))
    bs.inputs['Coat Weight'].default_value = 0.25 if white else 0.45
    bs.inputs['Coat Roughness'].default_value = 0.08
    if white:
        bs.inputs['Subsurface Weight'].default_value = 0.0
    link(nt, bs.outputs[0], out.inputs['Surface'])
    return m


def crack_group():
    g = bpy.data.node_groups.new('CrackSource', 'ShaderNodeTree')
    g.interface.new_socket('Position', in_out='INPUT', socket_type='NodeSocketVector')
    g.interface.new_socket('Center', in_out='INPUT', socket_type='NodeSocketVector')
    g.interface.new_socket('Radius', in_out='INPUT', socket_type='NodeSocketFloat')
    g.interface.new_socket('Seed', in_out='INPUT', socket_type='NodeSocketFloat')
    g.interface.new_socket('Count', in_out='INPUT', socket_type='NodeSocketFloat')
    g.interface.new_socket('Crack', in_out='OUTPUT', socket_type='NodeSocketFloat')
    nt = g
    gi = node(nt, 'NodeGroupInput')
    go = node(nt, 'NodeGroupOutput')
    d = vmath(nt, 'SUBTRACT', gi.outputs['Position'], gi.outputs['Center'])
    sep = node(nt, 'ShaderNodeSeparateXYZ')
    link(nt, d, sep.inputs[0])
    dist = math_(nt, 'SQRT', math_(nt, 'ADD', math_(nt, 'MULTIPLY', sep.outputs['X'], sep.outputs['X']),
                                   math_(nt, 'MULTIPLY', sep.outputs['Y'], sep.outputs['Y'])))
    ang = math_(nt, 'ARCTAN2', sep.outputs['Y'], sep.outputs['X'])
    # warp for jagged radial cracks
    cxyz = node(nt, 'ShaderNodeCombineXYZ')
    link(nt, math_(nt, 'MULTIPLY', dist, 0.35), cxyz.inputs['X'])
    link(nt, math_(nt, 'MULTIPLY', ang, 1.3), cxyz.inputs['Y'])
    link(nt, gi.outputs['Seed'], cxyz.inputs['Z'])
    nz = node(nt, 'ShaderNodeTexNoise')
    nz.inputs['Scale'].default_value = 1.0
    nz.inputs['Detail'].default_value = 2
    nz.inputs['Roughness'].default_value = 0.7
    link(nt, cxyz.outputs[0], nz.inputs['Vector'])
    warp = math_(nt, 'MULTIPLY', math_(nt, 'SUBTRACT', nz.outputs['Fac'], 0.5), 0.9)
    u = math_(nt, 'ADD', math_(nt, 'MULTIPLY', ang, math_(nt, 'DIVIDE', gi.outputs['Count'], 2 * pi)), warp)
    u = math_(nt, 'ADD', u, gi.outputs['Seed'])
    fr = math_(nt, 'ABSOLUTE', math_(nt, 'SUBTRACT', math_(nt, 'FRACT', u), 0.5))
    meters = math_(nt, 'MULTIPLY', fr, math_(nt, 'DIVIDE', math_(nt, 'MULTIPLY', dist, 2 * pi), gi.outputs['Count']))
    R = gi.outputs['Radius']
    taper = math_(nt, 'MAXIMUM', math_(nt, 'MINIMUM', math_(nt, 'DIVIDE', math_(nt, 'SUBTRACT', R, dist), math_(nt, 'MAXIMUM', math_(nt, 'MULTIPLY', R, 0.5), 0.5)), 1.0), 0.12)
    width = math_(nt, 'MULTIPLY', taper, math_(nt, 'ADD', 0.02, math_(nt, 'MULTIPLY', nz.outputs['Fac'], 0.05)))
    line = maprange(nt, meters, math_(nt, 'MULTIPLY', width, 0.35), width, 1.0, 0.0)
    front = maprange(nt, dist, math_(nt, 'SUBTRACT', R, 0.6), R, 1.0, 0.0)
    radial = math_(nt, 'MULTIPLY', line, front)
    # shatter web near the centre
    vo = node(nt, 'ShaderNodeTexVoronoi', feature='DISTANCE_TO_EDGE')
    vo.inputs['Scale'].default_value = 0.55
    vp = vmath(nt, 'ADD', gi.outputs['Position'], vmath(nt, 'SCALE', gi.outputs['Center'], None) if False else gi.outputs['Center'])
    link(nt, vp, vo.inputs['Vector'])
    web = maprange(nt, vo.outputs['Distance'], 0.006, 0.02, 1.0, 0.0)
    webmask = maprange(nt, dist, math_(nt, 'MULTIPLY', R, 0.3), math_(nt, 'MULTIPLY', R, 0.5), 1.0, 0.0)
    nz2 = node(nt, 'ShaderNodeTexNoise')
    nz2.inputs['Scale'].default_value = 0.3
    nz2.inputs['Detail'].default_value = 1
    link(nt, gi.outputs['Position'], nz2.inputs['Vector'])
    webmask = math_(nt, 'MULTIPLY', webmask, maprange(nt, nz2.outputs['Fac'], 0.42, 0.55, 0.0, 1.0))
    crack = math_(nt, 'MAXIMUM', radial, math_(nt, 'MULTIPLY', web, webmask))
    link(nt, crack, go.inputs['Crack'])
    return g


def floor_material():
    m, nt, out = new_mat('Board')
    S = 2.0
    tc = node(nt, 'ShaderNodeTexCoord')
    p = tc.outputs['Object']
    sep = node(nt, 'ShaderNodeSeparateXYZ')
    link(nt, p, sep.inputs[0])
    u = math_(nt, 'DIVIDE', math_(nt, 'ADD', sep.outputs['X'], S / 2), S)
    v = math_(nt, 'DIVIDE', math_(nt, 'ADD', sep.outputs['Y'], S / 2), S)
    fu, fv = math_(nt, 'FLOOR', u), math_(nt, 'FLOOR', v)
    parity = math_(nt, 'FLOORED_MODULO', math_(nt, 'ADD', fu, fv), 2.0)
    cell = node(nt, 'ShaderNodeCombineXYZ')
    link(nt, fu, cell.inputs['X']); link(nt, fv, cell.inputs['Y'])
    wn = node(nt, 'ShaderNodeTexWhiteNoise', noise_dimensions='3D')
    link(nt, cell.outputs[0], wn.inputs['Vector'])
    seedv = vmath(nt, 'SCALE', wn.outputs['Color'])
    seedv.node.inputs['Scale'].default_value = 40.0
    c = vmath(nt, 'ADD', vmath(nt, 'MULTIPLY', p, (1.1, 1.1, 1.1)), seedv)
    nz = node(nt, 'ShaderNodeTexNoise')
    nz.inputs['Scale'].default_value = 0.9
    nz.inputs['Detail'].default_value = 2
    nz.inputs['Roughness'].default_value = 0.6
    setin(nt, nz.inputs['Vector'], c)
    wv = node(nt, 'ShaderNodeTexWave', wave_type='BANDS', bands_direction='DIAGONAL')
    wv.inputs['Scale'].default_value = 0.7
    wv.inputs['Distortion'].default_value = 9.0
    wv.inputs['Detail'].default_value = 4
    wv.inputs['Detail Scale'].default_value = 1.4
    wv.inputs['Detail Roughness'].default_value = 0.62
    setin(nt, wv.inputs['Vector'], c)
    veins = maprange(nt, wv.outputs['Fac'], 0.0, 0.035, 0.85, 0.0)
    cloud = math_(nt, 'MULTIPLY', maprange(nt, nz.outputs['Fac'], 0.3, 0.75, 0.0, 1.0), 0.45)
    wcol = mixc(nt, veins, mixc(nt, cloud, (0.86, 0.845, 0.815, 1), (0.66, 0.65, 0.63, 1)), (0.3, 0.3, 0.32, 1))
    bcol = mixc(nt, math_(nt, 'MULTIPLY', veins, 0.7), mixc(nt, cloud, (0.014, 0.014, 0.016, 1), (0.03, 0.03, 0.032, 1)), (0.2, 0.19, 0.17, 1))
    col = mixc(nt, parity, wcol, bcol)
    gu = math_(nt, 'MULTIPLY', math_(nt, 'MINIMUM', math_(nt, 'FRACT', u), math_(nt, 'SUBTRACT', 1.0, math_(nt, 'FRACT', u))), S)
    gv = math_(nt, 'MULTIPLY', math_(nt, 'MINIMUM', math_(nt, 'FRACT', v), math_(nt, 'SUBTRACT', 1.0, math_(nt, 'FRACT', v))), S)
    grout = maprange(nt, math_(nt, 'MINIMUM', gu, gv), 0.004, 0.012, 1.0, 0.0)
    col = mixc(nt, grout, col, (0.05, 0.05, 0.05, 1))
    wet = node(nt, 'ShaderNodeTexNoise')
    wet.inputs['Scale'].default_value = 0.05
    wet.inputs['Detail'].default_value = 2
    link(nt, p, wet.inputs['Vector'])
    rough = maprange(nt, wet.outputs['Fac'], 0.4, 0.65, 0.05, 0.22)
    rough = math_(nt, 'ADD', rough, math_(nt, 'MULTIPLY', grout, 0.5))
    bs = node(nt, 'ShaderNodeBsdfPrincipled')
    setin(nt, bs.inputs['Base Color'], col)
    setin(nt, bs.inputs['Roughness'], rough)
    link(nt, bs.outputs[0], out.inputs['Surface'])
    return m


def crack_decals(crack_sources):
    """One transparent decal plane per crack source, hovering just above the board."""
    g = crack_group()
    for i, (center, seed, count, keys, size) in enumerate(crack_sources):
        m, nt, out = new_mat(f'Crack{i}')
        geo = node(nt, 'ShaderNodeNewGeometry')
        gn = node(nt, 'ShaderNodeGroup')
        gn.node_tree = g
        link(nt, geo.outputs['Position'], gn.inputs['Position'])
        gn.inputs['Center'].default_value = center
        gn.inputs['Seed'].default_value = seed
        gn.inputs['Count'].default_value = count
        sock = gn.inputs['Radius']
        for f, r in keys:
            sock.default_value = r
            sock.keyframe_insert('default_value', frame=f)
        bs = node(nt, 'ShaderNodeBsdfPrincipled')
        bs.inputs['Base Color'].default_value = (0.004, 0.004, 0.004, 1)
        bs.inputs['Roughness'].default_value = 0.85
        tr = node(nt, 'ShaderNodeBsdfTransparent')
        mx = node(nt, 'ShaderNodeMixShader')
        link(nt, gn.outputs[0], mx.inputs[0])
        link(nt, tr.outputs[0], mx.inputs[1])
        link(nt, bs.outputs[0], mx.inputs[2])
        link(nt, mx.outputs[0], out.inputs['Surface'])
        d = plane(f'CrackDecal{i}', size, 0.004, m, loc=(center[0], center[1]))
        d.visible_shadow = False
        for ff, hid in ((0, True), (keys[0][0], True), (keys[0][0] + 1, False)):
            d.hide_render = hid
            d.keyframe_insert('hide_render', frame=ff)


def cloud_material(name, z_seed, dens=0.62):
    m, nt, out = new_mat(name)
    m.blend_method = 'HASHED' if hasattr(m, 'blend_method') else None
    tc = node(nt, 'ShaderNodeTexCoord')
    mp = node(nt, 'ShaderNodeMapping')
    link(nt, tc.outputs['Object'], mp.inputs['Vector'])
    mp.inputs['Scale'].default_value = (0.006, 0.006, 0.006)
    for f, loc in ((0, (0, 0, z_seed)), (F_END, (0.9, 0.35, z_seed + 0.4))):
        mp.inputs['Location'].default_value = loc
        mp.inputs['Location'].keyframe_insert('default_value', frame=f)
    nz = node(nt, 'ShaderNodeTexNoise', noise_dimensions='3D')
    nz.inputs['Scale'].default_value = 1.6
    nz.inputs['Detail'].default_value = 4
    nz.inputs['Roughness'].default_value = 0.62
    nz.inputs['Distortion'].default_value = 0.3
    link(nt, mp.outputs[0], nz.inputs['Vector'])
    alpha = maprange(nt, nz.outputs['Fac'], 0.3, dens, 0.0, 1.0)
    shade = maprange(nt, nz.outputs['Fac'], 0.42, 0.72, 0.0, 1.0)
    em = node(nt, 'ShaderNodeEmission')
    colm = mixc(nt, shade, (0.008, 0.009, 0.012, 1), (0.13, 0.14, 0.165, 1))
    setin(nt, em.inputs['Color'], colm)
    add_driver(em.inputs['Strength'], 'default_value', '1.0+7.0*f')
    tr = node(nt, 'ShaderNodeBsdfTransparent')
    mx = node(nt, 'ShaderNodeMixShader')
    link(nt, alpha, mx.inputs[0])
    link(nt, tr.outputs[0], mx.inputs[1])
    link(nt, em.outputs[0], mx.inputs[2])
    link(nt, mx.outputs[0], out.inputs['Surface'])
    return m


def groundfog_material(name, seed, strength=0.3):
    m, nt, out = new_mat(name)
    tc = node(nt, 'ShaderNodeTexCoord')
    mp = node(nt, 'ShaderNodeMapping')
    link(nt, tc.outputs['Object'], mp.inputs['Vector'])
    mp.inputs['Scale'].default_value = (0.05, 0.08, 0.05)
    for f, loc in ((0, (seed, 0, 0)), (F_END, (seed + 1.4, 0.5, 0))):
        mp.inputs['Location'].default_value = loc
        mp.inputs['Location'].keyframe_insert('default_value', frame=f)
    nz = node(nt, 'ShaderNodeTexNoise')
    nz.inputs['Scale'].default_value = 1.0
    nz.inputs['Detail'].default_value = 2
    nz.inputs['Roughness'].default_value = 0.55
    link(nt, mp.outputs[0], nz.inputs['Vector'])
    alpha = maprange(nt, nz.outputs['Fac'], 0.35, 0.75, 0.0, strength)
    df = node(nt, 'ShaderNodeBsdfDiffuse')
    df.inputs['Color'].default_value = (0.5, 0.55, 0.62, 1)
    tr = node(nt, 'ShaderNodeBsdfTransparent')
    mx = node(nt, 'ShaderNodeMixShader')
    link(nt, alpha, mx.inputs[0])
    link(nt, tr.outputs[0], mx.inputs[1])
    link(nt, df.outputs[0], mx.inputs[2])
    link(nt, mx.outputs[0], out.inputs['Surface'])
    return m


def dust_material(name):
    m, nt, out = new_mat(name)
    tc = node(nt, 'ShaderNodeTexCoord')
    nz = node(nt, 'ShaderNodeTexNoise', noise_dimensions='4D')
    nz.inputs['Scale'].default_value = 2.2
    nz.inputs['Detail'].default_value = 5
    nz.inputs['Roughness'].default_value = 0.6
    link(nt, tc.outputs['Object'], nz.inputs['Vector'])
    nz.inputs['W'].default_value = 0.0
    nz.inputs['W'].keyframe_insert('default_value', frame=0)
    nz.inputs['W'].default_value = 6.0
    nz.inputs['W'].keyframe_insert('default_value', frame=F_END)
    ln = vmath(nt, 'LENGTH', tc.outputs['Object'], out='Value')
    fall = maprange(nt, ln, 0.35, 1.0, 1.0, 0.0)
    dens = math_(nt, 'MULTIPLY', fall, maprange(nt, nz.outputs['Fac'], 0.4, 0.7, 0.0, 1.0))
    val = node(nt, 'ShaderNodeValue', label='DensityCtl', name='DensityCtl')
    val.outputs[0].default_value = 0.0
    dens = math_(nt, 'MULTIPLY', dens, val.outputs[0])
    pv = node(nt, 'ShaderNodeVolumePrincipled')
    pv.inputs['Color'].default_value = (0.8, 0.79, 0.77, 1)
    pv.inputs['Anisotropy'].default_value = 0.25
    link(nt, dens, pv.inputs['Density'])
    link(nt, pv.outputs[0], out.inputs['Volume'])
    return m


def emission_material(name, color, strength):
    m, nt, out = new_mat(name)
    em = node(nt, 'ShaderNodeEmission')
    em.inputs['Color'].default_value = color
    em.inputs['Strength'].default_value = strength
    link(nt, em.outputs[0], out.inputs['Surface'])
    return m


def rain_material():
    m, nt, out = new_mat('Rain')
    em = node(nt, 'ShaderNodeEmission')
    em.inputs['Color'].default_value = (0.7, 0.75, 0.85, 1)
    add_driver(em.inputs['Strength'], 'default_value', '0.35+3.0*f')
    tr = node(nt, 'ShaderNodeBsdfTransparent')
    mx = node(nt, 'ShaderNodeMixShader')
    mx.inputs[0].default_value = 0.35
    link(nt, tr.outputs[0], mx.inputs[1])
    link(nt, em.outputs[0], mx.inputs[2])
    link(nt, mx.outputs[0], out.inputs['Surface'])
    return m

# --------------------------------------------------------------------------- geometry
def chaikin(pts, it=2):
    for _ in range(it):
        new = [pts[0]]
        for a, b in zip(pts, pts[1:]):
            new.append((0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]))
            new.append((0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]))
        new.append(pts[-1])
        pts = new
    return pts


def lathe(bm, prof, H, steps=96, it=2):
    prof = chaikin(prof, it)
    rings = []
    for r, z in prof:
        if r < 1e-5:
            rings.append([bm.verts.new((0, 0, z * H))])
        else:
            rings.append([bm.verts.new((r * H * cos(2 * pi * i / steps), r * H * sin(2 * pi * i / steps), z * H))
                          for i in range(steps)])
    for a, b in zip(rings, rings[1:]):
        if len(a) == 1 and len(b) == 1:
            continue
        for i in range(steps):
            j = (i + 1) % steps
            if len(a) == 1:
                bm.faces.new((a[0], b[j], b[i]))
            elif len(b) == 1:
                bm.faces.new((a[i], a[j], b[0]))
            else:
                bm.faces.new((a[i], a[j], b[j], b[i]))


def box(bm, center, size, bevel=0.0):
    m = Matrix.Translation(center) @ Matrix.Diagonal((size[0], size[1], size[2], 1))
    r = bmesh.ops.create_cube(bm, size=1.0, matrix=m)
    if bevel > 0:
        edges = list({e for v in r['verts'] for e in v.link_edges})
        bmesh.ops.bevel(bm, geom=edges + r['verts'], offset=bevel, segments=2, affect='EDGES', profile=0.5)


def ball(bm, center, radius):
    bmesh.ops.create_uvsphere(bm, u_segments=32, v_segments=16, radius=radius,
                              matrix=Matrix.Translation(center))


PROFILES = {
    'king': [(0, 0), (0.21, 0), (0.215, 0.012), (0.21, 0.03), (0.195, 0.04), (0.2, 0.055), (0.19, 0.07), (0.165, 0.08),
             (0.15, 0.095), (0.13, 0.12), (0.115, 0.16), (0.1, 0.22), (0.09, 0.3), (0.082, 0.4), (0.078, 0.5), (0.078, 0.58),
             (0.085, 0.6), (0.115, 0.615), (0.118, 0.63), (0.105, 0.645), (0.09, 0.652), (0.1, 0.665), (0.1, 0.678),
             (0.085, 0.688), (0.078, 0.7), (0.085, 0.74), (0.1, 0.78), (0.118, 0.81), (0.125, 0.825), (0.12, 0.84),
             (0.095, 0.85), (0.06, 0.858), (0, 0.862)],
    'queen': [(0, 0), (0.2, 0), (0.205, 0.012), (0.2, 0.028), (0.185, 0.038), (0.19, 0.052), (0.18, 0.065), (0.155, 0.075),
              (0.14, 0.09), (0.12, 0.115), (0.105, 0.16), (0.092, 0.24), (0.082, 0.34), (0.076, 0.45), (0.075, 0.55),
              (0.08, 0.6), (0.112, 0.615), (0.115, 0.63), (0.1, 0.645), (0.088, 0.652), (0.098, 0.665), (0.098, 0.678),
              (0.084, 0.688), (0.078, 0.7), (0.088, 0.75), (0.108, 0.8), (0.128, 0.84), (0.135, 0.855), (0.12, 0.86),
              (0.07, 0.87), (0.04, 0.885), (0, 0.89)],
    'bishop': [(0, 0), (0.19, 0), (0.195, 0.012), (0.19, 0.028), (0.175, 0.038), (0.18, 0.052), (0.17, 0.065),
               (0.145, 0.075), (0.13, 0.09), (0.11, 0.115), (0.095, 0.16), (0.082, 0.24), (0.073, 0.34), (0.068, 0.44),
               (0.07, 0.5), (0.1, 0.515), (0.105, 0.53), (0.09, 0.545), (0.078, 0.55), (0.088, 0.562), (0.088, 0.575),
               (0.075, 0.585), (0.07, 0.6), (0.095, 0.64), (0.11, 0.69), (0.112, 0.74), (0.1, 0.79), (0.075, 0.83),
               (0.045, 0.86), (0.03, 0.875), (0.042, 0.89), (0.045, 0.905), (0.035, 0.925), (0, 0.935)],
    'rook': [(0, 0), (0.2, 0), (0.205, 0.012), (0.2, 0.03), (0.185, 0.04), (0.19, 0.055), (0.175, 0.07), (0.15, 0.08),
             (0.14, 0.1), (0.13, 0.15), (0.122, 0.3), (0.118, 0.45), (0.12, 0.55), (0.13, 0.6), (0.155, 0.62),
             (0.16, 0.64), (0.16, 0.78), (0.12, 0.78), (0.12, 0.72), (0, 0.72)],
}
_pawn = [(0, 0), (0.3, 0), (0.305, 0.02), (0.29, 0.05), (0.27, 0.065), (0.275, 0.085), (0.25, 0.1), (0.21, 0.115),
         (0.18, 0.14), (0.15, 0.18), (0.125, 0.25), (0.11, 0.33), (0.105, 0.4), (0.11, 0.45), (0.17, 0.48),
         (0.175, 0.5), (0.15, 0.52), (0.12, 0.53), (0.11, 0.56)]
for k in range(-50, 91, 10):
    a = radians(k)
    _pawn.append((0.19 * cos(a) if k < 90 else 0.0, 0.72 + 0.19 * sin(a)))
PROFILES['pawn'] = _pawn


def apply_boolean(obj, cutter):
    mod = obj.modifiers.new('cut', 'BOOLEAN')
    mod.operation = 'DIFFERENCE'
    mod.solver = 'EXACT'
    mod.object = cutter
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)


def make_piece_mesh(kind, H):
    """Creates a mesh datablock for a chess piece of height H (origin at base centre)."""
    bm = bmesh.new()
    lathe(bm, PROFILES[kind], H, steps=96, it=1 if kind == 'rook' else 2)
    if kind == 'king':
        box(bm, (0, 0, 0.955 * H), (0.075 * H, 0.075 * H, 0.21 * H), bevel=0.006 * H)
        box(bm, (0, 0, 0.985 * H), (0.22 * H, 0.075 * H, 0.07 * H), bevel=0.006 * H)
    if kind == 'queen':
        for i in range(10):
            a = 2 * pi * i / 10
            ball(bm, (0.13 * H * cos(a), 0.13 * H * sin(a), 0.865 * H), 0.024 * H)
        ball(bm, (0, 0, 0.93 * H), 0.04 * H)
    me = bpy.data.meshes.new(kind + '_mesh')
    bm.normal_update()
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    smooth_shade(me)
    tmp = bpy.data.objects.new('tmp_' + kind, me)
    bpy.context.collection.objects.link(tmp)
    cutters = []
    if kind == 'rook':
        for a in (0, 60, 120):
            cme = bpy.data.meshes.new('cut')
            cbm = bmesh.new()
            box(cbm, (0, 0, 0.8 * H), (0.5 * H, 0.055 * H, 0.14 * H))
            cbm.to_mesh(cme); cbm.free()
            c = bpy.data.objects.new('cut', cme)
            c.rotation_euler.z = radians(a)
            bpy.context.collection.objects.link(c)
            cutters.append(c)
    if kind == 'bishop':
        cme = bpy.data.meshes.new('cut')
        cbm = bmesh.new()
        box(cbm, (0.07 * H, 0, 0.76 * H), (0.12 * H, 0.3 * H, 0.022 * H))
        cbm.to_mesh(cme); cbm.free()
        c = bpy.data.objects.new('cut', cme)
        bpy.context.collection.objects.link(c)
        c.rotation_euler.y = radians(-38)
        c.location = (0, 0, 0)
        cutters.append(c)
    bpy.context.view_layer.update()
    for c in cutters:
        apply_boolean(tmp, c)
        bpy.data.objects.remove(c)
    me = tmp.data
    bpy.data.objects.remove(tmp)
    return me


def plane(name, size, z, mat, loc=(0, 0)):
    me = bpy.data.meshes.new(name)
    s = size / 2
    me.from_pydata([(-s, -s, 0), (s, -s, 0), (s, s, 0), (-s, s, 0)], [], [(0, 1, 2, 3)])
    ob = bpy.data.objects.new(name, me)
    ob.location = (loc[0], loc[1], z)
    me.materials.append(mat)
    bpy.context.collection.objects.link(ob)
    return ob


def obj(name, me, mat=None, loc=(0, 0, 0)):
    ob = bpy.data.objects.new(name, me)
    ob.location = loc
    if mat is not None:
        if len(me.materials) == 0:
            me.materials.append(mat)
    bpy.context.collection.objects.link(ob)
    return ob

# --------------------------------------------------------------------------- choreography
# Impacts: (name, kind, white, H, (x, y), land_frame, fall_frames, tilt(deg x,y), shake)
IMPACTS = [
    ('Rook',   'rook',   True,  18.0, (5.0, 48.0),   124, 34, (3, -5), 0.65),
    ('Bishop', 'bishop', False, 17.0, (-22.0, 34.0), 158, 32, (-7, 9), 0.8),
    ('Pawn',   'pawn',   True,  10.0, (11.0, 19.0),  190, 30, (10, 6), 1.7),
    ('Queen',  'queen',  False, 21.0, (-3.0, 44.0),  226, 34, (-4, -3), 1.1),
]
FAR_DROPS = [
    ('FarPawnA', 'pawn', True, 12.0, (48.0, 150.0), 142, 34, (0, 0), 0.15),
    ('FarRook',  'rook', False, 16.0, (-70.0, 130.0), 176, 34, (0, 0), 0.2),
    ('FarPawnB', 'pawn', False, 12.0, (90.0, 210.0), 212, 34, (0, 0), 0.12),
]
STANDING = [('StandPawn1', 'pawn', True, 12.0, (-46.0, 112.0)), ('StandPawn2', 'pawn', False, 12.0, (62.0, 140.0)),
            ('StandQueen', 'queen', True, 26.0, (-130.0, 250.0)), ('StandBishop', 'bishop', False, 20.0, (150.0, 230.0))]
# lightning flashes: (frame, strength, bolt index or -1, sun yaw deg (dir light comes from), sun elevation)
FLASHES = [(38, 0.35, 0, 30, 35), (148, 0.7, 1, -60, 40), (262, 0.6, -1, 20, 50), (318, 0.9, -1, 180, 38),
           (336, 0.8, -1, 180, 38), (428, 1.6, 2, 175, 30), (446, 0.8, -1, 170, 35), (505, 1.2, 3, 190, 30),
           (548, 1.5, 2, 180, 40), (572, 1.0, -1, 180, 40)]
KING_RISE = (280, 440)
KING_FALL = (486, 590)


def flash_profile(f0, s):
    # double flicker
    return [(f0 - 1, 0.0), (f0, s), (f0 + 1, s * 0.25), (f0 + 2, s * 0.9), (f0 + 3, s * 0.4), (f0 + 5, s * 0.1), (f0 + 7, 0.0)]


def build():
    sc = setup_scene()
    col = bpy.context.collection

    # ---- crack sources (floor)
    crack_sources = []
    for name, kind, white, H, (x, y), lf, ff, tilt, sh in IMPACTS:
        R = H * 0.9
        crack_sources.append(((x, y, 0), random.random() * 10, 9, [(lf - 1, 0.0), (lf, 0.05), (lf + 3, R * 0.6), (lf + 12, R), (lf + 40, R * 1.15)], R * 2.5))
    kx, ky = 0.0, -KING_DIST
    crack_sources.append(((kx, ky, 0), 3.3, 44, [(KING_RISE[0] - 12, 0.0), (KING_RISE[0], 30.0), (300, 62.0), (318, 84.0), (340, 100.0), (420, 130.0)], 270.0))
    crack_sources.append(((0.4, -7.0, 0), 1.7, 38, [(300, 0.0), (304, 5.0), (318, 9.5), (330, 13.0), (345, 16.0)], 40.0))
    floor = plane('Board', 4000, 0.0, floor_material())
    crack_decals(crack_sources)

    # ---- sky: cloud layers + ground fog
    cl = plane('Clouds', 6000, 188, cloud_material('Cloud', 0.0, dens=0.55))
    cl.visible_shadow = False
    gf = plane('GroundFog', 700, 0.45, groundfog_material('GFog', 0.0, 0.32))
    gf.visible_shadow = False

    # ---- materials for pieces
    m_white = piece_material('WhiteMarble', True, 0.12)
    m_black = piece_material('BlackMarble', False, 0.12)
    m_king = piece_material('KingObsidian', False, 0.035, vein=(0.045, 0.043, 0.042, 1), rough_b=0.3)
    meshes = {}

    def piece_mesh(kind, H, white):
        k = (kind, H)
        if k not in meshes:
            me = make_piece_mesh(kind, H)
            meshes[k] = me
        me = meshes[k].copy()
        me.materials.clear()
        me.materials.append(m_white if white else m_black)
        return me

    # ---- chunk meshes for debris
    chunk_meshes = []
    for i in range(5):
        bm = bmesh.new()
        bmesh.ops.create_icosphere(bm, subdivisions=1, radius=0.5)
        for v in bm.verts:
            v.co *= 0.6 + 0.6 * random.random()
            v.co.z *= 0.55
        me = bpy.data.meshes.new(f'chunk{i}')
        bm.to_mesh(me); bm.free()
        chunk_meshes.append(me)
    slab_me = bpy.data.meshes.new('slab')
    bm = bmesh.new(); box(bm, (0, 0, 0), (1.95, 1.95, 0.3), bevel=0.03); bm.to_mesh(slab_me); bm.free()
    dust_mat = dust_material('Dust')

    shakes = []  # (frame, strength)

    def debris(tag, origin, f0, n, size, speed, up, mats, spread=1.0, gravity=14.0, mesh_list=None):
        for i in range(n):
            me = (mesh_list or chunk_meshes)[i % len(mesh_list or chunk_meshes)]
            ob = obj(f'{tag}_deb{i}', me)
            ob.data = me
            ob.material_slots and None
            ob.active_material = random.choice(mats) if False else None
            if len(me.materials) == 0:
                pass
            ob.data = me
            s = size * (0.5 + random.random())
            ob.scale = (s, s, s)
            mat = random.choice(mats)
            ob.material_slots  # noqa
            if not ob.data.materials:
                ob.data.materials.append(mat)
            ob.material_slots[0].link = 'OBJECT'
            ob.material_slots[0].material = mat
            a = random.random() * 2 * pi
            r0 = spread * (0.3 + random.random())
            p = Vector((origin[0] + r0 * cos(a), origin[1] + r0 * sin(a), 0.3 + random.random() * 1.5))
            v = Vector((cos(a) * speed * (0.4 + random.random()), sin(a) * speed * (0.4 + random.random()), up * (0.4 + random.random())))
            rot = Vector((random.random(), random.random(), random.random())) * 6
            w = Vector((random.gauss(0, 8), random.gauss(0, 8), random.gauss(0, 8)))
            frames, locs, rots = [f0 - 1], [(p.x, p.y, -30.0)], [tuple(rot)]
            dt = 1.0 / FPS
            rest = False
            for k in range(0, 110):
                frames.append(f0 + k)
                locs.append(tuple(p)); rots.append(tuple(rot))
                if rest:
                    continue
                v.z -= gravity * dt
                p = p + v * dt
                if Vector((p.x, p.y)).length < 4.0 and p.z < 5.0:
                    v.x, v.y = -v.x * 0.5, -v.y * 0.5
                    p = p + v * dt * 2
                rot = rot + w * dt
                if p.z < s * 0.25:
                    p.z = s * 0.25
                    v.z = -v.z * 0.3
                    v.x *= 0.55; v.y *= 0.55
                    w *= 0.5
                    if v.length < 0.8:
                        rest = True
            for ax in range(3):
                set_keys(ob, 'location', ax, frames, [l[ax] for l in locs])
                set_keys(ob, 'rotation_euler', ax, frames, [r[ax] for r in rots])
            fc = [c for c in fcurves_of(ob) if c.data_path == 'location']
            for c in fc:
                c.keyframe_points[0].interpolation = 'CONSTANT'

    def dust(tag, origin, f0, r_end, h_end, dens=1.0, life=90, grow=40):
        me = bpy.data.meshes.new(tag + '_dustmesh')
        bm = bmesh.new(); bmesh.ops.create_icosphere(bm, subdivisions=3, radius=1.0); bm.to_mesh(me); bm.free()
        ob = obj(tag + '_dust', me, loc=(origin[0], origin[1], 0.5))
        m = dust_mat.copy()
        me.materials.append(m)
        ctl = m.node_tree.nodes['DensityCtl'].outputs[0]
        for f, d in ((0, 0.0), (f0 - 1, 0.0), (f0, dens * 3.5), (f0 + int(life * 0.35), dens * 1.6), (f0 + life, 0.0)):
            ctl.default_value = d
            ctl.keyframe_insert('default_value', frame=f)
        set_keys(ob, 'scale', 0, [0, f0 - 1, f0, f0 + 6, f0 + grow, f0 + life], [0.01, 0.01, r_end * 0.15, r_end * 0.55, r_end * 0.9, r_end], 'BEZIER')
        set_keys(ob, 'scale', 1, [0, f0 - 1, f0, f0 + 6, f0 + grow, f0 + life], [0.01, 0.01, r_end * 0.15, r_end * 0.55, r_end * 0.9, r_end], 'BEZIER')
        set_keys(ob, 'scale', 2, [0, f0 - 1, f0, f0 + 6, f0 + grow, f0 + life], [0.01, 0.01, h_end * 0.3, h_end * 0.6, h_end * 0.9, h_end], 'BEZIER')
        for c in fcurves_of(ob):
            c.keyframe_points[1].interpolation = 'CONSTANT'
        ob.visible_shadow = False
        for ff, hid in ((0, True), (f0 - 1, True), (f0, False), (f0 + life + 1, True)):
            ob.hide_render = hid
            ob.keyframe_insert('hide_render', frame=ff)
        return ob

    def drop(name, kind, white, H, xy, lf, ff, tilt, sh, big=True):
        me = piece_mesh(kind, H, white)
        ob = obj(name, me)
        z0 = 205.0
        frames = list(range(lf - ff, lf + 1))
        zs = [z0 * (1 - ((f - (lf - ff)) / ff) ** 2) - 0.0 for f in frames]
        zs[-1] = -0.25 * H * 0.08
        # bounce / settle
        sink = -0.06 * H
        extra = [(lf + 2, sink + 0.03 * H), (lf + 5, sink - 0.01 * H), (lf + 9, sink)]
        frames_all = [0, lf - ff - 1] + frames + [e[0] for e in extra]
        zs_all = [900.0, 900.0] + zs + [e[1] for e in extra]
        set_keys(ob, 'location', 2, frames_all, zs_all)
        set_keys(ob, 'location', 0, [0], [xy[0]])
        set_keys(ob, 'location', 1, [0], [xy[1]])
        # tumble during fall, then tilt + wobble on landing
        tx, ty = radians(tilt[0]), radians(tilt[1])
        rz = random.random() * 2 * pi
        rf = [lf - ff, lf, lf + 3, lf + 7, lf + 14]
        set_keys(ob, 'rotation_euler', 0, rf, [tx * 2.5, tx * 1.6, -tx * 0.4, tx * 1.2, tx], 'BEZIER')
        set_keys(ob, 'rotation_euler', 1, rf, [-ty * 2, ty * 1.6, -ty * 0.3, ty * 1.1, ty], 'BEZIER')
        set_keys(ob, 'rotation_euler', 2, [lf - ff, lf], [rz - 0.6, rz], 'BEZIER')
        shakes.append((lf, sh))
        if big:
            debris(name, xy, lf, 26, 0.35 + H * 0.02, 9.0 + H * 0.4, 7.0 + H * 0.3, [m_white, m_black], spread=H * 0.2)
            dust(name, xy, lf, H * 1.9, H * 0.55)
        else:
            dust(name, xy, lf, H * 1.6, H * 0.5, dens=0.8)
        return ob

    for spec in IMPACTS:
        drop(*spec, big=True)
    for spec in FAR_DROPS:
        drop(*spec, big=False)
    for name, kind, white, H, xy in STANDING:
        ob = obj(name, piece_mesh(kind, H, white), loc=(xy[0], xy[1], -0.3))
        ob.rotation_euler = (radians(random.uniform(-3, 3)), radians(random.uniform(-3, 3)), random.random() * 6)

    # ---- the black king
    king_me = make_piece_mesh('king', H_KING)
    king_me.materials.append(m_king)
    Rb = 0.21 * H_KING
    pivot = bpy.data.objects.new('KingPivot', None)
    col.objects.link(pivot)
    pivot.location = (kx, ky + Rb, 0)
    king = obj('BlackKing', king_me)
    king.parent = pivot
    r0, r1 = KING_RISE
    fr = list(range(r0, r1 + 1, 2))
    zs = []
    for f in fr:
        t = (f - r0) / (r1 - r0)
        e = t * t * (3 - 2 * t)
        e = 0.15 * t + 0.85 * e
        zs.append(-H_KING - 6 + (H_KING + 6) * e + 0.35 * sin(f * 1.7) * (1 - t))
    set_keys(king, 'location', 2, [0] + fr, [-H_KING - 6] + zs)
    set_keys(king, 'location', 1, [0], [-Rb])
    set_keys(king, 'rotation_euler', 2, [0], [radians(20)])
    # unsteady wobble, then topple toward the camera
    f0, f1 = KING_FALL
    wob = [(462, 0.0), (470, 0.8), (476, -0.5), (482, 1.0), (486, 0.0)]
    frames, angs = [0, 461], [0.0, 0.0]
    for f, a in wob:
        frames.append(f); angs.append(radians(-a))
    for f in range(f0 + 1, f1 + 1):
        t = (f - f0) / (f1 - f0)
        angs.append(-radians(88) * (t ** 2.35))
        frames.append(f)
    set_keys(pivot, 'rotation_euler', 0, frames, angs, 'BEZIER')
    shakes.append((r0, 0.0))
    # king eruption: slabs + dust
    for i in range(3):
        dust(f'KingBase{i}', (kx + random.uniform(-15, 15), ky - 10 + random.uniform(-10, 5)), r0 + 10 + i * 30, 52 + i * 6, 26, dens=0.5, life=260, grow=90)
    for b in range(4):
        fb = r0 + 16 + b * 28
        a0 = random.random() * 2 * pi
        pts = (kx + (Rb + 4) * cos(a0), ky + (Rb + 4) * sin(a0))
        debris(f'KingSlab{b}', pts, fb, 12, 1.0, 9.0, 14.0, [m_white, m_black], spread=16.0, gravity=11.0, mesh_list=[slab_me])

    # ---- lightning bolts
    bolt_mat = emission_material('Bolt', (0.75, 0.82, 1.0, 1), 60.0)
    bolt_specs = [((-150, 330), 190), ((170, 260), 185), ((-35, -330), 200), ((60, -300), 200)]
    bolts = []
    for bi, ((bx, by), top) in enumerate(bolt_specs):
        cu = bpy.data.curves.new(f'bolt{bi}', 'CURVE')
        cu.dimensions = '3D'
        cu.bevel_depth = 0.55
        cu.bevel_resolution = 1

        def add_branch(p0, direction, length, depth):
            sp = cu.splines.new('POLY')
            pts = [p0]
            p = Vector(p0)
            segs = 14 if depth == 0 else 6
            for s in range(segs):
                p = p + direction * (length / segs) + Vector((random.gauss(0, 1), random.gauss(0, 1), 0)) * length * 0.05
                pts.append(p.copy())
                if depth < 1 and random.random() < 0.3:
                    add_branch(p.copy(), (direction + Vector((random.gauss(0, 0.7), random.gauss(0, 0.7), 0))).normalized(), length * 0.3, depth + 1)
            sp.points.add(len(pts) - 1)
            for k, q in enumerate(pts):
                sp.points[k].co = (q.x, q.y, q.z, 1)
                sp.points[k].radius = max(0.15, 1.0 - k / len(pts)) * (1.0 if depth == 0 else 0.5)
        add_branch(Vector((bx, by, top)), Vector((0, 0, -1)), top, 0)
        ob = bpy.data.objects.new(f'Bolt{bi}', cu)
        cu.materials.append(bolt_mat)
        col.objects.link(ob)
        ob.visible_shadow = False
        ob.hide_render = True
        ob.keyframe_insert('hide_render', frame=0)
        bolts.append(ob)

    # ---- lights
    moon = bpy.data.lights.new('Moon', 'SUN')
    moon.energy = 1.1
    moon.angle = radians(12)
    moon.color = (0.72, 0.8, 1.0)
    mo = bpy.data.objects.new('Moon', moon)
    col.objects.link(mo)
    # light from behind the camera (-Y), elevation 41 deg -> shadows point +Y
    mo.rotation_euler = (radians(90 - 41), 0, 0.0)  # travels +Y: comes from behind the camera / behind the king
    mo.visible_glossy = False
    set_keys(moon, 'energy', 0, [0, 260, 300, 360, 470], [2.2, 2.3, 3.2, 3.6, 3.2], 'BEZIER')

    lsun = bpy.data.lights.new('LightningSun', 'SUN')
    lsun.angle = radians(1.5)
    lsun.color = (0.78, 0.84, 1.0)
    add_driver(lsun, 'energy', '14.0*f')
    ls = bpy.data.objects.new('LightningSun', lsun)
    col.objects.link(ls)

    fk_frames, fk_vals = [0], [0.0]
    for (f, s, b, yaw, el) in FLASHES:
        for ff, v in flash_profile(f, s):
            fk_frames.append(ff); fk_vals.append(v)
        # light direction: coming from yaw (0 = from +Y in front of camera, 180 = from behind)
        rot = (radians(90 - el), 0, radians(yaw + 180))
        for ax in range(3):
            set_keys(ls, 'rotation_euler', ax, [f - 1], [rot[ax]], 'CONSTANT')
        if b >= 0:
            bo = bolts[b]
            for ff, hid in ((f - 1, True), (f, False), (f + 4, True)):
                bo.hide_render = hid
                bo.keyframe_insert('hide_render', frame=ff)
    order = sorted(zip(fk_frames, fk_vals))
    set_keys(sc, '["flash"]', 0, [o[0] for o in order], [o[1] for o in order], 'LINEAR')

    # ---- rain (geometry nodes)
    rain_me = bpy.data.meshes.new('RainMesh')
    rain = obj('Rain', rain_me)
    ng = bpy.data.node_groups.new('RainGN', 'GeometryNodeTree')
    ng.interface.new_socket('Geometry', in_out='INPUT', socket_type='NodeSocketGeometry')
    ng.interface.new_socket('Geometry', in_out='OUTPUT', socket_type='NodeSocketGeometry')
    gi = node(ng, 'NodeGroupInput'); go = node(ng, 'NodeGroupOutput')
    rv = node(ng, 'FunctionNodeRandomValue', data_type='FLOAT_VECTOR')
    rv.inputs[0].default_value = (-22, -22, 0)
    rv.inputs[1].default_value = (22, 22, 1)
    st = node(ng, 'GeometryNodeInputSceneTime')
    sep = node(ng, 'ShaderNodeSeparateXYZ')
    link(ng, rv.outputs[0], sep.inputs[0])
    Hh = 16.0
    fz = math_(ng, 'FRACT', math_(ng, 'ADD', sep.outputs['Z'], math_(ng, 'MULTIPLY', st.outputs['Seconds'], 14.0 / Hh)))
    z = math_(ng, 'SUBTRACT', Hh - 0.5, math_(ng, 'MULTIPLY', fz, Hh))
    tilt = 0.18
    comb = node(ng, 'ShaderNodeCombineXYZ')
    link(ng, math_(ng, 'ADD', sep.outputs['X'], math_(ng, 'MULTIPLY', z, tilt)), comb.inputs['X'])
    link(ng, sep.outputs['Y'], comb.inputs['Y'])
    link(ng, z, comb.inputs['Z'])
    pts = node(ng, 'GeometryNodePoints')
    pts.inputs['Count'].default_value = 7000
    link(ng, comb.outputs[0], pts.inputs['Position'])
    cyl = node(ng, 'GeometryNodeMeshCylinder')
    cyl.inputs['Vertices'].default_value = 3
    cyl.inputs['Radius'].default_value = 0.004
    cyl.inputs['Depth'].default_value = 0.55
    tf = node(ng, 'GeometryNodeTransform')
    link(ng, cyl.outputs['Mesh'], tf.inputs['Geometry'])
    tf.inputs['Rotation'].default_value = (0, -math.atan(tilt), 0)
    iop = node(ng, 'GeometryNodeInstanceOnPoints')
    link(ng, pts.outputs[0], iop.inputs['Points'])
    link(ng, tf.outputs[0], iop.inputs['Instance'])
    sm = node(ng, 'GeometryNodeSetMaterial')
    sm.inputs['Material'].default_value = rain_material()
    link(ng, iop.outputs[0], sm.inputs['Geometry'])
    link(ng, sm.outputs[0], go.inputs['Geometry'])
    mod = rain.modifiers.new('RainGN', 'NODES')
    mod.node_group = ng
    rain.visible_shadow = False

    # ---- camera rig
    rig = bpy.data.objects.new('CamRig', None); col.objects.link(rig)
    shake = bpy.data.objects.new('CamShake', None); col.objects.link(shake)
    shake.parent = rig
    cam_d = bpy.data.cameras.new('POV')
    cam_d.lens = 20
    cam_d.sensor_width = 36
    cam_d.clip_start = 0.05
    cam_d.clip_end = 6000
    cam = bpy.data.objects.new('POV', cam_d); col.objects.link(cam)
    cam.parent = shake
    cam.rotation_euler = (radians(90), 0, 0)
    sc.camera = cam
    body = bpy.data.objects.new('BodyRoot', None); col.objects.link(body)
    c1 = body.constraints.new('COPY_LOCATION'); c1.target = rig; c1.use_z = False
    c2 = body.constraints.new('COPY_ROTATION'); c2.target = rig; c2.use_x = False; c2.use_y = False
    fcs = body.driver_add('scale', 2)
    dv = fcs.driver; dv.type = 'SCRIPTED'
    vv = dv.variables.new(); vv.name = 'z'; vv.type = 'TRANSFORMS'
    vv.targets[0].id = rig; vv.targets[0].transform_type = 'LOC_Z'; vv.targets[0].transform_space = 'WORLD_SPACE'
    dv.expression = 'z/1.7'
    bm = bmesh.new()
    def capsule(p0, p1, r):
        p0, p1 = Vector(p0), Vector(p1)
        d = p1 - p0
        mtx = Matrix.Translation((p0 + p1) / 2) @ d.to_track_quat('Z', 'Y').to_matrix().to_4x4()
        bmesh.ops.create_cone(bm, cap_ends=True, segments=12, radius1=r, radius2=r, depth=d.length, matrix=mtx)
        ball(bm, tuple(p0), r); ball(bm, tuple(p1), r)
    capsule((-0.11, -0.12, 0.08), (-0.11, -0.12, 0.85), 0.075)
    capsule((0.11, -0.12, 0.08), (0.11, -0.12, 0.85), 0.075)
    bmesh.ops.create_cone(bm, cap_ends=True, segments=16, radius1=0.15, radius2=0.19, depth=0.55,
                          matrix=Matrix.Translation((0, -0.14, 1.15)) @ Matrix.Diagonal((1.0, 0.6, 1.0, 1.0)))
    capsule((-0.2, -0.14, 1.43), (0.2, -0.14, 1.43), 0.07)
    capsule((-0.25, -0.13, 1.4), (-0.3, -0.06, 0.88), 0.05)
    capsule((0.25, -0.13, 1.4), (0.3, -0.06, 0.88), 0.05)
    capsule((0, -0.15, 1.45), (0, -0.15, 1.55), 0.05)
    ball(bm, (0, -0.16, 1.64), 0.1)
    bme = bpy.data.meshes.new('BodyShadow'); bm.to_mesh(bme); bm.free()
    bo = obj('BodyShadow', bme)
    bo.parent = body
    bo.visible_camera = False; bo.visible_glossy = False; bo.visible_transmission = False; bo.visible_diffuse = False
    rain_c = rain.constraints.new('COPY_LOCATION')
    rain_c.target = rig

    # keyframes: frame, yaw, pitch, x, y, z
    K = [
        (0, 0, -47, 0, 0, 1.7), (22, 3, -44, 0, 0, 1.7), (72, -4, -4, 0, 0, 1.7), (95, 2, 3, 0, 0.05, 1.7),
        (110, 0, 15, 0, 0.1, 1.7), (121, -4, 7, 0, 0.1, 1.7), (126, -5, 2, 0, 0.1, 1.68), (140, 0, 4, 0, 0.15, 1.7),
        (151, 17, 14, 0, 0.15, 1.7), (160, 29, 4, 0, 0.15, 1.66), (176, 10, 3, 0, 0.2, 1.7),
        (184, -24, 19, 0, 0.2, 1.7), (190, -30, 7, 0, 0.2, 1.62), (195, -27, -7, 0, 0.1, 1.42), (206, -20, 1, 0, 0.05, 1.6),
        (216, -5, 11, 0, 0.05, 1.7), (228, 1, 2, 0, 0.05, 1.66), (246, 4, 0, 0, 0.1, 1.7), (263, -2, -9, 0, 0.12, 1.7),
        (292, -4, -43, 0, 0.3, 0.78), (330, 3, -46, 0, 0.3, 0.76), (352, 0, -38, 0, 0.3, 0.8), (360, 2, -28, 0, 0.3, 0.9),
        (378, 70, -4, 0, 0.3, 1.66), (392, 180, 10, 0, 0.3, 1.7), (430, 181, 34, 0, 0.3, 1.7), (470, 179, 52, 0, 0.3, 1.7),
        (486, 180, 54, 0, 0.3, 1.7), (520, 181, 64, 0, 0.9, 1.68), (556, 179, 78, 0, 1.6, 1.62), (590, 180, 88, 0, 1.9, 1.55),
    ]
    fr = [k[0] for k in K]
    set_keys(rig, 'rotation_euler', 2, fr, [radians(k[1]) for k in K], 'BEZIER')
    set_keys(rig, 'rotation_euler', 0, fr, [radians(k[2]) for k in K], 'BEZIER')
    for ax in range(3):
        set_keys(rig, 'location', ax, fr, [k[3 + ax] for k in K], 'BEZIER')
    for c in fcurves_of(rig):
        for kp in c.keyframe_points:
            kp.handle_left_type = kp.handle_right_type = 'AUTO_CLAMPED'
        c.update()

    # handheld + impact shake, baked per frame
    rumble = lambda f: (0.25 * max(0, min(1, (f - 280) / 60)) if 280 <= f < 445 else 0) + (
        0.2 + 0.9 * ((f - 486) / 104) ** 2 if f >= 486 else 0) + (0.3 if 462 <= f < 486 else 0)
    frames = list(range(0, F_END + 1))
    px, py, pz, rx, ry, rz = [], [], [], [], [], []
    for f in frames:
        t = f / FPS
        hp = 0.45 * noise.noise(Vector((t * 0.35, 1.3, 0))) + 0.12 * noise.noise(Vector((t * 1.7, 4.1, 0)))
        hy = 0.45 * noise.noise(Vector((t * 0.3, 7.7, 0))) + 0.1 * noise.noise(Vector((t * 1.9, 2.2, 0)))
        hr = 0.6 * noise.noise(Vector((t * 0.25, 9.9, 0)))
        bz = 0.012 * sin(2 * pi * t / 3.6)
        e_p = e_r = e_z = 0.0
        for (fi, s) in shakes:
            if f >= fi and s > 0:
                dtt = (f - fi) / FPS
                env = s * exp(-dtt / 0.38)
                e_p += env * 1.6 * noise.noise(Vector((dtt * 14, fi * 0.1, 3.0)))
                e_r += env * 1.3 * noise.noise(Vector((dtt * 12, fi * 0.1, 5.0)))
                e_z += env * 0.035 * noise.noise(Vector((dtt * 16, fi * 0.1, 8.0)))
        r = rumble(f)
        e_p += r * 1.2 * noise.noise(Vector((t * 9, 11.0, 0)))
        e_r += r * 1.0 * noise.noise(Vector((t * 8, 13.0, 0)))
        e_z += r * 0.02 * noise.noise(Vector((t * 10, 17.0, 0)))
        rx.append(radians(hp + e_p)); ry.append(radians(hr + e_r)); rz.append(radians(hy))
        px.append(0.0); py.append(0.0); pz.append(bz + e_z)
    set_keys(shake, 'rotation_euler', 0, frames, rx)
    set_keys(shake, 'rotation_euler', 1, frames, ry)
    set_keys(shake, 'rotation_euler', 2, frames, rz)
    set_keys(shake, 'location', 2, frames, pz)

    # depth of field: shallow for the crouch close-up
    cam_d.dof.use_dof = True
    set_keys(cam_d, 'dof.focus_distance', 0, [0, 60, 90, 264, 286, 350, 372], [2.4, 3.0, 30.0, 30.0, 1.3, 1.3, 60.0], 'BEZIER')
    set_keys(cam_d, 'dof.aperture_fstop', 0, [0, 60, 90, 264, 286, 350, 372], [2.8, 4.0, 11.0, 11.0, 2.2, 2.2, 11.0], 'BEZIER')

    # ---- compositor: distance fog, glow, lens, vignette
    sc.use_nodes = True
    tree = sc.node_tree
    tree.nodes.clear()
    rl = tree.nodes.new('CompositorNodeRLayers')
    fogc = tree.nodes.new('CompositorNodeRGB')
    fogc.outputs[0].default_value = (0.04, 0.048, 0.062, 1)
    flashc = tree.nodes.new('CompositorNodeRGB')
    flashc.outputs[0].default_value = (0.32, 0.37, 0.48, 1)
    fmix = tree.nodes.new('CompositorNodeMixRGB')
    add_driver(fmix.inputs[0], 'default_value', 'min(1.0,0.6*f)')
    tree.links.new(fogc.outputs[0], fmix.inputs[1]); tree.links.new(flashc.outputs[0], fmix.inputs[2])
    mul = tree.nodes.new('CompositorNodeMath'); mul.operation = 'MULTIPLY'; mul.inputs[1].default_value = 0.9; mul.use_clamp = True
    tree.links.new(rl.outputs['Mist'], mul.inputs[0])
    ftex = bpy.data.textures.new('FogNoise', 'CLOUDS')
    ftex.noise_scale = 0.45
    ftex.noise_depth = 2
    tn = tree.nodes.new('CompositorNodeTexture')
    tn.texture = ftex
    rig = bpy.data.objects['CamRig']
    for ax, (tr_type, k) in enumerate((('ROT_Z', -0.9), ('ROT_X', 0.9))):
        fc = tn.inputs['Offset'].driver_add('default_value', ax)
        d = fc.driver
        d.type = 'SCRIPTED'
        v = d.variables.new(); v.name = 'r'; v.type = 'TRANSFORMS'
        v.targets[0].id = rig; v.targets[0].transform_type = tr_type; v.targets[0].transform_space = 'WORLD_SPACE'
        vf = d.variables.new(); vf.name = 'fr'; vf.type = 'SINGLE_PROP'
        vf.targets[0].id_type = 'SCENE'; vf.targets[0].id = sc; vf.targets[0].data_path = 'frame_current'
        d.expression = f'{k}*r + fr*0.0025'
    tn.inputs['Scale'].default_value = (1.0, 1.0, 1.0)
    fvar = tree.nodes.new('CompositorNodeMapRange')
    tree.links.new(tn.outputs['Value'], fvar.inputs[0])
    fvar.inputs[1].default_value = 0.25; fvar.inputs[2].default_value = 0.75
    fvar.inputs[3].default_value = 0.72; fvar.inputs[4].default_value = 1.12
    fmul = tree.nodes.new('CompositorNodeMath'); fmul.operation = 'MULTIPLY'; fmul.use_clamp = True
    tree.links.new(mul.outputs[0], fmul.inputs[0]); tree.links.new(fvar.outputs[0], fmul.inputs[1])
    fog = tree.nodes.new('CompositorNodeMixRGB')
    tree.links.new(fmul.outputs[0], fog.inputs[0])
    tree.links.new(rl.outputs['Image'], fog.inputs[1])
    tree.links.new(fmix.outputs[0], fog.inputs[2])
    glare = tree.nodes.new('CompositorNodeGlare')
    glare.glare_type = 'FOG_GLOW'
    try:
        glare.inputs['Threshold'].default_value = 1.2
        glare.inputs['Strength'].default_value = 0.6
        glare.inputs['Size'].default_value = 0.6
    except Exception:
        pass
    tree.links.new(fog.outputs[0], glare.inputs[0])
    lens = tree.nodes.new('CompositorNodeLensdist')
    lens.inputs['Dispersion'].default_value = 0.012
    lens.inputs['Distortion'].default_value = -0.012
    tree.links.new(glare.outputs[0], lens.inputs[0])
    ell = tree.nodes.new('CompositorNodeEllipseMask')
    try:
        ell.inputs['Size'].default_value = (0.95, 0.95)
    except Exception:
        ell.width = ell.height = 0.95
    blur = tree.nodes.new('CompositorNodeBlur')
    blur.filter_type = 'GAUSS'
    blur.size_x = blur.size_y = 300
    try:
        blur.use_relative = True
        blur.factor_x = blur.factor_y = 30
    except Exception:
        pass
    tree.links.new(ell.outputs[0], blur.inputs[0])
    vig = tree.nodes.new('CompositorNodeMixRGB')
    vig.blend_type = 'MULTIPLY'
    vmap = tree.nodes.new('CompositorNodeMapRange')
    vmap.inputs[1].default_value = 0; vmap.inputs[2].default_value = 1
    vmap.inputs[3].default_value = 0.45; vmap.inputs[4].default_value = 1.0
    tree.links.new(blur.outputs[0], vmap.inputs[0])
    vig.inputs[0].default_value = 1.0
    tree.links.new(lens.outputs[0], vig.inputs[1])
    tree.links.new(vmap.outputs[0], vig.inputs[2])
    comp = tree.nodes.new('CompositorNodeComposite')
    tree.links.new(vig.outputs[0], comp.inputs[0])
    return sc


if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    out = argv[0] if argv else '/tmp/checkmate.blend'
    sc = build()
    bpy.ops.wm.save_as_mainfile(filepath=out)
    print('SAVED', out)
