/**
 * Tudo do Caçador: módulos, o "Marcar Presa", e o VD Marca de Caça.
 * Só leitura.
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({
    credential: admin.credential.cert(
        require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')),
});
const db = admin.firestore();

const RE = /ca[çc]ador|presa|marca de ca[çc]a|marcar/i;

console.log('══════ CLASSES ══════');
for (const d of (await db.collection('system/data/classes').get()).docs) {
    const x = d.data();
    if (!RE.test(x.nome || '')) continue;
    console.log(`${x.nome} [${d.id}]`);
    console.log('  módulos:', JSON.stringify(x.modulos || x.moduleIds || x.classModuleIds || '—'));
}

console.log('\n══════ MÓDULOS DE CLASSE ══════');
for (const d of (await db.collection('system/data/classModules').get()).docs) {
    const m = d.data();
    if (!RE.test(JSON.stringify(m).slice(0, 4000))) continue;
    console.log('─'.repeat(74));
    console.log(`${m.nome || '(sem nome)'}  [${d.id}]  tipo=${m.tipo}  itens=${(m.itensPredefinidos || []).length}`);
    console.log('  schema:', (m.schema || []).map(f => `${f.key}:"${f.label}"(${f.tipo})`).join(' · '));
    for (const it of m.itensPredefinidos || []) {
        console.log(`  · ${it.nome}`);
        console.log(`    valores: ${JSON.stringify(it.valores)}`);
        console.log(`    mira=${JSON.stringify(it.mira || null)} regua=${JSON.stringify(it.regua || null)} acao=${it.custoAcao || '—'}`);
        console.log(`    forma=${it.formaArea} tam=${it.tamanhoArea} alcance=${it.alcance} cond=${JSON.stringify(it.condicoesAplicadas || [])}`);
    }
}

console.log('\n══════ VDs ══════');
for (const d of (await db.collection('system/data/derivedValues').get()).docs) {
    const v = d.data();
    if (!/marca de ca[çc]a|presa/i.test(v.nome || '')) continue;
    console.log('─'.repeat(74));
    console.log(`${v.icone || ''} ${v.nome}  [${d.id}]  key=${v.key || '—'}`);
    console.log(`  bloco=${v.blocoNome} · campoAtual=${v.campoAtual} · statusCombate=${v.statusCombate}`);
    console.log(`  ${String(v.descricao || '').replace(/\s+/g, ' ').slice(0, 400)}`);
    console.log(`  mecanicaIds=${JSON.stringify(v.mecanicaIds || [])}`);
}
process.exit(0);
