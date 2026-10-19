(function () {
  'use strict';
  const E = window.TearEngine;
  const $ = (id) => document.getElementById(id);
  const LS_ESTADO = 'tf_estado', LS_PROJ = 'tf_projetos';

  let cfg = E.defaults();
  try {
    const s = JSON.parse(localStorage.getItem(LS_ESTADO));
    if (s && s.motif) cfg = E.norm(s);
  } catch (e) { /* sem armazenamento */ }
  const ui = { tool: 'paint', zoom: 2, reps: 2 };
  let res = null;

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = (v, d) => (isFinite(v) ? Number(v).toLocaleString('pt-BR', { maximumFractionDigits: d == null ? 1 : d }) : '—');
  const ESTR = { chapado: 'chapado', duplo: 'duplo', tubular: 'tubular' };

  // ---------- Persistência ----------
  function persist() { try { localStorage.setItem(LS_ESTADO, JSON.stringify(cfg)); } catch (e) { /* ignora */ } }
  function projetos() { try { return JSON.parse(localStorage.getItem(LS_PROJ)) || {}; } catch (e) { return {}; } }
  function setProjetos(p) { try { localStorage.setItem(LS_PROJ, JSON.stringify(p)); } catch (e) { alert('Não foi possível salvar neste navegador.'); } }

  // ---------- Atualização ----------
  let pend = false;
  function schedule() {
    if (pend) return;
    pend = true;
    requestAnimationFrame(() => { pend = false; update(); });
  }

  function update() {
    cfg = E.norm(cfg);
    res = E.build(cfg);
    persist();
    drawGrid();
    renderLigs();
    renderResumo();
    renderAvisos();
    renderAlts();
    renderImagens();
    renderQuadros();
    renderCorrente();
    renderProducao();
  }

  // ---------- Entradas ----------
  const numFields = ['gap', 'fiosFundo', 'fiosDetalhe', 'fiosOurela', 'ourela', 'minPecas', 'maxPecas', 'maxQuadros', 'maxFlut'];
  const prodFields = ['bpm', 'bpcm', 'fiosCm', 'metros'];
  const colorFields = { cFundo: 'fundo', cDetalhe: 'detalhe', cTrama: 'trama', cOurela: 'ourela' };

  function syncInputs() {
    numFields.forEach((k) => { $(k).value = cfg[k] === 0 && (k === 'maxPecas' || k === 'maxQuadros') ? '' : cfg[k]; });
    prodFields.forEach((k) => { $(k).value = cfg.prod[k]; });
    Object.keys(colorFields).forEach((id) => { $(id).value = cfg.cores[colorFields[id]]; });
    $('mw').value = cfg.motif.w;
    $('mh').value = cfg.motif.h;
    $('detalheMode').value = cfg.detalheMode;
    $('verso').checked = cfg.versoLegivel;
    $('intercala').checked = cfg.intercala;
    document.querySelectorAll('input[name=estrutura]').forEach((r) => { r.checked = r.value === cfg.estrutura; });
  }

  function bind() {
    numFields.forEach((k) => {
      $(k).addEventListener('input', () => { cfg[k] = $(k).value === '' ? 0 : Number($(k).value); schedule(); });
    });
    prodFields.forEach((k) => {
      $(k).addEventListener('input', () => { cfg.prod[k] = $(k).value; schedule(); });
    });
    Object.keys(colorFields).forEach((id) => {
      $(id).addEventListener('input', () => { cfg.cores[colorFields[id]] = $(id).value; schedule(); });
    });
    $('detalheMode').addEventListener('change', () => { cfg.detalheMode = $('detalheMode').value; schedule(); });
    $('verso').addEventListener('change', () => { cfg.versoLegivel = $('verso').checked; schedule(); });
    $('intercala').addEventListener('change', () => { cfg.intercala = $('intercala').checked; schedule(); });
    document.querySelectorAll('input[name=estrutura]').forEach((r) => {
      r.addEventListener('change', () => { if (r.checked) { cfg.estrutura = r.value; schedule(); } });
    });

    // Preset
    const sel = $('preset');
    sel.innerHTML = '<option value="">Escolher modelo…</option>' + E.PRESETS.map((p) => `<option value="${p.id}">${esc(p.nome)}</option>`).join('');
    sel.addEventListener('change', () => {
      const p = E.PRESETS.find((x) => x.id === sel.value);
      if (p) { cfg.motif = E.motifFromRows(p.rows); syncInputs(); schedule(); }
      sel.value = '';
    });

    // Tamanho do motivo
    const resize = () => {
      const w = Math.max(1, Math.min(80, parseInt($('mw').value, 10) || 1));
      const h = Math.max(1, Math.min(120, parseInt($('mh').value, 10) || 1));
      const cells = [];
      for (let r = 0; r < h; r++) {
        const row = [];
        for (let c = 0; c < w; c++) row.push(cfg.motif.cells[r] && cfg.motif.cells[r][c] ? 1 : 0);
        cells.push(row);
      }
      cfg.motif = { w, h, cells };
      schedule();
    };
    $('mw').addEventListener('change', resize);
    $('mh').addEventListener('change', resize);

    // Ferramentas
    document.querySelectorAll('[data-tool]').forEach((b) => {
      b.addEventListener('click', () => {
        ui.tool = b.dataset.tool;
        document.querySelectorAll('[data-tool]').forEach((x) => x.classList.toggle('on', x === b));
      });
    });
    $('btnLimpar').addEventListener('click', () => { cfg.motif.cells = cfg.motif.cells.map((r) => r.map(() => 0)); schedule(); });
    $('btnInverter').addEventListener('click', () => { cfg.motif.cells = cfg.motif.cells.map((r) => r.map((v) => (v ? 0 : 1))); schedule(); });
    $('btnEspelhar').addEventListener('click', () => { cfg.motif.cells = cfg.motif.cells.map((r) => r.slice().reverse()); schedule(); });

    // Visualização
    $('zoom').addEventListener('input', () => { ui.zoom = Number($('zoom').value); renderImagens(); });
    $('reps').addEventListener('change', () => { ui.reps = Number($('reps').value); renderImagens(); });
    $('btnPng').addEventListener('click', () => {
      baixarCanvas($('cvFrente'), 'fita-frente.png');
      setTimeout(() => baixarCanvas($('cvVerso'), 'fita-verso.png'), 300);
    });

    // Exportações
    $('btnCopiar').addEventListener('click', copiarTabela);
    $('btnCsv').addEventListener('click', () => baixarTexto(E.csv(res), 'corrente.csv', 'text/csv'));
    $('btnPrint').addEventListener('click', () => window.print());

    // Projetos
    $('btnSalvar').addEventListener('click', () => {
      const nome = $('pNome').value.trim();
      if (!nome) { $('pNome').focus(); return; }
      const p = projetos();
      p[nome] = JSON.parse(JSON.stringify(cfg));
      setProjetos(p);
      renderProjetos();
    });
    $('btnExport').addEventListener('click', () => baixarTexto(JSON.stringify(cfg, null, 2), 'desenho-fita.json', 'application/json'));
    $('fileImp').addEventListener('change', (ev) => {
      const f = ev.target.files[0];
      if (!f) return;
      const rd = new FileReader();
      rd.onload = () => {
        try { cfg = E.norm(JSON.parse(rd.result)); syncInputs(); schedule(); }
        catch (e) { alert('Arquivo inválido.'); }
      };
      rd.readAsText(f);
      ev.target.value = '';
    });
    $('btnReset').addEventListener('click', () => {
      if (confirm('Voltar tudo ao padrão? O desenho atual será perdido.')) { cfg = E.defaults(); syncInputs(); schedule(); }
    });
  }

  // ---------- Grade de pintura ----------
  const grid = $('grid');
  let cell = 28, gut = 26;

  function drawGrid() {
    const { w, h, cells } = cfg.motif;
    const avail = Math.max(240, (grid.parentElement.clientWidth || 340) - gut - 4);
    cell = Math.max(12, Math.min(40, Math.floor(avail / w)));
    const W = gut + w * cell, H = h * cell + 1;
    const dpr = window.devicePixelRatio || 1;
    grid.width = Math.ceil(W * dpr);
    grid.height = Math.ceil(H * dpr);
    grid.style.width = W + 'px';
    grid.style.height = H + 'px';
    const g = grid.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const css = getComputedStyle(document.documentElement);
    const cInk = css.getPropertyValue('--ink').trim() || '#000';
    const cLine = css.getPropertyValue('--line').trim() || '#ccc';
    const cMuted = css.getPropertyValue('--muted').trim() || '#666';
    g.clearRect(0, 0, W, H);
    g.font = '11px system-ui, sans-serif';
    g.textAlign = 'right';
    g.textBaseline = 'middle';
    for (let r = 0; r < h; r++) {
      g.fillStyle = cMuted;
      g.fillText(String(r + 1), gut - 4, r * cell + cell / 2);
      for (let c = 0; c < w; c++) {
        g.fillStyle = cells[r][c] ? cfg.cores.detalhe : 'rgba(128,128,128,0.10)';
        g.fillRect(gut + c * cell + 1, r * cell + 1, cell - 1, cell - 1);
      }
    }
    g.strokeStyle = cLine;
    g.lineWidth = 1;
    g.beginPath();
    for (let c = 0; c <= w; c++) { g.moveTo(gut + c * cell + 0.5, 0); g.lineTo(gut + c * cell + 0.5, h * cell); }
    for (let r = 0; r <= h; r++) { g.moveTo(gut, r * cell + 0.5); g.lineTo(gut + w * cell, r * cell + 0.5); }
    g.stroke();
    g.fillStyle = cInk;
  }

  let painting = false;
  function paintAt(ev) {
    const rect = grid.getBoundingClientRect();
    const x = ev.clientX - rect.left - gut, y = ev.clientY - rect.top;
    const c = Math.floor(x / cell), r = Math.floor(y / cell);
    const { w, h } = cfg.motif;
    if (c < 0 || r < 0 || c >= w || r >= h) return;
    const v = ui.tool === 'paint' ? 1 : 0;
    if (cfg.motif.cells[r][c] !== v) { cfg.motif.cells[r][c] = v; schedule(); }
  }
  grid.addEventListener('pointerdown', (ev) => { painting = true; grid.setPointerCapture(ev.pointerId); paintAt(ev); ev.preventDefault(); });
  grid.addEventListener('pointermove', (ev) => { if (painting) paintAt(ev); });
  const stop = () => { painting = false; };
  grid.addEventListener('pointerup', stop);
  grid.addEventListener('pointercancel', stop);
  window.addEventListener('resize', () => { if (res) drawGrid(); });

  // ---------- Ligamentos ----------
  function renderLigs() {
    const alts = E.alternativas(cfg).filter((a) => a.estrutura === cfg.estrutura);
    const box = $('ligs');
    box.innerHTML = '';
    E.LIGAMENTOS.forEach((l) => {
      const a = alts.find((x) => x.ligamento === l.id);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'lig' + (cfg.ligamento === l.id ? ' sel' : '') + (a && !a.ok ? ' bad' : '');
      b.innerHTML = '<canvas width="64" height="64"></canvas><div><b>' + esc(l.nome) + '</b><small>' + esc(l.desc) + '</small><div class="st">' + a.quadros + ' quadros · ' + a.pecas + ' peças</div></div>';
      miniatura(b.querySelector('canvas'), l.rows);
      b.addEventListener('click', () => { cfg.ligamento = l.id; schedule(); });
      box.appendChild(b);
    });
  }

  function miniatura(cv, rows) {
    const P = rows.length, Q = rows[0].length, s = Math.floor(60 / Math.max(P, Q));
    const g = cv.getContext('2d');
    const ox = Math.floor((64 - Q * s) / 2), oy = Math.floor((64 - P * s) / 2);
    g.clearRect(0, 0, 64, 64);
    for (let i = 0; i < P; i++) for (let j = 0; j < Q; j++) {
      g.fillStyle = rows[i][j] ? cfg.cores.fundo : cfg.cores.trama;
      g.fillRect(ox + j * s, oy + i * s, s - 1, s - 1);
    }
  }

  // ---------- Resultado ----------
  function metric(label, val, bad) { return `<div class="metric${bad ? ' bad' : ''}"><span>${esc(label)}</span><b>${val}</b></div>`; }

  function renderResumo() {
    const r = res, c = r.cfg;
    const badQ = c.maxQuadros && r.quadros > c.maxQuadros;
    const badP = c.maxPecas && r.pecas > c.maxPecas;
    $('resumo').innerHTML =
      metric('Quadros', r.quadros, badQ) +
      metric('Peças (corrente)', r.pecas, badP) +
      metric('Total de fios', r.fiosTotal) +
      metric('Liços', r.licos) +
      metric('Repetições na corrente', r.k + '×') +
      metric('Flutuação máx. (passadas)', r.flut.max || '—', c.maxFlut && r.flut.max > c.maxFlut);
  }

  function renderAvisos() {
    $('avisos').innerHTML = res.avisos.map((a) => `<div class="av ${a.nivel}">${esc(a.msg)}</div>`).join('');
  }

  function renderAlts() {
    const box = $('alts');
    const c = res.cfg;
    const viol = (c.maxQuadros && res.quadros > c.maxQuadros) || (c.maxPecas && res.pecas > c.maxPecas);
    if (!viol) { box.innerHTML = ''; return; }
    const alts = E.alternativas(c).filter((a) => a.ok && !(a.estrutura === c.estrutura && a.ligamento === c.ligamento));
    alts.sort((a, b) => (a.estrutura === c.estrutura ? 0 : 1) - (b.estrutura === c.estrutura ? 0 : 1) || a.quadros - b.quadros || a.pecas - b.pecas);
    const dist = E.alternativasDistancia(c).filter((a) => a.ok).sort((a, b) => Math.abs(a.gap - c.gap) - Math.abs(b.gap - c.gap)).slice(0, 4);
    let h = '<div class="alts"><b>Alternativas que respeitam os limites</b>';
    if (alts.length) {
      h += '<div class="chips">' + alts.slice(0, 8).map((a, i) => `<button type="button" class="chip" data-alt="${i}">${esc(a.nome)} · ${ESTR[a.estrutura]} — ${a.quadros} quadros, ${a.pecas} peças</button>`).join('') + '</div>';
    }
    if (dist.length) {
      h += '<div class="chips">' + dist.map((a, i) => `<button type="button" class="chip" data-dist="${i}">Distância ${a.gap} — ${a.quadros} quadros, ${a.pecas} peças</button>`).join('') + '</div>';
    }
    if (!alts.length && !dist.length) h += '<p class="hint">Nenhuma combinação cabe nos limites. Reduza a largura do desenho, a altura ou aumente o limite.</p>';
    h += '</div>';
    box.innerHTML = h;
    box.querySelectorAll('[data-alt]').forEach((b) => b.addEventListener('click', () => {
      const a = alts[Number(b.dataset.alt)];
      cfg.estrutura = a.estrutura; cfg.ligamento = a.ligamento; syncInputs(); schedule();
    }));
    box.querySelectorAll('[data-dist]').forEach((b) => b.addEventListener('click', () => {
      cfg.gap = dist[Number(b.dataset.dist)].gap; syncInputs(); schedule();
    }));
  }

  function renderQuadros() {
    let h = '<thead><tr><th>Quadro</th><th>Tipo</th><th>Liços</th><th>Fios</th></tr></thead><tbody>';
    res.frames.forEach((f) => { h += `<tr><td>Q${f.n}</td><td>${esc(f.tipo)}</td><td>${f.licos}</td><td>${f.fios}</td></tr>`; });
    h += `<tr><td><b>Total</b></td><td></td><td><b>${res.licos}</b></td><td><b>${res.fiosTotal}</b></td></tr></tbody>`;
    $('tbQuadros').innerHTML = h;
  }

  const MAXROWS = 400;
  function renderCorrente() {
    const rows = E.chainRows(res);
    let h = '<thead><tr><th>Peça</th>' + res.frames.map((f) => `<th>Q${f.n}</th>`).join('') + '</tr></thead><tbody>';
    rows.slice(0, MAXROWS).forEach((r, i) => {
      h += `<tr><td>${i + 1}</td>` + r.map((v) => `<td class="${v}">${v}</td>`).join('') + '</tr>';
    });
    h += '</tbody>';
    $('tbCorrente').innerHTML = h;
    // passagem
    const p = res.passagem;
    const lines = [];
    for (let i = 0; i < p.length; i += 12) {
      lines.push(String(i + 1).padStart(3, ' ') + '–' + String(Math.min(i + 12, p.length)).padEnd(3, ' ') + ' ' + p.slice(i, i + 12).map((n) => 'Q' + n).join(' '));
    }
    const nota = res.estrutura === 'chapado' ? '' : '\nOrdem no tear: fio de frente e fio de verso intercalados' + (res.estrutura === 'tubular' ? ', com uma borda de tubo em cada ponta.' : '.');
    $('passagem').textContent = lines.join('\n') + nota + (rows.length > MAXROWS ? `\n(Tabela mostra as primeiras ${MAXROWS} de ${rows.length} peças; o CSV tem todas.)` : '');
  }

  function renderProducao() {
    const p = res.producao || {};
    const items = [];
    if (p.cmMin != null) {
      items.push(metric('Velocidade', fmt(p.cmMin, 2) + ' cm/min'));
      items.push(metric('Produção', fmt(p.mHora, 2) + ' m/h'));
      items.push(metric('Tempo por metro', fmt(p.minPorMetro, 1) + ' min'));
      items.push(metric('Turno de 8 h', fmt(p.mTurno8h, 1) + ' m'));
      if (p.horasMetros != null) items.push(metric('Tempo para ' + fmt(Number(String(cfg.prod.metros).replace(',', '.')), 0) + ' m', fmt(p.horasMetros, 1) + ' h'));
    }
    if (p.correnteMm != null) {
      items.push(metric('Corrente completa', fmt(p.correnteMm, 1) + ' mm'));
      items.push(metric('Passo entre desenhos', fmt(p.passoMm, 1) + ' mm'));
      items.push(metric('Altura do desenho', fmt(p.alturaMm, 1) + ' mm'));
    }
    if (p.larguraMm != null) items.push(metric('Largura da fita', fmt(p.larguraMm, 1) + ' mm'));
    $('prodOut').innerHTML = items.length ? items.join('') : '<p class="hint">Preencha batidas por minuto e batidas por cm para calcular a produção. Informe fios por cm para estimar a largura.</p>';
  }

  // ---------- Imagem da fita ----------
  function shadeHex(hex, amt) {
    const n = parseInt(hex.replace('#', ''), 16);
    const f = (v) => Math.max(0, Math.min(255, Math.round(v + (amt < 0 ? v * amt : (255 - v) * amt))));
    return 'rgb(' + f(n >> 16) + ',' + f((n >> 8) & 255) + ',' + f(n & 255) + ')';
  }

  function drawView(cv, v, colors, zoom) {
    const u = 3 * zoom, rh = Math.round(4.5 * zoom);
    let W = 0;
    const xs = v.cols.map((c) => { const x = W; W += c.w * u; return x; });
    const H = Math.max(1, v.rows.length * rh);
    const dpr = window.devicePixelRatio || 1;
    cv.width = Math.ceil(W * dpr);
    cv.height = Math.ceil(H * dpr);
    cv.style.width = W + 'px';
    cv.style.height = H + 'px';
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#0b0b0b';
    g.fillRect(0, 0, W, H);
    const col = { g: colors.fundo, d: colors.detalhe, o: colors.ourela, t: colors.trama };
    for (let r = 0; r < v.rows.length; r++) {
      const y = r * rh;
      for (let c = 0; c < v.cols.length; c++) {
        const k = v.rows[r][c], cw = v.cols[c].w * u, x = xs[c];
        g.fillStyle = col[k];
        if (k === 't') {
          g.fillRect(x, y + 0.5, cw, rh - 1);
          g.fillStyle = 'rgba(255,255,255,0.20)';
          g.fillRect(x, y + rh * 0.32, cw, rh * 0.26);
          g.fillStyle = 'rgba(0,0,0,0.30)';
          g.fillRect(x, y + 0.5, cw, rh * 0.14);
          g.fillRect(x, y + rh - 0.5 - rh * 0.14, cw, rh * 0.14);
        } else {
          for (let t = 0; t < v.cols[c].w; t++) {
            const tx = x + t * u;
            g.fillStyle = col[k];
            g.fillRect(tx + 0.4, y, u - 0.8, rh);
            g.fillStyle = 'rgba(255,255,255,0.22)';
            g.fillRect(tx + u * 0.3, y, u * 0.28, rh);
            g.fillStyle = 'rgba(0,0,0,0.30)';
            g.fillRect(tx + 0.4, y, u * 0.16, rh);
            g.fillRect(tx + u - 0.4 - u * 0.16, y, u * 0.16, rh);
            g.fillStyle = 'rgba(0,0,0,0.28)';
            g.fillRect(tx + 0.4, y, u - 0.8, rh * 0.16);
            g.fillRect(tx + 0.4, y + rh - rh * 0.16, u - 0.8, rh * 0.16);
          }
        }
      }
    }
  }

  function renderImagens() {
    if (!res) return;
    const vf = E.view(res, 'f', ui.reps), vb = E.view(res, 'b', ui.reps);
    drawView($('cvFrente'), vf, cfg.cores, ui.zoom);
    drawView($('cvVerso'), vb, cfg.cores, ui.zoom);
  }

  // ---------- Exportações ----------
  function baixarBlob(blob, nome) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  function baixarTexto(txt, nome, tipo) { baixarBlob(new Blob([txt], { type: tipo + ';charset=utf-8' }), nome); }
  function baixarCanvas(cv, nome) { cv.toBlob((b) => { if (b) baixarBlob(b, nome); }); }

  function copiarTabela() {
    const rows = E.chainRows(res);
    const txt = ['Peça\t' + res.frames.map((f) => 'Q' + f.n).join('\t')].concat(rows.map((r, i) => (i + 1) + '\t' + r.join('\t'))).join('\n');
    const ok = () => { $('btnCopiar').textContent = 'Copiado'; setTimeout(() => { $('btnCopiar').textContent = 'Copiar tabela'; }, 1500); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(ok, () => alert('Não foi possível copiar.'));
    else { const ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); ok(); } catch (e) { alert('Não foi possível copiar.'); } ta.remove(); }
  }

  // ---------- Projetos ----------
  function renderProjetos() {
    const p = projetos(), box = $('pLista');
    const nomes = Object.keys(p);
    if (!nomes.length) { box.innerHTML = '<p class="hint">Nenhum projeto salvo neste aparelho.</p>'; return; }
    box.innerHTML = nomes.map((n, i) => `<div class="pitem"><span>${esc(n)}</span><span><button class="btn" data-open="${i}">Abrir</button> <button class="btn" data-del="${i}">Excluir</button></span></div>`).join('');
    box.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => {
      cfg = E.norm(p[nomes[Number(b.dataset.open)]]); syncInputs(); schedule();
    }));
    box.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => {
      const n = nomes[Number(b.dataset.del)];
      if (confirm('Excluir "' + n + '"?')) { delete p[n]; setProjetos(p); renderProjetos(); }
    }));
  }

  // ---------- Instalação (PWA) ----------
  let deferred = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; $('btnInstalar').hidden = false; });
  $('btnInstalar').addEventListener('click', async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice;
    deferred = null;
    $('btnInstalar').hidden = true;
  });
  window.addEventListener('appinstalled', () => { $('btnInstalar').hidden = true; });
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
  }

  // ---------- Início ----------
  syncInputs();
  bind();
  renderProjetos();
  update();
})();
