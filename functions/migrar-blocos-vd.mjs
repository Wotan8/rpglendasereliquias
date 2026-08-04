/**
 * Reestrutura os BLOCOS dos Valores Derivados (system/data/derivedValues).
 *
 * Regra da nova estrutura: bloco = "quando o jogador faz a pergunta".
 *   1  Combate            — o que se lê como número solto dentro da rodada
 *   2  Blindagens         — as 13 essências, consulta reativa ("levei dano Vermelho")
 *   20+ Ofício            — um bloco por subsistema (dissolve "Testes" e "Escola de Magia")
 *   30 Modificadores de Ataque — os escopoItem, cuja BASE não se lê: o total sai
 *                                na tabela de Ataques (nos 4 Acertos a base é 0)
 *   40 Deslocamento · 50 Sentidos · 60 Traços · 70 Corpo e Carga
 *
 * Toca APENAS blocoId / blocoNome / blocoOrdem / ordem. Nunca `nome`: o `key`
 * do VD é derivado do nome (system-data-loader.js) e as mecânicas apontam pelo
 * nome legível (TARGET_MAP), então renomear quebra ficha e dados salvos.
 *
 *   node migrar-blocos-vd.mjs                    # dry-run: mostra o diff
 *   node migrar-blocos-vd.mjs --apply            # grava
 *   node migrar-blocos-vd.mjs --apply --criar-espiritomancia
 *
 * Idempotente: rodar de novo sem --apply serve de auditoria (0 divergências = ok).
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();

const APLICAR = process.argv.includes('--apply');
const CRIAR_ESP = process.argv.includes('--criar-espiritomancia');

/** Ordem canônica das essências, igual à do cadastro. A mesma sequência vale
 *  para Blindagens e Danos — o jogador decora uma lista só. */
const ESSENCIAS = ['Cinza', 'Azul-Claro', 'Azul', 'Púrpura', 'Verde', 'Rosa',
  'Amarela', 'Vermelha', 'Marrom', 'Branca', 'Prateada', 'Preta', 'Dourada'];

/* ===== MAPA — [blocoId, blocoNome, blocoOrdem, VDs na ordem de leitura] ===== */
const BLOCOS = [
  ['combat', 'Combate', 1, [
    'Iniciativa', 'Reação', 'Blindagem', 'Dano da Língua', 'Marca de Caça',
  ]],
  // Condicionais: quem não tem canal nenhum não vê o bloco. Aberto por padrão
  // para ficar lado a lado com a Blindagem genérica, que é a regra default.
  ['defesas-essencia', 'Blindagens por Essência', 2,
    ESSENCIAS.map(c => `Blindagem ${c}`)],

  ['pallomancia', 'Pallomancia', 20, [
    'Pallomancia', 'Graça de Palla', 'Súplica', 'Prece Breve', 'Bênção',
    'Conexão Divina', 'Oscilação Solar', 'Peregrinação do Amanhecer',
    'Reconsagração', 'Exorcismo Menor', 'Cura de Nexo Menor',
  ]],
  ['sonoromancia', 'Sonoromancia', 21, [
    'Sonoromancia', 'Harmonia', 'Vocal', 'Inst. Cordas', 'Inst. Sopro',
    'Inst. Percussão', 'Contracanto', 'Resistir Dissonância', 'Ler Público',
  ]],
  ['necromancia', 'Necromancia', 22, [
    'Necromancia', 'Contato Necromântico', 'Convocar', 'Controle da Ruína',
    'Fragmento de Identidade', 'Vozes do Túmulo',
  ]],
  ['abismancy', 'Abismancia', 23, [
    'Abismancia', 'Contato Abismântico', 'Selo', 'Conexão com Abismo',
    'Ecos do Vazio', 'Ruptura Venire',
  ]],
  ['hemomancia', 'Hemomancia', 24, [
    'Bolha de Sangue', 'Absorver Sangue', 'Moldar Sangue', 'Solidificar Arma',
    'Escudo Hemático', 'Transfusão', 'Empatia Sanguínea', 'Resistir Efeito Hemático',
  ]],
  // Druida e Xamã compartilham o mesmo sistema mágico.
  ['espiritomancia', 'Espiritomancia', 25, [
    'Espiritomancia', 'Comunhão Simples', 'Percepção Espiritual', 'Buscar Vestígio',
    'Vincular Eco (Antiqua)', 'Libertar Eco Aprisionado', 'Resistir Possessão',
    'Exorcismo', 'Cravar Totem', 'Transcendência (Projetor)', 'Transcendência (Receptor)',
    // Trilha do Druida na sequência real de jogo: selar o vínculo → usar.
    // (Conseguir a criatura virou teste de perícia comum, não é mais VD.)
    'Vínculo Animal', 'Fusão Selvagem', 'Convocar Manada', 'Manipulação Natural',
  ]],
  ['alquimancia', 'Alquimancia', 26, [
    'Alquimancia', 'Preparar Loção', 'Dosagem',
  ]],
  ['runomancia', 'Runomancia', 27, [
    'Gravação Rúnica', 'Diagnóstico Rúnico',
  ]],
  ['manobras_guerreiro', 'Manobras', 28, [
    'Postura Defensiva', 'Postura Ofensiva', 'Investida', 'Cólera',
  ]],

  // Todos escopoItem: o chip mostra a BASE, o total real sai na tabela de
  // Ataques (nos 4 Acertos tipados a base é 0 por definição). Bloco fechado —
  // nenhum destes números se lê como chip.
  ['ataque-item', 'Modificadores de Ataque', 30, [
    'Acerto', 'Acerto Corpo a Corpo', 'Acerto à Distância', 'Acerto Desarmado',
    'Acerto Mágico',
    'Dano', ...ESSENCIAS.map(c => `Dano ${c}`),
  ]],

  ['desloc', 'Deslocamento', 40, [
    'Desloc. Terrestre', 'Desloc. Vertical', 'Desloc. Aquático',
    'Desloc. Aéreo', 'Flutuação', 'Resistência de Voo',
  ]],
  ['senses', 'Sentidos', 50, [
    'Percepção', 'Percepção Visual', 'Percepção Auditiva',
    'Percepção Olfativa', 'Percepção Tátil', 'Visão de Essência',
  ]],
  // Raciais e subsistemas de 1 VD, que não têm bloco funcional próprio.
  ['tracos', 'Traços', 60, [
    'Língua Preênsil', 'Cabeça Quente', 'Toque de Levitação',
  ]],
  ['corpo', 'Corpo e Carga', 70, [
    'Carga', 'Altura', 'Tamanho', 'Peso',
  ]],
];

