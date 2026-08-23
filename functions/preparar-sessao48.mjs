/**
 * Preparo da Sessão 48 "Três Vozes" na aba Sessão do Painel.
 *
 * Estado herdado da 47: espadachim morto, besteiro fugiu, Raknar caído,
 * Sona atrás dos caixotes, Nura junto aos Armadores, Praematum e Vexia na
 * câmara do Thalion — que está SOZINHO.
 *
 * Mesa hoje: Nura (Amanda), Sona (Helena), Don (Albert). Abel ausente —
 * Praematum está em cena mas NÃO FALA. Yasmin em pausa — Cindy vai embora.
 *
 *   node functions/preparar-sessao48.mjs [--apply]
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');
const MESA = '7MQKtOpcMt8DCH7r97Fb';
const uid = (p) => `${p}_${Math.random().toString(36).slice(2, 10)}`;

const CENAS = [
    {
        titulo: '1. O silêncio depois do tiroteio',
        notas: 'Abre AQUI, não no Thalion — o Abel não está e não pode ganhar mais um solo.\n\nO besteiro sumiu pelo corredor e o salão fica quieto de repente. Raknar respira errado no chão, braço e clavícula quebrados, um braço esbranquiçado de gelo. Oito Armadores encolhidos no fundo, que acabaram de ver essa gente matar um homem.\n\nSONA está agachada atrás dos cinco caixotes. NÃO peça teste: descreva a tampa solta do caixote mais próximo e cale a boca.\nNURA está no meio dos Armadores, de mãos vazias, tendo fingido rendição. São eles que vão descrever o rosto dela para a Ina.\nDON tem o Raknar morrendo na frente dele e a runa que quebrou o braço do aliado ainda quente.\n\nFecha a cena com a voz do Praematum atravessando a parede do fundo.',
    },
    {
        titulo: '2. A porta do fundo',
        notas: 'Como eles chegam à câmara. Não complique: a voz é o convite.\n\nSe carregarem o Raknar, ótimo — é o passaporte da cena 4.\nSe deixarem o Raknar, anote. Um capitão de guarda repara em quem abandona ferido.\nSe algum Armador for arrastado junto ou ameaçado, a Dívida com Ina anda mais uma fatia na colheita.',
    },
    {
        titulo: '3. Thalion — as três perguntas',
        notas: 'ELE JÁ FALOU COM O PRAEMATUM E OS TRÊS NÃO OUVIRAM NADA DISSO. É o motor da sessão inteira.\n\nAbre com ele de pé, espada na mão, apontada para a PORTA DO SALÃO e não para o anão:\n"Ele já falou. Agora vocês."\n\nAs três perguntas, nessa ordem — ele é capitão de guarda, pergunta antes de acusar:\n1. "Quantos eram na mata?" — testa o blefe do Praematum. Eles não sabem. "Dois" segura; "não sabemos" começa a rachar.\n2. "Os homens da Ina lá fora eram seus?" — a queixa concreta: a Feira não acontece amanhã, e a culpa é deles.\n3. "Quem mandou vocês?" — a armadilha. Se alguém disser "Ibirá", é o melhor ou o pior momento da campanha.\n\nO PRAEMATUM NÃO FALA. Se perguntarem a ele, ele olha e não responde. Thalion aceita isso rápido demais — homem calado ele respeita.',
    },
    {
        titulo: '4. Por que ele está vendendo',
        notas: 'O coração da sessão. Ver o conto "Ele Dormia" no livro dele.\n\nA verdade: roubou a adaga do PRÓPRIO Ibirá; chegou diante do deus adormecido com a lâmina na mão e não conseguiu levantar o braço; desistiu ali. Hoje só quer se livrar dela antes de enlouquecer — ela não entra em bainha e cobra Sanidade por dia.\n\nELE NÃO DIZ ISSO PRIMEIRO. Ordem das desculpas: (a) "é mercadoria, e mercadoria se vende"; (b) "não é assunto de vocês"; (c) o roubo, com orgulho; (d) e só sob pressão real, o braço que não subiu.\n\nAlavancas:\n- O RAKNAR CAÍDO. Ele é ex-capitão de guarda, sabe imobilizar clavícula. É como o Don compra boa vontade e — mais importante — é o que TIRA O THALION DAQUELA SALA. Homem que fica parado enquanto gente morre do outro lado da parede vira o Ibirá da própria história.\n- A SONA SENTE A ADAGA. Ela pode apontar a caixa de ferro. Deixe a Helena decidir se fala; é a bomba da noite e está na mão de quem teve uma ação inteira na 47.\n- A NURA é, como ele, alguém que cresceu não sendo recebida. Canal de empatia.',
    },
    {
        titulo: '5. A saída de Velmora',
        notas: 'Se saírem com a adaga: quem pegou começa a ouvir na hora, e o relógio do Sussurro Final sai de 0/6.\nSe saírem COM O THALION: melhor ainda, e muda a cena 6 inteira.\nSe deixarem o Thalion: ele some pela passagem secreta e leva a lâmina.\n\nOs caixotes: cada um saqueado move A Dívida com Ina.\nA despedida da CINDY entra aqui — ela sobrevoou os dois fios e é a única testemunha de tudo, e sai de Velmora sem ter sido vista por nenhum Armador. Vai para a vila natal limpa, enquanto os outros ficam marcados.',
    },
    {
        titulo: '6. A estrada — Morik e Fontrix',
        notas: 'Lampião parado no meio da estrada. Morik sozinho, de pé.\n\nFONTRIX ESTÁ LÁ, mas sentado à parte, longe do lampião, sem arco. Morik não acusa: pede que o Fontrix conte. E ele conta certo, INCLUSIVE que foi poupado. Vira confissão, não emboscada — e a pessoa com mais direito de odiá-los escolhe não odiar.\nEle carrega o peso do Albrix além do próprio.\n\nO acordo: seis frascos do Azul. Ninguém aceita poção de velho estranho na estrada — mas aceita se o THALION aceitar. Se o Thalion não veio, o fiador possível é o Fontrix.\n\n"Fiquem com ele. Mas se forem levar essa lâmina pro Ibirá, façam um favor a um velho: pergunta pra ele o nome da minha esposa. Vê se ele lembra."',
    },
    {
        titulo: '7. Ibirá (só se sobrar noite)',
        notas: 'NÃO FORCE. Se a estrada acabar tarde, corte com o Morik de mão estendida — é ótimo fim de sessão e o deus espera.\n\nSe rolar: bebem o Azul, ele já está lá. Role 1d6 na frente da mesa. O resultado escolhe quem ele AGARRA, não quem morre. Se alguém agir, ele solta e mata quem agiu. Se ninguém agir, mata quem está na mão.\nAUT 2: "Taslo" ou "Sereni" travam por uma rodada, 1x cada. Paloma, Sabrini e Guilion ele não reconhece, e é isso que quebra.',
    },
];

const SEGREDOS_NOVOS = [
    'Thalion roubou O Sussurro Final do PRÓPRIO Ibirá, durante a construção da masmorra em Sereni',
    'Thalion chegou diante de Ibirá adormecido com a adaga na mão e não conseguiu levantar o braço. Desistiu ali. Não conta isso sem pressão real',
    'Ele está vendendo porque não aguenta mais carregar — a lâmina cobra Sanidade por dia e não entra em bainha. Vai dar qualquer outra razão primeiro',
    'Thalion viu Ibirá aparecer sobre Sereni e ESCOLHEU não avisar Morik, sabendo o que ia acontecer com a vila',
    'Nura, Sona e Don NÃO ouviram o blefe do Praematum e não têm como corroborá-lo — e ele não pode mais falar',
    'Thalion conhece Fontrix e Albrix: são homens de Morik. Por isso o blefe soou como "Morik cercou minha rota de fuga"',
    'Se a Feira não acontecer, Thalion perde a única saída que tem — não há segundo comprador',
    'O besteiro fugiu sabendo que os Armadores o viram render-se; ele sabe que a Ina vai saber',
    'Os Armadores viram os rostos da Nura, da Sona e do Don. A Cindy não estava lá — ela sai de Velmora sem ser identificada',
    'Thalion é ex-capitão de guarda: sabe imobilizar clavícula, e repara em quem abandona ferido',
];

/* ===================== EXECUÇÃO ===================== */
const refSes = db.collection('mesas').doc(MESA).collection('sessoes');
const s47 = (await refSes.where('numero', '==', 47).get()).docs[0];
const d47 = s47.data();

