/* =====================================================================
   LK Studio core: connection, sign-in, permissions, navigation, and the
   shared building blocks every screen uses (templates, dialogs, toasts,
   loading / empty / error states, uploads, formatting).
   ===================================================================== */
(function () {
  'use strict';
  const S = (window.S = { views: {}, routes: [], cache: {} });
  const C = window.LK_CONFIG || {};
  const real = v => !!v && !/YOUR_/.test(v);
  S.configured = real(C.SUPABASE_URL) && real(C.SUPABASE_ANON_KEY);
  S.workerUrl = real(C.WORKER_URL) ? C.WORKER_URL.replace(/\/$/, '') : null;
  S.siteUrl = (real(C.SITE_URL) ? C.SITE_URL : location.origin + location.pathname.replace(/\/studio\/.*$/, '')).replace(/\/$/, '');
  S.db = S.configured ? window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY) : null;

  // ---------------- templating (every value is escaped unless wrapped in S.raw) ----------------
  const RAW = '__raw';
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  S.esc = s => esc(s == null ? '' : s);
  S.raw = s => ({ [RAW]: s == null ? '' : String(s) });
  const val = v => v == null || v === false ? '' : Array.isArray(v) ? v.map(val).join('') : typeof v === 'object' && RAW in v ? v[RAW] : esc(v);
  S.html = (strings, ...vals) => S.raw(strings.reduce((a, s, i) => a + s + (i < vals.length ? val(vals[i]) : ''), ''));
  S.render = (el, tpl) => { el.innerHTML = typeof tpl === 'string' ? esc(tpl) : val(tpl); return el; };
  S.$ = (sel, root = document) => root.querySelector(sel);
  S.$$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  // Delegated events. Re-binding the same selector on the same element replaces the old handler,
  // so screens that redraw themselves never end up running an action twice.
  S.on = (root, sel, ev, fn) => {
    root._lk = root._lk || {}; const key = ev + '|' + sel;
    if (root._lk[key]) root.removeEventListener(ev, root._lk[key]);
    const h = e => { const t = e.target.closest(sel); if (t && root.contains(t)) fn(e, t); };
    root._lk[key] = h; root.addEventListener(ev, h);
  };

  // ---------------- icons (thin line set) ----------------
  const P = {
    home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
    users: 'M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM20 20v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 4.15a3.5 3.5 0 0 1 0 6.7',
    gem: 'M6 3h12l3 5-9 13L3 8zM3 8h18M9.5 3 8 8l4 13 4-13-1.5-5',
    bag: 'M5 8h14l-1 12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1zM9 8V6a3 3 0 0 1 6 0v2',
    more: 'M5 12h.01M12 12h.01M19 12h.01',
    inbox: 'M3 13h5l1.5 3h5L16 13h5M5 5h14l2 8v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6z',
    quote: 'M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM14 3v5h5M9 13h6M9 17h4',
    receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3',
    card: 'M3 6h18v12H3zM3 10h18M7 15h3',
    chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
    target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM12 12h.01',
    task: 'M4 5h16v14H4zM8 12l2.5 2.5L16 9',
    note: 'M5 3h10l4 4v14H5zM15 3v4h4M8 12h8M8 16h5',
    folder: 'M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z',
    truck: 'M3 6h11v10H3zM14 9h4l3 3v4h-7M7.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM17.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z',
    cart: 'M3 4h2l2.5 11h10L20 7H6.5M9 20h.01M17 20h.01',
    settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z',
    bell: 'M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0',
    search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.35-4.35',
    plus: 'M12 5v14M5 12h14', camera: 'M3 8a2 2 0 0 1 2-2h2l2-3h6l2 3h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
    upload: 'M12 16V4M7 9l5-5 5 5M4 20h16', trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
    edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4', back: 'M15 18l-6-6 6-6', chev: 'M9 18l6-6-6-6', x: 'M18 6 6 18M6 6l12 12',
    check: 'M20 6 9 17l-5-5', star: 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z',
    up: 'M12 19V5M5 12l7-7 7 7', down: 'M12 5v14M5 12l7 7 7-7', left: 'M19 12H5M12 19l-7-7 7-7', right: 'M5 12h14M12 5l7 7-7 7',
    alert: 'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
    link: 'M10 14a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 10a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7',
    mail: 'M3 5h18v14H3zM3 6l9 7 9-7', phone: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z',
    eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z', lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
    refresh: 'M21 12a9 9 0 1 1-2.6-6.4M21 3v6h-6', download: 'M12 4v12M7 11l5 5 5-5M4 20h16', external: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
    image: 'M3 5h18v14H3zM8.5 11a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM21 16l-5-5L5 19', file: 'M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM14 3v5h5',
    pound: 'M17 20H7c2-1.5 2.5-3.5 2.5-6V8.5A3.5 3.5 0 0 1 16 7M6 13h8', clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2',
    send: 'M22 2 11 13M22 2l-7 20-4-9-9-4z', shield: 'M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z', logout: 'M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l5-5-5-5M15 12H3',
    sparkle: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6', copy: 'M8 8h12v12H8zM16 8V4H4v12h4',
    grip: 'M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01', calendar: 'M4 5h16v16H4zM4 10h16M9 3v4M15 3v4', pin: 'M12 17v5M5 17h14l-2-6V4H7v7z'
  };
  S.icon = (n, cls) => S.raw(`<svg class="${cls || ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${P[n] || P.file}"/></svg>`);

  // ---------------- formatting ----------------
  S.money = (p, opts) => p == null || isNaN(p) ? '—' : (p < 0 ? '−' : '') + '£' + (Math.abs(p) / 100).toLocaleString('en-GB', { minimumFractionDigits: opts && opts.whole ? 0 : 2, maximumFractionDigits: opts && opts.whole ? 0 : 2 });
  S.moneyShort = p => p == null ? '—' : Math.abs(p) >= 100000000 ? '£' + (p / 100000000).toFixed(1) + 'm' : Math.abs(p) >= 1000000 ? '£' + (p / 100000).toFixed(1) + 'k' : S.money(p, { whole: true });
  S.pence = v => { const t = String(v == null ? '' : v).replace(/[£,\s]/g, ''); if (t === '') return null; return /^-?\d{1,9}(\.\d{1,2})?$/.test(t) ? Math.round(parseFloat(t) * 100) : NaN; };
  S.pounds = p => p == null ? '' : (p / 100).toFixed(2);
  S.date = d => d ? new Date(d.length === 10 ? d + 'T12:00:00' : d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  S.dateTime = d => d ? new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
  S.ago = d => {
    if (!d) return '—'; const s = (Date.now() - new Date(d)) / 1000;
    if (s < -60) { const f = -s; return f < 3600 ? 'in ' + Math.round(f / 60) + ' min' : f < 86400 ? 'in ' + Math.round(f / 3600) + ' h' : 'in ' + Math.round(f / 86400) + ' days'; }
    return s < 60 ? 'just now' : s < 3600 ? Math.floor(s / 60) + ' min ago' : s < 86400 ? Math.floor(s / 3600) + ' h ago' : s < 172800 ? 'yesterday' : s < 2592000 ? Math.floor(s / 86400) + ' days ago' : S.date(d);
  };
  S.isoDate = d => { const x = d ? new Date(d) : new Date(); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
  S.pct = v => v == null ? '—' : (Math.round(v * 10) / 10).toLocaleString('en-GB') + '%';
  S.name = c => c ? (`${c.first_name || ''} ${c.last_name || ''}`.trim() || c.email || c.ref || 'Unnamed') : '—';
  S.initials = n => String(n || '?').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  S.label = s => String(s || '').replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());

  // Status vocabularies: label + colour, so every screen speaks the same language.
  const ST = {
    product: { draft: ['Draft', 'grey'], ready_for_review: ['Ready for review', 'amber'], owner_review: ['Owner review', 'violet'], changes_requested: ['Changes requested', 'red'],
      rejected: ['Rejected', 'red'], approved: ['Approved', 'blue'], published: ['Published', 'green'], unpublished: ['Unpublished', 'grey'], archived: ['Archived', 'grey'] },
    lead: { new: ['New', 'amber'], contact_required: ['Contact required', 'red'], contacted: ['Contacted', 'blue'], discussion: ['Discussion', 'violet'],
      quote_sent: ['Quote sent', 'blue'], awaiting_customer: ['Awaiting customer', 'amber'], won: ['Won', 'green'], lost: ['Lost', 'grey'] },
    quote: { draft: ['Draft', 'grey'], sent: ['Sent', 'blue'], viewed: ['Viewed', 'violet'], accepted: ['Accepted', 'green'], declined: ['Declined', 'red'], expired: ['Expired', 'grey'] },
    order: { draft: ['Draft', 'grey'], confirmed: ['Confirmed', 'blue'], in_progress: ['In progress', 'violet'], awaiting_payment: ['Awaiting payment', 'amber'], paid: ['Paid', 'green'], completed: ['Completed', 'green'], cancelled: ['Cancelled', 'grey'] },
    invoice: { draft: ['Draft', 'grey'], sent: ['Sent', 'blue'], viewed: ['Viewed', 'violet'], partially_paid: ['Partially paid', 'amber'], paid: ['Paid', 'green'], overdue: ['Overdue', 'red'], cancelled: ['Cancelled', 'grey'] },
    payment: { succeeded: ['Received', 'green'], failed: ['Failed', 'red'], refunded: ['Refunded', 'grey'], partially_refunded: ['Part refunded', 'amber'] },
    paystatus: { unpaid: ['Unpaid', 'amber'], partially_paid: ['Part paid', 'amber'], paid: ['Paid', 'green'], refunded: ['Refunded', 'grey'], partially_refunded: ['Part refunded', 'amber'] },
    account: { none: ['Account not created', 'grey'], invited: ['Invitation sent', 'blue'], expired: ['Invitation expired', 'amber'], active: ['Account active', 'green'], disabled: ['Disabled', 'red'] },
    customer: { prospect: ['Prospect', 'amber'], active: ['Active', 'green'], vip: ['VIP', 'violet'], inactive: ['Inactive', 'grey'] },
    task: { open: ['Open', 'blue'], done: ['Done', 'green'], cancelled: ['Cancelled', 'grey'] },
    priority: { low: ['Low', 'grey'], normal: ['Normal', 'blue'], high: ['High', 'red'] },
    purchase: { draft: ['Draft – not checked', 'amber'], confirmed: ['Confirmed', 'green'] },
    ocr: { none: ['Not read', 'grey'], pending: ['Reading…', 'blue'], read: ['Read – needs checking', 'amber'], failed: ['Could not read', 'red'], confirmed: ['Checked', 'green'] }
  };
  S.ST = ST;
  S.pill = (kind, v) => { const s = (ST[kind] || {})[v] || [S.label(v), 'grey']; return S.html`<span class="pill ${s[1]}">${s[0]}</span>`; };
  S.statusLabel = (kind, v) => ((ST[kind] || {})[v] || [S.label(v)])[0];

  // ---------------- data ----------------
  // Throws a friendly Error when Supabase reports a problem.
  S.must = r => { if (r && r.error) { const e = new Error(S.friendly(r.error.message)); e.raw = r.error; throw e; } return r ? r.data : null; };
  S.friendly = m => {
    m = String(m || 'Something went wrong');
    if (/JWT expired|invalid jwt|not signed in/i.test(m)) return 'Your session has ended. Please sign in again.';
    if (/row-level security|permission denied/i.test(m)) return 'You do not have permission to do that.';
    if (/duplicate key.*customers_email/i.test(m)) return 'A customer with this email address already exists.';
    if (/duplicate key.*sku/i.test(m)) return 'Another product already uses this SKU.';
    if (/Failed to fetch|Could not reach/i.test(m)) return 'Could not reach the server. Check your connection and try again.';
    return m.replace(/^ERROR:\s*/, '');
  };
  S.rpc = async (fn, args) => S.must(await S.db.rpc(fn, args || {}));

  // Calls to the Cloudflare Worker (things that need secret keys)
  S.worker = async (path, body) => {
    if (!S.workerUrl) { const e = new Error('MANUAL CONFIGURATION REQUIRED: the Cloudflare Worker is not connected yet (WORKER_URL in js/config.js).'); e.config = true; throw e; }
    const { data: { session } } = await S.db.auth.getSession();
    let r;
    try { r = await fetch(S.workerUrl + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (session ? session.access_token : '') }, body: JSON.stringify(body || {}) }); }
    catch (x) { const e = new Error('Could not reach the Cloudflare Worker. Check your connection or the Worker address.'); e.network = true; throw e; }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.error || 'Request failed'); e.config = !!j.config || r.status === 503; e.status = r.status; throw e; }
    return j;
  };
  S.integrations = async (force) => {
    if (S.cache.integ && !force) return S.cache.integ;
    let st = { worker: false, email: false, ocr: false, stripe: false, stripe_webhook: false };
    if (S.workerUrl) { try { st = Object.assign({ worker: true }, await S.worker('/status')); } catch (e) { st.workerError = e.message; } }
    return (S.cache.integ = st);
  };

  // Files
  S.signedUrl = async (bucket, path, secs) => S.must(await S.db.storage.from(bucket).createSignedUrl(path, secs || 300)).signedUrl;
  S.openFile = async (bucket, path) => {
    const w = window.open('', '_blank');
    try { const u = await S.signedUrl(bucket, path, 120); if (w) w.location = u; else location.href = u; }
    catch (e) { if (w) w.close(); S.toast('The file could not be opened: ' + e.message, { bad: true }); }
  };
  S.publicImg = path => path ? S.db.storage.from('product-images').getPublicUrl(path).data.publicUrl : '';
  S.uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2));
  S.safeName = n => String(n || 'file').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.\-]+/g, '_').slice(-80);
  // Photos: keep them sharp. Only very large images are scaled (to 2400px) at high quality.
  S.prepareImage = async (file, max = 2400, quality = 0.92) => {
    if (!/^image\//.test(file.type)) return { blob: file, type: file.type || 'application/octet-stream', ext: (file.name.split('.').pop() || 'bin').toLowerCase() };
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      const big = Math.max(bmp.width, bmp.height);
      if (big <= max && /jpe?g|png|webp/.test(file.type) && file.size < 6e6) return { blob: file, type: file.type, ext: file.type.split('/')[1].replace('jpeg', 'jpg') };
      const k = Math.min(1, max / big), c = document.createElement('canvas');
      c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
      const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(bmp, 0, 0, c.width, c.height);
      const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', quality));
      if (!blob) throw new Error('canvas');
      return { blob, type: 'image/jpeg', ext: 'jpg' };
    } catch (e) { return { blob: file, type: file.type, ext: (file.name.split('.').pop() || 'jpg').toLowerCase() }; }   // e.g. HEIC on some browsers: upload as is
  };
  S.upload = async (bucket, path, blob, type) => { S.must(await S.db.storage.from(bucket).upload(path, blob, { contentType: type, cacheControl: 31536000 })); return path; };

  // ---------------- UI: states ----------------
  S.loading = (rows = 4) => S.html`<div class="loading" aria-busy="true"><div class="skel h"></div>${Array.from({ length: rows }, () => S.raw('<div class="skel"></div>'))}</div>`;
  S.empty = ({ icon = 'sparkle', title, text, action } = {}) => S.html`<div class="state"><div class="ill">${S.icon(icon)}</div><h3>${title || 'Nothing here yet'}</h3>${text ? S.html`<p>${text}</p>` : ''}${action || ''}</div>`;
  S.errorState = (msg, retryId) => S.html`<div class="state err"><div class="ill">${S.icon('alert')}</div><h3>Something went wrong</h3><p>${msg}</p>${retryId ? S.html`<button class="btn" id="${retryId}">${S.icon('refresh')} Try again</button>` : ''}</div>`;
  S.configBanner = (msg) => S.html`<div class="banner config">${S.icon('settings')}<div><b>Manual configuration required</b>${msg}</div></div>`;
  S.banner = (kind, title, body) => S.html`<div class="banner ${kind}">${S.icon(kind === 'good' ? 'check' : kind === 'info' ? 'eye' : 'alert')}<div><b>${title}</b>${body || ''}</div></div>`;

  // ---------------- UI: toast ----------------
  S.toast = (msg, opts = {}) => {
    const box = S.$('#toasts'); const t = document.createElement('div');
    t.className = 'toast' + (opts.bad ? ' bad' : '');
    S.render(t, S.html`${S.icon(opts.bad ? 'alert' : 'check')}<span>${msg}</span>${opts.retry ? S.html`<button type="button">Retry</button>` : ''}`);
    if (opts.retry) S.$('button', t).onclick = () => { t.remove(); opts.retry(); };
    box.appendChild(t); setTimeout(() => t.remove(), opts.retry ? 9000 : opts.bad ? 6500 : 3200);
  };

  // ---------------- UI: sheets / dialogs ----------------
  S.sheet = ({ title, body, foot, wide, onClose }) => {
    const v = document.createElement('div'); v.className = 'veil'; v.setAttribute('role', 'dialog'); v.setAttribute('aria-modal', 'true'); v.setAttribute('aria-label', title || 'Dialog');
    S.render(v, S.html`<div class="sheet ${wide ? 'wide' : ''}"><div class="grab"></div><div class="sh"><h2>${title || ''}</h2><button class="iconbtn" data-close aria-label="Close">${S.icon('x')}</button></div>
      <div class="sb">${body || ''}</div>${foot ? S.html`<div class="sf">${foot}</div>` : ''}</div>`);
    const prev = document.activeElement;
    const close = () => { v.remove(); document.removeEventListener('keydown', key); if (prev && prev.focus) prev.focus(); onClose && onClose(); };
    const key = e => { if (e.key === 'Escape') close(); };
    v.addEventListener('mousedown', e => { if (e.target === v) close(); });
    S.on(v, '[data-close]', 'click', close);
    document.addEventListener('keydown', key);
    document.body.appendChild(v);
    setTimeout(() => { const f = S.$('input:not([type=hidden]),select,textarea', v) || S.$('.sf .btn', v); if (f && window.innerWidth > 820) f.focus(); }, 30);
    return { el: v, body: S.$('.sb', v), close };
  };
  S.confirm = ({ title = 'Are you sure?', message = '', confirm = 'Confirm', danger = false, typed } = {}) => new Promise(res => {
    let done = false;
    const s = S.sheet({ title, body: S.html`<p class="muted" style="margin-top:0">${message}</p>${typed ? S.html`<label class="fld"><span>Type <b>${typed}</b> to confirm</span><input id="typed" autocomplete="off"></label>` : ''}`,
      foot: S.html`<button class="btn ghost" data-close>Cancel</button><button class="btn ${danger ? 'danger' : 'gold'}" id="ok">${confirm}</button>`, onClose: () => { if (!done) res(false); } });
    S.$('#ok', s.el).onclick = () => {
      if (typed && S.$('#typed', s.el).value.trim() !== typed) { S.$('#typed', s.el).closest('.fld').classList.add('err'); return; }
      done = true; res(true); s.close();
    };
  });
  S.ask = ({ title, label, placeholder, required = true, confirm = 'Save', value = '' }) => new Promise(res => {
    let done = false;
    const s = S.sheet({ title, body: S.html`<label class="fld"><span>${label}</span><textarea id="ask" placeholder="${placeholder || ''}">${value}</textarea><small class="errmsg" hidden>Please fill this in.</small></label>`,
      foot: S.html`<button class="btn ghost" data-close>Cancel</button><button class="btn gold" id="ok">${confirm}</button>`, onClose: () => { if (!done) res(null); } });
    S.$('#ok', s.el).onclick = () => { const v = S.$('#ask', s.el).value.trim(); if (required && !v) { S.$('.errmsg', s.el).hidden = false; return; } done = true; s.close(); res(v); };
  });
  // Busy state for a button while an async action runs; returns the action's result.
  S.busy = async (btn, fn) => { if (btn) { btn.classList.add('busy'); btn.disabled = true; } try { return await fn(); } finally { if (btn) { btn.classList.remove('busy'); btn.disabled = false; } } };
  // Run an action with a friendly error toast (and optional retry).
  S.act = async (btn, fn, okMsg) => {
    try { const r = await S.busy(btn, fn); if (okMsg) S.toast(okMsg); return r; }
    catch (e) { if (!e.config) console.error(e); if (e.config) S.configDialog(e.message); else S.toast(S.friendly(e.message), { bad: true, retry: () => S.act(btn, fn, okMsg) }); throw e; }
  };
  S.configDialog = (msg) => S.sheet({ title: 'Manual configuration required', body: S.html`${S.configBanner(msg.replace(/^MANUAL CONFIGURATION REQUIRED:\s*/i, ''))}
    <p class="muted">Nothing was changed. Open <b>Settings → Integrations</b> to see exactly what to connect, then try again.</p>`,
    foot: S.html`<a class="btn" href="#/settings/integrations" data-close>Open Integrations</a><button class="btn gold" data-close>OK</button>` });

  // ---------------- forms ----------------
  S.form = f => { const o = {}; new FormData(f).forEach((v, k) => { o[k] = typeof v === 'string' ? v.trim() : v; }); S.$$('input[type=checkbox]', f).forEach(c => { if (c.name) o[c.name] = c.checked; }); return o; };
  S.fieldErr = (f, name, msg) => { const el = f.elements[name]; if (!el) return; const w = el.closest('.fld'); w.classList.add('err'); let m = S.$('.errmsg', w); if (!m) { m = document.createElement('small'); m.className = 'errmsg'; w.appendChild(m); } m.textContent = msg; m.hidden = false; el.focus(); };
  S.clearErr = f => S.$$('.fld.err', f).forEach(w => { w.classList.remove('err'); const m = S.$('.errmsg', w); if (m) m.hidden = true; });
  S.opts = (list, sel) => list.map(o => { const [v, l] = Array.isArray(o) ? o : [o, S.label(o)]; return S.html`<option value="${v}" ${String(v) === String(sel ?? '') ? 'selected' : ''}>${l}</option>`; });
  S.normPostcode = p => { const t = String(p || '').replace(/\s+/g, '').toUpperCase(); return /^[A-Z]{1,2}[0-9][A-Z0-9]?[0-9][A-Z]{2}$/.test(t) ? t.slice(0, -3) + ' ' + t.slice(-3) : String(p || '').trim(); };
  S.validEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e || '');

  // Record picker (search customers / products / suppliers) used across screens.
  S.pick = ({ title, table, select = '*', search, render, filter }) => new Promise(res => {
    let done = false;
    const s = S.sheet({ title, body: S.html`<div class="toolbar"><div class="search">${S.icon('search')}<input id="pq" placeholder="Search…" autocomplete="off"></div></div><div id="pr">${S.loading(3)}</div>`, onClose: () => { if (!done) res(null); } });
    let t;
    const load = async () => {
      const q = S.$('#pq', s.el).value.trim();
      let b = S.db.from(table).select(select).limit(30);
      if (filter) b = filter(b);
      if (q) b = b.or(search.map(c => `${c}.ilike.*${q.replace(/[,()*]/g, ' ')}*`).join(','));
      const r = await b;
      if (r.error) return S.render(S.$('#pr', s.el), S.errorState(S.friendly(r.error.message)));
      S.render(S.$('#pr', s.el), r.data.length ? S.html`<div class="list">${r.data.map((x, i) => S.html`<button class="li" data-i="${i}">${render(x)}${S.icon('chev', 'chev')}</button>`)}</div>`
        : S.empty({ icon: 'search', title: 'No matches', text: 'Try a different search.' }));
      S.$$('[data-i]', s.el).forEach(b2 => b2.onclick = () => { done = true; s.close(); res(r.data[+b2.dataset.i]); });
    };
    S.$('#pq', s.el).oninput = () => { clearTimeout(t); t = setTimeout(load, 220); };
    load();
  });

  // ---------------- router ----------------
  S.route = (pattern, fn, opts = {}) => {
    const keys = []; const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$');
    S.routes.push({ re, keys, fn, opts });
  };
  S.go = (h) => { if (location.hash === h) S.dispatch(); else location.hash = h; };
  S.params = () => new URLSearchParams((location.hash.split('?')[1]) || '');
  let navToken = 0;
  S.dispatch = async () => {
    const full = location.hash.slice(1) || '/'; const path = full.split('?')[0];
    const old = S.$('#view'); if (!old) return;
    const view = old.cloneNode(false); old.replaceWith(view);      // fresh element: no handlers left over from the previous screen
    const r = S.routes.find(x => x.re.test(path));
    const sect = path.split('/')[1] || '';
    S.$$('[data-nav]').forEach(a => a.classList.toggle('on', a.dataset.nav === sect || (!!a.dataset.alt && !!sect && a.dataset.alt.split(',').includes(sect))));
    window.scrollTo(0, 0);
    if (!r) { S.render(view, S.empty({ icon: 'search', title: 'Page not found', action: S.html`<a class="btn" href="#/">Go home</a>` })); return; }
    if (r.opts.owner && !S.isOwner()) { S.render(view, S.empty({ icon: 'lock', title: 'Owner only', text: 'This area is only available to the owner.' })); return; }
    if (r.opts.finance && !S.canFinance()) { S.render(view, S.empty({ icon: 'lock', title: 'No finance access', text: 'Ask the owner to give you access to financial information.' })); return; }
    const m = path.match(r.re); const p = {}; r.keys.forEach((k, i) => p[k] = decodeURIComponent(m[i + 1]));
    const my = ++navToken;
    S.render(view, S.loading());
    try { await r.fn(view, p, () => my === navToken); }
    catch (e) { console.error(e); if (my === navToken) { S.render(view, S.errorState(S.friendly(e.message), 'retry')); const b = S.$('#retry', view); if (b) b.onclick = S.dispatch; } }
  };
  S.page = ({ title, sub, crumb, acts }) => S.html`<header class="ph"><div>${crumb ? S.html`<div class="crumb"><a href="${crumb[1]}">${S.icon('back')} ${crumb[0]}</a></div>` : ''}<h1>${title}</h1>${sub ? S.html`<div class="sub">${sub}</div>` : ''}</div>${acts ? S.html`<div class="acts">${acts}</div>` : ''}</header>`;

  // ---------------- permissions ----------------
  S.isOwner = () => S.me && S.me.role === 'owner';
  S.canFinance = () => S.me && (S.me.role === 'owner' || S.me.can_view_finance);

  // ---------------- shell ----------------
  const NAV = [
    ['', 'Home', 'home'],
    ['grp', 'Customers'], ['customers', 'Customers', 'users'], ['leads', 'Enquiries', 'inbox'], ['quotes', 'Quotes', 'quote'],
    ['grp', 'Sales'], ['orders', 'Orders', 'bag'], ['invoices', 'Invoices', 'receipt'], ['payments', 'Payments', 'card', 'finance'],
    ['grp', 'Catalogue'], ['products', 'Products', 'gem'], ['suppliers', 'Suppliers', 'truck'], ['purchases', 'Purchasing', 'cart'],
    ['grp', 'Business'], ['finance', 'Finance', 'chart', 'finance'], ['kpis', 'KPIs & targets', 'target'], ['tasks', 'Tasks', 'task'], ['notes', 'Notes', 'note'], ['documents', 'Documents', 'folder'],
    ['grp', 'Studio'], ['settings', 'Settings', 'settings']
  ];
  S.navItems = () => NAV.filter(n => n[0] !== 'grp' && (n[3] !== 'finance' || S.canFinance()));
  function shell() {
    const root = S.$('#root');
    S.render(root, S.html`<div class="shell">
      <aside class="side"><div class="brand"><a class="mark" href="#/"><b>LK <span>Jewellers</span></b><small>London</small><i>Studio</i></a></div>
        <nav aria-label="Main">${NAV.map(n => n[0] === 'grp' ? S.html`<div class="grp">${n[1]}</div>` : (n[3] === 'finance' && !S.canFinance()) ? '' :
          S.html`<a href="#/${n[0]}" data-nav="${n[0]}">${S.icon(n[2])}<span>${n[1]}</span>${n[0] === 'leads' ? S.raw('<b class="count" id="leadcount" hidden></b>') : n[0] === 'products' ? S.raw('<b class="count" id="revcount" hidden></b>') : ''}</a>`)}</nav>
        <div class="me"><span class="avatar">${S.initials(S.me.full_name)}</span><div class="grow"><div>${S.me.full_name || S.me.email}</div><div class="tiny muted">${S.me.role === 'owner' ? 'Owner' : 'Team'}</div></div>
          <button class="iconbtn" id="signout" title="Sign out" aria-label="Sign out">${S.icon('logout')}</button></div></aside>
      <div class="main">
        <div class="top" id="top"><a class="mark mobile-brand" href="#/"><b>LK <span>Studio</span></b><small>London</small></a>
          <button class="searchbox" id="openSearch" type="button" aria-label="Search everything">${S.icon('search')}<span>Search customers, products, orders…</span><kbd>/</kbd></button>
          <button class="iconbtn" id="bell" aria-label="Notifications">${S.icon('bell')}<i class="dot" id="belldot" hidden></i></button>
          <a class="iconbtn" href="../index.html" target="_blank" rel="noopener" title="View website" aria-label="View website">${S.icon('external')}</a></div>
        <main class="view" id="view" tabindex="-1"></main>
      </div>
      <nav class="bottom" aria-label="Quick">
        <a href="#/" data-nav="">${S.icon('home')}<span>Home</span></a>
        <a href="#/customers" data-nav="customers" data-alt="leads">${S.icon('users')}<span>Customers</span><b class="count" id="leadcount2" hidden></b></a>
        <a href="#/products" data-nav="products">${S.icon('gem')}<span>Products</span></a>
        <a href="#/orders" data-nav="orders" data-alt="invoices,quotes">${S.icon('bag')}<span>Orders</span></a>
        <a href="#/more" data-nav="more" data-alt="suppliers,purchases,finance,kpis,tasks,notes,documents,settings,payments,notifications,audit">${S.icon('more')}<span>More</span></a>
      </nav></div>`);
    S.$('#signout').onclick = async () => { if (await S.confirm({ title: 'Sign out?', confirm: 'Sign out' })) { await S.db.auth.signOut(); location.reload(); } };
    S.$('#openSearch').onclick = () => S.openSearch();
    S.$('#bell').onclick = () => S.go('#/notifications');
    document.addEventListener('keydown', e => { if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement.tagName) && !S.$('.veil')) { e.preventDefault(); S.openSearch(); } });
    addEventListener('scroll', () => S.$('#top').classList.toggle('scrolled', scrollY > 4), { passive: true });
    addEventListener('hashchange', S.dispatch);
    S.refreshBadges(); setInterval(() => { if (!document.hidden) S.refreshBadges(); }, 60000);
    S.dispatch();
  }
  S.refreshBadges = async () => {
    try {
      const [n, l, p] = await Promise.all([
        S.db.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null),
        S.db.from('leads').select('id', { count: 'exact', head: true }).eq('stage', 'new').is('deleted_at', null),
        S.isOwner() ? S.db.from('products').select('id', { count: 'exact', head: true }).in('status', ['ready_for_review', 'owner_review']).is('deleted_at', null) : Promise.resolve({ count: 0 })]);
      S.$('#belldot').hidden = !(n.count > 0);
      [['#leadcount', l.count], ['#leadcount2', l.count], ['#revcount', p.count]].forEach(([id, c]) => { const el = S.$(id); if (el) { el.hidden = !c; el.textContent = c > 99 ? '99+' : c; } });
    } catch (e) { /* badges are best-effort */ }
  };

  // ---------------- sign-in screens ----------------
  function authFrame(inner) {
    S.render(S.$('#root'), S.html`<div class="auth"><div class="art"><blockquote>“Every piece begins at the bench, and every client is known by name.”<small>LK Jewellers · London</small></blockquote></div>
      <div class="pane"><div class="box"><span class="mark"><b>LK <span>Jewellers</span></b><small>London</small><i>Studio</i></span>${inner}</div></div></div>`);
  }
  function loginScreen(msg) {
    authFrame(S.html`<h1>Welcome back</h1><p class="lead">Sign in to LK Studio, the private workspace for the LK Jewellers team.</p>
      ${msg ? S.banner(msg.kind || 'bad', msg.title, msg.body) : ''}
      <form class="form" id="lf" novalidate><label class="fld"><span>Email</span><input name="email" type="email" autocomplete="username" required></label>
      <label class="fld"><span>Password</span><input name="password" type="password" autocomplete="current-password" required></label>
      <button class="btn gold block" type="submit">Sign in</button>
      <p class="center small"><button type="button" class="linkbtn" id="forgot">Forgotten your password?</button></p></form>`);
    const f = S.$('#lf');
    f.onsubmit = async e => {
      e.preventDefault(); S.clearErr(f); const v = S.form(f);
      if (!S.validEmail(v.email)) return S.fieldErr(f, 'email', 'Enter your email address');
      if (!v.password) return S.fieldErr(f, 'password', 'Enter your password');
      const btn = S.$('button[type=submit]', f);
      const r = await S.busy(btn, () => S.db.auth.signInWithPassword({ email: v.email.toLowerCase(), password: v.password }));
      if (r.error) return loginScreen({ title: /banned/i.test(r.error.message) ? 'Access switched off' : 'Could not sign in',
        body: /banned/i.test(r.error.message) ? 'Your access to LK Studio has been switched off. Please speak to the owner.' : /confirm/i.test(r.error.message) ? 'Please use the link in your invitation email first.' : 'Check your email and password and try again.' });
      boot();
    };
    S.$('#forgot').onclick = () => forgotScreen();
  }
  function forgotScreen() {
    authFrame(S.html`<h1>Reset password</h1><p class="lead">We will email you a secure link to choose a new password.</p>
      <form class="form" id="ff" novalidate><label class="fld"><span>Email</span><input name="email" type="email" autocomplete="username" required></label>
      <button class="btn gold block" type="submit">Send reset link</button><p class="center small"><button type="button" class="linkbtn" id="back">Back to sign in</button></p></form>`);
    S.$('#back').onclick = () => loginScreen();
    S.$('#ff').onsubmit = async e => {
      e.preventDefault(); const f = e.target; const v = S.form(f); S.clearErr(f);
      if (!S.validEmail(v.email)) return S.fieldErr(f, 'email', 'Enter your email address');
      const r = await S.busy(S.$('button[type=submit]', f), () => S.db.auth.resetPasswordForEmail(v.email.toLowerCase(), { redirectTo: location.origin + location.pathname }));
      if (r.error) return S.toast('The reset email could not be sent: ' + S.friendly(r.error.message), { bad: true });
      loginScreen({ kind: 'good', title: 'Check your email', body: 'If that address belongs to a team member, a reset link is on its way.' });
    };
  }
  function setPasswordScreen(isNew) {
    authFrame(S.html`<h1>${isNew ? 'Create your password' : 'Choose a new password'}</h1><p class="lead">${isNew ? 'Welcome to LK Studio. Choose a password to finish setting up your access.' : 'Choose a new password for LK Studio.'}</p>
      <form class="form" id="pf" novalidate><label class="fld"><span>New password <em>(at least 10 characters)</em></span><input name="p1" type="password" autocomplete="new-password" required></label>
      <label class="fld"><span>Repeat password</span><input name="p2" type="password" autocomplete="new-password" required></label>
      <button class="btn gold block" type="submit">Save and continue</button></form>`);
    S.$('#pf').onsubmit = async e => {
      e.preventDefault(); const f = e.target, v = S.form(f); S.clearErr(f);
      if (v.p1.length < 10) return S.fieldErr(f, 'p1', 'Use at least 10 characters');
      if (v.p1 !== v.p2) return S.fieldErr(f, 'p2', 'The passwords do not match');
      const r = await S.busy(S.$('button[type=submit]', f), () => S.db.auth.updateUser({ password: v.p1 }));
      if (r.error) return S.toast(S.friendly(r.error.message), { bad: true });
      S.toast('Password saved'); history.replaceState(null, '', location.pathname); boot();
    };
  }
  function noAccess(email) {
    authFrame(S.html`<h1>No access</h1><p class="lead">${email} is not a member of the LK Jewellers team. LK Studio is private.</p>
      <p class="muted small">Customers can sign in to their own account on the website instead.</p>
      <div class="flex"><a class="btn" href="../account/index.html">Customer account</a><button class="btn gold" id="so">Sign out</button></div>`);
    S.$('#so').onclick = async () => { await S.db.auth.signOut(); loginScreen(); };
  }

  async function boot() {
    if (!S.configured) {
      authFrame(S.html`<h1>Almost ready</h1>${S.configBanner('LK Studio needs your Supabase project details. Open js/config.js in the website folder and replace YOUR_SUPABASE_URL and YOUR_SUPABASE_ANON_KEY (see docs/SETUP-GUIDE.md, Part A).')}`);
      return;
    }
    const { data: { session } } = await S.db.auth.getSession();
    if (S.db.auth.urlError && !session) return loginScreen({ title: 'That link has expired', body: 'Links can only be used once and expire after a while. Request a new one below or ask the owner to resend your invitation.' });
    if (!session) return loginScreen();
    if (S.db.auth.linkType === 'invite' || S.db.auth.linkType === 'recovery') { const t = S.db.auth.linkType; S.db.auth.linkType = null; return setPasswordScreen(t === 'invite'); }
    const r = await S.db.from('staff').select('*').eq('user_id', session.user.id).eq('active', true).maybeSingle();
    if (r.error) return loginScreen({ title: 'Could not load your access', body: S.friendly(r.error.message) });
    if (!r.data) return noAccess(session.user.email);
    S.me = r.data; S.user = session.user;
    shell();
  }
  S.start = () => { boot().catch(e => { console.error(e); S.render(S.$('#root'), S.errorState(S.friendly(e.message))); }); };

  // ---------------- small shared widgets ----------------
  S.kv = rows => S.html`<dl class="kv">${rows.filter(r => r && r[1] !== undefined).map(([k, v]) => S.html`<dt>${k}</dt><dd>${v === null || v === '' ? S.raw('<span class="muted">—</span>') : v}</dd>`)}</dl>`;
  S.address = c => [c.address_line1, c.address_line2, c.city, c.county, c.postcode, c.country && c.country !== 'United Kingdom' ? c.country : ''].filter(Boolean).join(', ');
  S.tabs = (items, current) => S.html`<nav class="tabs">${items.map(([k, l, n, href]) => S.html`<a href="${href}" class="${k === current ? 'on' : ''}">${l}${n != null ? S.html`<b>${n}</b>` : ''}</a>`)}</nav>`;
  S.fileTile = d => S.html`<a class="file-tile" href="#" data-open="${d.bucket}|${d.path}"><span class="ic">${S.icon(/^image\//.test(d.mime || '') ? 'image' : 'file')}</span>
    <span class="grow" style="min-width:0"><span class="t" style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${d.title || d.filename || 'File'}</span>
    <span class="tiny muted">${S.label(d.kind)} · ${S.date(d.created_at)}${d.uploaded_by_customer ? ' · from customer' : ''}</span></span>${S.icon('external', 'chev')}</a>`;
  S.bindFiles = root => S.on(root, '[data-open]', 'click', (e, a) => { e.preventDefault(); const [b, ...p] = a.dataset.open.split('|'); S.openFile(b, p.join('|')); });
  // Load private image thumbnails lazily (signed URLs)
  S.thumbs = async root => {
    for (const img of S.$$('img[data-signed]', root)) {
      const [b, ...p] = img.dataset.signed.split('|');
      try { img.src = await S.signedUrl(b, p.join('|'), 600); } catch (e) { img.alt = 'Not available'; }
    }
  };
  // Customer-facing document maths (mirrors the database so totals show while typing)
  S.lineTotals = (lines, discount, vat) => {
    const incl = !vat || vat.prices_include_vat !== false, reg = !vat || vat.registered !== false;
    let sub = 0, v = 0;
    lines.forEach(l => {
      const g = Math.round((+l.quantity || 0) * (+l.unit_price_pence || 0)) - (+l.discount_pence || 0), r = +l.vat_rate || 0;
      sub += g; v += g * r / (incl ? 100 + r : 100);          // same formula as the database
    });
    const ratio = sub > 0 ? Math.max(sub - (discount || 0), 0) / sub : 0; v = reg ? v * ratio : 0;
    const total = incl ? Math.max(sub - (discount || 0), 0) : Math.max(sub - (discount || 0), 0) + v;
    return { subtotal: Math.round(sub), vat: Math.round(v), total: Math.round(total), incl };
  };
  S.settings = async (key) => {
    S.cache.settings = S.cache.settings || {};
    if (!(key in S.cache.settings)) { const r = await S.db.from('settings').select('value').eq('key', key).maybeSingle(); S.cache.settings[key] = r.data ? r.data.value : null; }
    return S.cache.settings[key];
  };
  S.staffList = async () => { if (!S.cache.staff) S.cache.staff = S.must(await S.db.from('staff').select('user_id,full_name,email,role,active').order('full_name')); return S.cache.staff; };
  S.staffName = (id) => { const s = (S.cache.staff || []).find(x => x.user_id === id); return s ? s.full_name : id ? 'Team member' : 'Unassigned'; };
})();
