/**
 * Mecânica "Conceder → 🚫 Bloqueia Equipar / ✅ Permite Equipar".
 *
 * Regras verificadas:
 *  • bloqueia por tag, por tipo e por equipamento específico;
 *  • tag/tipo valem tanto na instância quanto herdados do modelo do catálogo;
 *  • uma liberação que alcance o mesmo item SEMPRE vence o bloqueio;
 *  • liberação de outro item não libera este;
 *  • sem regras (ou com vínculo vazio) nada é bloqueado.
 *
 * Roda com: node ficha-v1.7_1/js/equip-bloqueio.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync(new URL('./mechanics-engine.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

/** Recorta uma função do módulo (o resto depende do DOM e do state da ficha). */
function pega(nome) {
  const ini = src.indexOf(`function ${nome}(`);
  assert.ok(ini > 0, `${nome} não encontrada`);
  const fim = src.indexOf('\n}\n', ini) + 3;
  assert.ok(fim > ini, `fim de ${nome} não encontrado`);
  return src.slice(ini, fim);
}

const CODIGO = ['_meReqTarget', '_meMatchItemsByReq', '_meItemCasaReqs', '_meBuscaRestricao',
  'equipBloqueioDoItem', 'equipBloqueioEfeitosDoItem'].map(pega).join('\n');

// Catálogo: a adaga tem a tag no modelo; a espada tem tipo Arma.
const CATALOGO = [
  { id: 'tplAdaga', nome: 'Adaga', tipo: 'Arma', tags: ['adaga', 'Ladino'] },
  { id: 'tplEspada', nome: 'Espada Longa', tipo: 'Arma', tags: ['Pesada I'] },
  { id: 'tplTunica', nome: 'Túnica', tipo: 'Vestimenta', tags: [] }
];
const adaga = { id: 'i1', nome: 'Adaga', modeloId: 'tplAdaga' };            // tags só no modelo
const adagaAvulsa = { id: 'i2', nome: 'Adaga Torta', tags: ['adaga'] };     // tag na instância
const espada = { id: 'i3', nome: 'Espada Longa', modeloId: 'tplEspada', tipo: 'Arma' };
const tunica = { id: 'i4', nome: 'Túnica', modeloId: 'tplTunica', tipo: 'Vestimenta' };
const ITENS = [adaga, adagaAvulsa, espada, tunica];

const porTag = t => ({ targetTipo: 'tag', tag: t });
const porTipo = t => ({ targetTipo: 'tipo', tipoEquipamento: t });
const porItem = id => ({ targetTipo: 'equipamento', equipamentoId: id });

/** Roda uma das duas consultas de bloqueio com as regras dadas. */
function consulta(fn, item, { bloqueios = [], bloqueiosEfeitos = [], liberacoes = [] } = {}) {
  const sandbox = {
    window: { _inventoryState: { items: ITENS, catalog: CATALOGO } },
    state: { equipRestricoes: { bloqueios, bloqueiosEfeitos, liberacoes } },
    resultado: null
  };
  vm.createContext(sandbox);
  vm.runInContext(`${CODIGO}\nresultado = ${fn}(${JSON.stringify(item)});`, sandbox);
  return sandbox.resultado;
}

const bloqueio = (item, regras) => consulta('equipBloqueioDoItem', item, regras);
const bloqueioEfeitos = (item, regras) => consulta('equipBloqueioEfeitosDoItem', item, regras);

const BLOQ_ADAGA = { reqs: [porTag('adaga')], fonte: 'Voto de Paz', descricao: 'Proibido portar lâminas curtas' };

// --- sem regra nenhuma ---
assert.equal(bloqueio(adaga), null);
assert.equal(bloqueio(adaga, { bloqueios: [] }), null);

// --- bloqueio por tag: pega tag do modelo E tag da instância ---
assert.ok(bloqueio(adaga, { bloqueios: [BLOQ_ADAGA] }), 'tag herdada do modelo deve bloquear');
assert.ok(bloqueio(adagaAvulsa, { bloqueios: [BLOQ_ADAGA] }), 'tag na instância deve bloquear');
assert.equal(bloqueio(espada, { bloqueios: [BLOQ_ADAGA] }), null, 'espada não tem a tag');
assert.equal(bloqueio(adaga, { bloqueios: [BLOQ_ADAGA] }).fonte, 'Voto de Paz');
assert.equal(bloqueio(adaga, { bloqueios: [BLOQ_ADAGA] }).descricao, 'Proibido portar lâminas curtas');

// --- bloqueio por tipo ---
const BLOQ_ARMA = { reqs: [porTipo('Arma')], fonte: 'Pacifista' };
assert.ok(bloqueio(espada, { bloqueios: [BLOQ_ARMA] }), 'tipo Arma deve bloquear a espada');
assert.equal(bloqueio(tunica, { bloqueios: [BLOQ_ARMA] }), null, 'Vestimenta não é Arma');