// Segredos não revelados herdam; os que a 47 tornou obsoletos ficam de fora.
const OBSOLETOS = [/corredor leste/i, /coroa de Gorren/i];
const herdados = (d47.segredos || [])
    .filter(x => !x.revelado && !OBSOLETOS.some(r => r.test(x.texto)))
    .map(x => ({ ...x, herdado: true }));

// Encontros que ainda valem, copiados da 47.
const encontros = (d47.encontros || []).filter(e => /Onça|Ibirá/i.test(e.nome || ''));

const ja = await refSes.where('numero', '==', 48).get();
if (!ja.empty) { console.log('Sessão 48 já existe:', ja.docs[0].id); process.exit(0); }

const doc48 = {
    numero: 48,
    fase: 'preparo',
    dataReal: new Date().toISOString().split('T')[0],
    dataJogo: '42/02/212 (madrugada) — mesma noite da 46 e da 47',
    inicioForte: 'O besteiro some pelo corredor e o salão fica quieto de uma vez. Raknar respira errado no chão. Oito Armadores encolhidos no fundo, que acabaram de ver vocês matar um homem. E então, atravessando a parede da sala do fundo, uma voz que vocês conhecem: o Praematum, falando com alguém.',
    cenas: CENAS.map(c => ({ id: uid('cena'), titulo: c.titulo, notas: c.notas, canvasId: '', feita: false })),
    segredos: [...SEGREDOS_NOVOS.map(t => ({ id: uid('seg'), texto: t, revelado: false, herdado: false })), ...herdados],
    encontros,
    recompensas: 'O Sussurro Final (caixa de ferro sem fechadura, câmara do Thalion) · Os Contos de Thalion Vassek em papel · 5 caixotes da Feira: planta do subsolo, pó de derrubada, virotes perfurantes, as três loções e o pó de sono, máscaras, velas · 6 frascos do Azul (do Morik, na estrada)',
    inbox: [],
    colheita: [],
    resumo: '',
    createdAt: Date.now(),
    fonte: 'Preparo montado em 23/08/2026. Mesa: Nura (Amanda), Sona (Helena), Don (Albert). Praematum em cena mas MUDO — Abel ausente. Cindy sai da campanha (Yasmin em pausa).',
};

console.log(APPLY ? '=== APLICANDO ===\n' : '=== DRY-RUN ===\n');
console.log(`Sessão ${doc48.numero} · fase=${doc48.fase} · ${doc48.dataReal}`);
console.log(`\nInício forte:\n  ${doc48.inicioForte}\n`);
console.log(`Cenas (${doc48.cenas.length}):`);
doc48.cenas.forEach(c => console.log(`  · ${c.titulo}`));
console.log(`\nSegredos: ${doc48.segredos.length} (${SEGREDOS_NOVOS.length} novos + ${herdados.length} herdados da 47)`);
doc48.segredos.filter(s => !s.herdado).forEach(s => console.log(`  ★ ${s.texto}`));
console.log(`\nEncontros carregados: ${encontros.map(e => e.nome).join(' | ') || 'nenhum'}`);

if (APPLY) { const r = await refSes.add(doc48); console.log(`\nGravado em sessoes/${r.id} — Painel → Mesa → Sessão.`); }
else console.log('\nRode com --apply.');
process.exit(0);
