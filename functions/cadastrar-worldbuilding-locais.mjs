/**
 * Cadastra no Worldbuilding os locais documentados na pasta Reliera —
 * lore do cenário (notas do vault) + locais da Mesa 1 (guias de sessão).
 * TUDO transcrito dos documentos do usuário; nada inventado.
 *
 * Fontes:
 *  - 01 Worldbuilding/Geografia e Locais/*.md            → Forkrok, Mirfel, Garkrok, Pata-Norte
 *  - 01 Worldbuilding/Geografia e Locais/Cidades/Sereni.md → descrição de Sereni
 *  - Mestre/Sessões/Mesa1/Sessão46/Guia..._O_Preco_do_Luto.docx → Velmora (pátio, torres, porta)
 *  - Sessão46/Handout_4_Planta_do_Subsolo.docx           → subsolo e passagem secreta
 *  - Sessão46/Guilda_de_Aventureiros_de_Sereni.docx      → a Guilda "Os Ecos"
 *  - Sessão46/Mestre_8_A_Feira_11_Bancas.docx            → a Feira no subsolo
 *  - Sessões/Mesa1/Sessão26|36|39|41 (.md)               → Vasteluna, Masmorra, casa do Morik
 *
 *   node functions/cadastrar-worldbuilding-locais.mjs           (dry-run)
 *   node functions/cadastrar-worldbuilding-locais.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');
const AGORA = new Date().toISOString();
const BASE_GEO = {
    clima: '', descricao: '', governo: '', historiaLocal: '', imagem: '', landmarks: '',
    notas: '', perigos: '', populacao: '', recursos: '', tags: '',
    linkedNpcs: [], linkedTribos: [], pertenceA: null,
    lastUpdate: AGORA, lastUpdateBy: 'import-reliera',
};

const GEOS = [
    // ---------- LOCAIS DA MESA 1 (guias de sessão) ----------
    {
        nome: 'Floresta de Velmora', tipo: 'Região',
        descricao: 'Floresta a meio dia de viagem (~5h) ao norte de Sereni, pela estrada norte. Mata fechada com trilhas discretas; fogueiras apagadas com terra e ossos de jantar enterrados denunciam gente treinada passando. A saída da passagem secreta do subsolo de Velmora fica aqui, escondida atrás de uma raiz, a 200 metros das ruínas.',
        perigos: 'A Onça (Felino-Fantasma das Savanas) ronda a mata — barulho, gritos ou sangue a atraem. Emboscadas de grupos armados. Pássaros mortos sem ferimento nenhum marcam a passagem recente do Sussurro Final: a adaga apaga essência por onde passa.',
        historiaLocal: 'Sessões 46–47 da Mesa 1 (Grau Espectro): o grupo atravessou a floresta rumo às Ruínas de Velmora e se dividiu em dois fios — a escaramuça com Fontrix e Albrix aconteceu perto da saída secreta.',
        notas: 'Importado dos guias da Sessão 46/47. Não está documentado se pertence ao Vale de Silmarela — confirmar com o Mestre.',
        tags: 'Mesa1,Velmora,',
    },
    {
        nome: 'Ruínas de Velmora', tipo: 'Ponto de Interesse', pertenceANome: 'Floresta de Velmora',
        descricao: 'Ruínas de uma fortaleza antiga no meio da Floresta de Velmora. O pátio central guarda 43 estacas de ferro com lampiões de óleo — nas noites de Feira do Submundo, são acesos um a um, num ritual de onze minutos em silêncio. Duas torres (norte e sul) servem de posto para Vigias de elite. Nos muros, corvos pousam todos virados para a mesma direção: o subsolo. A porta de pedra do subsolo tem trava de quatro símbolos rotativos e abre para uma escadaria de 31 degraus com dois metros de largura.',
        historiaLocal: 'Velmora foi um matadouro antes de ser ruína — um Sangral sente sangue de séculos sob o piso. O túnel de 200 metros que sai do salão do leilão foi cavado por quem construiu a fortaleza, não pela Feira: é mais velho que qualquer um lá dentro e não está no plano de segurança de ninguém.',
        landmarks: 'Pátio dos 43 lampiões · torres norte e sul · porta de pedra com trava de 4 símbolos · marcas a giz do Submundo (coroa = relíquia, lua crescente = esta noite, espiral = Abismo)',
        perigos: 'Vigias de elite nas torres quando há Feira marcada. Sede itinerante da Feira do Submundo no subsolo.',
        notas: 'Importado dos guias da Sessão 46/47 da Mesa 1.',
        tags: 'Mesa1,Velmora,Submundo,',
    },
    {
        nome: 'Masmorra de Ibirá', tipo: 'Ponto de Interesse',
        descricao: 'Masmorra erguida pelo deus Ibirá próxima a Sereni — o "evento recente" que atraiu aventureiros e desestabilizou o equilíbrio político da vila. Por dentro, enigmas de vozes: frases ditas pelo próprio Ibirá que, o grupo descobriria muito depois, são trechos do conto "Tão Frágil Sereni", de Morik Varn.',
        historiaLocal: 'Palco do 1º arco da Mesa 1 (Masmorra de Ibirá, até a Sessão 27). Ibirá alegou tê-la erguido como recompensa, "populando a Vila de Sereni" — e um templo erguido em segredo "virou cova para o meu silêncio". Darin dos Ecos é o único sobrevivente conhecido de uma expedição anterior: carrega as cicatrizes, não entra mais em lugar fechado, e vende um mapa parcial da gruta por 150 Luns.',
        perigos: 'De uma expedição anterior inteira, só Darin voltou.',
        notas: 'Importado do guia da Sessão 46/47, da Linha do Tempo da Mesa 1 e da nota Sereni.md.',
        tags: 'Mesa1,Ibirá,masmorra,',
    },
    {
        nome: 'Campos de Vasteluna', tipo: 'Região',
        descricao: 'Campos abertos, habitat de Penachos-Bravos — inclusive o Alfa.',
        historiaLocal: 'Sessão 26 da Mesa 1: combate contra o Penacho-Bravo Alfa em que Zyra Vento Veloz perdeu um braço.',
        notas: 'Pouco material documentado — expandir com o Mestre.',
        tags: 'Mesa1,',
    },
    {
        nome: 'Floresta de Silmari', tipo: 'Região',
        descricao: 'Floresta nos arredores de Sereni.',
        notas: 'Tabelas de encontros em "Floresta_de_Silmari_Encontros_Sereni.pdf" (pasta Sereni do vault). Mapas da floresta circulam no mercado negro — a banca Linhas Falsas da Feira do Submundo vende um.',
        tags: 'Sereni,',
    },
    // ---------- LOCAIS DO CENÁRIO (notas do vault) ----------
    {
        nome: 'Forte de Forkrok', tipo: 'Cidade',
        descricao: 'Estrutura imponente em meio à paisagem montanhosa, onde muros de pedra maciça se fundem com o relevo. Arquitetura grevoriana típica: ruas excepcionalmente largas, casas de formas cúbicas gigantescas, ruas que ziguezagueiam pela montanha entrando e saindo por túneis esculpidos na rocha — algumas passagens levam a residências embutidas na própria montanha. Sigilos Rúniuns espalhados pela cidade acendem os postes ao anoitecer e cumprem tarefas cotidianas; praças com fontes encantadas que nunca secam abrem-se entre as construções.',
        clima: 'Frio de altitude; muitos edifícios têm aquecimento rúnico.',
        landmarks: 'Túneis urbanos escavados na rocha · praças com fontes encantadas · sigilos Rúniuns nos postes',
        notas: 'Importado da nota "Forte de Forkrok.md" do vault.',
        tags: 'Grévoras,Forkrok,',
    },
    {
        nome: 'Porto de Forkrok', tipo: 'Cidade',
        descricao: 'Um dos mais impressionantes centros comerciais às margens do Rio Medial. Tudo é pedra — escolha prática e cultural dos Grévoras, que têm pouca habilidade com madeira. Ruas amplas para o tráfego de mercadorias, edificações com portas e arcos gigantescos que os próprios Grévoras raramente preenchem. Patrulhado pelos Megalitoras, criaturas enormes sob o comando do General Krorak.',
        populacao: 'Multicultural: Grévoras, Myrkas, Tamanos, Elorins, Vúrkas, Zérfikas e Torunkas.',
        clima: 'Temperado e úmido, com brisas constantes do Rio Medial; tempestades na época de chuvas.',
        historiaLocal: 'Fundado pelos Grévoras como ponto estratégico; expandiu após a aliança comercial com os Myrkas. A Defesa Contra os Saqueadores do Medial — invasão pirata repelida pelos Megalitoras — solidificou a fama de fortaleza comercial.',
        recursos: 'Comércio fluvial e terrestre; Feira dos Grandes Artefatos.',
        landmarks: 'Cais de pedra no Rio Medial · Megalitoras em patrulha',
        notas: 'Importado da nota "Porto de Forkrok.md" do vault.',
        tags: 'Grévoras,Forkrok,Rio Medial,',
    },
    {
        nome: 'Porto de Pata-Norte', tipo: 'Vila',
        descricao: 'Pequeno vilarejo portuário às margens do Rio Pata-Norte, um dos braços do Lago Mirfel — um dos pontos mais remotos da civilização Elorin. Casas de madeira e folhas entrelaçadas misturam-se à floresta densa; o rio serve de rota de navegação e abastecimento. Cercado por vegetação selvagem, com neblina nas manhãs frias e Enguias Luminescentes nas águas.',
        populacao: 'Menos de 100 habitantes — maioria Elorins; minoria significativa de Myrkas (anfíbios de pele azul, essenciais na pesca). Línguas: Galir (comum), Élori e Myrkári.',
        clima: 'Temperado; verões suaves, invernos chuvosos, umidade constante do rio e da floresta.',
        historiaLocal: 'Fundado como posto de comércio e pesca dos Elorins; os Myrkas chegaram há ~50 anos. A Grande Enchente de Forkrok (10-27-MU) — quando as minas de Forkrok abriram acesso a águas do subsolo — quase destruiu o porto; a reconstrução marcou novo período de prosperidade.',
        landmarks: 'Festival do Espelho de Mirfel (lanternas flutuantes no rio) · Oferenda à Criatura de Mirfel a cada estação',
        notas: 'Importado da nota "Porto de Pata-Norte.md" do vault. Próximo à Vila de Elória (ainda não cadastrada).',
        tags: 'Elorins,Myrkas,Mirfel,',
    },
    {
        nome: 'Lago Mirfel', tipo: 'Ponto de Interesse',
        descricao: 'Imenso corpo de água cujo formato lembra uma criatura mítica — braços e patas desenhados pelos pequenos rios que o alimentam.',
        historiaLocal: 'A lenda diz que o lago tem o formato do filho de um deus com uma criatura mortal animalesca. Os povoados ribeirinhos fazem oferendas de peixes e flores à Criatura de Mirfel a cada estação, para evitar tempestades.',
        notas: 'Importado das notas "Lago Mirfel.md" e "Porto de Pata-Norte.md" do vault.',
        tags: 'Mirfel,',
    },
    {
        nome: 'Mina de Garkrok', tipo: 'Ponto de Interesse',
        descricao: 'Mina profunda dos Grévoras da antiga Forkrok.',
        historiaLocal: 'Dizem que tinha conexão com uma bolsa de água profunda: ao romperem as rochas que a seguravam, uma quantidade exorbitante de água irrompeu da terra, escoando pelo Rio Medial até se dividir no Rio Pata-Norte e no Rio Garra-Sul, chegando ao Lago Mirfel — a Grande Enchente de Forkrok (10-27-MU).',
        notas: 'Importado da nota "Mina de Garkrok.md" do vault.',
        tags: 'Grévoras,Forkrok,',
    },
];

// Subsolo já existe — só completar descrição (se vazia) e pendurar na hierarquia
const SUBSOLO_DESCRICAO = 'Salão principal de teto baixo (3m) alcançado por uma escadaria de 31 degraus e 2m de largura, atrás da porta de pedra com trava de quatro símbolos. Nas noites de Feira do Submundo, 11 bancas se erguem em torno de um tablado central, com o salão do leilão ao fundo — mesa elevada onde a caixa de ferro é aberta. 43 lampiões de óleo, ~30 pessoas, máscaras são comuns e ninguém diz o próprio nome. No canto nordeste do salão do leilão, uma pedra solta esconde a passagem secreta: túnel de 200 metros e 1,40m de altura, cavado por quem construiu a fortaleza, saindo na mata atrás de uma raiz.';

const BASE_PROP = {
    estado: 'Conservada', tipo: '', notas: '', imagem: '', valor: '', titulo: '',
    descricao: '', tamanho: '', segredos: '', proprietario: '', comodos: '',
    linkedItems: [], lastUpdate: AGORA, lastUpdateBy: 'import-reliera',
};
const PROPS = [
    {
        nome: 'Guilda de Aventureiros de Sereni', tipo: 'Guilda',
        titulo: '"Os Ecos", como chamam os moradores',
        proprietario: 'Darin dos Ecos (atendente: Noryel)',
        descricao: 'Galpão de pedra e madeira encostado na muralha leste de Sereni, dois andares, telhado remendado. Foi celeiro antes de ser guilda e ainda cheira levemente a feno velho por baixo do cheiro de cerveja e couro molhado. O andar de baixo é uma sala só: balcão comprido de madeira lascada, quatro mesas, uma lareira que nunca apaga e, ocupando a parede inteira do fundo, o Mural de Contratos — tábua de carvalho de quatro metros com centenas de furos de prego, a maioria vazios.',
        comodos: 'Andar de baixo: salão único com balcão, 4 mesas, lareira e o Mural de Contratos. Andar de cima: 6 catres alugados a 8 Luns/noite e o quarto do Darin, que ninguém nunca viu por dentro. Porta dos fundos sempre destrancada, com corredor curto direto para a rua.',
        segredos: 'A porta dos fundos existe porque Darin não consegue ficar num cômodo com uma saída só — ele é o único sobrevivente da masmorra de Ibirá. A Guilda é penitência, não negócio: ele acha que deve a quem morreu com ele lá embaixo, e paga registrando contratos honestos e nunca mentindo sobre o risco.',
        notas: 'Sistema de Selos por confiança, não por poder: Caderno de Contratos com selos em lacre + chapa visível (Sem Selo → Couro → Madeira → Bronze → ...). Registro: 10 Luns. Falsificar chapa = chapa derretida em público e nome no Livro Negro de todas as guildas da rota. Detalhe completo em Guilda_de_Aventureiros_de_Sereni.docx.',
        geoNome: 'Sereni',
    },
    {
        nome: 'Casa de Morik Varn', tipo: 'Residência',
        proprietario: 'Morik Varn, o Ancião — Senhor de Sereni',
        descricao: 'Residência do Ancião que governa Sereni.',
        segredos: 'Invadida pelo grupo da Mesa 1 na Sessão 36, depois que Morik soube que queriam matá-lo e deixou a vila. Lá dentro o grupo leu o conto "Tão Frágil Sereni" — o texto por trás das vozes da masmorra de Ibirá — e as anotações que revelam que Ibirá estuprou e matou Sereni, esposa de Morik.',
        notas: 'Importado da Linha do Tempo da Mesa 1 (Sessão 36) e do guia da Sessão 46/47.',
        geoNome: 'Sereni',
    },
];

// Sereni: preencher descrição vazia com a nota do vault
const SERENI_DESCRICAO = 'Vila neutra e mercantil onde viajantes e tribos rivais convivem em uma tensa paz, graças ao equilíbrio político estabelecido pelo Ancião Morik. Terreno de planície. Uma nova masmorra surgiu próxima à vila, atraindo aventureiros e ameaçando desestabilizar o frágil equilíbrio da região — enquanto o Submundo opera nas sombras.';

/* ================= EXECUÇÃO ================= */
const log = (...a) => console.log(...a);
log(APPLY ? '=== APLICANDO ===' : '=== DRY-RUN (nada será gravado) ===\n');

