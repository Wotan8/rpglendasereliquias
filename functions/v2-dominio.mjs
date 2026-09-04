/**
 * Fase C2 do Núcleo v2 — o Domínio vira perícia.
 * Livro de 12 Páginas, p. 8: "Não existe Domínio à parte: a perícia é a porta."
 *
 *   node functions/v2-dominio.mjs            dry-run: lista tudo, não grava nada
 *   node functions/v2-dominio.mjs --apply    grava (antes salva o estado atual em BACKUP_DIR)
 *
 * O que faz:
 *  1. equipment.dominioId  → periciaId (id da perícia em system/data/skills); versao +0.01
 *  2. classModules.periciaId = perícia da Escola (escolaId → escolas.periciaIds[0]); dominioId apagado
 *  3. peculiarities "Domínio de X" despublicadas (substituidoPorPericiaId); mecânicas mec_dominio_* idem
 *  4. classes.peculiaridadeIds sem os Domínios; versao +0.01
 *  5. char.dots sem as chaves pec_<dominio>; EXP devolvido só ao Domínio COMPRADO (avulsa, 12 EXP)
 *
 * Cópias de item em mapas e NPCs não são tocadas: elas caem no modelo do catálogo
 * (`i.periciaId ?? tpl.periciaId`), e o `dominioId` velho que carregam vira letra morta.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const DEL = admin.firestore.FieldValue.delete();
const APPLY = process.argv.includes('--apply');
const BACKUP_DIR = 'D:/Imagem/US - Universo Soberano/RPG/Reliera/Backup Firestore 2026-09-03/scripts-backups';
const CUSTO_AVULSA = 12;   // "Custo Avulsa -12 EXP" (mecânica 3a82ZuFNXO7h4oWS4cw4), o que o Domínio comprado custou

/** Domínio → Perícia de Arte que o substitui (por NOME, para não amarrar em id). */
const PERICIA_DO_DOMINIO = {
    'Domínio de Armas de Braço': 'Arma', 'Domínio de Armas de Precisão': 'Precisão', 'Domínio de Disparo': 'Disparo',
    'Domínio de Sonoromancia': 'Sonoromancia', 'Domínio de Necromancia': 'Necromancia', 'Domínio de Abismancia': 'Abismancia',
    'Domínio de Pallomancia': 'Pallomancia', 'Domínio de Hemomancia': 'Hemomancia',
    'Domínio de Totemancia': 'Totemancia', 'Domínio de Espiritismo': 'Totemancia', 'Domínio de Voduísmo': 'Totemancia', 'Domínio de Ferinismo': 'Totemancia',
    'Domínio de Runomancia': 'Runomancia', 'Domínio de Tatuagem': 'Runomancia', 'Domínio de Talha': 'Runomancia', 'Domínio de Escripta': 'Runomancia',
    'Domínio de Alquimancia': 'Alquimancia', 'Domínio de Bálsamo': 'Alquimancia', 'Domínio de Fel': 'Alquimancia',
    'Domínio de Proteção': null,   // saiu no §12.5: armadura não tem porta
};
/** Ids que aparecem em item mas não existem como peculiaridade. */
const ALIAS_ID = { pec_dominio_escripta: 'Runomancia' };

const col = async (p) => (await db.collection(p).get()).docs.map(d => ({ ...d.data(), id: d.id }));
const proximaVersao = (v) => {
    const n = parseFloat(String(v ?? '').replace(',', '.').replace(/[^\d.]/g, ''));
    return Number.isFinite(n) && n > 0 ? (Math.round(n * 100 + 1) / 100).toFixed(2) : '1.00';
};
const agora = new Date().toISOString();

// ---------- cadastro ----------
const [skills, pecs, mecs, eq, mods, escolas, classes, chars] = await Promise.all([
    col('system/data/skills'), col('system/data/peculiarities'), col('system/data/mechanics'),
    col('system/data/equipment'), col('system/data/classModules'), col('system/data/escolas'),
    col('system/data/classes'), col('char'),
]);
const skillPorNome = (nome) => skills.find(s => s.publicado !== false && s.nome === nome);
for (const nome of new Set(Object.values(PERICIA_DO_DOMINIO).filter(Boolean)))
    if (!skillPorNome(nome)) { console.error('perícia não encontrada no cadastro:', nome); process.exit(1); }

