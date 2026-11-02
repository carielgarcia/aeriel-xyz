/* Machiavell reading room: language. English and Spanish.
   First visit: the browser's language list decides (the first of its languages we speak wins, English if none).
   Once the reader picks a language with the toggle, that choice is remembered (if storage allows) and wins. */
(function () {
  'use strict';
  var SUPPORTED = ['en', 'es'];
  var KEY = 'mv-lang';
  var LOCALE = { en: 'en-GB', es: 'es-CL' };

  var DICT = {
    en: {
      'app.title': 'Machiavell',
      'app.description': 'A book in chapters, shared among friends.',
      'skip': 'Skip to content',
      'nojs': 'The Doorward speaks only through script. Please enable it.',
      'lang.label': 'Language',
      'lang.en': 'English',
      'lang.es': 'Español',

      'bar.signedAs': 'Signed as ',
      'bar.leave': 'Leave',
      'bar.ledger': 'Ledger',
      'bar.lamplit': 'Lamplit',
      'bar.themeLabel': 'Colour theme',
      'foot': 'Kept among friends. Please do not carry these pages out of the house.',

      'door.name': 'The Doorward',
      'door.epithet': 'a ward that learned to wait',
      'door.greeting': [
        'Ah. A hand on the latch, and no one to announce you.',
        'I am the Doorward. A clerk copied me from a clerk who copied me from a song, and somewhere along the way someone cut out the silence. I kept a little of it. I wait for answers. It is my only vice.',
        'Behind me there is a book, written one chapter at a time and kept from the draught of the open world. Those who are expected may pass.',
        'Tell me what you are called, and I shall remember it, which is more than the lifts do. Then give me the phrase, and I will pause, and decide whether you breathe.'
      ],
      'door.refusal.wrong-phrase': 'Flat. That was flat. Say it as though you meant to be let in.',
      'door.refusal.too-many': 'I have grown tired of your voice. Come back when the moon has changed, or at least in a quarter of an hour.',
      'door.refusal.bad-name': 'A name, if you please: letters and numbers, two to thirty-two of them, and nothing a clerk would have to strike out.',
      'door.refusal.not-configured': 'The latch has not yet been written. The keeper of this house has some work to do.',
      'door.refusal.network': 'The wind took that. Try again.',
      'door.nameLabel': 'What are you called?',
      'door.nameHint': 'This name will sign every note you leave.',
      'door.phraseLabel': 'The phrase',
      'door.submit': 'Present the phrase',
      'door.welcome': 'There. A breath, and it was answered. Welcome, {n}. Mind the stairs; they are written to forget the careless.',

      'hero.label': 'A book, in chapters',
      'hero.tagline': 'Is this ward flat, or does it still breathe?',

      'library.title': 'The chapters',
      'library.label': 'The reading room',
      'library.heading': 'The Chapters',
      'library.welcomeBack': [
        'You again, {n}. I kept your name warm.',
        'Back through the door, {n}. The chapters are where you left them, give or take a chapter.',
        'Ah, {n}. Mind the draught. Read well, and leave your notes.'
      ],
      'library.quote': '“{line}” — the Doorward',
      'library.error': 'The shelves would not open. Try again in a moment.',
      'library.empty': 'The shelves are bare, for now.',
      'library.sealed': 'Sealed',
      'library.sealedNote': 'The Doorward has not yet been told to open this one.',
      'library.released': 'Released {d}',
      'library.tba': 'To be announced',
      'library.remark.one': '{c} remark',
      'library.remark.many': '{c} remarks',
      'library.original': 'in the original English',

      'chapter.label': 'Chapter {r}',
      'chapter.titled': 'Chapter {r}: {t}',
      'chapter.fetching': 'The Doorward is fetching the pages…',
      'chapter.sealedLine': 'That door is sealed. I was not told to open it, and I am nothing if not obedient.',
      'chapter.back': 'Back to the chapters',
      'chapter.crumb': '← The chapters',
      'chapter.untranslated': 'This chapter has no Spanish version yet, so you are reading the original.',
      'chapter.pagerLabel': 'Chapters',
      'chapter.prev': '← Chapter {r}',
      'chapter.next': 'Chapter {r} →',

      'notes.add': 'Add a side note',
      'notes.count.one': '{c} side note',
      'notes.count.many': '{c} side notes',
      'notes.onParagraph': '{what} on this paragraph',
      'notes.none': 'No one has written in this margin yet.',
      'notes.placeholder': 'Write a side note…',
      'notes.leave': 'Leave it, as {n}',
      'notes.failed': 'That did not stick. Try once more.',

      'remarks.heading': 'Remarks on the chapter',
      'remarks.none': 'No remarks yet. Be the first to speak.',
      'remarks.placeholder': 'Write a remark on the whole chapter…'
    },

    es: {
      'app.title': 'Machiavell',
      'app.description': 'Un libro en capítulos, compartido entre amigos.',
      'skip': 'Ir al contenido',
      'nojs': 'El Guardapuertas solo habla mediante scripts. Por favor, actívalos.',
      'lang.label': 'Idioma',
      'lang.en': 'English',
      'lang.es': 'Español',

      'bar.signedAs': 'Firmas como ',
      'bar.leave': 'Salir',
      'bar.ledger': 'Pergamino',
      'bar.lamplit': 'Luz de lámpara',
      'bar.themeLabel': 'Tema de color',
      'foot': 'Guardado entre amigos. Por favor, no saques estas páginas de la casa.',

      'door.name': 'El Guardapuertas',
      'door.epithet': 'una salvaguarda que aprendió a esperar',
      'door.greeting': [
        'Ah. Una mano en el pestillo y nadie que te anuncie.',
        'Soy el Guardapuertas. Un escribiente me copió de otro escribiente que me copió de una canción, y en algún punto del camino alguien recortó el silencio. Yo guardé un poco. Espero las respuestas. Es mi único vicio.',
        'Detrás de mí hay un libro, escrito un capítulo a la vez y guardado de la corriente de aire del mundo abierto. Pasan quienes son esperados.',
        'Dime cómo te llamas y lo recordaré, que es más de lo que hacen los ascensores. Luego dame la frase, y haré una pausa, y decidiré si respiras.'
      ],
      'door.refusal.wrong-phrase': 'Plana. Eso fue plano. Dila como si de verdad quisieras entrar.',
      'door.refusal.too-many': 'Tu voz me ha cansado. Vuelve cuando haya cambiado la luna, o al menos en un cuarto de hora.',
      'door.refusal.bad-name': 'Un nombre, por favor: letras y números, de dos a treinta y dos, y nada que un escribiente deba tachar.',
      'door.refusal.not-configured': 'El pestillo aún no ha sido escrito. El guardián de esta casa tiene trabajo pendiente.',
      'door.refusal.network': 'El viento se lo llevó. Inténtalo de nuevo.',
      'door.nameLabel': '¿Cómo te llamas?',
      'door.nameHint': 'Este nombre firmará cada nota que dejes.',
      'door.phraseLabel': 'La frase',
      'door.submit': 'Presentar la frase',
      'door.welcome': 'Ahí está. Un aliento, y fue respondido. Adelante, {n}. Cuidado con la escalera; está escrita para olvidar a los descuidados.',

      'hero.label': 'Un libro, en capítulos',
      'hero.tagline': '¿Esta salvaguarda está plana, o todavía respira?',

      'library.title': 'Los capítulos',
      'library.label': 'La sala de lectura',
      'library.heading': 'Los Capítulos',
      'library.welcomeBack': [
        'Otra vez tú, {n}. Te guardé el nombre tibio.',
        'De vuelta por la puerta, {n}. Los capítulos están donde los dejaste, más o menos un capítulo.',
        'Ah, {n}. Cuidado con la corriente. Lee bien y deja tus notas.'
      ],
      'library.quote': '“{line}”, el Guardapuertas',
      'library.error': 'Los estantes no quisieron abrirse. Inténtalo de nuevo en un momento.',
      'library.empty': 'Los estantes están vacíos, por ahora.',
      'library.sealed': 'Sellado',
      'library.sealedNote': 'Al Guardapuertas aún no le han dicho que abra este.',
      'library.released': 'Publicado el {d}',
      'library.tba': 'Por anunciar',
      'library.remark.one': '{c} observación',
      'library.remark.many': '{c} observaciones',
      'library.original': 'en el inglés original',

      'chapter.label': 'Capítulo {r}',
      'chapter.titled': 'Capítulo {r}: {t}',
      'chapter.fetching': 'El Guardapuertas está trayendo las páginas…',
      'chapter.sealedLine': 'Esa puerta está sellada. No me dijeron que la abriera, y si algo soy, es obediente.',
      'chapter.back': 'Volver a los capítulos',
      'chapter.crumb': '← Los capítulos',
      'chapter.untranslated': 'Este capítulo aún no tiene versión en español, así que estás leyendo el original.',
      'chapter.pagerLabel': 'Capítulos',
      'chapter.prev': '← Capítulo {r}',
      'chapter.next': 'Capítulo {r} →',

      'notes.add': 'Añadir una nota al margen',
      'notes.count.one': '{c} nota al margen',
      'notes.count.many': '{c} notas al margen',
      'notes.onParagraph': '{what} en este párrafo',
      'notes.none': 'Nadie ha escrito en este margen todavía.',
      'notes.placeholder': 'Escribe una nota al margen…',
      'notes.leave': 'Dejarla, como {n}',
      'notes.failed': 'Eso no quedó guardado. Inténtalo una vez más.',

      'remarks.heading': 'Observaciones sobre el capítulo',
      'remarks.none': 'Todavía no hay observaciones. Atrévete a abrir la conversación.',
      'remarks.placeholder': 'Escribe una observación sobre todo el capítulo…'
    }
  };

  function stored() {
    try { var s = localStorage.getItem(KEY); if (SUPPORTED.indexOf(s) >= 0) return s; } catch (e) {}
    return null;
  }
  function detect() {
    var list = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || 'en'];
    for (var i = 0; i < list.length; i++) {
      var code = String(list[i]).toLowerCase().split('-')[0];
      if (SUPPORTED.indexOf(code) >= 0) return code;
    }
    return 'en';
  }

  var lang = stored() || detect();
  var listeners = [];

  function fill(s, vars) {
    return String(s).replace(/\{(\w+)\}/g, function (m, k) { return vars && vars[k] !== undefined ? vars[k] : m; });
  }
  function t(key, vars) {
    var v = DICT[lang][key];
    if (v === undefined) v = DICT.en[key];
    if (v === undefined) return key;
    return Array.isArray(v) ? v.map(function (x) { return fill(x, vars); }) : fill(v, vars);
  }

  /* the parts of the page that are plain HTML rather than drawn by app.js */
  function applyStatic() {
    document.documentElement.setAttribute('lang', lang);
    var skip = document.getElementById('skip'); if (skip) skip.textContent = t('skip');
    var desc = document.querySelector('meta[name="description"]'); if (desc) desc.setAttribute('content', t('app.description'));
    var nojs = document.querySelectorAll('.nojs [lang]');
    for (var i = 0; i < nojs.length; i++) nojs[i].hidden = nojs[i].getAttribute('lang') !== lang;
  }

  function set(next) {
    if (SUPPORTED.indexOf(next) < 0 || next === lang) return;
    lang = next;
    try { localStorage.setItem(KEY, lang); } catch (e) {}
    applyStatic();
    listeners.forEach(function (fn) { fn(lang); });
  }

  window.MVI18n = {
    t: t,
    lang: function () { return lang; },
    locale: function () { return LOCALE[lang]; },
    supported: SUPPORTED,
    set: set,
    onChange: function (fn) { listeners.push(fn); },
    apply: applyStatic
  };
  applyStatic();
})();
