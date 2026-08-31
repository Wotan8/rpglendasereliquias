/**
 * Rito de doma — um por criatura domável.
 *
 * Até aqui toda fera domável dizia a mesma coisa: "AUT + Domar, Redutor −N".
 * Isso é a rolagem, não a doma. O que a mesa precisa é o que se FAZ antes de
 * rolar, e isso é diferente em cada bicho.
 *
 * Cada rito tem quatro linhas, e as quatro são jogáveis:
 *
 *   CHAMARIZ  o que a traz para perto — e o que a espanta
 *   PREÇO     o que custa entrar: comida, tempo, silêncio, uma estação inteira
 *   A PROVA   QUANDO se rola AUT + Domar. A condição é metade do teste
 *   O ERRO    o que a falha cobra. Nem toda falha é igual: uma foge, outra come
 *
 * Grava em `criatura.comportamento`, que é o único dos quatro campos do bloco
 * que sobrevive a um save do Painel (ele regrava `criatura` com habitat,
 * comportamento, dieta e nivelAmeaca, e descarta qualquer campo novo).
 *
 * O texto que já estava no comportamento é preservado acima do rito.
 *
 *   node functions/bestiario-ritos-doma.mjs            (dry-run)
 *   node functions/bestiario-ritos-doma.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');
const AUTOR = 'igorestevamalvesdesouza@gmail.com';

const R = (chamariz, preco, prova, erro) => ({ chamariz, preco, prova, erro });
const RITOS = {
    /* ── os quatro companheiros de cânone ── */
    'Corvo': R('Brilho. Qualquer coisa que reflita, deixada no mesmo galho.',
        'Dar sem pedir, muitas vezes, sem olhar enquanto ele pega.',
        'No dia em que ele traz alguma coisa de volta. Aí não se rola por permissão, rola-se por vínculo.',
        'Ele conta aos outros. Corvo guarda rosto por anos, e o bando inteiro passa a te evitar.'),
    'Serpente': R('Calor. Pedra ao sol, braseiro apagado, o próprio corpo parado.',
        'Imobilidade — mais tempo quieto do que qualquer pessoa acha razoável.',
        'Quando ela subir no braço por vontade própria. Só então.',
        'A mordida, e o Toxis que vem com ela. E ela volta para a fresta.'),
    'Lobo': R('Não é comida: é a matilha. Trata-se o ferido, e o resto observa.',
        'O resto da matilha tem de tolerar você primeiro. O lobo não decide sozinho.',
        'Quando o cuidado for aceito sem rosnado — e nunca com a matilha reunida.',
        'A matilha te acompanha até a borda do território. Não ataca. Só acompanha.'),
    'Urso': R('Mel e peixe, largados longe da toca e deixados lá.',
        'Distância da toca, sempre. Quem chega perto vira concorrente, não candidato.',
        'Fora do inverno, com o bicho comendo e você parado à vista.',
        'Ele te trata como concorrente. Urso não briga por medo, briga por comida.'),

    /* ── manada das nuvens baixas ── */
    'Nimbrote': R('Sal na mão aberta. Bezerro vem sozinho, sem convite.',
        'Nenhum. Ele já quer.',
        'Não há prova com o bezerro — há com a mãe. Se a Nímbara deixar, está feito.',
        'Não é você que falha: é ela que decide. Se ela vier, corre.'),
    'Nímbara': R('O bezerro. É a única coisa que a faz olhar para uma pessoa.',
        'Não tocar no bezerro. Nunca, nem uma vez, nem para ajudar.',
        'Durante a tempestade, quando ela precisa de quem leve a cria ao abrigo e não tem escolha.',
        'Carga. Ela não recua e não avisa — quem tem cria por perto ataca primeiro.'),
    'Nímbaro': R('Não há chamariz. Ele vem porque você está no campo dele.',
        'Deixar-se carregar e não correr. Correr é a resposta errada e é a única que o corpo quer dar.',
        'No instante em que ele PARA antes de bater — e ele para, se você não correu.',
        'Ele bate. É carga de meia tonelada e a diferença entre parar e não parar é você.'),
    'Nímbaro Alfa': R('A manada. Ele não é abordado; é aceito depois dela.',
        'Andar com a manada uma estação inteira, dormindo onde ela dorme.',
        'Quando a manada aceitar antes dele. O alfa ratifica, não decide.',
        'A manada inteira. Dez toneladas em movimento, e a Planície é plana.'),

    /* ── penacho-bravo ── */
    'Penacho-Bravo Juvenil': R('Grão espalhado no chão, e você agachado de costas.',
        'Três dias voltando à mesma hora, no mesmo lugar, sem olhar.',
        'No quarto dia, quando ele comer antes de você se afastar.',
        'Ele foge e o bando muda de trecho. Você perde a semana, não o braço.'),
    'Penacho-Bravo': R('Nenhum para o adulto. Para o filhote: o ovo.',
        'Enfrentar o Alfa, ou tirar alguém do bando para longe do ninho.',
        'Filhote criado à mão dispensa a prova. Adulto exige, e no meio do bando.',
        'O bando inteiro vem, e o ninho é atrás de você.'),
    'Penacho-Bravo Alfa': R('Desafio, não comida. Ele responde a quem se planta.',
        'Vencer sem matar: derrubá-lo e soltá-lo, à vista do bando.',
        'Depois de o derrubar, com ele ainda no chão e você sem arma na mão.',
        'Ele não esquece o rosto. E ele é chefe de um bando de seis.'),

    /* ── planície e céu ── */
    'Passa-Cerca': R('Não come. Segue quem anda de noite, e é isso que ela quer.',
        'Deixar-se seguir três noites seguidas sem virar as costas nem correr.',
        'Na quarta noite, ao amanhecer, com a matilha longe e a luz chegando.',
        'A matilha inteira te acompanha até você sair do campo. Nenhuma ataca. É pior.'),
    'Fúlgora': R('Carne alta, no punho, em campo aberto onde ela veja de cima.',
        'O ninho intacto. Quem mexe no ninho não doma uma Fúlgora nunca mais, nenhuma.',
        'Ela desce e decide. Rola-se no instante em que ela pousa, e ela pousa uma vez só.',
        'Mergulho. A pena da ponta da asa é serrilhada e você não ouve vir.'),
    'Rei-Coveiro': R('Carcaça. Qualquer uma, e quanto mais velha melhor.',
        'Dividir de verdade: comer junto, do mesmo corpo, sem enxotar.',
        'Quando ele deixar você tocar o que ele está comendo.',
        'Nenhum imediato — ele só voa. Mas o bando anota, e são de três a dez.'),

    /* ── subsolo ── */
    'Vidrela': R('Vibração ritmada. A mesma batida, repetida, sempre igual.',
        'Silêncio absoluto entre as batidas. Ela lê o intervalo, não o som.',
        'Dentro da teia, sem se debater. Quem se debate está falando outra coisa.',
        'O veneno cristalizante, e ninguém te acha na galeria a tempo.'),
    'Górbal': R('Batida no chão, no ritmo do tremor dele — a conversa é sísmica.',
        'Descer no túnel. Ele não sobe para negociar.',
        'No escuro, no túnel dele, com você entre a rocha e a mandíbula.',
        'Engolido. Não é figura de linguagem: é um ataque da ficha.'),
    'Apaga-Lume': R('Apagar a própria luz. Enquanto houver chama, ela só quer a chama.',
        'Ficar no escuro com ela por uma cena inteira, sem acender nada.',
        'No escuro absoluto, e é o único teste do Vale que se rola sem enxergar o alvo.',
        'Ela drena e se cura com o que tira. Você fica pior e ela fica melhor.'),

    /* ── ratos e predadores de topo ── */
    'Ratazana': R('Carniça fresca. Não precisa ser bonita; precisa ser sua.',
        'Deixar que ela coma antes de você tentar tocar. Três refeições, no mínimo.',
        'Depois da terceira refeição, com ela ainda comendo.',
        'Mordida infectada — VIG ou 1 de Vitalidade por hora. E ela lembra do cheiro.'),
    'Nevara': R('Nenhum. Não se chama uma Nevara; ela é que escolhe olhar.',
        'Deixar-se caçar e não morrer: sobreviver a três encontros, sem fugir do Vale.',
        'No terceiro encontro, se ela não atacar de imediato. Essa hesitação é a permissão.',
        'Não há segunda chance na mesma temporada. Ela some, e volta quando quiser.'),
    'Velocirops': R('Carne. Todo dia, no mesmo lugar, e você nunca à vista.',
        'Um ano. Não é exagero de texto: é a conta das trinta e seis sessões.',
        'No dia em que você aparece. Um teste, uma vez, depois de um ano de carne.',
        'Ele come. Foi você que ensinou o lugar e o horário.'),
};

