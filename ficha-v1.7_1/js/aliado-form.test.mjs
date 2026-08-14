/**
 * A Ficha do Aliado é HTML montado por string, e o resto de aliados.js acha os
 * campos por `document.getElementById`. Um id que some no formulário não quebra
 * nada na hora — quebra depois, ao salvar, e em silêncio.
 *
 * Este teste desenha o formulário e confere o contrato: os ids que o salvar/
 * preencher usam, as cinco abas e os campos que a lógica de mesa lê.
 *
 * Roda com: node ficha-v1.7_1/js/aliado-form.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync(new URL('./aliados.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

// Do primeiro tijolo do formulário até o fim de buildAliadoForm: tudo o que
// desenha a ficha e nada do que fala com o Firestore.
const ini = src.indexOf('/* ===== TIJOLOS DO FORMULÁRIO');
const fim = src.indexOf('\n}\n', src.indexOf('function buildAliadoForm() {')) + 3;
assert.ok(ini > 0 && fim > ini, 'bloco do formulário não encontrado em aliados.js');

const sandbox = { CampoImagem: { html: (o) => `<input id="${o.id}" data-pasta="${o.pasta}" ${o.attrs}>` } };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(`${src.slice(ini, fim)}\nglobalThis.__html = buildAliadoForm();`, sandbox);

const html = sandbox.__html;
const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]));

/* ===== as cinco abas, e só a primeira nasce aberta ===== */
const ABAS = ['identidade', 'mecanica', 'inventario', 'roleplay', 'loot'];
for (const aba of ABAS) {
  assert.ok(ids.has(`alSec_${aba}`), `painel da aba "${aba}" sumiu`);
  assert.match(html, new RegExp(`data-sec="${aba}"[^>]*onclick="aliadoSwitchSection\\('${aba}'\\)"`),
    `botão da aba "${aba}" sumiu ou perdeu o onclick`);
}
assert.equal((html.match(/class="tab-content active"/g) || []).length, 1,
  'só a aba Identidade pode nascer aberta');
assert.equal((html.match(/class="tab active"/g) || []).length, 1,
  'só um botão de aba pode nascer marcado');

/* ===== campos que salveAliadoNpc()/fillAliadoForm() leem por id ===== */
const OBRIGATORIOS = [
  // identidade
  'al_imagem', 'al_nome', 'al_tipo', 'al_nivel', 'al_raca', 'al_classe', 'al_tribo',
  'al_porte', 'al_papel', 'al_local', 'al_tamanho', 'al_tags',
  // mecânica
  'al_vit', 'al_vit_atual', 'al_ener', 'al_ener_atual', 'al_san', 'al_san_atual',
  'al_lealdade', 'al_ataques', 'al_skills',
  'al_dv_grid', 'al_structured_skills_grid', 'al_class_modules', 'al_class_modules_section',
  // inventário
  'aliadoInvRoot',
  // role play
  'al_personalidade1', 'al_personalidade2', 'al_personalidade3', 'al_trejeitos',
  'al_motivacao', 'al_segredos', 'al_aliado', 'al_rival', 'al_devedor', 'al_frases', 'al_historia',
  // loot
  'al_itens', 'al_luns', 'al_pistas', 'al_complicacoes',
  // cabeçalho
  'al_portrait', 'al_portrait_img', 'al_head_name',
];
const faltando = OBRIGATORIOS.filter(id => !ids.has(id));
assert.deepEqual(faltando, [], `campo(s) fora do formulário: ${faltando.join(', ')}`);

/* ===== os nove atributos ===== */
for (const a of ['FOR', 'DES', 'VIG', 'INT', 'RAC', 'PRS', 'PRE', 'MAN', 'AUT']) {
  assert.ok(ids.has(`al_attr_${a}`), `atributo ${a} sumiu da grade`);
}

/* ===== detalhes que a regra de mesa depende ===== */
assert.match(html, /id="al_lealdade"[^>]*min="0"[^>]*max="10"/,
  'Lealdade tem que continuar presa em 0–10 (Bestiário)');
assert.match(html, /id="al_nome"[^>]*oninput="alRefreshHeadName\(\)"/,
  'o nome atualiza o cabeçalho ao digitar');
assert.match(html, /id="al_nivel"[^>]*min="1"/, 'nível mínimo é 1');
assert.match(html, /<option value="npc">/, 'tipo NPC');
assert.match(html, /<option value="criatura">/, 'tipo Criatura');
for (const porte of ['Minúsculo', 'Pequeno', 'Médio', 'Grande', 'Enorme', 'Colossal']) {
  assert.ok(html.includes(`<option>${porte}</option>`), `porte ${porte} sumiu`);
}
assert.match(html, /onclick="window\.saveAliadoNpc\(\)"/, 'botão de salvar sumiu');

console.log(`✅ ficha do Aliado: ${ids.size} campos, 5 abas e as travas de mesa no lugar`);
