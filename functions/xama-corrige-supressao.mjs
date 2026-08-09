/**
 * Duas correções do dono do mundo na Incorporação:
 *
 * 1. O TESTE. Eu escrevi "AUT + Transcendência vs PRS do Eco" — teste
 *    disputado, que não é como a casa resolve isso. O certo é a forma padrão
 *    do sistema: Alvo = AUT + Transcendência, e a PRS do Eco entra como
 *    REDUTOR. Uma rolagem, não duas.
 *
 * 2. O MÓDULO "Ecos" SAI. Eco é NPC — não cabe em módulo de classe. Eco
 *    vinculado ao Totem de Antiqua é ALIADO do Xamã e mora na aba Aliados,
 *    que já existe e já faz exatamente isso (`aliadoProprio` + vínculo).
 *    Criar módulo era duplicar ficha de NPC em campo de texto.
 *
 *   node functions/xama-corrige-supressao.mjs            (dry-run)
 *   node functions/xama-corrige-supressao.mjs --apply
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');
const MOD_ECOS = 'mod_ecos_xama';

const DE_1 = 'SUPRESSÃO — o Eco tentando ficar com o corpo. Role AUT + Transcendência vs PRS do Eco';
const PARA_1 = 'SUPRESSÃO — o Eco tentando ficar com o corpo. Teste: Alvo = AUT + Transcendência,';
const DE_1B = 'na falha crítica, a cada extensão paga, e ao fim de cada cena com Eco Furioso ou';
const PARA_1B = 'com REDUTOR igual à PRS do Eco. Role na falha crítica, a cada extensão paga, e ao fim';
const DE_1C = 'Corrompido. Falhou, sobe um degrau:';
const PARA_1C = 'de cada cena com Eco Furioso ou Corrompido. Falhou, sobe um degrau:';
const DE_2 = '  cena, AUT + Transcendência vs PRS do Eco para voltar ao Nv 2.';
const PARA_2 = '  cena, o mesmo teste (AUT + Transcendência, redutor = PRS do Eco) para voltar ao Nv 2.';
const DE_3 = 'Corrompido. Falhou, sobe um degrau:';

assert.ok(!/vs PRS/.test(PARA_1 + PARA_1B + PARA_2), 'nenhuma sobra de teste disputado');
assert.ok(/REDUTOR igual à PRS/.test(PARA_1B), 'a PRS vira redutor');

const [modsSnap, clsSnap] = await Promise.all(
    ['classModules', 'classes'].map(c => db.collection('system/data/' + c).get()));
const totem = modsSnap.docs.find(d => d.id === 'mod_totem');
const modEcos = modsSnap.docs.find(d => d.id === MOD_ECOS);
const xama = clsSnap.docs.map(d => ({ id: d.id, ...d.data() })).find(c => /Xam/i.test(c.nome || ''));
const erros = [];
if (!totem) erros.push('mod_totem não achado');
if (!xama) erros.push('classe Xamã não achada');

let antes = null, depois = null;
const itens = (totem?.data().itensPredefinidos || []).map(it => {
    if (it.nome !== 'Transcendência — Receptor') return it;
    antes = String(it.descricao || '');
    let t = antes;
    for (const [de, para] of [[DE_1, PARA_1], [DE_1B, PARA_1B], [DE_1C, PARA_1C], [DE_2, PARA_2]]) {
        if (!t.includes(de)) { erros.push(`âncora não achada: "${de.slice(0, 46)}…"`); continue; }
        t = t.replace(de, para);
    }
    depois = t;
    return { ...it, descricao: t, valores: { ...(it.valores || {}), 6: t } };
});
if (!antes) erros.push('ritual Receptor não achado');
if (depois && /vs PRS do Eco/.test(depois)) erros.push('sobrou "vs PRS do Eco" no texto');
if (!modEcos) erros.push(`módulo ${MOD_ECOS} não achado (já removido?)`);
const temNaClasse = (xama?.modulosDaClasse || []).includes(MOD_ECOS);

console.log('=== Correções na Incorporação ===\n');
console.log('1. Teste da Supressão — de disputado para redutor:');
if (depois) for (const l of depois.split('\n')) if (/SUPRESS|REDUTOR|redutor|mesmo teste/.test(l)) console.log('   ' + l);
console.log(`\n2. Módulo "${MOD_ECOS}" apagado${temNaClasse ? ' e desvinculado do Xamã' : ''}.`);
console.log('   Eco vinculado é ALIADO: mora na aba Aliados como NPC, que já existe.');
if (erros.length) { console.error('\n🔴 ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

const agora = admin.firestore.Timestamp.now();
const batch = db.batch();
batch.update(totem.ref, { itensPredefinidos: itens, atualizadoEm: agora });
batch.delete(modEcos.ref);
if (temNaClasse) batch.update(db.collection('system/data/classes').doc(xama.id), {
    modulosDaClasse: (xama.modulosDaClasse || []).filter(m => m !== MOD_ECOS), atualizadoEm: agora,
});
await batch.commit();
console.log('\n✅ Gravado.');
process.exit(0);
