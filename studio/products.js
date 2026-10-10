/* LK Studio: Products — list, guided "Add product" flow, costing & pricing, owner review, publishing, stock. */
(function () {
  const { html, raw, icon, money, pct, date, dateTime, ago, pill, $, $$ } = S;
  const CATEGORIES = ['Engagement rings', 'Wedding bands', 'Rings', 'Earrings', 'Necklaces', 'Pendants', 'Bracelets', 'Bespoke', 'Gifts', 'Other'];
  const TYPES = [['stocked', 'Stocked item (we hold stock)'], ['one_off', 'One-off piece'], ['bespoke', 'Bespoke commission'], ['in_house', 'Made in-house'], ['service', 'Service (repair, resize…)']];
  const COST_KINDS = [['purchase', 'Purchase cost'], ['shipping', 'Shipping'], ['delivery', 'Delivery / courier'], ['import', 'Import duty / fees'], ['other', 'Other cost']];

  // ---------- costing (same maths as the database's product_costing) ----------
  S.costing = (p, costs, vat) => {
    const pq = Math.max(+p.purchase_qty || 1, 1);
    const per = c => c.basis === 'per_item' ? +c.amount_pence : +c.amount_pence / pq;
    const purchase = costs.filter(c => c.kind === 'purchase').reduce((a, c) => a + per(c), 0);
    const extra = costs.filter(c => c.kind !== 'purchase').reduce((a, c) => a + per(c), 0);
    const landed = purchase + extra, price = p.selling_price_pence;
    const reg = !vat || vat.registered !== false;
    const net = price == null ? null : reg ? price / (1 + (+p.vat_rate || 0) / 100) : price;
    const gp = net == null ? null : net - landed;
    return { pq, purchase: Math.round(purchase), extra: Math.round(extra), landed: Math.round(landed), price, net: net == null ? null : Math.round(net), gp: gp == null ? null : Math.round(gp),
      margin: net > 0 && gp != null ? Math.round(gp / net * 1000) / 10 : null, markup: landed > 0 && gp != null ? Math.round(gp / landed * 1000) / 10 : null,
      qty: +p.quantity || 0, revenue: net == null ? null : Math.round(net * (+p.quantity || 0)), profit: gp == null ? null : Math.round(gp * (+p.quantity || 0)), per, reg };
  };
  S.costingBlock = (k, costs, p) => html`<div class="calc">
      ${costs.length ? costs.map(c => html`<div class="r"><span>${S.label(c.kind)}${c.description ? ' · ' + c.description : ''}${c.basis === 'total' ? html` <span class="muted small">(${money(c.amount_pence)} ÷ ${k.pq} item${k.pq === 1 ? '' : 's'})</span>` : ''}</span><span>${money(Math.round(k.per(c)))}</span></div>`) : html`<div class="r"><span class="muted">No costs recorded yet</span><span>—</span></div>`}
      <div class="r tot"><span>Landed cost per item</span><span>${money(k.landed)}</span></div>
      <div class="r"><span>Selling price${k.reg ? ' (incl. VAT)' : ''}</span><span>${money(k.price)}</span></div>
      ${k.reg ? html`<div class="r op"><span>minus VAT at ${p.vat_rate}%</span><span>${k.price == null ? '—' : money(k.price - k.net)}</span></div><div class="r"><span>Net selling price</span><span>${money(k.net)}</span></div>` : ''}
      <div class="r op"><span>minus landed cost</span><span>${money(k.landed)}</span></div>
      <div class="r tot"><span>Gross profit per item</span><span style="color:${k.gp < 0 ? 'var(--rose-d)' : 'inherit'}">${money(k.gp)}</span></div></div>
    <div class="metric" style="margin-top:12px"><div><b>${pct(k.margin)}</b><span>Margin</span></div><div><b>${pct(k.markup)}</b><span>Markup</span></div><div><b>${k.qty}</b><span>In stock</span></div></div>
    ${k.qty > 0 && k.gp != null ? html`<p class="small muted" style="margin:10px 0 0">If all ${k.qty} in stock sell: revenue ${money(k.revenue)} (ex VAT), gross profit ${money(k.profit)}.</p>` : ''}
    <p class="explain" style="margin-top:12px"><b>Margin</b> is profit as a share of the net selling price (${k.gp != null && k.net ? money(k.gp) + ' ÷ ' + money(k.net) : 'profit ÷ net price'}). <b>Markup</b> is profit as a share of what the piece cost you (${k.gp != null && k.landed ? money(k.gp) + ' ÷ ' + money(k.landed) : 'profit ÷ landed cost'}).</p>`;

  const productThumb = p => { const im = (p.product_images || []).sort((a, b) => (b.is_primary - a.is_primary) || a.position - b.position)[0]; return im ? S.publicImg(im.path) : ''; };

  // =========================== LIST ===========================
  const SF = [['all', 'All'], ['draft', 'Drafts'], ['review', 'Awaiting review'], ['changes_requested', 'Changes requested'], ['approved', 'Approved'], ['published', 'Published'], ['unpublished', 'Unpublished'], ['publish_failed', 'Publishing failed'], ['low_stock', 'Low stock']];
  S.route('/products', async (v, p, live) => {
    const prm = S.params(); const st = prm.get('status') || 'all', cat = prm.get('cat') || '', sup = prm.get('sup') || '';
    const suppliers = S.must(await S.db.from('suppliers').select('id,name').is('deleted_at', null).order('name'));
    S.render(v, html`${S.page({ title: 'Products', sub: 'Your catalogue, from first photo to the website', acts: html`<a class="btn gold" href="#/products/new">${icon('camera')} Add product</a>` })}
      <div class="toolbar"><div class="search">${icon('search')}<input id="pq" placeholder="Name, SKU or supplier reference" aria-label="Search products"></div>
        <select id="pcat" aria-label="Category"><option value="">All categories</option>${S.opts(CATEGORIES.map(c => [c, c]), cat)}</select>
        <select id="psup" aria-label="Supplier"><option value="">All suppliers</option>${S.opts(suppliers.map(s => [s.id, s.name]), sup)}</select></div>
      <div class="scrollx" style="margin-bottom:16px"><div class="chips" style="flex-wrap:nowrap">${SF.map(([k, l]) => html`<a class="chip ${k === st ? 'on' : ''}" href="#/products?status=${k}${cat ? '&cat=' + encodeURIComponent(cat) : ''}${sup ? '&sup=' + sup : ''}">${l}</a>`)}</div></div>
      <div id="plist">${S.loading()}</div>`);
    const nav = () => { const q = new URLSearchParams({ status: st }); if ($('#pcat', v).value) q.set('cat', $('#pcat', v).value); if ($('#psup', v).value) q.set('sup', $('#psup', v).value); S.go('#/products?' + q); };
    $('#pcat', v).onchange = nav; $('#psup', v).onchange = nav;
    const load = async () => {
      const term = $('#pq', v).value.trim().replace(/[,()*]/g, ' ');
      let b = S.db.from('products').select('id,name,sku,status,category,quantity,low_stock_threshold,selling_price_pence,publish_status,product_type,updated_at,suppliers(name),product_images(path,is_primary,position)').is('deleted_at', null).order('updated_at', { ascending: false }).limit(300);
      if (st === 'review') b = b.in('status', ['ready_for_review', 'owner_review']);
      else if (st === 'publish_failed') b = b.eq('publish_status', 'failed').neq('status', 'published');
      else if (st !== 'all' && st !== 'low_stock') b = b.eq('status', st);
      if (cat) b = b.eq('category', cat); if (sup) b = b.eq('supplier_id', sup);
      if (term) b = b.or(`name.ilike.*${term}*,sku.ilike.*${term}*,supplier_ref.ilike.*${term}*`);
      const r = await b; if (!live()) return;
      if (r.error) return S.render($('#plist', v), S.errorState(S.friendly(r.error.message)));
      let rows = r.data; if (st === 'low_stock') rows = rows.filter(x => x.low_stock_threshold != null && x.quantity <= x.low_stock_threshold);
      S.render($('#plist', v), rows.length ? html`<div class="list">${rows.map(x => { const t = productThumb(x); return html`<a class="li" href="#/products/${x.id}">${t ? html`<img class="thumb" src="${t}" alt="" loading="lazy">` : html`<span class="ic" style="width:52px;height:52px">${icon('gem')}</span>`}
        <span class="main-t"><span class="t" style="display:block">${x.name || 'Untitled product'}</span><span class="d" style="display:block">${[x.sku, x.category, x.suppliers && x.suppliers.name].filter(Boolean).join(' · ') || 'Details not added yet'}</span></span>
        <span class="end">${pill('product', x.status)}${x.publish_status === 'failed' && x.status !== 'published' ? raw('<span class="pill red plain">Publishing failed</span>') : ''}
        <span class="tiny muted">${x.selling_price_pence != null ? money(x.selling_price_pence) : 'No price'}${['stocked', 'one_off'].includes(x.product_type) ? ' · ' + x.quantity + ' in stock' : ''}${x.low_stock_threshold != null && x.quantity <= x.low_stock_threshold ? ' · LOW' : ''}</span></span>${icon('chev', 'chev')}</a>`; })}</div>`
        : S.empty({ icon: 'gem', title: term || st !== 'all' ? 'No products match' : 'No products yet', text: 'Add your first product with the camera on your phone.', action: html`<a class="btn gold" href="#/products/new">${icon('camera')} Add product</a>` }));
    };
    let t; $('#pq', v).oninput = () => { clearTimeout(t); t = setTimeout(load, 250); }; load();
  });

  // =========================== NEW → draft ===========================
  S.route('/products/new', async v => {
    S.render(v, html`${S.page({ title: 'Add a product', crumb: ['Products', '#/products'] })}<div class="card" style="max-width:640px;text-align:center;padding:36px 22px">
      <div class="state" style="padding:0 0 10px"><div class="ill">${icon('camera')}</div><h3>Start with photos</h3><p>We will guide you through photos, details, supplier and invoice, costs and price. You can stop at any point and come back: everything is saved as a draft.</p></div>
      <button class="btn gold" id="start">${icon('plus')} Start new product</button></div>`);
    $('#start', v).onclick = e => S.act(e.currentTarget, async () => {
      const r = S.must(await S.db.from('products').insert({ name: '', created_by: S.user.id }).select('id').single()); S.go(`#/products/${r.id}/edit?step=photos`);
    }).catch(() => {});
  });

  // =========================== WIZARD ===========================
  const STEPS = [['photos', 'Photos'], ['details', 'Details'], ['supplier', 'Supplier'], ['costs', 'Costs'], ['price', 'Price'], ['review', 'Review']];
  S.route('/products/:id/edit', async (v, p, live) => {
    const step = S.params().get('step') || 'photos'; const i = STEPS.findIndex(s => s[0] === step);
    const prod = S.must(await S.db.from('products').select('*, suppliers(*)').eq('id', p.id).maybeSingle());
    if (!live()) return;
    if (!prod) return S.render(v, S.empty({ icon: 'gem', title: 'Product not found' }));
    const locked = ['approved', 'published', 'unpublished'].includes(prod.status) && !S.isOwner();
    S.render(v, html`${S.page({ title: prod.name || 'New product', crumb: ['Product', '#/products/' + prod.id], sub: html`${pill('product', prod.status)}` })}
      <nav class="steps" aria-label="Steps">${STEPS.map(([k, l], j) => html`<a href="#/products/${prod.id}/edit?step=${k}" class="${j < i ? 'done' : ''} ${j === i ? 'on' : ''}" ${j === i ? raw('aria-current="step"') : ''}><i></i>${j + 1}<span class="lbl">. ${l}</span></a>`)}</nav>
      ${prod.status === 'changes_requested' ? html`<div id="ownernote"></div>` : ''}
      ${locked ? S.banner('info', 'Approved product', 'You can update photos, details and costs. Only the owner can change the price of an approved product.') : ''}
      <div id="step" class="has-wizbar"></div>`);
    if (prod.status === 'changes_requested') {
      const n = S.must(await S.db.from('product_review_notes').select('*').eq('product_id', prod.id).eq('action', 'request_changes').order('created_at', { ascending: false }).limit(1))[0];
      if (n) S.render($('#ownernote', v), S.banner('warn', 'The owner asked for changes', html`<p class="pre" style="margin:4px 0 0">${n.note}</p>`));
    }
    const next = () => S.go(`#/products/${prod.id}/edit?step=${STEPS[Math.min(i + 1, STEPS.length - 1)][0]}`);
    const prev = i > 0 ? `#/products/${prod.id}/edit?step=${STEPS[i - 1][0]}` : '#/products/' + prod.id;
    await WIZ[step]($('#step', v), prod, { next, prev, locked });
  });

  const wizbar = (prev, label = 'Save & continue', id = 'nextb') => html`<div class="wizbar"><a class="btn" href="${prev}">${icon('back')} Back</a><button class="btn gold" id="${id}">${label} ${icon('right')}</button></div>`;

  const WIZ = {
    // ---------- 1. photos
    async photos(el, prod, w) {
      const draw = async () => {
        const imgs = S.must(await S.db.from('product_images').select('*').eq('product_id', prod.id).order('position'));
        S.render(el, html`<section class="card"><div class="ch"><div><h2>Photos</h2><p class="muted small">Add several angles. The photo marked <b>Main</b> is shown first on the website. Use ★ to choose it and the arrows to reorder.</p></div></div>
          <div class="photos" id="ph">${imgs.map((im, k) => html`<div class="ph-item ${im.is_primary ? 'primary' : ''}"><img src="${S.publicImg(im.path)}" alt="Product photo ${k + 1}" loading="lazy">${im.is_primary ? raw('<span class="lbl">Main</span>') : ''}
            <div class="tools"><button type="button" data-prim="${im.id}" title="Make main photo" aria-label="Make main photo" ${im.is_primary ? 'disabled' : ''}>${icon('star')}</button>
            <span class="flex" style="gap:6px"><button type="button" data-mv="${im.id}|-1" aria-label="Move earlier" ${k === 0 ? 'disabled' : ''}>${icon('left')}</button><button type="button" data-mv="${im.id}|1" aria-label="Move later" ${k === imgs.length - 1 ? 'disabled' : ''}>${icon('right')}</button></span>
            <button type="button" data-del="${im.id}" aria-label="Remove photo">${icon('trash')}</button></div></div>`)}
            <label class="ph-add">${icon('camera')}Take photo<input type="file" accept="image/*" capture="environment" data-up></label>
            <label class="ph-add">${icon('upload')}Upload photos<input type="file" accept="image/*" multiple data-up></label></div>
          ${!imgs.length ? html`<p class="muted small" style="margin:14px 0 0">No photos yet. You can add them later too.</p>` : ''}</section>${wizbar(w.prev, imgs.length ? 'Continue' : 'Skip for now')}`);
        S.$$('[data-up]', el).forEach(inp => inp.onchange = async () => {
          const files = [...inp.files]; if (!files.length) return;
          const grid = $('#ph', el); let pos = imgs.length ? Math.max(...imgs.map(x => x.position)) + 1 : 0, failed = [];
          for (const f of files) {
            const tile = document.createElement('div'); tile.className = 'ph-up'; tile.textContent = 'Uploading…'; grid.insertBefore(tile, grid.querySelector('.ph-add'));
            try {
              const prep = await S.prepareImage(f); const path = `${prod.id}/${S.uuid()}.${prep.ext}`;
              await S.upload('product-images', path, prep.blob, prep.type);
              S.must(await S.db.from('product_images').insert({ product_id: prod.id, path, position: pos++ }));
            } catch (e) { failed.push(f.name + ': ' + S.friendly(e.message)); }
          }
          if (failed.length) S.toast('Some photos did not upload. ' + failed[0], { bad: true }); else S.toast(files.length + ' photo' + (files.length > 1 ? 's' : '') + ' added');
          draw();
        });
        S.on(el, '[data-prim]', 'click', (e, b) => S.act(b, async () => { S.must(await S.db.from('product_images').update({ is_primary: true }).eq('id', b.dataset.prim)); draw(); }, 'Main photo set').catch(() => {}));
        S.on(el, '[data-mv]', 'click', (e, b) => {
          const [id, d] = b.dataset.mv.split('|'); const k = imgs.findIndex(x => x.id === id); const o = imgs[k + +d]; if (!o) return;
          S.act(b, async () => { S.must(await S.db.from('product_images').update({ position: o.position }).eq('id', id)); S.must(await S.db.from('product_images').update({ position: imgs[k].position === o.position ? o.position + +d : imgs[k].position }).eq('id', o.id)); draw(); }).catch(() => {});
        });
        S.on(el, '[data-del]', 'click', async (e, b) => {
          if (!(await S.confirm({ title: 'Remove this photo?', confirm: 'Remove', danger: true }))) return;
          const im = imgs.find(x => x.id === b.dataset.del);
          S.act(b, async () => { S.must(await S.db.from('product_images').delete().eq('id', im.id)); await S.db.storage.from('product-images').remove([im.path]); draw(); }, 'Photo removed').catch(() => {});
        });
        $('#nextb', el).onclick = w.next;
      };
      await draw();
    },
    // ---------- 2. details (fields adapt to the type of product)
    async details(el, prod, w) {
      const cats = CATEGORIES.includes(prod.category) || !prod.category ? CATEGORIES : [prod.category, ...CATEGORIES];
      S.render(el, html`<section class="card"><h2>Details</h2><form class="form" id="df" novalidate style="margin-top:12px">
        <label class="fld"><span>Product name</span><input name="name" value="${prod.name}" maxlength="140" required placeholder="e.g. Oval Solitaire Engagement Ring"></label>
        <div class="row"><label class="fld"><span>Category</span><select name="category"><option value="">Choose…</option>${S.opts(cats.map(c => [c, c]), prod.category)}</select></label>
          <label class="fld"><span>Subcategory <em>(optional)</em></span><input name="subcategory" value="${prod.subcategory || ''}" maxlength="80" placeholder="e.g. Solitaire"></label></div>
        <label class="fld"><span>Type of product</span><select name="product_type">${S.opts(TYPES, prod.product_type)}</select><small id="typehint"></small></label>
        <div class="row"><label class="fld"><span>SKU / reference</span><input name="sku" value="${prod.sku || ''}" maxlength="40" autocapitalize="characters"></label>
          <div class="fld"><span>&nbsp;</span><button class="btn" type="button" id="sug">${icon('sparkle')} Suggest a reference</button></div></div>
        <div id="jfields"><div class="section-t">Materials</div>
          <div class="row3"><label class="fld"><span>Metal</span><input name="metal" value="${prod.metal || ''}" maxlength="60" placeholder="e.g. 18ct white gold" list="metals"></label>
            <label class="fld"><span>Gemstone</span><input name="gemstone" value="${prod.gemstone || ''}" maxlength="120" placeholder="e.g. 1.20ct oval diamond, G VS1"></label>
            <label class="fld"><span>Other material <em>(optional)</em></span><input name="material" value="${prod.material || ''}" maxlength="80"></label></div>
          <datalist id="metals"><option>18ct yellow gold</option><option>18ct white gold</option><option>18ct rose gold</option><option>9ct yellow gold</option><option>Platinum</option><option>Sterling silver</option></datalist>
          <div class="row"><label class="fld"><span>Weight (g) <em>(if known)</em></span><input name="weight_g" value="${prod.weight_g ?? ''}" inputmode="decimal"></label>
            <label class="fld"><span>Size / dimensions <em>(if relevant)</em></span><input name="dimensions" value="${prod.dimensions || ''}" maxlength="80" placeholder="e.g. Ring size L, 2.2mm band"></label></div></div>
        <label class="fld"><span>Description <em>(shown on the website)</em></span><textarea name="description" maxlength="4000" placeholder="Describe the piece: stone, setting, finish, how it feels to wear.">${prod.description}</textarea></label>
        <label class="fld"><span>Internal notes <em>(team only)</em></span><textarea name="notes" maxlength="4000" style="min-height:80px">${prod.notes || ''}</textarea></label>
        <label class="fld" style="max-width:280px"><span>Low stock warning at <em>(optional)</em></span><input name="low_stock_threshold" value="${prod.low_stock_threshold ?? ''}" inputmode="numeric" placeholder="e.g. 1"></label>
      </form></section>${wizbar(w.prev)}`);
      const f = $('#df', el);
      const adapt = () => { const t = f.product_type.value; $('#jfields', el).hidden = t === 'service';
        $('#typehint', el).textContent = { stocked: 'We track stock, supplier and purchase cost.', one_off: 'A single piece: stock is 1 when bought.', bespoke: 'Made to order for a client; supplier optional.', in_house: 'Made in our workshop; record material costs.', service: 'No stock or supplier needed.' }[t]; };
      f.product_type.onchange = adapt; adapt();
      $('#sug', el).onclick = () => { const c = (f.category.value || 'LK').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase(); f.sku.value = 'LK-' + c + '-' + Math.random().toString(36).slice(2, 6).toUpperCase(); };
      $('#nextb', el).onclick = e => {
        S.clearErr(f); const o = S.form(f);
        if (!o.name) return S.fieldErr(f, 'name', 'Give the product a name');
        if (o.weight_g && isNaN(+o.weight_g)) return S.fieldErr(f, 'weight_g', 'Weight must be a number');
        if (o.low_stock_threshold && !/^\d+$/.test(o.low_stock_threshold)) return S.fieldErr(f, 'low_stock_threshold', 'Use a whole number');
        const upd = { name: o.name, category: o.category || null, subcategory: o.subcategory || null, product_type: o.product_type, sku: o.sku ? o.sku.toUpperCase() : null,
          metal: o.metal || null, gemstone: o.gemstone || null, material: o.material || null, weight_g: o.weight_g ? +o.weight_g : null, dimensions: o.dimensions || null,
          description: o.description || '', notes: o.notes || null, low_stock_threshold: o.low_stock_threshold ? +o.low_stock_threshold : null };
        S.act(e.currentTarget, async () => { S.must(await S.db.from('products').update(upd).eq('id', prod.id)); w.next(); }, 'Details saved').catch(() => {});
      };
    },
    // ---------- 3. supplier, invoice / receipt, OCR, stock
    async supplier(el, prod, w) {
      const draw = async () => {
        const p2 = S.must(await S.db.from('products').select('*, suppliers(*)').eq('id', prod.id).single());
        const [docs, moves] = await Promise.all([
          S.db.from('documents').select('*').eq('product_id', prod.id).in('kind', ['supplier_invoice', 'supplier_receipt', 'purchase_document']).is('deleted_at', null).order('created_at', { ascending: false }).then(S.must),
          S.db.from('stock_movements').select('id', { count: 'exact', head: true }).eq('product_id', prod.id)]);
        const stocked = ['stocked', 'one_off'].includes(p2.product_type);
        S.render(el, html`<section class="card"><div class="ch"><div><h2>Supplier</h2><p class="muted small">${p2.product_type === 'service' ? 'Not needed for services.' : 'Who did you buy this from?'}</p></div></div>
          ${p2.suppliers ? html`<div class="li" style="border:1px solid var(--line);border-radius:12px"><span class="ic">${icon('truck')}</span><span class="main-t"><span class="t" style="display:block">${p2.suppliers.name}</span><span class="d" style="display:block">${p2.suppliers.contact_name || p2.suppliers.email || ''}</span></span><button class="btn sm" id="chs">Change</button></div>`
            : html`<div class="flex"><button class="btn" id="chs">${icon('search')} Choose supplier</button><button class="btn ghost" id="news">${icon('plus')} New supplier</button></div>`}
          <form class="form" id="sf" style="margin-top:16px"><div class="row"><label class="fld"><span>Supplier's reference <em>(optional)</em></span><input name="supplier_ref" value="${p2.supplier_ref || ''}" maxlength="60"></label>
            ${stocked ? html`<label class="fld"><span>Quantity bought</span><input name="purchase_qty" value="${p2.purchase_qty}" inputmode="numeric"><small>Used to share delivery and other costs per item.</small></label>` : ''}</div></form></section>
        <section class="card"><div class="ch"><div><h2>Supplier invoice or receipt</h2><p class="muted small">Photograph or upload it. We can read it for you, and you check every figure before anything is saved.</p></div></div>
          ${docs.length ? html`<div class="list" style="margin-bottom:14px">${docs.map(d => html`<div class="li"><span class="ic">${icon('receipt')}</span><span class="main-t"><a class="t" style="display:block" href="#" data-open="${d.bucket}|${d.path}">${d.filename || d.title}</a><span class="d" style="display:block">${date(d.created_at)}</span></span>
            ${S.pill('ocr', d.ocr_status)}${d.ocr_status !== 'confirmed' ? html`<button class="btn sm gold" data-ocr="${d.id}">${d.ocr_status === 'read' ? 'Review' : 'Read & review'}</button>` : ''}</div>`)}</div>` : ''}
          <div class="flex"><label class="btn">${icon('camera')} Take photo<input type="file" accept="image/*" capture="environment" hidden data-doc></label><label class="btn">${icon('upload')} Upload image or PDF<input type="file" accept="image/*,application/pdf" hidden data-doc></label>
            ${p2.supplier_id ? html`<button class="btn ghost" id="attach">${icon('link')} Attach existing</button>` : ''}</div></section>
        ${stocked && !moves.count ? html`<section class="card"><div class="ch"><div><h2>Stock</h2><p class="muted small">No stock recorded yet. If you are not entering a supplier invoice, record how many you have now.</p></div></div>
          <div class="flex"><input class="inp" id="opening" inputmode="numeric" placeholder="Quantity in stock" style="max-width:200px"><button class="btn" id="setopen">Record stock</button></div></section>` : ''}
        ${wizbar(w.prev)}`);
        S.bindFiles(el);
        $('#chs', el).onclick = async () => { const s = await S.pickSupplier(); if (s) { await S.act(null, async () => S.must(await S.db.from('products').update({ supplier_id: s.id }).eq('id', prod.id)), 'Supplier set').catch(() => {}); draw(); } };
        const ns = $('#news', el); if (ns) ns.onclick = () => S.supplierSheet(null, async s => { S.must(await S.db.from('products').update({ supplier_id: s.id }).eq('id', prod.id)); draw(); });
        S.$$('[data-doc]', el).forEach(inp => inp.onchange = async () => {
          const f = inp.files[0]; if (!f) return;
          try {
            const d = await S.act(null, () => S.addSupplierDoc(f, { supplier_id: p2.supplier_id, product_id: prod.id, kind: /receipt/i.test(f.name) ? 'supplier_receipt' : 'supplier_invoice' }), 'Document saved');
            draw(); S.purchaseReview(d, { product: p2, onDone: draw });
          } catch (e) { }
        });
        S.on(el, '[data-ocr]', 'click', (e, b) => { const d = docs.find(x => x.id === b.dataset.ocr); S.purchaseReview(d, { product: p2, onDone: draw }); });
        const at = $('#attach', el); if (at) at.onclick = async () => {
          const d = await S.pick({ title: 'Attach a supplier document', table: 'documents', select: '*', search: ['filename', 'title'], filter: b => b.eq('supplier_id', p2.supplier_id).in('kind', ['supplier_invoice', 'supplier_receipt', 'purchase_document']).is('deleted_at', null).order('created_at', { ascending: false }),
            render: d2 => html`<span class="ic">${icon('receipt')}</span><span class="main-t"><span class="t" style="display:block">${d2.filename}</span><span class="d" style="display:block">${date(d2.created_at)} · ${S.statusLabel('ocr', d2.ocr_status)}</span></span>` });
          if (d) { await S.act(null, async () => S.must(await S.db.from('documents').update({ product_id: prod.id }).eq('id', d.id)), 'Attached').catch(() => {}); draw(); }
        };
        const so = $('#setopen', el); if (so) so.onclick = e => { const n = parseInt($('#opening', el).value, 10); if (!(n > 0)) return S.toast('Enter a quantity above 0', { bad: true });
          S.act(e.currentTarget, async () => { S.must(await S.db.from('stock_movements').insert({ product_id: prod.id, change: n, reason: 'opening', created_by: S.user.id })); draw(); }, 'Stock recorded').catch(() => {}); };
        $('#nextb', el).onclick = e => {
          const f = $('#sf', el); const o = S.form(f); const upd = { supplier_ref: o.supplier_ref || null };
          if (stocked) { if (!/^\d+$/.test(o.purchase_qty || '') || +o.purchase_qty < 1) return S.fieldErr(f, 'purchase_qty', 'Use a whole number of 1 or more'); upd.purchase_qty = +o.purchase_qty; }
          S.act(e.currentTarget, async () => { S.must(await S.db.from('products').update(upd).eq('id', prod.id)); w.next(); }).catch(() => {});
        };
      };
      await draw();
    },
    // ---------- 4. costs → landed cost
    async costs(el, prod, w) {
      const vat = await S.settings('vat');
      const draw = async () => {
        const [p2, costs] = await Promise.all([S.db.from('products').select('*').eq('id', prod.id).single().then(S.must), S.db.from('product_costs').select('*').eq('product_id', prod.id).order('created_at').then(S.must)]);
        const k = S.costing(p2, costs, vat);
        S.render(el, html`<div class="split"><section class="card"><div class="ch"><div><h2>Costs</h2><p class="muted small">What it cost to get this piece to you. “Whole purchase” costs are shared across the ${k.pq} item${k.pq === 1 ? '' : 's'} bought.</p></div></div>
          ${costs.length ? html`<div class="list" style="margin-bottom:16px">${costs.map(c => html`<div class="li"><span class="main-t"><span class="t" style="display:block">${S.label(c.kind)}${c.description ? ' · ' + c.description : ''}</span><span class="d" style="display:block">${c.basis === 'per_item' ? 'Per item' : 'Whole purchase'}${c.purchase_id ? ' · from supplier invoice' : ''}</span></span><span class="amt">${money(c.amount_pence)}</span><button class="iconbtn" data-rm="${c.id}" aria-label="Remove cost">${icon('trash')}</button></div>`)}</div>` : ''}
          <form class="form" id="cf" novalidate><div class="row"><label class="fld"><span>Type of cost</span><select name="kind">${S.opts(COST_KINDS, costs.some(c => c.kind === 'purchase') ? 'shipping' : 'purchase')}</select></label>
            <label class="fld"><span>Amount</span><div class="money"><input name="amount" inputmode="decimal" placeholder="0.00"></div></label></div>
            <div class="row"><label class="fld"><span>Description <em>(optional)</em></span><input name="description" maxlength="120"></label>
            <label class="fld"><span>Applies to</span><select name="basis">${S.opts([['per_item', 'Each item'], ['total', 'The whole purchase (shared)']])}</select></label></div>
            <button class="btn" type="submit">${icon('plus')} Add cost</button></form></section>
          <section class="card"><h2>Landed cost</h2><p class="muted small">Purchase cost + additional costs = landed cost. Every figure is shown so you can check it.</p>
            <div class="calc"><div class="r"><span>Purchase cost per item</span><span>${money(k.purchase)}</span></div><div class="r op"><span>plus additional costs per item</span><span>${money(k.extra)}</span></div><div class="r tot"><span>Landed cost per item</span><span>${money(k.landed)}</span></div></div></section></div>
          ${wizbar(w.prev)}`);
        $('#cf', el).onsubmit = e => { e.preventDefault(); const f = e.target, o = S.form(f); S.clearErr(f); const a = S.pence(o.amount);
          if (a == null || isNaN(a) || a < 0) return S.fieldErr(f, 'amount', 'Enter an amount like 125.50');
          S.act(S.$('button[type=submit]', f), async () => { S.must(await S.db.from('product_costs').insert({ product_id: prod.id, kind: o.kind, amount_pence: a, basis: o.basis, description: o.description || '', created_by: S.user.id })); draw(); }, 'Cost added').catch(() => {}); };
        S.on(el, '[data-rm]', 'click', async (e, b) => { if (!(await S.confirm({ title: 'Remove this cost?', confirm: 'Remove', danger: true }))) return; S.act(b, async () => { S.must(await S.db.from('product_costs').delete().eq('id', b.dataset.rm)); draw(); }, 'Removed').catch(() => {}); });
        $('#nextb', el).onclick = w.next;
      };
      await draw();
    },
    // ---------- 5. price (suggestion only; the user confirms)
    async price(el, prod, w) {
      const [p2, costs, vat, rules] = await Promise.all([S.db.from('products').select('*').eq('id', prod.id).single().then(S.must), S.db.from('product_costs').select('*').eq('product_id', prod.id).then(S.must), S.settings('vat'), S.settings('pricing_rules')]);
      const target = (rules && rules.categories && rules.categories[p2.category]) || (rules && rules.default_margin_pct) || 55;
      S.render(el, html`<div class="split"><section class="card"><h2>Selling price</h2><form class="form" id="prf" novalidate style="margin-top:12px">
        <div class="row"><label class="fld"><span>Price to the customer${!vat || vat.registered !== false ? ' (incl. VAT)' : ''}</span><div class="money"><input name="price" inputmode="decimal" value="${S.pounds(p2.selling_price_pence)}" ${w.locked ? 'disabled' : ''}></div></label>
          <label class="fld"><span>VAT rate</span><select name="vat_rate" ${w.locked ? 'disabled' : ''}>${S.opts([['20', '20% (standard)'], ['5', '5%'], ['0', '0% / exempt']], String(Math.round(p2.vat_rate)))}</select></label></div></form>
        <div class="card tint flat" style="margin-top:16px;padding:16px"><div class="row-between"><div><div class="tiny" style="letter-spacing:.16em;text-transform:uppercase;color:var(--gold-d)">Suggestion only</div>
          <div id="sugp" class="serif" style="font-size:1.6rem"></div><div class="small muted" id="sugw"></div></div><button class="btn sm" id="usesug" ${w.locked ? 'disabled' : ''}>Use this price</button></div>
          <label class="fld" style="margin-top:12px;max-width:220px"><span>Target margin %</span><input id="tm" class="inp" inputmode="decimal" value="${target}"></label></div>
        <p class="small muted" style="margin:14px 0 0">Nothing changes until you press <b>Confirm price</b>. Suggestions never change a price on their own.</p></section>
        <section class="card"><h2>Profit</h2><div id="calc"></div></section></div>
        <div class="wizbar"><a class="btn" href="${w.prev}">${icon('back')} Back</a><button class="btn gold" id="nextb" ${w.locked ? 'disabled' : ''}>${icon('check')} Confirm price</button></div>
        ${w.locked ? html`<div class="wizbar" style="position:static"><span></span><button class="btn" id="skip">Continue ${icon('right')}</button></div>` : ''}`);
      const f = $('#prf', el);
      const live = () => {
        const pr = S.pence(f.price.value); const p3 = Object.assign({}, p2, { selling_price_pence: pr == null || isNaN(pr) ? null : pr, vat_rate: +f.vat_rate.value });
        const k = S.costing(p3, costs, vat); S.render($('#calc', el), S.costingBlock(k, costs, p3));
        const m = Math.min(95, Math.max(0, parseFloat($('#tm', el).value) || 0)) / 100;
        if (k.landed > 0) { const net = k.landed / (1 - m); const gross = k.reg ? net * (1 + p3.vat_rate / 100) : net; const rounded = Math.ceil(gross / 500) * 500;
          $('#sugp', el).textContent = S.money(rounded); $('#sugw', el).textContent = `${S.money(k.landed)} landed cost at ${Math.round(m * 100)}% margin${k.reg ? ' + VAT' : ''}, rounded up to the nearest £5`; $('#usesug', el).dataset.v = rounded; $('#usesug', el).disabled = w.locked; }
        else { $('#sugp', el).textContent = '—'; $('#sugw', el).textContent = 'Add costs first to get a suggestion.'; $('#usesug', el).disabled = true; }
      };
      f.price.oninput = live; f.vat_rate.onchange = live; $('#tm', el).oninput = live; live();
      $('#usesug', el).onclick = () => { f.price.value = S.pounds(+$('#usesug', el).dataset.v); live(); S.toast('Suggested price filled in. Press Confirm price to keep it.'); };
      const sk = $('#skip', el); if (sk) sk.onclick = w.next;
      $('#nextb', el).onclick = e => {
        const pr = S.pence(f.price.value); S.clearErr(f);
        if (pr == null || isNaN(pr) || pr <= 0) return S.fieldErr(f, 'price', 'Enter the selling price, e.g. 2450');
        S.act(e.currentTarget, async () => { S.must(await S.db.from('products').update({ selling_price_pence: pr, vat_rate: +f.vat_rate.value }).eq('id', prod.id)); w.next(); }, 'Price confirmed').catch(() => {});
      };
    },
    // ---------- 6. review & submit
    async review(el, prod, w) {
      const [issues, p2] = await Promise.all([S.rpc('product_issues_checked', { p_id: prod.id }), S.db.from('products').select('*').eq('id', prod.id).single().then(S.must)]);
      const canSubmit = ['draft', 'changes_requested', 'rejected'].includes(p2.status);
      S.render(el, html`<section class="card"><h2>Ready for review?</h2>
        ${issues.blocking.length ? S.banner('bad', 'Still needed before the owner can approve', html`<ul>${issues.blocking.map(x => html`<li>${x}</li>`)}</ul>`) : S.banner('good', 'Everything required is here', 'The owner can review and approve this product.')}
        ${issues.warnings.length ? S.banner('warn', 'Worth checking', html`<ul>${issues.warnings.map(x => html`<li>${x}</li>`)}</ul>`) : ''}
        <p class="muted">${canSubmit ? 'When you submit, the owner is notified and will approve, request changes, or publish it to the website.' : 'Current status: ' + S.statusLabel('product', p2.status) + '.'}</p></section>
        <div class="wizbar"><a class="btn" href="${w.prev}">${icon('back')} Back</a>
          ${canSubmit ? html`<button class="btn gold" id="submit" ${issues.blocking.length ? 'disabled' : ''}>${icon('send')} Submit for owner review</button>` : S.isOwner() && ['ready_for_review', 'owner_review'].includes(p2.status) ? html`<a class="btn gold" href="#/products/${p2.id}/review">Open owner review</a>` : html`<a class="btn gold" href="#/products/${p2.id}">Done</a>`}</div>`);
      const sb = $('#submit', el); if (sb) sb.onclick = () => S.act(sb, async () => { await S.rpc('product_submit', { p_id: prod.id }); S.go('#/products/' + prod.id); }, 'Submitted for owner review').catch(() => {});
    }
  };

  // =========================== PRODUCT PAGE ===========================
  S.route('/products/:id', async (v, p, live) => {
    const [prod, imgs, costs, vat, notes, docs, moves, hist] = await Promise.all([
      S.db.from('products').select('*, suppliers(*)').eq('id', p.id).maybeSingle().then(S.must),
      S.db.from('product_images').select('*').eq('product_id', p.id).order('position').then(S.must),
      S.db.from('product_costs').select('*').eq('product_id', p.id).order('created_at').then(S.must), S.settings('vat'),
      S.db.from('product_review_notes').select('*').eq('product_id', p.id).order('created_at', { ascending: false }).then(S.must),
      S.db.from('documents').select('*').eq('product_id', p.id).is('deleted_at', null).order('created_at', { ascending: false }).then(S.must),
      S.db.from('stock_movements').select('*').eq('product_id', p.id).order('created_at', { ascending: false }).limit(50).then(S.must),
      S.db.from('audit_log').select('*').eq('entity', 'products').eq('entity_id', p.id).order('at', { ascending: false }).limit(40).then(S.must)]);
    await S.staffList();
    if (!live()) return;
    if (!prod || prod.deleted_at) return S.render(v, S.empty({ icon: 'gem', title: 'Product not found', action: html`<a class="btn" href="#/products">All products</a>` }));
    const k = S.costing(prod, costs, vat); const owner = S.isOwner(); const st = prod.status;
    const lastChange = notes.find(n => n.action === 'request_changes');
    const webUrl = S.siteUrl + '/item.html?s=' + encodeURIComponent(prod.slug);
    const acts = [];
    if (!['approved', 'published', 'unpublished'].includes(st) || owner) acts.push(html`<a class="btn" href="#/products/${prod.id}/edit?step=details">${icon('edit')} Edit</a>`);
    if (['draft', 'changes_requested', 'rejected'].includes(st)) acts.push(html`<a class="btn gold" href="#/products/${prod.id}/edit?step=review">${icon('send')} Submit for review</a>`);
    if (owner && ['ready_for_review', 'owner_review'].includes(st)) acts.push(html`<a class="btn gold" href="#/products/${prod.id}/review">${icon('eye')} Review</a>`);
    if (owner && ['approved', 'unpublished'].includes(st)) acts.push(html`<button class="btn gold" id="pub">${icon('upload')} Publish to website</button>`);
    if (owner && st === 'published') acts.push(html`<button class="btn" id="unpub">Unpublish</button>`);
    if (st === 'published') acts.push(html`<a class="btn" href="${webUrl}" target="_blank" rel="noopener">${icon('external')} View on website</a>`);
    S.render(v, html`<header class="ph"><div><div class="crumb"><a href="#/products">${icon('back')} Products</a></div><h1>${prod.name || 'Untitled product'}</h1>
      <div class="sub flex">${prod.sku || 'No SKU'} ${pill('product', st)}</div></div><div class="acts">${acts}</div></header>
      ${prod.publish_status === 'failed' && st !== 'published' ? S.banner('bad', 'Publishing failed', html`${prod.publish_error || 'Unknown reason'}. The product is safe and was not changed on the website.${owner ? raw(' <button class="linkbtn" id="retrypub">Retry publishing</button>') : ''}`) : ''}
      ${st === 'changes_requested' && lastChange ? S.banner('warn', 'Changes requested by the owner', html`<p class="pre" style="margin:4px 0 0">${lastChange.note}</p><span class="tiny">${dateTime(lastChange.created_at)}</span>`) : ''}
      ${st === 'published' ? S.banner('good', 'Live on the website', html`Published ${dateTime(prod.published_at)}. <a href="${webUrl}" target="_blank" rel="noopener">Open the product page</a>`) : ''}
      <div class="split"><div class="stack">
        <section class="card">${imgs.length ? html`<div class="gallery"><img src="${S.publicImg((imgs.find(x => x.is_primary) || imgs[0]).path)}" alt="${prod.name}"><div class="rest">${imgs.filter(x => !x.is_primary).slice(0, 4).map(x => html`<img src="${S.publicImg(x.path)}" alt="" loading="lazy">`)}</div></div>`
          : S.empty({ icon: 'camera', title: 'No photos yet', action: html`<a class="btn" href="#/products/${prod.id}/edit?step=photos">Add photos</a>` })}
          <div class="row-between" style="margin-top:12px"><span class="muted small">${imgs.length} photo${imgs.length === 1 ? '' : 's'}</span><a class="btn sm" href="#/products/${prod.id}/edit?step=photos">Manage photos</a></div></section>
        <section class="card"><div class="ch"><h2>Details</h2><a class="btn sm" href="#/products/${prod.id}/edit?step=details">Edit</a></div>
          ${S.kv([['Category', [prod.category, prod.subcategory].filter(Boolean).join(' › ')], ['Type', (TYPES.find(t => t[0] === prod.product_type) || [, ''])[1]], ['Metal', prod.metal], ['Gemstone', prod.gemstone], ['Material', prod.material],
            ['Weight', prod.weight_g ? prod.weight_g + ' g' : ''], ['Size', prod.dimensions], ['SKU', prod.sku]])}
          <div class="hr"></div><p class="pre" style="margin:0">${prod.description || raw('<span class="muted">No description yet</span>')}</p>
          ${prod.notes ? html`<div class="hr"></div><div class="tiny muted" style="letter-spacing:.14em;text-transform:uppercase">Internal notes</div><p class="pre" style="margin:6px 0 0">${prod.notes}</p>` : ''}</section>
        <section class="card"><div class="ch"><h2>History</h2></div>${notes.length || hist.length ? html`<ul class="tl">${[...notes.map(n => ({ at: n.created_at, t: S.label(n.action) + (n.note ? ': ' + n.note : ''), by: n.author })),
          ...hist.filter(h => h.action === 'products.update' || h.action === 'products.insert').map(h => ({ at: h.at, t: h.action === 'products.insert' ? 'Product created' : 'Edited: ' + Object.keys(h.details || {}).filter(x => !['updated_at', 'publish_status', 'publish_error'].includes(x)).map(S.label).join(', '), by: h.actor }))]
          .filter(x => !/Edited: $/.test(x.t)).sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 30).map(x => html`<li>${x.t}<time>${dateTime(x.at)}${x.by ? ' · ' + S.staffName(x.by) : ''}</time></li>`)}</ul>` : html`<p class="muted">No history yet.</p>`}</section>
      </div><div class="stack">
        <section class="card"><div class="ch"><h2>Price & profit</h2><a class="btn sm" href="#/products/${prod.id}/edit?step=price">Pricing</a></div>${S.costingBlock(k, costs, prod)}
          <div class="flex" style="margin-top:12px"><a class="btn sm" href="#/products/${prod.id}/edit?step=costs">Edit costs</a></div></section>
        <section class="card"><div class="ch"><h2>Supplier</h2><a class="btn sm" href="#/products/${prod.id}/edit?step=supplier">Edit</a></div>
          ${prod.suppliers ? S.kv([['Supplier', html`<a href="#/suppliers/${prod.suppliers.id}">${prod.suppliers.name}</a>`], ['Their reference', prod.supplier_ref]]) : html`<p class="muted">No supplier set.</p>`}
          ${docs.length ? html`<div class="files" style="margin-top:14px">${docs.map(S.fileTile)}</div>` : ''}</section>
        ${['stocked', 'one_off'].includes(prod.product_type) ? html`<section class="card"><div class="ch"><div><h2>${prod.quantity} in stock</h2><p class="muted small">From recorded purchases, sales and adjustments only.</p></div><button class="btn sm" id="adj">Adjust</button></div>
          ${moves.length ? html`<div class="list">${moves.map(m => html`<div class="li"><span class="main-t"><span class="t" style="display:block">${S.label(m.reason)}${m.note ? ' · ' + m.note : ''}</span><span class="d" style="display:block">${dateTime(m.created_at)}</span></span><span class="amt" style="color:${m.change > 0 ? 'var(--sage-d)' : 'var(--rose-d)'}">${m.change > 0 ? '+' : ''}${m.change}</span></div>`)}</div>` : html`<p class="muted">No stock movements yet.</p>`}</section>` : ''}
        ${owner || (st === 'draft' && prod.created_by === S.user.id) ? html`<section class="card flat"><div class="ch"><div><h3>${st === 'draft' ? 'Discard draft' : 'Archive product'}</h3><p class="muted small">${st === 'draft' ? 'Removes this unfinished draft.' : 'Hides it from Studio. Order and invoice history are kept.'}</p></div><button class="btn danger sm" id="arch">${st === 'draft' ? 'Discard' : 'Archive'}</button></div></section>` : ''}
      </div></div>`);
    S.bindFiles(v);
    const doPublish = btn => S.act(btn, async () => { const r = await S.rpc('product_publish', { p_id: prod.id }); if (!r.ok) S.toast('PUBLISHING FAILED: ' + r.error, { bad: true }); else S.toast('Published to the website'); S.dispatch(); }).catch(() => {});
    const pb = $('#pub', v); if (pb) pb.onclick = async () => { if (await S.confirm({ title: 'Publish to the website?', message: 'It will appear on the “New in” page immediately, with its price and photos.', confirm: 'Publish' })) doPublish(pb); };
    const rp = $('#retrypub', v); if (rp) rp.onclick = () => doPublish(rp);
    const up = $('#unpub', v); if (up) up.onclick = async () => { const why = await S.ask({ title: 'Unpublish this product?', label: 'Reason (kept in the history)', required: false, confirm: 'Unpublish' }); if (why === null) return;
      S.act(up, async () => { await S.rpc('product_review_action', { p_id: prod.id, p_action: 'unpublish', p_note: why || null }); S.dispatch(); }, 'Removed from the website').catch(() => {}); };
    const ad = $('#adj', v); if (ad) ad.onclick = () => {
      const s = S.sheet({ title: 'Adjust stock', body: html`<form class="form" id="sa"><div class="row"><label class="fld"><span>Change</span><input name="change" type="number" step="1" placeholder="e.g. -1 or 2"></label>
        <label class="fld"><span>Reason</span><select name="reason">${S.opts([['adjustment', 'Stock count correction'], ['purchase', 'New stock received'], ['return', 'Returned by customer']])}</select></label></div>
        <label class="fld"><span>Note</span><input name="note" maxlength="200"></label></form>`, foot: html`<button class="btn ghost" data-close>Cancel</button><button class="btn gold" id="ok">Save</button>` });
      $('#ok', s.el).onclick = e => { const f = $('#sa', s.el), o = S.form(f); const n = parseInt(o.change, 10); S.clearErr(f); if (!n) return S.fieldErr(f, 'change', 'Enter a number other than 0');
        if (prod.quantity + n < 0) return S.fieldErr(f, 'change', 'Stock cannot go below 0');
        S.act(e.currentTarget, async () => { S.must(await S.db.from('stock_movements').insert({ product_id: prod.id, change: n, reason: o.reason, note: o.note || null, created_by: S.user.id })); s.close(); S.dispatch(); }, 'Stock updated').catch(() => {}); };
    };
    const ar = $('#arch', v); if (ar) ar.onclick = async () => {
      if (!(await S.confirm({ title: st === 'draft' ? 'Discard this draft?' : 'Archive this product?', message: st === 'published' ? 'It will also be removed from the website.' : '', confirm: st === 'draft' ? 'Discard' : 'Archive', danger: true }))) return;
      S.act(ar, async () => { if (st === 'published') await S.rpc('product_review_action', { p_id: prod.id, p_action: 'unpublish', p_note: 'Archived' });
        S.must(await S.db.from('products').update({ deleted_at: new Date().toISOString() }).eq('id', prod.id)); S.go('#/products'); }, st === 'draft' ? 'Draft discarded' : 'Product archived').catch(() => {});
    };
  });

  // =========================== OWNER REVIEW ===========================
  S.route('/products/:id/review', async (v, p, live) => {
    if (!S.isOwner()) return S.render(v, S.empty({ icon: 'lock', title: 'Owner review', text: 'Only the owner can review products.' }));
    let prod = S.must(await S.db.from('products').select('*').eq('id', p.id).maybeSingle());
    if (!prod) return S.render(v, S.empty({ icon: 'gem', title: 'Product not found' }));
    if (prod.status === 'ready_for_review') { await S.rpc('product_start_review', { p_id: p.id }).catch(() => {}); prod.status = 'owner_review'; }
    const [p2, imgs, costs, vat, issues, docs, notes] = await Promise.all([
      S.db.from('products').select('*, suppliers(*)').eq('id', p.id).single().then(S.must), S.db.from('product_images').select('*').eq('product_id', p.id).order('position').then(S.must),
      S.db.from('product_costs').select('*').eq('product_id', p.id).order('created_at').then(S.must), S.settings('vat'), S.rpc('product_issues_checked', { p_id: p.id }),
      S.db.from('documents').select('*').eq('product_id', p.id).is('deleted_at', null).then(S.must), S.db.from('product_review_notes').select('*').eq('product_id', p.id).order('created_at', { ascending: false }).then(S.must)]);
    await S.staffList();
    if (!live()) return;
    const k = S.costing(p2, costs, vat); const block = issues.blocking.length > 0;
    const sub = notes.find(n => n.action === 'submitted');
    S.render(v, html`${S.page({ title: 'Review: ' + (p2.name || 'Untitled'), crumb: ['Product', '#/products/' + p2.id], sub: html`${pill('product', p2.status)} ${sub ? html`<span class="small muted">Submitted ${ago(sub.created_at)} by ${S.staffName(sub.author)}</span>` : ''}` })}
      ${block ? S.banner('bad', 'Incomplete: cannot be approved yet', html`<ul>${issues.blocking.map(x => html`<li>${x}</li>`)}</ul>`) : S.banner('good', 'Complete', 'All required information is present.')}
      ${issues.warnings.length ? S.banner('warn', 'Please check', html`<ul>${issues.warnings.map(x => html`<li>${x}</li>`)}</ul>`) : ''}
      <div class="split" style="padding-bottom:90px"><div class="stack">
        <section class="card">${imgs.length ? html`<div class="photos">${imgs.map(im => html`<div class="ph-item ${im.is_primary ? 'primary' : ''}"><img src="${S.publicImg(im.path)}" alt="">${im.is_primary ? raw('<span class="lbl">Main</span>') : ''}</div>`)}</div>` : S.banner('bad', 'No photos', '')}</section>
        <section class="card"><h2>${p2.name}</h2>${S.kv([['SKU', p2.sku], ['Category', [p2.category, p2.subcategory].filter(Boolean).join(' › ')], ['Type', S.label(p2.product_type)], ['Metal', p2.metal], ['Gemstone', p2.gemstone], ['Weight', p2.weight_g ? p2.weight_g + ' g' : ''], ['Size', p2.dimensions], ['Stock', String(p2.quantity)]])}
          <div class="hr"></div><div class="tiny muted" style="letter-spacing:.14em;text-transform:uppercase">Website description</div><p class="pre">${p2.description || '—'}</p>
          ${p2.notes ? html`<div class="tiny muted" style="letter-spacing:.14em;text-transform:uppercase">Internal notes</div><p class="pre">${p2.notes}</p>` : ''}</section>
      </div><div class="stack">
        <section class="card"><h2>Price & profit</h2>${S.costingBlock(k, costs, p2)}</section>
        <section class="card"><h2>Supplier & invoice</h2>${p2.suppliers ? S.kv([['Supplier', html`<a href="#/suppliers/${p2.suppliers.id}">${p2.suppliers.name}</a>`], ['Their reference', p2.supplier_ref]]) : html`<p class="muted">No supplier.</p>`}
          ${docs.length ? html`<div class="files" style="margin-top:12px">${docs.map(S.fileTile)}</div>` : html`<p class="muted small">No supplier invoice or receipt attached.</p>`}</section>
        ${notes.length ? html`<section class="card"><h2>Review history</h2><ul class="tl">${notes.map(n => html`<li>${S.label(n.action)}${n.note ? ': ' + n.note : ''}<time>${dateTime(n.created_at)} · ${S.staffName(n.author)}</time></li>`)}</ul></section>` : ''}
      </div></div>
      <div class="wizbar" style="position:fixed;left:var(--side);right:0;bottom:0;padding:14px 28px;background:rgba(248,245,241,.96);border-top:1px solid var(--line);justify-content:flex-end;flex-wrap:wrap" id="rbar">
        <button class="btn ghost" data-a="save_draft">Save as draft</button><button class="btn danger" data-a="reject">Reject</button><button class="btn" data-a="request_changes">Request changes</button>
        <button class="btn" data-a="approve" ${block ? 'disabled' : ''}>Approve</button><button class="btn gold" data-a="approve_publish" ${block ? 'disabled' : ''}>${icon('check')} Approve & publish</button></div>`);
    if (innerWidth <= 820) Object.assign($('#rbar', v).style, { left: '0', bottom: 'calc(var(--bottom) + env(safe-area-inset-bottom))', padding: '10px 12px' });
    S.on(v, '[data-a]', 'click', async (e, b) => {
      const a = b.dataset.a; let note = null;
      if (a === 'request_changes') { note = await S.ask({ title: 'Request changes', label: 'What needs changing? Your partner will see this note on the product.', confirm: 'Send back' }); if (note === null) return; }
      if (a === 'reject') { note = await S.ask({ title: 'Reject product', label: 'Reason', confirm: 'Reject' }); if (note === null) return; }
      if (a === 'approve_publish' && !(await S.confirm({ title: 'Approve and publish?', message: 'The product will appear on the website straight away.', confirm: 'Approve & publish' }))) return;
      try {
        const r = await S.busy(b, () => S.rpc('product_review_action', { p_id: p2.id, p_action: a, p_note: note }));
        if (r && r.ok === false) S.toast('Approved, but PUBLISHING FAILED: ' + r.error, { bad: true });
        else S.toast({ save_draft: 'Saved as draft', reject: 'Product rejected', request_changes: 'Changes requested', approve: 'Approved', approve_publish: 'Approved and published' }[a]);
        S.refreshBadges(); S.go('#/products/' + p2.id);
      } catch (er) { S.toast(S.friendly(er.message), { bad: true }); }
    });
  });
})();
