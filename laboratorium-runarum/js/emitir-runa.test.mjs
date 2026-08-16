/**
 * ᛟ A emissão: o projeto virando peça de verdade.
 *
 * O que este teste tranca é a fiação, porque a lógica já está trancada em
 * shared/runa-em-jogo.test.mjs. Três coisas podem quebrar sem dar erro:
 *
 *   1. o mapa FIXO de condições por Aspectus voltar — ele existia aqui e
 *      contradizia o repertório do registro (Terra dizia "Imobilizado" e o
 *      cadastro diz Prostrado · Imobilizado, com escolha pelo Impressor);
 *   2. a runa virar um "item runa" genérico em vez de ser gravada SOBRE a
 *      peça-base — o osso tem de continuar osso;
 *   3. o modelo não ir para o catálogo, e a peça sumir de vez quando os usos
 *      acabarem.
 *
 * Roda com: node laboratorium-runarum/js/emitir-runa.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const banc = readFileSync(new URL('./bancada.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const app = readFileSync(new URL('./lab-app.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const html = readFileSync(new URL('../laboratorium.html', import.meta.url), 'utf8');

/* ===== 1) o mapa fixo morreu, e a régua vem do módulo puro ===== */
assert.doesNotMatch(banc, /const COND_ASPECTUS\s*=/,
    '🔒 o mapa fixo de condição por Aspectus não pode voltar — o repertório é do registro');
assert.doesNotMatch(banc, /fogo:\s*'Queimadura'/, 'nem em pedaços');
assert.match(banc, /import \{ blocoDeCombate \} from '\.\.\/\.\.\/shared\/runa-em-jogo\.js/,
    'a régua da runa em jogo mora no módulo puro');
assert.match(banc, /function blocoDaRuna\(runa\)/, 'e a bancada só junta o que a ficha sabe');

/* ===== 2) a runa é gravada SOBRE a peça-base ===== */
assert.match(banc, /import \{ instanciarDoModelo \} from '\.\.\/\.\.\/shared\/equip-campos\.js/,
    'a instância nasce de uma cópia integral do modelo-base');
assert.match(banc, /function escolherBase\(\)/, 'tem de perguntar em que peça grava');
assert.match(banc, /\.\.\.modeloBase,/, '🔒 o modelo da runa começa do cadastro da peça — o osso continua osso');
assert.match(banc, /tags: \[\.\.\.new Set\(\[\.\.\.\(modeloBase\.tags \|\| \[\]\), 'Runa', ramoNome\]\)\]/,
    'as tags do material continuam valendo, com Runa e o ofício por cima');

/* ===== 3) modelo no catálogo + instância na ficha ===== */
assert.match(banc, /setDoc\(doc\(db, 'system', 'data', 'equipment', modeloId\)/,
    "🔒 o MODELO vai para o catálogo: é ele que sobrevive quando os usos acabam");
assert.match(banc, /setDoc\(doc\(db, 'items', itemId\)/, 'e a instância vai para a ficha');
assert.match(banc, /usosRestantes: b\.permanente \? null : b\.usos/, 'a peça nasce contada');

/* ===== 4) tatuagem vira Peculiaridade, não item ===== */
assert.match(banc, /addDoc\(collection\(db, 'system', 'data', 'peculiarities'\)/,
    'tatuagem não tem peça: vira Peculiaridade para o Mestre aplicar');
assert.match(banc, /tags: \['Runa', 'Tatuagem'\]/);

/* ===== 5) as recusas chegam à tela antes de gravar ===== */
assert.match(banc, /if \(b\.problemas\.length\)/, 'circuito que não fecha tem de avisar antes');
assert.match(banc, /b\.periciaExigida && !achaDot/, '🔒 Abissal sem Abismancia não grava');
assert.match(banc, /b\.sanidadeGravar/, 'e o pedágio de Sanidade aparece no confirm');

/* ===== 6) o Cartucho continua sendo o grimório ===== */
assert.match(banc, /function registrarNoCartucho/, 'anotar no Cartucho é o registro do que ele SABE');
assert.match(banc, /classModuleData\.cartucho_runico/);
assert.equal((banc.match(/registrarNoCartucho\(/g) || []).length, 3,
    'a declaração + emitir (que também anota) + anotar sozinho');

/* ===== 7) os dois botões existem e apontam para funções exportadas ===== */
assert.match(app, /data-acao="gravar"/, 'o botão de gravar a peça');
assert.match(app, /data-acao="ficha"/, 'e o de só anotar');
assert.match(app, /LabBancada\?\.emitirRuna\?\.\(r, toast\)/);
assert.match(app, /LabBancada\?\.enviarParaFicha\?\.\(r, toast\)/);
for (const fn of ['emitirRuna', 'enviarParaFicha', 'blocoDaRuna']) {
    assert.match(banc, new RegExp(`\\b${fn}[,\\s]`), `${fn} tem de sair no objeto público de LabBancada`);
}

/* ===== 8) o cache-buster acompanhou a mudança ===== */
const v = html.match(/js\/bancada\.js\?v=(\d+)/);
assert.ok(v && Number(v[1]) >= 3, 'bancada.js mudou: o ?v= no HTML tem de subir junto');

console.log('✅ emissão OK — grava sobre a peça, modelo no catálogo, tatuagem vira Peculiaridade');
