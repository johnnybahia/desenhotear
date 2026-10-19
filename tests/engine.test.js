const assert = require('assert');
const E = require('../engine.js');

let n = 0;
const t = (name, fn) => { fn(); n++; console.log('ok -', name); };
const base = (o) => E.norm(Object.assign({ ourela: 0, gap: 1 }, o || {}));

t('ligamentos: 10 opções, ciclos esperados', () => {
  assert.strictEqual(E.LIGAMENTOS.length, 10);
  const q = {};
  E.LIGAMENTOS.forEach((l) => {
    const cols = new Set();
    for (let j = 0; j < l.rows[0].length; j++) cols.add(l.rows.map((r) => r[j]).join(''));
    q[l.id] = cols.size;
  });
  assert.deepStrictEqual(q, { tafeta: 2, sarja21: 3, sarja12: 3, sarja31: 4, sarja22: 4, cetim5: 5, cetim8: 8, esteira: 2, espinha: 4, rips: 2 });
});

t('exemplo A 5x7 tafetá chapado: 4 quadros, 8 peças', () => {
  const r = E.build(base());
  assert.strictEqual(r.quadros, 4);
  assert.strictEqual(r.pecas, 8);
  const tipos = r.frames.map((f) => f.tipo);
  assert.deepStrictEqual(tipos, ['fundo', 'fundo', 'detalhe', 'detalhe']);
});

t('total de fios: 6 fundo x2 + 5 detalhe x1 = 17', () => {
  assert.strictEqual(E.build(base()).fiosTotal, 17);
  assert.strictEqual(E.build(base({ fiosFundo: 3, fiosDetalhe: 2 })).fiosTotal, 6 * 3 + 5 * 2);
});

t('detalhe sobe onde pinta (coluna 1 do A)', () => {
  const r = E.build(base());
  const col = r.loom.find((c) => c.t === 'd' && c.m === 0);
  assert.deepStrictEqual(col.seq, [0, 1, 1, 1, 1, 1, 1, 0]);
});

t('mínimo de peças: motivo vazio 1x1 tafetá -> 8', () => {
  const r = E.build(E.norm({ ourela: 0, gap: 0, motif: { w: 1, h: 1, cells: [[0]] } }));
  assert.strictEqual(r.pecas, 8);
});

t('mínimo configurável', () => {
  assert.strictEqual(E.build(base({ minPecas: 12 })).pecas, 16);
  assert.strictEqual(E.build(base({ minPecas: 1 })).pecas, 8);
});

t('cetim 5 não fecha em 8: repete até múltiplo de 5 (40) e sugere distância', () => {
  const r = E.build(E.norm({ ourela: 0, gap: 1, ligamento: 'cetim5' }));
  assert.strictEqual(r.pecas, 40);
  assert.ok(r.avisos.some((a) => /Com distância de 3/.test(a.msg)), JSON.stringify(r.avisos));
  const r2 = E.build(E.norm({ ourela: 0, gap: 3, ligamento: 'cetim5' }));
  assert.strictEqual(r2.pecas, 10);
});

t('ourela exige ciclo par', () => {
  const r = E.build(E.norm({ ourela: 2, gap: 2, motif: { w: 1, h: 1, cells: [[1]] }, ligamento: 'sarja21' }));
  assert.strictEqual(r.pecas % 6, 0);
});

t('flutuação: coluna 1 do A = 6 passadas', () => {
  const r = E.build(base());
  assert.strictEqual(r.flut.up, 6);
  assert.ok(E.build(base({ maxFlut: 4 })).avisos.some((a) => a.nivel === 'aviso'));
  assert.ok(!E.build(base({ maxFlut: 6 })).avisos.some((a) => a.nivel === 'aviso'));
});

t('limite de quadros dispara erro; alternativas existem', () => {
  const c = base({ ligamento: 'cetim8', maxQuadros: 6 });
  const r = E.build(c);
  assert.ok(r.quadros > 6);
  assert.ok(r.avisos.some((a) => a.nivel === 'erro'));
  const alt = E.alternativas(c).filter((a) => a.ok && a.estrutura === 'chapado');
  assert.ok(alt.length > 0 && alt.some((a) => a.ligamento === 'tafeta'));
});

