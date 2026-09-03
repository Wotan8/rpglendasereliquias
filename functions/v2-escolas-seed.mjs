/**
 * Escola e Ramo como cadastro.
 *
 * Cria `system/data/escolas` (8 escolas, ids determinísticos `escola_<slug>`) a partir
 * das peculiaridades "Escola de Magia" (descrição), das Formas de Conjuração (por nome),
 * dos Compêndios (bookId) e do Livro de 12 Páginas (Tributo e Desastre). Grava em cada
 * módulo de classe o `escolaId` do ramo (módulo marcial fica sem).
 *
 *   node functions/v2-escolas-seed.mjs            (dry-run)
 *   node functions/v2-escolas-seed.mjs --apply
 */
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');

const ESCOLAS = [
    { id: 'escola_hemomancia', nome: 'Hemomancia', icone: '🩸', atributo: 'INT', periciaNome: 'Hemomancia', pecEscola: 'Hemomancia', formas: [], compendioId: 'book_ms3gb8zgr21roi', ordem: 1,
      tributo: 'Só sangue vivo obedece; sangue sob seu controle continua vivo, o resto morre com o tempo. 3 de Vitalidade = 1 Carga (contador de cena).',
      desastre: 'Regra geral: o Narrador escolhe a consequência.' },
    { id: 'escola_abismancia', nome: 'Abismancia', icone: '🌑', atributo: 'PRS', periciaNome: 'Abismancia', pecEscola: 'Abismancia', formas: ['Talismã Abissal'], compendioId: 'book_ms3gb8sua583cb', ordem: 2,
      tributo: 'Paga em Sanidade; quanto menos Sanidade, mais Conexão com o Abismo. Em Sanidade 0 nenhum ritual pode ser pago.',
      desastre: 'Regra geral: o Narrador escolhe a consequência.' },
    { id: 'escola_necromancia', nome: 'Necromancia', icone: '🔯', atributo: 'PRS', periciaNome: 'Necromancia', pecEscola: 'Necromancia', formas: ['Talismã Profano'], compendioId: 'book_ms3gb8mfoqx3mp', ordem: 3,
      tributo: 'Talismã Profano e um cadáver nunca reanimado; ritual falho consome o cadáver. Cada servo de pé come 1 Sanidade sua por sessão.',
      desastre: 'Regra geral: o Narrador escolhe a consequência.' },
    { id: 'escola_pallomancia', nome: 'Pallomancia', icone: '✨', atributo: 'PRE', periciaNome: 'Pallomancia', pecEscola: 'Pallomancia', formas: ['Símbolo Sagrado'], compendioId: 'book_ms3gb8part7b7i', ordem: 4,
      tributo: 'Símbolo Sagrado e linha de visão.',
      desastre: 'Luz Vacilante: Desvantagem em toda Pallomancia até o fim da cena; não empilha com outro 10. Reconsagração e Peregrinação do Amanhecer suspendem.' },
    { id: 'escola_sonoromancia', nome: 'Sonoromancia', icone: '🎵', atributo: 'PRE', periciaNome: 'Sonoromancia', pecEscola: 'Sonoromancia', formas: ['Vocal', 'Inst. Corda', 'Inst. Percussão', 'Inst. Sopro'], compendioId: 'book_ms3gb954k59x5d', ordem: 5,
      tributo: 'O jogador canta ou toca de verdade e precisa de quem ouça. Harmonia é contador de cena com teto igual à perícia; errar zera.',
      desastre: 'Regra geral, e a Harmonia vai a zero.' },
    { id: 'escola_totemancia', nome: 'Totemancia', icone: '🌿', atributo: 'PRE', periciaNome: 'Totemancia', pecEscola: 'Totemancia Xamânica', formas: ['Totem'], compendioId: 'book_ms3gb924a9frg1', ordem: 6,
      tributo: 'Totem cravado, e o consentimento de quem vem: o Eco aceita, o bicho confia, do vivo basta uma parte dele.',
      desastre: 'Regra geral: o Narrador escolhe a consequência.' },
    { id: 'escola_runomancia', nome: 'Runomancia', icone: 'ᛟ', atributo: 'INT', periciaNome: 'Runomancia', pecEscola: 'Runomancia', formas: ['Tomo Rúnico'], compendioId: 'book_ms3gb8w3l8qous', ordem: 7,
      tributo: 'Luns e horas de gravação. A runa é item com Qualidade: quem grava precisa da perícia, quem usa não.',
      desastre: 'Falha de gravação conforme o Compêndio (Parte VI).' },
    { id: 'escola_alquimancia', nome: 'Alquimancia', icone: '⚗️', atributo: 'RAC', periciaNome: 'Alquimancia', pecEscola: 'Alquimancia', formas: [], compendioId: 'book_ms3gb8iq5q9k0i', ordem: 8,
      tributo: 'Ingredientes e tempo de bancada. A loção é item com Qualidade: quem usa não precisa de nada.',
      desastre: 'Falha crítica no preparo produz loção de efeito invertido (Compêndio).' },
];

