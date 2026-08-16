/**
 * Torneio Famélia — o que a arquibancada joga na areia.
 *
 * Enche a Caixa do Mestre da mesa (`characterId = '__caixa_mestre__<mesaId>'`,
 * que é o que `area-mesas-inventario.js` lê) com o que os espectadores atiram
 * para os jogadores durante a luta contra o Grakkun e a Vespa.
 *
 * Cada item aponta para o modelo do catálogo por `modeloId`, então dano,
 * mecânicas e cura vêm do registro — `_campoDoItem` da ficha faz o fallback
 * instância → modelo. Só o NOME e a DESCRIÇÃO são de arena.
 *
 * Os modelos são resolvidos POR NOME contra `system/data/equipment`: nome
 * errado vira erro na hora, em vez de um `modeloId` órfão que só aparece na
 * mesa, com o item sem dano nenhum na mão do jogador.
 *
 *   node functions/caixa-mestre-torneio-famelia.mjs            (dry-run)
 *   node functions/caixa-mestre-torneio-famelia.mjs --apply
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

const MESA_ID = 'd4Oi7KmowQ2gY4OU0Im8';                 // Torneio Famélia
const CAIXA_ID = '__caixa_mestre__' + MESA_ID;          // _getCaixaMestreId()
const PREFIXO_ID = 'item-arquibancada-';                // marca os que são meus

/* ═══════════════ O que vem da arquibancada ═══════════════
 * `modelo`  → nome exato no catálogo (system/data/equipment)
 * `nome`    → como chega na areia
 * `qtd`     → quantidade
 * `desc`    → quem jogou, quando cai, e o que fazer com aquilo */
const ARREMESSOS = [
    {
        modelo: 'Rede', nome: 'Rede de pescador (com peixe seco preso)', qtd: 1,
        desc: 'JOGADA POR: um pescador da bancada leste, que passou a luta inteira gritando '
            + '"DERRUBA A MOSCA!".\n\n'
            + '⭐ É A RESPOSTA À VESPA. Ela voa a 22m e as composições dela só alcançam 6m — '
            + 'presa no chão, ela vira uma Picxi de 13 de Vitalidade e Blindagem 0.\n\n'
            + 'QUANDO CAI: quando alguém tentar (e falhar) acertar a Vespa em voo pela primeira vez. '
            + 'A arquibancada percebe o problema antes dos jogadores.\n'
            + 'Cheira a peixe por três dias. Ninguém vai deixar isso barato depois.',
    },
    {
        modelo: 'Boleadeira', nome: 'Boleadeira gasta de tropeiro', qtd: 1,
        desc: 'JOGADA POR: um tropeiro que veio a Famélia vender gado e ficou pela luta. '
            + 'Grita a instrução junto com o arremesso: "NAS PERNAS, NÃO NO BICHO!".\n\n'
            + '⭐ Segunda resposta à Vespa, e mais elegante que a rede: alcance, e ela cai.\n\n'
            + 'QUANDO CAI: alternativa à rede — use uma OU outra, não as duas. '
            + 'A boleadeira se o grupo tem alguém de Destreza; a rede se não tem.',
    },
    {
        modelo: 'Funda', nome: 'Funda de menino (o dono quer de volta)', qtd: 1,
        desc: 'JOGADA POR: um moleque de nove anos, contra a vontade absoluta da mãe. '
            + 'Ele grita o nome dele junto, para o caso de virem devolver.\n\n'
            + 'Alcance sem gastar arma de verdade. Pouco dano, mas serve para irritar '
            + 'quem está voando e para estourar o frasco que alguém está segurando.\n\n'
            + 'QUANDO CAI: cedo, na primeira rodada. É o primeiro sinal de que a plateia escolheu lado.\n'
            + '⚠ Se algum jogador devolver a funda ao menino no fim, a arquibancada inteira '
            + 'se levanta. Isso vale mais que a bolsa da luta.',
    },
    {
        modelo: 'Faca', nome: 'Faca de merenda (com queijo na lâmina)', qtd: 1,
        desc: 'JOGADA POR: uma senhora que veio ver a luta e almoçar, nessa ordem de importância.\n\n'
            + 'Não é grande coisa: 1d4. Mas é aço numa mão desarmada, e é o que existe '
            + 'se os jogadores entraram na areia sem nada — como escravos entram.\n\n'
            + 'QUANDO CAI: imediatamente, se algum jogador começar desarmado.',
    },
    {
        modelo: 'Loção de cura 2 (+4)', nome: 'Frasco de cura (de boticário que apostou em vocês)', qtd: 1,
        desc: 'JOGADA POR: um boticário que apostou nos forasteiros contra os forasteiros — '
            + 'e agora está protegendo o investimento dele, não a vida de vocês.\n\n'
            + 'QUANDO CAI: quando o primeiro jogador chegar a menos da metade da Vitalidade. '
            + 'Não antes — o boticário é sovina e a plateia quer ver sangue antes de socorrer.\n\n'
            + '⚠ Frasco de vidro caindo em areia dura: se ninguém pegar até o fim da rodada seguinte, '
            + 'alguém pisa e quebra.',
    },
    {
        modelo: 'Pó de Derrubada', nome: 'Saquinho de pó (caiu junto com a bolsa toda)', qtd: 1,
        desc: 'JOGADA POR: ninguém, na verdade. Um sujeito se debruçou demais no parapeito '
            + 'e a bolsa inteira dele foi junto. Ele está gritando por ela.\n\n'
            + '⭐ Contra o Grakkun: 3,19m e 275kg de Yotun no chão é o único jeito de '
            + 'ganhar um turno inteiro dele.\n\n'
            + 'QUANDO CAI: rodada 2 ou 3, quando ficar claro que trocar golpe com o gigante não fecha a conta.',
    },
    {
        modelo: 'Pó de Cristal de Sono', nome: 'Embrulho de pano sem etiqueta', qtd: 1,
        desc: 'JOGADA POR: alguém que NÃO gritou o que era. Isso deveria dizer alguma coisa.\n\n'
            + 'É Pó de Cristal de Sono, mas os jogadores não sabem: só um teste de '
            + 'INT + Alquimancia (ou Herbalismo) identifica antes do uso. Sem o teste, '
            + 'é um embrulho que pode ser qualquer coisa — inclusive contra eles.\n\n'
            + 'QUANDO CAI: junto com o Pó de Derrubada, para forçar a escolha entre '
            + 'o pó que eles conhecem e o que não conhecem.',
    },
    {
        modelo: 'Broquel', nome: 'Broquel amassado (⚠ ISTO É UM INSULTO UQATÁ)', qtd: 1,
        desc: 'JOGADO POR: um veterano da bancada norte, que sabe exatamente o que está fazendo. '
            + 'Ele não jogou para ajudar os jogadores — jogou para provocar o gigante.\n\n'
            + '⚠⚠ O GRAKKUN É UQATÁ. "O Escudo é o Túmulo dos Fracos" não é só uma proibição '
            + 'de equipar: é ofensa pessoal. Quem erguer este broquel vira o alvo ÚNICO dele — '
            + 'ele ignora o resto da areia, ignora a Vespa gritando, e vai.\n\n'
            + 'Mecanicamente: +1 de Blindagem. Narrativamente: uma alavanca de aggro na mão dos jogadores. '
            + 'Um grupo esperto usa isto para tirar o gigante de cima do companheiro ferido — '
            + 'ou para separá-lo dos 6m de alcance das composições da Vespa.\n\n'
            + 'QUANDO CAI: no momento em que o Grakkun estiver claramente ganhando.',
    },
    {
        modelo: 'Porção de Hidromel', nome: 'Caneco de hidromel pela metade', qtd: 2,
        desc: 'JOGADO POR: dois sujeitos diferentes, com a mesma ideia e o mesmo nível de embriaguez.\n\n'
            + 'Não serve para quase nada, e é de propósito. Arremessável, molha, distrai, '
            + 'e um gole dá coragem que não é bônus nenhum. Está aqui para que nem tudo que '
            + 'a arquibancada joga seja útil — senão vira loja, não vira plateia.\n\n'
            + 'QUANDO CAI: sempre. A qualquer momento. Especialmente no pior momento.',
    },
];

