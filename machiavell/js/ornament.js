/* Furniture for Machiavell, drawn only from the system's own vocabulary: hairlines in `rule`, breathing strokes in
   `turquoise` (always interrupted), the checkerboard of the Concord's floor, concentric discs and the ✦.
   The side columns carry a dragon, arcane and nature motifs. Stroke only, no gradients. */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var PI = Math.PI;

  function el(tag, attrs, kids) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }
  function f(x) { return x.toFixed(1); }

  /* a spiral from outer radius r1 (at angle a0) in to radius r0 */
  function spiral(cx, cy, r1, r0, turns, dir, a0) {
    var N = Math.max(8, Math.round(turns * 20)), pts = [], i, t, a, r;
    for (i = 0; i <= N; i++) {
      t = i / N; a = a0 + dir * t * turns * 2 * PI; r = r1 + (r0 - r1) * t;
      pts.push(f(cx + r * Math.cos(a)) + ' ' + f(cy + r * Math.sin(a)));
    }
    return 'M' + pts.join('L');
  }
  function path(d, cls) { return el('path', { d: d, 'class': cls || 'o-rule', fill: 'none' }); }
  function line(x1, y1, x2, y2, cls) { return el('line', { x1: x1, y1: y1, x2: x2, y2: y2, 'class': cls || 'o-rule' }); }
  function circ(cx, cy, r, cls) { return el('circle', { cx: cx, cy: cy, r: r, 'class': cls || 'o-rule', fill: 'none' }); }
  function star(x, y, s, cls) {
    return path('M' + x + ' ' + (y - s) + ' Q' + x + ' ' + y + ' ' + (x + s) + ' ' + y + ' Q' + x + ' ' + y + ' ' + x + ' ' + (y + s) +
      ' Q' + x + ' ' + y + ' ' + (x - s) + ' ' + y + ' Q' + x + ' ' + y + ' ' + x + ' ' + (y - s) + 'Z', cls || 'o-star');
  }
  function diamond(x, y, s, cls) {
    return path('M' + x + ' ' + (y - s) + 'L' + (x + s) + ' ' + y + 'L' + x + ' ' + (y + s) + 'L' + (x - s) + ' ' + y + 'Z', cls || 'o-rule');
  }

  /* ---------- helpers for the side column ---------- */
  function rot(px, py, ang) { return [px * Math.cos(ang) - py * Math.sin(ang), px * Math.sin(ang) + py * Math.cos(ang)]; }
  function poly(pts, cls) { return path('M' + pts.map(function (p) { return f(p[0]) + ' ' + f(p[1]); }).join('L'), cls); }
  function at(cls, kids) { return el('g', { 'class': cls }, kids); }
  /* an arc of a circle from degree a0 to a1 (0 = up, clockwise) */
  function arc(cx, cy, r, a0, a1, cls) {
    var p0 = rot(0, -r, a0 * PI / 180), p1 = rot(0, -r, a1 * PI / 180), large = ((a1 - a0 + 360) % 360) > 180 ? 1 : 0;
    return path('M' + f(cx + p0[0]) + ' ' + f(cy + p0[1]) + ' A' + r + ' ' + r + ' 0 ' + large + ' 1 ' + f(cx + p1[0]) + ' ' + f(cy + p1[1]), cls);
  }

  /* NATURE ------------------------------------------------------------------------------- */
  /* a pointed leaf from (x,y) toward angle ang (radians, 0 = right), with a midrib and two veins */
  function leaf(x, y, ang, len, cls) {
    var w = len * 0.36, g = el('g', {});
    function P(px, py) { var r = rot(px, py, ang); return f(x + r[0]) + ' ' + f(y + r[1]); }
    g.appendChild(path('M' + P(0, 0) + ' Q' + P(len * 0.45, -w * 1.5) + ' ' + P(len, 0) + ' Q' + P(len * 0.45, w * 1.5) + ' ' + P(0, 0), cls || 'o-leaf'));
    g.appendChild(path('M' + P(0, 0) + ' L' + P(len * 0.88, 0), 'o-leaf thin'));
    g.appendChild(path('M' + P(len * 0.35, 0) + ' L' + P(len * 0.6, -w * 0.7) + ' M' + P(len * 0.35, 0) + ' L' + P(len * 0.6, w * 0.7), 'o-leaf thin'));
    return g;
  }
  function sprig(x, y, ang, len, n) {
    var g = el('g', {}), pts = [], i, t, a, b, side = 1;
    function P(px, py) { var r = rot(px, py, ang); return [x + r[0], y + r[1]]; }
    for (i = 0; i <= 20; i++) { t = i / 20; pts.push(P(len * t, -Math.sin(t * 2.2) * len * 0.14)); }
    g.appendChild(poly(pts, 'o-leaf'));
    for (i = 1; i <= n; i++) {
      t = i / (n + 1); a = pts[Math.round(t * 20)]; b = pts[Math.min(20, Math.round(t * 20) + 1)];
      var d = Math.atan2(b[1] - a[1], b[0] - a[0]);
      g.appendChild(leaf(a[0], a[1], d + side * 0.95, 11 - t * 3));
      side = -side;
    }
    var e = pts[20], e2 = pts[19];
    g.appendChild(leaf(e[0], e[1], Math.atan2(e[1] - e2[1], e[0] - e2[0]), 12));
    return g;
  }
  /* a bare branch for a small creature to sit on: a gently bowed stem, leaves hanging only below it */
  function branch(x, y, len) {
    var g = el('g', {}), pts = [], i, t;
    for (i = 0; i <= 20; i++) { t = i / 20; pts.push([x + len * t, y - Math.sin(t * PI) * len * 0.06]); }
    g.appendChild(poly(pts, 'o-leaf'));
    [0.12, 0.34, 0.8].forEach(function (u, k) {
      var q = pts[Math.round(u * 20)];
      g.appendChild(leaf(q[0], q[1], PI / 2 + (k % 2 ? 0.55 : -0.5), 12 - k));
    });
    return g;
  }
  /* an oak leaf: a stalk, then a blade whose edge swells into lobes */
  function oakLeaf(x, y, ang, len) {
    var g = el('g', {}), stalk = len * 0.18, top = [], bot = [], i, t, hw;
    function P(px, py) { var r = rot(px, py, ang); return [x + r[0], y + r[1]]; }
    for (i = 0; i <= 40; i++) {
      t = i / 40;
      hw = len * 0.27 * Math.pow(Math.sin(PI * Math.min(1, t * 1.02)), 0.75) * (1 + 0.38 * Math.cos(2 * PI * 3 * t - 0.4));
      top.push(P(stalk + (len - stalk) * t, -hw)); bot.push(P(stalk + (len - stalk) * t, hw));
    }
    g.appendChild(poly(top.concat(bot.reverse()), 'o-leaf'));
    g.appendChild(poly([P(0, 0), P(len, 0)], 'o-leaf thin'));
    [0.3, 0.5, 0.7].forEach(function (k) {
      var q = stalk + (len - stalk) * k;
      g.appendChild(poly([P(q, 0), P(q + len * 0.1, -len * 0.16)], 'o-leaf thin'));
      g.appendChild(poly([P(q, 0), P(q + len * 0.1, len * 0.16)], 'o-leaf thin'));
    });
    return g;
  }
  /* an acorn hanging from (x,y): a short stalk, a cross-hatched cap, a nut */
  function acorn(x, y, s, ang) {
    var g = el('g', { transform: 'translate(' + x + ' ' + y + ') rotate(' + (ang || 0) + ') scale(' + s + ')' });
    g.appendChild(path('M0 0 L0 3', 'o-leaf'));
    g.appendChild(path('M-4.6 8 C-4.6 3 4.6 3 4.6 8 Z', 'o-leaf'));
    g.appendChild(path('M-2.4 4.6 L1.2 8 M0.2 3.6 L3.4 7 M-3.6 6.2 L-1.6 8 M2.2 4.2 L4.4 6.2', 'o-leaf thin'));
    g.appendChild(path('M-4 8.6 C-4 15 -1 17 0 18 C1 17 4 15 4 8.6', 'o-leaf'));
    return g;
  }
  /* a fern frond: a curling stem with paired leaflets that shrink toward the curl */
  function frond(x, y, ang, len) {
    var g = el('g', {}), pts = [], i, t, k, a, b;
    function P(px, py) { var r = rot(px, py, ang); return [x + r[0], y + r[1]]; }
    for (i = 0; i <= 24; i++) { t = i / 24; pts.push(P(len * t, -Math.pow(t, 2.2) * len * 0.5)); }
    g.appendChild(poly(pts, 'o-leaf'));
    for (k = 2; k <= 22; k += 2) {
      t = k / 24; a = pts[k]; b = pts[k + 1];
      var dx = b[0] - a[0], dy = b[1] - a[1], l = Math.sqrt(dx * dx + dy * dy) || 1, sz = 7 * (1 - t * 0.8);
      g.appendChild(poly([a, [a[0] - dy / l * sz - dx / l * 2, a[1] + dx / l * sz - dy / l * 2]], 'o-leaf thin'));
      g.appendChild(poly([a, [a[0] + dy / l * sz - dx / l * 2, a[1] - dx / l * sz - dy / l * 2]], 'o-leaf thin'));
    }
    return g;
  }

  /* ARCANE ------------------------------------------------------------------------------- */
  /* Elder Futhark, each in a box 8 wide and 13 high; drawn as strokes so no font is needed */
  var RUNES = [
    'M1 0V13M1 4L7 0M1 8L7 4',            /* fehu */
    'M1 13V0L7 4V13',                      /* uruz */
    'M1 0V13M1 3L7 6.5L1 10',              /* thurisaz */
    'M1 0V13M1 2L7 5M1 6L7 9',             /* ansuz */
    'M1 0V13M1 1L7 4L1 7.5L7 13',          /* raido */
    'M7 2L2 6.5L7 11',                     /* kenaz */
    'M1 1L7 12M7 1L1 12',                  /* gebo */
    'M1 0V13M1 1L7 4L1 7',                 /* wunjo */
    'M1 0V13M7 0V13M1 4L7 9',              /* hagalaz */
    'M4 0V13M0.5 4L7.5 9',                 /* nauthiz */
    'M4 0V13',                             /* isa */
    'M1 1L4 4.5L1 8M7 5L4 8.5L7 12',       /* jera */
    'M4 0V13M4 0L1 3M4 13L7 10',           /* eihwaz */
    'M1 0V13M1 0L7 3L1 6.5M1 13L7 10L1 6.5', /* perthro */
    'M4 0V13M4 5L0.5 0M4 5L7.5 0',         /* algiz */
    'M6 0L2 4L6 9L2 13',                   /* sowilo */
    'M4 0V13M0.5 4L4 0L7.5 4',             /* tiwaz */
    'M1 0V13M1 0L6 3L1 6.5L6 10L1 13',     /* berkano */
    'M1 0V13M7 0V13M1 0L4 4L7 0',          /* ehwaz */
    'M1 1V12M7 1V12M1 1L7 12M7 1L1 12',    /* mannaz */
    'M3 13V0M3 0L7 4',                     /* laguz */
    'M4 0L8 4L4 8L0 4Z',                   /* ingwaz */
    'M1 1V12L7 1V12Z',                     /* dagaz */
    'M4 0L8 4L4 8L0 4Z M4 8L1 13M4 8L7 13' /* othala */
  ];
  function glyph(cx, cy, k, sc) {
    return el('path', { d: RUNES[k % RUNES.length], 'class': 'o-arcane thin', fill: 'none',
      transform: 'translate(' + f(cx) + ' ' + f(cy) + ') scale(' + (sc || 1) + ') translate(-4 -6.5)' });
  }
  function rune(cx, cy, k) { return glyph(cx, cy, k, 1); }
  /* a bindrune: two runes cut over one stem, read as a single mark */
  function bindrune(cx, cy, a, b, sc) {
    var g = el('g', {});
    g.appendChild(glyph(cx, cy, a, sc)); g.appendChild(glyph(cx, cy, b, sc));
    return g;
  }
  /* a vertical cartouche: two wires, bindrunes between them, a diamond at each end, dots down the outside */
  function runeColumn(x, y, n, seed) {
    var g = el('g', {}), i, step = 19, h = n * step + 8, k;
    g.appendChild(poly([[x - 10, y], [x - 10, y + h]], 'o-rule thin')); g.appendChild(poly([[x + 10, y], [x + 10, y + h]], 'o-rule thin'));
    g.appendChild(diamond(x, y - 1, 3.2, 'o-arcane thin')); g.appendChild(diamond(x, y + h + 1, 3.2, 'o-arcane thin'));
    for (i = 0; i < n; i++) {
      k = seed + i * 5;
      g.appendChild(i % 2 ? rune(x, y + 4 + step * (i + 0.5), k) : bindrune(x, y + 4 + step * (i + 0.5), k, k + 7));
      if (i < n - 1) {
        g.appendChild(el('circle', { cx: x - 10, cy: y + 4 + step * (i + 1), r: 1.1, 'class': 'o-arcane-fill' }));
        g.appendChild(el('circle', { cx: x + 10, cy: y + 4 + step * (i + 1), r: 1.1, 'class': 'o-arcane-fill' }));
      }
    }
    return g;
  }
  /* a crescent moon, tips up, centre (cx,cy), radius r */
  function moon(cx, cy, r) {
    return path('M' + cx + ' ' + (cy - r) + ' A' + r + ' ' + r + ' 0 1 0 ' + cx + ' ' + (cy + r) + ' A' + (r * 1.4) + ' ' + (r * 1.4) + ' 0 0 1 ' + cx + ' ' + (cy - r) + 'Z', 'o-arcane');
  }
  function constellation(pts, sizes) {
    var g = el('g', {});
    g.appendChild(poly(pts, 'o-arcane thin'));
    pts.forEach(function (q, i) { g.appendChild(star(q[0], q[1], sizes[i] || 4.5)); });
    return g;
  }
  /* a sigil: ring, inner ring that breathes (never closed), tick band, and a figure in the middle */
  function sigil(cx, cy, R, kind) {
    var g = el('g', {}), k, a, r1, r2, pts;
    g.appendChild(circ(cx, cy, R, 'o-arcane'));
    g.appendChild(circ(cx, cy, R - 4.5, 'o-arcane thin'));
    for (k = 0; k < 24; k++) {
      a = k * PI / 12; r1 = R - 4.5; r2 = R - (k % 2 ? 2.2 : 3.6);
      g.appendChild(line(f(cx + r1 * Math.sin(a)), f(cy - r1 * Math.cos(a)), f(cx + r2 * Math.sin(a)), f(cy - r2 * Math.cos(a)), 'o-arcane thin'));
    }
    g.appendChild(arc(cx, cy, R - 8.5, 20, 340, 'o-live'));
    function tri(off, rad) {
      pts = [0, 1, 2].map(function (i) { var q = off + i * 120; return [cx + rad * Math.sin(q * PI / 180), cy - rad * Math.cos(q * PI / 180)]; });
      return poly(pts.concat([pts[0]]), 'o-arcane thin');
    }
    if (kind === 'star') {
      for (k = 0; k < 8; k++) {
        a = k * PI / 4;
        g.appendChild(line(f(cx + 5 * Math.sin(a)), f(cy - 5 * Math.cos(a)), f(cx + (R - 10) * Math.sin(a)), f(cy - (R - 10) * Math.cos(a)), 'o-arcane thin'));
        g.appendChild(el('circle', { cx: f(cx + (R - 10) * Math.sin(a)), cy: f(cy - (R - 10) * Math.cos(a)), r: 1.3, 'class': 'o-arcane-fill' }));
      }
    } else {
      g.appendChild(tri(0, R - 8.5)); g.appendChild(tri(180, R - 8.5));
    }
    g.appendChild(el('circle', { cx: cx, cy: cy, r: 2, 'class': 'o-arcane-fill' }));
    return g;
  }

  /* DRAGON ------------------------------------------------------------------------------- */
  /* a wing from its shoulder (x,y); dir -1 / +1 for left / right. Leading arm, finger bones, scalloped membrane. */
  function wing(x, y, dir, s) {
    var g = el('g', {}), tips = [[19, -33], [23, -15], [21, 3], [14, 18]], root = [3, 24], sh = [0, 0], i, m, c;
    function P(p) { return [x + dir * p[0] * s, y + p[1] * s]; }
    g.appendChild(poly([P(sh), P([8, -18]), P(tips[0])], 'o-dragon'));
    g.appendChild(poly([P(tips[0]), P([22, -39]), P([26, -37])], 'o-dragon'));  /* the claw at the wing's wrist */
    var edge = [P(tips[0])];
    for (i = 0; i < tips.length - 1; i++) {
      m = P([(tips[i][0] + tips[i + 1][0]) / 2 - 7, (tips[i][1] + tips[i + 1][1]) / 2]);
      edge.push(m, P(tips[i + 1]));
    }
    m = P([(tips[3][0] + root[0]) / 2 - 5, (tips[3][1] + root[1]) / 2 + 2]);
    edge.push(m, P(root));
    /* membrane edge as smooth scallops: quadratic through each pulled-in midpoint */
    var d = 'M' + f(edge[0][0]) + ' ' + f(edge[0][1]);
    for (i = 1; i < edge.length; i += 2) d += ' Q' + f(edge[i][0]) + ' ' + f(edge[i][1]) + ' ' + f(edge[i + 1][0]) + ' ' + f(edge[i + 1][1]);
    g.appendChild(path(d, 'o-dragon'));
    tips.forEach(function (t) { g.appendChild(poly([P(sh), P(t)], 'o-dragon thin')); });
    g.appendChild(poly([P(sh), P(root)], 'o-dragon'));
    return g;
  }

  /* a baby dragon, facing right, feet at (x,y). pose 'perch' sits with its tail curled and small wings folded up;
     pose 'fly' has its wings open and its feet tucked. dir -1 mirrors it. A big head, a short neck, a ✦ for an eye. */
  function babyDragon(x, y, s, dir, pose) {
    var g = el('g', { transform: 'translate(' + x + ' ' + y + ') scale(' + (dir * s) + ' ' + s + ')' });
    function D(d, cls) { g.appendChild(path(d, cls || 'o-dragon')); }
    /* back, neck and skull; jaw; belly */
    D('M-16 -6 C-14 -16 -2 -20 6 -16 C10 -14 12 -12 12 -10');
    D('M12 -10 C14 -18 22 -20 27 -16 C30 -14 30 -11 27 -9 C24 -8 20 -9 17 -8');
    D('M27 -9 C24 -6 19 -6 16 -7', 'o-dragon thin');
    D('M16 -7 C15 -2 10 2 3 3 C-4 4 -12 2 -16 -2');
    /* curled tail */
    D('M-16 -6 C-24 -7 -31 -2 -30 4 C-29 9 -22 10 -21 5 C-20 2 -23 0 -25 2');
    D('M-16 -2 C-20 -1 -24 2 -24 4', 'o-dragon thin');
    /* horn, brow, spines */
    D('M17 -17 C15 -22 12 -24 9 -25', 'o-dragon thin');
    D('M16 -14 Q21 -17 25 -14', 'o-dragon thin');
    [[-10, -13], [-4, -17], [2, -18]].forEach(function (q) { g.appendChild(poly([[q[0] - 2.2, q[1] + 0.5], [q[0], q[1] - 3.4], [q[0] + 2.2, q[1] + 0.5]], 'o-dragon thin')); });
    g.appendChild(star(21.5, -13.2, 2.4));
    g.appendChild(circ(27.3, -12, 0.6, 'o-dragon thin'));
    if (pose === 'fly') {
      g.appendChild(wing(-6, -12, -1, 0.62)); g.appendChild(wing(-4, -13, 1, 0.5));
      D('M-6 1 L-7 5 M2 3 L2 7', 'o-dragon thin');
    } else {
      D('M-4 -15 L-6 -28 Q-9 -24 -11 -27 Q-13 -22 -16 -24 L-13 -14');
      D('M-4 -15 L-11 -27', 'o-dragon thin');
      D('M-8 1.5 L-9 8 L-4 8 M2 3 L1 9 L6 9', 'o-dragon thin');
    }
    return g;
  }

  /* ---------- the side column: one tall tile, repeated down the page ----------
     A wyrm weaves down the column and passes through arcane rings; at the crossings it spreads its wings, from its
     curves grow oak, acorns and a fern, a moon and stars keep the other side, and runes run along the outer wires.
     Stroke only, no gradients. Copper is the dragon, green the growing things, violet the arcane, turquoise the breath. */
  var TW = 112, TH = 640, BX = 76, AMP = 14, PERIOD = 320, PH = 40, HW = 6;
  function bx(y) { return BX + AMP * Math.sin(2 * PI * (y - PH) / PERIOD); }
  function bdx(y) { return AMP * 2 * PI / PERIOD * Math.cos(2 * PI * (y - PH) / PERIOD); }

  /* the wyrm's body: a halo to hide whatever it passes over, two edges, scale chevrons and a spined back */
  function wyrm() {
    var g = el('g', {}), C = [], Lp = [], Rp = [], y, dx, len, nx, ny, tx, ty, k = 0, c, chev, spines = '';
    for (y = -6; y <= TH + 6; y += 3) {
      dx = bdx(y); len = Math.sqrt(dx * dx + 1); nx = 1 / len; ny = -dx / len; tx = dx / len; ty = 1 / len; c = [bx(y), y];
      C.push(c); Lp.push([c[0] - nx * HW, c[1] - ny * HW]); Rp.push([c[0] + nx * HW, c[1] + ny * HW]);
      if (k % 2 === 0) {
        g.appendChild(poly([[c[0] - nx * HW, c[1] - ny * HW], [c[0] + tx * 3.4, c[1] + ty * 3.4], [c[0] + nx * HW, c[1] + ny * HW]], 'o-dragon thin'));
      }
      if (k % 5 === 0) {
        var sd = (k / 5) % 2 ? 1 : -1, e = [c[0] + sd * nx * HW, c[1] + sd * ny * HW];
        g.appendChild(poly([[e[0] - tx * 3, e[1] - ty * 3], [e[0] + sd * nx * 4.6 + tx * 1.5, e[1] + sd * ny * 4.6 + ty * 1.5], [e[0] + tx * 3.5, e[1] + ty * 3.5]], 'o-dragon'));
      }
      k++;
    }
    var halo = poly(C, 'o-halo'); g.insertBefore(halo, g.firstChild);
    g.appendChild(poly(Lp, 'o-dragon')); g.appendChild(poly(Rp, 'o-dragon'));
    return g;
  }

  function sideTile(ground) {
    var g = el('g', {}), y, k;
    /* the rune band: two wires, ticks along them, and an inscription of runes and bindrunes between them */
    g.appendChild(line(20, 0, 20, TH, 'o-rule')); g.appendChild(line(36, 0, 36, TH, 'o-rule'));
    var runes = el('g', { 'class': 'o-runes' });
    for (y = 10, k = 0; y < TH; y += 20, k++) {
      var m = k % 8;
      if (m === 3) { runes.appendChild(diamond(28, y, 3.4, 'o-arcane thin')); runes.appendChild(el('circle', { cx: 28, cy: y, r: 1, 'class': 'o-arcane-fill' })); }
      else if (m === 7) { runes.appendChild(circ(28, y, 4.6, 'o-arcane thin')); runes.appendChild(line(28, y - 4.6, 28, y + 4.6, 'o-arcane thin')); runes.appendChild(line(23.4, y, 32.6, y, 'o-arcane thin')); }
      else if (m === 1 || m === 5) runes.appendChild(bindrune(28, y, (k * 5 + 2) % 24, (k * 7 + 9) % 24));
      else runes.appendChild(rune(28, y, (k * 7 + (k >> 2) * 3) % 24));
      if (k % 2 === 0) { runes.appendChild(line(17.5, y + 10, 20, y + 10, 'o-rule thin')); runes.appendChild(line(36, y + 10, 38.5, y + 10, 'o-rule thin')); }
    }
    g.appendChild(runes);
    /* a vine climbs the inner wire, a pair of leaves at every second rune */
    var vp = [];
    for (y = -2; y <= TH + 2; y += 2) vp.push([39 + 2.4 * Math.sin(2 * PI * y / 40), y]);
    g.appendChild(poly(vp, 'o-leaf thin'));
    for (y = 20; y < TH; y += 40) {
      g.appendChild(leaf(39, y, -PI / 2 + 0.55, 10)); g.appendChild(leaf(39, y + 20, PI / 2 - 0.55, 10));
    }
    if (ground) return g;
    /* the wyrm alone, with wings spread at two of its crossings; everything else lives in the bands beside it */
    [200, 520].forEach(function (cy) { g.appendChild(wing(bx(cy) - HW + 1, cy - 6, -1, 1.05)); g.appendChild(wing(bx(cy) + HW - 1, cy - 6, 1, 1.05)); });
    g.appendChild(wyrm());
    return g;
  }

  /* ---------- the bands: what the screen has to spare, filled outward from the wyrm ----------
     Not blocks of scattered pieces: five bands, each 56 wide and each one thing, laid side by side in a fixed order
     (a vine with perched baby dragons, a chain of sigils, a rune frieze, a fern stem, a second vine). Every piece sits
     on its band's own centre line at a fixed pitch, so nothing can touch its neighbour or the wyrm. All five
     divide the same 1280 height, so the tiling is seamless. */
  var BW = 56, FH = 1280, NB = 5, MAXB = 14;
  function wave(y, ph, amp, per) { return 28 + amp * Math.sin(2 * PI * (y + ph) / per); }

  function vineBand(variant) {
    var g = el('g', {}), y, k, pts = [], ph = variant ? 40 : 0, babies = variant ? [[690, -1], [1190, 1]] : [[250, 1], [930, -1]];
    function nearBaby(yy) { return babies.some(function (b) { return Math.abs(yy - b[0]) < 40; }); }
    for (y = -4; y <= FH + 4; y += 4) pts.push([wave(y, ph, 7, 160), y]);
    g.appendChild(poly(pts, 'o-leaf'));
    for (k = 0; k < 32; k++) {                       /* small leaves, alternating sides, every 40 */
      y = 20 + 40 * k; if (nearBaby(y)) continue;
      var side = k % 2 ? -1 : 1, x = wave(y, ph, 7, 160);
      g.appendChild(leaf(x, y, side > 0 ? -0.55 : PI + 0.55, 14));
    }
    for (k = 0; k < 8; k++) {                        /* at every swing of the vine: an oak leaf and acorn, or two acorns */
      y = 80 + 160 * k - ph; if (nearBaby(y)) continue;
      var x2 = wave(y, ph, 7, 160), sd = k % 2 ? -1 : 1;
      if (k % 2) { g.appendChild(acorn(x2 - 3, y + 2, 0.95, 4)); g.appendChild(acorn(x2 + 8, y + 5, 0.8, -8)); }
      else { g.appendChild(oakLeaf(x2, y + 2, sd > 0 ? 0.35 : PI - 0.35, 20)); g.appendChild(acorn(x2 - 10, y + 10, 0.8, 8)); }
    }
    babies.forEach(function (b) {                     /* each sits on a short ledge that crosses the vine, feet on the ledge */
      var sx = wave(b[0], ph, 7, 160), yb = b[0];
      g.appendChild(poly([[sx - 25, yb + 1.5], [sx - 9, yb - 1], [sx + 9, yb - 1], [sx + 25, yb + 1.5]], 'o-leaf'));
      g.appendChild(babyDragon(sx, yb - 1 - 8.5 * 0.85, 0.85, b[1], 'perch'));
    });
    return g;
  }

  function arcaneBand() {
    var g = el('g', {}), k, y, x = 28;
    for (k = 0; k < 10; k++) {
      y = 64 + 128 * k;
      g.appendChild(sigil(x, y, 21, k % 2 ? 'star' : 'tri'));
      var m = y + 64, t = k % 3;                      /* between sigils, a moon, a pair of stars, or a small constellation */
      g.appendChild(line(x, y + 21, x, m - 13, 'o-rule thin')); g.appendChild(line(x, m + 13, x, y + 107, 'o-rule thin'));
      if (t === 0) g.appendChild(moon(x, m, 9));
      else if (t === 1) { g.appendChild(star(x, m - 6, 4.5)); g.appendChild(star(x, m + 6, 3.5)); }
      else g.appendChild(constellation([[x - 10, m + 6], [x, m - 7], [x + 10, m + 5]], [3.5, 5, 3.5]));
    }
    return g;
  }

  function runeBand() {
    var g = el('g', {}), k, y;
    g.appendChild(line(10, 0, 10, FH, 'o-rule')); g.appendChild(line(46, 0, 46, FH, 'o-rule'));
    for (k = 0; k < 64; k++) {
      y = 10 + 20 * k;
      var m = k % 8;
      if (m === 3) { g.appendChild(diamond(28, y, 4, 'o-arcane thin')); g.appendChild(el('circle', { cx: 28, cy: y, r: 1.1, 'class': 'o-arcane-fill' })); g.appendChild(line(14, y, 22, y, 'o-arcane thin')); g.appendChild(line(34, y, 42, y, 'o-arcane thin')); }
      else if (m === 7) { g.appendChild(circ(28, y, 6, 'o-arcane thin')); g.appendChild(line(28, y - 6, 28, y + 6, 'o-arcane thin')); g.appendChild(line(22, y, 34, y, 'o-arcane thin')); }
      else if (m % 2) g.appendChild(bindrune(28, y, (k * 5 + 2) % 24, (k * 7 + 9) % 24, 1.1));
      else { g.appendChild(glyph(21, y, (k * 7 + 3) % 24, 0.95)); g.appendChild(glyph(35, y, (k * 11 + 5) % 24, 0.95)); }
      if (k % 2 === 0) { g.appendChild(line(7, y + 10, 10, y + 10, 'o-rule thin')); g.appendChild(line(46, y + 10, 49, y + 10, 'o-rule thin')); }
    }
    return g;
  }

  function fernBand() {
    var g = el('g', {}), y, k, pts = [];
    for (y = -4; y <= FH + 4; y += 4) pts.push([wave(y, 0, 3, 128), y]);
    g.appendChild(poly(pts, 'o-leaf'));
    for (k = 0; k < 40; k++) {                       /* ladder fern: a pair of leaves every 32, tilting up and outward */
      y = 16 + 32 * k; var x = wave(y, 0, 3, 128);
      g.appendChild(leaf(x, y, -PI / 2 + 0.95, 19)); g.appendChild(leaf(x, y, -PI / 2 - 0.95, 19));
      if (k % 4 === 3) g.appendChild(star(x, y + 16, 3.6));
    }
    return g;
  }

  function bandTile(kind) { return [function () { return vineBand(0); }, arcaneBand, runeBand, fernBand, function () { return vineBand(1); }][kind](); }

  /* the wyrm's head, in profile, facing the page. Its neck joins the first tile at (NX, HEAD_H). */
  var HEAD_H = 92, NX = bx(0);
  function head() {
    var g = el('g', {}), O = [62, 58], k, y, c, dx, len, nx, ny, tx, ty, C = [], Lp = [], Rp = [];
    function P(dx_, dy_) { return [O[0] + dx_, O[1] + dy_]; }
    /* neck: the same weave, continued upward from the tile's first row */
    for (y = HEAD_H + 3; y >= O[1]; y -= 3) {
      dx = bdx(y - HEAD_H); len = Math.sqrt(dx * dx + 1); nx = 1 / len; ny = -dx / len; tx = dx / len; ty = 1 / len; c = [bx(y - HEAD_H), y];
      C.push(c); Lp.push([c[0] - nx * HW, c[1] - ny * HW]); Rp.push([c[0] + nx * HW, c[1] + ny * HW]);
      if (Math.round((HEAD_H - y) / 3) % 2 === 0) g.appendChild(poly([[c[0] - nx * HW, c[1] - ny * HW], [c[0] + tx * 3.4, c[1] + ty * 3.4], [c[0] + nx * HW, c[1] + ny * HW]], 'o-dragon thin'));
    }
    g.insertBefore(poly(C, 'o-halo'), g.firstChild);
    g.appendChild(poly(Lp, 'o-dragon')); g.appendChild(poly(Rp, 'o-dragon'));
    /* back-of-the-neck spines */
    [[-6, 6], [-7, 19], [-7.5, 32]].forEach(function (q) { var a = P(q[0], q[1]); g.appendChild(poly([[a[0], a[1] - 3.5], [a[0] - 6, a[1] + 0.5], [a[0], a[1] + 3.5]], 'o-dragon')); });
    /* horns, swept back */
    g.appendChild(path('M' + P(-1, -12).join(' ') + ' C' + P(-7, -21).join(' ') + ' ' + P(-12, -24).join(' ') + ' ' + P(-18, -34).join(' '), 'o-dragon'));
    g.appendChild(path('M' + P(5, -15).join(' ') + ' C' + P(1, -24).join(' ') + ' ' + P(-2, -29).join(' ') + ' ' + P(-4, -38).join(' '), 'o-dragon thin'));
    /* skull and snout, then the open jaw */
    g.appendChild(path('M' + P(-6, 2).join(' ') + ' C' + P(-8, -8).join(' ') + ' ' + P(-2, -16).join(' ') + ' ' + P(8, -19).join(' ') +
      ' C' + P(18, -22).join(' ') + ' ' + P(32, -18).join(' ') + ' ' + P(45, -10).join(' ') +
      ' C' + P(48, -8).join(' ') + ' ' + P(48, -4).join(' ') + ' ' + P(44, -2).join(' ') +
      ' C' + P(36, -2).join(' ') + ' ' + P(22, -3).join(' ') + ' ' + P(14, -2).join(' '), 'o-dragon'));
    g.appendChild(path('M' + P(44, -2).join(' ') + ' C' + P(40, 4).join(' ') + ' ' + P(32, 9).join(' ') + ' ' + P(18, 9).join(' ') +
      ' C' + P(12, 9).join(' ') + ' ' + P(8, 6).join(' ') + ' ' + P(6, 4).join(' '), 'o-dragon'));
    g.appendChild(path('M' + P(14, -2).join(' ') + ' C' + P(16, 4).join(' ') + ' ' + P(20, 6).join(' ') + ' ' + P(26, 6).join(' '), 'o-dragon thin'));
    /* teeth, a nostril, a brow ridge, and the eye: a four-pointed ✦ */
    [[24, -3], [30, -3], [36, -3]].forEach(function (q) { var a = P(q[0], q[1]); g.appendChild(poly([[a[0] - 1.6, a[1]], [a[0], a[1] + 3.2], [a[0] + 1.6, a[1]]], 'o-dragon thin')); });
    g.appendChild(circ(f(O[0] + 40), f(O[1] - 10), 1.2, 'o-dragon thin'));
    g.appendChild(path('M' + P(8, -14).join(' ') + ' Q' + P(18, -17).join(' ') + ' ' + P(27, -13).join(' '), 'o-dragon thin'));
    g.appendChild(star(O[0] + 17, O[1] - 9, 4.5));
    return g;
  }

  function column(side) {
    var svg = el('svg', { 'class': 'col-svg', width: '100%', height: '100%', 'aria-hidden': 'true', focusable: 'false' });
    var defs = el('defs', {}, [
      el('pattern', { id: 'o-tile-' + side, x: 0, y: HEAD_H, width: TW, height: TH, patternUnits: 'userSpaceOnUse' }, [sideTile(false)]),
      el('pattern', { id: 'o-band-0-' + side, x: 0, y: 0, width: BW, height: FH, patternUnits: 'userSpaceOnUse' }, [bandTile(0)]),
      el('pattern', { id: 'o-band-1-' + side, x: 0, y: 0, width: BW, height: FH, patternUnits: 'userSpaceOnUse' }, [bandTile(1)]),
      el('pattern', { id: 'o-band-2-' + side, x: 0, y: 0, width: BW, height: FH, patternUnits: 'userSpaceOnUse' }, [bandTile(2)]),
      el('pattern', { id: 'o-band-3-' + side, x: 0, y: 0, width: BW, height: FH, patternUnits: 'userSpaceOnUse' }, [bandTile(3)]),
      el('pattern', { id: 'o-band-4-' + side, x: 0, y: 0, width: BW, height: FH, patternUnits: 'userSpaceOnUse' }, [bandTile(4)]),
      el('pattern', { id: 'o-ground-' + side, x: 0, y: HEAD_H, width: TW, height: TH, patternUnits: 'userSpaceOnUse' }, [sideTile(true)]),
      el('pattern', { id: 'o-check-' + side, x: 0, y: 0, width: 16, height: 16, patternUnits: 'userSpaceOnUse' }, [
        el('rect', { x: 0, y: 0, width: 8, height: 8, 'class': 'o-dark' }), el('rect', { x: 8, y: 8, width: 8, height: 8, 'class': 'o-dark' }),
        el('rect', { x: 8, y: 0, width: 8, height: 8, 'class': 'o-pale' }), el('rect', { x: 0, y: 8, width: 8, height: 8, 'class': 'o-pale' })
      ])
    ]);
    svg.appendChild(defs);
    svg.appendChild(el('rect', { x: 0, y: 0, width: 16, height: '100%', fill: 'url(#o-check-' + side + ')' }));
    svg.appendChild(el('rect', { x: 0, y: 0, width: TW, height: HEAD_H, fill: 'url(#o-ground-' + side + ')' }));
    svg.appendChild(el('rect', { x: 0, y: HEAD_H, width: TW, height: '100%', fill: 'url(#o-tile-' + side + ')' }));
    /* each band is its own rect with the pattern shifted to start at the rect's left edge */
    var i;
    for (i = 0; i < MAXB; i++) {
      var pid = 'o-bandx-' + side + '-' + i;
      svg.firstChild.appendChild(el('pattern', { id: pid, href: '#o-band-' + (i % NB) + '-' + side, x: TW + i * BW, y: 0, width: BW, height: FH, patternUnits: 'userSpaceOnUse' }));
      svg.appendChild(el('rect', { 'class': 'col-band', x: TW + i * BW, y: 0, width: 0, height: '100%', fill: 'url(#' + pid + ')' }));
    }
    svg.appendChild(el('line', { 'class': 'col-end o-rule', x1: -10, y1: 0, x2: -10, y2: '100%' }));
    svg.appendChild(head());
    return svg;
  }

  /* ---------- horizontal flourish: a broken line, a ✦ in the pause, a scroll at each end ---------- */
  function flourish(w, opts) {
    w = w || 360; opts = opts || {};
    var h = 36, cy = 18, c = w / 2, gap = 20;
    var svg = el('svg', { 'class': 'flourish', width: w, height: h, viewBox: '0 0 ' + w + ' ' + h, 'aria-hidden': 'true', focusable: 'false' });
    var half = el('g', {});
    half.appendChild(line(c - gap, cy, c - gap - 34, cy, 'o-live'));
    half.appendChild(line(c - gap - 42, cy, 78, cy, 'o-rule'));
    half.appendChild(diamond(c - gap - 38, cy, 3));
    half.appendChild(path(spiral(62, cy - 3, 12, 1.5, 2.25, 1, PI), 'o-rule'));
    half.appendChild(path(spiral(40, cy + 4, 8, 1.2, 2, -1, 0), 'o-rule'));
    half.appendChild(path('M74 ' + cy + ' C70 ' + (cy - 6) + ' 66 ' + (cy - 12) + ' 62 ' + (cy - 15), 'o-rule'));
    half.appendChild(line(30, cy, 14, cy, 'o-rule thin'));
    half.appendChild(diamond(10, cy, 3, 'o-rule'));
    svg.appendChild(half);
    svg.appendChild(el('g', { transform: 'translate(' + w + ' 0) scale(-1 1)' }, [half.cloneNode(true)]));
    svg.appendChild(star(c, cy, opts.big ? 11 : 8));
    return svg;
  }

  /* quarter-flourish for the corners of a plate; four <use> copies rotate it */
  function cornerSymbol() {
    var g = el('g', {});
    g.appendChild(path('M4 44 L4 4 L44 4', 'o-rule'));
    g.appendChild(path('M10 44 L10 10 L44 10', 'o-rule thin'));
    g.appendChild(path(spiral(22, 22, 9, 1.2, 2, 1, PI), 'o-rule'));
    g.appendChild(diamond(4, 4, 4, 'o-fill'));
    g.appendChild(line(30, 22, 44, 22, 'o-live'));
    g.appendChild(line(22, 30, 22, 44, 'o-live'));
    return el('symbol', { id: 'o-corner', viewBox: '0 0 48 48' }, [g]);
  }
  function corners(host) {
    ['tl', 'tr', 'bl', 'br'].forEach(function (p) {
      var s = el('svg', { 'class': 'corner corner-' + p, width: 48, height: 48, 'aria-hidden': 'true', focusable: 'false' }, [el('use', { href: '#o-corner' })]);
      host.appendChild(s);
    });
  }

  /* the ward line: flat, or breathing with a pause; id lets the page toggle it */
  function ward(w, breathing) {
    var svg = el('svg', { 'class': 'ward', width: w, height: 20, viewBox: '0 0 ' + w + ' 20', 'aria-hidden': 'true', focusable: 'false' });
    var a = el('line', { x1: 0, y1: 10, x2: w, y2: 10, 'class': 'ward-a' });
    var b = el('line', { x1: 0, y1: 10, x2: 0, y2: 10, 'class': 'ward-b' });
    svg.appendChild(a); svg.appendChild(b);
    svg.setBreathing = function (on) {
      var gap = on ? 28 : 0, x0 = (w - gap) / 2;
      svg.setAttribute('class', 'ward' + (on ? ' live' : ''));
      a.setAttribute('x2', on ? x0 : w); b.setAttribute('x1', x0 + gap); b.setAttribute('x2', on ? w : x0 + gap);
    };
    svg.setBreathing(!!breathing);
    return svg;
  }

  function mount() {
    var host = el('svg', { width: 0, height: 0, style: 'position:absolute', 'aria-hidden': 'true', focusable: 'false' }, [el('defs', {}, [cornerSymbol()])]);
    document.body.insertBefore(host, document.body.firstChild);
    var cols = ['l', 'r'].map(function (sd) { var c = document.getElementById('col-' + sd); c.appendChild(column(sd)); return c; });
    /* the wider the screen, the more strips; whole strips only, so nothing is ever cut in half */
    function fit() {
      cols.forEach(function (c) {
        var w = c.clientWidth, n = Math.max(0, Math.min(MAXB, Math.floor((w - TW + 6) / BW)));
        c.querySelectorAll('.col-band').forEach(function (r, i) { r.setAttribute('width', i < n ? BW : 0); });
        var e = c.querySelector('.col-end'); if (e) { var ex = TW + n * BW + 4; e.setAttribute('x1', n ? ex : -10); e.setAttribute('x2', n ? ex : -10); }
      });
    }
    fit();
    if (window.ResizeObserver) { var ro = new ResizeObserver(fit); cols.forEach(function (c) { ro.observe(c); }); }
    else window.addEventListener('resize', fit);
  }

  window.MVOrn = { mount: mount, flourish: flourish, corners: corners, ward: ward, star: function (s) {
    return el('svg', { 'class': 'mini-star', width: s, height: s, viewBox: '0 0 20 20', 'aria-hidden': 'true', focusable: 'false' }, [star(10, 10, 9)]);
  } };
})();
