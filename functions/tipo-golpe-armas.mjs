/**
 * Frente 1 — a arma passa a declarar que tipo de golpe entrega.
 *
 * O alvo já tem três Blindagens físicas tipadas (bloco "Blindagem por Golpe":
 * Cortante, Perfurante, Contundente, todas espelhando `Blindagem`), e o Livro
 * §5.4 promete que "se a arma for do tipo a que a armadura cede, vale a
 * Blindagem reduzida". Só que NENHUMA arma dizia qual tipo entrega — a metade
 * ofensiva do sistema nunca foi ligada.
 *
 * Este script grava `tipoGolpe` nas armas, deduzido da família (tag). A ficha
 * passa a exibir o tipo ao lado do dano, na tabela de Ataques e no detalhe do
 * item (item-scope-calc.js + inventory.js).
 *
 *   node functions/tipo-golpe-armas.mjs            (dry-run)
 *   node functions/tipo-golpe-armas.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');

const VD_DANO = 'JYISs9MKSNeQ9MdJzkyT';

/* família (tag) → tipo de golpe. Ordem importa: a primeira que casar vence. */
const POR_TAG = [
    ['cortante', ['Espada', 'Machado', 'Foice']],
    ['perfurante', ['Adaga', 'Haste', 'Flecha', 'Virote', 'Arco', 'Besta', 'Zarabatana']],
    ['contundente', ['Impacto', 'Bengala']],
];

/* Exceções por nome, quando a família não conta a história toda. */
const POR_NOME = {
    // Bolas: o que derruba é o peso girando, não a ponta.
    'Boleadeira': 'contundente',
    // Livro §6.3: "Adaga, faca, estoque e sabre são lâminas de ponta e pulso".
    // O estoque fura; o sabre corta (fica na regra da família).
    'Estoque': 'perfurante',
};

const snap = await db.collection('system/data/equipment').get();
const armas = snap.docs
    .map(d => ({ _ref: d.ref, id: d.id, ...d.data() }))
    .filter(e => (e.valoresDerivadosVinculados || []).some(v => v.id === VD_DANO));

const porTipo = { cortante: [], perfurante: [], contundente: [] };
const semTipo = [], jaTinha = [];

for (const a of armas) {
    if (a.tipoGolpe) { jaTinha.push(`${a.nome} (${a.tipoGolpe})`); continue; }
    const tags = a.tags || [];
    let tipo = POR_NOME[a.nome]
        || (POR_TAG.find(([, ts]) => ts.some(t => tags.includes(t))) || [])[0];
    if (!tipo) { semTipo.push(`${a.nome} ${JSON.stringify(tags)}`); continue; }
    porTipo[tipo].push(a);
}

console.log('='.repeat(72));
console.log('TIPO DE GOLPE NAS ARMAS');
console.log('='.repeat(72));
console.log(`\n${armas.length} itens com equação de Dano.\n`);
const ICONES = { cortante: '🗡️', perfurante: '🏹', contundente: '🔨' };
for (const [tipo, lista] of Object.entries(porTipo)) {
    console.log(`${ICONES[tipo]} ${tipo.toUpperCase()} (${lista.length}) — barrado pela Blindagem ${tipo[0].toUpperCase() + tipo.slice(1)}`);
    console.log('   ' + lista.map(a => a.nome).join(' · '));
    console.log('');
}
if (jaTinha.length) console.log(`Já tinham tipo (${jaTinha.length}): ${jaTinha.join(', ')}\n`);

const erros = [];
if (semTipo.length) {
    console.log(`⚠ SEM FAMÍLIA RECONHECIDA (${semTipo.length}):`);
    semTipo.forEach(s => console.log('   ' + s));
    erros.push(`${semTipo.length} arma(s) sem tipo — acrescente a família em POR_TAG ou o nome em POR_NOME`);
}
const total = Object.values(porTipo).reduce((s, l) => s + l.length, 0);
if (total + jaTinha.length !== armas.length) erros.push(`${armas.length} armas mas ${total + jaTinha.length} classificadas`);

if (erros.length) { console.error('\n🔴 ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
console.log(`✅ auto-verificação: ${total} armas classificadas, nenhuma sobrou.`);

if (!APPLY) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

const agora = Date.now();
const batch = db.batch();
for (const [tipo, lista] of Object.entries(porTipo))
    for (const a of lista) batch.update(a._ref, { tipoGolpe: tipo, updatedAt: agora });
await batch.commit();
console.log(`\n✅ Gravado: ${total} armas com tipo de golpe.`);
process.exit(0);
