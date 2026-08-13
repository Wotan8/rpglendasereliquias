/**
 * Slots de equipamento — shared/equip-slots.js.
 *
 * Módulo único usado pelos TRÊS inventários: ficha do personagem, aliados e
 * NPCs do painel do mestre. O teste roda contra o compartilhado, então uma
 * regressão aqui pega os três de uma vez.
 *
 * Regras verificadas:
 *  • slotsDoItem reúne principal + adicionais + o legado slotAnatomico2;
 *  • espada de duas mãos toma 2 Mãos; armadura completa toma Torso+Pernas+Braços;
 *  • cobertura que não cabe NÃO impede o equipar — ocupa o que dá e avisa no naoCoube;
 *  • slot já tomado por OUTRO item não é reaproveitado;
 *  • quantidade ausente vale 1, e a chave legada 'modificador' ainda é aceita;
 *  • planejarEquipar ignora o próprio item e o que está armazenado;
 *  • principal na MESMA parte que a cobertura só cabe se sobrar slot na parte;
 *  • MODO DE USO: a 2ª mão é REQUISITO (recusa), a cobertura não é;
 *  • vínculo de VD com `maos` só vale naquela pegada, e o dado de 2 mãos
 *    (formulaDano2Maos) troca a fórmula sem trocar a peça.
 *
 * Roda com: node shared/equip-slots.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync(new URL('./equip-slots.js', import.meta.url), 'utf8');

// Corpo humano: 2 Mãos, 2 Braços, 1 Torso, 1 Pernas, 1 Cabeça.
const BODY = {
  mao_1: { partId: 'MAO' }, mao_2: { partId: 'MAO' },
  braco_1: { partId: 'BRACO' }, braco_2: { partId: 'BRACO' },
  torso: { partId: 'TORSO' }, pernas: { partId: 'PERNAS' }, cabeca: { partId: 'CABECA' },
};
const NOMES = { MAO: 'Mão', BRACO: 'Braço', TORSO: 'Torso', PERNAS: 'Pernas', CABECA: 'Cabeça' };
const label = id => NOMES[id] || id;

/** Valores criados dentro do vm têm outro prototype; normaliza para o teste. */
const plain = o => JSON.parse(JSON.stringify(o));

function ctx(catalog = []) {
  const c = { console: { warn() {}, log() {} } };
  c.window = c;
  vm.createContext(c);
  vm.runInContext(src, c);
  const E = c.EquipSlots;
  // Mesma assinatura que o teste usava antes, com o catálogo já injetado.
  return {
    _slotsDoItem: E.slotsDoItem,
    _itemOcupaSlot: E.itemOcupaSlot,
    _slotsExtrasNecessarios: item => E.slotsExtrasNecessarios(item, catalog),
    _reservarSlots: E.reservarSlots,
    _planejarEquipar: (item, slot, todos, body, opts) =>
      E.planejarEquipar(item, slot, todos, body, { catalog, labelParte: label, ...(opts || {}) }),
  };
}

// --- _slotsDoItem reúne as três origens -----------------------------------
{
  const c = ctx();
  assert.deepEqual(plain(c._slotsDoItem({ slotAnatomico: 'torso' })), ['torso']);
  assert.deepEqual(plain(c._slotsDoItem({ slotAnatomico: 'mao_1', slotAnatomico2: 'mao_2' })), ['mao_1', 'mao_2'],
    'formato legado de arma de duas mãos continua contando');
  assert.deepEqual(plain(c._slotsDoItem({ slotAnatomico: 'torso', slotsOcupados: ['pernas', 'braco_1'] })),
    ['torso', 'pernas', 'braco_1']);
  assert.deepEqual(plain(c._slotsDoItem(null)), []);
  assert.equal(c._itemOcupaSlot({ slotAnatomico: 'torso', slotsOcupados: ['pernas'] }, 'pernas'), true);
  assert.equal(c._itemOcupaSlot({ slotAnatomico: 'torso' }, 'pernas'), false);
}

// --- espada de duas mãos: +1 Mão ------------------------------------------
{
  const c = ctx();
  const espada = { nome: 'Montante', slotsAdicionais: [{ id: 'MAO', quantidade: 1 }] };
  const r = c._reservarSlots(c._slotsExtrasNecessarios(espada), BODY, ['mao_1'], label);
  assert.deepEqual(plain(r.naoCoube), []);
  assert.deepEqual(plain(r.slots), ['mao_2'], 'pega a mão que sobrou');
}

