/**
 * Dissonância deixou de existir no sistema (decisão do mestre, 14/08/2026).
 * Tira as três aparições que a varredura achou — nenhuma tinha VD, condição
 * ou mecânica por trás; era só prosa e dois números soltos:
 *
 *   1. peculiarities/Sonoromancia — o bullet de risco/lore inteiro.
 *   2. classModules/sonoro_c5 → A SINFONIA — "Após o fim: +3 Dissonância."
 *   3. classModules/sonoro_c5 → HARMONIA DAS ESFERAS — só a frase da
 *      Dissonância; "Falha Crítica: a zona se inverte" fica, é outra regra.
 *
 *   node functions/__remove-dissonancia.mjs            (dry-run)
 *   node functions/__remove-dissonancia.mjs --apply
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

function mostrar(rotulo, antes, depois) {
    if (antes === depois) { console.log(`   = ${rotulo} já sem Dissonância`); return false; }
    console.log(`   ↻ ${rotulo}`);
    console.log(`     antes: ${antes.replace(/\s+/g, ' ').slice(-160)}`);
    console.log(`     depois: ${depois.replace(/\s+/g, ' ').slice(-160)}`);
    return true;
}

let mudou = 0;

/* ═══ 1. Peculiaridade Sonoromancia ═══ */
const pecRef = db.doc('system/data/peculiarities/1WpcMGanUQNoEtwzXuL2');
const pec = (await pecRef.get()).data();
const descAntes = pec.descricao;
const descDepois = descAntes
    .replace(/\n- A prática carrega o risco letal da Dissonância:[^\n]*/i, '')
    .trimEnd();
if (mostrar('peculiarities/Sonoromancia.descricao', descAntes, descDepois)) {
    mudou++;
    if (APLICAR) await pecRef.update({ descricao: descDepois, versao: (pec.versao || 1) + 1, updatedAt: agora() });
}

/* ═══ 2 e 3. Módulo sonoro_c5 ═══ */
const modRef = db.doc('system/data/classModules/sonoro_c5');
const mod = (await modRef.get()).data();
const itens = (mod.itensPredefinidos || []).map(it => {
    const v10Antes = it.valores?.['10'] || '';
    if (!/dissonância/i.test(v10Antes)) return it;
    const v10Depois = v10Antes
        .replace(/\s*Após o fim: [+]?\d+\s*Dissonância\.?/i, '')
        .trim();
    mostrar(`sonoro_c5 → ${it.nome}`, v10Antes, v10Depois);
    mudou++;
    return { ...it, valores: { ...it.valores, '10': v10Depois }, descricao: v10Depois };
});
if (APLICAR) await modRef.update({ itensPredefinidos: itens, updatedAt: agora() });

console.log(`\n${mudou} campo(s) a mudar`);
console.log(APLICAR ? '✅ APLICADO' : '🔍 dry-run — rode com --apply para gravar');
process.exit(0);
