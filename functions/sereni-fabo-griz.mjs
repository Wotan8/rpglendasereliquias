/**
 * Fabo Griz — a ficha estava inteiramente vazia: nove atributos em zero, sem
 * altura, sem perícia, sem papel. Só o nome e a tag "Vendedor no Mercado Griz".
 *
 * O que existia no banco e eu respeitei:
 *   · nome, local Sereni, mesaId, e a tag do Mercado Griz;
 *   · a régua v3 (Alvo = FOR max DES + perícia · dano = dado do catálogo + FOR);
 *   · a escada de perícia por papel da passada 4 — mercador estabelecido = Arma 1;
 *   · o formato de ficha do Rorek Pic, o outro mercador do mercado.
 *
 * TUDO O MAIS É INVENÇÃO MINHA e está aqui para você aprovar ou riscar:
 * atributos, altura, perícias, personalidade, o caderno, e as três relações.
 *
 * A ideia por trás dele: o Rorek vende bugiganga e mente. O Fabo vende
 * equipamento de verdade e não mente — e é justamente por isso que ele é o
 * primeiro a saber quem não voltou, porque foi ele quem vendeu a corda.
 *
 *   node functions/sereni-fabo-griz.mjs            (dry-run)
 *   node functions/sereni-fabo-griz.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');
const AUTOR = 'igorestevamalvesdesouza@gmail.com';
const ALTURA_VD = 'XPv2i5GhoHfz2QSH3pCl', U = 3.90;

const ALTURA = 1.68;
const ATRIB = { INT: 3, RAC: 3, PRS: 2, FOR: 2, DES: 2, VIG: 2, PRE: 3, MAN: 3, AUT: 3 };
const PERICIAS = { 'Barganha': 3, 'Observação': 3, 'Erudição': 2, 'Diplomacia': 2, 'Labuta': 2, 'Empatia': 1, 'Arma': 1 };

const ROLEPLAY = {
    personalidade: [
        'Honesto por cálculo — freguês que volta vale mais que freguês tosquiado',
        'Sabe o preço de tudo e o peso de tudo, e diz os dois sem que perguntem',
        'Nunca saiu de Sereni; vende a vida que não viveu',
    ],
    trejeitos: 'Pesa a mercadoria na mão antes de dizer o preço, sempre. Corrige a postura da mochila nas '
        + 'costas do freguês antes de deixar ele sair. Chama todo aventureiro de "moço" ou "moça", '
        + 'independente da idade. Anota tudo. Quando não gosta de uma pergunta, responde falando de corda.',
    motivacao: 'Manter a loja de pé e a reputação limpa numa vila onde a banca do lado vende falsificação. '
        + 'E — isto ele não diz — que a conta do caderno pare de crescer.',
    segredos: 'O CADERNO. Fabo anota nome, data, o que levou e quanto pagou. E anota também quando o freguês '
        + 'volta. Trinta e um nomes estão sem a segunda anotação, quase todos da época da Ruína de Ibirá. '
        + 'Ele é a única pessoa em Sereni que sabe o número exato, e não conta a ninguém: freguês que sabe '
        + 'a conta não compra corda.\n\nParte do estoque de segunda mão é espólio — equipamento que ele '
        + 'vendeu novo e recomprou da Guilda depois. Ele reconhece cada peça e nunca comenta.',
    relacoes: {
        aliado: 'Darin dos Ecos — a Guilda manda freguês e lhe vende o espólio de quem não voltou. '
            + 'Os dois nunca falaram sobre o que isso significa.',
        rival: 'Rorek Pic — a banca de bugiganga ao lado. Não é inveja: cada falsificação vendida no '
            + 'Mercado Griz custa a confiança de todo mundo que vende ali, inclusive dele.',
        devedor: 'Aventureiros que compram fiado antes de descer. Ele aceita, e é por isso que o caderno dói.',
    },
    frases: '"Corda boa é a que você não lembra de ter comprado."\n'
        + '"Leva a de vinte metros. A de dez sempre falta três."\n'
        + '"Pergaminho em branco eu garanto. Pergaminho escrito, quem garante é quem escreveu."\n'
        + '"Volta e me conta se prestou."',
    historia: 'Filho e neto de mercador; a loja é do avô e o nome Griz é do mercado, não da família — foi '
        + 'a família que emprestou o nome ao lugar, e não o contrário. Fabo nunca passou da estrada norte.\n\n'
        + 'Vende o que aventureiro precisa e ninguém fabrica em Sereni: mochila, corda, tocha, pederneira, '
        + 'óleo, saco de dormir, pergaminho em branco, tinta, giz, estaca, cantil. Não vende arma nem '
        + 'armadura — isso é do Velmir Trok, e os dois respeitam a linha.\n\n'
        + 'Sabe ler e escrever, o que na vila é quase ofício. É por isso que vende pergaminho — e é por '
        + 'isso que não sabe dizer se o pergaminho ESCRITO que às vezes aparece no balcão vale alguma '
        + 'coisa. Ele vende assim mesmo, e avisa que não garante.',
};

const LOOT = {
    itens: 'ESTOQUE DA LOJA GRIZ — tudo genuíno, tudo comum:\n'
        + '- Mochila de aventureiro (várias capacidades)\n'
        + '- Corda de cânhamo, 10 m e 20 m\n'
        + '- Tocha, pederneira, óleo de lampião\n'
        + '- Saco de dormir, cantil, estacas, giz\n'
        + '- Pergaminho em branco, tinta, pena\n'
        + '- Ferramentas de escalada e pesca\n\n'
        + 'SEGUNDA MÃO (espólio comprado da Guilda — ele sabe de quem era):\n'
        + '- Equipamento usado, 40% do preço, mesma qualidade\n\n'
        + 'BALCÃO DE TRÁS (não exposto):\n'
        + '- 1d3 pergaminhos escritos que ele não sabe ler. Vende avisando que não garante.',
    luns: '4d10+40',
    pistas: 'O CADERNO — nome, data, o que levou, quanto pagou, e se voltou. Trinta e um nomes sem a '
        + 'segunda anotação. É registro de quem entrou na Ruína de Ibirá e a lista mais completa que '
        + 'existe em Sereni, mais completa que a da Guilda. Ele mostra a quem tratar bem e perguntar direito.',
    complicacoes: 'Se alguém publicar a conta do caderno, a vila entende de uma vez o tamanho do que a '
        + 'Ruína custou — e a Guilda de Darin perde a metade dos candidatos. Fabo sabe disso, e é a razão '
        + 'de ele calar.',
};

const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const grab = async c => (await db.collection(c).get()).docs;
const [npcDocs, skDocs, eqDocs] = await Promise.all([grab('npcs'), grab('system/data/skills'), grab('system/data/equipment')]);
const erros = [];

const d = npcDocs.filter(x => (x.data().nome || '') === 'Fabo Griz');
if (d.length !== 1) erros.push(`Fabo Griz: ${d.length} docs`);
const doc = d[0], n = doc?.data() || {};
if (Object.values(n.atributos || {}).some(v => Number(v) > 0)) erros.push('a ficha já tem atributos — não é mais a ficha vazia; pare e confira');

const skPorNome = {}; for (const s of skDocs) skPorNome[norm(s.data().nome)] = { id: s.id, ...s.data() };
const pericias = [];
for (const [nome, nivel] of Object.entries(PERICIAS)) {
    const s = skPorNome[norm(nome)];
    if (!s) { erros.push(`perícia "${nome}" não existe no catálogo`); continue; }
    pericias.push({ refId: s.id, nivel });
}
const faca = eqDocs.map(x => x.data()).find(e => (e.nome || '') === 'Faca');
if (!faca?.formulaDano) erros.push('arma "Faca" não achada no catálogo');

const VIT = (ATRIB.VIG + ALTURA * 3) * 3;
const alvo = Math.max(ATRIB.FOR, ATRIB.DES) + PERICIAS['Arma'];
const dado = faca ? String(faca.formulaDano).split('/')[0].trim() : '1d4';
const P = Math.max(0, Math.min((Math.min(alvo, 9) - 1) / 10, 0.9));
const forca = P * Math.max(1, ((Number(/(\d+)d(\d+)/.exec(dado)?.[1]) * (Number(/(\d+)d(\d+)/.exec(dado)?.[2]) + 1)) / 2) + ATRIB.FOR - 2) / U;
const ATAQUES = `${faca?.nome || 'Faca'} (A. Padrão): Alvo ${alvo}, ${dado}+${ATRIB.FOR}.   [Arma ${PERICIAS['Arma']} + FOR/DES ${Math.max(ATRIB.FOR, ATRIB.DES)}]`;

const acum = (nv, por) => { let t = 0; for (let i = 1; i <= nv; i++) t += i * por; return t; };
let poder = 0;
for (const v of Object.values(ATRIB)) poder += acum(v, 5);
for (const [nome, nv] of Object.entries(PERICIAS)) poder += acum(nv, Number(skPorNome[norm(nome)]?.custoEvolucao) || 4);

/* ── relatório ── */
console.log(`\n=== Fabo Griz [${doc?.id}] ===\n`);
console.log(`   papel:   Dono da Loja Griz — Equipamento de Aventura`);
console.log(`   raça/classe: Humano · Mercador Estabelecido · porte médio · ${ALTURA} m`);
console.log(`   atributos: ${Object.entries(ATRIB).map(([k, v]) => k + v).join(' ')}   (nenhum acima de 3)`);
console.log(`   Vitalidade: (VIG ${ATRIB.VIG} + Tamanho ${(ALTURA * 3).toFixed(2)}) × 3 = ${VIT.toFixed(2)}`);
console.log(`   perícias: ${Object.entries(PERICIAS).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
console.log(`   ataque:   ${ATAQUES}`);
console.log(`             força ${forca.toFixed(2).replace('.', ',')}× — Inofensiva, como convém a um lojista`);
console.log(`   ⚡ Poder: ${poder}`);
console.log(`\n   personalidade:`);
for (const p of ROLEPLAY.personalidade) console.log(`      · ${p}`);
console.log(`\n   segredo (resumo): o caderno — 31 nomes sem a anotação de volta, quase todos da Ruína de Ibirá.`);
console.log(`   relações: aliado Darin dos Ecos · rival Rorek Pic · devedores fiados`);

if (erros.length) { console.error('\n🔴 ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

await doc.ref.update({
    schemaVersion: 2, modoFicha: 'mecanico', tipo: 'npc', nivel: 1, ai: 1,
    papel: 'Dono da Loja Griz — Equipamento de Aventura',
    raca: 'Humano', classe: 'Mercador Estabelecido', porte: 'médio', tamanho: `${String(ALTURA).replace('.', ',')}m`,
    tags: 'mercador, loja, equipamento, aventureiros, mercado griz, sereni, caderno, honesto',
    atributos: ATRIB, periciasEstruturadas: pericias, ataques: ATAQUES,
    valoresDer: {
        overrides: { [ALTURA_VD]: ALTURA }, atual: {}, extras: [],
        VIT, BLD: 0, DESLOCAMENTO: '6m', SAN: 0, ENER: 0,
    },
    rolePlay: ROLEPLAY, loot: LOOT,
    lastUpdate: new Date().toISOString(), lastUpdateBy: AUTOR,
});
console.log('\n✅ Fabo Griz preenchido.');
process.exit(0);
