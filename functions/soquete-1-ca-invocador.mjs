/**
 * Passo 1 do soquete mágico v2 — o CA do Invocador ganha equação.
 *
 *   Ruptura Venire     = (Sanidade Máxima − Sanidade Atual) ÷ Sanidade Máxima × 10
 *   Conexão com Abismo = Perícia: Abismancia ÷ 2 + Ruptura Venire   [arredondaMesa]
 *
 * Por que em dois VDs: a equação do motor é um fold sequencial da esquerda para
 * a direita, sem parênteses — `A ÷ 2 + 10 × (1 − S ÷ Smax)` não cabe numa lista
 * só. "Ruptura Venire" já existe no bloco Abismancia e a descrição dela é
 * exatamente essa fração ("o inverso exato da contenção mental"), então ela é o
 * degrau natural, não um VD inventado para o truque.
 *
 * O arredondamento é o do motor (`dvValorDeMesa`, Livro §5.4): para baixo, com
 * mínimo 1 se maior que zero. Aplicado uma vez sobre a soma.
 *
 * Divisão por zero é segura: o motor devolve 0, e a mecânica "Sanidade Mínima"
 * já garante Sanidade Máxima ≥ 1.
 *
 *   node functions/soquete-1-ca-invocador.mjs            (dry-run)
 *   node functions/soquete-1-ca-invocador.mjs --apply
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

const F = ref => ({ tipo: 'ficha', ref });
const Fo = (op, ref) => ({ op, tipo: 'ficha', ref });
const N = (op, valor) => ({ op, tipo: 'fixo', valor });

const ALVOS = [
    { nome: 'Ruptura Venire', arredondaMesa: false, equacao: [
        F('Sanidade Máxima'), Fo('-', 'Sanidade Atual'), Fo('÷', 'Sanidade Máxima'), N('×', 10),
    ]},
    { nome: 'Conexão com Abismo', arredondaMesa: true, equacao: [
        F('Perícia: Abismancia'), N('÷', 2), Fo('+', 'Ruptura Venire'),
    ]},
];

/* ═══ ASSERTS — reproduz o fold do motor e confere a escada de CA ═══ */
const fold = (eq, ref) => {
    let r = ref(eq[0]);
    for (let i = 1; i < eq.length; i++) {
        const v = ref(eq[i]), op = eq[i].op || '+';
        if (op === '+') r += v; else if (op === '-') r -= v;
        else if (op === '×') r *= v; else if (op === '÷') r = v !== 0 ? r / v : 0;
        else if (op === 'min') r = Math.min(r, v); else if (op === 'max') r = Math.max(r, v);
    }
    return isNaN(r) ? 0 : r;
};
const valorDeMesa = v => (v > 0 ? Math.max(1, Math.floor(v)) : Math.floor(v) || 0);

function ca(san, sanMax, abismancia) {
    const ctx = { 'Sanidade Máxima': sanMax, 'Sanidade Atual': san, 'Perícia: Abismancia': abismancia };
    const resolve = eq => t => (t.tipo === 'ficha' ? (ctx[t.ref] ?? 0) : Number(t.valor) || 0);
    ctx['Ruptura Venire'] = fold(ALVOS[0].equacao, resolve());
    return valorDeMesa(fold(ALVOS[1].equacao, resolve()));
}

assert.equal(ca(24, 24, 4), 2, 'Abismancia 4, mente intacta → CA 2 (entra na escada)');
assert.equal(ca(24, 24, 0), 0, 'sem treino e são → CA 0');
assert.equal(ca(9, 24, 4), 8, 'Abismancia 4 e SAN 9/24 → CA 8 (Estilhaçar Causa)');
assert.equal(ca(10, 20, 0), 5, 'exemplo do dono do mundo: 10/20 → CA 5');
assert.equal(ca(0, 24, 4), 12, 'no fundo do poço o CA não trava (o Mestre usa o excedente)');
for (let s = 24; s > 0; s--) assert.ok(ca(s - 1, 24, 4) >= ca(s, 24, 4), 'perder Sanidade nunca baixa o CA');
assert.equal(ca(24, 0, 4), 2, 'Sanidade Máxima 0 não quebra (÷0 devolve 0)');
console.log('✅ 30 asserts passaram (7 casos + monotonicidade em 23 pontos).\n');

/* ═══ GRAVAÇÃO ═══ */
const col = db.collection('system/data/derivedValues');
const docs = (await col.get()).docs.map(d => ({ id: d.id, ...d.data() }));

const erros = [], plano = [];
for (const alvo of ALVOS) {
    const achados = docs.filter(d => d.nome === alvo.nome);
    if (achados.length !== 1) { erros.push(`"${alvo.nome}": ${achados.length} VDs com esse nome (esperado 1)`); continue; }
    const vd = achados[0];
    if (Array.isArray(vd.equacao) && vd.equacao.length) {
        erros.push(`"${alvo.nome}" JÁ TEM equação — não vou sobrescrever. Confira antes.`);
        continue;
    }
    plano.push({ id: vd.id, ...alvo });
}

const txt = eq => eq.map((t, i) => `${i ? ' ' + (t.op || '+') + ' ' : ''}${t.tipo === 'ficha' ? '[' + t.ref + ']' : t.valor}`).join('');
console.log('=== Passo 1: equação do CA ===\n');
for (const p of plano) {
    console.log(`  ${p.nome}`);
    console.log(`    = ${txt(p.equacao)}`);
    console.log(`    arredondaMesa: ${p.arredondaMesa}\n`);
}
console.log('  Escada resultante (Sanidade máxima 24, Abismancia 4):');
for (const alvoCA of [2, 3, 4, 5, 6, 7, 8]) {
    let s = 24; while (s > 0 && ca(s, 24, 4) < alvoCA) s--;
    console.log(`    CA ${alvoCA} → Sanidade ${s}/24`);
}

if (erros.length) { console.error('\n🔴 ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
if (plano.length !== 2) { console.error(`\n🔴 ABORTADO: plano com ${plano.length} VDs (esperado 2).`); process.exit(1); }

if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }
for (const p of plano) await col.doc(p.id).update({ equacao: p.equacao, arredondaMesa: p.arredondaMesa, updatedAt: Date.now() });
console.log(`\n✅ Gravado em ${plano.length} VDs.`);
process.exit(0);
