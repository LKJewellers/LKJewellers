/* LK Studio: Quotes, Orders, Invoices, Payments & payment links. */
(function () {
  const { html, raw, icon, money, date, dateTime, ago, pill, $, $$ } = S;
  const KINDS = {
    quote: { table: 'quotes', lines: 'quote_lines', fk: 'quote_id', title: 'Quote', plural: 'Quotes', icon: 'quote', editable: d => d.status === 'draft' },
    order: { table: 'orders', lines: 'order_lines', fk: 'order_id', title: 'Order', plural: 'Orders', icon: 'bag', editable: d => ['draft', 'confirmed'].includes(d.status) },
    invoice: { table: 'invoices', lines: 'invoice_lines', fk: 'invoice_id', title: 'Invoice', plural: 'Invoices', icon: 'receipt', editable: d => d.status === 'draft' }
  };

  // =========================== LISTS ===========================
  const FILTERS = {
    quote: [['all', 'All'], ['draft', 'Drafts'], ['sent', 'Sent'], ['viewed', 'Viewed'], ['accepted', 'Accepted'], ['declined', 'Declined'], ['expired', 'Expired']],
    order: [['open', 'Open'], ['draft', 'Drafts'], ['confirmed', 'Confirmed'], ['in_progress', 'In progress'], ['awaiting_payment', 'Awaiting payment'], ['paid', 'Paid'], ['completed', 'Completed'], ['cancelled', 'Cancelled'], ['all', 'All']],
    invoice: [['all', 'All'], ['open', 'Unpaid'], ['overdue', 'Overdue'], ['draft', 'Drafts'], ['paid', 'Paid'], ['cancelled', 'Cancelled']]
  };
  const listRoute = kind => async (v, p, live) => {
    const K = KINDS[kind]; const f = S.params().get('status') || FILTERS[kind][0][0];
    let b = S.db.from(K.table).select('*, customers(first_name,last_name,company,ref)').is('deleted_at', null).order('created_at', { ascending: false }).limit(300);
    if (f === 'open') b = kind === 'order' ? b.in('status', ['confirmed', 'in_progress', 'awaiting_payment']) : b.in('status', ['sent', 'viewed', 'partially_paid', 'overdue']);
    else if (f !== 'all') b = b.eq('status', f);
    if (kind === 'invoice') await S.rpc('refresh_statuses').catch(() => {});
    const rows = S.must(await b); if (!live()) return;
    const sum = rows.reduce((a, d) => a + d.total_pence - (d.amount_paid_pence || 0), 0);
    S.render(v, html`${S.page({ title: K.plural, sub: kind === 'invoice' && ['open', 'overdue'].includes(f) && S.canFinance() ? money(sum) + ' outstanding' : '',
      acts: html`${kind !== 'invoice' ? html`<a class="btn" href="#/${kind === 'quote' ? 'orders' : 'quotes'}">${kind === 'quote' ? 'Orders' : 'Quotes'}</a>` : html`<a class="btn" href="#/orders">Orders</a>`}<a class="btn gold" href="#/${K.table}/new">${icon('plus')} New ${K.title.toLowerCase()}</a>` })}
      <div class="scrollx" style="margin-bottom:16px"><div class="chips" style="flex-wrap:nowrap">${FILTERS[kind].map(([k, l]) => html`<a class="chip ${k === f ? 'on' : ''}" href="#/${K.table}?status=${k}">${l}</a>`)}</div></div>
      ${rows.length ? html`<div class="list">${rows.map(d => html`<a class="li" href="#/${K.table}/${d.id}"><span class="ic">${icon(K.icon)}</span>
        <span class="main-t"><span class="t" style="display:block">${d.number}${d.title ? ' · ' + d.title : ''}</span><span class="d" style="display:block">${d.customers ? S.name(d.customers) : 'No customer'} · ${date(d.issue_date || d.order_date)}${kind === 'invoice' && !['paid', 'cancelled', 'draft'].includes(d.status) ? ' · due ' + date(d.due_date) : ''}${kind === 'quote' && ['sent', 'viewed'].includes(d.status) ? ' · valid until ' + date(d.expiry_date) : ''}</span></span>
        <span class="end"><span class="amt">${money(d.total_pence)}</span>${pill(kind, d.status)}${kind === 'order' && d.status !== 'draft' ? S.pill('paystatus', d.payment_status) : ''}</span>${icon('chev', 'chev')}</a>`)}</div>`
        : S.empty({ icon: K.icon, title: 'No ' + K.plural.toLowerCase() + ' here', text: kind === 'invoice' ? 'Create invoices from confirmed orders, or start one directly.' : '', action: html`<a class="btn gold" href="#/${K.table}/new">${icon('plus')} New ${K.title.toLowerCase()}</a>` })}`);
  };
  S.route('/quotes', listRoute('quote')); S.route('/orders', listRoute('order')); S.route('/invoices', listRoute('invoice'));

  // =========================== NEW (draft) ===========================
  const newRoute = kind => async v => {
    const K = KINDS[kind]; const prm = S.params();
    let cid = prm.get('customer');
    if (!cid) { S.render(v, html`${S.page({ title: 'New ' + K.title.toLowerCase(), crumb: [K.plural, '#/' + K.table] })}${S.empty({ icon: 'users', title: 'Who is it for?', text: 'Choose the customer first.', action: html`<button class="btn gold" id="pc">${icon('search')} Choose customer</button> <a class="btn" href="#/customers/new">New customer</a>` })}`);
      $('#pc', v).onclick = async () => { const c = await S.pickCustomer(); if (c) S.go(`#/${K.table}/new?customer=${c.id}${prm.get('lead') ? '&lead=' + prm.get('lead') : ''}`); }; return; }
    const row = { customer_id: cid, created_by: S.user.id };
    if (kind === 'quote' && prm.get('lead')) row.lead_id = prm.get('lead');
    if (kind === 'invoice') { const b = await S.settings('business'); row.due_date = S.isoDate(Date.now() + ((b && b.payment_terms_days) || 14) * 864e5); }
    const r = S.must(await S.db.from(K.table).insert(row).select('id').single());
    location.replace(`#/${K.table}/${r.id}`);
  };
  S.route('/quotes/new', newRoute('quote')); S.route('/orders/new', newRoute('order')); S.route('/invoices/new', newRoute('invoice'));

  // =========================== DOCUMENT PAGE ===========================
  const docRoute = kind => async (v, p, live) => {
    const K = KINDS[kind];
    const [d, lines, vat, business] = await Promise.all([
      S.db.from(K.table).select('*, customers(*)').eq('id', p.id).maybeSingle().then(S.must),
      S.db.from(K.lines).select('*').eq(K.fk, p.id).order('position').then(S.must), S.settings('vat'), S.settings('business')]);
    if (!live()) return;
    if (!d || d.deleted_at) return S.render(v, S.empty({ icon: K.icon, title: K.title + ' not found', action: html`<a class="btn" href="#/${K.table}">All ${K.plural.toLowerCase()}</a>` }));
    const c = d.customers; const editable = K.editable(d);
    // An order's payments include those made against its invoices
    const orderInvIds = kind === 'order' ? S.must(await S.db.from('invoices').select('id').eq('order_id', d.id)).map(x => x.id) : [];
    const payQ = () => { let q = S.db.from('payments').select('*, refunds(*)').order('received_at', { ascending: false });
      return kind === 'order' && orderInvIds.length ? q.or(`order_id.eq.${d.id},invoice_id.in.(${orderInvIds.join(',')})`) : q.eq(K.fk, d.id); };
    const [payments, links, related] = await Promise.all([
      kind !== 'quote' ? payQ().then(S.must) : Promise.resolve([]),
      S.db.from('payment_links').select('*').eq(K.fk, d.id).order('created_at', { ascending: false }).then(S.must),
      kind === 'order' ? Promise.all([d.quote_id ? S.db.from('quotes').select('id,number,status').eq('id', d.quote_id).maybeSingle().then(S.must) : null, S.db.from('invoices').select('id,number,status,total_pence').eq('order_id', d.id).is('deleted_at', null).then(S.must)])
        : kind === 'invoice' && d.order_id ? S.db.from('orders').select('id,number,status').eq('id', d.order_id).maybeSingle().then(S.must)
        : kind === 'quote' ? S.db.from('orders').select('id,number,status').eq('quote_id', d.id).is('deleted_at', null).then(S.must) : Promise.resolve(null)]);
    const st = d.status;
    const acts = [];
    acts.push(html`<button class="btn" id="pdf">${icon('download')} PDF</button>`);
    if (kind === 'quote') {
      if (st === 'draft') acts.push(html`<button class="btn" id="marksent">Mark as sent</button><button class="btn gold" id="send">${icon('send')} Send to customer</button>`);
      if (['sent', 'viewed'].includes(st)) acts.push(html`<button class="btn" id="resend">${icon('send')} Resend</button><button class="btn" data-qs="declined">Declined</button><button class="btn gold" data-qs="accepted">${icon('check')} Accepted</button>`);
      if (st === 'accepted' && !(related && related.length)) acts.push(html`<button class="btn gold" id="toorder">${icon('bag')} Convert to order</button>`);
      if (st === 'accepted') acts.push(html`<button class="btn" id="plink">${icon('link')} Payment link</button>`);
      acts.push(html`<button class="btn ghost" id="dup">${icon('copy')} Duplicate</button>`);
    }
    if (kind === 'order') {
      const next = { draft: [['confirmed', 'Confirm order']], confirmed: [['in_progress', 'Start work']], in_progress: [['awaiting_payment', 'Awaiting payment'], ['completed', 'Mark completed']], awaiting_payment: [], paid: [['completed', 'Mark completed']] }[st] || [];
      next.forEach(([s2, l]) => acts.push(html`<button class="btn ${s2 === 'confirmed' ? 'gold' : ''}" data-os="${s2}">${l}</button>`));
      if (!['draft', 'cancelled'].includes(st) && !(related && related[1].length)) acts.push(html`<button class="btn gold" id="toinv">${icon('receipt')} Create invoice</button>`);
      if (!['draft', 'cancelled'].includes(st) && d.payment_status !== 'paid') acts.push(html`<button class="btn" id="pay">${icon('pound')} Record payment</button><button class="btn" id="plink">${icon('link')} Payment link</button>`);
    }
    if (kind === 'invoice') {
      if (st === 'draft') acts.push(html`<button class="btn" id="marksent">Mark as sent</button><button class="btn gold" id="send">${icon('send')} Send invoice</button>`);
      if (['sent', 'viewed', 'partially_paid', 'overdue'].includes(st)) acts.push(html`<button class="btn" id="resend">${icon('send')} Resend</button><button class="btn" id="plink">${icon('link')} ${d.payment_link_url ? 'New payment link' : 'Payment link'}</button><button class="btn gold" id="pay">${icon('pound')} Record payment</button>`);
    }
    const linkBox = links.filter(l => l.status === 'active');
    S.render(v, html`<header class="ph"><div><div class="crumb"><a href="#/${K.table}">${icon('back')} ${K.plural}</a></div><h1>${K.title} ${d.number}</h1>
      <div class="sub flex">${c ? html`<a href="#/customers/${c.id}">${S.name(c)}</a>` : 'No customer'} ${pill(kind, st)} ${kind === 'order' && st !== 'draft' ? S.pill('paystatus', d.payment_status) : ''}</div></div><div class="acts">${acts}</div></header>
      ${kind === 'invoice' && st === 'overdue' ? S.banner('bad', 'Overdue', `This invoice was due on ${date(d.due_date)}. ${money(d.total_pence - d.amount_paid_pence)} is outstanding.`) : ''}
      ${kind === 'quote' && d.customer_response ? S.banner(st === 'accepted' ? 'good' : 'info', 'Customer replied', d.customer_response) : ''}
      ${linkBox.length ? html`<div class="banner info">${icon('link')}<div class="grow"><b>Payment link ready</b><a href="${linkBox[0].url}" target="_blank" rel="noopener" style="word-break:break-all">${linkBox[0].url}</a> · ${money(linkBox[0].amount_pence)}</div><button class="btn sm" id="copyl">${icon('copy')} Copy</button></div>` : ''}
      <div class="split"><div class="stack" id="ed"></div><div class="stack">
        <section class="card"><h2>Summary</h2>${S.kv([[kind === 'order' ? 'Order date' : 'Date', date(d.issue_date || d.order_date)], kind === 'quote' ? ['Valid until', date(d.expiry_date)] : null, kind === 'invoice' ? ['Due', date(d.due_date)] : null,
          d.sent_at ? ['Sent', dateTime(d.sent_at)] : null, d.viewed_at ? ['Viewed by customer', dateTime(d.viewed_at)] : null, d.responded_at ? ['Customer answered', dateTime(d.responded_at)] : null, d.paid_at ? ['Paid', dateTime(d.paid_at)] : null,
          kind !== 'quote' ? ['Paid so far', money(d.amount_paid_pence)] : null, kind !== 'quote' ? ['Outstanding', money(Math.max(0, d.total_pence - d.amount_paid_pence))] : null,
          kind === 'order' && related && related[0] ? ['From quote', html`<a href="#/quotes/${related[0].id}">${related[0].number}</a>`] : null,
          kind === 'order' && related && related[1].length ? ['Invoice', related[1].map(i => html`<a href="#/invoices/${i.id}">${i.number}</a> `)] : null,
          kind === 'invoice' && related ? ['Order', html`<a href="#/orders/${related.id}">${related.number}</a>`] : null,
          kind === 'quote' && related && related.length ? ['Order', related.map(o => html`<a href="#/orders/${o.id}">${o.number}</a> `)] : null,
          kind === 'order' && d.points_earned ? ['Loyalty points earned', String(d.points_earned)] : null])}</section>
        ${kind !== 'quote' ? html`<section class="card"><div class="ch"><h2>Payments</h2></div>${payments.length ? html`<div class="list">${payments.map(pm => html`<div class="li"><span class="main-t"><span class="t" style="display:block">${money(pm.amount_pence)} · ${S.label(pm.method)}</span>
            <span class="d" style="display:block">${dateTime(pm.received_at)}${pm.reference ? ' · ' + pm.reference : ''}</span>${pm.refunds.map(r => html`<span class="d" style="display:block;color:var(--rose-d)">Refund ${money(r.amount_pence)} · ${date(r.refunded_at)} · ${r.status}</span>`)}</span>
            <span class="end">${pill('payment', pm.status)}<span class="tag ${pm.source === 'stripe_verified' ? 'actual' : 'manual'}">${pm.source === 'stripe_verified' ? 'Stripe verified' : 'Manual'}</span>
            ${pm.source === 'manual' && ['succeeded', 'partially_refunded'].includes(pm.status) && S.canFinance() ? html`<button class="linkbtn small" data-refund="${pm.id}">Record refund</button>` : ''}</span></div>`)}</div>`
          : html`<p class="muted">No payments yet.</p>`}</section>` : ''}
        ${editable || d.status === 'draft' ? html`<section class="card flat"><div class="ch"><div><h3>${d.status === 'draft' ? 'Delete draft' : 'Cancel order'}</h3><p class="muted small">${d.status === 'draft' ? 'Removes this unfinished draft.' : 'Stock is returned if it was taken.'}</p></div><button class="btn danger sm" id="del">${d.status === 'draft' ? 'Delete' : 'Cancel'}</button></div></section>` : ''}
        ${kind === 'invoice' && ['sent', 'viewed', 'overdue'].includes(st) && !d.amount_paid_pence ? html`<section class="card flat"><div class="ch"><div><h3>Cancel invoice</h3><p class="muted small">Kept in your records, marked cancelled.</p></div><button class="btn danger sm" id="cancelinv">Cancel</button></div></section>` : ''}
      </div></div>`);
    await editor($('#ed', v), kind, d, lines, vat, editable);
    // ---- actions
    const btn = id => $(id, v);
    btn('#pdf').onclick = e => makePdf(e.currentTarget, kind, d, vat, business);
    const send = async b => { if (!c || !c.email) return S.toast('Add an email address to the customer first.', { bad: true });
      if (!(await S.confirm({ title: `Email this ${K.title.toLowerCase()} to ${S.name(c)}?`, message: `It will be sent to ${c.email} with a secure link to view it in their account.`, confirm: 'Send' }))) return;
      try { await S.act(b, () => S.worker(`/${K.table}/send`, { [K.fk]: d.id }), K.title + ' sent'); S.dispatch(); } catch (e) { } };
    if (btn('#send')) btn('#send').onclick = e => send(e.currentTarget);
    if (btn('#resend')) btn('#resend').onclick = e => send(e.currentTarget);
    if (btn('#marksent')) btn('#marksent').onclick = async e => { if (!(await S.confirm({ title: 'Mark as sent?', message: 'Use this if you have given the customer this ' + K.title.toLowerCase() + ' yourself (in person or by your own email). It will appear in their account.', confirm: 'Mark as sent' }))) return;
      S.act(e.currentTarget, async () => { await S.rpc('mark_document_sent', { p_kind: kind, p_id: d.id }); S.dispatch(); }, 'Marked as sent').catch(() => {}); };
    S.on(v, '[data-qs]', 'click', async (e, b) => { const to = b.dataset.qs; const note = await S.ask({ title: to === 'accepted' ? 'Customer accepted' : 'Customer declined', label: 'How did they let you know? (optional)', required: false, confirm: 'Save' }); if (note === null) return;
      S.act(b, async () => { S.must(await S.db.from('quotes').update({ status: to, responded_at: new Date().toISOString(), customer_response: note || null }).eq('id', d.id));
        S.must(await S.db.from('communications').insert({ customer_id: d.customer_id, kind: 'quote_' + to, summary: 'Quote ' + d.number + ' ' + to + (note ? ' (' + note + ')' : ''), related_type: 'quote', related_id: d.id, created_by: S.user.id })); S.dispatch(); }, 'Quote updated').catch(() => {}); });
    if (btn('#toorder')) btn('#toorder').onclick = e => S.act(e.currentTarget, async () => { const id = await S.rpc('convert_quote_to_order', { p_quote: d.id }); S.go('#/orders/' + id); }, 'Order created').catch(() => {});
    if (btn('#toinv')) btn('#toinv').onclick = e => S.act(e.currentTarget, async () => { const id = await S.rpc('create_invoice_from_order', { p_order: d.id }); S.go('#/invoices/' + id); }, 'Invoice created').catch(() => {});
    if (btn('#dup')) btn('#dup').onclick = e => S.act(e.currentTarget, async () => {
      const n = S.must(await S.db.from('quotes').insert({ customer_id: d.customer_id, lead_id: d.lead_id, title: d.title, notes: d.notes, internal_notes: d.internal_notes, discount_pence: d.discount_pence, created_by: S.user.id }).select('id').single());
      if (lines.length) S.must(await S.db.from('quote_lines').insert(lines.map(l => ({ quote_id: n.id, product_id: l.product_id, description: l.description, quantity: l.quantity, unit_price_pence: l.unit_price_pence, discount_pence: l.discount_pence, vat_rate: l.vat_rate, position: l.position }))));
      S.go('#/quotes/' + n.id); }, 'Copied into a new draft').catch(() => {});
    S.on(v, '[data-os]', 'click', (e, b) => S.act(b, async () => { S.must(await S.db.from('orders').update({ status: b.dataset.os }).eq('id', d.id)); S.dispatch(); }, 'Order updated').catch(() => {}));
    if (btn('#plink')) btn('#plink').onclick = async e => { const out = d.total_pence - (d.amount_paid_pence || 0);
      if (!(await S.confirm({ title: 'Create a Stripe payment link?', message: `A secure link for ${money(out)} will be created. Payments are only marked as received when Stripe confirms them.`, confirm: 'Create link' }))) return;
      try { const r = await S.act(e.currentTarget, () => S.worker('/stripe/payment-link', { [K.fk]: d.id }), 'Payment link created'); try { await navigator.clipboard.writeText(r.url); S.toast('Link copied to clipboard'); } catch (x) { } S.dispatch(); } catch (er) { } };
    if (btn('#copyl')) btn('#copyl').onclick = async () => { try { await navigator.clipboard.writeText(linkBox[0].url); S.toast('Link copied'); } catch (x) { S.toast('Copy the link from the box above', { bad: true }); } };
    if (btn('#pay')) btn('#pay').onclick = () => S.recordPayment(kind, d);
    S.on(v, '[data-refund]', 'click', (e, b) => S.recordRefund(payments.find(x => x.id === b.dataset.refund)));
    if (btn('#del')) btn('#del').onclick = async () => {
      if (d.status === 'draft') { if (!(await S.confirm({ title: 'Delete this draft?', confirm: 'Delete', danger: true }))) return; S.act(btn('#del'), async () => { S.must(await S.db.from(K.table).update({ deleted_at: new Date().toISOString() }).eq('id', d.id)); S.go('#/' + K.table); }, 'Draft deleted').catch(() => {}); }
      else { if (!(await S.confirm({ title: 'Cancel order ' + d.number + '?', message: 'The order stays in your records as cancelled.', confirm: 'Cancel order', danger: true }))) return; S.act(btn('#del'), async () => { S.must(await S.db.from('orders').update({ status: 'cancelled' }).eq('id', d.id)); S.dispatch(); }, 'Order cancelled').catch(() => {}); }
    };
    if (btn('#cancelinv')) btn('#cancelinv').onclick = async () => { if (!(await S.confirm({ title: 'Cancel invoice ' + d.number + '?', message: 'It will be marked cancelled. It is never deleted, so your records stay complete.', confirm: 'Cancel invoice', danger: true, typed: 'CANCEL' }))) return;
      S.act(btn('#cancelinv'), async () => { S.must(await S.db.from('invoices').update({ status: 'cancelled' }).eq('id', d.id)); S.dispatch(); }, 'Invoice cancelled').catch(() => {}); };
  };
  S.route('/quotes/:id', docRoute('quote')); S.route('/orders/:id', docRoute('order')); S.route('/invoices/:id', docRoute('invoice'));

  // =========================== LINE EDITOR ===========================
  async function editor(el, kind, d, lines, vat, editable) {
    const K = KINDS[kind];
    let rows = lines.map(l => ({ ...l }));
    const removed = [];
    const draw = () => {
      const t = S.lineTotals(rows, d.discount_pence, vat);
      if (!editable) {
        S.render(el, html`<section class="card"><h2>Items</h2><div class="tblwrap"><table class="tbl resp"><thead><tr><th>Description</th><th class="num">Qty</th><th class="num">Unit price</th><th class="num">Discount</th><th class="num">Amount</th></tr></thead>
          <tbody>${rows.map(l => html`<tr><td data-l="Item">${l.description}</td><td class="num" data-l="Qty">${+l.quantity}</td><td class="num" data-l="Unit">${money(l.unit_price_pence)}</td><td class="num" data-l="Discount">${l.discount_pence ? money(l.discount_pence) : '—'}</td><td class="num" data-l="Amount">${money(Math.round(l.quantity * l.unit_price_pence) - l.discount_pence)}</td></tr>`)}</tbody></table></div>
          ${totalsBlock(d, vat)}
          ${d.notes ? html`<div class="hr"></div><div class="tiny muted" style="letter-spacing:.14em;text-transform:uppercase">Notes for the customer</div><p class="pre">${d.notes}</p>` : ''}
          ${d.internal_notes ? html`<div class="tiny muted" style="letter-spacing:.14em;text-transform:uppercase">Internal notes</div><p class="pre">${d.internal_notes}</p>` : ''}
          <p class="small muted">${kind === 'quote' ? 'Sent quotes cannot be edited. Use Duplicate to make a new version.' : kind === 'invoice' ? 'Sent invoices cannot be edited. Cancel and re-issue if something is wrong.' : 'This order is past confirmation, so its items are locked.'}</p></section>`);
        return;
      }
      S.render(el, html`<section class="card"><div class="ch"><h2>Items</h2></div><div class="lines-ed">${rows.map((l, i) => html`<div class="ln" data-i="${i}">
          <label class="fld desc"><span>Description</span><input data-k="description" value="${l.description || ''}" placeholder="Item or service"></label>
          <label class="fld"><span>Qty</span><input data-k="quantity" inputmode="decimal" value="${l.quantity ?? 1}"></label>
          <label class="fld"><span>Unit price £</span><input data-k="unit_price" inputmode="decimal" value="${S.pounds(l.unit_price_pence)}"></label>
          <label class="fld"><span>Discount £</span><input data-k="discount" inputmode="decimal" value="${l.discount_pence ? S.pounds(l.discount_pence) : ''}"></label>
          <label class="fld"><span>VAT %</span><select data-k="vat_rate">${S.opts([['20', '20'], ['5', '5'], ['0', '0']], String(Math.round(l.vat_rate ?? 20)))}</select></label>
          <button type="button" class="iconbtn x" data-rm="${i}" aria-label="Remove line" style="align-self:end">${icon('trash')}</button></div>`)}</div>
        <div class="flex" style="margin-top:12px"><button class="btn sm" id="addp">${icon('gem')} Add product</button><button class="btn sm ghost" id="addl">${icon('plus')} Add custom line</button></div>
        <form class="form" id="docf" style="margin-top:18px">
          ${kind === 'quote' ? html`<label class="fld"><span>Title <em>(optional)</em></span><input name="title" value="${d.title || ''}" maxlength="140" placeholder="e.g. Bespoke oval engagement ring"></label>` : ''}
          <div class="row">${kind === 'order' ? html`<label class="fld"><span>Order date</span><input type="date" name="order_date" value="${d.order_date}"></label>` : html`<label class="fld"><span>Date</span><input type="date" name="issue_date" value="${d.issue_date}"></label>`}
            ${kind === 'quote' ? html`<label class="fld"><span>Valid until</span><input type="date" name="expiry_date" value="${d.expiry_date}"></label>` : kind === 'invoice' ? html`<label class="fld"><span>Due date</span><input type="date" name="due_date" value="${d.due_date}"></label>` : html`<label class="fld"><span>Discount code <em>(loyalty)</em></span><div class="flex"><input name="code" class="inp grow" placeholder="LK-XXXXXXXX" value="${d.discount_code || ''}" ${d.discount_code ? 'disabled' : ''}>${d.discount_code ? '' : html`<button class="btn sm" type="button" id="apply">Apply</button>`}</div></label>`}</div>
          <label class="fld" style="max-width:240px"><span>Overall discount £</span><input name="discount" inputmode="decimal" value="${d.discount_pence ? S.pounds(d.discount_pence) : ''}"></label>
          <label class="fld"><span>Notes for the customer <em>(shown on the ${K.title.toLowerCase()})</em></span><textarea name="notes" maxlength="2000">${d.notes || ''}</textarea></label>
          <label class="fld"><span>Internal notes <em>(never shown to the customer)</em></span><textarea name="internal_notes" maxlength="4000" style="min-height:70px">${d.internal_notes || ''}</textarea></label></form>
        <div class="calc totals" style="margin-top:16px"><div class="r"><span>Subtotal</span><span>${money(t.subtotal)}</span></div>${d.discount_pence ? html`<div class="r"><span>Discount</span><span>−${money(d.discount_pence)}</span></div>` : ''}
          ${!vat || vat.registered !== false ? html`<div class="r"><span>${t.incl ? 'VAT included' : 'VAT'}</span><span>${money(t.vat)}</span></div>` : ''}<div class="r tot"><span>Total</span><span>${money(t.total)}</span></div></div>
        <div class="flex" style="justify-content:flex-end;margin-top:16px"><button class="btn gold" id="savedoc">${icon('check')} Save</button></div></section>`);
      const readBack = () => {
        $$('.ln', el).forEach(r => { const l = rows[+r.dataset.i]; $$('[data-k]', r).forEach(inp => {
          const k = inp.dataset.k, val = inp.value;
          if (k === 'unit_price') l.unit_price_pence = S.pence(val); else if (k === 'discount') l.discount_pence = val ? S.pence(val) : 0;
          else if (k === 'vat_rate') l.vat_rate = +val; else if (k === 'quantity') l.quantity = val; else l[k] = val; }); });
        const f = $('#docf', el); if (f) { const disc = S.pence(f.discount.value); d.discount_pence = disc && !isNaN(disc) ? disc : 0; ['title', 'issue_date', 'expiry_date', 'due_date', 'order_date', 'notes', 'internal_notes'].forEach(k => { if (f[k]) d[k] = f[k].value; }); }
      };
      let tt; el.oninput = () => { clearTimeout(tt); tt = setTimeout(() => { readBack(); const t2 = S.lineTotals(rows.map(x => ({ ...x, unit_price_pence: isNaN(x.unit_price_pence) ? 0 : x.unit_price_pence, discount_pence: isNaN(x.discount_pence) ? 0 : x.discount_pence })), d.discount_pence, vat);
        const tot = $$('.totals .r span:last-child', el); if (tot.length) { tot[0].textContent = money(t2.subtotal); tot[tot.length - 1].textContent = money(t2.total); if (!vat || vat.registered !== false) tot[tot.length - 2].textContent = money(t2.vat); } }, 200); };
      S.on(el, '[data-rm]', 'click', (e, b) => { readBack(); const [x] = rows.splice(+b.dataset.rm, 1); if (x.id) removed.push(x.id); draw(); });
      $('#addl', el).onclick = () => { readBack(); rows.push({ description: '', quantity: 1, unit_price_pence: null, discount_pence: 0, vat_rate: 20 }); draw(); const ins = $$('.ln input[data-k=description]', el); ins[ins.length - 1].focus(); };
      $('#addp', el).onclick = async () => { readBack(); const pr = await S.pick({ title: 'Add product', table: 'products', select: 'id,name,sku,selling_price_pence,vat_rate,status,product_images(path,is_primary)', search: ['name', 'sku'], filter: b => b.is('deleted_at', null).order('name'),
        render: x => html`<span class="ic">${icon('gem')}</span><span class="main-t"><span class="t" style="display:block">${x.name || 'Untitled'}</span><span class="d" style="display:block">${x.sku || ''} · ${x.selling_price_pence != null ? money(x.selling_price_pence) : 'no price'} · ${S.statusLabel('product', x.status)}</span></span>` });
        if (pr) { rows.push({ product_id: pr.id, description: pr.name + (pr.sku ? ' (' + pr.sku + ')' : ''), quantity: 1, unit_price_pence: pr.selling_price_pence || 0, discount_pence: 0, vat_rate: +pr.vat_rate || 20 }); draw(); } };
      const ap = $('#apply', el); if (ap) ap.onclick = async () => { readBack(); const code = $('#docf', el).code.value.trim().toUpperCase(); if (!code) return;
        try { await S.act(ap, async () => {
          const dc = S.must(await S.db.from('discount_codes').select('*').eq('code', code).eq('used', false).maybeSingle());
          if (!dc) throw new Error('That code does not exist or has already been used.');
          if (dc.customer_id && dc.customer_id !== d.customer_id) throw new Error('That code belongs to a different customer.');
          S.must(await S.db.from('discount_codes').update({ used: true, used_on_order: d.id }).eq('id', dc.id).eq('used', false));
          S.must(await S.db.from('orders').update({ discount_pence: (d.discount_pence || 0) + dc.value_pence, discount_code: code }).eq('id', d.id)); }, 'Loyalty discount applied'); S.dispatch(); } catch (e) { } };
      $('#savedoc', el).onclick = async e => {
        readBack(); const f = $('#docf', el);
        const bad = rows.findIndex(l => !String(l.description || '').trim() || l.unit_price_pence == null || isNaN(l.unit_price_pence) || !(+l.quantity > 0) || isNaN(l.discount_pence));
        if (bad >= 0) return S.toast(`Line ${bad + 1}: add a description, quantity and price.`, { bad: true });
        if (isNaN(S.pence(f.discount.value || '0'))) return S.toast('The overall discount must be a number.', { bad: true });
        const head = { discount_pence: d.discount_pence || 0, notes: d.notes || null, internal_notes: d.internal_notes || null };
        if (kind === 'quote') Object.assign(head, { title: d.title || null, issue_date: d.issue_date, expiry_date: d.expiry_date });
        if (kind === 'invoice') Object.assign(head, { issue_date: d.issue_date, due_date: d.due_date });
        if (kind === 'order') head.order_date = d.order_date;
        if (kind === 'quote' && head.expiry_date < head.issue_date) return S.toast('The quote cannot expire before it is issued.', { bad: true });
        try { await S.act(e.currentTarget, async () => {
          if (removed.length) S.must(await S.db.from(K.lines).delete().in('id', removed.splice(0)));
          for (let i = 0; i < rows.length; i++) { const l = rows[i]; const row = { description: l.description.trim(), quantity: +l.quantity, unit_price_pence: l.unit_price_pence, discount_pence: l.discount_pence || 0, vat_rate: l.vat_rate ?? 20, product_id: l.product_id || null, position: i };
            if (l.id) S.must(await S.db.from(K.lines).update(row).eq('id', l.id)); else { const r = S.must(await S.db.from(K.lines).insert(Object.assign(row, { [K.fk]: d.id })).select('id').single()); l.id = r.id; } }
          S.must(await S.db.from(K.table).update(head).eq('id', d.id)); }, 'Saved'); S.dispatch(); } catch (er) { }
      };
    };
    draw();
  }
  const totalsBlock = (d, vat) => html`<div class="calc totals" style="margin-top:16px"><div class="r"><span>Subtotal</span><span>${money(d.subtotal_pence)}</span></div>${d.discount_pence ? html`<div class="r"><span>Discount</span><span>−${money(d.discount_pence)}</span></div>` : ''}
    ${!vat || vat.registered !== false ? html`<div class="r"><span>${!vat || vat.prices_include_vat !== false ? 'VAT included' : 'VAT'}</span><span>${money(d.vat_pence)}</span></div>` : ''}<div class="r tot"><span>Total</span><span>${money(d.total_pence)}</span></div>
    ${d.amount_paid_pence ? html`<div class="r"><span>Paid</span><span>−${money(d.amount_paid_pence)}</span></div><div class="r tot"><span>Balance</span><span>${money(d.total_pence - d.amount_paid_pence)}</span></div>` : ''}</div>`;

  // =========================== PDF ===========================
  async function makePdf(btn, kind, d, vat, business) {
    if (kind === 'order') return S.toast('PDFs are made for quotes and invoices. Create an invoice from this order.', { bad: true });
    const run = async () => {
      const lines = S.must(await S.db.from(KINDS[kind].lines).select('description,quantity,unit_price_pence,discount_pence,vat_rate').eq(KINDS[kind].fk, d.id).order('position'));
      const fresh = S.must(await S.db.from(KINDS[kind].table).select('*, customers(*)').eq('id', d.id).single());
      if (!lines.length) throw new Error('Add at least one item first.');
      let blob;
      try { blob = window.LKPDF.build({ kind, doc: fresh, lines, customer: fresh.customers || {}, business, vat }); }
      catch (e) { console.error(e); throw new Error('INVOICE GENERATION FAILED. Please try again.'); }
      window.LKPDF.download(blob, `${fresh.number}.pdf`);
      if (kind === 'invoice' && fresh.status !== 'draft') {   // keep a copy of the issued invoice with the records
        const path = `invoices/${fresh.number}-${Date.now()}.pdf`;
        try { await S.upload('business-docs', path, blob, 'application/pdf');
          S.must(await S.db.from('documents').insert({ kind: 'invoice_pdf', bucket: 'business-docs', path, filename: fresh.number + '.pdf', mime: 'application/pdf', size_bytes: blob.size, customer_id: fresh.customer_id, invoice_id: fresh.id, uploaded_by: S.user.id }));
          S.must(await S.db.from('invoices').update({ pdf_path: path }).eq('id', fresh.id));
        } catch (e) { S.toast('PDF downloaded, but a copy could not be saved to Documents: ' + e.message, { bad: true }); }
      }
    };
    S.act(btn, run, 'PDF ready').catch(() => {});
  }

  // =========================== RECORD PAYMENT / REFUND ===========================
  S.recordPayment = (kind, d) => {
    const out = Math.max(0, d.total_pence - (d.amount_paid_pence || 0));
    const s = S.sheet({ title: 'Record a payment', body: html`<p class="muted" style="margin-top:0">For money received outside Stripe (bank transfer, card machine, cash). Stripe payments are recorded automatically once Stripe confirms them.</p>
      <form class="form" id="pf" novalidate><div class="row"><label class="fld"><span>Amount</span><div class="money"><input name="amount" inputmode="decimal" value="${S.pounds(out)}"></div></label>
        <label class="fld"><span>Method</span><select name="method">${S.opts([['bank_transfer', 'Bank transfer'], ['card_terminal', 'Card machine'], ['cash', 'Cash'], ['other', 'Other']])}</select></label></div>
        <div class="row"><label class="fld"><span>Date received</span><input type="date" name="date" value="${S.isoDate()}"></label><label class="fld"><span>Reference <em>(optional)</em></span><input name="reference" maxlength="80"></label></div></form>`,
      foot: html`<button class="btn ghost" data-close>Cancel</button><button class="btn gold" id="ok">Record payment</button>` });
    $('#ok', s.el).onclick = e => { const f = $('#pf', s.el), o = S.form(f); S.clearErr(f); const a = S.pence(o.amount);
      if (!a || isNaN(a) || a <= 0) return S.fieldErr(f, 'amount', 'Enter the amount received');
      if (a > out && !confirm('This is more than the outstanding amount. Record it anyway?')) return;
      S.act(e.currentTarget, async () => { S.must(await S.db.from('payments').insert({ [KINDS[kind].fk]: d.id, amount_pence: a, method: o.method, source: 'manual', reference: o.reference || null,
        received_at: o.date === S.isoDate() ? new Date().toISOString() : new Date(o.date + 'T12:00:00').toISOString(), recorded_by: S.user.id })); s.close(); S.dispatch(); }, 'Payment recorded').catch(() => {}); };
  };
  S.recordRefund = pm => {
    const left = pm.amount_pence - pm.refunded_pence;
    const s = S.sheet({ title: 'Record a refund', body: html`<p class="muted" style="margin-top:0">The original payment of ${money(pm.amount_pence)} is kept; the refund is recorded against it. ${money(left)} can still be refunded.</p>
      <form class="form" id="rf" novalidate><label class="fld"><span>Refund amount</span><div class="money"><input name="amount" inputmode="decimal" value="${S.pounds(left)}"></div></label><label class="fld"><span>Reason</span><input name="reason" maxlength="200"></label></form>`,
      foot: html`<button class="btn ghost" data-close>Cancel</button><button class="btn danger" id="ok">Record refund</button>` });
    $('#ok', s.el).onclick = e => { const f = $('#rf', s.el), o = S.form(f); S.clearErr(f); const a = S.pence(o.amount);
      if (!a || isNaN(a) || a <= 0 || a > left) return S.fieldErr(f, 'amount', 'Enter an amount up to ' + money(left));
      S.act(e.currentTarget, async () => { S.must(await S.db.from('refunds').insert({ payment_id: pm.id, amount_pence: a, reason: o.reason || null, source: 'manual', status: 'succeeded' })); s.close(); S.dispatch(); }, 'Refund recorded').catch(() => {}); };
  };

  // =========================== PAYMENTS ===========================
  S.route('/payments', async (v, p, live) => {
    const f = S.params().get('f') || 'all';
    let b = S.db.from('payments').select('*, customers(first_name,last_name), invoices(id,number), orders(id,number), refunds(*)').order('received_at', { ascending: false }).limit(300);
    if (f === 'stripe') b = b.eq('source', 'stripe_verified'); if (f === 'manual') b = b.eq('source', 'manual'); if (f === 'failed') b = b.eq('status', 'failed'); if (f === 'refunded') b = b.gt('refunded_pence', 0);
    const [rows, links, integ] = await Promise.all([b.then(S.must), S.db.from('payment_links').select('*, customers(first_name,last_name)').order('created_at', { ascending: false }).limit(50).then(S.must), S.integrations()]);
    if (!live()) return;
    S.render(v, html`${S.page({ title: 'Payments', sub: 'Money received, refunds and payment links', acts: html`<button class="btn gold" id="nl">${icon('link')} New payment link</button>` })}
      ${!integ.stripe ? S.configBanner('Stripe is not connected yet, so payment links cannot be created and card payments are not recorded automatically. Manual payments still work. See Settings → Integrations.') : ''}
      <div class="scrollx" style="margin-bottom:16px"><div class="chips" style="flex-wrap:nowrap">${[['all', 'All'], ['stripe', 'Stripe (verified)'], ['manual', 'Manual'], ['refunded', 'Refunds'], ['failed', 'Failed']].map(([k, l]) => html`<a class="chip ${k === f ? 'on' : ''}" href="#/payments?f=${k}">${l}</a>`)}</div></div>
      ${rows.length ? html`<div class="list">${rows.map(pm => html`<div class="li"><span class="ic">${icon('card')}</span><span class="main-t"><span class="t" style="display:block">${pm.customers ? S.name(pm.customers) : 'Customer'} · ${money(pm.amount_pence)}</span>
        <span class="d" style="display:block">${dateTime(pm.received_at)} · ${S.label(pm.method)}${pm.invoices ? raw(' · <a href="#/invoices/' + pm.invoices.id + '">' + S.esc(pm.invoices.number) + '</a>') : ''}${pm.orders ? raw(' · <a href="#/orders/' + pm.orders.id + '">' + S.esc(pm.orders.number) + '</a>') : ''}${pm.failure_reason ? ' · ' + pm.failure_reason : ''}</span>
        ${pm.refunds.map(r => html`<span class="d" style="display:block;color:var(--rose-d)">Refunded ${money(r.amount_pence)} on ${date(r.refunded_at)}${r.reason ? ' · ' + r.reason : ''} (${r.source === 'stripe_verified' ? 'Stripe' : 'manual'})</span>`)}</span>
        <span class="end">${pill('payment', pm.status)}<span class="tag ${pm.source === 'stripe_verified' ? 'actual' : 'manual'}">${pm.source === 'stripe_verified' ? 'Actual · Stripe' : 'Manually entered'}</span></span></div>`)}</div>`
        : S.empty({ icon: 'card', title: 'No payments here yet' })}
      <section class="card" style="margin-top:22px"><div class="ch"><div><h2>Payment links</h2><p class="muted small">Created from LK Studio. Marked paid only when Stripe confirms.</p></div></div>
        ${links.length ? html`<div class="list">${links.map(l => html`<div class="li"><span class="main-t"><span class="t" style="display:block">${l.description} · ${money(l.amount_pence)}</span><span class="d" style="display:block">${l.customers ? S.name(l.customers) + ' · ' : ''}${dateTime(l.created_at)}</span></span>
          <span class="end"><span class="pill ${l.status === 'paid' ? 'green' : l.status === 'active' ? 'blue' : 'grey'}">${S.label(l.status)}</span>${l.status === 'active' ? html`<button class="linkbtn small" data-copy="${l.url}">Copy link</button>` : ''}</span></div>`)}</div>` : html`<p class="muted">No payment links yet.</p>`}</section>`);
    S.on(v, '[data-copy]', 'click', async (e, b) => { try { await navigator.clipboard.writeText(b.dataset.copy); S.toast('Link copied'); } catch (x) { S.toast(b.dataset.copy); } });
    $('#nl', v).onclick = () => {
      let cust = null, prod = null;
      const s = S.sheet({ title: 'New payment link', body: html`<p class="muted" style="margin-top:0">For deposits or anything without an invoice. For invoices, use the button on the invoice instead.</p><form class="form" id="lf" novalidate>
        <label class="fld"><span>What is it for?</span><input name="description" maxlength="200" placeholder="e.g. Deposit for bespoke ring"></label><label class="fld"><span>Amount</span><div class="money"><input name="amount" inputmode="decimal"></div></label>
        <div class="flex"><button type="button" class="btn sm" id="lc">${icon('users')} <span>Link to customer</span></button><button type="button" class="btn sm" id="lp">${icon('gem')} <span>Link to product</span></button></div></form>`,
        foot: html`<button class="btn ghost" data-close>Cancel</button><button class="btn gold" id="ok">Create link</button>` });
      $('#lc', s.el).onclick = async () => { cust = await S.pickCustomer(); if (cust) $('#lc span', s.el).textContent = S.name(cust); };
      $('#lp', s.el).onclick = async () => { prod = await S.pick({ title: 'Product', table: 'products', select: 'id,name,sku', search: ['name', 'sku'], filter: q => q.is('deleted_at', null), render: x => html`<span class="main-t"><span class="t">${x.name}</span></span>` }); if (prod) $('#lp span', s.el).textContent = prod.name; };
      $('#ok', s.el).onclick = async e => { const f = $('#lf', s.el), o = S.form(f); S.clearErr(f); const a = S.pence(o.amount);
        if (!o.description) return S.fieldErr(f, 'description', 'Describe what the payment is for'); if (!a || isNaN(a) || a < 50) return S.fieldErr(f, 'amount', 'Enter an amount of at least £0.50');
        try { const r = await S.act(e.currentTarget, () => S.worker('/stripe/payment-link', { amount_pence: a, description: o.description, customer_id: cust && cust.id, product_id: prod && prod.id }), 'Payment link created');
          s.close(); try { await navigator.clipboard.writeText(r.url); S.toast('Link copied to clipboard'); } catch (x) { } S.dispatch(); } catch (er) { } };
    };
  }, { finance: true });
})();
