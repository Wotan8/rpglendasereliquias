/**
 * Passos Sombrios — efeito novo, desenho do dono do mundo.
 *
 * ANTES: "Teste DES + Furtividade + Subterfúgio vs Percepção. Sucesso: move
 * até metade do D. Terrestre entrando em modo furtivo."
 *
 * AGORA: custa 1 Ação de MOVIMENTO (não a Padrão) e 1 Energia; move o
 * Deslocamento Terrestre INTEIRO; entra em modo furtivo; e o ônus de não o
 * perder de vista passa para o observador — Percepção com Desvantagem.
 *
 * Três mudanças de fundo:
 *  · cobra a Ação de Movimento, então o Ladino ainda ataca no mesmo turno;
 *  · o teste inverte de lado — quem rola é quem tenta enxergar;
 *  · metade do Deslocamento vira o Deslocamento inteiro.
 *
 * O QUE NÃO ENTRA NO TEXTO: "depois ataca sem chance de reação". Isso é o que
 * o modo furtivo já significa, e é o que o Golpe pelas Costas cobra. Escrever
 * aqui seria a redundância que o audit-redundancia caça — dois pedaços do
 * sistema mandando na mesma coisa.
 *
 *   node functions/passos-sombrios.mjs            (dry-run)
 *   node functions/passos-sombrios.mjs --apply
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');
const MOD = 'manobras_ladino';

const TEXTO = 'Custa 1 Ação de Movimento e 1 Energia. Move o seu Deslocamento Terrestre inteiro e entra em '
    + 'modo furtivo. Quem não quiser perdê-lo de vista testa Percepção com Desvantagem.';

/* ═══ ASSERTS ═══ */
assert.ok(/Ação de Movimento/.test(TEXTO), 'a economia de ação é o coração da mudança');
assert.ok(/Desvantagem/.test(TEXTO), 'o ônus é de quem observa');
/* Não pode reescrever o que o modo furtivo já garante nem o que o Golpe pelas
   Costas cobra — seria redundância (família DUPLICADA / MESMO EIXO). */
assert.ok(!/sem (?:chance de )?rea[çc][ãa]o|dano direto|ignora a Blindagem/i.test(TEXTO),
    'o efeito do modo furtivo mora no Golpe pelas Costas, não aqui');
assert.ok(!/-\s*\d/.test(TEXTO), 'sem modificador numérico solto');
console.log('✅ 4 asserts.\n');

const ref = db.collection('system/data/classModules').doc(MOD);
const snap = await ref.get();
if (!snap.exists) { console.error(`🔴 módulo ${MOD} não achado`); process.exit(1); }
const m = snap.data();
let antes = null;
const itens = (m.itensPredefinidos || []).map(it => {
    if (it.nome !== 'Passos Sombrios') return it;
    antes = String(it.descricao || '');
    return {
        ...it, descricao: TEXTO,
        valores: { ...(it.valores || {}), 5: TEXTO },
        duracaoValor: 1, duracaoUnidade: 'cena', alvosMax: 1,
    };
});
if (!antes) { console.error('🔴 Passos Sombrios não achado'); process.exit(1); }

console.log('=== Passos Sombrios ===\n');
console.log(`  antes: ${antes}`);
console.log(`  agora: ${TEXTO}`);
console.log('\n  Fora do texto de propósito: "ataca sem chance de reação" é a definição do');
console.log('  modo furtivo e o que o Golpe pelas Costas já cobra — escrever aqui seria');
console.log('  a redundância que o auditor caça.');
if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }
await ref.update({ itensPredefinidos: itens, atualizadoEm: admin.firestore.Timestamp.now() });
console.log('\n✅ Gravado.');
process.exit(0);
