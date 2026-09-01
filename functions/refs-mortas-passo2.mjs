/**
 * Refs mortas — passo 2: as oito que sobraram.
 *
 * Decisões do usuário em 01/09/2026:
 *
 *  A. Faísca → **Eletrocutado**, nas três criaturas elétricas. Buff aceito de
 *     propósito, e os carimbos sobem junto.
 *     Nível: **1**. O texto original não declarava nível nenhum, e N=1 é o
 *     mínimo fiel — e é também o único N sem Descarga (ela é N−1, logo 0).
 *     N=2 liga a Descarga no aliado adjacente e quase dobra o preço; fica
 *     como opção declarada no relatório, não como escolha minha.
 *
 *  B. Papa-Noite **não tem peçonha**. "Envenenar 1" sai. Ele come e drena
 *     magia, e usar magia contra ele só o fortalece. A garra passa a aplicar
 *     **Drenado** — que é exatamente "perde N de um recurso (Energia, Graça,
 *     Harmonia) e não o recupera até o fim da cena", já no catálogo.
 *
 *  C. As cinco de uma ficha só viram condição de verdade. Cada uma é escrita
 *     EXATAMENTE com a regra que já estava inline na ficha — nenhuma ganhou
 *     efeito novo, nenhuma perdeu:
 *
 *       Infecção             Ratazana      VIG Alvo 3 ou 1 VIT por HORA até tratar
 *       Náusea               Rei-Coveiro   não corre até o fim do turno seguinte
 *       Veneno Cristalizante Vidrela       2 dano/rodada por 3 rodadas, −1 Deslocamento
 *       Dilacerar            Górbal        a peça atingida perde 1 de Blindagem
 *       Dreno de Luz         Apaga-Lume    apaga a chama mais próxima do alvo
 *
 *     Duas delas (Infecção e Dreno de Luz) valem **0,00 un na economia de
 *     combate** e pertencem à economia de cena (Régua §3.3): uma cobra por
 *     hora, a outra apaga uma tocha. Isso está declarado dentro delas.
 *
 *   node functions/refs-mortas-passo2.mjs            (dry-run)
 *   node functions/refs-mortas-passo2.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');
const AUTOR = 'igorestevamalvesdesouza@gmail.com';
const CRIADOR = 'M2rZzlQkzxTrrddeFQ10S6zsfX62';
const U = 3.90, DANO = 0.290, BLD_REF = 2;

const br = (x, c = 2) => x.toFixed(c).replace('.', ',');
const medio = d => { const m = /(\d+)d(\d+)/.exec(String(d)); return m ? Number(m[1]) * (Number(m[2]) + 1) / 2 : NaN; };
const GRAUS = [[0.15, 'Inofensiva'], [0.35, 'Praga'], [0.75, 'Comum'], [1.5, 'Séria'], [3.0, 'Grave']];
const grauDe = x => (GRAUS.find(([t]) => x < t) || [null, 'Calamidade'])[1];
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

/* ═════════ C. as cinco condições novas ═════════ */
const NOVAS = [
{
    nome: 'Infecção', icone: '🦠', duracao: 'até ser tratada', removivel: true,
    acumulaNiveis: false, afetaTabuleiro: true,
    descricao:
`A mordida sujou a ferida. Não é o golpe que mata — é o que ficou nele.

· ao ser aplicada, o alvo testa **VIG contra Alvo 3**; passando, nada acontece;
· falhando, perde **1 de Vitalidade por HORA** até ser tratada;
· sai com **Perícia: Anatomia** e tempo, com cura mágica, ou com uma loção de **Caltra**;
· o Descanso Longo **não** resolve sozinho — dormir com infecção é acordar pior.

**Vale 0,00 un na economia de combate.** A unidade é a HORA, não a rodada: numa luta de cinco rodadas ela não tira nada de ninguém. Pertence à economia de cena (Régua §3.3), e é ali que ela morde — na viagem, no acampamento, no dia seguinte.

É a diferença entre ser mordido e ser mordido por algo que vive em esgoto.`,
},
{
    nome: 'Náusea', icone: '🤮', duracao: 'até o fim do turno seguinte', removivel: false,
    acumulaNiveis: false, afetaTabuleiro: true,
    descricao:
`O estômago virou. Dá para andar; não dá para correr.

· o alvo **não pode correr** até o fim do turno seguinte — a Ação de Movimento anda, mas não dobra;
· não impede atacar, defender nem usar a Reação.

Vale cerca de **0,10 un/rodada**, a mesma faixa do **Lento** — e é menos que ele, porque o Lento corta o Deslocamento pela metade e ainda tira 2 de Iniciativa. A Náusea só proíbe a corrida.

Pequena de propósito: o valor dela não é o número, é o alvo que queria fugir e vai ter que ir devagar.`,
},
{
    nome: 'Veneno Cristalizante', icone: '💎', duracao: '3 rodadas', removivel: true,
    acumulaNiveis: false, afetaTabuleiro: true,
    descricao:
`A peçonha endurece o que toca. O sangue engrossa, a junta trava.

· **2 de dano por rodada, durante 3 rodadas**, no fim do turno do alvo;
· enquanto durar, o alvo tem **−1 de Deslocamento**;
· sai com loção de **Caltra**, com cura mágica, ou quando as 3 rodadas passam.

**Vale ~0,63 un/rodada** — 0,58 do dano (2 × ${br(DANO, 3)}) mais uma fração pelo Deslocamento. Total de ~1,88 un pela duração inteira.

**Não é Toxis nem Peçonha.** O Toxis é o que a bancada macera e o que acaba na cena; a Peçonha é o que não passa sem Caltra do nível certo. Este aqui tem duração fixa e curta e cobra mobilidade junto — é veneno de emboscadora, feito para o alvo não sair de onde caiu.`,
},
{
    nome: 'Dilacerar', icone: '🛡️', duracao: 'até a peça ser consertada', removivel: true,
    acumulaNiveis: true, nivelMaximo: 5, afetaTabuleiro: true,
    descricao:
`Não fere o corpo: come a armadura.

· a **peça atingida** perde **N de Blindagem**;
· **acumula** na mesma peça, até que ela não proteja mais nada;
· **não sai com cura, descanso nem tempo** — só consertando a peça, com ferramenta e quem saiba;
· o alvo não sente nada. É o equipamento que está morrendo.

**Vale ${br(0.154, 3)} un/rodada por nível** — o espelho exato do **Blindado**, que compra +1 de Blindagem pela mesma taxa. O que faz esta condição valer mais que o número é a duração: ela atravessa a cena, a noite e a viagem, e cobra dinheiro em vez de Vitalidade.

Diferente do **Exposto**, que tira Defesa e passa. Este tira Blindagem e fica.`,
},
{
    nome: 'Dreno de Luz', icone: '🕯️', duracao: 'instantâneo', removivel: false,
    acumulaNiveis: false, afetaTabuleiro: true,
    descricao:
`A chama mais próxima do alvo apaga. Tocha, lampião ou vela — a que estiver mais perto.

· apaga **uma** fonte de chama por aplicação;
· não afeta luz de Essência nem fogueira grande;
· reacender custa o que sempre custou: uma Ação e o que estiver na mochila.

**Vale 0,00 un na economia de combate**, e é o efeito mais perigoso desta lista mesmo assim. Pertence à economia de cena (Régua §3.3): o que ele compra não é dano, é o escuro — e o escuro é onde a criatura que apaga a luz ganha o que ela ganha no escuro.

Contra a Apaga-Lume, apagar a tocha devolve a Absorção dela. A condição não machuca ninguém; ela desliga o contra-jogo.`,
},
];

