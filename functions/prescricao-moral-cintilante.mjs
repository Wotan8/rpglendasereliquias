/**
 * Moral Cintilante I — 0,68× em custo 2, o único fora da faixa com conserto
 * limpo entre os seis que sobraram.
 *
 * A régua oferece três alavancas (duração 1→2 rodadas, alvos 4→6, magnitude
 * ×1,5). Duração de "2 rodadas" não é linguagem de mesa e magnitude ×1,5 num
 * efeito de ±1 não existe. Alvos é a única que cabe na ficção: a luz do Bispo
 * ilumina mais gente.
 *
 *   raio 3m → 6m  e  alvosMax 6   →  ~1,02×
 *
 *   node functions/prescricao-moral-cintilante.mjs            (dry-run)
 *   node functions/prescricao-moral-cintilante.mjs --apply
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

const DE = 'Raio de 3m: inimigos sofrem -1 no Alvo de testes sociais/morais e aliados ganham +1 no Alvo.';
const PARA = 'Raio de 6m: inimigos sofrem -1 no Alvo de testes sociais/morais e aliados ganham +1 no Alvo.';

/* A régua conta 4 para área sobre aliados e não olha o tamanho; quem manda é
   alvosMax quando declarado (alvosDeTipado). Sem ele, dobrar o raio não muda
   número nenhum. */
const ALVOS = 6;
assert.ok(ALVOS > 4, 'tem que subir de fato');
assert.notEqual(DE, PARA);

const snap = await db.collection('system/data/classModules').get();
const erros = []; let alvo = null;
for (const d of snap.docs) {
    const m = d.data();
    const idx = (m.itensPredefinidos || []).findIndex(i => i.nome === 'Moral Cintilante I');
    if (idx < 0) continue;
    const it = m.itensPredefinidos[idx];
    if (Number.isFinite(it.alvosMax)) erros.push(`já tem alvosMax=${it.alvosMax}`);
    const trocas = [];
    let desc = it.descricao || '';
    if (desc.includes(DE)) { desc = desc.replace(DE, PARA); trocas.push('descricao'); }
    const valores = { ...(it.valores || {}) };
    for (const [k, v] of Object.entries(valores))
        if (typeof v === 'string' && v.includes(DE)) { valores[k] = v.replace(DE, PARA); trocas.push(`valores.${k}`); }
    if (!trocas.length) erros.push('texto de origem não achado');
    const itens = [...m.itensPredefinidos];
    itens[idx] = { ...it, descricao: desc, valores, alvosMax: ALVOS, tamanhoArea: 6 };
    alvo = { ref: d.ref, itens, modulo: m.titulo, trocas };
}
if (!alvo) erros.push('Moral Cintilante I não achada');

console.log('=== Moral Cintilante I ===\n');
console.log(`  raio 3m → 6m · alvosMax → ${ALVOS}   (0,68× → ~1,02×)`);
if (alvo) console.log(`  texto: ${alvo.trocas.join(' + ')}  [${alvo.modulo}]`);
if (erros.length) { console.error('\n🔴 ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }
await alvo.ref.update({ itensPredefinidos: alvo.itens, atualizadoEm: admin.firestore.Timestamp.now() });
console.log('\n✅ Gravado.');
process.exit(0);
