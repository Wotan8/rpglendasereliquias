/**
 * Perícias nos aliados animais — a Dádiva de Perícia saía vazia em 10 de 10.
 *
 * A Dádiva de Perícia sorteia UMA DE CADA CATEGORIA (físico, social, mental,
 * combate) entre as que o hóspede TEM. Com `periciasEstruturadas: []` em todas
 * as fichas de aliado, ela nunca entregava nada — e o Druida que funde jamais
 * recebia perícia de bicho nenhum.
 *
 * Cada aliado sai daqui com pelo menos uma perícia de CADA UMA das quatro
 * categorias. O script trava se faltar alguma.
 *
 * BRIGA É DERIVADA, NÃO ESCOLHIDA: sai de `Alvo do golpe − max(FOR, DES)`, para
 * a perícia bater com o ataque que já está escrito na ficha. Onde a conta dá
 * zero ou menos, o bicho simplesmente não recebe Briga — é o caso do Urso, cujo
 * Alvo 5 já é menor que a FOR 6 dele.
 *
 *   node functions/bestiario-pericias-aliados.mjs            (dry-run)
 *   node functions/bestiario-pericias-aliados.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');
const AUTOR = 'igorestevamalvesdesouza@gmail.com';

/* nome → perícias, sem Briga (que é derivada do Alvo) */
const ALIADOS = {
    'Lobo':        { Sobrevivência: 3, Observação: 2, Intimidação: 2, Esquiva: 1, Resiliência: 1 },
    'Urso':        { Atletismo: 3, Intimidação: 3, Observação: 1, Bloquear: 1, Resiliência: 2 },
    'Corvo':       { Furtividade: 2, Acrobacia: 2, Observação: 4, Esquiva: 2, Erudição: 1 },
    'Serpente':    { Furtividade: 4, Observação: 2, Reflexo: 2, Resiliência: 1 },
    'Cão-Pastor':  { Sobrevivência: 3, Atletismo: 2, Observação: 3, Liderança: 2, Esquiva: 1, Resiliência: 1 },
    'Rouba-Rede':  { Furtividade: 3, Atletismo: 3, Observação: 2, Malandragem: 2, Evadir: 2, Resiliência: 1 },
    'Rasga-Palha': { Acrobacia: 3, Furtividade: 2, Observação: 4, Esquiva: 2, Resiliência: 1 },
    'Fuça-Fundo':  { Atletismo: 3, Labuta: 3, Observação: 3, Intimidação: 1, Resiliência: 2, 'Contra-Ataque': 2 },
    'Fenor':       { Labuta: 3, Atletismo: 2, Observação: 1, Evadir: 1, Resiliência: 3 },
    'Papa-Broto':  { Agilidade: 4, Acrobacia: 3, Furtividade: 2, Observação: 3, Evadir: 2, Resiliência: 1 },
};
const CATEGORIAS = ['fisico', 'social', 'mental', 'combate'];

const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const grab = async c => (await db.collection(c).get()).docs;
const [npcDocs, skDocs] = await Promise.all([grab('npcs'), grab('system/data/skills')]);
const skills = skDocs.map(d => ({ id: d.id, ...d.data() }));
const skPorNome = {}; for (const s of skills) skPorNome[norm(s.nome)] = s;
const erros = [];

const acum = (nv, por) => { let t = 0; for (let i = 1; i <= nv; i++) t += i * por; return t; };
const plano = [];
for (const [nome, mapa] of Object.entries(ALIADOS)) {
    const d = npcDocs.filter(x => (x.data().nome || '') === nome);
    if (d.length !== 1) { erros.push(`"${nome}": ${d.length} docs`); continue; }
    const n = d[0].data();
    if (n.tipo !== 'criatura') { erros.push(`"${nome}" não é criatura`); continue; }

    const lista = { ...mapa };
    /* Briga sai do Alvo já escrito no ataque, para a ficha não se contradizer */
    const g = /Alvo (\d+)/.exec(String(n.ataques || '').split('\n').find(l => /Alvo\s*\d/.test(l)) || '');
    const base = Math.max(Number(n.atributos?.FOR) || 0, Number(n.atributos?.DES) || 0);
    const briga = g ? Number(g[1]) - base : 0;
    if (briga > 0) lista.Briga = briga;

    const pericias = [], porCat = {};
    for (const [nomePer, nivel] of Object.entries(lista)) {
        const s = skPorNome[norm(nomePer)];
        if (!s) { erros.push(`${nome}: perícia "${nomePer}" não existe no catálogo`); continue; }
        pericias.push({ refId: s.id, nivel });
        porCat[s.categoria] = (porCat[s.categoria] || 0) + 1;
    }
    const faltando = CATEGORIAS.filter(c => !porCat[c]);
    if (faltando.length) erros.push(`${nome}: sem perícia de ${faltando.join(', ')} — a Dádiva de Perícia sai vazia nessa(s) categoria(s)`);
    if ((n.periciasEstruturadas || []).length) erros.push(`${nome} já tem ${n.periciasEstruturadas.length} perícias — pare e confira`);

    const poderAtr = ['INT', 'RAC', 'PRS', 'FOR', 'DES', 'VIG', 'PRE', 'MAN', 'AUT']
        .reduce((s, k) => s + acum(Number(n.atributos?.[k]) || 0, 5), 0);
    const poderPer = pericias.reduce((s, p) =>
        s + acum(p.nivel, Number(skills.find(x => x.id === p.refId)?.custoEvolucao) || 4), 0);

    plano.push({ ref: d[0].ref, nome, lista, pericias, porCat, briga,
        alvo: g?.[1], base, poderAtr, poderPer });
}

/* ── relatório ── */
console.log(`\n=== Perícias nos ${plano.length} aliados ===\n`);
console.log('aliado         fis soc men com   Briga (Alvo − FOR/DES)   ⚡ Poder');
for (const p of plano) {
    const b = p.briga > 0 ? `${p.briga}  (${p.alvo} − ${p.base})` : `—    (${p.alvo} − ${p.base} ≤ 0)`;
    console.log(`${p.nome.padEnd(14)} ${String(p.porCat.fisico || 0).padStart(3)} ${String(p.porCat.social || 0).padStart(3)} ${String(p.porCat.mental || 0).padStart(3)} ${String(p.porCat.combate || 0).padStart(3)}   ${b.padEnd(22)} ${p.poderAtr} → ${p.poderAtr + p.poderPer}  (+${p.poderPer})`);
}
console.log('\nDetalhe:');
for (const p of plano) console.log(`   ${p.nome.padEnd(14)} ${Object.entries(p.lista).map(([k, v]) => `${k} ${v}`).join(' · ')}`);

if (erros.length) { console.error('\n🔴 ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

const iso = new Date().toISOString();
const batch = db.batch();
for (const p of plano) batch.update(p.ref, {
    periciasEstruturadas: p.pericias, lastUpdate: iso, lastUpdateBy: AUTOR });
await batch.commit();
console.log(`\n✅ ${plano.length} aliados com perícia nas quatro categorias.`);
process.exit(0);
