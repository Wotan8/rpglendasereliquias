/**
 * Totens do Xamã — vazios e com Eco.
 *
 * REGRA DE CÂNONE QUE MANDA NO DESENHO (capítulo Totemancia, Lei do Território):
 * totem comum NÃO sustenta um Eco fora do território dele; só a Madeira de
 * Antiqua serve de âncora permanente. Mas o mesmo capítulo define os Ecos
 * ANDARILHOS — "não possuem vínculo territorial… particularmente valiosos para
 * Xamãs viajantes". É por aí que um Xamã de estrada carrega Eco em totem
 * barato, sem quebrar a Lei.
 *
 * Daí as três famílias:
 *   VAZIO       — esperando consagração. Material muda durabilidade, não poder.
 *   COM ECO     — já consagrado. Andarilho anda junto; Ancestral só em casa.
 *   ANTIQUA     — o único que leva qualquer Eco a qualquer lugar. Fim de linha.
 *
 * Moeda (Livro §5): Luni 1 L$ · Ka'Luni 1.000 L$ · Mi'Luni 1.000.000 L$.
 * A Antiqua custa "100 Ka'luns a 1 Mi'lun" pelo cânone — 100.000 L$ na ponta
 * barata, e é assim que ela fica sendo objetivo de campanha e não item de loja.
 *
 * NENHUM NOME PRÓPRIO NOVO. Os Ecos são ofícios (lenhador, sentinela,
 * mensageira), não pessoas nomeadas — nomear morto é criar cânone.
 *
 *   node functions/cadastrar-totens.mjs            (dry-run)
 *   node functions/cadastrar-totens.mjs --apply
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');
const AUTOR = 'M2rZzlQkzxTrrddeFQ10S6zsfX62';
const MAO = '6r4QB7jnlln8WpehKzS4';

/* ── VAZIOS ── material muda o que aguenta, nunca o que entrega. */
const VAZIOS = [
    { nome: 'Totem Bruto de Madeira', preco: 40, peso: 0.4,
      desc: 'Galho de árvore velha, descascado e entalhado com o que se tinha à mão. Aceita consagração a um Eco. '
          + 'Racha se cair, queima se esquecer perto do fogo — mas qualquer xamã sabe fazer outro numa tarde.' },
    { nome: 'Totem de Osso Curtido', preco: 120, peso: 0.5,
      desc: 'Osso longo de bicho grande, curtido em fumaça e cinza. Aceita consagração a um Eco. '
          + 'Não queima e não apodrece; o Eco que mora nele costuma ficar mais falante, e ninguém sabe explicar por quê.' },
    { nome: 'Totem de Pedra do Leito', preco: 260, peso: 1.6,
      desc: 'Seixo tirado do fundo de rio corrente, onde a Essência Verde se deposita por décadas. Aceita consagração a um Eco. '
          + 'Aguenta água, fogo e queda. Pesa como pedra porque é pedra.' },
    { nome: 'Totem de Madeira de Antiqua', preco: 100000, peso: 0.3,
      desc: 'Lasca de uma árvore que muitos consideram lenda, esculpida em ritual e em noite de Véu fino. '
          + 'É o ÚNICO totem capaz de sustentar um Eco fora do território dele, em qualquer lugar do mundo, '
          + 'e comporta Ecos até o limite de Totemismo ÷ 2 (mínimo 1). Objetivo de uma vida, não compra de mercado.' },
];

/* ── COM ECO ── ficha do Eco no próprio item, para o Mestre copiar ao NPC.
   Andarilho = anda junto. Ancestral = só funciona no território dele. */
const COM_ECO = [
    { nome: 'Totem do Lenhador', preco: 900, peso: 0.5, vinculo: 'Andarilho',
      dadiva: 'Braço', estado: 'Sereno', pers: '1 · Sereno', disp: 9, prs: 1,
      pericia: 'Labuta 3',
      desc: 'Cabo de machado gasto até o veio, entalhado em forma de mão fechada. Um homem que derrubou árvore a vida inteira '
          + 'e morreu de velho no próprio catre — não tem pressa, não tem mágoa, e ainda sabe onde a madeira cede.' },
    { nome: 'Totem da Sentinela', preco: 900, peso: 0.4, vinculo: 'Andarilho',
      dadiva: 'Olho', estado: 'Inquieto', pers: '2 · Zeloso', disp: 7, prs: 2,
      pericia: 'Observação 3',
      desc: 'Ponta de lança quebrada, amarrada com tira de couro a um cabo curto. Morreu no turno dela, de olho aberto, '
          + 'e cobra do xamã a mesma disciplina que cobrava de si. Quer saber quem está de guarda antes de responder qualquer coisa.' },
    { nome: 'Totem do Velho Urso', preco: 1100, peso: 1.2, vinculo: 'Andarilho',
      dadiva: 'Pele', estado: 'Sereno', pers: '6 · Silente', disp: 7, prs: 2,
      pericia: 'Sobrevivência 3',
      desc: 'Crânio de urso pequeno, com as órbitas preenchidas de resina. Não fala: responde em imagens de frio, de fome e de '
          + 'invernos que acabaram. Aguenta ser ferido por muito tempo antes de achar que já chega.' },
    { nome: 'Totem da Mensageira', preco: 900, peso: 0.3, vinculo: 'Andarilho',
      dadiva: 'Passo', estado: 'Inquieto', pers: '3 · Curioso', disp: 8, prs: 2,
      pericia: 'Atletismo 3',
      desc: 'Sandália de corda petrificada pelo tempo, montada num cabo de junco. Passou a vida levando recado de aldeia em aldeia '
          + 'e morreu no meio de uma entrega. Pergunta mais do que responde, e ainda quer saber como termina cada história.' },
    { nome: 'Totem do Pregoeiro', preco: 900, peso: 0.4, vinculo: 'Andarilho',
      dadiva: 'Boca', estado: 'Sereno', pers: '5 · Orgulhoso', disp: 7, prs: 2,
      pericia: 'Performance 3',
      desc: 'Sino rachado de feira, sem badalo, preso a um punho de madeira polida pelo uso. Anunciou preço e sentença por quarenta anos '
          + 'e não aprendeu a falar baixo. Empresta a voz de bom grado — e a paciência, nunca.' },
    { nome: 'Totem do Enforcado', preco: 1600, peso: 0.5, vinculo: 'Andarilho',
      dadiva: 'Braço', estado: 'Furioso', pers: '10 · Rancoroso', disp: 2, prs: 4, mascara: true,
      pericia: 'Intimidação 5',
      desc: 'Nó de corda endurecido, engastado num toco de forca. Atende ao chamado com uma cordialidade que não é dele — '
          + 'e testa Supressão ao fim de cada cena. Empresta mais do que qualquer Eco sereno, e é exatamente por isso que está à venda barato.' },
];

