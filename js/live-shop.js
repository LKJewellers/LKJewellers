/* LK Jewellers: adds pieces published from LK Studio to the shop pages.
   Usage: <script src="js/config.js"></script><script src="js/live-shop.js" data-cats="Rings,Earrings"></script>
   data-cats  = the LK Studio categories shown on that page ("*" = everything).
   data-limit = optional, show at most this many pieces (used on the home page).
   Only reads the public website_products feed (published pieces, customer-facing fields).
   The pages ship with no products of their own: if nothing is published (or anything fails),
   the page shows its "being added" message, and sections marked data-live-sec stay hidden. */
(function () {
  var me = document.currentScript, C = window.LK_CONFIG || {};
  if (!C.SUPABASE_URL || /YOUR_/.test(C.SUPABASE_URL) || !C.SUPABASE_ANON_KEY) return;
  var list = function (a) { return (me.getAttribute(a) || '').split(',').map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean); };
  var want = list('data-cats'); if (!want.length) want = ['*'];
  var not = list('data-not');
  var limit = parseInt(me.getAttribute('data-limit'), 10) || 0;
  var base = C.SUPABASE_URL.replace(/\/$/, '');
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var img = function (p) { return p ? base + '/storage/v1/object/public/product-images/' + p.split('/').map(encodeURIComponent).join('/') : ''; };
  var money = function (p) { var v = p / 100; return '£' + v.toLocaleString('en-GB', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 }); };
  var first = function (t) { var m = String(t || '').match(/^[^.!?]*[.!?]/); return (m ? m[0] : String(t || '')).slice(0, 160); };
  fetch(base + '/rest/v1/website_products?select=slug,name,description,category,price_pence,image_path,published_at,buy_url&order=published_at.desc', {
    headers: { apikey: C.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + C.SUPABASE_ANON_KEY }
  }).then(function (r) { return r.ok ? r.json() : []; }).then(function (rows) {
    rows = (rows || []).filter(function (p) {
      var c = String(p.category || '').toLowerCase();
      return p.slug && p.image_path && (want.indexOf('*') > -1 || want.indexOf(c) > -1) && not.indexOf(c) === -1;
    });
    if (limit) rows = rows.slice(0, limit);
    var grid = document.querySelector('main .grid'); if (!grid || !rows.length) return;
    var htmlCards = rows.map(function (p) {
      var url = 'item?s=' + encodeURIComponent(p.slug);
      return '<article class="prod rv in live"><div class="gal"><div class="frame gal-main"><a href="' + url + '" tabindex="-1" aria-hidden="true">' +
        '<img src="' + esc(img(p.image_path)) + '" alt="' + esc(p.name) + '" width="1000" height="1000" loading="lazy" decoding="async"></a></div></div>' +
        '<div class="body"><h3><a href="' + url + '">' + esc(p.name) + '</a></h3><p>' + esc(first(p.description)) + '</p>' +
        '<div class="row">' + (p.price_pence != null ? '<span class="price">' + money(p.price_pence) + '</span>' : '<span class="price por">Price on request</span>') +
        (p.buy_url ? '<a class="btn sm" href="' + esc(p.buy_url) + '" rel="noopener">Buy now</a>' : '<a class="btn sm" href="' + url + '">View</a>') + '</div></div></article>';
    }).join('');
    grid.innerHTML = htmlCards;
    // pieces exist: drop the "being added" message and reveal any hidden live section
    [].forEach.call(document.querySelectorAll('.empty-msg'), function (n) { n.parentNode.removeChild(n); });
    var sec = grid.closest('[data-live-sec]'); if (sec) sec.hidden = false;
    if (!document.getElementById('live-shop-css')) {
      var st = document.createElement('style'); st.id = 'live-shop-css';
      st.textContent = '.prod.live .gal-main img{object-fit:contain}';
      document.head.appendChild(st);
    }
  }).catch(function () {});
})();
