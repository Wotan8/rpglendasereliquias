/**
 * O EXP entra no denominador da régua (decisão de 24/08/2026).
 *
 *      custo total = recursos + ação + 0,10 × EXP
 *
 * DE ONDE SAI O 0,10. Um jogador ganha de 0 a 12 EXP por sessão, média ~6.
 * A 0,10 por EXP, 10 EXP compram 1 unidade — uma rodada de guerreiro, e
 * permanente. Uma sessão compra ~0,6 unidade de poder que não volta; vinte
 * sessões compram ~12, que é a ordem do crescimento de um personagem numa
 * campanha inteira. É a âncora que faltava.
 *
 * POR QUE O VALOR É PEQUENO, e isso é de propósito: recurso e ação são pagos
 * A CADA USO; o EXP é pago UMA VEZ e a habilidade fica. Cobrar EXP como se
 * fosse custo por ativação colocaria toda habilidade no vermelho — a 1,67 por
 * EXP (a conta ingênua "6 EXP = 10 unidades de uma sessão"), uma manobra de
 * 1 EXP teria denominador 3,67 em vez de 2,00.
 *
 * O QUE ISSO CONSERTA: as capstones. Cólera e Ataque Mudo custam 5 EXP e liam
 * acima do teto porque o denominador ignorava o que elas custaram para existir.
 *
 * Também corrige a NOTA PENETRANTE: Ofuscado → Abalado 2.
 *
 *   node functions/exp-no-denominador.mjs            (dry-run)
 *   node functions/exp-no-denominador.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const D = db.collection('system').doc('data');
const APPLY = process.argv.includes('--apply');
const r2 = n => Math.round(n * 100) / 100;
export const UNIDADE_POR_EXP = 0.10;

const classeDe = {};
for (const doc of (await D.collection('classes').get()).docs)
    for (const m of (doc.data().modulosDaClasse || [])) classeDe[m] = doc.data().nome;

const mudou = [], saiuDaFaixa = [], entrouNaFaixa = [];
for (const doc of (await D.collection('classModules').get()).docs) {
    const m = doc.data();
    if (m.publicado === false) continue;
    let alterou = false;
    const itens = (m.itensPredefinidos || []).map(p => {
        let q = p;

        // NOTA PENETRANTE: Ofuscado -> Abalado 2
        if (p.id === 'pdi_sono_1785112141051_c10') {
            const t = 'Até 2 inimigos no raio sofrem 1d4 de dano sônico e ficam Abalado 2 por 3 rodadas.';
            // 1d4 (0,77) + Abalado 2 x 0,167 x 3 rodadas x 2 alvos x 0,85 (1,70)
            q = { ...q, descricao: t, valores: { ...q.valores, 10: t },
                condicoesAplicadas: [{ condicao: 'Abalado', portao: 'resistencia', chance: null, alvos: 2, rodadas: 3, nivel: 2 }],
                regua: { ...q.regua, unidades: 2.47 } };
            alterou = true;
        }

        const r = q.regua;
        if (!r || r.custo == null || r.razao == null || r.expNoCusto) return q;
        const exp = Number(q.custoExpProprio) || 0;
        const custo = r2(r.custo + UNIDADE_POR_EXP * exp);
        const razao = r2(r.unidades / custo);
        alterou = true;
        const ref = `${classeDe[doc.id] || '?'} · ${q.nome}`;
        const teto = (q.condicoesAplicadas || []).some(c => c.portao === 'resistencia') ? 2.00 : 1.70;
        if (r.razao >= 1 && r.razao <= teto && (razao < 1 || razao > teto)) saiuDaFaixa.push(`${ref}: ${r.razao}x → ${razao}x`);
        if ((r.razao < 1 || r.razao > teto) && razao >= 1 && razao <= teto) entrouNaFaixa.push(`${ref}: ${r.razao}x → ${razao}x`);
        if (exp > 1) mudou.push(`${ref}  ${exp} EXP  ${r.razao}x → ${razao}x`);
        return { ...q, regua: { ...r, custo, razao, expNoCusto: exp, em: '2026-08-24' } };
    });
    if (alterou && APPLY) await doc.ref.update({ itensPredefinidos: itens });
}

console.log(`${APPLY ? 'APLICADO' : 'DRY-RUN'} · taxa ${UNIDADE_POR_EXP} unidade por EXP\n`);
console.log('habilidades de mais de 1 EXP (onde o efeito é grande):');
mudou.forEach(x => console.log(`  ${x}`));
if (entrouNaFaixa.length) { console.log('\nENTRARAM na faixa:'); entrouNaFaixa.forEach(x => console.log(`  ✓ ${x}`)); }
if (saiuDaFaixa.length) { console.log('\nSAÍRAM da faixa:'); saiuDaFaixa.forEach(x => console.log(`  ! ${x}`)); }
if (!APPLY) console.log('\nrode com --apply');
process.exit(0);
