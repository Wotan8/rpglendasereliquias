/**
 * Campo de imagem — shared/campo-imagem.js.
 *
 * O que dá para testar fora do navegador é o que decide se um arquivo entra e
 * onde ele vai parar no Storage. O resto é DOM.
 *
 * Regras verificadas:
 *  • só imagem passa, e só até 8 MB;
 *  • o caminho carimba a hora e higieniza o nome (espaço, acento, barra);
 *  • pasta com barra sobrando não vira caminho com barra dupla;
 *  • sem pasta, cai em `imagens/` — a única liberada por padrão no storage.rules.
 *
 * Roda com: node shared/campo-imagem.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync(new URL('./campo-imagem.js', import.meta.url), 'utf8');
const ctx = { window: {}, console };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(src, ctx);           // sem `document`: a ligação de DOM não roda
const CI = ctx.window.CampoImagem;

const arquivo = (nome, tipo, bytes) => ({ name: nome, type: tipo, size: bytes });

// ── validar ────────────────────────────────────────────────
assert.equal(CI.validar(arquivo('a.png', 'image/png', 1024)), null);
assert.match(CI.validar(arquivo('a.pdf', 'application/pdf', 10)), /não é uma imagem/);
assert.match(CI.validar(arquivo('a.png', 'image/png', 9 * 1024 * 1024)), /8 MB/);
assert.match(CI.validar(null), /Nenhum arquivo/);
// Seletor que não informa o tipo (Android, .ico no Windows): vale a extensão.
assert.equal(CI.validar(arquivo('icone.ico', '', 4096)), null);
assert.equal(CI.validar(arquivo('foto.HEIC', '', 4096)), null);
assert.match(CI.validar(arquivo('planilha.xlsx', '', 4096)), /não é uma imagem/);
// 8 MB exatos ainda passam — o limite é "acima de".
assert.equal(CI.validar(arquivo('a.jpg', 'image/jpeg', 8 * 1024 * 1024)), null);

// ── caminho ────────────────────────────────────────────────
const p = CI.caminho('imagens/itens', 'Saco de Luns Simples.png');
assert.match(p, /^imagens\/itens\/\d+_Saco_de_Luns_Simples\.png$/);
assert.match(CI.caminho('/imagens/npcs/', 'x.png'), /^imagens\/npcs\/\d+_x\.png$/);
assert.match(CI.caminho('', 'x.png'), /^imagens\/\d+_x\.png$/);
// Nome hostil não escapa da pasta: sem barra sobrando, o arquivo continua
// sendo um só segmento dentro dela.
assert.match(CI.caminho('imagens', '../../regras.json'), /^imagens\/\d+_[\w.-]+$/);

console.log('✅ campo-imagem: validação e caminho OK');
