/* Website contact form -> LK Studio.
   Only active when the Cloudflare Worker is configured (WORKER_URL in js/config.js).
   Otherwise this file does nothing and the form keeps working exactly as before.
   The Worker stores every enquiry before processing it, so none is ever lost. */
(function () {
  if (!window.LK || !LK.workerReady) return;
  const form = document.getElementById('contact-form'); if (!form) return;
  const note = document.getElementById('note');
  // Extra optional fields that help us reply and keep designs with the enquiry.
  const add = html => { const d = document.createElement('div'); d.innerHTML = html; form.insertBefore(d.firstElementChild, form.querySelector('button[type=submit]')); };
  add('<label>Phone <em style="font-style:normal;opacity:.7">(optional)</em><input type="tel" name="phone" autocomplete="tel"></label>');
  add('<label>Photos or sketches <em style="font-style:normal;opacity:.7">(optional, up to 5)</em><input type="file" name="files" accept="image/*,application/pdf" multiple></label>');
  add('<label class="lk-hp" aria-hidden="true" style="position:absolute;left:-9999px">Leave empty<input name="website" tabindex="-1" autocomplete="off"></label>');
  // Capture-phase listener runs before the page's original handler and replaces it.
  document.addEventListener('submit', async e => {
    if (e.target !== form) return;
    e.preventDefault(); e.stopImmediatePropagation();
    const btn = form.querySelector('button[type=submit]'); const say = t => { if (note) note.textContent = t; };
    const fd = new FormData(form); const files = form.files.files;
    if (files.length > 5) return say('Please attach up to 5 files.');
    for (const f of files) if (f.size > 10 * 1024 * 1024) return say(`"${f.name}" is larger than 10 MB.`);
    fd.delete('files'); [...files].forEach(f => fd.append('file', f, f.name));
    if (fd.get('type')) fd.set('subject', fd.get('type') + (new URLSearchParams(location.search).get('enquire') ? ': ' + new URLSearchParams(location.search).get('enquire') : ''));
    fd.set('page', location.pathname);
    btn.disabled = true; say('Sending…');
    try {
      const r = await fetch(window.LK_CONFIG.WORKER_URL.replace(/\/$/, '') + '/enquiry', { method: 'POST', body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'failed');
      form.reset(); say('Thank you. We have received your enquiry' + (j.ref ? ' (reference ' + j.ref + ')' : '') + ' and will reply within one working day.' + (j.files_failed ? ' Some files could not be attached; please email them to us.' : ''));
    } catch (err) {
      say(err.message && err.message !== 'failed' && !/fetch/i.test(err.message) ? err.message : 'Sorry, your message could not be sent. Please try again, or email hello@lkjewellers.co.uk.');
    } finally { btn.disabled = false; }
  }, true);
})();
