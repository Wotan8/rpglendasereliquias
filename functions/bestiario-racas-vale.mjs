/**
 * Raças de criatura do Vale de Silmarela — e as 10 partes do corpo que faltavam.
 *
 * PARTE A — `system/data/bodyParts` tinha 13 partes e 11 eram humanas; as duas
 * não-humanoides eram Asa de Libélula (Picxi) e Língua Longa. Sem cauda, focinho,
 * casco, garra, asa, chifre, presa, orelha, pata e bico, TODA raça de criatura
 * nasceria com anatomia de gente — quatro dedos, dois ombros, uma cintura. E é a
 * anatomia que decide o que a criatura veste, o que ela segura e onde ela leva
 * Blindagem.
 *
 * PARTE B — seis raças no catálogo `system/data/races`, que hoje só tem as 8
 * humanoides jogáveis. A raça é o lugar certo porque é ela que fixa a ALTURA
 * inicial e a variação — e é da Altura que sai o Tamanho, e do Tamanho a
 * Vitalidade. O Yotun faz assim (Altura 5,25 ± 0,75) e as criaturas passam a
 * fazer igual.
 *
 *   Fenor          1,30 ± 0,20   gado de Sereni — o Julo já é "Pastor de Fenores"
 *   Cão-Pastor     0,70 ± 0,10   o cão que guarda fenor
 *   Rouba-Rede     0,60 ± 0,10   ladrão de rede da Borda de Silmarela
 *   Fuça-Fundo     0,90 ± 0,15   porco-do-mato da Floresta de Silmarela
 *   Papa-Broto     0,80 ± 0,10   praga de lavoura da Planície de Silmarela
 *   Rasga-Palha    0,50 ± 0,10   gavião da Planície de Velmora
 *
 * Nenhuma ficha de criatura é criada aqui. Isto é catálogo.
 *
 *   node functions/bestiario-racas-vale.mjs            (dry-run)
 *   node functions/bestiario-racas-vale.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');
const AUTOR_UID = 'M2rZzlQkzxTrrddeFQ10S6zsfX62';

/* ── PARTE A · as partes que faltavam ── */
const PARTES = [
    { nome: 'Focinho', icone: '👃', segurar: false, empunhar: false, vestir: false, fixar: true,
      nota: 'aceita focinheira e açaime — é por isso que fixa' },
    { nome: 'Orelha', icone: '👂', segurar: false, empunhar: false, vestir: false, fixar: true,
      nota: 'brinco de marcação de rebanho' },
    { nome: 'Chifre', icone: '🐮', segurar: false, empunhar: false, vestir: false, fixar: true,
      nota: 'ponteira, argola, fita de manada' },
    { nome: 'Presa', icone: '🦷', segurar: false, empunhar: false, vestir: false, fixar: true },
    { nome: 'Bico', icone: '🐦', segurar: true, empunhar: false, vestir: false, fixar: false,
      nota: 'segura, mas não empunha — ave carrega, não maneja' },
    { nome: 'Pata', icone: '🐾', segurar: false, empunhar: false, vestir: true, fixar: true,
      nota: 'aceita bota e enfaixamento' },
    { nome: 'Casco', icone: '🐴', segurar: false, empunhar: false, vestir: true, fixar: true,
      nota: 'ferradura' },
    { nome: 'Garra', icone: '🦅', segurar: true, empunhar: false, vestir: false, fixar: true,
      nota: 'ave de rapina agarra e carrega; aceita pealo e guizo' },
    { nome: 'Asa', icone: '🪶', segurar: false, empunhar: false, vestir: false, fixar: true,
      nota: 'asa emplumada — a de libélula já existia, para a Picxi' },
    { nome: 'Cauda', icone: '🦎', segurar: false, empunhar: false, vestir: false, fixar: true },
];

