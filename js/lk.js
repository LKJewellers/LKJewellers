/* LK Jewellers: shared helpers for account, admin and live-product pages.
   Needs js/config.js (see config.example.js) and the Supabase library loaded first. */
(function () {
  const C = window.LK_CONFIG || {};
  const LK = (window.LK = {});
  const real = v => !!v && !/YOUR_/.test(v);
  LK.configured = real(C.SUPABASE_URL) && real(C.SUPABASE_ANON_KEY) && !!(window.supabase && window.supabase.createClient);
  LK.workerReady = real(C.WORKER_URL);
  LK.siteUrl = (real(C.SITE_URL) ? C.SITE_URL : location.origin).replace(/\/$/, '');
  LK.base = location.pathname.includes('/account/') || location.pathname.includes('/admin/') ? '../' : '';
  LK.db = LK.configured ? window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null;

  // ---- tiny utilities (esc() must wrap every value put into innerHTML)
  LK.$ = (s, r = document) => r.querySelector(s);
  LK.$$ = (s, r = document) => [...r.querySelectorAll(s)];
  LK.esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  LK.money = p => (p == null ? '' : '£' + (p / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  LK.toPence = v => { const t = String(v).replace(/[£,\s]/g, ''); return /^\d{1,9}(\.\d{1,2})?$/.test(t) ? Math.round(parseFloat(t) * 100) : null; };   // strict: '12x' is rejected
  LK.date = d => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
  LK.validEmail = s => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 254;
  LK.slug = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'item';
  LK.rand = () => Math.random().toString(36).slice(2, 8);

  LK.toast = (msg, bad) => {
    let t = LK.$('#lk-toast');
    if (!t) { t = document.createElement('div'); t.id = 'lk-toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg; t.className = 'show' + (bad ? ' bad' : '');
    clearTimeout(LK._tt); LK._tt = setTimeout(() => (t.className = ''), 4200);
  };
  LK.setupNotice = el => {
    el.innerHTML = '<div class="notice"><b>Setup needed.</b> This page needs the database connection. Follow docs/SETUP-GUIDE.md and create js/config.js.</div>';
  };

  // ---- session helpers
  LK.session = async () => (await LK.db.auth.getSession()).data.session;
  LK.me = async () => {
    const s = await LK.session(); if (!s) return null;
    for (let i = 0; i < 3; i++) {          // the row is created by a database trigger; allow a moment
      const { data } = await LK.db.from('customers').select('*').eq('id', s.user.id).maybeSingle();
      if (data) return data;
      await new Promise(r => setTimeout(r, 600));
    }
    return null;
  };
  LK.signOut = async () => { await LK.db.auth.signOut(); location.href = LK.base + 'account/index.html'; };

  // ---- call the Cloudflare Worker with the signed-in user's token
  LK.worker = async (path, body) => {
    if (!LK.workerReady) throw new Error('The Cloudflare Worker is not set up yet (see the setup guide).');
    const s = await LK.session();
    const r = await fetch(C.WORKER_URL.replace(/\/$/, '') + path, { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (s ? s.access_token : '') },
      body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'Request failed');
    return j;
  };
  LK.productImage = path => (path ? LK.db.storage.from('product-images').getPublicUrl(path).data.publicUrl : '');
})();
