/**
 * As 13 armas de disparo estavam com `alcanceM` VAZIO — alcance 0, tiro
 * nenhum. Este script preenche a capacidade de cada uma e marca as que não
 * passam pelo braço.
 *
 * ═══ COMO OS NÚMEROS FORAM ESCOLHIDOS ═══
 *
 * A âncora é a FOR: 1 ponto = 10 m (o Deslocamento Terrestre da linha de base).
 * A distribuição real nas 40 fichas é min 1 · MEDIANA 3 · máx 10, com a massa
 * em 1–3. Então o arqueiro típico sustenta 30 m.
 *
 * Os arcos foram escalonados EM VOLTA desse 30:
 *   · abaixo (Funda 20)          → a arma é o gargalo mesmo para FOR média;
 *   · em cima (Simples 30)       → arma e braço empatam na mediana;
 *   · acima (Longo 60)           → só rende de verdade a partir de FOR 6.
 * É isso que faz o arco caro valer a pena PARA QUEM TEM FORÇA, e não para
 * todo mundo — a diferença entre Arco Longo e Arco Simples só aparece
 * acima de FOR 3.
 *
 * As BESTAS ignoram o limite de FOR (decisão do mestre): são armadas por
 * manivela ou estribo antes do tiro. Por isso o alcance delas é o alcance
 * REAL, sem corte — e foram mantidas mais curtas que os arcos de topo, senão
 * seriam estritamente melhores que arco para todo mundo. A Besta de Sítio é a
 * exceção proposital: é peça de cerco.
 *
 * Estes são números de MESA, não de física — mexer neles no Painel do Criador
 * é esperado. O que não pode voltar é o campo vazio.
 *
 *   node functions/__aplica-alcance-disparo.mjs            (dry-run)
 *   node functions/__aplica-alcance-disparo.mjs --apply
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({
    credential: admin.credential.cert(
        require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')),
});
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

const METROS_POR_FOR = 10;

//                            alcance  ignoraFOR
const ARMAS = {
    // ── Arcos: puxados pelo braço, a FOR corta ──
    'Arco Simples':          [30, false],   // empata com a FOR mediana (3)
    'Arco Garnute':          [35, false],
    'Arco Composto':         [45, false],
    'Arco de Guerra':        [50, false],
    'Arco Longo':            [60, false],   // só rende inteiro a partir de FOR 6
    'Funda':                 [20, false],   // a arma é o gargalo já na mediana

    // ── Bestas: armadas por manivela, o braço não entra ──
    'Besta de Mão':          [20, true],
    'Besta de Repetição':    [25, true],
    'Besta Leve':            [30, true],
    'Besta de Caça':         [35, true],
    'Besta Menin':           [35, true],
    'Besta Pesada':          [45, true],
    'Besta de Sítio Gélida': [70, true],    // peça de cerco, de propósito
};

/* A regra que os números têm que respeitar, conferida aqui: */
const arcos = Object.entries(ARMAS).filter(([, [, ig]]) => !ig).map(([, [a]]) => a);
const bestas = Object.entries(ARMAS).filter(([, [, ig]]) => ig).map(([, [a]]) => a);
// nenhuma besta comum (fora a de cerco) pode passar do melhor arco
assert.ok(Math.max(...bestas.filter(a => a < 70)) < Math.max(...arcos),
    'besta comum não pode alcançar mais que o melhor arco');
// o arco mediano tem que empatar com a FOR mediana, senão a régua da FOR não morde
assert.equal(ARMAS['Arco Simples'][0], 3 * METROS_POR_FOR,
    'o arco de entrada tem que empatar com a FOR mediana (3)');

console.log('-- ALCANCE DAS ARMAS DE DISPARO --');
console.log(`   (FOR media = 3 sustenta ${3 * METROS_POR_FOR} m)\n`);

const snap = await db.collection('system/data/equipment').get();
let n = 0, faltando = Object.keys(ARMAS);

for (const d of snap.docs) {
    const e = d.data();
    const nome = (e.nome || '').trim();
    const cfg = ARMAS[nome];
    if (!cfg) continue;
    faltando = faltando.filter(x => x !== nome);
    const [alcance, ignora] = cfg;

    const igual = Number(e.alcanceM) === alcance && !!e.ignoraLimiteForDisparo === ignora;
    if (igual) { console.log(`   = ${nome.padEnd(24)} ja bate`); continue; }

    const efetivoFor3 = ignora ? alcance : Math.min(alcance, 3 * METROS_POR_FOR);
    console.log(`   ${nome.padEnd(24)} ${String(e.alcanceM ?? 'vazio').padStart(5)} -> ${String(alcance).padStart(3)} m`
        + (ignora ? '  [ignora FOR]' : `  (FOR 3 usa ${efetivoFor3} m)`));
    n++;
    if (APLICAR) await d.ref.update({
        alcanceM: alcance,
        ignoraLimiteForDisparo: ignora,
        updatedAt: admin.firestore.Timestamp.now(),
    });
}

if (faltando.length) console.log(`\n   AVISO: nao encontradas no catalogo: ${faltando.join(', ')}`);
console.log(`\n${n} arma(s) a mudar`);
console.log(APLICAR ? 'APLICADO no Firestore' : 'dry-run - rode com --apply para gravar');
process.exit(0);
