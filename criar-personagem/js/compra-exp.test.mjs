/**
 * Compra de nível com EXP na criação (atributos, perícias e exclusivas).
 * Roda com: node criar-personagem/js/compra-exp.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const raiz = new URL('../', import.meta.url);

/* Duas comuns e duas exclusivas de classe, com custos e limitadores diferentes. */
const SKILLS = {
    mental: [{ name: 'Ocultismo', key: 'ocultismo', attr: 'INT', attrLabel: 'INT', atributoBase: ['INT'], custoExp: 4, todoPersonagem: true, descricao: '' }],
    fisico: [], social: [], combate: [
        { name: 'Esquiva', key: 'esquiva', attr: 'DES', attrLabel: 'DES/VIG', atributoBase: ['DES', 'VIG'], custoExp: 4, todoPersonagem: true, descricao: '' }
    ],
    exclusivo: [
        { name: 'Canto', key: 'canto', attr: 'VIG', attrLabel: 'VIG/PRE', atributoBase: ['VIG', 'PRE'], custoExp: 2, todoPersonagem: false, descricao: 'canta' },
        { name: 'Erudição Rúnica', key: 'erudicao_runica', attr: 'INT', attrLabel: 'INT', atributoBase: ['INT'], custoExp: 5, todoPersonagem: false, descricao: 'estuda' }
    ]
};

const elementoFalso = () => ({ textContent: '', innerHTML: '', style: {}, classList: { add() {}, remove() {}, toggle() {} }, querySelectorAll: () => [], appendChild() {}, remove() {} });

/* `window` precisa ser o próprio global do sandbox: os módulos do wizard escrevem
   `window.wizardState = ...` e depois leem `wizardState` sem prefixo. */
const ctx = {
    console, setTimeout, clearTimeout, URLSearchParams,
    location: { search: '' },
    document: {
        addEventListener() {},
        getElementById: () => null,
        querySelector: () => null,
        querySelectorAll: () => [],
        createElement: () => elementoFalso(),
        body: { appendChild() {}, removeChild() {} }
    },
    SKILLS,
    CLASS_SKILLS: { Bardo: ['Canto'] },
    DERIVED_VALUES: [],
    _systemData: { mechanics: [], skills: [], races: [], classes: [], tribes: [], peculiarities: [] }
};
ctx.window = ctx;
ctx.globalThis = ctx;
vm.createContext(ctx);

// distribuicoes-module entra porque atributo e perícia leem dele o bônus que a
// peculiaridade soma na linha (bonusDeMecanicas). Sem peculiaridade escolhida
// ele devolve {} e nada muda — mas a função precisa existir.
for (const f of ['js/data.js', 'js/wizard-engine.js', 'js/exp-tracker.js', 'js/app.js', 'js/distribuicoes-module.js', 'js/attributes-module.js', 'js/skills-module.js']) {
    vm.runInContext(readFileSync(new URL(f, raiz), 'utf8'), ctx, { filename: f });
}

// storage.js não entra: aqui só interessa o cálculo, não a persistência.
vm.runInContext('function saveWizardToStorage() {}', ctx);

const run = expr => vm.runInContext(expr, ctx);

/* Estado base: 100 EXP no pool, grupos escolhidos. */
function reset() {
    run(`
        wizardState.atributos = { attr_int: 0, attr_rac: 0, attr_prs: 0, attr_for: 0, attr_des: 0, attr_vig: 0, attr_pre: 0, attr_man: 0, attr_aut: 0 };
        wizardState.atributosExp = {};
        wizardState.pericias = {};
        wizardState.periciasExp = {};
        wizardState.expSources = {};
        wizardState.classeSelecionada = 'Bardo';
        wizardState.grupoPrimario = 'Fisico';
        wizardState.grupoFraco = 'Social';
        wizardState.grupoPericiaPrimario = 'combate';
        wizardState.grupoPericia2 = 'mental';
        wizardState.grupoPericiaFraco = 'social';
        wizardState.grupoPericia3 = 'fisico';
        ExpTracker.addSource('exp_inicial', 100, 'EXP Inicial');
    `);
}

/* ===== 1. Custo por degrau ===== */
reset();
assert.equal(run('ExpTracker.custoFaixa(0, 3, 5)'), 5 + 10 + 15, 'degraus 1..3 a 5/nível somam 30');
assert.equal(run('ExpTracker.custoFaixa(2, 3, 5)'), 15, 'só o degrau 3 custa 15');

/* ===== 2. Atributo: comprar, custo e devolução ===== */
reset();
run(`comprarAtributoExp('attr_for')`); // base 1 → Nv2, custa 2×5
assert.equal(run(`nivelAtributo('attr_for')`), 2);
assert.equal(run('ExpTracker.custoComprasAtributos()'), 10);
assert.equal(run('ExpTracker.getTotal()'), 90, 'o pool cai 10 EXP');

