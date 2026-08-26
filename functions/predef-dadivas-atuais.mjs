/**
 * Predefs de Receptor — o texto que o jogador lê passa a ser a regra que roda.
 *
 * Os dois Receptores (Transcendência do Xamã, Fusão Selvagem do Druida) usam UM
 * motor só: shared/incorporacao.js + shared/dadiva.js. A reforma de 18/08,
 * uniformizada em 24/08, mudou tudo e nenhum dos dois textos foi refeito:
 *
 *   mod_totem "Transcendência — Receptor"
 *     · lista 5 Dádivas com VALORES FIXOS (+4 dano, +7 Blindagem, +9m, +5 Alvo).
 *       O motor não usa nenhum deles — calcula da ficha do Eco.
 *     · diz "o Mestre define ao gerar o Eco". Hoje sorteia na hora.
 *     · diz "uma PERÍCIA sua no valor 3 ou 5". Hoje é uma de cada TIPO.
 *     · não menciona a Sanidade escalonada, que o Tabuleiro cobra de verdade.
 *
 *   ally_animal "Fusão Selvagem — Receptor"
 *     · "ganha o que o animal tem de melhor, e só o que for melhor que o dele"
 *       é a regra da SOBRA, morta. Hoje sorteia e SOMA até o teto.
 *
 * NÃO TOCA em custo, ação, teste, nem no carimbo `regua` — o carimbo já está
 * certo (pecas.efeitoComTeto descreve a regra atual). Só o texto de efeito.
 * Os blocos PERSONALIDADE e SUPRESSÃO ficam como estão: continuam válidos.
 *
 *   node functions/predef-dadivas-atuais.mjs            (dry-run)
 *   node functions/predef-dadivas-atuais.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');
const col = db.collection('system').doc('data').collection('classModules');

const CABECA_NOVA = `O Eco divide a carne com o Xamã por 1 CENA. Ele empresta a DÁDIVA da vida que teve.

DÁDIVAS — são NOVE, e nenhuma se escolhe: sorteia-se o que sai, e o valor sorteado é
SOMADO ao do Xamã, maior ou menor. Quem segura é o TETO: 5, mais o que a Aura permitir,
e o limite racial vence tudo. O que passa do teto se perde.
· BRAÇO — sorteia um atributo físico (FOR, DES, VIG)
· MENTE — sorteia um atributo mental (INT, RAC, PRS)
· BOCA — sorteia um atributo social (PRE, MAN, AUT)
· PELE — sorteia entre Vitalidade Máxima, Blindagem e Blindagem Arcana
· OLHO — sorteia um Sentido
· PASSO — sorteia um Deslocamento
· PERÍCIA — uma de cada TIPO de perícia que o Eco tenha
· HABILIDADE — libera os módulos de classe do Eco
· ENERGIA — devolve fôlego, NUNCA mais do que esta habilidade custou
Tudo sai da FICHA do Eco: Eco sem ficha não entrega nada. Os Ecos prontos estão
cadastrados com a tag "Eco".
Eco ANCESTRAL dobra a Dádiva — mas o dobro também para no teto — e o custo passa a
2 Energia + 2 Sanidade.
SANIDADE ESCALONADA: entrega acima de 2 unidades cobra +1 de Sanidade a cada 2 unidades
excedentes. Quem tira mais, paga mais.`;

const FUSAO_NOVA = 'O Druida abre espaço na própria carne e o Aliado Animal entra. O corpo do bicho fica inerte. '
    + 'O que o animal entrega é a DÁDIVA — a mesma da Transcendência do Xamã, com a mesma regra: sorteia-se o que sai, '
    + 'e o sorteado é SOMADO ao do Druida até o teto (5, mais o que a Aura permitir; o limite racial vence). '
    + 'Tudo sai da ficha do bicho. Entrega acima de 2 unidades cobra +1 de Sanidade a cada 2 excedentes. '
    + 'Acaba quando a fusão acaba.';

const MARCA_FIM = '\n\nA PERSONALIDADE do Eco';
const VELHO_FUSAO = 'O Druida abre espaço na própria carne e o Aliado Animal entra. O corpo do bicho fica inerte; o Druida ganha o que o animal tem de melhor, e só o que for melhor que o dele. Acaba quando a fusão acaba.';

console.log(APPLY ? 'APLICANDO\n' : 'DRY-RUN\n');
const gravar = [];

// ── mod_totem · troca só a cabeça, mantém PERSONALIDADE + SUPRESSÃO ────────
{
    const m = (await col.doc('mod_totem').get()).data();
    const itens = m.itensPredefinidos.map(p => ({ ...p }));
    const p = itens.find(x => x.nome === 'Transcendência — Receptor');
    if (!p) { console.error('ABORTA: predef Transcendência — Receptor sumiu'); process.exit(1); }
    const velho = p.valores?.['6'];
    if (!velho || !velho.includes('+7 de Blindagem')) { console.error('ABORTA: o Efeito nao esta no estado antigo esperado'); process.exit(1); }
    const i = velho.indexOf(MARCA_FIM);
    if (i < 0) { console.error('ABORTA: nao achei o bloco PERSONALIDADE — nao dá pra preservar o resto'); process.exit(1); }
    const novo = CABECA_NOVA + velho.slice(i);
    if (/\+7 de Blindagem|\+9m de Deslocamento|Mestre define ao gerar/.test(novo)) { console.error('ABORTA: sobrou texto antigo'); process.exit(1); }
    p.valores = { ...p.valores, '6': novo };
    if (p.descricao === velho) p.descricao = novo;
    console.log(`mod_totem :: Transcendência — Receptor`);
    console.log(`  efeito ${velho.length} → ${novo.length} chars · preservado: PERSONALIDADE + SUPRESSÃO (${velho.length - i} chars)`);
    console.log(`  custo/ação/teste/regua: intactos`);
    gravar.push([col.doc('mod_totem'), itens]);
}

// ── ally_animal ───────────────────────────────────────────────────────────
{
    const m = (await col.doc('ally_animal').get()).data();
    const itens = m.itensPredefinidos.map(p => ({ ...p }));
    const p = itens.find(x => x.nome === 'Fusão Selvagem — Receptor');
    if (!p || p.descricao !== VELHO_FUSAO) { console.error('ABORTA: Fusão Selvagem — Receptor nao esta no estado esperado'); process.exit(1); }
    p.descricao = FUSAO_NOVA;
    console.log(`\nally_animal :: Fusão Selvagem — Receptor`);
    console.log(`  descricao ${VELHO_FUSAO.length} → ${FUSAO_NOVA.length} chars`);
    gravar.push([col.doc('ally_animal'), itens]);
}

if (!APPLY) { console.log('\nrode com --apply'); process.exit(0); }
for (const [ref, itens] of gravar) { await ref.update({ itensPredefinidos: itens }); console.log(`OK ${ref.id}`); }
process.exit(0);
