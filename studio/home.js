/* LK Studio: Home dashboard, notifications, global search, "More" menu. */
(function () {
  const { html, raw, icon, money, moneyShort, pct, ago, date, pill, $, $$ } = S;

  // ---------- KPI ring (shared with the KPI screen) ----------
  S.ring = (pctv, status) => {
    const p = Math.max(0, Math.min(100, pctv || 0)), c = 2 * Math.PI * 34;
    const col = status === 'achieved' ? '#3f6a3c' : status === 'behind' ? '#9b3a2a' : status === 'no_data' || status == null ? '#c9bcae' : '#b8955a';
    return raw(`<div class="ring"><svg viewBox="0 0 84 84"><circle cx="42" cy="42" r="34" fill="none" stroke="#efe7dc" stroke-width="7"/>
      <circle cx="42" cy="42" r="34" fill="none" stroke="${col}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${(c * p / 100).toFixed(1)} ${c.toFixed(1)}"/></svg>
      <b>${pctv == null ? '–' : Math.round(pctv) + '%'}</b></div>`);
  };
  S.kpiValue = k => k.restricted ? 'Restricted' : k.value == null ? 'No data yet' : k.unit === 'gbp' ? money(k.value, { whole: true }) : k.unit === 'pct' ? pct(k.value) : k.unit === 'hours' ? k.value + ' h' : Number(k.value).toLocaleString('en-GB');
  S.kpiTarget = k => k.unit === 'gbp' ? money(k.target, { whole: true }) : k.unit === 'pct' ? pct(k.target) : k.unit === 'hours' ? k.target + ' h' : Number(k.target).toLocaleString('en-GB');
  S.kpiStatus = s => ({ achieved: ['Achieved', 'green'], on_track: ['On track', 'blue'], behind: ['Behind', 'red'], no_data: ['No data', 'grey'] })[s] || ['', 'grey'];

  S.route('/', async (v, p, live) => {
    const d = await S.rpc('dashboard');
    if (!live()) return;
    const h = new Date().getHours(); const greet = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
    const f = d.finance, m = f && f.month;
    const alerts = [];
    if (d.failed_enquiries) alerts.push(['bad', `${d.failed_enquiries} enquir${d.failed_enquiries === 1 ? 'y' : 'ies'} could not be processed`, 'They are safely stored. Open them to retry.', '#/leads?view=inbox']);
    if (d.publish_failures) alerts.push(['bad', `Publishing failed for ${d.publish_failures} product${d.publish_failures === 1 ? '' : 's'}`, 'The products are safe and can be retried.', '#/products?status=publish_failed']);
    if (S.isOwner() && d.awaiting_approval) alerts.push(['warn', `${d.awaiting_approval} product${d.awaiting_approval === 1 ? '' : 's'} waiting for your review`, '', '#/products?status=review']);
    if (!S.isOwner() && d.changes_requested) alerts.push(['warn', `${d.changes_requested} product${d.changes_requested === 1 ? '' : 's'} need changes`, 'The owner has left comments.', '#/products?status=changes_requested']);
    if (d.overdue_tasks) alerts.push(['warn', `${d.overdue_tasks} overdue task${d.overdue_tasks === 1 ? '' : 's'}`, '', '#/tasks?view=overdue']);
    if (m && m.invoices.overdue_count) alerts.push(['bad', `${m.invoices.overdue_count} overdue invoice${m.invoices.overdue_count === 1 ? '' : 's'} (${money(m.invoices.overdue_pence)})`, '', '#/invoices?status=overdue']);
    S.render(v, html`
      <header class="ph"><div><div class="crumb">${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        <h1>${greet}, ${S.me.full_name.split(' ')[0] || 'there'}</h1></div>
        <div class="acts"><a class="btn" href="#/customers/new">${icon('plus')} Customer</a><a class="btn gold" href="#/products/new">${icon('camera')} Add product</a></div></header>
      ${alerts.map(a => html`<a class="banner ${a[0]}" href="${a[3]}" style="text-decoration:none">${icon('alert')}<div class="grow"><b>${a[1]}</b>${a[2]}</div>${icon('chev')}</a>`)}
      <div class="grid g4" style="margin-bottom:18px">
        ${m ? html`
          <a class="stat" href="#/finance"><div class="k">Net sales · this month ${m.cogs.estimated ? '' : ''}</div><div class="v">${moneyShort(m.sales.net_pence)}</div><div class="s">${m.sales.orders} paid order${m.sales.orders === 1 ? '' : 's'}</div></a>
          <a class="stat" href="#/finance"><div class="k">Gross profit ${m.gross_profit.estimated ? raw('<span class="tag est">Estimated</span>') : ''}</div><div class="v">${moneyShort(m.gross_profit.pence)}</div><div class="s">Margin ${pct(m.gross_profit.margin_pct)}</div></a>
          <a class="stat" href="#/payments"><div class="k">Cash received</div><div class="v">${moneyShort(m.cash.actual_pence + m.cash.manual_pence)}</div><div class="s"><span class="tag actual">Stripe ${moneyShort(m.cash.actual_pence)}</span> <span class="tag manual">Manual ${moneyShort(m.cash.manual_pence)}</span></div></a>
          <a class="stat ${m.invoices.overdue_count ? 'alert' : ''}" href="#/invoices?status=open"><div class="k">Outstanding invoices</div><div class="v">${moneyShort(m.invoices.outstanding_pence)}</div><div class="s">${m.invoices.outstanding_count} open · ${m.invoices.overdue_count} overdue</div></a>`
        : html`
          <a class="stat" href="#/leads"><div class="k">New enquiries</div><div class="v">${d.new_enquiries}</div><div class="s">Waiting for a first reply</div></a>
          <a class="stat" href="#/orders"><div class="k">Open orders</div><div class="v">${d.open_orders}</div><div class="s">Confirmed or in progress</div></a>
          <a class="stat" href="#/products?status=review"><div class="k">Awaiting approval</div><div class="v">${d.awaiting_approval}</div><div class="s">Products with the owner</div></a>
          <a class="stat" href="#/tasks"><div class="k">Follow-ups due</div><div class="v">${d.follow_ups.length}</div><div class="s">${d.overdue_tasks} overdue</div></a>`}
      </div>
      <div class="split">
        <div class="stack">
          <section class="card"><div class="ch"><div><h2>New enquiries</h2><p class="muted small">${d.new_enquiries} new</p></div><a class="btn sm" href="#/leads">All enquiries</a></div>
            ${d.enquiries.length ? html`<div class="list">${d.enquiries.map(l => html`<a class="li" href="#/leads/${l.id}"><span class="ic">${icon('inbox')}</span><span class="main-t"><span class="t" style="display:block">${l.name || l.email || l.ref}</span><span class="d" style="display:block">${l.subject || l.email || ''}</span></span>
              <span class="end">${l.match_status === 'review' ? pill('lead', 'contact_required') : ''}<span class="tiny muted">${ago(l.created_at)}</span></span></a>`)}</div>`
              : S.empty({ icon: 'inbox', title: 'All caught up', text: 'New website enquiries will appear here.' })}</section>
          <section class="card"><div class="ch"><div><h2>Follow-ups</h2><p class="muted small">Due soon, for you or unassigned</p></div><a class="btn sm" href="#/tasks">All tasks</a></div>
            ${d.follow_ups.length ? html`<div class="list">${d.follow_ups.map(t => html`<div class="li"><label class="check" style="margin:0"><input type="checkbox" data-done="${t.id}" aria-label="Mark done"></label>
              <span class="main-t"><span class="t" style="display:block">${t.title}</span><span class="d" style="display:block">${t.customer ? t.customer + ' · ' : ''}${t.due_at ? (new Date(t.due_at) < new Date() ? 'Overdue · ' : 'Due ') + ago(t.due_at) : 'No due date'}</span></span>
              ${t.priority === 'high' ? pill('priority', 'high') : ''}${t.customer_id ? html`<a class="iconbtn" href="#/customers/${t.customer_id}" aria-label="Open customer">${icon('chev')}</a>` : ''}</div>`)}</div>`
              : S.empty({ icon: 'task', title: 'Nothing due', text: 'Follow-ups you create on customers and enquiries show here.' })}</section>
        </div>
        <div class="stack">
          <section class="card"><div class="ch"><h2>Targets</h2><a class="btn sm" href="#/kpis">KPIs</a></div>
            ${d.kpis.length ? html`<div class="stack">${d.kpis.slice(0, 4).map(k => { const st = S.kpiStatus(k.status); return html`<div class="kpi">${S.ring(k.restricted ? null : k.pct, k.status)}<div class="grow"><div class="n">${k.name}</div>
              <div class="v">${S.kpiValue(k)}</div><div class="tiny muted">Target ${k.restricted ? '—' : S.kpiTarget(k)} · ${S.label(k.period)}</div></div>${k.restricted ? '' : html`<span class="pill ${st[1]}">${st[0]}</span>`}</div>`; })}</div>`
              : S.empty({ icon: 'target', title: 'No targets yet', text: S.isOwner() ? 'Set monthly targets for revenue, enquiries and more.' : 'The owner has not set any targets yet.', action: S.isOwner() ? html`<a class="btn" href="#/kpis">Set targets</a>` : '' })}</section>
          ${f ? html`<section class="card"><div class="ch"><h2>Recent payments</h2><a class="btn sm" href="#/payments">All</a></div>
            ${f.recent_payments.length ? html`<div class="list">${f.recent_payments.map(pm => html`<div class="li"><span class="ic">${icon('card')}</span><span class="main-t"><span class="t" style="display:block">${pm.customer || 'Customer'}</span>
              <span class="d" style="display:block">${S.label(pm.method)} · ${ago(pm.received_at)}</span></span><span class="end"><span class="amt">${money(pm.amount_pence)}</span>
              <span class="tag ${pm.source === 'stripe_verified' ? 'actual' : 'manual'}">${pm.source === 'stripe_verified' ? 'Stripe verified' : 'Manual'}</span></span></div>`)}</div>`
              : S.empty({ icon: 'card', title: 'No payments yet' })}</section>` : ''}
        </div>
      </div>`);
    S.on(v, '[data-done]', 'change', async (e, c) => {
      try { S.must(await S.db.from('tasks').update({ status: 'done' }).eq('id', c.dataset.done)); c.closest('.li').style.opacity = .45; S.toast('Follow-up completed'); }
      catch (er) { c.checked = false; S.toast(er.message, { bad: true }); }
    });
  });

  // ---------- Notifications ----------
  S.route('/notifications', async v => {
    const list = S.must(await S.db.from('notifications').select('*').order('created_at', { ascending: false }).limit(100));
    S.render(v, html`${S.page({ title: 'Notifications', sub: 'Things that need your attention', acts: list.some(n => !n.read_at) ? html`<button class="btn" id="allread">${icon('check')} Mark all read</button>` : '' })}
      ${list.length ? html`<div class="list">${list.map(n => html`<a class="li ${n.read_at ? '' : 'unread'}" href="${n.link || '#/'}" data-n="${n.id}"><span class="ic">${icon(
        /payment|refund/.test(n.kind) ? 'card' : /enquir/.test(n.kind) ? 'inbox' : /product|publish|changes/.test(n.kind) ? 'gem' : /quote/.test(n.kind) ? 'quote' : /invoice/.test(n.kind) ? 'receipt' : /stock/.test(n.kind) ? 'alert' : /customer|signup|design/.test(n.kind) ? 'users' : 'bell')}</span>
        <span class="main-t"><span class="t" style="display:block">${n.title}</span><span class="d" style="display:block">${n.body || ''}</span></span><span class="end tiny muted">${ago(n.created_at)}</span></a>`)}</div>`
        : S.empty({ icon: 'bell', title: 'No notifications', text: 'You will be told about new enquiries, approvals, payments and anything that fails.' })}`);
    S.on(v, '[data-n]', 'click', (e, a) => { S.db.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', a.dataset.n).then(S.refreshBadges); });
    const b = $('#allread', v); if (b) b.onclick = () => S.act(b, async () => { S.must(await S.db.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null)); S.refreshBadges(); S.dispatch(); }, 'All marked as read');
  });

  // ---------- Global search ----------
  const TYPE = { customer: ['Customers', 'users', id => '#/customers/' + id], lead: ['Enquiries', 'inbox', id => '#/leads/' + id], product: ['Products', 'gem', id => '#/products/' + id],
    supplier: ['Suppliers', 'truck', id => '#/suppliers/' + id], quote: ['Quotes', 'quote', id => '#/quotes/' + id], order: ['Orders', 'bag', id => '#/orders/' + id],
    invoice: ['Invoices', 'receipt', id => '#/invoices/' + id], payment: ['Payments', 'card', () => '#/payments'], task: ['Tasks', 'task', () => '#/tasks'],
    note: ['Notes', 'note', id => '#/notes?open=' + id], document: ['Documents', 'folder', () => '#/documents'] };
  S.openSearch = () => {
    if ($('.search-ov')) return;
    const s = S.sheet({ title: '', body: html`<div class="flex" style="border-bottom:1px solid var(--line);padding-bottom:8px">${icon('search')}<input id="gq" placeholder="Search customers, products, orders, invoices…" autocomplete="off" aria-label="Search"></div><div id="gr"><p class="muted small" style="padding:16px 0">Search by name, email, phone, reference, SKU or document number.</p></div>` });
    s.el.classList.add('search-ov');
    const inp = $('#gq', s.el); inp.focus();
    let t, seq = 0;
    inp.oninput = () => { clearTimeout(t); t = setTimeout(async () => {
      const q = inp.value.trim(), my = ++seq; const out = $('#gr', s.el);
      if (q.length < 2) return S.render(out, html`<p class="muted small" style="padding:16px 0">Type at least 2 characters.</p>`);
      S.render(out, S.loading(2));
      try {
        const res = await S.rpc('search_all', { q }); if (my !== seq) return;
        if (!res.length) return S.render(out, S.empty({ icon: 'search', title: 'No results', text: 'Nothing matches “' + q + '”.' }));
        const groups = {}; res.forEach(r => (groups[r.type] = groups[r.type] || []).push(r));
        S.render(out, html`${Object.keys(groups).map(k => html`<div class="res-grp">${TYPE[k][0]}</div><div class="list">${groups[k].map(r => html`<a class="li" href="${TYPE[k][2](r.id)}" data-close><span class="ic">${icon(TYPE[k][1])}</span>
          <span class="main-t"><span class="t" style="display:block">${r.title || '—'}</span><span class="d" style="display:block">${r.subtitle || ''}</span></span>${icon('chev', 'chev')}</a>`)}</div>`)}`);
      } catch (e) { S.render(out, S.errorState(e.message)); }
    }, 220); };
  };

  // ---------- More (mobile) ----------
  S.route('/more', v => {
    S.render(v, html`${S.page({ title: 'More' })}<div class="more-grid">${S.navItems().filter(n => n[0] && !['customers', 'products', 'orders'].includes(n[0])).map(n => html`<a href="#/${n[0]}">${icon(n[2])}${n[1]}</a>`)}
      <a href="#/notifications">${icon('bell')}Notifications</a><a href="../index.html" target="_blank" rel="noopener">${icon('external')}Website</a></div>
      <div class="card flat" style="margin-top:18px"><div class="row-between"><div class="flex"><span class="avatar">${S.initials(S.me.full_name)}</span><div><div>${S.me.full_name}</div><div class="tiny muted">${S.me.email} · ${S.me.role === 'owner' ? 'Owner' : 'Team'}</div></div></div>
      <button class="btn sm" id="so2">${icon('logout')} Sign out</button></div></div>`);
    $('#so2', v).onclick = () => $('#signout').click();
  });
})();