/* ── PARTE B · as seis raças ── */
const ALTURA_VD = 'XPv2i5GhoHfz2QSH3pCl';
const RACAS = [
    {
        nome: 'Fenor', subtitulo: 'O Gado de Sereni — Paciência de Quatro Patas',
        altura: 1.30, varia: 0.20, vida: '20',
        tendencia: 'Pacientes — Gregários — Teimosos no lugar errado',
        aparencia: 'Bovino de pelo curto e denso, garupa alta e chifres curtos virados para a frente, não '
            + 'para os lados — chifre de empurrar, não de furar. Pelagem em castanho barrento e cinza-fumo. '
            + 'O casco é largo e chato, feito para terreno mole de pasto encharcado.',
        habitat: 'Pastos ao norte de Sereni e as bordas de todo o Vale de Silmarela onde há capim e água. '
            + 'Não se afasta do rebanho por vontade própria.',
        historia: 'Fenor é o gado do Vale, e é anterior a Sereni. Nenhum registro diz quem o domesticou '
            + 'primeiro; a vila diz que foi o contrário, que o fenor escolheu ficar perto de quem cava poço. '
            + 'Dá leite, carne, couro e força de tração, e é a razão de haver pastor em Sereni.',
        curiosidades: [
            'Fenor perdido para de andar e berra até alguém vir. É o motivo de o rebanho raramente se perder inteiro.',
            'O chifre virado para a frente serve para empurrar o outro fenor para fora do bebedouro, e é assim que a manada resolve tudo.',
            'Couro de fenor velho é o couro que o ferreiro prefere para avental.',
            'Bezerro nasce sabendo andar em duas horas e sabendo seguir em duas semanas.',
        ],
        partes: [['Cabeça', 1], ['Focinho', 1], ['Chifre', 2], ['Orelha', 2], ['Pescoço', 1], ['Torso', 1],
                 ['Costas', 1], ['Pernas', 4], ['Casco', 4], ['Cauda', 1]],
        pecs: [['Carne Dura', 1]],
    },
    {
        nome: 'Cão-Pastor', subtitulo: 'O Que Late Cedo',
        altura: 0.70, varia: 0.10, vida: '14',
        tendencia: 'Atentos — Insistentes — Incapazes de ficar quietos',
        aparencia: 'Cão de porte médio, pelo áspero de duas camadas, orelha em pé e focinho comprido. '
            + 'Rabo baixo quando trabalha, alto quando não. Pelagem malhada de cinza e creme — a cor não é '
            + 'escolha de criador, é a que se enxerga de longe no capim.',
        habitat: 'Onde houver fenor. Vive no pasto, dorme na porta, e entra em casa só quando chove forte.',
        historia: 'Criado junto com o fenor e para o fenor. A vila não o considera um bicho de estimação: é '
            + 'ferramenta de pastor, e é tratado como tal — o que em Sereni significa melhor do que a maioria '
            + 'das pessoas trata gente.',
        curiosidades: [
            'Late antes de haver motivo, e é isso que o torna útil. Pastor experiente conta os latidos, não os escuta.',
            'Quando ele PARA de latir é que se corre — cão-pastor cala na presença do que ele sabe que não vence.',
            'Aprende o nome de cada fenor do rebanho e não confunde.',
            'Um filhote vale três dias de trabalho de um homem. Ninguém em Sereni vende cão; troca-se.',
        ],
        partes: [['Cabeça', 1], ['Focinho', 1], ['Orelha', 2], ['Pescoço', 1], ['Torso', 1],
                 ['Costas', 1], ['Pernas', 4], ['Pata', 4], ['Cauda', 1]],
        pecs: [],
    },
    {
        nome: 'Rouba-Rede', subtitulo: 'A Praga do Pescador',
        altura: 0.60, varia: 0.10, vida: '12',
        tendencia: 'Curiosos — Descarados — Sem noção de propriedade alheia',
        aparencia: 'Mustelídeo comprido e baixo, pelagem impermeável castanho-escura que escurece quase '
            + 'para preto quando molhada. Pata palmada, cauda grossa e achatada que serve de leme. Bigodes '
            + 'longos que leem a corrente. Fora d\'água anda desengonçado; dentro, some.',
        habitat: 'Borda de Silmarela e todo curso d\'água do Vale com barranco escavável. Faz toca com a '
            + 'boca abaixo da linha d\'água e o quarto acima.',
        historia: 'Ninguém sabe se o Rouba-Rede seguiu o pescador ou se o pescador se instalou onde ele já '
            + 'estava. O que se sabe é que rede posta à noite amanhece rasgada, e que a marca do rasgo é '
            + 'sempre a mesma. Tiric conserta a dele há anos e nunca matou um.',
        curiosidades: [
            'Rasga a rede pelo meio, come um peixe e deixa os outros. Não é fome: é o mais fácil.',
            'Aguenta quatro minutos submerso e sai por onde não entrou.',
            'Aceita comida da mão em duas semanas de insistência, e depois não vai embora nunca mais.',
            'Pescador que perde a rede xinga; pescador que perde o Rouba-Rede fica quieto o dia inteiro.',
        ],
        partes: [['Cabeça', 1], ['Focinho', 1], ['Orelha', 2], ['Pescoço', 1], ['Torso', 1],
                 ['Costas', 1], ['Pernas', 4], ['Pata', 4], ['Cauda', 1]],
        pecs: [],
    },
    {
        nome: 'Fuça-Fundo', subtitulo: 'O Que Vira a Terra',
        altura: 0.90, varia: 0.15, vida: '18',
        tendencia: 'Desconfiados — Metódicos — Perigosos quando cercados',
        aparencia: 'Porco-do-mato de cerda dura e escura, cernelha alta e ancas estreitas — corpo de cunha, '
            + 'feito para atravessar mato fechado sem parar. Presas inferiores curvas que ele afia sozinho '
            + 'contra as de cima. Focinho com placa de cartilagem que aguenta revolver raiz e pedra.',
        habitat: 'Floresta de Silmarela, no chão úmido sob copa fechada. Segue a linha das raízes e dos '
            + 'fungos, e é por isso que ele sempre reaparece no mesmo trecho.',
        historia: 'A vila caça Fuça-Fundo e a vila o odeia, nas mesmas semanas: ele revira a horta de quem '
            + 'planta perto da mata, e depois alimenta a mesma casa por um mês. Herborista aprende a andar '
            + 'atrás dele — onde ele fuçou, o que presta já saiu do chão.',
        curiosidades: [
            'Acha tubérculo e fungo a meio metro de profundidade pelo cheiro, e ignora o que não presta.',
            'Não carrega, mas empurra: um Fuça-Fundo adulto move o que dois homens não movem.',
            'Cercado, ele vem — nunca foge para os lados. Todo caçador do Vale sabe disso e metade esquece.',
            'A trilha dele denuncia água a menos de duzentos passos.',
        ],
        partes: [['Cabeça', 1], ['Focinho', 1], ['Presa', 2], ['Orelha', 2], ['Pescoço', 1], ['Torso', 1],
                 ['Costas', 1], ['Pernas', 4], ['Casco', 4], ['Cauda', 1]],
        pecs: [['Pele Dura', 1]],
    },
    {
        nome: 'Papa-Broto', subtitulo: 'A Boca da Lavoura',
        altura: 0.80, varia: 0.10, vida: '8',
        tendencia: 'Assustadiços — Rápidos — Incorrigíveis',
        aparencia: 'Lagomorfo grande, quase da altura do joelho de um homem, com pernas traseiras longas e '
            + 'orelhas maiores que a cabeça. Pelagem de cor de palha seca que some no campo em pé. Olho na '
            + 'lateral do crânio: enxerga atrás de si sem virar o pescoço.',
        habitat: 'Planície de Silmarela e toda borda de lavoura do Vale. Onde há cevada e centeio, há '
            + 'Papa-Broto, e o número deles é o número de brotos.',
        historia: 'Não é caça nobre nem inimigo digno: é a conta que todo lavrador do Vale faz e não fala. '
            + 'Darva Torvel calcula a colheita de cevada descontando o que o Papa-Broto vai levar, e acerta '
            + 'mais do que erra.',
        curiosidades: [
            'Come o broto, não a planta. Por isso a lavoura não morre — só rende menos, todo ano, para sempre.',
            'A orelha ouve passo em capim a trinta passos. Não se chega perto de um andando.',
            'Salta o próprio comprimento três vezes e muda de direção no ar.',
            'Cria de uma fêmea em um ano dá para encher um campo. É por isso que ninguém tenta exterminar: tenta acompanhar.',
        ],
        partes: [['Cabeça', 1], ['Focinho', 1], ['Orelha', 2], ['Pescoço', 1], ['Torso', 1],
                 ['Costas', 1], ['Pernas', 4], ['Pata', 4], ['Cauda', 1]],
        pecs: [],
    },
    {
        nome: 'Rasga-Palha', subtitulo: 'O Ladrão de Telhado',
        altura: 0.50, varia: 0.10, vida: '25',
        tendencia: 'Solitários — Pacientes — Leais só a quem alimenta',
        aparencia: 'Ave de rapina de porte médio, dorso ardósia e peito riscado, com envergadura de quase '
            + 'dois metros. Garra desproporcional ao corpo. Voa em círculo alto e desce em linha reta, sem '
            + 'aviso e sem som — a pena da ponta da asa é serrilhada e corta o ar em silêncio.',
        habitat: 'Planície de Velmora e os campos abertos do Vale, com ninho em rocha alta ou em árvore '
            + 'morta. Um por território: não divide céu.',
        historia: 'Chamado assim porque desce no telhado de palha do galinheiro, abre um rombo e leva o '
            + 'pinto pelo buraco. A vila conserta o telhado e xinga a ave. Quem tem paciência descobre a '
            + 'outra metade: a mesma ave aceita o punho, e aí o pinto é dela por direito.',
        curiosidades: [
            'Enxerga um movimento de palmo a duzentos metros de altura.',
            'Volta para quem alimenta, e só. Não é lealdade: é contabilidade, e funciona igual.',
            'A pena serrilhada da asa é o que o torna silencioso, e é a primeira coisa que um falcoeiro examina.',
            'Ninho de Rasga-Palha tem sempre um objeto brilhante que não serve para nada.',
        ],
        partes: [['Cabeça', 1], ['Bico', 1], ['Pescoço', 1], ['Torso', 1], ['Costas', 1],
                 ['Asa', 2], ['Pernas', 2], ['Garra', 2], ['Cauda', 1]],
        pecs: [],
    },
];

