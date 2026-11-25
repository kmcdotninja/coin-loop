"""Coin Loop models. Run: npm run coins   (or: Blender -b -P blender/coins.py)
One coin per currency: a disc with a raised rim, a reeded edge, the symbol engraved into the face
(front and back), soft bevels everywhere so edges catch the light. Exported together to
public/models/coins.glb, one object per coin (coin_USD, coin_EUR, ...). Materials are set in the browser.
"""
import bpy, bmesh, math, os, sys

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'models', 'coins.glb')
BLEND = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'coins.blend')
HERE = os.path.dirname(os.path.abspath(__file__))
FONT = os.path.join(HERE, 'fonts', 'Inter-Bold.ttf')  # Inter (OFL), in the repo so the coins build the same everywhere
FALLBACKS = [f for f in ['/System/Library/Fonts/Supplemental/Arial Bold.ttf', '/System/Library/Fonts/SFNS.ttf',
             'C:/Windows/Fonts/arialbd.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'] if os.path.exists(f)]
COINS = [('USD', '$'), ('EUR', '€'), ('GBP', '£'), ('JPY', '¥'), ('NGN', '₦'), ('INR', '₹'), ('BTC', '₿')]

R, T = 1.0, 0.16          # radius, thickness
FACE_R, RECESS = 0.84, 0.022  # the field inside the rim, and how far it sits below the rim
ENGRAVE = 0.042            # symbol depth below the field (engraved coins)
RAISE = 0.02               # symbol height above the field (raised coins); the rim stands 0.022 proud
REEDS = 120                # grooves around the edge
GLYPH_H = 0.92             # symbol height (the face is 1.68 across)

bpy.ops.wm.read_factory_settings(use_empty=True)
font = bpy.data.fonts.load(FONT)
fallbacks = [bpy.data.fonts.load(f) for f in FALLBACKS if os.path.exists(f)]

def apply_all(ob):
    bpy.context.view_layer.objects.active = ob
    for m in list(ob.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)

def boolean(target, cutter, op='DIFFERENCE', messy=False):
    m = target.modifiers.new('b', 'BOOLEAN'); m.operation = op; m.object = cutter; m.solver = 'EXACT'
    if messy: m.use_self = True; m.use_hole_tolerant = True
    apply_all(target); bpy.data.objects.remove(cutter, do_unlink=True)

def cylinder(r, depth, z=0, verts=120):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=(0, 0, z))
    return bpy.context.object