/* ═════════ leitura ═════════ */
const grab = async c => (await db.collection(c).get()).docs;
const [condDocs, npcDocs] = await Promise.all([grab('system/data/conditions'), grab('npcs')]);
const condNomes = condDocs.map(d => d.data().nome);
const erros = [];
for (const n of NOVAS) if (condNomes.some(c => norm(c) === norm(n.nome)))
    erros.push(`condição "${n.nome}" já existe`);
for (const alvo of ['Eletrocutado', 'Drenado']) if (!condNomes.includes(alvo))
    erros.push(`condição-destino "${alvo}" não existe`);

const npcs = npcDocs.map(d => ({ id: d.id, ...d.data() }));
const patches = [];

/* ═════════ A. Faísca → Eletrocutado 1, e recarimbo ═════════ */
const N_ELETRO = 1;
/* Eletrocutado N contra o defensor de referência (Blindagem 2):
   dano = N + metade da Blindagem = N+1, e a Blindagem não reduz.  */
const valorEletro = N => (N + Math.floor(BLD_REF / 2)) * DANO + 0.320 + (N >= 2 ? (N - 1) * DANO : 0);
const ELETRO = valorEletro(N_ELETRO);
const ELETRO2 = valorEletro(2);

/* o que cada rider vale por rodada, para o recarimbo */
const RIDER = {
    'Prostrado': () => 0.47, 'Amedrontado': () => 0.17,
    'Hemorragia': n => 0.29 * (n || 1), 'Eletrocutado': n => valorEletro(n || 1),
    'Necrose': n => (1 / U) * (n || 1), 'Peçonha': n => 1.16 * (n || 1),
    'Veneno Cristalizante': () => 0.63, 'Dilacerar': n => 0.154 * (n || 1),
    'Náusea': () => 0.10, 'Infecção': () => 0, 'Dreno de Luz': () => 0,
};
const forcaDaFicha = atq => {
    let melhor = 0, detalhe = null;
    for (const l of String(atq).split('\n')) {
        const g = /Alvo (\d+)[^,]*, (\d+d\d+)(?:\+(\d+))?/.exec(l);
        if (!g) continue;
        const P = Math.max(0, Math.min((Math.min(+g[1], 9) - 1) / 10, 0.9));
        const golpe = P * Math.max(1, medio(g[2]) + (g[3] ? +g[3] : 0) - 2) / U;
        let rider = 0, quais = [];
        for (const [nome, f] of Object.entries(RIDER)) {
            const m = new RegExp(`\\b${nome}\\b(?:\\s+(\\d+))?`).exec(l);
            if (!m) continue;
            const v = f(m[1] ? +m[1] : null) * P;
            rider += v; quais.push(`${nome}${m[1] ? ' ' + m[1] : ''}`);
        }
        if (golpe + rider > melhor) { melhor = golpe + rider; detalhe = { linha: l.trim(), golpe, rider, quais }; }
    }
    return { forca: melhor, detalhe };
};