/* ── conferências ── */
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const grab = async c => (await db.collection(c).get()).docs.map(d => ({ id: d.id, ...d.data() }));
const [bps, racas, pecs, vds] = await Promise.all([
    grab('system/data/bodyParts'), grab('system/data/races'),
    grab('system/data/peculiarities'), grab('system/data/derivedValues')]);
const erros = [];

const bpPorNome = {}; for (const b of bps) bpPorNome[norm(b.nome)] = b;
for (const p of PARTES) if (bpPorNome[norm(p.nome)]) erros.push(`parte "${p.nome}" já existe`);
for (const r of RACAS) if (racas.some(x => norm(x.nome) === norm(r.nome))) erros.push(`raça "${r.nome}" já existe`);
if (!vds.some(v => v.id === ALTURA_VD)) erros.push('VD Altura não achado');

const pecPorNome = {}; for (const p of pecs) pecPorNome[norm(p.nome)] = p;
for (const r of RACAS) for (const [nome] of r.pecs)
    if (!pecPorNome[norm(nome)]) erros.push(`peculiaridade "${nome}" (${r.nome}) não existe`);

/* toda parte citada tem de existir ou estar sendo criada agora */
const novas = new Set(PARTES.map(p => norm(p.nome)));
for (const r of RACAS) for (const [nome] of r.partes)
    if (!bpPorNome[norm(nome)] && !novas.has(norm(nome))) erros.push(`parte "${nome}" (${r.nome}) não existe nem está sendo criada`);

