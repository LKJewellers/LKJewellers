/* Live products published from LK Studio: latest (grid) and item?s=slug (detail).
   Reads only the public website_products feed: published pieces, customer-facing fields. */
(function () {
  const { $, esc, money } = LK, root = $('#app');
  if (!LK.configured) { root.innerHTML = '<p class="muted center">Our latest pieces will appear here soon.</p>'; return; }
  const price = p => p.price_pence != null ? money(p.price_pence) : 'Price on request';
  const card = p => `<article class="prod"><a class="art" href="item?s=${encodeURIComponent(p.slug)}">
    <img src="${esc(LK.productImage(p.image_path))}" alt="${esc(p.name)}" loading="lazy" width="600" height="600"></a>
    <div class="info"><h3><a href="item?s=${encodeURIComponent(p.slug)}">${esc(p.name)}</a></h3><p class="price">${price(p)}</p>
    ${p.buy_url ? `<a class="btn sm solid" href="${esc(p.buy_url)}" rel="noopener">Buy now</a>` : `<a class="btn sm" href="item?s=${encodeURIComponent(p.slug)}">View</a>`}</div></article>`;

  if (document.body.dataset.page === 'latest') {
    LK.db.from('website_products').select('*').order('published_at', { ascending: false }).then(({ data, error }) => {
      if (error || !data || !data.length) { root.innerHTML = '<p class="muted center">New pieces are on their way. Please check back soon.</p>'; return; }
      root.innerHTML = '<div class="grid live-grid">' + data.map(card).join('') + '</div>';
    });
  } else {
    const slug = new URLSearchParams(location.search).get('s') || '';
    LK.db.from('website_products').select('*').eq('slug', slug).maybeSingle().then(({ data: p }) => {
      if (!p) { root.innerHTML = '<p class="muted center">We could not find that piece. <a href="latest">See what is new</a>.</p>'; return; }
      document.title = p.name + ' | LK Jewellers London';
      const imgs = (p.images || []).length ? p.images : [p.image_path];
      // metal & diamond options: priced ones can be bought, the rest are "available on enquiry"
      const vs = (p.variants || []).filter(v => v && v.metal);
      const metals = [...new Set(vs.map(v => v.metal))];
      const hasLab = vs.some(v => v.diamond === 'lab');
      const def = vs.find(v => v.is_default && v.diamond === 'natural') || vs[0] || null;
      const st = { metal: def ? def.metal : (p.metal || ''), dia: 'natural' };
      const find = (m, d) => vs.find(v => v.metal === m && v.diamond === d);
      const diaName = d => d === 'lab' ? 'Lab-grown diamond' : 'Natural diamond';
      const optsHtml = () => !vs.length || (metals.length < 2 && !hasLab) ? '' : `<div class="opts">
          <div class="opt-l">Metal: <b>${esc(st.metal)}</b></div><div class="chips-row">${metals.map(m => { const v = find(m, st.dia);
            return `<button type="button" class="ochip ${m === st.metal ? 'on' : ''} ${v && v.price_pence ? '' : 'enq'}" data-metal="${esc(m)}">${esc(m)}${v && v.price_pence ? '' : '<small>On enquiry</small>'}</button>`; }).join('')}</div>
          ${hasLab ? `<div class="opt-l">Diamond: <b>${diaName(st.dia)}</b></div><div class="chips-row">${['natural', 'lab'].map(d => { const v = find(st.metal, d);
            return `<button type="button" class="ochip ${d === st.dia ? 'on' : ''} ${v && v.price_pence ? '' : 'enq'}" data-dia="${d}">${diaName(d)}${v && v.price_pence ? '' : '<small>On enquiry</small>'}</button>`; }).join('')}</div>` : ''}</div>`;
      const buyHtml = () => {
        const v = vs.length ? find(st.metal, st.dia) : null;
        const pp = vs.length ? (v && v.price_pence) : p.price_pence, url = vs.length ? (v && v.buy_url) : p.buy_url;
        const label = p.name + (vs.length && (metals.length > 1 || hasLab) ? ' – ' + st.metal + (hasLab ? ', ' + diaName(st.dia).toLowerCase() : '') : '') + (p.sku ? ' (' + p.sku + ')' : '');
        const enq = `contact?enquire=${encodeURIComponent(label)}`;
        const priceTxt = pp ? money(pp) : 'Available on enquiry';
        const canBuy = pp && url && p.available;
        return { price: `<p class="price${pp ? '' : ' por'}" id="vprice">${priceTxt}</p>`,
          actions: `${p.available ? '' : '<p class="muted">Currently sold out. Ask us about making one for you.</p>'}${canBuy ? `<a class="btn solid" href="${esc(url)}" rel="noopener">Buy now</a> ` : ''}<a class="btn${canBuy ? '' : ' solid'}" href="${enq}">${pp ? 'Enquire about this piece' : 'Enquire about this option'}</a>` };
      };
      const details = () => [['Metal', vs.length ? st.metal : p.metal], ['Stone', p.gemstone], ['Material', p.material]].filter(x => x[1]);
      const right = () => { const b = buyHtml(); return `<span class="label">${esc(p.category || '')}</span><h1>${esc(p.name)}</h1>${b.price}
        <p class="desc">${esc(p.description).replace(/\n/g, '<br>')}</p>${optsHtml()}
        <dl class="spec">${details().map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
        <div class="buyrow">${b.actions}</div>`; };
      root.innerHTML = `<div class="item"><div><img id="mainimg" src="${esc(LK.productImage(imgs[0]))}" alt="${esc(p.name)}" width="800" height="800">
        ${imgs.length > 1 ? `<div class="thumbs-row">${imgs.map((im, i) => `<button type="button" data-i="${i}" aria-label="Photo ${i + 1}"><img src="${esc(LK.productImage(im))}" alt="" loading="lazy"></button>`).join('')}</div>` : ''}
        ${(p.videos || []).map(v => `<video class="item-video" src="${esc(LK.productImage(v))}" autoplay muted playsinline loop preload="auto" disablepictureinpicture disableremoteplayback></video>`).join('')}</div>
        <div id="iright">${right()}</div></div>`;
      const box = $('#iright');
      box.addEventListener('click', e => {
        const b = e.target.closest('[data-metal],[data-dia]'); if (!b) return;
        if (b.dataset.metal) st.metal = b.dataset.metal; else st.dia = b.dataset.dia;
        box.innerHTML = right();
      });
      root.querySelectorAll('video.item-video').forEach(v => { v.muted = true; v.defaultMuted = true; const go = () => v.play().catch(() => {}); go(); v.addEventListener('canplay', go, { once: true }); });
      root.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { $('#mainimg').src = LK.productImage(imgs[+b.dataset.i]); });
    });
  }
})();
