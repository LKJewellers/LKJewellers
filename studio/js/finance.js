/* LK Studio: Finance dashboard, outgoings, KPIs & targets. */
(function () {
  const { html, raw, icon, money, moneyShort, pct, date, dateTime, pill, $, $$ } = S;
  const tag = k => raw({ actual: '<span class="tag actual">Actual</span>', manual: '<span class="tag manual">Manually entered</span>', est: '<span class="tag est">Estimated</span>' }[k]);

  const PERIODS = [['today', 'Today'], ['week', 'This week'], ['month', 'This month'], ['quarter', 'This quarter'], ['year', 'This year'], ['custom', 'Custom']];
  const range = (k, from, to) => {
    const n = new Date(), d = x => S.isoDate(x);
    if (k === 'today') return [d(n), d(n)];
    if (k === 'week') { const m = new Date(n); m.setDate(n.getDate() - ((n.getDay() + 6) % 7)); return [d(m), d(n)]; }
    if (k === 'month') return [d(new Date(n.getFullYear(), n.getMonth(), 1)), d(n)];
    if (k === 'quarter') return [d(new Date(n.getFullYear(), Math.floor(n.getMonth() / 3) * 3, 1)), d(n)];
    if (k === 'year') return [d(new Date(n.getFullYear(), 0, 1)), d(n)];
    return [from || d(new Date(n.getFullYear(), n.getMonth(), 1)), to || d(n)];
  };

  // Simple bar + line chart (SVG): net sales bars, gross profit line.
  const chart = trend => {
    if (!trend || !trend.length) return '';
    const W = 720, H = 240, L = 54, B = 30, T = 14, R = 10, w = (W - L - R) / trend.length;
    const max = Math.max(1, ...trend.map(t => Math.max(t.net_sales_pence, t.gross_profit_pence, 0)));
    const min = Math.min(0, ...trend.map(t => t.gross_profit_pence));
    const y = v => T + (H - T - B) * (1 - (v - min) / (max - min || 1));
    const ticks = 4, step = (max - min) / ticks;
    let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Net sales and gross profit, last 12 months">`;
    for (let i = 0; i <= ticks; i++) { const v = min + step * i; s += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="#efe7dc"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${S.esc(moneyShort(v))}</text>`; }
    trend.forEach((t, i) => { const x = L + i * w + w * 0.18, bw = w * 0.64; s += `<rect x="${x}" y="${y(Math.max(0, t.net_sales_pence))}" width="${bw}" height="${Math.max(0, y(0) - y(Math.max(0, t.net_sales_pence)))}" rx="3" fill="#e6d5b3"><title>${t.month}: ${S.esc(money(t.net_sales_pence))} net sales</title></rect>`;
      s += `<text x="${L + i * w + w / 2}" y="${H - 10}" text-anchor="middle">${new Date(t.month + '-15').toLocaleDateString('en-GB', { month: 'short' })}</text>`; });
    s += `<polyline fill="none" stroke="#8a6a36" stroke-width="2" points="${trend.map((t, i) => `${L + i * w + w / 2},${y(t.gross_profit_pence)}`).join(' ')}"/>`;
    trend.forEach((t, i) => { s += `<circle cx="${L + i * w + w / 2}" cy="${y(t.gross_profit_pence)}" r="3" fill="#8a6a36"><title>${t.month}: ${S.esc(money(t.gross_profit_pence))} gross profit</title></circle>`; });
    return raw(s + '</svg>');
  };

  S.route('/finance', async (v, p, live) => {
    const prm = S.params(); const per = prm.get('p') || 'month'; const [from, to] = range(per, prm.get('from'), prm.get('to'));
    const f = await S.rpc('finance_summary', { p_from: from, p_to: to }); if (!live()) return;
    const cashTotal = f.cash.actual_pence + f.cash.manual_pence;
    S.render(v, html`${S.page({ title: 'Finance', sub: `${S.date(from)} – ${S.date(to)}`, acts: html`<a class="btn" href="#/finance/outgoings">${icon('receipt')} Outgoings</a><a class="btn" href="#/kpis">${icon('target')} Targets</a>` })}
      <div class="scrollx" style="margin-bottom:14px"><div class="chips" style="flex-wrap:nowrap">${PERIODS.map(([k, l]) => html`<a class="chip ${k === per ? 'on' : ''}" href="#/finance?p=${k}">${l}</a>`)}</div></div>
      ${per === 'custom' ? html`<div class="toolbar"><label class="fld"><span>From</span><input type="date" id="fr" value="${from}"></label><label class="fld"><span>To</span><input type="date" id="tt" value="${to}"></label><div class="fld"><span>&nbsp;</span><button class="btn" id="go">Show</button></div></div>` : ''}
      <p class="small muted" style="margin:0 0 16px">${tag('actual')} verified by Stripe &nbsp; ${tag('manual')} recorded by a person &nbsp; ${tag('est')} depends on costs that may be incomplete</p>
      <div class="grid g4">
        <div class="stat"><div class="k">Cash received</div><div class="v">${moneyShort(cashTotal)}</div><div class="s">${tag('actual')} ${money(f.cash.actual_pence)}<br>${tag('manual')} ${money(f.cash.manual_pence)}</div></div>
        <div class="stat"><div class="k">Net sales</div><div class="v">${moneyShort(f.sales.net_pence)}</div><div class="s">${f.sales.orders} paid order${f.sales.orders === 1 ? '' : 's'} · avg ${money(f.sales.average_order_pence)}</div></div>
        <div class="stat"><div class="k">Gross profit ${f.gross_profit.estimated ? tag('est') : ''}</div><div class="v">${moneyShort(f.gross_profit.pence)}</div><div class="s">Margin ${pct(f.gross_profit.margin_pct)}</div></div>
        <div class="stat ${f.invoices.overdue_count ? 'alert' : ''}"><div class="k">Outstanding</div><div class="v">${moneyShort(f.invoices.outstanding_pence)}</div><div class="s">${f.invoices.outstanding_count} invoice${f.invoices.outstanding_count === 1 ? '' : 's'} · ${f.invoices.overdue_count} overdue (${money(f.invoices.overdue_pence)})</div></div>
      </div>
      <div class="split" style="margin-top:18px"><div class="stack">
        <section class="card"><div class="ch"><div><h2>Sales & profit trend</h2><p class="muted small">Last 12 months, by month an order was paid</p></div><div class="legend"><span><i style="background:#e6d5b3"></i>Net sales</span><span><i style="background:#8a6a36"></i>Gross profit</span></div></div>${chart(f.trend)}</section>
        <section class="card"><h2>How the figures are worked out</h2><p class="muted small">For orders fully paid in this period.</p>
          <div class="calc"><div class="r"><span>Sales (including VAT)</span><span>${money(f.sales.gross_pence)}</span></div><div class="r op"><span>minus VAT</span><span>${money(f.sales.vat_pence)}</span></div>
            <div class="r tot"><span>Net sales (revenue)</span><span>${money(f.sales.net_pence)}</span></div><div class="r op"><span>minus cost of goods sold ${f.cogs.estimated ? tag('est') : ''}</span><span>${money(f.cogs.pence)}</span></div>
            <div class="r tot"><span>Gross profit</span><span>${money(f.gross_profit.pence)}</span></div><div class="r op"><span>minus recorded outgoings ${tag('manual')}</span><span>${money(f.expenses.pence)}</span></div>
            <div class="r tot"><span>Net profit ${tag('est')}</span><span>${money(f.net_profit.pence)}</span></div></div>
          ${f.cogs.lines_missing_cost ? S.banner('warn', `${f.cogs.lines_missing_cost} sold item${f.cogs.lines_missing_cost === 1 ? '' : 's'} had no recorded cost`, 'They are counted as £0 cost, so gross profit is overstated. Add costs to those products for accurate figures.') : ''}
          <p class="explain">${f.net_profit.explanation} Cost of goods uses each item's landed cost at the time it was sold.</p></section>
      </div><div class="stack">
        <section class="card"><h2>Money in</h2>${S.kv([['Received via Stripe', html`${money(f.cash.actual_pence + f.cash.refunds_actual_pence)} ${tag('actual')}`], ['Received manually', html`${money(f.cash.manual_pence + f.cash.refunds_manual_pence)} ${tag('manual')}`],
          ['Refunds', money(f.cash.refunds_actual_pence + f.cash.refunds_manual_pence)], ['Net cash received', money(cashTotal)], ['Invoices paid', `${f.invoices.paid_count} · ${money(f.invoices.paid_pence)}`]])}</section>
        <section class="card"><h2>Money out</h2>${S.kv([['Supplier purchases', html`${money(f.purchases.pence)} ${tag('manual')}`], ['Purchase invoices', String(f.purchases.count)], ['Other outgoings', html`${money(f.expenses.pence)} ${tag('manual')}`]])}
          <p class="small muted" style="margin:12px 0 0">Supplier purchases are stock you bought; their cost counts towards profit when each piece sells.</p>
          <div class="flex" style="margin-top:12px"><a class="btn sm" href="#/purchases">Purchasing</a><a class="btn sm" href="#/finance/outgoings">Outgoings</a></div></section>
      </div></div>`);
    const go = $('#go', v); if (go) go.onclick = () => { const a = $('#fr', v).value, b = $('#tt', v).value; if (!a || !b || a > b) return S.toast('Choose a valid date range', { bad: true }); S.go(`#/finance?p=custom&from=${a}&to=${b}`); };
  }, { finance: true });

  // =========================== OUTGOINGS ===========================
  const CATS = [['supplier', 'Supplier'], ['bills', 'Bills & utilities'], ['rent', 'Rent'], ['wages', 'Wages'], ['marketing', 'Marketing'], ['other', 'Other']];
  S.route('/finance/outgoings', async (v, p, live) => {
    const rows = S.must(await S.db.from('expenses').select('*, documents(bucket,path,filename)').is('deleted_at', null).order('expense_date', { ascending: false }).limit(300));
    if (!live()) return;
    const month = rows.filter(e => e.expense_date >= S.isoDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1))).reduce((a, e) => a + e.amount_pence, 0);
    S.render(v, html`${S.page({ title: 'Outgoings', crumb: ['Finance', '#/finance'], sub: money(month) + ' this month · all figures entered by a person', acts: html`<button class="btn gold" id="add">${icon('camera')} Add outgoing</button>` })}
      ${rows.length ? html`<div class="list">${rows.map(e => html`<div class="li"><span class="ic">${icon('receipt')}</span><span class="main-t"><span class="t" style="display:block">${e.payee || e.description || S.label(e.category)}</span>
        <span class="d" style="display:block">${S.date(e.expense_date)} · ${(CATS.find(c => c[0] === e.category) || [, 'Other'])[1]}${e.description && e.payee ? ' · ' + e.description : ''}${e.vat_pence ? ' · VAT ' + money(e.vat_pence) : ''}</span></span>
        <span class="end"><span class="amt">${money(e.amount_pence)}</span>${e.documents ? html`<a href="#" class="small" data-open="${e.documents.bucket}|${e.documents.path}">Receipt</a>` : ''}</span><button class="iconbtn" data-del="${e.id}" aria-label="Remove">${icon('trash')}</button></div>`)}</div>`
        : S.empty({ icon: 'receipt', title: 'No outgoings recorded', text: 'Record rent, bills, wages and other costs so net profit can be estimated.' })}`);
    S.bindFiles(v);
    $('#add', v).onclick = () => expenseSheet();
    S.on(v, '[data-del]', 'click', async (e, b) => { if (!(await S.confirm({ title: 'Remove this outgoing?', message: 'It is kept in the audit trail.', confirm: 'Remove', danger: true }))) return;
      S.act(b, async () => { S.must(await S.db.from('expenses').update({ deleted_at: new Date().toISOString() }).eq('id', b.dataset.del)); S.dispatch(); }, 'Removed').catch(() => {}); });
  }, { finance: true });

  function expenseSheet() {
    let doc = null;
    const s = S.sheet({ title: 'Add outgoing', body: html`<div class="flex" style="margin-bottom:16px"><label class="btn">${icon('camera')} Photo of receipt<input type="file" accept="image/*" capture="environment" hidden data-r></label><label class="btn ghost">${icon('upload')} Upload<input type="file" accept="image/*,application/pdf" hidden data-r></label></div>
      <div id="rs"></div><form class="form" id="ef" novalidate><div class="row"><label class="fld"><span>Date</span><input type="date" name="expense_date" value="${S.isoDate()}"></label><label class="fld"><span>Category</span><select name="category">${S.opts(CATS, 'bills')}</select></label></div>
      <label class="fld"><span>Paid to</span><input name="payee" maxlength="120"></label><label class="fld"><span>Description</span><input name="description" maxlength="200"></label>
      <div class="row"><label class="fld"><span>Total (incl. VAT)</span><div class="money"><input name="amount" inputmode="decimal"></div></label><label class="fld"><span>of which VAT</span><div class="money"><input name="vat" inputmode="decimal"></div></label></div></form>`,
      foot: html`<button class="btn ghost" data-close>Cancel</button><button class="btn gold" id="ok">Save outgoing</button>` });
    const f = $('#ef', s.el);
    S.$$('[data-r]', s.el).forEach(inp => inp.onchange = async () => {
      const file = inp.files[0]; if (!file) return; const box = $('#rs', s.el);
      S.render(box, html`<p class="small muted">Saving receipt…</p>`);
      try {
        const prep = await S.prepareImage(file, 3000, 0.9); const path = `expenses/${S.uuid()}-${S.safeName(file.name)}`;
        await S.upload('business-docs', path, prep.blob, prep.type);
        doc = S.must(await S.db.from('documents').insert({ kind: 'expense_receipt', bucket: 'business-docs', path, filename: file.name, mime: prep.type, size_bytes: prep.blob.size, uploaded_by: S.user.id }).select().single());
        S.render(box, html`<p class="small muted">Receipt saved. Reading it…</p>`);
        try {
          const r = await S.worker('/ocr', { document_id: doc.id }); const d = r.data;
          if (d.supplier_name) f.payee.value = d.supplier_name; if (/^\d{4}-\d{2}-\d{2}$/.test(d.invoice_date || '')) f.expense_date.value = d.invoice_date;
          if (d.total != null) f.amount.value = Number(d.total).toFixed(2); if (d.vat != null) f.vat.value = Number(d.vat).toFixed(2);
          if (d.lines && d.lines.length) f.description.value = d.lines.slice(0, 3).map(l => l.description).join(', ').slice(0, 200);
          S.render(box, S.banner('warn', 'Read automatically: please check', 'Correct anything that does not match the receipt before saving.'));
        } catch (e) { S.render(box, e.config ? S.configBanner('Automatic reading is not set up yet. The receipt is saved; type the figures below.') : S.banner('bad', 'OCR could not read this receipt', 'The receipt is saved. Please type the figures below.')); }
      } catch (e) { S.render(box, S.banner('bad', 'The receipt could not be saved', S.friendly(e.message))); doc = null; }
    });
    $('#ok', s.el).onclick = e => { S.clearErr(f); const o = S.form(f); const a = S.pence(o.amount), vt = o.vat ? S.pence(o.vat) : 0;
      if (!a || isNaN(a) || a <= 0) return S.fieldErr(f, 'amount', 'Enter the total paid'); if (isNaN(vt) || vt > a) return S.fieldErr(f, 'vat', 'VAT must be a number no bigger than the total');
      if (!o.payee && !o.description) return S.fieldErr(f, 'payee', 'Who was it paid to?');
      S.act(e.currentTarget, async () => { const r = S.must(await S.db.from('expenses').insert({ expense_date: o.expense_date, category: o.category, payee: o.payee || null, description: o.description || '', amount_pence: a, vat_pence: vt || 0, document_id: doc ? doc.id : null, created_by: S.user.id }).select('id').single());
        if (doc) { S.must(await S.db.from('documents').update({ expense_id: r.id, ocr_status: doc.ocr_status === 'none' ? 'none' : 'confirmed' }).eq('id', doc.id)); }
        s.close(); S.dispatch(); }, 'Outgoing saved').catch(() => {}); };
  }

  // =========================== KPIs ===========================
  const METRICS = [['revenue', 'Revenue (net sales)', 'gbp'], ['gross_profit', 'Gross profit', 'gbp'], ['gross_margin', 'Gross margin', 'pct'], ['new_customers', 'New customers', 'count'], ['new_enquiries', 'New enquiries', 'count'],
    ['lead_conversion', 'Enquiry conversion rate', 'pct'], ['average_order_value', 'Average order value', 'gbp'], ['products_added', 'Products added', 'count'], ['products_sold', 'Products sold', 'count'],
    ['supplier_spend', 'Supplier spending', 'gbp'], ['quote_conversion', 'Quote conversion rate', 'pct'], ['response_time_hours', 'Response time to enquiries (hours)', 'hours'], ['repeat_customer_rate', 'Repeat customer rate', 'pct'], ['manual', 'Other (enter the value yourself)', 'count']];
  const unitOf = m => (METRICS.find(x => x[0] === m) || [, , 'count'])[2];
  S.route('/kpis', async (v, p, live) => {
    const [prog, all] = await Promise.all([S.rpc('kpi_progress'), S.db.from('kpis').select('*').order('sort_order').order('created_at').then(S.must)]);
    if (!live()) return;
    const owner = S.isOwner();
    S.render(v, html`${S.page({ title: 'KPIs & targets', sub: 'Progress is calculated from your real records', acts: owner ? html`<button class="btn gold" id="add">${icon('plus')} New target</button>` : '' })}
      ${prog.length ? html`<div class="grid g2">${prog.map(k => { const st = S.kpiStatus(k.status); return html`<section class="card"><div class="kpi">${S.ring(k.restricted ? null : k.pct, k.status)}<div class="grow"><div class="n">${k.name}</div>
        <div class="v">${S.kpiValue(k)}</div><div class="tiny muted">${k.restricted ? 'Financial target: owner and finance access only' : 'Target ' + S.kpiTarget(k) + ' · ' + S.date(k.from) + ' – ' + S.date(k.to)}</div></div>
        <div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end">${k.restricted ? '' : html`<span class="pill ${st[1]}">${st[0]}</span>`}${owner ? html`<button class="btn sm ghost" data-edit="${k.id}">Edit</button>` : ''}</div></div></section>`; })}</div>`
        : S.empty({ icon: 'target', title: 'No targets yet', text: owner ? 'Set targets for revenue, profit, enquiries and more. Progress updates automatically.' : 'The owner has not set any targets yet.', action: owner ? html`<button class="btn gold" id="add2">${icon('plus')} New target</button>` : '' })}
      ${owner && all.some(k => !k.active) ? html`<section class="card" style="margin-top:18px"><h3>Switched off</h3><div class="list">${all.filter(k => !k.active).map(k => html`<div class="li"><span class="main-t"><span class="t">${k.name}</span></span><button class="btn sm" data-edit="${k.id}">Edit</button></div>`)}</div></section>` : ''}`);
    const open = k => kpiSheet(k);
    [$('#add', v), $('#add2', v)].filter(Boolean).forEach(b => b.onclick = () => open(null));
    S.on(v, '[data-edit]', 'click', (e, b) => open(all.find(k => k.id === b.dataset.edit)));
  });
  function kpiSheet(k) {
    k = k || { metric: 'revenue', period: 'month', active: true, higher_is_better: true };
    const u0 = unitOf(k.metric); const shown = k.target == null ? '' : u0 === 'gbp' ? (k.target / 100).toFixed(0) : k.target;
    const s = S.sheet({ title: k.id ? 'Edit target' : 'New target', body: html`<form class="form" id="kf" novalidate>
      <label class="fld"><span>Measure</span><select name="metric">${S.opts(METRICS.map(m => [m[0], m[1]]), k.metric)}</select></label>
      <label class="fld"><span>Name</span><input name="name" value="${k.name || ''}" maxlength="80"></label>
      <div class="row"><label class="fld"><span id="tl">Target</span><input name="target" inputmode="decimal" value="${shown}"></label><label class="fld"><span>Period</span><select name="period">${S.opts([['week', 'Each week'], ['month', 'Each month'], ['quarter', 'Each quarter'], ['year', 'Each year'], ['custom', 'Custom dates']], k.period)}</select></label></div>
      <div class="row" id="cd"><label class="fld"><span>From</span><input type="date" name="start_date" value="${k.start_date || ''}"></label><label class="fld"><span>To</span><input type="date" name="end_date" value="${k.end_date || ''}"></label></div>
      <label class="fld" id="mv"><span>Current value</span><input name="manual_value" inputmode="decimal" value="${k.manual_value ?? ''}"></label>
      <label class="check"><input type="checkbox" name="higher_is_better" ${k.higher_is_better ? 'checked' : ''}><span>Higher is better</span></label>
      <label class="check"><input type="checkbox" name="active" ${k.active ? 'checked' : ''}><span>Show on dashboards</span></label></form>`,
      foot: html`<button class="btn ghost" data-close>Cancel</button><button class="btn gold" id="ok">Save target</button>` });
    const f = $('#kf', s.el);
    const adapt = () => { const m = f.metric.value, u = unitOf(m); $('#tl', s.el).textContent = 'Target' + (u === 'gbp' ? ' (£)' : u === 'pct' ? ' (%)' : u === 'hours' ? ' (hours)' : '');
      $('#cd', s.el).hidden = f.period.value !== 'custom'; $('#mv', s.el).hidden = m !== 'manual';
      if (!f.name.value || METRICS.some(x => x[1] === f.name.value)) f.name.value = (METRICS.find(x => x[0] === m) || [, ''])[1];
      if (m === 'response_time_hours') f.higher_is_better.checked = false; };
    f.metric.onchange = adapt; f.period.onchange = adapt; adapt();
    $('#ok', s.el).onclick = e => { S.clearErr(f); const o = S.form(f); const u = unitOf(o.metric); const t = parseFloat(o.target);
      if (!o.name) return S.fieldErr(f, 'name', 'Name the target'); if (!(t > 0)) return S.fieldErr(f, 'target', 'Enter a target above 0');
      if (o.period === 'custom' && (!o.start_date || !o.end_date || o.start_date > o.end_date)) return S.fieldErr(f, 'start_date', 'Choose valid dates');
      const row = { name: o.name, metric: o.metric, target: u === 'gbp' ? Math.round(t * 100) : t, period: o.period, start_date: o.period === 'custom' ? o.start_date : null, end_date: o.period === 'custom' ? o.end_date : null,
        manual_value: o.metric === 'manual' && o.manual_value !== '' ? parseFloat(o.manual_value) : null, higher_is_better: !!o.higher_is_better, active: !!o.active };
      S.act(e.currentTarget, async () => { if (k.id) S.must(await S.db.from('kpis').update(row).eq('id', k.id)); else S.must(await S.db.from('kpis').insert(Object.assign(row, { created_by: S.user.id }))); s.close(); S.dispatch(); }, 'Target saved').catch(() => {}); };
  }
})();
