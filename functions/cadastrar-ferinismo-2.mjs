/**
 * Correções pedidas depois do primeiro cadastro do Ferinismo:
 *   1. Perícias Iniciais do Druida MOD volta ao que era (+1 Domar, +1 Herbalismo)
 *   2. Fluxomancia entra no SELECT, como opção do jogador
 *   3. Druida passa a ter os dois livros (Alquimancia + Totemancia)
 *   4. Regra de conseguir Eco como Aliado entra no Compêndio de Totemancia
 *
 *   node functions/cadastrar-ferinismo-2.mjs           → só mostra o plano
 *   node functions/cadastrar-ferinismo-2.mjs --apply   → grava
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const serviceAccount = require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const APLICAR = process.argv.includes('--apply');
const agora = admin.firestore.Timestamp.now();

const POOL = [
  'Perícia: Aliado Animal',
  'Perícia: Dosagem',
  'Perícia: Erudição Defensiva',
  'Perícia: Erudição Ofensiva',
  'Perícia: Fluxomancia',
  'Perícia: Linguagem Animal',
  'Perícia: Maceração',
];

/* Entra logo antes de "Regras Do Ramo Do Xamã" — a seção do ramo do Espiritismo. */
const SECAO_ECO_ALIADO = `
<h2>Conseguir um Eco como Aliado</h2>
<p>Encontrar um Eco não é tê-lo consigo. O ritual de busca revela o que a Essência Verde guardou naquele lugar; fazer com que esse vestígio <em>acompanhe</em> você é outra conversa — e é uma conversa que qualquer um capaz de perceber Ecos pode tentar, não só o Xamã.</p>
<p><strong>Alvo = AUT + Empatia.</strong> <strong>Redutor = o Redutor do Eco.</strong></p>
<p>O paralelo com o mundo dos vivos é exato: domar uma criatura é <em>AUT + Domar</em> contra o Redutor dela (Livro de Regras, 7.7); atrair um Eco é <em>AUT + Empatia</em> contra o Redutor dele. O que muda é a moeda da conversa. Uma fera pesa cheiro, comida e distância; um Eco pesa o que ainda lhe falta — uma dívida, um nome não dito, um corpo enterrado no lugar errado. Ecos Serenos aceitam por pouco. Inquietos cobram antes de responder. Furiosos e Corrompidos raramente aceitam, e quem insiste costuma pagar em Sanidade.</p>
<p><strong>Com sucesso</strong>, o Eco passa a acompanhar o praticante e aparece entre seus Aliados. <strong>Na falha</strong>, ele se recolhe à Essência Verde — e uma segunda tentativa parte de um Redutor pior, porque agora ele sabe o que você quer.</p>
<p><strong>Aliado não é vínculo, e vínculo não é posse.</strong> Um Eco Aliado está com você por interesse próprio: porque você o escuta, porque prometeu algo, porque o caminho dele por ora é o seu. Ele não obedece, pode recusar uma comunhão e pode ir embora. Incorporá-lo ou projetar-se nele exige o consentimento dele a cada vez — a Lei da Comunhão não abre exceção para quem apenas anda junto.</p>
<p>O que dispensa esse consentimento é o <strong>vínculo</strong>, e vínculo se constrói, não se rola: exige Lealdade acumulada e um ritual próprio. Ecos vinculados sem Madeira de Antiqua continuam precisando ser <em>chamados</em> antes de cada uso — só a Antiqua os guarda perto o bastante para dispensar o chamado.</p>
`.trim();

const plano = [];
const add = (ref, o) => plano.push({ ref, ...o });

/* 1. MOD volta ao original */
add('system/data/mechanics/xUeykrUZUUdSBGFV4JlN', {
  rotulo: 'Perícias Iniciais do Druida MOD — desfaz o +1 Fluxomancia',
  patch: {
    config: { calculos: [
      { operacao: '+', alvo: 'Perícia: Domar', equacao: [{ tipo: 'fixo', valor: 1 }] },
      { operacao: '+', alvo: 'Perícia: Herbalismo', equacao: [{ tipo: 'fixo', valor: 1 }] },
    ] },
    previewTexto: '+1 em Perícia: Domar; +1 em Perícia: Herbalismo',
  },
});

/* 2. Fluxomancia vira opção no SELECT */
add('system/data/mechanics/1oSc5YzsKlQWYscFWOQo', {
  rotulo: 'Perícias Iniciais do Druida SELECT — Fluxomancia entra no pool',
  patchFn: (atual) => ({
    config: { ...atual.config, poolPersonalizado: POOL },
    previewTexto: `Distribuir: +1 em 2 alvos de [${POOL.join(', ')}]`,
  }),
});

/* 3. Druida com os dois livros */
add('system/data/classes/l7zlhsuXN6PIXCetcaj3', {
  rotulo: 'Druida — Alquimancia + Totemancia',
  patch: {
    livrosVinculados: [
      { bookId: 'book_ms3gb8iq5q9k0i', capituloIds: [] },   // Compêndio de Alquimancia
      { bookId: 'book_ms3gb924a9frg1', capituloIds: [] },   // Compêndio de Totemancia
    ],
  },
});

/* 4. Compêndio de Totemancia — regra do Eco Aliado, no ramo do Espiritismo */
add('worldbuilding-articles/art_ms3gb93y6turqk', {
  rotulo: 'Compêndio de Totemancia — "Conseguir um Eco como Aliado"',
  timestamps: false,
  patchFn: (atual) => {
    const h = atual.contentHTML || '';
    if (h.includes('Conseguir um Eco como Aliado')) return null;          // idempotente
    const ancora = '<h2>Regras Do Ramo Do Xamã</h2>';
    if (!h.includes(ancora)) throw new Error('âncora não encontrada no capítulo');
    const novo = h.replace(ancora, SECAO_ECO_ALIADO + '\n' + ancora);
    return {
      contentHTML: novo,
      words: novo.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length,
      updatedAt: Date.now(),
    };
  },
});

console.log(`\n===== PLANO (${plano.length} documentos) =====\n`);
const gravar = [];
for (const p of plano) {
  const snap = await db.doc(p.ref).get();
  if (!snap.exists) { console.log(`❌ ${p.ref} NAO EXISTE — abortando`); process.exit(1); }
  const atual = snap.data();
  const patch = p.patchFn ? p.patchFn(atual) : p.patch;
  if (!patch) { console.log(`⏭️  ${p.rotulo}\n   já aplicado, pulando\n`); continue; }

  console.log(`• ${p.rotulo}\n  ${p.ref}`);
  for (const [k, v] of Object.entries(patch)) {
    const a = JSON.stringify(atual[k]), d = JSON.stringify(v);
    if (a === d) { console.log(`    ${k}: (sem mudança)`); continue; }
    const corta = (s) => (s || '').length > 170 ? (s || '').slice(0, 170) + '…' : (s || '(vazio)');
    console.log(`    ${k}:\n       antes : ${corta(a)}\n       depois: ${corta(d)}`);
  }
  console.log('');

  if (p.timestamps !== false) {
    patch.updatedAt = agora;
    if (atual.atualizadoEm) patch.atualizadoEm = agora;
    if (typeof atual.versao === 'number') patch.versao = atual.versao + 1;
  }
  gravar.push({ ref: p.ref, patch, rotulo: p.rotulo });
}

if (!APLICAR) { console.log('\n(dry-run — rode com --apply para gravar)'); process.exit(0); }
for (const g of gravar) { await db.doc(g.ref).update(g.patch); console.log(`✅ ${g.rotulo}`); }
console.log(`\n${gravar.length} documento(s) atualizado(s).`);
process.exit(0);
