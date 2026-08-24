/**
 * Livro de Regras do Jogador — Descanso Rápido (Cap. 7.1) e Recuperar Fôlego (Cap. 6.2).
 * Decisões do playtest de 18/08/2026. Replaces cirúrgicos: âncora não achada = erro, nada salvo.
 * node functions/__aplica-descanso-rapido.mjs
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const serviceAccount = require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

function trocar(html, ancora, novo, rotulo) {
  if (!html.includes(ancora)) throw new Error(`âncora não encontrada: ${rotulo}`);
  return html.replace(ancora, novo);
}

// ===== Capítulo 6 — Recuperar Fôlego na economia de ação (6.2) =====
const ANC6 = `<p>Alternativamente: <strong>2 Ações de Movimento</strong> (deslocar-se mais). Algumas ações exigem o turno inteiro (<strong>Ação Completa</strong>, indicado na descrição). Quem luta com <strong>armas duplas</strong> gasta o turno inteiro nisso (ver 6.10).</p>`;
const NOVO6 = ANC6 + `
<p><strong>Recuperar Fôlego (Ação Completa)</strong> — gaste o turno inteiro parado, sem mover nem atacar, e recupere <strong>1 Energia</strong>. É a pausa de cinco segundos no meio da pancadaria: baixar a arma, encher o peito, voltar. Só existe dentro do combate — fora dele, quem devolve Energia é o descanso (7.1). Ficar uma rodada imóvel tem preço: quem estava em postura larga a guarda, e ninguém para de olhar para você.</p>`;

// ===== Capítulo 7 — Descanso Rápido na tabela de tipos (7.1) =====
const ANC7_LINHA = `<tr><td><strong>Descanso Curto</strong></td>`;
const NOVO7_LINHA = `<tr><td><strong>Descanso Rápido</strong></td><td>~30 min</td><td>Sentar de verdade: comer algo, beber, calar a cabeça. Recupera <strong>1 ponto</strong>, em <strong>Energia ou Sanidade</strong> — nunca Vitalidade. A cabeça se recompõe numa meia hora; o corpo, só dormindo.</td></tr>
` + ANC7_LINHA;

const ANC7_NOTA = `<p>Interrupções sérias (ataques, tempestades, fugas) podem anular total ou parcialmente os efeitos, a critério do Narrador.</p>`;
const NOVO7_NOTA = ANC7_NOTA + `
<p><em>Dentro do combate não há descanso — o que existe lá é <strong>Recuperar Fôlego</strong>: o turno inteiro parado por 1 Energia (6.2).</em></p>`;

const ref6 = db.collection('worldbuilding-articles').doc('art-regras-jogador-06');
const ref7 = db.collection('worldbuilding-articles').doc('art-regras-jogador-07');
const [d6, d7] = await Promise.all([ref6.get(), ref7.get()]);

let h6 = String(d6.data().contentHTML || '');
let h7 = String(d7.data().contentHTML || '');
if (h6.includes('Recuperar Fôlego')) { console.log('Cap 6 já tem Recuperar Fôlego — nada a fazer'); }
else {
  h6 = trocar(h6, ANC6, NOVO6, 'cap6 economia de ação');
  await ref6.update({ contentHTML: h6 });
  console.log(`Cap 6 atualizado: ${String(d6.data().contentHTML).length} → ${h6.length} chars`);
}
if (h7.includes('Descanso Rápido')) { console.log('Cap 7 já tem Descanso Rápido — nada a fazer'); }
else {
  h7 = trocar(h7, ANC7_LINHA, NOVO7_LINHA, 'cap7 linha da tabela');
  h7 = trocar(h7, ANC7_NOTA, NOVO7_NOTA, 'cap7 nota pós-tabela');
  await ref7.update({ contentHTML: h7 });
  console.log(`Cap 7 atualizado: ${String(d7.data().contentHTML).length} → ${h7.length} chars`);
}
console.log('ok');
process.exit(0);
