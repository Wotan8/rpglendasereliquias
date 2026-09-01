// Rodar: node worldbuilding/js/wb-rich-sanitize.test.mjs
// Testa só as decisões puras — limparHTML precisa de DOM e roda no navegador.
import assert from 'node:assert/strict';
import { decidirTag, atributoOk, urlOk, filtrarClasses, filtrarEstilo } from './wb-rich-sanitize.js';

// --- decidirTag: o que o autor escreveu fica, o lixo do Word desembrulha ---
assert.equal(decidirTag('p'), 'manter');
assert.equal(decidirTag('FIGCAPTION'), 'manter');
assert.equal(decidirTag('img'), 'manter');
assert.equal(decidirTag('font'), 'desembrulhar', '<font> some mas o texto dele fica');
assert.equal(decidirTag('o:p'), 'desembrulhar', 'tag do Office');
// O Compêndio de Runomancia é escrito em tabelas — se caírem, perde-se texto real.
['table', 'thead', 'tbody', 'tr', 'th', 'td', 'caption'].forEach(t =>
    assert.equal(decidirTag(t), 'manter', `<${t}> precisa sobreviver`));
assert.equal(decidirTag('script'), 'remover', 'script vai embora COM o conteúdo');
assert.equal(decidirTag('style'), 'remover');
assert.equal(decidirTag('iframe'), 'remover');

// --- atributoOk ---
assert.equal(atributoOk('a', 'href'), true);
assert.equal(atributoOk('img', 'src'), true);
assert.equal(atributoOk('img', 'alt'), true);
assert.equal(atributoOk('a', 'src'), false, 'src não é atributo de link');
assert.equal(atributoOk('img', 'href'), false);
assert.equal(atributoOk('div', 'onclick'), false, 'handler inline nunca passa');
assert.equal(atributoOk('img', 'onerror'), false, 'o vetor clássico de XSS');
assert.equal(atributoOk('IMG', 'ONERROR'), false, 'nem em maiúsculas');
assert.equal(atributoOk('p', 'class'), true);
assert.equal(atributoOk('p', 'style'), true);
// Regressão: a menção @entidade é um <a>; se o caso de <a> respondesse antes,
// data-entity sumiria a cada gravação e o link morreria em silêncio.
assert.equal(atributoOk('a', 'data-entity'), true, 'a menção é um <a> e guarda a entidade');
assert.equal(atributoOk('a', 'data-cat'), true);
assert.equal(atributoOk('a', 'contenteditable'), true);
assert.equal(atributoOk('span', 'data-entity'), true);
assert.equal(atributoOk('p', 'align'), false, 'align vira text-align inline');
assert.equal(atributoOk('td', 'colspan'), true, 'células mescladas continuam mescladas');
assert.equal(atributoOk('th', 'rowspan'), true);
assert.equal(atributoOk('td', 'width'), false, 'largura fixa quebra em tela pequena');

// --- urlOk ---
assert.equal(urlOk('https://firebasestorage.googleapis.com/x.png'), true);
assert.equal(urlOk('http://exemplo.com/a.jpg'), true);
assert.equal(urlOk('/icons/icon-192.png'), true);
assert.equal(urlOk('#ancora'), true);
assert.equal(urlOk('data:image/png;base64,AAAA'), true, 'imagem colada inline serve');
// Regressão: caminho relativo sem "./" é URL legítima — derrubá-lo apagava o src.
assert.equal(urlOk('imagens/mapa.png'), true, 'relativa simples continua valendo');
assert.equal(urlOk('../shared/x.png'), true);
assert.equal(urlOk('javascript:alert(1)'), false);
assert.equal(urlOk('vbscript:msgbox'), false, 'qualquer esquema executável cai');
assert.equal(urlOk('  JavaScript:alert(1)'), false, 'espaço e caixa não driblam');
assert.equal(urlOk('data:text/html,<script>'), false, 'data: só para imagem');
assert.equal(urlOk(''), false);
assert.equal(urlOk(null), false);

// --- filtrarClasses: só o vocabulário que texto-mundo.css desenha ---
assert.equal(filtrarClasses('tm-fig tm-fig--flut-dir'), 'tm-fig tm-fig--flut-dir');
assert.equal(filtrarClasses('wbt-mention'), 'wbt-mention');
assert.equal(filtrarClasses('MsoNormal tm-capitular x'), 'tm-capitular', 'classe do Word cai fora');
assert.equal(filtrarClasses(''), '');
assert.equal(filtrarClasses('  tm-a   tm-b  '), 'tm-a tm-b', 'espaços extras não viram classe vazia');

// --- filtrarEstilo: guarda a intenção (cor, alinhamento), joga fora o resto ---
assert.equal(filtrarEstilo('color: #D4AF37'), 'color: #D4AF37');
assert.equal(filtrarEstilo('text-align:center'), 'text-align: center');
assert.equal(filtrarEstilo('font-family: Calibri; color: red'), 'color: red',
    'a fonte é do sistema, não do documento colado');
assert.equal(filtrarEstilo('margin:0;padding:40px'), '', 'layout colado não sobrevive');
assert.equal(filtrarEstilo('background-color: url(javascript:1)'), '', 'url() em estilo é barrado');
assert.equal(filtrarEstilo('width: expression(alert(1))'), '');
assert.equal(filtrarEstilo(''), '');
assert.equal(filtrarEstilo('COLOR: red'), 'COLOR: red', 'propriedade em maiúscula é reconhecida');

// --- campo vinculado (shared/campo-vinculado.js) ---
// Os tres data-* sao o endereco do campo no cadastro: sem eles o vinculo
// morre a cada gravacao e o texto vira literal.
assert.ok(atributoOk('SPAN', 'data-cat'));
assert.ok(atributoOk('SPAN', 'data-entity'));
assert.ok(atributoOk('SPAN', 'data-campo'));
// `data-sumiu` NAO: e o aviso de "objeto nao encontrado", recalculado a cada
// leitura. Gravado, viraria lapide permanente de algo que pode ter voltado.
assert.equal(atributoOk('SPAN', 'data-sumiu'), false,
    'o aviso de objeto sumido nao pode ser gravado no texto');
assert.equal(filtrarClasses('tm-campo'), 'tm-campo');

console.log('✅ wb-rich-sanitize: todos os testes passaram.');