t('duplo: passadas alternam frente/verso e camada oposta fica correta', () => {
  const r = E.build(base({ estrutura: 'duplo' }));
  assert.strictEqual(r.pecas % 2, 0);
  assert.strictEqual(r.pecas, 16);
  r.loom.forEach((c) => {
    for (let n = 0; n < r.N; n++) {
      if (c.layer === 'f' && n % 2 === 1) assert.strictEqual(c.seq[n], 1, 'frente sobe na passada do verso');
      if (c.layer === 'b' && n % 2 === 0) assert.strictEqual(c.seq[n], 0, 'verso desce na passada da frente');
    }
  });
  assert.strictEqual(r.fiosTotal, 2 * 17);
});

t('tubular: ganha no máximo 2 quadros de borda sobre o duplo', () => {
  const d = E.build(base({ estrutura: 'duplo' }));
  const tu = E.build(base({ estrutura: 'tubular' }));
  assert.ok(tu.quadros >= d.quadros && tu.quadros <= d.quadros + 2);
  assert.strictEqual(tu.fiosTotal, d.fiosTotal + 2 * 2);
});

t('verso legível: motivo do verso espelhado no tear', () => {
  const m = { w: 3, h: 1, cells: [[1, 0, 0]] };
  const leg = E.build(E.norm({ ourela: 0, gap: 1, estrutura: 'duplo', motif: m, versoLegivel: true }));
  const nao = E.build(E.norm({ ourela: 0, gap: 1, estrutura: 'duplo', motif: m, versoLegivel: false }));
  const idxB = (res, mm) => res.loom.find((c) => c.layer === 'b' && c.t === 'd' && c.m === mm).lseq[0];
  assert.strictEqual(idxB(leg, 2), 1);
  assert.strictEqual(idxB(leg, 0), 0);
  assert.strictEqual(idxB(nao, 0), 1);
});

t('frente e verso do chapado são complementares', () => {
  const r = E.build(base());
  const f = E.view(r, 'f', 1), b = E.view(r, 'b', 1);
  assert.strictEqual(f.rows.length, r.N);
  const W = f.cols.length;
  for (let i = 0; i < r.N; i++) for (let j = 0; j < W; j++) {
    const a = f.rows[i][j], bb = b.rows[i][W - 1 - j];
    assert.ok((a === 't') !== (bb === 't'), 'um mostra trama e o outro mostra fio');
  }
});

t('produção: 300 bat/min, 20 bat/cm = 15 cm/min = 9 m/h', () => {
  const r = E.build(base({ prod: { bpm: '300', bpcm: '20', fiosCm: '40', metros: '1000' } }));
  assert.strictEqual(r.producao.cmMin, 15);
  assert.strictEqual(r.producao.mHora, 9);
  assert.ok(Math.abs(r.producao.horasMetros - 1000 / 9) < 1e-9);
  assert.strictEqual(r.producao.correnteMm, (8 / 20) * 10);
  assert.strictEqual(r.producao.larguraMm, (17 / 40) * 10);
});

t('csv e chainRows coerentes', () => {
  const r = E.build(base());
  const rows = E.chainRows(r);
  assert.strictEqual(rows.length, 8);
  assert.ok(E.csv(r).split('\n').length === 9);
});

t('entrada inválida não quebra', () => {
  const r = E.build({ motif: { w: 0, h: 0 }, gap: -5, fiosFundo: 'x', estrutura: 'xx', ligamento: 'zz' });
  assert.ok(r.quadros > 0 && r.pecas >= 8);
});

console.log(`\n${n} testes passaram`);

(function () {
  const r = E.build(E.norm({ ourela: 0, gap: 1, intercala: false }));
  assert.strictEqual(r.licos, 7, 'g + 5 d + g');
  assert.strictEqual(r.fiosTotal, 2 * 2 + 5);
  assert.strictEqual(r.quadros, 4);
  console.log('ok - sem fundo entre colunas do detalhe');
})();

