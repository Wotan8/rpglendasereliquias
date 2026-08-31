/**
 * As 6 fichas das raças do Vale — o que faltava para o Druida poder domar.
 *
 * A ficha é GERADA DA RAÇA: Altura, partes do corpo e peculiaridades saem do
 * documento em `system/data/races`, não são digitadas aqui. Só atributos, golpe
 * e rito de doma são decisão desta passada.
 *
 * Todas ficam DENTRO DO ORÇAMENTO DE COMPANHEIRO (≤ 0,6×), e é o ponto: das 20
 * criaturas domáveis que existiam, só cinco cabiam nele — e duas eram bicho de
 * esgoto e fantasma. Um Druida iniciante do Vale tinha Lobo, Urso, Corvo e
 * Serpente, os quatro genéricos. Agora tem dez, e seis são daqui.
 *
 *   Fenor          0,19×  Praga    o rebanho — doma-se pelo cão, não pelo bicho
 *   Papa-Broto     0,26×  Praga    velocidade e orelha
 *   Cão-Pastor     0,45×  Comum    faro e audição
 *   Rouba-Rede     0,45×  Comum    nadar e fôlego
 *   Rasga-Palha    0,45×  Comum    visão e voo
 *   Fuça-Fundo     0,56×  Comum    faro e escavar
 *
 * As cinco Dádivas que faltavam à Fusão Selvagem — nadar, escavar, salto,
 * audição e carga — passam a ter bicho que as entregue.
 *
 *   node functions/bestiario-fichas-vale.mjs            (dry-run)
 *   node functions/bestiario-fichas-vale.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');
const AUTOR = 'igorestevamalvesdesouza@gmail.com';
const U = 3.90, ALTURA_VD = 'XPv2i5GhoHfz2QSH3pCl';

const medio = d => { const m = /(\d+)d(\d+)/.exec(String(d)); return m ? Number(m[1]) * (Number(m[2]) + 1) / 2 : 0; };
const GRAUS = [[0.15, 'Inofensiva'], [0.35, 'Praga'], [0.75, 'Comum'], [1.5, 'Séria'], [3.0, 'Grave']];
const grauDe = x => (GRAUS.find(([t]) => x < t) || [null, 'Calamidade'])[1];
const vg = n => n.toFixed(2).replace('.', ',');
const DOMA = { 'Inofensiva': [0, 6, 4, 1], 'Praga': [-1, 5, 5, 1], 'Comum': [-1, 4, 6, 1],
    'Séria': [-3, 3, 8, 2], 'Grave': [-5, 2, 10, 3], 'Calamidade': [-7, 1, 10, 4] };
const clausula = g => {
    const [r, ini, lim, ritmo] = DOMA[g], falta = Math.max(0, lim - ini);
    return `Domável: AUT + Domar, dificuldade ${g} (Redutor ${r === 0 ? '0' : '−' + Math.abs(r)}) · `
        + `Lealdade começa em ${ini}, vínculo exige ${lim}`
        + (falta ? ` — ${falta} ponto${falta > 1 ? 's' : ''} a cada ${ritmo} ${ritmo > 1 ? 'sessões' : 'sessão'}, ${falta * ritmo} sessões ao todo` : ' — já nasce vinculada');
};

const FICHAS = [
    { raca: 'Fenor', porte: 'médio', grauAlvo: 'Praga',
      atrib: { FOR: 2, DES: 2, VIG: 4, INT: 0, RAC: 1, PRS: 1, PRE: 1, MAN: 0, AUT: 1 },
      golpe: ['Cabeçada', 4, '1d4', 2],
      ataques: 'Cabeçada (A. Padrão): Alvo 4, 1d4+2 — chifre de empurrar, não de furar.\n'
        + 'Não ataca por conta própria. Só quando encurralado, e mesmo assim empurra antes de bater.',
      desloc: '6m', local: 'Pastos ao norte de Sereni',
      habitat: 'Pastos ao norte de Sereni e as encostas de capim curto do Vale de Silmarela.',
      dieta: 'Herbívoro — capim curto e sal',
      densidade: 'rebanho de 10 a 40, nunca sozinho',
      nota: 'onde o primeiro põe a pata, os outros põem',
      rito: ['Sal na mão aberta. Fenor conhece sal antes de conhecer gente.',
             'Nenhum. Ele segue quem o rebanho segue — e o rebanho segue o cão.',
             'A prova não é com o fenor: é com o cão-pastor. Quem o cão aceita, o rebanho aceita.',
             'Nenhum. Ele volta para o rebanho e finge que nada aconteceu. É a única doma do Vale que não custa nada errar.'],
      dadiva: 'carga e resistência' },

    { raca: 'Cão-Pastor', porte: 'médio', grauAlvo: 'Comum',
      atrib: { FOR: 3, DES: 4, VIG: 3, INT: 2, RAC: 3, PRS: 2, PRE: 3, MAN: 0, AUT: 2 },
      golpe: ['Mordida', 6, '1d4', 3],
      ataques: 'Mordida (A. Padrão): Alvo 6, 1d4+3.\n'
        + 'Ladra Cedo: no primeiro turno de qualquer encontro, ninguém do grupo pode ser pego de surpresa.\n'
        + 'Toca Rebanho: move animal de rebanho sem teste, um por turno.',
      desloc: '12m', local: 'Pastos ao norte de Sereni',
      habitat: 'Onde houver fenor. Vive no pasto, dorme na porta.',
      dieta: 'Onívoro — sobras, e o que caça sozinho',
      densidade: 'um por rebanho; dois em rebanho grande',
      nota: 'quando ele PARA de latir é que se corre',
      rito: ['Trabalho, não comida. Ele quer ter o que fazer, e quem lhe dá isso ele segue.',
             'Dar-lhe serviço todo dia, sem falhar um. Cão-pastor ocioso adoece de tédio.',
             'Na primeira vez em que ele obedecer a você antes de obedecer ao pastor.',
             'Ele volta para o dono. Cão-pastor não troca de dono — ele adota um segundo, e você não foi.'],
      dadiva: 'faro e audição' },

    { raca: 'Rouba-Rede', porte: 'pequeno', grauAlvo: 'Comum',
      atrib: { FOR: 3, DES: 4, VIG: 3, INT: 2, RAC: 3, PRS: 2, PRE: 2, MAN: 0, AUT: 2 },
      golpe: ['Mordida', 6, '1d4', 3],
      ataques: 'Mordida (A. Padrão): Alvo 6, 1d4+3.\n'
        + 'Fôlego: aguenta 4 minutos submerso.\n'
        + 'Dentro d\'água some: quem o perder de vista não o reencontra, e ele sai por onde não entrou.',
      desloc: '5m em terra, natação 12m', local: 'Borda de Silmarela',
      habitat: 'Borda de Silmarela e todo curso d\'água do Vale com barranco escavável.',
      dieta: 'Piscívoro',
      densidade: 'solitário ou casal',
      nota: 'rasga a rede pelo meio, come um peixe e deixa os outros',
      rito: ['Peixe na mão, dentro d\'água, e você parado até a cintura.',
             'Deixar a rede aberta e não consertar. Quem conserta a rede está dizendo que a briga continua.',
             'Quando ele comer da sua mão sem submergir antes.',
             'Nenhum. Ele leva o peixe e volta amanhã. É a doma mais barata do Vale, e a que exige mais paciência.'],
      dadiva: 'nadar e fôlego' },

    { raca: 'Fuça-Fundo', porte: 'médio', grauAlvo: 'Comum',
      atrib: { FOR: 4, DES: 2, VIG: 4, INT: 1, RAC: 2, PRS: 3, PRE: 2, MAN: 0, AUT: 2 },
      golpe: ['Presas', 5, '1d6', 4],
      ataques: 'Presas (A. Padrão): Alvo 5, 1d6+4 — afiadas pelo próprio dono, uma contra a outra.\n'
        + 'Investida (A. Padrão; exige 6 m em linha reta): Alvo 5, 1d6+4 e Derrubada.\n'
        + 'Escava: 2 m por rodada em terra. Acha raiz e fungo a meio metro pelo cheiro.',
      desloc: '9m, escava 2m', local: 'Floresta de Silmarela',
      habitat: 'Floresta de Silmarela, no chão úmido sob copa fechada.',
      dieta: 'Onívoro — raiz, tubérculo, fungo e o que estiver morto',
      densidade: 'solitário; fêmea com crias na primavera',
      nota: 'cercado, ele vem — nunca foge para os lados',
      rito: ['Raiz cortada e deixada exposta, no mesmo trecho, três dias seguidos.',
             'Não cercar. Nunca fechar os dois lados — é o que transforma abordagem em briga.',
             'De lado, nunca de frente, com ele comendo. De frente é desafio e ele responde.',
             'Cercado, ele vem. Meia tonelada de cunha, e o mato fechado é dele, não seu.'],
      dadiva: 'faro e escavar' },

    { raca: 'Papa-Broto', porte: 'pequeno', grauAlvo: 'Praga',
      atrib: { FOR: 2, DES: 5, VIG: 2, INT: 1, RAC: 3, PRS: 1, PRE: 2, MAN: 0, AUT: 1 },
      golpe: ['Coice', 5, '1d4', 2],
      ataques: 'Coice (A. Padrão): Alvo 5, 1d4+2 — só quando agarrado, e é a única briga que ele aceita.\n'
        + 'Salta o próprio comprimento três vezes e muda de direção no ar.\n'
        + 'Ouve passo em capim a trinta passos. Não se chega perto de um andando.',
      desloc: '15m, salto 5m', local: 'Planície de Silmarela',
      habitat: 'Planície de Silmarela e toda borda de lavoura do Vale.',
      dieta: 'Herbívoro — broto, e só broto',
      densidade: 'solitário, mas nunca há só um',
      nota: 'come o broto, não a planta: a lavoura não morre, só rende menos, para sempre',
      rito: ['O broto. Não há outro chamariz e não adianta tentar outro.',
             'Plantar para ele. Um canteiro que é dele e que você não colhe.',
             'No capim alto, agachado, sem olhar direto. Olhar de frente é olho de predador.',
             'Ele some, e a orelha dele já guardou o seu passo. Naquele campo, acabou.'],
      dadiva: 'deslocamento e salto' },

    { raca: 'Rasga-Palha', porte: 'pequeno', grauAlvo: 'Comum',
      atrib: { FOR: 2, DES: 5, VIG: 2, INT: 2, RAC: 4, PRS: 3, PRE: 2, MAN: 0, AUT: 3 },
      golpe: ['Garras', 6, '1d6', 2],
      ataques: 'Garras (A. Padrão): Alvo 6, 1d6+2 — desproporcionais ao corpo.\n'
        + 'Mergulho (A. Padrão; só em voo, exige 10 m de altura): Alvo 7, 1d6+2 e Derrubada.\n'
        + 'Silencioso: a pena serrilhada da ponta da asa corta o ar sem som. Não se ouve vir.\n'
        + 'Enxerga movimento de palmo a duzentos metros de altura.',
      desloc: 'solo 2m, voo 20m', local: 'Planície de Velmora',
      habitat: 'Planície de Velmora e os campos abertos do Vale, com ninho em rocha alta ou árvore morta.',
      dieta: 'Carnívoro — o que couber na garra',
      densidade: 'um por território; não divide céu',
      nota: 'volta para quem alimenta, e só',
      rito: ['Carne no punho, em campo aberto — e a fome dele, que é o chamariz de verdade.',
             'Deixá-lo com fome primeiro. Ave farta não desce para ninguém.',
             'Quando ele vier ao punho por escolha, e não porque não havia mais nada.',
             'Ele leva a carne e não volta. Volta para quem alimenta, e você deixou de ser essa pessoa.'],
      dadiva: 'visão e voo' },
];

const grab = async c => (await db.collection(c).get()).docs.map(d => ({ id: d.id, ...d.data() }));
const [npcs, racas, pecs] = await Promise.all([grab('npcs'), grab('system/data/races'), grab('system/data/peculiarities')]);
const erros = [];

const avarbus = npcs.find(n => n.nome === 'Avarbus');
const VINCULADOS = avarbus?.valoresDer?.vinculados || [];
if (VINCULADOS.length < 5) erros.push(`vinculados do Avarbus veio com ${VINCULADOS.length}`);

for (const f of FICHAS) {
    if (npcs.some(n => n.nome === f.raca)) { erros.push(`ficha "${f.raca}" já existe em npcs`); continue; }
    const r = racas.find(x => x.nome === f.raca);
    if (!r) { erros.push(`raça "${f.raca}" não achada`); continue; }
    f.racaDoc = r;
    /* tudo isto vem da raça, não daqui */
    f.altura = r.derivedValueIds?.find(d => d.id === ALTURA_VD)?.valorInicial;
    f.partes = r.partesDoCorpo || [];
    f.pecs = (r.peculiaridadeIds || []).map(p => ({ refId: p.id, nivel: p.nivelInicial || 1, fonte: 'raca' }));
    if (!f.altura) { erros.push(`raça "${f.raca}" sem Altura`); continue; }

    const [, alvo, dado, bon] = f.golpe;
    const P = Math.max(0, Math.min((Math.min(alvo, 9) - 1) / 10, 0.9));
    f.bld = f.pecs.reduce((s, p) => s + (pecs.find(x => x.id === p.refId)?.nome === 'Pele Dura' ? p.nivel : 0), 0);
    f.vit = (f.atrib.VIG + f.altura * 3) * 3
        + f.pecs.reduce((s, p) => s + (pecs.find(x => x.id === p.refId)?.nome === 'Carne Dura' ? 3 * p.nivel : 0), 0);
    f.dpr = P * Math.max(1, medio(dado) + bon - 2);
    f.x = f.dpr / U;
    f.grau = grauDe(f.x);
    f.pericia = alvo - Math.max(f.atrib.FOR, f.atrib.DES);

    if (f.grau !== f.grauAlvo) erros.push(`${f.raca}: ${vg(f.x)}× cai em ${f.grau}, não em ${f.grauAlvo}`);
    if (f.x > 0.6) erros.push(`${f.raca}: ${vg(f.x)}× acima do orçamento de companheiro (0,60×)`);
    if (bon > f.atrib.FOR) erros.push(`${f.raca}: bônus +${bon} acima de FOR ${f.atrib.FOR}`);
    if (f.pericia > 5 || f.pericia < 0) erros.push(`${f.raca}: Alvo ${alvo} exigiria perícia ${f.pericia}`);
    const duelo = f.vit / (0.6 * Math.max(1, 8.5 - f.bld));
    if (duelo > 10.5) erros.push(`${f.raca}: ${duelo.toFixed(1)} rodadas em duelo`);
    f.duelo = duelo;
    f.ameaca = [f.grau, `${vg(f.x)}×`, f.densidade, clausula(f.grau), f.nota].join(' · ');
    f.comportamento = `${f.nota[0].toUpperCase()}${f.nota.slice(1)}.\n\nRITO DE DOMA\n`
        + `Chamariz: ${f.rito[0]}\nPreço: ${f.rito[1]}\nA prova: ${f.rito[2]}\nO erro: ${f.rito[3]}`;
}

