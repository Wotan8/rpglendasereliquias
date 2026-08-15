/**
 * A PRESA continua caindo no diálogo de "mira não cadastrada" mesmo com o
 * predefinido correto no banco. Eu simulei a indexação do `carregarSkills` com
 * os dados reais e ela ACHA o predefinido — ou seja, a falha está em algum
 * ponto do runtime que eu não consigo observar daqui (cache de módulo, ordem de
 * carga do registro).
 *
 * Em vez de tentar adivinhar uma quarta vez, uso o caminho que NÃO depende do
 * registro: `mira: it.mira || pd?.mira || ...` lê o ITEM primeiro. Gravando a
 * mira no próprio item da ficha, ela vale mesmo que o predefinido não chegue.
 *
 * Isto conserta quem já tem a skill. O predefinido continua sendo a fonte para
 * quem receber a skill daqui em diante — os dois caminhos ficam de pé.
 *
 *   node functions/__grava-mira-no-item.mjs            (dry-run)
 *   node functions/__grava-mira-no-item.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({
    credential: admin.credential.cert(
        require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')),
});
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

// A mira canônica sai do predefinido — nada é reescrito à mão aqui.
const mod = (await db.doc('system/data/classModules/manobras_cacador').get()).data();
const pd = (mod?.itensPredefinidos || []).find(x => x.id === 'pdi_cacador_presa_1');
if (!pd?.mira) { console.log('ABORTA: predefinido A PRESA sem mira'); process.exit(1); }
console.log('mira canônica do predefinido:');
console.log('  ', JSON.stringify(pd.mira));
console.log('   custoAcao:', pd.custoAcao);

let n = 0;
for (const d of (await db.collection('npcs').get()).docs) {
    const x = d.data();
    if (!Array.isArray(x.modulosClasse)) continue;
    let mudou = false;
    const novos = x.modulosClasse.map(m => {
        if (m.refId !== 'manobras_cacador') return m;
        return {
            ...m,
            itens: (m.itens || []).map(it => {
                if (it._predefId !== 'pdi_cacador_presa_1') return it;
                if (JSON.stringify(it.mira) === JSON.stringify(pd.mira)) return it;
                mudou = true;
                return { ...it, mira: pd.mira, custoAcao: it.custoAcao || pd.custoAcao || 'padrao' };
            }),
        };
    });
    if (!mudou) continue;
    console.log(`   ${x.nome}: mira gravada no item`);
    n++;
    if (APLICAR) await d.ref.update({ modulosClasse: novos, updatedAt: admin.firestore.Timestamp.now() });
}

// Personagens guardam em classModuleData (mapa por refId)
for (const d of (await db.collection('char').get()).docs) {
    const x = d.data();
    const lista = x.classModuleData?.manobras_cacador;
    if (!Array.isArray(lista) || !lista.length) continue;
    let mudou = false;
    const novos = lista.map(it => {
        if (it._predefId !== 'pdi_cacador_presa_1') return it;
        if (JSON.stringify(it.mira) === JSON.stringify(pd.mira)) return it;
        mudou = true;
        return { ...it, mira: pd.mira, custoAcao: it.custoAcao || pd.custoAcao || 'padrao' };
    });
    if (!mudou) continue;
    console.log(`   char/${x.nome || d.id}: mira gravada no item`);
    n++;
    if (APLICAR) await d.ref.update({ 'classModuleData.manobras_cacador': novos });
}

console.log(`\n${n} ficha(s) a mudar`);
console.log(APLICAR ? 'APLICADO no Firestore' : 'dry-run - rode com --apply para gravar');
process.exit(0);
