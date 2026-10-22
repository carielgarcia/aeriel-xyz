/* ÆRIEL colour layer — plugs into js/archive.js through window.AR.register().
   Data: data/chroma.json (scripts/chroma.py): 24 swatches, per photo atmosphere/accent swatches, top-5 atmosphere
   and accent colours, the 128-colour barcode, a 16-point OKLab signature, and pairwise EMD (D).

   URL state:  ?swatch=teal&swatch=club-fuchsia&mode=accent     colour filter (up to 3 swatches; mode all|atmosphere|accent)
               ?sort=AER-2026-POL-0012                            wall sorted by chromatic distance from a photo
               ?progression=A..B&steps=8&path=chain               colour journey (A, B = catalog code or swatch:<id>)
   Path finding runs in js/chroma-worker.js; the main thread only looks distances up and draws. */
(function () {
  'use strict';
  if (!window.AR) return;
  var api, C, SW = {}, swOrder = [], Pc = {}, idx = {}, grid, worker = null, reqId = 0, pending = {};
  function on() { return !!(C && api); }
  var MODES = ['all', 'atmosphere', 'accent'], STEPS = [5, 8, 12, 16, 24];
  var st = { sw: [], mode: 'all', sort: null, prog: null, picking: null, seq: null, busy: false, note: '' };
  var strip, dock, ribbon, cards = {};

  /* ---------- helpers ---------- */
  function ui(k) { return api.ui(k); }
  function esc(s) { return api.esc(s); }
  function lang() { return api.lang(); }
  function swName(id) { var s = SW[id]; return s ? (s.name[lang()] || s.name.en) : id; }
  function swNum(id) { var i = swOrder.indexOf(id) + 1; return (i < 10 ? '0' : '') + i; }
  function D(a, b) { return C.D[idx[a]][idx[b]] / 100; }
  function fmt(x) { return x == null || isNaN(x) ? '—' : x.toFixed(2); }
  function hexRgb(h) { h = h.replace('#', ''); return [0, 2, 4].map(function (i) { return parseInt(h.substr(i, 2), 16) / 255; }); }
  function lin(c) { return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function oklab(hex) {
    var c = hexRgb(hex).map(lin), r = c[0], g = c[1], b = c[2];
    var l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
  }
  function oklch(hex) { var o = oklab(hex), C2 = Math.hypot(o[1], o[2]), h = (Math.atan2(o[2], o[1]) * 180 / Math.PI + 360) % 360; return [o[0], C2, h]; }
  function labToRgb(L, a, b) {
    var l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3), m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3), s = Math.pow(L - 0.0894841775 * a - 1.2914855480 * b, 3);
    return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s]
      .map(function (c) { c = Math.min(1, Math.max(0, c)); return Math.round((c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055) * 255); });
  }
  function swLab(id) { var s = SW[id], h = s.lch[2] * Math.PI / 180; return [s.lch[0], s.lch[1] * Math.cos(h), s.lch[1] * Math.sin(h)]; }
  function slotKey(x) { return typeof x === 'string' ? x : 'swatch:' + x.swatch; }
  function parseSlot(s) {
    if (!s) return null;
    if (s.indexOf('swatch:') === 0) { var id = s.slice(7); return SW[id] ? { swatch: id, lab: swLab(id) } : null; }
    return Pc[s] ? s : null;
  }
  function photo(code) { var t = api.byCode(code); return t && t._p; }
  function barHTML(code, cls) {
    var b = Pc[code].bar;
    return '<div class="' + cls + '" aria-hidden="true">' + b.map(function (c) { return '<span style="background:' + c[0] + ';flex-grow:' + Math.log1p(c[1]).toFixed(3) + '"></span>'; }).join('') + '</div>';
  }

  /* ---------- worker ---------- */
  function send(msg) {
    msg.id = ++reqId;
    return new Promise(function (resolve) {
      pending[msg.id] = resolve;
      if (worker) worker.postMessage(msg);
      else window.ChromaPath.send(msg, function (o) { var r = pending[o.id]; delete pending[o.id]; if (r) r(o); });
    });
  }
  function startWorker() {
    try { worker = new Worker('js/chroma-worker.js'); worker.onmessage = function (e) { var r = pending[e.data.id]; delete pending[e.data.id]; if (r) r(e.data); }; }
    catch (e) { worker = null; }
    var go = function () { return send({ type: 'init', codes: C.order, sigs: C.order.map(function (c) { return Pc[c].sig; }), D: C.D }); };
    if (worker) return go();
    return new Promise(function (res) { var s = document.createElement('script'); s.src = 'js/chroma-worker.js'; s.onload = res; document.head.appendChild(s); }).then(go);
  }

  /* ---------- matching / counts ---------- */
  function hasSw(p, id, mode) {
    var e = Pc[p.code]; if (!e) return false;
    var a = e.atmSw.indexOf(id) > -1, c = e.accSw.indexOf(id) > -1;
    return mode === 'atmosphere' ? a : mode === 'accent' ? c : (a || c);
  }
  function swMatch(p, list) { return list.every(function (id) { return hasSw(p, id, st.mode); }); }
  function counts() {
    var out = {}, base = api.tiles().map(function (t) { return t._p; }).filter(function (p) { return api.matchesFilters(p); });
    swOrder.forEach(function (id) {
      var list = st.sw.indexOf(id) > -1 ? st.sw : st.sw.concat([id]).slice(-3);
      out[id] = base.filter(function (p) { return swMatch(p, list); }).length;
    });
    return out;
  }

  /* ---------- strip ---------- */
  function buildStrip() {
    strip = document.getElementById('ch-strip');
    var keys = swOrder.map(function (id, i) {
      var s = SW[id], hair = i === 18 ? '<span class="ch-hair" aria-hidden="true"></span>' : '';
      return hair + '<button type="button" class="ch-key' + (s.group === 'tone' ? ' ch-key--tone' : '') + '" data-sw="' + id + '" style="--c:' + s.hex + '" aria-pressed="false"><span class="ch-key-c" aria-hidden="true"></span><span class="ch-key-n" aria-hidden="true">' + swNum(id) + '</span></button>';
    }).join('');
    strip.innerHTML =
      '<div class="ch-row">' +
      '<div class="ch-keys" role="group" id="ch-keys">' + keys + '</div>' +
      '<div class="ch-ctl">' +
      '<div class="filters ch-mode" role="group" id="ch-mode">' + MODES.map(function (m) { return '<button type="button" data-mode="' + m + '" aria-pressed="false"></button>'; }).join('') + '</div>' +
      '<button type="button" class="ae-btn ae-btn--sm ch-journey" id="ch-journey"></button>' +
      '</div></div>' +
      '<p class="ae-cap ch-readout" id="ch-readout" aria-live="polite"></p>';
    strip.hidden = false;
    strip.addEventListener('click', function (e) {
      var k = e.target.closest('.ch-key');
      if (k) { onSwatch(k.dataset.sw); return; }
      var m = e.target.closest('[data-mode]');
      if (m) { if (st.mode !== m.dataset.mode) api.update(function () { st.mode = m.dataset.mode; }, true); return; }
      if (e.target.closest('#ch-journey')) startJourney();
    });
    function over(e) { var k = e.target.closest('.ch-key'); readout(k ? k.dataset.sw : null); }
    strip.addEventListener('pointerover', over);
    strip.addEventListener('focusin', over);
    strip.addEventListener('pointerleave', function () { readout(null); });
    strip.addEventListener('focusout', function () { readout(null); });
  }
  var lastCounts = {};
  function readout(id) {
    var r = document.getElementById('ch-readout'); if (!r) return;
    if (id) { r.textContent = swNum(id) + ' · ' + swName(id) + ' · ' + (lastCounts[id] || 0); return; }
    r.textContent = st.note ? ui(st.note) : (st.sw.length ? st.sw.map(function (s) { return swNum(s) + ' ' + swName(s); }).join(' + ') + ' · ' + modeLabel(st.mode) : ui('chPick'));
  }
  function modeLabel(m) { return ui(m === 'atmosphere' ? 'chAtm' : m === 'accent' ? 'chAcc' : 'chAll'); }
  function renderStrip() {
    if (!strip) return;
    lastCounts = counts();
    strip.querySelectorAll('.ch-key').forEach(function (k) {
      var id = k.dataset.sw, n = lastCounts[id], on = st.sw.indexOf(id) > -1;
      k.setAttribute('aria-pressed', String(on));
      k.classList.toggle('is-zero', !n && !on);
      k.setAttribute('aria-label', swNum(id) + ' · ' + swName(id) + ' · ' + n + ' ' + ui(n === 1 ? 'photograph' : 'photographs'));
    });
    strip.querySelectorAll('[data-mode]').forEach(function (b) { b.textContent = modeLabel(b.dataset.mode); b.setAttribute('aria-pressed', String(st.mode === b.dataset.mode)); });
    document.getElementById('ch-mode').setAttribute('aria-label', ui('chModes'));
    document.getElementById('ch-keys').setAttribute('aria-label', ui('chColour'));
    var j = document.getElementById('ch-journey'); j.textContent = ui('chJourney') + ' →'; j.setAttribute('aria-pressed', String(!!st.prog));
    readout(null);
  }
  function onSwatch(id) {
    if (st.picking) { assign(st.picking, { swatch: id, lab: swLab(id) }); return; }
    var next = st.sw.slice(), i = next.indexOf(id);
    if (i > -1) next.splice(i, 1); else { next.push(id); if (next.length > 3) { next.shift(); flash('chMax'); } }
    if (st.seq) exitJourney(true);
    api.update(function () { st.sw = next; }, true);
  }
  function flash(key) { st.note = key; readout(null); setTimeout(function () { st.note = ''; readout(null); }, 2600); }

  /* ---------- drawer profile ---------- */
  function drawer(p) {
    var e = Pc[p.code]; if (!e) return '';
    var h = '<div class="ar-f ar-f--wide ch-profile">';
    h += '<p class="label">' + esc(ui('chProfile')) + '</p>';
    h += '<div class="ch-bar" tabindex="0" role="group" aria-label="' + esc(ui('chProfile') + '. ' + ui('chLoupe')) + '" data-code="' + p.code + '">' +
      e.bar.map(function (c, i) { return '<span data-i="' + i + '" style="background:' + c[0] + ';flex-grow:' + Math.log1p(c[1]).toFixed(3) + '"></span>'; }).join('') + '</div>';
    h += '<p class="ae-cap ch-loupe" aria-live="polite">' + esc(ui('chLoupe')) + '</p>';
    h += '<div class="ch-rows">';
    h += '<p class="label">' + esc(ui('chAtm')) + '</p><div class="ch-pills">' + e.atm.map(function (a) { return pill(a[0], a[2], 'atmosphere', (a[1] / 10).toFixed(1) + '%'); }).join('') + '</div>';
    if (e.acc.length) h += '<p class="label">' + esc(ui('chAccents')) + '</p><div class="ch-pills">' + e.acc.map(function (a) { return pill(a[0], a[2], 'accent', 'ΔE ' + a[3].toFixed(1)); }).join('') + '</div>';
    h += '</div><div class="ch-actions">';
    h += '<button type="button" class="ae-btn ae-btn--sm" data-ch="sort" data-code="' + p.code + '">' + esc(ui('chSort')) + '</button>';
    h += '<button type="button" class="ae-btn ae-btn--sm" data-ch="a" data-code="' + p.code + '">' + esc(ui('chSetA')) + '</button>';
    if (st.prog && st.prog.a && slotKey(st.prog.a) !== p.code) h += '<button type="button" class="ae-btn ae-btn--sm" data-ch="b" data-code="' + p.code + '">' + esc(ui('chSetB')) + '</button>';
    h += '</div></div>';
    return h;
  }
  function pill(hex, sw, mode, metric) {
    var label = ui('chFilterSw') + swName(sw) + ui(mode === 'atmosphere' ? 'chInAtm' : 'chInAcc');
    return '<button type="button" class="ch-pill" data-ch="pill" data-sw="' + sw + '" data-mode="' + mode + '" aria-label="' + esc(label) + '">' +
      '<span class="ch-chip" style="background:' + hex + '" aria-hidden="true"></span><span class="ch-pill-t">' + esc(hex) + '</span><span class="ch-pill-s">' + esc(swName(sw)) + '</span><span class="ch-pill-m">' + esc(metric) + '</span></button>';
  }
  function drawerClick(ev) {
    var b = ev.target.closest('[data-ch]'); if (!b) return false;
    var k = b.dataset.ch;
    if (k === 'pill') { if (st.seq) exitJourney(true); api.update(function () { api.setOnlyFilters([]); st.sw = [b.dataset.sw]; st.mode = b.dataset.mode; st.sort = null; }, true); }
    else if (k === 'sort') { if (st.seq) exitJourney(true); api.update(function () { st.sort = b.dataset.code; }, true); }
    else if (k === 'a') { st.prog = st.prog || { a: null, b: null, steps: 8, path: 'chain' }; assign('a', b.dataset.code); }
    else if (k === 'b') assign('b', b.dataset.code);
    return true;
  }
  function loupe(bar, i) {
    var e = Pc[bar.dataset.code], c = e && e.bar[i]; if (!c) return;
    bar.querySelectorAll('.is-at').forEach(function (s) { s.classList.remove('is-at'); });
    var span = bar.children[i]; if (span) span.classList.add('is-at');
    bar._i = i;
    var l = oklch(c[0]), sw = null;
    for (var j = 0; j < e.atm.length; j++) if (e.atm[j][0] === c[0]) sw = e.atm[j][2];
    var out = bar.parentNode.querySelector('.ch-loupe');
    out.textContent = c[0] + ' · oklch(' + l[0].toFixed(3) + ' ' + l[1].toFixed(3) + ' ' + Math.round(l[2]) + '°) · ' + c[1].toFixed(1) + '‰ ' + ui('chWeight');
  }

  /* ---------- sort ---------- */
  function sortOrder() {
    var ref = st.sort; if (!Pc[ref]) return null;
    return api.tiles().slice().sort(function (a, b) {
      var da = Pc[a._p.code] ? D(ref, a._p.code) : 1e9, db = Pc[b._p.code] ? D(ref, b._p.code) : 1e9; return da - db;
    });
  }

  /* ---------- journey (progression) ---------- */
  function startJourney() {
    if (st.prog) { exitJourney(); return; }
    st.prog = { a: null, b: null, steps: 8, path: 'chain' }; st.picking = 'a';
    renderDock(); dock.scrollIntoView({ block: 'nearest', behavior: api.motion() ? 'smooth' : 'auto' });
    api.update(function () {}, true);
  }
  function assign(slot, value) {
    if (typeof value === 'string' && !Pc[value]) return;
    st.prog = st.prog || { a: null, b: null, steps: 8, path: 'chain' };
    st.prog[slot] = value;
    if (st.prog.a && st.prog.b && slotKey(st.prog.a) === slotKey(st.prog.b)) st.prog[slot === 'a' ? 'b' : 'a'] = null;
    st.picking = !st.prog.a ? 'a' : !st.prog.b ? 'b' : null;
    renderDock();
    if (st.prog.a && st.prog.b) compute(true); else api.update(function () { st.seq = null; }, true);
  }
  function pool() {
    return api.tiles().map(function (t) { return t._p; }).filter(function (p) { return Pc[p.code] && api.matchesFilters(p) && (!st.sw.length || swMatch(p, st.sw)); }).map(function (p) { return p.code; });
  }
  var compSeq = 0;
  function compute(push) {
    var my = ++compSeq, pr = st.prog;
    st.busy = true; renderDock();
    return send({ type: 'path', a: pr.a, b: pr.b, steps: pr.steps, path: pr.path, pool: pool() }).then(function (r) {
      if (my !== compSeq || st.prog !== pr) return;
      st.busy = false;
      api.update(function () { st.seq = r; st.sort = null; }, push);
      renderDock();
    });
  }
  function exitJourney(silent) {
    st.prog = null; st.picking = null; st.seq = null; st.busy = false; compSeq++;
    renderDock();
    if (!silent) api.update(function () {}, true);
  }
  function polar() {
    var a = st.prog && st.prog.a; if (!a) return;
    var codes = pool().filter(function (c) { return c !== a; });
    if (typeof a === 'string') { assign('b', codes.reduce(function (m, c) { return D(a, c) > D(a, m) ? c : m; }, codes[0])); return; }
    send({ type: 'row', from: a }).then(function (r) {
      var best = null, bd = -1; C.order.forEach(function (c, i) { if (codes.indexOf(c) > -1 && r.row[i] > bd) { bd = r.row[i]; best = c; } });
      if (best) assign('b', best);
    });
  }

  /* ---------- dock ---------- */
  function slotHTML(slot) {
    var v = st.prog[slot], label = ui(slot === 'a' ? 'chSlotA' : 'chSlotB'), inner;
    if (!v) inner = '<span class="ch-slot-empty">' + esc(st.picking === slot ? '…' : ui('chEmpty')) + '</span>';
    else if (typeof v === 'string') {
      var p = photo(v);
      inner = '<img src="' + esc(p.thumb.src) + '" alt="" width="40" height="49"><span class="ch-slot-t"><span class="ch-slot-code">' + esc(v) + '</span>' + barHTML(v, 'ch-mini') + '</span>';
    } else inner = '<span class="ch-slot-sw" style="background:' + SW[v.swatch].hex + '"></span><span class="ch-slot-t"><span class="ch-slot-code">' + esc(swNum(v.swatch) + ' · ' + swName(v.swatch)) + '</span></span>';
    return '<div class="ch-slot' + (st.picking === slot ? ' is-picking' : '') + '"><p class="label">' + esc(label) + '</p>' +
      '<button type="button" class="ch-slot-b" data-dock="pick-' + slot + '" aria-pressed="' + (st.picking === slot) + '" aria-label="' + esc(label + ': ' + (v ? (typeof v === 'string' ? v : swName(v.swatch)) : ui('chEmpty')) + '. ' + ui('chChoose')) + '">' + inner + '</button></div>';
  }
  function renderDock() {
    if (!dock) return;
    if (!st.prog) { dock.hidden = true; dock.innerHTML = ''; renderStrip(); return; }
    var pr = st.prog, h = '<div class="ch-dock-in">';
    h += slotHTML('a');
    h += '<div class="ch-dock-mid"><p class="label">' + esc(ui('chSteps')) + '</p><div class="filters ch-seg" role="group" aria-label="' + esc(ui('chSteps')) + '">' +
      STEPS.map(function (n) { return '<button type="button" data-dock="steps" data-v="' + n + '" aria-pressed="' + (pr.steps === n) + '">' + n + '</button>'; }).join('') + '</div>' +
      '<p class="label">' + esc(ui('chPath')) + '</p><div class="filters ch-seg" role="group" aria-label="' + esc(ui('chPath')) + '">' +
      '<button type="button" data-dock="path" data-v="direct" aria-pressed="' + (pr.path === 'direct') + '">' + esc(ui('chDirect')) + '</button>' +
      '<button type="button" data-dock="path" data-v="chain" aria-pressed="' + (pr.path === 'chain') + '">' + esc(ui('chChain')) + '</button></div></div>';
    h += slotHTML('b');
    h += '<div class="ch-dock-end">';
    if (pr.a) h += '<button type="button" class="ae-btn ae-btn--sm" data-dock="polar">' + esc(ui('chPolar')) + '</button>';
    if (pr.a && pr.b) h += '<button type="button" class="ae-btn ae-btn--sm" data-dock="swap">⇄ ' + esc(ui('chSwap')) + '</button>';
    h += '<button type="button" class="ae-btn ae-btn--sm" data-dock="exit">✕ ' + esc(ui('chExit')) + '</button></div></div>';
    var status = st.busy ? ui('chTracing') + '…' : st.picking ? ui(st.picking === 'a' ? 'chPickA' : 'chPickB') : '';
    if (!st.busy && st.seq) {
      var tot = st.seq.deltas.reduce(function (a, b) { return a + b; }, 0);
      status = st.seq.cases.length + ' ' + ui('chSteps').toLowerCase() + ' · ΣΔD ' + fmt(tot) + ' · ' + ui(pr.path === 'direct' ? 'chDirect' : 'chChain') + ' · ' + st.seq.ms + ' ms';
      if (st.seq.capped) status += ' · ' + ui('chCapped').replace(/\{n\}/g, st.seq.cases.length);
    }
    h += '<p class="ae-cap ch-status" aria-live="polite">' + esc(status) + '</p>';
    dock.innerHTML = h; dock.hidden = false;
    dock.setAttribute('aria-label', ui('chJourneyOf'));
    renderStrip();
  }
  function dockClick(e) {
    var b = e.target.closest('[data-dock]'); if (!b) return;
    var k = b.dataset.dock, pr = st.prog;
    if (k === 'exit') exitJourney();
    else if (k === 'pick-a' || k === 'pick-b') { st.picking = st.picking === k.slice(-1) ? null : k.slice(-1); renderDock(); }
    else if (k === 'steps') { pr.steps = +b.dataset.v; renderDock(); if (pr.a && pr.b) compute(true); }
    else if (k === 'path') { pr.path = b.dataset.v; renderDock(); if (pr.a && pr.b) compute(true); }
    else if (k === 'polar') polar();
    else if (k === 'swap') { var a = pr.a; pr.a = pr.b; pr.b = a; renderDock(); compute(true); }
  }

  /* ---------- sequence track + ribbon ---------- */
  function seqTiles() {
    if (!st.seq) return null;
    return st.seq.cases.filter(function (c) { return typeof c === 'string'; }).map(function (c) { return api.byCode(c); }).filter(Boolean);
  }
  function card(slot) {
    if (!cards[slot]) {
      var el = document.createElement('div'); el.className = 'ch-card';
      el.innerHTML = '<div class="ch-card-sw"></div><p class="ar-case ae-cap"></p>'; cards[slot] = el;
    }
    return cards[slot];
  }
  function applyLayout() {
    var seq = !!st.seq;
    grid.classList.toggle('is-seq', seq);
    ['a', 'b'].forEach(function (slot) {
      var c = st.seq && st.seq.cases[slot === 'a' ? 0 : st.seq.cases.length - 1], el = cards[slot];
      if (seq && c && typeof c !== 'string') { el = card(slot); el.querySelector('.ch-card-sw').style.background = SW[c.swatch].hex; if (!el.parentNode) grid.appendChild(el); }
      else if (el && el.parentNode) el.remove();
    });
    if (seq && !ribbon.parentNode) grid.appendChild(ribbon);
    if (!seq && ribbon.parentNode) ribbon.remove();
    captions();
  }
  function captions() {
    var seqC = st.seq ? st.seq.cases : null, n = seqC ? seqC.length : 0;
    api.tiles().forEach(function (t) { var c = t.querySelector('.ar-case'); c.hidden = true; c.textContent = ''; });
    if (seqC) {
      seqC.forEach(function (c, i) {
        var el = typeof c === 'string' ? api.byCode(c) && api.byCode(c).querySelector('.ar-case') : cards[i === 0 ? 'a' : 'b'] && cards[i === 0 ? 'a' : 'b'].querySelector('.ar-case');
        if (!el) return;
        var role = i === 0 ? ' · ' + ui('chOrigin') : i === n - 1 ? ' · ' + ui('chDest') : '';
        var name = typeof c === 'string' ? c : swNum(c.swatch) + ' · ' + swName(c.swatch);
        el.innerHTML = '<span class="ar-case-n">' + esc(ui('chCase') + ' ' + (i < 9 ? '0' : '') + (i + 1) + '/' + (n < 10 ? '0' : '') + n + role) + '</span><span>' + esc(name) + '</span>' +
          (i ? '<span>ΔD ' + fmt(st.seq.deltas[i]) + '</span>' : '<span>&nbsp;</span>');
        el.hidden = false;
      });
    } else if (st.sort && Pc[st.sort]) {
      api.visibleTiles().forEach(function (t) {
        var c = t.querySelector('.ar-case'), d = Pc[t._p.code] ? D(st.sort, t._p.code) : null;
        c.textContent = t._p.code === st.sort ? ui('chRef') : 'D ' + fmt(d); c.hidden = false;
      });
    }
  }
  function afterOrder() {
    if (!st.seq) return;
    if (cards.a && cards.a.parentNode) cards.a.style.order = '0';
    if (cards.b && cards.b.parentNode) cards.b.style.order = '99999';
  }
  function offsetX(el) { var x = 0; while (el && el !== grid) { x += el.offsetLeft; el = el.offsetParent; } return x; }
  function drawRibbon() {
    if (!st.seq || !ribbon.parentNode) return;
    var cs = st.seq.cases, els = cs.map(function (c, i) {
      if (typeof c === 'string') { var t = api.byCode(c); return t && t.querySelector('.ar-ph'); }
      return cards[i === 0 ? 'a' : 'b'] && cards[i === 0 ? 'a' : 'b'].querySelector('.ch-card-sw');
    });
    if (els.some(function (e) { return !e; })) return;
    var centers = els.map(function (e) { return offsetX(e) + e.offsetWidth / 2; });
    var W = Math.max(grid.scrollWidth, grid.clientWidth), H = 96, dpr = Math.min(2, window.devicePixelRatio || 1);
    var cv = ribbon.querySelector('canvas');
    ribbon.style.width = W + 'px';
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + 'px'; cv.style.height = H + 'px';
    var g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    var plans = st.seq.plans, step = 2, x0 = centers[0], x1 = centers[centers.length - 1];
    for (var x = Math.floor(x0); x < x1; x += step) {
      var i = 0; while (i < centers.length - 2 && x >= centers[i + 1]) i++;
      var t = (x - centers[i]) / Math.max(1, centers[i + 1] - centers[i]); t = t * t * (3 - 2 * t);
      var pl = plans[i] || [], pts = [], tot = 0;
      for (var k = 0; k < pl.length; k++) { var e = pl[k]; pts.push([e[0] + (e[3] - e[0]) * t, e[1] + (e[4] - e[1]) * t, e[2] + (e[5] - e[2]) * t, e[6]]); tot += e[6]; }
      pts.sort(function (p, q) { return q[0] - p[0]; });   // light at the top, dark at the bottom
      var y = 0;
      for (k = 0; k < pts.length; k++) {
        var h = pts[k][3] / tot * H, rgb = labToRgb(pts[k][0], pts[k][1], pts[k][2]);
        g.fillStyle = 'rgb(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ')';
        g.fillRect(x, y, step + 0.5, h + 0.5); y += h;
      }
    }
    var line = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#fff';
    g.fillStyle = line; centers.forEach(function (cx) { g.fillRect(Math.round(cx) - 0.5, 0, 1, 6); g.fillRect(Math.round(cx) - 0.5, H - 6, 1, 6); });
    ribbon.querySelector('.label').textContent = ui('chRibbon');
    ribbon.querySelector('.label').style.left = x0 + 'px';
  }
  var rafR = 0;
  function afterLayout() {
    captions();
    if (st.seq) { cancelAnimationFrame(rafR); rafR = requestAnimationFrame(drawRibbon); }
  }

  /* ---------- crumbs ---------- */
  function crumbs() {
    var h = '';
    if (st.sw.length) {
      h += st.sw.map(function (id) {
        return '<button type="button" class="ar-crumb ch-crumb" data-ch-rm="' + id + '" aria-label="' + esc(ui('remove') + ui('chColour') + ' ' + swName(id)) + '"><span class="ar-crumb-k">' + esc(ui('chColour') + ' · ' + modeLabel(st.mode)) + '</span> <span class="ch-chip" style="background:' + SW[id].hex + '" aria-hidden="true"></span> ' + esc(swName(id)) + ' <span aria-hidden="true">✕</span></button>';
      }).join('');
    }
    if (st.sort && Pc[st.sort]) h += '<button type="button" class="ar-crumb" data-ch-rm-sort aria-label="' + esc(ui('remove') + ui('chSortedBy') + ' ' + st.sort) + '"><span class="ar-crumb-k">' + esc(ui('chSortedBy')) + '</span> ' + esc(st.sort) + ' <span aria-hidden="true">✕</span></button>';
    return h;
  }
  function barClick(e) {
    var r = e.target.closest('[data-ch-rm]');
    if (r) { var id = r.dataset.chRm; api.update(function () { st.sw = st.sw.filter(function (x) { return x !== id; }); }, true); return true; }
    if (e.target.closest('[data-ch-rm-sort]')) { api.update(function () { st.sort = null; }, true); return true; }
    return false;
  }

  /* ---------- URL ---------- */
  function readParams() {
    var q = new URLSearchParams(location.search);
    st.sw = q.getAll('swatch').filter(function (s) { return SW[s]; }).slice(0, 3);
    st.mode = MODES.indexOf(q.get('mode')) > -1 ? q.get('mode') : 'all';
    st.sort = Pc[q.get('sort')] ? q.get('sort') : null;
    var pr = q.get('progression');
    if (pr) {
      var parts = pr.split('..'), steps = +q.get('steps'), path = q.get('path');
      var next = { a: parseSlot(parts[0]), b: parseSlot(parts[1]), steps: STEPS.indexOf(steps) > -1 ? steps : 8, path: path === 'direct' ? 'direct' : 'chain' };
      var same = st.prog && st.seq && slotKey(st.prog.a || '') === slotKey(next.a || '') && slotKey(st.prog.b || '') === slotKey(next.b || '') && st.prog.steps === next.steps && st.prog.path === next.path;
      if (!same) {
        st.prog = next; st.seq = null; st.picking = !next.a ? 'a' : !next.b ? 'b' : null;
        if (next.a && next.b) setTimeout(function () { compute(false); }, 0);
      }
    } else if (st.prog && (st.prog.a || st.seq)) { st.prog = null; st.seq = null; st.picking = null; }
    renderDock();
  }
  function writeParams(q) {
    ['swatch', 'mode', 'sort', 'progression', 'steps', 'path'].forEach(function (k) { q.delete(k); });
    st.sw.forEach(function (s) { q.append('swatch', s); });
    if (st.sw.length && st.mode !== 'all') q.set('mode', st.mode);
    if (st.sort) q.set('sort', st.sort);
    if (st.prog && st.prog.a) {
      q.set('progression', slotKey(st.prog.a) + (st.prog.b ? '..' + slotKey(st.prog.b) : ''));
      q.set('steps', st.prog.steps); q.set('path', st.prog.path);
    }
  }

  /* ---------- register ---------- */
  AR.register({
    load: function () {
      return fetch('data/chroma.json').then(function (r) { if (!r.ok) throw new Error('chroma ' + r.status); return r.json(); }).then(function (c) {
        C = c; C.swatches.forEach(function (s) { SW[s.id] = s; swOrder.push(s.id); });
        Pc = C.photos; C.order.forEach(function (code, i) { idx[code] = i; });
        return startWorker();
      }).catch(function (e) { C = null; if (window.console) console.warn('colour layer off:', e); });
    },
    init: function (a) {
      api = a; if (!C) { AR.register(null); return; }
      grid = api.grid;
      dock = document.getElementById('ch-dock');
      ribbon = document.createElement('div'); ribbon.className = 'ch-ribbon'; ribbon.setAttribute('aria-hidden', 'true');
      ribbon.innerHTML = '<p class="label"></p><canvas></canvas>';
      buildStrip();
      dock.addEventListener('click', dockClick);
      document.addEventListener('pointermove', function (e) {
        var s = e.target.closest && e.target.closest('.ch-bar span'); if (s) loupe(s.parentNode, +s.dataset.i);
      }, { passive: true });
      document.addEventListener('keydown', function (e) {
        var bar = e.target.closest && e.target.closest('.ch-bar'); if (!bar) return;
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); var n = bar.children.length, i = (bar._i == null ? -1 : bar._i) + (e.key === 'ArrowRight' ? 1 : -1); loupe(bar, (i + n) % n); }
      });
      document.addEventListener('focusin', function (e) { if (e.target.classList && e.target.classList.contains('ch-bar') && e.target._i == null) loupe(e.target, 0); });
      if (window.ResizeObserver) new ResizeObserver(function () { if (st.seq) afterLayout(); }).observe(grid);
    },
    readParams: function () { if (on()) readParams(); },
    writeParams: function (q) { if (on()) writeParams(q); },
    match: function (p) { return !on() || !st.sw.length || swMatch(p, st.sw); },
    force: function (p) { if (!on() || !st.seq) return undefined; return st.seq.cases.indexOf(p.code) > -1; },
    order: function () { if (!on()) return undefined; return seqTiles() || (st.sort ? sortOrder() : undefined); },
    mode: function () { return on() && st.seq ? 'seq' : 'wall'; },
    drawer: function (p) { return on() ? drawer(p) : undefined; },
    drawerClick: function (e) { return on() ? drawerClick(e) : false; },
    crumbs: function () { return on() ? crumbs() : ''; },
    barClick: function (e) { return on() ? barClick(e) : false; },
    clear: function () { if (!on()) return; st.sw = []; st.mode = 'all'; st.sort = null; if (st.prog) exitJourney(true); },
    onFilters: function () { if (st.seq) exitJourney(true); },
    tileClick: function (t) { if (!on() || !st.picking) return false; assign(st.picking, t._p.code); return true; },
    applyLayout: function () { if (on()) applyLayout(); },
    afterOrder: function () { if (on()) afterOrder(); },
    afterLayout: function () { if (on()) afterLayout(); },
    afterBar: function () { if (on()) renderStrip(); },
    onLang: function () { if (on()) { renderDock(); afterLayout(); } },
    escape: function () { if (on() && st.picking) { st.picking = null; renderDock(); } },
    keepScroll: function () { return !!(st.seq || st.prog); }
  });
})();
