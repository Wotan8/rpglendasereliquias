/**
 * Grava o documento `config/regras` a partir do padrão em shared/regras-padrao.js.
 * Chaves que já existem no doc são preservadas (o Criador pode ter editado); só
 * as que faltam entram. Versão sobe um centésimo se algo entrou.
 *
 *   node functions/v2-regras-seed.mjs            (dry-run)
 *   node functions/v2-regras-seed.mjs --apply
 */
import { createRequire } from 'node:module';
import { REGRAS_PADRAO, mesclarRegras } from '../shared/regras-padrao.js';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');

const ref = db.doc('config/regras');
const snap = await ref.get();
const atual = snap.exists ? snap.data() : null;
const novo = mesclarRegras(atual || {});          // padrão por baixo, doc por cima
const faltavam = [];
const walk = (p, d, pref = '') => { for (const k of Object.keys(p)) { const c = pref ? `${pref}.${k}` : k; if (!d || d[k] === undefined) faltavam.push(c); else if (p[k] && typeof p[k] === 'object' && !Array.isArray(p[k])) walk(p[k], d[k], c); } };
walk(REGRAS_PADRAO, atual);
const sobe = s => { const n = Math.round((parseFloat(s) || 1) * 100) + 1; return (n / 100).toFixed(2); };
if (atual && faltavam.length) novo.versao = sobe(atual.versao);
console.log(`${APPLY ? 'APLICANDO' : 'DRY-RUN'} — config/regras ${atual ? 'existe (v' + atual.versao + ')' : 'não existe'}; chaves que entram: ${faltavam.length}`);
for (const f of faltavam.slice(0, 80)) console.log('  + ' + f);
if (APPLY) { await ref.set({ ...novo, updatedAt: Date.now() }); console.log(`gravado config/regras v${novo.versao}`); }
process.exit(0);
