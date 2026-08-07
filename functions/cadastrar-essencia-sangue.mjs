/**
 * Sangue é a décima quarta Essência (decisão do dono do mundo, 06/08/2026).
 * Cria os dois VDs que faltavam para ela ter canal: Blindagem Sanguínea
 * (bloco blindagem-essencia) e Dano Sanguíneo (bloco ataque-item).
 *
 * Clona o documento de uma das 13 irmãs e sobrescreve só nome/descrição/ícone/ordem
 * — assim nenhum campo do padrão fica de fora quando o padrão mudar.
 *
 *   node functions/cadastrar-essencia-sangue.mjs --dry-run
 *   node functions/cadastrar-essencia-sangue.mjs
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();

const DRY = process.argv.includes('--dry-run');
const COR = 'Carmesim-Escura'; // cadastro de asp_sangue e seed do painel-runic.js concordam

const alvos = [
  {
    template: 'Blindagem Eólica',
    nome: 'Blindagem Sanguínea',
    icone: '🩸',
    ordem: 48, // 13 irmãs ocupam 35..47
    descricao: `Blindagem contra a Essência ${COR} (Sangue). Nasce igual à Blindagem Arcana; só muda se alguma peça vestida ceder ou resistir a essa Essência. Pode ficar abaixo de zero — aí o golpe é amplificado (Livro de Regras, 5.4).`,
  },
  {
    template: 'Dano Eólico',
    nome: 'Dano Sanguíneo',
    icone: '🩸',
    ordem: 200, // 13 irmãs ocupam 70..190, de 10 em 10
    descricao: `Parcela de dano da Essência ${COR} (Sangue). Soma-se ao golpe como canal separado e subtrai a Blindagem ${COR} do alvo, não a Blindagem física. Cada canal é clampado em 0 antes de somar; o piso de 1 vale para o golpe inteiro.`,
  },
];

const snap = await db.collection('system/data/derivedValues').get();
const porNome = new Map(snap.docs.map(d => [d.data().nome, d]));

// --- conferências: o mundo tem que estar como esperado antes de gravar ---
const nBlind = snap.docs.filter(d => d.data().blocoId === 'blindagem-essencia').length;
const nDano = snap.docs.filter(d => d.data().blocoId === 'ataque-item' && /^Dano /.test(d.data().nome || '')).length;
console.log(`blindagem-essencia=${nBlind}  canais "Dano *" em ataque-item=${nDano}`);
if (nBlind !== 13 || nDano !== 13) throw new Error(`esperava 13 e 13, achei ${nBlind} e ${nDano} — o bloco mudou, revise o script`);

const asp = await db.doc('system/data/runicElements/asp_sangue').get();
if (!asp.exists) throw new Error('asp_sangue não existe em runicElements — a decisão (b) pressupõe que ele fica');
if (asp.data().cor !== COR) throw new Error(`cor do asp_sangue é "${asp.data().cor}", script assume "${COR}"`);

for (const a of alvos) {
  if (porNome.has(a.nome)) throw new Error(`"${a.nome}" já existe (${porNome.get(a.nome).id}) — nada a fazer`);
  if (!porNome.has(a.template)) throw new Error(`template "${a.template}" sumiu`);
}

// --- gravação ---
for (const a of alvos) {
  const base = { ...porNome.get(a.template).data() };
  const doc = {
    ...base,
    nome: a.nome,
    descricao: a.descricao,
    icone: a.icone,
    ordem: a.ordem,
    criadoEm: admin.firestore.FieldValue.serverTimestamp(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  const ref = db.collection('system/data/derivedValues').doc();
  console.log(`\n${DRY ? '[dry-run] criaria' : 'criando'} ${ref.id} :: ${doc.nome}`);
  console.log(`   bloco=${doc.blocoId} ordem=${doc.ordem} escopoItem="${doc.escopoItem}" espelhaVD=${doc.espelhaVD ?? '-'} mecanicaIds=${JSON.stringify(doc.mecanicaIds)}`);
  console.log(`   ${doc.descricao}`);
  if (!DRY) await ref.set(doc);
}

if (!DRY) {
  const depois = await db.collection('system/data/derivedValues').get();
  const b2 = depois.docs.filter(d => d.data().blocoId === 'blindagem-essencia').length;
  const d2 = depois.docs.filter(d => d.data().blocoId === 'ataque-item' && /^Dano /.test(d.data().nome || '')).length;
  console.log(`\nconferência: blindagem-essencia=${b2}  canais=${d2}`);
  if (b2 !== 14 || d2 !== 14) throw new Error('pós-conferência falhou');
  console.log('✅ 14 e 14');
} else {
  console.log('\n[dry-run] nada gravado');
}
process.exit(0);