for (const nome of ['Nímbara', 'Nímbaro', 'Fúlgora']) {
    const n = npcs.find(x => x.nome === nome);
    if (!n) { erros.push(`"${nome}" não achado`); continue; }
    const atq = String(n.ataques || '');
    if (!/\bFaísca\b/.test(atq)) { erros.push(`"${nome}": não achei "Faísca" em ataques`); continue; }
    const depois = atq.replace(/e Faísca — o alvo perde a Reação até o fim do turno dele\./,
        `e Eletrocutado ${N_ELETRO}.`);
    if (depois === atq) { erros.push(`"${nome}": o texto da Faísca não bate com o esperado`); continue; }
    const antesF = forcaDaFicha(atq), depoisF = forcaDaFicha(depois);
    const am = String(n.criatura?.nivelAmeaca || '');
    const carimboAntes = (/(\d+,\d+)×/.exec(am) || [])[1];
    const grauNovo = grauDe(depoisF.forca);
    const amNovo = am.replace(/^[^·]+·\s*\d+,\d+×/, `${grauNovo} · ${br(depoisF.forca)}×`);
    patches.push({ nome, ref: db.collection('npcs').doc(n.id), tipo: 'eletro',
        campos: { ataques: depois, 'criatura.nivelAmeaca': amNovo },
        atqAntes: atq, atqDepois: depois, carimboAntes, forcaNova: depoisF.forca,
        grauAntes: carimboAntes ? grauDe(Number(carimboAntes.replace(',', '.'))) : '—', grauNovo,
        detalhe: depoisF.detalhe, amAntes: am, amNovo });
}

/* ═════════ B. Papa-Noite ═════════ */
const pn = npcs.find(x => x.nome === 'Papa-Noite');
if (!pn) erros.push('"Papa-Noite" não achado');
else {
    const atq = String(pn.ataques || '');
    const de = 'Garras Noturnas (A. Padrão): Alvo 9, 2d6+4 e Envenenar 1.';
    const para = 'Garras Noturnas (A. Padrão): Alvo 9, 2d6+4 e Drenado 1 — a garra tira Energia, não sangue.';
    if (!atq.includes(de)) erros.push(`"Papa-Noite": não achei "${de}"`);
    else {
        const linhaMagia = 'MAGIA NÃO FUNCIONA CONTRA ELE: o dano de Essência que ele receberia vira alimento — ele não sofre nada e recupera esse tanto de Vitalidade. Conjurador que insiste está alimentando o que veio matar.';
        let depois = atq.replace(de, para);
        if (!depois.includes('MAGIA NÃO FUNCIONA')) depois = depois.trimEnd() + '\n' + linhaMagia;
        patches.push({ nome: 'Papa-Noite', ref: db.collection('npcs').doc(pn.id), tipo: 'papanoite',
            campos: { ataques: depois }, atqAntes: atq, atqDepois: depois });
    }
}