const colGeo = db.collection('worldbuilding-geography');
const colProp = db.collection('worldbuilding-properties');
const geoSnap = await colGeo.get();
const geoPorNome = new Map();
geoSnap.forEach(d => geoPorNome.set((d.data().nome || '').trim(), { ref: d.ref, ...d.data() }));

log('--- Geografia ---');
for (const g of GEOS) {
    if (geoPorNome.has(g.nome)) { log('  = já existe:', g.nome); continue; }
    const { pertenceANome, ...campos } = g;
    const doc = { ...BASE_GEO, ...campos };
    if (pertenceANome) {
        const pai = geoPorNome.get(pertenceANome);
        if (pai) doc.pertenceA = { id: pai.ref.id, nome: pai.nome, tipo: pai.tipo };
        else doc.pertenceA = { nome: pertenceANome };   // resolvido na 2ª passada
    }
    log(`  + ${g.nome} (${g.tipo})${pertenceANome ? ' ← ' + pertenceANome : ''}`);
    if (APPLY) {
        const ref = await colGeo.add(doc);
        geoPorNome.set(g.nome, { ref, ...doc });
    }
}
// 2ª passada: resolver pertenceA que apontava para doc criado nesta rodada
if (APPLY) {
    for (const [nome, g] of geoPorNome) {
        if (g.pertenceA && g.pertenceA.nome && !g.pertenceA.id) {
            const pai = geoPorNome.get(g.pertenceA.nome);
            if (pai) await g.ref.update({ pertenceA: { id: pai.ref.id, nome: pai.nome, tipo: pai.tipo } });
        }
    }
}

