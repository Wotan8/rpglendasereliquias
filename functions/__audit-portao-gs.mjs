/**
 * O portão de resistência, fechado — e a invariante que ele criou.
 *
 * REGRA (fecha um ponto em aberto do §5.3): a condição pega quando os Graus
 * do conjurador alcançam o atributo do alvo, GS >= AUT, igual à rolagem de
 * combate. Como GS = Alvo − resultado (§0.1) e o 10 sempre falha:
 *
 *      P(pega) = (Alvo do conjurador − AUT do alvo) / 10
 *
 * Já embute o acerto: rolagem falha não gera Grau. Substitui o ×0,50 que o
 * §6.1 usava só de ilustração.
 *
 * INVARIANTE: buff em si mesmo ou em aliado NÃO tem portão de resistência
 * (§1.2 — passa só pelo teste de quem conjura). Marcar buff como resistido
 * cobra do alvo um teste para receber uma bênção, e com Redutor fundo produz
 * P = 0,00: foi o que aconteceu com a Armadura Sanguínea.
 *
 *   node functions/__audit-portao-gs.mjs
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();

const pGS = (alvo, aut) => Math.max(0, Math.min(alvo, 9) - aut) / 10;
assert.equal(pGS(7, 0), 0.70, 'GS >= 0 é o mesmo que acertar a conjuração');
assert.equal(pGS(7, 3), 0.40);
assert.equal(pGS(4, 3), 0.10, 'Redutor −3 sobre Alvo 7 deixa 1 resultado em 10');
assert.equal(pGS(3, 3), 0.00, 'AUT alcançando o Alvo é imunidade — e o alerta abaixo existe por isso');

console.log('Alvo do conjurador 7, AUT típico 3\n Redutor  Alvo  P(GS>=AUT)');
for (const r of [0, -1, -2, -3, -4]) console.log(`   ${String(r).padStart(2)}      ${7 + r}      ${pGS(7 + r, 3).toFixed(2)}`);

/* Quem é buff (não deveria ter portão) — pelo texto do efeito. */
const EH_BUFF = /Blindado|Fortalecido|Célere|aliado|Você fica|escudo de sangue|Armadura completa/i;
const mods = (await db.collection('system/data/classModules').get()).docs.map((d) => d.data());
const problemas = [];
let comPortao = 0, semPortao = 0;
for (const m of mods) {
    const lbl = Object.fromEntries((m.schema || []).map((f) => [f.key, String(f.label || '')]));
    const kR = Object.keys(lbl).find((x) => /^redutor/i.test(lbl[x]));
    const kE = Object.keys(lbl).find((x) => /^efeito/i.test(lbl[x]));
    for (const it of (m.itensPredefinidos || [])) {
        const cs = (it.condicoesAplicadas || []).filter((c) => c && c.condicao);
        if (!cs.length) continue;
        const red = Number(String(kR ? it.valores?.[kR] ?? 0 : 0).replace(',', '.')) || 0;
        const txt = `${it.descricao || ''} ${it.valores?.[kE] || ''}`;
        for (const c of cs) {
            if (c.portao === 'resistencia') comPortao++; else semPortao++;
            if (c.portao === 'resistencia' && EH_BUFF.test(txt))
                problemas.push(`BUFF COM PORTÃO · ${it.nome} → ${c.condicao}`);
            if (c.portao === 'resistencia' && pGS(7 + red, 3) === 0)
                problemas.push(`IMPOSSÍVEL · ${it.nome}: Redutor ${red} contra AUT 3 dá P = 0,00`);
        }
    }
}
console.log(`\n condições aplicadas: ${comPortao} com resistência · ${semPortao} sem portão (buff)`);
console.log(` problemas: ${problemas.length ? '\n   ' + [...new Set(problemas)].join('\n   ') : 'nenhum'}`);
assert.equal(problemas.length, 0, 'nenhum buff pode exigir teste de resistência do alvo');
console.log('\n✅ invariante do portão mantida.');
