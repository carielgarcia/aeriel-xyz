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
      'nojs': 'I can only talk if your browser runs scripts. Please turn them on!',
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
      'door.epithet': 'A little wood elf guards this story.',
      'door.greeting': [
        'Ah! Someone told me people would come. I didn\'t think anyone would be interested, to be honest. Good for you.',
        'I am the Doorward. My cousin Machiavell told me I should be here guarding his story from AI bots trying to scrape them and to make sure only those who are true of heart and know the words can access it.',
        'Behind me there is a book, written one chapter at a time.',
        'Tell me your name, and I will remember it. Then give me the phrase and I will decide whether you belong here.'
      ],
      'door.refusal.wrong-phrase': 'Hm, that is not it. My cousin Machiavell said the words have to be exact. Try again?',
      'door.refusal.too-many': 'You have tried too many times and I am getting nervous. Please come back in a little while, okay?',
      'door.refusal.bad-name': 'I need a name I can remember: two to thirty-two letters or numbers, nothing fancy.',
      'door.refusal.not-configured': 'Oh no, the lock is not ready yet. Somebody should tell my cousin.',
      'door.refusal.network': 'The wind blew that away. Say it again?',
      'door.nameLabel': 'What are you called?',
      'door.nameHint': 'This name will sign every note you leave.',
      'door.phraseLabel': 'The phrase',
      'door.submit': 'Present the phrase',
      'door.welcome': 'You said it right! Welcome, {n}. I will remember your name. Mind the stairs, they are steep. My cousin says to read well and leave your notes.',

      'hero.label': 'A book, in chapters',
      'hero.tagline': 'A secret my cousin trusted me to guard.',

      'library.title': 'The chapters',
      'library.label': 'The reading room',
      'library.heading': 'The Chapters',
      'library.welcomeBack': [
        'You came back, {n}! I kept your name safe.',
        'Hi again, {n}. The chapters are right where you left them, I checked.',
        'Welcome back, {n}. Read well, and leave your notes!'
      ],
      'library.quote': '“{line}” — the Doorward',
      'library.error': 'The shelves are stuck. Try again in a moment.',
      'library.empty': 'There is nothing on the shelves yet.',
      'library.sealed': 'Sealed',
      'library.sealedNote': 'My cousin has not told me to open this one yet.',
      'library.released': 'Released {d}',
      'library.tba': 'To be announced',
      'library.remark.one': '{c} remark',
      'library.remark.many': '{c} remarks',
      'library.original': 'in the original English',

      'chapter.label': 'Chapter {r}',
      'chapter.titled': 'Chapter {r}: {t}',
      'chapter.fetching': 'I am going to get the pages. Wait a moment…',
      'chapter.sealedLine': 'That door is shut. My cousin did not say I could open it yet, and I do not want to get in trouble.',
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
      'nojs': 'Solo puedo hablar si tu navegador ejecuta scripts. ¡Por favor, actívalos!',
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
      'door.epithet': 'Un pequeño elfo del bosque custodia esta historia.',
      'door.greeting': [
        '¡Ah! Alguien me dijo que vendría gente. La verdad, no pensé que a nadie le fuera a interesar. Qué bueno por ti.',
        'Soy el Guardapuertas. Mi primo Machiavell me pidió que estuviera aquí cuidando su historia de los bots de IA que intentan extraerla, y asegurándome de que solo puedan entrar quienes tienen un corazón sincero y conocen las palabras.',
        'Detrás de mí hay un libro, escrito un capítulo a la vez.',
        'Dime tu nombre y lo recordaré. Luego dame la frase y decidiré si perteneces aquí.'
      ],
      'door.refusal.wrong-phrase': 'Mmm, esa no es. Mi primo Machiavell dijo que las palabras tienen que ser exactas. ¿Lo intentas de nuevo?',
      'door.refusal.too-many': 'Has intentado demasiadas veces y me estoy poniendo nervioso. Vuelve en un ratito, ¿sí?',
      'door.refusal.bad-name': 'Necesito un nombre que pueda recordar: de dos a treinta y dos letras o números, nada complicado.',
      'door.refusal.not-configured': 'Ay, no, la cerradura todavía no está lista. Alguien debería avisarle a mi primo.',
      'door.refusal.network': 'El viento se llevó eso. ¿Lo dices otra vez?',
      'door.nameLabel': '¿Cómo te llamas?',
      'door.nameHint': 'Este nombre firmará cada nota que dejes.',
      'door.phraseLabel': 'La frase',
      'door.submit': 'Presentar la frase',
      'door.welcome': '¡Lo dijiste bien! Adelante, {n}. Recordaré tu nombre. Cuidado con la escalera, es empinada. Mi primo dice que leas con calma y dejes tus notas.',

      'hero.label': 'Un libro, en capítulos',
      'hero.tagline': 'Un secreto que mi primo me confió para que lo cuide.',

      'library.title': 'Los capítulos',
      'library.label': 'La sala de lectura',
      'library.heading': 'Los Capítulos',
      'library.welcomeBack': [
        '¡Volviste, {n}! Guardé bien tu nombre.',
        'Hola otra vez, {n}. Los capítulos están donde los dejaste, lo revisé.',
        'De vuelta, {n}. ¡Lee bien y deja tus notas!'
      ],
      'library.quote': '“{line}”, el Guardapuertas',
      'library.error': 'Los estantes se atascaron. Inténtalo en un momento.',
      'library.empty': 'Todavía no hay nada en los estantes.',
      'library.sealed': 'Sellado',
      'library.sealedNote': 'Mi primo todavía no me dijo que abra este.',
      'library.released': 'Publicado el {d}',
      'library.tba': 'Por anunciar',
      'library.remark.one': '{c} observación',
      'library.remark.many': '{c} observaciones',
      'library.original': 'en el inglés original',

      'chapter.label': 'Capítulo {r}',
      'chapter.titled': 'Capítulo {r}: {t}',
      'chapter.fetching': 'Voy a buscar las páginas. Espera un momento…',
      'chapter.sealedLine': 'Esa puerta está cerrada. Mi primo no me dijo que la abriera todavía, y no quiero meterme en problemas.',
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
