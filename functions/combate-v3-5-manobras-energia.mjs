/**
 * Combate v3 — passo 5: manobras precificadas contra a Energia.
 *
 * Régua: 1 ENER deve valer 2 a 4 pontos de Vitalidade por combate (a reserva de
 * 6 vale 15-25% do dano de um combate inteiro, que é ~18,6).
 *
 * O achado da auditoria não foi "as manobras são fracas". Foi que ninguém
 * precificou a DURAÇÃO: 1 ENER numa Postura cobre 6 rodadas, 1 ENER num golpe
 * cobre 1. Para empatar, o golpe único teria de ser 6x mais forte por rodada.
 * Por isso quase todo golpe de 1 ENER encosta no piso da faixa.
 *
 *   Inspirar          0,20/ENER  →  3,30  (vira Ação Livre; deixa de custar o ataque)
 *   Golpe Giratório   1,45/ENER  →  2,90  (2 ENER → 1)
 *   Ataque Mudo       1,25/ENER  →  2,50  (2 ENER → 1)
 *
 * Ataque Total (0,55/ENER) fica como está por decisão do usuário.
 * Golpe Preciso do Ladino não muda: o 1,00 é contra Blindagem 2, e ele escala
 * com a armadura do alvo (3,00 contra Blindagem 6). É ferramenta antiarmadura.
 *
 * Também corrige três divergências de dado encontradas na varredura.
 *
 *   node functions/combate-v3-5-manobras-energia.mjs            (dry-run)
 *   node functions/combate-v3-5-manobras-energia.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');

const CAMPO_CUSTO = '3';     // campo "Custo:" no schema dos módulos de manobra
const CAMPO_ACAO = 'acao';

/* nome da habilidade → { patch em valores, patch no doc, descricao nova, motivo } */
const AJUSTES = {
    'Inspirar': {
        valores: { [CAMPO_ACAO]: 'Ação Livre' },
        motivo: 'grito de guerra deixa de custar o seu ataque — 0,20 → 3,30 por ENER (3 aliados)',
    },
    'Golpe Giratório': {
        valores: { [CAMPO_CUSTO]: '1 Energia' },
        motivo: 'cobrava preço de 2 e entregava de 1 — 1,45 → 2,90 por ENER (3 alvos)',
    },
    'Ataque Mudo': {
        valores: { [CAMPO_CUSTO]: '1 Energia' },
        motivo: 'já paga caro em requisito (furtivo + 3 perícias, 1×/cena) — 1,25 → 2,50 por ENER',
    },
    'Romper Defesa': {
        doc: { custoExpProprio: 1 },
        motivo: 'custoExpProprio era null; as outras oito manobras do Guerreiro têm 1',
    },
    'Salto Predatório': {
        valores: { [CAMPO_CUSTO]: '—' },
        motivo: 'o campo Custo dizia "2 Ações", duplicando o campo Ação. Nenhum custo em Energia '
            + 'foi declarado para ela em lugar nenhum — fica sem, até você definir',
    },
};

/* Livro §6.9: alinhar a tabela com o que a ficha (referência oficial) diz. */
const LIVRO = [
    ['Golpe Giratório 2 → 1 ENER',
        '<tr><td><strong>Golpe Giratório</strong></td><td>2 ENER</td>',
        '<tr><td><strong>Golpe Giratório</strong></td><td>1 ENER</td>'],
    ['Romper Defesa 2 → 1 ENER (o módulo já dizia 1)',
        '<tr><td><strong>Romper Defesa</strong></td><td>2 ENER</td>',
        '<tr><td><strong>Romper Defesa</strong></td><td>1 ENER</td>'],
];

const snap = await db.collection('system/data/classModules').get();
const mods = snap.docs.map(d => ({ _ref: d.ref, id: d.id, ...d.data() }));

