/* LK Studio: Suppliers, supplier documents, OCR review and purchasing. */
(function () {
  const { html, raw, icon, money, date, dateTime, pill, $, $$ } = S;

  // =========================== SUPPLIERS ===========================
  S.pickSupplier = () => S.pick({ title: 'Choose supplier', table: 'suppliers', select: 'id,name,contact_name,email', search: ['name', 'contact_name', 'email', 'account_ref'], filter: b => b.is('deleted_at', null).order('name'),
    render: s => html`<span class="ic">${icon('truck')}</span><span class="main-t"><span class="t" style="display:block">${s.name}</span><span class="d" style="display:block">${s.contact_name || s.email || ''}</span></span>` });

  const supplierForm = s => html`<form class="form" id="supf" novalidate>
    <label class="fld"><span>Company name</span><input name="name" value="${s.name || ''}" maxlength="140" required></label>
    <div class="row"><label class="fld"><span>Contact person</span><input name="contact_name" value="${s.contact_name || ''}" maxlength="120"></label><label class="fld"><span>Account / reference no.</span><input name="account_ref" value="${s.account_ref || ''}" maxlength="60"></label></div>
    <div class="row"><label class="fld"><span>Phone</span><input name="phone" type="tel" value="${s.phone || ''}"></label><label class="fld"><span>Email</span><input name="email" type="email" value="${s.email || ''}"></label></div>
    <label class="fld"><span>Website</span><input name="website" value="${s.website || ''}" placeholder="https://"></label>
    <div class="section-t">Address</div>
    <label class="fld"><span>Address line 1</span><input name="address_line1" value="${s.address_line1 || ''}"></label><label class="fld"><span>Address line 2</span><input name="address_line2" value="${s.address_line2 || ''}"></label>
    <div class="row3"><label class="fld"><span>Town / city</span><input name="city" value="${s.city || ''}"></label><label class="fld"><span>Postcode</span><input name="postcode" value="${s.postcode || ''}"></label><label class="fld"><span>Country</span><input name="country" value="${s.country || 'United Kingdom'}"></label></div>
    <label class="fld"><span>Notes</span><textarea name="notes">${s.notes || ''}</textarea></label></form>`;
  S.supplierSheet = (s, after) => {
    const sh = S.sheet({ title: s ? 'Edit supplier' : 'New supplier', wide: true, body: supplierForm(s || {}), foot: html`<button class="btn ghost" data-close>Cancel</button><button class="btn gold" id="ok">Save supplier</button>` });
    const f = $('#supf', sh.el); f.postcode.onblur = () => { f.postcode.value = S.normPostcode(f.postcode.value); };
    $('#ok', sh.el).onclick = e => {
      S.clearErr(f); const o = S.form(f);
      if (!o.name) return S.fieldErr(f, 'name', 'Enter the company name');
      if (o.email && !S.validEmail(o.email)) return S.fieldErr(f, 'email', 'This email does not look right');
      const row = {}; ['name', 'contact_name', 'account_ref', 'phone', 'email', 'website', 'address_line1', 'address_line2', 'city', 'postcode', 'country', 'notes'].forEach(k => row[k] = o[k] || null);
      S.act(e.currentTarget, async () => {
        const r = s ? S.must(await S.db.from('suppliers').update(row).eq('id', s.id).select().single()) : S.must(await S.db.from('suppliers').insert(Object.assign(row, { created_by: S.user.id })).select().single());
        sh.close(); after ? await after(r) : S.go('#/suppliers/' + r.id);
      }, 'Supplier saved').catch(() => {});
    };
  };

  S.route('/suppliers', async (v, p, live) => {
    const rows = S.must(await S.db.from('suppliers').select('id,name,contact_name,email,phone,city,products(id)').is('deleted_at', null).order('name'));
    if (!live()) return;
    S.render(v, html`${S.page({ title: 'Suppliers', sub: 'Who you buy from', acts: html`<button class="btn gold" id="ns">${icon('plus')} New supplier</button>` })}
      <div class="toolbar"><div class="search">${icon('search')}<input id="sq" placeholder="Search suppliers"></div></div><div id="sl"></div>`);
    const draw = () => { const q = $('#sq', v).value.trim().toLowerCase(); const list = rows.filter(s => !q || [s.name, s.contact_name, s.email].join(' ').toLowerCase().includes(q));
      S.render($('#sl', v), list.length ? html`<div class="list">${list.map(s => html`<a class="li" href="#/suppliers/${s.id}"><span class="ic">${icon('truck')}</span><span class="main-t"><span class="t" style="display:block">${s.name}</span><span class="d" style="display:block">${[s.contact_name, s.email || s.phone, s.city].filter(Boolean).join(' · ')}</span></span><span class="end tiny muted">${s.products.length} product${s.products.length === 1 ? '' : 's'}</span>${icon('chev', 'chev')}</a>`)}</div>`
        : S.empty({ icon: 'truck', title: q ? 'No suppliers match' : 'No suppliers yet', text: 'Add the companies you buy stones, mounts and finished pieces from.' })); };
    $('#sq', v).oninput = draw; draw(); $('#ns', v).onclick = () => S.supplierSheet(null);
  });

  S.route('/suppliers/:id', async (v, p, live) => {
    const [s, contacts, prods, purchases, docs] = await Promise.all([
      S.db.from('suppliers').select('*').eq('id', p.id).maybeSingle().then(S.must), S.db.from('supplier_contacts').select('*').eq('supplier_id', p.id).order('name').then(S.must),
      S.db.from('products').select('id,name,sku,status,product_images(path,is_primary)').eq('supplier_id', p.id).is('deleted_at', null).order('name').then(S.must),
      S.db.from('purchases').select('*').eq('supplier_id', p.id).is('deleted_at', null).order('purchase_date', { ascending: false }).then(S.must),
      S.db.from('documents').select('*').eq('supplier_id', p.id).is('deleted_at', null).order('created_at', { ascending: false }).then(S.must)]);
    if (!live()) return;
    if (!s) return S.render(v, S.empty({ icon: 'truck', title: 'Supplier not found' }));
    S.render(v, html`<header class="ph"><div><div class="crumb"><a href="#/suppliers">${icon('back')} Suppliers</a></div><h1>${s.name}</h1><div class="sub">${s.account_ref ? 'Account ' + s.account_ref : ''}</div></div>
      <div class="acts">${s.phone ? html`<a class="btn" href="tel:${s.phone}">${icon('phone')} Call</a>` : ''}${s.email ? html`<a class="btn" href="mailto:${s.email}">${icon('mail')} Email</a>` : ''}<button class="btn" id="ed">${icon('edit')} Edit</button><a class="btn gold" href="#/purchases/new?supplier=${s.id}">${icon('receipt')} Add invoice</a></div></header>
      <div class="split"><div class="stack">
        <section class="card"><h2>Purchase history</h2>${purchases.length ? html`<div class="list">${purchases.map(pu => html`<a class="li" href="#/purchases/${pu.id}"><span class="ic">${icon('cart')}</span><span class="main-t"><span class="t" style="display:block">${pu.invoice_number || 'No invoice number'}</span><span class="d" style="display:block">${date(pu.purchase_date)}</span></span>
          <span class="end">${S.canFinance() ? html`<span class="amt">${money(pu.total_pence)}</span>` : ''}${pill('purchase', pu.status)}</span>${icon('chev', 'chev')}</a>`)}</div>` : html`<p class="muted">No purchases recorded.</p>`}</section>
        <section class="card"><h2>Products supplied</h2>${prods.length ? html`<div class="list">${prods.map(x => { const im = (x.product_images || []).find(i => i.is_primary) || (x.product_images || [])[0]; return html`<a class="li" href="#/products/${x.id}">${im ? html`<img class="thumb" src="${S.publicImg(im.path)}" alt="">` : html`<span class="ic">${icon('gem')}</span>`}<span class="main-t"><span class="t" style="display:block">${x.name || 'Untitled'}</span><span class="d" style="display:block">${x.sku || ''}</span></span>${pill('product', x.status)}</a>`; })}</div>` : html`<p class="muted">None yet.</p>`}</section>
        <section class="card"><div class="ch"><h2>Documents</h2><label class="btn sm">${icon('upload')} Add<input type="file" hidden id="sd" accept="image/*,application/pdf"></label></div>${docs.length ? html`<div class="files">${docs.map(S.fileTile)}</div>` : html`<p class="muted">Invoices, receipts and other supplier documents appear here.</p>`}</section>
      </div><div class="stack">
        <section class="card"><h2>Details</h2>${S.kv([['Contact', s.contact_name], ['Phone', s.phone], ['Email', s.email ? html`<a href="mailto:${s.email}">${s.email}</a>` : ''], ['Website', s.website ? html`<a href="${/^https?:/.test(s.website) ? s.website : 'https://' + s.website}" target="_blank" rel="noopener">${s.website}</a>` : ''],
          ['Address', S.address(s)], ['Account no.', s.account_ref]])}${s.notes ? html`<div class="hr"></div><p class="pre" style="margin:0">${s.notes}</p>` : ''}</section>
        <section class="card"><div class="ch"><h2>Contacts</h2><button class="btn sm" id="ac">${icon('plus')} Add</button></div>${contacts.length ? html`<div class="list">${contacts.map(c => html`<div class="li"><span class="main-t"><span class="t" style="display:block">${c.name}${c.role ? ' · ' + c.role : ''}</span><span class="d" style="display:block">${[c.phone, c.email].filter(Boolean).join(' · ')}</span></span><button class="iconbtn" data-rmc="${c.id}" aria-label="Remove contact">${icon('trash')}</button></div>`)}</div>` : html`<p class="muted">No extra contacts.</p>`}</section>
      </div></div>`);
    S.bindFiles(v);
    $('#ed', v).onclick = () => S.supplierSheet(s, () => S.dispatch());
    $('#ac', v).onclick = () => { const sh = S.sheet({ title: 'Add contact', body: html`<form class="form" id="cf"><div class="row"><label class="fld"><span>Name</span><input name="name" required></label><label class="fld"><span>Role</span><input name="role"></label></div><div class="row"><label class="fld"><span>Phone</span><input name="phone"></label><label class="fld"><span>Email</span><input name="email" type="email"></label></div></form>`, foot: html`<button class="btn ghost" data-close>Cancel</button><button class="btn gold" id="ok">Add</button>` });
      $('#ok', sh.el).onclick = e => { const f = $('#cf', sh.el), o = S.form(f); if (!o.name) return S.fieldErr(f, 'name', 'Enter a name'); S.act(e.currentTarget, async () => { S.must(await S.db.from('supplier_contacts').insert({ supplier_id: s.id, name: o.name, role: o.role || null, phone: o.phone || null, email: o.email || null })); sh.close(); S.dispatch(); }, 'Contact added').catch(() => {}); }; };
    S.on(v, '[data-rmc]', 'click', async (e, b) => { if (await S.confirm({ title: 'Remove contact?', confirm: 'Remove', danger: true })) S.act(b, async () => { S.must(await S.db.from('supplier_contacts').delete().eq('id', b.dataset.rmc)); S.dispatch(); }).catch(() => {}); });
    $('#sd', v).onchange = async e => { const f = e.target.files[0]; if (!f) return; try { await S.act(null, () => S.addSupplierDoc(f, { supplier_id: s.id, kind: 'purchase_document' }), 'Document added'); S.dispatch(); } catch (er) { } };
  });

  // =========================== SUPPLIER DOCUMENTS ===========================
  S.addSupplierDoc = async (file, { supplier_id, product_id, kind }) => {
    if (file.size > 25 * 1024 * 1024) throw new Error('The file is larger than 25 MB.');
    const prep = await S.prepareImage(file, 3000, 0.9);
    const path = `${supplier_id || 'unassigned'}/${S.uuid()}-${S.safeName(file.name.replace(/\.(heic|heif)$/i, '.' + prep.ext))}`;
    await S.upload('supplier-docs', path, prep.blob, prep.type);
    return S.must(await S.db.from('documents').insert({ kind: kind || 'supplier_invoice', bucket: 'supplier-docs', path, filename: file.name, mime: prep.type, size_bytes: prep.blob.size,
      supplier_id: supplier_id || null, product_id: product_id || null, uploaded_by: S.user.id }).select().single());
  };

  // =========================== OCR REVIEW ===========================
  // OCR is never trusted: everything read is shown in an editable form, and nothing is saved
  // as a purchase until the person presses "Confirm".
  S.purchaseReview = (doc, { product, onDone } = {}) => {
    const sh = S.sheet({ title: 'Check the supplier invoice', wide: true, body: html`<div id="pr"></div>` });
    const box = $('#pr', sh.el);
    const start = () => {
      if (doc.ocr_status === 'read' && doc.ocr_data) return form(doc.ocr_data, true);
      S.render(box, html`<p class="muted" style="margin-top:0">We can read the figures from <b>${doc.filename}</b> for you. You will check every one before it is saved.</p>
        <div class="flex"><button class="btn gold" id="ocr">${icon('sparkle')} Read it automatically</button><button class="btn" id="man">Enter the figures myself</button>
        <a class="btn ghost" href="#" data-open="${doc.bucket}|${doc.path}">${icon('eye')} View document</a></div>`);
      S.bindFiles(box);
      $('#man', box).onclick = () => form({}, false);
      $('#ocr', box).onclick = async e => {
        const b = e.currentTarget;
        try { const r = await S.busy(b, () => S.worker('/ocr', { document_id: doc.id })); doc.ocr_status = 'read'; doc.ocr_data = r.data; S.toast('Read. Please check each figure.'); form(r.data, true); }
        catch (er) {
          if (er.config) S.render(box, html`${S.configBanner(er.message.replace(/^MANUAL CONFIGURATION REQUIRED:\s*/i, '') + ' You can still enter the figures yourself.')}<button class="btn gold" id="man2">Enter the figures myself</button>`);
          else S.render(box, html`${S.banner('bad', 'OCR could not read this document', er.message.replace(/^OCR COULD NOT READ THIS DOCUMENT:?\s*/i, '') || 'Please enter the details by hand.')}<div class="flex"><button class="btn gold" id="man2">Enter the figures myself</button><button class="btn" id="again">${icon('refresh')} Try again</button></div>`);
          $('#man2', box).onclick = () => form({}, false); const ag = $('#again', box); if (ag) ag.onclick = start;
        }
      };
    };
    const p2 = n => n == null || n === '' || isNaN(n) ? '' : Number(n).toFixed(2);
    async function form(d, fromOcr) {
      let supplier = product && product.suppliers ? product.suppliers : null;
      if (!supplier && doc.supplier_id) supplier = S.must(await S.db.from('suppliers').select('*').eq('id', doc.supplier_id).maybeSingle());
      let suggested = null;
      if (!supplier && d.supplier_name) { const m = S.must(await S.db.from('suppliers').select('*').is('deleted_at', null).ilike('name', '%' + d.supplier_name.replace(/[%_,()]/g, ' ').trim().split(/\s+/)[0] + '%').limit(1)); suggested = m[0] || null; }
      const lines = (d.lines && d.lines.length ? d.lines : [{ description: product ? product.name : '', quantity: 1 }]).map(l => ({ ...l }));
      const charges = (d.other_charges || []).map(c => ({ ...c }));
      const draw = () => {
        S.render(box, html`${fromOcr ? S.banner('warn', 'Read automatically: please check every figure', 'Figures read from a photo can be wrong. Correct anything that does not match the document. Nothing is saved until you confirm.') : ''}
          <div class="flex" style="margin-bottom:14px"><a class="btn sm" href="#" data-open="${doc.bucket}|${doc.path}">${icon('eye')} View document</a></div>
          <form class="form" id="ocrf" novalidate>
            <div class="section-t">Supplier</div>
            <div id="sup">${supplier ? html`<div class="li" style="border:1px solid var(--line);border-radius:12px"><span class="ic">${icon('truck')}</span><span class="main-t"><span class="t" style="display:block">${supplier.name}</span>${d.supplier_name && d.supplier_name.toLowerCase() !== supplier.name.toLowerCase() ? html`<span class="d" style="display:block">Document says: “${d.supplier_name}”</span>` : ''}</span><button type="button" class="btn sm" id="chs">Change</button></div>`
              : html`${d.supplier_name ? html`<p class="small" style="margin:0 0 8px">Document says: <b>${d.supplier_name}</b></p>` : ''}<div class="flex">${suggested ? html`<button type="button" class="btn gold" id="usesug">Use ${suggested.name}</button>` : ''}<button type="button" class="btn" id="chs">${icon('search')} Choose supplier</button><button type="button" class="btn ghost" id="mks">${icon('plus')} New supplier${d.supplier_name ? ' “' + d.supplier_name + '”' : ''}</button></div>`}</div>
            <div class="row"><label class="fld"><span>Invoice number</span><input name="invoice_number" value="${d.invoice_number || ''}"></label><label class="fld"><span>Invoice date</span><input name="purchase_date" type="date" value="${/^\d{4}-\d{2}-\d{2}$/.test(d.invoice_date || '') ? d.invoice_date : S.isoDate()}"></label></div>
            <div class="section-t">Lines</div>
            <div id="lines">${lines.map((l, i) => html`<div class="ocr-line" data-i="${i}"><label class="fld desc"><span>Description</span><input data-k="description" value="${l.description || ''}"></label>
              <label class="fld"><span>Ref / code</span><input data-k="ref_code" value="${l.ref_code || ''}"></label><label class="fld"><span>Qty</span><input data-k="quantity" inputmode="decimal" value="${l.quantity ?? 1}"></label>
              <label class="fld"><span>Unit cost £</span><input data-k="unit_cost" inputmode="decimal" value="${p2(l.unit_cost)}"></label><label class="fld"><span>Line total £</span><input data-k="line_total" inputmode="decimal" value="${p2(l.line_total)}"></label>
              <button type="button" class="iconbtn" data-rml="${i}" aria-label="Delete line" style="align-self:end">${icon('trash')}</button>
              ${product ? html`<label class="check" style="grid-column:1/-1"><input type="radio" name="mine" value="${i}" ${(l._mine ?? i === 0) ? 'checked' : ''}><span>This line is <b>${product.name || 'this product'}</b></span></label>` : html`<div style="grid-column:1/-1" class="flex small">${l._product ? html`<span>Linked to <b>${l._product.name}</b></span> <button type="button" class="linkbtn" data-unlink="${i}">unlink</button>` : html`<button type="button" class="btn sm" data-link="${i}">${icon('link')} Link to product</button><button type="button" class="btn sm ghost" data-newp="${i}">${icon('plus')} New product draft</button>`}</div>`}</div>`)}</div>
            <button type="button" class="btn sm" id="addl">${icon('plus')} Add line</button>
            <div class="section-t">Other charges</div>
            <div id="charges">${charges.map((c, i) => html`<div class="row" data-c="${i}" style="align-items:end"><label class="fld"><span>Description</span><input data-k="description" value="${c.description || ''}"></label><div class="flex" style="align-items:end"><label class="fld grow"><span>Amount £</span><input data-k="amount" inputmode="decimal" value="${p2(c.amount)}"></label><button type="button" class="iconbtn" data-rmc="${i}" aria-label="Delete charge">${icon('trash')}</button></div></div>`)}</div>
            <button type="button" class="btn sm" id="addc">${icon('plus')} Add charge (delivery, insurance…)</button>
            ${product ? html`<label class="check"><input type="checkbox" name="allocate" checked><span>Add this product's share of the other charges to its landed cost</span></label>` : html`<label class="check"><input type="checkbox" name="allocate" checked><span>Share other charges across the linked products' costs</span></label>`}
            <div class="section-t">Totals</div>
            <div class="row3"><label class="fld"><span>Subtotal £</span><input name="subtotal" inputmode="decimal" value="${p2(d.subtotal)}"></label><label class="fld"><span>VAT £</span><input name="vat" inputmode="decimal" value="${p2(d.vat)}"></label><label class="fld"><span>Total £</span><input name="total" inputmode="decimal" value="${p2(d.total)}"></label></div>
            <div id="check"></div>
            <label class="check"><input type="checkbox" name="add_stock" checked><span>Add the quantities to stock (stocked items)</span></label>
          </form>
          <div class="flex" style="justify-content:flex-end;margin-top:18px"><button class="btn ghost" data-close>Not now</button><button class="btn gold" id="confirm">${icon('check')} I have checked it · Confirm</button></div>`);
        S.bindFiles(box);
        const readBack = () => {   // keep typed values when redrawing
          $$('.ocr-line', box).forEach(r => { const l = lines[+r.dataset.i]; $$('[data-k]', r).forEach(inp => { l[inp.dataset.k] = inp.value; }); const rb = $('input[name=mine]', r); if (rb) l._mine = rb.checked; });
          $$('[data-c]', box).forEach(r => { const c = charges[+r.dataset.c]; $$('[data-k]', r).forEach(inp => { c[inp.dataset.k] = inp.value; }); });
          const f = $('#ocrf', box); d.invoice_number = f.invoice_number.value; d.invoice_date = f.purchase_date.value; d.subtotal = f.subtotal.value; d.vat = f.vat.value; d.total = f.total.value;
        };
        const check = () => {
          readBack();
          const sum = lines.reduce((a, l) => a + (S.pence(l.line_total) || Math.round((S.pence(l.unit_cost) || 0) * (+l.quantity || 1)) || 0), 0) + charges.reduce((a, c) => a + (S.pence(c.amount) || 0), 0) + (S.pence(d.vat) || 0);
          const tot = S.pence(d.total);
          S.render($('#check', box), tot && Math.abs(sum - tot) > 1 ? S.banner('warn', 'The figures do not add up', `Lines + charges + VAT = ${money(sum)}, but the total says ${money(tot)}. Please check before confirming.`) : '');
        };
        $('#ocrf', box).oninput = check; check();
        $('#addl', box).onclick = () => { readBack(); lines.push({ quantity: 1 }); draw(); };
        $('#addc', box).onclick = () => { readBack(); charges.push({}); draw(); };
        S.on(box, '[data-rml]', 'click', (e, b) => { readBack(); lines.splice(+b.dataset.rml, 1); draw(); });
        S.on(box, '[data-rmc]', 'click', (e, b) => { readBack(); charges.splice(+b.dataset.rmc, 1); draw(); });
        S.on(box, '[data-link]', 'click', async (e, b) => { readBack(); const pr = await S.pick({ title: 'Link to product', table: 'products', select: 'id,name,sku,product_type', search: ['name', 'sku'], filter: q => q.is('deleted_at', null).order('updated_at', { ascending: false }), render: x => html`<span class="ic">${icon('gem')}</span><span class="main-t"><span class="t" style="display:block">${x.name || 'Untitled'}</span><span class="d" style="display:block">${x.sku || ''}</span></span>` }); if (pr) { lines[+b.dataset.link]._product = pr; draw(); } });
        S.on(box, '[data-unlink]', 'click', (e, b) => { readBack(); delete lines[+b.dataset.unlink]._product; draw(); });
        S.on(box, '[data-newp]', 'click', async (e, b) => { readBack(); const l = lines[+b.dataset.newp];
          try { const np = await S.act(b, async () => S.must(await S.db.from('products').insert({ name: l.description || 'New product', supplier_id: supplier ? supplier.id : null, supplier_ref: l.ref_code || null, created_by: S.user.id }).select('id,name,product_type').single()), 'Draft product created'); l._product = np; draw(); } catch (er) { } });
        const chs = $('#chs', box); if (chs) chs.onclick = async () => { readBack(); const s2 = await S.pickSupplier(); if (s2) { supplier = s2; draw(); } };
        const us = $('#usesug', box); if (us) us.onclick = () => { readBack(); supplier = suggested; draw(); };
        const mk = $('#mks', box); if (mk) mk.onclick = () => { readBack(); S.supplierSheet({ name: d.supplier_name || '' }, async s2 => { supplier = s2; draw(); }); };
        $('#confirm', box).onclick = async e => {
          readBack(); const f = $('#ocrf', box); S.clearErr(f);
          if (!supplier) return S.toast('Choose or create the supplier first.', { bad: true });
          const bad = []; const outLines = lines.map((l, i) => {
            const q = l.quantity === '' || l.quantity == null ? 1 : +l.quantity; const uc = S.pence(l.unit_cost), lt = S.pence(l.line_total);
            if (!(q > 0)) bad.push(`Line ${i + 1}: quantity`); if (Number.isNaN(uc) || Number.isNaN(lt)) bad.push(`Line ${i + 1}: amounts must be numbers`);
            if (uc == null && lt == null) bad.push(`Line ${i + 1}: enter a unit cost or line total`);
            const unit = uc != null ? uc : lt != null ? Math.round(lt / q) : null;
            const pid = product ? (l._mine ? product.id : null) : (l._product ? l._product.id : null);
            return { description: l.description || '', ref_code: l.ref_code || null, quantity: q, unit_cost_pence: unit, line_total_pence: lt != null ? lt : unit != null ? Math.round(unit * q) : null, product_id: pid, add_stock: f.add_stock.checked };
          });
          const outCharges = charges.filter(c => c.amount !== '' && c.amount != null).map(c => ({ description: c.description || 'Charge', amount_pence: S.pence(c.amount) }));
          if (outCharges.some(c => Number.isNaN(c.amount_pence))) bad.push('Other charges must be numbers');
          ['subtotal', 'vat', 'total'].forEach(k => { if (Number.isNaN(S.pence(f[k].value))) bad.push(S.label(k) + ' must be a number'); });
          if (product && !outLines.some(l => l.product_id)) bad.push('Tick which line is this product');
          if (bad.length) return S.toast('Please fix: ' + bad.slice(0, 3).join('; '), { bad: true });
          try {
            await S.act(e.currentTarget, () => S.rpc('confirm_purchase', { p: { document_id: doc.id, supplier_id: supplier.id, invoice_number: f.invoice_number.value, purchase_date: f.purchase_date.value || null,
              subtotal_pence: S.pence(f.subtotal.value), vat_pence: S.pence(f.vat.value), total_pence: S.pence(f.total.value), other_charges: outCharges, lines: outLines,
              allocate_charges: f.allocate.checked, ocr_used: !!fromOcr } }), 'Purchase confirmed and costs added');
            sh.close(); onDone && onDone();
          } catch (er) { }
        };
      };
      draw();
    }
    start();
  };

  // =========================== PURCHASING ===========================
  S.route('/purchases', async (v, p, live) => {
    const [rows, unchecked] = await Promise.all([
      S.db.from('purchases').select('*, suppliers(name)').is('deleted_at', null).order('purchase_date', { ascending: false }).limit(200).then(S.must),
      S.db.from('documents').select('*, suppliers(name)').in('kind', ['supplier_invoice', 'supplier_receipt']).in('ocr_status', ['none', 'read', 'failed']).is('purchase_id', null).is('deleted_at', null).order('created_at', { ascending: false }).then(S.must)]);
    if (!live()) return;
    S.render(v, html`${S.page({ title: 'Purchasing', sub: 'Supplier invoices and what each piece really cost', acts: html`<a class="btn gold" href="#/purchases/new">${icon('camera')} Add supplier invoice</a>` })}
      ${unchecked.length ? html`<section class="card tint" style="margin-bottom:18px"><div class="ch"><div><h2>Waiting to be checked</h2><p class="muted small">Documents uploaded but not yet confirmed. Nothing from them counts until checked.</p></div></div>
        <div class="list">${unchecked.map(d => html`<button class="li" data-doc="${d.id}"><span class="ic">${icon('receipt')}</span><span class="main-t"><span class="t" style="display:block">${d.filename}</span><span class="d" style="display:block">${d.suppliers ? d.suppliers.name + ' · ' : ''}${date(d.created_at)}</span></span>${S.pill('ocr', d.ocr_status)}${icon('chev', 'chev')}</button>`)}</div></section>` : ''}
      ${rows.length ? html`<div class="list">${rows.map(pu => html`<a class="li" href="#/purchases/${pu.id}"><span class="ic">${icon('cart')}</span><span class="main-t"><span class="t" style="display:block">${pu.suppliers ? pu.suppliers.name : 'Unknown supplier'}</span><span class="d" style="display:block">${pu.invoice_number || 'No invoice no.'} · ${date(pu.purchase_date)}${pu.ocr_used ? ' · read by OCR, checked' : ''}</span></span>
        <span class="end">${S.canFinance() ? html`<span class="amt">${money(pu.total_pence)}</span>` : ''}${pill('purchase', pu.status)}</span>${icon('chev', 'chev')}</a>`)}</div>`
        : S.empty({ icon: 'cart', title: 'No purchases yet', text: 'Photograph a supplier invoice to record what you bought and what it cost.', action: html`<a class="btn gold" href="#/purchases/new">${icon('camera')} Add supplier invoice</a>` })}`);
    S.on(v, '[data-doc]', 'click', (e, b) => S.purchaseReview(unchecked.find(d => d.id === b.dataset.doc), { onDone: S.dispatch }));
  });
  S.route('/purchases/new', async v => {
    const sid = S.params().get('supplier'); let sup = sid ? S.must(await S.db.from('suppliers').select('*').eq('id', sid).maybeSingle()) : null;
    S.render(v, html`${S.page({ title: 'Add supplier invoice', crumb: ['Purchasing', '#/purchases'] })}<div class="card" style="max-width:640px"><div class="stack">
      <div id="sp"></div><p class="muted">Take a photo of the invoice or receipt, or upload a PDF. You will check every figure before anything is saved.</p>
      <div class="flex"><label class="btn gold">${icon('camera')} Take photo<input type="file" accept="image/*" capture="environment" hidden data-f></label><label class="btn">${icon('upload')} Upload file<input type="file" accept="image/*,application/pdf" hidden data-f></label></div></div></div>`);
    const dp = () => { S.render($('#sp', v), sup ? html`<div class="li" style="border:1px solid var(--line);border-radius:12px"><span class="ic">${icon('truck')}</span><span class="main-t"><span class="t" style="display:block">${sup.name}</span></span><button class="btn sm" id="cs">Change</button></div>` : html`<button class="btn" id="cs">${icon('search')} Choose supplier (optional)</button>`);
      $('#cs', v).onclick = async () => { const s2 = await S.pickSupplier(); if (s2) { sup = s2; dp(); } }; };
    dp();
    S.$$('[data-f]', v).forEach(inp => inp.onchange = async () => { const f = inp.files[0]; if (!f) return;
      try { const d = await S.act(null, () => S.addSupplierDoc(f, { supplier_id: sup ? sup.id : null, kind: 'supplier_invoice' }), 'Document saved'); S.purchaseReview(d, { onDone: () => S.go('#/purchases') }); } catch (e) { } });
  });
  S.route('/purchases/:id', async (v, p, live) => {
    const pu = S.must(await S.db.from('purchases').select('*, suppliers(*), purchase_lines(*, products(id,name)), documents!purchases_document_id_fkey(*)').eq('id', p.id).maybeSingle());
    await S.staffList();
    if (!live()) return;
    if (!pu) return S.render(v, S.empty({ icon: 'cart', title: 'Purchase not found' }));
    const doc = pu.documents;
    S.render(v, html`${S.page({ title: pu.invoice_number || 'Purchase', crumb: ['Purchasing', '#/purchases'], sub: html`${pu.suppliers ? pu.suppliers.name + ' · ' : ''}${date(pu.purchase_date)} ${pill('purchase', pu.status)}`,
      acts: doc ? html`<a class="btn" href="#" data-open="${doc.bucket}|${doc.path}">${icon('eye')} View document</a>` : '' })}
      <section class="card"><div class="tblwrap"><table class="tbl resp"><thead><tr><th>Description</th><th>Ref</th><th class="num">Qty</th><th class="num">Unit cost</th><th class="num">Line total</th><th>Product</th></tr></thead><tbody>
        ${pu.purchase_lines.map(l => html`<tr><td data-l="Description">${l.description}</td><td data-l="Ref">${l.ref_code || ''}</td><td class="num" data-l="Qty">${+l.quantity}</td><td class="num" data-l="Unit cost">${money(l.unit_cost_pence)}</td><td class="num" data-l="Line total">${money(l.line_total_pence)}</td><td data-l="Product">${l.products ? html`<a href="#/products/${l.products.id}">${l.products.name}</a>` : '—'}</td></tr>`)}</tbody></table></div>
        <div class="calc totals" style="margin-top:16px">${pu.other_charges_pence ? html`<div class="r"><span>Other charges</span><span>${money(pu.other_charges_pence)}</span></div>` : ''}<div class="r"><span>Subtotal</span><span>${money(pu.subtotal_pence)}</span></div><div class="r"><span>VAT</span><span>${money(pu.vat_pence)}</span></div><div class="r tot"><span>Total</span><span>${money(pu.total_pence)}</span></div></div>
        <p class="small muted" style="margin:14px 0 0">${pu.ocr_used ? 'Read automatically, then checked and confirmed' : 'Entered by hand and confirmed'}${pu.confirmed_by ? ' by ' + S.staffName(pu.confirmed_by) : ''}${pu.confirmed_at ? ' on ' + dateTime(pu.confirmed_at) : ''}.</p></section>`);
    S.bindFiles(v);
  });
})();
