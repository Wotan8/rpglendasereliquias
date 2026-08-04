/**
 * Frentes novas da Mesa 1 "Grau Espectro" + patch nas duas que já existem.
 *
 * REGRA DE RITMO (definida pelo mestre): 1 fatia ≈ 1 sessão.
 * Toda escada abaixo foi dimensionada por isso — o número de fatias é
 * literalmente "quantas sessões até o desastre", e `cheias` inicial é
 * "quantas sessões disso já passaram".
 *
 * Fontes (nada inventado; ver PENDENTE onde a escada é estrutura minha):
 *  - Sessão47/O Céu Ficou Parado.pdf   → família do Thalion (Paloma/Sabrini/Guilion)
 *  - Sessão47/Eu Cedi.pdf              → Onéria caiu, legiões Famo se aproximam a cada ciclo
 *  - Sessão47/Guia_do_Mestre_..._Dois_Fios.docx → Sussurro (−1 SAN/dia, sem bainha), Morik, Ibirá
 *  - Sessão47/Consequencias_Pendentes.docx      → relógio da Ina
 *  - char/char_1783854635897_2g8e9t (ficha da Sona) → Agatha, medo de perder o controle
 *  - Linha_do_Tempo_Sessoes.md (S39/S41) → a Onça
 *
 *   node functions/cadastrar-frentes-mesa1.mjs           (dry-run)
 *   node functions/cadastrar-frentes-mesa1.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');
const MESA_ID = '7MQKtOpcMt8DCH7r97Fb';
const FONTE = 'Frentes abertas em 01/08/2026 (preparo da Sessão 47)';

/* ============================ FRENTES NOVAS ============================ */
const NOVAS = [
    {
        nome: 'O Sussurro Final',
        tipo: 'ameaca',
        perigo: 'A adaga não entra em bainha e custa Sanidade por dia de posse. Ela não quer ser carregada — quer escolher quem carrega. O relógio começa a andar na sessão em que alguém a pegar, e mede o portador, não a lâmina. Gancho pessoal da Sona: o medo declarado na ficha dela é exatamente este (perder o controle perto de alguém importante), e a regra que ela mesma escreveu foi "aprender sobre relíquias, pois uma hora eu posso acabar com uma maldição incurável nas mãos".',
        relogio: { fatias: 6, cheias: 0 },
        pressagios: [
            { texto: 'O portador não solta sem passar num teste. Os sussurros só vêm quando ele dorme.', quando: 1, ocorrido: false },
            { texto: 'Sussurros em vigília, e quem dorme a menos de 3m também ouve. A voz é de alguém que o portador enterrou — se for a Sona, é a Agatha.', quando: 2, ocorrido: false },
            { texto: 'O custo dobra: −2 Sanidade por dia. O portador acorda com a adaga na mão sem lembrar de tê-la pegado.', quando: 3, ocorrido: false },
            { texto: 'A adaga recusa a troca de dono — quem tenta passar adiante precisa rolar para conseguir.', quando: 4, ocorrido: false },
            { texto: 'Um aliado leva dano do portador sem que o jogador tenha declarado ataque nenhum.', quando: 5, ocorrido: false },
            { texto: 'A adaga escolhe outro. O portador anterior a quer de volta e não admite por quê.', quando: 6, ocorrido: false },
        ],
        rostosNomes: ['Thalion Vassek'],
    },
    {
        nome: 'O Encargo de Ibirá',
        tipo: 'ameaca',
        // 2/4 porque a S45 (a encomenda) e a S46 (a noite de Velmora) já queimaram duas fatias.
        perigo: 'Ibirá encomendou pessoalmente o roubo da adaga que mata deuses e não explicou por quê. O guia da 47 já trata a espera dele como relógio ("o deus espera uma semana"). Cada fatia é uma sessão sem entrega. As duas leituras possíveis do porquê estão ambas no conto "Tão Frágil Sereni": a maldição da Sereni ("você vai pagar primeiro com a reputação, depois com a vida") e o medo declarado dele ("nem mesmo um deus está a salvo da vergonha que criou"). Ou ele quer a adaga para que ninguém mais a tenha, ou ele quer terminar o serviço com as próprias mãos. ESCOLHER antes da fatia 4.',
        relogio: { fatias: 4, cheias: 2 },
        pressagios: [
            { texto: 'Ibirá vem cobrar. Não pede audiência, não manda recado — aparece.', quando: 3, ocorrido: false },
            { texto: 'Ele para de esperar e vai buscar a adaga onde ela estiver, passando por quem estiver no caminho.', quando: 4, ocorrido: false },
        ],
        rostosNomes: ['Ibirá'],
    },
    {
        nome: 'O Viúvo — Morik Varn',
        tipo: 'faccao',
        // 1/4: ele já saiu da vila (S36) e já está na estrada com o Azul. O relógio não começa do zero.
        perigo: 'Morik quer o mesmo que Thalion quis e abandonou: matar Ibirá pela esposa, Sereni. Ele tem o Azul e trinta anos de espera. Se o grupo não fechar com ele, ele vai sozinho — e morre tentando, levando junto o Azul e tudo que sabe sobre como ferir o deus. O desfecho do Fio A mexe direto neste relógio: matar o Fontrix tira uma perna do plano dele e adianta uma fatia.',
        relogio: { fatias: 4, cheias: 1 },
        pressagios: [
            { texto: 'Ele para de oferecer ajuda. Fontrix e Albrix somem de cena e não respondem mais.', quando: 2, ocorrido: false },
            { texto: 'Ele vai sozinho e gasta o Azul que sobrou. Ninguém sabe para onde.', quando: 3, ocorrido: false },
            { texto: 'Morik morre tentando. O grupo perde o Azul, a receita e o único homem que estudou Ibirá por trinta anos — e, porque é ele quem segura os acordos com o império Famo, Sereni fica sem cobertura. É AQUI que se abre a frente "As Legiões Famo".', quando: 4, ocorrido: false },
        ],
        rostosNomes: ['Morik Varn, o Ancião', 'Fontrix Olho-de-Corvo', 'Albrix Muro-de-Ferro'],
    },
];

