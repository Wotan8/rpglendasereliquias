/**
 * Migra a coleção legada `characters` (fichas do sistema antigo, v1.6) para `char`
 * e, depois de conferir, apaga a legada.
 *
 *   node functions/v2-migra-characters.mjs              (dry-run: mostra o que faria)
 *   node functions/v2-migra-characters.mjs --apply      (cria os docs em `char`)
 *   node functions/v2-migra-characters.mjs --apagar     (apaga `characters` só se cada id já existir em `char` com origem 'characters')
 *
 * O documento inteiro original vai para `legado`, então nada se perde.
 */
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');
const APAGAR = process.argv.includes('--apagar');

const strip = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const slug = s => strip(s).replace(/[^a-z0-9]/g, '_').replace(/__+/g, '_');
const ms = v => v && typeof v.toMillis === 'function' ? new Date(v.toMillis()).toISOString() : (v || null);

// perícias atuais → chave de dots (mesma regra do system-data-loader)
const CAT = { mental: 'mental', fisica: 'fisico', fisico: 'fisico', social: 'social', combate: 'combate', defensiva: 'combate', exclusivo: 'classe', classe: 'classe' };
const skills = (await db.collection('system/data/skills').get()).docs.map(d => ({ id: d.id, ...d.data() }));
const porNome = new Map();
for (const s of skills) porNome.set(strip(s.nome), `sk_${CAT[(s.categoria || 'mental').toLowerCase()] || 'mental'}_${slug(s.nome)}`);
// nomes do sistema antigo → nome atual
const ALIAS = { 'abismo': 'abismancia', 'essencia': 'fluxomancia', 'oficio-intelectual': 'erudicao', 'oficio intelectual': 'erudicao', 'oficio-bracal': 'labuta', 'oficio bracal': 'labuta', 'alquimia': 'alquimancia', 'medicina': 'anatomia', 'erudicao-ofensiva': 'erudicao ofensiva', 'erudicao-defensiva': 'erudicao defensiva', 'linguagem-animal': 'linguagem animal', 'aliado-animal': 'aliado animal', 'maceracao': 'maceracao' };
const dotDe = nomeLegado => { let n = strip(nomeLegado); n = ALIAS[n] || n.replace(/-/g, ' '); return porNome.get(n) || null; };

const legados = await db.collection('characters').get();
console.log(`${APPLY ? 'APLICANDO' : APAGAR ? 'APAGANDO' : 'DRY-RUN'} — ${legados.size} fichas em characters`);
const relatorio = [];
const batch = db.batch();
let apagados = 0;

for (const d of legados.docs) {
    const L = d.data();
    const jaExiste = await db.doc(`char/${d.id}`).get();
    if (APAGAR) {
        if (jaExiste.exists && jaExiste.data().origem === 'characters') { batch.delete(d.ref); apagados++; console.log(`  apaga characters/${d.id} (${L.nome}) — cópia confirmada em char`); }
        else console.log(`  MANTÉM characters/${d.id} (${L.nome}) — sem cópia confirmada em char`);
        continue;
    }
    const dots = {};
    for (const a of ['int', 'rac', 'prs', 'for', 'des', 'vig', 'pre', 'man', 'aut']) if (typeof L[a] === 'number') dots['attr_' + a] = L[a];
    const semMapa = [];
    for (const [nome, nivel] of Object.entries(L.skills || {})) { const k = dotDe(nome); if (k) { if (nivel > 0) dots[k] = nivel; } else semMapa.push(nome); }
    for (const [nome, nivel] of Object.entries(L.classAbilities || {})) { const k = dotDe(nome); if (k) { if (nivel > 0) dots[k] = nivel; } else semMapa.push('classe:' + nome); }
    const notes = [];
    if (L.notas) notes.push({ id: 'note-legado-notas', titulo: '📜 Notas (sistema antigo)', conteudo: String(L.notas) });
    if (L.masterNotes) notes.push({ id: 'note-legado-mestre', titulo: '👑 Notas do Mestre (sistema antigo)', conteudo: String(L.masterNotes) });
    notes.push({ id: 'note-legado-aviso', titulo: '⚠️ Ficha migrada', conteudo: 'Esta ficha veio do sistema antigo (coleção characters). Inventário, aliados, receitas e habilidades de classe antigas estão guardados em "legado" e precisam ser refeitos no sistema atual.' });
    const novo = {
        fields: {
            nome: L.nome || '', idade: L.idade != null ? String(L.idade) : '', jogador: L.jogador || L.userEmail || '',
            raca: L.raca || '', classe: L.classe || '', tribo: '', virtude: L.virtude || '', vicio: L.vicio || '',
            exp: Number(L.exp) || 0, exp_total: Number(L.exp) || 0,
        },
        dots,
        hpMax: L.hpMax ?? null, hpCurrent: L.hpCurrent ?? null,
        enerMax: L.detMax ?? null, enerCurrent: L.detCurrent ?? L.enerCurrent ?? null,
        sanCurrent: L.sanCurrent ?? null,
        conditions: [], auras: {}, notes, peculiaridadesIndividuais: [], classModuleData: {}, expApplied: {},
        charImg: typeof L.characterImage === 'string' ? L.characterImage : (L.imagem || ''),
        ownerUid: L.ownerUid || null, userEmail: L.userEmail || null, ownerEmail: L.userEmail || null,
        createdAt: ms(L.createdAt) || new Date().toISOString(), createdVia: 'migracao-characters', origem: 'characters',
        migradoEm: new Date().toISOString(), lastUpdate: new Date().toISOString(),
        luns: L.luns ?? 0,
        // a imagem base64 já vai em charImg; duplicá-la no legado estoura o limite de 1 MiB do documento
        legado: JSON.parse(JSON.stringify({ ...L, characterImage: L.characterImage ? '(movida para charImg)' : L.characterImage }, (k, v) => (v && typeof v.toMillis === 'function') ? ms(v) : v)),
    };
    relatorio.push({ id: d.id, nome: L.nome, dots: Object.keys(dots).length, semMapa, jaExiste: jaExiste.exists });
    console.log(`  ${d.id} | ${L.nome} | ${Object.keys(dots).length} dots | sem mapa: ${semMapa.join(', ') || '-'}${jaExiste.exists ? ' | JÁ EXISTE em char' : ''}`);
    if (APPLY && !jaExiste.exists) {
        // um documento por escrita: o lote inteiro estoura 10 MiB com as imagens embutidas
        try { await db.doc(`char/${d.id}`).set(novo); console.log(`    → criado char/${d.id}`); }
        catch (e) { console.log(`    ✗ falhou char/${d.id}: ${e.message}`); }
    }
}

if (APPLY || APAGAR) {
    writeFileSync(new URL(`./_backup-characters-${Date.now()}.json`, import.meta.url), JSON.stringify(Object.fromEntries(legados.docs.map(d => [d.id, d.data()])), (k, v) => (v && typeof v.toMillis === 'function') ? ms(v) : v, 1));
    if (APAGAR) { await batch.commit(); console.log(`apagados: ${apagados}`); }
}
process.exit(0);
