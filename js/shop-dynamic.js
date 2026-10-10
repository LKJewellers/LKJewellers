/* Live products published from LK Studio: latest.html (grid) and item.html?s=slug (detail).
   Reads only the public website_products feed: published pieces, customer-facing fields. */
(function () {
  const { $, esc, money } = LK, root = $('#app');
  if (!LK.configured) { root.innerHTML = '<p class="muted center">Our latest pieces will appear here soon.</p>'; return; }
  const price = p => p.price_pence != null ? money(p.price_pence) : 'Price on request';
  const card = p => `<article class="prod"><a class="art" href="item.html?s=${encodeURIComponent(p.slug)}">
    <img src="${esc(LK.productImage(p.image_path))}" alt="${esc(p.name)}" loading="lazy" width="600" height="600"></a>
    <div class="info"><h3><a href="item.html?s=${encodeURIComponent(p.slug)}">${esc(p.name)}</a></h3><p class="price">${price(p)}</p></div></article>`;

  if (document.body.dataset.page === 'latest') {
    LK.db.from('website_products').select('*').order('published_at', { ascending: false }).then(({ data, error }) => {
      if (error || !data || !data.length) { root.innerHTML = '<p class="muted center">New pieces are on their way. Please check back soon.</p>'; return; }
      root.innerHTML = '<div class="grid live-grid">' + data.map(card).join('') + '</div>';
    });
  } else {
    const slug = new URLSearchParams(location.search).get('s') || '';
    LK.db.from('website_products').select('*').eq('slug', slug).maybeSingle().then(({ data: p }) => {
      if (!p) { root.innerHTML = '<p class="muted center">We could not find that piece. <a href="latest.html">See what is new</a>.</p>'; return; }
      document.title = p.name + ' | LK Jewellers London';
      const imgs = (p.images || []).length ? p.images : [p.image_path];
      const details = [['Metal', p.metal], ['Stone', p.gemstone], ['Material', p.material]].filter(x => x[1]);
      root.innerHTML = `<div class="item"><div><img id="mainimg" src="${esc(LK.productImage(imgs[0]))}" alt="${esc(p.name)}" width="800" height="800">
        ${imgs.length > 1 ? `<div class="thumbs-row">${imgs.map((im, i) => `<button type="button" data-i="${i}" aria-label="Photo ${i + 1}"><img src="${esc(LK.productImage(im))}" alt="" loading="lazy"></button>`).join('')}</div>` : ''}</div>
        <div><span class="label">${esc(p.category || '')}</span><h1>${esc(p.name)}</h1><p class="price">${price(p)}</p>
        <p class="desc">${esc(p.description).replace(/\n/g, '<br>')}</p>
        ${details.length ? `<dl class="spec">${details.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>` : ''}
        ${p.available ? '' : '<p class="muted">Currently sold out. Ask us about making one for you.</p>'}
        <a class="btn solid" href="contact.html?enquire=${encodeURIComponent(p.name + (p.sku ? ' (' + p.sku + ')' : ''))}">Enquire about this piece</a></div></div>`;
      root.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { $('#mainimg').src = LK.productImage(imgs[+b.dataset.i]); });
    });
  }
})();
