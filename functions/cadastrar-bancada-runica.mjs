/**
 * Cadastra os materiais de bancada da Runomancia — as ferramentas e consumíveis
 * que a Bancada do Laboratorium vai reconhecer no inventário.
 *
 * Campo novo por item: `comportamentoMaterial` (a tríade decidida na espec):
 *   consumido    — some no uso, quantidade desconta
 *   desgastavel  — contador `desgaste` na instância; chance de estragar = desgaste ÷ 10
 *   resistente   — só quebra em falha crítica de gravação
 *
 * E `qualidadeMaterial` (0/+1/+2) nas tintas — entra na fórmula de usos.
 * Tag comum: "Bancada Rúnica" — é o que a Bancada consulta.
 *
 *   node functions/cadastrar-bancada-runica.mjs            (dry-run)
 *   node functions/cadastrar-bancada-runica.mjs --apply
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');
const AUTOR = 'M2rZzlQkzxTrrddeFQ10S6zsfX62';
const SLOT_MAO = '6r4QB7jnlln8WpehKzS4';

const ITENS = [
    { nome: 'Pincel de Escripta', comp: 'desgastavel', preco: 15, peso: 0.1,
      desc: 'Pincel de cerdas firmes para traço rúnico. Cada gravação cobra do pelo: com desgaste alto, trocar é mais barato que perder o circuito.' },
    { nome: 'Tinta Rúnica Comum', comp: 'consumido', qual: 0, preco: 5, peso: 0.2, qtd: 5,
      desc: 'Tinta condutiva de fuligem e goma. Faz o traço correr — por poucas ativações.' },
    { nome: 'Tinta Rúnica Fina', comp: 'consumido', qual: 1, preco: 20, peso: 0.2, qtd: 5,
      desc: 'Moída com quartzo claro. Segura a Essência no traço por mais usos (+1 na fórmula da Escripta).' },
    { nome: 'Tinta-Mestra', comp: 'consumido', qual: 2, preco: 80, peso: 0.2, qtd: 3,
      desc: 'A receita que os mestres não escrevem. O traço quase não vaza (+2 na fórmula da Escripta).' },
    { nome: 'Papel de Gravação', comp: 'consumido', preco: 2, peso: 0.05, qtd: 10,
      desc: 'Folha prensada que aceita circuito sem beber a tinta. A superfície barata da Escripta.' },
    { nome: 'Talhadeira Fina', comp: 'desgastavel', preco: 40, peso: 0.5,
      desc: 'Para o detalhe do circuito em pedra e metal. O fio cansa: desgaste alto é convite a traço torto.' },
    { nome: 'Talhadeira Pesada', comp: 'resistente', preco: 90, peso: 1.5,
      desc: 'A ferramenta de abrir canal. Só quebra em falha crítica — e aí quebra junto com o resto.' },
    { nome: 'Agulhas Rituais', comp: 'consumido', preco: 25, peso: 0.1, qtd: 5,
      desc: 'Agulhas de osso e prata para a Tatuagem Rúnica. Descartadas a cada trabalho — pele não perdoa agulha rombuda.' },
];

assert.ok(ITENS.every(i => ['consumido', 'desgastavel', 'resistente'].includes(i.comp)));
assert.equal(ITENS.filter(i => i.qual != null).length, 3, 'as três tintas têm qualidade');
console.log('✅ 2 asserts passaram.\n');

const col = db.collection('system/data/equipment');
const eq = (await col.get()).docs.map(d => ({ id: d.id, ...d.data() }));
const colisao = ITENS.filter(i => eq.some(e => e.nome === i.nome));
console.log('=== Materiais de bancada ===\n');
for (const i of ITENS) {
    console.log(`  ${i.nome.padEnd(20)} ${i.comp.padEnd(12)} ${i.qual != null ? `qualidade +${i.qual} ` : ''}${i.preco} L$`);
}
if (colisao.length) { console.error(`\n🔴 ABORTADO: já existem: ${colisao.map(c => c.nome).join(', ')}`); process.exit(1); }
if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

const agora = admin.firestore.Timestamp.now();
const batch = db.batch();
for (const i of ITENS) {
    batch.set(col.doc(), {
        nome: i.nome, tipo: 'Objeto',
        tags: ['Bancada Rúnica', 'Runomancia', i.comp === 'consumido' ? 'Consumível de bancada' : 'Ferramenta'],
        comportamentoMaterial: i.comp,
        ...(i.qual != null ? { qualidadeMaterial: i.qual } : {}),
        descricao: i.desc, peso: i.peso, tamanho: 1, quantidade: i.qtd ?? 1, preco: i.preco,
        formaEquipar: 'segurar', equipavelEm: [SLOT_MAO],
        formulaDano: '', liga: '', pressaoBase: null, multiplicadorPressao: null,
        ehContainer: false, capacidadeContainer: null, pesoMaximoContainer: null,
        mecanicaIds: [], imagemUrl: '', publicado: true, versao: 1,
        criadoPor: AUTOR, criadoEm: agora, atualizadoEm: agora,
    });
}
await batch.commit();
console.log(`\n✅ ${ITENS.length} materiais cadastrados.`);
process.exit(0);
