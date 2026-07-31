/**
 * Popula a Mesa 1 "Grau Espectro" a partir do material da pasta Reliera.
 * TUDO aqui é transcrição/estruturação dos documentos do Mestre — nada inventado.
 *
 * Fontes:
 *  - Sessões/Mesa1/Linha_do_Tempo_Sessoes.md          → histórico (session-logs)
 *  - Sessões/Mesa1/Sessão47/Guia_do_Mestre_..._Dois_Fios.docx → sessão 47 (preparo)
 *  - Sessões/Mesa1/Sessão47/Fichas_de_Combate_Sessao47.docx   → encontros
 *  - Sessões/Mesa1/Sessão47/Consequencias_Pendentes.docx      → frente da Ina
 *  - Sessões/Mesa1/Sessão39|41/Sessão*.md                     → frente da Onça
 *
 *   node functions/cadastrar-mesa1-grau-espectro.mjs           (dry-run)
 *   node functions/cadastrar-mesa1-grau-espectro.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');
const MESA_ID = '7MQKtOpcMt8DCH7r97Fb';   // Grau Espectro
const FONTE = 'Importado da pasta Reliera em 30/07/2026';

/* ---------------- NPCs a vincular (mesaId vazio → esta mesa) ---------------- */
const VINCULAR = [
    'Fontrix Olho-de-Corvo',        // Sessão46/47 — atirador do Morik
    'Albrix Muro-de-Ferro',         // Sessão46/47 — escudeiro do Morik
    'Seriva \'Véu Cinza\'',         // Sessão47 — a Verificação
    'Ibirá',                        // 1º e 3º arco — o deus
    'Gorren-Nhar, o Porteiro',      // Sessão34 e Sessão47
    'Raknar Sombra Sangrenta',      // Sessão46 — NPC junto do grupo
    'Armador da Feira',             // Sessão47 — os 8 do salão
    'Vigia de Elite da Feira',      // Sessão46 — os 2 mortos nas torres
    'Sentinela da Feira',           // Feira do Submundo
    'Felino-Fantasma das Savanas',  // a Onça — Sessão39/41/47
    'Vorath \'Fenda-Aberta\'',      // 2º arco
    'Velhen \'O Que Se Repete\'',   // Sessão30 — possuiu Arek
];

/* ---------------- FRENTES ---------------- */
// Presságios transcritos da tabela "Linha do tempo sugerida" de Consequencias_Pendentes.docx
const FRENTES = [
    {
        nome: 'A Dívida com Ina',
        tipo: 'faccao',
        perigo: 'Ina Nó-de-Pedra descobre quem matou os dois Vigias de elite dela em Velmora e reage — matar pessoal contratado é dano direto a ela, não brecha jurídica.',
        relogio: { fatias: 4, cheias: 0 },
        pressagios: [
            { texto: 'Um Corredor ou Armador relata a Ina. Ela ainda não sabe quem fez (+1 a 2 dias)', quando: 1, ocorrido: false },
            { texto: 'Ina identifica os rostos — a Cindy, brilhando no escuro, é a descrição mais fácil de circular (+3 a 5 dias)', quando: 2, ocorrido: false },
            { texto: 'Ina cobra restituição (Luns, favor ou serviço) — ou trata como quebra da Paz, se decidir que o horário é discutível', quando: 3, ocorrido: false },
            { texto: 'SEM PORTA: "Não quebrou lei. Não será recebido." Reputação no Submundo cai a 0 e MAN+Malandragem sofre −3 dados', quando: 4, ocorrido: false },
        ],
        rostosNomes: ['Ina Nó-de-Pedra', 'Seriva \'Véu Cinza\''],
    },
    {
        nome: 'A Onça',
        tipo: 'ameaca',
        perigo: 'O Felino-Fantasma que matou Arternix Arvenka na Sessão 39 continua solto na mata. Barulho, gritos ou sangue em excesso a trazem para investigar. Morik paga 2 mil luns por ela; a guilda do Carinha do Gelo paga outros 2 mil.',
        relogio: { fatias: 6, cheias: 0 },
        pressagios: [],   // os documentos não trazem escada de presságios — preencher em mesa
        rostosNomes: ['Felino-Fantasma das Savanas'],
    },
];

