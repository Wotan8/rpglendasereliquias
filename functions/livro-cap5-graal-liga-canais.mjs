/**
 * Cap. 5 — três correções:
 *
 *  1. §5.6 — Grau 5 "Graau" → "Graal".
 *  2. §5.5 — coluna Descrição da tabela de Liga vira escala de qualidade
 *     (Improvisada / Baixa / Comum / Boa / Alta / Suprema). Duas linhas estavam
 *     erradas: a 4 dizia "Obra-prima" (colide com o Grau 4, que agora se chama
 *     Obra Prima) e a 5 dizia "artefatos ancestrais, únicos no mundo" — a Liga 5
 *     é forjável, não é peça única.
 *  3. §5.6 — as três portas pelas quais um equipamento ganha canal de Essência.
 *
 *   node functions/livro-cap5-graal-liga-canais.mjs            (dry-run)
 *   node functions/livro-cap5-graal-liga-canais.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

const EDICOES = [
    {
        nome: '§5.6 — Grau 5: Graau → Graal',
        de: '<tr><td>5</td><td>+4</td><td>Graau</td>',
        para: '<tr><td>5</td><td>+4</td><td>Graal</td>'
    },
    {
        nome: '§5.5 — tabela de Liga: escala de qualidade na Descrição',
        de: '<tr><td>0</td><td>Sem Liga</td><td>Improvisado. Pedra, galho, garrafa quebrada.</td></tr>\n'
          + '<tr><td>1</td><td>Bruta</td><td>Produção básica, o que qualquer ferreiro de vila produz.</td></tr>\n'
          + '<tr><td>2</td><td>Justa</td><td>Artesão competente. Equipamento de soldado profissional.</td></tr>\n'
          + '<tr><td>3</td><td>Nobre</td><td>Mestre artesão, acabamento impecável. Equipamento de elite.</td></tr>\n'
          + '<tr><td>4</td><td>Pura</td><td>Obra-prima, materiais raros, técnicas secretas.</td></tr>\n'
          + '<tr><td>5</td><td>Superior</td><td>Artefatos ancestrais, únicos no mundo.</td></tr>',
        para: '<tr><td>0</td><td>Sem Liga</td><td>Improvisada. Pedra, galho, garrafa quebrada.</td></tr>\n'
            + '<tr><td>1</td><td>Bruta</td><td>Baixa. O que qualquer ferreiro de vila produz.</td></tr>\n'
            + '<tr><td>2</td><td>Justa</td><td>Comum. Equipamento de soldado profissional.</td></tr>\n'
            + '<tr><td>3</td><td>Nobre</td><td>Boa. Acabamento impecável, equipamento de elite.</td></tr>\n'
            + '<tr><td>4</td><td>Pura</td><td>Alta. Materiais raros e técnicas fechadas.</td></tr>\n'
            + '<tr><td>5</td><td>Superior</td><td>Suprema. O limite do que a forja alcança.</td></tr>'
    },
    {
        nome: '§5.6 — as três portas do canal de Essência',
        de: 'Como se resolve isso na mesa está no Capítulo 6, seção 6.5.</p>\n',
        para: 'Como se resolve isso na mesa está no Capítulo 6, seção 6.5.</p>\n'
            + '<p>Um equipamento ganha um canal de três maneiras:</p>\n'
            + '<ul>\n'
            + '<li><strong>De nascença</strong> — a peça foi forjada de material que já carrega a Essência. Esse Fio conta no teto da sua faixa de Poder, junto com o físico;</li>\n'
            + '<li><strong>Afiação Arcana</strong> — o forjarcanista imbui o canal numa arma comum. Conta no teto da Liga (ver seção 5.5), não no teto de Fio;</li>\n'
            + '<li><strong>Consumível</strong> — óleo, loção, unguento passado na lâmina. Dura o que dura e não conta em teto nenhum.</li>\n'
            + '</ul>\n'
            + '<p>O forjarcanista é a porta pela qual a magia entra num equipamento mundano. Espada nenhuma nasce flamejante.</p>\n'
    }
];

const ref = db.collection('worldbuilding-articles').doc('art-regras-jogador-05');
const snap = await ref.get();
if (!snap.exists) { console.error('🔴 art-regras-jogador-05 não existe.'); process.exit(1); }

let html = snap.data().contentHTML || '';
const antes = html.length;
let erro = false;

for (const e of EDICOES) {
    const n = html.split(e.de).length - 1;
    console.log(`\n${e.nome}  →  ocorrências: ${n}`);
    if (n !== 1) { console.error(`  🔴 esperava 1, achou ${n}.`); erro = true; continue; }
    console.log(`  - ${e.de.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200)}`);
    console.log(`  + ${e.para.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200)}`);
    html = html.replace(e.de, e.para);
}

if (erro) { console.error('\n🔴 ABORTADO — nada gravado.'); process.exit(1); }
console.log(`\n${antes} → ${html.length} chars`);
if (!APLICAR) { console.log('\n(dry-run — nada gravado. Use --apply.)'); process.exit(0); }

await ref.update({ contentHTML: html, updatedAt: Date.now() });
console.log('\n✅ Gravado.');
process.exit(0);