const bloco = (r) => 'RITO DE DOMA\n'
    + `Chamariz: ${r.chamariz}\n`
    + `Preço: ${r.preco}\n`
    + `A prova: ${r.prova}\n`
    + `O erro: ${r.erro}`;

const npcs = (await db.collection('npcs').get()).docs;
const erros = [];
const plano = [];
for (const [nome, r] of Object.entries(RITOS)) {
    const d = npcs.filter(x => (x.data().nome || '') === nome);
    if (d.length !== 1) { erros.push(`"${nome}": ${d.length} docs`); continue; }
    const n = d[0].data();
    if (n.tipo !== 'criatura') { erros.push(`"${nome}" não é tipo criatura`); continue; }
    const antes = String(n.criatura?.comportamento || '').trim();
    if (/RITO DE DOMA/.test(antes)) { erros.push(`"${nome}" já tem rito`); continue; }
    plano.push({ ref: d[0].ref, nome, antes, depois: [antes, bloco(r)].filter(Boolean).join('\n\n'), r });
}
const semRito = npcs.filter(x => x.data().tipo === 'criatura'
    && /Domável/.test(x.data().criatura?.nivelAmeaca || '')
    && !RITOS[x.data().nome || '']).map(x => x.data().nome);

console.log(`\n=== Rito de doma · ${plano.length} criaturas ===\n`);
for (const p of plano) {
    console.log(`── ${p.nome}`);
    console.log(`   Chamariz: ${p.r.chamariz}`);
    console.log(`   Preço:    ${p.r.preco}`);
    console.log(`   A prova:  ${p.r.prova}`);
    console.log(`   O erro:   ${p.r.erro}`);
    console.log(`   ${p.antes ? `(preserva ${p.antes.length} caracteres de comportamento)` : '(comportamento estava vazio)'}\n`);
}
if (semRito.length) console.log(`⚠ Domáveis sem rito: ${semRito.join(', ')}`);

if (erros.length) { console.error('\n🔴 ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

const iso = new Date().toISOString();
const batch = db.batch();
for (const p of plano) batch.update(p.ref, {
    'criatura.comportamento': p.depois, lastUpdate: iso, lastUpdateBy: AUTOR });
await batch.commit();
console.log(`\n✅ ${plano.length} ritos de doma gravados.`);
process.exit(0);
