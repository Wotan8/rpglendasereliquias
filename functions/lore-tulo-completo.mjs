/**
 * Tulo: corrige a economia, escreve cultura e militar, cadastra as 3 unidades.
 *
 * Texto desenvolvido com o usuário e APROVADO em 30/07/2026.
 *
 * CORREÇÃO IMPORTANTE: a economia gravada antes partia da premissa de que "1 em
 * 10 chega à vida adulta" era mortalidade infantil. O usuário esclareceu que é
 * LENDA — o que mata é a prova de patente, e quem desiste vira base produtiva da
 * tribo. Três frases foram substituídas por causa disso.
 *
 * Canon usado: 9 patentes em 3 unidades (Prompt.md), equipamento por unidade,
 * patente como nome (Zuberi — Zalakare Drie, de Sessão 1.md), "um campeão vale
 * dez soldados comuns" e "1 em 10" (PDF de cenário), glorificação do sofrimento.
 *
 *   node functions/lore-tulo-completo.mjs            (dry-run)
 *   node functions/lore-tulo-completo.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');

const ECONOMIA = [
    'Os Tulo vendem a única coisa que produzem: a si mesmos — e cobram por um o preço de dez.',
    'Um campeão Tulo vale dez soldados comuns, e isso é uma tabela de preços. Quem contrata um Zalakare paga o que pagaria por uma dezena de lanceiros, e paga sem discutir, porque recebe outra coisa. Tribos, vilas e mercadores os procuram para escoltar o que precisa chegar, guardar o que precisa resistir e, acima de tudo, decidir disputas em combate único.',
    'É aí que está o negócio verdadeiro. Duas partes que preferem poupar uma guerra inteira contratam cada uma o seu campeão e aceitam o resultado do encontro. Os Tulo são chamados para isso mais do que para qualquer outra coisa em Vasteluna, e o preço que cobram é o preço da lenda de que um deles vale dez.',
    'Por trás de cada campeão há uma tribo que o sustenta. Quem desistiu da prova e ficou é quem planta, curte o couro, ferra o cavalo e forja a lança que outro vai empunhar. Cada arma Tulo é feita para a patente de quem a recebe e fica na tribo. Grão e metal bruto chegam de fora, pagos com serviço — o resto sai das mãos de quem parou de subir.',
    'A economia inteira se apoia na reputação. Cada derrota pública corrige o preço de todos eles antes do fim da estação. Eles carregam o que provaram na última vez em que alguém olhou.',
].join('\n\n');

const CULTURA = [
    'Dizem que de cada dez Tulo, apenas um chega à vida adulta. É lenda, e os Tulo não fazem questão de corrigi-la — ela paga bem.',
    'A verdade é mais estreita e mais dura: o que mata não é a infância, é a prova. Quem se inscreve para uma patente enfrenta o que foi desenhado para separar quem passa de quem não passa, e a maioria dos que se inscrevem não volta.',
    'Alguns olham para o que vem pela frente e param. Quem para não carrega mérito nenhum — mérito é o que a prova concede, e ele não a completou. Também não carrega castigo: ninguém o humilha e ninguém o afasta. Ele fica fora da escada, e a tribo segue precisando dele.',
    'O sofrimento tem valor entre eles. Uma cicatriz é um registro, e um Tulo sabe contar de onde veio cada uma. O que se admira não é a vitória fácil, é o que custou caro — e por isso o velho de patente alta é ouvido em silêncio quando fala do que atravessou.',
    'Um Tulo que passa é um guerreiro de dar medo. É o que a tribo espera, é o que ela cobra, e é o que ela paga para ver.',
].join('\n\n');

const MILITAR = [
    'Não há tropa comum entre os Tulo. As três unidades são de elite, e as nove patentes formam uma escada única que atravessa a tribo inteira — a patente de um Tulo é o nome pelo qual ele é chamado.',
    'Zalakare carrega as três primeiras: Een, Twee e Drie. Muha carrega as três intermediárias: Vier, Vyf e Ses. Tulakare carrega as três últimas: Sewe, Agt e Nege.',
    'Subir de patente exige prova, e a prova é rigorosa o bastante para matar. A maioria dos que se inscrevem morre nela. Alguns desistem, e os que desistem encontram outro lugar na tribo.',
].join('\n\n');

const UNIDADES = [
    {
        nome: 'ZALAKARE',
        funcao: 'As três primeiras patentes: Een, Twee e Drie.',
        descricao: 'Combatem de peito à mostra e tanga, empunhando a Lança Zalakare. É por onde todo Tulo começa a subir, e já é unidade de elite — entre eles não existe tropa comum. Um Zalakare Een acaba de atravessar a primeira prova; um Zalakare Drie atravessou três, e a distância entre os dois se mede em cicatrizes.',
    },
    {
        nome: 'MUHA',
        funcao: 'As três patentes intermediárias: Vier, Vyf e Ses.',
        descricao: 'Trocam a exposição do corpo pelo escudo redondo e carregam a Lança Muha. São os que já provaram o bastante para receber proteção, e o bastante para saber quando dispensá-la. Um Muha Ses está a três provas do topo da escada Tulo, e sabe exatamente quais faltam.',
    },
    {
        nome: 'TULAKARE',
        funcao: 'As três patentes mais altas: Sewe, Agt e Nege.',
        descricao: 'Escudo redondo e espada longa de uma mão. Um Tulakare atravessou oito provas antes de chegar onde está, e cada uma delas foi vista e contada por quem estava lá. É a estes que se refere a lenda de que um Tulo vale dez soldados comuns — e é a palavra de um Tulakare Nege que decide quando a tribo não tem tempo de discutir.',
    },
];

const snap = await db.collection('system/data/tribes').where('nome', '==', 'Tulo').limit(1).get();
if (snap.empty) { console.log('✖ Tulo não encontrada'); process.exit(1); }
const doc = snap.docs[0], t = doc.data();
const vazio = v => !v || String(v).trim() === '.' || String(v).trim() === '';

console.log(`Tulo ${doc.id}\n`);
console.log(`economia: SOBRESCREVE ${String(t.economia || '').length} chars -> ${ECONOMIA.length} chars`);
console.log(`   (corrige as 3 frases que partiam da premissa errada sobre o "1 em 10")`);
for (const [c, txt] of [['cultura', CULTURA], ['militar', MILITAR]])
    console.log(`${c}: ${vazio(t[c]) ? '(vazio)' : '(tinha texto!)'} -> ${txt.length} chars, ${txt.split('\n\n').length} parágrafos`);
console.log(`\nunidadesMilitares: ${JSON.stringify((t.unidadesMilitares || []).map(u => u.nome))} -> ${JSON.stringify(UNIDADES.map(u => u.nome))}`);

const depois = { ...t, economia: ECONOMIA, cultura: CULTURA, militar: MILITAR };
const faltando = ['descricao', 'cultura', 'governo', 'economia', 'militar'].filter(f => vazio(depois[f]));
console.log(`campos vazios depois: ${faltando.join(', ') || 'nenhum'}`);
console.log(`publicado: ${t.publicado}  (inalterado — falta a mecânica)`);

if (!APPLY) { console.log('\nDRY-RUN — nada gravado.\n'); process.exit(); }
await doc.ref.update({
    economia: ECONOMIA, cultura: CULTURA, militar: MILITAR,
    unidadesMilitares: UNIDADES, ordem: 5,
    pericias: admin.firestore.FieldValue.delete(),
    atualizadoEm: new Date(),
});
console.log('\n✔ GRAVADO.\n');
process.exit();