/** VD novo que falta cadastrar: a escola do Druida/Xamã. Espelha a forma dos
 *  outros ratings de escola (Necromancia, Pallomancia...). */
const NOVO_ESPIRITOMANCIA = {
  nome: 'Espiritomancia',
  icone: '🌿',
  descricao: 'O sistema mágico que permite a interação com os espíritos, a incorporação e a possessão deles. ' +
    'O Xamã conversa com os espíritos e os incorpora, geralmente por meio de totens. ' +
    'O Druida não fala com os espíritos: incorpora os espíritos de seus aliados animais. ' +
    'Alguns druidas também usam totens, mas é raro.',
  blocoId: 'espiritomancia', blocoNome: 'Espiritomancia', blocoOrdem: 25, ordem: 10,
  prefixo: '', sufixo: '',
  todoPersonagem: false, mecanicaIds: [],
  campoAtual: false, campoEditavel: false,
  characterCreationRule: false, characterCreationMin: null, characterCreationMax: null,
  publicado: true, versao: 1,
};

/* ===== EXECUÇÃO ===== */

const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/\s+/g, ' ').trim();

const snap = await db.collection('system/data/derivedValues').get();
const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

const porNome = new Map();
for (const d of docs) {
  const k = norm(d.nome);
  if (porNome.has(k)) console.log(`⚠️  NOME DUPLICADO no Firestore: "${d.nome}" (${porNome.get(k).id} e ${d.id})`);
  else porNome.set(k, d);
}

const alvo = new Map();   // id do doc → campos novos
const faltando = [];      // no mapa, mas não existe no Firestore

for (const [blocoId, blocoNome, blocoOrdem, nomes] of BLOCOS) {
  nomes.forEach((nome, i) => {
    const doc = porNome.get(norm(nome));
    if (!doc) { faltando.push(`${nome}  (bloco ${blocoNome})`); return; }
    alvo.set(doc.id, { blocoId, blocoNome, blocoOrdem, ordem: (i + 1) * 10 });
  });
}

const naoMapeados = docs.filter(d => !alvo.has(d.id));
const mudancas = [];
for (const d of docs) {
  const novo = alvo.get(d.id);
  if (!novo) continue;
  const difs = Object.entries(novo).filter(([k, v]) => d[k] !== v);
  if (difs.length) mudancas.push({ doc: d, novo, difs });
}

console.log(`\n=== ${docs.length} VDs · ${alvo.size} mapeados · ${mudancas.length} com divergência ===\n`);
for (const [blocoId, blocoNome, blocoOrdem] of BLOCOS) {
  const meus = mudancas.filter(m => m.novo.blocoId === blocoId);
  if (!meus.length) continue;
  console.log(`── ${blocoNome} (${blocoId}, ordem ${blocoOrdem})`);
  for (const m of meus) {
    const de = `${m.doc.blocoNome || '—'}/${m.doc.ordem ?? '—'}`;
    console.log(`   ${m.doc.nome.padEnd(30)} ${de.padEnd(22)} → ${blocoNome}/${m.novo.ordem}`);
  }
}

if (faltando.length) {
  console.log(`\n🔴 NO MAPA MAS NÃO EXISTE NO FIRESTORE (${faltando.length}):`);
  for (const f of faltando) console.log('   - ' + f);
}
if (naoMapeados.length) {
  console.log(`\n🔴 EXISTE NO FIRESTORE MAS NÃO ESTÁ NO MAPA (${naoMapeados.length}) — ficariam soltos em "Geral":`);
  for (const d of naoMapeados) console.log(`   - ${d.nome}  (bloco atual: ${d.blocoNome || '—'})`);
}

if (!APLICAR) {
  console.log('\n(dry-run — nada gravado. Use --apply para gravar.)');
  process.exit();
}

if (naoMapeados.length) {
  console.log('\n❌ Abortado: há VD fora do mapa. Corrija o mapa antes de gravar.');
  process.exit(1);
}

let batch = db.batch(), n = 0;
for (const m of mudancas) {
  batch.update(db.doc(`system/data/derivedValues/${m.doc.id}`), { ...m.novo, updatedAt: new Date() });
  if (++n % 400 === 0) { await batch.commit(); batch = db.batch(); }
}
await batch.commit();
console.log(`\n✅ ${mudancas.length} VDs atualizados.`);

if (CRIAR_ESP) {
  const ref = await db.collection('system/data/derivedValues').add({ ...NOVO_ESPIRITOMANCIA, criadoEm: new Date(), updatedAt: new Date() });
  console.log(`✅ VD "Espiritomancia" criado: ${ref.id}`);
  console.log('   ⚠️  Falta vincular: adicione esse id em derivedValueIds das classes Druida e Xamã');
  console.log('       (ou de uma peculiaridade delas), senão ele não aparece em nenhuma ficha.');
}

process.exit();
