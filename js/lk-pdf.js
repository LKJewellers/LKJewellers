/* =====================================================================
   LK Jewellers: invoice & quote PDFs, generated in the browser.
   No third-party library: a small PDF writer using the standard PDF fonts
   (Helvetica, Times). Used by LK Studio and the customer portal.
   Only customer-facing fields are ever passed in: never costs or internal notes.
   ===================================================================== */
(function () {
  'use strict';
  // Standard font widths (1/1000 em) for characters 32..126.
  const HV = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
  const HB = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];
  const WIN = { 8364: 128, 8218: 130, 8222: 132, 8230: 133, 8216: 145, 8217: 146, 8220: 147, 8221: 148, 8226: 149, 8211: 150, 8212: 151, 8482: 153 };
  // Map text to WinAnsi bytes; anything outside becomes '?'
  const enc = s => Array.from(String(s == null ? '' : s)).map(ch => { const c = ch.codePointAt(0); return c < 128 || (c >= 160 && c <= 255) ? String.fromCharCode(c) : WIN[c] ? String.fromCharCode(WIN[c]) : '?'; }).join('');
  const width = (s, font, size) => {
    const tbl = font === 'F2' ? HB : HV; let w = 0;
    for (const ch of enc(s)) { const c = ch.charCodeAt(0); w += c >= 32 && c <= 126 ? tbl[c - 32] : c === 163 ? 556 : c === 150 ? 556 : c === 183 ? 278 : c >= 192 ? 600 : 500; }
    return w * size / 1000 * (font === 'F3' || font === 'F4' ? 0.95 : 1);
  };
  const esc = s => String(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const hex = c => { const n = parseInt(c.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255].map(x => x.toFixed(3)).join(' '); };

  function Doc() {
    const pages = []; let cur = null; const W = 595.28, H = 841.89;
    const api = {
      W, H,
      page() { cur = []; pages.push(cur); return api; },
      // y is measured from the TOP of the page
      text(x, y, s, o = {}) {
        const f = o.font || 'F1', size = o.size || 10; let tx = x; const t = enc(s);
        const cs = o.spacing || 0; const w = width(t, f, size) + cs * t.length;
        if (o.align === 'right') tx = x - w; else if (o.align === 'center') tx = x - w / 2;
        cur.push(`BT /${f} ${size} Tf ${hex(o.color || '#1e2327')} rg ${cs} Tc 1 0 0 1 ${tx.toFixed(2)} ${(H - y).toFixed(2)} Tm (${esc(t)}) Tj ET`);
        return w;
      },
      line(x1, y1, x2, y2, o = {}) { cur.push(`${hex(o.color || '#dfe2e2')} RG ${o.width || 0.6} w ${x1.toFixed(2)} ${(H - y1).toFixed(2)} m ${x2.toFixed(2)} ${(H - y2).toFixed(2)} l S`); },
      rect(x, y, w, h, color) { cur.push(`${hex(color)} rg ${x.toFixed(2)} ${(H - y - h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`); },
      wrap(s, maxW, font, size) {
        const out = []; String(s || '').split(/\n/).forEach(par => {
          let line = ''; par.split(/\s+/).forEach(word => { const t = line ? line + ' ' + word : word; if (width(t, font, size) <= maxW || !line) line = t; else { out.push(line); line = word; } });
          out.push(line);
        });
        return out;
      },
      width,
      // footerFn(pageIndex, pageCount) is called with each page active, to draw running footers
      blob(footerFn) {
        if (footerFn) pages.forEach((p, i) => { cur = p; footerFn(i, pages.length); });
        const objs = []; const add = s => { objs.push(s); return objs.length; };
        const catalog = add(null), pagesId = add(null);
        const fonts = { F1: 'Helvetica', F2: 'Helvetica-Bold', F3: 'Times-Roman', F4: 'Times-Italic' };
        const fontIds = {}; for (const k in fonts) fontIds[k] = add(`<< /Type /Font /Subtype /Type1 /BaseFont /${fonts[k]} /Encoding /WinAnsiEncoding >>`);
        const res = `<< /Font << ${Object.keys(fontIds).map(k => `/${k} ${fontIds[k]} 0 R`).join(' ')} >> >>`;
        const kids = [];
        pages.forEach(p => { const stream = p.join('\n'); const cid = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
          kids.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${W} ${H}] /Resources ${res} /Contents ${cid} 0 R >>`)); });
        objs[catalog - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
        objs[pagesId - 1] = `<< /Type /Pages /Kids [${kids.map(k => k + ' 0 R').join(' ')}] /Count ${kids.length} >>`;
        let out = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'; const offs = [];
        objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
        const xref = out.length;
        out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('');
        out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R /Info << /Producer (LK Jewellers) /Title (LK Jewellers document) >> >>\nstartxref\n${xref}\n%%EOF`;
        const bytes = new Uint8Array(out.length); for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 255;
        return new Blob([bytes], { type: 'application/pdf' });
      }
    };
    return api;
  }

  const money = p => (p < 0 ? '-' : '') + '£' + (Math.abs(p || 0) / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dt = d => d ? new Date(String(d).length === 10 ? d + 'T12:00:00' : d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  const GOLD = '#8a6a36', INK = '#1e2327', MUTED = '#6c7277', LINE = '#dfe2e2';

  /**
   * Build an invoice or quote PDF.
   * kind: 'invoice' | 'quote'
   * doc: { number, issue_date, due_date | expiry_date, status, discount_pence, subtotal_pence, vat_pence, total_pence, amount_paid_pence, notes, payment_link_url, title }
   * lines: [{ description, quantity, unit_price_pence, discount_pence, vat_rate }]
   * customer: { first_name, last_name, company, email, address_line1, address_line2, city, county, postcode, country }
   * business: settings.business  ·  vat: settings.vat
   */
  function businessDoc({ kind, doc, lines, customer, business, vat }) {
    business = business || {}; vat = vat || { registered: true, prices_include_vat: true };
    const d = Doc(); const M = 48, R = d.W - 48; let y;
    const header = (first) => {
      d.page();
      d.text(M, 64, 'LK JEWELLERS', { font: 'F3', size: 22, spacing: 3.2, color: INK });
      d.text(M + 1, 80, 'LONDON', { size: 6.5, spacing: 4.5, color: GOLD });
      const addr = [business.address, business.email, business.phone, business.website].filter(Boolean).join('\n');
      let ry = 52; d.wrap(addr, 200, 'F1', 8.5).forEach(l => { d.text(R, ry, l, { size: 8.5, align: 'right', color: MUTED }); ry += 12; });
      d.line(M, 104, R, 104, { color: '#c2a167', width: 0.8 });
      if (!first) { d.text(M, 128, (kind === 'invoice' ? 'Invoice ' : 'Quote ') + doc.number + ' (continued)', { size: 9, color: MUTED }); y = 150; }
    };
    header(true);
    d.text(M, 150, kind === 'invoice' ? 'Invoice' : 'Quotation', { font: 'F3', size: 30, color: INK });
    const meta = [['Number', doc.number], [kind === 'invoice' ? 'Invoice date' : 'Date', dt(doc.issue_date)],
      kind === 'invoice' ? ['Due date', dt(doc.due_date)] : ['Valid until', dt(doc.expiry_date)]];
    let my = 132; meta.forEach(([k, v]) => { d.text(R - 120, my, k.toUpperCase(), { size: 7, spacing: 1.2, color: MUTED, align: 'right' }); d.text(R, my, v, { size: 9.5, align: 'right' }); my += 15; });
    // Bill to
    y = 196; d.text(M, y, kind === 'invoice' ? 'BILL TO' : 'PREPARED FOR', { size: 7, spacing: 1.6, color: GOLD, font: 'F2' }); y += 15;
    const name = [customer.first_name, customer.last_name].filter(Boolean).join(' ');
    [name, customer.company, customer.address_line1, customer.address_line2, [customer.city, customer.county].filter(Boolean).join(', '), customer.postcode, customer.country && customer.country !== 'United Kingdom' ? customer.country : '', customer.email]
      .filter(Boolean).forEach((l, i) => { d.text(M, y, l, { size: i === 0 ? 10.5 : 9.5, font: i === 0 ? 'F2' : 'F1', color: i === 0 ? INK : MUTED }); y += 13; });
    if (doc.title) { y += 6; d.text(M, y, doc.title, { font: 'F4', size: 12, color: INK }); y += 6; }
    // Table
    y += 18;
    const cols = { desc: M, qty: 330, unit: 410, disc: 470, amt: R };
    const th = () => { d.rect(M, y - 11, R - M, 20, '#f7f0e3');
      d.text(cols.desc + 8, y + 2, 'DESCRIPTION', { size: 7, spacing: 1.2, font: 'F2', color: GOLD }); d.text(cols.qty, y + 2, 'QTY', { size: 7, spacing: 1.2, font: 'F2', color: GOLD, align: 'right' });
      d.text(cols.unit, y + 2, 'UNIT PRICE', { size: 7, spacing: 1.2, font: 'F2', color: GOLD, align: 'right' }); d.text(cols.disc, y + 2, 'DISCOUNT', { size: 7, spacing: 1.2, font: 'F2', color: GOLD, align: 'right' });
      d.text(cols.amt - 8, y + 2, 'AMOUNT', { size: 7, spacing: 1.2, font: 'F2', color: GOLD, align: 'right' }); y += 24; };
    th();
    lines.forEach(l => {
      const wrapped = d.wrap(l.description, 255, 'F1', 9.5); const h = wrapped.length * 12 + 10;
      if (y + h > d.H - 200) { header(false); th(); }
      wrapped.forEach((t, i) => d.text(cols.desc + 8, y + i * 12, t, { size: 9.5 }));
      const gross = Math.round((+l.quantity || 0) * (+l.unit_price_pence || 0)) - (+l.discount_pence || 0);
      d.text(cols.qty, y, String(+l.quantity), { size: 9.5, align: 'right' }); d.text(cols.unit, y, money(l.unit_price_pence), { size: 9.5, align: 'right' });
      d.text(cols.disc, y, l.discount_pence ? money(-l.discount_pence) : '', { size: 9.5, align: 'right', color: MUTED }); d.text(cols.amt - 8, y, money(gross), { size: 9.5, align: 'right' });
      y += h - 2; d.line(M, y - 8, R, y - 8);
    });
    if (y > d.H - 220) { header(false); }
    // Totals
    y += 8; const tx = R - 8, lx = 360;
    const row = (k, v, o = {}) => { d.text(lx, y, k, { size: o.size || 9.5, color: o.color || MUTED, font: o.font }); d.text(tx, y, v, { size: o.size || 9.5, align: 'right', font: o.font, color: o.vcolor || INK }); y += o.gap || 16; };
    row('Subtotal', money(doc.subtotal_pence));
    if (doc.discount_pence) row('Discount', money(-doc.discount_pence));
    if (vat.registered !== false) row(vat.prices_include_vat !== false ? 'VAT included' : 'VAT', money(doc.vat_pence));
    d.line(lx, y - 8, R, y - 8, { color: '#c2a167' }); y += 4;
    row('Total', money(doc.total_pence), { size: 12, font: 'F2', color: INK, gap: 18 });
    if (kind === 'invoice' && doc.amount_paid_pence) { row('Paid', money(-doc.amount_paid_pence)); row('Balance due', money(doc.total_pence - doc.amount_paid_pence), { size: 12, font: 'F2', color: GOLD, vcolor: GOLD, gap: 18 }); }
    // Payment & notes
    y += 10; let ly = y;
    if (kind === 'invoice') {
      d.text(M, ly, 'PAYMENT', { size: 7, spacing: 1.6, font: 'F2', color: GOLD }); ly += 14;
      if (doc.payment_link_url && doc.status !== 'paid') { d.text(M, ly, 'Pay securely online:', { size: 9 }); ly += 12; d.wrap(doc.payment_link_url, 280, 'F1', 8.5).forEach(t => { d.text(M, ly, t, { size: 8.5, color: GOLD }); ly += 11; }); ly += 4; }
      if (business.bank_details) { d.wrap('Bank transfer: ' + business.bank_details, 280, 'F1', 9).forEach(t => { d.text(M, ly, t, { size: 9, color: MUTED }); ly += 12; }); }
      d.text(M, ly, 'Please quote ' + doc.number + ' as your reference.', { size: 9, color: MUTED }); ly += 18;
    } else {
      d.text(M, ly, 'This quotation is valid until ' + dt(doc.expiry_date) + '.', { size: 9, color: MUTED }); ly += 18;
    }
    if (doc.notes) { d.text(M, ly, 'NOTES', { size: 7, spacing: 1.6, font: 'F2', color: GOLD }); ly += 14; d.wrap(doc.notes, 300, 'F1', 9).slice(0, 14).forEach(t => { d.text(M, ly, t, { size: 9 }); ly += 12; }); }
    // Footer on every page
    const foot = [business.name || 'LK Jewellers', 'London', business.website, business.company_number ? 'Company no. ' + business.company_number : '', business.vat_number ? 'VAT no. ' + business.vat_number : ''].filter(Boolean).join('  \u00b7  ');
    const thanks = business.invoice_footer || 'Thank you for choosing LK Jewellers.';
    return d.blob((i, n) => {
      d.line(M, d.H - 62, R, d.H - 62, { color: LINE });
      d.text(d.W / 2, d.H - 46, thanks, { font: 'F4', size: 10, align: 'center', color: INK });
      d.text(d.W / 2, d.H - 32, foot, { size: 7.5, align: 'center', color: MUTED });
      if (n > 1) d.text(R, d.H - 32, 'Page ' + (i + 1) + ' of ' + n, { size: 7.5, align: 'right', color: MUTED });
    });
  }

  window.LKPDF = {
    // Returns a Blob (application/pdf)
    build(opts) { return businessDoc(opts); },
    download(blob, filename) {
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
    },
    _Doc: Doc
  };
})();