/* ═══ ASSERTS ═══ */
const nomes = [...VAZIOS, ...COM_ECO].map(t => t.nome);
assert.equal(new Set(nomes).size, nomes.length, 'nome repetido');
assert.ok(VAZIOS.every((t, i) => i === 0 || t.preco > VAZIOS[i - 1].preco), 'vazios em escada de preço');
const antiqua = VAZIOS.at(-1);
assert.ok(antiqua.preco >= 100000, 'a Antiqua custa ao menos 100 Ka\'Luni (cânone)');
assert.ok(/ÚNICO totem capaz de sustentar um Eco fora do território/.test(antiqua.desc), 'a Lei do Território tem que estar escrita nela');
assert.ok(COM_ECO.every(t => t.vinculo === 'Andarilho'),
    'Eco preso a território não anda em totem comum — só Andarilho, ou seria quebrar a Lei');
/* O perigoso tem que entregar mais: é a Lei da Reciprocidade em número. */
const mau = COM_ECO.find(t => t.estado === 'Furioso');
assert.ok(Number(mau.pericia.match(/\d+/)[0]) > 3, 'o Eco hostil empresta mais que os serenos');
assert.ok(mau.disp < 5 && mau.prs > 2, 'e é mais difícil de segurar');
console.log(`✅ ${6} asserts.\n`);

const col = db.collection('system/data/equipment');
const eq = (await col.get()).docs.map(d => d.data());
const colisao = nomes.filter(n => eq.some(e => e.nome === n));

console.log('=== Totens ===\n');
console.log('VAZIOS — esperando consagração:');
for (const t of VAZIOS) console.log(`  ${t.nome.padEnd(30)} ${String(t.preco).padStart(7)} L$  ${t.peso}kg`);
console.log('\nCOM ECO — Andarilhos, andam com o Xamã:');
console.log('  totem                     Dádiva  Estado     Personalidade    Disp  PRS  empresta        preço');
for (const t of COM_ECO)
    console.log(`  ${t.nome.padEnd(25)} ${t.dadiva.padEnd(7)} ${t.estado.padEnd(10)} ${t.pers.padEnd(16)} ${String(t.disp).padStart(3)}  ${String(t.prs).padStart(3)}  ${t.pericia.padEnd(15)} ${t.preco}${t.mascara ? '  🎭' : ''}`);
if (colisao.length) { console.error(`\n🔴 ABORTADO: já existem: ${colisao.join(', ')}`); process.exit(1); }
console.log(`\n  ${nomes.length} itens novos. O "Totem Pessoal Entalhado" (Inicial) continua sendo o de partida.`);
if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

const agora = admin.firestore.Timestamp.now();
const base = { tipo: 'Objeto', formaEquipar: 'empunhar', equipavelEm: [MAO],
    categoriaArma: null, pressaoBase: null, multiplicadorPressao: null, quantidade: null,
    ehContainer: false, capacidadeContainer: null, pesoMaximoContainer: null,
    mecanicaIds: [], imagemUrl: '', publicado: true, versao: 1,
    criadoPor: AUTOR, criadoEm: agora, atualizadoEm: agora };
const batch = db.batch();
for (const t of VAZIOS) batch.set(col.doc(), { ...base, nome: t.nome, descricao: t.desc,
    peso: t.peso, tamanho: t.peso, preco: t.preco,
    tags: ['Totem', 'Xamã', 'Vazio', ...(t.preco >= 100000 ? ['Antiqua'] : [])] });
for (const t of COM_ECO) batch.set(col.doc(), { ...base, nome: t.nome,
    descricao: `${t.desc}\n\nECO VINCULADO (${t.vinculo}) — Dádiva ${t.dadiva} · Estado ${t.estado} · Personalidade ${t.pers} · `
        + `Disposição ${t.disp}${t.mascara ? ' (usa MÁSCARA — o que ele mostra não é o que sente)' : ''} · PRS ${t.prs} · empresta ${t.pericia}. `
        + `Dispensa Buscar Vestígio: o Eco já está aqui.`,
    peso: t.peso, tamanho: t.peso, preco: t.preco,
    tags: ['Totem', 'Xamã', 'Com Eco', t.dadiva, t.vinculo] });
await batch.commit();
console.log(`\n✅ ${nomes.length} totens cadastrados.`);
process.exit(0);