// --- armadura completa: Torso (principal) + Pernas + 2 Braços -------------
{
  const c = ctx();
  const set = {
    nome: 'Armadura Completa',
    slotsAdicionais: [{ id: 'PERNAS', quantidade: 1 }, { id: 'BRACO', quantidade: 2 }],
  };
  const r = c._reservarSlots(c._slotsExtrasNecessarios(set), BODY, ['torso'], label);
  assert.deepEqual(plain(r.naoCoube), []);
  assert.deepEqual(plain(r.slots), ['pernas', 'braco_1', 'braco_2'],
    'ocupa partes do corpo diferentes de uma vez');
}

// --- cobertura sem slot livre: ocupa o que dá, não recusa ------------------
{
  const c = ctx();
  const set = { slotsAdicionais: [{ id: 'BRACO', quantidade: 2 }] };
  const r = c._reservarSlots(c._slotsExtrasNecessarios(set), BODY, ['torso', 'braco_1'], label);
  assert.deepEqual(plain(r.slots), ['braco_2'], 'reserva o braço que sobrou');
  assert.match(r.naoCoube[0], /1× Braço/, 'acusa só o que ficou de fora');
}

// --- parte que o corpo NEM TEM: ignora e segue ----------------------------
{
  const c = ctx();
  const semCauda = c._reservarSlots([{ parteId: 'CAUDA', quantidade: 1 }], BODY, ['torso'], label);
  assert.deepEqual(plain(semCauda.slots), []);
  assert.deepEqual(plain(semCauda.naoCoube), ['1× CAUDA']);
}

// --- slot tomado por outro item não é reaproveitado -----------------------
{
  const c = ctx();
  const outro = { slotAnatomico: 'mao_1', slotsOcupados: ['mao_2'] };  // montante equipado
  const tomados = ['torso', ...c._slotsDoItem(outro)];
  const r = c._reservarSlots([{ parteId: 'MAO', quantidade: 1 }], BODY, tomados, label);
  assert.deepEqual(plain(r.slots), [], 'as duas mãos estão com o montante');
}

// --- cobertura mista, uma cabe e outra não -------------------------------
{
  const c = ctx();
  const r = c._reservarSlots(
    [{ parteId: 'PERNAS', quantidade: 1 }, { parteId: 'CABECA', quantidade: 2 }], BODY, ['torso'], label);
  assert.deepEqual(plain(r.slots), ['pernas', 'cabeca'], 'pega tudo que existe');
  assert.equal(r.naoCoube.length, 1);
  assert.match(r.naoCoube[0], /1× Cabeça/, 'só a sobra impossível é acusada');
}

// --- quantidade ausente = 1; chave legada 'modificador' aceita ------------
{
  const c = ctx();
  assert.deepEqual(plain(c._slotsExtrasNecessarios({ slotsAdicionais: [{ id: 'MAO' }] })),
    [{ parteId: 'MAO', quantidade: 1 }], 'sem quantidade vale 1');
  assert.deepEqual(plain(c._slotsExtrasNecessarios({ slotsAdicionais: [{ id: 'BRACO', modificador: 2 }] })),
    [{ parteId: 'BRACO', quantidade: 2 }], "aceita a chave 'modificador' do seletor");
  assert.deepEqual(plain(c._slotsExtrasNecessarios({ slotsAdicionais: [{ quantidade: 3 }] })), [],
    'entrada sem parte do corpo é descartada');
  assert.deepEqual(plain(c._slotsExtrasNecessarios({})), []);
}

// --- herda do modelo do catálogo ------------------------------------------
{
  const c = ctx([{ id: 'm1', slotsAdicionais: [{ id: 'MAO', quantidade: 1 }] }]);
  assert.deepEqual(plain(c._slotsExtrasNecessarios({ modeloId: 'm1' })),
    [{ parteId: 'MAO', quantidade: 1 }], 'item sem vínculo próprio herda o do modelo');
}

