/* Roda os MESMOS módulos da tela contra o banco real, sem navegador.
   Além dos asserts, escreve mapa-conflito/__previa.html — a tela como ela
   fica com os dados de hoje, útil para conferir layout sem precisar logar.

     node functions/__check-mapa-conflito.mjs                                 */
import assert from 'node:assert/strict';
import { writeFileSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { agruparPorAcao, habilidadesDaClasse, colunaClasse, cardDefesa,
         perfilDaClasse, mapaSVG, radarSVG, vocacaoDominante,
         auditoriaDaClasse, auditoriaSVG, tabelaAuditoria, FAIXA_REGUA, FAIXA_RESISTE }
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
    vds:      Object.fromEntries(vds.map(v=>[v.id,v.nome])),   // Teste: aponta pra ca
    pericias: Object.fromEntries(peric.map(p=>[p.id,p.nome])),
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

/* ═══ Os dois eixos do mapa ═══ */
const perfis = classes.map(c => perfilDaClasse(c, modulos, mapas));
console.log('\n=== EIXOS DO MAPA ===');
console.log('classe                  n   ritmo   VD%   vocação        cond.');
for (const p of [...perfis].sort((a, b) => b.ritmo - a.ritmo)) {
    if (!p.n) { console.log(`${p.nome.padEnd(22)}  —   (sem repertório)`); continue; }
    console.log(`${p.nome.padEnd(22)} ${String(p.n).padStart(2)}  ${p.ritmo >= 0 ? '+' : ''}${p.ritmo.toFixed(2)}  ${String(Math.round(p.portao * 100)).padStart(3)}%   ${(vocacaoDominante(p) || '—').padEnd(12)} ${p.condicoes}`);
}

/* Os dois chips que estavam mortos: Teste apontava para derivedValues (eu lia
   skills) e condicoesAplicadas é objeto (eu lia como id). Sem número aqui, a
   regressão volta calada — foi exatamente assim que passou despercebida. */
const chips = classes.flatMap(c => habilidadesDaClasse(c, modulos, mapas));
console.log('\nchips que estavam MORTOS:');
console.log('  teste (VD) resolvido:', chips.filter(h => h.teste).length, 'de', chips.length);
console.log('  condição legível:    ', chips.filter(h => h.condicoes.length).length, 'de', chips.length);
assert.ok(chips.filter(h => h.teste).length > 0, 'o chip de teste tem que voltar a aparecer');
assert.ok(chips.filter(h => h.condicoes.length).length > 0, 'o chip de condição também');
assert.equal(chips.filter(h => h.condicoes.some(c => /\[object/.test(c.nome))).length, 0,
    'nenhuma condição pode virar "[object Object]" de novo');

/* ═══ Auditoria: só número exato, vindo de `regua` ═══ */
const auds = classes.map(c => auditoriaDaClasse(c, modulos, mapas)).filter(a => a.n);
const [piso, teto] = FAIXA_REGUA;
console.log(`\n=== AUDITORIA DA RÉGUA ===  (faixa ${piso.toFixed(2)}–${teto.toFixed(2)}×)`);
for (const a of [...auds].sort((x, y) => y.cobertura - x.cobertura)) {
    const rs = a.medidas.map(m => m.razao).sort((x, y) => x - y);
    console.log(`${a.nome.padEnd(22)} ${String(a.medidas.length).padStart(2)}/${String(a.n).padEnd(2)} ${String(Math.round(a.cobertura * 100)).padStart(3)}%  ${(rs.length ? `${rs[0].toFixed(2)}–${rs.at(-1).toFixed(2)}×` : 'nunca auditada').padEnd(15)} fora: ${a.foraDaFaixa.length}`);
}
const medidas = auds.reduce((s, a) => s + a.medidas.length, 0);
const totalHab = auds.reduce((s, a) => s + a.n, 0);
const foraTudo = auds.flatMap(a => a.foraDaFaixa);
console.log(`\nCOBERTURA GERAL: ${medidas}/${totalHab} = ${Math.round(100 * medidas / totalHab)}%`);
console.log(`SEM RÉGUA NENHUMA: ${auds.filter(a => !a.medidas.length).map(a => a.nome).join(', ') || '—'}`);
console.log(`FORA DA FAIXA: ${foraTudo.length} de ${medidas} medidas`);
for (const m of [...foraTudo].sort((x, y) => y.razao - x.razao).slice(0, 6))
    console.log(`   ${m.razao.toFixed(2)}×  ${m.nome}  (${m.unidades} un ÷ custo ${m.custo})`);

/* A cobertura parcial É o achado. Se um dia der 100%, ótimo; se der 0, a
   leitura de `regua` quebrou e a tela mostraria "nada fora da faixa". */
assert.ok(medidas > 0, 'a leitura da régua quebrou — nenhuma habilidade medida');
for (const a of auds) for (const m of a.medidas)
    assert.ok(Number.isFinite(m.razao) && Number.isFinite(m.unidades),
        `régua com número inválido em ${a.nome}/${m.nome}`);

console.log('\n─────────────────────────────');
console.log('classes sem habilidade pré-cadastrada:', semNada.join(', ') || '—');
console.log('faixas fora do catálogo de ação:', semAcao.join(' | ') || 'nenhuma');
console.log('ids crus vazando para a tela:', idsCrus.join(' | ') || 'nenhum');
console.log('Defesas no rodapé:', defesas.length);

assert.equal(idsCrus.length, 0, 'nenhum hash do Firestore pode aparecer na tela');
assert.equal(defesas.length, 8, 'as 8 Defesas têm que estar no rodapé');
assert.ok(classes.length > 0 && Object.keys(modulos).length > 0);

/* ═══ Prévia: a tela inteira, todas as classes lado a lado ═══
   O CSS vai EMBUTIDO: assim o arquivo abre sozinho, de qualquer pasta, sem
   servidor — e sem o service worker servir folha velha, que já enganou uma
   verificação inteira aqui. */
const css = ['../mapa-conflito/css/mapa-conflito.css', '../shared/tokens.css', '../shared/lendas-reliquias.css']
    .map(f => readFileSync(new URL(f, import.meta.url), 'utf8')).join('\n');
const previa = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Prévia — Mapa de Conflito</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Inter:wght@400;500;600;700;800&display=swap">
<style>${css}</style>
</head><body>
<header class="mc-topo"><h1>⚔️ Mapa de Conflito — prévia (${classes.length} classes)</h1></header>
<section class="mc-economia"><strong>O turno tem 2 ações.</strong>
<span>Toda habilidade custa <b>1 Ação Padrão</b>, salvo quando o cadastro diz outra coisa.</span></section>
<section class="mc-mapa">
  <div class="mc-mapa-quadro"><h2>🗺️ Ritmo × Portão</h2><div>${mapaSVG(perfis, [])}</div></div>
  <div class="mc-mapa-quadro"><h2>🎯 Vocação — todas as classes</h2>
    ${radarSVG(perfis)}</div>
</section>
<section class="mc-mapa">
  <div class="mc-mapa-quadro"><h2>🎯 Vocação — duas (silhueta cheia)</h2>
    ${radarSVG(perfis.filter(p=>['Guerreiro','Xamã'].includes(p.nome)))}</div>
  <div class="mc-mapa-quadro"><h2>🎯 Vocação — quatro</h2>
    ${radarSVG(perfis.filter(p=>['Guerreiro','Xamã','Bardo','Sangral'].includes(p.nome)))}</div>
</section>
<section class="mc-audit">
  <div class="mc-mapa-quadro"><h2>🧮 Razão da Régua</h2>
    <p class="mc-mapa-nota">1 unidade = uma rodada de guerreiro (DPR 3,445 em Q0). Faixa aprovada 1,00–1,70×.
    Nada aqui é heurística: todo número vem de <code>regua</code> gravada no cadastro.</p>
    ${auditoriaSVG([...auds].sort((x,y)=>(y.foraDaFaixa[0]?.razao||0)-(x.foraDaFaixa[0]?.razao||0)||y.cobertura-x.cobertura))}</div>
  <div class="mc-mapa-quadro"><h2>📋 Fora da faixa</h2>${tabelaAuditoria(auds)}</div>
</section>
<main class="mc-colunas">${classes.map(c=>colunaClasse(c, modulos, mapas)).join('')}</main>
<section class="mc-defesas"><h2>🛡️ Defesas — iguais para todos</h2>
<p class="mc-defesas-nota">Você declara uma defesa por golpe recebido. O limite por rodada é
<b>Reflexo − 1</b> (mínimo 1); cada defesa além disso custa 1 Energia.</p>
<div class="mc-defesas-grade">${defesas.map(cardDefesa).join('')}</div></section>
</body></html>`;
writeFileSync(new URL('../mapa-conflito/__previa.html', import.meta.url), previa);

console.log('\n✅ render contra o banco real: OK  →  mapa-conflito/__previa.html');
