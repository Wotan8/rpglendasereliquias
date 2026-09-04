// node ficha-v1.7_1/js/pec-duplicada.test.mjs
// Mesma peculiaridade vinda por dois caminhos (Classe + avulsa) aplica as
// mecânicas UMA vez. Sem isto o Teto de Arma do Guerreiro com "Domínio de
// Armas de Braço" soma [FOR] duas vezes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const aplicadas = [];

const ctx = vm.createContext({
    console: { log() {}, warn() {}, error() {} },
    document: { getElementById: () => null, querySelectorAll: () => [], addEventListener() {} },
    state: { dots: {}, auras: {} },
});
ctx.window = ctx;
vm.runInContext(fs.readFileSync(path.join(dir, 'mechanics-engine.js'), 'utf8'), ctx);
// depois de carregar: a declaração real sobrescreveria o dublê
ctx.applyMechanicToSheet = (mech, pec) => aplicadas.push(`${pec.id}:${mech.id}`);

const aplicar = vm.runInContext('_aplicarPecUmaVez', ctx);
const limpar = () => vm.runInContext('_pecsAplicadas.clear()', ctx);

const dominio = { id: 'dom1', key: 'dom1', nome: 'Mestre em Armas', mecanicas: [{ id: 'm_teto' }] };

// --- Herdada da classe e comprada como avulsa: aplica uma vez só ---
aplicar(dominio);
aplicar({ ...dominio });
assert.deepEqual(aplicadas, ['dom1:m_teto'], 'a segunda cópia não soma de novo');

// --- Nova passada de recálculo aplica de novo (o Set é por passada) ---
limpar();
aplicar(dominio);
assert.equal(aplicadas.length, 2, 'recalcular a ficha reaplica');

// --- Pec sem mecânicas e entrada inválida não quebram ---
aplicar({ id: 'vazia' });
aplicar(null);
assert.equal(aplicadas.length, 2);

// --- Aura vinculada também entra uma vez, no maior grau ---
limpar();
ctx.AURAS = [{ id: 'a1' }];
aplicar({ id: 'p2', mecanicas: [], auraVinculadaId: 'a1', auraGrauConcedido: 2 });
aplicar({ id: 'p3', mecanicas: [], auraVinculadaId: 'a1', auraGrauConcedido: 1 });
assert.equal(ctx.state.auras.a1.grauDesbloqueado, 2, 'grau menor não rebaixa a aura');

console.log('OK');
