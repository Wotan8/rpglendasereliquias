/**
 * Regenera a tabela de proteção do §5.4 A PARTIR DO BANCO.
 *
 * A tabela era digitada à mão e já nasceu com risco de divergir do catálogo —
 * o modelo de preço mudou 32 das 36 peças de uma vez. Gerar do dado resolve a
 * classe inteira de erro: o livro passa a ser um espelho, não uma cópia.
 *
 * Também acerta os dois números do parágrafo de conjunto x avulso, que são
 * somas do próprio catálogo.
 *
 *   node functions/livro-tabela-protecao.mjs            (dry-run)
 *   node functions/livro-tabela-protecao.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

const grab = async c => (await db.collection(`system/data/${c}`).get());
const [eqSnap, vdSnap, atSnap, skSnap] = await Promise.all(
    ['equipment', 'derivedValues', 'attributes', 'skills'].map(grab));
const vds = vdSnap.docs.map(d => ({ id: d.id, ...d.data() }));
const nm = id => (vds.find(v => v.id === id) || {}).nome || `?${id}`;

/* Penalidade vem de três coleções diferentes: VD, atributo (chave attr_xxx ou
   id) e perícia (id). Um mapa só, senão a tabela do livro publica ID cru. */
const ROTULO = {};
for (const v of vds) ROTULO[v.id] = v.nome;
for (const d of atSnap.docs) {
    const a = d.data();
    ROTULO[d.id] = a.sigla || a.nome;
    if (a.sigla) ROTULO['attr_' + a.sigla.toLowerCase()] = a.sigla;
}
for (const d of skSnap.docs) ROTULO[d.id] = (d.data().nome || '').trim();
/* Atributo é chave fixa de código (`attr_des`), não documento — a coleção
   `attributes` está vazia. A sigla é o próprio sufixo em maiúsculas. */
const rot = id => ROTULO[id]
    || (/^attr_[a-z]+$/.test(id) ? id.slice(5).toUpperCase() : null)
    || `?${id}`;
const CLASSES = ['Leve', 'Média', 'Pesada', 'Escudo'];

/* nomes dos slots, para a coluna "Cobre" */
const PARTES = {};
for (const d of (await db.collection('system/data/bodyParts').get()).docs) PARTES[d.id] = d.data().nome;

const moeda = v => String(v).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const linhas = [];
for (const d of eqSnap.docs) {
    const e = d.data();
    const classe = (e.tags || []).find(t => CLASSES.includes(t));
    if (!classe) continue;
    const bl = (e.valoresDerivadosVinculados || []).filter(v => nm(v.id) === 'Blindagem')
        .reduce((s, v) => s + (Number(v.modificador) || 0), 0);
    const slots = 1 + (e.slotsAdicionais || []).reduce((s, x) => s + (x.quantidade || 0), 0);

    const cobre = classe === 'Escudo' ? 'Mão'
        : [...(e.equipavelEm || []).map(id => PARTES[id] || id),
           ...(e.slotsAdicionais || []).map(s => (PARTES[s.id] || s.id) + (s.quantidade > 1 ? ` ×${s.quantidade}` : ''))]
          .filter(Boolean).join(', ');

    const pen = [...(e.atributosVinculados || []), ...(e.periciasVinculadas || []),
                 ...(e.valoresDerivadosVinculados || []).filter(v => !/^Blindagem/.test(nm(v.id)))]
        .filter(v => (Number(v.modificador) || 0) < 0)
        .map(v => `${rot(v.id)} ${v.modificador}`);
    const cruas = pen.filter(p => p.startsWith('?'));
    if (cruas.length) { console.error(`🔴 ${e.nome}: rótulo não resolvido — ${cruas.join(', ')}`); process.exitCode = 1; }

    linhas.push({ nome: e.nome, classe, bl, slots, cobre, peso: e.peso ?? 0, preco: Number(e.preco) || 0,
                  pen: pen.length ? pen.join(' · ') : '—' });
}
linhas.sort((a, b) => b.bl - a.bl || b.slots - a.slots || a.nome.localeCompare(b.nome));

