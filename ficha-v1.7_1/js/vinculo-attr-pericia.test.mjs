/**
 * Vínculo de Atributo e Perícia no equipamento (modificador ao equipar).
 *
 * Regras verificadas:
 *  • atributo soma na chave direta (attr_des) e perícia resolve id → sk_<cat>_<key>;
 *  • modificador negativo subtrai; vários itens acumulam na mesma chave;
 *  • modificador 0 ou id vazio não cria entrada;
 *  • vínculo do modelo do catálogo vale, e o da instância vence o do modelo;
 *  • perícia inexistente não quebra nem polui o bag.
 *
 * Roda com: node ficha-v1.7_1/js/vinculo-attr-pericia.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync(new URL('./inventory.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

function pega(inicio, fimMarcador) {
  const ini = src.indexOf(inicio);
  assert.ok(ini > 0, `"${inicio}" não encontrado`);
  const fim = src.indexOf(fimMarcador, ini + inicio.length);
  assert.ok(fim > ini, `fim de "${inicio}" não encontrado`);
  return src.slice(ini, fim + fimMarcador.length);
}

const CODIGO = [
  pega('function _campoDoItem(item, key)', "return (tpl && Array.isArray(tpl[key])) ? tpl[key] : [];\n}"),
  pega('const _SK_PREFIXO = {', "exclusivo: 'sk_exclusivo_',\n};"),
  pega('function _periciaDotKey(skillId)', 'return null;\n}'),
  pega('function _aplicarAtributosEPericias(item)', 'bag[chave] = (bag[chave] || 0) + mod;\n    }\n}'),
].join('\n');

/** SKILLS no formato que buildSkillsFromFirebase monta na ficha. */
const SKILLS = {
  fisico: [{ id: 'sk1', key: 'furtividade', name: 'Furtividade' }],
  mental: [{ id: 'sk2', key: 'alquimancia', name: 'Alquimancia' }],
};

function ambiente({ catalog = [] } = {}) {
  const avisos = [];
  const ctx = { console: { warn: m => avisos.push(m), log() {} }, SKILLS };
  ctx.window = ctx;
  ctx.state = { mechanicBonuses: {} };
  ctx._inventoryState = { items: [], catalog };
  vm.createContext(ctx);
  vm.runInContext(CODIGO, ctx);
  return { ctx, bag: () => ctx.state.mechanicBonuses, avisos };
}

// --- atributo: chave direta ------------------------------------------------
{
  const { ctx, bag } = ambiente();
  ctx._aplicarAtributosEPericias({ nome: 'Cota', atributosVinculados: [{ id: 'attr_des', modificador: -1 }] });
  assert.deepEqual(bag(), { attr_des: -1 }, 'atributo usa a chave dos dots direto');
}

// --- perícia: resolve id → sk_<categoria>_<key> ---------------------------
{
  const { ctx, bag } = ambiente();
  ctx._aplicarAtributosEPericias({ nome: 'Cota', periciasVinculadas: [{ id: 'sk1', modificador: -2 }] });
  assert.deepEqual(bag(), { sk_fisico_furtividade: -2 }, 'perícia física resolve com prefixo da categoria');
}
{
  const { ctx, bag } = ambiente();
  ctx._aplicarAtributosEPericias({ nome: 'Kit', periciasVinculadas: [{ id: 'sk2', modificador: 1 }] });
  assert.deepEqual(bag(), { sk_mental_alquimancia: 1 }, 'perícia mental usa o outro prefixo');
}

// --- a penalidade completa de uma armadura pesada --------------------------
{
  const { ctx, bag } = ambiente();
  ctx._aplicarAtributosEPericias({
    nome: 'Armadura de Torneio',
    atributosVinculados: [{ id: 'attr_des', modificador: -3 }],
    periciasVinculadas: [{ id: 'sk1', modificador: -5 }],
  });
  assert.deepEqual(bag(), { attr_des: -3, sk_fisico_furtividade: -5 },
    'Pesada III: −3 DES e −5 Furtividade numa peça só, sem mecânica');
}

// --- vários itens acumulam na mesma chave ---------------------------------
{
  const { ctx, bag } = ambiente();
  ctx._aplicarAtributosEPericias({ nome: 'Armadura', atributosVinculados: [{ id: 'attr_des', modificador: -2 }] });
  ctx._aplicarAtributosEPericias({ nome: 'Escudo', atributosVinculados: [{ id: 'attr_des', modificador: -1 }] });
  assert.deepEqual(bag(), { attr_des: -3 }, 'armadura + escudo somam a penalidade');
}

// --- ruído não cria entrada ------------------------------------------------
{
  const { ctx, bag } = ambiente();
  ctx._aplicarAtributosEPericias({
    nome: 'Roupa',
    atributosVinculados: [{ id: 'attr_for', modificador: 0 }, { id: '', modificador: 3 }],
    periciasVinculadas: [{ id: 'sk1', modificador: 0 }],
  });
  assert.deepEqual(bag(), {}, 'modificador 0 ou id vazio é ignorado');
}

// --- herança do modelo do catálogo ---------------------------------------
{
  const { ctx, bag } = ambiente({
    catalog: [{ id: 'm1', atributosVinculados: [{ id: 'attr_vig', modificador: 2 }] }],
  });
  ctx._aplicarAtributosEPericias({ nome: 'Peça', modeloId: 'm1' });
  assert.deepEqual(bag(), { attr_vig: 2 }, 'item sem vínculo próprio herda o do modelo');
}
{
  const { ctx, bag } = ambiente({
    catalog: [{ id: 'm1', atributosVinculados: [{ id: 'attr_vig', modificador: 2 }] }],
  });
  ctx._aplicarAtributosEPericias({ nome: 'Peça', modeloId: 'm1', atributosVinculados: [{ id: 'attr_vig', modificador: 9 }] });
  assert.deepEqual(bag(), { attr_vig: 9 }, 'vínculo da instância vence o do modelo');
}

// --- perícia que não existe mais ------------------------------------------
{
  const { ctx, bag, avisos } = ambiente();
  ctx._aplicarAtributosEPericias({ nome: 'Relíquia', periciasVinculadas: [{ id: 'sk-apagada', modificador: -1 }] });
  assert.deepEqual(bag(), {}, 'perícia inexistente não polui o bag');
  assert.ok(avisos.some(a => /não encontrada/.test(a)), 'e avisa no console em vez de falhar calado');
}

console.log('✅ vinculo-attr-pericia: todos os casos passaram');
