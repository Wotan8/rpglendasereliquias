/**
 * ᛟ RUNOTECA — a busca sobre tudo que já foi gravado.
 *
 * Duas coisas quebram aqui sem dar erro: a peça deixar de guardar o CIRCUITO
 * (e aí a Runoteca vira um álbum de fotos, não uma bancada), e a busca deixar
 * de olhar as duas coleções (peça gravada e tatuagem são a mesma runa em
 * suportes diferentes; ver só uma é enxergar meio mundo).
 *
 * Roda com: node laboratorium-runarum/js/runoteca.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const rt = readFileSync(new URL('./runoteca.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const banc = readFileSync(new URL('./bancada.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const app = readFileSync(new URL('./lab-app.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const html = readFileSync(new URL('../laboratorium.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../css/laboratorium.css', import.meta.url), 'utf8');

/* ===== 1) a peça guarda o CIRCUITO, não só o resultado ===== */
assert.equal((banc.match(/canvas: runa\.canvas \|\| null/g) || []).length, 2,
    '🔒 os DOIS caminhos de emissão (peça e tatuagem) têm de guardar o desenho — sem ele a auditoria não é refeita');

/* ===== 2) a busca cobre as duas coleções ===== */
assert.match(rt, /collection\(db, 'system', 'data', 'equipment'\)/, 'peças gravadas');
assert.match(rt, /collection\(db, 'system', 'data', 'peculiarities'\)/, 'e tatuagens');
assert.match(rt, /normalizar\(x, 'item'\)/);
assert.match(rt, /normalizar\(x, 'peculiaridade'\)/);

/* ===== 3) a decisão de busca, exercitada de verdade ===== */
const sb = {};
vm.createContext(sb);
vm.runInContext(rt.slice(rt.indexOf('    const norm ='), rt.indexOf('    function fichaHTML')), sb);
const runa = {
    nome: 'Lança de Lava', peca: 'Pergaminho', ramo: 'Escripta',
    tags: ['Runa', 'Escripta'],
    bloco: {
        canal: 'Dano Ígneo',
        nucleo: { artus: 'Criar', aspectus: 'Fogo', emissor: 'Projetor' },
        condicoesAplicadas: [{ condicao: 'Queimadura', nivel: 2 }],
    },
};
const busca = (q) => { sb.r = runa; sb.q = q; vm.runInContext('x = casa(r, norm(q))', sb); return sb.x; };
assert.equal(busca(''), true, 'busca vazia mostra tudo');
assert.equal(busca('lava'), true, 'pelo nome');
assert.equal(busca('LANÇA'), true, 'sem caixa e sem acento');
assert.equal(busca('lanca'), true, 'e sem acento digitado');
assert.equal(busca('pergaminho'), true, 'pela peça em que foi gravada');
assert.equal(busca('fogo'), true, 'pelo Aspectus');
assert.equal(busca('projetor'), true, 'pelo Emissor');
assert.equal(busca('queimadura'), true, '🔒 pela condição que aplica — é assim que o Mestre acha "o que queima"');
assert.equal(busca('escripta'), true, 'pelo ofício');
assert.equal(busca('gelo'), false, 'e o que não casa não aparece');

/* ===== 4) só entra o que é runa de verdade ===== */
assert.match(rt, /const temRuna = d => d\.runa &&/,
    'equipamento comum e peculiaridade comum não podem entrar na Runoteca');

/* ===== 5) devolver o circuito à mesa ===== */
assert.match(rt, /window\.LabCanvas\?\.loadState\?\.\(r\.canvas\)/, 'abrir na mesa recarrega o desenho');
assert.match(rt, /window\.labSwitchTab\?\.\('montagem'\)/);
assert.match(app, /window\.labSwitchTab = switchTab/, 'e o lab-app precisa expor a troca de aba');
assert.match(rt, /lab-rt-semdesenho/, 'runa antiga sem desenho tem de dizer por que não abre');

/* ===== 6) a aba existe e é carregada ===== */
assert.match(html, /data-tab="runoteca"/, 'o botão da aba');
assert.match(html, /data-pane="runoteca"/, 'e o painel');
assert.match(html, /js\/runoteca\.js\?v=\d+/, 'o script entra no HTML');
assert.match(app, /window\.LabRunoteca\?\.boot\?\.\(\)/, 'e sobe junto com o Laboratorium');
assert.match(css, /\.lab-runoteca\s*\{/, 'com estilo próprio');
const v = html.match(/laboratorium\.css\?v=(\d+)/);
assert.ok(v && Number(v[1]) >= 4, 'o CSS mudou: o ?v= tem de subir junto');

console.log('✅ Runoteca OK — as duas coleções, busca por condição, e o circuito volta à mesa');