const dominios = pecs.filter(p => /^Dom[ií]nio de /.test(p.nome || ''));
const periciaDoDomId = {};   // domId → skillId | null
for (const d of dominios) {
    if (!(d.nome in PERICIA_DO_DOMINIO)) { console.error('Domínio sem mapa:', d.id, d.nome); process.exit(1); }
    const alvo = PERICIA_DO_DOMINIO[d.nome];
    periciaDoDomId[d.id] = alvo ? skillPorNome(alvo).id : null;
}
for (const [id, nome] of Object.entries(ALIAS_ID)) periciaDoDomId[id] = skillPorNome(nome).id;
const domIds = new Set(dominios.map(d => d.id));

const ops = [];   // { ref, data, antes, log }
const op = (caminho, data, antes, log) => ops.push({ ref: db.doc(caminho), data, antes, log });

// ---------- 1. equipment ----------
let eqTrocas = 0, eqSemMapa = [];
for (const e of eq) {
    if (!('dominioId' in e)) continue;
    if (!(e.dominioId in periciaDoDomId)) { eqSemMapa.push(`${e.id} (${e.nome}) → ${e.dominioId}`); continue; }
    const periciaId = periciaDoDomId[e.dominioId];
    eqTrocas++;
    op(`system/data/equipment/${e.id}`, { periciaId, dominioId: DEL, versao: proximaVersao(e.versao), updatedAt: Date.now() },
        { dominioId: e.dominioId, versao: e.versao ?? null }, `equipment ${e.nome}: ${e.dominioId} → ${periciaId ? skills.find(s => s.id === periciaId).nome : 'sem porta'}`);
}

// ---------- 2. classModules ----------
let modTrocas = 0;
for (const m of mods) {
    const escola = m.escolaId ? escolas.find(x => x.id === m.escolaId) : null;
    const periciaId = escola?.periciaIds?.[0] ?? (m.dominioId in periciaDoDomId ? periciaDoDomId[m.dominioId] : null) ?? null;
    if ((m.periciaId ?? null) === periciaId && !('dominioId' in m)) continue;
    modTrocas++;
    op(`system/data/classModules/${m.id}`, { periciaId, dominioId: DEL, versao: proximaVersao(m.versao), updatedAt: Date.now() },
        { dominioId: m.dominioId ?? null, periciaId: m.periciaId ?? null, versao: m.versao ?? null },
        `módulo ${m.titulo || m.nome}: perícia ${periciaId ? skills.find(s => s.id === periciaId)?.nome : '—'} (escola ${escola?.nome || '—'})`);
}

// ---------- 3. peculiaridades e mecânicas dos Domínios ----------
for (const d of dominios) {
    op(`system/data/peculiarities/${d.id}`,
        { publicado: false, aposentadoEm: agora, aposentadoPor: 'v2-C2: o Domínio virou perícia', substituidoPorPericiaId: periciaDoDomId[d.id], versao: proximaVersao(d.versao), updatedAt: Date.now() },
        { publicado: d.publicado ?? null, versao: d.versao ?? null }, `peculiaridade ${d.nome}: despublicada`);
}
const mecsDom = mecs.filter(m => /^mec_dominio_/.test(m.id) && m.publicado !== false);
for (const m of mecsDom)
    op(`system/data/mechanics/${m.id}`, { publicado: false, aposentadoEm: agora, aposentadoPor: 'v2-C2', updatedAt: Date.now() },
        { publicado: m.publicado ?? null }, `mecânica ${m.nome}: despublicada`);

