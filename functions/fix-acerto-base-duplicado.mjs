/**
 * BUG: o Acerto era contado duas vezes em toda arma.
 *
 * O VD `Acerto` é o balde de modificador GENÉRICO (peculiaridade, condição,
 * escudo) — é assim que os VDs irmãos o descrevem, e é assim que o Escudo de
 * Torre e o Escudo Grande já o usam (modificador −2 e −1, escopo global).
 *
 * Só que ele carregava uma mecânica `Acerto (base)` somando
 * `maior(FOR, DES) + Perícia: Arma`. E a Equação de Valor de cada arma soma
 * `FOR + Perícia: Arma + Acerto`. O atributo e a perícia entravam pelos dois
 * caminhos:
 *
 *     item:  FOR + Arma + Acerto
 *     Acerto: maior(FOR, DES) + Arma
 *     total: 2 × (FOR + Arma)
 *
 * Caso real relatado: Machadinha com Acerto base 8 mostrando 16 na aba Combate.
 * Atinge as 62 armas cujas equações puxam o termo `Acerto`.
 *
 * Correção: a mecânica sai do VD e é aposentada (mesmo tratamento dado à
 * mecânica de Reação no combate v3). A base volta a ser 0, que é o que a
 * própria descrição do campo já promete.
 *
 *   node functions/fix-acerto-base-duplicado.mjs            (dry-run)
 *   node functions/fix-acerto-base-duplicado.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');

const VD_ACERTO = 'hmHQhKsFs03T9ixGVy8b';
const MEC_BASE = 'l88wWsEEGZZa6TxV3NEH';

const DESC_NOVA =
    'Modificador GENÉRICO de acerto, que vale para todos os tipos de entrega. '
    + 'A BASE aqui é 0 — o atributo e a perícia de cada arma saem da Equação de Valor '
    + 'montada no próprio item, no cadastro de Equipamentos, e a equação puxa este valor '
    + 'pelo termo "Acerto". Aqui entram só peculiaridade, condição, classe, raça e escudo '
    + '(Escudo Grande −1, Escudo de Torre −2). O total com cada arma aparece na aba Combate, '
    + 'em "Ataques e Efeitos Ativos".';

const colVD = db.collection('system/data/derivedValues');
const colMec = db.collection('system/data/mechanics');

const [vdSnap, mecSnap, eqSnap] = await Promise.all([
    colVD.doc(VD_ACERTO).get(), colMec.doc(MEC_BASE).get(),
    db.collection('system/data/equipment').get(),
]);

const erros = [];
if (!vdSnap.exists) erros.push(`VD Acerto (${VD_ACERTO}) não encontrado`);
if (!mecSnap.exists) erros.push(`mecânica Acerto (base) (${MEC_BASE}) não encontrada`);

const vd = vdSnap.data() || {};
const mec = mecSnap.data() || {};
if (vd.nome !== 'Acerto') erros.push(`o VD ${VD_ACERTO} se chama "${vd.nome}", esperado "Acerto"`);
if (!(vd.mecanicaIds || []).includes(MEC_BASE)) erros.push('o VD Acerto não aponta para a mecânica base — já foi corrigido?');

/* A mecânica só pode estar presa a este VD. Se outro doc a usa, parar. */
const outros = [];
for (const c of ['derivedValues', 'skills', 'peculiarities', 'races', 'classes', 'conditions', 'equipment', 'classModules']) {
    let s; try { s = await db.collection(`system/data/${c}`).get(); } catch (e) { continue; }
    for (const d of s.docs) {
        if (d.id === VD_ACERTO) continue;
        if (JSON.stringify(d.data()).includes(MEC_BASE)) outros.push(`${c}/${d.data().nome || d.id}`);
    }
}
if (outros.length) erros.push(`a mecânica é usada por outros documentos: ${outros.join(', ')}`);

/* Quantas armas são afetadas. */
const TIPADOS = ['20CCFbc4ngJIOorNb9K0', 'N1JLG2HeKHOL9UEzrQU4', 'H9VopkYPpDz3MXssdHP9', '2XFDxbiiu22nJ76qrOzd'];
let dobradas = 0, semTermo = 0;
for (const d of eqSnap.docs) {
    const vs = (d.data().valoresDerivadosVinculados || []).filter(v => TIPADOS.includes(v.id));
    if (!vs.length) continue;
    if (JSON.stringify(vs).includes('"Acerto"')) dobradas++; else semTermo++;
}

console.log('='.repeat(72));
console.log('BUG: Acerto contado duas vezes');
console.log('='.repeat(72));
console.log(`\nVD .......... ${vd.nome} (${VD_ACERTO})`);
console.log(`Mecânica .... ${mec.nome} — ${mec.previewTexto}`);
console.log(`Equação ..... ${JSON.stringify(mec.config)}`);
console.log(`\nArmas afetadas (equação puxa o termo "Acerto"): ${dobradas}`);
console.log(`Focos/armas que NÃO puxam o termo (bug separado, não tocado): ${semTermo}`);
console.log(`\nDepois da correção:`);
console.log(`  Acerto (base) .......... 0  + peculiaridade/condição/classe/raça/escudo`);
console.log(`  Machadinha do relato ... 16 → 8`);
console.log(`\nA mecânica é aposentada (publicado=false, config vazia), não apagada —`);
console.log(`mesmo tratamento dado à mecânica de Reação no combate v3.`);

if (erros.length) { console.error('\n🔴 ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
console.log('\n✅ auto-verificação: a mecânica está presa só ao VD Acerto; nada mais depende dela.');

if (!APPLY) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

const agora = admin.firestore.Timestamp.now();
const batch = db.batch();
batch.update(colVD.doc(VD_ACERTO), {
    mecanicaIds: (vd.mecanicaIds || []).filter(id => id !== MEC_BASE),
    descricao: DESC_NOVA, updatedAt: agora, atualizadoEm: agora,
});
batch.update(colMec.doc(MEC_BASE), {
    publicado: false,
    nome: 'Acerto (base) — APOSENTADA: duplicava o atributo e a perícia que a arma já soma',
    previewTexto: 'aposentada',
    config: { calculos: [] },
    atualizadoEm: agora,
});
await batch.commit();
console.log('\n✅ Gravado: Acerto voltou a ser base 0; mecânica aposentada.');
process.exit(0);
