/**
 * Duas correções de cadastro:
 *
 * 1. A PRESA — a mira explícita que gravei não tinha `condicaoNome`, e é dela
 *    que o Tabuleiro tira qual condição aplicar. Resultado: marcava o alvo e
 *    não punha a condição Presa nele. Também faltava o `condicaoPortao`, que é
 *    o que diz ao motor "isto não tem rolagem, não abra janela de conflito".
 *
 * 2. MUNIÇÃO das armas de disparo. O campo `tipoProjetil` nasceu vazio em
 *    todas as 13. As tags saem do que os projéteis JÁ carregam no catálogo
 *    (Flecha, Virote, Zarabatana) — nada de tag nova.
 *
 *    A FUNDA fica de fora: os 5 projéteis do catálogo são Flecha ×2, Virote,
 *    Haste e Zarabatana. Não existe pedra/bala, e inventar um item é decisão
 *    do mestre, não deste script. Ela continua sem gastar munição até lá.
 *
 *   node functions/__corrige-presa-e-municao.mjs            (dry-run)
 *   node functions/__corrige-presa-e-municao.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({
    credential: admin.credential.cert(
        require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')),
});
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');
const agora = () => admin.firestore.Timestamp.now();

/* ═══ 1. A PRESA: a mira precisa carregar a condição ═══ */
console.log('-- A PRESA: mira --');
const modRef = db.doc('system/data/classModules/manobras_cacador');
const mod = (await modRef.get()).data();
if (!mod) { console.log('   ABORTA: modulo manobras_cacador nao existe'); process.exit(1); }

const itens = (mod.itensPredefinidos || []).map(it => {
    if (it.id !== 'pdi_cacador_presa_1') return it;
    const cond = (it.condicoesAplicadas || [])[0] || {};
    const mira = {
        ...it.mira,
        condicaoNome: cond.condicao || 'Presa',
        condicaoRodadas: Number(cond.rodadas) || 0,
        condicaoMaxAlvos: Number(cond.alvos) || 1,
        // 'nenhum' = sem Chance e sem teste de resistência: o efeito acontece,
        // e o Tabuleiro não abre janela de conflito pedindo um Acerto.
        condicaoPortao: cond.portao || 'nenhum',
    };
    console.log(`   condicaoNome: ${it.mira?.condicaoNome ?? '(vazio)'} -> ${mira.condicaoNome}`);
    console.log(`   condicaoPortao: ${it.mira?.condicaoPortao ?? '(vazio)'} -> ${mira.condicaoPortao}`);
    console.log(`   condicaoMaxAlvos: ${it.mira?.condicaoMaxAlvos ?? '(vazio)'} -> ${mira.condicaoMaxAlvos}`);
    return { ...it, mira };
});
if (APLICAR) await modRef.update({ itensPredefinidos: itens, updatedAt: agora() });

/* ═══ 2. Munição das armas ═══ */
const MUNICAO = {
    'Arco Simples': ['Flecha'],
    'Arco Garnute': ['Flecha'],
    'Arco Composto': ['Flecha'],
    'Arco de Guerra': ['Flecha'],
    'Arco Longo': ['Flecha'],
    'Besta de Mão': ['Virote'],
    'Besta Leve': ['Virote'],
    'Besta Pesada': ['Virote'],
    'Besta de Caça': ['Virote'],
    'Besta Menin': ['Virote'],
    'Besta de Repetição': ['Virote'],
    'Besta de Sítio Gélida': ['Virote'],
    // 'Funda': sem projétil correspondente no catálogo — ver cabeçalho.
};

console.log('\n-- MUNICAO DAS ARMAS --');
const snap = await db.collection('system/data/equipment').get();
let n = 0;
const vistas = new Set();

// que tags de projétil existem de fato? avisar se eu pedir uma que não existe
const tagsExistentes = new Set();
snap.forEach(d => { const e = d.data(); if (e.tipo === 'Projétil') (e.tags || []).forEach(t => tagsExistentes.add(t)); });

for (const d of snap.docs) {
    const e = d.data();
    const nome = (e.nome || '').trim();
    const tags = MUNICAO[nome];
    if (!tags) continue;
    vistas.add(nome);
    const atual = e.tipoProjetil || [];
    if (JSON.stringify(atual) === JSON.stringify(tags)) { console.log(`   = ${nome.padEnd(24)} ja bate`); continue; }
    const semProjetil = tags.filter(t => !tagsExistentes.has(t));
    console.log(`   ${nome.padEnd(24)} ${JSON.stringify(atual)} -> ${JSON.stringify(tags)}`
        + (semProjetil.length ? `  AVISO: nenhum projetil com a tag ${semProjetil.join('/')}` : ''));
    n++;
    if (APLICAR) await d.ref.update({ tipoProjetil: tags, updatedAt: agora() });
}

const faltando = Object.keys(MUNICAO).filter(x => !vistas.has(x));
if (faltando.length) console.log(`   AVISO: nao encontradas no catalogo: ${faltando.join(', ')}`);
console.log(`   tags de projetil que existem hoje: ${[...tagsExistentes].join(', ')}`);
console.log(`   Funda deixada de fora: sem pedra/bala no catalogo`);

console.log(`\n${n} arma(s) a mudar`);
console.log(APLICAR ? 'APLICADO no Firestore' : 'dry-run - rode com --apply para gravar');
process.exit(0);
