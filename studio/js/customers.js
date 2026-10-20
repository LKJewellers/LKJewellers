/* LK Studio: Customers (records, accounts, timeline, files) and Enquiries (leads pipeline). */
(function () {
  const { html, raw, icon, money, date, dateTime, ago, pill, $, $$ } = S;

  // =========================== CUSTOMERS LIST ===========================
  const FILTERS = [['all', 'All'], ['prospect', 'Prospects'], ['active', 'Active'], ['vip', 'VIP'], ['acc_active', 'Account active'], ['acc_invited', 'Invited'], ['acc_expired', 'Invitation expired'], ['acc_none', 'No account']];
  S.route('/customers', async (v, p, live) => {
    const prm = S.params(); const f = prm.get('f') || 'all', q = prm.get('q') || '';
    S.render(v, html`${S.page({ title: 'Customers', sub: 'Everyone you work with, in one place', acts: html`<a class="btn" href="#/leads">${icon('inbox')} Enquiries</a><a class="btn gold" href="#/customers/new">${icon('plus')} New customer</a>` })}
      <div class="toolbar"><div class="search">${icon('search')}<input id="cq" value="${q}" placeholder="Name, email, phone, reference or company" aria-label="Search customers"></div></div>
      <div class="scrollx" style="margin-bottom:16px"><div class="chips" style="flex-wrap:nowrap">${FILTERS.map(([k, l]) => html`<a class="chip ${k === f ? 'on' : ''}" href="#/customers?f=${k}${q ? '&q=' + encodeURIComponent(q) : ''}">${l}</a>`)}</div></div>
      <div id="clist">${S.loading()}</div>`);
    const load = async () => {
      const term = $('#cq', v).value.trim();
      let b = S.db.from('customer_list').select('id,ref,first_name,last_name,email,phone,company,status,account_label,last_order_date,total_spend_pence,open_leads,last_contact_at,created_at').order('created_at', { ascending: false }).limit(200);
      if (f === 'prospect' || f === 'active' || f === 'vip') b = b.eq('status', f);
      if (f.startsWith('acc_')) b = b.eq('account_label', f.slice(4));
      if (term) { const t = term.replace(/[,()*]/g, ' '); const digits = t.replace(/\D/g, '').replace(/^44/, '0');
        b = b.or([`first_name.ilike.*${t}*`, `last_name.ilike.*${t}*`, `email.ilike.*${t}*`, `ref.ilike.*${t}*`, `company.ilike.*${t}*`, `phone.ilike.*${t}*`].concat(digits.length > 4 ? [`phone_norm.ilike.*${digits}*`] : []).join(',')); }
      const r = await b; if (!live()) return;
      if (r.error) return S.render($('#clist', v), S.errorState(S.friendly(r.error.message)));
      const rows = r.data;
      S.render($('#clist', v), rows.length ? html`<div class="list">${rows.map(c => html`<a class="li" href="#/customers/${c.id}"><span class="avatar">${S.initials(S.name(c))}</span>
        <span class="main-t"><span class="t" style="display:block">${S.name(c)}${c.company ? html` <span class="muted">· ${c.company}</span>` : ''}</span>
        <span class="d" style="display:block">${c.email || c.phone || 'No contact details'} · ${c.ref}</span></span>
        <span class="end">${pill('account', c.account_label)}<span class="tiny muted">${c.open_leads ? c.open_leads + ' open enquir' + (c.open_leads === 1 ? 'y' : 'ies') + ' · ' : ''}${S.canFinance() && c.total_spend_pence ? money(c.total_spend_pence, { whole: true }) + ' spent' : c.last_order_date ? 'Last order ' + date(c.last_order_date) : 'Added ' + ago(c.created_at)}</span></span>${icon('chev', 'chev')}</a>`)}</div>`
        : S.empty({ icon: 'users', title: term ? 'No customers match' : 'No customers yet', text: term ? 'Try another name, email or phone number.' : 'Add your first customer, or they will appear automatically from website enquiries.', action: html`<a class="btn gold" href="#/customers/new">${icon('plus')} New customer</a>` }));
    };
    let t; $('#cq', v).oninput = () => { clearTimeout(t); t = setTimeout(load, 250); };
    load();
  });

  // =========================== CUSTOMER FORM ===========================
  const customerForm = c => html`<form class="form" id="custf" novalidate>
    <div class="section-t">Name</div>
    <div class="row"><label class="fld"><span>First name</span><input name="first_name" value="${c.first_name || ''}" autocomplete="off" maxlength="80" required></label>
      <label class="fld"><span>Last name</span><input name="last_name" value="${c.last_name || ''}" autocomplete="off" maxlength="80"></label></div>
    <label class="fld"><span>Company <em>(optional)</em></span><input name="company" value="${c.company || ''}" maxlength="120"></label>
    <div class="section-t">Contact</div>
    <div class="row"><label class="fld"><span>Email</span><input name="email" type="email" value="${c.email || ''}" autocomplete="off" inputmode="email"></label>
      <label class="fld"><span>Phone</span><input name="phone" type="tel" value="${c.phone || ''}" autocomplete="off" inputmode="tel"></label></div>
    <div class="section-t">Address</div>
    <label class="fld"><span>Address line 1</span><input name="address_line1" value="${c.address_line1 || ''}" maxlength="120"></label>
    <label class="fld"><span>Address line 2 <em>(optional)</em></span><input name="address_line2" value="${c.address_line2 || ''}" maxlength="120"></label>
    <div class="row"><label class="fld"><span>Town / city</span><input name="city" value="${c.city || ''}" maxlength="80"></label><label class="fld"><span>County <em>(optional)</em></span><input name="county" value="${c.county || ''}" maxlength="80"></label></div>
    <div class="row"><label class="fld"><span>Postcode</span><input name="postcode" value="${c.postcode || ''}" maxlength="12" autocapitalize="characters"></label><label class="fld"><span>Country</span><input name="country" value="${c.country || 'United Kingdom'}" maxlength="60"></label></div>
    <div class="section-t">About</div>
    <label class="fld"><span>Status</span><select name="status">${S.opts([['prospect', 'Prospect'], ['active', 'Active customer'], ['vip', 'VIP'], ['inactive', 'Inactive']], c.status || 'active')}</select></label>
    <label class="fld"><span>Internal notes <em>(never shown to the customer)</em></span><textarea name="notes" maxlength="5000">${c.notes || ''}</textarea></label>
    <label class="check"><input type="checkbox" name="marketing_consent" ${c.marketing_consent ? 'checked' : ''}><span>Has agreed to receive news and offers</span></label>
  </form>`;
  const readCustomer = f => {
    S.clearErr(f); const v = S.form(f);
    if (!v.first_name && !v.last_name && !v.company) { S.fieldErr(f, 'first_name', 'Enter a name'); return null; }
    if (v.email && !S.validEmail(v.email)) { S.fieldErr(f, 'email', 'This email address does not look right'); return null; }
    if (v.phone && !/^[0-9+()\s-]{6,20}$/.test(v.phone)) { S.fieldErr(f, 'phone', 'Use digits, spaces and + only'); return null; }
    const out = {}; ['first_name', 'last_name', 'company', 'email', 'phone', 'address_line1', 'address_line2', 'city', 'county', 'postcode', 'country', 'status', 'notes'].forEach(k => out[k] = v[k] || null);
    out.first_name = out.first_name || ''; out.last_name = out.last_name || ''; out.country = out.country || 'United Kingdom';
    out.marketing_consent = !!v.marketing_consent; return out;
  };
  const bindPostcode = f => { f.postcode.addEventListener('blur', () => { if (/^(united kingdom|uk|gb|england|scotland|wales|northern ireland)?$/i.test(f.country.value.trim())) f.postcode.value = S.normPostcode(f.postcode.value); }); };
  // Before creating, look for likely duplicates and let the user decide.
  async function possibleMatches(c) {
    const ors = []; if (c.email) ors.push(`email.ilike.${c.email.replace(/[,()*]/g, '')}`);
    const digits = (c.phone || '').replace(/\D/g, '').replace(/^44/, '0'); if (digits.length >= 6) ors.push(`phone_norm.eq.${digits}`);
    if (c.first_name && c.last_name) ors.push(`and(first_name.ilike.${c.first_name.replace(/[,()*]/g, '')},last_name.ilike.${c.last_name.replace(/[,()*]/g, '')})`);
    if (!ors.length) return [];
    return S.must(await S.db.from('customers').select('id,ref,first_name,last_name,email,phone').is('deleted_at', null).or(ors.join(',')).limit(5));
  }

  S.route('/customers/new', async v => {
    const prm = S.params();
    S.render(v, html`${S.page({ title: 'New customer', crumb: ['Customers', '#/customers'] })}<div class="card" style="max-width:760px">${customerForm({ first_name: prm.get('first') || '', email: prm.get('email') || '' })}
      <div class="wizbar" style="position:static;background:none;padding:22px 0 0"><a class="btn ghost" href="#/customers">Cancel</a><button class="btn gold" id="save">${icon('check')} Save customer</button></div></div>`);
    const f = $('#custf', v); bindPostcode(f);
    $('#save', v).onclick = async e => {
      const c = readCustomer(f); if (!c) return;
      const btn = e.currentTarget;
      const matches = await S.busy(btn, () => possibleMatches(c)).catch(er => { S.toast(er.message, { bad: true }); return null; });
      if (matches === null) return;
      if (matches.length) {
        const exact = matches.find(m => c.email && m.email && m.email.toLowerCase() === c.email.toLowerCase());
        const s = S.sheet({ title: 'Possible existing customer', body: html`<p class="muted" style="margin-top:0">${exact ? 'A customer with this email address already exists. Open their record instead.' : 'These customers look similar. Is this one of them?'}</p>
          <div class="list">${matches.map(m => html`<a class="li" href="#/customers/${m.id}" data-close><span class="avatar">${S.initials(S.name(m))}</span><span class="main-t"><span class="t" style="display:block">${S.name(m)}</span><span class="d" style="display:block">${m.email || ''} ${m.phone || ''} · ${m.ref}</span></span>${icon('chev', 'chev')}</a>`)}</div>`,
          foot: exact ? html`<button class="btn gold" data-close>OK</button>` : html`<button class="btn ghost" data-close>Cancel</button><button class="btn gold" id="anyway">Create a new customer anyway</button>` });
        const any = $('#anyway', s.el); if (any) any.onclick = () => { s.close(); create(); };
        return;
      }
      create();
      async function create() {
        try { const row = await S.act(btn, async () => S.must(await S.db.from('customers').insert(Object.assign(c, { created_by: S.user.id })).select('id').single()), 'Customer saved'); S.go('#/customers/' + row.id); } catch (er) { /* toast shown */ }
      }
    };
  });

  // =========================== CUSTOMER RECORD ===========================
  const TABS = [['overview', 'Overview'], ['activity', 'Activity'], ['enquiries', 'Enquiries'], ['quotes', 'Quotes'], ['orders', 'Orders'], ['invoices', 'Invoices'], ['payments', 'Payments'], ['files', 'Designs & files'], ['followups', 'Follow-ups'], ['notes', 'Notes'], ['loyalty', 'Loyalty']];
  S.route('/customers/:id', (v, p, l) => customerRecord(v, p.id, 'overview', l));
  S.route('/customers/:id/:tab', (v, p, l) => p.id === 'new' ? null : customerRecord(v, p.id, p.tab, l));

  async function customerRecord(v, id, tab, live) {
    const c = S.must(await S.db.from('customer_list').select('*').eq('id', id).maybeSingle());
    if (!live()) return;
    if (!c) return S.render(v, S.empty({ icon: 'users', title: 'Customer not found', text: 'They may have been archived.', action: html`<a class="btn" href="#/customers">All customers</a>` }));
    const counts = await Promise.all(['leads', 'quotes', 'orders', 'invoices'].map(t => S.db.from(t).select('id', { count: 'exact', head: true }).eq('customer_id', id).is('deleted_at', null)));
    const n = { enquiries: counts[0].count, quotes: counts[1].count, orders: counts[2].count, invoices: counts[3].count };
    S.render(v, html`<header class="ph"><div><div class="crumb"><a href="#/customers">${icon('back')} Customers</a></div>
        <div class="flex"><span class="avatar" style="width:52px;height:52px;font-size:1.3rem">${S.initials(S.name(c))}</span><div><h1>${S.name(c)}</h1>
        <div class="sub flex">${c.ref} ${pill('customer', c.status)} ${pill('account', c.account_label)}</div></div></div></div>
        <div class="acts">${c.phone ? html`<a class="btn" href="tel:${c.phone.replace(/\s/g, '')}">${icon('phone')} Call</a>` : ''}${c.email ? html`<a class="btn" href="mailto:${c.email}">${icon('mail')} Email</a>` : ''}
          <a class="btn" href="#/quotes/new?customer=${c.id}">${icon('quote')} Quote</a><button class="btn gold" id="fu">${icon('plus')} Follow-up</button></div></header>
      ${S.tabs(TABS.map(([k, l]) => [k, l, n[k], `#/customers/${id}/${k}`]), tab)}<div id="tab"></div>`);
    $('#fu', v).onclick = () => S.taskSheet({ customer_id: id, kind: 'follow_up', title: 'Call ' + (c.first_name || S.name(c)) }, () => S.go(`#/customers/${id}/followups`));
    const t = $('#tab', v);
    const fn = TABBERS[tab] || TABBERS.overview; await fn(t, c, live);
  }

  const docList = (rows, emptyMsg, link) => rows.length ? html`<div class="list">${rows.map(link)}</div>` : S.empty({ icon: 'file', title: emptyMsg });
  const TABBERS = {
    async overview(t, c) {
      const info = c.auth_user_id ? await S.rpc('customer_login_info', { p_customer: c.id }).catch(() => ({})) : {};
      const pts = S.must(await S.db.from('loyalty_points').select('points').eq('customer_id', c.id)).reduce((a, x) => a + x.points, 0);
      const acc = c.account_label;
      S.render(t, html`<div class="split"><div class="stack">
        <section class="card"><div class="ch"><h2>Details</h2><button class="btn sm" id="edit">${icon('edit')} Edit</button></div>
          ${S.kv([['Email', c.email ? html`<a href="mailto:${c.email}">${c.email}</a>` : ''], ['Phone', c.phone ? html`<a href="tel:${c.phone.replace(/\s/g, '')}">${c.phone}</a>` : ''], ['Company', c.company],
            ['Address', S.address(c)], ['Customer since', date(c.created_at)], ['Last contact', c.last_contact_at ? ago(c.last_contact_at) : ''], ['Last order', c.last_order_date ? date(c.last_order_date) : ''],
            S.canFinance() ? ['Total spend', money(c.total_spend_pence)] : null, ['Marketing', c.marketing_consent ? 'Agreed to news and offers' : 'No marketing consent'], ['Loyalty points', pts.toLocaleString('en-GB')]])}
          ${c.notes ? html`<div class="hr"></div><div class="tiny muted" style="letter-spacing:.14em;text-transform:uppercase">Internal notes</div><p class="pre" style="margin:6px 0 0">${c.notes}</p>` : ''}</section>
      </div><div class="stack">
        <section class="card"><div class="ch"><div><h2>Website account</h2><p class="muted small">Email is the login. Passwords are never visible.</p></div>${pill('account', acc)}</div>
          ${S.kv([['Login email', c.email], ['Account created', info.created_at ? date(info.created_at) : ''], ['Activated', c.activated_at ? date(c.activated_at) : ''],
            ['Last login', info.last_sign_in_at ? dateTime(info.last_sign_in_at) : ''], ['Invitation', c.invite_sent_at ? 'Sent ' + dateTime(c.invite_sent_at) + (c.invite_expires_at ? (acc === 'expired' ? ' · expired ' : ' · expires ') + dateTime(c.invite_expires_at) : '') : 'Not sent']])}
          <div class="flex" style="margin-top:16px">
            ${acc === 'none' ? html`<button class="btn gold" data-acc="signup-link">${icon('send')} Send signup link</button>` : ''}
            ${acc === 'invited' || acc === 'expired' ? html`<button class="btn gold" data-acc="signup-link">${icon('refresh')} Resend signup link</button>` : ''}
            ${acc === 'active' ? html`<button class="btn" data-acc="password-reset">${icon('lock')} Send password reset link</button>` : ''}
            ${acc !== 'disabled' && acc !== 'none' ? html`<button class="btn danger" data-acc="disable">Disable account</button>` : ''}
            ${acc === 'disabled' ? html`<button class="btn" data-acc="reactivate">Reactivate account</button>` : ''}</div>
          ${!c.email ? S.banner('warn', 'No email address', 'Add an email address to send a signup link.') : ''}</section>
        ${S.isOwner() ? html`<section class="card flat"><div class="ch"><div><h3>Archive customer</h3><p class="muted small">Hides the record. Orders, invoices and payments are kept.</p></div><button class="btn danger sm" id="archive">Archive</button></div></section>` : ''}
      </div></div>`);
      $('#edit', t).onclick = () => editCustomer(c);
      S.on(t, '[data-acc]', 'click', async (e, b) => {
        const a = b.dataset.acc;
        const labels = { 'signup-link': ['Send a secure signup link?', `We will email ${c.email} a link to confirm their email and create a password. It expires in 24 hours.`, 'Send link'],
          'password-reset': ['Send a password reset link?', `We will email ${c.email} a secure link to choose a new password. You will never see their password.`, 'Send link'],
          disable: ['Disable this account?', 'They will be signed out and unable to sign in until you reactivate the account. Their records are kept.', 'Disable'],
          reactivate: ['Reactivate this account?', 'They will be able to sign in again.', 'Reactivate'] }[a];
        if (!(await S.confirm({ title: labels[0], message: labels[1], confirm: labels[2], danger: a === 'disable' }))) return;
        try { await S.act(b, () => S.worker('/customers/' + a, { customer_id: c.id }), { 'signup-link': 'Signup link sent', 'password-reset': 'Password reset link sent', disable: 'Account disabled', reactivate: 'Account reactivated' }[a]); S.dispatch(); } catch (er) { /* shown */ }
      });
      const ar = $('#archive', t); if (ar) ar.onclick = async () => {
        if (!(await S.confirm({ title: 'Archive ' + S.name(c) + '?', message: 'The customer will be hidden from lists and search. Their orders, invoices and payments stay in your records.', confirm: 'Archive', danger: true, typed: 'ARCHIVE' }))) return;
        try { await S.act(ar, async () => S.must(await S.db.from('customers').update({ deleted_at: new Date().toISOString() }).eq('id', c.id)), 'Customer archived'); S.go('#/customers'); } catch (er) { }
      };
    },
    async activity(t, c) {
      const rows = S.must(await S.db.from('communications').select('*').eq('customer_id', c.id).order('created_at', { ascending: false }).limit(200));
      S.render(t, html`<div class="split"><section class="card"><div class="ch"><h2>Timeline</h2><button class="btn sm" id="log">${icon('plus')} Log contact</button></div>
        ${rows.length ? html`<ul class="tl">${rows.map(r => html`<li>${r.summary}${r.customer_visible ? raw(' <span class="tag manual">Visible to customer</span>') : ''}<time>${dateTime(r.created_at)}${r.created_by ? ' · ' + S.staffName(r.created_by) : ''}</time></li>`)}</ul>`
          : S.empty({ icon: 'clock', title: 'No activity yet' })}</section><div></div></div>`);
      await S.staffList();
      $('#log', t).onclick = () => {
        const s = S.sheet({ title: 'Log contact', body: html`<form class="form" id="lg"><label class="fld"><span>Type</span><select name="kind">${S.opts([['call', 'Phone call'], ['email', 'Email'], ['note', 'Meeting / other']])}</select></label>
          <label class="fld"><span>What happened?</span><textarea name="summary" required maxlength="500"></textarea></label></form>`, foot: html`<button class="btn ghost" data-close>Cancel</button><button class="btn gold" id="ok">Save</button>` });
        $('#ok', s.el).onclick = e => { const f = $('#lg', s.el), x = S.form(f); if (!x.summary) return S.fieldErr(f, 'summary', 'Describe the contact');
          S.act(e.currentTarget, async () => { S.must(await S.db.from('communications').insert({ customer_id: c.id, kind: x.kind, summary: { call: 'Call: ', email: 'Email: ', note: '' }[x.kind] + x.summary, created_by: S.user.id }));
            S.must(await S.db.from('customers').update({ last_contact_at: new Date().toISOString() }).eq('id', c.id)); s.close(); S.dispatch(); }, 'Saved').catch(() => {}); };
      };
    },
    async enquiries(t, c) {
      const rows = S.must(await S.db.from('leads').select('*').eq('customer_id', c.id).is('deleted_at', null).order('created_at', { ascending: false }));
      S.render(t, html`<div class="row-between" style="margin-bottom:14px"><span></span><a class="btn" href="#/leads/new?customer=${c.id}">${icon('plus')} New enquiry</a></div>
        ${docList(rows, 'No enquiries', l => html`<a class="li" href="#/leads/${l.id}"><span class="ic">${icon('inbox')}</span><span class="main-t"><span class="t" style="display:block">${l.subject || (l.message || '').slice(0, 60) || l.ref}</span><span class="d" style="display:block">${l.ref} · ${S.label(l.source)} · ${date(l.created_at)}</span></span>${pill('lead', l.stage)}${icon('chev', 'chev')}</a>`)}`);
    },
    async quotes(t, c) { await S.docTab(t, 'quotes', c, 'quote'); },
    async orders(t, c) { await S.docTab(t, 'orders', c, 'order'); },
    async invoices(t, c) { await S.docTab(t, 'invoices', c, 'invoice'); },
    async payments(t, c) {
      if (!S.canFinance()) return S.render(t, S.empty({ icon: 'lock', title: 'No finance access' }));
      const rows = S.must(await S.db.from('payments').select('*, refunds(*), invoices(number)').eq('customer_id', c.id).order('received_at', { ascending: false }));
      S.render(t, docList(rows, 'No payments yet', p2 => html`<div class="li"><span class="ic">${icon('card')}</span><span class="main-t"><span class="t" style="display:block">${money(p2.amount_pence)} · ${S.label(p2.method)}</span>
        <span class="d" style="display:block">${dateTime(p2.received_at)}${p2.invoices ? ' · ' + p2.invoices.number : ''}${p2.refunded_pence ? ' · refunded ' + money(p2.refunded_pence) : ''}</span></span>
        <span class="end">${pill('payment', p2.status)}<span class="tag ${p2.source === 'stripe_verified' ? 'actual' : 'manual'}">${p2.source === 'stripe_verified' ? 'Stripe verified' : 'Manual'}</span></span></div>`));
    },
    async files(t, c) {
      const rows = S.must(await S.db.from('documents').select('*').eq('customer_id', c.id).is('deleted_at', null).eq('bucket', 'customer-files').order('created_at', { ascending: false }));
      const groups = [['customer_design', 'Designs'], ['inspiration', 'Inspiration'], ['enquiry_attachment', 'Sent with enquiries'], ['customer_document', 'Documents']];
      S.render(t, html`<div class="row-between" style="margin-bottom:14px"><p class="muted small" style="margin:0">Designs, drawings and inspiration from ${c.first_name || 'the customer'}, plus anything you share with them. Kept separate from supplier and financial documents.</p>
        <label class="btn gold">${icon('upload')} Add file<input type="file" id="cf" multiple hidden accept="image/*,application/pdf"></label></div>
        ${rows.length ? groups.filter(g => rows.some(r => r.kind === g[0])).map(([k, l]) => html`<div class="section-t" style="margin:18px 0 12px">${l}</div>
          <div class="files">${rows.filter(r => r.kind === k).map(d => html`<div class="file-tile"><span class="ic">${/^image\//.test(d.mime || '') ? html`<img data-signed="${d.bucket}|${d.path}" alt="">` : icon('file')}</span>
            <a class="grow" href="#" data-open="${d.bucket}|${d.path}" style="min-width:0;color:inherit"><span style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${d.title || d.filename}</span>
            <span class="tiny muted">${date(d.created_at)} · ${d.uploaded_by_customer ? 'from customer' : 'from LK'}${d.customer_visible && !d.uploaded_by_customer ? ' · shared' : ''}</span>${d.note ? html`<span class="tiny" style="display:block">${d.note}</span>` : ''}</a></div>`)}</div>`)
          : S.empty({ icon: 'image', title: 'No files yet', text: 'Customers can upload designs and inspiration from their account, or you can add files here.' })}`);
      S.bindFiles(t); S.thumbs(t);
      $('#cf', t).onchange = async e => {
        const files = [...e.target.files]; if (!files.length) return;
        const s = S.sheet({ title: 'Add ' + files.length + ' file' + (files.length > 1 ? 's' : ''), body: html`<form class="form" id="uf"><label class="fld"><span>Type</span><select name="kind">${S.opts([['customer_design', 'Design / drawing'], ['inspiration', 'Inspiration'], ['customer_document', 'Document']])}</select></label>
          <label class="fld"><span>Note <em>(optional)</em></span><input name="note" maxlength="300"></label><label class="check"><input type="checkbox" name="share" checked><span>Show in the customer's account</span></label></form>`,
          foot: html`<button class="btn ghost" data-close>Cancel</button><button class="btn gold" id="go">Upload</button>` });
        $('#go', s.el).onclick = ev => S.act(ev.currentTarget, async () => {
          const o = S.form($('#uf', s.el));
          for (const file of files) {
            const prep = await S.prepareImage(file); const path = `${c.id}/lk-${S.uuid()}-${S.safeName(file.name)}`;
            await S.upload('customer-files', path, prep.blob, prep.type);
            S.must(await S.db.from('documents').insert({ kind: o.kind, bucket: 'customer-files', path, filename: file.name, mime: prep.type, size_bytes: prep.blob.size, customer_id: c.id, note: o.note || null, customer_visible: !!o.share, uploaded_by: S.user.id }));
          }
          s.close(); S.dispatch();
        }, 'Uploaded').catch(() => {});
      };
    },
    async followups(t, c) { await S.taskList(t, { customer_id: c.id }, { customer_id: c.id, kind: 'follow_up' }); },
    async notes(t, c) { await S.noteList(t, { customer_id: c.id }); },
    async loyalty(t, c) {
      const [pts, codes] = await Promise.all([S.db.from('loyalty_points').select('*').eq('customer_id', c.id).order('created_at', { ascending: false }), S.db.from('discount_codes').select('*').eq('customer_id', c.id).order('created_at', { ascending: false })]);
      const list = S.must(pts), bal = list.reduce((a, x) => a + x.points, 0);
      S.render(t, html`<div class="split"><section class="card"><div class="ch"><div><h2>${bal.toLocaleString('en-GB')} points</h2><p class="muted small">Earned automatically when orders are paid</p></div><button class="btn" id="adj">${icon('edit')} Adjust</button></div>
        ${list.length ? html`<div class="list">${list.map(x => html`<div class="li"><span class="main-t"><span class="t" style="display:block">${x.reason}</span><span class="d" style="display:block">${dateTime(x.created_at)}</span></span><span class="amt" style="color:${x.points > 0 ? 'var(--sage-d)' : 'var(--rose-d)'}">${x.points > 0 ? '+' : ''}${x.points}</span></div>`)}</div>` : S.empty({ icon: 'star', title: 'No points yet' })}</section>
        <section class="card"><h3>Discount codes</h3>${S.must(codes).length ? html`<div class="list">${S.must(codes).map(d => html`<div class="li"><span class="main-t"><span class="t" style="display:block">${d.code}</span><span class="d" style="display:block">${money(d.value_pence)} off · ${date(d.created_at)}</span></span>${d.used ? pill('task', 'done') : html`<span class="pill green">Available</span>`}</div>`)}</div>` : html`<p class="muted">None yet. Customers create codes from their points in their account.</p>`}</section></div>`);
      $('#adj', t).onclick = () => {
        const s = S.sheet({ title: 'Adjust points', body: html`<form class="form" id="pa"><label class="fld"><span>Points <em>(use − to remove)</em></span><input name="points" type="number" step="1" required></label><label class="fld"><span>Reason</span><input name="reason" required maxlength="120"></label></form>`, foot: html`<button class="btn ghost" data-close>Cancel</button><button class="btn gold" id="ok">Save</button>` });
        $('#ok', s.el).onclick = e => { const f = $('#pa', s.el), o = S.form(f); const n = parseInt(o.points, 10); S.clearErr(f);
          if (!n) return S.fieldErr(f, 'points', 'Enter a number other than 0'); if (!o.reason) return S.fieldErr(f, 'reason', 'Give a reason');
          S.act(e.currentTarget, async () => { S.must(await S.db.from('loyalty_points').insert({ customer_id: c.id, points: n, reason: 'Adjusted: ' + o.reason, created_by: S.user.id })); s.close(); S.dispatch(); }, 'Points updated').catch(() => {}); };
      };
    }
  };
  // Lists of quotes / orders / invoices for a customer (used here and on enquiries)
  S.docTab = async (t, table, c, kind) => {
    const rows = S.must(await S.db.from(table).select('*').eq('customer_id', c.id).is('deleted_at', null).order('created_at', { ascending: false }));
    S.render(t, html`<div class="row-between" style="margin-bottom:14px"><span></span>${kind !== 'invoice' ? html`<a class="btn" href="#/${table}/new?customer=${c.id}">${icon('plus')} New ${kind}</a>` : ''}</div>
      ${docList(rows, 'No ' + table + ' yet', d => html`<a class="li" href="#/${table}/${d.id}"><span class="ic">${icon(kind === 'quote' ? 'quote' : kind === 'order' ? 'bag' : 'receipt')}</span>
        <span class="main-t"><span class="t" style="display:block">${d.number}${d.title ? ' · ' + d.title : ''}</span><span class="d" style="display:block">${date(d.issue_date || d.order_date)}</span></span>
        <span class="end"><span class="amt">${money(d.total_pence)}</span>${pill(kind, d.status)}</span>${icon('chev', 'chev')}</a>`)}`);
  };
  function editCustomer(c) {
    const s = S.sheet({ title: 'Edit customer', wide: true, body: customerForm(c), foot: html`<button class="btn ghost" data-close>Cancel</button><button class="btn gold" id="ok">Save changes</button>` });
    const f = $('#custf', s.el); bindPostcode(f);
    $('#ok', s.el).onclick = e => { const x = readCustomer(f); if (!x) return; S.act(e.currentTarget, async () => { S.must(await S.db.from('customers').update(x).eq('id', c.id)); s.close(); S.dispatch(); }, 'Customer updated').catch(() => {}); };
  }

  // =========================== ENQUIRIES (LEADS) ===========================
  const STAGES = ['new', 'contact_required', 'contacted', 'discussion', 'quote_sent', 'awaiting_customer', 'won', 'lost'];
  S.route('/leads', async (v, p, live) => {
    const prm = S.params(); const view = prm.get('view') || (innerWidth < 820 ? 'list' : 'board'); const stage = prm.get('stage') || 'open';
    if (view === 'inbox') return inbox(v, live);
    let b = S.db.from('leads').select('*, customers(id,first_name,last_name,ref)').is('deleted_at', null).order('created_at', { ascending: false }).limit(300);
    if (stage === 'open') b = b.not('stage', 'in', '(won,lost)'); else if (stage !== 'all') b = b.eq('stage', stage);
    const [rows, failed] = await Promise.all([b.then(S.must), S.db.from('enquiries_inbox').select('id', { count: 'exact', head: true }).eq('status', 'failed')]);
    await S.staffList(); if (!live()) return;
    const cnt = k => rows.filter(l => l.stage === k).length;
    S.render(v, html`${S.page({ title: 'Enquiries', sub: 'From the website, phone and in person', acts: html`<a class="btn" href="#/leads?view=${view === 'board' ? 'list' : 'board'}&stage=${stage}">${view === 'board' ? 'List view' : 'Board view'}</a><a class="btn gold" href="#/leads/new">${icon('plus')} New enquiry</a>` })}
      ${failed.count ? html`<a class="banner bad" href="#/leads?view=inbox" style="text-decoration:none">${icon('alert')}<div class="grow"><b>${failed.count} enquir${failed.count === 1 ? 'y' : 'ies'} could not be processed</b>They are stored safely. Open to review and retry.</div>${icon('chev')}</a>` : ''}
      <div class="scrollx" style="margin-bottom:16px"><div class="chips" style="flex-wrap:nowrap">${[['open', 'Open'], ...STAGES.map(s => [s, S.statusLabel('lead', s)]), ['all', 'All']].map(([k, l]) => html`<a class="chip ${k === stage ? 'on' : ''}" href="#/leads?view=${view}&stage=${k}">${l}${STAGES.includes(k) && stage === 'all' ? html` <b>${cnt(k)}</b>` : ''}</a>`)}</div></div>
      ${!rows.length ? S.empty({ icon: 'inbox', title: 'No enquiries here', text: 'Website enquiries arrive automatically. You can also log phone and in-person enquiries.' }) :
        view === 'board' ? html`<div class="board">${STAGES.filter(s => stage === 'all' || stage === 'open' ? (stage === 'all' || !['won', 'lost'].includes(s)) : s === stage).map(sg => html`<div class="col"><h4>${S.statusLabel('lead', sg)}<span>${cnt(sg)}</span></h4>
          ${rows.filter(l => l.stage === sg).map(l => leadCard(l))}</div>`)}</div>`
        : html`<div class="list">${rows.map(l => html`<a class="li" href="#/leads/${l.id}"><span class="ic">${icon('inbox')}</span><span class="main-t"><span class="t" style="display:block">${l.name || l.email || l.ref}${l.match_status === 'review' ? raw(' <span class="pill red plain">Check customer</span>') : ''}</span>
          <span class="d" style="display:block">${l.subject || (l.message || '').slice(0, 80)}</span></span><span class="end">${pill('lead', l.stage)}<span class="tiny muted">${ago(l.created_at)}</span></span>${icon('chev', 'chev')}</a>`)}</div>`}`);
  });
  const leadCard = l => html`<a class="lead-card" href="#/leads/${l.id}"><div class="row-between"><span class="t">${l.name || l.email || l.ref}</span>${l.stage === 'new' && !l.seen_at ? raw('<span class="pill amber plain">New</span>') : ''}</div>
    <div class="d">${l.subject || l.message || ''}</div><div class="tiny muted" style="margin-top:8px">${l.ref} · ${ago(l.created_at)}${l.assigned_to ? ' · ' + S.staffName(l.assigned_to) : ''}${l.match_status === 'review' ? ' · check customer' : ''}</div></a>`;

  async function inbox(v, live) {
    const rows = S.must(await S.db.from('enquiries_inbox').select('*').neq('status', 'processed').order('received_at', { ascending: false }));
    if (!live()) return;
    S.render(v, html`${S.page({ title: 'Enquiries needing attention', crumb: ['Enquiries', '#/leads'], sub: 'Website enquiries are always stored first, so nothing is lost even if processing fails.' })}
      ${rows.length ? html`<div class="stack">${rows.map(r => html`<section class="card"><div class="ch"><div><h3>${r.payload.name || 'Unknown sender'}</h3><p class="muted small">${dateTime(r.received_at)} · ${r.payload.email || r.payload.phone || 'no contact details'}</p></div>${r.status === 'failed' ? raw('<span class="pill red">Failed</span>') : raw('<span class="pill amber">Pending</span>')}</div>
        ${r.error ? S.banner('bad', 'Why it failed', r.error) : ''}<p class="pre">${r.payload.message || ''}</p>
        <div class="flex"><button class="btn gold" data-retry="${r.id}">${icon('refresh')} Retry</button></div></section>`)}</div>`
        : S.empty({ icon: 'check', title: 'Nothing waiting', text: 'Every enquiry has been processed.' })}`);
    S.on(v, '[data-retry]', 'click', async (e, b) => {
      try { const id = await S.act(b, () => S.rpc('process_enquiry', { p_inbox: b.dataset.retry })); if (id) { S.toast('Enquiry processed'); S.go('#/leads/' + id); } else { S.toast('Still could not be processed. Check the reason shown.', { bad: true }); S.dispatch(); } } catch (er) { }
    });
  }

  S.route('/leads/new', async v => {
    const cid = S.params().get('customer'); let cust = cid ? S.must(await S.db.from('customers').select('id,first_name,last_name,email,phone,ref').eq('id', cid).maybeSingle()) : null;
    S.render(v, html`${S.page({ title: 'New enquiry', crumb: ['Enquiries', '#/leads'] })}<div class="card" style="max-width:760px"><form class="form" id="lf" novalidate>
      <div class="section-t">Customer</div><div id="cpick"></div>
      <div class="section-t">Enquiry</div>
      <div class="row"><label class="fld"><span>Source</span><select name="source">${S.opts([['phone', 'Phone'], ['in_person', 'In person'], ['email', 'Email'], ['social', 'Social media'], ['referral', 'Referral'], ['website', 'Website'], ['other', 'Other']])}</select></label>
        <label class="fld"><span>Subject</span><input name="subject" maxlength="200" placeholder="e.g. Engagement ring, budget £5k"></label></div>
      <label class="fld"><span>Details</span><textarea name="message" maxlength="10000" placeholder="What are they looking for?"></textarea></label></form>
      <div class="wizbar" style="position:static;background:none;padding:22px 0 0"><a class="btn ghost" href="#/leads">Cancel</a><button class="btn gold" id="save">${icon('check')} Save enquiry</button></div></div>`);
    const drawPick = () => S.render($('#cpick', v), cust ? html`<div class="li" style="border:1px solid var(--line);border-radius:12px"><span class="avatar">${S.initials(S.name(cust))}</span><span class="main-t"><span class="t" style="display:block">${S.name(cust)}</span><span class="d" style="display:block">${cust.email || cust.phone || ''} · ${cust.ref}</span></span><button class="btn sm" type="button" id="chg">Change</button></div>`
      : html`<div class="flex"><button class="btn" type="button" id="pickc">${icon('search')} Choose existing customer</button><a class="btn ghost" href="#/customers/new">${icon('plus')} New customer</a></div>`);
    const bind = () => { const b = $('#pickc', v) || $('#chg', v); if (b) b.onclick = async () => { const c = await S.pickCustomer(); if (c) { cust = c; drawPick(); bind(); } }; };
    drawPick(); bind();
    $('#save', v).onclick = e => {
      const o = S.form($('#lf', v));
      if (!cust) return S.toast('Choose the customer first (or create them).', { bad: true });
      if (!o.subject && !o.message) return S.fieldErr($('#lf', v), 'message', 'Add some details');
      S.act(e.currentTarget, async () => { const r = S.must(await S.db.from('leads').insert({ customer_id: cust.id, name: S.name(cust), email: cust.email, phone: cust.phone, source: o.source, subject: o.subject || null, message: o.message || null, stage: 'contacted', assigned_to: S.user.id, created_by: S.user.id }).select('id').single());
        S.must(await S.db.from('communications').insert({ customer_id: cust.id, kind: 'enquiry_received', summary: 'Enquiry logged: ' + (o.subject || o.message).slice(0, 80), related_type: 'lead', related_id: r.id, created_by: S.user.id })); S.go('#/leads/' + r.id); }, 'Enquiry saved').catch(() => {});
    };
  });
  S.pickCustomer = () => S.pick({ title: 'Choose customer', table: 'customers', select: 'id,ref,first_name,last_name,email,phone', search: ['first_name', 'last_name', 'email', 'phone', 'ref', 'company'], filter: b => b.is('deleted_at', null).order('created_at', { ascending: false }),
    render: c => html`<span class="avatar">${S.initials(S.name(c))}</span><span class="main-t"><span class="t" style="display:block">${S.name(c)}</span><span class="d" style="display:block">${c.email || c.phone || ''} · ${c.ref}</span></span>` });

  S.route('/leads/:id', async (v, p, live) => {
    const l = S.must(await S.db.from('leads').select('*, customers(*)').eq('id', p.id).maybeSingle());
    if (!live()) return;
    if (!l) return S.render(v, S.empty({ icon: 'inbox', title: 'Enquiry not found' }));
    if (!l.seen_at) S.db.from('leads').update({ seen_at: new Date().toISOString() }).eq('id', l.id).then(() => {});
    const [files, hist, staff, matches] = await Promise.all([
      S.db.from('documents').select('*').eq('lead_id', l.id).is('deleted_at', null).then(S.must),
      S.db.from('lead_stage_history').select('*').eq('lead_id', l.id).order('changed_at').then(S.must), S.staffList(),
      l.possible_matches && l.possible_matches.length ? S.db.from('customers').select('id,ref,first_name,last_name,email,phone').in('id', l.possible_matches).then(S.must) : Promise.resolve([])]);
    const c = l.customers;
    S.render(v, html`<header class="ph"><div><div class="crumb"><a href="#/leads">${icon('back')} Enquiries</a></div><h1>${l.name || l.email || l.ref}</h1>
      <div class="sub flex">${l.ref} · ${S.label(l.source)} · ${dateTime(l.created_at)} ${pill('lead', l.stage)}</div></div>
      <div class="acts">${c ? html`<a class="btn" href="#/quotes/new?customer=${c.id}&lead=${l.id}">${icon('quote')} Create quote</a>` : ''}<button class="btn gold" id="fu">${icon('plus')} Follow-up</button></div></header>
      ${l.match_status === 'review' ? html`<section class="card tint" style="margin-bottom:18px"><div class="ch"><div><h2>Who is this?</h2><p class="muted small">This enquiry has the same phone number as ${matches.length === 1 ? 'an existing customer' : 'existing customers'} but a different email address. Please decide.</p></div></div>
        <div class="list">${matches.map(m => html`<div class="li"><span class="avatar">${S.initials(S.name(m))}</span><span class="main-t"><span class="t" style="display:block">${S.name(m)}</span><span class="d" style="display:block">${m.email || ''} ${m.phone || ''} · ${m.ref}</span></span><button class="btn sm gold" data-link="${m.id}">Same person</button></div>`)}</div>
        <div class="flex" style="margin-top:14px"><button class="btn" id="newc">${icon('plus')} It is a new customer</button></div></section>` : ''}
      <div class="split"><div class="stack">
        <section class="card"><h2>Enquiry</h2>${l.subject ? html`<p style="font-weight:500;margin:6px 0">${l.subject}</p>` : ''}<p class="pre">${l.message || '—'}</p>
          ${files.length ? html`<div class="section-t" style="margin:18px 0 12px">Attached files</div><div class="files">${files.map(d => html`<a class="file-tile" href="#" data-open="${d.bucket}|${d.path}"><span class="ic">${/^image\//.test(d.mime || '') ? html`<img data-signed="${d.bucket}|${d.path}" alt="">` : icon('file')}</span><span class="grow">${d.filename}</span></a>`)}</div>` : ''}</section>
        <section class="card"><div class="ch"><h2>Stage</h2></div><div class="chips">${STAGES.map(sg => html`<button class="chip ${sg === l.stage ? 'on' : ''}" data-stage="${sg}">${S.statusLabel('lead', sg)}</button>`)}</div>
          ${l.lost_reason ? html`<p class="muted small" style="margin-top:12px">Lost because: ${l.lost_reason}</p>` : ''}
          <div class="hr"></div><ul class="tl">${hist.map(h => html`<li>${h.from_stage ? S.statusLabel('lead', h.from_stage) + ' → ' : 'Received as '}${S.statusLabel('lead', h.to_stage)}<time>${dateTime(h.changed_at)}${h.changed_by ? ' · ' + S.staffName(h.changed_by) : ''}</time></li>`)}</ul></section>
        <section class="card"><div class="ch"><h2>Follow-ups</h2></div><div id="tasks"></div></section>
      </div><div class="stack">
        <section class="card"><h2>Contact</h2>${S.kv([['Name', l.name], ['Email', l.email ? html`<a href="mailto:${l.email}">${l.email}</a>` : ''], ['Phone', l.phone ? html`<a href="tel:${l.phone.replace(/\s/g, '')}">${l.phone}</a>` : ''],
          ['Customer', c ? html`<a href="#/customers/${c.id}">${S.name(c)} · ${c.ref}</a>` : html`<span class="pill red plain">Not linked yet</span>`]])}</section>
        <section class="card"><h2>Assigned to</h2><select class="inp" id="assign" style="margin-top:8px">${S.opts([['', 'Unassigned'], ...staff.filter(s2 => s2.active).map(s2 => [s2.user_id, s2.full_name])], l.assigned_to || '')}</select></section>
        <section class="card"><h2>Internal notes</h2><textarea class="inp" id="lnotes" style="min-height:140px;margin-top:8px" placeholder="Only the team can see this">${l.notes || ''}</textarea><div class="tiny muted" id="saved" style="margin-top:6px"></div></section>
      </div></div>`);
    S.bindFiles(v); S.thumbs(v);
    await S.taskList($('#tasks', v), { lead_id: l.id }, { lead_id: l.id, customer_id: c ? c.id : null, kind: 'follow_up' }, true);
    $('#fu', v).onclick = () => S.taskSheet({ lead_id: l.id, customer_id: c ? c.id : null, kind: 'follow_up', title: 'Contact ' + (l.name || 'customer') }, S.dispatch);
    S.on(v, '[data-stage]', 'click', async (e, b) => {
      const sg = b.dataset.stage; if (sg === l.stage) return;
      let extra = {};
      if (sg === 'lost') { const why = await S.ask({ title: 'Mark as lost', label: 'Why was it lost?', confirm: 'Mark lost' }); if (why === null) return; extra.lost_reason = why; }
      S.act(b, async () => { S.must(await S.db.from('leads').update(Object.assign({ stage: sg }, extra)).eq('id', l.id)); S.dispatch(); S.refreshBadges(); }, 'Stage updated').catch(() => {});
    });
    $('#assign', v).onchange = e => S.act(null, async () => S.must(await S.db.from('leads').update({ assigned_to: e.target.value || null }).eq('id', l.id)), 'Assigned').catch(() => {});
    let nt; $('#lnotes', v).oninput = e => { clearTimeout(nt); $('#saved', v).textContent = 'Saving…'; nt = setTimeout(async () => { const r = await S.db.from('leads').update({ notes: e.target.value }).eq('id', l.id); $('#saved', v).textContent = r.error ? 'Not saved: ' + S.friendly(r.error.message) : 'Saved'; }, 700); };
    S.on(v, '[data-link]', 'click', (e, b) => S.act(b, async () => { await S.rpc('resolve_lead_match', { p_lead: l.id, p_customer: b.dataset.link }); S.dispatch(); }, 'Linked to customer').catch(() => {}));
    const nc = $('#newc', v); if (nc) nc.onclick = () => S.act(nc, async () => { await S.rpc('resolve_lead_match', { p_lead: l.id, p_customer: null }); S.dispatch(); }, 'New customer created').catch(() => {});
  });
})();
