/**
 * Os três Tetos de Ofício saem da grid da ficha.
 *
 * Eles são encanamento: a Equação de Dano das armas lê o valor pelo `min`,
 * mas o jogador não tem o que fazer com "Teto de Ofício: Braço 3" na tela.
 * Foram cadastrados com todoPersonagem: true e poluíram a aba Combate.
 *
 * Esconder é SEGURO — conferido no código antes de mexer:
 *   • applyDerivedValueMechanics (mechanics-engine.js:1509) percorre
 *     window.DERIVED_VALUES inteiro, então a mecânica "+[FOR] em Teto" roda
 *     mesmo com o VD fora da grid;
 *   • recalcAll (derived-values.js:828) calcula state.derived pela UNIÃO de
 *     _dynamicDerivedKeys com TODOS os VDs, justamente para quem referencia
 *     um VD fora da grid não ler "—".
 * O `min` das 58 armas continua enxergando o teto. Se algum dia esses dois
 * caminhos passarem a filtrar por todoPersonagem, o Domínio para de capar em
 * silêncio — é o que este comentário existe para denunciar.
 *
 *   node functions/tetos-ocultos.mjs            (dry-run)
 *   node functions/tetos-ocultos.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

const ALVOS = ['Teto de Ofício: Braço', 'Teto de Ofício: Precisão', 'Teto de Ofício: Disparo'];

const snap = await db.collection('system/data/derivedValues').get();
const achados = snap.docs.filter(d => ALVOS.includes(d.data().nome));

console.log('\n=== Tetos de Ofício fora da grid da ficha ===\n');
for (const d of achados) {
    const v = d.data();
    console.log(`  ${v.nome.padEnd(26)} todoPersonagem: ${v.todoPersonagem} → false`);
}
console.log(`\nVDs achados : ${achados.length} / ${ALVOS.length}`);

if (achados.length !== ALVOS.length) { console.error('\n🔴 ABORTADO — nem todos os Tetos foram achados.'); process.exit(1); }
if (achados.some(d => d.data().todoPersonagem !== true)) console.log('  (algum já estava false — idempotente)');
if (!APLICAR) { console.log('\n(dry-run — nada gravado. Use --apply.)'); process.exit(0); }

const lote = db.batch();
for (const d of achados) lote.update(d.ref, { todoPersonagem: false });
await lote.commit();
console.log(`\n✅ ${achados.length} VDs escondidos da grid (o cálculo continua).`);
process.exit(0);
