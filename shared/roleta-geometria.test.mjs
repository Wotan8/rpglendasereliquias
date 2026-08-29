// Rodar: node shared/roleta-geometria.test.mjs
import assert from 'node:assert/strict';
import { fatias, rotacaoFinal, fatiaSobASeta, fatiaNoPonto, minimoDeFatia, GRAU_MINIMO, ANGULO_SETA } from './roleta-geometria.js';

// As 37 chances reais do documento de mesa, incluindo a de 0,09% que sumia
const REAIS = [1, 1, 1, 3, 3, 3, 3, 5, 3, 5, 5, 1, 3, 3, 3, 3, 3, 5, 5, 3, 5, 3, 3, 1, 1, 1,
    0.5, 3, 3, 3, 3, 5, 1, 1, 0.5, 0.3, 0.09].map((chance, i) => ({ nome: 'p' + i, chance }));

const f = fatias(REAIS);
assert.equal(f.length, 37, 'as 37 entram na roda');
assert.ok(Math.abs(f[f.length - 1].fim - 360) < 1e-9, 'as fatias fecham exatamente 360 graus');

/* --- TAMANHO MINIMO, E PROPORCAO EXATA ACIMA DELE ---
   A de 0,09% em proporcao pura ocupa 0,32 grau: meio pixel de arco, some. E
   fatia que some diz a coisa errada — quem olha conclui que o premio nao esta
   na roda, e ele esta. Entao ha um piso, e ele custa alguma coisa: o teste
   cobra as duas metades do trato. */
const minimo = minimoDeFatia(REAIS.length);
assert.equal(minimo, GRAU_MINIMO, 'com 37 fatias o minimo nao precisa encolher');

// 1) ninguem some
for (const fatia of f) {
    assert.ok(fatia.tamanho >= minimo - 1e-9,
        `a fatia ${fatia.indice} ficou com ${fatia.tamanho.toFixed(3)} grau, abaixo do minimo`);
}
assert.ok(f.some(x => x.inflada), 'com uma chance de 0,09% alguem TEM de ter sido inflado');

// 2) quem ja cabia mantem proporcao EXATA entre si
const livres = f.filter(x => !x.inflada);
const a = livres[0], b = livres.find(x => REAIS[x.indice].chance !== REAIS[a.indice].chance);
assert.ok(Math.abs(a.tamanho / b.tamanho - REAIS[a.indice].chance / REAIS[b.indice].chance) < 1e-9,
    'entre as fatias nao infladas a proporcao tem de ser exata');
const cinco = f.find(x => REAIS[x.indice].chance === 5 && !x.inflada);
const um = f.find(x => REAIS[x.indice].chance === 1 && !x.inflada);
assert.ok(Math.abs(cinco.tamanho / um.tamanho - 5) < 1e-9, 'a de 5% tem de ser 5x a de 1%');

// 3) mais chance nunca da fatia menor — o piso nao pode inverter a ordem
for (const x of f) {
    for (const y of f) {
        if (REAIS[x.indice].chance > REAIS[y.indice].chance) {
            assert.ok(x.tamanho >= y.tamanho - 1e-9,
                `${REAIS[x.indice].chance}% ficou menor que ${REAIS[y.indice].chance}%`);
        }
    }
}

// 4) o piso encolhe sozinho quando ha fatia demais, senao os minimos passariam
//    de 360 e nao sobraria roda para repartir
{
    const muitas = Array.from({ length: 300 }, (_, i) => ({ chance: i + 1 }));
    const g = fatias(muitas);
    const min300 = minimoDeFatia(300);
    assert.ok(min300 < GRAU_MINIMO, 'com 300 fatias o minimo tinha de encolher');
    assert.ok(min300 * 300 < 360, 'os minimos somados nao podem passar da roda inteira');
    assert.ok(g.every(x => x.tamanho >= min300 - 1e-9), 'e ninguem some nem assim');
    assert.ok(Math.abs(g[g.length - 1].fim - 360) < 1e-6, '300 fatias ainda fecham 360');
}

// 5) uma roda so de iguais nao infla ninguem
{
    const g = fatias([{ chance: 1 }, { chance: 1 }, { chance: 1 }]);
    assert.ok(g.every(x => Math.abs(x.tamanho - 120) < 1e-9), 'tres iguais dao 120 graus cada');
    assert.ok(g.every(x => !x.inflada), 'e nenhuma delas precisou de piso');
}

// --- INVARIANTE PRINCIPAL: girar pelo premio X para com X sob a seta ---
for (const fatia of f) {
    for (const desvio of [-0.5, -0.3, 0, 0.3, 0.5]) {
        const r = rotacaoFinal(f, fatia.indice, 6, desvio);
        const parou = fatiaSobASeta(f, r);
        assert.equal(parou.indice, fatia.indice,
            `premio ${fatia.indice} (${fatia.tamanho.toFixed(2)} graus, desvio ${desvio}) parou em ${parou.indice}`);
    }
}

/* --- e vale tambem para a MENOR fatia, a que so existe por causa do piso ---
   Ela agora tem exatamente `minimo` graus. Antes tinha 1,12 e o teste cobrava
   isso; hoje uma fatia abaixo do piso seria o proprio defeito. */
const minusculo = f.find(x => x.inflada);
assert.ok(Math.abs(minusculo.tamanho - minimo) < 1e-9, 'a inflada fica exatamente no piso');
assert.equal(fatiaSobASeta(f, rotacaoFinal(f, minusculo.indice, 8, 0)).indice, minusculo.indice);
for (const desvio of [-0.5, 0, 0.5]) {
    assert.equal(fatiaSobASeta(f, rotacaoFinal(f, minusculo.indice, 8, desvio)).indice,
        minusculo.indice, 'o desvio nao pode empurrar o ponteiro para fora da fatia minima');
}

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