const ordemBase = Math.max(0, ...racas.map(r => Number(r.ordem) || 0));

/* ── relatório ── */
console.log(`\n=== PARTE A · ${PARTES.length} partes do corpo novas ===\n`);
console.log('nome        ícone  segurar empunhar vestir fixar   para quê');
for (const p of PARTES)
    console.log(`${p.nome.padEnd(11)} ${p.icone}     ${String(p.segurar).padEnd(7)} ${String(p.empunhar).padEnd(8)} ${String(p.vestir).padEnd(6)} ${String(p.fixar).padEnd(6)}  ${p.nota || ''}`);
console.log(`\n   (o catálogo tinha ${bps.length}; fica com ${bps.length + PARTES.length})`);

console.log(`\n\n=== PARTE B · ${RACAS.length} raças de criatura ===\n`);
for (const r of RACAS) {
    const slots = r.partes.reduce((s, [, n]) => s + n, 0);
    console.log(`── ${r.nome} — ${r.subtitulo}`);
    console.log(`   Altura ${r.altura.toFixed(2)} ± ${r.varia.toFixed(2)} m  →  Tamanho ${(r.altura * 3).toFixed(2)}  →  Vitalidade (VIG + ${(r.altura * 3).toFixed(2)}) × 3`);
    console.log(`   ${r.partes.length} partes, ${slots} slots: ${r.partes.map(([n, s]) => `${n}${s > 1 ? '×' + s : ''}`).join(' · ')}`);
    console.log(`   peculiaridades: ${r.pecs.map(([n, nv]) => `${n} Nv${nv}`).join(', ') || '—'}`);
    console.log(`   vida ${r.vida} anos · ${r.habitat.split('.')[0]}.`);
    console.log('');
}
console.log(`   Referência: o humano tem 11 partes e 21 slots. O Yotun fixa Altura 5,25 ± 0,75 do mesmo jeito.`);

