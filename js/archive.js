/* ÆRIEL archive wall.
   archive.json       → published by ÆRIEL Archive Studio straight to the R2 bucket behind MEDIA (with the
                        images it points at). There is deliberately no copy in this repo: a copy would outlive takedowns
   data/taxonomy.i18n.json → UI labels and enum values in en / es / pt

   Grid: CSS Grid, one tile per print. The serif "i" opens a record drawer. The open print moves to
   column 1 of its row (CSS `order`), its tile spans the row, the drawer fills the remaining columns and
   is height-locked to the print (ResizeObserver → --ph). Every change runs through flip(): positions
   are measured before and after, then inverted and played back with WAAPI transforms.
   Filters live in the query string (?person=…&city=…), so views are shareable and back/forward work. */
(function () {
  'use strict';
  var root = document.documentElement;
  var grid = document.getElementById('ar-grid');
  if (!grid) return;
  var still = window.matchMedia('(prefers-reduced-motion: reduce)');
  var EASE = 'cubic-bezier(0.22, 1, 0.36, 1)', DUR = 620;

  var D, TX, tiles = [], byCode = {}, facets = new Map(), labels = {}, filters = [], openTile = null, ro = null;

  /* ---------- i18n ---------- */
  function lang() { return ['en', 'es', 'pt'].indexOf(root.lang) > -1 ? root.lang : 'en'; }
  function ui(k) { var e = TX.ui[k]; return e ? (e[lang()] || e.en) : k; }
  function tv(v) { if (v == null) return ''; var e = TX.values[v]; return e ? (e[lang()] || e.en || v) : v; }
  function fl(k) { var e = TX.filters[k]; return e ? (e[lang()] || e.en) : k; }
  function tr(o) { if (!o) return null; return o[lang()] || o[o.src] || o.en || o.es || o.pt || null; }
  function slug(s) {
    return String(s == null ? '' : s).replace(/Æ/g, 'AE').replace(/æ/g, 'ae').normalize('NFKD')
      .replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'x';
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function inline(s) {
    return esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/(^|[\s(“"])[*_](?!\s)(.+?)[*_](?=[\s.,;:)”"]|$)/g, '$1<em>$2</em>');
  }
  /* tiny markdown: paragraphs, ## headings, * lists, --- rules; everything escaped first */
  function md(text) {
    return String(text).trim().split(/\n{2,}/).map(function (b) {
      b = b.trim();
      if (/^-{3,}$/.test(b)) return '';
      if (/^#{1,6}\s/.test(b)) return '<p class="label ar-mdh">' + inline(b.replace(/^#+\s*/, '')) + '</p>';
      if (/^[*-]\s/m.test(b) && b.split('\n').every(function (l) { return /^[*-]\s/.test(l.trim()); }))
        return '<ul>' + b.split('\n').map(function (l) { return '<li>' + inline(l.trim().replace(/^[*-]\s+/, '')) + '</li>'; }).join('') + '</ul>';
      return '<p>' + inline(b).replace(/\n/g, '<br>') + '</p>';
    }).join('');
  }
  function firstPara(text) { var p = String(text).trim().split(/\n{2,}/)[0]; return p; }

  /* ---------- entity helpers ---------- */
  function person(k) { return D.people[k] || { name: k }; }
  function org(k) { return D.orgs[k] || { name: k }; }
  function space(k) { return D.spaces[k] || null; }
  function spaceName(s) { if (!s) return ''; return s.private ? ui('privateHome') + (s.hood ? ' · ' + s.hood : '') : s.name; }
  function ancestors(k, out) { var o = D.orgs[k]; if (o && o.parent && out.indexOf(o.parent) < 0) { out.push(o.parent); ancestors(o.parent, out); } return out; }
  function photoOrgs(p) {
    /* houses and organizations reach a photo through the people in it, or directly */
    var houses = [], others = [];
    (p.people || []).forEach(function (x) {
      var pp = person(x.p);
      (pp.houses || []).forEach(function (h) { houses.push({ org: h.org, scene: h.scene, titles: h.titles, via: x.p }); });
      (pp.orgs || []).forEach(function (o) { (org(o.org).isHouse ? houses : others).push({ org: o.org, role: o.role, via: x.p }); });
    });
    (p.orgs || []).forEach(function (o) { (org(o.org).isHouse ? houses : others).push({ org: o.org, note: o.note }); });
    return { houses: houses, others: others };
  }

  /* facets: filter key → list of slugs a photo matches; labels[key][slug] → display function */
  function addLabel(k, s, fn) { (labels[k] = labels[k] || {})[s] = fn; }
  function enumFacet(f, k, v) { if (v == null || v === '') return; var s = slug(v); (f[k] = f[k] || []).push(s); addLabel(k, s, function () { return tv(v); }); }
  function buildFacets(p) {
    var f = {};
    (p.people || []).forEach(function (x) {
      (f.person = f.person || []).push(x.p); addLabel('person', x.p, function () { return person(x.p).name; });
      enumFacet(f, 'role', x.role);
    });
    var po = photoOrgs(p);
    po.houses.forEach(function (h) {
      [h.org].concat(ancestors(h.org, [])).forEach(function (k) { (f.house = f.house || []).push(k); addLabel('house', k, function () { return org(k).name; }); });
    });
    po.others.forEach(function (o) {
      [o.org].concat(ancestors(o.org, [])).forEach(function (k) { (f.org = f.org || []).push(k); addLabel('org', k, function () { return org(k).name; }); });
    });
    if (p.event) {
      var e = D.events[p.event];
      f.event = [p.event]; addLabel('event', p.event, function () { return e.title; });
      if (e.series) { f.series = [e.series]; addLabel('series', e.series, function () { return D.series[e.series].name; }); }
      enumFacet(f, 'etype', e.type);
      (e.sonic || []).forEach(function (s) { enumFacet(f, 'sound', s); });
    }
    if (p.space) { var s = space(p.space); f.space = [p.space]; addLabel('space', p.space, function () { return spaceName(s); }); if (s && s.type) enumFacet(f, 'stype', s.type); }
    enumFacet(f, 'hood', p.hood); enumFacet(f, 'city', p.city); enumFacet(f, 'country', p.country);
    if (p.year) { f.year = [String(p.year)]; addLabel('year', String(p.year), function () { return String(p.year); }); }
    if (p.date && p.precision === 'Exact') { f.date = [p.date]; addLabel('date', p.date, function () { return tr(p.dateText) || p.date; }); }
    enumFacet(f, 'medium', p.medium); enumFacet(f, 'camera', p.camera); enumFacet(f, 'stock', p.stock);
    enumFacet(f, 'frame', p.frame); enumFacet(f, 'color', p.color); enumFacet(f, 'light', p.light);
    enumFacet(f, 'time', p.time); enumFacet(f, 'process', p.process);
    (p.themes || []).forEach(function (v) { enumFacet(f, 'theme', v); });
    (p.body || []).forEach(function (v) { enumFacet(f, 'body', v); });
    return f;
  }
  function matches(p) {
    var f = facets.get(p);
    return filters.every(function (x) { return (f[x[0]] || []).indexOf(x[1]) > -1; });
  }

  /* ---------- tiles ---------- */
  function names(p) { return (p.people || []).map(function (x) { return person(x.p).name; }); }
  function alt(p) {
    var n = names(p), s = space(p.space), where = s ? spaceName(s) : '', place = [where, p.city].filter(Boolean);
    if (place.length === 2 && place[0] === place[1]) place.pop();
    var t = n.length ? ui('photoOf') + listJoin(n) : ui('polaroid');
    if (place.length) t += (n.length ? ui('at') : ', ') + place.join(', ');
    if (p.year) t += ', ' + p.year;
    return t;
  }
  function listJoin(a) { if (a.length < 2) return a.join(''); var and = { en: ' and ', es: ' y ', pt: ' e ' }[lang()]; return a.slice(0, -1).join(', ') + and + a[a.length - 1]; }

  function makeTile(p, i) {
    var t = document.createElement('article');
    t.className = 'ar-tile'; t.dataset.code = p.code; t.style.setProperty('--ar', p.ar);
    if (p.border) t.style.setProperty('--border', p.border);
    t.innerHTML =
      '<div class="ar-ph"><div class="ar-pull">' +
      '<button class="ar-open" type="button"><img class="ar-img" src="' + esc(p.thumb.src) + '" srcset="' + esc(p.thumb.src) + ' ' + p.thumb.w + 'w, ' + esc(p.img.src) + ' ' + p.img.w + 'w" ' +
      'sizes="(min-width:1100px) 25vw, (min-width:720px) 33vw, (min-width:400px) 50vw, 100vw" width="' + p.thumb.w + '" height="' + p.thumb.h + '" alt="" loading="' + (i < 8 ? 'eager' : 'lazy') + '" decoding="async"></button>' +
      '<button class="ar-i" type="button" aria-expanded="false" aria-controls="ar-d-' + p.code + '"><span aria-hidden="true">i</span></button>' +
      '</div><p class="ar-tcap"></p></div>' +
      '<div class="ar-drawer" id="ar-d-' + p.code + '" role="region" tabindex="-1" hidden></div>';
    t._p = p;
    t.querySelector('.ar-i').addEventListener('click', function () { toggle(t); });
    t.querySelector('.ar-open').addEventListener('click', function () { openViewer(t); });
    t.querySelector('.ar-drawer').addEventListener('click', onDrawerClick);
    return t;
  }
  /* Under each print: who is in it, and the event or year. */
  function tileCaption(p) {
    var n = names(p), e = p.event && D.events[p.event];
    return (n.length ? '<b>' + esc(listJoin(n)) + '</b>' : '') + '<span>' + esc(e ? e.title : (p.year || '')) + '</span>';
  }
  function labelTile(t) {
    var a = alt(t._p);
    t.querySelector('.ar-tcap').innerHTML = tileCaption(t._p);
    t.querySelector('.ar-img').alt = a;
    t.querySelector('.ar-open').setAttribute('aria-label', ui('open') + a);
    t.querySelector('.ar-i').setAttribute('aria-label', (t === openTile ? ui('closeInfo') : ui('info')) + ' · ' + t._p.code);
    t.querySelector('.ar-drawer').setAttribute('aria-label', ui('info') + ' · ' + t._p.code);
  }

  /* ---------- drawer ---------- */
  function tag(k, v, text, cls) {
    return '<button type="button" class="' + (cls || 'ar-tag') + '" data-k="' + esc(k) + '" data-v="' + esc(v) + '" aria-label="' + esc(ui('filterOn') + text) + '">' + esc(text) + '</button>';
  }
  function etag(k, v) { return v == null || v === '' ? '' : tag(k, slug(v), tv(v)); }
  /* Custom fields published with a record: { "Field": ["short value" | {src,en,es,pt}] }. Long texts arrive translated. */
  function attrVal(v) { return typeof v === 'string' ? v : tr(v); }
  function attrsHTML(attrs) {
    return Object.keys(attrs || {}).map(function (k) {
      var vals = (attrs[k] || []).map(attrVal).filter(Boolean);
      if (!vals.length) return '';
      var long = vals.some(function (v) { return v.length > 60; });
      return '<div class="ar-f ar-f--wide"><p class="label">' + esc(k) + '</p>' + (long ? '<div class="ar-cap">' + vals.map(md).join('') + '</div>' :
        '<div class="ar-vals"><span class="ar-plain">' + esc(vals.join(', ')) + '</span></div>') + '</div>';
    }).join('');
  }
  /* Every profile and website a person has, grouped by platform. */
  var PLATFORM = { instagram: 'Instagram', tiktok: 'TikTok', x: 'X', twitter: 'X', youtube: 'YouTube', soundcloud: 'SoundCloud', bandcamp: 'Bandcamp',
    spotify: 'Spotify', facebook: 'Facebook', threads: 'Threads', bluesky: 'Bluesky', mixcloud: 'Mixcloud', vimeo: 'Vimeo', linkedin: 'LinkedIn', ra: 'Resident Advisor' };
  var ORDER = ['instagram', 'tiktok', 'x', 'twitter', 'threads', 'bluesky', 'youtube', 'soundcloud', 'mixcloud', 'bandcamp', 'spotify', 'website'];
  function handle(platform, url) {
    try { var u = new URL(url); } catch (e) { return url; }
    var path = u.pathname.replace(/\/+$/, ''), last = decodeURIComponent(path.split('/').pop() || '');
    if (platform === 'website' || !last) return u.hostname.replace(/^www\./, '') + (platform === 'website' && path ? path : '');
    return /^(instagram|tiktok|x|twitter|threads)$/.test(platform) ? '@' + last.replace(/^@/, '') : last;
  }
  function linksHTML(links) {
    var keys = Object.keys(links || {}).sort(function (a, b) {
      var i = ORDER.indexOf(a), j = ORDER.indexOf(b); return (i < 0 ? 99 : i) - (j < 0 ? 99 : j) || a.localeCompare(b);
    });
    var out = [];
    keys.forEach(function (k) {
      (links[k] || []).forEach(function (url) {
        if (!/^https:\/\//i.test(url)) return;
        var name = k === 'website' ? ui('website') : (PLATFORM[k] || k.charAt(0).toUpperCase() + k.slice(1));
        out.push('<a class="ar-out" href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(name) + ' ' + esc(handle(k, url)) + ' ↗</a>');
      });
    });
    return out.length ? '<div class="ar-links">' + out.join('') + '</div>' : '';
  }
  function field(label, html, wide) { return html ? '<div class="ar-f' + (wide ? ' ar-f--wide' : '') + '"><p class="label">' + esc(label) + '</p><div class="ar-vals">' + html + '</div></div>' : ''; }

  /* Links that open a person, house, event or space: bold names, not boxed tags. */
  function ent(k, v, text, cls) {
    return '<button type="button" class="ar-ent' + (cls ? ' ' + cls : '') + '" data-k="' + esc(k) + '" data-v="' + esc(v) + '" aria-label="' + esc(ui('filterOn') + text) + '">' + esc(text) + '</button>';
  }
  function houseKind(k) { return D.orgs[k] && D.orgs[k].isHouse ? 'house' : 'org'; }
  function sceneName(s) { return ui(s === 'kiki' ? 'sceneKiki' : s === 'main' ? 'sceneMain' : s) || s; }
  /* Ballroom titles are part of a person's name in the scene: they get their own badges, never small print. */
  function titlesHTML(titles, small) {
    return titles && titles.length ? '<span class="ar-titles' + (small ? ' ar-titles--s' : '') + '">' + titles.map(function (t) { return '<span class="ar-title">' + esc(t) + '</span>'; }).join('') + '</span>' : '';
  }
  /* One row per house (house, scene, titles), then one row per scene where the person walks 007, then collectives. */
  function ballroomRows(pp, small) {
    var rows = [];
    (pp.houses || []).forEach(function (x) {
      rows.push('<div class="ar-hrow">' + ent('house', x.org, org(x.org).name, 'ar-ent--house') +
        (x.scene ? '<span class="ar-scene">' + esc(sceneName(x.scene)) + '</span>' : '') + titlesHTML(x.titles, small) + '</div>');
    });
    (pp.free || []).forEach(function (s) {
      rows.push('<div class="ar-hrow ar-hrow--free"><span class="ar-free">' + esc(ui('freeAgent')) + '</span><span class="ar-scene">' + esc(sceneName(s)) + '</span></div>');
    });
    (pp.orgs || []).forEach(function (x) {
      rows.push('<div class="ar-hrow">' + ent(houseKind(x.org), x.org, org(x.org).name, 'ar-ent--house') +
        (x.role ? '<span class="ar-scene">' + esc(tv(x.role)) + '</span>' : '') + '</div>');
    });
    return rows.join('');
  }
  function fact(label, html) { return html ? '<div class="ar-fact"><dt>' + esc(label) + '</dt><dd>' + html + '</dd></div>' : ''; }
  function plain(v) { return v == null || v === '' ? '' : '<span>' + esc(tv(v)) + '</span>'; }

  /* The record reads top to bottom as: who, the caption, the photographer's words, where and when, the scene,
     then film and colour folded away. Every name, place and value still filters the wall. */
  function drawerHTML(p) {
    var h = '', e = p.event ? D.events[p.event] : null, s = p.space ? space(p.space) : null;
    h += '<div class="ar-dhead"><p class="ar-code">' + esc(p.code) + '</p>' +
      '<a class="ar-plink" href="?photo=' + encodeURIComponent(p.code) + '" data-copy="' + esc(p.code) + '">' + esc(ui('photoLink')) + '</a></div>';
    if (p.people) {
      h += '<div class="ar-who">' + p.people.map(function (x) {
        var pp = person(x.p), sub = [];
        if (x.persona) sub.push(ui('as') + ' ' + x.persona);
        if (x.look) sub.push(ui('look') + ': ' + x.look);
        return '<div class="ar-person"><div class="ar-pname">' + ent('person', x.p, pp.name, 'ar-ent--name') +
          (x.role && p.people.length > 1 ? tag('role', slug(x.role), tv(x.role)) : '') + '</div>' +
          (sub.length ? '<p class="ar-sub">' + esc(sub.join(' · ')) + '</p>' : '') +
          '<div class="ar-ball ar-ball--s">' + ballroomRows(pp, true) + '</div></div>';
      }).join('') + '</div>';
    }
    var cap = tr(p.caption); if (cap) h += '<div class="ar-cap">' + md(cap) + '</div>';
    var note = tr(p.note); if (note) h += '<div class="ar-note"><p class="label">' + esc(ui('note')) + '</p>' + md(note) + '</div>';
    var intent = tr(p.intent); if (intent) h += '<div class="ar-note"><p class="label">' + esc(ui('intent')) + '</p>' + md(intent) + '</div>';

    // where and when: one line, every part a link
    var line = [];
    if (p.date && p.precision === 'Exact') line.push(ent('date', p.date, tr(p.dateText)));
    else if (p.dateText) line.push('<span>' + esc(tr(p.dateText)) + '</span>');
    if (e) line.push(ent('event', p.event, e.title));
    if (s) line.push(ent('space', p.space, spaceName(s)));
    if (p.hood) line.push(ent('hood', slug(p.hood), tv(p.hood)));
    if (p.city && p.city !== p.hood) line.push(ent('city', slug(p.city), tv(p.city)));
    if (p.country) line.push(ent('country', slug(p.country), tv(p.country)));
    if (line.length) h += '<div class="ar-f"><p class="label">' + esc(ui('whereWhen')) + '</p><p class="ar-line">' + line.join('<span class="ar-dot" aria-hidden="true">·</span>') + '</p></div>';

    // the scene: event kind, sound, series, collectives named on the photo, themes
    var chips = [];
    if (e) { chips.push(etag('etype', e.type)); (e.sonic || []).forEach(function (v) { chips.push(etag('sound', v)); }); }
    if (s && s.type) chips.push(etag('stype', s.type));
    var f = '';
    if (e && e.series) f += field(ui('series'), ent('series', e.series, D.series[e.series].name));
    f += field(ui('collectives'), (p.orgs || []).map(function (o) { return ent(houseKind(o.org), o.org, org(o.org).name) + (o.note ? '<span class="ar-sub">' + esc(o.note) + '</span>' : ''); }).join(''));
    f += field(ui('scene'), chips.join(''));
    f += field(ui('themes'), (p.themes || []).map(function (v) { return etag('theme', v); }).join(''));
    f += field(ui('body'), (p.body || []).map(function (v) { return etag('body', v); }).join(''));
    if (p.warnings) f += field(ui('content'), '<span class="ar-plain">' + esc(p.warnings.map(tv).join(', ')) + '</span>');
    if (f) h += '<div class="ar-fields">' + f + '</div>';
    h += attrsHTML(p.attrs);

    // film and colour: everything about the object, folded
    var d = '';
    d += fact(ui('medium'), etag('medium', p.medium));
    d += fact(ui('camera'), etag('camera', p.camera));
    d += fact(ui('filmStock'), etag('stock', p.stock));
    d += fact(ui('frame'), etag('frame', p.frame));
    d += fact(ui('color'), etag('color', p.color));
    d += fact(ui('lighting'), etag('light', p.light));
    d += fact(ui('time'), etag('time', p.time));
    d += fact(ui('process'), etag('process', p.process));
    d += fact(ui('filmProcess'), plain(p.filmProcess));
    d += fact(ui('roll'), p.roll ? '<span>' + esc(p.roll) + '</span>' : '');
    d += fact(ui('frameNo'), p.frameNo ? '<span>' + esc(p.frameNo) + '</span>' : '');
    d += fact(ui('alter'), (p.alter || []).map(function (v) { return '<span>' + esc(tv(v)) + '</span>'; }).join(', '));
    d += fact(ui('sound'), p.sound && /^https:\/\//i.test(p.sound) ? '<a class="ar-out" href="' + esc(p.sound) + '" target="_blank" rel="noopener">' + esc(handle('website', p.sound)) + ' ↗</a>' : '');
    var c = colourBlock(p);
    if (d || c) h += '<details class="ar-more-info"><summary>' + esc(ui('filmColour')) + '</summary>' + (d ? '<dl class="ar-facts">' + d + '</dl>' : '') + c + '</details>';
    h += '<p class="ar-rights">© ' + esc(p.credit || 'ÆRIEL') + ' · ' + esc(tv(p.license)) + '</p>';
    return h;
  }
  /* The Studio's colour profile: named colours with their share, atmosphere and accent colours with the curatorial
     swatches they fall under, the 128-colour strip, the dominant colours and the frame border. */
  function colourBlock(p) {
    var HEX = /^#[0-9a-f]{6}$/i, l = lang();
    function sw(hex, title) { return HEX.test(hex || '') ? '<span class="ar-sw" style="background:' + hex + '" title="' + esc(title || hex) + '"></span>' : ''; }
    function swNames(ids) {
      var seen = {};
      return (ids || []).map(function (i) { var s = (TX.swatches || {})[String(i)]; return s ? (s[l] || s.en) : null; })
        .filter(function (n) { if (!n || seen[n]) return false; seen[n] = 1; return true; }).join(' · ');
    }
    function row(label, cols, ids) {
      if (!cols || !cols.length) return '';
      return '<div class="ar-crow"><span class="ar-clab">' + esc(ui(label)) + '</span><span class="ar-sws">' +
        cols.map(function (c) { return sw(c[0], c[0] + ' · ' + Math.round(c[1] * 1000) / 10 + '%'); }).join('') + '</span>' +
        (swNames(ids) ? '<span class="ar-cnames">' + esc(swNames(ids)) + '</span>' : '') + '</div>';
    }
    var h = '';
    if (p.named && p.named.length) h += '<div class="ar-chips">' + p.named.map(function (c) {
      var n = (TX.colorNames || {})[c[0]] || {};
      return '<span class="ar-cchip"><i style="background:' + (HEX.test(n.hex || '') ? n.hex : '#888') + '"></i>' + esc(n[l] || n.en || c[0]) + ' ' + Math.round(c[1] * 100) + '%</span>';
    }).join('') + '</div>';
    if ((p.atm && p.atm.length) || (p.acc && p.acc.length)) h += '<div class="ar-cbox">' + row('atmosphere', p.atm, p.swAtm) + row('accent', p.acc, p.swAcc) + '</div>';
    if (p.palette && p.palette.length) h += '<p class="ar-sub">' + esc(ui('palette')) + '</p><div class="ar-pal" role="img" aria-label="' + esc(ui('palette')) + '">' +
      p.palette.map(function (c) { return '<span style="background:' + esc(c[0]) + ';flex-grow:' + (c[1] == null ? 1 : Math.max(c[1], 0.5)) + '" title="' + esc(c[0]) + '"></span>'; }).join('') + '</div>';
    if (p.dominant && p.dominant.length) h += '<p class="ar-sub">' + esc(ui('dominant')) + '</p><div class="ar-dom">' + p.dominant.map(function (c) { return sw(c); }).join('') + '</div>';
    if (HEX.test(p.border || '')) h += '<p class="ar-sub ar-border">' + sw(p.border) + esc(ui('frameColor')) + ' ' + esc(p.border.toUpperCase()) + '</p>';
    return h ? '<div class="ar-f ar-f--wide ar-colour"><p class="label">' + esc(ui('colours')) + '</p>' + h + '</div>' : '';
  }
  function onDrawerClick(ev) {
    var c = ev.target.closest('[data-copy]');
    if (c) {
      var url = location.origin + location.pathname + '?photo=' + encodeURIComponent(c.dataset.copy);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        ev.preventDefault();
        navigator.clipboard.writeText(url).then(function () { c.textContent = ui('linkCopied'); setTimeout(function () { c.textContent = ui('photoLink'); }, 2000); }, function () { location.href = url; });
      }
      return;
    }
    var b = ev.target.closest('[data-k]');
    if (!b) return;
    setFilters([[b.dataset.k, b.dataset.v]], true);
  }

  /* ---------- layout: order, open state, height lock ---------- */
  function cols() { return getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length || 1; }
  function visibleTiles() { return tiles.filter(function (t) { return !t.hidden; }); }
  function applyOrder() {
    var n = cols(), vis = visibleTiles();
    grid.dataset.cols = n;
    vis.forEach(function (t, i) { t.style.order = String(i * 2); });
    if (openTile && !openTile.hidden) {
      var i = vis.indexOf(openTile), rowStart = Math.floor(i / n) * n;
      openTile.style.order = String(rowStart * 2 - 1);   // lands in column 1 of its own row
    }
  }
  function lockHeight() {
    if (!openTile) return;
    var img = openTile.querySelector('.ar-img');
    openTile.style.setProperty('--ph', img.getBoundingClientRect().height + 'px');
  }
  function watch(t) {
    if (ro) ro.disconnect();
    if (!t || !window.ResizeObserver) return;
    ro = new ResizeObserver(lockHeight);
    ro.observe(t.querySelector('.ar-img'));
  }

  /* ---------- FLIP ---------- */
  function motion() { return !still.matches && !!Element.prototype.animate; }
  function rects() { var m = new Map(); visibleTiles().forEach(function (t) { m.set(t, t.querySelector('.ar-ph').getBoundingClientRect()); }); return m; }
  function play(first, opened) {
    if (!motion()) return;
    var k = 0;
    visibleTiles().forEach(function (t) {
      var ph = t.querySelector('.ar-ph'), last = ph.getBoundingClientRect(), f = first.get(t);
      if (!f) {   // entering: settle in from slightly behind the wall
        ph.animate([{ transform: 'perspective(1200px) translateZ(-120px) rotateY(-18deg)', opacity: 0 }, { transform: 'none', opacity: 1 }],
          { duration: 480, delay: Math.min(k++ * 24, 360), easing: EASE, fill: 'backwards' });
        return;
      }
      var dx = f.left - last.left, dy = f.top - last.top, sx = f.width / last.width, sy = f.height / last.height;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(sx - 1) < 0.005) return;
      var from = 'translate(' + dx + 'px,' + dy + 'px) scale(' + sx + ',' + sy + ')';
      var frames = [{ transform: from }, { transform: 'none' }];
      if (t === opened) {   // the opened print glides with a slight turn, as if lifted and set down
        var turn = dx > 0 ? 7 : (dx < 0 ? -4 : 0);
        frames = [
          { transform: 'perspective(1200px) ' + from + ' translateZ(0px) rotateY(0deg)' },
          { transform: 'perspective(1200px) translate(' + dx * 0.4 + 'px,' + dy * 0.4 + 'px) scale(' + (1 + (sx - 1) * 0.4) + ',' + (1 + (sy - 1) * 0.4) + ') translateZ(28px) rotateY(' + turn + 'deg)', offset: 0.5 },
          { transform: 'perspective(1200px) translate(0px,0px) scale(1,1) translateZ(0px) rotateY(0deg)' }];
      }
      ph.animate(frames, { duration: DUR, easing: EASE });
    });
  }
  function unfold(t) {
    if (!motion()) return;
    var d = t.querySelector('.ar-drawer'), stacked = cols() <= 2;
    d.style.transformOrigin = stacked ? '50% 0' : '0 50%';
    d.animate([
      { opacity: 0, transform: stacked ? 'perspective(1200px) rotateX(-10deg) translateY(-12px)' : 'perspective(1200px) rotateY(-14deg) translateX(-18px)', clipPath: stacked ? 'inset(0 0 100% 0)' : 'inset(0 100% 0 0)' },
      { opacity: 1, transform: 'none', clipPath: 'inset(0 0 0 0)' }
    ], { duration: 560, delay: 140, easing: EASE, fill: 'backwards' });
  }
  function fold(t) {
    if (!motion() || !t) return Promise.resolve();
    var d = t.querySelector('.ar-drawer');
    return d.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'perspective(1200px) rotateY(-8deg) translateX(-10px)' }],
      { duration: 180, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' }).finished.catch(function () {});
  }

  /* ---------- open / close ---------- */
  function setOpen(t) {
    if (openTile) {
      var prev = openTile;
      prev.classList.remove('is-open');
      prev.querySelector('.ar-drawer').hidden = true;
      prev.querySelector('.ar-drawer').getAnimations && prev.querySelector('.ar-drawer').getAnimations().forEach(function (a) { a.cancel(); });
      prev.querySelector('.ar-i').setAttribute('aria-expanded', 'false');
      prev.style.removeProperty('--ph');
      openTile = null; labelTile(prev);
    }
    if (t) {
      openTile = t;
      var d = t.querySelector('.ar-drawer');
      d.innerHTML = drawerHTML(t._p); d.hidden = false; d.scrollTop = 0;
      t.classList.add('is-open');
      t.querySelector('.ar-i').setAttribute('aria-expanded', 'true');
      labelTile(t);
    }
    applyOrder(); lockHeight(); watch(t);
    pullReset();
    photoParam(t ? t._p.code : null);
  }
  /* ?photo=CODE opens that print's record, so a record can be sent as a link. */
  function photoParam(code) {
    var q = new URLSearchParams(location.search);
    if ((q.get('photo') || null) === code) return;
    if (code) q.set('photo', code); else q.delete('photo');
    var s = q.toString();
    history.replaceState(history.state, '', location.pathname + (s ? '?' + s : '') + location.hash);
  }
  var seq = 0;   // newest action wins: a close that is still folding never undoes a later open
  function toggle(t) {
    var first = rects(), gen = ++seq;
    if (openTile === t) {
      fold(t).then(function () {
        if (gen !== seq || openTile !== t) return;
        first = rects(); setOpen(null); play(first); t.querySelector('.ar-i').focus();
      });
      return;
    }
    setOpen(t); play(first, t); unfold(t);
    var r = t.getBoundingClientRect();
    if (r.top < 0 || r.bottom > innerHeight) t.scrollIntoView({ block: r.height > innerHeight ? 'start' : 'nearest', behavior: motion() ? 'smooth' : 'auto' });
  }

  /* ---------- filters ---------- */
  function readURL() {
    var q = new URLSearchParams(location.search), out = [];
    q.forEach(function (v, k) { if (TX.filters[k] && v) out.push([k, v]); });
    return out;
  }
  function writeURL(push) {
    var q = new URLSearchParams(location.search);
    Object.keys(TX.filters).forEach(function (k) { q.delete(k); });
    filters.forEach(function (f) { q.append(f[0], f[1]); });
    var s = q.toString(), url = location.pathname + (s ? '?' + s : '') + location.hash;
    if (url !== location.pathname + location.search + location.hash) history[push ? 'pushState' : 'replaceState']({ ar: 1 }, '', url);
  }
  function setFilters(next, push) {
    var same = JSON.stringify(next) === JSON.stringify(filters);
    if (same && !openTile) return;
    var leaving = tiles.filter(function (t) { return !t.hidden && !matchesAfter(t._p, next); });
    var closing = openTile, gen = ++fseq; seq++;
    var pre = [fold(closing)];
    if (motion()) leaving.forEach(function (t) { pre.push(t.querySelector('.ar-ph').animate([{ opacity: 1 }, { opacity: 0, transform: 'perspective(1200px) translateZ(-80px)' }], { duration: 200, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' }).finished.catch(function () {})); });
    Promise.all(pre).then(function () {
      if (gen !== fseq) return;   // a newer filter change superseded this one
      var first = rects();
      leaving.forEach(function (t) { first.delete(t); t.querySelector('.ar-ph').getAnimations().forEach(function (a) { a.cancel(); }); });
      filters = next;
      if (closing && openTile === closing) setOpen(null);
      tiles.forEach(function (t) { t.hidden = !matches(t._p); });
      applyOrder();
      renderBar(); writeURL(push);
      play(first);
      var head = document.getElementById('ar-top');
      if (push && head && head.getBoundingClientRect().top < 0) head.scrollIntoView({ behavior: motion() ? 'smooth' : 'auto' });
    });
  }
  var fseq = 0;
  function matchesAfter(p, next) { var keep = filters; filters = next; var m = matches(p); filters = keep; return m; }

  /* A profile for whatever the wall is filtered to: the name as a heading, then what matters about it. */
  function profileHead(kind, name, meta) {
    return '<p class="ar-kind">' + esc(ui(kind)) + '</p><h3 class="ar-pn">' + esc(name) + '</h3>' +
      (meta.length ? '<p class="ar-meta">' + meta.filter(Boolean).join('<span class="ar-dot" aria-hidden="true">·</span>') + '</p>' : '');
  }
  function countMeta() { var n = visibleTiles().length; return esc(n + ' ' + ui(n === 1 ? 'photograph' : 'photographs')); }
  function section(label, html) { return html ? '<div class="ar-psec"><p class="label">' + esc(label) + '</p>' + html + '</div>' : ''; }
  /* Everyone who belongs to a house or to one of its chapters, with their scene and titles there. */
  function members(k) {
    var rows = [];
    Object.keys(D.people).forEach(function (pk) {
      var pp = D.people[pk];
      (pp.houses || []).forEach(function (x) {
        if (x.org !== k && ancestors(x.org, []).indexOf(k) < 0) return;
        rows.push({ n: pp.name, h: '<div class="ar-mrow">' + ent('person', pk, pp.name, 'ar-ent--house') +
          '<span class="ar-scene">' + esc([x.org !== k ? org(x.org).name : '', x.scene ? sceneName(x.scene) : ''].filter(Boolean).join(' · ')) + '</span>' + titlesHTML(x.titles, true) + '</div>' });
      });
      (pp.orgs || []).forEach(function (x) {
        if (x.org !== k && ancestors(x.org, []).indexOf(k) < 0) return;
        rows.push({ n: pp.name, h: '<div class="ar-mrow">' + ent('person', pk, pp.name, 'ar-ent--house') + (x.role ? '<span class="ar-scene">' + esc(tv(x.role)) + '</span>' : '') + '</div>' });
      });
    });
    rows.sort(function (a, b) { return a.n.localeCompare(b.n); });
    return rows.map(function (r) { return r.h; }).join('');
  }
  function context(k, v) {
    var h = '';
    if (k === 'person' && D.people[v]) {
      var pp = D.people[v], shown = (pp.aka || '').toLowerCase(), named = (pp.name || '').toLowerCase();
      /* the shown alias is already in the name; older builds also repeated it in aliases */
      var also = (pp.aka && named.indexOf(shown) < 0 ? [pp.aka] : []).concat((pp.aliases || []).filter(function (a) { var l = (a || '').toLowerCase(); return l && l !== shown && l !== named; }));
      var meta = [];
      if (pp.pronouns) meta.push('<span><b>' + esc(ui('pronouns')) + '</b> ' + esc(pp.pronouns.map(function (x) { return ui({ male: 'pronMale', female: 'pronFemale', neutral: 'pronNeutral' }[x] || x); }).join(' / ')) + '</span>');
      if (also.length) meta.push('<span><b>' + esc(ui('aka')) + '</b> ' + esc(also.join(', ')) + '</span>');
      meta.push('<span>' + countMeta() + '</span>');
      h += profileHead('kindPerson', pp.name, meta);
      var ball = ballroomRows(pp, false);
      if (ball) h += '<div class="ar-ball">' + ball + '</div>';
      var bio = tr(pp.bio);
      if (bio) h += bioBlock(bio);
      h += attrsHTML(pp.attrs);
      h += linksHTML(pp.links);
    } else if ((k === 'house' || k === 'org') && D.orgs[v]) {
      var o = D.orgs[v], bits = [esc(tv(o.type))];
      if (o.founded) bits.push(esc(ui('founded') + ' ' + o.founded + (o.dissolved ? '–' + o.dissolved : '')));
      if (o.international) bits.push(esc(ui('international')));
      if (o.chapter) bits.push(esc(ui('chapter') + ' ' + o.chapter));
      if (o.scenes && o.scenes.length) bits.push(esc(o.scenes.map(tv).join(', ')));
      bits.push(countMeta());
      h += profileHead(o.isHouse ? 'kindHouse' : 'kindCollective', o.name, bits.filter(Boolean));
      if (o.parent) h += '<p class="ar-meta">' + esc(ui('parent')) + ' ' + ent(houseKind(o.parent), o.parent, org(o.parent).name) + '</p>';
      var eth = tr(o.ethos), hist = tr(o.history);
      if (eth) h += bioBlock(eth); if (hist) h += bioBlock(hist);
      var m = members(v);
      if (m) h += section(ui('members'), '<div class="ar-ball">' + m + '</div>');
      h += attrsHTML(o.attrs);
    } else if (k === 'event' && D.events[v]) {
      var e = D.events[v], parts = [];
      if (e.date) { var dd = D.photos.filter(function (p) { return p.event === v && p.date === e.date; })[0]; parts.push(esc(dd ? tr(dd.dateText) : e.date)); }
      if (e.type) parts.push(esc(tv(e.type)));
      if (e.edition) parts.push(esc(ui('edition') + ' ' + e.edition));
      parts.push(countMeta());
      h += profileHead('kindEvent', e.title, parts);
      var where = [];
      if (e.space) where.push(ent('space', e.space, spaceName(space(e.space))));
      if (e.series) where.push(ent('series', e.series, D.series[e.series].name));
      if (where.length) h += '<p class="ar-line">' + where.join('<span class="ar-dot" aria-hidden="true">·</span>') + '</p>';
      var chips = (e.sonic || []).map(function (s) { return etag('sound', s); }).concat((e.categories || []).map(function (c) { return '<span class="ar-tag ar-tag--static">' + esc(tv(c)) + '</span>'; }));
      if (chips.length) h += '<div class="ar-vals">' + chips.join('') + '</div>';
      if (e.organizers) h += section(ui('organizers'), '<div class="ar-ball">' + e.organizers.map(function (o) { return '<div class="ar-mrow">' + ent(houseKind(o), o, org(o).name, 'ar-ent--house') + '</div>'; }).join('') + '</div>');
      if (e.crew) h += section(ui('crew'), '<div class="ar-ball">' + e.crew.filter(function (c) { return c.p && D.people[c.p]; }).map(function (c) {
        return '<div class="ar-mrow">' + ent('person', c.p, person(c.p).name, 'ar-ent--house') + (c.role ? '<span class="ar-scene">' + esc(tv(c.role)) + '</span>' : '') + '</div>'; }).join('') + '</div>');
      h += attrsHTML(e.attrs);
    } else if (k === 'series' && D.series[v]) {
      var s = D.series[v];
      h += profileHead('kindSeries', s.name, [esc(tv(s.type)), s.events ? esc(s.events + ' ' + ui(s.events === 1 ? 'eventOne' : 'eventMany')) : '', s.editions ? esc(s.editions + ' ' + ui(s.editions === 1 ? 'edition' : 'editions')) : '', countMeta()].filter(Boolean));
      if (s.parent && D.series[s.parent]) h += '<p class="ar-meta">' + esc(ui('parent')) + ' ' + ent('series', s.parent, D.series[s.parent].name) + '</p>';
    } else if (k === 'space' && D.spaces[v]) {
      var sp = D.spaces[v];
      h += profileHead('kindSpace', spaceName(sp), [esc(tv(sp.type)), sp.status ? esc(tv(sp.status)) : '', countMeta()].filter(Boolean));
      var addr = [sp.address, sp.hood, sp.city, tv(sp.country)].filter(Boolean);
      if (addr.length) h += '<p class="ar-meta">' + esc(addr.join(', ')) + '</p>';
      if (sp.formerNames) h += '<p class="ar-meta"><b>' + esc(ui('formerNames')) + '</b> ' + esc(sp.formerNames.join(', ')) + '</p>';
      h += attrsHTML(sp.attrs);
    }
    return h;
  }
  function bioBlock(text) {
    var first = firstPara(text), more = text.trim() !== first.trim();
    return '<div class="ar-bio"><div class="ar-bio-short">' + md(first) + '</div>' + (more ? '<div class="ar-bio-full" hidden>' + md(text) + '</div><button type="button" class="ar-more" aria-expanded="false">' + esc(ui('more')) + '</button>' : '') + '</div>';
  }
  /* Houses and events with photographs on the wall, as a second row of ways in. */
  function renderBrowse() {
    var box = document.getElementById('ar-browse');
    if (!box) return;
    function row(k, label, keys, name) {
      keys = keys.filter(function (x) { return tiles.some(function (t) { return (facets.get(t._p)[k] || []).indexOf(x) > -1; }); });
      if (!keys.length) return '';
      keys.sort(function (a, b) { return name(a).localeCompare(name(b)); });
      return '<div class="ar-brow"><p class="label">' + esc(ui(label)) + '</p><div class="ar-bvals">' +
        keys.map(function (x) { return ent(k, x, name(x)); }).join('') + '</div></div>';
    }
    box.innerHTML = row('house', 'browseHouses', Object.keys(D.orgs).filter(function (k) { return D.orgs[k].isHouse; }), function (k) { return D.orgs[k].name; }) +
      row('event', 'browseEvents', Object.keys(D.events), function (k) { return D.events[k].title; });
  }
  function renderBar() {
    var bar = document.getElementById('ar-active'), n = visibleTiles().length;
    document.getElementById('ar-n').textContent = n + ' ' + ui(n === 1 ? 'photograph' : 'photographs');
    document.querySelectorAll('#ar-quick button').forEach(function (b) {
      var on = b.dataset.k ? filters.length === 1 && filters[0][0] === b.dataset.k && filters[0][1] === b.dataset.v : !filters.length;
      b.setAttribute('aria-pressed', String(on));
    });
    var empty = document.getElementById('ar-empty');
    empty.hidden = n > 0; empty.textContent = ui('none');
    if (!filters.length) { bar.hidden = true; bar.innerHTML = ''; return; }
    var h = '<div class="ar-crumbs"><p class="label">' + esc(ui('filterBy')) + '</p>';
    h += filters.map(function (f) {
      var lab = labels[f[0]] && labels[f[0]][f[1]] ? labels[f[0]][f[1]]() : f[1];
      return '<button type="button" class="ar-crumb" data-rm="' + esc(f[0]) + '" data-rv="' + esc(f[1]) + '" aria-label="' + esc(ui('remove') + fl(f[0]) + ' ' + lab) + '"><span class="ar-crumb-k">' + esc(fl(f[0])) + '</span> ' + esc(lab) + ' <span aria-hidden="true">✕</span></button>';
    }).join('');
    h += '<button type="button" class="ae-btn ae-btn--sm ar-clear" data-clear>' + esc(ui('clear')) + ' ✕</button></div>';
    if (filters.length === 1) { var c = context(filters[0][0], filters[0][1]); if (c) h += '<div class="ar-ctx">' + c + '</div>'; }
    bar.innerHTML = h; bar.hidden = false;
  }

  /* ---------- viewer (full-size print, steps through the visible wall) ---------- */
  var dlg = document.getElementById('viewer'), pic = document.getElementById('pic'), count = document.getElementById('count'), list = [], cur = 0, opener = null;
  function wallOrder() { return visibleTiles().slice().sort(function (a, b) { return Number(a.style.order) - Number(b.style.order); }); }
  function show(i) {
    cur = (i + list.length) % list.length;
    var p = list[cur]._p, im = document.createElement('img');
    im.src = p.img.src; im.width = p.img.w; im.height = p.img.h; im.alt = alt(p); im.className = 'ar-full';
    pic.replaceChildren(im);
    count.textContent = (cur + 1) + ' / ' + list.length + ' · ' + p.code;
  }
  function openViewer(t) {
    if (!dlg || !dlg.showModal) return;
    opener = t.querySelector('.ar-open'); list = wallOrder(); show(list.indexOf(t)); dlg.showModal();
  }
  if (dlg) {
    dlg.addEventListener('click', function (e) { var b = e.target.closest('[data-step],[data-close]'); if (b) { if (b.hasAttribute('data-close')) dlg.close(); else show(cur + Number(b.dataset.step)); } else if (e.target === pic || e.target === dlg) dlg.close(); });
    dlg.addEventListener('keydown', function (e) { if (e.key === 'ArrowRight') show(cur + 1); if (e.key === 'ArrowLeft') show(cur - 1); });
    dlg.addEventListener('close', function () { pic.replaceChildren(); if (opener) opener.focus(); });
  }

  /* ---------- mouse pull (same feel as the cover print) ---------- */
  var pullReset = function () {};
  (function () {
    var fine = window.matchMedia('(hover: hover) and (pointer: fine)'), mx = null, my = null, raf = 0, R = 520, MOVE = 7, TILT = 4;
    function els() { return [].slice.call(grid.querySelectorAll('.ar-tile:not([hidden]):not(.is-open) .ar-pull')); }
    function st(e) { if (!e._c) { e._c = { x: 0, y: 0, rx: 0, ry: 0 }; e._t = { x: 0, y: 0, rx: 0, ry: 0 }; } return e; }
    function frame() {
      var moving = false;
      els().forEach(function (e) {
        st(e); var c = e._c, t = e._t;
        if (mx === null) { t.x = t.y = t.rx = t.ry = 0; } else {
          var r = e.getBoundingClientRect();
          if (r.bottom < -R || r.top > innerHeight + R) { t.x = t.y = t.rx = t.ry = 0; } else {
            var dx = mx - (r.left + r.width / 2), dy = my - (r.top + r.height / 2), d = Math.hypot(dx, dy), f = Math.max(0, 1 - d / R);
            f = f * f * (3 - 2 * f); var ux = d ? dx / d : 0, uy = d ? dy / d : 0;
            t.x = ux * MOVE * f; t.y = uy * MOVE * f; t.ry = ux * TILT * f; t.rx = -uy * TILT * f;
          }
        }
        c.x += (t.x - c.x) * .12; c.y += (t.y - c.y) * .12; c.rx += (t.rx - c.rx) * .12; c.ry += (t.ry - c.ry) * .12;
        if (Math.abs(t.x - c.x) + Math.abs(t.y - c.y) + Math.abs(t.rx - c.rx) + Math.abs(t.ry - c.ry) > .01) moving = true;
        e.style.transform = 'perspective(900px) translate3d(' + c.x.toFixed(2) + 'px,' + c.y.toFixed(2) + 'px,0) rotateX(' + c.rx.toFixed(2) + 'deg) rotateY(' + c.ry.toFixed(2) + 'deg)';
      });
      raf = moving ? requestAnimationFrame(frame) : 0;
    }
    function kick() { if (!raf) raf = requestAnimationFrame(frame); }
    function on() { return fine.matches && !still.matches; }
    document.addEventListener('pointermove', function (ev) { if (ev.pointerType !== 'mouse' || !on()) return; mx = ev.clientX; my = ev.clientY; kick(); }, { passive: true });
    document.addEventListener('pointerleave', function () { mx = my = null; kick(); });
    window.addEventListener('scroll', function () { if (mx !== null) kick(); }, { passive: true });
    pullReset = function () { grid.querySelectorAll('.ar-tile.is-open .ar-pull').forEach(function (e) { e.style.transform = ''; if (e._c) e._c = e._t = null; }); };
  })();

  /* ---------- events ---------- */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && openTile && !(dlg && dlg.open)) { e.preventDefault(); toggle(openTile); }
  });
  document.getElementById('ar-active').addEventListener('click', function (e) {
    var m = e.target.closest('.ar-more');
    if (m) { var b = m.parentNode, full = b.querySelector('.ar-bio-full'), open = full.hidden; full.hidden = !open; b.querySelector('.ar-bio-short').hidden = open; m.setAttribute('aria-expanded', String(open)); m.textContent = ui(open ? 'less' : 'more'); return; }
    if (e.target.closest('[data-clear]')) { setFilters([], true); return; }
    var r = e.target.closest('[data-rm]');
    if (r) { setFilters(filters.filter(function (f) { return !(f[0] === r.dataset.rm && f[1] === r.dataset.rv); }), true); return; }
    var t = e.target.closest('[data-k]');
    if (t) setFilters([[t.dataset.k, t.dataset.v]], true);
  });
  var browse = document.getElementById('ar-browse');
  if (browse) browse.addEventListener('click', function (e) { var t = e.target.closest('[data-k]'); if (t) setFilters([[t.dataset.k, t.dataset.v]], true); });
  document.querySelectorAll('#ar-quick button').forEach(function (b) {
    b.addEventListener('click', function () { setFilters(b.dataset.k ? [[b.dataset.k, b.dataset.v]] : [], true); });
  });
  window.addEventListener('popstate', function () { if (D) setFilters(readURL(), false); });
  var lastCols = 0;
  if (window.ResizeObserver) new ResizeObserver(function () { var n = cols(); if (n !== lastCols) { lastCols = n; applyOrder(); } lockHeight(); }).observe(grid);
  document.addEventListener('ae:lang', function () {
    if (!D) return;
    tiles.forEach(labelTile);
    if (openTile) { var d = openTile.querySelector('.ar-drawer'), st = d.scrollTop; d.innerHTML = drawerHTML(openTile._p); d.scrollTop = st; }
    renderBar(); renderBrowse();
  });

  /* ---------- cover print: rotates through every photo in the archive ----------
     Starts on a random print, then crossfades to the next one in a shuffled order every few seconds.
     Reads the same data/archive.json as the wall, so a takedown in the Studio leaves the cover too.
     Reduced motion: one random print per visit, no rotation. Pauses while the tab is hidden. */
  function coverRotation(photos) {
    var fig = document.getElementById('hero-print');
    if (!fig || !photos.length) return;
    var order = photos.slice(), i, j, t;
    for (i = order.length - 1; i > 0; i--) { j = Math.floor(Math.random() * (i + 1)); t = order[i]; order[i] = order[j]; order[j] = t; }
    var at = 0, cur = null, timer = 0, HOLD = 6000, FADE = 1300;
    function img(p) {
      var im = new Image();
      im.decoding = 'async'; im.alt = '';
      im.srcset = p.thumb.src + ' ' + p.thumb.w + 'w, ' + p.img.src + ' ' + p.img.w + 'w';
      im.sizes = '(max-width:900px) 75vw, 420px';
      im.src = p.img.src;
      return im;
    }
    function show(p) {
      var im = img(p);
      var go = function () {
        fig.appendChild(im);
        fig.classList.add('ready');
        void im.offsetWidth;
        im.classList.add('on');
        var old = cur; cur = im;
        if (old) setTimeout(function () { old.remove(); }, still.matches ? 0 : FADE);
        schedule();
      };
      (im.decode ? im.decode() : Promise.resolve()).then(go, go);
    }
    function next() { at = (at + 1) % order.length; show(order[at]); }
    function schedule() {
      clearTimeout(timer);
      if (still.matches || order.length < 2 || document.hidden) return;
      timer = setTimeout(next, HOLD);
      img(order[(at + 1) % order.length]); /* preload the next print */
    }
    document.addEventListener('visibilitychange', function () { if (document.hidden) clearTimeout(timer); else schedule(); });
    still.addEventListener('change', schedule);
    show(order[0]);
  }

  /* ---------- boot ---------- */
  var status = document.getElementById('ar-status');
  var MEDIA = 'https://media.aeriel.xyz';
  function getJSON(u) { return fetch(u).then(function (r) { if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); }); }
  /* The archive comes only from the bucket, so a takedown in the Studio is final. If the bucket can't be reached
     the page says so rather than showing an older copy that could still hold photos since taken down. */
  var UNAVAILABLE = '<span lang="en">The archive is briefly unavailable. Please try again in a few minutes.</span>' +
    '<span lang="es">El archivo no está disponible por un momento. Vuelve a intentarlo en unos minutos.</span>' +
    '<span lang="pt">O arquivo está indisponível no momento. Tente novamente em alguns minutos.</span>';
  Promise.all([getJSON(MEDIA + '/data/archive.json'), getJSON('/data/taxonomy.i18n.json')])
    .then(function (r) {
      D = r[0]; TX = r[1];
      coverRotation(D.photos);
      var frag = document.createDocumentFragment();
      D.photos.forEach(function (p, i) { facets.set(p, buildFacets(p)); var t = makeTile(p, i); tiles.push(t); byCode[p.code] = t; frag.appendChild(t); });
      grid.replaceChildren(frag);
      tiles.forEach(labelTile);
      filters = readURL();
      tiles.forEach(function (t) { t.hidden = !matches(t._p); });
      applyOrder(); renderBar(); renderBrowse();
      grid.removeAttribute('aria-busy'); if (status) status.remove();
      var want = new URLSearchParams(location.search).get('photo'), wt = want && byCode[want];
      if (wt) {
        if (wt.hidden) { filters = []; tiles.forEach(function (t) { t.hidden = false; }); applyOrder(); renderBar(); writeURL(false); }
        setOpen(wt);
        requestAnimationFrame(function () { wt.scrollIntoView({ block: 'start' }); });
      } else if (want) photoParam(null);
    })
    .catch(function (err) {
      if (status) status.innerHTML = UNAVAILABLE; /* constant markup, no archive data */
      grid.removeAttribute('aria-busy');
      if (window.console) console.error(err);
    });
})();
