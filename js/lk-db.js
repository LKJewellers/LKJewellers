/* =====================================================================
   LK Jewellers: lightweight Supabase client (no third-party libraries).
   Talks to your Supabase project's standard REST, Auth and Storage APIs.
   Exposes window.supabase.createClient(url, anonKey) with the subset of the
   official API this website uses:
     auth:    getSession, getUser, signInWithPassword, signInWithOtp, signOut,
              resetPasswordForEmail, updateUser, onAuthStateChange
     data:    from(table).select/insert/update/upsert/delete + filters, rpc()
     storage: from(bucket).upload/getPublicUrl/createSignedUrl/download/remove
   The anon key is public by design; Row Level Security protects the data.
   ===================================================================== */
(function () {
  'use strict';

  function createClient(url, anonKey, opts) {
    url = String(url).replace(/\/$/, '');
    const ref = (url.match(/\/\/([^.]+)/) || [, 'lk'])[1];
    const KEY = 'lk-auth-' + ref;
    const listeners = new Set();
    let session = null;
    let urlError = null;

    // ---------- session storage (wrapped: storage can be blocked) ----------
    const store = {
      get() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } },
      set(s) { try { s ? localStorage.setItem(KEY, JSON.stringify(s)) : localStorage.removeItem(KEY); } catch (e) { /* private mode */ } }
    };
    const emit = (event, s) => listeners.forEach(cb => { try { cb(event, s); } catch (e) { console.error(e); } });
    const setSession = (s, event) => {
      session = s ? Object.assign({}, s, { expires_at: s.expires_at || Math.floor(Date.now() / 1000) + (s.expires_in || 3600) }) : null;
      store.set(session);
      if (event) emit(event, session);
    };
    const err = (message, extra) => Object.assign({ message: message || 'Request failed' }, extra || {});

    async function http(method, path, body, headers, raw, retried) {
      const h = Object.assign({ apikey: anonKey, Authorization: 'Bearer ' + (session ? session.access_token : anonKey) }, headers || {});
      if (body !== undefined && !(body instanceof Blob) && !(body instanceof ArrayBuffer) && !(body instanceof FormData)) {
        h['Content-Type'] = h['Content-Type'] || 'application/json';
        body = JSON.stringify(body);
      }
      let res;
      try { res = await fetch(url + path, { method, headers: h, body }); }
      catch (e) { return { error: err('Could not reach the server. Check your connection and try again.', { network: true }), status: 0 }; }
      if (res.status === 401 && session && session.refresh_token && !retried) {
        const r = await refresh();
        if (r) return http(method, path, typeof body === 'string' ? JSON.parse(body) : body, headers, raw, true);
      }
      if (raw) return { res, status: res.status };
      const text = await res.text();
      let data = null; try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
      if (!res.ok) {
        const m = data && (data.message || data.msg || data.error_description || data.error) || ('Error ' + res.status);
        return { error: err(typeof m === 'string' ? m : JSON.stringify(m), { status: res.status, code: data && data.code, details: data && data.details, hint: data && data.hint }), status: res.status, res };
      }
      return { data, status: res.status, res };
    }

    // ---------- AUTH ----------
    async function refresh() {
      const rt = session && session.refresh_token; if (!rt) return null;
      let res;
      try { res = await fetch(url + '/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: { apikey: anonKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: rt }) }); }
      catch (e) { return null; }
      if (!res.ok) { setSession(null, 'SIGNED_OUT'); return null; }
      const s = await res.json(); setSession(s, 'TOKEN_REFRESHED'); return s;
    }

    // Email links (verify, magic link, invite, recovery) arrive as #access_token=... in the URL.
    const ready = (async () => {
      session = store.get();
      if (!(opts && opts.auth && opts.auth.detectSessionInUrl === false) && typeof location !== 'undefined' && location.hash.length > 1) {
        const p = new URLSearchParams(location.hash.slice(1));
        if (p.get('error_description') || p.get('error')) {
          urlError = (p.get('error_description') || p.get('error')).replace(/\+/g, ' ');
          history.replaceState(null, '', location.pathname + location.search);
        } else if (p.get('access_token')) {
          const s = { access_token: p.get('access_token'), refresh_token: p.get('refresh_token'), expires_in: +p.get('expires_in') || 3600, token_type: 'bearer' };
          session = s;
          const u = await http('GET', '/auth/v1/user');
          if (!u.error) {
            s.user = u.data; setSession(s, p.get('type') === 'recovery' ? 'PASSWORD_RECOVERY' : 'SIGNED_IN');
            client.auth.linkType = p.get('type');
          } else { session = null; urlError = 'This link is invalid or has expired.'; }
          history.replaceState(null, '', location.pathname + location.search);
        }
      }
      if (session && session.expires_at && session.expires_at - Date.now() / 1000 < 60) await refresh();
    })();

    const auth = {
      linkType: null,
      get urlError() { return urlError; },
      async getSession() {
        await ready;
        if (session && session.expires_at - Date.now() / 1000 < 60) await refresh();
        return { data: { session }, error: null };
      },
      async getUser() {
        await ready; if (!session) return { data: { user: null }, error: err('Not signed in') };
        const r = await http('GET', '/auth/v1/user'); return r.error ? { data: { user: null }, error: r.error } : { data: { user: r.data }, error: null };
      },
      async signInWithPassword({ email, password }) {
        await ready;
        const r = await http('POST', '/auth/v1/token?grant_type=password', { email, password }, { Authorization: 'Bearer ' + anonKey });
        if (r.error) return { data: {}, error: r.error };
        setSession(r.data, 'SIGNED_IN'); return { data: { session: r.data, user: r.data.user }, error: null };
      },
      // Passwordless sign-up / sign-in link. Supabase creates the account when the link is used.
      async signInWithOtp({ email, options }) {
        const o = options || {};
        const q = o.emailRedirectTo ? '?redirect_to=' + encodeURIComponent(o.emailRedirectTo) : '';
        const r = await http('POST', '/auth/v1/otp' + q, { email, data: o.data || {}, create_user: o.shouldCreateUser !== false }, { Authorization: 'Bearer ' + anonKey });
        return { data: {}, error: r.error || null };
      },
      async resetPasswordForEmail(email, o) {
        const q = o && o.redirectTo ? '?redirect_to=' + encodeURIComponent(o.redirectTo) : '';
        const r = await http('POST', '/auth/v1/recover' + q, { email }, { Authorization: 'Bearer ' + anonKey });
        return { data: {}, error: r.error || null };
      },
      async updateUser(attrs) {
        await ready; if (!session) return { data: {}, error: err('Your link has expired. Please request a new one.') };
        const r = await http('PUT', '/auth/v1/user', attrs);
        if (r.error) return { data: {}, error: r.error };
        session.user = r.data; setSession(session, 'USER_UPDATED'); return { data: { user: r.data }, error: null };
      },
      async signOut() {
        await ready;
        if (session) await http('POST', '/auth/v1/logout', {});
        setSession(null, 'SIGNED_OUT'); return { error: null };
      },
      onAuthStateChange(cb) {
        listeners.add(cb); ready.then(() => cb('INITIAL_SESSION', session));
        return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } };
      }
    };

    // ---------- DATABASE (PostgREST) ----------
    function from(table) {
      const q = { method: 'GET', params: [], headers: {}, body: undefined, single: null, head: false, wantReturn: false };
      const enc = v => encodeURIComponent(v);
      const fmt = v => (v === null ? 'null' : String(v));
      const add = (col, op, v) => { q.params.push(enc(col) + '=' + op + '.' + enc(fmt(v))); return b; };
      const b = {
        select(cols, o) {
          q.params.push('select=' + enc(String(cols || '*').replace(/\s+(?=([^"]*"[^"]*")*[^"]*$)/g, '')));
          if (q.method === 'GET') { if (o && o.head) q.head = true; } else q.wantReturn = true;
          if (o && o.count) q.headers.Prefer = [q.headers.Prefer, 'count=' + o.count].filter(Boolean).join(',');
          return b;
        },
        insert(rows, o) { q.method = 'POST'; q.body = rows; if (o && o.onConflict) q.params.push('on_conflict=' + enc(o.onConflict)); return b; },
        upsert(rows, o) {
          q.method = 'POST'; q.body = rows; q.headers.Prefer = 'resolution=' + (o && o.ignoreDuplicates ? 'ignore' : 'merge') + '-duplicates';
          if (o && o.onConflict) q.params.push('on_conflict=' + enc(o.onConflict)); return b;
        },
        update(values) { q.method = 'PATCH'; q.body = values; return b; },
        delete() { q.method = 'DELETE'; return b; },
        eq: (c, v) => add(c, 'eq', v), neq: (c, v) => add(c, 'neq', v), gt: (c, v) => add(c, 'gt', v), gte: (c, v) => add(c, 'gte', v),
        lt: (c, v) => add(c, 'lt', v), lte: (c, v) => add(c, 'lte', v), like: (c, v) => add(c, 'like', v), ilike: (c, v) => add(c, 'ilike', v),
        is: (c, v) => add(c, 'is', v),
        in(c, vals) { q.params.push(enc(c) + '=in.(' + vals.map(v => enc('"' + String(v).replace(/"/g, '\\"') + '"')).join(',') + ')'); return b; },
        contains(c, vals) { q.params.push(enc(c) + '=cs.' + enc('{' + vals.join(',') + '}')); return b; },
        not(c, op, v) { q.params.push(enc(c) + '=not.' + op + '.' + enc(fmt(v))); return b; },
        or(expr) { q.params.push('or=' + enc('(' + expr + ')')); return b; },
        order(c, o) {
          const part = c + '.' + (o && o.ascending === false ? 'desc' : 'asc') + (o && o.nullsFirst != null ? (o.nullsFirst ? '.nullsfirst' : '.nullslast') : '');
          const i = q.params.findIndex(p => p.startsWith('order='));
          if (i >= 0) q.params[i] += ',' + enc(part); else q.params.push('order=' + enc(part));
          return b;
        },
        limit(n) { q.params.push('limit=' + n); return b; },
        range(a, z) { q.params.push('offset=' + a, 'limit=' + (z - a + 1)); return b; },
        single() { q.single = 'one'; return b; },
        maybeSingle() { q.single = 'maybe'; return b; },
        then(ok, bad) { return run().then(ok, bad); }
      };
      async function run() {
        await ready;
        if (session && session.expires_at - Date.now() / 1000 < 60) await refresh();
        const h = Object.assign({}, q.headers);
        if (q.method !== 'GET') {
          h.Prefer = [h.Prefer, q.wantReturn ? 'return=representation' : 'return=minimal'].filter(Boolean).join(',');
        }
        if (q.single === 'one') h.Accept = 'application/vnd.pgrst.object+json';
        const path = '/rest/v1/' + table + (q.params.length ? '?' + q.params.join('&') : '');
        const r = await http(q.head ? 'HEAD' : q.method, path, q.body, h, q.head);
        let count = null;
        const cr = r.res && r.res.headers.get('content-range');
        if (cr && cr.includes('/')) { const n = cr.split('/')[1]; count = n === '*' ? null : +n; }
        if (q.head) return { data: null, count, error: r.status >= 400 || r.status === 0 ? err('Request failed', { status: r.status }) : null, status: r.status };
        if (r.error) {
          if (q.single === 'one' && r.status === 406) r.error.message = 'The record could not be found (or more than one matched).';
          return { data: null, count, error: r.error, status: r.status };
        }
        let data = r.data;
        if (q.single === 'maybe') {
          if (Array.isArray(data) && data.length > 1) return { data: null, error: err('More than one row returned'), status: r.status };
          data = Array.isArray(data) ? data[0] || null : data;
        }
        if (q.method !== 'GET' && !q.wantReturn) data = null;
        return { data, count, error: null, status: r.status };
      }
      return b;
    }

    async function rpc(fn, args) {
      await ready;
      if (session && session.expires_at - Date.now() / 1000 < 60) await refresh();
      const r = await http('POST', '/rest/v1/rpc/' + fn, args || {});
      return { data: r.error ? null : r.data, error: r.error || null };
    }

    // ---------- STORAGE ----------
    const storage = {
      from(bucket) {
        const p = path => String(path).split('/').map(encodeURIComponent).join('/');
        return {
          async upload(path, file, o) {
            await ready;
            const h = { 'Content-Type': (o && o.contentType) || file.type || 'application/octet-stream', 'x-upsert': o && o.upsert ? 'true' : 'false' };
            if (o && o.cacheControl) h['cache-control'] = 'max-age=' + o.cacheControl;
            const r = await http('POST', '/storage/v1/object/' + bucket + '/' + p(path), file, h);
            return r.error ? { data: null, error: r.error } : { data: { path, fullPath: bucket + '/' + path }, error: null };
          },
          getPublicUrl(path) { return { data: { publicUrl: url + '/storage/v1/object/public/' + bucket + '/' + p(path) } }; },
          async createSignedUrl(path, expiresIn) {
            await ready;
            const r = await http('POST', '/storage/v1/object/sign/' + bucket + '/' + p(path), { expiresIn: expiresIn || 60 });
            if (r.error) return { data: null, error: r.error };
            const s = r.data.signedURL || r.data.signedUrl;
            return { data: { signedUrl: url + '/storage/v1' + (s.startsWith('/') ? s : '/' + s) }, error: null };
          },
          async download(path) {
            await ready;
            const r = await http('GET', '/storage/v1/object/authenticated/' + bucket + '/' + p(path), undefined, {}, true);
            if (!r.res || !r.res.ok) return { data: null, error: err('Could not download the file') };
            return { data: await r.res.blob(), error: null };
          },
          async remove(paths) {
            await ready;
            const r = await http('DELETE', '/storage/v1/object/' + bucket, { prefixes: paths });
            return { data: r.data, error: r.error || null };
          }
        };
      }
    };

    const client = { auth, from, rpc, storage, url };
    return client;
  }

  window.supabase = { createClient };
})();
