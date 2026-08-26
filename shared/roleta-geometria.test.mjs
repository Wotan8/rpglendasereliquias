// Rodar: node shared/roleta-geometria.test.mjs
import assert from 'node:assert/strict';
import { fatias, rotacaoFinal, fatiaSobASeta, ANGULO_SETA } from './roleta-geometria.js';

// As 37 chances reais do documento de mesa, incluindo as de 0,3%
const REAIS = [1, 1, 1, 3, 3, 3, 3, 5, 3, 5, 5, 1, 3, 3, 3, 3, 3, 5, 5, 3, 5, 3, 3, 1, 1, 1,
    0.5, 3, 3, 3, 3, 5, 1, 1, 0.5, 0.3, 0.3].map((chance, i) => ({ nome: 'p' + i, chance }));

const f = fatias(REAIS);
assert.equal(f.length, 37, 'as 37 entram na roda');
assert.ok(Math.abs(f[f.length - 1].fim - 360) < 1e-9, 'as fatias fecham exatamente 360 graus');

// tamanho proporcional: a de 5% tem de ser ~16,7x a de 0,3%
const cinco = f.find(x => REAIS[x.indice].chance === 5);
const tresDecimos = f.find(x => REAIS[x.indice].chance === 0.3);
assert.ok(Math.abs(cinco.tamanho / tresDecimos.tamanho - 5 / 0.3) < 1e-9, 'proporcao preservada');

// --- INVARIANTE PRINCIPAL: girar pelo premio X para com X sob a seta ---
for (const fatia of f) {
    for (const desvio of [-0.5, -0.3, 0, 0.3, 0.5]) {
        const r = rotacaoFinal(f, fatia.indice, 6, desvio);
        const parou = fatiaSobASeta(f, r);
        assert.equal(parou.indice, fatia.indice,
            `premio ${fatia.indice} (${fatia.tamanho.toFixed(2)} graus, desvio ${desvio}) parou em ${parou.indice}`);
    }
}

// --- vale tambem para a menor fatia possivel, de 1,12 grau ---
const minusculo = f.find(x => x.tamanho < 1.2);
assert.ok(minusculo, 'existe fatia menor que 1,2 grau para testar');
assert.equal(fatiaSobASeta(f, rotacaoFinal(f, minusculo.indice, 8, 0)).indice, minusculo.indice);

// --- premio desligado (chance 0) nao ocupa espaco nem pode ser alvo ---
const comDesligado = [{ chance: 5 }, { chance: 0 }, { chance: 5 }];
const fd = fatias(comDesligado);
assert.equal(fd.length, 2);
assert.deepEqual(fd.map(x => x.indice), [0, 2], 'os indices continuam os da lista original');
assert.throws(() => rotacaoFinal(fd, 1), /nao tem fatia|não tem fatia/);

// --- roda vazia nao explode ---
assert.deepEqual(fatias([]), []);
assert.deepEqual(fatias(null), []);
assert.deepEqual(fatias([{ chance: 0 }]), []);

// --- a rotacao sempre gira para frente e inclui as voltas pedidas ---
const r6 = rotacaoFinal(f, 0, 6);
assert.ok(r6 >= 6 * 360 && r6 < 7 * 360, 'seis voltas mais o ajuste');

// --- caso de uma fatia so: qualquer rotacao para nela ---
const uma = fatias([{ chance: 1 }]);
assert.equal(uma[0].tamanho, 360);
assert.equal(fatiaSobASeta(uma, rotacaoFinal(uma, 0, 3)).indice, 0);

// --- a seta esta no topo ---
assert.equal(ANGULO_SETA, 270);

console.log('✅ roleta-geometria: todos os casos passaram (37 fatias x 5 desvios conferidos)');
