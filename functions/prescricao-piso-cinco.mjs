/**
 * As cinco últimas abaixo da faixa.
 *
 * REGRA DA CASA, reafirmada pelo dono do mundo: ficar 15% ABAIXO é muito pior
 * que ficar no teto da faixa. Habilidade abaixo de 1,00× é armadilha — o
 * jogador paga o recurso e recebe menos do que pagou, e a habilidade morre no
 * catálogo sem ninguém escolher. 1,70× é o topo da faixa de trabalho, não um
 * estouro: continua legal.
 *
 * Três delas dão exatamente 0,85 = 0,170 × 5 rodadas — um modificador de 1
 * ponto por uma cena, o menor efeito sustentado que o sistema sabe expressar.
 * Como não existe degrau intermediário, o conserto é dobrar.
 *
 *   Membros Sanguíneos   +1 → +2 em testes relacionados        0,85× → 1,70×
 *   Distração da Fé I    -1 → -2 na Reação do alvo             0,85× → 1,70×
 *   INTIMIDAÇÃO SÔNICA   1 → 2 inimigos                        0,85× → 1,70×
 *   Luz do Teleporte I   1 → 2 alvos                           0,83× → 1,66×
 *   Luz Reveladora I     raio 3m → 4,5m, 4 alvos               0,96× → 1,28×
 *
 *   node functions/prescricao-piso-cinco.mjs            (dry-run)
 *   node functions/prescricao-piso-cinco.mjs --apply
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

const P = [
    {
        nome: 'Membros Sanguíneos', esperado: 1.70,
        de: 'Cada membro concede +1 em testes relacionados.',
        para: 'Cada membro concede +2 em testes relacionados.',
    },
    {
        nome: 'Distração da Fé I', esperado: 1.70,
        de: '-1 Reação do alvo por 1 cena.',
        para: '-2 Reação do alvo por 1 cena.',
    },
    {
        nome: 'INTIMIDAÇÃO SÔNICA [V, P]', esperado: 1.70,
        de: '1 inimigo a 6m testa AUT vs GS. Falha: Amedrontado por 1 cena.',
        para: '2 inimigos a 6m testam AUT vs GS. Falha: Amedrontado por 1 cena.',
        alvosMax: 2,
    },
    {
        nome: 'Luz do Teleporte I', esperado: 1.66,
        de: 'Teleporta 1 alvo ao alcance da luz',
        para: 'Teleporta até 2 alvos ao alcance da luz',
        alvosMax: 2,
    },
    {
        nome: 'Luz Reveladora I', esperado: 1.28,
        de: 'Cria uma luz sutil num raio de 3m',
        para: 'Cria uma luz sutil num raio de 4,5m',
        alvosMax: 4, tamanhoArea: 4.5,
    },
];

assert.equal(P.length, 5);
assert.ok(P.every(p => p.esperado >= 1.00), 'nenhuma pode continuar abaixo da linha');
assert.ok(P.every(p => p.esperado <= 1.70), 'nenhuma pode passar do teto da faixa');
assert.ok(P.every(p => p.de !== p.para), 'todo reparo muda o texto');

const snap = await db.collection('system/data/classModules').get();
const erros = [], plano = [], alterados = new Map();

for (const d of snap.docs) {
    const m = d.data();
    let mexeu = false;
    const itens = (m.itensPredefinidos || []).map(it => {
        const p = P.find(x => x.nome === it.nome);
        if (!p) return it;
        const trocas = [];
        let desc = it.descricao || '';
        if (desc.includes(p.de)) { desc = desc.replace(p.de, p.para); trocas.push('descricao'); }
        const valores = { ...(it.valores || {}) };
        for (const [k, v] of Object.entries(valores))
            if (typeof v === 'string' && v.includes(p.de)) { valores[k] = v.replace(p.de, p.para); trocas.push(`valores.${k}`); }
        if (!trocas.length) { erros.push(`${p.nome}: texto de origem não achado`); return it; }
        mexeu = true;
        plano.push({ ...p, modulo: m.titulo, trocas });
        return {
            ...it, descricao: desc, valores,
            ...(p.alvosMax != null ? { alvosMax: p.alvosMax } : {}),
            ...(p.tamanhoArea != null ? { tamanhoArea: p.tamanhoArea } : {}),
        };
    });
    if (mexeu) alterados.set(d.ref, itens);
}
const faltando = P.filter(p => !plano.some(x => x.nome === p.nome));
if (faltando.length) erros.push(`não achadas: ${faltando.map(p => p.nome).join(', ')}`);

console.log('=== As cinco abaixo da linha ===\n');
for (const p of plano) {
    console.log(`▸ ${p.nome}  [${p.modulo}]  → ~${p.esperado.toFixed(2)}×`);
    console.log(`   "${p.de.slice(0, 60)}"`);
    console.log(`   "${p.para.slice(0, 60)}"`);
    console.log(`   ${p.trocas.join(' + ')}${p.alvosMax ? ` · alvosMax ${p.alvosMax}` : ''}${p.tamanhoArea ? ` · área ${p.tamanhoArea}m` : ''}`);
}
if (erros.length) { console.error('\n🔴 ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

const batch = db.batch();
for (const [ref, itens] of alterados) batch.update(ref, { itensPredefinidos: itens, atualizadoEm: admin.firestore.Timestamp.now() });
await batch.commit();
console.log('\n✅ Gravado.');
process.exit(0);