/* ═══════════════ Execução ═══════════════ */
const mesa = await db.collection('mesas').doc(MESA_ID).get();
assert.ok(mesa.exists, 'mesa Torneio Famélia não encontrada');
assert.equal(mesa.data().nome, 'Torneio Famélia', 'o MESA_ID não é o da mesa do torneio');

const catalogo = [];
(await db.collection('system/data/equipment').get())
    .forEach(d => catalogo.push({ id: d.id, ...d.data() }));

const itens = ARREMESSOS.map((a, i) => {
    const tpl = catalogo.find(e => e.nome === a.modelo);
    assert.ok(tpl, `equipamento "${a.modelo}" não existe em system/data/equipment`);
    return {
        id: `${PREFIXO_ID}${String(i + 1).padStart(2, '0')}`,
        nome: a.nome, tipo: tpl.tipo, modeloId: tpl.id,
        categoriaArma: tpl.categoriaArma || null,
        peso: tpl.peso ?? 1, pressaoBase: tpl.peso ?? 1, tamanho: tpl.tamanho ?? 1,
        quantidade: a.qtd, descricao: a.desc,
        formulaDano: '', imagem: tpl.imagemUrl || '',
        equipavelEm: tpl.equipavelEm || [], formaEquipar: tpl.formaEquipar || '',
        mecanicaIdsProprias: [],
        characterId: CAIXA_ID, ownerType: 'caixa', ownerUid: '',
        ehContainer: !!tpl.ehContainer,
        equipado: false, parentItemId: null, criadoPor: 'mestre',
        lastModified: new Date().toISOString(),
    };
});

const naCaixa = await db.collection('items').where('characterId', '==', CAIXA_ID).get();
const meusAntigos = naCaixa.docs.filter(d => d.id.startsWith(PREFIXO_ID));
const deOutros = naCaixa.docs.length - meusAntigos.length;

console.log(`\n📦 Caixa do Mestre — Torneio Famélia (${CAIXA_ID})`);
console.log(`   Já tinha ${naCaixa.docs.length} item(ns): ${meusAntigos.length} da arquibancada `
    + `(serão substituídos) e ${deOutros} de outra origem (NÃO serão tocados).\n`);
for (const it of itens) {
    const tpl = catalogo.find(e => e.id === it.modeloId);
    console.log(`   • ${it.nome}  ×${it.quantidade}`);
    console.log(`     ${it.tipo}${tpl.formulaDano ? ` · dano ${tpl.formulaDano}` : ''} · `
        + `peso ${it.peso} · modelo "${tpl.nome}"`);
}
console.log(`\n   ${itens.length} arremessos, ${itens.reduce((s, i) => s + i.quantidade, 0)} unidades.`);

if (!APLICAR) {
    console.log('\n🔍 DRY-RUN. Rode com --apply para gravar.\n');
    process.exit(0);
}

for (const d of meusAntigos) await d.ref.delete();
for (const it of itens) await db.collection('items').doc(it.id).set(it);
console.log(`\n✅ ${itens.length} itens na Caixa do Mestre. A plateia está armada.\n`);
process.exit(0);