/* As Legiões Famo NÃO entram aqui. Morik tem acordos com o império; enquanto ele
 * está no posto, a frente não existe. Ela nasce no momento em que ele sai — ou seja,
 * é a fatia 4 d'O Viúvo que a abre. Escrever só quando isso acontecer. */

/* ================= PATCH NAS FRENTES QUE JÁ EXISTEM ================= */
const PATCHES = {
    'A Onça': {
        // Tinha 6 fatias e 0 presságios — relógio sem escada. A morte cai na fatia 4,
        // conforme o mestre: "se não resolverem, ela vai matar pessoas em algumas sessões".
        pressagios: [
            { texto: 'Rastro fresco no caminho do grupo. Um animal de carga some durante a noite.', quando: 1, ocorrido: false },
            { texto: 'Um animal grande morto e não comido. Ela não está caçando por fome.', quando: 2, ocorrido: false },
            { texto: 'Ela aparece a 30m e não ataca — observa e sai. Quem cruza o olhar dela perde 1 Sanidade.', quando: 3, ocorrido: false },
            { texto: 'Ela mata. Um NPC nomeado da vila ou da estrada, do mesmo jeito que matou a Arternix.', quando: 4, ocorrido: false },
            { texto: 'O contrato vira leilão: Morik e a guilda do Carinha do Gelo sobem o valor e a mata enche de caçador armado.', quando: 5, ocorrido: false },
            { texto: 'Ela escolhe o grupo. Passa a seguir, e ataca quando um deles estiver sozinho.', quando: 6, ocorrido: false },
        ],
    },
    'A Dívida com Ina': {
        // Os Vigias morreram na S46 e a colheita da 46 nunca rodou no sistema.
        // Pela regra de 1 fatia/sessão, na 47 este relógio já está em 1/4.
        relogio: { fatias: 4, cheias: 1 },
        perigo: 'Ina Nó-de-Pedra descobre quem matou os dois Vigias de elite dela em Velmora e reage — matar pessoal contratado é dano direto a ela, não brecha jurídica. GANCHO DA NURA: o desastre desta frente ("Não quebrou lei. Não será recebido.") é a infância dela virada em mecânica — na vila onde cresceu, os outros pais não deixavam as crianças brincarem com ela por causa da raça, até ela desistir e virar arredia. Ela é quem reconhece a marca antes de todo mundo, e é quem tem a caixa de ferramentas para operar um Submundo de portas fechadas: aprendeu a se esconder muito bem justamente por ser a excluída da vila.',
    },
};

/* ============================ EXECUÇÃO ============================ */
const log = (...a) => console.log(...a);

const npcSnap = await db.collection('npcs').get();
const porNome = new Map();
npcSnap.forEach(d => porNome.set((d.data().nome || '').trim(), d.id));

log(APPLY ? '=== APLICANDO ===' : '=== DRY-RUN (nada será gravado) ===');
log('Mesa:', MESA_ID, '· regra de ritmo: 1 fatia ≈ 1 sessão\n');

const col = db.collection('mesas').doc(MESA_ID).collection('frentes');
const atuais = await col.get();
const porNomeFrente = new Map();
atuais.forEach(d => porNomeFrente.set(d.data().nome, { id: d.id, ...d.data() }));

log('--- 1. Frentes novas ---');
let criadas = 0;
for (const f of NOVAS) {
    if (porNomeFrente.has(f.nome)) { log('  = já existe:', f.nome); continue; }
    const rostos = f.rostosNomes.map(n => porNome.get(n)).filter(Boolean);
    const faltando = f.rostosNomes.filter(n => !porNome.get(n));
    log(`  + ${f.nome} — ${f.relogio.cheias}/${f.relogio.fatias} fatias, ${f.pressagios.length} presságio(s), ${rostos.length} rosto(s)${faltando.length ? '  ⚠ sem NPC no banco: ' + faltando.join(', ') : ''}`);
    criadas++;
    if (APPLY) await col.add({
        nome: f.nome, tipo: f.tipo, perigo: f.perigo, status: 'ativa',
        relogio: f.relogio, pressagios: f.pressagios, rostos,
        historico: [], createdAt: Date.now(), fonte: FONTE,
    });
}

log('\n--- 2. Patches nas existentes ---');
let patched = 0;
for (const [nome, patch] of Object.entries(PATCHES)) {
    const atual = porNomeFrente.get(nome);
    if (!atual) { log('  ⚠ não encontrada:', nome); continue; }
    const campos = Object.keys(patch).filter(k =>
        JSON.stringify(atual[k]) !== JSON.stringify(patch[k]));
    if (!campos.length) { log('  = já está assim:', nome); continue; }
    log(`  ~ ${nome} — ${campos.map(c => c === 'relogio'
        ? `relógio ${atual.relogio.cheias}/${atual.relogio.fatias} → ${patch.relogio.cheias}/${patch.relogio.fatias}`
        : `${c}: ${(atual[c] || []).length} → ${patch[c].length}`).join(' · ')}`);
    patched++;
    if (APPLY) await col.doc(atual.id).update(patch);
}

log('\n=== RESUMO ===');
log(` Novas: ${criadas} · Patches: ${patched} · Total de frentes ativas depois: ${atuais.size + criadas}`);
if (!APPLY) log('\n Rode de novo com --apply para gravar.');
process.exit(0);
