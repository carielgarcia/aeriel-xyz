/* ÆRIEL colour engine — path finding off the main thread.
   Signatures: 16 weighted points in OKLab per photo (scripts/chroma.py). D: pairwise EMD ×100 (stored ×100 as ints).

   Messages in:  {type:'init', codes, sigs, D}
                 {type:'path', id, a, b, steps, path:'direct'|'chain', pool:[codes]}
                 {type:'row',  id, from}            → EMD from a slot (photo code or {swatch, lab}) to every photo
   Messages out: {id, ...result, ms}

   Direct interpolation: displacement interpolation along the optimal transport plan A→B (each unit of colour
   travels in a straight line in OKLab); at each of the N−2 inner stops the archive photo nearest (EMD) to the
   interpolated distribution is taken, never twice.
   Curatorial chain: shortest path with exactly N−1 hops over the 8-nearest-neighbour graph, edge cost = D²
   (squared, so the walk prefers many even steps to a few long jumps); layered Dijkstra/Bellman–Ford over hop
   count, no photo visited twice; falls back to the complete graph when the neighbour graph is too sparse. */
'use strict';
var codes = [], index = {}, sigs = [], D = null, knn = null;
var EPS = 0.004;

function sinkhorn(A, B, iters, wantPlan) {
  var n = A.length, m = B.length, C = new Float64Array(n * m), K = new Float64Array(n * m), i, j, k;
  for (i = 0; i < n; i++) for (j = 0; j < m; j++) {
    var dl = A[i][0] - B[j][0], da = A[i][1] - B[j][1], db = A[i][2] - B[j][2], c = Math.sqrt(dl * dl + da * da + db * db);
    C[i * m + j] = c; K[i * m + j] = Math.exp(-c / EPS);
  }
  var u = new Float64Array(n).fill(1), v = new Float64Array(m).fill(1);
  for (k = 0; k < iters; k++) {
    for (i = 0; i < n; i++) { var s = 0; for (j = 0; j < m; j++) s += K[i * m + j] * v[j]; u[i] = A[i][3] / Math.max(s, 1e-300); }
    for (j = 0; j < m; j++) { var t = 0; for (i = 0; i < n; i++) t += K[i * m + j] * u[i]; v[j] = B[j][3] / Math.max(t, 1e-300); }
  }
  var cost = 0, plan = wantPlan ? [] : null;
  for (i = 0; i < n; i++) for (j = 0; j < m; j++) {
    var p = u[i] * K[i * m + j] * v[j];
    cost += p * C[i * m + j];
    if (plan && p > 2e-3) plan.push([A[i][0], A[i][1], A[i][2], B[j][0], B[j][1], B[j][2], p]);
  }
  return { d: cost * 100, plan: plan };
}
function sigOf(slot) { return typeof slot === 'string' ? sigs[index[slot]] : [[slot.lab[0], slot.lab[1], slot.lab[2], 1]]; }
function dist(x, y) {
  if (typeof x === 'string' && typeof y === 'string') return D[index[x]][index[y]] / 100;
  return sinkhorn(sigOf(x), sigOf(y), 250).d;
}
function buildKnn(k) {
  var n = codes.length, nb = [];
  for (var i = 0; i < n; i++) {
    var row = [];
    for (var j = 0; j < n; j++) if (j !== i) row.push(j);
    row.sort(function (a, b) { return D[i][a] - D[i][b]; });
    nb.push(new Set(row.slice(0, k)));
  }
  for (i = 0; i < n; i++) nb[i].forEach(function (j) { nb[j].add(i); });   // symmetric
  return nb.map(function (s) { return Array.from(s); });
}
function nearestPhoto(slot, pool) {
  var best = null, bd = Infinity;
  pool.forEach(function (c) { var d = dist(slot, c); if (d < bd) { bd = d; best = c; } });
  return best;
}

/* exactly `hops` edges from s to t, no repeated node; returns node indices or null */
function hopPath(s, t, hops, allowed, neighbours) {
  var layer = new Map([[s, { cost: 0, prev: null }]]), layers = [layer];
  function onPath(node, rec) { for (var r = rec; r; r = r.prev) if (r.node === node) return true; return false; }
  layer.get(s).node = s;
  for (var h = 1; h <= hops; h++) {
    var next = new Map();
    layer.forEach(function (rec, u) {
      var nbs = neighbours ? neighbours[u] : allowed;
      for (var x = 0; x < nbs.length; x++) {
        var v = nbs[x];
        if (!allowed.has(v) || v === u) continue;
        if (v === t && h < hops) continue;
        if (h === hops && v !== t) continue;
        if (onPath(v, rec)) continue;
        var w = D[u][v] / 100, c = rec.cost + w * w, cur = next.get(v);
        if (!cur || c < cur.cost) next.set(v, { cost: c, prev: rec, node: v });
      }
    });
    if (!next.size) return null;
    layers.push(next); layer = next;
  }
  var end = layer.get(t); if (!end) return null;
  var out = []; for (var r = end; r; r = r.prev) out.unshift(r.node);
  return out;
}

