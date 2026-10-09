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
    return (xy(0) + f'<ellipse cx="{f(x + 5)}" cy="{f(y + 5)}" rx="7" ry="5" fill="#000" opacity=".28"/></g>'
            f'<line x1="{f(bx)}" y1="{f(by)}" x2="{f(tx)}" y2="{f(ty)}" stroke="#3B2A1A" stroke-width="1.6"/>'
            f'<ellipse cx="{f(cx)}" cy="{f(cy)}" rx="{f(h * 0.15)}" ry="{f(h * 0.4)}" fill="url(#gTree)"/>')

def house(x0, y0, w, d, h):
    x1, y1, ym, hr = x0 + w, y0 + d, y0 + d / 2, h + 7
    out = ['<g class="house3d">']
    out.append(f'<polygon points="{pts((x0, y0, h), (x1, y0, h), (x1, ym, hr), (x0, ym, hr))}" fill="#152E55"/>')
    out.append(xz(y1) + rect(x0, 0, w, h, '#2B4A78') + ''.join(
        rect(x0 + 3 + i * 7, 4, 4, 5, '#0F2747', ' class="win"') for i in range(int((w - 3) // 7))) + '</g>')
    out.append(yz(x1) + rect(y0, 0, d, h, '#22406B') + rect(y0 + d / 2 - 2, 4, 4, 5, '#0F2747', ' class="win"') + '</g>')
    out.append(f'<polygon points="{pts((x1, y0, h), (x1, y1, h), (x1, ym, hr))}" fill="#22406B"/>')
    out.append(f'<polygon points="{pts((x0, ym, hr), (x1, ym, hr), (x1, y1, h), (x0, y1, h))}" fill="#1D3B66" stroke="#2F5A8F" stroke-width=".6"/>')
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
    return f'<path d="{d}" fill="none" stroke="#8FA8CC" stroke-width="1.1"/>', (a1, a2)

def sag(a, b, k=10):
    mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + k
    return f'M{f(a[0])} {f(a[1])}Q{f(mx)} {f(my)} {f(b[0])} {f(b[1])}'

o = []
W = o.append

# ---------------------------------------------------------------- defs
W('''<defs>
  <linearGradient id="gW" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4FD0FA"/><stop offset=".55" stop-color="#1AA8E8"/><stop offset="1" stop-color="#0B7FC4"/></linearGradient>
  <linearGradient id="gWdeep" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1690D6"/><stop offset="1" stop-color="#0A5E9E"/></linearGradient>
  <linearGradient id="gGlint" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
  <linearGradient id="gTube" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5AA9FF"/><stop offset=".45" stop-color="#1E6FD9"/><stop offset="1" stop-color="#0B3F8F"/></linearGradient>
  <linearGradient id="gCone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7BBDFF"/><stop offset="1" stop-color="#1450A8"/></linearGradient>
  <linearGradient id="gTree" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3FA066"/><stop offset="1" stop-color="#14472C"/></linearGradient>
  <radialGradient id="gGround" cx=".55" cy=".45" r=".7"><stop offset="0" stop-color="#11305C"/><stop offset="1" stop-color="#081631"/></radialGradient>
  <radialGradient id="gGlow"><stop offset="0" stop-color="#4AF745" stop-opacity=".7"/><stop offset="1" stop-color="#4AF745" stop-opacity="0"/></radialGradient>
  <radialGradient id="gLamp"><stop offset="0" stop-color="#FFD66B" stop-opacity=".55"/><stop offset="1" stop-color="#FFD66B" stop-opacity="0"/></radialGradient>
  <pattern id="pRows" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#13304F"/><path d="M0 4h8" stroke="#2E7D4F" stroke-width="2.2" stroke-opacity=".55"/></pattern>
  <pattern id="pRows2" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#152F4A"/><path d="M4 0v8" stroke="#3A8A52" stroke-width="2" stroke-opacity=".45"/></pattern>
  <pattern id="pGridW" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M50 0H0v50" fill="none" stroke="#2A5590" stroke-opacity=".22" stroke-width=".8"/></pattern>
  <filter id="fArc" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <clipPath id="dvClip" clipPathUnits="userSpaceOnUse"><rect id="dvClipRect" x="950" y="40" width="0" height="80"/></clipPath>
</defs>''')

# ---------------------------------------------------------------- ground, fields, grid
W(xy(0) + rect(-260, -140, 1560, 600, 'url(#gGround)') + rect(-260, -140, 1560, 600, 'url(#pGridW)') + '</g>')
# Scene body, v2: the canal flows toward -x (up-left on screen), so every part of the
# derivation scheme is laid out mirrored along the canal: m(x) = 1092 - x.
# Intake (upstream) on the right, 400 m channel running left, powerhouse, tailrace, grid, village.
M = lambda x: 1092 - x

fields = [(-120, 130, 230, 150, 'pRows'), (150, 140, 200, 140, 'pRows2'), (380, 140, 230, 150, 'pRows'),
          (-140, -130, 330, 90, 'pRows2'), (240, -130, 330, 95, 'pRows'), (620, -130, 360, 100, 'pRows2'),
          (640, 200, 150, 110, 'pRows'), (-130, 300, 260, 110, 'pRows2'), (180, 300, 300, 100, 'pRows')]
fields = [(M(x + w), y, w, h, p) for x, y, w, h, p in fields]
W(xy(0) + ''.join(rect(x, y, w, h, f'url(#{p})', ' rx="3" stroke="#2E7D4F" stroke-opacity=".35" stroke-width="1"') for x, y, w, h, p in fields) + '</g>')
W(xy(0) + rect(-260, -34, 1560, 12, '#1A2F4E') + '</g>')                    # dirt road, far side
for x in range(-180, 1240, 34):                                             # far poplar row
    W(tree(x, -42, 46 + (x * 7 % 13)))

# ---------------------------------------------------------------- main canal (flows toward -x)
X0, X1 = -260, 1300
W(xy(0) + rect(X0, -12, X1 - X0, 16, '#3B5C8C') + '</g>')
W(f'<polygon points="{pts((X0, 4, 0), (X1, 4, 0), (X1, 11, -11), (X0, 11, -11))}" fill="#4F75AA"/>')
W(xy(-3) + f'<rect x="{X0}" y="6" width="{X1 - X0}" height="25" fill="url(#gW)"/>'
  + f'<rect class="glint" x="{X0}" y="9" width="220" height="16" fill="url(#gGlint)" opacity=".35"/>'
  + ''.join(f'<path class="flow flow--canal" d="M{X1} {yy}H{X0}" style="animation-delay:-{d}s"/>' for yy, d in ((11, 0), (17, .7), (23, .3), (28, 1.1)))
  + '</g>')
for a, b in ((X0, 127), (177, 920), (942, X1)):                             # near bank, gaps at tailrace + intake
    W(xy(0) + rect(a, 32, b - a, 14, '#35558A') + '</g>')
    W(xz(46) + rect(a, -3, b - a, 3, '#22406B') + '</g>')
lp = P(560, 20, 0)
W(f'<text class="canal-lbl" x="{f(lp[0])}" y="{f(lp[1])}" transform="rotate(30 {f(lp[0])} {f(lp[1])})">←  ASOSIY SUG\'ORISH KANALI</text>')

# ---------------------------------------------------------------- intake (upstream end) + gates
W(xy(-12) + rect(920, 32, 22, 38, '#0B1730') + '</g>')
W(yz(920) + rect(32, -12, 38, 14, '#2B4A78') + '</g>')                       # inner wall, +x face
W(f'<g class="w-intake">' + xy(-4) + rect(920, 30, 22, 42, 'url(#gW)') + ''.join(
    f'<path class="flow flow--intake" d="M{xx} 30V72"/>' for xx in (925, 931, 937)) + '</g></g>')
for px_ in (917, 928.5, 940):
    W(box(px_, px_ + 5, 47, 55, -12, 9, '#4B6FA3', '#2F5185', '#24467A'))
W('<g class="gates">')
for gx in (922, 933.5):
    W(f'<g class="gate">' + xz(51) + rect(gx, -12, 6.5, 15, '#7C93B5') + ''.join(
        f'<path d="M{gx} {zz}h6.5" stroke="#5C7397" stroke-width=".8"/>' for zz in (-8, -4, 0)) + '</g></g>')
W('</g>')
W('<g class="hoist">' + box(916, 919.5, 49, 53, 9, 27, '#F05A55', '#C62828', '#A61E1E')
  + box(941.5, 945, 49, 53, 9, 27, '#F05A55', '#C62828', '#A61E1E')
  + box(916, 945, 49, 53, 27, 30, '#F26A65', '#D32F2F', '#B71C1C') + '</g>')

# ---------------------------------------------------------------- derivation channel, 400 m, running toward -x
FB = '422,70 380,54 380,108 422,92'                                         # forebay widening at the powerhouse
W(xy(-12) + rect(422, 70, 520, 22, '#0B1730') + f'<polygon points="{FB}" fill="#0B1730"/>' + '</g>')
W(xz(70) + rect(422, -12, 498, 14, '#3A5F94') + '</g>')                      # far wall, inner (+y) face
W(f'<polygon points="{pts((380, 54, 2), (422, 70, 2), (422, 70, -12), (380, 54, -12))}" fill="#33568A"/>')
W(xy(2) + rect(422, 66, 498, 4, '#5A80B6') + '</g>')
W(f'<g class="w-deriv">' + xy(-4) + '<g clip-path="url(#dvClip)">'
  + rect(422, 70, 520, 22, 'url(#gW)') + f'<polygon points="{FB}" fill="url(#gW)"/>'
  + ''.join(f'<path class="flow flow--deriv" d="M942 {yy}H380" style="animation-delay:-{d}s"/>' for yy, d in ((75, 0), (81, .5), (87, .25)))
  + '</g></g></g>')
W(xy(2) + rect(422, 92, 520, 4, '#5A80B6') + '<polygon points="422,92 380,108 380,112 422,96" fill="#5A80B6"/>' + '</g>')
W(xz(96) + rect(422, 0, 520, 2, '#2B4A78') + '</g>')
d1, d2 = P(942, 104, 0), P(422, 104, 0)
W(f'<g class="dim"><path d="M{f(d1[0])} {f(d1[1])}L{f(d2[0])} {f(d2[1])}" stroke="#46C6F7" stroke-width="1.2" stroke-dasharray="4 3"/>'
  + ''.join(f'<path d="{"M%s %sL%s %s" % (f(a[0]), f(a[1] - 6), f(a[0]), f(a[1] + 6))}" stroke="#46C6F7" stroke-width="1.2"/>' for a in (d1, d2))
  + f'<g transform="translate({f((d1[0] + d2[0]) / 2)} {f((d1[1] + d2[1]) / 2)})"><rect x="-30" y="-11" width="60" height="22" rx="6" fill="#0B1B33" stroke="#46C6F7" stroke-width="1.2"/><text x="0" y="4.5" text-anchor="middle">400 m</text></g></g>')
for x in range(452, 1192, 46):                                              # near poplar row
    W(tree(x, 292, 30 + (x * 5 % 9)))

# ---------------------------------------------------------------- powerhouse (cutaway); water enters at x=380, leaves at x=270
PX0, PX1, PY0, PY1, PZ0, PZ1 = 270, 380, 46, 116, -6, 34
W(xy(PZ0) + rect(PX0, PY0, PX1 - PX0, PY1 - PY0, '#1A355E') + '</g>')
W(xy(PZ0 + .2) + '<circle class="ph-glow" cx="325" cy="81" r="58" fill="url(#gGlow)"/></g>')
W(xz(PY0) + rect(PX0, PZ0, PX1 - PX0, PZ1 - PZ0, '#29497A') + ''.join(
    rect(PX0 + 12 + i * 26, 14, 14, 12, '#16325C') for i in range(4)) + '</g>')
W(yz(PX0) + rect(PY0, PZ0, PY1 - PY0, PZ1 - PZ0, '#203F6D') + rect(58, -4, 16, 18, '#0B1730') + rect(88, -4, 16, 18, '#0B1730') + '</g>')

def unit(yc, k):
    zc = 6
    s = [f'<g class="unit unit--{k}">']
    s.append(xy(PZ0 + .1) + f'<ellipse cx="326" cy="{yc + 3}" rx="44" ry="13" fill="#000" opacity=".35"/></g>')
    s.append(tube(280, 9, 292, 11, yc, zc, 'url(#gCone)'))                 # draft tube toward the outlet
    s.append(tube(292, 11, 358, 11, yc, zc, 'url(#gTube)'))
    for fx_ in (300, 324, 346):
        s.append(tube(fx_, 12, fx_ + 2.2, 12, yc, zc, '#0E4AA6'))
    s.append(yz(358) + f'<circle cx="{yc}" cy="{zc}" r="11" fill="#08306E"/>'   # intake face with the runner
             f'<circle cx="{yc}" cy="{zc}" r="11" fill="none" stroke="#5AA9FF" stroke-width="1.2"/>'
             f'<g class="runner" style="transform-origin:{yc}px {zc}px">'
             + ''.join(f'<path d="M{yc} {zc} q4 -3 8.5 -2 l0 1.8 q-4 1 -8.5 0.2z" fill="#9FE3FF" transform="rotate({a} {yc} {zc})"/>' for a in range(0, 360, 72))
             + f'<circle cx="{yc}" cy="{zc}" r="2.6" fill="#E8F7FF"/></g>'
             f'<circle class="spin-ring" cx="{yc}" cy="{zc}" r="8" fill="none" stroke="#BDEBFF" stroke-width="1" stroke-dasharray="3 5"/>'
             '</g>')
    s.append(f'<g class="gen">' + box(306, 332, yc - 8, yc + 8, 16, 28, '#183A6A', '#0F2A52', '#0B2346')
             + xz(yc + 8) + f'<path class="gen-bolt" d="M322 25 l-5 -7 h4 l-2 -6 l7 8 h-4z" fill="#4AF745"/>'
             + rect(306, 16, 26, 12, 'none', ' stroke="#4AF745" stroke-width=".9"') + '</g>'
             + yz(332) + rect(yc - 8, 16, 16, 12, 'none', ' stroke="#4AF745" stroke-width=".9"') + '</g>'
             + '</g>')
    s.append('</g>')
    return ''.join(s)

W(unit(66, 'a'))
W(unit(96, 'b'))
W(f'<g class="crane">' + box(PX0 + 4, PX1 - 4, 48, 50, 31, 32.5, '#F05A55', '#C62828', '#A61E1E')
  + box(PX0 + 4, PX1 - 4, 112, 114, 31, 32.5, '#F05A55', '#C62828', '#A61E1E')
  + box(300, 306, 48, 114, 32, 34, '#FF7A70', '#D32F2F', '#B71C1C')
  + box(300, 306, 62, 70, 26, 32, '#FF7A70', '#D32F2F', '#B71C1C') + '</g>')
for cx_, cy_ in ((PX1, PY1), (PX1, PY0), (PX0, PY1)):
    W(box(cx_ - 3, cx_, cy_ - 3, cy_, PZ0, PZ1, '#5A80B6', '#3A5F94', '#2F5185'))
W(xz(PY1) + rect(PX0, PZ0, PX1 - PX0, 8, '#2B4A78') + '</g>')
W(yz(PX1) + rect(PY0, PZ0, PY1 - PY0, 8, '#22406B') + rect(56, -6, 20, 6, '#0B1730') + rect(86, -6, 20, 6, '#0B1730') + '</g>')
W(f'<polygon points="{pts((PX0, PY0, PZ1), (PX1, PY0, PZ1), (PX1, PY1, PZ1), (PX0, PY1, PZ1))}" fill="#46C6F7" fill-opacity=".05" stroke="#46C6F7" stroke-opacity=".45" stroke-width="1" stroke-dasharray="5 4"/>')

# ---------------------------------------------------------------- tailrace back to the canal (downstream)
TR = [(270, 50), (224, 50), (177, 44), (127, 44), (174, 112), (270, 112)]
W(xy(-12) + f'<polygon points="{" ".join(f"{a},{b}" for a, b in TR)}" fill="#0B1730"/></g>')
W(f'<g class="w-tail">' + xy(-4) + f'<polygon points="{" ".join(f"{a},{b}" for a, b in TR)}" fill="url(#gW)"/>'
  + rect(127, 30, 50, 16, 'url(#gW)')
  + ''.join(f'<path class="flow flow--tail" d="M266 {yy} L222 {yy} L{162 - i * 8} 34" style="animation-delay:-{i * .35}s"/>' for i, yy in enumerate((60, 72, 84, 96, 106)))
  + '</g></g>')
W(f'<polygon points="{pts((224, 50, 2), (177, 44, 2), (177, 44, -12), (224, 50, -12))}" fill="#33568A"/>')
W(xy(2) + '<polyline points="270,112 174,112 127,44" fill="none" stroke="#5A80B6" stroke-width="4"/></g>')
for i in range(5):
    a = P(266, 58 + i * 12, -3)
    W(f'<circle class="drop" cx="{f(a[0])}" cy="{f(a[1])}" r="1.3" fill="#E6F8FF" style="animation-delay:-{i * .27}s"/>')

# ---------------------------------------------------------------- transformer, pylons, village (downstream side)
W('<g class="trafo">' + box(232, 252, 128, 146, 0, 16, '#183A6A', '#0F2A52', '#0B2346')
  + xz(146) + ''.join(f'<path d="M{235 + i * 3} 2v11" stroke="#4AF745" stroke-opacity=".7" stroke-width=".9"/>' for i in range(5)) + '</g>'
  + yz(252) + rect(128, 0, 18, 16, 'none', ' stroke="#4AF745" stroke-width="1"') + '</g>'
  + xy(.1) + '<circle class="trafo-glow" cx="242" cy="137" r="30" fill="url(#gGlow)"/></g>' + '</g>')
c1, c2 = P(292, 116, 4), P(244, 128, 10)
W(f'<path d="M{f(c1[0])} {f(c1[1])}L{f(c2[0])} {f(c2[1])}" stroke="#4AF745" stroke-width="1.4" stroke-opacity=".6" class="cable"/>')
py1, arms1 = pylon(162, 196)
py2, arms2 = pylon(82, 244)
W(py1); W(py2)
tA = P(237, 137, 18)
vill = P(12, 292, 20)
wires = []
for k in (0, 1):
    a, b = arms1[k], arms2[k]
    wires.append(sag(tA, a, 6) + ' ' + sag(a, b, 12) + ' ' + sag(b, vill, 10))
W(''.join(f'<path class="wire" d="{w}"/>' for w in wires))
W(''.join(f'<path class="spark" d="{w}" style="animation-delay:-{i * .45}s"/>' for i, w in enumerate(wires)))
for (hx, hy, w_, d_, h_) in ((1040, 262, 26, 18, 13), (1074, 250, 22, 16, 12), (1062, 296, 28, 18, 14),
                             (1100, 284, 22, 16, 12), (1030, 310, 22, 16, 11), (1096, 322, 26, 18, 13)):
    W(house(M(hx + w_), hy, w_, d_, h_))
W(xy(.1) + '<circle class="village-glow" cx="17" cy="292" r="70" fill="url(#gLamp)"/></g>')
for x in range(980, 1180, 36):
    W(tree(M(x), 350, 34 + (x % 9)))
W(tree(M(1150), 258, 38)); W(tree(M(1012), 222, 36)); W(tree(M(890), 160, 40)); W(tree(M(1120), 230, 34))

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

arcs = []
for yc in (66, 96):
    top = P(319, yc, 28)
    for i in range(3):
        arcs.append(bolt(top, (top[0] + rnd.uniform(-14, 14), top[1] - rnd.uniform(16, 26)), 6, 4))
t0 = P(242, 137, 16)
for i in range(2):
    arcs.append(bolt(t0, (t0[0] + rnd.uniform(-10, 10), t0[1] - rnd.uniform(14, 20)), 5, 3.5))
arcs.append(bolt(P(292, 116, 4), P(244, 128, 10), 8, 3))
W('<g class="arcs" filter="url(#fArc)">' + ''.join(
    f'<path class="arc" d="{d}" style="animation-delay:-{rnd.uniform(0, 2.4):.2f}s;animation-duration:{rnd.uniform(1.6, 2.8):.2f}s"/>'
    for d in arcs) + '</g>')

# ---------------------------------------------------------------- labels (scale-compensated by JS)
def label(cls, world, dx, dy, text, anchor='start'):
    ax, ay = P(*world)
    tx = dx + (6 if anchor == 'start' else -6)
    return (f'<g class="lbl {cls}" transform="translate({f(ax)} {f(ay)})"><g class="lbl__s">'
            f'<path d="M0 0L{dx} {dy}" stroke="#4AF745" stroke-width="1"/><circle r="3"/>'
            f'<text x="{tx}" y="{dy + 4}" text-anchor="{anchor}">{text}</text></g></g>')
W(label('lbl-1', (931, 51, 30), -40, -34, 'SUV QABUL QILGICH · ZATVOR', 'end'))
W(label('lbl-2', (662, 81, 2), 20, -46, 'DERIVATSIYA KANALI'))
W(label('lbl-3', (358, 66, 6), -24, -56, '2 × GORIZONTAL TURBINA', 'end'))
W(label('lbl-4', (319, 96, 28), -30, -46, '2 × GENERATOR', 'end'))
W(label('lbl-4b', (242, 137, 16), 34, 22, 'TRANSFORMATOR'))
W(label('lbl-5', (152, 70, -4), 30, -34, 'SUV KANALGA QAYTADI'))
W(label('lbl-5b', (17, 290, 22), 0, -56, 'TARMOQ · ISTE\'MOLCHI', 'middle'))

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
    '0': cam(-48, 1132, 20, 330, 0, 30, .0),
    '1': cam(842, 992, 10, 115, -12, 40, .14, .12),
    '2': cam(372, 952, 50, 120, -12, 20, .02),
    '3': cam(252, 392, 40, 125, -6, 36, .16, .1),
    '4': cam(202, 402, 30, 165, -6, 36, .12, .1),
    '5': cam(-58, 392, 30, 340, 0, 50, .06, .08),
}

svg = (f'<svg class="dia" id="dia" viewBox="{cams["0"]}" data-cams=\'{json.dumps(cams)}\' role="img" '
       'aria-label="Mini-GES maketi: sug\'orish kanali, zatvorli suv qabul qilgich, 400 metrlik derivatsiya kanali, '
       'ikki gorizontal turbinali stansiya, qaytish o\'zani, transformator va qishloqqa boruvchi elektr tarmog\'i">'
       + ''.join(o) + '</svg>')
open(sys.argv[1], 'w', encoding='utf-8').write(svg)
print(len(svg) // 1024, 'KB', cams)