/* ── relatório ── */
console.log(`\n=== 6 fichas novas · geradas das raças ===\n`);
console.log('nome           Alvo  dano     DPR    força   grau     Altura  Vit    Bld  duelo  Dádiva');
for (const f of FICHAS) {
    if (!f.racaDoc) continue;
    const [, alvo, dado, bon] = f.golpe;
    console.log(`${f.raca.padEnd(14)} ${String(alvo).padStart(3)}  ${(dado + '+' + bon).padEnd(7)} ${f.dpr.toFixed(2).padStart(5)}  ${vg(f.x)}×  ${f.grau.padEnd(7)} ${String(f.altura).padStart(5)} m ${f.vit.toFixed(1).padStart(5)}  ${f.bld}    ${f.duelo.toFixed(1)}   ${f.dadiva}`);
}
console.log('\nO que vem da raça (não digitado na ficha):');
for (const f of FICHAS) if (f.racaDoc)
    console.log(`   ${f.raca.padEnd(14)} Altura ${f.altura} · ${f.partes.length} partes / ${f.partes.reduce((s, p) => s + p.slots, 0)} slots · ${f.pecs.length ? f.pecs.length + ' peculiaridade da raça' : 'sem peculiaridade'}`);
console.log('\nExemplo de rito (Fenor):');
for (const l of (FICHAS[0].comportamento || '').split('\n')) console.log('   ' + l);

