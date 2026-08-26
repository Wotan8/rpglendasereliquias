// SÓ LEITURA — retrato de peso/tamanho do catálogo de items (sem characterId).
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();

const snap = await db.collection('system/data/equipment').get();
const cat = [];
snap.forEach(d => {
    const x = d.data();
    cat.push({ id: d.id, nome: x.nome || x.name, tipo: x.tipo, peso: x.peso, tamanho: x.tamanho, pressaoBase: x.pressaoBase, liga: x.liga, integridadeBase: x.integridadeBase });
});
console.log(`catálogo system/data/equipment: ${cat.length} peças\n`);

const n = v => (v == null || v === '' ? null : Number(v));
const buckets = (vals, cortes) => {
    const b = {}; let faltam = 0;
    for (const v of vals) {
        if (v == null || !Number.isFinite(v)) { faltam++; continue; }
        const c = cortes.find(([, max]) => v <= max);
        b[c[0]] = (b[c[0]] || 0) + 1;
    }
    return { b, faltam };
};

for (const campo of ['peso', 'tamanho']) {
    const vals = cat.map(x => n(x[campo]));
    const { b, faltam } = buckets(vals, [
        ['=0', 0], ['(0, 0.1]', 0.1], ['(0.1, 0.5]', 0.5], ['(0.5, 1)', 0.999999],
        ['=1', 1], ['(1, 2]', 2], ['(2, 5]', 5], ['(5, 20]', 20], ['>20', Infinity],
    ]);
    console.log(`${campo.toUpperCase()} — faixas:`);
    for (const [k, v] of Object.entries(b)) console.log(`  ${k.padEnd(10)} ${v}`);
    if (faltam) console.log(`  (vazio)    ${faltam}`);
    console.log('');
}

// suspeitos: exatamente 1 (o default do formulário) — provável "não preenchido de verdade"
const p1t1 = cat.filter(x => n(x.peso) === 1 && n(x.tamanho) === 1);
console.log(`peso=1 E tamanho=1 (default do form): ${p1t1.length}`);

// integridade: quantos derivam de (Liga+Tamanho)×3 — mexer no tamanho move isto
const derivam = cat.filter(x => !(n(x.integridadeBase) > 0));
console.log(`integridade DERIVADA de (Liga+Tamanho)×3: ${derivam.length} de ${cat.length}`);

// pressaoBase preenchida (peso efetivo ao equipar difere do peso)
const comPressao = cat.filter(x => x.pressaoBase != null && x.pressaoBase !== '');
console.log(`pressaoBase preenchida: ${comPressao.length}\n`);

// tipos
const porTipo = {};
for (const x of cat) porTipo[x.tipo || '(sem tipo)'] = (porTipo[x.tipo || '(sem tipo)'] || 0) + 1;
console.log('por tipo:', JSON.stringify(porTipo), '\n');

// amostra dos extremos e dos "redondos demais"
const fmt = x => `  ${String(x.nome).padEnd(34)} peso=${x.peso} tam=${x.tamanho} (${x.tipo || '—'})`;
console.log('10 mais pesados:');
[...cat].filter(x => n(x.peso) != null).sort((a, b) => n(b.peso) - n(a.peso)).slice(0, 10).forEach(x => console.log(fmt(x)));
console.log('\n10 mais leves (>0):');
[...cat].filter(x => n(x.peso) > 0).sort((a, b) => n(a.peso) - n(b.peso)).slice(0, 10).forEach(x => console.log(fmt(x)));
console.log('\n15 primeiros com peso=1 e tamanho=1:');
p1t1.slice(0, 15).forEach(x => console.log(fmt(x)));
process.exit(0);
