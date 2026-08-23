/**
 * Mestre mexe no EXP Restante à mão → a ficha pergunta se reflete no Total.
 *
 * O risco aqui é a pergunta aparecer quando NÃO deve: spendExp() e companhia
 * escrevem no mesmo campo o tempo todo, e se o vigia disparasse nelas o mestre
 * levaria um toast a cada bolinha comprada. Por isso o valor de partida sai do
 * `focus` (só edição manual passa por ele) e a pergunta sai do `change`.
 *
 * Roda com: node ficha-v1.7_1/js/exp-restante-total.test.mjs
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

/* ===== DOM de mentira: um input que dispara focus/change de verdade ===== */
function campoFalso(valor) {
    const ouvintes = {};
    return {
        value: String(valor),
        dataset: {},
        addEventListener(ev, fn) { (ouvintes[ev] ||= []).push(fn); },
        disparar(ev) { (ouvintes[ev] || []).forEach(fn => fn()); },
        get temOuvintes() { return Object.keys(ouvintes).length > 0; }
    };
}

let campos, toasts;

function montar() {
    campos = { exp: campoFalso(4), exp_total: campoFalso(358) };
    toasts = [];
    const sandbox = {
        window: {},
        setTimeout: () => {},
        scheduleAutosave: () => {},
        document: { querySelector: (s) => campos[(s.match(/"(.+)"/) || [])[1]] || null },
    };
    vm.createContext(sandbox);
    sandbox.showExpToast = (msg, tipo, botoes) => toasts.push({ msg, tipo, botoes });
    vm.runInContext([
        recorta(exp, 'function podeGastarDeGraca('),
        recorta(exp, 'function _refletirNoTotal('),
        recorta(exp, 'function _perguntarSobreOTotal('),
        recorta(exp, 'function initVigiaExpRestante('),
    ].join('\n'), sandbox);
    return sandbox;
}

/** Edita o campo como um humano: foca, digita, sai. */
const editar = (novo) => {
    campos.exp.disparar('focus');
    campos.exp.value = String(novo);
    campos.exp.disparar('change');
};
const responder = (rotulo) => {
    const b = toasts.at(-1).botoes.find(x => x.label === rotulo);
    assert.ok(b, `botão "${rotulo}" não existe em ${JSON.stringify(toasts.at(-1).botoes.map(x => x.label))}`);
    if (b.action) b.action();
};

/* ===== 1. Mestre aumenta o Restante ===== */
let s = montar();
s.window.isMestre = true;
vm.runInContext('initVigiaExpRestante()', s);

editar(34);                                     // 4 → 34, o mestre deu 30 EXP
assert.equal(toasts.length, 1, 'mudar o Restante à mão tem de perguntar sobre o Total');
assert.match(toasts[0].msg, /4 → 34 \(\+30\)/, 'a pergunta mostra de onde para onde foi');
assert.match(toasts[0].msg, /358 → 388/, 'e o que aconteceria com o Total');

responder('✓ Somar no Total');
assert.equal(campos.exp_total.value, 388, 'somou os 30 no Total');
assert.equal(campos.exp.value, '34', 'o Restante fica como o mestre digitou');

/* ===== 2. Recusar deixa o Total quieto ===== */
s = montar();
s.window.isMestre = true;
vm.runInContext('initVigiaExpRestante()', s);
editar(50);
responder('✕ Só o Restante');
assert.equal(campos.exp_total.value, '358', 'recusando, o Total não se mexe');

/* ===== 3. Diminuir o Restante subtrai do Total ===== */
s = montar();
s.window.isMestre = true;
vm.runInContext('initVigiaExpRestante()', s);
campos.exp.value = '100';
editar(70);                                     // −30
assert.match(toasts.at(-1).msg, /Subtrair 30/, 'delta negativo pergunta em subtrair');
responder('✓ Subtrair do Total');
assert.equal(campos.exp_total.value, 328);

/* ===== 4. O Total nunca fica negativo ===== */
s = montar();
s.window.isMestre = true;
vm.runInContext('initVigiaExpRestante()', s);
campos.exp_total.value = '10';
campos.exp.value = '100';
editar(0);                                      // −100 contra um Total de 10
responder('✓ Subtrair do Total');
assert.equal(campos.exp_total.value, 0, 'o Total é histórico: piso em zero, não negativo');

/* ===== 5. Nada muda, nada pergunta ===== */
s = montar();
s.window.isMestre = true;
vm.runInContext('initVigiaExpRestante()', s);
editar(4);                                      // mesmo valor
assert.equal(toasts.length, 0, 'sair do campo sem mudar nada não pode perguntar');

/* ===== 6. Escrita programática (spendExp e cia.) não dispara =====
   É o caso que mais incomodaria: comprar uma bolinha mexe neste campo. */
s = montar();
s.window.isMestre = true;
vm.runInContext('initVigiaExpRestante()', s);
campos.exp.value = '999';                       // como spendExp faz: .value direto
assert.equal(toasts.length, 0, 'mudar .value sem change não pode perguntar');

/* ===== 7. Jogador não é perguntado (nem edita o campo) ===== */
s = montar();
s.window.isMestre = false;
s.window.isCreator = false;
vm.runInContext('initVigiaExpRestante()', s);
editar(34);
assert.equal(toasts.length, 0, 'a pergunta é do mestre; para o jogador o campo é readOnly');

/* ===== 8. Ligar duas vezes não duplica a pergunta ===== */
s = montar();
s.window.isMestre = true;
vm.runInContext('initVigiaExpRestante(); initVigiaExpRestante()', s);
editar(34);
assert.equal(toasts.length, 1, 'initVigiaExpRestante tem de ser idempotente');

console.log('✅ EXP Restante × Total OK — pergunta só na edição manual do mestre, e o Total tem piso zero');