// ---------- 4. classes ----------
let classesTrocas = 0;
for (const c of classes) {
    const antes = c.peculiaridadeIds || [];
    const depois = antes.filter(id => !domIds.has(id));
    const bonusAntes = c.bonusIniciais || [];
    const bonusDepois = bonusAntes.filter(id => !domIds.has(id));
    if (depois.length === antes.length && bonusDepois.length === bonusAntes.length) continue;
    classesTrocas++;
    const data = { versao: proximaVersao(c.versao), updatedAt: Date.now() };
    if (depois.length !== antes.length) data.peculiaridadeIds = depois;
    if (bonusDepois.length !== bonusAntes.length) data.bonusIniciais = bonusDepois;
    op(`system/data/classes/${c.id}`, data, { peculiaridadeIds: antes, bonusIniciais: bonusAntes, versao: c.versao ?? null },
        `classe ${c.nome}: sai ${antes.filter(id => domIds.has(id)).map(id => dominios.find(d => d.id === id)?.nome).join(', ')}`);
}

// ---------- 5. fichas ----------
let charsTrocas = 0, expDevolvido = 0;
const avisos = [];
for (const ch of chars) {
    const dots = ch.dots || {};
    const chaves = Object.keys(dots).filter(k => domIds.has(k.replace(/^pec_/, '')));
    const indAntes = ch.peculiaridadesIndividuais || [];
    const indDepois = indAntes.filter(p => !domIds.has(typeof p === 'string' ? p : p?.id));
    if (!chaves.length && indDepois.length === indAntes.length) continue;
    charsTrocas++;
    let devolve = 0;
    for (const k of chaves) {
        const nivel = Number(dots[k]) || 0;
        if (nivel >= 2) avisos.push(`${ch.id} (${ch.fields?.nome || ''}): Domínio ${k} no nível ${nivel} — EXP dos níveis 2+ NÃO devolvido (nenhum caso previsto)`);
    }
    devolve += (indAntes.length - indDepois.length) * CUSTO_AVULSA;   // comprado como avulsa: devolve o que custou
    expDevolvido += devolve;
    const novosDots = Object.fromEntries(Object.entries(dots).filter(([k]) => !chaves.includes(k)));
    const data = {
        dots: novosDots,
        migracaoDominioV2: { em: agora, removidos: chaves.map(k => ({ chave: k, nivel: dots[k] })), expDevolvido: devolve },
    };
    if (indDepois.length !== indAntes.length) data.peculiaridadesIndividuais = indDepois;
    if (devolve) data['fields.exp'] = (Number(ch.fields?.exp) || 0) + devolve;
    op(`char/${ch.id}`, data, { dots: chaves.map(k => [k, dots[k]]), exp: ch.fields?.exp ?? null },
        `ficha ${ch.fields?.nome || ch.id}: sai ${chaves.join(', ')}${devolve ? ` (+${devolve} EXP)` : ''}`);
}

// ---------- relatório ----------
console.log(`Domínios no cadastro: ${dominios.length} | equipment: ${eqTrocas} trocas | módulos: ${modTrocas} | classes: ${classesTrocas} | fichas: ${charsTrocas} (EXP devolvido ${expDevolvido}) | mecânicas: ${mecsDom.length}`);
if (eqSemMapa.length) console.log('EQUIPMENT SEM MAPA (não tocados):', eqSemMapa.join(' | '));
for (const o of ops) console.log(' ', o.log);
for (const a of avisos) console.log('AVISO:', a);

if (!APPLY) { console.log('\n(dry-run: nada gravado; use --apply)'); process.exit(0); }

fs.mkdirSync(BACKUP_DIR, { recursive: true });
const bk = path.join(BACKUP_DIR, `_backup-dominio-${agora.replace(/[:.]/g, '-')}.json`);
fs.writeFileSync(bk, JSON.stringify(ops.map(o => ({ doc: o.ref.path, antes: o.antes, depois: Object.fromEntries(Object.entries(o.data).filter(([, v]) => v !== DEL)) })), null, 1));
console.log('backup:', bk);

for (let i = 0; i < ops.length; i += 400) {
    const b = db.batch();
    ops.slice(i, i + 400).forEach(o => b.update(o.ref, o.data));
    await b.commit();
}
console.log(`gravado: ${ops.length} documentos`);
process.exit(0);