/* ---------------- SESSÃO 47 (preparo) ---------------- */
const CENAS = [
    { titulo: 'Abertura', notas: '5 min — recapitular e devolver o controle aos dois grupos' },
    { titulo: 'FIO A — A Caçada ao Fontrix', notas: '20-25 min — Praematum, Vexia e Cindy circulando. Fontrix ferido e desesperado; Albrix não ataca primeiro. A Onça pode voltar aqui' },
    { titulo: 'FIO B — A Descida', notas: '25-30 min — 31 degraus; Arkrau não quer descer; 8 Armadores montando a Feira; corredor leste; a Verificação da Seriva' },
    { titulo: 'O Choque — Gorren-Nhar', notas: 'Variável — 3 desfechos conforme quem chega primeiro à câmara. A coroa é ponto vital (VIT 8): destruída, ele se retira' },
    { titulo: 'A Estrada — Morik', notas: '15 min — lampião no meio da estrada, sem guardas. O acordo e os 6 frascos de Azul. Ajustar conforme o destino do Fontrix' },
    { titulo: 'Ibirá — o deus', notas: 'O resto — 4 fases: A Parede → O Azul → O Medo → O Joelho. Abertura: 1d6 na frente da mesa' },
];

const SEGREDOS = [
    'Fontrix procura Ilena há três anos — se souberem dela, ele baixa o arco pela primeira vez',
    'Albrix serve Morik porque Morik salvou a irmã dele, Lenna',
    'Fontrix e Albrix são os contratados do Morik que estiveram na tentativa de impedir o ritual do Vorath (Sessão 34)',
    'A esposa de Morik se chamava Sereni — Ibirá a estuprou e matou; a vingança dele é o mesmo motivo que Thalion teve e abandonou',
    'Thalion serviu Morik e o odiou por hipocrisia — ouvir sobre Sereni o faz entregar a adaga por exaustão, não por medo',
    'Os Armadores não são criminosos: são carregadores contratados pelo Sindicato Pogtara — matar um arruína o grupo com Ina',
    'No corredor leste tem gente que não é da equipe — os Armadores evitam aquele corredor',
    'O Sussurro Final não pode ser guardado em bainha e custa −1 Sanidade por dia de posse; contra mortais é adaga comum, contra divindade ignora Blindagem',
    'Ibirá tem AUT 2 — "Taslo" ou "Sereni" o travam por uma rodada (1× cada); Paloma, Sabrini e Guilion ele não reconhece, e é isso que quebra',
    'Sem o Azul do Morik no sangue, enfrentar Ibirá é TPK — a Imunidade Divina zera todo dano mortal contra BLD 12',
    'A coroa de Gorren-Nhar é ponto vital (VIT 8, alvo específico, −3 Dif) — destruída, ele perde a Presença Soberana e se retira com dignidade',
    'Arkrau nunca explicou a contradição da porta ("estava aberta, mas dava medo entrar") — se cobrarem, ele muda de assunto muito rápido',
];