const feitos = [], erros = [];
for (const m of mods) {
    if (m.id === 'Manobras') continue;
    let mexeu = false;
    const itens = (m.itensPredefinidos || []).map(it => {
        const aj = AJUSTES[it.nome || ''];
        if (!aj) return it;
        mexeu = true;
        const antesV = { ...(it.valores || {}) };
        const novo = { ...it, valores: { ...antesV, ...(aj.valores || {}) }, ...(aj.doc || {}) };
        feitos.push({
            modulo: m.titulo, nome: it.nome, motivo: aj.motivo,
            antes: aj.valores
                ? Object.keys(aj.valores).map(k => `${k}="${antesV[k]}"`).join(' ')
                : `custoExpProprio=${it.custoExpProprio}`,
            depois: aj.valores
                ? Object.entries(aj.valores).map(([k, v]) => `${k}="${v}"`).join(' ')
                : `custoExpProprio=${aj.doc.custoExpProprio}`,
        });
        return novo;
    });
    if (mexeu) m._novosItens = itens;
}

const naoAchados = Object.keys(AJUSTES).filter(n => !feitos.some(f => f.nome === n));
if (naoAchados.length) erros.push(`habilidades não encontradas: ${naoAchados.join(', ')}`);

const refLivro = db.collection('worldbuilding-articles').doc('art-regras-jogador-06');
let html = (await refLivro.get()).data().contentHTML || '';
const livroFeitos = [];
for (const [rot, de, para] of LIVRO) {
    if (!html.includes(de)) { erros.push(`Livro §6.9: trecho não encontrado — ${rot}`); continue; }
    html = html.split(de).join(para);
    livroFeitos.push(rot);
}

console.log('='.repeat(74));
console.log('COMBATE v3 — passo 5: manobras contra a Energia');
console.log('='.repeat(74));
console.log('\nMÓDULOS DE CLASSE:');
for (const f of feitos) {
    console.log(`\n  ${f.nome}   [${f.modulo}]`);
    console.log(`    ${f.antes}  →  ${f.depois}`);
    console.log(`    ${f.motivo}`);
}
console.log('\nLIVRO §6.9 (alinhar com a ficha, que é a referência oficial):');
livroFeitos.forEach(r => console.log(`  ✔ ${r}`));

console.log('\nNÃO MEXIDO, de propósito:');
console.log('  Ataque Total ......... fica em 0,55 por ENER — decisão do usuário');
console.log('  Golpe Preciso ........ 1,00 é contra Blindagem 2; escala até 3,00 contra Blindagem 6');
console.log('  Defesa extra ......... 1,10 é o piso da economia, e piso é o lugar certo dela');

/* auto-verificação */
if (feitos.length !== Object.keys(AJUSTES).length)
    erros.push(`${Object.keys(AJUSTES).length} ajustes previstos, ${feitos.length} aplicados`);
if (livroFeitos.length !== LIVRO.length)
    erros.push(`${LIVRO.length} trocas no Livro previstas, ${livroFeitos.length} aplicadas`);
if (/<td>2 ENER<\/td>/.test(html)) erros.push('ainda sobrou "2 ENER" na tabela do Livro');

const conferir = {
    'Inspirar': it => it.valores[CAMPO_ACAO] === 'Ação Livre',
    'Golpe Giratório': it => it.valores[CAMPO_CUSTO] === '1 Energia',
    'Ataque Mudo': it => it.valores[CAMPO_CUSTO] === '1 Energia',
    'Romper Defesa': it => it.custoExpProprio === 1,
    'Salto Predatório': it => it.valores[CAMPO_CUSTO] === '—',
};
for (const m of mods) for (const it of (m._novosItens || [])) {
    const chk = conferir[it.nome];
    if (chk && !chk(it)) erros.push(`${it.nome}: patch não pegou`);
}

if (erros.length) { console.error('\n🔴 ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
console.log(`\n✅ auto-verificação: ${feitos.length} ajustes nos módulos, ${livroFeitos.length} no Livro, todos conferidos.`);

if (!APPLY) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

const batch = db.batch();
let nMods = 0;
for (const m of mods) if (m._novosItens) { batch.update(m._ref, { itensPredefinidos: m._novosItens, updatedAt: Date.now() }); nMods++; }
batch.update(refLivro, {
    contentHTML: html, updatedAt: Date.now(),
    words: html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length,
});
await batch.commit();
console.log(`\n✅ Gravado: ${feitos.length} habilidades em ${nMods} módulos + Livro §6.9.`);
process.exit(0);