if (erros.length) { console.error('\n🔴 ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

const iso = new Date().toISOString();
const batch = db.batch();
for (const f of FICHAS) {
    batch.set(db.collection('npcs').doc(), {
        schemaVersion: 2, modoFicha: 'mecanico', tipo: 'criatura', nome: f.raca, nivel: 1, ai: 1,
        raca: f.raca, racaRef: { refId: f.racaDoc.id, custom: '' }, classe: '', tribo: '',
        porte: f.porte, tamanho: `${String(f.altura).replace('.', ',')}m`,
        papel: '', local: f.local, tags: `criatura, domável, companheiro, vale de silmarela`,
        atributos: f.atrib, periciasEstruturadas: [], peculiaridades: f.pecs,
        partesDoCorpo: f.partes, modulosClasse: [],
        ataques: f.ataques, skills: '',
        valoresDer: { overrides: { [ALTURA_VD]: f.altura }, atual: {}, extras: [], vinculados: VINCULADOS,
            VIT: f.vit, BLD: f.bld, SAN: 0, ENER: 0, DESLOCAMENTO: f.desloc },
        criatura: { habitat: f.habitat, comportamento: f.comportamento, dieta: f.dieta, nivelAmeaca: f.ameaca },
        rolePlay: { personalidade: ['', '', ''], trejeitos: '', motivacao: '', segredos: '',
            relacoes: { aliado: '', rival: '', devedor: '' }, frases: '', historia: '' },
        loot: { itens: '', luns: '', pistas: '', complicacoes: '' },
        visibilidade: 'secreto', mesaId: '', vinculos: [], aliadoProprio: false, imagem: '',
        lastUpdate: iso, lastUpdateBy: AUTOR,
    });
}
await batch.commit();
console.log(`\n✅ ${FICHAS.length} fichas criadas.`);
process.exit(0);
