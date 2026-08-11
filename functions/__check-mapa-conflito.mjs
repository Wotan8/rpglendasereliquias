/* Roda os MESMOS módulos da tela contra o banco real, sem navegador.
   Além dos asserts, escreve mapa-conflito/__previa.html — a tela como ela
   fica com os dados de hoje, útil para conferir layout sem precisar logar.

     node functions/__check-mapa-conflito.mjs                                 */
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { agruparPorAcao, habilidadesDaClasse, colunaClasse, cardDefesa }
    from '../mapa-conflito/js/conflito-dados.js';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const lista = async c => (await db.collection(`system/data/${c}`).get()).docs.map(d=>({id:d.id,...d.data()}));

const [classes, mods, peric, conds, vds] = await Promise.all(
    ['classes','classModules','skills','conditions','derivedValues'].map(lista));
const modulos = Object.fromEntries(mods.map(m=>[m.id,m]));
const mapas = {
    pericias:  Object.fromEntries(peric.map(p=>[p.id,p.nome])),
    condicoes: Object.fromEntries(conds.map(c=>[c.id,c.nome])),
};
classes.sort((a,b)=>String(a.nome).localeCompare(String(b.nome),'pt-BR'));
const defesas = vds.filter(v=>v.blocoId==='defesa').sort((a,b)=>(a.ordem||0)-(b.ordem||0));

/* ═══ Relatório + coleta de problemas ═══ */
const semNada = [], idsCrus = [], semAcao = [];
for (const c of classes) {
    const habs = habilidadesDaClasse(c, modulos, mapas);
    const g = agruparPorAcao(habs);
    console.log(`\n══ ${c.nome}  [${c.atributoChave||'?'}]  ${habs.length} habilidades`);
    for (const f of g) console.log(`   ${f.conhecida?' ':'⚠'} ${f.icone} ${f.nome.padEnd(32)} ${f.lista.length}`);
    if (!habs.length) semNada.push(c.nome);
    for (const f of g) if (!f.conhecida) semAcao.push(`${c.nome}: ${f.lista.length} em "${f.nome}"`);
    for (const h of habs)
        for (const v of [h.custo,h.teste,h.alcance,h.duracao])
            if (v && /^[A-Za-z0-9]{20}$/.test(v)) idsCrus.push(`${c.nome}/${h.nome}: id cru "${v}"`);
}

console.log('\n─────────────────────────────');
console.log('classes sem habilidade pré-cadastrada:', semNada.join(', ') || '—');
console.log('faixas fora do catálogo de ação:', semAcao.join(' | ') || 'nenhuma');
console.log('ids crus vazando para a tela:', idsCrus.join(' | ') || 'nenhum');
console.log('Defesas no rodapé:', defesas.length);

assert.equal(idsCrus.length, 0, 'nenhum hash do Firestore pode aparecer na tela');
assert.equal(defesas.length, 8, 'as 8 Defesas têm que estar no rodapé');
assert.ok(classes.length > 0 && Object.keys(modulos).length > 0);

/* ═══ Prévia: a tela inteira, todas as classes lado a lado ═══ */
const previa = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Prévia — Mapa de Conflito</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Inter:wght@400;500;600;700;800&display=swap">
<link rel="stylesheet" href="css/mapa-conflito.css">
<link rel="stylesheet" href="../shared/tokens.css">
<link rel="stylesheet" href="../shared/lendas-reliquias.css">
</head><body>
<header class="mc-topo"><h1>⚔️ Mapa de Conflito — prévia (${classes.length} classes)</h1></header>
<section class="mc-economia"><strong>O turno tem 2 ações.</strong>
<span>Toda habilidade custa <b>1 Ação Padrão</b>, salvo quando o cadastro diz outra coisa.</span></section>
<main class="mc-colunas">${classes.map(c=>colunaClasse(c, modulos, mapas)).join('')}</main>
<section class="mc-defesas"><h2>🛡️ Defesas — iguais para todos</h2>
<p class="mc-defesas-nota">Você declara uma defesa por golpe recebido. O limite por rodada é
<b>Reflexo − 1</b> (mínimo 1); cada defesa além disso custa 1 Energia.</p>
<div class="mc-defesas-grade">${defesas.map(cardDefesa).join('')}</div></section>
</body></html>`;
writeFileSync(new URL('../mapa-conflito/__previa.html', import.meta.url), previa);

console.log('\n✅ render contra o banco real: OK  →  mapa-conflito/__previa.html');