run(`comprarAtributoExp('attr_for')`); // Nv3, +15
assert.equal(run('ExpTracker.getTotal()'), 75);

run(`venderAtributoExp('attr_for')`);
assert.equal(run('ExpTracker.getTotal()'), 90, 'devolver o nível devolve o EXP exato');

/* Teto do sistema: 5 e nada além. */
reset();
for (let i = 0; i < 10; i++) run(`comprarAtributoExp('attr_des')`);
assert.equal(run(`nivelAtributo('attr_des')`), 5, 'nem com EXP passa do 5');

/* ===== 3. Ponto inicial ocupa o degrau já pago com EXP ===== */
reset();
run(`comprarAtributoExp('attr_for')`);                 // Nv2 comprado, −10
assert.equal(run('ExpTracker.getTotal()'), 90);
run(`clickAttrDot('attr_for', 2, 'Fisico')`);          // agora o ponto paga o Nv2
assert.equal(run(`nivelAtributo('attr_for')`), 2, 'o nível não muda: o ponto assumiu o degrau');
assert.equal(run(`wizardState.atributosExp.attr_for`), 0);
assert.equal(run('ExpTracker.getTotal()'), 100, 'o EXP volta inteiro para o pool');

/* ===== 4. Perícia: limitador é o MENOR dos atributos base ===== */
reset();
run(`wizardState.atributos.attr_des = 2;`); // DES 3, VIG 1 → Esquiva trava em 1
const esquiva = `window.SKILLS.combate[0]`;
assert.equal(run(`getSkillParentAttributeLevel(${esquiva})`), 1, 'DES/VIG usa o menor, não o primeiro');
run(`comprarPericiaExp('esquiva')`);
assert.equal(run(`nivelPericia('sk_esquiva')`), 1, 'sobe até o limitador');
run(`comprarPericiaExp('esquiva')`);
assert.equal(run(`nivelPericia('sk_esquiva')`), 1, 'e trava ali até o atributo subir');

run(`wizardState.atributos.attr_vig = 2; revalidarCompras();`);
run(`comprarPericiaExp('esquiva')`);
assert.equal(run(`nivelPericia('sk_esquiva')`), 2, 'subiu VIG, a perícia destrava');

/* ===== 5. Baixar o atributo devolve o nível de perícia que ele sustentava ===== */
const antes = run('ExpTracker.getTotal()');
run(`wizardState.atributos.attr_vig = 0; revalidarCompras();`);
assert.equal(run(`nivelPericia('sk_esquiva')`), 1, 'o limitador puxa a perícia de volta');
assert.ok(run('ExpTracker.getTotal()') > antes, 'e o EXP do nível perdido volta ao pool');

/* ===== 6. Exclusivas: custo próprio e sem ponto inicial ===== */
reset();
run(`wizardState.atributos.attr_int = 2;`); // INT 3
assert.deepEqual(run('getExclusivasDisponiveis().map(s => s.name)'), ['Canto'],
    'só as exclusivas da classe escolhida aparecem');

run(`comprarPericiaExp('erudicao_runica')`); // 1 × 5 EXP
assert.equal(run('ExpTracker.custoComprasPericias()'), 5, 'usa o custoEvolucao da perícia, não o 4 padrão');
run(`comprarPericiaExp('erudicao_runica')`); // + 2 × 5
assert.equal(run('ExpTracker.custoComprasPericias()'), 15);
assert.equal(run('ExpTracker.getTotal()'), 85);

/* Exclusiva nunca recebe ponto inicial: não está em nenhum dos 4 grupos de pool. */
assert.equal(run(`getSkillGroupRemaining('combate')`), run('REGRAS_CRIACAO.pericias.primario'),
    'nada do pool de combate foi para a exclusiva');

/* ===== 7. Chave que vai para a ficha ===== */
assert.equal(run(`chaveDaFicha(findSkillByDotKey('sk_erudicao_runica'))`), 'sk_classe_erudi__o_r_nica',
    'exclusiva de classe grava como a ficha injeta (sk_classe_, com acento virando _)');
assert.equal(run(`chaveDaFicha(findSkillByDotKey('sk_ocultismo'))`), 'sk_mental_ocultismo',
    'perícia comum mantém o formato sk_<categoria>_<key>');

/* ===== 8. EXP Total conta o comprado ===== */
reset();
const totalLimpo = run('ExpTracker.calcExpTotal()');
run(`comprarAtributoExp('attr_for')`);
assert.equal(run('ExpTracker.calcExpTotal()'), totalLimpo + 10,
    'o nível comprado entra no valor total do personagem');

console.log('✅ compra-exp: 8 blocos OK');
