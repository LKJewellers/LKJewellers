/* LK Studio: Settings — team & permissions, business details, pricing, loyalty, website text, integrations, audit log, my account. */
(function () {
  const { html, raw, icon, date, dateTime, ago, $, $$ } = S;
  const TABS = [['integrations', 'Integrations'], ['team', 'Team', true], ['business', 'Business & VAT'], ['pricing', 'Pricing', true], ['loyalty', 'Loyalty', true], ['website', 'Website text', true], ['audit', 'Audit log', true], ['account', 'My account']];

  S.route('/settings', v => S.go('#/settings/' + (S.isOwner() ? 'team' : 'integrations')));
  S.route('/settings/:tab', async (v, p, live) => {
    const tabs = TABS.filter(t => !t[2] || S.isOwner());
    const tab = tabs.find(t => t[0] === p.tab) ? p.tab : tabs[0][0];
    S.render(v, html`${S.page({ title: 'Settings' })}${S.tabs(tabs.map(([k, l]) => [k, l, null, '#/settings/' + k]), tab)}<div id="st">${S.loading()}</div>`);
    await SECTIONS[tab]($('#st', v), live);
  });

  const saveSetting = async (key, value, isPublic = false) => { S.must(await S.db.from('settings').upsert({ key, value, is_public: isPublic, updated_at: new Date().toISOString() })); if (S.cache.settings) delete S.cache.settings[key]; };

  const SECTIONS = {
    // ---------------- integrations ----------------
    async integrations(el) {
      const st = await S.integrations(true);
      let pub = null; try { const r = await fetch(S.db.url + '/rest/v1/website_products?select=id', { headers: { apikey: window.LK_CONFIG.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + window.LK_CONFIG.SUPABASE_ANON_KEY, Prefer: 'count=exact', Range: '0-0' } }); pub = r.ok ? (r.headers.get('content-range') || '').split('/')[1] : null; } catch (e) { }
      const row = (ok, title, okText, missing) => html`<div class="li"><span class="ic" style="background:${ok ? 'var(--sage)' : 'var(--amber)'};color:${ok ? 'var(--sage-d)' : 'var(--amber-d)'}">${icon(ok ? 'check' : 'settings')}</span>
        <span class="main-t"><span class="t" style="display:block">${title}</span><span class="d" style="display:block;white-space:normal">${ok ? okText : raw('<b style="color:var(--gold-d)">MANUAL CONFIGURATION REQUIRED</b> · ' + S.esc(missing))}</span></span></div>`;
      S.render(el, html`<p class="muted" style="margin-top:0">What LK Studio is connected to. Anything marked <b>manual configuration required</b> keeps working inside the app, but that one connection will report a clear error instead of pretending to succeed.</p>
        <div class="list cfg-list">
          ${row(true, 'Database, logins and file storage (Supabase)', 'Connected. You are signed in and your data is protected by database rules.', '')}
          ${row(pub !== null, 'Website product feed', pub !== null ? `Connected. ${pub} product${pub === '1' ? ' is' : 's are'} published on the website “New in” page.` : '', 'The website could not read published products. Check js/config.js on the website.')}
          ${row(st.worker, 'Cloudflare Worker (secure server)', 'Connected.', st.workerError ? 'The Worker did not answer: ' + st.workerError : 'Deploy the Worker and put its address in WORKER_URL in js/config.js (Setup guide, Part C).')}
          ${row(st.email, 'Email sending (signup links, password resets, quotes, invoices)', 'Connected through Resend.', 'Add the RESEND_API_KEY secret and EMAIL_FROM to the Worker (Setup guide, Part B).')}
          ${row(st.ocr, 'Reading invoices and receipts (OCR)', 'Connected. Results are always checked by a person before saving.', 'Add the RECEIPT_READER_API_KEY secret to the Worker. Until then, enter figures by hand.')}
          ${row(st.stripe, 'Stripe payment links', 'Connected.', 'Add the STRIPE_SECRET_KEY secret to the Worker (Setup guide, Part D).')}
          ${row(st.stripe_webhook, 'Stripe payment confirmations (webhook)', 'Connected. Payments are only marked paid when Stripe confirms them.', 'Create a Stripe webhook to <Worker address>/stripe/webhook and add STRIPE_WEBHOOK_SECRET (Setup guide, Part D).')}
          ${row(st.worker, 'Website enquiry form → LK Studio', 'Enquiries from the contact page arrive in Enquiries automatically.', 'Needs the Worker. Until then the contact form keeps using its previous email form.')}
          ${row(st.enquiry_alerts, 'Email alert for new enquiries', 'On.', 'Optional: set NOTIFY_EMAIL on the Worker to also receive enquiries by email. They always appear in LK Studio.')}
        </div><button class="btn" id="re" style="margin-top:16px">${icon('refresh')} Check again</button>`);
      $('#re', el).onclick = () => SECTIONS.integrations(el);
    },
    // ---------------- team ----------------
    async team(el) {
      const staff = S.must(await S.db.from('staff').select('*').order('role').order('full_name')); S.cache.staff = null;
      S.render(el, html`<div class="row-between" style="margin-bottom:14px"><p class="muted small" style="margin:0">Team members sign in to LK Studio. Customers can never sign in here.</p><button class="btn gold" id="inv">${icon('plus')} Invite team member</button></div>
        <div class="list">${staff.map(m => html`<div class="li"><span class="avatar">${S.initials(m.full_name)}</span><span class="main-t"><span class="t" style="display:block">${m.full_name}${m.user_id === S.user.id ? ' (you)' : ''}</span><span class="d" style="display:block">${m.email} · added ${date(m.created_at)}</span></span>
          <span class="end"><span class="pill ${m.active ? (m.role === 'owner' ? 'violet' : 'blue') : 'grey'}">${m.active ? (m.role === 'owner' ? 'Owner' : 'Team') : 'Access off'}</span>${m.role !== 'owner' ? html`<span class="tiny muted">${m.can_view_finance ? 'Can see finances' : 'No finance access'}</span>` : ''}</span>
          ${m.user_id !== S.user.id ? html`<button class="btn sm" data-m="${m.user_id}">Manage</button>` : ''}</div>`)}</div>
        <section class="card flat" style="margin-top:18px"><h3>What each role can do</h3>${S.kv([['Owner', 'Everything: approve and publish products, set KPIs and targets, see finances, manage the team and settings, view the audit log.'],
          ['Team', 'Day-to-day work: customers, enquiries, products (prepare and submit), suppliers, purchasing, quotes, orders, invoices, tasks and notes. Cannot approve or publish products, change approved prices, set targets or manage the team.'],
          ['Finance access', 'Optional for team members: lets them see the finance dashboard, payments, outgoings and money figures.']])}</section>`);
      $('#inv', el).onclick = () => {
        const s = S.sheet({ title: 'Invite team member', body: html`<form class="form" id="if"><label class="fld"><span>Full name</span><input name="full_name" maxlength="120"></label><label class="fld"><span>Work email</span><input name="email" type="email"></label>
          <label class="fld"><span>Role</span><select name="role">${S.opts([['staff', 'Team member'], ['owner', 'Owner (full control)']])}</select></label><label class="check"><input type="checkbox" name="can_view_finance"><span>Can see financial information</span></label></form>
          <p class="small muted">They will receive an email to set their own password.</p>`, foot: html`<button class="btn ghost" data-close>Cancel</button><button class="btn gold" id="ok">Send invitation</button>` });
        $('#ok', s.el).onclick = e => { const f = $('#if', s.el), o = S.form(f); S.clearErr(f); if (!o.full_name) return S.fieldErr(f, 'full_name', 'Enter their name'); if (!S.validEmail(o.email)) return S.fieldErr(f, 'email', 'Enter a valid email');
          S.act(e.currentTarget, async () => { await S.worker('/staff/invite', o); s.close(); SECTIONS.team(el); }, 'Invitation sent').catch(() => {}); };
      };
      S.on(el, '[data-m]', 'click', (e, b) => {
        const m = staff.find(x => x.user_id === b.dataset.m);
        const s = S.sheet({ title: m.full_name, body: html`<form class="form" id="mf"><label class="fld"><span>Role</span><select name="role">${S.opts([['staff', 'Team member'], ['owner', 'Owner']], m.role)}</select></label>
          <label class="check"><input type="checkbox" name="can_view_finance" ${m.can_view_finance ? 'checked' : ''}><span>Can see financial information</span></label></form>
          <div class="hr"></div><div class="row-between"><div><b>${m.active ? 'Access is on' : 'Access is off'}</b><div class="small muted">${m.active ? 'Switching off signs them out of LK Studio.' : 'Switch on to let them sign in again.'}</div></div><button class="btn ${m.active ? 'danger' : ''}" id="tog">${m.active ? 'Switch off access' : 'Switch on access'}</button></div>`,
          foot: html`<button class="btn ghost" data-close>Cancel</button><button class="btn gold" id="ok">Save</button>` });
        $('#ok', s.el).onclick = ev => { const o = S.form($('#mf', s.el));
          S.act(ev.currentTarget, async () => { S.must(await S.db.from('staff').update({ role: o.role, can_view_finance: o.role === 'owner' || !!o.can_view_finance }).eq('user_id', m.user_id)); s.close(); SECTIONS.team(el); }, 'Saved').catch(() => {}); };
        $('#tog', s.el).onclick = async ev => { const on = !m.active;
          if (!on && !(await S.confirm({ title: 'Switch off ' + m.full_name + "'s access?", message: 'They will no longer be able to use LK Studio. Their past work stays in the records.', confirm: 'Switch off', danger: true }))) return;
          try { await S.act(ev.currentTarget, async () => { try { await S.worker('/staff/access', { user_id: m.user_id, active: on }); }
            catch (er) { if (!er.config) throw er; S.must(await S.db.from('staff').update({ active: on }).eq('user_id', m.user_id)); S.toast('Studio access updated. Connect the Worker to also block their login completely.', { bad: true }); } }, on ? 'Access switched on' : 'Access switched off'); s.close(); SECTIONS.team(el); } catch (er) { } };
      });
    },
    // ---------------- business & VAT ----------------
    async business(el) {
      const b = (await S.settings('business')) || {}, vat = (await S.settings('vat')) || {}; const ro = !S.isOwner();
      S.render(el, html`<section class="card" style="max-width:820px"><h2>Business details</h2><p class="muted small">Shown on invoices, quotes and emails.</p><form class="form" id="bf">
        <div class="row"><label class="fld"><span>Business name</span><input name="name" value="${b.name || 'LK Jewellers'}" ${ro ? 'disabled' : ''}></label><label class="fld"><span>Website</span><input name="website" value="${b.website || ''}" ${ro ? 'disabled' : ''}></label></div>
        <label class="fld"><span>Address</span><textarea name="address" style="min-height:70px" ${ro ? 'disabled' : ''}>${b.address || ''}</textarea></label>
        <div class="row"><label class="fld"><span>Email</span><input name="email" value="${b.email || ''}" ${ro ? 'disabled' : ''}></label><label class="fld"><span>Phone</span><input name="phone" value="${b.phone || ''}" ${ro ? 'disabled' : ''}></label></div>
        <div class="row"><label class="fld"><span>Company number</span><input name="company_number" value="${b.company_number || ''}" ${ro ? 'disabled' : ''}></label><label class="fld"><span>VAT number</span><input name="vat_number" value="${b.vat_number || ''}" ${ro ? 'disabled' : ''}></label></div>
        <label class="fld"><span>Bank details for transfers</span><input name="bank_details" value="${b.bank_details || ''}" placeholder="Account name · sort code · account number" ${ro ? 'disabled' : ''}></label>
        <div class="row"><label class="fld"><span>Payment terms (days)</span><input name="payment_terms_days" inputmode="numeric" value="${b.payment_terms_days || 14}" ${ro ? 'disabled' : ''}></label><label class="fld"><span>Invoice footer</span><input name="invoice_footer" value="${b.invoice_footer || ''}" ${ro ? 'disabled' : ''}></label></div>
        <div class="section-t">VAT</div>
        <label class="check"><input type="checkbox" name="registered" ${vat.registered !== false ? 'checked' : ''} ${ro ? 'disabled' : ''}><span>LK Jewellers is VAT registered</span></label>
        <label class="check"><input type="checkbox" name="prices_include_vat" ${vat.prices_include_vat !== false ? 'checked' : ''} ${ro ? 'disabled' : ''}><span>Prices include VAT (normal for shops selling to the public)</span></label>
        <label class="fld" style="max-width:200px"><span>Standard VAT rate %</span><input name="default_rate" inputmode="decimal" value="${vat.default_rate ?? 20}" ${ro ? 'disabled' : ''}></label></form>
        ${ro ? html`<p class="small muted">Only the owner can change these details.</p>` : html`<div class="flex" style="justify-content:flex-end;margin-top:16px"><button class="btn gold" id="sv">Save</button></div>`}</section>`);
      const sv = $('#sv', el); if (sv) sv.onclick = e => { const f = $('#bf', el), o = S.form(f); S.clearErr(f); if (!/^\d{1,3}$/.test(o.payment_terms_days)) return S.fieldErr(f, 'payment_terms_days', 'Use a number of days');
        S.act(e.currentTarget, async () => { await saveSetting('business', { name: o.name, website: o.website, address: o.address, email: o.email, phone: o.phone, company_number: o.company_number, vat_number: o.vat_number, bank_details: o.bank_details, payment_terms_days: +o.payment_terms_days, invoice_footer: o.invoice_footer, tagline: 'London' });
          await saveSetting('vat', { registered: !!o.registered, prices_include_vat: !!o.prices_include_vat, default_rate: +o.default_rate || 20 }); }, 'Saved').catch(() => {}); };
    },
    // ---------------- pricing rules ----------------
    async pricing(el) {
      const r = (await S.settings('pricing_rules')) || { default_margin_pct: 55, categories: {} };
      const cats = ['Engagement rings', 'Wedding bands', 'Rings', 'Earrings', 'Necklaces', 'Pendants', 'Bracelets', 'Bespoke', 'Gifts', 'Other'];
      S.render(el, html`<section class="card" style="max-width:720px"><h2>Pricing suggestions</h2><p class="muted small">Used only to suggest a price when adding a product. A suggested price is never applied without someone confirming it.</p>
        <form class="form" id="pf"><label class="fld" style="max-width:240px"><span>Default target margin %</span><input name="default" inputmode="decimal" value="${r.default_margin_pct}"></label>
        <div class="section-t">By category <em class="muted" style="text-transform:none;letter-spacing:0">(leave blank to use the default)</em></div>
        <div class="row">${cats.map(c => html`<label class="fld"><span>${c}</span><input name="c:${c}" inputmode="decimal" value="${(r.categories || {})[c] ?? ''}"></label>`)}</div></form>
        <p class="explain">Example: with a 55% margin, a piece with a landed cost of £1,000 is suggested at £1,000 ÷ (1 − 0.55) = £2,222 before VAT, £2,667 with 20% VAT, rounded up to £2,670.</p>
        <div class="flex" style="justify-content:flex-end"><button class="btn gold" id="sv">Save</button></div></section>`);
      $('#sv', el).onclick = e => { const o = S.form($('#pf', el)); const d = parseFloat(o.default); if (!(d > 0 && d < 95)) return S.toast('The default margin must be between 1 and 94%', { bad: true });
        const c = {}; Object.keys(o).filter(k => k.startsWith('c:') && o[k] !== '').forEach(k => { const x = parseFloat(o[k]); if (x > 0 && x < 95) c[k.slice(2)] = x; });
        S.act(e.currentTarget, () => saveSetting('pricing_rules', { default_margin_pct: d, categories: c }), 'Pricing rules saved').catch(() => {}); };
    },
    // ---------------- loyalty ----------------
    async loyalty(el) {
      const ppp = await S.settings('loyalty_points_per_pound'), ppt = await S.settings('loyalty_pence_per_point');
      S.render(el, html`<section class="card" style="max-width:640px"><h2>Loyalty points</h2><p class="muted small">Customers earn points when an order is fully paid, and can swap 100 points at a time for a discount code in their account.</p>
        <form class="form" id="lf"><div class="row"><label class="fld"><span>Points per £1 spent</span><input name="ppp" inputmode="decimal" value="${ppp ?? 1}"></label><label class="fld"><span>Value of 1 point (pence)</span><input name="ppt" inputmode="decimal" value="${ppt ?? 1}"></label></div></form>
        <p class="explain" id="ex"></p><div class="flex" style="justify-content:flex-end"><button class="btn gold" id="sv">Save</button></div></section>`);
      const f = $('#lf', el); const ex = () => { const a = +f.ppp.value || 0, b = +f.ppt.value || 0; $('#ex', el).textContent = `A £1,000 order earns ${Math.floor(1000 * a).toLocaleString('en-GB')} points, worth ${S.money(Math.floor(1000 * a) * b)} off a future order (${(a * b).toFixed(1)}% back).`; };
      f.oninput = ex; ex();
      $('#sv', el).onclick = e => { const a = parseFloat(f.ppp.value), b = parseFloat(f.ppt.value); if (!(a >= 0) || !(b >= 0)) return S.toast('Use numbers of 0 or more', { bad: true });
        S.act(e.currentTarget, async () => { await saveSetting('loyalty_points_per_pound', a); await saveSetting('loyalty_pence_per_point', b); }, 'Saved').catch(() => {}); };
    },
    // ---------------- website text ----------------
    async website(el) {
      const KEYS = [['home_hero_title', 'Homepage headline', 'Press Enter for a new line.'], ['home_lead', 'Homepage intro sentence', ''], ['home_bespoke_title', 'Homepage bespoke heading', ''], ['home_bespoke_text', 'Homepage bespoke paragraph', ''], ['home_footer_line', 'Homepage footer line', '']];
      const rows = S.must(await S.db.from('settings').select('key,value').in('key', KEYS.map(k => k[0])));
      const cur = Object.fromEntries(rows.map(r => [r.key, typeof r.value === 'string' ? r.value : '']));
      S.render(el, html`<section class="card" style="max-width:760px"><h2>Website text</h2><p class="muted small">Change the wording on the homepage. Leave a box empty to keep the original text. Products are published from the Products screen.</p>
        <form class="form" id="wf">${KEYS.map(([k, l, h]) => html`<label class="fld"><span>${l}</span><textarea name="${k}" maxlength="600" style="min-height:70px" placeholder="Original text is used when empty">${cur[k] || ''}</textarea>${h ? html`<small>${h}</small>` : ''}</label>`)}</form>
        <div class="flex" style="justify-content:flex-end"><a class="btn" href="../index.html" target="_blank" rel="noopener">${icon('external')} View homepage</a><button class="btn gold" id="sv">Save</button></div></section>`);
      $('#sv', el).onclick = e => { const o = S.form($('#wf', el));
        S.act(e.currentTarget, async () => { const up = KEYS.filter(([k]) => o[k]).map(([k]) => ({ key: k, value: o[k], is_public: true, updated_at: new Date().toISOString() }));
          const clear = KEYS.filter(([k]) => !o[k]).map(([k]) => k);
          if (up.length) S.must(await S.db.from('settings').upsert(up)); if (clear.length) S.must(await S.db.from('settings').delete().in('key', clear)); }, 'Website text saved').catch(() => {}); };
    },
    // ---------------- audit log ----------------
    async audit(el) {
      await S.staffList();
      const q = S.params().get('q') || '';
      let b = S.db.from('audit_log').select('*').order('at', { ascending: false }).limit(300);
      if (q) b = b.or(`action.ilike.*${q.replace(/[,()*]/g, ' ')}*,entity.ilike.*${q.replace(/[,()*]/g, ' ')}*`);
      const rows = S.must(await b);
      const linkFor = r => ({ products: '#/products/', customers: '#/customers/', quotes: '#/quotes/', orders: '#/orders/', invoices: '#/invoices/', leads: '#/leads/', suppliers: '#/suppliers/', purchases: '#/purchases/' })[r.entity];
      const say = a => a.replace(/^(\w+)\.(insert|update|delete)$/, (_, t, op) => S.label(t.replace(/s$/, '')) + ' ' + { insert: 'created', update: 'changed', delete: 'deleted' }[op]).replace(/^(\w+)\.(.+)$/, (_, t, ev) => S.label(t) + ': ' + ev.replace(/_/g, ' '));
      S.render(el, html`<form class="toolbar" id="af"><div class="search">${icon('search')}<input name="q" value="${q}" placeholder="Filter by action or record type (e.g. product, price, payment)"></div></form>
        <p class="small muted">Every important action is recorded with who, when and what changed. Entries cannot be edited or deleted.</p>
        ${rows.length ? html`<div class="list">${rows.map(r => html`<details class="li" style="display:block"><summary style="display:flex;gap:12px;align-items:center;cursor:pointer;list-style:none"><span class="ic">${icon('shield')}</span>
          <span class="main-t"><span class="t" style="display:block">${say(r.action)}</span><span class="d" style="display:block">${dateTime(r.at)} · ${r.actor_kind === 'system' ? 'System' : r.actor_kind === 'customer' ? 'Customer' : S.staffName(r.actor)}</span></span>
          ${linkFor(r) && r.entity_id ? html`<a class="btn sm" href="${linkFor(r)}${r.entity_id}">Open</a>` : ''}</summary>
          ${r.details ? html`<div class="tblwrap" style="margin-top:10px"><table class="tbl"><tbody>${Object.entries(r.details).map(([k, val]) => html`<tr><td class="muted">${S.label(k)}</td><td>${Array.isArray(val) ? html`${val[0] ?? '—'} → <b>${val[1] ?? '—'}</b>` : typeof val === 'object' ? JSON.stringify(val) : String(val)}</td></tr>`)}</tbody></table></div>` : ''}</details>`)}</div>`
          : S.empty({ icon: 'shield', title: 'No entries' })}`);
      $('#af', el).onsubmit = e => { e.preventDefault(); location.hash = '#/settings/audit?q=' + encodeURIComponent(e.target.q.value.trim()); };
    },
    // ---------------- my account ----------------
    async account(el) {
      S.render(el, html`<section class="card" style="max-width:560px"><h2>${S.me.full_name}</h2><p class="muted">${S.me.email} · ${S.me.role === 'owner' ? 'Owner' : 'Team member'}</p>
        <form class="form" id="pw"><div class="section-t">Change password</div><label class="fld"><span>New password <em>(at least 10 characters)</em></span><input type="password" name="p1" autocomplete="new-password"></label>
        <label class="fld"><span>Repeat new password</span><input type="password" name="p2" autocomplete="new-password"></label><button class="btn gold" type="submit">Update password</button></form></section>`);
      $('#pw', el).onsubmit = e => { e.preventDefault(); const f = e.target, o = S.form(f); S.clearErr(f);
        if (o.p1.length < 10) return S.fieldErr(f, 'p1', 'Use at least 10 characters'); if (o.p1 !== o.p2) return S.fieldErr(f, 'p2', 'The passwords do not match');
        S.act(S.$('button', f), async () => { const r = await S.db.auth.updateUser({ password: o.p1 }); if (r.error) throw new Error(r.error.message); f.reset(); }, 'Password updated').catch(() => {}); };
    }
  };
  S.route('/audit', () => S.go('#/settings/audit'), { owner: true });
})();
