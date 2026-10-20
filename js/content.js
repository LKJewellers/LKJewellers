/* Replaces text on the page when the admin has edited it. Any element with
   data-content="key" is overwritten by the public setting of the same key. If
   nothing is set (or the database is unreachable) the original text stays. */
(function () {
  if (!window.LK || !LK.configured) return;
  const els = LK.$$('[data-content]'); if (!els.length) return;
  LK.db.from('settings').select('key,value').eq('is_public', true).in('key', els.map(e => e.dataset.content))
    .then(({ data }) => {
      (data || []).forEach(r => {
        const t = typeof r.value === 'string' ? r.value : null; if (!t || !t.trim()) return;
        LK.$$('[data-content="' + r.key + '"]').forEach(el => {
          el.textContent = '';                                  // textContent only: no HTML can be injected
          t.split('\n').forEach((line, i) => { if (i) el.appendChild(document.createElement('br')); el.appendChild(document.createTextNode(line)); });
        });
      });
    });
})();
