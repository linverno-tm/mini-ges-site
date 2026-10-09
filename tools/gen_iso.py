"""Generate the isometric mini-GES scene as SVG (the "Qanday ishlaydi" model).

Usage:  python tools/gen_iso.py out.svg   then paste the <svg> into index.html,
replacing the existing <svg class="dia" ...> element.


World axes: x along the canal (flow direction), y toward the viewer, z up.
Flat geometry is drawn in plane groups whose matrix is the iso projection of that
plane, so rects/circles/paths written in world units land exactly in 3D.
"""
import json, math, sys

C, S = math.cos(math.radians(30)), 0.5
f = lambda v: f'{v:.2f}'.rstrip('0').rstrip('.')

def P(x, y, z=0):
    return (C * (x - y), S * (x + y) - z)

def pts(*ps):
    return ' '.join(f'{f(a)},{f(b)}' for a, b in (P(*p) for p in ps))

def xy(z=0, extra=''):
    return f'<g transform="matrix({f(C)} {f(S)} {f(-C)} {f(S)} 0 {f(-z)})"{extra}>'

def xz(y0, extra=''):
    return f'<g transform="matrix({f(C)} {f(S)} 0 -1 {f(-C * y0)} {f(S * y0)})"{extra}>'

def yz(x0, extra=''):
    return f'<g transform="matrix({f(-C)} {f(S)} 0 -1 {f(C * x0)} {f(S * x0)})"{extra}>'

def rect(x, y, w, h, fill, extra=''):
    return f'<rect x="{f(x)}" y="{f(y)}" width="{f(w)}" height="{f(h)}" fill="{fill}"{extra}/>'

def box(x0, x1, y0, y1, z0, z1, top, fy, fx, extra=''):
    """axis-aligned box: visible faces are top, +y and +x"""
    return (f'<g{extra}>'
            + xz(y1) + rect(x0, z0, x1 - x0, z1 - z0, fy) + '</g>'
            + yz(x1) + rect(y0, z0, y1 - y0, z1 - z0, fx) + '</g>'
            + xy(z1) + rect(x0, y0, x1 - x0, y1 - y0, top) + '</g>'
            + '</g>')

def hull(points):
    pts_ = sorted(set(points))
    if len(pts_) < 3:
        return pts_
    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lo, up = [], []
    for p in pts_:
        while len(lo) >= 2 and cross(lo[-2], lo[-1], p) <= 0: lo.pop()
        lo.append(p)
    for p in reversed(pts_):
        while len(up) >= 2 and cross(up[-2], up[-1], p) <= 0: up.pop()
        up.append(p)
    return lo[:-1] + up[:-1]

def ring(x, yc, zc, r, n=48):
    return [P(x, yc + r * math.cos(t), zc + r * math.sin(t)) for t in (2 * math.pi * i / n for i in range(n))]

def tube(x0, r0, x1, r1, yc, zc, fill, extra=''):
    h = hull([(round(a, 2), round(b, 2)) for a, b in ring(x0, yc, zc, r0) + ring(x1, yc, zc, r1)])
    return f'<polygon points="{" ".join(f"{f(a)},{f(b)}" for a, b in h)}" fill="{fill}"{extra}/>'

def tree(x, y, h):
    bx, by = P(x, y, 0); tx, ty = P(x, y, h * 0.32); cx, cy = P(x, y, h * 0.66)
    return (xy(0) + f'<ellipse cx="{f(x + h * .32)}" cy="{f(y + 2)}" rx="{f(h * .34)}" ry="4.5" fill="#1B2410" opacity=".3"/></g>'
            f'<line x1="{f(bx)}" y1="{f(by)}" x2="{f(tx)}" y2="{f(ty)}" stroke="#3B2A1A" stroke-width="1.6"/>'
            f'<ellipse cx="{f(cx)}" cy="{f(cy)}" rx="{f(h * 0.15)}" ry="{f(h * 0.4)}" fill="url(#gTree)"/>'
            f'<ellipse cx="{f(cx - h * .05)}" cy="{f(cy - h * .08)}" rx="{f(h * 0.06)}" ry="{f(h * 0.26)}" fill="#8DB45C" opacity=".35"/>')