// Fichas de Combate — Sessão 47. VIT/BLD já ajustados ao que aconteceu na 46.
const ENCONTROS = [
    {
        nome: 'FIO A — Fontrix ferido + Albrix',
        parts: [
            { npc: 'Fontrix Olho-de-Corvo', vit: 16, ener: 5, san: 100, ini: 7, det: 'BLD 2 · REA 5 · PERC 6 · Arco (+4) 6d10 · −2 à distância (pó corrosivo)' },
            { npc: 'Albrix Muro-de-Ferro', vit: 28, ener: 5, san: 100, ini: 4, det: 'BLD 5 · REA 3 · Espada Longa (+3) 9d10 · Escudo Grande · NÃO ataca primeiro' },
        ],
    },
    {
        nome: 'A Onça (Felino-Fantasma)',
        parts: [
            { npc: 'Felino-Fantasma das Savanas', vit: 42, ener: 5, san: 100, ini: 9, det: 'BLD 2 · REA 9 · Mordida Alvo 10 1d10+4 · Salto Predatório Alvo 11 · 4 saídas: lutar, recuar, dar comida, contornar' },
        ],
    },
    {
        nome: 'FIO B — Thalion + 4 capangas',
        parts: [
            { npc: 'Thalion Vassek', vit: 30, ener: 6, san: 18, ini: 3, det: 'BLD 2 · REA 3 · luta para FUGIR. Ouvir sobre Sereni = entrega a adaga' },
            { npc: 'Capanga de Thalion', vit: 8, ener: 5, san: 100, ini: 4, det: 'BLD 2 · porta da câmara · Espada 7d10', n: 2 },
            { npc: 'Capanga de Thalion', vit: 8, ener: 5, san: 100, ini: 4, det: 'BLD 2 · dormindo no corredor — 2 rodadas para reagir', n: 2 },
        ],
    },
    {
        nome: 'O Choque — Gorren-Nhar, o Porteiro',
        parts: [
            { npc: 'Gorren-Nhar, o Porteiro', vit: 120, ener: 10, san: 100, ini: 7, det: 'BLD 6 · 2,40m · Garras Soberanas Alvo 14 3d10+7 · Presença Soberana −1 a 15m · coroa VIT 8 é ponto vital' },
        ],
    },
    {
        nome: 'Ibirá — o deus (final)',
        parts: [
            { npc: 'Ibirá', vit: 90, ener: 10, san: 100, ini: 10, det: 'BLD 12 · Imunidade Divina: só Sussurro Final ou Azul perfuram · AUT 2 · 4 fases' },
        ],
    },
];

const SESSAO47 = {
    numero: 47,
    fase: 'preparo',
    dataReal: '',
    dataJogo: 'Logo após a meia-noite — mesma noite da Sessão 46',
    inicioForte: 'A porta de pedra do subsolo está aberta e o grupo segue dividido: FIO A (Praematum, Vexia, Cindy) circulando para cercar Fontrix na floresta; FIO B (Nura, Sona, Don, Raknar, Arkrau) no topo dos 31 degraus. É meia-noite — a Verificação da Seriva pode já estar em andamento.',
    recompensas: 'O Sussurro Final (a adaga que mata deuses) · 6 frascos de Azul, do Morik · loot dos capangas: 2 Moedas Sombrias e uma cópia dos Contos · os Contos em papel do Thalion ("O Céu Ficou Parado" e "Eu Cedi")',
};

/* ---------------- HISTÓRICO (Linha_do_Tempo_Sessoes.md) ---------------- */
const ARCO = n => n <= 27 ? '1º Arco — Masmorra de Ibirá'
    : n <= 35 ? '2º Arco — O Louco Vorath (Os Obscurum)'
    : '3º Arco — Como Matar um Deus?';

