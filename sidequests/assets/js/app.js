/* SIDE QUESTS — draft mockup. No build step, no dependencies. */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const money = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
  const live = (msg) => { const el = $('#live'); if (el) el.textContent = msg; };

  /* ------------------------------------------------------------------
     Data
     ------------------------------------------------------------------ */
  const RARITY = {
    common:    { name: 'Common',    xp: 10,  count: 62, blurb: 'Say hello to someone. Mostly harmless.' },
    uncommon:  { name: 'Uncommon',  xp: 25,  count: 31, blurb: 'Requires a plan and a straight face.' },
    rare:      { name: 'Rare',      xp: 50,  count: 17, blurb: 'Requires a witness.' },
    epic:      { name: 'Epic',      xp: 100, count: 7,  blurb: 'Requires a crowd, or at least five brave strangers.' },
    legendary: { name: 'Legendary', xp: 250, count: 3,  blurb: 'Requires a song, a room and nerve.' },
  };

  const QUESTS = [
    { n: 7,   rarity: 'rare',      title: 'The Angry Goose',     dare: 'Give this card to someone who once had to run from security, the police or a really angry goose.' },
    { n: 14,  rarity: 'common',    title: 'Shoe Twin',           dare: 'Find someone wearing the same shoes as you. Say nothing. Wait for them to notice.' },
    { n: 21,  rarity: 'common',    title: 'Tote Bag Oracle',     dare: 'Find a person with a tote bag. Guess what is inside. If you are right, they owe you a handshake.' },
    { n: 27,  rarity: 'common',    title: 'Best Spot',           dare: 'Ask three people where the best place to stand is. Go and stand there.' },
    { n: 33,  rarity: 'uncommon',  title: 'Hydration Station',   dare: 'Bring someone a glass of water. Say nothing. Walk away with authority.' },
    { n: 38,  rarity: 'uncommon',  title: 'Slow Clap',           dare: 'Start a slow clap for the DJ. You have until the drop.' },
    { n: 45,  rarity: 'common',    title: 'Lyric Check',         dare: 'Find a person who knows every word to this song. Ask them to sing you the next line.' },
    { n: 52,  rarity: 'rare',      title: 'The Elder',           dare: 'Find the oldest person here. Ask for their best night out. Listen to the whole story.' },
    { n: 58,  rarity: 'common',    title: 'Compliment Heist',    dare: 'Compliment a stranger’s outfit. Be specific. Be sincere. Leave before they can reply.' },
    { n: 63,  rarity: 'uncommon',  title: 'Last Metro Alliance', dare: 'Find someone else watching the clock for the last train. Form an alliance. Share the departure time.' },
    { n: 66,  rarity: 'uncommon',  title: 'Secret Handshake',    dare: 'Invent a handshake with a stranger. Do it twice. Never do it again.' },
    { n: 71,  rarity: 'rare',      title: 'Question Mark',       dare: 'Hold a conversation with a stranger for one full minute using only questions. First to answer loses.' },
    { n: 80,  rarity: 'epic',      title: 'Dance Thief',         dare: 'Find the best dance move in the room. Learn it. Teach it to someone else before the song ends.' },
    { n: 84,  rarity: 'common',    title: 'Coat Check Poet',     dare: 'Ask the person at the coat check for their best advice. Accept it. Do not argue.' },
    { n: 90,  rarity: 'uncommon',  title: 'The Exit Report',     dare: 'Find the person closest to the exit. Ask if the night is worth staying for. Report back.' },
    { n: 96,  rarity: 'common',    title: 'High Five Circuit',   dare: 'Collect a high five from someone in every corner of the room.' },
    { n: 101, rarity: 'rare',      title: 'Fake Profession',     dare: 'Introduce two strangers to each other. Give them each an absurd job title. Commit.' },
    { n: 105, rarity: 'common',    title: 'Staring Contest',     dare: 'Challenge a friend to a staring contest. The loser takes a photo of the winner.' },
    { n: 112, rarity: 'epic',      title: 'Conga Line',          dare: 'Start a conga line. It counts at five people. It always counts at five people.' },
    { n: 115, rarity: 'epic',      title: 'Town Crier',          dare: 'Announce one true fact about this night to a nearby group. Use a serious voice. Leave.' },
    { n: 118, rarity: 'legendary', title: 'Turn Around',         dare: 'Get everyone in your part of the room to turn and face the same direction. You have one song.' },
    { n: 119, rarity: 'legendary', title: 'Unanimous',           dare: 'Get five strangers to agree on one favourite song. Write it on the back of this card.' },
    { n: 120, rarity: 'legendary', title: 'Side Quest Zero',     dare: 'Skip this card. Tell someone why. That counts.' },
  ];

  const EDITIONS = [
    { no: '01', name: 'The First Night', accent: 'magenta', cards: 120, status: 'In stock', ok: true,  price: 14, add: 'p-ed1', cta: 'Add to cart',
      copy: 'The base deck. 120 quests for every bar, club and warehouse where you have stood near a wall and wished something would happen. Something will now.' },
    { no: '02', name: 'Last Metro',      accent: 'cobalt',  cards: 120, status: 'In stock', ok: true,  price: 14, add: 'p-ed2', cta: 'Add to cart',
      copy: 'The queue, the dance floor at 3 a.m. and the long goodbye at the door. 120 quests for the second half of the night.' },
    { no: '03', name: 'Backstage',       accent: 'violet',  cards: 60,  status: 'Pre-order · Ships spring 2027', ok: false, price: 12, add: 'p-ed3', cta: 'Pre-order',
      copy: 'Quests for the people who keep the night running: bartenders, DJs, door staff, whoever is holding your bag. Be nice. Say thank you. Ask for nothing.' },
    { no: '04', name: 'Dawn',            accent: 'gold',    cards: 60,  status: 'Coming soon', ok: false, price: 12, add: null, cta: 'Notify me',
      copy: 'Printed on cream stock so you can read it in daylight. Quests for brunch, sunrise and the bus home. The same cards, slightly more tired.' },
  ];

  const PRODUCTS = [
    { id: 'p-ed1',  art: 'deck',   rarity: 'common',    name: 'Edition 01 · The First Night', price: 14, desc: '120 cards. The deck that started it.', kind: 'Deck' },
    { id: 'p-ed2',  art: 'deck',   rarity: 'uncommon',  name: 'Edition 02 · Last Metro',      price: 14, desc: '120 cards for the second half of the night.', kind: 'Deck' },
    { id: 'p-ed3',  art: 'deck',   rarity: 'rare',      name: 'Edition 03 · Backstage',       price: 12, desc: '60 cards for the people who run the night. Pre-order, ships spring 2027.', kind: 'Pre-order' },
    { id: 'p-dbl',  art: 'double', rarity: 'rare',      name: 'Double Feature',               price: 24, desc: 'Editions 01 and 02. Save four dollars. Spend them at the coat check.', kind: 'Bundle', feature: true },
    { id: 'p-foil', art: 'foil',   rarity: 'legendary', name: 'Foil Pack',                    price: 9,  desc: 'Five holo cards. One Epic or better, guaranteed.', kind: 'Foil' },
    { id: 'p-venue',art: 'venue',  rarity: 'epic',      name: 'Venue Pack',                   price: 69, desc: 'Six decks, one table tent, one sign. For venues that would like their guests to talk to each other.', kind: 'Venue' },
    { id: 'p-log',  art: 'log',    rarity: 'common',    name: 'Quest Log',                    price: 11, desc: '48-page pocket notebook. Tally your XP. Record your crimes of kindness.', kind: 'Notebook' },
    { id: 'p-band', art: 'band',   rarity: 'uncommon',  name: 'Quest Wristbands (10)',        price: 8,  desc: 'Woven, gold on black. Wear one. Strangers will ask. That is the quest.', kind: 'Wearable' },
    { id: 'p-pin',  art: 'pin',    rarity: 'rare',      name: 'Gold Star Pin',                price: 10, desc: 'Enamel pin. Awarded to yourself, for services to the night.', kind: 'Pin' },
  ];
  const PBY = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));

  /* ------------------------------------------------------------------
     Building blocks
     ------------------------------------------------------------------ */
  const star = (cls = 'star') => `<svg class="${cls}" viewBox="0 0 100 100" aria-hidden="true"><use href="#star4"/></svg>`;
  const rtag = (r) => `<span class="rtag" data-r="${r}">${star('star')}${RARITY[r].name}</span>`;
  const pad = (n) => String(n).padStart(3, '0');

  const ORN = ['tl', 'tr', 'bl', 'br']
    .map((p) => `<svg class="orn orn--${p}" viewBox="0 0 100 100" aria-hidden="true"><use href="#orn-corner"/></svg>`)
    .join('');

  const EMBLEM = `
    <svg class="emblem" viewBox="-100 -100 200 200" aria-hidden="true">
      <circle r="92" fill="none" stroke="url(#hood)" stroke-width="1.5"/>
      <circle r="78" fill="none" stroke="url(#hood)" stroke-width="1" stroke-dasharray="2 7" stroke-linecap="round"/>
      <path d="M0 -70 Q0 0 70 0 Q0 0 0 70 Q0 0 -70 0 Q0 0 0 -70Z" fill="none" stroke="url(#hood)" stroke-width="3" stroke-linejoin="round"/>
      <path d="M0 -70 Q0 0 70 0 Q0 0 0 70 Q0 0 -70 0 Q0 0 0 -70Z" fill="none" stroke="url(#hood)" stroke-width="1.5" stroke-linejoin="round" transform="rotate(45) scale(0.62)"/>
      <circle r="5" fill="var(--cobalt)"/>
      <use href="#star4" x="-14" y="-92" width="28" height="28" style="color:var(--gold)"/>
      <circle cx="-84" cy="0" r="2.5" fill="var(--teal)"/><circle cx="84" cy="0" r="2.5" fill="var(--magenta)"/>
    </svg>`;

  const frontHTML = (ed = 'Edition 01') => `${ORN}
    <div class="qf">
      <span class="label">${ed}</span>
      ${EMBLEM}
      <div class="qf__name"><span class="card-title">Side Quests</span><span class="serial">© 2026 Side Quest Cards</span></div>
    </div>`;

  const backHTML = (q) => `${ORN}
    <div class="qb">
      <div class="qb__top">${rtag(q.rarity)}<span class="label">No. ${pad(q.n)} / 120</span></div>
      <div class="qb__mid">${star('star')}<p class="card-title qb__title">${q.title}</p><p class="card-dare">${q.dare}</p></div>
      <div class="qb__foot"><span class="label">+${RARITY[q.rarity].xp} XP</span><span class="serial">Skip is always allowed</span></div>
    </div>`;

  const qcard = (q, { flipped = false, lift = false, id = '', ed = 'Edition 01' } = {}) => `
    <div class="qcard${flipped ? ' is-flipped' : ''}${lift ? ' qcard--lift' : ''}" data-r="${q.rarity}"${id ? ` id="${id}"` : ''}>
      <div class="qcard__inner">
        <div class="qface qface--front">${frontHTML(ed)}</div>
        <div class="qface qface--back"${flipped ? '' : ' aria-hidden="true"'}>${backHTML(q)}</div>
      </div>
    </div>`;

  const qstatic = (q) => `<div class="qcard qcard--static" data-r="${q.rarity}"><div class="qface">${backHTML(q)}</div></div>`;

  /* ------------------------------------------------------------------
     Product + edition art (original linework, no figure)
     ------------------------------------------------------------------ */
  const card = (x, y, w, h, rot, extra = '') =>
    `<g transform="rotate(${rot} ${x + w / 2} ${y + h / 2})"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.round(w * 0.12)}" fill="var(--surface-card)" stroke="url(#hood)" stroke-width="2.5"/>${extra}</g>`;
  const miniStar = (cx, cy, s, col = 'var(--gold)') => `<use href="#star4" x="${cx - s / 2}" y="${cy - s / 2}" width="${s}" height="${s}" style="color:${col}"/>`;

  function productArt(kind) {
    let g = '';
    switch (kind) {
      case 'deck':
        g = card(60, 38, 80, 112, -9) + card(60, 38, 80, 112, 0) + card(60, 38, 80, 112, 9, miniStar(100, 94, 30));
        break;
      case 'double':
        g = card(24, 44, 70, 98, -8) + card(24, 44, 70, 98, 2, miniStar(59, 93, 24)) +
            card(104, 52, 70, 98, -2) + card(104, 52, 70, 98, 8, miniStar(139, 101, 24, 'var(--magenta)'));
        break;
      case 'foil':
        g = [-26, -13, 0, 13, 26].map((r, i) => card(68, 44, 64, 90, r, i === 4 ? miniStar(100, 89, 24) : '')).join('');
        break;
      case 'venue':
        g = `<path d="M54 54 L100 24 L146 54 L146 76 L54 76Z" fill="var(--surface-card)" stroke="url(#hood)" stroke-width="2.5" stroke-linejoin="round"/>` + miniStar(100, 58, 18) +
            [0, 1, 2].map((i) => card(46 + i * 36, 92, 28, 40, 0)).join('') + [0, 1, 2].map((i) => card(46 + i * 36, 140, 28, 40, 0)).join('');
        break;
      case 'log':
        g = `<rect x="58" y="34" width="84" height="118" rx="8" fill="var(--surface-card)" stroke="url(#hood)" stroke-width="2.5"/><path d="M72 34 V152" stroke="url(#hood)" stroke-width="2"/>` +
            miniStar(107, 78, 30) + `<path d="M84 114 H132 M84 126 H132 M84 138 H118" stroke="var(--line-strong)" stroke-width="2" stroke-linecap="round"/>`;
        break;
      case 'band':
        g = `<rect x="22" y="76" width="156" height="48" rx="10" fill="var(--surface-card)" stroke="url(#hood)" stroke-width="2.5"/>` +
            [44, 72, 100, 128, 156].map((x, i) => miniStar(x, 100, 14, i % 2 ? 'var(--gold)' : 'var(--magenta)')).join('');
        break;
      case 'pin':
        g = `<circle cx="100" cy="98" r="52" fill="var(--surface-card)" stroke="url(#hood)" stroke-width="2.5"/><circle cx="100" cy="98" r="42" fill="none" stroke="var(--line-strong)" stroke-width="1.5" stroke-dasharray="2 6" stroke-linecap="round"/>` + miniStar(100, 98, 56);
        break;
      default:
        g = miniStar(100, 100, 60);
    }
    return `<svg class="art__svg" viewBox="0 0 200 200" aria-hidden="true">${g}</svg>`;
  }

  /* ------------------------------------------------------------------
     Hero card
     ------------------------------------------------------------------ */
  (function hero() {
    const slot = $('#hero-card-slot');
    slot.innerHTML = qcard(QUESTS[0], { lift: true, id: 'hero-card' }) +
      '<button class="hit" type="button" aria-pressed="false" aria-label="Flip the card to read the dare"></button>';
    const c = $('#hero-card'), hit = $('.hit', slot), back = $('.qface--back', c);
    hit.addEventListener('click', () => {
      const on = c.classList.toggle('is-flipped');
      hit.setAttribute('aria-pressed', on);
      back.setAttribute('aria-hidden', !on);
    });
  })();

  /* Ticker: duplicate the group for a seamless loop */
  (function ticker() {
    const track = $('#ticker-track'), group = $('#ticker-group');
    const clone = group.cloneNode(true);
    clone.removeAttribute('id');
    clone.setAttribute('aria-hidden', 'true');
    track.appendChild(clone);
  })();

  /* ------------------------------------------------------------------
     Draw a card
     ------------------------------------------------------------------ */
  (function draw() {
    const slot = $('#draw-slot');
    slot.innerHTML = qcard(QUESTS[0], { lift: true, id: 'draw-card' });
    const c = $('#draw-card'), back = $('.qface--back', c);
    const status = $('#draw-status');
    const drawBtn = $('#draw-btn'), doneBtn = $('#complete-btn'), skipBtn = $('#skip-btn');
    const LEVELS = ['Bystander', 'Regular', 'Hazard', 'Menace', 'Local legend'];
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let current = null, xp = 0, resolved = true;

    const say = (html, ok = false) => {
      status.className = 'status' + (ok ? ' status--ok' : '');
      status.innerHTML = html;
    };
    const renderXP = () => {
      const lvl = Math.floor(xp / 100), pct = xp % 100;
      $('#xp-level').textContent = `Level ${lvl + 1} · ${LEVELS[Math.min(lvl, LEVELS.length - 1)]}`;
      $('#xp-text').textContent = `${pct} / 100 XP`;
      $('#xp-fill').style.width = pct + '%';
      $('#xp-bar').setAttribute('aria-valuenow', pct);
    };

    const pickQuest = () => {
      // Weighted by the deck's rarity counts so Legendary stays legendary.
      const weights = QUESTS.map((q) => RARITY[q.rarity].count / QUESTS.filter((x) => x.rarity === q.rarity).length);
      let q, tries = 0;
      do {
        let r = Math.random() * weights.reduce((a, b) => a + b, 0), i = 0;
        for (; i < weights.length - 1; i++) { r -= weights[i]; if (r <= 0) break; }
        q = QUESTS[i];
        tries++;
      } while (q === current && tries < 20);
      return q;
    };

    const reveal = (q) => {
      c.dataset.r = q.rarity;
      back.innerHTML = backHTML(q);
      back.setAttribute('aria-hidden', 'false');
      requestAnimationFrame(() => c.classList.add('is-flipped'));
    };

    drawBtn.addEventListener('click', () => {
      current = pickQuest();
      resolved = false;
      doneBtn.disabled = false;
      skipBtn.disabled = false;
      const wasFlipped = c.classList.contains('is-flipped');
      if (wasFlipped) {
        c.classList.remove('is-flipped');
        back.setAttribute('aria-hidden', 'true');
        setTimeout(() => reveal(current), reduce ? 220 : 420);
      } else {
        reveal(current);
      }
      say(`${star('star')}<span><strong>${RARITY[current.rarity].name}.</strong> ${current.title}. Do it, or skip it. Both are fine.</span>`);
      live(`Drew ${RARITY[current.rarity].name} card: ${current.title}. ${current.dare}`);
    });

    doneBtn.addEventListener('click', () => {
      if (!current || resolved) return;
      resolved = true;
      const gain = RARITY[current.rarity].xp;
      xp += gain;
      renderXP();
      doneBtn.disabled = true;
      skipBtn.disabled = true;
      say(`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg><span><strong>Quest complete.</strong> +${gain} XP. Now hand the card to someone.</span>`, true);
    });

    skipBtn.addEventListener('click', () => {
      if (!current || resolved) return;
      resolved = true;
      doneBtn.disabled = true;
      skipBtn.disabled = true;
      say(`${star('star')}<span><strong>Skipped.</strong> No penalty. The night goes on.</span>`);
    });

    renderXP();
  })();

  /* ------------------------------------------------------------------
     Rarity list
     ------------------------------------------------------------------ */
  $('#rarity-list').innerHTML = Object.entries(RARITY).map(([k, r]) => `
    <li class="rrow" data-r="${k}">
      ${rtag(k)}
      <p class="rrow__blurb">${r.blurb}</p>
      <span class="label">${r.xp} XP</span>
      <div class="xpbar" role="img" aria-label="${r.count} of 120 cards in each deck"><span style="width:${Math.max(2, (r.count / 120) * 100)}%"></span></div>
      <span class="label">${r.count} / 120</span>
    </li>`).join('');

  /* ------------------------------------------------------------------
     Cart
     ------------------------------------------------------------------ */
  const cart = {};
  const cartD = $('#cart-dialog');
  const cartCount = () => Object.values(cart).reduce((a, b) => a + b, 0);
  const cartTotal = () => Object.entries(cart).reduce((s, [id, q]) => s + PBY[id].price * q, 0);

  function renderCart() {
    const n = cartCount();
    $('#cart-count').textContent = n;
    $('#cart-open').setAttribute('aria-label', `Open cart, ${n} item${n === 1 ? '' : 's'}`);
    $('#cart-subtotal').textContent = money(cartTotal());
    $('#cart-checkout').disabled = n === 0;
    const ids = Object.keys(cart);
    $('#cart-items').innerHTML = ids.length
      ? ids.map((id) => {
          const p = PBY[id];
          return `<li class="cart-line">
            <div><strong>${p.name}</strong><div class="body-sm muted">${money(p.price)} each</div></div>
            <span class="price">${money(p.price * cart[id])}</span>
            <div class="qty" role="group" aria-label="Quantity for ${p.name}">
              <button type="button" data-act="dec" data-id="${id}" aria-label="One fewer">−</button>
              <output>${cart[id]}</output>
              <button type="button" data-act="inc" data-id="${id}" aria-label="One more">+</button>
            </div>
            <button class="linkbtn" type="button" data-act="rm" data-id="${id}" style="justify-self:end">Remove</button>
          </li>`;
        }).join('')
      : '<li class="cart-empty">Your cart is empty. The night, however, is full of quests.</li>';
  }

  function addToCart(id, btn) {
    cart[id] = (cart[id] || 0) + 1;
    renderCart();
    live(`Added ${PBY[id].name} to cart. ${cartCount()} items in cart.`);
    if (btn) {
      const old = btn.dataset.label || btn.textContent;
      btn.dataset.label = old;
      btn.textContent = 'Added';
      setTimeout(() => { btn.textContent = old; }, 1200);
    }
  }

  $('#cart-open').addEventListener('click', () => { renderCart(); cartD.showModal(); });
  $('#cart-close').addEventListener('click', () => cartD.close());
  cartD.addEventListener('click', (e) => { if (e.target === cartD) cartD.close(); });
  $('#cart-items').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    const id = b.dataset.id;
    if (b.dataset.act === 'inc') cart[id]++;
    if (b.dataset.act === 'dec') { cart[id]--; if (cart[id] <= 0) delete cart[id]; }
    if (b.dataset.act === 'rm') delete cart[id];
    renderCart();
  });
  const mockD = $('#mock-dialog');
  $('#cart-checkout').addEventListener('click', () => { cartD.close(); mockD.showModal(); });
  $('#mock-close').addEventListener('click', () => mockD.close());
  mockD.addEventListener('click', (e) => { if (e.target === mockD) mockD.close(); });

  /* ------------------------------------------------------------------
     Editions
     ------------------------------------------------------------------ */
  $('#editions-grid').innerHTML = EDITIONS.map((e, i) => `
    <article class="ed" data-accent="${e.accent}">
      <div class="art art--wide">
        <svg class="orn orn--tl" viewBox="0 0 100 100" aria-hidden="true"><use href="#orn-corner"/></svg>
        <svg class="orn orn--tr" viewBox="0 0 100 100" aria-hidden="true"><use href="#orn-corner"/></svg>
        <svg class="orn orn--bl" viewBox="0 0 100 100" aria-hidden="true"><use href="#orn-corner"/></svg>
        <svg class="orn orn--br" viewBox="0 0 100 100" aria-hidden="true"><use href="#orn-corner"/></svg>
        <div class="ed__no"><span class="label">Edition</span><b>${e.no}</b></div>
      </div>
      <div class="ed__meta label">${star('star')}${e.status}</div>
      <h3 class="t-md">${e.name}</h3>
      <p>${e.copy}</p>
      <p class="label">${e.cards} cards${e.no === '01' || e.no === '02' ? ' · 5 rarities' : ''}</p>
      <div class="ed__foot">
        <span class="price">${money(e.price)}</span>
        ${e.add
          ? `<button class="btn btn--ghost btn--sm" type="button" data-add="${e.add}">${e.cta}</button>`
          : `<button class="btn btn--ghost btn--sm" type="button" data-notify="${i}">${e.cta}</button>`}
      </div>
    </article>`).join('');

  $('#editions-grid').addEventListener('click', (e) => {
    const n = e.target.closest('[data-notify]');
    if (n) {
      n.outerHTML = `<span class="note-ok body-sm"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>You’re on the list</span>`;
      live('You are on the list for Edition 04, Dawn.');
    }
  });

  /* ------------------------------------------------------------------
     Shop
     ------------------------------------------------------------------ */
  $('#shop-grid').innerHTML = PRODUCTS.map((p) => `
    <article class="prod${p.feature ? ' prod--feature' : ''}" data-r="${p.rarity}">
      <div class="art art--square">
        <svg class="orn orn--tl" viewBox="0 0 100 100" aria-hidden="true"><use href="#orn-corner"/></svg>
        <svg class="orn orn--br" viewBox="0 0 100 100" aria-hidden="true"><use href="#orn-corner"/></svg>
        ${productArt(p.art)}
      </div>
      <div class="prod__top">${rtag(p.rarity)}<span class="label">${p.kind}</span></div>
      <h3 class="t-md" style="font-size:24px;line-height:28px">${p.name}</h3>
      <p>${p.desc}</p>
      <div class="prod__foot">
        <span class="price">${money(p.price)}</span>
        <button class="btn ${p.feature ? 'btn--primary' : 'btn--ghost'} btn--sm" type="button" data-add="${p.id}">${p.kind === 'Pre-order' ? 'Pre-order' : 'Add to cart'}</button>
      </div>
    </article>`).join('');

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-add]');
    if (b) addToCart(b.dataset.add, b);
  });

  /* ------------------------------------------------------------------
     Archive + card viewer
     ------------------------------------------------------------------ */
  const chips = $('#chips'), grid = $('#archive-grid');
  let filter = 'all';
  const sorted = [...QUESTS].sort((a, b) => a.n - b.n);

  function renderChips() {
    const opts = [['all', 'All', QUESTS.length], ...Object.entries(RARITY).map(([k, r]) => [k, r.name, QUESTS.filter((q) => q.rarity === k).length])];
    chips.innerHTML = opts.map(([k, name, n]) => `<button class="chip" type="button" data-f="${k}" aria-pressed="${filter === k}">${name} · ${n}</button>`).join('');
  }
  function renderGrid() {
    const list = sorted.filter((q) => filter === 'all' || q.rarity === filter);
    grid.innerHTML = list.map((q) => `<li>${qstatic(q)}<button class="hit" type="button" data-n="${q.n}" aria-label="Pick up ${q.title}, ${RARITY[q.rarity].name}"></button></li>`).join('');
    live(`Showing ${list.length} card${list.length === 1 ? '' : 's'}.`);
  }
  chips.addEventListener('click', (e) => {
    const b = e.target.closest('[data-f]');
    if (!b) return;
    filter = b.dataset.f;
    renderChips();
    renderGrid();
    $(`[data-f="${filter}"]`, chips).focus();
  });
  renderChips();
  renderGrid();

  const cardD = $('#card-dialog'), cardSlot = $('#card-dialog-slot');
  grid.addEventListener('click', (e) => {
    const b = e.target.closest('[data-n]');
    if (!b) return;
    const q = QUESTS.find((x) => x.n === Number(b.dataset.n));
    $('#viewer-title').textContent = q.title;
    cardSlot.innerHTML = qcard(q, { lift: true, flipped: true });
    $('#card-dialog-meta').textContent = `No. ${pad(q.n)} of 120 · ${RARITY[q.rarity].name} · ${RARITY[q.rarity].xp} XP`;
    $('#card-dialog-flip').textContent = 'Show the front';
    cardD.showModal();
  });
  $('#card-dialog-flip').addEventListener('click', (e) => {
    const c = $('.qcard', cardSlot), back = $('.qface--back', c);
    const on = c.classList.toggle('is-flipped');
    back.setAttribute('aria-hidden', !on);
    e.currentTarget.textContent = on ? 'Show the front' : 'Flip card';
  });
  $('#card-dialog-add').addEventListener('click', (e) => addToCart('p-ed1', e.currentTarget));
  $('#card-close').addEventListener('click', () => cardD.close());
  cardD.addEventListener('click', (e) => { if (e.target === cardD) cardD.close(); });

  /* ------------------------------------------------------------------
     Forms (mockups: nothing is sent anywhere)
     ------------------------------------------------------------------ */
  function mockForm(form, msg, okText) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      let bad = null;
      $$('input', form).forEach((i) => {
        const empty = i.required && !i.value.trim();
        const badMail = i.type === 'email' && i.value && !/^\S+@\S+\.\S+$/.test(i.value);
        i.setAttribute('aria-invalid', empty || badMail ? 'true' : 'false');
        if ((empty || badMail) && !bad) bad = i;
      });
      if (bad) {
        msg.className = 'form__msg form__msg--err body-sm';
        msg.textContent = `Error: please check the ${bad.type === 'email' ? 'email address' : (form.querySelector(`label[for="${bad.id}"]`)?.textContent || 'field').toLowerCase()}.`;
        bad.focus();
        return;
      }
      msg.className = 'form__msg form__msg--ok body-sm';
      msg.innerHTML = `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>${okText}`;
      form.reset();
    });
  }
  mockForm($('#venue-form'), $('#venue-msg'), 'Request noted. This is a mockup, so nobody will read it.');
  mockForm($('#news-form'), $('#news-msg'), 'You’re on the guest list. (Mockup: you aren’t.)');

  /* ------------------------------------------------------------------
     Theme + nav
     ------------------------------------------------------------------ */
  const root = document.documentElement, themeBtn = $('#theme-toggle');
  function setTheme(t, save) {
    root.setAttribute('data-theme', t);
    themeBtn.setAttribute('aria-pressed', String(t === 'dawn'));
    themeBtn.setAttribute('aria-label', t === 'dawn' ? 'Switch to the Night theme' : 'Switch to the Dawn theme');
    $('#theme-label').textContent = t === 'dawn' ? 'Night' : 'Dawn';
    if (save) { try { localStorage.setItem('sq-theme', t); } catch (_) {} }
  }
  setTheme(root.getAttribute('data-theme') || 'night', false);
  themeBtn.addEventListener('click', () => setTheme(root.getAttribute('data-theme') === 'dawn' ? 'night' : 'dawn', true));

  const nav = $('#nav'), navBtn = $('#nav-toggle');
  navBtn.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    navBtn.setAttribute('aria-expanded', String(open));
  });
  nav.addEventListener('click', (e) => {
    if (e.target.closest('a')) { nav.classList.remove('open'); navBtn.setAttribute('aria-expanded', 'false'); }
  });

  renderCart();
})();
