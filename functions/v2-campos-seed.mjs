/**
 * Grava `config/campos` a partir do padrão em shared/campos-cadastro.js (só o que falta).
 *   node functions/v2-campos-seed.mjs            (dry-run)
 *   node functions/v2-campos-seed.mjs --apply
 */
import { createRequire } from 'node:module';
import { CAMPOS_PADRAO, mesclarCampos } from '../shared/campos-cadastro.js';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');
const ref = db.doc('config/campos');
const snap = await ref.get();
const atual = snap.exists ? snap.data() : null;
const novo = mesclarCampos(atual || {});
const entram = [];
for (const [col, blocos] of Object.entries(CAMPOS_PADRAO)) {
    if (col === 'versao') continue;
    for (const bloco of Object.keys(blocos)) if (!atual || !atual[col] || !atual[col][bloco]) entram.push(`${col}.${bloco} (${blocos[bloco].length} campos)`);
}
console.log(`${APPLY ? 'APLICANDO' : 'DRY-RUN'} — config/campos ${atual ? 'existe' : 'não existe'}; blocos que entram: ${entram.join(', ') || 'nenhum'}`);
if (APPLY) { await ref.set({ ...novo, updatedAt: Date.now() }); console.log('gravado config/campos'); }
process.exit(0);