function path(msg) {
  var a = msg.a, b = msg.b, pool = msg.pool.filter(function (c) { return c in index; });
  var aIsPhoto = typeof a === 'string', bIsPhoto = typeof b === 'string';
  [a, b].forEach(function (x) { if (typeof x === 'string' && pool.indexOf(x) < 0) pool.push(x); });
  var photosWanted = msg.steps - (aIsPhoto ? 0 : 1) - (bIsPhoto ? 0 : 1);
  photosWanted = Math.max(aIsPhoto && bIsPhoto ? 2 : 1, Math.min(photosWanted, pool.length));
  var cases = [], capped = photosWanted + (aIsPhoto ? 0 : 1) + (bIsPhoto ? 0 : 1) < msg.steps;

  if (msg.path === 'chain') {
    var s = aIsPhoto ? a : nearestPhoto(a, pool), t = bIsPhoto ? b : nearestPhoto(b, pool.filter(function (c) { return c !== s; }));
    var allowed = new Set(pool.map(function (c) { return index[c]; }));
    var hops = Math.max(1, photosWanted - 1), ids = null;
    if (s === t) ids = [index[s]];
    else {
      ids = hopPath(index[s], index[t], hops, allowed, knn);
      while (!ids && hops >= 1) { ids = hopPath(index[s], index[t], hops, allowed, null); if (!ids) { hops--; capped = true; } }
    }
    var chosen = (ids || [index[s], index[t]]).map(function (i) { return codes[i]; });
    if (!aIsPhoto) cases.push(a); cases = cases.concat(chosen); if (!bIsPhoto) cases.push(b);
  } else {
    var A = sigOf(a), B = sigOf(b), plan = sinkhorn(A, B, 300, true).plan, used = new Set();
    if (aIsPhoto) used.add(a); if (bIsPhoto) used.add(b);
    var inner = photosWanted - (aIsPhoto ? 1 : 0) - (bIsPhoto ? 1 : 0), mids = [];
    for (var k = 1; k <= inner; k++) {
      var tt = k / (inner + 1);   // A sits at t = 0, B at t = 1, cases evenly spaced between
      var target = plan.map(function (e) { return [e[0] + (e[3] - e[0]) * tt, e[1] + (e[4] - e[1]) * tt, e[2] + (e[5] - e[2]) * tt, e[6]]; });
      var tot = target.reduce(function (x, e) { return x + e[3]; }, 0); target.forEach(function (e) { e[3] /= tot; });
      var best = null, bd = Infinity;
      pool.forEach(function (c) { if (used.has(c)) return; var d = sinkhorn(target, sigs[index[c]], 120).d; if (d < bd) { bd = d; best = c; } });
      if (best) { used.add(best); mids.push(best); }
    }
    cases = [a].concat(mids, [b]);
  }
  // distances between consecutive cases and transport plans for the ribbon
  var deltas = [0], plans = [];
  for (var i = 1; i < cases.length; i++) {
    var r = sinkhorn(sigOf(cases[i - 1]), sigOf(cases[i]), 250, true);
    deltas.push(typeof cases[i - 1] === 'string' && typeof cases[i] === 'string' ? D[index[cases[i - 1]]][index[cases[i]]] / 100 : r.d);
    plans.push(r.plan);
  }
  return { cases: cases, deltas: deltas, plans: plans, capped: capped };
}

function onMessage(msg, reply) {
  var t0 = (self.performance || Date).now(), out;
  if (msg.type === 'init') {
    codes = msg.codes; sigs = msg.sigs; D = msg.D; index = {}; codes.forEach(function (c, i) { index[c] = i; });
    knn = buildKnn(Math.min(8, codes.length - 1)); out = { ready: true };
  } else if (msg.type === 'path') out = path(msg);
  else if (msg.type === 'row') out = { row: codes.map(function (c) { return dist(msg.from, c); }) };
  out.id = msg.id; out.ms = Math.round(((self.performance || Date).now() - t0) * 10) / 10;
  reply(out);
}
if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
  self.onmessage = function (e) { onMessage(e.data, function (o) { self.postMessage(o); }); };
} else {
  /* main-thread fallback when Workers are unavailable */
  window.ChromaPath = { send: function (msg, cb) { setTimeout(function () { onMessage(msg, cb); }, 0); } };
}
