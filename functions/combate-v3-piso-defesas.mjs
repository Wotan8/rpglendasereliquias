/**
 * Combate v3 — piso 0 nas oito Defesas.
 *
 * As Defesas nascem de "Reação + perícia − 1": quem não tem a perícia fica com
 * −1 na ficha, e um número negativo não quer dizer nada — o atacante já vence
 * com 0 Graus de Sucesso. A defesa mínima é 0.
 *
 * Não entra mecânica nova: o limite do sistema que carrega teto e piso juntos
 * é o 'clamp' (o engine só guarda UM limite por alvo, então dois docs — teto e
 * piso — se atropelariam). As mecânicas "Defesa: X (teto)" viram 'clamp' com
 * valorMinimo 0 e passam a se chamar "(limites)".
 *
 *   node functions/combate-v3-piso-defesas.mjs            (dry-run)
 *   node functions/combate-v3-piso-defesas.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');

const agora = admin.firestore.Timestamp.now();
const grab = async c => (await db.collection(`system/data/${c}`).get()).docs.map(d => ({ id: d.id, ...d.data() }));
const [vds, mecs] = await Promise.all([grab('derivedValues'), grab('mechanics')]);

const defesas = vds.filter(v => v.nome.startsWith('Defesa: '));
const erros = [];
if (defesas.length !== 8) erros.push(`esperava 8 VDs "Defesa: ...", achei ${defesas.length}`);

const alvos = defesas.map(vd => {
    const mec = mecs.find(m => m.nome === `${vd.nome} (teto)` || m.nome === `${vd.nome} (limites)`);
    if (!mec) { erros.push(`sem mecânica de limite para "${vd.nome}"`); return null; }
    const calc = (mec.config?.calculos || [])[0];
    if (!calc) { erros.push(`"${mec.nome}" sem cálculo`); return null; }
    if (calc.tipoLimite === 'clamp' && Number(calc.valorMinimo) === 0) return { vd, mec, calc, jaFeito: true };
    if (calc.tipoLimite !== 'maximo') { erros.push(`"${mec.nome}" não é teto (${calc.tipoLimite})`); return null; }
    return { vd, mec, calc, jaFeito: false };
}).filter(Boolean);

console.log('='.repeat(72));
console.log('COMBATE v3 — piso 0 nas Defesas');
console.log('='.repeat(72) + '\n');
for (const { vd, mec, jaFeito } of alvos) {
    console.log(`  ${vd.nome.padEnd(20)} ${jaFeito ? 'já tem piso 0' : `${mec.nome} → clamp [0 .. teto atual]`}`);
}
if (erros.length) { console.error('\n🔴 ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
if (!APPLY) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

const batch = db.batch();
let n = 0;
for (const { vd, mec, calc } of alvos.filter(a => !a.jaFeito)) {
    const tetoTexto = (mec.previewTexto || '').replace(/^.*máximo\s*/i, '') || 'o teto';
    batch.update(db.doc(`system/data/mechanics/${mec.id}`), {
        nome: mec.nome.replace('(teto)', '(limites)'),
        descricao: `${mec.descricao} Nenhuma defesa fica negativa: o piso é 0.`,
        previewTexto: `${vd.nome}: entre 0 e ${tetoTexto}`,
        config: { calculos: [{ ...calc, tipoLimite: 'clamp', valorMinimo: 0 }] },
        atualizadoEm: agora,
    });
    batch.update(db.doc(`system/data/derivedValues/${vd.id}`), {
        descricao: `${vd.descricao} Nunca fica abaixo de 0.`,
        updatedAt: agora, atualizadoEm: agora,
    });
    n++;
}
await batch.commit();
console.log(`\n✅ ${n} Defesa(s) com piso 0.`);
process.exit(0);
