/**
 * 1) Limpa espaço sobrando no nome das unidades militares do Uqatá.
 * 2) Cria as 4 tribos que existem no PDF de cenário e não estavam no site.
 *
 * TEXTO TRANSCRITO LITERALMENTE de:
 *   D:/Imagem/US - Universo Soberano/RPG/Reliera/Z- Outros/Cenário-Classes-Tribos v02.pdf
 *   (pág. 15-17, "Tribos de Vasteluna")
 * Campo que o PDF não cobre fica "." — NÃO inventar preenchimento.
 *
 *   node functions/adicionar-tribos-faltantes.mjs            (dry-run)
 *   node functions/adicionar-tribos-faltantes.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');

const NOVAS = [
    {
        nome: "Liu'r",
        lema: 'Os Cavaleiros Errantes',
        descricao: 'Mestres das montarias, sobretudo cavalos. Atuam como mensageiros velozes e apoio em emboscadas.',
        cultura: '.',
        governo: '.',
        economia: 'Possuem muitos aliados, por prestarem apoio logístico.',
        militar: 'Função tática: mensageiros velozes e apoio em emboscadas. Vivem cruzando Vasteluna; possuem bases temporárias e mobilidade estratégica.',
    },
    {
        nome: 'Poneiro',
        lema: 'Os Olhos do Vento',
        descricao: 'Arqueiros de elite, com as melhores táticas de arquearia do continente.',
        cultura: 'Silêncio, paciência e mortalidade à distância são suas virtudes.',
        governo: '.',
        economia: '.',
        militar: 'Defesa à distância, vigilância constante e ataques precisos. Infraestrutura: torres altas e muros de madeira com passarelas para atiradores.',
    },
    {
        nome: 'Oara',
        lema: 'Os Mestres do Cerco',
        descricao: 'Tribo de engenheiros bélicos. Criam as máquinas de guerra mais letais de Vasteluna.',
        cultura: 'Valorizam intelecto técnico, precisão e planejamento logístico.',
        governo: '.',
        economia: 'Forte vínculo com a tribo Ganute; trocam conhecimento por proteção.',
        militar: 'Criam as máquinas de guerra mais letais de Vasteluna.',
    },
    {
        nome: 'Ogo',
        lema: 'Os Gigantes de Sangue Puro',
        descricao: 'Tribo cuja raça dominante são os Yotuns (gigantes). Sociedade fechada, com raríssima aceitação de outras raças.',
        cultura: 'Orgulho racial, honra pela força e tradição ancestral. Vivem em locais vastos, adaptados ao seu tamanho e poder físico.',
        governo: '.',
        economia: '.',
        militar: '.',
    },
];

const BASE = {
    peculiaridadeIds: [], derivedValueIds: [], unidadesMilitares: [],
    imagemUrl: '', publicado: false, versao: 1,
};

/* ===== 1. Espaços nas unidades do Uqatá ===== */
console.log('=== 1. UNIDADES DO UQATÁ ===');
const usnap = await db.collection('system/data/tribes').where('nome', '==', 'Uqatá').limit(1).get();
const uq = usnap.docs[0];
const unidades = (uq.data().unidadesMilitares || []).map(u => ({
    ...u,
    nome: (u.nome || '').trim(),
    funcao: (u.funcao || '').trim(),
    descricao: (u.descricao || '').trim(),
}));
for (const [i, u] of unidades.entries()) {
    const antes = uq.data().unidadesMilitares[i];
    if (antes.nome !== u.nome) console.log(`  "${antes.nome}" -> "${u.nome}"`);
}
if (APPLY) await uq.ref.update({ unidadesMilitares: unidades, atualizadoEm: new Date() });

/* ===== 2. Tribos novas ===== */
console.log('\n=== 2. TRIBOS NOVAS (texto transcrito do PDF de cenário) ===');
const existentes = (await db.collection('system/data/tribes').get()).docs.map(d => d.data().nome);
let ordem = 50;
for (const t of NOVAS) {
    if (existentes.includes(t.nome)) { console.log(`  ~ "${t.nome}" já existe — pulando`); continue; }
    const ref = db.collection('system/data/tribes').doc();
    const vazios = ['cultura', 'governo', 'economia', 'militar'].filter(f => t[f] === '.');
    console.log(`\n  + CRIA ${ref.id}  "${t.nome}" — ${t.lema}`);
    console.log(`      ${t.descricao}`);
    console.log(`      campos sem fonte no PDF (ficam "."): ${vazios.join(', ') || 'nenhum'}`);
    if (APPLY) await ref.set({ ...BASE, ...t, ordem: ordem++, criadoEm: new Date(), atualizadoEm: new Date() });
}

console.log(APPLY ? '\n✔ GRAVADO.\n' : '\nDRY-RUN — nada gravado. Rode com --apply.\n');
process.exit();