// --- bloqueio por equipamento específico ---
const BLOQ_ESPADA = { reqs: [porItem('tplEspada')], fonte: 'Maldição' };
assert.ok(bloqueio(espada, { bloqueios: [BLOQ_ESPADA] }));
assert.equal(bloqueio(adaga, { bloqueios: [BLOQ_ESPADA] }), null);

// --- vários vínculos na mesma regra: basta um casar ---
const BLOQ_MISTO = { reqs: [porTag('inexistente'), porTipo('Vestimenta')], fonte: 'Nudez Ritual' };
assert.ok(bloqueio(tunica, { bloqueios: [BLOQ_MISTO] }));
assert.equal(bloqueio(espada, { bloqueios: [BLOQ_MISTO] }), null);

// --- liberação vence bloqueio ---
const LIB_ADAGA = { reqs: [porTag('adaga')], fonte: 'Treinamento Ladino' };
assert.equal(bloqueio(adaga, { bloqueios: [BLOQ_ADAGA], liberacoes: [LIB_ADAGA] }), null,
  'permitir_equipar deve vencer bloquear_equipar');
assert.equal(bloqueio(adaga, { bloqueios: [BLOQ_ARMA, BLOQ_ADAGA], liberacoes: [LIB_ADAGA] }), null,
  'liberação vence mesmo com mais de um bloqueio');

// --- liberação de outro alvo não libera este ---
const LIB_ESPADA = { reqs: [porItem('tplEspada')], fonte: 'Marcial' };
assert.ok(bloqueio(adaga, { bloqueios: [BLOQ_ADAGA], liberacoes: [LIB_ESPADA] }),
  'liberar espada não pode liberar adaga');

// --- vínculo vazio/malformado não bloqueia o mundo inteiro ---
assert.equal(bloqueio(adaga, { bloqueios: [{ reqs: [], fonte: 'Regra vazia' }] }), null);
assert.equal(bloqueio(adaga, { bloqueios: [{ reqs: [porTag('')], fonte: 'Tag vazia' }] }), null);
assert.equal(bloqueio(adaga, { bloqueios: [{ reqs: [porItem('')], fonte: 'Id vazio' }] }), null);
assert.equal(bloqueio(tunica, { bloqueios: [{ fonte: 'Sem reqs' }] }), null);

// ===== BLOQUEIO SÓ DE EFEITOS =====
const EFEITOS_PESADA = { reqs: [porTag('Pesada I')], fonte: 'Sem Treino Marcial', descricao: 'Você não sabe usar' };

// não impede equipar de todo — só os modos com efeito
assert.equal(bloqueio(espada, { bloqueiosEfeitos: [EFEITOS_PESADA] }), null,
  'bloqueio de efeitos NÃO pode virar bloqueio total');
assert.ok(bloqueioEfeitos(espada, { bloqueiosEfeitos: [EFEITOS_PESADA] }), 'mas barra os efeitos');
assert.equal(bloqueioEfeitos(espada, { bloqueiosEfeitos: [EFEITOS_PESADA] }).fonte, 'Sem Treino Marcial');
assert.equal(bloqueioEfeitos(adaga, { bloqueiosEfeitos: [EFEITOS_PESADA] }), null, 'adaga não tem a tag');

// bloqueio total implica bloqueio de efeitos (quem não equipa, não ativa)
assert.ok(bloqueioEfeitos(adaga, { bloqueios: [BLOQ_ADAGA] }),
  'bloqueio total precisa aparecer também na consulta de efeitos');
assert.equal(bloqueioEfeitos(adaga, { bloqueios: [BLOQ_ADAGA] }).fonte, 'Voto de Paz');

// os dois bloqueios convivem, cada um no seu alvo
const regras = { bloqueios: [BLOQ_ADAGA], bloqueiosEfeitos: [EFEITOS_PESADA] };
assert.ok(bloqueio(adaga, regras), 'adaga: bloqueio total');
assert.equal(bloqueio(espada, regras), null, 'espada: pode equipar');
assert.ok(bloqueioEfeitos(espada, regras), 'espada: mas sem efeitos');

// liberação vence os DOIS tipos
const LIB_PESADA = { reqs: [porTag('Pesada I')], fonte: 'Treinamento Marcial' };
assert.equal(bloqueioEfeitos(espada, { bloqueiosEfeitos: [EFEITOS_PESADA], liberacoes: [LIB_PESADA] }), null,
  'permitir_equipar libera o bloqueio de efeitos');
assert.equal(bloqueioEfeitos(adaga, { bloqueios: [BLOQ_ADAGA], liberacoes: [LIB_ADAGA] }), null,
  'permitir_equipar libera o bloqueio total na consulta de efeitos');

// sem regra de efeitos, a consulta é inerte
assert.equal(bloqueioEfeitos(espada, {}), null);
assert.equal(bloqueioEfeitos(espada, { bloqueiosEfeitos: [{ reqs: [], fonte: 'vazia' }] }), null);

console.log('✅ bloquear/permitir equipar OK — total, só-efeitos, herança do modelo e liberação vencendo os dois');
