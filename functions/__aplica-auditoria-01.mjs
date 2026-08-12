/**
 * Auditoria — lote 1. Só o que já foi decidido e não tem incerteza pendente.
 *
 *   1. Determinação não existe mais: 16 custos com "D" viram Energia.
 *      O "1D + 1G" do Exorcismo Menor era custo ADITIVO (proibido pelo §4.2)
 *      e vira "2 Energia ou 2 Graça".
 *   2. Bardo: o Redutor escalava no teste de CONJURAR e derrubava a chance
 *      E os Graus — as duas coisas se multiplicam, e o Opus Magnum entregava
 *      2,4% do que custava (§4.4). A escada é achatada em 0.
 *   3. Bardo: com o Redutor em 0, as três canções que são só condição entram
 *      na faixa aumentando ALVOS — custo é o tier e não se toca.
 *   4. Sangral: 1 Carga passa a custar 3 de Vitalidade; o Escudo Hemático
 *      cai para 0,88× e sobe para +3 Blindagem (1,33×).
 *
 *   node functions/__aplica-auditoria-01.mjs            (dry-run)
 *   node functions/__aplica-auditoria-01.mjs --apply
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

/* "1D ou 1G" → "1 Energia ou 1 Graça"; "2D" → "2 Energia"; e o aditivo.
   Só mexe em quem TEM a sigla. Sem essa guarda o .trim() entrava de carona
   em custos de outras classes e o lote crescia sozinho — foi o que o assert
   de contagem pegou (19 em vez de 16). */
const temD = (v) => /\d\s*D\b/.test(String(v));
const converteCusto = (v) => {
  const s = String(v);
  if (!temD(s)) return s;
  if (s.trim() === '1D + 1G') return '2 Energia ou 2 Graça';   // §4.2: aditivo é proibido
  return s.trim().replace(/(\d+)\s*D\b/g, '$1 Energia').replace(/(\d+)\s*G\b/g, '$1 Graça');
};
assert.equal(converteCusto('1D ou 1G'), '1 Energia ou 1 Graça');
assert.equal(converteCusto('2D ou 2G'), '2 Energia ou 2 Graça');
assert.equal(converteCusto('1D'), '1 Energia');
assert.equal(converteCusto('1D + 1G'), '2 Energia ou 2 Graça');
assert.equal(converteCusto('1D ou 2G (limite 3m)'), '1 Energia ou 2 Graça (limite 3m)');
assert.equal(converteCusto('1 Carga'), '1 Carga', 'o que não tem D fica intocado');

/* Bardo: alvos novos das canções que são SÓ condição (P total 0,42). */
const ALVOS_BARDO = {
  'GRITO DISSONANTE [V, S]': 2,
  'INTIMIDAÇÃO SÔNICA [V, P]': 3,
  'NANA DO ENTORPECIMENTO [V, C]': 3,
};

const col = db.collection('system/data/classModules');
const mods = (await col.get()).docs.map(d => ({ id: d.id, ...d.data() }));
const chave = (m, re) => { const l = Object.fromEntries((m.schema || []).map(f => [f.key, String(f.label || '')]));
  return Object.keys(l).find(x => re.test(l[x])); };

const plano = [];
for (const m of mods) {
  const kC = chave(m, /^custo/i), kR = chave(m, /^redutor/i), kE = chave(m, /^efeito/i);
  const ehBardo = /^Custo \d/.test(m.titulo);
  let mexeu = false;
  const itens = (m.itensPredefinidos || []).map(it => {
    const novo = { ...it, valores: { ...it.valores } };
    const reg = (o, de, para) => { plano.push({ mod: m.titulo, item: it.nome, o, de, para }); mexeu = true; };

    // 1. custo "D" → Energia
    if (kC) { const v = String(it.valores?.[kC] ?? ''); const n = converteCusto(v);
      if (v && n !== v) { novo.valores[kC] = n; reg('custo', v, n); } }

    // 2. Bardo: Redutor achatado em 0
    if (ehBardo && kR) { const v = String(it.valores?.[kR] ?? '').trim();
      if (v && v !== '0') { novo.valores[kR] = '0'; reg('Redutor', v, '0'); } }

    // 3. Bardo: mais alvos nas três que são só condição
    if (ehBardo && ALVOS_BARDO[it.nome]) {
      const n = ALVOS_BARDO[it.nome];
      const cs = (it.condicoesAplicadas || []).filter(c => c && c.condicao);
      if (cs.length && cs.some(c => (c.alvos || 1) !== n)) {
        novo.condicoesAplicadas = (it.condicoesAplicadas || [])
          .map(c => (c && c.condicao) ? { ...c, alvos: n } : c);
        reg('alvos', cs.map(c => c.alvos).join('/'), String(n));
      }
    }

    // 4. Sangral: Escudo Hemático +2 → +3 Blindagem
    if (it.nome === 'Escudo Hemático') {
      const troca = (s) => String(s ?? '').replace(/\+2 de Blindagem/g, '+3 de Blindagem');
      if (troca(it.descricao) !== it.descricao) { novo.descricao = troca(it.descricao); reg('efeito', '+2 Blindagem', '+3 Blindagem'); }
      if (kE && troca(it.valores?.[kE]) !== it.valores?.[kE]) novo.valores[kE] = troca(it.valores[kE]);
    }
    return novo;
  });
  if (mexeu) m._novos = itens;
}

/* ═══ Conferência antes de gravar (§5.2) ═══ */
const conta = (o) => plano.filter(p => p.o === o).length;
console.log('=== PLANO ===\n');
for (const p of plano) console.log(`  [${p.o}] ${p.mod.slice(0,24).padEnd(26)} ${String(p.item).slice(0,30).padEnd(32)} "${p.de}" → "${p.para}"`);
console.log(`\n  custo D→Energia: ${conta('custo')}   Redutor→0: ${conta('Redutor')}   alvos: ${conta('alvos')}   efeito: ${conta('efeito')}`);

assert.equal(conta('custo'), 16, 'tem que mexer em exatamente 16 custos com D');
assert.equal(conta('alvos'), 3, 'três canções ganham alvos');
assert.equal(conta('efeito'), 1, 'só o Escudo Hemático muda de efeito');
assert.ok(conta('Redutor') >= 7, 'pelo menos as 7 canções com condição perdem o Redutor');
assert.ok(plano.every(p => p.de !== p.para), 'nenhuma troca pode ser no-op');

if (!APLICAR) { console.log('\n(dry-run — nada gravado. Rode com --apply para valer.)'); process.exit(0); }
const lote = db.batch();
for (const m of mods.filter(x => x._novos)) lote.update(col.doc(m.id), { itensPredefinidos: m._novos });
await lote.commit();
console.log(`\n✅ gravado em ${mods.filter(x => x._novos).length} módulos.`);