// módulo de classe → escola (o ramo). Marciais ficam sem escola.
const RAMOS = {
    mod_hemomancia: 'escola_hemomancia', TbRKh68m2hvr9KUVrOXb: 'escola_abismancia', ritual_necro: 'escola_necromancia',
    mod_pallomancia: 'escola_pallomancia', mod_sonoromancia: 'escola_sonoromancia',
    mod_totem: 'escola_totemancia', mod_vodu: 'escola_totemancia', ally_animal: 'escola_totemancia',
    cartucho_runico: 'escola_runomancia', gX31tLk7vRsTPDuay4h9: 'escola_alquimancia', WxIUefCzMIAcupHjqqxw: 'escola_alquimancia',
};

const pecs = (await db.collection('system/data/peculiarities').get()).docs.map(d => ({ ...d.data(), id: d.id }));
const formas = (await db.collection('system/data/castingForms').get()).docs.map(d => ({ ...d.data(), id: d.id }));
const mods = (await db.collection('system/data/classModules').get()).docs.map(d => ({ ...d.data(), id: d.id }));
const formaId = nome => formas.find(f => f.nome === nome)?.id || null;

console.log(`${APPLY ? 'APLICANDO' : 'DRY-RUN'} — ${ESCOLAS.length} escolas, ${Object.keys(RAMOS).length} ramos`);
const batch = db.batch();
const backup = { escolasAntes: {}, modulosAntes: {} };
for (const e of ESCOLAS) {
    const pec = pecs.find(p => p.nome === e.pecEscola);
    const formaIds = e.formas.map(formaId).filter(Boolean);
    const faltam = e.formas.filter(n => !formaId(n));
    const existente = await db.doc(`system/data/escolas/${e.id}`).get();
    if (existente.exists) backup.escolasAntes[e.id] = existente.data();
    const docu = {
        nome: e.nome, icone: e.icone, ordem: e.ordem,
        descricao: pec?.descricao || '', pecEscolaId: pec?.id || null,
        atributo: e.atributo, periciaNome: e.periciaNome, periciaIds: [],   // ligado na Fase C1
        formaIds, tributo: e.tributo, desastre: e.desastre, leis: '',
        compendioId: e.compendioId, publicado: true,
        versao: existente.exists ? (existente.data().versao || '1.00') : '1.00',
        criadoEm: existente.exists ? (existente.data().criadoEm || Date.now()) : Date.now(), updatedAt: Date.now(),
    };
    console.log(`  ${e.id}: pec=${pec ? 'ok' : 'SEM PEC'} formas=${formaIds.length}${faltam.length ? ' (faltam: ' + faltam.join(', ') + ')' : ''}${existente.exists ? ' [atualiza]' : ' [cria]'}`);
    if (APPLY) batch.set(db.doc(`system/data/escolas/${e.id}`), docu, { merge: true });
}
for (const m of mods) {
    const escolaId = RAMOS[m.id] || null;
    if (m.escolaId === escolaId) continue;
    backup.modulosAntes[m.id] = { escolaId: m.escolaId ?? null };
    console.log(`  módulo ${m.id} (${m.nome || m.titulo}): escolaId ${m.escolaId ?? '—'} → ${escolaId ?? '— (marcial)'}`);
    if (APPLY) batch.update(db.doc(`system/data/classModules/${m.id}`), { escolaId, updatedAt: Date.now() });
}
if (APPLY) {
    writeFileSync(new URL(`./_backup-escolas-${Date.now()}.json`, import.meta.url), JSON.stringify(backup, null, 1));
    await batch.commit();
    console.log('gravado');
}
process.exit(0);
