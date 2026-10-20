/* =====================================================================
   LK Jewellers customer accounts: sign up (email first), sign in, password
   reset, and the private customer portal. Customers only ever receive their
   own customer-facing data, through secure database functions.
   ===================================================================== */
(function () {
  const { $, $$, esc, money, date, toast } = LK;
  const page = document.body.dataset.page;
  const root = $('#app');
  if (!LK.configured) { LK.setupNotice(root); return; }
  const db = LK.db;
  const msg = (el, text, bad) => { if (!el) return; el.textContent = text; el.className = 'msg ' + (bad ? 'bad' : 'ok'); el.hidden = !text; };
  const busy = async (btn, fn) => { btn.disabled = true; btn.dataset.t = btn.dataset.t || btn.textContent; btn.textContent = 'Please wait…'; try { return await fn(); } finally { btn.disabled = false; btn.textContent = btn.dataset.t; } };
  const showPanel = id => { $$('.panel').forEach(p => (p.hidden = p.id !== id)); $$('.tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.p === id)); };
  const friendly = m => /Failed to fetch|reach the server/i.test(m || '') ? 'We could not reach our server. Please check your connection and try again.' : (m || 'Something went wrong. Please try again.');

  // ======================= SIGN IN / JOIN / FORGOT =======================
  if (page === 'auth') {
    LK.session().then(s => { if (s) location.replace('portal.html'); });
    $$('.tabs button, [data-go]').forEach(b => b.addEventListener('click', () => showPanel(b.dataset.p || b.dataset.go)));
    showPanel(location.hash === '#join' ? 'join' : location.hash === '#forgot' ? 'forgot' : 'signin');
    if (new URLSearchParams(location.search).get('deleted')) msg($('#signin-msg'), 'Your account has been deleted.');

    $('#signin-form').addEventListener('submit', async e => {
      e.preventDefault(); const f = e.target, out = $('#signin-msg'); const email = f.email.value.trim().toLowerCase();
      if (!LK.validEmail(email) || !f.password.value) return msg(out, 'Enter your email address and password.', true);
      const { error } = await busy($('button[type=submit]', f), () => db.auth.signInWithPassword({ email, password: f.password.value }));
      if (error) {
        if (/confirm/i.test(error.message)) { $('#resend').hidden = false; return msg(out, 'Please confirm your email address first, using the link we sent you.', true); }
        if (/banned/i.test(error.message)) return msg(out, 'This account has been disabled. Please contact LK Jewellers.', true);
        return msg(out, /Invalid login/i.test(error.message) ? 'That email and password do not match.' : friendly(error.message), true);
      }
      location.href = 'portal.html';
    });
    $('#resend').addEventListener('click', async () => {
      const email = $('#signin-form').email.value.trim().toLowerCase(); if (!LK.validEmail(email)) return msg($('#signin-msg'), 'Enter your email address above first.', true);
      const { error } = await db.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: LK.siteUrl + '/account/reset.html?welcome=1' } });
      msg($('#signin-msg'), error ? friendly(error.message) : 'We have sent you a new link.', !!error);
    });
    // Join: name + email only. The emailed link confirms the address, then they create a password.
    $('#join-form').addEventListener('submit', async e => {
      e.preventDefault(); const f = e.target, out = $('#join-msg');
      const name = f.full_name.value.trim(), email = f.email.value.trim().toLowerCase();
      if (name.length < 2 || name.length > 120) return msg(out, 'Please enter your full name.', true);
      if (!LK.validEmail(email)) return msg(out, 'Please enter a valid email address.', true);
      if (!f.privacy.checked) return msg(out, 'Please agree to how we use your details to create an account.', true);
      const { error } = await busy($('button[type=submit]', f), () => db.auth.signInWithOtp({ email, options: { shouldCreateUser: true,
        emailRedirectTo: LK.siteUrl + '/account/reset.html?welcome=1', data: { full_name: name, marketing_consent: f.marketing.checked } } }));
      if (error) return msg(out, /rate|too many/i.test(error.message) ? 'Please wait a minute before asking for another email.' : friendly(error.message), true);
      f.hidden = true; $('#join-done').hidden = false; $('#join-email').textContent = email;
    });
    $('#forgot-form').addEventListener('submit', async e => {
      e.preventDefault(); const f = e.target, out = $('#forgot-msg'), email = f.email.value.trim().toLowerCase();
      if (!LK.validEmail(email)) return msg(out, 'Enter a valid email address.', true);
      const { error } = await busy($('button[type=submit]', f), () => db.auth.resetPasswordForEmail(email, { redirectTo: LK.siteUrl + '/account/reset.html' }));
      msg(out, error ? 'We could not send the email right now. Please try again in a minute.' : 'If an account exists for that email, a reset link is on its way.', !!error);
    });
  }

  // ======================= CREATE / RESET PASSWORD =======================
  if (page === 'reset') (async () => {
    const welcome = /welcome=1/.test(location.search);
    const { data: { session } } = await db.auth.getSession();
    if (!session) {
      $('#reset-title').textContent = 'This link has expired';
      msg($('#reset-msg'), (db.auth.urlError ? db.auth.urlError + '. ' : '') + 'Links work once and expire after a while. Request a new one below.', true);
      $('#reset-again').hidden = false; return;
    }
    $('#reset-title').textContent = welcome ? 'Create your password' : 'Choose a new password';
    $('#reset-lead').textContent = welcome ? 'Your email address is confirmed. Choose a password to finish setting up your account. Your email is your login.' : 'Choose a new password for your account.';
    $('#reset-form').hidden = false;
    $('#reset-form').addEventListener('submit', async e => {
      e.preventDefault(); const f = e.target, out = $('#reset-msg');
      if (f.password.value.length < 8) return msg(out, 'Use at least 8 characters.', true);
      if (f.password.value !== f.password2.value) return msg(out, 'The two passwords do not match.', true);
      const { error } = await busy($('button[type=submit]', f), () => db.auth.updateUser({ password: f.password.value }));
      if (error) return msg(out, friendly(error.message), true);
      msg(out, 'Password saved. Opening your account…'); setTimeout(() => (location.href = 'portal.html'), 900);
    });
  })();

  // ======================= PORTAL =======================
  if (page !== 'portal') return;
  const TABS = [['overview', 'Overview'], ['quotes', 'Quotes'], ['orders', 'Orders'], ['invoices', 'Invoices'], ['payments', 'Payments'], ['designs', 'Designs & inspiration'], ['documents', 'Documents'], ['enquiries', 'Enquiries'], ['messages', 'Messages'], ['profile', 'Profile'], ['points', 'Points'], ['privacy', 'Privacy']];
  const STATUS = { draft: 'Draft', sent: 'Awaiting your reply', viewed: 'Awaiting your reply', accepted: 'Accepted', declined: 'Declined', expired: 'Expired', confirmed: 'Confirmed', in_progress: 'In progress',
    awaiting_payment: 'Awaiting payment', paid: 'Paid', completed: 'Completed', cancelled: 'Cancelled', partially_paid: 'Part paid', overdue: 'Overdue', succeeded: 'Received', refunded: 'Refunded', partially_refunded: 'Part refunded', unpaid: 'Unpaid' };
  const pill = s => `<span class="pill ${esc(s)}">${esc(STATUS[s] || s)}</span>`;
  let D = null, me = null; const viewed = new Set();

  const linesTable = (doc) => `<table class="ptbl"><thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Price</th><th class="num">Amount</th></tr></thead><tbody>
    ${doc.lines.map(l => `<tr><td>${esc(l.description)}${l.discount_pence ? `<br><small>Discount ${money(l.discount_pence)}</small>` : ''}</td><td class="num">${+l.quantity}</td><td class="num">${money(l.unit_price_pence)}</td><td class="num">${money(Math.round(l.quantity * l.unit_price_pence) - l.discount_pence)}</td></tr>`).join('')}</tbody>
    <tfoot>${doc.discount_pence ? `<tr><td colspan="3">Discount</td><td class="num">−${money(doc.discount_pence)}</td></tr>` : ''}${D.vat && D.vat.registered !== false ? `<tr><td colspan="3">${D.vat.prices_include_vat !== false ? 'VAT included' : 'VAT'}</td><td class="num">${money(doc.vat_pence)}</td></tr>` : ''}
    <tr class="tot"><td colspan="3">Total</td><td class="num">${money(doc.total_pence)}</td></tr>${doc.amount_paid_pence ? `<tr><td colspan="3">Paid</td><td class="num">−${money(doc.amount_paid_pence)}</td></tr><tr class="tot"><td colspan="3">Balance</td><td class="num">${money(doc.total_pence - doc.amount_paid_pence)}</td></tr>` : ''}</tfoot></table>`;
  const empty = (t, s) => `<div class="pempty"><b>${esc(t)}</b>${s ? `<p>${esc(s)}</p>` : ''}</div>`;

  const RENDER = {
    overview() {
      const openQ = D.quotes.filter(q => ['sent', 'viewed'].includes(q.status)), due = D.invoices.filter(i => ['sent', 'viewed', 'partially_paid', 'overdue'].includes(i.status));
      return `<div class="stats"><a class="stat" href="#quotes"><b>${openQ.length}</b><span>Quotes awaiting you</span></a><a class="stat" href="#invoices"><b>${money(due.reduce((a, i) => a + i.total_pence - i.amount_paid_pence, 0))}</b><span>To pay</span></a>
        <a class="stat" href="#orders"><b>${D.orders.filter(o => !['completed', 'cancelled'].includes(o.status)).length}</b><span>Orders in progress</span></a><a class="stat" href="#points"><b>${D.loyalty.balance.toLocaleString('en-GB')}</b><span>Loyalty points</span></a></div>
        ${new URLSearchParams(location.search).get('paid') ? '<div class="notice ok-n">Thank you for your payment. It will appear here as soon as our payment provider confirms it.</div>' : ''}
        ${openQ.length ? `<h3>Waiting for you</h3>${openQ.map(q => `<a class="prow" href="#quotes"><span><b>Quote ${esc(q.number)}</b>${q.title ? ' · ' + esc(q.title) : ''}<br><small>Valid until ${date(q.expiry_date)}</small></span><span>${money(q.total_pence)}</span></a>`).join('')}` : ''}
        ${due.length ? due.map(i => `<a class="prow" href="#invoices"><span><b>Invoice ${esc(i.number)}</b><br><small>Due ${date(i.due_date)}</small></span><span>${money(i.total_pence - i.amount_paid_pence)} ${pill(i.status)}</span></a>`).join('') : ''}
        <h3>Recent messages</h3>${D.communications.slice(0, 5).map(m => `<div class="prow"><span>${esc(m.summary)}</span><small>${date(m.created_at)}</small></div>`).join('') || empty('Nothing yet')}
        <p style="margin-top:22px"><a class="btn solid" href="#designs">Share a design or inspiration</a> <a class="btn" href="../contact.html">Contact us</a></p>`;
    },
    quotes() {
      return D.quotes.length ? D.quotes.map(q => `<article class="pcard" data-quote="${q.id}"><div class="pch"><div><h3>Quote ${esc(q.number)}</h3><small>${esc(q.title || '')} · ${date(q.issue_date)} · valid until ${date(q.expiry_date)}</small></div>${pill(q.status)}</div>
        ${linesTable(q)}${q.notes ? `<p class="pnote">${esc(q.notes)}</p>` : ''}
        <div class="pact"><button class="btn" data-qpdf="${q.id}">Download PDF</button>${['sent', 'viewed'].includes(q.status) ? `<button class="btn" data-decline="${q.id}">Decline</button><button class="btn solid" data-accept="${q.id}">Accept quote</button>` : ''}</div><p class="msg" hidden></p></article>`).join('')
        : empty('No quotes yet', 'When we prepare a quote for you, it will appear here.');
    },
    orders() {
      return D.orders.length ? D.orders.map(o => `<article class="pcard"><div class="pch"><div><h3>Order ${esc(o.number)}</h3><small>${date(o.order_date)}</small></div><div>${pill(o.status)} ${pill(o.payment_status)}</div></div>${linesTable(o)}${o.notes ? `<p class="pnote">${esc(o.notes)}</p>` : ''}</article>`).join('')
        : empty('No orders yet');
    },
    invoices() {
      return D.invoices.length ? D.invoices.map(i => `<article class="pcard" data-inv="${i.id}"><div class="pch"><div><h3>Invoice ${esc(i.number)}</h3><small>${date(i.issue_date)} · due ${date(i.due_date)}</small></div>${pill(i.status)}</div>${linesTable(i)}${i.notes ? `<p class="pnote">${esc(i.notes)}</p>` : ''}
        <div class="pact"><button class="btn" data-ipdf="${i.id}">Download PDF</button>${i.payment_link_url && i.total_pence > i.amount_paid_pence ? `<a class="btn solid" href="${esc(i.payment_link_url)}" rel="noopener">Pay ${money(i.total_pence - i.amount_paid_pence)} securely</a>` : ''}</div></article>`).join('')
        : empty('No invoices yet');
    },
    payments() {
      return D.payments.length ? D.payments.map(p => `<div class="prow"><span><b>${money(p.amount_pence)}</b> · ${esc(p.method === 'stripe' ? 'Card (online)' : p.method.replace(/_/g, ' '))}${p.invoice_number ? ' · invoice ' + esc(p.invoice_number) : ''}<br><small>${date(p.received_at)}</small>
        ${p.refunds.map(r => `<br><small class="minus">Refund ${money(r.amount_pence)} · ${date(r.refunded_at)}</small>`).join('')}</span>${pill(p.status)}</div>`).join('') : empty('No payments yet');
    },
    designs() {
      const mine = D.documents.filter(d => d.mine);
      return `<div class="pcard"><h3>Share a design or inspiration</h3><p class="muted">Drawings, screenshots, photos of pieces you love, measurements: anything that helps us. Only you and the LK Jewellers team can see them.</p>
        <form id="upf" class="form-grid"><label>Type<select name="kind"><option value="customer_design">My design or drawing</option><option value="inspiration">Inspiration</option><option value="customer_document">Measurements or other document</option></select></label>
        ${D.enquiries.length ? `<label>About<select name="lead"><option value="">General</option>${D.enquiries.map(e => `<option value="${e.id}">${esc(e.subject || e.ref)}</option>`).join('')}</select></label>` : ''}
        <label class="full">Note <em>(optional)</em><textarea name="note" rows="2" maxlength="2000" placeholder="e.g. Like this, but in rose gold with a smaller stone"></textarea></label>
        <div class="full upbtns"><label class="btn">Take a photo<input type="file" accept="image/*" capture="environment" hidden data-files></label><label class="btn">Choose files<input type="file" accept="image/*,application/pdf" multiple hidden data-files></label></div></form>
        <div id="upq"></div></div>
        <h3>Your uploads</h3>${mine.length ? `<div class="pgrid">${mine.map(d => `<a class="ptile" href="#" data-file="${esc(d.path)}">${/^image\//.test(d.mime || '') ? `<img data-thumb="${esc(d.path)}" alt="">` : '<span class="doc">PDF</span>'}<span><b>${esc(d.filename || 'File')}</b><small>${date(d.created_at)}</small>${d.note ? `<small>${esc(d.note)}</small>` : ''}</span></a>`).join('')}</div>` : empty('Nothing uploaded yet')}`;
    },
    documents() {
      const shared = D.documents.filter(d => !d.mine);
      return shared.length ? `<div class="pgrid">${shared.map(d => `<a class="ptile" href="#" data-file="${esc(d.path)}">${/^image\//.test(d.mime || '') ? `<img data-thumb="${esc(d.path)}" alt="">` : '<span class="doc">PDF</span>'}<span><b>${esc(d.title || d.filename || 'Document')}</b><small>${date(d.created_at)}</small></span></a>`).join('')}</div>`
        : empty('No documents yet', 'Certificates, valuations and other documents we share with you appear here.');
    },
    enquiries() { return D.enquiries.length ? D.enquiries.map(e => `<div class="prow"><span><b>${esc(e.subject || 'Enquiry ' + e.ref)}</b><br><small>${date(e.created_at)} · ${esc((e.message || '').slice(0, 120))}</small></span><span class="pill">${esc(e.status)}</span></div>`).join('') : empty('No enquiries', 'Use our contact page to start a conversation.'); },
    messages() { return D.communications.length ? `<ul class="ptl">${D.communications.map(m => `<li>${esc(m.summary)}<small>${date(m.created_at)}</small></li>`).join('')}</ul>` : empty('No messages yet'); },
    profile() {
      const p = D.profile;
      return `<form id="profile-form" class="pcard form-grid" novalidate><p class="muted full">Login email: <b>${esc(p.email)}</b> · customer reference ${esc(p.ref)}</p>
        <label>First name<input name="first_name" value="${esc(p.first_name)}" maxlength="80"></label><label>Last name<input name="last_name" value="${esc(p.last_name)}" maxlength="80"></label>
        <label>Phone<input name="phone" type="tel" value="${esc(p.phone || '')}"></label><label>Company <em>(optional)</em><input name="company" value="${esc(p.company || '')}"></label>
        <label class="full">Address line 1<input name="address_line1" value="${esc(p.address_line1 || '')}" maxlength="120"></label><label class="full">Address line 2<input name="address_line2" value="${esc(p.address_line2 || '')}" maxlength="120"></label>
        <label>Town / city<input name="city" value="${esc(p.city || '')}" maxlength="80"></label><label>County<input name="county" value="${esc(p.county || '')}" maxlength="80"></label>
        <label>Postcode<input name="postcode" value="${esc(p.postcode || '')}" maxlength="12"></label><label>Country<input name="country" value="${esc(p.country || 'United Kingdom')}" maxlength="60"></label>
        <label class="check full"><input type="checkbox" name="marketing_consent" ${p.marketing_consent ? 'checked' : ''}><span>Send me news and offers</span></label>
        <div class="full"><button class="btn solid" type="submit">Save</button> <a class="btn" href="reset.html">Change password</a></div><p class="msg full" id="profile-msg" hidden></p></form>`;
    },
    points() {
      const L = D.loyalty;
      return `<div class="pcard"><div class="bal">${L.balance.toLocaleString('en-GB')}</div><p class="muted">points · 100 points = ${money(100)} off</p>
        <form id="redeem-form" class="inline"><input name="points" type="number" min="100" step="100" placeholder="e.g. 500" aria-label="Points to use"><button class="btn solid" type="submit">Get a discount code</button></form><p class="msg" id="redeem-msg" hidden></p></div>
        <h3>Your codes</h3>${L.codes.length ? L.codes.map(c => `<div class="prow"><span><b>${esc(c.code)}</b> · ${money(c.value_pence)} off</span><span class="pill">${c.used ? 'Used' : 'Available'}</span></div>`).join('') : empty('No codes yet')}
        <h3>History</h3>${L.history.length ? L.history.map(h => `<div class="prow"><span>${esc(h.reason)}<br><small>${date(h.created_at)}</small></span><b class="${h.points > 0 ? 'plus' : 'minus'}">${h.points > 0 ? '+' : ''}${h.points}</b></div>`).join('') : empty('You earn points every time an order is paid')}`;
    },
    privacy() {
      return `<div class="pcard"><h3>Your data</h3><p class="muted">Download everything we hold about you. Financial records (orders and invoices) are kept without your personal details if you delete your account, because the law requires it.</p><button class="btn" id="export-btn">Download my data</button></div>
        <form id="delete-form" class="pcard" novalidate><h3>Delete my account</h3><p class="muted">This cannot be undone.</p><label>Type DELETE to confirm<input name="confirm" autocomplete="off"></label><button class="btn" type="submit">Delete my account</button><p class="msg" id="delete-msg" hidden></p></form>`;
    }
  };

  async function load() {
    const r = await db.rpc('portal_data'); if (r.error) throw new Error(r.error.message); D = r.data;
  }
  function draw() {
    const tab = (location.hash.slice(1) || 'overview').split('?')[0]; const t = TABS.find(x => x[0] === tab) ? tab : 'overview';
    $('#ptabs').innerHTML = TABS.map(([k, l]) => `<a href="#${k}" class="${k === t ? 'on' : ''}">${esc(l)}</a>`).join('');
    $('#pbody').innerHTML = RENDER[t]();
    bind(t);
  }
  function bind(t) {
    const body = $('#pbody');
    // Mark quotes / invoices as viewed when the customer opens that tab
    if (t === 'quotes') D.quotes.filter(q => q.status === 'sent' && !viewed.has(q.id)).forEach(q => { viewed.add(q.id); db.rpc('portal_view', { p_kind: 'quote', p_id: q.id }); });
    if (t === 'invoices') D.invoices.filter(i => i.status === 'sent' && !viewed.has(i.id)).forEach(i => { viewed.add(i.id); db.rpc('portal_view', { p_kind: 'invoice', p_id: i.id }); });
    $$('[data-accept],[data-decline]', body).forEach(b => b.onclick = async () => {
      const acc = !!b.dataset.accept, id = b.dataset.accept || b.dataset.decline, q = D.quotes.find(x => x.id === id), out = $('.msg', b.closest('.pcard'));
      let note = null;
      if (acc) { if (!confirm(`Accept quote ${q.number} for ${money(q.total_pence)}?`)) return; }
      else { note = prompt('Would you like to tell us why? (optional)', ''); if (note === null) return; }
      const { error } = await busy(b, () => db.rpc('portal_respond_quote', { p_id: id, p_accept: acc, p_note: note || null }));
      if (error) return msg(out, error.message, true);
      toast(acc ? 'Thank you. We will be in touch to arrange the next steps.' : 'Thank you for letting us know.'); await load(); draw();
    });
    const pdf = (kind, id) => { const d = (kind === 'quote' ? D.quotes : D.invoices).find(x => x.id === id);
      try { const blob = window.LKPDF.build({ kind, doc: d, lines: d.lines, customer: D.profile, business: D.business || {}, vat: D.vat }); window.LKPDF.download(blob, d.number + '.pdf'); }
      catch (e) { toast('The PDF could not be created. Please try again.', true); } };
    $$('[data-qpdf]', body).forEach(b => b.onclick = () => pdf('quote', b.dataset.qpdf));
    $$('[data-ipdf]', body).forEach(b => b.onclick = () => pdf('invoice', b.dataset.ipdf));
    // Private files: short-lived signed links, only for the customer's own folder
    $$('[data-file]', body).forEach(a => a.onclick = async e => { e.preventDefault(); const w = window.open('', '_blank');
      const r = await db.storage.from('customer-files').createSignedUrl(a.dataset.file, 120); if (r.error) { if (w) w.close(); return toast('That file could not be opened.', true); } if (w) w.location = r.data.signedUrl; else location.href = r.data.signedUrl; });
    $$('img[data-thumb]', body).forEach(async img => { const r = await db.storage.from('customer-files').createSignedUrl(img.dataset.thumb, 600); if (!r.error) img.src = r.data.signedUrl; });
    // Uploads (with retry if anything fails)
    $$('[data-files]', body).forEach(inp => inp.onchange = () => { upload([...inp.files]); inp.value = ''; });
    const pf = $('#profile-form', body); if (pf) pf.onsubmit = async e => {
      e.preventDefault(); const f = e.target, out = $('#profile-msg');
      const v = {}; ['first_name', 'last_name', 'phone', 'company', 'address_line1', 'address_line2', 'city', 'county', 'postcode', 'country'].forEach(k => v[k] = f[k].value.trim()); v.marketing_consent = f.marketing_consent.checked;
      if (!v.first_name) return msg(out, 'Please enter your first name.', true);
      if (v.phone && !/^[0-9+()\s-]{6,20}$/.test(v.phone)) return msg(out, 'That phone number does not look right.', true);
      const { error } = await busy($('button[type=submit]', f), () => db.rpc('portal_update_profile', { p: v }));
      if (error) return msg(out, error.message, true); await load(); draw(); toast('Your details have been saved.');
    };
    const rf = $('#redeem-form', body); if (rf) rf.onsubmit = async e => {
      e.preventDefault(); const n = parseInt(e.target.points.value, 10), out = $('#redeem-msg');
      if (!(n >= 100) || n % 100) return msg(out, 'Use points in multiples of 100.', true);
      if (n > D.loyalty.balance) return msg(out, 'You do not have that many points.', true);
      const { data, error } = await busy($('button', e.target), () => db.rpc('redeem_points', { p_points: n }));
      if (error) return msg(out, error.message, true); await load(); draw(); toast(`Your code ${data.code} is worth ${money(data.value_pence)}. Quote it when you order.`);
    };
    const ex = $('#export-btn', body); if (ex) ex.onclick = async () => { const { data, error } = await db.rpc('export_my_data'); if (error) return toast(error.message, true);
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); a.download = 'my-lk-jewellers-data.json'; a.click(); };
    const df = $('#delete-form', body); if (df) df.onsubmit = async e => { e.preventDefault(); const out = $('#delete-msg');
      if (e.target.confirm.value.trim() !== 'DELETE') return msg(out, 'Type DELETE in capital letters to confirm.', true);
      const { error } = await db.rpc('delete_my_account'); if (error) return msg(out, error.message, true);
      await db.auth.signOut(); location.href = 'index.html?deleted=1'; };
  }
  const failed = [];
  async function upload(files) {
    const f = $('#upf'); if (!f) return; const q = $('#upq');
    const kind = f.kind.value, note = f.note.value.trim(), lead = f.lead ? f.lead.value : '';
    for (const file of files) {
      const row = document.createElement('div'); row.className = 'prow'; row.innerHTML = `<span>${esc(file.name)}</span><small>Uploading…</small>`; q.appendChild(row);
      try {
        if (file.size > 25 * 1024 * 1024) throw new Error('This file is larger than 25 MB.');
        const path = `${D.profile.id}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}-${file.name.replace(/[^\w.\-]+/g, '_').slice(-80)}`;
        const up = await db.storage.from('customer-files').upload(path, file, { contentType: file.type || 'application/octet-stream' });
        if (up.error) throw new Error(up.error.message);
        const reg = await db.rpc('portal_register_upload', { p_path: path, p_filename: file.name, p_mime: file.type, p_size: file.size, p_kind: kind, p_note: note || null, p_lead: lead || null });
        if (reg.error) throw new Error(reg.error.message);
        row.querySelector('small').textContent = 'Uploaded ✓';
      } catch (e) {
        row.querySelector('small').innerHTML = `<span class="minus">Not uploaded: ${esc(friendly(e.message))}</span> <button class="linkbtn" type="button">Retry</button>`;
        row.querySelector('button').onclick = () => { row.remove(); upload([file]); };
        failed.push(file);
      }
    }
    await load(); const keep = q.innerHTML; draw(); const q2 = $('#upq'); if (q2) q2.innerHTML = keep;
    $$('#upq .prow button').forEach((b, i) => { b.onclick = () => { b.closest('.prow').remove(); upload([failed[i]]); }; });
  }

  (async () => {
    const { data: { session } } = await db.auth.getSession();
    if (!session) return location.replace('index.html');
    const act = await db.rpc('portal_activate');
    if (act.error) {
      root.innerHTML = `<div class="notice"><b>${esc(act.error.message)}</b><p>If you think this is a mistake, please <a href="../contact.html">contact us</a>.</p><button class="btn" id="so">Sign out</button></div>`;
      $('#so').onclick = async () => { await db.auth.signOut(); location.href = 'index.html'; }; return;
    }
    me = act.data;
    if (!me.welcomed && LK.workerReady) LK.worker('/notify/welcome', {}).catch(() => {});
    try { await load(); } catch (e) { root.innerHTML = `<div class="notice">We could not load your account: ${esc(friendly(e.message))} <button class="btn" onclick="location.reload()">Try again</button></div>`; return; }
    $('#welcome').textContent = me.first_name ? 'Welcome back, ' + me.first_name : 'Welcome back';
    if (me.first_time) $('#welcome').textContent = 'Welcome' + (me.first_name ? ', ' + me.first_name : '');
    $('#signout').onclick = async () => { await db.auth.signOut(); location.href = 'index.html'; };
    $('#pshell').hidden = false; $('#ploading').hidden = true;
    // Fresh data each time a section is opened, so statuses (paid, accepted…) are always current.
    addEventListener('hashchange', async () => { try { await load(); } catch (e) { /* keep last good data */ } draw(); scrollTo({ top: $('#ptabs').offsetTop - 100 }); });
    draw();
  })();
})();