if (erros.length) { console.error('\n🔴 ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

/* ── gravação ── */
const agora = admin.firestore.Timestamp.now();
const batch = db.batch();
const idsNovos = {};
for (const p of PARTES) {
    const ref = db.collection('system/data/bodyParts').doc();
    idsNovos[norm(p.nome)] = ref.id;
    batch.set(ref, {
        nome: p.nome, icone: p.icone, ehPadrao: false,
        podeSegurar: p.segurar, podeEmpunhar: p.empunhar, podeVestir: p.vestir, podeFixar: p.fixar,
        descricao: p.nota || '', publicado: true,
        criadoPor: AUTOR_UID, criadoEm: agora, atualizadoEm: agora, versao: 1,
    });
}
const idParte = nome => bpPorNome[norm(nome)]?.id || idsNovos[norm(nome)];
RACAS.forEach((r, i) => {
    batch.set(db.collection('system/data/races').doc(), {
        nome: r.nome, subtitulo: r.subtitulo, expectativaVida: r.vida,
        tendencia: r.tendencia, aparencia: r.aparencia, habitat: r.habitat,
        historia: r.historia, curiosidades: r.curiosidades,
        tags: 'Criatura', publicado: true, imagemUrl: '',
        derivedValueIds: [{ id: ALTURA_VD, valorInicial: r.altura,
            characterCreationMin: -r.varia, characterCreationMax: r.varia }],
        peculiaridadeIds: r.pecs.map(([nome, nv]) => ({ id: pecPorNome[norm(nome)].id, nivelInicial: nv })),
        partesDoCorpo: r.partes.map(([nome, slots]) => ({ id: idParte(nome), slots })),
        ordem: ordemBase + 10 + i, versao: 1,
        criadoPor: AUTOR_UID, criadoEm: agora, atualizadoEm: agora,
    });
});
await batch.commit();
console.log(`\n✅ ${PARTES.length} partes do corpo + ${RACAS.length} raças de criatura.`);
process.exit(0);
