/**
 * Gera o briefing de atualização do Capítulo 5 do Livro de Regras.
 *
 * Lê TUDO do Firestore (catálogo + o contentHTML do capítulo publicado) e
 * escreve um markdown comparando os dois: o que o capítulo já diz certo, o que
 * está desatualizado e o que falta. Nada aqui é digitado à mão — rodar de novo
 * depois de qualquer mudança no catálogo devolve o relatório atualizado.
 *
 *   node functions/relatorio-protecao.mjs [caminho-de-saida.md]
 */
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();

const SAIDA = process.argv[2] || 'RELATORIO-PROTECAO.md';
const ARTIGO = 'worldbuilding-articles/art-regras-jogador-05';
const TAXA = { 'Leve': 0.20, 'Média': 0.22, 'Pesada': 0.30 };

const grab = async c => (await db.collection(`system/data/${c}`).get()).docs.map(d => ({ id: d.id, ...d.data() }));
const [eq, dvs, bp, skills] = await Promise.all(['equipment', 'derivedValues', 'bodyParts', 'skills'].map(grab));
const artigo = (await db.doc(ARTIGO).get()).data();

const BL = dvs.find(d => d.nome === 'Blindagem').id;
const DESLOC = dvs.find(d => d.nome === 'Desloc. Terrestre').id;
const FURT = skills.find(s => s.nome === 'Furtividade').id;
const NOME = Object.fromEntries(bp.map(p => [p.id, p.nome]));

const blDe = e => (e.valoresDerivadosVinculados || []).find(v => v.id === BL)?.modificador ?? 0;
const slotsDe = e => 1 + (e.slotsAdicionais || []).reduce((a, s) => a + s.quantidade, 0);
const classeDe = e => Object.keys(TAXA).find(c => (e.tags || []).includes(c)) || ((e.tags || []).includes('Escudo') ? 'Escudo' : null);
const num = n => n.toFixed(2).replace('.', ',');
const moeda = n => (n ?? 0).toLocaleString('pt-BR');
const penDe = e => {
    const p = [];
    const des = (e.atributosVinculados || []).find(a => a.id === 'attr_des')?.modificador;
    const furt = (e.periciasVinculadas || []).find(x => x.id === FURT)?.modificador;
    const dl = (e.valoresDerivadosVinculados || []).find(v => v.id === DESLOC)?.modificador;
    if (des) p.push(`DES ${des}`);
    if (furt) p.push(`Furt ${furt}`);
    if (dl) p.push(`Desloc ${dl}`);
    return p.join(' · ') || '—';
};
const coberturaDe = e => {
    const partes = [NOME[e.equipavelEm?.[0]] || '?'];
    for (const s of e.slotsAdicionais || []) for (let i = 0; i < s.quantidade; i++) partes.push(NOME[s.id]);
    const conta = partes.reduce((o, n) => (o[n] = (o[n] || 0) + 1, o), {});
    return Object.entries(conta).map(([n, q]) => q > 1 ? `${n}×${q}` : n).join(', ');
};

const protecoes = eq.filter(e => classeDe(e) && blDe(e) > 0)
    .map(e => ({
        nome: e.nome, classe: classeDe(e), slots: classeDe(e) === 'Escudo' ? 1 : slotsDe(e),
        bl: blDe(e), peso: e.peso, preco: e.preco, pen: penDe(e),
        cobertura: classeDe(e) === 'Escudo' ? 'Mão' : coberturaDe(e),
        nova: (e.tags || []).includes('Avulsa'),
    }))
    .sort((a, b) => b.bl - a.bl || a.nome.localeCompare(b.nome));

/* O que o capítulo publicado tem hoje, extraído do próprio HTML. */
const html = artigo.contentHTML;
const linhasLivro = [...html.matchAll(
    /<tr><td>([^<]+)<\/td><td>(Leve|Média|Pesada|Escudo)<\/td><td>([^<]+)<\/td><td><strong>([^<]+)<\/strong><\/td>/g)]
    .map(m => ({ nome: m[1], classe: m[2], slots: m[3], bl: m[4] }));
const noLivro = Object.fromEntries(linhasLivro.map(l => [l.nome, l]));

