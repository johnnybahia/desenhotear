/*
 * Motor de cálculo — Desenho para tear de fita (alto e baixo)
 * Sem dependências. Funciona no navegador (window.TearEngine) e no Node (require).
 *
 * Convenções:
 *   A = alto (fio levantado)   B = baixo (fio abaixado)
 *   Passada = 1 peça da corrente (1 batida de trama).
 *   Motivo pintado = fio de detalhe aparece na frente.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TearEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const gcd = (a, b) => { while (b) { const t = b; b = a % b; a = t; } return a; };
  const lcm = (a, b) => (a / gcd(a, b)) * b;
  const mk = (P, Q, fn) =>
    Array.from({ length: P }, (_, i) => Array.from({ length: Q }, (_, j) => (fn(i, j) ? 1 : 0)));
  const twill = (a, b) => { const n = a + b; return mk(n, n, (i, j) => ((((j - i) % n) + n) % n) < a); };

  // rows[passada][fio] = 1 quando o fio sobe (alto)
  const LIGAMENTOS = [
    { id: 'tafeta', nome: 'Tafetá 1/1', desc: 'Fio sobe e desce alternado. Firme e simples.', rows: mk(2, 2, (i, j) => (i + j) % 2 === 0) },
    { id: 'sarja21', nome: 'Sarja 2/1', desc: 'Diagonal: sobe 2, desce 1. Mais urdume na frente.', rows: twill(2, 1) },
    { id: 'sarja12', nome: 'Sarja 1/2', desc: 'Diagonal: sobe 1, desce 2. Mais trama na frente.', rows: twill(1, 2) },
    { id: 'sarja31', nome: 'Sarja 3/1', desc: 'Diagonal marcada, urdume dominante.', rows: twill(3, 1) },
    { id: 'sarja22', nome: 'Sarja 2/2', desc: 'Diagonal equilibrada, frente e verso parecidos.', rows: twill(2, 2) },
    { id: 'cetim5', nome: 'Cetim 5', desc: 'Superfície lisa e brilhante, poucos cruzamentos.', rows: mk(5, 5, (i, j) => j !== (2 * i) % 5) },
    { id: 'cetim8', nome: 'Cetim 8', desc: 'Ainda mais liso e macio. Exige muitos quadros.', rows: mk(8, 8, (i, j) => j !== (3 * i) % 8) },
    { id: 'esteira', nome: 'Esteira 2/2', desc: 'Tafetá duplo (2 fios e 2 passadas juntos). Aspecto de cesto.', rows: mk(4, 4, (i, j) => (((i >> 1) + (j >> 1)) % 2) === 0) },
    { id: 'espinha', nome: 'Espinha de peixe', desc: 'Sarja 2/2 que inverte a diagonal a cada 4 fios.', rows: mk(4, 8, (i, j) => { const jj = j < 4 ? j : 7 - j; return ((jj - i + 4) % 4) < 2; }) },
    { id: 'rips', nome: 'Rips (reps)', desc: 'Tafetá com 2 passadas iguais: nervuras transversais.', rows: mk(4, 2, (i, j) => (((i >> 1) + j) % 2) === 0) },
  ];
  const LIG = {};
  LIGAMENTOS.forEach((l) => { LIG[l.id] = l; });

  const PRESETS = [
    { id: 'A', nome: 'Letra A', rows: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'] },
    { id: 'losango', nome: 'Losango', rows: ['...#...', '..###..', '.#####.', '#######', '.#####.', '..###..', '...#...'] },
    { id: 'cruz', nome: 'Cruz', rows: ['..#..', '..#..', '#####', '..#..', '..#..'] },
    { id: 'coracao', nome: 'Coração', rows: ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'] },
    { id: 'diagonal', nome: 'Diagonal', rows: ['#......', '.#.....', '..#....', '...#...', '....#..', '.....#.', '......#'] },
    { id: 'xadrez', nome: 'Xadrez', rows: ['##..##..', '##..##..', '..##..##', '..##..##'] },
  ];

  const motifFromRows = (rows) => ({
    w: rows[0].length,
    h: rows.length,
    cells: rows.map((r) => r.split('').map((c) => (c === '#' ? 1 : 0))),
  });

  function defaults() {
    return {
      motif: motifFromRows(PRESETS[0].rows),
      gap: 1,
      estrutura: 'chapado', // chapado | duplo | tubular
      ligamento: 'tafeta',
      detalheMode: 'flutuado', // flutuado | ligado
      versoLegivel: true,
      intercala: true, // true: fundo entre as colunas do detalhe
      fiosFundo: 2,
      fiosDetalhe: 1,
      fiosOurela: 2,
      ourela: 2,
      minPecas: 8,
      maxPecas: 0,
      maxQuadros: 0,
      maxFlut: 6,
      cores: { fundo: '#1f3a5f', detalhe: '#c0392b', trama: '#e8e0cf', ourela: '#1f3a5f' },
      prod: { bpm: '', bpcm: '', fiosCm: '', metros: '' },
    };
  }

  function fixMotif(m) {
    const w = Math.max(1, Math.min(80, Math.round((m && m.w) || 1)));
    const h = Math.max(1, Math.min(120, Math.round((m && m.h) || 1)));
    const cells = [];
    for (let r = 0; r < h; r++) {
      const row = [];
      for (let c = 0; c < w; c++) row.push(m && m.cells && m.cells[r] && m.cells[r][c] ? 1 : 0);
      cells.push(row);
    }
    return { w, h, cells };
  }

  function norm(c) {
    const d = defaults();
    const o = Object.assign({}, d, c || {});
    const int = (v, min, max, def) => {
      v = Math.round(Number(v));
      if (!isFinite(v)) v = def;
      return Math.max(min, Math.min(max, v));
    };
    o.gap = int(o.gap, 0, 200, d.gap);
    o.fiosFundo = int(o.fiosFundo, 1, 20, d.fiosFundo);
    o.fiosDetalhe = int(o.fiosDetalhe, 1, 20, d.fiosDetalhe);
    o.fiosOurela = int(o.fiosOurela, 1, 20, d.fiosOurela);
    o.ourela = int(o.ourela, 0, 20, d.ourela);
    o.minPecas = int(o.minPecas, 1, 1000, d.minPecas);
    o.maxPecas = int(o.maxPecas, 0, 100000, 0);
    o.maxQuadros = int(o.maxQuadros, 0, 200, 0);
    o.maxFlut = int(o.maxFlut, 0, 1000, d.maxFlut);
    if (!['chapado', 'duplo', 'tubular'].includes(o.estrutura)) o.estrutura = 'chapado';
    if (!LIG[o.ligamento]) o.ligamento = 'tafeta';
    if (!['flutuado', 'ligado'].includes(o.detalheMode)) o.detalheMode = 'flutuado';
    o.versoLegivel = o.versoLegivel !== false;
    o.intercala = o.intercala !== false;
    o.motif = fixMotif(o.motif);
    o.cores = Object.assign({}, d.cores, (c && c.cores) || {});
    o.prod = Object.assign({}, d.prod, (c && c.prod) || {});
    return o;
  }

  function chainLen(cfg, W) {
    const L = cfg.motif.h + cfg.gap;
    const fac = cfg.estrutura === 'chapado' ? 1 : 2;
    let P = W.rows.length;
    if (cfg.ourela > 0 || cfg.detalheMode === 'ligado') P = lcm(P, 2);
    const need = Math.ceil(Math.max(1, cfg.minPecas) / fac);
    let k = 1;
    while ((k * L < need || (k * L) % P !== 0) && k < 5000) k++;
    return { L, k, P, fac, layerPicks: k * L, N: k * L * fac };
  }

  function maxRun(seq, val) {
    const n = seq.length;
    let best = 0, cur = 0;
    for (let i = 0; i < 2 * n; i++) {
      if (seq[i % n] === val) { cur++; if (cur > best) best = cur; } else cur = 0;
    }
    return Math.min(best, n);
  }

  const RANK = { g: 0, o: 0, d: 1, t: 2 };
  const TIPO = { g: 'fundo', o: 'ourela', d: 'detalhe', t: 'borda do tubo' };

  function layout(cfg) {
    const cols = [];
    for (let i = 0; i < cfg.ourela; i++) cols.push({ t: 'o' });
    cols.push({ t: 'g' });
    for (let m = 0; m < cfg.motif.w; m++) { cols.push({ t: 'd', m }); if (cfg.intercala) cols.push({ t: 'g' }); }
    if (!cfg.intercala) cols.push({ t: 'g' });
    for (let i = 0; i < cfg.ourela; i++) cols.push({ t: 'o' });
    let gi = 0, oi = 0;
    cols.forEach((c) => { if (c.t === 'g') c.idx = gi++; else if (c.t === 'o') c.idx = oi++; });
    return cols;
  }

  function fits(cfg, r) {
    return (!cfg.maxQuadros || r.quadros <= cfg.maxQuadros) && (!cfg.maxPecas || r.pecas <= cfg.maxPecas);
  }

  function build(cfgIn, opt) {
    opt = opt || {};
    const cfg = norm(cfgIn);
    const W = LIG[cfg.ligamento];
    const { h, w, cells } = cfg.motif;
    const ch = chainLen(cfg, W);
    const { N, L, k, P, fac, layerPicks } = ch;
    const cols = layout(cfg);
    const thr = (t) => (t === 'g' ? cfg.fiosFundo : t === 'd' ? cfg.fiosDetalhe : cfg.fiosOurela);
    const wr = W.rows.length, wq = W.rows[0].length;

    function lseq(c, back) {
      const out = new Array(layerPicks);
      for (let i = 0; i < layerPicks; i++) {
        let v;
        if (c.t === 'g') v = W.rows[i % wr][c.idx % wq];
        else if (c.t === 'o') v = (i + c.idx) % 2 === 0 ? 1 : 0;
        else {
          const r = i % L;
          const m = back && cfg.versoLegivel ? w - 1 - c.m : c.m;
          const painted = r < h && cells[r][m] ? 1 : 0;
          v = painted && cfg.detalheMode === 'ligado' ? (i % 2 === 0 ? 1 : 0) : painted;
        }
        out[i] = v ? 1 : 0;
      }
      return out;
    }

    const loom = [];
    const edge = (side) => {
      const s = new Array(N);
      for (let n = 0; n < N; n++) s[n] = (n % 2 === 0) === (side === 0) ? 1 : 0;
      return { t: 't', layer: 'e', side, threads: cfg.fiosOurela, seq: s, lseq: s };
    };
    if (cfg.estrutura === 'chapado') {
      cols.forEach((c, j) => {
        const s = lseq(c, false);
        loom.push({ t: c.t, layer: 'f', j, m: c.m, threads: thr(c.t), seq: s, lseq: s });
      });
    } else {
      if (cfg.estrutura === 'tubular') loom.push(edge(0));
      cols.forEach((c, j) => {
        const sf = lseq(c, false), sb = lseq(c, true);
        const f = new Array(N), b = new Array(N);
        for (let n = 0; n < N; n++) {
          const i = n >> 1;
          if (n % 2 === 0) { f[n] = sf[i]; b[n] = 0; } else { f[n] = 1; b[n] = sb[i]; }
        }
        loom.push({ t: c.t, layer: 'f', j, m: c.m, threads: thr(c.t), seq: f, lseq: sf });
        loom.push({ t: c.t, layer: 'b', j, m: c.m, threads: thr(c.t), seq: b, lseq: sb });
      });
      if (cfg.estrutura === 'tubular') loom.push(edge(1));
    }

    // Quadros = colunas (liços) com sequência alto/baixo idêntica
    const map = new Map();
    const frames = [];
    loom.forEach((c, idx) => {
      const key = c.seq.join('');
      let f = map.get(key);
      if (!f) {
        f = { key, seq: c.seq, cols: [], licos: 0, fios: 0, tipos: {}, rank: 9, first: idx };
        map.set(key, f);
        frames.push(f);
      }
      f.cols.push(idx);
      f.licos++;
      f.fios += c.threads;
      f.tipos[c.t] = 1;
      f.rank = Math.min(f.rank, RANK[c.t]);
      c.frame = f;
    });
    frames.sort((a, b) => a.rank - b.rank || a.first - b.first);
    frames.forEach((f, i) => { f.n = i + 1; f.tipo = Object.keys(f.tipos).map((t) => TIPO[t]).filter((v, i2, a) => a.indexOf(v) === i2).join(' + '); });

    const fiosTotal = loom.reduce((s, c) => s + c.threads, 0);
    const fiosPorCamada = loom.filter((c) => c.layer === 'f' || c.layer === 'e').reduce((s, c) => s + c.threads, 0);

    // Flutuação (em passadas da própria camada), só colunas de detalhe
    let fUp = 0, fDown = 0, upCol = -1, downCol = -1;
    const painted = cells.some((r) => r.some((v) => v));
    if (painted) {
      loom.forEach((c) => {
        if (c.t !== 'd') return;
        const u = maxRun(c.lseq, 1), d = maxRun(c.lseq, 0);
        if (u > fUp) { fUp = u; upCol = c.m; }
        if (d > fDown) { fDown = d; downCol = c.m; }
      });
    }
    const floatMax = cfg.estrutura === 'chapado' ? Math.max(fUp, fDown) : fUp;

    const res = {
      cfg, ligamento: W, estrutura: cfg.estrutura, N, L, k, P, fac, layerPicks,
      loom, frames, quadros: frames.length, pecas: N, licos: loom.length,
      fiosTotal, fiosPorCamada,
      flut: { up: fUp, down: fDown, upCol, downCol, max: floatMax },
      passagem: loom.map((c) => c.frame.n),
      avisos: [],
    };
    if (opt.light) return res;

    // ---- Avisos ----
    const add = (nivel, msg) => res.avisos.push({ nivel, msg });
    if (!painted) add('info', 'Nenhum quadrado pintado: a fita sai só com o fundo.');
    if (cfg.maxQuadros && res.quadros > cfg.maxQuadros) {
      add('erro', `Precisa de ${res.quadros} quadros, acima do limite de ${cfg.maxQuadros}.`);
    }
    if (cfg.maxPecas && res.pecas > cfg.maxPecas) {
      add('erro', `A corrente tem ${res.pecas} peças, acima do limite de ${cfg.maxPecas}.`);
    }
    if (painted && cfg.maxFlut && floatMax > cfg.maxFlut) {
      const onde = fUp >= fDown || cfg.estrutura !== 'chapado' ? `coluna ${upCol + 1} do desenho (na frente)` : `coluna ${downCol + 1} do desenho (no verso)`;
      add('aviso', `Flutuação de ${floatMax} passadas seguidas na ${onde}; limite ${cfg.maxFlut}. Fio solto longo pode puxar ou embolar.`);
    }
    const baseL = L * fac;
    if (k > 1) {
      const fechaLig = L % P !== 0;
      if (fechaLig) {
        add('info', `O ligamento (ciclo de ${P} passadas) não fecha com ${L} passadas por repetição: o desenho é repetido ${k}× na corrente (${N} peças).`);
      } else if (baseL < cfg.minPecas) {
        add('info', `Mínimo de ${cfg.minPecas} peças: o desenho é repetido ${k}× (${N} peças).`);
      }
      if (fechaLig) {
        const alt = alternativasDistancia(cfg)
          .filter((a) => a.melhor)
          .sort((a, b) => a.pecas - b.pecas || Math.abs(a.gap - cfg.gap) - Math.abs(b.gap - cfg.gap))[0];
        if (alt) add('info', `Com distância de ${alt.gap} passadas (em vez de ${cfg.gap}) a corrente cai de ${N} para ${alt.pecas} peças.`);
      }
    }
    if (cfg.estrutura !== 'chapado') {
      add('info', 'Duplo/tubular: modelo simplificado (camadas alternando passada de frente e de verso). Valide com uma corrente real antes de produzir.');
    }
    if (cfg.estrutura === 'chapado' && painted) {
      add('info', 'Chapado: o verso mostra o desenho em negativo, com o fio de detalhe flutuando atrás.');
    }

    res.producao = producao(cfg, res);
    return res;
  }

  function producao(cfg, res) {
    const num = (v) => { const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) && n > 0 ? n : 0; };
    const bpm = num(cfg.prod.bpm), bpcm = num(cfg.prod.bpcm), fcm = num(cfg.prod.fiosCm), metros = num(cfg.prod.metros);
    const out = {};
    if (bpm && bpcm) {
      out.cmMin = bpm / bpcm;
      out.mHora = (out.cmMin * 60) / 100;
      out.minPorMetro = 100 / out.cmMin;
      out.mTurno8h = out.mHora * 8;
      if (metros) out.horasMetros = metros / out.mHora;
    }
    if (bpcm) {
      out.correnteMm = (res.N / bpcm) * 10;
      out.passoMm = ((res.L * res.fac) / bpcm) * 10;
      out.alturaMm = ((cfg.motif.h * res.fac) / bpcm) * 10;
    }
    if (fcm) out.larguraMm = (res.fiosPorCamada / fcm) * 10;
    return out;
  }

  function alternativasDistancia(cfgIn) {
    const cfg = norm(cfgIn);
    const base = build(cfg, { light: true });
    const out = [];
    for (let g = 0; g <= cfg.gap + 12; g++) {
      if (g === cfg.gap) continue;
      const r = build(Object.assign({}, cfg, { gap: g }), { light: true });
      out.push({ gap: g, quadros: r.quadros, pecas: r.pecas, ok: fits(cfg, r), melhor: r.pecas < base.pecas && r.pecas >= cfg.minPecas });
    }
    return out;
  }

  function alternativas(cfgIn) {
    const cfg = norm(cfgIn);
    const out = [];
    ['chapado', 'duplo', 'tubular'].forEach((e) => {
      LIGAMENTOS.forEach((l) => {
        const r = build(Object.assign({}, cfg, { estrutura: e, ligamento: l.id }), { light: true });
        out.push({ estrutura: e, ligamento: l.id, nome: l.nome, quadros: r.quadros, pecas: r.pecas, ok: fits(cfg, r) });
      });
    });
    return out;
  }

  function chainRows(res) {
    const rows = [];
    for (let n = 0; n < res.N; n++) rows.push(res.frames.map((f) => (f.seq[n] ? 'A' : 'B')));
    return rows;
  }

  function csv(res) {
    const head = ['Peca'].concat(res.frames.map((f) => 'Q' + f.n)).join(';');
    const lines = chainRows(res).map((r, i) => [i + 1].concat(r).join(';'));
    return [head].concat(lines).join('\n');
  }

  // Vista para renderização: lado 'f' (frente) ou 'b' (verso)
  function view(res, side, reps) {
    reps = Math.max(1, reps || 1);
    let cols, picks = [];
    if (res.estrutura === 'chapado') {
      cols = res.loom.slice();
      for (let n = 0; n < res.N; n++) picks.push(n);
    } else {
      cols = res.loom.filter((c) => c.layer === side || c.layer === 'e');
      for (let n = 0; n < res.N; n++) if (n % 2 === (side === 'f' ? 0 : 1)) picks.push(n);
    }
    if (side === 'b') cols = cols.slice().reverse();
    const key = (c) => (c.t === 'd' ? 'd' : c.t === 'g' ? 'g' : 'o');
    const rows = [];
    for (let r = 0; r < reps; r++) {
      picks.forEach((n) => {
        rows.push(cols.map((c) => {
          const up = c.seq[n] === 1;
          if (res.estrutura === 'chapado') return (side === 'f' ? up : !up) ? key(c) : 't';
          return up ? key(c) : 't';
        }));
      });
    }
    return { cols: cols.map((c) => ({ k: key(c), w: c.threads })), rows };
  }

  return {
    LIGAMENTOS, PRESETS, motifFromRows, defaults, norm, build, alternativas, alternativasDistancia,
    chainRows, csv, view, fits,
  };
});
