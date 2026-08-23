/**
 * PARTE DO CORPO NOVA -> QUEM JÁ EXISTE
 *
 * `char.partesDoCorpo` é um retrato tirado na criação do personagem
 * (criar-personagem/js/finale-module.js: "Injetado no momento da criação").
 * O Painel do Criador, ao marcar uma parte como `ehPadrao`, faz auto-link só
 * nas RAÇAS (_autoLinkBodyPartToAllRaces) — personagem e NPC que já existiam
 * ficam com a cópia velha para sempre, e a parte nova simplesmente não aparece
 * no modal de equipar deles.
 *
 * Este script alinha a cópia com a raça, mas SÓ nas partes marcadas `ehPadrao`
 * no catálogo — a anatomia que todo mundo daquela raça deveria ter. Parte
 * especial (Asa de Libélula, Língua Longa) fica de fora de propósito: quem tem
 * ganhou por escolha, e distribuir asa para quem nunca teve é dano, não conserto.
 * Nunca remove nada — parte extra na cópia é dado legítimo.
 *
 *   node functions/migrar-parte-do-corpo.mjs            # dry-run: só lista
 *   node functions/migrar-parte-do-corpo.mjs --apply    # grava
 *   node functions/migrar-parte-do-corpo.mjs --todas    # inclui as não-padrão
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');
const TODAS = process.argv.includes('--todas');

const norm = (s) => String(s || '').trim().toLowerCase();

const partes = {};
(await db.collection('system/data/bodyParts').get()).forEach(d => { partes[d.id] = { id: d.id, ...d.data() }; });

const racas = {};
(await db.collection('system/data/races').get()).forEach(d => {
    const r = d.data();
    if (r.nome) racas[norm(r.nome)] = { id: d.id, ...r };
});

console.log(`📚 ${Object.keys(partes).length} partes no catálogo · ${Object.keys(racas).length} raças`);

/** Partes que a raça declara e a cópia do personagem não tem. */
function faltantes(copia, raca) {
    const tem = new Set((copia || []).map(p => p.id));
    return (raca?.partesDoCorpo || [])
        .filter(ref => ref?.id && !tem.has(ref.id) && partes[ref.id])
        .filter(ref => TODAS || partes[ref.id].ehPadrao)
        .map(ref => ({ ...partes[ref.id], slots: ref.slots || 1 }));
}

let mexidos = 0, semRaca = 0, semCopia = 0;

const snap = await db.collection('char').get();
for (const d of snap.docs) {
    const c = d.data();
    const copia = c.partesDoCorpo;
    // Sem cópia nenhuma o personagem já cai no fallback da raça em tempo de
    // leitura (ficha-v1.7_1/js/storage.js) — nada a migrar, e criar a cópia
    // agora só congelaria o que hoje é vivo.
    if (!Array.isArray(copia) || !copia.length) { semCopia++; continue; }

    const raca = racas[norm(c.raca || c.fields?.raca)];
    if (!raca) { semRaca++; continue; }

    const novas = faltantes(copia, raca);
    if (!novas.length) continue;

    mexidos++;
    const nome = c.fields?.charName || c.fields?.nome || c.nome || d.id;
    console.log(`  ${APPLY ? '✍️ ' : '· '}${nome} (${raca.nome}) += ${novas.map(p => p.nome).join(', ')}`);
    if (APPLY) {
        await d.ref.update({ partesDoCorpo: [...copia, ...novas], lastUpdate: new Date().toISOString() });
    }
}

console.log(`\n${APPLY ? '✅ gravados' : '🔍 seriam gravados'}: ${mexidos} personagens`);
console.log(`   ignorados: ${semCopia} sem cópia (usam a raça ao vivo) · ${semRaca} com raça desconhecida`);
if (!TODAS) console.log('   (só partes ehPadrao — use --todas para incluir as especiais)');
if (!APPLY) console.log('\nRode de novo com --apply para gravar.');
