/**
 * Manobras — duas correções.
 *
 * ═══ 1. Golpe Preciso está DUPLICADO ═══
 * Duas entradas com o mesmo nome no módulo:
 *   "Alvo = + Precisão. Ignora a Blindagem do alvo neste ataque."  → 1,09×
 *   "Ignora a Blindagem do alvo."                                  → 0,58×
 * A segunda é subconjunto da primeira — versão antiga que ficou. Não é
 * desbalanceamento, é lixo de dado: some.
 *
 * ═══ 2. Inspirar — 0,68× ═══
 *   "Aliados em até 6m ganham +1 no Alvo de Ataque até o fim do seu próximo turno."
 *
 * Dois problemas na mesma frase. "Seu próximo turno" é ambíguo — do Guerreiro ou
 * do aliado? E a régua lê como 1 rodada, porque não há número.
 *
 *   1 × 0,170 × 1 rodada × 4 aliados = 0,68
 *   1 × 0,170 × 2 rodadas × 4 aliados = 1,36  → 1,36×
 *
 * Declarar "por 2 rodadas" resolve os dois: fecha a régua e tira a ambiguidade
 * de mesa. Duas rodadas é o que "até o fim do próximo turno" já significava na
 * prática — o resto desta e a próxima.
 *
 *   node functions/guerreiro-manobras.mjs            (dry-run)
 *   node functions/guerreiro-manobras.mjs --apply
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

const T = 0.585 / 3.445;
const INSPIRAR_DE = 'Aliados em até 6m ganham +1 no Alvo de Ataque até o fim do seu próximo turno.';
const INSPIRAR_PARA = 'Aliados em até 6m ganham +1 no Alvo de Ataque por 2 rodadas.';
const DUPLICATA = 'Ignora a Blindagem do alvo.';   // a versão curta, que sai

/* ═══ ASSERTS ═══ */
assert.ok(1 * T * 1 * 4 < 1.00, 'Inspirar reprova com 1 rodada');
assert.ok(1 * T * 2 * 4 >= 1.00, `e passa com 2 (${(1 * T * 2 * 4).toFixed(2)}×)`);
assert.ok(1 * T * 2 * 4 <= 1.70, 'sem estourar a faixa');
assert.ok(/por 2 rodadas/.test(INSPIRAR_PARA), 'duração tem que virar número — a régua não lê "próximo turno"');
assert.ok(!/seu próximo turno/.test(INSPIRAR_PARA), 'e a ambiguidade de posse tem que sair');
assert.ok('Alvo = + Precisão. Ignora a Blindagem do alvo neste ataque.'.includes('Ignora a Blindagem do alvo'),
    'a duplicata é mesmo subconjunto da versão completa');
console.log(`✅ 6 asserts passaram.  Inspirar: 0,68× → ${(1 * T * 2 * 4).toFixed(2)}×\n`);

/* ═══ PLANO ═══ */
const col = db.collection('system/data/classModules');
const mods = (await col.get()).docs.map(d => ({ id: d.id, ...d.data() }));
const erros = [], acoes = [];
for (const m of mods) {
    const lbl = Object.fromEntries((m.schema || []).map(f => [f.key, String(f.label || '')]));
    const kE = Object.keys(lbl).find(k => /efeito/i.test(lbl[k]));
    if (!kE) continue;
    const antes = (m.itensPredefinidos || []).length;
    let mexeu = false;

    const itens = (m.itensPredefinidos || [])
        .filter(it => {
            const txt = String(it.valores?.[kE] ?? '').trim();
            if (it.nome === 'Golpe Preciso' && txt === DUPLICATA) {
                acoes.push({ tipo: 'remove', nome: it.nome, modulo: m.titulo, txt }); mexeu = true; return false;
            }
            return true;
        })
        .map(it => {
            if (it.nome !== 'Inspirar') return it;
            const txt = String(it.valores?.[kE] ?? '').trim();
            if (txt !== INSPIRAR_DE) { erros.push(`Inspirar: texto inesperado — ${txt}`); return it; }
            acoes.push({ tipo: 'edita', nome: it.nome, modulo: m.titulo, de: INSPIRAR_DE, para: INSPIRAR_PARA });
            mexeu = true;
            return { ...it, valores: { ...it.valores, [kE]: INSPIRAR_PARA }, descricao: INSPIRAR_PARA,
                     duracaoValor: 2, duracaoUnidade: 'turno', alcance: 6, formaArea: 'circulo', tamanhoArea: 6 };
        });
    if (mexeu) { m._novos = itens; m._delta = `${antes} → ${itens.length} itens`; }
}

console.log('=== Manobras ===\n');
for (const a of acoes) {
    if (a.tipo === 'remove') console.log(`  ✂  duplicata removida: "${a.nome}" — "${a.txt}"  (${a.modulo})`);
    else { console.log(`  ✎  ${a.nome}  (${a.modulo})`); console.log(`       de:   ${a.de}`); console.log(`       para: ${a.para}`); }
}
const rem = acoes.filter(a => a.tipo === 'remove').length, ed = acoes.filter(a => a.tipo === 'edita').length;
console.log(`\n  ${rem} removida(s) · ${ed} editada(s)`);
mods.filter(x => x._delta).forEach(m => console.log(`  ${m.titulo}: ${m._delta}`));
if (erros.length) { console.error('\n🔴 ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
if (rem !== 1 || ed !== 1) { console.error(`\n🔴 ABORTADO: esperava 1 remoção e 1 edição, deu ${rem} e ${ed}.`); process.exit(1); }

if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }
for (const m of mods.filter(x => x._novos)) await col.doc(m.id).update({ itensPredefinidos: m._novos, updatedAt: Date.now() });
console.log('\n✅ Gravado.');
process.exit(0);
