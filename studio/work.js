/* LK Studio: Tasks & follow-ups, Notes, Documents. */
(function () {
  const { html, raw, icon, money, date, dateTime, ago, pill, $, $$ } = S;

  // =========================== TASKS ===========================
  const taskLinks = t => [t.customers && ['users', S.name(t.customers), '#/customers/' + t.customer_id], t.products && ['gem', t.products.name, '#/products/' + t.product_id],
    t.suppliers && ['truck', t.suppliers.name, '#/suppliers/' + t.supplier_id], t.lead_id && ['inbox', 'Enquiry', '#/leads/' + t.lead_id], t.quote_id && ['quote', 'Quote', '#/quotes/' + t.quote_id],
    t.order_id && ['bag', 'Order', '#/orders/' + t.order_id], t.invoice_id && ['receipt', 'Invoice', '#/invoices/' + t.invoice_id]].filter(Boolean);
  const taskRow = t => { const over = t.status === 'open' && t.due_at && new Date(t.due_at) < new Date();
    return html`<div class="li" style="${t.status !== 'open' ? 'opacity:.55' : ''}"><label class="check" style="margin:0"><input type="checkbox" data-tdone="${t.id}" ${t.status === 'done' ? 'checked' : ''} aria-label="Done"></label>
      <button class="main-t" data-tedit="${t.id}" style="background:none;border:0;text-align:left;padding:0;cursor:pointer;min-width:0"><span class="t" style="display:block;${t.status === 'done' ? 'text-decoration:line-through' : ''}">${t.title}</span>
      <span class="d" style="display:block">${t.due_at ? raw(`<span style="color:${over ? 'var(--rose-d)' : 'inherit'}">${over ? 'Overdue · ' : 'Due '}${S.esc(S.dateTime(t.due_at))}</span>`) : 'No due date'}${t.assigned_to ? ' · ' + S.staffName(t.assigned_to) : ''}</span>
      ${taskLinks(t).length ? html`<span class="d flex" style="gap:10px;margin-top:2px">${taskLinks(t).map(([i, l]) => html`<span>${l}</span>`)}</span>` : ''}</button>
      <span class="end">${t.priority !== 'normal' ? pill('priority', t.priority) : ''}${t.kind === 'follow_up' ? raw('<span class="tiny muted">Follow-up</span>') : ''}</span></div>`; };
  const TSEL = '*, customers(first_name,last_name), products(name), suppliers(name)';

  // Reusable list (used on customer, enquiry and the Tasks page)
  S.taskList = async (host, filter, defaults, compact) => {
    await S.staffList();
    const el = document.createElement('div'); host.replaceChildren(el);
    let b = S.db.from('tasks').select(TSEL).order('status').order('due_at', { ascending: true, nullsFirst: false }).limit(200);
    Object.entries(filter).forEach(([k, val]) => { b = b.eq(k, val); });
    const rows = S.must(await b);
    S.render(el, html`${compact ? '' : html`<div class="row-between" style="margin-bottom:14px"><span></span><button class="btn" data-tnew>${icon('plus')} Add follow-up</button></div>`}
      ${rows.length ? html`<div class="list">${rows.map(taskRow)}</div>` : S.empty({ icon: 'task', title: 'No follow-ups', text: 'Add a reminder to call, email or chase.' })}
      ${compact ? html`<div style="margin-top:12px"><button class="btn sm" data-tnew>${icon('plus')} Add follow-up</button></div>` : ''}`);
    bindTasks(el, rows, () => S.taskList(host, filter, defaults, compact), defaults);
  };
  function bindTasks(el, rows, refresh, defaults) {
    S.on(el, '[data-tdone]', 'change', async (e, c) => { try { S.must(await S.db.from('tasks').update({ status: c.checked ? 'done' : 'open' }).eq('id', c.dataset.tdone)); S.toast(c.checked ? 'Done' : 'Reopened'); refresh(); } catch (er) { c.checked = !c.checked; S.toast(er.message, { bad: true }); } });
    S.on(el, '[data-tedit]', 'click', (e, b) => S.taskSheet(rows.find(t => t.id === b.dataset.tedit), refresh));
    S.on(el, '[data-tnew]', 'click', () => S.taskSheet(Object.assign({ kind: 'follow_up' }, defaults || {}), refresh));
  }
  S.taskSheet = async (t, after) => {
    const staff = await S.staffList(); t = t || {};
    let link = { customer: t.customers ? { id: t.customer_id, ...t.customers } : null, product: t.products ? { id: t.product_id, ...t.products } : null, supplier: t.suppliers ? { id: t.supplier_id, ...t.suppliers } : null };
    if (t.customer_id && !link.customer) link.customer = S.must(await S.db.from('customers').select('id,first_name,last_name').eq('id', t.customer_id).maybeSingle());
    const dueLocal = t.due_at ? new Date(new Date(t.due_at) - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16) : '';
    const s = S.sheet({ title: t.id ? 'Edit task' : t.kind === 'follow_up' ? 'New follow-up' : 'New task', body: html`<form class="form" id="tf" novalidate>
      <label class="fld"><span>What needs doing?</span><input name="title" value="${t.title || ''}" maxlength="200" placeholder="e.g. Call Ann about the sketch"></label>
      <div class="chips">${['Call customer', 'Email customer', 'Follow up quote', 'Chase payment', 'Contact supplier', 'Order stock', 'Check delivery'].map(q => html`<button type="button" class="chip" data-q="${q}">${q}</button>`)}</div>
      <label class="fld"><span>Details <em>(optional)</em></span><textarea name="description" style="min-height:80px">${t.description || ''}</textarea></label>
      <div class="row"><label class="fld"><span>Due</span><input type="datetime-local" name="due_at" value="${dueLocal}"></label><label class="fld"><span>Priority</span><select name="priority">${S.opts([['low', 'Low'], ['normal', 'Normal'], ['high', 'High']], t.priority || 'normal')}</select></label></div>
      <div class="row"><label class="fld"><span>Assigned to</span><select name="assigned_to">${S.opts([['', 'Unassigned'], ...staff.filter(x => x.active).map(x => [x.user_id, x.full_name])], t.id ? (t.assigned_to || '') : S.user.id)}</select></label>
        <label class="fld"><span>Type</span><select name="kind">${S.opts([['follow_up', 'Follow-up'], ['task', 'Task']], t.kind || 'task')}</select></label></div>
      <div class="section-t">Related to</div><div class="flex" id="links"></div>
      ${t.id ? html`<label class="fld"><span>Status</span><select name="status">${S.opts([['open', 'Open'], ['done', 'Done'], ['cancelled', 'Cancelled']], t.status)}</select></label>` : ''}</form>`,
      foot: html`<button class="btn ghost" data-close>Cancel</button><button class="btn gold" id="ok">${t.id ? 'Save' : 'Add'}</button>` });
    const f = $('#tf', s.el);
    S.on(s.el, '[data-q]', 'click', (e, b) => { f.title.value = b.dataset.q + (link.customer ? ': ' + S.name(link.customer) : ''); });
    const drawLinks = () => { S.render($('#links', s.el), html`${['customer', 'product', 'supplier'].map(k => html`<button type="button" class="btn sm ${link[k] ? '' : 'ghost'}" data-lk="${k}">${icon(k === 'customer' ? 'users' : k === 'product' ? 'gem' : 'truck')} ${link[k] ? (k === 'customer' ? S.name(link[k]) : link[k].name) : 'Add ' + k}</button>`)}`);
      S.$$('[data-lk]', s.el).forEach(b => b.onclick = async () => { const k = b.dataset.lk; if (link[k]) { link[k] = null; return drawLinks(); }
        const r = k === 'customer' ? await S.pickCustomer() : k === 'supplier' ? await S.pickSupplier() : await S.pick({ title: 'Product', table: 'products', select: 'id,name,sku', search: ['name', 'sku'], filter: q => q.is('deleted_at', null), render: x => html`<span class="main-t"><span class="t">${x.name || 'Untitled'}</span></span>` });
        if (r) { link[k] = r; drawLinks(); } }); };
    drawLinks();
    $('#ok', s.el).onclick = e => { S.clearErr(f); const o = S.form(f); if (!o.title) return S.fieldErr(f, 'title', 'Describe the task');
      const row = { title: o.title, description: o.description || null, due_at: o.due_at ? new Date(o.due_at).toISOString() : null, priority: o.priority, assigned_to: o.assigned_to || null, kind: o.kind,
        customer_id: link.customer ? link.customer.id : null, product_id: link.product ? link.product.id : null, supplier_id: link.supplier ? link.supplier.id : null };
      if (!t.id) Object.assign(row, { lead_id: t.lead_id || null, quote_id: t.quote_id || null, order_id: t.order_id || null, invoice_id: t.invoice_id || null }); else row.status = o.status;
      S.act(e.currentTarget, async () => { if (t.id) S.must(await S.db.from('tasks').update(row).eq('id', t.id)); else S.must(await S.db.from('tasks').insert(Object.assign(row, { created_by: S.user.id }))); s.close(); after && after(); }, t.id ? 'Task saved' : 'Added').catch(() => {}); };
  };

  S.route('/tasks', async (v, p, live) => {
    const view = S.params().get('view') || 'mine'; await S.staffList();
    let b = S.db.from('tasks').select(TSEL).order('due_at', { ascending: true, nullsFirst: false }).limit(300);
    if (view === 'mine') b = b.eq('status', 'open').or(`assigned_to.eq.${S.user.id},assigned_to.is.null`);
    if (view === 'all') b = b.eq('status', 'open'); if (view === 'overdue') b = b.eq('status', 'open').lt('due_at', new Date().toISOString());
    if (view === 'done') b = b.eq('status', 'done').order('completed_at', { ascending: false });
    const rows = S.must(await b); if (!live()) return;
    S.render(v, html`${S.page({ title: 'Tasks', sub: 'Follow-ups and jobs for the team', acts: html`<button class="btn gold" id="nt">${icon('plus')} New task</button>` })}
      <form class="toolbar" id="qa"><div class="search">${icon('plus')}<input name="title" placeholder="Quick add: type a task and press Enter" aria-label="Quick add task"></div></form>
      <div class="scrollx" style="margin-bottom:16px"><div class="chips" style="flex-wrap:nowrap">${[['mine', 'Mine'], ['all', 'All open'], ['overdue', 'Overdue'], ['done', 'Done']].map(([k, l]) => html`<a class="chip ${k === view ? 'on' : ''}" href="#/tasks?view=${k}">${l}</a>`)}</div></div>
      ${rows.length ? html`<div class="list">${rows.map(taskRow)}</div>` : S.empty({ icon: 'task', title: view === 'done' ? 'Nothing completed yet' : 'All clear', text: 'Nothing waiting here.' })}`);
    bindTasks(v, rows, S.dispatch, { kind: 'task' });
    $('#nt', v).onclick = () => S.taskSheet({ kind: 'task' }, S.dispatch);
    $('#qa', v).onsubmit = e => { e.preventDefault(); const tt = e.target.title.value.trim(); if (!tt) return;
      S.act(null, async () => { S.must(await S.db.from('tasks').insert({ title: tt, kind: 'task', assigned_to: S.user.id, created_by: S.user.id })); S.dispatch(); }, 'Task added').catch(() => {}); };
  });

  // =========================== NOTES ===========================
  const NCATS = [['general', 'General'], ['customer', 'Customer'], ['product', 'Product'], ['supplier', 'Supplier'], ['idea', 'Idea'], ['reminder', 'Reminder']];
  S.noteList = async (host, filter) => {
    const el = document.createElement('div'); host.replaceChildren(el);
    let b = S.db.from('notes').select('*, customers(first_name,last_name), products(name), suppliers(name)').is('deleted_at', null).order('pinned', { ascending: false }).order('updated_at', { ascending: false }).limit(200);
    Object.entries(filter || {}).forEach(([k, val]) => { b = b.eq(k, val); });
    const rows = S.must(await b);
    S.render(el, html`<div class="row-between" style="margin-bottom:14px"><span></span><button class="btn" data-nnew>${icon('plus')} Add note</button></div>${noteGrid(rows)}`);
    S.on(el, '[data-nnew]', 'click', () => S.noteSheet(Object.assign({}, filter), () => S.noteList(host, filter)));
    S.on(el, '[data-note]', 'click', (e, b2) => S.noteSheet(rows.find(n => n.id === b2.dataset.note), () => S.noteList(host, filter)));
  };
  const noteGrid = rows => rows.length ? html`<div class="grid g3">${rows.map(n => html`<button class="card" data-note="${n.id}" style="text-align:left;cursor:pointer;font:inherit;color:inherit;margin:0">
    <div class="row-between"><span class="tiny" style="letter-spacing:.14em;text-transform:uppercase;color:var(--gold-d)">${(NCATS.find(c => c[0] === n.category) || [, 'General'])[1]}${n.pinned ? ' · pinned' : ''}</span><span class="tiny muted">${ago(n.updated_at)}</span></div>
    ${n.title ? html`<h3 style="font-size:1.2rem;margin:8px 0 4px">${n.title}</h3>` : ''}<p class="small" style="margin:6px 0 0;display:-webkit-box;-webkit-line-clamp:5;-webkit-box-orient:vertical;overflow:hidden;white-space:pre-wrap">${n.body}</p>
    ${n.reminder_at ? html`<p class="tiny" style="margin:10px 0 0;color:${new Date(n.reminder_at) < new Date() ? 'var(--rose-d)' : 'var(--muted)'}">${icon('clock')} Reminder ${S.dateTime(n.reminder_at)}</p>` : ''}
    ${n.customers || n.products || n.suppliers ? html`<p class="tiny muted" style="margin:6px 0 0">${[n.customers && S.name(n.customers), n.products && n.products.name, n.suppliers && n.suppliers.name].filter(Boolean).join(' · ')}</p>` : ''}</button>`)}</div>`
    : S.empty({ icon: 'note', title: 'No notes yet', text: 'Jot down ideas, measurements, conversations or reminders.' });

  S.noteSheet = async (n, after) => {
    n = n || {};
    const atts = n.id ? S.must(await S.db.from('documents').select('*').eq('note_id', n.id).is('deleted_at', null)) : [];
    let link = { customer: n.customers ? { id: n.customer_id, ...n.customers } : n.customer_id ? S.must(await S.db.from('customers').select('id,first_name,last_name').eq('id', n.customer_id).maybeSingle()) : null,
      product: n.products ? { id: n.product_id, ...n.products } : null, supplier: n.suppliers ? { id: n.supplier_id, ...n.suppliers } : null };
    const remLocal = n.reminder_at ? new Date(new Date(n.reminder_at) - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16) : '';
    const s = S.sheet({ title: n.id ? 'Note' : 'New note', body: html`<form class="form" id="nf" novalidate>
      <label class="fld"><span>Title <em>(optional)</em></span><input name="title" value="${n.title || ''}" maxlength="140"></label>
      <label class="fld"><span>Note</span><textarea name="body" style="min-height:160px" placeholder="Write anything…">${n.body || ''}</textarea></label>
      <div class="row"><label class="fld"><span>Category</span><select name="category">${S.opts(NCATS, n.category || (link.customer ? 'customer' : 'general'))}</select></label><label class="fld"><span>Reminder <em>(optional)</em></span><input type="datetime-local" name="reminder_at" value="${remLocal}"></label></div>
      <label class="check"><input type="checkbox" name="pinned" ${n.pinned ? 'checked' : ''}><span>Pin to the top</span></label>
      <div class="section-t">Related to</div><div class="flex" id="nl"></div>
      <div class="section-t">Attachments</div><div class="files" id="na">${atts.map(S.fileTile)}</div><label class="btn sm" style="width:max-content">${icon('camera')} Add photo or file<input type="file" hidden id="nfile" accept="image/*,application/pdf"></label><div id="pending" class="tiny muted"></div></form>`,
      foot: html`${n.id ? html`<button class="btn danger" id="nd">Delete</button>` : ''}<button class="btn ghost" data-close>Close</button><button class="btn gold" id="ok">Save note</button>` });
    const f = $('#nf', s.el); const pending = [];
    S.bindFiles(s.el);
    const drawLinks = () => { S.render($('#nl', s.el), html`${['customer', 'product', 'supplier'].map(k => html`<button type="button" class="btn sm ${link[k] ? '' : 'ghost'}" data-lk="${k}">${link[k] ? (k === 'customer' ? S.name(link[k]) : link[k].name) : 'Add ' + k}</button>`)}`);
      S.$$('[data-lk]', s.el).forEach(b => b.onclick = async () => { const k = b.dataset.lk; if (link[k]) { link[k] = null; return drawLinks(); }
        const r = k === 'customer' ? await S.pickCustomer() : k === 'supplier' ? await S.pickSupplier() : await S.pick({ title: 'Product', table: 'products', select: 'id,name', search: ['name', 'sku'], filter: q => q.is('deleted_at', null), render: x => html`<span class="main-t"><span class="t">${x.name || 'Untitled'}</span></span>` });
        if (r) { link[k] = r; drawLinks(); } }); };
    drawLinks();
    $('#nfile', s.el).onchange = e => { const file = e.target.files[0]; if (file) { pending.push(file); $('#pending', s.el).textContent = pending.map(x => x.name).join(', ') + ' will be attached when you save.'; } };
    const nd = $('#nd', s.el); if (nd) nd.onclick = async () => { if (!(await S.confirm({ title: 'Delete this note?', confirm: 'Delete', danger: true }))) return;
      S.act(nd, async () => { S.must(await S.db.from('notes').update({ deleted_at: new Date().toISOString() }).eq('id', n.id)); s.close(); after && after(); }, 'Note deleted').catch(() => {}); };
    $('#ok', s.el).onclick = e => { S.clearErr(f); const o = S.form(f); if (!o.body && !o.title) return S.fieldErr(f, 'body', 'Write something first');
      const row = { title: o.title || '', body: o.body || '', category: o.category, reminder_at: o.reminder_at ? new Date(o.reminder_at).toISOString() : null, pinned: !!o.pinned, updated_at: new Date().toISOString(),
        customer_id: link.customer ? link.customer.id : null, product_id: link.product ? link.product.id : null, supplier_id: link.supplier ? link.supplier.id : null };
      S.act(e.currentTarget, async () => {
        const id = n.id ? (S.must(await S.db.from('notes').update(row).eq('id', n.id)), n.id) : S.must(await S.db.from('notes').insert(Object.assign(row, { created_by: S.user.id })).select('id').single()).id;
        for (const file of pending) { const prep = await S.prepareImage(file, 2400); const path = `notes/${id}/${S.uuid()}-${S.safeName(file.name)}`; await S.upload('business-docs', path, prep.blob, prep.type);
          S.must(await S.db.from('documents').insert({ kind: 'note_attachment', bucket: 'business-docs', path, filename: file.name, mime: prep.type, size_bytes: prep.blob.size, note_id: id, customer_id: row.customer_id, product_id: row.product_id, supplier_id: row.supplier_id, uploaded_by: S.user.id })); }
        s.close(); after && after(); }, 'Note saved').catch(() => {}); };
  };
  S.route('/notes', async (v, p, live) => {
    const cat = S.params().get('cat') || 'all', q = S.params().get('q') || '';
    let b = S.db.from('notes').select('*, customers(first_name,last_name), products(name), suppliers(name)').is('deleted_at', null).order('pinned', { ascending: false }).order('updated_at', { ascending: false }).limit(300);
    if (cat !== 'all') b = b.eq('category', cat);
    if (q) b = b.or(`title.ilike.*${q.replace(/[,()*]/g, ' ')}*,body.ilike.*${q.replace(/[,()*]/g, ' ')}*`);
    const rows = S.must(await b); if (!live()) return;
    const due = rows.filter(n => n.reminder_at && new Date(n.reminder_at) < new Date(Date.now() + 864e5));
    S.render(v, html`${S.page({ title: 'Notes', sub: 'Quick notes, ideas and reminders', acts: html`<button class="btn gold" id="nn">${icon('plus')} New note</button>` })}
      <form class="toolbar" id="ns"><div class="search">${icon('search')}<input name="q" value="${q}" placeholder="Search notes"></div></form>
      <div class="scrollx" style="margin-bottom:16px"><div class="chips" style="flex-wrap:nowrap">${[['all', 'All'], ...NCATS].map(([k, l]) => html`<a class="chip ${k === cat ? 'on' : ''}" href="#/notes?cat=${k}">${l}</a>`)}</div></div>
      ${due.length ? S.banner('warn', `${due.length} reminder${due.length === 1 ? '' : 's'} due`, due.map(n => n.title || n.body.slice(0, 40)).join(' · ')) : ''}
      ${noteGrid(rows)}`);
    $('#nn', v).onclick = () => S.noteSheet({}, S.dispatch);
    S.on(v, '[data-note]', 'click', (e, b2) => S.noteSheet(rows.find(n => n.id === b2.dataset.note), S.dispatch));
    $('#ns', v).onsubmit = e => { e.preventDefault(); S.go('#/notes?cat=' + cat + '&q=' + encodeURIComponent(e.target.q.value.trim())); };
    const open = S.params().get('open'); if (open) { const n = rows.find(x => x.id === open) || S.must(await S.db.from('notes').select('*').eq('id', open).maybeSingle()); if (n) S.noteSheet(n, S.dispatch); }
  });

  // =========================== DOCUMENTS ===========================
  const DGROUPS = [['all', 'All', null], ['supplier', 'Supplier invoices & receipts', ['supplier_invoice', 'supplier_receipt', 'purchase_document']], ['customer', 'Customer designs & files', ['customer_design', 'inspiration', 'customer_document', 'enquiry_attachment']],
    ['sales', 'Quotes & invoices', ['quote_pdf', 'invoice_pdf']], ['product', 'Product documents', ['product_document']], ['expense', 'Expense receipts', ['expense_receipt']], ['notes', 'Note attachments', ['note_attachment']]];
  S.route('/documents', async (v, p, live) => {
    const g = S.params().get('g') || 'all', q = S.params().get('q') || ''; const grp = DGROUPS.find(x => x[0] === g) || DGROUPS[0];
    let b = S.db.from('documents').select('*, suppliers(name), customers(first_name,last_name), products(name)').is('deleted_at', null).order('created_at', { ascending: false }).limit(300);
    if (grp[2]) b = b.in('kind', grp[2]);
    if (q) b = b.or(`filename.ilike.*${q.replace(/[,()*]/g, ' ')}*,title.ilike.*${q.replace(/[,()*]/g, ' ')}*`);
    if (!S.canFinance()) b = b.not('kind', 'in', '(expense_receipt,invoice_pdf)');
    const rows = S.must(await b); if (!live()) return;
    S.render(v, html`${S.page({ title: 'Documents', sub: 'Every file, kept with the record it belongs to', acts: html`<button class="btn gold" id="nd">${icon('upload')} Add document</button>` })}
      <form class="toolbar" id="ds"><div class="search">${icon('search')}<input name="q" value="${q}" placeholder="Search file names"></div></form>
      <div class="scrollx" style="margin-bottom:16px"><div class="chips" style="flex-wrap:nowrap">${DGROUPS.map(([k, l]) => html`<a class="chip ${k === g ? 'on' : ''}" href="#/documents?g=${k}">${l}</a>`)}</div></div>
      ${rows.length ? html`<div class="list">${rows.map(d => html`<div class="li"><span class="ic">${icon(/^image\//.test(d.mime || '') ? 'image' : 'file')}</span>
        <span class="main-t"><a class="t" style="display:block" href="#" data-open="${d.bucket}|${d.path}">${d.title || d.filename || 'File'}</a>
        <span class="d" style="display:block">${S.label(d.kind)} · ${date(d.created_at)}${d.uploaded_by_customer ? ' · from customer' : ''}</span>
        <span class="d flex" style="gap:10px">${d.customers ? html`<a href="#/customers/${d.customer_id}">${S.name(d.customers)}</a>` : ''}${d.suppliers ? html`<a href="#/suppliers/${d.supplier_id}">${d.suppliers.name}</a>` : ''}${d.products ? html`<a href="#/products/${d.product_id}">${d.products.name || 'Product'}</a>` : ''}${d.purchase_id ? html`<a href="#/purchases/${d.purchase_id}">Purchase</a>` : ''}${d.invoice_id ? html`<a href="#/invoices/${d.invoice_id}">Invoice</a>` : ''}${d.note_id ? html`<a href="#/notes?open=${d.note_id}">Note</a>` : ''}</span></span>
        ${['supplier_invoice', 'supplier_receipt'].includes(d.kind) ? S.pill('ocr', d.ocr_status) : ''}</div>`)}</div>`
        : S.empty({ icon: 'folder', title: 'No documents here' })}`);
    S.bindFiles(v);
    $('#ds', v).onsubmit = e => { e.preventDefault(); S.go('#/documents?g=' + g + '&q=' + encodeURIComponent(e.target.q.value.trim())); };
    $('#nd', v).onclick = () => {
      let link = {};
      const s = S.sheet({ title: 'Add document', body: html`<form class="form" id="df"><label class="fld"><span>Type</span><select name="kind">${S.opts([['supplier_invoice', 'Supplier invoice'], ['supplier_receipt', 'Supplier receipt'], ['purchase_document', 'Other supplier document'], ['product_document', 'Product document (certificate, valuation…)'], ['customer_document', 'Customer document']])}</select></label>
        <label class="fld"><span>Title <em>(optional)</em></span><input name="title" maxlength="140"></label><div class="flex" id="dl"></div><label class="fld"><span>File</span><input type="file" name="file" accept="image/*,application/pdf"></label></form>`,
        foot: html`<button class="btn ghost" data-close>Cancel</button><button class="btn gold" id="ok">Upload</button>` });
      const f = $('#df', s.el);
      const drawL = () => { const k = f.kind.value; const need = k.startsWith('supplier') || k === 'purchase_document' ? 'supplier' : k === 'product_document' ? 'product' : 'customer';
        S.render($('#dl', s.el), html`<button type="button" class="btn sm" id="pk">${icon(need === 'supplier' ? 'truck' : need === 'product' ? 'gem' : 'users')} ${link[need] ? (need === 'customer' ? S.name(link[need]) : link[need].name) : 'Choose ' + need}</button>`);
        $('#pk', s.el).onclick = async () => { const r = need === 'customer' ? await S.pickCustomer() : need === 'supplier' ? await S.pickSupplier() : await S.pick({ title: 'Product', table: 'products', select: 'id,name', search: ['name', 'sku'], filter: q2 => q2.is('deleted_at', null), render: x => html`<span class="main-t"><span class="t">${x.name}</span></span>` }); if (r) { link = { [need]: r }; drawL(); } }; };
      f.kind.onchange = () => { link = {}; drawL(); }; drawL();
      $('#ok', s.el).onclick = e => { const o = S.form(f); const file = f.file.files[0]; if (!file) return S.fieldErr(f, 'file', 'Choose a file'); const k = o.kind;
        if (k === 'customer_document' && !link.customer) return S.toast('Choose the customer this belongs to.', { bad: true });
        S.act(e.currentTarget, async () => {
          if (k.startsWith('supplier') || k === 'purchase_document') { const d = await S.addSupplierDoc(file, { supplier_id: link.supplier && link.supplier.id, kind: k }); if (o.title) await S.db.from('documents').update({ title: o.title }).eq('id', d.id); }
          else { const bucket = k === 'customer_document' ? 'customer-files' : 'business-docs'; const prep = await S.prepareImage(file, 3000, 0.9);
            const path = k === 'customer_document' ? `${link.customer.id}/lk-${S.uuid()}-${S.safeName(file.name)}` : `products/${link.product ? link.product.id : 'general'}/${S.uuid()}-${S.safeName(file.name)}`;
            await S.upload(bucket, path, prep.blob, prep.type);
            S.must(await S.db.from('documents').insert({ kind: k, bucket, path, filename: file.name, title: o.title || null, mime: prep.type, size_bytes: prep.blob.size, customer_id: link.customer ? link.customer.id : null, product_id: link.product ? link.product.id : null, uploaded_by: S.user.id })); }
          s.close(); S.dispatch(); }, 'Document added').catch(() => {}); };
    };
  });
})();
