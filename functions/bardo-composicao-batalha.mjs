/**
 * COMPOSIÇÃO DE BATALHA (Bardo, Custo 3 — Clímax) — 0,28× na régua, mas o
 * problema real é pior: a habilidade tem valor NEGATIVO em uso.
 *
 * Texto atual: "1 ação/turno aplica 1 efeito menor sem custo: +1 Ataque a 1
 * aliado, -1 no Alvo a 1 inimigo, ou remove 1 condição menor."
 *
 *   efeito por turno .... +1 no Alvo a 1 alvo ....  +0,17
 *   custo por turno ..... 1 ação (uma rodada sua) . −1,00
 *                                                   ─────
 *                                                   −0,83
 *
 * O "sem custo" do texto se refere a não gastar Harmonia — mas gasta a ação, que
 * é o recurso mais caro do sistema (§1.1: 1 turno = 1,000). Paga-se 3 para
 * destravar a opção de perder 0,83 por turno. Ninguém usa: atacar rende mais.
 *
 * ═══ O CONSERTO ═══
 *
 * Tirar o custo de ação e alargar para o grupo. Pela tabela de projeto (§1.5),
 * Custo 3 pede 18 pontos-rodada-alvo de Alvo:
 *
 *   1 ponto × 5 rodadas × 4 aliados = 20 pontos-rodada-alvo = 3,40 un → 1,13×
 *
 * Vira a canção de regência: o Bardo continua tocando e molda o campo a cada
 * rodada sem gastar o turno. É identidade de Clímax, e não compete com o próprio
 * ataque dele.
 *
 * ═══ CUIDADO NA REDAÇÃO ═══
 *
 * A régua soma TODOS os modificadores de Alvo da frase (para ler "inimigos −1 e
 * aliados +1" como dois efeitos). Escrever "+1 aos aliados ou −1 aos inimigos"
 * faria ela contar os dois numa habilidade que só entrega um. Por isso o texto
 * declara o número uma vez e descreve a alternativa sem repetir o valor.
 *
 *   node functions/bardo-composicao-batalha.mjs            (dry-run)
 *   node functions/bardo-composicao-batalha.mjs --apply
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

const DE = '1 ação/turno aplica 1 efeito menor sem custo: +1 Ataque a 1 aliado, -1 no Alvo a 1 inimigo, ou remove 1 condição mental leve.';
const PARA = 'No início de cada turno, sem gastar ação, aplique +1 no Alvo a todos os aliados a 6m — ou o mesmo valor como penalidade a todos os inimigos a 6m.';

/* ═══ ASSERTS ═══ */
const T_ALVO = 0.585 / 3.445, ACAO = 1.00, CUSTO = 3, RODADAS = 5, ALIADOS = 4;
const porTurnoAntes = 1 * T_ALVO - ACAO;
const depois = 1 * T_ALVO * RODADAS * ALIADOS;
assert.ok(porTurnoAntes < 0, `a versão antiga rende ${porTurnoAntes.toFixed(2)} por turno — negativo`);
assert.ok(depois / CUSTO >= 1.00, `a nova passa o piso (${(depois / CUSTO).toFixed(2)}×)`);
assert.ok(depois / CUSTO <= 1.70, 'e não estoura a faixa');
assert.equal((PARA.match(/[+-]\s*\d+\s*no Alvo/gi) || []).length, 1,
    'o valor pode aparecer UMA vez só — a régua soma todos os que achar');
assert.ok(/sem gastar ação/.test(PARA), 'o custo de ação tem que sair explicitamente do texto');
assert.ok(/aliados a 6m/.test(PARA), 'plural com distância é o que a régua lê como grupo');
console.log(`✅ 6 asserts passaram.`);
console.log(`   antes: ${porTurnoAntes.toFixed(2)} por turno (negativo) · depois: ${depois.toFixed(2)} un → ${(depois / CUSTO).toFixed(2)}×\n`);

/* ═══ PLANO ═══ */
const col = db.collection('system/data/classModules');
const mods = (await col.get()).docs.map(d => ({ id: d.id, ...d.data() }));

const erros = [], plano = [];
for (const m of mods) {
    const lbl = Object.fromEntries((m.schema || []).map(f => [f.key, String(f.label || '')]));
    const kE = Object.keys(lbl).find(k => /efeito/i.test(lbl[k]));
    if (!kE) continue;
    let mexeu = false;
    const itens = (m.itensPredefinidos || []).map(it => {
        if (!/COMPOSIÇÃO DE BATALHA/i.test(it.nome || '')) return it;
        const atual = String(it.valores?.[kE] ?? '').trim().replace(/\s+/g, ' ');
        if (atual !== DE) { erros.push(`texto inesperado: ${atual}`); return it; }
        mexeu = true; plano.push(m.titulo);
        return {
            ...it, valores: { ...it.valores, [kE]: PARA }, descricao: PARA,
            alcance: 6, formaArea: 'circulo', tamanhoArea: 6, alvosMax: null,
            duracaoValor: 1, duracaoUnidade: 'cena', condicoesAplicadas: [],
        };
    });
    if (mexeu) m._novos = itens;
}

console.log('=== COMPOSIÇÃO DE BATALHA ===\n');
console.log(`  de:   ${DE}`);
console.log(`  para: ${PARA}\n`);
console.log(`  0,28× → ${(depois / CUSTO).toFixed(2)}×   (Custo 3, inalterado)`);
console.log(`  sai o custo de ação · o efeito passa a pegar o grupo · duração vira 'cena' tipada`);
console.log(`  módulo: ${plano.join(', ') || '—'}`);
if (erros.length) { console.error('\n🔴 ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
if (!plano.length) { console.error('\n🔴 ABORTADO: canção não encontrada.'); process.exit(1); }

if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }
for (const m of mods.filter(x => x._novos)) await col.doc(m.id).update({ itensPredefinidos: m._novos, updatedAt: Date.now() });
console.log('\n✅ Gravado.');
process.exit(0);
