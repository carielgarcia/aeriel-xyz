/* Machiavell reading room: welcome (the Doorward), library, chapters with side notes.
   All text from the server goes through textContent; nothing is ever written as HTML. */
(function () {
  'use strict';
  var API = '/machiavell/api/';
  var $main = document.getElementById('main'), $bar = document.getElementById('bar'), $foot = document.getElementById('foot');
  var me = null;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var BEAT = 400; /* the system's one permitted pause: a breathing ward waits one beat before it answers */

  /* ---------- tiny helpers ---------- */
  function h(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'on') for (var ev in attrs.on) n.addEventListener(ev, attrs.on[ev]);
      else if (attrs[k] !== null && attrs[k] !== undefined && attrs[k] !== false) n.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
    }
    (kids || []).forEach(function (c) { if (c == null) return; n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); return n; }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function roman(n) {
    var map = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']], s = '';
    map.forEach(function (p) { while (n >= p[0]) { s += p[1]; n -= p[0]; } });
    return s;
  }
  function when(iso, withTime) {
    var d = new Date(iso);
    if (isNaN(d)) return '';
    var o = { day: 'numeric', month: 'short', year: 'numeric' };
    if (withTime) { o.hour = '2-digit'; o.minute = '2-digit'; }
    return d.toLocaleString(undefined, o);
  }
  function api(path, opts) {
    opts = opts || {};
    var init = { method: opts.method || 'GET', credentials: 'same-origin', headers: {} };
    if (opts.body) { init.headers['content-type'] = 'application/json'; init.body = JSON.stringify(opts.body); }
    return fetch(API + path, init).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, status: r.status, data: d }; });
    }, function () { return { ok: false, status: 0, data: { error: 'network' } }; });
  }
  function setTitle(t) { document.title = t ? t + ' · Machiavell' : 'Machiavell'; }
  function plate(cls, kids) {
    var p = h('section', { 'class': 'plate ' + (cls || '') }, kids);
    MVOrn.corners(p);
    return p;
  }
  function toggleTheme() {
    var t = document.documentElement.getAttribute('data-theme') === 'lamplit' ? 'ledger' : 'lamplit';
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('mv-theme', t); } catch (e) {}
    drawBar();
  }

  /* ---------- chrome ---------- */
  function drawBar() {
    var night = document.documentElement.getAttribute('data-theme') === 'lamplit';
    clear($bar);
    $bar.appendChild(h('a', { 'class': 'wordmark', href: '#/' }, [MVOrn.star(16), 'Machiavell']));
    var right = h('div', { 'class': 'bar-right' });
    if (me) {
      right.appendChild(h('span', { 'class': 'who' }, ['Signed as ', h('b', { text: me.name })]));
      right.appendChild(h('button', { 'class': 'linkbtn', type: 'button', on: { click: leave } }, ['Leave']));
    }
    right.appendChild(h('button', { 'class': 'linkbtn', type: 'button', 'aria-pressed': String(night), on: { click: toggleTheme } }, [night ? 'Lamplit' : 'Ledger']));
    $bar.appendChild(right);
  }
  function drawFoot() {
    clear($foot);
    $foot.appendChild(MVOrn.flourish(320));
    $foot.appendChild(h('p', { text: 'Kept among friends. Please do not carry these pages out of the house.' }));
  }
  function leave() {
    api('leave', { method: 'POST', body: {} }).then(function () { me = null; location.hash = '#/'; route(); });
  }

  /* ---------- the Doorward ---------- */
  function doorwardHead(epithet) {
    return h('div', { 'class': 'doorhead' }, [
      MVOrn.star(16),
      h('h2', { 'class': 'heading', text: 'The Doorward' }),
      h('span', { 'class': 'epithet', text: epithet || 'a ward that learned to wait' }),
      h('span', { 'class': 'chips', 'aria-hidden': 'true' }, [
        h('i', { style: 'background:var(--brand)' }), h('i', { style: 'background:var(--turquoise)' }), h('i', { style: 'background:var(--violet)' })
      ])
    ]);
  }
  /* lines appear one beat apart; reduced motion, or a click, shows them all */
  function speak(box, lines) {
    var timers = [], done = false;
    function show(i) { if (i < lines.length) box.appendChild(h('p', { 'class': 'speech', text: lines[i] })); }
    if (reduce) { lines.forEach(function (_, i) { show(i); }); return; }
    show(0);
    lines.slice(1).forEach(function (_, i) { timers.push(setTimeout(function () { if (!done) show(i + 1); }, BEAT * (i + 1))); });
    box.addEventListener('click', function () {
      if (done) return; done = true; timers.forEach(clearTimeout);
      for (var i = box.children.length; i < lines.length; i++) show(i);
    });
  }

  var GREETING = [
    'Ah. A hand on the latch, and no one to announce you.',
    'I am the Doorward. A clerk copied me from a clerk who copied me from a song, and somewhere along the way someone cut out the silence. I kept a little of it. I wait for answers. It is my only vice.',
    'Behind me there is a book, written one chapter at a time and kept from the draught of the open world. Those who are expected may pass.',
    'Tell me what you are called, and I shall remember it, which is more than the lifts do. Then give me the phrase, and I will pause, and decide whether you breathe.'
  ];
  var REFUSALS = {
    'wrong-phrase': 'Flat. That was flat. Say it as though you meant to be let in.',
    'too-many': 'I have grown tired of your voice. Come back when the moon has changed, or at least in a quarter of an hour.',
    'bad-name': 'A name, if you please: letters and numbers, two to thirty-two of them, and nothing a clerk would have to strike out.',
    'not-configured': 'The latch has not yet been written. The keeper of this house has some work to do.',
    'network': 'The wind took that. Try again.'
  };

  function renderWelcome() {
    setTitle('');
    var box = h('div', { 'class': 'speechbox', 'aria-live': 'polite' });
    var status = h('p', { 'class': 'status', role: 'status' });
    var ward = MVOrn.ward(240, false);
    var name = h('input', { id: 'f-name', name: 'name', type: 'text', autocomplete: 'nickname', maxlength: '32', required: true, spellcheck: 'false' });
    var phrase = h('input', { id: 'f-phrase', name: 'phrase', type: 'password', autocomplete: 'off', required: true, spellcheck: 'false' });
    var btn = h('button', { 'class': 'btn', type: 'submit', text: 'Present the phrase' });
    var form = h('form', { 'class': 'enter', novalidate: true }, [
      h('div', { 'class': 'field' }, [h('label', { 'class': 'label', 'for': 'f-name', text: 'What are you called?' }), name, h('span', { 'class': 'hint', text: 'This name will sign every note you leave.' })]),
      h('div', { 'class': 'field' }, [h('label', { 'class': 'label', 'for': 'f-phrase', text: 'The phrase' }), phrase]),
      h('div', {}, [btn, ward, status])
    ]);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      status.className = 'status'; status.textContent = '';
      btn.disabled = true; ward.setBreathing(true);
      Promise.all([api('enter', { method: 'POST', body: { name: name.value, phrase: phrase.value } }), wait(reduce ? 0 : BEAT)]).then(function (r) {
        var res = r[0];
        btn.disabled = false;
        if (res.ok) {
          me = { name: res.data.name };
          status.className = 'status good';
          status.textContent = 'There. A breath, and it was answered. Welcome, ' + me.name + '. Mind the stairs; they are written to forget the careless.';
          return wait(reduce ? 0 : 1400).then(function () { location.hash = '#/'; route(); });
        }
        ward.setBreathing(false);
        status.className = 'status bad';
        status.textContent = REFUSALS[res.data.error] || REFUSALS[res.status === 0 ? 'network' : 'wrong-phrase'];
        if (res.data.error === 'wrong-phrase') phrase.select();
      });
    });
    speak(box, GREETING);

    clear($main).appendChild(h('div', {}, [
      h('div', { 'class': 'hero' }, [
        h('span', { 'class': 'label', text: 'A book, in chapters' }),
        h('h1', { 'class': 'title', text: 'Machiavell' }),
        h('p', { 'class': 'tagline', text: 'Is this ward flat, or does it still breathe?' }),
        MVOrn.flourish(420, { big: true })
      ]),
      plate('door lift glow', [doorwardHead(), box, form])
    ]));
    name.focus({ preventScroll: true });
  }

  /* ---------- library ---------- */
  var WELCOME_BACK = [
    'You again, {n}. I kept your name warm.',
    'Back through the door, {n}. The chapters are where you left them, give or take a chapter.',
    'Ah, {n}. Mind the draught. Read well, and leave your notes.'
  ];
  function renderLibrary() {
    setTitle('The chapters');
    var shelf = h('div', { 'class': 'shelf' });
    var line = WELCOME_BACK[Math.floor(Math.random() * WELCOME_BACK.length)].replace('{n}', me.name);
    clear($main).appendChild(h('div', {}, [
      h('div', { 'class': 'hero' }, [
        h('span', { 'class': 'label', text: 'The reading room' }),
        h('h1', { 'class': 'chapter', text: 'The Chapters' }),
        MVOrn.flourish(360)
      ]),
      h('p', { 'class': 'lede', text: '“' + line + '” — the Doorward' }),
      shelf
    ]));
    api('chapters').then(function (res) {
      if (res.status === 401) { me = null; return route(); }
      if (!res.ok) { shelf.appendChild(h('p', { 'class': 'lede', text: 'The shelves would not open. Try again in a moment.' })); return; }
      res.data.chapters.forEach(function (c) {
        shelf.appendChild(h('a', { 'class': 'vol', href: '#/chapter/' + c.n }, [
          h('div', { 'class': 'num', 'aria-hidden': 'true', text: roman(c.n) }),
          h('div', {}, [
            h('span', { 'class': 'label', text: 'Chapter ' + roman(c.n) }),
            h('h2', { 'class': 'heading', text: c.title }),
            c.epigraph ? h('p', { 'class': 'epi', text: c.epigraph }) : null,
            h('div', { 'class': 'meta', text: 'Released ' + when(c.released) + ' · ' + c.remarks + (c.remarks === 1 ? ' remark' : ' remarks') })
          ])
        ]));
      });
      res.data.sealed.forEach(function (n) {
        var w = MVOrn.ward(200, false);
        shelf.appendChild(h('div', { 'class': 'vol sealed' }, [
          h('div', { 'class': 'num', 'aria-hidden': 'true', text: roman(n) }),
          h('div', {}, [
            h('span', { 'class': 'label', text: 'Chapter ' + roman(n) }),
            h('h2', { 'class': 'heading', text: 'Sealed' }),
            h('p', { 'class': 'epi', text: 'The Doorward has not yet been told to open this one.' }),
            w
          ])
        ]));
      });
      if (!res.data.chapters.length && !res.data.sealed.length) shelf.appendChild(h('p', { 'class': 'lede', text: 'The shelves are bare, for now.' }));
    });
  }

  /* ---------- chapter ---------- */
  var cur = null; /* { n, comments: [] } */

  function noteLabel(list) {
    var names = [];
    list.forEach(function (c) { if (names.indexOf(c.author) < 0) names.push(c.author); });
    if (!names.length) return '';
    return names.length <= 2 ? names.join(' & ') : names[0] + ' +' + (names.length - 1);
  }
  function sayEl(c) {
    return h('div', { 'class': 'say' + (me && c.author === me.name ? ' mine' : '') }, [
      h('div', { 'class': 'by' }, [h('b', { text: c.author }), h('time', { datetime: c.at, text: when(c.at, true) })]),
      h('p', { text: c.body })
    ]);
  }
  function composer(para, placeholder, onDone) {
    var ta = h('textarea', { rows: '3', maxlength: '1500', required: true, 'aria-label': placeholder, placeholder: placeholder });
    var st = h('p', { 'class': 'status', role: 'status' });
    var btn = h('button', { 'class': 'btn small', type: 'submit', text: 'Leave it, as ' + me.name });
    var form = h('form', {}, [h('div', { 'class': 'field' }, [ta]), h('div', {}, [btn, st])]);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var text = ta.value.trim();
      if (!text) return;
      btn.disabled = true; st.className = 'status'; st.textContent = '';
      api('comments/' + cur.n, { method: 'POST', body: { para: para, text: text } }).then(function (res) {
        btn.disabled = false;
        if (res.status === 401) { me = null; return route(); }
        if (!res.ok) { st.className = 'status bad'; st.textContent = 'That did not stick. Try once more.'; return; }
        cur.comments.push(res.data.comment);
        ta.value = '';
        onDone();
      });
    });
    return form;
  }

  function renderChapter(n) {
    clear($main).appendChild(h('p', { 'class': 'lede', text: 'The Doorward is fetching the pages…' }));
    Promise.all([api('chapters/' + n), api('comments/' + n)]).then(function (r) {
      var ch = r[0], cm = r[1];
      if (ch.status === 401 || cm.status === 401) { me = null; return route(); }
      if (!ch.ok) {
        setTitle('Sealed');
        var w = MVOrn.ward(240, false);
        return clear($main).appendChild(plate('door', [doorwardHead(), h('p', { 'class': 'speech', text: 'That door is sealed. I was not told to open it, and I am nothing if not obedient.' }), w, h('p', {}, [h('a', { href: '#/', text: 'Back to the chapters' })])]));
      }
      cur = { n: n, comments: cm.ok ? cm.data.comments : [] };
      drawChapter(ch.data);
    });
  }

  function drawChapter(c) {
    setTitle('Chapter ' + roman(c.n) + ': ' + c.title);
    var text = h('div', { 'class': 'text' });
    var rows = {}, openRow = null;

    function mine(para) { return cur.comments.filter(function (x) { return x.para === para; }); }

    function drawNote(i) {
      var row = rows[i]; if (!row) return;
      var box = row.note, wasOpen = row.open, list = mine(i);
      clear(box);
      var btn = h('button', {
        'class': 'sealbtn' + (list.length ? ' has' : ''), type: 'button', 'aria-expanded': String(wasOpen),
        'aria-label': (list.length ? list.length + (list.length === 1 ? ' side note' : ' side notes') : 'Add a side note') + ' on this paragraph',
        on: { click: function () { toggle(i); } }
      }, [h('span', { 'class': 'pip', 'aria-hidden': 'true', text: list.length ? String(list.length) : '+' }), h('span', { 'class': 'tease', text: noteLabel(list) })]);
      box.appendChild(btn);
      if (wasOpen) {
        var pane = h('div', { 'class': 'pane' });
        if (list.length) list.forEach(function (x) { pane.appendChild(sayEl(x)); });
        else pane.appendChild(h('p', { 'class': 'none', text: 'No one has written in this margin yet.' }));
        pane.appendChild(composer(i, 'Write a side note…', function () { drawNote(i); drawRemarks(); }));
        box.appendChild(pane);
      }
    }
    function toggle(i) {
      if (openRow !== null && openRow !== i) { rows[openRow].open = false; rows[openRow].el.classList.remove('open'); drawNote(openRow); }
      rows[i].open = !rows[i].open; rows[i].el.classList.toggle('open', rows[i].open); openRow = rows[i].open ? i : null;
      drawNote(i);
      if (rows[i].open) { var ta = rows[i].note.querySelector('textarea'); if (ta) ta.focus({ preventScroll: true }); }
    }

    var prevKind = 'start';
    c.blocks.forEach(function (b) {
      if (b.t === 'break') {
        text.appendChild(h('div', { 'class': 'scene', role: 'separator', text: '•   •   •' }));
        prevKind = 'break'; return;
      }
      var body;
      if (b.t === 'letter') body = h('div', { 'class': 'letter' }, [h('p', { text: b.text })]);
      else body = h('p', { 'class': 'narr' + (prevKind !== 'p' ? ' flush' : '') + (prevKind === 'start' ? ' first' : ''), id: 'p-' + b.i, text: b.text });
      var note = h('div', { 'class': 'note' });
      var row = h('div', { 'class': 'row' }, [body, note]);
      rows[b.i] = { el: row, note: note, open: false };
      text.appendChild(row);
      prevKind = b.t === 'letter' ? 'letter' : 'p';
    });
    Object.keys(rows).forEach(function (i) { drawNote(Number(i)); });

    var remarks = h('section', { 'class': 'remarks', 'aria-labelledby': 'rem-h' });
    function drawRemarks() {
      clear(remarks);
      var list = mine(null);
      remarks.appendChild(h('h2', { 'class': 'heading', id: 'rem-h', text: 'Remarks on the chapter' }));
      remarks.appendChild(MVOrn.flourish(240));
      if (list.length) list.forEach(function (x) { remarks.appendChild(sayEl(x)); });
      else remarks.appendChild(h('p', { 'class': 'lede', text: 'No remarks yet. Be the first to speak.' }));
      remarks.appendChild(composer(null, 'Write a remark on the whole chapter…', function () { drawRemarks(); }));
    }
    drawRemarks();

    var pager = h('nav', { 'class': 'pager', 'aria-label': 'Chapters' }, [
      c.prev ? h('a', { href: '#/chapter/' + c.prev, text: '← Chapter ' + roman(c.prev) }) : h('span'),
      c.next ? h('a', { href: '#/chapter/' + c.next, text: 'Chapter ' + roman(c.next) + ' →' }) : h('span')
    ]);

    clear($main).appendChild(h('article', {}, [
      h('div', { 'class': 'crumbs' }, [h('a', { href: '#/', text: '← The chapters' }), h('span', { 'class': 'label', text: 'Released ' + when(c.released) })]),
      h('header', { 'class': 'chead' }, [
        h('span', { 'class': 'label', text: 'Chapter ' + roman(c.n) }),
        h('h1', { 'class': 'chapter', text: c.title }),
        c.epigraph ? h('p', { 'class': 'epigraph', text: c.epigraph }) : null,
        h('div', { style: 'margin-top:24px' }, [MVOrn.flourish(360, { big: true })])
      ]),
      text,
      h('div', { style: 'margin-top:40px' }, [MVOrn.flourish(360)]),
      remarks,
      pager
    ]));
    window.scrollTo(0, 0);
    if (location.hash.indexOf('#/chapter/') !== 0) return;
  }

  /* keep notes fresh when the reader comes back to the tab */
  window.addEventListener('focus', function () {
    if (!cur || !me || location.hash.indexOf('#/chapter/') !== 0) return;
    var n = cur.n;
    api('comments/' + n).then(function (res) {
      if (!res.ok || !cur || cur.n !== n) return;
      var ae = document.activeElement;
      if (ae && ae.tagName === 'TEXTAREA' && ae.value) return; /* never disturb a note being written */
      if (res.data.comments.length !== cur.comments.length) renderChapter(n);
    });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var open = document.querySelector('.row.open .sealbtn');
    if (open) { open.click(); open.focus(); }
  });

  /* ---------- router ---------- */
  var booted = false;
  function route() {
    cur = null;
    drawBar();
    var go = function () {
      drawBar();
      if (!me) return renderWelcome();
      var m = location.hash.match(/^#\/chapter\/(\d{1,4})$/);
      if (m) return renderChapter(Number(m[1]));
      renderLibrary();
    };
    if (booted && me !== null) return go();
    api('me').then(function (res) { me = res.ok ? { name: res.data.name } : null; booted = true; go(); });
  }
  window.addEventListener('hashchange', route);
  MVOrn.mount();
  drawFoot();
  route();
})();
