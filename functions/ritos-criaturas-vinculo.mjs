/**
 * Liga os ritos de invocação às fichas de criatura — campo tipado
 * `criaturasVinculadas: [{ npcId, nome }]` no item do módulo, irmão de
 * `custoEquipamentos` (padrão do passo 7). É o que permite ao Tabuleiro puxar
 * o token da criatura direto do rito, sem busca por nome.
 *
 *   Invocação Abissal      → as 5 respostas da escada de CA
 *   ERGUER FANTOCHES       → Fantoche
 *   RITUAL DE REANIMAÇÃO   → Servo Reanimado
 *   Vínculo Animal         → os 6 domáveis (4 companheiros + Velocirops + Ratazana)
 *
 * Fusão Selvagem e Convocar Manada ficam sem vínculo de propósito: a Fusão usa
 * o aliado já vinculado, e a Manada é economia de cena, sem ficha.
 *
 *   node functions/ritos-criaturas-vinculo.mjs            (dry-run)
 *   node functions/ritos-criaturas-vinculo.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

const MAPA = {
    'Invocação Abissal':    ['Cria Menor do Véu', 'Cria da Fenda', 'Horror Rastejante', 'Horror Maior', 'Entidade da Oitava'],
    'ERGUER FANTOCHES':     ['Fantoche'],
    'RITUAL DE REANIMAÇÃO': ['Servo Reanimado'],
    'Vínculo Animal':       ['Lobo', 'Urso', 'Corvo', 'Serpente', 'Velocirops', 'Ratazana'],
};

const [npcSnap, modSnap] = await Promise.all([
    db.collection('npcs').get(), db.collection('system/data/classModules').get(),
]);
/* Só templates: sem mesa. Evita casar com um "Urso" de campanha no futuro. */
const templates = npcSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(n => !n.mesaId);
const mods = modSnap.docs.map(d => ({ id: d.id, ...d.data() }));

const erros = [], plano = [];
const resolver = nome => {
    const achados = templates.filter(n => n.nome === nome);
    if (achados.length !== 1) { erros.push(`criatura "${nome}": ${achados.length} templates (esperado 1)`); return null; }
    return { npcId: achados[0].id, nome };
};

for (const m of mods) {
    let mexeu = false;
    const itens = (m.itensPredefinidos || []).map(it => {
        const alvo = MAPA[it.nome];
        if (!alvo) return it;
        if (Array.isArray(it.criaturasVinculadas) && it.criaturasVinculadas.length) {
            erros.push(`"${it.nome}" já tem criaturasVinculadas`); return it;
        }
        const refs = alvo.map(resolver).filter(Boolean);
        if (refs.length !== alvo.length) return it;
        mexeu = true;
        plano.push({ modulo: m.titulo, rito: it.nome, refs });
        return { ...it, criaturasVinculadas: refs };
    });
    if (mexeu) m._novos = itens;
}

console.log('=== Ritos → fichas de criatura ===\n');
for (const p of plano) {
    console.log(`  ${p.rito}  (${p.modulo})`);
    console.log(`     → ${p.refs.map(r => r.nome).join(' · ')}`);
}
console.log(`\n  ${plano.length} ritos vinculados · Fusão Selvagem e Convocar Manada de fora, de propósito.`);
if (erros.length) { console.error('\n🔴 ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
if (plano.length !== Object.keys(MAPA).length) { console.error(`\n🔴 ABORTADO: ${plano.length}/${Object.keys(MAPA).length} ritos achados.`); process.exit(1); }

if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }
for (const m of mods.filter(x => x._novos)) {
    await db.collection('system/data/classModules').doc(m.id).update({ itensPredefinidos: m._novos, updatedAt: Date.now() });
}
console.log('\n✅ Gravado.');
process.exit(0);