const tabela = `<table>
<thead><tr><th>Peça</th><th>Classe</th><th>Blindagem</th><th>Cobre</th><th>Peso</th><th>Preço (L$)</th><th>Penalidade</th></tr></thead>
<tbody>
${linhas.map(l => `<tr><td>${l.nome}</td><td>${l.classe}</td><td><strong>${l.bl}</strong></td><td>${l.cobre}</td><td>${l.peso}</td><td>${moeda(l.preco)}</td><td>${l.pen}</td></tr>`).join('\n')}
</tbody>
</table>`;

/* conjunto x avulso, na classe Pesada */
const pesadas = linhas.filter(l => l.classe === 'Pesada');
const torneio = pesadas.find(l => l.nome === 'Armadura de Torneio');
const avulsoPesado = pesadas.filter(l => l.nome !== 'Armadura de Torneio' && l.nome !== 'Armadura Completa'
    && l.nome !== 'Meia-Armadura' && l.nome !== 'Cota de Placas');
const somaAvulso = avulsoPesado.reduce((s, l) => s + l.preco, 0);
const somaBl = avulsoPesado.reduce((s, l) => s + l.bl, 0);

console.log(`\n=== tabela de proteção do §5.4 ===\n`);
console.log(`  ${linhas.length} peças na tabela`);
console.log(`  arnês Pesado avulso: ${avulsoPesado.map(l => l.nome).join(' + ')}`);
console.log(`  = Blindagem ${somaBl} por ${moeda(somaAvulso)} L$   ·   Armadura de Torneio: Blindagem ${torneio.bl} por ${moeda(torneio.preco)} L$`);
if (somaBl !== torneio.bl) console.error(`  🔴 avulso (${somaBl}) e conjunto (${torneio.bl}) não dão a mesma Blindagem`);
if (somaAvulso <= torneio.preco) console.error(`  🔴 avulso não está mais caro que o conjunto — a regra do Livro inverteu`);

const ref = db.collection('worldbuilding-articles').doc('art-regras-jogador-05');
const snap = await ref.get();
let html = snap.data().contentHTML || '';
const antes = html.length;

/* 1) troca a tabela inteira: do <table> após o título do catálogo até o </table> */
const marca = '<h3>O catálogo de proteção</h3>';
const i = html.indexOf(marca);
if (i < 0) { console.error('🔴 título do catálogo não encontrado.'); process.exit(1); }
const ini = html.indexOf('<table>', i);
const fim = html.indexOf('</table>', ini);
if (ini < 0 || fim < 0) { console.error('🔴 tabela não encontrada.'); process.exit(1); }
html = html.slice(0, ini) + tabela + html.slice(fim + '</table>'.length);
console.log(`  ok  tabela substituída`);

/* 2) os dois números do parágrafo conjunto x avulso */
const de = /pagando mais caro \([\d.]+ L\$ contra [\d.]+( L\$)?\)/;
if (!de.test(html)) { console.error('🔴 parágrafo de conjunto x avulso não encontrado.'); process.exit(1); }
html = html.replace(de, `pagando mais caro (${moeda(somaAvulso)} L$ contra ${moeda(torneio.preco)} L$)`);
console.log(`  ok  conjunto x avulso: ${moeda(somaAvulso)} contra ${moeda(torneio.preco)}`);
console.log(`  ${antes} → ${html.length} chars`);

if (process.exitCode === 1) { console.error('\n🔴 ABORTADO — há rótulo não resolvido; a tabela publicaria ID cru.'); process.exit(1); }
if (!APLICAR) { console.log('\n(dry-run — nada gravado. Use --apply.)'); process.exit(0); }
await ref.update({ contentHTML: html, updatedAt: Date.now() });
console.log('\n✅ §5.4 atualizado a partir do banco.');
process.exit(0);
