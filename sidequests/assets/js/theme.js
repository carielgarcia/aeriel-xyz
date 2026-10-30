/* Applies the saved theme before first paint. External file so the site's Content-Security-Policy allows it. */
try {
  var t = localStorage.getItem('sq-theme');
  if (t === 'dawn' || t === 'night') document.documentElement.setAttribute('data-theme', t);
} catch (e) {}
