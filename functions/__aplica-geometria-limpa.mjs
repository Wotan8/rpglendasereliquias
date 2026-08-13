/**
 * Área não declara alvos — declara área.
 *
 * O lote anterior gravou `alvosMax` calculado da geometria em toda habilidade
 * de área. Isso mente na mesa: uma Trombeta em cone de 30 m dizendo "7 alvos"
 * quando o jogador acerta 1 é ruído, não informação. Quem está dentro da forma
 * é decidido no tabuleiro.
 *
 * O número continua existindo — mas só DENTRO da régua, na hora de precificar,
 * e nunca gravado no item. Forma de alvo único mantém alvosMax = 1, que ali é
 * informação de verdade.
 *
 *   node functions/__aplica-geometria-limpa.mjs            (dry-run)
 *   node functions/__aplica-geometria-limpa.mjs --apply
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

const AREA = ['circulo', 'onda', 'cone', 'zona', 'linha', 'retangulo'];
const UNICO = ['unico', 'proprio', 'ponto'];
assert.ok(!AREA.some((f) => UNICO.includes(f)), 'as duas listas não podem se cruzar');

const col = db.collection('system/data/classModules');
const mods = (await col.get()).docs.map((d) => ({ id: d.id, ...d.data() }));
const plano = [];
for (const m of mods) {
    let mexeu = false;
    const itens = (m.itensPredefinidos || []).map((it) => {
        const f = it.formaArea;
        if (AREA.includes(f) && it.alvosMax != null) {
            plano.push(`${it.nome.slice(0, 32).padEnd(34)} ${f.padEnd(10)} alvosMax ${it.alvosMax} → (área manda)`);
            mexeu = true;
            return { ...it, alvosMax: null };
        }
        if (UNICO.includes(f) && it.alvosMax !== 1) {
            plano.push(`${it.nome.slice(0, 32).padEnd(34)} ${f.padEnd(10)} alvosMax ${it.alvosMax ?? '-'} → 1`);
            mexeu = true;
            return { ...it, alvosMax: 1 };
        }
        return it;
    });
    if (mexeu) m._novos = itens;
}
console.log('=== PLANO ===');
plano.forEach((x) => console.log('  ' + x));
console.log(`\n  itens: ${plano.length}   módulos: ${mods.filter((m) => m._novos).length}`);

if (!APLICAR) { console.log('\n(dry-run — nada gravado.)'); process.exit(0); }
const lote = db.batch();
for (const m of mods.filter((x) => x._novos)) lote.update(col.doc(m.id), { itensPredefinidos: m._novos });
await lote.commit();
console.log('\n✅ gravado.');
