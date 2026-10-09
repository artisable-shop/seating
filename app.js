// Artisable seating chart editor. Tek yerlesim hesabi (layout) hem onizlemeyi hem PDF'i besler,
// boylece ekranda gorulen ile inen dosya ayni olur. Her sey tarayicida calisir; liste cihazdan cikmaz.
// Olculer inch; PDF'te 1 in = 72 pt, onizlemede 1 in = 96 css px. Yerlesim seating.py ile ayni.
(() => {
  const W = 18, H = 24, PX = 96, PT = 72, LH = 1.15;
  const NUMS = ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
    'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen', 'Twenty',
    'Twenty-One', 'Twenty-Two', 'Twenty-Three', 'Twenty-Four'];
  const MAX_TABLES = 24, MAX_GUESTS = 14;
  const SAMPLE_FIRST = ['Olivia', 'Liam', 'Emma', 'Noah', 'Ava', 'Lucas', 'Sophia', 'Mason', 'Isabella', 'Ethan', 'Mia', 'Henry',
    'Amelia', 'Jack', 'Harper', 'Owen', 'Evelyn', 'Leo', 'Abigail', 'Caleb', 'Ella', 'Julian', 'Grace', 'Wyatt'];
  const SAMPLE_LAST = ['Bennett', 'Carter', 'Hayes', 'Morgan', 'Brooks', 'Foster', 'Reed', 'Parker', 'Sullivan', 'Ellis',
    'Coleman', 'Harper', 'Price', 'Wells', 'Porter', 'Hughes'];

  const $ = id => document.getElementById(id);
  const store = {
    get(k) { try { return localStorage.getItem('artisable-seating:' + k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem('artisable-seating:' + k, v); } catch (e) { /* gizli pencere vb. */ } },
  };

  // Masa modeli: her masa ayri kutu {name, guests(text, satir basina bir isim)}.
  // Ilk surum tek metin kutusunda "bos satir = masa, 'Ad:' = masa adi" kurali kullaniyordu; operator
  // (9 Ekim) "anlamadim, yapamadim" dedi -> her masa icin ayri kutu + "listeyi masalara dagit".
  let tables = [];
  const autoName = (i, numbering) => numbering === 'num' ? `Table ${i + 1}` : `Table ${NUMS[i] || i + 1}`;

  function sampleTables() {
    const out = [];
    for (let t = 0; t < 12; t++) {
      const g = [];
      for (let i = 0; i < 8; i++) g.push(`${SAMPLE_FIRST[(t * 8 + i) % 24]} ${SAMPLE_LAST[(t * 5 + i * 3) % 16]}`);
      out.push({ name: '', guests: g.join('\n') });
    }
    return out;
  }

  const lines = text => text.replace(/\r/g, '').split('\n').map(s => s.trim()).filter(Boolean);

  function splitList(text, perTable) {
    const names = lines(text), out = [];
    for (let i = 0; i < names.length; i += perTable) out.push({ name: '', guests: names.slice(i, i + perTable).join('\n') });
    return out;
  }

  function toTables(list, numbering) {
    return list.map((t, i) => ({ name: (t.name || '').trim() || autoName(i, numbering), guests: lines(t.guests || '') }));
  }

  // ---- yerlesim: [{kind:'text'|'img', ...}] (inch) ----
  function layout(d, measure) {
    const items = [];
    const T = d.theme;
    const dim = k => THEMES[T].dims[k];
    const img = (key, x, y, w) => items.push({ kind: 'img', key, x, y, w, h: w * dim(key)[1] / dim(key)[0] });
    const cluB = 5.6, hB = cluB * dim('cb-xy')[1] / dim('cb-xy')[0];
    img('ca', -0.5, -0.5, 7.4);
    img('ca-x', W + 0.5 - 7.4, -0.5, 7.4);
    img('cb-xy', W + 0.45 - cluB, H + 0.45 - hB, cluB);
    img('cb-y', -0.45, H + 0.45 - hB, cluB);
    img('title', (W - 10) / 2, 1.35, 10);
    img('divider', (W - 4.2) / 2, 4.35, 4.2);

    // Metin kutusu: ortali, tek satir; sigmazsa punto kuculur (olcum PDF fontuyla yapilir).
    const warn = [];
    const text = (s, x, y, w, size, color, minSize) => {
      if (!s) return;
      let sz = size;
      const room = w * PT - 6;
      while (sz > minSize && measure(s, sz) > room) sz -= 0.5;
      if (measure(s, sz) > room) warn.push(`"${s}" is too long and may be cut off - try a shorter version.`);
      items.push({ kind: 'text', s, x, y: y + (size - sz) * LH / 2 / PT, w, size: sz, color });
    };
    text(d.names, 3, 3.0, 12, 66, 'ink', 30);
    text(d.date, 4, 21.75, 10, 26, 'ink', 16);

    const tables = d.tables.slice(0, MAX_TABLES);
    if (d.tables.length > MAX_TABLES) warn.push(`Only the first ${MAX_TABLES} tables fit on one chart (you have ${d.tables.length}).`);
    const n = tables.length;
    if (n) {
      const cols = n <= 4 ? n : n <= 12 ? 4 : n <= 15 ? 5 : 6;
      const rows = Math.ceil(n / cols);
      const gridW = 15.1, cw = gridW / Math.max(cols, 3);
      const usedW = cw * cols, xs = (W - usedW) / 2;
      const area = rows <= 3 ? 15.0 : 15.7;
      const maxG = Math.min(MAX_GUESTS, Math.max(...tables.map(t => t.guests.length), 1));
      if (tables.some(t => t.guests.length > MAX_GUESTS)) warn.push(`Tables are limited to ${MAX_GUESTS} guests; extra names are left out.`);
      const need = 0.72 + maxG * 0.44 + 0.25;              // tam boy bir masa blogu
      const rh = Math.min(5.0, area / rows);
      const s = Math.min(1, rh / need, cols > 4 ? 4 / cols * 1.15 : 1);
      if (s < 0.6) warn.push('That is a lot of names for one chart - the text is getting small. Consider two charts.');
      // 12 masa / 3 sira tam alani doldurur (seating.py ile ayni, y0 = 5.6); az masa dikeyde ortalanir.
      const blockH = rows * rh, y0 = 5.6 + Math.max(0, (area - blockH) / 2);
      tables.forEach((t, k) => {
        const r = Math.floor(k / cols), c = k % cols;
        const inRow = Math.min(cols, n - r * cols);
        const xr = xs + (cols - inRow) * cw / 2;            // son eksik sira ortalanir
        const x = xr + c * cw, y = y0 + r * rh;
        text(t.name, x, y, cw, 30 * s, 'accent', 14);
        t.guests.slice(0, MAX_GUESTS).forEach((g, i) => text(g, x, y + (0.72 + i * 0.44) * s, cw, 19 * s, 'ink', 9));
      });
    }
    return { items, warn };
  }

  // ---- onizleme ----
  function renderPreview(L, d) {
    const th = THEMES[d.theme];
    const pg = $('page');
    pg.style.background = th.paper;
    pg.style.setProperty('--ink', th.ink);
    pg.style.setProperty('--accent', th.accent);
    const parts = ['<div class="frame"></div>'];
    for (const it of L.items) {
      if (it.kind === 'img') {
        parts.push(`<img alt="" src="assets/${d.theme}-${it.key}.png" style="left:${it.x * PX}px;top:${it.y * PX}px;width:${it.w * PX}px;height:${it.h * PX}px">`);
      } else {
        const el = document.createElement('div'); el.textContent = it.s;
        parts.push(`<div class="t" style="left:${it.x * PX}px;top:${it.y * PX}px;width:${it.w * PX}px;font-size:${it.size}pt;color:var(--${it.color})">${el.innerHTML}</div>`);
      }
    }
    pg.innerHTML = parts.join('');
    $('warn').innerHTML = L.warn.map(w => `<li>${w.replace(/</g, '&lt;')}</li>`).join('');
    $('warn').hidden = !L.warn.length;
    fit();
  }

  function fit() {
    const box = $('stage'), pg = $('page');
    const k = Math.min(box.clientWidth / (W * PX), (box.clientHeight || 1e9) / (H * PX));
    pg.style.transform = `scale(${k})`;
    box.style.height = H * PX * k + 'px';
  }

  // ---- PDF ----
  let fontBytes = null, measureFont = null;
  const imgCache = {};
  async function bytes(url) { const r = await fetch(url); if (!r.ok) throw new Error(url + ' ' + r.status); return r.arrayBuffer(); }

  async function initMeasure() {
    fontBytes = await bytes('fonts/EBGaramond.ttf');
    const doc = await PDFLib.PDFDocument.create();
    doc.registerFontkit(fontkit);
    measureFont = await doc.embedFont(fontBytes, { subset: false });
  }

  async function makePdf(L, d) {
    const { PDFDocument, rgb } = PDFLib;
    const hex = h => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
    const th = THEMES[d.theme];
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    doc.setTitle(`Seating Chart - ${d.names || 'Wedding'}`);
    doc.setCreator('Artisable seating chart editor');
    const font = await doc.embedFont(fontBytes, { subset: false });
    const page = doc.addPage([W * PT, H * PT]);
    page.drawRectangle({ x: 0, y: 0, width: W * PT, height: H * PT, color: hex(th.paper) });
    const ins = 0.55 * PT;
    page.drawRectangle({ x: ins, y: ins, width: W * PT - 2 * ins, height: H * PT - 2 * ins,
      borderColor: hex(th.accent), borderWidth: 1.125, borderOpacity: 0.5 });
    for (const it of L.items) {
      if (it.kind === 'img') {
        const url = `assets/${d.theme}-${it.key}.png`;
        imgCache[url] = imgCache[url] || await bytes(url);
        const im = await doc.embedPng(imgCache[url]);
        page.drawImage(im, { x: it.x * PT, y: (H - it.y - it.h) * PT, width: it.w * PT, height: it.h * PT });
      } else {
        const tw = font.widthOfTextAtSize(it.s, it.size);
        const asc = font.heightAtSize(it.size, { descender: false });
        const tot = font.heightAtSize(it.size);
        const base = it.y * PT + (LH * it.size - tot) / 2 + asc;   // CSS satir kutusundaki taban cizgisi
        page.drawText(it.s, { x: it.x * PT + (it.w * PT - tw) / 2, y: H * PT - base, size: it.size, font,
          color: hex(it.color === 'accent' ? th.accent : th.ink) });
      }
    }
    return doc.save();
  }

  // ---- form ----
  function read() {
    return { theme: $('theme').value, names: $('names').value.trim(), date: $('date').value.trim(),
      tables: toTables(tables, $('numbering').value) };
  }

  const esc = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  function cardCount(t) { const n = lines(t.guests).length; return `${n} guest${n === 1 ? '' : 's'}`; }

  function renderCards(focusIdx) {
    const num = $('numbering').value;
    $('tables').innerHTML = tables.map((t, i) => `
      <div class="card" data-i="${i}">
        <div class="card-head">
          <input class="tname" value="${esc(t.name)}" placeholder="${autoName(i, num)}" aria-label="Table ${i + 1} name" maxlength="40">
          <button type="button" class="rm" title="Remove this table" aria-label="Remove table ${i + 1}">&times;</button>
        </div>
        <textarea class="tguests" rows="${Math.min(10, Math.max(3, lines(t.guests).length + 1))}" placeholder="Type one guest name per line" aria-label="Guests at table ${i + 1}" spellcheck="false">${esc(t.guests)}</textarea>
        <div class="n">${cardCount(t)}</div>
      </div>`).join('');
    if (focusIdx != null) { const c = $('tables').querySelector(`[data-i="${focusIdx}"] .tguests`); if (c) { c.focus(); c.scrollIntoView({ block: 'center' }); } }
  }

  let timer = null, last = null;
  function update() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const d = read();
      for (const k of ['theme', 'names', 'date', 'per', 'numbering']) store.set(k, $(k).value);
      store.set('tables', JSON.stringify(tables));
      last = { d, L: layout(d, (s, sz) => measureFont.widthOfTextAtSize(s, sz)) };
      $('count').textContent = `${d.tables.length} table${d.tables.length === 1 ? '' : 's'}, ${d.tables.reduce((a, t) => a + t.guests.length, 0)} guests`;
      renderPreview(last.L, d);
    }, 120);
  }

  function wireCards() {
    const box = $('tables');
    box.addEventListener('input', e => {
      const card = e.target.closest('.card'); if (!card) return;
      const t = tables[+card.dataset.i];
      if (e.target.classList.contains('tname')) t.name = e.target.value;
      if (e.target.classList.contains('tguests')) {
        t.guests = e.target.value;
        e.target.rows = Math.min(10, Math.max(3, e.target.value.split('\n').length + 1));
        card.querySelector('.n').textContent = cardCount(t);
      }
      update();
    });
    box.addEventListener('click', e => {
      if (!e.target.classList.contains('rm')) return;
      const i = +e.target.closest('.card').dataset.i;
      const t = tables[i];
      if ((t.name.trim() || lines(t.guests).length) && !confirm('Remove this table and its guests?')) return;
      tables.splice(i, 1); renderCards(); update();
    });
    $('add').addEventListener('click', () => {
      if (tables.length >= MAX_TABLES) { alert(`One chart fits up to ${MAX_TABLES} tables.`); return; }
      tables.push({ name: '', guests: '' }); renderCards(tables.length - 1); update();
    });
    $('clearall').addEventListener('click', () => {
      if (!confirm('Remove all tables and guests and start with one empty table?')) return;
      tables = [{ name: '', guests: '' }]; renderCards(0); update();
    });
    $('sample').addEventListener('click', () => {
      if (tables.some(t => lines(t.guests).length) && !confirm('Replace your tables with the example?')) return;
      tables = sampleTables(); renderCards(); update();
    });
    $('split').addEventListener('click', () => {
      const per = Math.max(1, Math.min(MAX_GUESTS, +$('per').value || 8));
      const made = splitList($('bulk').value, per);
      if (!made.length) { alert('Paste your guest names into the box first - one name per line.'); return; }
      if (tables.some(t => lines(t.guests).length) && !confirm(`This replaces your current tables with ${made.length} new tables of ${per}. Continue?`)) return;
      tables = made.slice(0, MAX_TABLES); $('bulk').value = '';
      renderCards(); update();
      $('tables').scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
    $('numbering').addEventListener('input', () => renderCards());
  }

  async function download() {
    const btn = $('dl'); btn.disabled = true; const label = btn.textContent; btn.textContent = 'Preparing your PDF...';
    try {
      const out = await makePdf(last.L, last.d);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([out], { type: 'application/pdf' }));
      a.download = `seating-chart-${(last.d.names || 'wedding').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    } catch (e) {
      alert('Sorry, the PDF could not be created: ' + e.message);
    } finally { btn.disabled = false; btn.textContent = label; }
  }

  async function start() {
    const q = new URLSearchParams(location.search).get('theme');
    const defaults = { theme: THEMES[q] ? q : 'sage', names: 'Emma & James', date: 'June 14, 2027', per: '8', numbering: 'words' };
    for (const k in defaults) $(k).value = store.get(k) ?? defaults[k];
    if (THEMES[q]) $('theme').value = q;
    try { tables = JSON.parse(store.get('tables')) || null; } catch (e) { tables = null; }
    if (!Array.isArray(tables) || !tables.length) tables = sampleTables();
    await initMeasure();
    await document.fonts.load('20px EBG');
    renderCards();
    wireCards();
    for (const k of ['theme', 'names', 'date', 'numbering']) $(k).addEventListener('input', update);
    $('dl').addEventListener('click', download);
    addEventListener('resize', fit);
    $('dl').disabled = false;
    update();
  }
  start().catch(e => { $('warn').hidden = false; $('warn').innerHTML = `<li>Could not load the editor: ${e.message}</li>`; });
  window.__seating = { splitList, setTables: list => { tables = list; renderCards(); update(); }, layout: d => layout(d, (s, sz) => measureFont.widthOfTextAtSize(s, sz)), makePdf, read, get last() { return last; } };
})();
