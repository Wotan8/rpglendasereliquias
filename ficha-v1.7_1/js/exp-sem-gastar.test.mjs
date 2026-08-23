/**
 * Mestre/Criador sobe nível com o custo em EXP OPCIONAL.
 *
 * O confirm é o único lugar que decide isso, e ele avisa o chamador por um
 * booleano: `onConfirm(true)` cobra, `onConfirm(false)` concede de graça. Se
 * algum chamador ignorar a flag, o mestre passa a gastar EXP sem querer — daí
 * este teste travar tanto os botões quanto a flag que cada um entrega.
 *
 * Roda com: node ficha-v1.7_1/js/exp-sem-gastar.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const exp = readFileSync(new URL('./exp-upgrade.js', import.meta.url), 'utf8');

const recorta = (src, assinatura) => {
    const ini = src.indexOf(assinatura);
    assert.ok(ini > 0, `${assinatura} não encontrado`);
    const fim = src.indexOf('\n}\n', ini) + 3;
    return src.slice(ini, fim);
};

/* DOM de mentira: só o bastante para o toast se montar e ser lido. */
const criados = [];
const elemento = () => {
    const el = {
        className: '', textContent: '', filhos: [],
        classList: { add() {}, remove() {}, contains: () => false },
        appendChild(f) { this.filhos.push(f); return f; },
        addEventListener(ev, fn) { if (ev === 'click') this.aoClicar = fn; },
        parentNode: null
    };
    criados.push(el);
    return el;
};
const container = elemento();
const campos = { exp: { value: '10' }, exp_total: { value: '100' } };

const sandbox = {
    window: {},
    setTimeout: () => {},
    scheduleAutosave: () => {},
    document: {
        getElementById: (id) => (id === 'expToastContainer' ? container : null),
        querySelector: (s) => campos[(s.match(/"(.+)"/) || [])[1]] || null,
        createElement: elemento
    },
};
vm.createContext(sandbox);
vm.runInContext([
    'let _activeToast = null;',
    'function dismissExpToast() { _activeToast = null; }',
    recorta(exp, 'function podeGastarDeGraca('),
    recorta(exp, 'function getCurrentExp('),
    recorta(exp, 'function setCurrentExp('),
    recorta(exp, 'function concederSemGastar('),
    recorta(exp, 'function spendExp('),
    recorta(exp, 'function showExpToast('),
    recorta(exp, 'function showUpgradeConfirm('),
].join('\n'), sandbox);

/** Confirma e devolve os botões desenhados + o que cada um entrega ao chamador. */
function confirmar({ mestre, semExp }) {
    sandbox.window.isMestre = !!mestre;
    container.filhos.length = 0;
    const recebido = [];
    sandbox.aoConfirmar = (comExp) => recebido.push(comExp);
    vm.runInContext(
        `showUpgradeConfirm('Força', 3, 30, aoConfirmar, ${JSON.stringify({ semExp: !!semExp })})`,
        sandbox);

    const toast = container.filhos.at(-1);
    const linha = toast.filhos.find(f => f.className === 'exp-toast-btns');
    const botoes = linha ? linha.filhos : [];
    return {
        mensagem: toast.filhos[0].textContent,
        rotulos: botoes.map(b => b.textContent),
        clicar: (rotulo) => {
            const b = botoes.find(x => x.textContent === rotulo);
            assert.ok(b, `botão "${rotulo}" não existe`);
            b.aoClicar();
            return recebido;
        }
    };
}

/* ===== 1. Jogador: nada muda ===== */
const jogador = confirmar({ mestre: false });
assert.deepEqual(jogador.rotulos, ['✓ Confirmar', '✕ Cancelar'],
    'jogador não pode ver a opção de conceder de graça');
assert.deepEqual(jogador.clicar('✓ Confirmar'), [true],
    'confirmar do jogador sempre cobra o EXP');

/* ===== 2. Mestre: escolhe pagar ou não ===== */
const mestre = confirmar({ mestre: true });
assert.deepEqual(mestre.rotulos, ['✓ Gastar 30 EXP', '🛡️ Sem gastar', '✕ Cancelar'],
    'mestre recebe as duas opções, com o custo escrito no botão que cobra');
assert.deepEqual(mestre.clicar('🛡️ Sem gastar'), [false],
    'a concessão gratuita precisa entregar false — é o que impede o spendExp()');

const mestre2 = confirmar({ mestre: true });
assert.deepEqual(mestre2.clicar('✓ Gastar 30 EXP'), [true],
    'o mestre que escolhe pagar cobra igual ao jogador');

/* ===== 3. Criador conta como mestre ===== */
sandbox.window.isMestre = false;
sandbox.window.isCreator = true;
container.filhos.length = 0;
vm.runInContext(`showUpgradeConfirm('Força', 3, 30, () => {}, {})`, sandbox);
const doCriador = container.filhos.at(-1).filhos.find(f => f.className === 'exp-toast-btns');
assert.ok(doCriador.filhos.some(b => b.textContent === '🛡️ Sem gastar'),
    'Criador tambem concede sem cobrar');
sandbox.window.isCreator = false;

/* ===== 4. Sem EXP: só sobra a concessão ===== */
const semExp = confirmar({ mestre: true, semExp: true });
assert.deepEqual(semExp.rotulos, ['🛡️ Sem gastar', '✕ Cancelar'],
    'sem EXP no personagem, o botão de pagar não pode aparecer');
assert.match(semExp.mensagem, /não tem esse EXP/,
    'a mensagem precisa dizer por que só há uma opção');

/* ===== 5. O que cada botão faz com o EXP da ficha =====
   Reproduz o que todo chamador precisa escrever (core.js, race-peculiarities.js,
   class-modules-renderer.js): pagar sai de Restante, conceder soma no Total. */
const aplicar = (comExp, custo) => {
    sandbox.comExp = comExp;
    vm.runInContext(`comExp ? spendExp(${custo}) : concederSemGastar(${custo})`, sandbox);
};

campos.exp.value = '100'; campos.exp_total.value = '250';
aplicar(true, 30);
assert.equal(campos.exp.value, 70, 'pagar sai do EXP Restante');
assert.equal(campos.exp_total.value, '250', 'pagar não mexe no Total — ele é histórico');

campos.exp.value = '100'; campos.exp_total.value = '250';
aplicar(false, 30);
assert.equal(campos.exp.value, '100', 'conceder não encosta no Restante');
assert.equal(campos.exp_total.value, 280,
    'conceder soma o custo no Total: o personagem passou a valer aqueles 30 EXP');

console.log('✅ concessão sem EXP OK — jogador cobra sempre, mestre escolhe, sem EXP só concede');