const faltando = protecoes.filter(p => !noLivro[p.nome]);
const divergentes = protecoes.filter(p => noLivro[p.nome] && noLivro[p.nome].bl !== num(p.bl));
const conferem = protecoes.filter(p => noLivro[p.nome] && noLivro[p.nome].bl === num(p.bl));

const tabela = lista => [
    '| Peça | Classe | Slots | Blindagem | Cobertura | Peso | Preço | Penalidade |',
    '|---|---|---|---|---|---|---|---|',
    ...lista.map(p => `| ${p.nome}${p.nova ? ' ⭑' : ''} | ${p.classe} | ${p.slots} | **${num(p.bl)}** | ${p.cobertura} | ${p.peso} | ${moeda(p.preco)} | ${p.pen} |`),
].join('\n');

/** Soma um conjunto de peças pelo nome. `curta` omite peso e preço (seção 3). */
const conjunto = (rotulo, nomes, curta = false) => {
    const ps = nomes.map(n => {
        const p = protecoes.find(x => x.nome === n);
        if (!p) throw new Error(`conjunto "${rotulo}": peça "${n}" não está no catálogo`);
        return p;
    });
    const bl = Math.round(ps.reduce((a, p) => a + p.bl, 0) * 100) / 100;
    const slots = ps.reduce((a, p) => a + p.slots, 0);
    const base = `| ${rotulo} | ${slots}${curta ? ' slots' : ''} | ${num(bl)} | **${Math.floor(bl)}** |`;
    return curta ? base
        : `${base} ${ps.reduce((a, p) => a + p.peso, 0)} | ${moeda(ps.reduce((a, p) => a + p.preco, 0))} |`;
};
const PILHA_LEVE = ['Armadura Leve', 'Capuz Acolchoado', 'Gola de Couro', 'Mangas Acolchoadas', 'Cinta Acolchoada'];