def house(x0, y0, w, d, h):
    x1, y1, ym, hr = x0 + w, y0 + d, y0 + d / 2, h + 7
    out = ['<g class="house3d">']
    out.append(xy(0) + f'<polygon points="{poly_xy(hull([(x0, y0), (x1, y0), (x1, y1), (x0, y1), (x0 + 9, y0 + 2), (x1 + 9, y0 + 2), (x1 + 9, y1 + 2), (x0 + 9, y1 + 2)]))}" fill="#1B2410" opacity=".2"/></g>')
    out.append(f'<polygon points="{pts((x0, y0, h), (x1, y0, h), (x1, ym, hr), (x0, ym, hr))}" fill="#7E4334"/>')
    out.append(xz(y1) + rect(x0, 0, w, h, '#E4DCCB') + ''.join(
        rect(x0 + 3 + i * 7, 4, 4, 5, '#5B6670', ' class="win"') for i in range(int((w - 3) // 7))) + '</g>')
    out.append(yz(x1) + rect(y0, 0, d, h, '#C9BFAB') + rect(y0 + d / 2 - 2, 4, 4, 5, '#5B6670', ' class="win"') + '</g>')
    out.append(f'<polygon points="{pts((x1, y0, h), (x1, y1, h), (x1, ym, hr))}" fill="#C9BFAB"/>')
    out.append(f'<polygon points="{pts((x0, ym, hr), (x1, ym, hr), (x1, y1, h), (x0, y1, h))}" fill="#A35A45" stroke="#7A3F31" stroke-width=".6"/>')
    out.append('</g>')
    return ''.join(out)

def pylon(bx, by, h=62):
    s, out = 5, []
    top = [P(bx + dx, by + dy, h) for dx, dy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    base = [P(bx + dx * s, by + dy * s, 0) for dx, dy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    d = ''.join(f'M{f(a[0])} {f(a[1])}L{f(b[0])} {f(b[1])}' for a, b in zip(base, top))
    for zz in (18, 36, 52):
        k = 1 - zz / h * 0.8
        q = [P(bx + dx * s * k, by + dy * s * k, zz) for dx, dy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
        d += 'M' + 'L'.join(f'{f(a)} {f(b)}' for a, b in q) + 'Z'
    a1, a2 = P(bx, by - 12, h - 4), P(bx, by + 12, h - 4)
    d += f'M{f(a1[0])} {f(a1[1])}L{f(a2[0])} {f(a2[1])}'
    return f'<path d="{d}" fill="none" stroke="#6E767C" stroke-width="1.2"/>', (a1, a2)

def hermite(p0, t0, p1, t1, n=28):
    """cubic Hermite segment p0 -> p1 with end tangents t0, t1 (world xy)"""
    out = []
    for i in range(n + 1):
        u = i / n
        h00, h10, h01, h11 = 2*u**3 - 3*u**2 + 1, u**3 - 2*u**2 + u, -2*u**3 + 3*u**2, u**3 - u**2
        out.append((h00*p0[0] + h10*t0[0] + h01*p1[0] + h11*t1[0], h00*p0[1] + h10*t0[1] + h01*p1[1] + h11*t1[1]))
    return out

def unit_vec(x, y):
    L = math.hypot(x, y) or 1
    return x / L, y / L

def normals(line):
    """left normal (-dy, dx) at every point of a polyline"""
    out = []
    for i in range(len(line)):
        a, b = line[max(0, i - 1)], line[min(len(line) - 1, i + 1)]
        dx, dy = unit_vec(b[0] - a[0], b[1] - a[1])
        out.append((-dy, dx))
    return out

def offset(line, d):
    """polyline shifted sideways; d is a number or a list (per point); + = left of the direction"""
    ns = normals(line)
    ds = d if isinstance(d, list) else [d] * len(line)
    return [(x + nx * k, y + ny * k) for (x, y), (nx, ny), k in zip(line, ns, ds)]

def poly_xy(points):
    return ' '.join(f'{f(x)},{f(y)}' for x, y in points)

def path_xy(points):
    return 'M' + 'L'.join(f'{f(x)} {f(y)}' for x, y in points)

def ribbon(edge, z0, z1, fill, extra=''):
    """vertical face standing on a polyline (screen polygon)"""
    if len(edge) < 2:
        return ''
    top = [P(x, y, z1) for x, y in edge]
    bot = [P(x, y, z0) for x, y in reversed(edge)]
    return f'<polygon points="{" ".join(f"{f(a)},{f(b)}" for a, b in top + bot)}" fill="{fill}"{extra}/>'

def visible_runs(line, side):
    """split a polyline edge into runs whose face toward the channel (side=+1 left edge) can be seen.
    The viewer looks from +x+y: a face is visible when its normal has nx + ny > 0."""
    ns = normals(line)
    runs, cur = [], []
    for pt, (nx, ny) in zip(line, ns):
        inward = (-nx * side, -ny * side)
        if inward[0] + inward[1] > 0:
            cur.append(pt)
        elif cur:
            runs.append(cur); cur = []
    if cur:
        runs.append(cur)
    return runs

def band(center, half, coping=4, wall=None, top=None, face=None, y_min=31):
    """open channel along a curve: returns (bed+walls svg, coping svg, water polygon in world xy)
    Parts inside the main canal (y < y_min) are trimmed: the mouth merges with the canal water."""
    wall, top, face = wall or CONC[1], top or CONC[0], face or CONC[2]
    hs = half if isinstance(half, list) else [half] * len(center)
    L, R = offset(center, hs), offset(center, [-h for h in hs])
    Lo, Ro = offset(center, [h + coping for h in hs]), offset(center, [-h - coping for h in hs])
    keep = lambda pts_, lim=y_min: [q for q in pts_ if q[1] >= lim]
    water = L + list(reversed(R))
    # bed: only the part a viewer can see in an empty trench, from the far wall's foot (z -12)
    # up to the near coping (z 2), which hides the rest; otherwise it shows as a dark seam
    ns = normals(center)
    lback = [nx + ny < 0 for nx, ny in ns]
    idx = [i for i, q in enumerate(center) if q[1] >= y_min + 14]   # starts inside the bank: water hides the cut
    bed = [P(*L[i], -12 if lback[i] else 2) for i in idx] + [P(*R[i], 2 if lback[i] else -12) for i in reversed(idx)]
    under = f'<polygon points="{" ".join(f"{f(a)},{f(b)}" for a, b in bed)}" fill="{CONC_BED}"/>'
    for edge, side in ((L, 1), (R, -1)):
        for run in visible_runs(keep(edge, 44), side):      # inside the bank the cut face belongs to the bank
            under += ribbon(run, -12, 2, wall)
    cop = ''
    for e, eo, side in ((L, Lo, 1), (R, Ro, -1)):
        e2 = [a for a, b in zip(e, eo) if b[1] >= 46]
        eo2 = [b for b in eo if b[1] >= 46]
        if len(e2) > 1:
            cop += xy(2) + f'<polygon points="{poly_xy(e2 + list(reversed(eo2)))}" fill="{top}"/></g>'
        for run in visible_runs(eo2, -side):            # outer face of the coping, seen from outside
            cop += ribbon(run, 0, 2, face)
    return under, cop, water

def obox(c, d, L, Wd, z0, z1, top, side_a, side_b, extra=''):
    """box turned so its length runs along direction d (unit xy) and its width across it"""
    ux, uy = d
    vx, vy = -uy, ux
    corners = [(c[0] + ux * a + vx * b, c[1] + uy * a + vy * b) for a, b in
               ((-L / 2, -Wd / 2), (L / 2, -Wd / 2), (L / 2, Wd / 2), (-L / 2, Wd / 2))]
    out = [f'<g{extra}>']
    for i in range(4):
        a, b = corners[i], corners[(i + 1) % 4]
        nx, ny = (a[0] + b[0]) / 2 - c[0], (a[1] + b[1]) / 2 - c[1]      # outward: centre -> edge midpoint
        if nx + ny > 0:                                                    # faces the viewer (+x+y)
            fill = side_a if abs(ny) >= abs(nx) else side_b                # same colour roles as box(): +y face, +x face
            out.append(f'<polygon points="{pts((a[0], a[1], z0), (b[0], b[1], z0), (b[0], b[1], z1), (a[0], a[1], z1))}" fill="{fill}"/>')
    out.append(f'<polygon points="{pts(*[(x, y, z1) for x, y in corners])}" fill="{top}"/>')
    out.append('</g>')
    return ''.join(out)

def sag(a, b, k=10):
    mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + k
    return f'M{f(a[0])} {f(a[1])}Q{f(mx)} {f(my)} {f(b[0])} {f(b[1])}'

# ---------------------------------------------------------------- daylight palette
CONC = ('#C7C4BA', '#A9A69D', '#8F8C84')        # concrete: top, +y face, +x face (sun from the left)
CONC_BED = '#55554E'                             # wet channel bed
PLASTER = ('#D8D0BE', '#C9C0AC', '#B4AB97')      # powerhouse walls
STEEL = ('#9AA6AF', '#7F8B94', '#66717A')
SAFETY = ('#E3B23E', '#C6952C', '#A97E23')       # hoist and crane paint
MACHINE = ('#6E8A78', '#5A7464', '#4A6153')      # generator housing
NOISE = 'data:image/png;base64,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'

def shadow(x0, x1, y0, y1, h, k=.55):
    """soft ground shadow of a box, cast toward +x (sun on the left, high)"""
    dx, dy = h * k, h * k * .25
    poly = hull([(x0, y0), (x1, y0), (x1, y1), (x0, y1), (x0 + dx, y0 + dy), (x1 + dx, y0 + dy), (x1 + dx, y1 + dy), (x0 + dx, y1 + dy)])
    return xy(0) + f'<polygon points="{poly_xy(poly)}" fill="#1B2410" opacity=".22"/></g>'

o = []
W = o.append

# ---------------------------------------------------------------- defs
W(f'''<defs>
  <linearGradient id="gW" gradientUnits="userSpaceOnUse" x1="-260" y1="0" x2="1300" y2="90"><stop offset="0" stop-color="#5F9EA4"/><stop offset=".5" stop-color="#4C8D96"/><stop offset="1" stop-color="#3D7B86"/></linearGradient>
  <linearGradient id="gWdeep" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4A8790"/><stop offset="1" stop-color="#2C5F6A"/></linearGradient>
  <linearGradient id="gGlint" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
  <linearGradient id="gTube" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C9D3DA"/><stop offset=".45" stop-color="#7E8E9A"/><stop offset="1" stop-color="#46535D"/></linearGradient>
  <linearGradient id="gCone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#B9C4CC"/><stop offset="1" stop-color="#56646F"/></linearGradient>
  <linearGradient id="gTree" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6F9A45"/><stop offset=".55" stop-color="#4A7230"/><stop offset="1" stop-color="#2D4A1F"/></linearGradient>
  <radialGradient id="gGround" cx=".42" cy=".44" r=".5"><stop offset="0" stop-color="#8A8E5E"/><stop offset=".7" stop-color="#737A4C"/><stop offset="1" stop-color="#5C643D"/></radialGradient>
  <radialGradient id="gGlow"><stop offset="0" stop-color="#4AF745" stop-opacity=".7"/><stop offset="1" stop-color="#4AF745" stop-opacity="0"/></radialGradient>
  <radialGradient id="gLamp"><stop offset="0" stop-color="#FFD66B" stop-opacity=".55"/><stop offset="1" stop-color="#FFD66B" stop-opacity="0"/></radialGradient>
  <pattern id="pRows" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#6F7E3C"/><path d="M0 4h8" stroke="#4B6327" stroke-width="2.6" stroke-opacity=".8"/><path d="M0 1.6h8" stroke="#8E9C57" stroke-width=".8" stroke-opacity=".6"/></pattern>
  <pattern id="pRows2" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#B09E5E"/><path d="M4 0v8" stroke="#8F7E43" stroke-width="2.2" stroke-opacity=".7"/></pattern>
  <pattern id="pGridW" width="96" height="96" patternUnits="userSpaceOnUse"><image href="{NOISE}" width="96" height="96"/></pattern>
  <filter id="fArc" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <clipPath id="dvClip" clipPathUnits="userSpaceOnUse"><rect id="dvClipRect" x="1080" y="0" width="0" height="260"/></clipPath>
  <clipPath id="landClip" clipPathUnits="userSpaceOnUse"><rect x="-300" y="27" width="1700" height="600"/></clipPath>
</defs>''')

# ---------------------------------------------------------------- ground, fields, grid
W(xy(0) + rect(-900, -800, 2900, 2000, 'url(#gGround)') + rect(-900, -800, 2900, 2000, 'url(#pGridW)') + '</g>')   # ground reaches past every camera edge
# Scene body, v2: the canal flows toward -x (up-left on screen), so every part of the
# derivation scheme is laid out mirrored along the canal: m(x) = 1092 - x.
# Intake (upstream) on the right, 400 m channel running left, powerhouse, tailrace, grid, village.
M = lambda x: 1092 - x
DY = 50                 # powerhouse, tailrace, grid and village sit this much further from the canal than in v2
FY = 110                # near-side fields move back so the arched channel has open ground around it

fields = [(-120, 130, 230, 150, 'pRows'), (150, 140, 200, 140, 'pRows2'), (380, 140, 230, 150, 'pRows'),
          (-140, -130, 330, 90, 'pRows2'), (240, -130, 330, 95, 'pRows'), (620, -130, 360, 100, 'pRows2'),
          (640, 200, 150, 110, 'pRows'), (-130, 300, 260, 110, 'pRows2'), (180, 300, 300, 100, 'pRows')]
fields = [(M(x + w), y + (FY if y > 0 else 0), w, h, p) for x, y, w, h, p in fields]
W(xy(0) + ''.join(rect(x, y, w, h, f'url(#{p})', ' rx="3" stroke="#5E5435" stroke-opacity=".45" stroke-width="1.2"') for x, y, w, h, p in fields) + '</g>')
W(xy(0) + rect(-260, -34, 1560, 12, '#A08C67') + rect(-260, -34, 1560, 12, 'url(#pGridW)') + '</g>')   # dirt road, far side
for x in range(-180, 1240, 34):                                             # far poplar row
    W(tree(x, -42, 46 + (x * 7 % 13)))

# ---------------------------------------------------------------- main canal (flows toward -x)
X0, X1 = -260, 1300
W(xy(0) + rect(X0, -12, X1 - X0, 16, CONC[0]) + '</g>')
W(f'<polygon points="{pts((X0, 4, 0), (X1, 4, 0), (X1, 11, -11), (X0, 11, -11))}" fill="{CONC[1]}"/>')
W(xy(-3) + f'<rect x="{X0}" y="6" width="{X1 - X0}" height="25" fill="url(#gW)"/>'
  + f'<rect class="glint" x="{X0}" y="9" width="220" height="16" fill="url(#gGlint)" opacity=".35"/>'
  + ''.join(f'<path class="flow flow--canal" d="M{X1} {yy}H{X0}" style="animation-delay:-{d}s"/>' for yy, d in ((11, 0), (17, .7), (23, .3), (28, 1.1)))
  + '</g>')
# water routes (drawn further down) are laid out first: the near bank gets real openings where they cross it
K0, K1, K2 = (1060, 16), (700, 178), (422, 81 + DY)
t0 = unit_vec(-1, .38)
route = hermite(K0, (t0[0] * 420, t0[1] * 420), K1, (-380, 0), 30)[:-1] + hermite(K1, (-380, 0), K2, (-300, 0), 26)
gi = next(i for i, q in enumerate(route) if q[1] >= 66)      # the gate stands just past the canal bank
# flared mouth: 22 wide at the gate, opening to ~42 where it meets the canal
rh = [11 + 10 * ((gi - i) / gi) ** 1.4 if i < gi else 11 for i in range(len(route))]
tail = hermite((270, 81 + DY), (-200, 0), (40, 14), (-230, -95), 30)        # mirror of the intake: leaves level, joins the canal at a shallow angle
th = [31 - 17 * (i / (len(tail) - 1)) ** .8 for i in range(len(tail))]       # 62 wide at the outlet, 28 at the canal
th = [h + 8 * max(0, (i - len(tail) * .8) / (len(tail) * .2)) for i, h in enumerate(th)]   # and a slight flare into the canal

def cross_x(edge, yv):
    """x where a polyline first crosses the line y = yv (its ends are extended straight, in case they stop short)"""
    def ext(p, q, k=80):
        dx, dy = unit_vec(p[0] - q[0], p[1] - q[1])
        return (p[0] + dx * k, p[1] + dy * k)
    edge = [ext(edge[0], edge[1])] + list(edge) + [ext(edge[-1], edge[-2])]
    for (xa, ya), (xb, yb) in zip(edge, edge[1:]):
        if (ya - yv) * (yb - yv) <= 0 and ya != yb:
            return xa + (xb - xa) * (yv - ya) / (yb - ya)
    return None

def opening(center, half):
    """the bank's cut for a channel: x on the bank's water line (y 32) and outer line (y 46) for both channel edges"""
    L, R = offset(center, half), offset(center, [-h for h in half])
    xs = {k: (cross_x(e, 32), cross_x(e, 46)) for k, e in (('L', L), ('R', R))}
    lo_edge = min(xs, key=lambda k: min(xs[k]))
    hi_edge = 'R' if lo_edge == 'L' else 'L'
    return xs[lo_edge], xs[hi_edge]      # ((x@32, x@46) on the downstream edge, same on the upstream edge)

cuts = sorted([opening(tail, th), opening(route, rh)], key=lambda c: c[0][0])
segs, start = [], ((X0, X0))
for lo, hi in cuts:
    segs.append((start, lo)); start = hi
segs.append((start, (X1, X1)))
for (a32, a46), (b32, b46) in segs:       # bank pieces with slanted ends that follow the channel walls
    W(xy(0) + f'<polygon points="{f(a32)},32 {f(b32)},32 {f(b46)},46 {f(a46)},46" fill="{CONC[0]}"/></g>')
    W(xz(46) + rect(a46, -3, b46 - a46, 3, CONC[2]) + '</g>')
lp = P(560, 20, 0)
W(f'<text class="canal-lbl" x="{f(lp[0])}" y="{f(lp[1])}" transform="rotate(30 {f(lp[0])} {f(lp[1])})">←  ASOSIY SUG\'ORISH KANALI</text>')

# fish jumping upstream (+x) now and then: hidden while they wait, a short leap with a splash in and out.
# Unequal periods (13/17/19/23/29 s) so the leaps never fall into a noticeable rhythm.
FISH = [(170, 19, 13, 4), (440, 25, 19, 11), (800, 14, 23, 2), (985, 17, 17, 7), (1170, 22, 29, 17)]   # x, y, period s, phase s
fish_svg = ('<g transform="scale(1.6)"><ellipse rx="4.6" ry="1.55" fill="#E6EDEE"/><ellipse cx="-.2" cy=".6" rx="4" ry=".85" fill="#3E4F57"/>'
            '<polygon points="-4,0 -7.4,2 -6.5,0 -7.4,-2" fill="#56666D"/><path d="M-.5 1.35 l1.6 1.1 l.9 -1.15z" fill="#56666D"/>'
            '<circle cx="3.1" cy=".4" r=".42" fill="#12191D"/></g>')
for fx, fy, per, ph in FISH:
    kind = 'a' if per < 20 else 'b'
    st = f'animation-duration:{per}s;animation-delay:-{ph}s'
    W(xy(-3) + f'<ellipse class="splash splash--in-{kind}" cx="{fx}" cy="{fy}" rx="4.4" ry="4.4" style="{st}"/>'
      + f'<ellipse class="splash splash--out-{kind}" cx="{fx + 26}" cy="{fy}" rx="4.4" ry="4.4" style="{st}"/></g>')
    W(xz(fy) + f'<g transform="translate({fx} -3)"><g class="fish fish--{kind}" style="{st}">{fish_svg}</g></g></g>')

# ---------------------------------------------------------------- intake + 400 m channel: one smooth bow
# Water leaves the canal in its own direction (no right angle), arcs away from the canal and comes back
# level into the forebay. Hermite tangents keep the curve smooth at every joint.
G, Gd = route[gi], unit_vec(route[gi + 1][0] - route[gi - 1][0], route[gi + 1][1] - route[gi - 1][1])
under, coping, water = band(route, rh)
W(under)
FB = f'422,{70 + DY} 380,{54 + DY} 380,{108 + DY} 422,{92 + DY}'          # forebay widening at the powerhouse
W(f'<polygon points="{pts((422, 70 + DY, -12), (380, 54 + DY, -12), (380, 108 + DY, 2), (422, 92 + DY, 2))}" fill="{CONC_BED}"/>')   # forebay bed, visible part
W(f'<polygon points="{pts((380, 54 + DY, 2), (422, 70 + DY, 2), (422, 70 + DY, -12), (380, 54 + DY, -12))}" fill="{CONC[1]}"/>')
intake_line, deriv_line = route[:gi + 1], route[gi:]
ih = rh[:gi + 1]
inner = lambda line: [q for q in line if q[1] >= 31]
W(f'<g class="w-intake">' + xy(-4) + '<g clip-path="url(#landClip)">'
  + f'<polygon points="{poly_xy(offset(intake_line, ih) + list(reversed(offset(intake_line, [-h for h in ih]))))}" fill="url(#gW)"/>'
  + ''.join(f'<path class="flow flow--intake" d="{path_xy(inner(offset(intake_line, [h * k for h in ih])))}"/>' for k in (-.55, 0, .55))
  + '</g></g></g>')
W(f'<g class="w-deriv">' + xy(-4) + '<g clip-path="url(#dvClip)">'
  + f'<polygon points="{poly_xy(offset(deriv_line, 11) + list(reversed(offset(deriv_line, -11))))}" fill="url(#gW)"/>'
  + f'<polygon points="{FB}" fill="url(#gW)"/>'
  + ''.join(f'<path class="flow flow--deriv" d="{path_xy(offset(deriv_line, k) + [(380, 81 + DY - k)])}" style="animation-delay:-{d}s"/>'
            for k, d in ((-6, 0), (0, .5), (6, .25)))
  + '</g></g></g>')
W(coping)
W(xy(2) + f'<polygon points="380,{50 + DY} 422,{66 + DY} 422,{70 + DY} 380,{54 + DY}" fill="{CONC[0]}"/>'
  + f'<polygon points="422,{92 + DY} 380,{108 + DY} 380,{112 + DY} 422,{96 + DY}" fill="{CONC[0]}"/></g>')
W(f'<polygon points="{pts((422, 96 + DY, 2), (380, 112 + DY, 2), (380, 112 + DY, 0), (422, 96 + DY, 0))}" fill="{CONC[2]}"/>')

# gate across the flow: three piers, two lifting leaves, red hoist frame (all turned to the channel axis)
nx_, ny_ = -Gd[1], Gd[0]
at = lambda k: (G[0] + nx_ * k, G[1] + ny_ * k)
for k, z0 in ((-13.5, 2), (0, -4), (13.5, 2)):                              # side piers stand on the walls, the middle one in the water
    W(obox(at(k), Gd, 8, 4.5, z0, 9, *CONC))
W('<g class="gates">')
for k0, k1 in ((-11.2, -2.3), (2.3, 11.2)):
    a_, b_ = at(k0), at(k1)
    lines = ''.join(f'<path d="M{f(P(a_[0], a_[1], zz)[0])} {f(P(a_[0], a_[1], zz)[1])}L{f(P(b_[0], b_[1], zz)[0])} {f(P(b_[0], b_[1], zz)[1])}" stroke="{STEEL[2]}" stroke-width=".8"/>' for zz in (-1, 2, 5))
    W(f'<g class="gate"><polygon points="{pts((a_[0], a_[1], -4), (b_[0], b_[1], -4), (b_[0], b_[1], 6), (a_[0], a_[1], 6))}" fill="{STEEL[0]}"/>{lines}</g>')
W('</g>')
W('<g class="hoist">' + obox(at(-15.8), Gd, 4, 3.5, 9, 27, *SAFETY) + obox(at(15.8), Gd, 4, 3.5, 9, 27, *SAFETY)
  + obox(G, Gd, 4, 35, 27, 30, *SAFETY) + '</g>')

# 400 m: dashed dimension following the arch on its outer side
dim = [q for q in offset(deriv_line, -26)]
d1, d2 = P(*dim[0]), P(*dim[-1])
apex = max(range(len(dim)), key=lambda i: dim[i][1])
am = P(*dim[apex])
W(f'<g class="dim"><path d="M' + 'L'.join(f'{f(P(x, y)[0])} {f(P(x, y)[1])}' for x, y in dim) + '" fill="none" stroke="#46C6F7" stroke-width="1.2" stroke-dasharray="4 3"/>'
  + ''.join(f'<path d="{"M%s %sL%s %s" % (f(q[0]), f(q[1] - 6), f(q[0]), f(q[1] + 6))}" stroke="#46C6F7" stroke-width="1.2"/>' for q in (d1, d2))
  + f'<g transform="translate({f(am[0])} {f(am[1] + 4)})"><rect x="-30" y="-11" width="60" height="22" rx="6" fill="#0B1B33" stroke="#46C6F7" stroke-width="1.2"/><text x="0" y="4.5" text-anchor="middle">400 m</text></g></g>')
for x in range(452, 1192, 46):                                              # near poplar row, beyond the arch
    W(tree(x, 232 + (x * 3 % 7), 30 + (x * 5 % 9)))

# ---------------------------------------------------------------- tailrace: curves back into the canal (downstream)
t_under, t_coping, t_water = band(tail, th)
W(t_under)
W(f'<g class="w-tail">' + xy(-4) + '<g clip-path="url(#landClip)">'
  + f'<polygon points="{poly_xy(t_water)}" fill="url(#gW)"/>'
  + ''.join(f'<path class="flow flow--tail" d="{path_xy(offset(tail, [h * k for h in th]))}" style="animation-delay:-{i * .35}s"/>'
            for i, k in enumerate((-.6, -.3, 0, .3, .6)))
  + '</g></g></g>')
W(t_coping)
for i in range(5):
    a_ = P(266, 58 + DY + i * 12, -3)
    W(f'<circle class="drop" cx="{f(a_[0])}" cy="{f(a_[1])}" r="1.3" fill="#E6F8FF" style="animation-delay:-{i * .27}s"/>')
TMID = tail[len(tail) // 2]

# ---------------------------------------------------------------- powerhouse (cutaway); water enters at x=380, leaves at x=270
PX0, PX1, PY0, PY1, PZ0, PZ1 = 270, 380, 46 + DY, 116 + DY, -6, 34
W(shadow(PX0, PX1, PY0, PY1, 30))
W(xy(PZ0) + rect(PX0, PY0, PX1 - PX0, PY1 - PY0, '#86837A') + '</g>')
W(xy(PZ0 + .2) + f'<circle class="ph-glow" cx="325" cy="{81 + DY}" r="58" fill="url(#gGlow)"/></g>')
W(xz(PY0) + rect(PX0, PZ0, PX1 - PX0, PZ1 - PZ0, PLASTER[1]) + ''.join(
    rect(PX0 + 12 + i * 26, 14, 14, 12, '#5D6B74') + rect(PX0 + 12 + i * 26, 14, 14, 3, '#7F8E97') for i in range(4)) + '</g>')
W(yz(PX0) + rect(PY0, PZ0, PY1 - PY0, PZ1 - PZ0, PLASTER[2]) + rect(58 + DY, -4, 16, 18, '#3A3B37') + rect(88 + DY, -4, 16, 18, '#3A3B37') + '</g>')

def unit(yc, k):
    zc = 6
    s = [f'<g class="unit unit--{k}">']
    s.append(xy(PZ0 + .1) + f'<ellipse cx="326" cy="{yc + 3}" rx="44" ry="13" fill="#000" opacity=".25"/></g>')
    s.append(tube(280, 9, 292, 11, yc, zc, 'url(#gCone)'))                 # draft tube toward the outlet
    s.append(tube(292, 11, 358, 11, yc, zc, 'url(#gTube)'))
    for fx_ in (300, 324, 346):
        s.append(tube(fx_, 12, fx_ + 2.2, 12, yc, zc, STEEL[2]))
    s.append(yz(358) + f'<circle cx="{yc}" cy="{zc}" r="11" fill="#2F3A42"/>'   # intake face with the runner
             f'<circle cx="{yc}" cy="{zc}" r="11" fill="none" stroke="#B5C2CB" stroke-width="1.2"/>'
             f'<g class="runner" style="transform-origin:{yc}px {zc}px">'
             + ''.join(f'<path d="M{yc} {zc} q4 -3 8.5 -2 l0 1.8 q-4 1 -8.5 0.2z" fill="#DCE4EA" transform="rotate({a} {yc} {zc})"/>' for a in range(0, 360, 72))
             + f'<circle cx="{yc}" cy="{zc}" r="2.6" fill="#E8F7FF"/></g>'
             f'<circle class="spin-ring" cx="{yc}" cy="{zc}" r="8" fill="none" stroke="#BDEBFF" stroke-width="1" stroke-dasharray="3 5"/>'
             '</g>')
    s.append(f'<g class="gen">' + box(306, 332, yc - 8, yc + 8, 16, 28, *MACHINE)
             + xz(yc + 8) + f'<path class="gen-bolt" d="M322 25 l-5 -7 h4 l-2 -6 l7 8 h-4z" fill="#4AF745"/>'
             + rect(306, 16, 26, 12, 'none', ' stroke="#4AF745" stroke-width=".6" stroke-opacity=".55"') + '</g>'
             + yz(332) + rect(yc - 8, 16, 16, 12, 'none', ' stroke="#4AF745" stroke-width=".6" stroke-opacity=".55"') + '</g>'
             + '</g>')
    s.append('</g>')
    return ''.join(s)

W(unit(66 + DY, 'a'))
W(unit(96 + DY, 'b'))
W(f'<g class="crane">' + box(PX0 + 4, PX1 - 4, 48 + DY, 50 + DY, 31, 32.5, *SAFETY)
  + box(PX0 + 4, PX1 - 4, 112 + DY, 114 + DY, 31, 32.5, *SAFETY)
  + box(300, 306, 48 + DY, 114 + DY, 32, 34, *SAFETY)
  + box(300, 306, 62 + DY, 70 + DY, 26, 32, *SAFETY) + '</g>')
for cx_, cy_ in ((PX1, PY1), (PX1, PY0), (PX0, PY1)):
    W(box(cx_ - 3, cx_, cy_ - 3, cy_, PZ0, PZ1, *CONC))
W(xz(PY1) + rect(PX0, PZ0, PX1 - PX0, 8, PLASTER[1]) + '</g>')
W(yz(PX1) + rect(PY0, PZ0, PY1 - PY0, 8, PLASTER[2]) + rect(56 + DY, -6, 20, 6, '#3A3B37') + rect(86 + DY, -6, 20, 6, '#3A3B37') + '</g>')
W(f'<polygon points="{pts((PX0, PY0, PZ1), (PX1, PY0, PZ1), (PX1, PY1, PZ1), (PX0, PY1, PZ1))}" fill="#FFFFFF" fill-opacity=".04" stroke="#FFFFFF" stroke-opacity=".55" stroke-width="1" stroke-dasharray="5 4"/>')

# ---------------------------------------------------------------- transformer, pylons, village (downstream side)
W(shadow(232, 252, 128 + DY, 146 + DY, 16))
W('<g class="trafo">' + box(232, 252, 128 + DY, 146 + DY, 0, 16, *STEEL)
  + xz(146 + DY) + ''.join(f'<path d="M{235 + i * 3} 2v11" stroke="#4E585F" stroke-width="1.4"/>' for i in range(5)) + '</g>'
  + yz(252) + rect(128 + DY, 0, 18, 16, 'none', ' stroke="#4E585F" stroke-width="1"') + '</g>'
  + xy(.1) + f'<circle class="trafo-glow" cx="242" cy="{137 + DY}" r="30" fill="url(#gGlow)"/></g>' + '</g>')
c1, c2 = P(292, 116 + DY, 4), P(244, 128 + DY, 10)
W(f'<path d="M{f(c1[0])} {f(c1[1])}L{f(c2[0])} {f(c2[1])}" stroke="#4AF745" stroke-width="1.4" stroke-opacity=".6" class="cable"/>')
py1, arms1 = pylon(162, 196 + DY)
py2, arms2 = pylon(82, 244 + DY)
W(py1); W(py2)
tA = P(237, 137 + DY, 18)
vill = P(12, 292 + DY, 20)
wires = []
for k in (0, 1):
    a, b = arms1[k], arms2[k]
    wires.append(sag(tA, a, 6) + ' ' + sag(a, b, 12) + ' ' + sag(b, vill, 10))
W(''.join(f'<path class="wire" d="{w}"/>' for w in wires))
W(''.join(f'<path class="spark" d="{w}" style="animation-delay:-{i * .45}s"/>' for i, w in enumerate(wires)))
for (hx, hy, w_, d_, h_) in ((1040, 262, 26, 18, 13), (1074, 250, 22, 16, 12), (1062, 296, 28, 18, 14),
                             (1100, 284, 22, 16, 12), (1030, 310, 22, 16, 11), (1096, 322, 26, 18, 13)):
    W(house(M(hx + w_), hy + DY, w_, d_, h_))
W(xy(.1) + f'<circle class="village-glow" cx="17" cy="{292 + DY}" r="70" fill="url(#gLamp)"/></g>')
for x in range(980, 1180, 36):
    W(tree(M(x), 350 + DY, 34 + (x % 9)))
W(tree(M(1150), 258 + DY, 38)); W(tree(M(1012), 222 + DY, 36)); W(tree(M(890), 180 + DY, 40)); W(tree(M(1120), 230 + DY, 34))

# ---------------------------------------------------------------- electric arcs (step 4+)
import random
rnd = random.Random(7)

def bolt(a, b, n=7, amp=4.5):
    (x0, y0), (x1, y1) = a, b
    dx, dy = x1 - x0, y1 - y0
    L = (dx * dx + dy * dy) ** .5 or 1
    nx, ny = -dy / L, dx / L
    pts_ = [(x0, y0)]
    for i in range(1, n):
        t = i / n
        o = rnd.uniform(-amp, amp) * (1 - abs(.5 - t))
        pts_.append((x0 + dx * t + nx * o, y0 + dy * t + ny * o))
    pts_.append((x1, y1))
    d = 'M' + 'L'.join(f'{f(x)} {f(y)}' for x, y in pts_)
    k = rnd.randint(2, n - 2)
    bx, by = pts_[k]
    d += f'M{f(bx)} {f(by)}l{f(rnd.uniform(-9, 9))} {f(rnd.uniform(-9, -3))}l{f(rnd.uniform(-5, 5))} {f(rnd.uniform(-6, -2))}'
    return d

arcs, gen_arcs = [], []
for yc in (66 + DY, 96 + DY):
    top = P(319, yc, 28)
    for i in range(3):
        gen_arcs.append(bolt(top, (top[0] + rnd.uniform(-14, 14), top[1] - rnd.uniform(16, 26)), 6, 4))
    # small discharges crawling along the generator's top edges
    edges = [((306, yc - 8), (332, yc - 8)), ((332, yc - 8), (332, yc + 8)), ((306, yc + 8), (332, yc + 8))]
    for (ax_, ay_), (bx_, by_) in edges:
        t1, t2 = sorted((rnd.uniform(0, 1), rnd.uniform(0, 1)))
        a_ = P(ax_ + (bx_ - ax_) * t1, ay_ + (by_ - ay_) * t1, 28.4)
        b_ = P(ax_ + (bx_ - ax_) * t2, ay_ + (by_ - ay_) * t2, 28.4)
        gen_arcs.append(bolt(a_, b_, 5, 2.5))
t0 = P(242, 137 + DY, 16)
for i in range(2):
    arcs.append(bolt(t0, (t0[0] + rnd.uniform(-10, 10), t0[1] - rnd.uniform(14, 20)), 5, 3.5))
arcs.append(bolt(P(292, 116 + DY, 4), P(244, 128 + DY, 10), 8, 3))
W('<g class="arcs" filter="url(#fArc)">' + ''.join(
    f'<path class="arc" d="{d}" style="animation-delay:-{rnd.uniform(0, 2.4):.2f}s;animation-duration:{rnd.uniform(1.6, 2.8):.2f}s"/>'
    for d in arcs) + ''.join(
    f'<path class="arc arc--gen" d="{d}" style="animation-delay:-{rnd.uniform(0, 1.6):.2f}s;animation-duration:{rnd.uniform(1.1, 1.9):.2f}s"/>'
    for d in gen_arcs) + '</g>')

# energy links (turbine shaft -> generator) and a floating bolt above each generator
fx = []
for i, yc in enumerate((66 + DY, 96 + DY)):
    a_, b_ = P(319, yc, 17), P(319, yc, 16)
    s_ = P(352, yc, 12)
    fx.append(f'<path class="gen-link" d="M{f(s_[0])} {f(s_[1])}Q{f((s_[0] + a_[0]) / 2)} {f(a_[1] - 6)} {f(a_[0])} {f(a_[1])}"/>')
    zx, zy = P(319, yc, 46)
    fx.append(f'<g class="gen-zap" style="animation-delay:-{i * .8}s" transform="translate({f(zx)} {f(zy)})">'
              '<circle r="11" class="gen-zap__halo"/>'
              '<path d="M1.5 -9 L-5 1.5 H-0.5 L-2.5 9 L5 -2 H0.5 L3 -9Z"/></g>')
W('<g class="genfx" filter="url(#fArc)">' + ''.join(fx) + '</g>')

# ---------------------------------------------------------------- labels (scale-compensated by JS)
def label(cls, world, dx, dy, text, anchor='start'):
    ax, ay = P(*world)
    tx = dx + {'start': 6, 'end': -6}.get(anchor, 0)
    return (f'<g class="lbl {cls}" transform="translate({f(ax)} {f(ay)})"><g class="lbl__s">'
            f'<path d="M0 0L{dx} {dy}" stroke="#4AF745" stroke-width="1"/><circle r="3"/>'
            f'<text x="{tx}" y="{dy + (4 if anchor != "middle" else -6)}" text-anchor="{anchor}">{text}</text></g></g>')
W(label('lbl-1', (G[0], G[1], 30), -40, -34, 'SUV QABUL QILGICH · ZATVOR', 'end'))
W(label('lbl-2', (route[30][0], route[30][1] - 11, 2), 0, -58, 'DERIVATSIYA KANALI', 'middle'))   # above the arch, on the open ground
W(label('lbl-3', (358, 96 + DY, -2), -14, 50, '2 × GORIZONTAL TURBINA', 'end'))
W(label('lbl-4', (319, 96 + DY, 28), -30, -46, '2 × GENERATOR', 'end'))
W(label('lbl-4b', (242, 137 + DY, 16), 34, 22, 'TRANSFORMATOR'))
W(label('lbl-5', (TMID[0], TMID[1], -4), 30, -34, 'SUV KANALGA QAYTADI'))
W(label('lbl-5b', (17, 290 + DY, 22), 0, -56, 'TARMOQ · ISTE\'MOLCHI', 'middle'))

# ---------------------------------------------------------------- cameras
ASPECT = 1000 / 640
def cam(x0, x1, y0, y1, z0=-12, z1=40, m=.06, sx=0.0):
    cs = [P(x, y, z) for x in (x0, x1) for y in (y0, y1) for z in (z0, z1)]
    xs, ys = [c[0] for c in cs], [c[1] for c in cs]
    w, h = max(xs) - min(xs), max(ys) - min(ys)
    w, h = w * (1 + 2 * m), h * (1 + 2 * m)
    if w / h > ASPECT: h = w / ASPECT
    else: w = h * ASPECT
    cx, cy = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2
    return f'{f(cx - w / 2 - sx * w)} {f(cy - h / 2)} {f(w)} {f(h)}'
cams = {
    '0': cam(-48, 1132, 20, 330 + DY, 0, 30, .0),
    '1': cam(G[0] - 60, G[0] + 75, 8, G[1] + 30, -12, 40, .1, .04),
    '2': cam(372, 1060, 10, 205, -12, 20, .04, .14),   # shifted so the photo inset (bottom-left) leaves the arch visible
    '3': cam(252, 392, 40 + DY, 125 + DY, -6, 36, .16, .1),
    '4': cam(150, 402, 20, 165 + DY, -6, 36, .1, .1),
    '5': cam(-58, 392, 30, 340 + DY, 0, 50, .06, .08),
}

svg = (f'<svg class="dia" id="dia" viewBox="{cams["0"]}" data-cams=\'{json.dumps(cams)}\' role="img" '
       'aria-label="Mini-GES maketi: sug\'orish kanali, zatvorli suv qabul qilgich, 400 metrlik derivatsiya kanali, '
       'ikki gorizontal turbinali stansiya, qaytish o\'zani, transformator va qishloqqa boruvchi elektr tarmog\'i">'
       + ''.join(o) + '</svg>')
open(sys.argv[1], 'w', encoding='utf-8').write(svg)
print(len(svg) // 1024, 'KB', 'gate', [round(v) for v in G], cams)
