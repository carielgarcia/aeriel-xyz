/* Baroque furniture for Machiavell, drawn only from the system's own vocabulary:
   hairlines in `rule`, breathing strokes in `turquoise` (always interrupted), the checkerboard
   of the Concord's floor, concentric discs, the ✦ and the scroll. Stroke only, no gradients, no faces. */
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

  /* concentric rosette: discs, sixteen ticks, eight petals */
  function rosette(cx, cy, R) {
    var g = el('g', {}), k, a;
    g.appendChild(circ(cx, cy, R));
    g.appendChild(circ(cx, cy, R * 0.66));
    g.appendChild(circ(cx, cy, R * 0.22, 'o-live'));
    for (k = 0; k < 16; k++) {
      a = k * PI / 8;
      g.appendChild(line(f(cx + (R + 1) * Math.cos(a)), f(cy + (R + 1) * Math.sin(a)), f(cx + (R + 5) * Math.cos(a)), f(cy + (R + 5) * Math.sin(a))));
    }
    for (k = 0; k < 8; k++) {
      g.appendChild(el('ellipse', { cx: 0, cy: -R * 0.44, rx: R * 0.15, ry: R * 0.26, 'class': 'o-live', fill: 'none', transform: 'translate(' + cx + ' ' + cy + ') rotate(' + k * 45 + ')' }));
    }
    return g;
  }

  /* an acanthus-like scroll leaving the stem at (sx,sy) toward `dir` (-1 left, +1 right) */
  function scroll(sx, sy, dir, size) {
    var g = el('g', {}), s = size || 1, ex = sx + dir * 30 * s, ey = sy + 18 * s, cx = sx + dir * 17 * s, cy = sy + 38 * s;
    g.appendChild(path('M' + sx + ' ' + sy + ' C' + (sx + dir * 12 * s) + ' ' + (sy - 14 * s) + ' ' + (sx + dir * 32 * s) + ' ' + (sy - 8 * s) + ' ' + ex + ' ' + ey));
    g.appendChild(path(spiral(cx, cy, 11 * s, 1.5 * s, 2.25, dir, -PI / 2 + (dir > 0 ? 0 : PI)), 'o-rule'));
    g.appendChild(path('M' + ex + ' ' + ey + ' C' + (ex - dir * 3 * s) + ' ' + (ey + 10 * s) + ' ' + (cx + dir * 6 * s) + ' ' + (cy - 12 * s) + ' ' + (cx + dir * 8 * s) + ' ' + (cy - 8 * s)));
    g.appendChild(path('M' + sx + ' ' + (sy + 6 * s) + ' C' + (sx + dir * 6 * s) + ' ' + (sy + 20 * s) + ' ' + (sx + dir * 4 * s) + ' ' + (sy + 34 * s) + ' ' + (sx + dir * 12 * s) + ' ' + (sy + 46 * s), 'o-live'));
    return g;
  }

  /* ---------- the side column: one tile, repeated down the page ---------- */
  var TW = 112, TH = 440, CX = 68;
  function sideTile() {
    var g = el('g', {}), y;
    /* twin wires along the inner edge, each broken where a rosette sits */
    [[22, 'o-rule'], [27, 'o-rule thin']].forEach(function (w) {
      g.appendChild(line(w[0], 0, w[0], 70 - 30, w[1])); g.appendChild(line(w[0], 70 + 30, w[0], 330 - 22, w[1]));
      g.appendChild(line(w[0], 330 + 22, w[0], TH, w[1]));
    });
    /* the stem breathes: turquoise, with a pause at every ornament */
    g.appendChild(line(CX, 0, CX, 70 - 33, 'o-live'));
    g.appendChild(line(CX, 70 + 33, CX, 160 - 6, 'o-live'));
    g.appendChild(line(CX, 160 + 6, CX, 330 - 26, 'o-live'));
    g.appendChild(line(CX, 330 + 26, CX, TH, 'o-live'));
    g.appendChild(rosette(CX, 70, 24));
    g.appendChild(star(CX, 160, 7));
    g.appendChild(scroll(CX, 176, -1, 1)); g.appendChild(scroll(CX, 176, 1, 1));
    g.appendChild(rosette(CX, 330, 16));
    g.appendChild(scroll(CX, 356, -1, 0.9)); g.appendChild(scroll(CX, 356, 1, 0.9));
    /* a lattice of small diamonds between the wires and the stem */
    for (y = 240; y <= 300; y += 20) {
      g.appendChild(diamond(40, y, 4)); g.appendChild(diamond(96, y, 4));
    }
    g.appendChild(diamond(CX, 270, 6, 'o-rule'));
    g.appendChild(star(CX, 420, 5));
    return g;
  }

  function column(side) {
    var svg = el('svg', { 'class': 'col-svg', width: '100%', height: '100%', 'aria-hidden': 'true', focusable: 'false' });
    var defs = el('defs', {}, [
      el('pattern', { id: 'o-tile-' + side, x: 0, y: 0, width: TW, height: TH, patternUnits: 'userSpaceOnUse' }, [sideTile()]),
      el('pattern', { id: 'o-check-' + side, x: 0, y: 0, width: 16, height: 16, patternUnits: 'userSpaceOnUse' }, [
        el('rect', { x: 0, y: 0, width: 8, height: 8, 'class': 'o-dark' }), el('rect', { x: 8, y: 8, width: 8, height: 8, 'class': 'o-dark' }),
        el('rect', { x: 8, y: 0, width: 8, height: 8, 'class': 'o-pale' }), el('rect', { x: 0, y: 8, width: 8, height: 8, 'class': 'o-pale' })
      ])
    ]);
    svg.appendChild(defs);
    svg.appendChild(el('rect', { x: 0, y: 0, width: 16, height: '100%', fill: 'url(#o-check-' + side + ')' }));
    svg.appendChild(el('rect', { x: 0, y: 0, width: TW, height: '100%', fill: 'url(#o-tile-' + side + ')' }));
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
    document.getElementById('col-l').appendChild(column('l'));
    document.getElementById('col-r').appendChild(column('r'));
  }

  window.MVOrn = { mount: mount, flourish: flourish, corners: corners, ward: ward, star: function (s) {
    return el('svg', { 'class': 'mini-star', width: s, height: s, viewBox: '0 0 20 20', 'aria-hidden': 'true', focusable: 'false' }, [star(10, 10, 9)]);
  } };
})();
