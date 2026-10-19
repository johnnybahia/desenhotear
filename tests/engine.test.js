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