def outward(o):
    """weld the extrusion's caps to its walls and point every face outward, so booleans see a closed solid"""
    bm = bmesh.new(); bm.from_mesh(o.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(o.data); bm.free()

def has_glyph(ch, f):
    """a missing glyph draws a box of 32 vertices"""
    bpy.ops.object.text_add(); t = bpy.context.object
    t.data.body = ch; t.data.font = f; t.data.extrude = 0.1
    bpy.ops.object.convert(target='MESH'); m = bpy.context.object
    ok = len(m.data.vertices) > 40
    bpy.data.objects.remove(m, do_unlink=True)
    return ok

def spline_poly(sp):
    """the outline as a polygon, sampled along its bezier segments"""
    if not len(sp.bezier_points): return [(p.co.x, p.co.y) for p in sp.points]
    bp, out = sp.bezier_points, []
    for i in range(len(bp)):
        p0, p1 = bp[i], bp[(i + 1) % len(bp)]
        a, h1, h2, d = p0.co, p0.handle_right, p1.handle_left, p1.co
        for k in range(8):
            t = k / 8; u = 1 - t
            out.append((u**3 * a.x + 3 * u * u * t * h1.x + 3 * u * t * t * h2.x + t**3 * d.x,
                        u**3 * a.y + 3 * u * u * t * h1.y + 3 * u * t * t * h2.y + t**3 * d.y))
    return out

def inside(pt, poly):
    x, y = pt; n = len(poly); c = False
    for i in range(n):
        (x1, y1), (x2, y2) = poly[i], poly[i - 1]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1: c = not c
    return c

def glyph_mesh(ch, size):
    """The symbol as one clean solid, whatever the font does with overlapping outlines: every outline becomes its own
    prism, the solid ones are unioned and the counters (outlines lying wholly inside another) subtracted. Centred, GLYPH_H tall."""
    f = next((f for f in [font] + fallbacks if has_glyph(ch, f)), font)
    bpy.ops.object.text_add(); t = bpy.context.object
    t.data.body = ch; t.data.font = f; t.data.size = size; t.data.resolution_u = 6
    t.data.align_x = 'CENTER'; t.data.align_y = 'CENTER'
    bpy.ops.object.convert(target='CURVE'); c = bpy.context.object
    # a hole (the inside of B, €, £) lies wholly inside another outline; a crossbar that only overlaps a stroke (₦, ¥)
    # is solid. Winding can't tell these apart: fonts wind overlapping bars like counters.
    polys = [spline_poly(sp) for sp in c.data.splines]
    def is_hole(i):
        depth = sum(1 for j in range(len(polys)) if j != i and all(inside(p, polys[j]) for p in polys[i][::3]))
        return depth % 2 == 1
    solids, holes = [], []
    for i in range(len(polys)):
        o = c.copy(); o.data = c.data.copy(); bpy.context.collection.objects.link(o)
        for j in reversed(range(len(o.data.splines))):
            if j != i: o.data.splines.remove(o.data.splines[j])
        o.data.extrude = 1.0; o.data.fill_mode = 'BOTH'; o.data.resolution_u = 6
        bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o
        bpy.ops.object.convert(target='MESH'); o = bpy.context.object
        outward(o)
        (holes if is_hole(i) else solids).append(o)
    bpy.data.objects.remove(c, do_unlink=True)
    m = solids[0]
    outward(m)
    for o in solids[1:]: boolean(m, o, 'UNION')
    for o in holes:
        o.scale.z = 1.3; bpy.context.view_layer.objects.active = o; bpy.ops.object.transform_apply(scale=True)
        boolean(m, o, 'DIFFERENCE')
    xs = [v.co.x for v in m.data.vertices]; ys = [v.co.y for v in m.data.vertices]
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    k = GLYPH_H / (max(ys) - min(ys))  # every symbol the same height on the face
    for v in m.data.vertices: v.co.x = (v.co.x - cx) * k; v.co.y = (v.co.y - cy) * k
    return m, len(m.data.vertices)

made = []
for (code, ch), relief in [(c, r) for r in ('engraved', 'raised') for c in COINS]:
    raised = relief == 'raised'
    coin = cylinder(R, T)
    coin.name = f'coin_{code}' + ('_raised' if raised else '')
    # the field: recessed inside the rim, on both faces
    for s in (1, -1):
        boolean(coin, cylinder(FACE_R, RECESS * 2, z=s * T / 2, verts=120))
    # the reeded edge: thin boxes around the rim, joined into one cutter
    cut = []
    for i in range(REEDS):
        a = 2 * math.pi * i / REEDS
        bpy.ops.mesh.primitive_cube_add(size=1, location=(R * math.cos(a), R * math.sin(a), 0), rotation=(0, 0, a))
        b = bpy.context.object; b.scale = (0.018, 0.009, T * 0.72); cut.append(b)
    bpy.ops.object.select_all(action='DESELECT')
    for b in cut: b.select_set(True)
    bpy.context.view_layer.objects.active = cut[0]; bpy.ops.object.join()
    boolean(coin, bpy.context.object)
    # the symbol on both faces (mirrored on the back so it reads correctly there): engraved into the field, or raised
    # from it in relief, its top just under the rim so a coin still lies flat on its rim
    for s in (1, -1):
        g, n = glyph_mesh(ch, 1.0)
        if raised:
            g.scale = (s, 1, RAISE / 2)  # extrude=1 spans -1..1: RAISE tall, centred so it stands on the field
            g.location = (0, 0, s * (T / 2 - RECESS + RAISE / 2 - 0.001))
        else:
            g.scale = (s, 1, ENGRAVE)  # cuts ENGRAVE below the field
            g.location = (0, 0, s * (T / 2 - RECESS))
        bpy.context.view_layer.objects.active = g; bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        outward(g)  # the mirror (negative scale) turns the solid inside out
        boolean(coin, g, 'UNION' if raised else 'DIFFERENCE')
    outward(coin)  # booleans can leave walls wound inward: the browser culls those, so make every face point out
    # soft bevels on every hard edge, then smooth shading that keeps the flats flat
    bv = coin.modifiers.new('bevel', 'BEVEL'); bv.width = 0.014; bv.segments = 4; bv.profile = 0.6; bv.limit_method = 'ANGLE'; bv.angle_limit = math.radians(40)
    bv.harden_normals = True
    wn = coin.modifiers.new('wn', 'WEIGHTED_NORMAL'); wn.keep_sharp = True
    bpy.context.view_layer.objects.active = coin
    bpy.ops.object.shade_smooth()
    apply_all(coin)
    # tidy what the booleans left: zero-area slivers shade as creases across flat faces
    bm = bmesh.new(); bm.from_mesh(coin.data)
    bmesh.ops.dissolve_degenerate(bm, dist=1e-5, edges=bm.edges)
    bm.to_mesh(coin.data); bm.free()
    # cavity shading baked as vertex colour: the engraving floor darkest, its walls a ramp up to the field, the field
    # a touch darker than the rim. Polished engravings only read when the recess is darker, as on a real struck coin.
    me = coin.data
    col = me.color_attributes.new('Cavity', 'FLOAT_COLOR', 'POINT')
    field = T / 2 - RECESS
    for v in me.vertices:
        z, rad = abs(v.co.z), math.hypot(v.co.x, v.co.y)
        if raised:
            if rad > FACE_R + 0.01: k = 1.0  # rim and edge
            elif z > field + 0.004: k = 1.0  # the raised symbol: the brightest, polished
            else: k = 0.72  # the field round it, a touch darker so the relief reads
            col.data[v.index].color = (k, k, k, 1); continue
        if rad > FACE_R + 0.01 or z > field + 0.002: k = 1.0  # rim, edge and the rim's top
        elif z > field - 0.002: k = 0.9  # the field
        else: k = 0.42 + 0.48 * max(0.0, (z - (field - ENGRAVE)) / ENGRAVE) ** 1.5  # down into the engraving
        col.data[v.index].color = (k, k, k, 1)
    me.color_attributes.active_color = col
    made.append((coin.name, len(coin.data.polygons), n))
    coin.location = ((len(made) % 7) * 2.4, 0, (len(made) // 7) * 2.4)  # spread out for a look in Blender; the browser re-centres

bpy.ops.object.select_all(action='DESELECT')
for o in bpy.data.objects:
    if o.name.startswith('coin_'): o.select_set(True)
os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=OUT, use_selection=True, export_format='GLB', export_apply=True, export_normals=True, export_materials='NONE', export_vertex_color='ACTIVE',
    export_draco_mesh_compression_enable=os.environ.get('DRACO', '1') == '1', export_draco_mesh_compression_level=10, export_draco_position_quantization=14, export_draco_normal_quantization=10)
bpy.ops.wm.save_as_mainfile(filepath=BLEND)  # open this in Blender to look around the models
# a preview: every coin, engraved and raised, tilted, lit in Workbench (shape check only)
scn = bpy.context.scene; scn.render.engine = 'BLENDER_WORKBENCH'; scn.display.shading.light = 'MATCAP'
scn.display.shading.color_type = 'SINGLE'; scn.display.shading.single_color = (0.8, 0.8, 0.82)
scn.render.resolution_x, scn.render.resolution_y = 1800, 760
scn.display.shading.light = 'STUDIO'; scn.display.shading.show_cavity = True
# engraved coins on the top row, raised below
for o in bpy.data.objects:
    if o.name.startswith('coin_'): o.hide_render = False
for k, (code, _) in enumerate(COINS):
    for row, suffix in enumerate(('', '_raised')):
        o = bpy.data.objects['coin_' + code + suffix]; o.location = ((k - 3) * 2.2, 0, 1.15 - row * 2.3); o.rotation_euler = (math.radians(65), 0, 0)
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); scn.collection.objects.link(cam); scn.camera = cam
cam.location = (0, -16, 0); cam.rotation_euler = (math.radians(90), 0, 0); cam.data.lens = 50
scn.render.filepath = os.path.join(os.path.dirname(BLEND), 'preview.png'); bpy.ops.render.render(write_still=True)
for code, faces, gv in made: print('COIN', code, 'faces', faces, 'glyph verts', gv)
print('WROTE', os.path.abspath(OUT), os.path.getsize(OUT))
