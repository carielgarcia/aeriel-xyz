/* aeriel.xyz menu. Loaded in <head> without defer, so the language and theme are set before first paint.
   Same keys as the archive (preferred-lang, ae-theme), so a choice made on one page holds on the other. */
(function () {
  var root = document.documentElement, LANGS = ['en', 'es', 'pt'];

  /* Links shared before the archive moved (aeriel.xyz/?person=…, aeriel.xyz/#archive) still open the archive. */
  var FILTERS = ['person', 'house', 'org', 'event', 'series', 'space', 'hood', 'city', 'country', 'year', 'date', 'medium', 'camera',
    'stock', 'frame', 'color', 'light', 'time', 'theme', 'body', 'process', 'role', 'etype', 'stype', 'sound'];
  var q = new URLSearchParams(location.search);
  if (FILTERS.some(function (k) { return q.has(k); }) || /^#(archive|ar-|top$)/.test(location.hash)) {
    location.replace('/archive/' + location.search + location.hash);
    return;
  }

  var l = 'en';
  try { var s = localStorage.getItem('preferred-lang'); if (LANGS.indexOf(s) > -1) l = s; else throw 0; }
  catch (e) {
    var ls = navigator.languages || [navigator.language || ''];
    for (var i = 0; i < ls.length; i++) { var c = (ls[i] || '').slice(0, 2).toLowerCase(); if (LANGS.indexOf(c) > -1) { l = c; break; } }
  }
  root.lang = l;
  try { var t = localStorage.getItem('ae-theme'); if (t === 'light' || t === 'dark') root.setAttribute('data-theme', t); } catch (e) {}

  var TITLE = { en: 'ÆRIEL · A place for experimentation', es: 'ÆRIEL · Un lugar para experimentar', pt: 'ÆRIEL · Um lugar para experimentar' };
  var DESC = {
    en: 'Projects by ÆRIEL while they are under development: an analog archive of queer life and a book released one chapter at a time.',
    es: 'Proyectos de ÆRIEL mientras están en desarrollo: un archivo analógico de vida queer y un libro publicado capítulo a capítulo.',
    pt: 'Projetos de ÆRIEL enquanto estão em desenvolvimento: um arquivo analógico de vida queer e um livro lançado capítulo a capítulo.'
  };
  var THEME = { paper: { en: 'Paper', es: 'Papel', pt: 'Papel' }, night: { en: 'Night', es: 'Noche', pt: 'Noite' } };

  function isLight() { var t = root.getAttribute('data-theme'); return t ? t === 'light' : matchMedia('(prefers-color-scheme: light)').matches; }
  function sync() {
    var lang = root.lang;
    document.title = TITLE[lang];
    var d = document.querySelector('meta[name=description]'); if (d) d.setAttribute('content', DESC[lang]);
    document.querySelectorAll('[data-lang]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.lang === lang)); });
    document.querySelectorAll('[data-aria-' + lang + ']').forEach(function (el) { el.setAttribute('aria-label', el.getAttribute('data-aria-' + lang)); });
    var tb = document.getElementById('theme');
    if (tb) { var light = isLight(); tb.textContent = (light ? THEME.night : THEME.paper)[lang]; tb.setAttribute('aria-pressed', String(light)); }
  }
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-lang]').forEach(function (b) {
      b.addEventListener('click', function () { root.lang = b.dataset.lang; try { localStorage.setItem('preferred-lang', root.lang); } catch (e) {} sync(); });
    });
    var tb = document.getElementById('theme');
    if (tb) tb.addEventListener('click', function () {
      var t = isLight() ? 'dark' : 'light'; root.setAttribute('data-theme', t);
      try { localStorage.setItem('ae-theme', t); } catch (e) {} sync();
    });
    matchMedia('(prefers-color-scheme: light)').addEventListener('change', sync);
    sync();
  });
})();
