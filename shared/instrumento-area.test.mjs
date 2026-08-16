/**
 * A área de um instrumento. Roda com:
 *   node shared/instrumento-area.test.mjs
 *
 * A régua da mesa, em uma linha cada:
 *   Percussão → círculo,   raio 2 × (Qualidade + 1)
 *   Sopro     → cone 30°,  comprimento 4 × (Qualidade + 1)
 *   Corda     → cone 90°,  comprimento 3 × (Qualidade + 1)
 *
 * O "+1" é o degrau: a Qualidade começa em 0 e não existe instrumento acima de
 * 1 no jogo, então multiplicar direto zerava a área de tudo que existe.
 */
import assert from 'node:assert/strict';
import { familiaDoInstrumento, areaDoInstrumento, explicaArea, FAMILIAS } from './instrumento-area.js';

// --- família pelas tags (é assim que o catálogo marca) ---
assert.equal(familiaDoInstrumento(['Instrumento', 'Corda']), 'corda', 'Rabeca, Harpa, Alaúde');
assert.equal(familiaDoInstrumento(['Instrumento', 'Sopro']), 'sopro', 'Flauta, Gaita, Trompa');
assert.equal(familiaDoInstrumento(['Instrumento', 'Percussão']), 'percussao', 'Tambor, Címbalos');
assert.equal(familiaDoInstrumento(['Inicial', 'Xamã', 'Instrumento', 'Percussão']), 'percussao',
    'o Chocalho tem tag de sobra e continua sendo percussão');
assert.equal(familiaDoInstrumento(['instrumento', 'percussao']), 'percussao', 'sem acento e em minúscula também');

// não é instrumento, ou é sem família: não vira área nenhuma
assert.equal(familiaDoInstrumento(['Arma', 'Corda']), null, '"Corda" sozinha não faz de um arco um instrumento');
assert.equal(familiaDoInstrumento(['Instrumento']), null, 'instrumento sem família não chuta forma');
assert.equal(familiaDoInstrumento([]), null);
assert.equal(familiaDoInstrumento(null), null, 'lixo não explode');

// --- a régua ---
const rabeca = areaDoInstrumento(['Instrumento', 'Corda'], 1);
assert.equal(rabeca.forma, 'cone');
assert.equal(rabeca.ang, 90, 'corda espalha na frente');
assert.equal(rabeca.metros, 6, '3 × (Qualidade 1 + 1)');

const trompa = areaDoInstrumento(['Instrumento', 'Sopro'], 1);
assert.equal(trompa.ang, 30, 'sopro é estreito');
assert.equal(trompa.metros, 8, '4 × (Qualidade 1 + 1) — o sopro vai mais longe que a corda');
assert.ok(trompa.metros > rabeca.metros, 'a trompa alcança mais que a rabeca de mesma Qualidade');

const tambor = areaDoInstrumento(['Instrumento', 'Percussão'], 1);
assert.equal(tambor.forma, 'circulo', 'tambor não aponta para lado nenhum');
assert.equal(tambor.ang, 0);
assert.equal(tambor.metros, 4, '2 × (Qualidade 1 + 1)');

// --- 🔒 A PEÇA INICIAL SOA. É todo instrumento que existe no jogo hoje. ---
assert.equal(areaDoInstrumento(['Instrumento', 'Percussão'], 0).metros, 2, 'Q0 percussão: 2 m de raio');
assert.equal(areaDoInstrumento(['Instrumento', 'Corda'], 0).metros, 3, 'Q0 corda: cone de 3 m');
assert.equal(areaDoInstrumento(['Instrumento', 'Sopro'], 0).metros, 4, 'Q0 sopro: cone de 4 m');
assert.ok(areaDoInstrumento(['Instrumento', 'Corda'], 0).metros > 0,
    '🔒 Qualidade 0 é a peça inicial, não uma peça quebrada — tem que alcançar alguém');

// --- Qualidade manda no tamanho: cada degrau soma um multiplicador ---
assert.equal(areaDoInstrumento(['Instrumento', 'Corda'], 5).metros, 18, 'Qualidade 5 na corda');
assert.equal(areaDoInstrumento(['Instrumento', 'Sopro'], 1).metros, 8);
assert.equal(areaDoInstrumento(['Instrumento', 'Corda'], undefined).metros, 3, 'Qualidade ausente conta como 0');
assert.equal(areaDoInstrumento(['Instrumento', 'Corda'], -2).qualidade, 0, 'Qualidade negativa não existe');
assert.equal(areaDoInstrumento(['Arma'], 5), null, 'arma comum não tem área de instrumento');

// --- a explicação que a mesa lê ---
assert.match(explicaArea(rabeca), /cone de 90° e 6 m/);
assert.match(explicaArea(rabeca), /3 × \(Qualidade 1 \+ 1\)/, 'mostra a conta, não só o resultado');
assert.match(explicaArea(tambor), /círculo de 4 m de raio/);
assert.equal(explicaArea(null), '');

// as três famílias e nada mais
assert.deepEqual(Object.keys(FAMILIAS).sort(), ['corda', 'percussao', 'sopro']);

console.log('✅ área do instrumento OK — família pelas tags, forma e metros pela Qualidade');
