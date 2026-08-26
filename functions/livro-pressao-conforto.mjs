// =============================================
// Textos publicados acompanham a doutrina de conforto (25/08/2026):
// pressão sentida = peso × conforto, faixa ×0,5 (ápice do conforto) a ×1,5
// (ápice do desconforto); o normal é ×1.
//   1. VD Carga (system/data/derivedValues): "roupas não contam" → contam metade.
//   2. Livro do Jogador Cap. 5 §5.9: o bullet de Pressão ganha a faixa.
//
//   node functions/livro-pressao-conforto.mjs            (dry-run)
//   node functions/livro-pressao-conforto.mjs --apply
// =============================================
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

// ── 1. VD Carga ──
const VD_DE = 'Roupas leves e medias não contam para o\ncarregamento de peso, ao contrário de armaduras entre\noutros.';
const VD_PARA = 'O peso que conta é a Pressão: peso × conforto da peça,\nde ×0,5 (roupa vestida, peça bem distribuída ou de luxo\n— sente metade) a ×1,5 (peça desajeitada). Armadura\nvestida distribui a massa, mas paga quase tudo.';

const vdRef = db.collection('system/data/derivedValues').doc('Mmi9h5TRZ6jsyLk3XuEr');
const vd = (await vdRef.get()).data();
if (!vd.descricao.includes(VD_DE)) { console.log('❌ VD Carga: trecho não encontrado — nada gravado.'); process.exit(1); }
console.log('✓ VD Carga: trecho localizado');

// ── 2. Cap. 5 ──
const CAP_DE = '<li><strong>Vestimentas e itens bem distribuídos pressionam menos:</strong> alguns itens têm Pressão menor que o peso real quando vestidos (uma armadura vestida distribui a massa pelo corpo);</li>';
const CAP_PARA = '<li><strong>Vestimentas e itens bem distribuídos pressionam menos:</strong> a Pressão de cada peça é o peso × conforto. Roupa vestida, peça bem distribuída ou de luxo desce até <strong>×0,5</strong> — sente metade do peso; uma armadura vestida distribui a massa pelo corpo e paga quase tudo (×0,9 nas placas ajustadas); peça desajeitada — um caixote, uma armadura cerimonial — sobe até o teto de <strong>×1,5</strong>;</li>';

const capRef = db.collection('worldbuilding-articles').doc('art-regras-jogador-05');
const cap = (await capRef.get()).data();
const n = cap.contentHTML.split(CAP_DE).length - 1;
if (n !== 1) { console.log(`❌ Cap. 5: trecho aparece ${n}× (esperava 1) — nada gravado.`); process.exit(1); }
console.log('✓ Cap. 5: bullet localizado');

const htmlNovo = cap.contentHTML.replace(CAP_DE, CAP_PARA);
const words = htmlNovo.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').trim().split(/\s+/).length;
console.log(`palavras Cap. 5: ${cap.words} → ${words}`);

if (!APLICAR) { console.log('\nDRY-RUN — rode com --apply para gravar.'); process.exit(0); }
const agora = new Date().toISOString();
await vdRef.update({ descricao: vd.descricao.replace(VD_DE, VD_PARA) });
await capRef.update({ contentHTML: htmlNovo, words, atualizadoEm: agora, updatedAt: agora });
console.log('✅ VD Carga e Cap. 5 atualizados.');
process.exit(0);
