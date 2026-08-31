/**
 * Bestiário — cadastra a perícia de arma natural das criaturas que não têm
 * nenhuma. Item 7 do handoff: "a força de uma criatura não custa ⚡ Poder" —
 * Alvo e dado são digitados livremente no texto de `ataques`, e o Poder só
 * soma o que está em `periciasEstruturadas`. Sem a perícia, uma criatura pode
 * ter força 3× e Poder muito abaixo do que ela realmente entrega.
 *
 * A perícia de arma natural é sempre BRIGA — é o que toda ficha de canône já
 * cadastrada usa (Lobo, Urso, Cão-Pastor, Serpente...). O NÍVEL não é
 * inventado: é derivado do próprio Alvo que já está escrito em `ataques`,
 * pela mesma régua v3 (Alvo = (FOR max DES) + perícia):
 *
 *     nível = max(0, Alvo − max(FOR, DES))
 *
 * Isso não muda nem o Alvo nem a força em × guerreiro — os dois continuam
 * exatamente os mesmos, escritos à mão em `ataques`. Só passa a existir um
 * registro que EXPLICA de onde aquele Alvo vem, e que o Poder pode somar.
 *
 * Criatura que JÁ tem Briga cadastrada fica INTOCADA — a calibração dela pode
 * ter sido feita por outro motivo (ex.: Urso tem FOR 6 sozinho cobrindo o
 * Alvo, nível calculado dá 0 e não se grava nível 0 à toa). Criatura de mesa
 * (mesaId preenchido) também fica de fora — não se mexe sem perguntar.
 *
 *   node functions/bestiario-briga-poder.mjs            (dry-run)
 *   node functions/bestiario-briga-poder.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');
const AUTOR = 'igorestevamalvesdesouza@gmail.com';

const grab = async c => (await db.collection(c).get()).docs.map(d => ({ id: d.id, ...d.data() }));
const [npcs, skills] = await Promise.all([grab('npcs'), grab('system/data/skills')]);
const briga = skills.find(s => s.nome === 'Briga');
if (!briga) { console.log('❌ perícia "Briga" não achada no catálogo'); process.exit(1); }
const custoEvolucao = Number(briga.custoEvolucao) || 4;
const custoDe = n => custoEvolucao * n * (n + 1) / 2;

const erros = [];
const cri = npcs.filter(n => n.tipo === 'criatura');
const plano = [], jaTem = [], nivelZero = [];

for (const n of cri) {
    if (n.mesaId) { continue; }   // mesa em andamento, não mexe

    const temBriga = (n.periciasEstruturadas || []).some(p => p.refId === briga.id);
    if (temBriga) { jaTem.push(n.nome); continue; }

    const atq = (String(n.ataques || '').split('\n').find(l => /Alvo\s*\d/.test(l)) || '').trim();
    const g = /Alvo (\d+)/.exec(atq);
    if (!g) { erros.push(`"${n.nome}": Alvo não legível em ataques — "${atq}"`); continue; }
    const alvo = Number(g[1]);
    const FOR = Number(n.atributos?.FOR) || 0, DES = Number(n.atributos?.DES) || 0;
    const nivel = Math.max(0, alvo - Math.max(FOR, DES));

    if (nivel === 0) { nivelZero.push(`${n.nome} (Alvo ${alvo}, FOR/DES ${Math.max(FOR, DES)} já cobre sozinho)`); continue; }

    plano.push({
        ref: db.collection('npcs').doc(n.id), nome: n.nome, alvo, FOR, DES, nivel,
        custo: custoDe(nivel), periciasAtuais: n.periciasEstruturadas || [],
    });
}

console.log(`\n=== Perícia de arma natural (Briga) — ${plano.length} criaturas para cadastrar ===\n`);
console.log('nome                       Alvo  FOR  DES  nível de Briga   custo Exp adicionado');
for (const p of plano.sort((a, b) => b.nivel - a.nivel))
    console.log(`${p.nome.padEnd(26)} ${String(p.alvo).padStart(4)}  ${String(p.FOR).padStart(3)}  ${String(p.DES).padStart(3)}  ${String(p.nivel).padStart(14)}   +${p.custo} EXP`);

console.log(`\nJá tinham Briga cadastrada, intocadas (${jaTem.length}): ${jaTem.join(', ')}`);
console.log(`\nNível calculado 0 — não precisam de registro (${nivelZero.length}):`);
nivelZero.forEach(s => console.log(`   ${s}`));

if (erros.length) { console.log('\n❌ ERROS — nada foi gravado:'); erros.forEach(e => console.log('   ' + e)); process.exit(1); }

if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

const iso = new Date().toISOString();
const batch = db.batch();
for (const p of plano) batch.update(p.ref, {
    periciasEstruturadas: [...p.periciasAtuais, { refId: briga.id, nivel: p.nivel }],
    lastUpdate: iso, lastUpdateBy: AUTOR,
});
await batch.commit();
console.log(`\n✅ ${plano.length} criaturas com Briga cadastrada — Poder agora reflete a força.`);
process.exit(0);
