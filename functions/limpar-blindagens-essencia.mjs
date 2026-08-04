/**
 * Remove as 13 "Blindagem <Essência>" e cria uma "Blindagem Arcana".
 *
 * Elas foram criadas antes de fecharmos que o Reforço Arcano é GERAL — protege
 * contra qualquer Essência. Com isso, um canal de defesa por Essência deixou de
 * ter função: a fraqueza contra uma Essência é propriedade da PEÇA (contra ela,
 * o Reforço Arcano conta metade), não um Valor Derivado.
 *
 * Os 13 "Dano <Essência>" continuam: o ATAQUE é tipado, só a defesa não é.
 *
 *   node functions/limpar-blindagens-essencia.mjs            (dry-run)
 *   node functions/limpar-blindagens-essencia.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

const grab = async c => (await db.collection(`system/data/${c}`).get()).docs.map(d => ({ id: d.id, ...d.data() }));
const [vds, eq, mecs] = await Promise.all([grab('derivedValues'), grab('equipment'), grab('mechanics')]);

const alvos = vds.filter(v => /^Blindagem .+/.test(v.nome || '') && v.nome !== 'Blindagem Arcana');
console.log(`Blindagens por Essência encontradas: ${alvos.length}`);
if (alvos.length !== 13) { console.error('🔴 esperava 13. Abortando.'); process.exit(1); }

/* --- ninguém pode estar usando --- */
const ids = new Set(alvos.map(a => a.id));
const nomes = new Set(alvos.map(a => a.nome));
const itensUsando = eq.filter(e => (e.valoresDerivadosVinculados || []).some(v => ids.has(v.id)));
const mecsUsando = mecs.filter(m => nomes.has(m.alvo) || JSON.stringify(m).includes('Blindagem Vermelha')
    || [...nomes].some(n => JSON.stringify(m).includes(n)));
console.log(`  itens que vinculam alguma: ${itensUsando.length}`);
console.log(`  mecânicas que citam alguma: ${mecsUsando.length}`);
if (itensUsando.length || mecsUsando.length) {
    console.error('🔴 alguém ainda usa. Abortando.');
    for (const i of itensUsando) console.error(`   item: ${i.nome}`);
    for (const m of mecsUsando) console.error(`   mecânica: ${m.nome}`);
    process.exit(1);
}
for (const a of alvos) console.log(`  − ${a.nome}`);

/* --- a que fica no lugar --- */
const jaTem = vds.find(v => v.nome === 'Blindagem Arcana');
const blFisica = vds.find(v => v.nome === 'Blindagem');
if (!blFisica) { console.error('🔴 VD "Blindagem" não encontrado.'); process.exit(1); }
console.log(`\n  + Blindagem Arcana ${jaTem ? '(JÁ EXISTE, não recria)' : `(no bloco ${blFisica.blocoNome}, ao lado da física)`}`);

if (!APLICAR) { console.log('\n(dry-run — nada gravado. Use --apply.)'); process.exit(0); }

const col = db.collection('system/data/derivedValues');
const batch = db.batch();
for (const a of alvos) batch.delete(col.doc(a.id));
if (!jaTem) {
    const agora = admin.firestore.Timestamp.now();
    batch.set(col.doc(), {
        nome: 'Blindagem Arcana', icone: '✨',
        descricao: 'Subtrai do dano de Essência, seja qual for a Essência — o Reforço Arcano do '
            + 'forjarcanista protege contra todas. Contra a Essência a que a peça cede, conta metade '
            + '(Livro de Regras, 5.4). Não substitui a Blindagem, que barra só o dano físico.',
        ordem: (blFisica.ordem ?? 3) + 1,
        escopoItem: '', arredondaMesa: true, todoPersonagem: false,
        blocoId: blFisica.blocoId, blocoNome: blFisica.blocoNome, blocoOrdem: blFisica.blocoOrdem,
        prefixo: '', sufixo: '', mecanicaIds: [],
        campoAtual: false, campoEditavel: false, statusCombate: false,
        characterCreationRule: false, characterCreationMin: null, characterCreationMax: null,
        publicado: true, criadoPor: blFisica.criadoPor, criadoEm: agora, createdAt: agora, updatedAt: agora, versao: 1
    });
}
await batch.commit();
console.log(`\n✅ ${alvos.length} removidas${jaTem ? '' : ' · Blindagem Arcana criada'}.`);
process.exit(0);
