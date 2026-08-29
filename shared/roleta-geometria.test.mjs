// Rodar: node shared/roleta-geometria.test.mjs
import assert from 'node:assert/strict';
import { fatias, rotacaoFinal, fatiaSobASeta, fatiaNoPonto, ANGULO_SETA } from './roleta-geometria.js';

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

/* --- ONDE O DEDO CAIU ---
   A janela de espiada abre a fatia que a pessoa tocou. Errar aqui mostra o
   prêmio do vizinho, o que é pior do que não mostrar nada: a pessoa acredita.
   O ancoradouro é a seta, que já tem invariante própria acima. Um ponto posto
   NA direção da seta tem de dar a mesma fatia que `fatiaSobASeta`, em qualquer
   rotação — no dia em que alguém trocar um sinal, os dois discordam. */
const R = 100;
for (let rot = 0; rot < 360; rot += 7) {
    // ANGULO_SETA = 270 graus e o y cresce para baixo, entao a seta e -y
    const alvo = fatiaSobASeta(f, rot);
    const achado = fatiaNoPonto(f, rot, 0, -R * 0.7, R);
    assert.ok(achado, `nada sob a seta com a roda em ${rot}`);
    assert.equal(achado.indice, alvo.indice,
        `discordou de fatiaSobASeta em ${rot}: ${achado.indice} contra ${alvo.indice}`);
}

// e um ponto no MEIO de cada fatia tem de devolver aquela fatia, sempre
for (const fatia of f) {
    const rad = fatia.meio * Math.PI / 180;
    const achado = fatiaNoPonto(f, 0, Math.cos(rad) * R * 0.6, Math.sin(rad) * R * 0.6, R);
    assert.equal(achado?.indice, fatia.indice, `o meio da fatia ${fatia.indice} caiu fora dela`);
}

// fora do aro e dentro do eixo nao sao fatia nenhuma
assert.equal(fatiaNoPonto(f, 0, R * 1.2, 0, R), null, 'fora do disco devia dar null');
assert.equal(fatiaNoPonto(f, 0, 3, 0, R, 20), null, 'o miolo devia dar null');
assert.ok(fatiaNoPonto(f, 0, 25, 0, R, 20), 'logo depois do miolo ja e fatia');

// a roda girada leva o ponto junto: o mesmo pixel vira outra fatia
assert.notEqual(fatiaNoPonto(f, 0, 0, -R * 0.7, R).indice,
    fatiaNoPonto(f, 180, 0, -R * 0.7, R).indice,
    'girar meia volta tinha de trocar a fatia sob o dedo');


console.log('✅ roleta-geometria: todos os casos passaram (37 fatias x 5 desvios, mais o ponto sob o dedo)');
