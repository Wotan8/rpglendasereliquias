/**
 * Colheita da Sessão 47 (02/08/2026) da Mesa 1 "Grau Espectro".
 * Usa a mesma regra de computeAvanco do painel: presságio cruzado dispara,
 * histórico ganha {de, para, motivo, t}.
 *   node functions/colheita-sessao47.mjs [--apply]
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');
const MESA = '7MQKtOpcMt8DCH7r97Fb';

const AVANCOS = {
  'O Viúvo — Morik Varn': { delta: 1, motivo: 'S47: Albrix morto pela Vexia, Fontrix desarmado e poupado. Morik perdeu os dois agentes de campo numa noite.' },
  'A Dívida com Ina':     { delta: 1, motivo: 'S47: combate dentro de Velmora com 8 Armadores testemunhando; um guarda morto, o besteiro fugiu sabendo que não tem como mentir.' },
  'A Onça':               { delta: 2, motivo: 'S47: apareceu a 30m e não atacou; o Praematum entregou o corpo do Albrix como isca. Agora associa o grupo a carne fácil.' },
};

// Três escadas foram reescritas: os presságios que eu tinha escrito não batem
// mais com o que a mesa fez. Reescrever é honesto; deixar disparar texto errado não é.
const ONCA_PRESSAGIOS = [
  { texto: 'Ela aparece a 30m no meio da caçada e não ataca. Recebe carne de mão beijada.', quando: 1, ocorrido: true },
  { texto: 'Ela associa o cheiro do grupo a carne fácil e passa a rondar por onde eles passaram.', quando: 2, ocorrido: true },
  { texto: 'Ela come o que ficou pra trás: animal de carga, montaria, ou o NPC mais fraco do acampamento.', quando: 3, ocorrido: false },
  { texto: 'Ela mata um nomeado. Se não a mataram nem domaram até aqui, ela mata — e escolhe quem estiver sozinho.', quando: 4, ocorrido: false },
  { texto: 'O contrato vira leilão: Morik e a guilda do Carinha do Gelo sobem o valor e a mata enche de caçador armado.', quando: 5, ocorrido: false },
  { texto: 'Ela para de esperar alguém ficar sozinho e entra no acampamento.', quando: 6, ocorrido: false },
];

const VIUVO_PRESSAGIOS = [
  { texto: 'Albrix morto e Fontrix desarmado. Morik fica sem os dois braços de campo na mesma noite — e o Corvo volta carregando o peso do amigo além do próprio.', quando: 2, ocorrido: true },
  { texto: 'Ele vai sozinho e gasta o Azul que sobrou. Ninguém sabe para onde.', quando: 3, ocorrido: false },
  { texto: 'Morik morre tentando. O grupo perde o Azul, a receita e o único homem que estudou Ibirá por trinta anos — e, porque é ele quem segura os acordos com o império Famo, Sereni fica sem cobertura. É AQUI que se abre a frente "As Legiões Famo".', quando: 4, ocorrido: false },
];

const INA_PRESSAGIOS_NOVOS = [
  { texto: 'Os 8 Armadores viram tudo de perto e o besteiro fugiu sabendo que não tem como mentir. A notícia chega a Ina esta noite, não em dias.', quando: 1, ocorrido: true },
  { texto: 'Ina identifica os rostos: a Pogo albina, a arqueira Tamano e o rapaz das runas. A Cindy não estava lá — a descrição mais fácil de circular agora é a da Sona.', quando: 2, ocorrido: true },
];

function computeAvanco(f, delta, motivo) {
  const fatias = f.relogio?.fatias || 6;
  const de = Math.min(f.relogio?.cheias || 0, fatias);
  const para = Math.max(0, Math.min(de + delta, fatias));
  if (para === de) return null;
  const pressagios = (f.pressagios || []).map(p => ({ ...p }));
  const disparados = [];
  if (delta > 0) for (const p of pressagios) {
    if (!p.ocorrido && (p.quando || 0) <= para) { p.ocorrido = true; disparados.push(p.texto); }
  }
  const historico = [...(f.historico || []), { de, para, motivo: (motivo || '').trim(), t: Date.now() }];
  return { patch: { 'relogio.cheias': para, pressagios, historico }, disparados, de, para };
}

const col = db.collection('mesas').doc(MESA).collection('frentes');
const snap = await col.get();
console.log(APPLY ? '=== APLICANDO ===\n' : '=== DRY-RUN ===\n');

for (const d of snap.docs) {
  const f = { id: d.id, ...d.data() };
  const mov = AVANCOS[f.nome];
  if (!mov) { console.log(`  = ${f.nome}: parada em ${f.relogio.cheias}/${f.relogio.fatias}`); continue; }
  // A Onça troca a escada antes de andar.
  if (f.nome === 'A Onça') f.pressagios = ONCA_PRESSAGIOS;
  if (f.nome === 'O Viúvo — Morik Varn') f.pressagios = VIUVO_PRESSAGIOS;
  if (f.nome === 'A Dívida com Ina') f.pressagios = [...INA_PRESSAGIOS_NOVOS, ...(f.pressagios || []).filter(x => (x.quando || 0) > 2)];
  const r = computeAvanco(f, mov.delta, mov.motivo);
  console.log(`  ~ ${f.nome}: ${r.de} -> ${r.para} de ${f.relogio.fatias}`);
  for (const t of r.disparados) console.log(`      ⚡ ${t}`);
  if (APPLY) await col.doc(f.id).update(r.patch);
}

// Fecha a sessão 47.
const ses = await db.collection('mesas').doc(MESA).collection('sessoes').where('numero', '==', 47).get();
if (ses.empty) console.log('\n  ⚠ sessão 47 não encontrada');
else {
  console.log(`\n  ✓ sessão 47 (${ses.docs[0].id}): fase -> fechada`);
  if (APPLY) await ses.docs[0].ref.update({
    fase: 'fechada',
    resumo: 'Fio 2: Vexia matou Albrix; Fontrix se rendeu, entregou arco e mochila e foi poupado. A Onça apareceu e recebeu o corpo do Albrix. Praematum e Vexia entraram na passagem secreta. Fio 1: a porta de enigma tinha fechado de novo; reabriram, alarme tocou. Desceram, Armadores em pânico, combate com 2 guardas — espadachim morto, besteiro fugiu, Raknar caído com braço e clavícula fraturados. Sona escondida atrás dos caixotes, Nura fingiu rendição junto aos Armadores. Fecho: Praematum sai da passagem na câmara do Thalion, que está sozinho, e blefa que salvou a vida dele de uma emboscada de um arqueiro e um guerreiro.',
    fechadaEm: Date.now(),
  });
}
console.log(APPLY ? '\nGravado.' : '\nRode com --apply.');
process.exit(0);
