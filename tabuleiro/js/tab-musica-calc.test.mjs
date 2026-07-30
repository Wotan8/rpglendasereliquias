// Rodar: node tabuleiro/js/tab-musica-calc.test.mjs
import assert from 'node:assert/strict';
import { planoDeReproducao, posicaoInicial, idDoYoutube } from './tab-musica-calc.js';

// --- reconhecer link do YouTube (todas as formas que o mestre pode colar) ---
const ID = 'dQw4w9WgXcQ';
for (const u of [
    `https://www.youtube.com/watch?v=${ID}`,
    `http://youtube.com/watch?v=${ID}`,
    `https://m.youtube.com/watch?v=${ID}`,
    `https://music.youtube.com/watch?v=${ID}&list=RDAMVM123`,
    `https://youtu.be/${ID}`,
    `https://youtu.be/${ID}?t=42`,
    `https://www.youtube.com/embed/${ID}`,
    `https://www.youtube.com/shorts/${ID}`,
    `https://www.youtube-nocookie.com/embed/${ID}`,
    `https://www.youtube.com/watch?list=PL9&v=${ID}&index=2`,
    `  https://www.youtube.com/watch?v=${ID}  `,
]) assert.equal(idDoYoutube(u), ID, u);

// --- o que NÃO é YouTube segue como arquivo direto ---
for (const u of [
    'https://firebasestorage.googleapis.com/v0/b/x/o/taverna.mp3?alt=media',
    'https://exemplo.com/musica.ogg',
    'https://open.spotify.com/track/abc',
    'https://naoyoutube.com/watch?v=' + ID,
    '', null, undefined, 42,
]) assert.equal(idDoYoutube(u), null, String(u));

assert.equal(idDoYoutube('https://www.youtube.com/watch?v=curto'), null, 'id tem que ter 11 chars');
assert.equal(idDoYoutube('https://www.youtube.com/feed/subscriptions'), null, 'link do YouTube sem vídeo');

const existe = new Set(['a', 'b', 'c']);
const temFaixa = (fid) => existe.has(fid);

// --- nada tocando, nada acontece ---
assert.deepEqual(planoDeReproducao({}, temFaixa, []), { parar: [], iniciar: [] });

// --- mestre deu play em duas: o jogador entra nas duas ---
assert.deepEqual(planoDeReproducao({ a: 1, b: 2 }, temFaixa, []).iniciar, ['a', 'b']);

// --- já estou nas duas: nada a fazer (não reinicia a música a cada snapshot) ---
assert.deepEqual(planoDeReproducao({ a: 1, b: 2 }, temFaixa, ['a', 'b']), { parar: [], iniciar: [] });

// --- mestre parou uma: paro só ela ---
assert.deepEqual(planoDeReproducao({ a: 1 }, temFaixa, ['a', 'b']), { parar: ['b'], iniciar: [] });

// --- faixa apagada da playlist enquanto tocava: para mesmo constando em `tocando` ---
assert.deepEqual(planoDeReproducao({ a: 1, z: 5 }, temFaixa, ['a', 'z']), { parar: ['z'], iniciar: [] });
assert.deepEqual(planoDeReproducao({ z: 5 }, temFaixa, []).iniciar, [], 'não tento iniciar faixa sem arquivo');

// --- t0 = 0 é instante válido? não: 0 significa "sem carimbo" e não deve travar o play ---
assert.deepEqual(planoDeReproducao({ a: 0 }, temFaixa, []).iniciar, ['a']);

// --- entrar em fase ---
const agora = 1_000_000;
assert.equal(posicaoInicial(agora - 30_000, agora, 100, true), 30, 'entro no segundo 30');
assert.equal(posicaoInicial(agora - 250_000, agora, 100, true), 50, 'com loop, dá a volta');
assert.equal(posicaoInicial(agora - 250_000, agora, 100, false), 99.9, 'sem loop, já acabou');
assert.equal(posicaoInicial(agora - 200, agora, 100, true), null, 'começou agora: não mexe');
assert.equal(posicaoInicial(agora - 30_000, agora, NaN, true), null, 'sem duração conhecida, não mexe');
assert.equal(posicaoInicial(agora - 30_000, agora, Infinity, true), null, 'stream ao vivo, não mexe');
assert.equal(posicaoInicial(0, agora, 100, true), null, 'sem carimbo de início, toca do começo');

console.log('✅ tab-musica-calc: sincronia de reprodução OK');
