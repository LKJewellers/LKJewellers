/* LK Studio: activity clock.
   Team members: after 1 minute without touching the app a clock appears top right; after 15 minutes a
   pop-up tells them to get back to work, with the clock still counting. Only real use (clicks, typing,
   scrolling, moving the mouse) resets it. Opening a new tab or reloading does not: the last real activity
   is stored in the database, so the clock carries on across tabs and devices.
   Admin: the Home page shows how long each team member has been idle, with a button to send the pop-up. */
(function () {
  const IDLE_CLOCK = 60 * 1000, IDLE_POP = 15 * 60 * 1000, BEAT = 30 * 1000, POLL = 20 * 1000;
  const MSG = 'Stop smoking so much weed and get on with your work.';

  // 15:03 · 2:05:09 · 1 day 3 hrs · 2 weeks 3 days · 1 year 4 weeks
  const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
  S.idleText = ms => {
    const s = Math.max(0, Math.floor(ms / 1000)), m = Math.floor(s / 60), h = Math.floor(m / 60), d = Math.floor(h / 24), wk = Math.floor(d / 7), y = Math.floor(d / 365);
    const two = n => String(n).padStart(2, '0');
    if (h < 1) return m + ':' + two(s % 60);
    if (d < 1) return h + ':' + two(m % 60) + ':' + two(s % 60);
    if (wk < 1) return plural(d, 'day') + (h % 24 ? ' ' + (h % 24) + ' hr' + (h % 24 === 1 ? '' : 's') : '');
    if (y < 1) return plural(wk, 'week') + (d % 7 ? ' ' + plural(d % 7, 'day') : '');
    const wr = Math.floor((d - y * 365) / 7);
    return plural(y, 'year') + (wr ? ' ' + plural(wr, 'week') : '');
  };

  let offset = 0; const now = () => Date.now() + offset;   // keep in step with the server clock

  // ---------------- team member side ----------------
  function startStaff() {
    let last = now(), lastBeat = 0, seenNudge = null, pop = null, clock = null, popShownFor = null, mx = -1, my = -1;
    const el = (cls, html) => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; document.body.appendChild(d); return d; };
    const showPop = nudge => {
      if (pop) return;
      pop = el('idlepop', `<div class="box" role="alertdialog" aria-live="assertive"><div class="em">🚬😴</div><h2>${MSG}</h2>
        <p class="muted" style="margin:0">It's been</p><div class="clk" id="idleclk">${S.idleText(now() - last)}</div>
        ${nudge ? '<p class="small muted" style="margin:-6px 0 12px">Sent by the admin. They can see this.</p>' : '<p class="small muted" style="margin:-6px 0 12px">The admin can see how long you’ve been away.</p>'}
        <button class="btn gold" type="button">Back to work</button></div>`);
      popShownFor = last;
    };
    const hidePop = () => { if (pop) { pop.remove(); pop = null; } };
    const activity = () => {
      last = now(); hidePop(); if (clock) { clock.remove(); clock = null; }
      if (now() - lastBeat > BEAT) { lastBeat = now(); S.rpc('staff_heartbeat').catch(() => {}); }
    };
    ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(ev => addEventListener(ev, activity, { passive: true, capture: true }));
    addEventListener('mousemove', e => { if (mx >= 0 && Math.abs(e.clientX - mx) + Math.abs(e.clientY - my) > 12) activity(); mx = e.clientX; my = e.clientY; }, { passive: true });
    setInterval(() => {
      const idle = now() - last;
      if (idle >= IDLE_CLOCK) { if (!clock) clock = el('idleclock', ''); clock.innerHTML = 'Last active <b>' + S.idleText(idle) + '</b> ago'; }
      if (idle >= IDLE_POP && popShownFor !== last) showPop(false);
      const c = pop && pop.querySelector('#idleclk'); if (c) c.textContent = S.idleText(idle);
    }, 1000);
    const sync = async () => {
      try {
        const st = await S.rpc('staff_status'); if (!st) return;
        if (st.now) offset = Date.parse(st.now) - Date.now();
        const dbLast = st.last_active_at ? Date.parse(st.last_active_at) : null;
        if (dbLast && dbLast > last + 2000) last = dbLast;                      // used on another tab or device
        if (seenNudge === null) seenNudge = st.nudge_at || '';                 // don't replay an old nudge on load
        else if (st.nudge_at && st.nudge_at !== seenNudge) { seenNudge = st.nudge_at; hidePop(); showPop(true); }
      } catch (e) { }
    };
    // first load: carry on from the last real activity stored in the database (a reload does not reset it)
    (async () => {
      try {
        const st = await S.rpc('staff_status');
        if (st && st.now) offset = Date.parse(st.now) - Date.now();
        if (st && st.last_active_at) last = Math.min(now(), Date.parse(st.last_active_at)); else { last = now(); S.rpc('staff_heartbeat').catch(() => {}); }
        seenNudge = (st && st.nudge_at) || '';
      } catch (e) { }
      setInterval(sync, POLL);
    })();
  }

  // ---------------- admin side ----------------
  S.renderTeamActivity = async box => {
    if (!box || !S.isOwner()) return;
    let team = [];
    const load = async () => { try { team = (await S.rpc('team_activity')) || []; } catch (e) { team = []; } draw(); };
    const draw = () => {
      if (!document.body.contains(box)) return;
      if (!team.length) { box.innerHTML = ''; return; }
      S.render(box, S.html`<section class="card teamact" style="margin-bottom:18px"><div class="ch"><div><h2>Team activity</h2><p class="muted small">Time since each person last used the studio.</p></div></div>
        <div class="list">${team.map(t => { const idle = t.last_active_at ? now() - Date.parse(t.last_active_at) : null;
          return S.html`<div class="li"><span class="ic">${S.icon('users')}</span><span class="main-t"><span class="t" style="display:block">${t.name || 'Team member'}</span>
            <span class="d" style="display:block">${idle == null ? 'Not used the studio yet' : idle < 60000 ? 'Active now' : 'Idle for ' + S.idleText(idle)}</span></span>
            <button class="btn sm ${idle != null && idle >= IDLE_POP ? 'danger' : ''}" data-nudge="${t.user_id}">Send “get to work”</button></div>`; })}</div></section>`);
    };
    S.on(box, '[data-nudge]', 'click', (e, b) => S.act(b, () => S.rpc('staff_nudge', { p_user: b.dataset.nudge }), 'Sent. It pops up on their screen within 20 seconds.').catch(() => {}));
    await load();
    const tick = setInterval(() => { if (!document.body.contains(box)) return clearInterval(tick); draw(); }, 1000);
    const poll = setInterval(() => { if (!document.body.contains(box)) return clearInterval(poll); load(); }, POLL);
  };

  // start once someone is signed in
  const wait = setInterval(() => {
    if (!S.me || !S.user) return;
    clearInterval(wait);
    if (!S.isOwner()) startStaff();
  }, 1000);
})();