/* ═════════ relatório ═════════ */
console.log('\n══════════ C. As cinco condições novas ══════════');
for (const n of NOVAS) console.log(`\n${n.icone}  ${n.nome}   (${n.duracao}${n.acumulaNiveis ? `, acumula até ${n.nivelMaximo}` : ''})\n` +
    n.descricao.split('\n').map(s => '   ' + s).join('\n'));

console.log('\n\n══════════ A. Faísca → Eletrocutado ══════════');
console.log(`   Eletrocutado ${N_ELETRO} contra o defensor de referência (Blindagem ${BLD_REF}):`);
console.log(`     dano ${N_ELETRO}+${Math.floor(BLD_REF / 2)} = ${N_ELETRO + 1}, e a Blindagem não reduz  →  ${br((N_ELETRO + 1) * DANO)} un`);
console.log(`     + 0,32 un por não poder usar a Reação  →  TOTAL ${br(ELETRO)} un/rodada`);
console.log(`     Descarga não dispara em N=1 (ela é N−1). Em N=2 valeria ${br(ELETRO2)} un — quase o dobro.\n`);
console.log('ficha        de                       para                       carimbo             linha que manda');
for (const p of patches.filter(p => p.tipo === 'eletro')) {
    console.log(`\n${p.nome}`);
    console.log(`   de:   ${p.atqAntes.split('\n')[0]}`);
    console.log(`   para: ${p.atqDepois.split('\n')[0]}`);
    console.log(`   carimbo: ${p.carimboAntes}× ${p.grauAntes}  →  ${br(p.forcaNova)}× ${p.grauNovo}${p.grauAntes !== p.grauNovo ? '   ⚠ SOBE DE GRAU' : ''}`);
    console.log(`   manda:   ${p.detalhe.linha.slice(0, 88)}`);
    console.log(`            golpe ${br(p.detalhe.golpe)} + riders ${br(p.detalhe.rider)} [${p.detalhe.quais.join(', ')}]`);
}

console.log('\n\n══════════ B. Papa-Noite ══════════');
const ppn = patches.find(p => p.tipo === 'papanoite');
if (ppn) {
    console.log('   de:\n' + ppn.atqAntes.split('\n').map(s => '      ' + s).join('\n'));
    console.log('\n   para:\n' + ppn.atqDepois.split('\n').map(s => '      ' + s).join('\n'));
    console.log(`
   ⚠ DUAS COISAS PARA VOCÊ OLHAR:
     · "fortalece" eu li como CURA (o dano vira Vitalidade). Se for buff de
       atributo ou de Alvo em vez de cura, é uma linha para trocar.
     · a ficha dele diz, em rolePlay.historia, "imune a danos físicos". Com
       magia também não funcionando, ele fica sem nenhuma via de dano. Não
       toquei nisso — mas as duas frases juntas o tornam imortal.`);
}

if (erros.length) { console.log('\n❌ ERROS — nada foi gravado:'); erros.forEach(e => console.log('   ' + e)); process.exit(1); }
console.log('\n✅ conferências OK.');

if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

const agora = admin.firestore.Timestamp.now();
const iso = new Date().toISOString();
const batch = db.batch();
for (const n of NOVAS) batch.set(db.collection('system/data/conditions').doc(), {
    ...n, publicado: true, efeitoMecanicaIds: [], versao: 1,
    criadoPor: CRIADOR, criadoEm: agora, atualizadoEm: agora });
for (const p of patches) batch.update(p.ref, { ...p.campos, lastUpdate: iso, lastUpdateBy: AUTOR });
await batch.commit();
console.log(`\n✅ ${NOVAS.length} condições criadas e ${patches.length} fichas atualizadas.`);
process.exit(0);
