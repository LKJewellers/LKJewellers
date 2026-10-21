/* LK Studio: automatic white backgrounds for product photos.
   A small AI model (U2-Net-p, studio/models/u2netp.onnx) finds the piece, then everything that is
   background is painted pure white. Edges are protected: anything near the piece that does not match
   the background colour is always kept, so claws, chains and stones are never cut off.
   If the model cannot load (old browser, offline), a simpler edge-fill method is used instead. */
(function () {
  const ORT_URL = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.3/dist/ort.min.js';
  const ORT_DIR = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.3/dist/';
  const MODEL_URL = 'models/u2netp.onnx';
  let sessionP = null;

  const loadScript = src => new Promise((res, rej) => { if (window.ort) return res(); const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Could not load ' + src)); document.head.appendChild(s); });
  const session = () => sessionP || (sessionP = (async () => {
    await loadScript(ORT_URL);
    ort.env.wasm.wasmPaths = ORT_DIR; ort.env.wasm.numThreads = 1;
    return ort.InferenceSession.create(MODEL_URL, { executionProviders: ['wasm'] });
  })().catch(e => { sessionP = null; throw e; }));
  S.whiteBgWarmUp = () => session().catch(() => {});

  const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const ctx = c => c.getContext('2d', { willReadFrequently: true });
  const toJpeg = c => new Promise(r => c.toBlob(r, 'image/jpeg', 0.92));

  // three passes of a box blur = a fast Gaussian blur (single channel, in place)
  function blur(a, w, h, r) {
    if (r < 1) return a;
    const t = new Float32Array(a.length);
    for (let pass = 0; pass < 3; pass++) {
      for (let y = 0; y < h; y++) { let acc = 0; const o = y * w;
        for (let x = -r; x <= r; x++) acc += a[o + Math.min(w - 1, Math.max(0, x))];
        for (let x = 0; x < w; x++) { t[o + x] = acc / (2 * r + 1); acc += a[o + Math.min(w - 1, x + r + 1)] - a[o + Math.max(0, x - r)]; } }
      for (let x = 0; x < w; x++) { let acc = 0;
        for (let y = -r; y <= r; y++) acc += t[Math.min(h - 1, Math.max(0, y)) * w + x];
        for (let y = 0; y < h; y++) { a[y * w + x] = acc / (2 * r + 1); acc += t[Math.min(h - 1, y + r + 1) * w + x] - t[Math.max(0, y - r) * w + x]; } }
    }
    return a;
  }
  // scale a set of up to 4 single-channel maps (0..1) to a new size using the browser's smooth scaling
  function scaleMaps(maps, w, h, W, H) {
    const c = canvas(w, h), g = ctx(c), id = g.createImageData(w, h);
    for (let i = 0; i < w * h; i++) for (let k = 0; k < 4; k++) id.data[i * 4 + k] = k < maps.length ? Math.round(maps[k][i] * 255) : 255;
    g.putImageData(id, 0, 0);
    const C = canvas(W, H), G = ctx(C); G.imageSmoothingEnabled = true; G.imageSmoothingQuality = 'high'; G.drawImage(c, 0, 0, W, H);
    const d = G.getImageData(0, 0, W, H).data, out = maps.map(() => new Float32Array(W * H));
    for (let i = 0; i < W * H; i++) for (let k = 0; k < maps.length; k++) out[k][i] = d[i * 4 + k] / 255;
    return out;
  }

  async function aiWhite(file) {
    const sess = await session();
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const k = Math.min(1, 2400 / Math.max(bmp.width, bmp.height)), W = Math.round(bmp.width * k), H = Math.round(bmp.height * k);
    const full = canvas(W, H), fg = ctx(full); fg.fillStyle = '#fff'; fg.fillRect(0, 0, W, H); fg.imageSmoothingQuality = 'high'; fg.drawImage(bmp, 0, 0, W, H);
    // small working copy
    const s = Math.min(1, 640 / Math.max(W, H)), w = Math.max(2, Math.round(W * s)), h = Math.max(2, Math.round(H * s));
    const sm = canvas(w, h), sg = ctx(sm); sg.imageSmoothingQuality = 'high'; sg.drawImage(full, 0, 0, w, h);
    const sd = sg.getImageData(0, 0, w, h).data;
    // background colour around the edge of the photo: if it's already pure white, leave the photo alone
    let br = 0, bgc = 0, bb = 0, n = 0, dev = 0;
    const edge = []; for (let x = 0; x < w; x++) edge.push(x, (h - 1) * w + x); for (let y = 1; y < h - 1; y++) edge.push(y * w, y * w + w - 1);
    edge.forEach(i => { br += sd[i * 4]; bgc += sd[i * 4 + 1]; bb += sd[i * 4 + 2]; n++; }); br /= n; bgc /= n; bb /= n;
    edge.forEach(i => { dev = Math.max(dev, Math.abs(sd[i * 4] - br), Math.abs(sd[i * 4 + 1] - bgc), Math.abs(sd[i * 4 + 2] - bb)); });
    if (br > 248 && bgc > 248 && bb > 248 && dev < 10) return { blob: await toJpeg(full), changed: false };
    // 1. the model finds the piece
    const M = 320, mc = canvas(M, M), mg = ctx(mc); mg.imageSmoothingQuality = 'high'; mg.drawImage(full, 0, 0, M, M);
    const md = mg.getImageData(0, 0, M, M).data, inp = new Float32Array(3 * M * M);
    const mean = [0.485, 0.456, 0.406], std = [0.229, 0.224, 0.225];
    for (let i = 0; i < M * M; i++) for (let c = 0; c < 3; c++) inp[c * M * M + i] = (md[i * 4 + c] / 255 - mean[c]) / std[c];
    const res = await sess.run({ [sess.inputNames[0]]: new ort.Tensor('float32', inp, [1, 3, M, M]) });
    const o = res[sess.outputNames[0]].data; let lo = Infinity, hi = -Infinity; for (const v of o) { if (v < lo) lo = v; if (v > hi) hi = v; }
    const m320 = new Float32Array(M * M); for (let i = 0; i < M * M; i++) m320[i] = (o[i] - lo) / (hi - lo + 1e-8);
    const [m] = scaleMaps([m320], M, M, w, h);
    const a0 = new Float32Array(w * h); for (let i = 0; i < w * h; i++) a0[i] = Math.min(1, Math.max(0, (m[i] - 0.1) / 0.4));
    // 2. estimate the background colour behind the piece (copes with gradients)
    const R = Math.max(2, Math.round(Math.max(w, h) * 0.03));
    const wt = new Float32Array(w * h), cr = new Float32Array(w * h), cg = new Float32Array(w * h), cb = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) { const q = 1 - a0[i] + 1e-4; wt[i] = q; cr[i] = sd[i * 4] / 255 * q; cg[i] = sd[i * 4 + 1] / 255 * q; cb[i] = sd[i * 4 + 2] / 255 * q; }
    blur(wt, w, h, R); blur(cr, w, h, R); blur(cg, w, h, R); blur(cb, w, h, R);
    for (let i = 0; i < w * h; i++) { cr[i] /= wt[i]; cg[i] /= wt[i]; cb[i] /= wt[i]; }
    // 3. on darker backdrops, clear background-coloured gaps inside the piece (e.g. the middle of a ring)
    if ((br + bgc + bb) / 3 < 200) {
      const hole = new Float32Array(w * h);
      for (let i = 0; i < w * h; i++) { const d = Math.max(Math.abs(sd[i * 4] / 255 - cr[i]), Math.abs(sd[i * 4 + 1] / 255 - cg[i]), Math.abs(sd[i * 4 + 2] / 255 - cb[i])); hole[i] = d < 0.035 ? 1 : 0; }
      blur(hole, w, h, 2); for (let i = 0; i < w * h; i++) if (hole[i] > 0.9) a0[i] = 0;
    }
    // 4. "near the piece" zone, where anything not background-coloured is always kept
    const rn = Math.max(2, Math.round(Math.max(w, h) * 0.015)), near = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) near[i] = a0[i] > 0.5 ? 1 : 0;
    blur(near, w, h, rn); for (let i = 0; i < w * h; i++) near[i] = Math.min(1, near[i] * 4);
    // 5. full-size pass: paint the background white
    const [A, N, BR, BG] = scaleMaps([a0, near, cr, cg], w, h, W, H); const [BB] = scaleMaps([cb], w, h, W, H);
    const img = fg.getImageData(0, 0, W, H), d = img.data;
    for (let i = 0, p = 0; i < W * H; i++, p += 4) {
      const diff = Math.max(Math.abs(d[p] - BR[i] * 255), Math.abs(d[p + 1] - BG[i] * 255), Math.abs(d[p + 2] - BB[i] * 255));
      const keep = Math.min(1, Math.max(0, (diff - 14) / 20)) * N[i];
      const a = Math.max(A[i], keep);
      if (a < 1) { d[p] += (255 - d[p]) * (1 - a); d[p + 1] += (255 - d[p + 1]) * (1 - a); d[p + 2] += (255 - d[p + 2]) * (1 - a); }
    }
    fg.putImageData(img, 0, 0);
    return { blob: await toJpeg(full), changed: true };
  }

  // Public: returns { blob (JPEG), changed }. Falls back to the simple method if the AI can't run.
  S.whiteBgAI = async (file, basic) => {
    try { return await aiWhite(file); }
    catch (e) { console.warn('AI background removal unavailable, using the simple method', e); if (basic) return basic(file); throw e; }
  };
})();