const HISTORICO = [
    [25, '2025-12-14', 'Taverna Caneca Preta, novo dono Gertrok. Praematum e Unreine entram no grupo.'],
    [26, '2025-12-21', 'Penacho Bravo Alfa nos Campos de Vasteluna. Zyra perde um braço.'],
    [27, '2025-12-28', 'Arek aparece; Palla e Ibirá se manifestam no céu; Cindy doma o Cindybu.'],
    [28, '2026-01-04', 'Cindygalia domada; Rila está grávida; entrada na caverna.'],
    [29, '2026-01-11', 'Combate contra três sombras; surge o "criador".'],
    [30, '2026-01-18', 'Velhen possui Arek. Diário de Vorath. Grupo recua para Sereni.'],
    [31, '2026-01-25', 'Bandidos atrás do baú; Ibirá vs. o palhaço; Palla intervém.'],
    [32, '2026-02-01', 'Sessão calma e preparatória em Sereni.'],
    [33, '2026-02-08', 'Assalto ao ritual: 3 dos 7 lacaios da Obscurum mortos.'],
    [34, '2026-02-17', 'Fim ou Recomeço. Gorren-Nhar quase mata Praematum; Alan Biltrox invocado; Unreine morre e salva Palla. O ritual e a luta aconteceram na MESMA sessão.'],
    [35, '2026-03-01', 'Fuga sob a enxurrada até a taverna; estreia a Yotun "Barbie".'],
    [36, '2026-03-08', 'Novo arco. Morik Varn soube que queriam matá-lo e saiu da vila; o grupo invadiu a casa dele e leu o conto "Tão Frágil Sereni". Ibirá apareceu falando exatamente as frases ouvidas na masmorra dele no 1º arco — o conto do Morik é o texto por trás daquelas vozes.'],
    [37, '2026-03-15', 'Ratos na masmorra; recuperam o corpo de Unreine.'],
    [38, '2026-03-22', 'Roleplay em Sereni; Praematum ludibria o padre.'],
    [39, '2026-03-29', 'Arternix Arvenka morre — primeira aparição da Onça. Arternix e Cindy saíram para caçar frutinhas e ervas; Arternix já estava muito ferida quando a Onça a matou. Cindy a enterrou. Duas mortes na sessão; só a da Arternix ficou registrada. Amanda passou a jogar com Nura.'],
    [41, '2026-04-26', 'Praematum acordou com pesadelos pela morte da Arternix e foi atrás de informações sobre a Onça; acabou se inscrevendo na guilda do Carinha do Gelo. O contrato pagava 2 mil luns — e como Morik também pagava 2 mil, o plano virou entregá-la viva. A armadilha desandou, choveram flechas de atiradores escondidos, e Praematum achou um baú com duas máscaras do submundo. Terminou com 2 mantos e 1 máscara.'],
    [42, '2026-05-10', 'Última antes do hiato de sete semanas. Sem resumo registrado; funcionou como fechamento de temporada.'],
    [45, '2026-07-12', 'Sessão sem combate, de preparação na vila. O grupo viu as missões do dia, encontrou uma Pogo cega que bebia sangue (Sona) e a convidou. Aceitaram a missão de encontrar um sujeito que só revelaria a missão pessoalmente — era Ibirá. O deus encomendou o roubo da adaga que mata deuses, justamente a que o grupo já queria roubar. Depois discutiram se entregariam a adaga ou fariam a própria arma com ela.'],
    [46, '2026-07-26', 'A Estrada para Velmora. O grupo viajou ~5h até a Floresta de Velmora e se dividiu. Grupo 1 (Praematum, Vexia, Cindy) topou com Albrix e Fontrix perto da saída secreta — Fontrix virou atirando, Albrix mandou fugirem, Cindy jogou pó corrosivo no rosto do Fontrix. Grupo 2 (Nura, Sona, Don, Raknar) encontrou Arkrau, um Diabrete carismático e medroso, e entrou com ele: mataram os 2 Vigias de elite da torre e acertaram a senha na segunda tentativa. Don completou a Runa Gélida. Terminou com a porta de pedra do subsolo se abrindo.'],
];
const GAME_DATE = { 46: '42/02/212 — Semana 5 do mês Cresti, Primavera, Era Dourada (Dia Ignitus)' };

/* ================= EXECUÇÃO ================= */
const log = (...a) => console.log(...a);
const uid = p => p + '-' + Math.random().toString(36).slice(2, 10);

const npcSnap = await db.collection('npcs').get();
const porNome = new Map();
npcSnap.forEach(d => porNome.set((d.data().nome || '').trim(), { id: d.id, ...d.data() }));

log(APPLY ? '=== APLICANDO ===' : '=== DRY-RUN (nada será gravado) ===');
log('Mesa:', MESA_ID, '\n');

/* 1. Vincular NPCs */
log('--- 1. NPCs a vincular ---');
let vinc = 0;
for (const nome of VINCULAR) {
    const n = porNome.get(nome);
    if (!n) { log('  ⚠ NAO ENCONTRADO:', nome); continue; }
    if (n.mesaId === MESA_ID) { log('  = já vinculado:', nome); continue; }
    if (n.mesaId) { log(`  ⚠ PULADO (está em outra mesa: ${n.mesaId}):`, nome); continue; }
    log('  + vincular:', nome);
    if (APPLY) await db.collection('npcs').doc(n.id).update({ mesaId: MESA_ID });
    vinc++;
}

