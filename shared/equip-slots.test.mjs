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
 *  • falta de slot livre é recusada, dizendo o que falta e quanto tem;
 *  • slot já tomado por OUTRO item não é reaproveitado;
 *  • exigência parcial não reserva nada pela metade sem acusar;
 *  • quantidade ausente vale 1, e a chave legada 'modificador' ainda é aceita;
 *  • planejarEquipar ignora o próprio item e o que está armazenado;
 *  • principal na MESMA parte que a cobertura só cabe se sobrar slot na parte.
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
  assert.equal(r.ok, true);
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
  assert.equal(r.ok, true);
  assert.deepEqual(plain(r.slots), ['pernas', 'braco_1', 'braco_2'],
    'ocupa partes do corpo diferentes de uma vez');
}

// --- sem slot livre: recusa e diz o que falta ------------------------------
{
  const c = ctx();
  const set = { slotsAdicionais: [{ id: 'BRACO', quantidade: 2 }] };
  const r = c._reservarSlots(c._slotsExtrasNecessarios(set), BODY, ['torso', 'braco_1'], label);
  assert.equal(r.ok, false);
  assert.deepEqual(plain(r.slots), [], 'não reserva nada pela metade');
  assert.match(r.faltando[0], /2× Braço \(livre: 1\)/, 'a mensagem diz o que falta e quanto tem');
}

// --- slot tomado por outro item não é reaproveitado -----------------------
{
  const c = ctx();
  const outro = { slotAnatomico: 'mao_1', slotsOcupados: ['mao_2'] };  // montante equipado
  const tomados = ['torso', ...c._slotsDoItem(outro)];
  const r = c._reservarSlots([{ parteId: 'MAO', quantidade: 1 }], BODY, tomados, label);
  assert.equal(r.ok, false, 'as duas mãos estão com o montante');
}

// --- exigência mista, uma atendida e outra não ----------------------------
{
  const c = ctx();
  const r = c._reservarSlots(
    [{ parteId: 'PERNAS', quantidade: 1 }, { parteId: 'CABECA', quantidade: 2 }], BODY, ['torso'], label);
  assert.equal(r.ok, false);
  assert.equal(r.faltando.length, 1);
  assert.match(r.faltando[0], /Cabeça/, 'só a parte impossível é acusada');
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
  assert.equal(r.ok, true, 'reequipar o próprio item não pode colidir consigo mesmo');
  assert.deepEqual(plain(r.extras), ['pernas', 'braco_1', 'braco_2']);
}

// --- planejarEquipar soma os extras já reservados (mão da arma de 2 mãos) --
{
  const c = ctx();
  const espada = { id: 'e', slotsAdicionais: [] };
  const r = c._planejarEquipar(espada, 'mao_1', [], BODY, { extrasJaReservados: ['mao_2'] });
  assert.equal(r.ok, true);
  assert.deepEqual(plain(r.extras), ['mao_2'], 'a mão extra da arma de 2 mãos entra no resultado');
}

// --- planejarEquipar respeita item de outro dono já ocupando --------------
{
  const c = ctx();
  const set = { id: 'x', slotsAdicionais: [{ id: 'BRACO', quantidade: 2 }] };
  const todos = [{ id: 'w', equipado: true, slotAnatomico: 'braco_1' }];
  const r = c._planejarEquipar(set, 'torso', todos, BODY);
  assert.equal(r.ok, false);
  assert.match(r.faltando[0], /2× Braço \(livre: 1\)/);
}

// --- principal na MESMA parte da cobertura ---------------------------------
// O catálogo tinha 5 itens oferecendo como slot principal uma parte que o
// próprio slotsAdicionais deles já consumia inteira. A ficha listava a opção e
// a reserva recusava sempre: Manto de Linho na Cabeça, Cota de Malha no Ombro,
// Peitoral de Aço nas Costas... A regra é quantidade <= slots_da_parte - 1.
{
  const c = ctx();
  const manto = { id: 'm', slotsAdicionais: [{ id: 'CABECA', quantidade: 1 }] };
  assert.equal(c._planejarEquipar(manto, 'cabeca', [], BODY, { labelParte: label }).ok, false,
    'principal na Cabeça + cobrir a Cabeça pede 2 cabeças — o corpo só tem 1');
  assert.equal(c._planejarEquipar(manto, 'torso', [], BODY, { labelParte: label }).ok, true,
    'com o principal fora da parte coberta, o mesmo item equipa');

  // Contraprova: pedir 1 Braço extra com o principal no Braço cabe, são 2.
  const ombreiras = { id: 'o', slotsAdicionais: [{ id: 'BRACO', quantidade: 1 }] };
  assert.equal(c._planejarEquipar(ombreiras, 'braco_1', [], BODY, { labelParte: label }).ok, true,
    'parte de 2 slots aguenta principal + 1 de cobertura');
}

console.log('✅ equip-slots: todos os casos passaram');
