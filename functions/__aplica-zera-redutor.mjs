/**
 * Zera o Redutor onde o GS importa; mantém onde não importa.
 *
 * Critério do dono do sistema:
 *   · dá dano ou afeta facção inimiga  → zera (já enfrenta o Redutor da Defesa)
 *   · o GS é determinante no efeito     → zera
 *   · nem um nem outro                  → mantém
 *
 *   node functions/__aplica-zera-redutor.mjs [--apply]
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

/* Dano, ou efeito dirigido a inimigo. */
/* Nomes que o regex nao pega porque o texto foi reescrito nos lotes anteriores
   e nao usa mais as palavras-gatilho — mas sao hostis sem duvida. */
const HOSTIL_EXPLICITO = ['Selo Negativo','Cegueira da Fé I','Distração da Fé I'];
const HOSTIL = /dano|\dd\d|inimigo|rival|alvo (fica|recebe|sofre|testa)|vs (PRS|AUT|VIG|FOR)|resist|expuls|banir|cegueira|penit[êe]ncia|provoc|atordo|prostr|abalado|drenado|amedront|ofusc/i;
/* O GS decide magnitude, duração ou alcance do efeito. */
const GS_DECIDE = /por GS|\(GS\)|graus? (de sucesso )?(determinam|extra|obtidos)|vs GS|por grau|GS\b/i;

const col = db.collection('system/data/classModules');
const mods = (await col.get()).docs.map((d) => ({ id: d.id, ...d.data() }));
const zerar = [], manter = [];
for (const m of mods) {
    const lbl = Object.fromEntries((m.schema || []).map((f) => [f.key, String(f.label || '')]));
    const kR = Object.keys(lbl).find((x) => /^redutor/i.test(lbl[x]));
    const kE = Object.keys(lbl).find((x) => /^efeito/i.test(lbl[x]));
    if (!kR) continue;
    let mexeu = false;
    const itens = (m.itensPredefinidos || []).map((it) => {
        const v = String(it.valores?.[kR] ?? '').trim();
        const n = Number(v.replace(',', '.')) || 0;
        if (!n) return it;
        const txt = `${it.descricao || ''} ${it.valores?.[kE] || ''}`;
        const hostil = HOSTIL.test(txt) || HOSTIL_EXPLICITO.includes(it.nome);
        const gs = GS_DECIDE.test(txt);
        if (hostil || gs) {
            zerar.push({ nome: it.nome, red: n, por: hostil ? (gs ? 'hostil + GS' : 'hostil') : 'GS decide' });
            mexeu = true;
            return { ...it, valores: { ...it.valores, [kR]: '0' } };
        }
        manter.push({ nome: it.nome, red: n });
        return it;
    });
    if (mexeu) m._novos = itens;
}

console.log(`=== ZERAR (${zerar.length}) ===`);
for (const z of zerar) console.log(`  ${z.nome.slice(0, 32).padEnd(34)} ${String(z.red).padStart(2)} → 0   [${z.por}]`);
console.log(`\n=== MANTER (${manter.length}) ===`);
for (const k of manter) console.log(`  ${k.nome.slice(0, 32).padEnd(34)} ${String(k.red).padStart(2)}`);
assert.ok(zerar.length + manter.length === 33, `esperado 33 com Redutor, achei ${zerar.length + manter.length}`);

if (!APLICAR) { console.log('\n(dry-run)'); process.exit(0); }
const lote = db.batch();
for (const m of mods.filter((x) => x._novos)) lote.update(col.doc(m.id), { itensPredefinidos: m._novos });
await lote.commit();
console.log('\n✅ gravado.');