/* 2. Frentes */
log('\n--- 2. Frentes ---');
const colFrentes = db.collection('mesas').doc(MESA_ID).collection('frentes');
const frentesExistentes = await colFrentes.get();
const nomesFrentes = new Set(); frentesExistentes.forEach(d => nomesFrentes.add(d.data().nome));
for (const f of FRENTES) {
    if (nomesFrentes.has(f.nome)) { log('  = já existe:', f.nome); continue; }
    const rostos = (f.rostosNomes || []).map(nm => porNome.get(nm)?.id).filter(Boolean);
    const faltando = (f.rostosNomes || []).filter(nm => !porNome.get(nm));
    log(`  + ${f.nome} — relógio ${f.relogio.cheias}/${f.relogio.fatias}, ${f.pressagios.length} presságio(s), ${rostos.length} rosto(s)${faltando.length ? ' ⚠ sem NPC: ' + faltando.join(', ') : ''}`);
    if (APPLY) await colFrentes.add({
        nome: f.nome, tipo: f.tipo, perigo: f.perigo, status: 'ativa',
        relogio: f.relogio, pressagios: f.pressagios, rostos,
        historico: [], createdAt: Date.now(), fonte: FONTE,
    });
}

/* 3. Sessão 47 */
log('\n--- 3. Sessão 47 (preparo) ---');
const colSessoes = db.collection('mesas').doc(MESA_ID).collection('sessoes');
const ja47 = await colSessoes.where('numero', '==', 47).get();
if (!ja47.empty) log('  = sessão 47 já existe — pulando');
else {
    const encontros = ENCONTROS.map(e => {
        const participantes = [];
        for (const p of e.parts) {
            const npc = porNome.get(p.npc);
            for (let i = 0; i < (p.n || 1); i++) {
                participantes.push({
                    id: uid('npc'),
                    ...(npc ? { npcId: npc.id, isNpc: true } : { isCustom: true }),
                    name: p.npc + (p.n > 1 ? ` ${i + 1}` : ''),
                    type: npc ? (npc.tipo === 'criatura' ? 'Criatura' : 'NPC') : 'Inimigo',
                    initiative: p.ini || 0, details: p.det || '',
                    hpCurrent: p.vit, hpMax: p.vit,
                    enerCurrent: p.ener, enerMax: p.ener,
                    sanCurrent: p.san, sanMax: p.san,
                });
            }
            if (!npc) log(`    ⚠ sem NPC no banco (vai como avulso): ${p.npc}`);
        }
        return { id: uid('enc'), nome: e.nome, participantes };
    });
    log(`  + Sessão 47 "Dois Fios" — ${CENAS.length} cenas, ${SEGREDOS.length} segredos, ${encontros.length} encontros`);
    encontros.forEach(e => log(`      ⚔ ${e.nome} (${e.participantes.length})`));
    if (APPLY) await colSessoes.add({
        ...SESSAO47,
        cenas: CENAS.map(c => ({ id: uid('cena'), ...c, canvasId: '', feita: false })),
        segredos: SEGREDOS.map(t => ({ id: uid('seg'), texto: t, revelado: false, herdado: false })),
        encontros, inbox: [], colheita: [], resumo: '',
        createdAt: Date.now(), fonte: FONTE,
    });
}

/* 4. Histórico */
log('\n--- 4. Histórico de sessões (session-logs) ---');
const logsExist = await db.collection('session-logs').where('mesaId', '==', MESA_ID).get();
const numsExist = new Set(); logsExist.forEach(d => numsExist.add(d.data().sessionNumber));
let novos = 0;
for (const [num, data, resumo] of HISTORICO) {
    if (numsExist.has(num)) { log(`  = já existe: sessão ${num}`); continue; }
    novos++;
    if (APPLY) await db.collection('session-logs').add({
        mesaId: MESA_ID, sessionNumber: num, dateReal: data,
        gameDate: GAME_DATE[num] || '', summary: resumo,
        playerSummaries: '', participants: [], npcs: '', locations: '',
        combats: '', loot: '', hooks: '', moments: '',
        dmNotes: `${ARCO(num)} · ${FONTE} (Linha_do_Tempo_Sessoes.md)`,
        createdAt: new Date().toISOString(), createdBy: 'import',
    });
}
log(`  + ${novos} sessão(ões) a importar (40, 43 e 44 não têm registro e foram puladas)`);

log('\n=== RESUMO ===');
log(` NPCs vinculados: ${vinc} · Frentes: ${FRENTES.filter(f => !nomesFrentes.has(f.nome)).length} · Sessão 47: ${ja47.empty ? 'criar' : 'já existe'} · Histórico: ${novos}`);
if (!APPLY) log('\n Rode de novo com --apply para gravar.');
process.exit(0);
