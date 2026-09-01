/**
 * Papa-Noite: fecha a [LACUNA] da taxa de crescimento.
 *
 * Decisão do usuário (01/09/2026): a conversão é PROPORCIONAL, sem degrau —
 * drenar 1 de Essência já conta, na razão de 1 para 10 em metro. Consumir 10
 * de uma vez é raro demais para servir de limiar.
 *
 *     1 de Essência drenada  →  +0,1 m de Altura
 *     teto                   →  8 m (o dobro da forma noturna)
 *
 * A Vitalidade vem de graça na cascata que o motor já calcula:
 *
 *     Tamanho    = Altura × 3          +0,1 m  →  +0,3 de Tamanho
 *     Vitalidade = (VIG + Tamanho) × 3            →  +0,9 de Vitalidade Máxima
 *
 * Confere nas duas pontas da escada, com o VIG 2 da ficha:
 *     4 m → Tamanho 12 → (2+12)×3 = 42   ← como ele está
 *     8 m → Tamanho 24 → (2+24)×3 = 78   ← no teto, 40 de Essência depois
 *
 * Fracionário de ponta a ponta é o padrão do sistema: a Régua manda arredondar
 * só na exibição, e o cálculo por trás segue quebrado.
 *
 * O crescimento NÃO mexe no carimbo dele. O dado é o mesmo, o Alvo é o mesmo,
 * a força continua 2,08×. O que cresce é a carne — a punição por lançar magia
 * nele é o combate ficar longo, não ele bater mais forte.
 *
 * ── VERSIONAMENTO ───────────────────────────────────────────────────
 * O CLAUDE.md manda versionar todo cânone alterado, e a ficha dele não tinha
 * campo `versao` nenhum. Primeira gravação nasce em **1.00**, como manda a
 * regra. (Nenhuma das 48 criaturas nem dos 13 capítulos do Bestiário tem
 * versão — está reportado à parte; aqui só o Papa-Noite.)
 *
 *   node functions/papanoite-taxa-azire.mjs            (dry-run)
 *   node functions/papanoite-taxa-azire.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');
const AUTOR = 'igorestevamalvesdesouza@gmail.com';

const TAXA_M = 0.1;      // metros por 1 de Essência drenada
const TETO_M = 8;

const docs = (await db.collection('npcs').get()).docs;
const doc = docs.find(d => (d.data().nome || '') === 'Papa-Noite');
if (!doc) { console.log('❌ "Papa-Noite" não achado'); process.exit(1); }
const n = doc.data();

/* confere a cascata contra a ficha antes de escrever número nenhum */
const VIT = Number(n.valoresDer?.VIT);
const alturaBase = 4;                                   // forma noturna, do comportamento da ficha
const VIG = VIT / 3 - alturaBase * 3;
if (!Number.isFinite(VIG) || Math.abs(VIG - Math.round(VIG)) > 0.01) {
    console.log(`❌ a cascata não fecha: VIT ${VIT} com Altura ${alturaBase} daria VIG ${VIG}`); process.exit(1);
}
const vitEm = m => (VIG + m * 3) * 3;
const porPonto = vitEm(alturaBase + TAXA_M) - vitEm(alturaBase);
const essenciaAteOTeto = Math.round((TETO_M - alturaBase) / TAXA_M);

const br = x => x.toFixed(1).replace('.', ',');
const de = '[LACUNA] Quanto de Essência drenada vale 1 m de Altura, e se há teto de crescimento — a definir.';
const para = `A conversão é PROPORCIONAL, sem degrau: cada 1 de Essência drenada soma ${br(TAXA_M)} m de Altura — drenar 1 já conta. `
    + `Teto de ${TETO_M} m, o dobro da forma noturna. Como Tamanho = Altura × 3 e Vitalidade = (VIG + Tamanho) × 3, `
    + `cada 1 de Essência vale +${br(porPonto)} de Vitalidade Máxima, além da cura. `
    + `Do basal (${br(alturaBase)} m, ${br(vitEm(alturaBase))} de Vitalidade) ao teto (${TETO_M} m, ${br(vitEm(TETO_M))}) são ${essenciaAteOTeto} de Essência. `
    + `Crescer não muda o dado dele: não bate mais forte, dura mais.`;

const atq = String(n.ataques || '');
if (!atq.includes(de)) { console.log('❌ a [LACUNA] esperada não está no texto — confira à mão:\n' + atq); process.exit(1); }
const depois = atq.replace(de, para);

const versaoAntes = n.versao;
const versaoDepois = versaoAntes === undefined ? '1.00'
    : (Number(String(versaoAntes).replace(',', '.')) + 0.01).toFixed(2);

console.log(`\n=== Papa-Noite · taxa de crescimento  [${doc.id}] ===\n`);
console.log(`   cascata conferida na ficha: VIT ${VIT} = (VIG ${VIG} + Altura ${alturaBase}×3) × 3 ✓\n`);
console.log('   Essência drenada   Altura   Tamanho   Vitalidade Máxima');
for (const e of [0, 10, 20, 30, essenciaAteOTeto]) {
    const m = alturaBase + e * TAXA_M;
    console.log(`   ${String(e).padStart(9)}${e === essenciaAteOTeto ? ' (teto)' : '       '}   ${br(m).padStart(5)} m   ${br(m * 3).padStart(6)}   ${br(vitEm(m)).padStart(14)}`);
}
console.log(`\n   de:   ${de}`);
console.log(`\n   para: ${para.replace(/(.{92}\S*)\s/g, '$1\n         ')}`);
console.log(`\n   versao: ${versaoAntes === undefined ? '(não tinha) → 1.00, como manda o CLAUDE.md' : `${versaoAntes} → ${versaoDepois}`}`);

if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }
await doc.ref.update({ ataques: depois, versao: versaoDepois,
    lastUpdate: new Date().toISOString(), lastUpdateBy: AUTOR });
console.log('\n✅ gravado.');
process.exit(0);
