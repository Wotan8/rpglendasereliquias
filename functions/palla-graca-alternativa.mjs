/**
 * Graça de Palla passa a ser custo ALTERNATIVO, nunca adicional.
 *
 * A maioria das magias do Pallacerdote já dizia "1D ou 1G". Três fugiam do
 * padrão e cobravam os dois recursos, o que dobra a barra que a magia precisa
 * vencer sem dobrar o que ela entrega:
 *
 *   Luz do Manto de Palla I     "1D + 1G"          → "1D ou 1G"
 *   Reconsagração do Santuário  "2D + 1G"          → "2D ou 2G"
 *   Luz da Vontade I            "2D ou 1D + 2G"    → "2D ou 2G"
 *
 * A terceira não é desbalanceada, é opção morta: "1D + 2G" custa 3 pontos pelo
 * mesmo efeito que 2 pontos compram na primeira opção. Ninguém escolheria.
 *
 * Nenhum efeito muda. Nenhum botão muda — os dois já existem e o jogador clica
 * o que quiser. Só o texto que declara a regra.
 *
 *   node functions/palla-graca-alternativa.mjs            (dry-run)
 *   node functions/palla-graca-alternativa.mjs --apply
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

const TROCAS = {
    'Luz do Manto de Palla I':    ['1D + 1G', '1D ou 1G'],
    'Reconsagração do Santuário': ['2D + 1G', '2D ou 2G'],
    'Luz da Vontade I':           ['2D ou 1D + 2G', '2D ou 2G'],
};

/** Pontos da opção mais barata — a mesma leitura que a régua usa. */
const pontos = txt => Math.min(...String(txt).split(/\s+ou\s+/i)
    .map(op => [...op.matchAll(/(\d+)\s*(D\b|G\b)/gi)].reduce((t, m) => t + +m[1], 0))
    .filter(v => v > 0));

assert.equal(pontos('1D + 1G'), 2, 'aditivo custa a soma');
assert.equal(pontos('1D ou 1G'), 1, 'alternativo custa a opção mais barata');
assert.equal(pontos('2D + 1G'), 3);
assert.equal(pontos('2D ou 2G'), 2);
assert.equal(pontos('2D ou 1D + 2G'), 2, 'a opção cara já era ignorada — é opção morta');
console.log('✅ 5 asserts passaram.\n');

const col = db.collection('system/data/classModules');
const mods = (await col.get()).docs.map(d => ({ id: d.id, ...d.data() }));

const erros = [], plano = [];
for (const m of mods) {
    const lbl = Object.fromEntries((m.schema || []).map(f => [f.key, String(f.label || '')]));
    const kCusto = Object.keys(lbl).find(k => /^custo/i.test(lbl[k]));
    if (!kCusto) continue;
    let mexeu = false;
    const itens = (m.itensPredefinidos || []).map(it => {
        const alvo = TROCAS[it.nome];
        if (!alvo) return it;
        const atual = String(it.valores?.[kCusto] ?? '').trim();
        if (atual !== alvo[0]) { erros.push(`"${it.nome}": custo é "${atual}", esperava "${alvo[0]}"`); return it; }
        mexeu = true;
        plano.push({ nome: it.nome, de: alvo[0], para: alvo[1], modulo: m.titulo });
        return { ...it, valores: { ...it.valores, [kCusto]: alvo[1] } };
    });
    if (mexeu) m._novosItens = itens;
}

console.log('=== Graça como custo alternativo ===\n');
for (const p of plano) {
    console.log(`  ${p.nome}   (${p.modulo})`);
    console.log(`     "${p.de}"  →  "${p.para}"     ${pontos(p.de)} pontos → ${pontos(p.para)}\n`);
}
const achados = plano.length, esperados = Object.keys(TROCAS).length;
if (erros.length) { console.error('🔴 ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
if (achados !== esperados) { console.error(`🔴 ABORTADO: ${achados}/${esperados} magias achadas.`); process.exit(1); }
console.log(`  ${achados} magias. Efeitos e botões intocados — só a regra de custo.`);

if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }
for (const m of mods.filter(x => x._novosItens)) {
    await col.doc(m.id).update({ itensPredefinidos: m._novosItens, updatedAt: Date.now() });
}
console.log('\n✅ Gravado.');
process.exit(0);