log('\n--- Subsolo da Ruina de Velmora (existente) ---');
const subsolo = geoPorNome.get('Subsolo da Ruina de Velmora');
if (!subsolo) log('  ⚠ não encontrado');
else {
    const ruinas = geoPorNome.get('Ruínas de Velmora');
    const patch = {};
    if (!subsolo.pertenceA && ruinas) patch.pertenceA = APPLY ? { id: ruinas.ref.id, nome: 'Ruínas de Velmora', tipo: 'Ponto de Interesse' } : '(Ruínas de Velmora)';
    if (!(subsolo.descricao || '').trim()) patch.descricao = SUBSOLO_DESCRICAO;
    if (Object.keys(patch).length) {
        log('  ~ completar:', Object.keys(patch).join(', '));
        if (APPLY) await subsolo.ref.update(patch);
    } else log('  = nada a completar');
}

log('\n--- Sereni (existente) ---');
const sereni = geoPorNome.get('Sereni');
if (sereni && !(sereni.descricao || '').trim()) {
    log('  ~ preencher descrição (estava vazia)');
    if (APPLY) await sereni.ref.update({ descricao: SERENI_DESCRICAO });
} else log('  = descrição já preenchida — não toco');

log('\n--- Properties ---');
const propSnap = await colProp.get();
const propNomes = new Set(); propSnap.forEach(d => propNomes.add((d.data().nome || '').trim()));
for (const p of PROPS) {
    if (propNomes.has(p.nome)) { log('  = já existe:', p.nome); continue; }
    const { geoNome, ...campos } = p;
    const geo = geoPorNome.get(geoNome);
    const doc = { ...BASE_PROP, ...campos, localizacao: geoNome, geographyId: geo ? geo.ref.id : '' };
    log(`  + ${p.nome} (${p.tipo}) em ${geoNome}`);
    if (APPLY) await colProp.add(doc);
}

log('\n' + (APPLY ? '=== CONCLUÍDO ===' : 'Rode de novo com --apply para gravar.'));
process.exit(0);
