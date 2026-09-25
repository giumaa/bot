"""Render selected frames or a range.
blender -b -y checkmate.blend --python render_frames.py -- <outdir> <pct> <samples> <frames: 10,80,... | a-b>
"""
import bpy, sys, os, time
argv = sys.argv[sys.argv.index('--') + 1:]
outdir, pct, samples, spec = argv[0], int(argv[1]), int(argv[2]), argv[3]
sc = bpy.context.scene
sc.render.resolution_percentage = pct
sc.cycles.samples = samples
sc.render.image_settings.file_format = 'PNG'
sc.render.image_settings.color_depth = '8'
os.makedirs(outdir, exist_ok=True)
if '-' in spec and ',' not in spec:
    a, b = map(int, spec.split('-'))
    frames = range(a, b + 1)
else:
    frames = [int(x) for x in spec.split(',')]
for f in frames:
    path = os.path.join(outdir, f'f{f:04d}.png')
    if os.path.exists(path) and os.path.getsize(path) > 0:
        continue
    sc.frame_set(f)
    sc.render.filepath = path
    t = time.time()
    bpy.ops.render.render(write_still=True)
    print(f'FRAME {f} {time.time()-t:.1f}s', flush=True)