const md = `# Capítulo 5 — o que mudou na proteção

Gerado do Firestore em ${new Date().toLocaleDateString('pt-BR')}. Fonte da verdade: coleção
\`system/data/equipment\`. O capítulo publicado é \`${ARTIGO}\` (campo \`contentHTML\`).

⭑ = peça nova, criada nesta revisão.

---

## 1. A mudança de regra

**A taxa da classe Leve subiu de 0,15 para 0,20 de Blindagem por slot coberto.**
Média (0,22) e Pesada (0,30) não mudaram.

| Classe do material | Blindagem por slot coberto |
|---|---|
| Leve | **0,20** (era 0,15) |
| Média | 0,22 |
| Pesada | 0,30 |

Motivo: a 0,15, a maior cobertura Leve possível dava 0,75, e como a Blindagem só
arredonda para baixo no total, a faixa inteira valia 0 na mesa. Pagar por armadura
leve não mudava uma única rolagem.

## 2. O conceito novo: a linha à la carte

Antes, o catálogo só tinha armaduras de tronco — para proteger a cabeça era
preciso comprar uma Armadura de Torneio de 20.000. Agora existem **18 peças
avulsas**, uma por slot do corpo, que permitem montar proteção peça por peça.

Três coisas que o texto precisa deixar claras para o jogador:

1. **Peça avulsa pequena vale 0 sozinha.** Um Elmo de Placas dá 0,30, que
   arredonda para zero. Ela existe para ser somada, não para ser usada só. O
   primeiro elmo que o personagem compra não muda nada na mesa — e isso é
   esperado, não um defeito.
2. **Comprar peça por peça é mais caro que comprar a armadura inteira.** O
   conjunto Pesado completo custa 24.000 contra os 20.000 da Armadura de Torneio,
   pela mesma Blindagem. Você paga pela conveniência de comprar aos poucos.
3. **Par é uma peça só.** Ombreiras, braçadeiras, grevas e escarpes cobrem os dois
   lados de uma vez. Não existe "uma grevа".

## 3. Cada classe tem um teto na mesa

Este é o ponto de design mais importante do capítulo, e hoje ele não está escrito
em lugar nenhum:

| Classe | Maior cobertura alcançável | Blindagem | A mesa usa |
|---|---|---|---|
${conjunto('Leve (Armadura Leve + as 4 avulsas)', PILHA_LEVE, true)}
| Média (conjunto completo) | 13 slots | ${num(TAXA['Média'] * 13)} | **${Math.floor(TAXA['Média'] * 13)}** |
| Pesada (conjunto completo) | 13 slots | ${num(TAXA['Pesada'] * 13)} | **${Math.floor(TAXA['Pesada'] * 13)}** |

**Não existe peça Leve para Pernas e Pé, e isso é deliberado.** É o que segura o
teto da faixa Leve em 1,80. Com grevas e botas leves ela chegaria a 2,60, que
arredonda para o mesmo 2 do conjunto Médio — e como Leve custa menos e pesa menos,
a classe Média deixaria de ter razão de existir.

## 4. Conjuntos completos, lado a lado

| Conjunto | Slots | Blindagem | Na mesa | Peso | Preço |
|---|---|---|---|---|---|
${conjunto('Pesado avulso (8 peças)', ['Elmo de Placas', 'Gorjal de Aço', 'Ombreiras de Placas', 'Braçadeiras de Placas', 'Couraça de Placas', 'Faldar de Placas', 'Grevas de Placas', 'Escarpes de Placas'])}
${conjunto('Armadura de Torneio (1 peça)', ['Armadura de Torneio'])}
${conjunto('Médio avulso (Couro Reforçado + 6)', ['Couro Reforçado', 'Coifa de Malha', 'Gorjal de Malha', 'Braçadeiras de Couro', 'Cinturão Rebitado', 'Calças de Malha', 'Botas Ferradas'])}
${conjunto('Leve máximo (Armadura Leve + 4)', PILHA_LEVE)}
${conjunto('Cota de Malha (1 peça)', ['Cota de Malha'])}

## 5. Catálogo completo de proteção (${protecoes.length} peças)

${tabela(protecoes)}

---

# O que fazer no Capítulo 5

## A. Linhas que estão ERRADAS hoje (${divergentes.length})

${divergentes.length ? tabela(divergentes) + '\n\nO capítulo mostra: ' + divergentes.map(p => `${p.nome} = ${noLivro[p.nome].bl}`).join(' · ') : 'Nenhuma — todos os valores que o capítulo já traz conferem com o banco.'}

## B. Peças que FALTAM no capítulo (${faltando.length})

${faltando.length ? tabela(faltando) : 'Nenhuma.'}

## C. Linhas que já estão certas (${conferem.length})

${conferem.map(p => p.nome).join(' · ')}

## D. Outras mudanças de dado que o texto pode citar

- **Meia-Armadura: 6.500 → 9.000.** A 6.500 ela entregava Cabeça e Pescoço barato
  demais e virava a rota mais barata para a Blindagem máxima, por baixo da própria
  Armadura de Torneio.
- **Armadura Leve: passou a ter preço (1.200) e encolheu de 5 para 4 slots**
  (perdeu a Cintura). A 5 slots ela dava 1,00 e dominava o Couro Cravejado e o
  Couro Reforçado — mais Blindagem, mais barata e sem penalidade.
- **Manto de Linho: passou a ter preço (400).**
- **Cinco peças tiveram a lista de slots onde podem ser vestidas corrigida**
  (Peitoral de Aço, Cota de Malha, Couro Batido, Armadura Leve, Manto de Linho).
  Elas ofereciam opções que nunca funcionavam. A cobertura não mudou — se o
  capítulo diz o que cada peça cobre, continua valendo.

## E. Cuidado com o vocabulário

**"Reforçado" é termo reservado à melhoria de ferreiro** (a resistência física
adicionada na oficina). Não usar como adjetivo solto ao descrever peça nova. Os
itens antigos que já se chamam Couro Reforçado e Roupas Reforçadas ficam como
estão.
`;

writeFileSync(SAIDA, md, 'utf8');
console.log(`\n✔ ${SAIDA}`);
console.log(`  ${protecoes.length} peças no catálogo · ${conferem.length} certas no capítulo · ${divergentes.length} erradas · ${faltando.length} faltando\n`);
process.exit();