// ---- texto / imagem / posição ----
(function () {
  const ok = (n) => console.log('ok - ' + n);
  const A = E.PRESETS[0].rows.map((r) => r.split('').map((c) => (c === '#' ? 1 : 0)));

  // fonte de pixel: "A" é igual ao modelo A
  const a = E.renderPixelText('A');
  assert.deepStrictEqual(a.cells, A);
  ok('fonte 5x7: A igual ao modelo');

  // largura de "AB" = 5 + 1 + 5; espaço configurável; escala
  assert.strictEqual(E.renderPixelText('AB').w, 11);
  assert.strictEqual(E.renderPixelText('AB', { espaco: 2 }).w, 12);
  const e2 = E.renderPixelText('A', { escala: 2 });
  assert.strictEqual(e2.w, 10); assert.strictEqual(e2.h, 14);
  assert.strictEqual(e2.cells[0][2], 1); assert.strictEqual(e2.cells[1][2], 1); assert.strictEqual(e2.cells[0][0], 0);
  ok('fonte 5x7: largura, espaço e escala');

  // acentos, minúsculas, caracteres não suportados
  assert.deepStrictEqual(E.renderPixelText('ação').cells, E.renderPixelText('ACAO').cells);
  const u = E.renderPixelText('A#B');
  assert.deepStrictEqual(u.ignorados, ['#']);
  assert.strictEqual(u.w, 11);
  assert.strictEqual(E.renderPixelText('   ').vazio, true);
  assert.strictEqual(E.renderPixelText('').vazio, true);
  ok('fonte 5x7: acentos, minúsculas, não suportados, vazio');

  // limite de tamanho
  const longo = E.renderPixelText('MARFIM TEXTIL BAHIA CEARA', { escala: 2 });
  assert.ok(longo.w <= E.MAXW && longo.cortado);
  ok('texto longo é cortado em 80 colunas');

  // todos os glifos têm 7 linhas de largura uniforme
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,!:\'-+/?'.split('').forEach((ch) => {
    const g = E.renderPixelText(ch);
    assert.ok(g.h === 7 && g.cells.every((r) => r.length === g.w), 'glifo ' + ch);
  });
  ok('todos os glifos consistentes');

  // girar / espelhar
  const m = [[1, 0, 0], [1, 1, 0]]; // 2 linhas x 3 colunas
  assert.deepStrictEqual(E.transformCells(m, { rot: 90 }), [[1, 1], [1, 0], [0, 0]]);
  assert.deepStrictEqual(E.transformCells(m, { rot: 180 }), [[0, 1, 1], [0, 0, 1]]);
  assert.deepStrictEqual(E.transformCells(m, { rot: 270 }), [[0, 0], [0, 1], [1, 1]]);
  assert.deepStrictEqual(E.transformCells(m, { rot: 360 }), m);
  assert.deepStrictEqual(E.transformCells(m, { flipH: true }), [[0, 0, 1], [0, 1, 1]]);
  assert.deepStrictEqual(E.transformCells(m, { flipV: true }), [[1, 1, 0], [1, 0, 0]]);
  assert.deepStrictEqual(E.transformCells(m, { invert: true }), [[0, 1, 1], [0, 0, 1]]);
  assert.deepStrictEqual(m, [[1, 0, 0], [1, 1, 0]], 'não altera a entrada');
  // 4 giros de 90 voltam ao original
  let g = A; for (let i = 0; i < 4; i++) g = E.transformCells(g, { rot: 90 });
  assert.deepStrictEqual(g, A);
  ok('posição: girar, espelhar, inverter');

  // reamostragem por média de área
  const src = new Float32Array([1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0]);
  const r = E.resampleBox(src, 4, 4, 2, 2);
  assert.deepStrictEqual(Array.from(r), [1, 0, 0, 0.25]);
  const up = E.resampleBox(new Float32Array([0, 1]), 2, 1, 4, 1);
  assert.deepStrictEqual(Array.from(up), [0, 0, 1, 1]);
  ok('reamostragem por área');

  // limiar e pontilhado
  const dk = [0.1, 0.4, 0.6, 0.9];
  assert.deepStrictEqual(E.toBits(dk, 4, 1, { limiar: 0.5 })[0], [0, 0, 1, 1]);
  assert.deepStrictEqual(E.toBits(dk, 4, 1, { limiar: 0.3 })[0], [0, 1, 1, 1]);
  const cinza = new Float32Array(16).fill(0.5);
  const dt = E.toBits(cinza, 4, 4, { dither: true });
  const pintados = dt.flat().reduce((s2, v) => s2 + v, 0);
  assert.ok(pintados >= 6 && pintados <= 10, 'cinza 50% pinta ~metade, pintou ' + pintados);
  assert.ok(E.toBits(new Float32Array(16).fill(0), 4, 4, { dither: true }).flat().every((v) => v === 0));
  assert.ok(E.toBits(new Float32Array(16).fill(1), 4, 4, { dither: true }).flat().every((v) => v === 1));
  ok('limiar e pontilhado');

  // RGBA -> escuridão (preto opaco = 1, branco = 0, transparente = 0)
  const px = new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255, 0, 0, 0, 0, 128, 128, 128, 255]);
  const d = E.darknessFromRGBA(px, 4, 1);
  assert.ok(d[0] === 1 && d[1] === 0 && d[2] === 0 && Math.abs(d[3] - 0.498) < 0.01);
  ok('RGBA para escuridão');

  // colunas distintas do A e quadros previstos com texto
  assert.strictEqual(E.colunasDistintas(A), 2);
  const pal = E.renderPixelText('FITA');
  const rr = E.build(E.norm({ ourela: 0, gap: 1, motif: { w: pal.w, h: pal.h, cells: pal.cells } }));
  assert.ok(rr.quadros >= 4 && rr.quadros <= 2 + E.colunasDistintas(pal.cells) + 1);
  ok('colunas distintas e quadros de uma palavra: ' + rr.quadros + ' quadros');
})();