// --- planejarEquipar: ignora o próprio item e o que está armazenado --------
{
  const c = ctx();
  const set = { id: 'x', nome: 'Armadura Completa',
                slotsAdicionais: [{ id: 'PERNAS', quantidade: 1 }, { id: 'BRACO', quantidade: 2 }] };
  const todos = [
    { id: 'x', equipado: true, slotAnatomico: 'torso', slotsOcupados: ['pernas'] }, // ele mesmo
    { id: 'y', equipado: true, estadoEquip: 'armazenado', slotAnatomico: 'braco_1' }, // na mochila
    { id: 'z', equipado: false, slotAnatomico: 'braco_2' },                           // desequipado
  ];
  const r = c._planejarEquipar(set, 'torso', todos, BODY);
  assert.deepEqual(plain(r.naoCoube), [], 'reequipar o próprio item não pode colidir consigo mesmo');
  assert.deepEqual(plain(r.extras), ['pernas', 'braco_1', 'braco_2']);
}

// --- planejarEquipar soma os extras já reservados (mão da arma de 2 mãos) --
{
  const c = ctx();
  const espada = { id: 'e', slotsAdicionais: [] };
  const r = c._planejarEquipar(espada, 'mao_1', [], BODY, { extrasJaReservados: ['mao_2'] });
  assert.deepEqual(plain(r.extras), ['mao_2'], 'a mão extra da arma de 2 mãos entra no resultado');
}

// --- planejarEquipar respeita item de outro dono já ocupando --------------
{
  const c = ctx();
  const set = { id: 'x', slotsAdicionais: [{ id: 'BRACO', quantidade: 2 }] };
  const todos = [{ id: 'w', equipado: true, slotAnatomico: 'braco_1' }];
  const r = c._planejarEquipar(set, 'torso', todos, BODY);
  assert.deepEqual(plain(r.extras), ['braco_2'], 'o braço do outro item continua fora de alcance');
  assert.match(r.naoCoube[0], /1× Braço/);
}

// --- principal na MESMA parte da cobertura ---------------------------------
// O catálogo tem itens cujo slot principal fica na parte que o próprio
// slotsAdicionais já consome inteira (Manto de Linho na Cabeça, Cota de Malha
// no Ombro). Antes isso recusava o equipar; agora só cobre menos.
{
  const c = ctx();
  const manto = { id: 'm', slotsAdicionais: [{ id: 'CABECA', quantidade: 1 }] };
  const naCabeca = c._planejarEquipar(manto, 'cabeca', [], BODY, { labelParte: label });
  assert.deepEqual(plain(naCabeca.extras), [], 'a única cabeça já é o slot principal');
  assert.match(naCabeca.naoCoube[0], /1× Cabeça/, 'equipa assim mesmo, só não cobre duas vezes');

  const noTorso = c._planejarEquipar(manto, 'torso', [], BODY, { labelParte: label });
  assert.deepEqual(plain(noTorso.extras), ['cabeca'], 'com o principal fora da parte, a cobertura cabe');
}

// === MODO DE USO (mãos) ====================================================
// A 2ª mão é REQUISITO, ao contrário da cobertura dos slotsAdicionais.

/** O módulo cru, para as funções que não precisam de catálogo. */
function modulo() {
  const c = { console: { warn() {}, log() {} } };
  c.window = c;
  vm.createContext(c);
  vm.runInContext(src, c);
  return c.EquipSlots;
}

// --- maosDoItem: a categoria manda; onde ela não decide, vale maosUsadas ----
{
  const ES = modulo();
  assert.equal(ES.maosDoItem({ tipo: 'Arma', categoriaArma: 'duas_maos' }), 2);
  assert.equal(ES.maosDoItem({ tipo: 'Arma', categoriaArma: 'duas_maos', maosUsadas: 1 }), 2,
    'categoria fixa ignora a escolha do dono');
  assert.equal(ES.maosDoItem({ tipo: 'Arma', categoriaArma: 'uma_mao' }), 1);
  assert.equal(ES.maosDoItem({ tipo: 'Arma', categoriaArma: 'versatil', maosUsadas: 2 }), 2);
  assert.equal(ES.maosDoItem({ tipo: 'Arma', categoriaArma: 'versatil' }), 1, 'sem escolha = 1 mão');
  assert.equal(ES.maosDoItem({ tipo: 'Vestimenta', maosUsadas: 2 }), 1, 'só arma ocupa mão');
  assert.equal(ES.escolheMaos({ tipo: 'Arma', categoriaArma: 'versatil' }), true);
  assert.equal(ES.escolheMaos({ tipo: 'Arma', categoriaArma: 'distancia' }), true, 'arco também');
  assert.equal(ES.escolheMaos({ tipo: 'Arma', categoriaArma: 'escudo' }), false);
}

