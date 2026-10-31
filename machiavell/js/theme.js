/* ledger (parchment) by day, lamplit (night) by preference; remembered if storage allows */
(function () {
  var t = null;
  try { t = localStorage.getItem('mv-theme'); } catch (e) {}
  if (t !== 'ledger' && t !== 'lamplit') t = window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'lamplit' : 'ledger';
  document.documentElement.setAttribute('data-theme', t);
})();