(function () {
  const ok = (n) => console.log('ok - ' + n);
  const pal = E.renderPixelText('FITA 2026');
  const total = E.colunasDistintas(pal.cells);
  const simp = E.simplificarColunas(pal.cells, 5);
  assert.ok(total > 5);
  assert.strictEqual(E.colunasDistintas(simp), 5);
  assert.strictEqual(simp.length, pal.h);
  assert.strictEqual(simp[0].length, pal.w);
  assert.deepStrictEqual(E.simplificarColunas(pal.cells, total), pal.cells, 'sem mudança quando já cabe');
  ok('simplificar colunas: reduz para o máximo pedido e mantém o tamanho');

  const cfg = E.norm({ ourela: 0, gap: 1, motif: { w: pal.w, h: pal.h, cells: pal.cells } });
  const q0 = E.build(cfg).quadros;
  const alvo = Math.max(4, Math.floor(q0 / 2));
  const r = E.colunasParaCaber(cfg, pal.cells, alvo);
  assert.ok(r !== null && r.n < total);
  const q1 = E.build(Object.assign({}, cfg, { motif: { w: pal.w, h: pal.h, cells: r.cells } })).quadros;
  assert.ok(q1 <= alvo, `${q1} <= ${alvo}`);
  assert.strictEqual(E.colunasDistintas(r.cells), r.n);
  assert.strictEqual(E.colunasParaCaber(cfg, pal.cells, 1), null, 'nem o fundo cabe em 1 quadro');
  ok('colunas para caber: ' + q0 + ' quadros -> ' + q1 + ' (limite ' + alvo + ')');
})();

(function () {
  const ok = (n) => console.log('ok - ' + n);
  const cheio = [[1, 1, 1], [1, 1, 1], [1, 1, 1]];
  assert.deepStrictEqual(E.morfologia(cheio, 'afinar'), [[0, 0, 0], [0, 1, 0], [0, 0, 0]]);
  assert.deepStrictEqual(E.morfologia(cheio, 'contorno'), [[1, 1, 1], [1, 0, 1], [1, 1, 1]]);
  assert.deepStrictEqual(E.morfologia([[0, 0, 0], [0, 1, 0], [0, 0, 0]], 'engrossar'), [[0, 1, 0], [1, 1, 1], [0, 1, 0]]);
  assert.deepStrictEqual(E.morfologia(cheio, 'nenhum'), cheio);
  ok('morfologia: engrossar, afinar, contorno');
})();