// --- vinculoValeComMaos: o mesmo machado com dois conjuntos de VD ----------
{
  const ES = modulo();
  const machado1 = { tipo: 'Arma', categoriaArma: 'versatil', maosUsadas: 1 };
  const machado2 = { ...machado1, maosUsadas: 2 };
  const sempre = { id: 'a' }, so1 = { id: 'b', maos: 1 }, so2 = { id: 'c', maos: 2 };
  assert.equal(ES.vinculoValeComMaos(sempre, machado1), true);
  assert.equal(ES.vinculoValeComMaos(sempre, machado2), true, 'sem maos = vale nos dois modos');
  assert.equal(ES.vinculoValeComMaos(so1, machado1), true);
  assert.equal(ES.vinculoValeComMaos(so1, machado2), false);
  assert.equal(ES.vinculoValeComMaos(so2, machado2), true);
  assert.equal(ES.vinculoValeComMaos(so2, machado1), false);
  assert.equal(ES.vinculoValeComMaos({ id: 'd', maos: 0 }, machado2), true, '0 = sempre');
}

// --- formulaDanoPorMaos: instância vence modelo por inteiro ----------------
{
  const ES = modulo();
  const tpl = { formulaDano: '1d8', formulaDano2Maos: '1d12' };
  const uma = { tipo: 'Arma', categoriaArma: 'versatil', maosUsadas: 1 };
  const duas = { ...uma, maosUsadas: 2 };
  assert.equal(ES.formulaDanoPorMaos(uma, tpl), '1d8');
  assert.equal(ES.formulaDanoPorMaos(duas, tpl), '1d12');
  assert.equal(ES.formulaDanoPorMaos({ ...duas, formulaDano: '2d6' }, tpl), '2d6',
    'peça com dado próprio não consulta mais o modelo');
  assert.equal(ES.formulaDanoPorMaos({ ...duas, formulaDano2Maos: '3d6' }, tpl), '3d6');
  assert.equal(ES.formulaDanoPorMaos(duas, { formulaDano: '1d6' }), '1d6', 'sem 2 mãos cadastrado, o mesmo dado');
  assert.equal(ES.formulaDanoPorMaos({}, null), '');
}

// --- planejarEquipar reserva (e exige) a 2ª mão ----------------------------
{
  const c = ctx();
  const montante = { id: 'm', tipo: 'Arma', categoriaArma: 'duas_maos' };

  const ok = c._planejarEquipar(montante, 'mao_1', [], BODY);
  assert.equal(ok.faltaMao, null);
  assert.deepEqual(plain(ok.extras), ['mao_2'], 'a 2ª mão entra sem slotsAdicionais nenhum');
  assert.equal(ok.maoExtra, 'mao_2');

  const outraArma = [{ id: 'z', equipado: true, slotAnatomico: 'mao_2' }];
  const falta = c._planejarEquipar(montante, 'mao_1', outraArma, BODY);
  assert.match(falta.faltaMao, /1× Mão/, 'sem a 2ª mão livre, RECUSA — não é cobertura');
  assert.deepEqual(plain(falta.extras), []);

  // Versátil escolhendo 1 mão equipa com a outra mão ocupada.
  const machado = { id: 'x', tipo: 'Arma', categoriaArma: 'versatil', maosUsadas: 1 };
  assert.equal(c._planejarEquipar(machado, 'mao_1', outraArma, BODY).faltaMao, null);
  assert.match(c._planejarEquipar({ ...machado, maosUsadas: 2 }, 'mao_1', outraArma, BODY).faltaMao, /Mão/);
}

// --- a 2ª mão não atropela a cobertura, e vice-versa -----------------------
{
  const c = ctx();
  // Espadão que também prende no Braço: mão extra + cobertura no mesmo plano.
  const arma = { id: 'a', tipo: 'Arma', categoriaArma: 'duas_maos',
                 slotsAdicionais: [{ id: 'BRACO', quantidade: 2 }] };
  const r = c._planejarEquipar(arma, 'mao_1', [], BODY);
  assert.deepEqual(plain(r.extras), ['mao_2', 'braco_1', 'braco_2']);
  assert.deepEqual(plain(r.naoCoube), []);
}

console.log('✅ equip-slots: todos os casos passaram');
