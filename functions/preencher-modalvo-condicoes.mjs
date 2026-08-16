/**
 * Preenche o `modAlvo` / `modAlvoTestes` das condições — o número que o
 * Tabuleiro subtrai do Alvo (ver shared/combate-cenas.js, efeitoDasCondicoes).
 *
 * Até agora esse número só existia como TEXTO ("−2 no Alvo de todos os
 * testes"), então ninguém subtraía nada na mesa.
 *
 * ⚠️ SÓ entram condições cuja penalidade é de QUEM CARREGA a condição, e sem
 * ressalva. Ficaram DE FORA, de propósito:
 *   · Exposto e Prostrado — o número é no Alvo de QUEM ATACA o portador, não
 *     no dele. Preencher aqui penalizaria a pessoa errada.
 *   · Provocado — "−2 em ataques contra quem NÃO seja o provocador": depende
 *     de quem é o alvo do golpe, e o motor não recebe essa informação.
 *   · Ofuscado — o número que aparece no texto é a régua de balanceamento.
 *
 *   node functions/preencher-modalvo-condicoes.mjs            (dry-run)
 *   node functions/preencher-modalvo-condicoes.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');

/* nome → { porNivel: {nivel: mod}, geral: mod }  (o texto que justifica cada um) */
const PLANO = {
    'Abalado':     { porNivel: { 1: -1, 2: -2, 3: -3 } },
    'Corrompido':  { porNivel: { 1: -1, 2: -2, 3: -3 } },
    // nível 3 diz "efeitos de Exaustão 2", então repete o −2 do nível 2
    'Exaustão':    { porNivel: { 1: -1, 2: -2, 3: -2 } },
    'Cego':        { geral: -4 },
    'Amedrontado': { geral: -1 },
};

const snap = await db.collection('system/data/conditions').get();
const lote = db.batch();
let mudancas = 0;

console.log('='.repeat(70));
console.log('modAlvo das condições' + (APPLY ? '  — GRAVANDO' : '  — DRY-RUN'));
console.log('='.repeat(70));

for (const d of snap.docs) {
    const c = d.data();
    const plano = PLANO[c.nome];
    if (!plano) continue;
    const patch = {};

    if (plano.porNivel) {
        const linhas = (c.efeitoPorNivel || []).map(l => ({ ...l }));
        let mexeu = false;
        for (const l of linhas) {
            const novo = plano.porNivel[Number(l.nivel)];
            if (novo == null || l.modAlvo === novo) continue;
            console.log(`  ${c.nome} nv ${l.nivel}: modAlvo ${JSON.stringify(l.modAlvo)} → ${novo}   "${String(l.efeito).slice(0, 52)}"`);
            l.modAlvo = novo; mexeu = true;
        }
        const faltando = Object.keys(plano.porNivel).filter(n => !linhas.some(l => Number(l.nivel) === Number(n)));
        if (faltando.length) console.log(`  ⚠️ ${c.nome}: nível(is) ${faltando.join(', ')} não existem no cadastro — nada a preencher`);
        if (mexeu) patch.efeitoPorNivel = linhas;
    }
    if (plano.geral != null && c.modAlvoTestes !== plano.geral) {
        console.log(`  ${c.nome}: modAlvoTestes ${JSON.stringify(c.modAlvoTestes)} → ${plano.geral}`);
        patch.modAlvoTestes = plano.geral;
    }
    if (Object.keys(patch).length) { lote.update(d.ref, patch); mudancas++; }
}

const naoAchadas = Object.keys(PLANO).filter(n => !snap.docs.some(d => d.data().nome === n));
if (naoAchadas.length) console.log(`\n🔴 não encontradas no banco: ${naoAchadas.join(', ')}`);

console.log(`\n${mudancas} condição(ões) a atualizar.`);
if (!APPLY) { console.log('DRY-RUN. Rode com --apply para gravar.'); process.exit(0); }
if (mudancas) await lote.commit();
console.log('✅ gravado.');
process.exit(0);
