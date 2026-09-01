// =====================================================================
// TEXTO DO MUNDO — faxina do HTML escrito no Escritório do Cronista
// ---------------------------------------------------------------------
// Por que existe: o capítulo é gravado como HTML e re-exibido na ficha do
// jogador e no Laboratorium. Se um "colar do Word" trouxer <font>, tabelas
// de layout e `style="font-family:Calibri"`, a diagramação do autor deixa
// de valer nas outras telas — cada uma renderiza uma coisa. Aqui o HTML é
// reduzido ao vocabulário que shared/texto-mundo.css sabe desenhar.
//
// As decisões (o que passa) são funções PURAS de string, testadas em
// wb-rich-sanitize.test.mjs. `limparHTML` é só a caminhada no DOM.
// =====================================================================

/** Tags que ficam como estão — o vocabulário de texto-mundo.css. */
export const TAGS_OK = new Set([
    'P', 'BR', 'H1', 'H2', 'H3', 'H4', 'BLOCKQUOTE', 'PRE', 'CODE',
    'UL', 'OL', 'LI', 'HR', 'A', 'IMG', 'FIGURE', 'FIGCAPTION',
    'STRONG', 'B', 'EM', 'I', 'U', 'S', 'MARK', 'SPAN', 'DIV', 'SUB', 'SUP',
    // Tabelas são diagramação de verdade — o Compêndio de Runomancia é
    // feito delas. Desembrulhar aqui destruiria texto já escrito.
    'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TH', 'TD', 'CAPTION',
]);

/** Tags que somem com o conteúdo junto (nunca são texto do capítulo). */
export const TAGS_FORA = new Set([
    'SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META',
    'FORM', 'INPUT', 'BUTTON', 'SELECT', 'TEXTAREA', 'NOSCRIPT',
]);

/** Propriedades CSS inline que valem a pena preservar (intenção do autor). */
export const CSS_OK = new Set([
    'color', 'background-color', 'text-align', 'font-weight',
    'font-style', 'text-decoration', 'font-variant',
    /* Imagem: largura livre e posicao da figura solta, em %. Sao custom
       properties de proposito — o texto-mundo.css e quem decide o que fazer
       com elas, entao o documento carrega a INTENCAO (40% de largura), nao
       layout pronto. E por serem `--tm-*`, nao ha como um HTML colado de
       fora injetar `position: fixed` por aqui. */
    '--tm-fig-larg', '--tm-fig-x', '--tm-fig-y', '--tm-fig-op',
    /* Tabela: largura de coluna em %. Mesmo motivo — `width` continua fora
       da lista, que e por onde o HTML colado do Word entra com pixel. */
    '--tm-col-larg',
]);

/**
 * O que fazer com uma tag.
 *   'manter'      → fica
 *   'desembrulhar'→ some a tag, o texto de dentro continua (ex.: <font>, <table>)
 *   'remover'     → some tag E conteúdo (ex.: <script>)
 */
export function decidirTag(tagName) {
    const t = String(tagName || '').toUpperCase();
    if (TAGS_FORA.has(t)) return 'remover';
    if (TAGS_OK.has(t)) return 'manter';
    return 'desembrulhar';
}

/**
 * Um atributo pode ficar? `class` e `style` têm filtro próprio (ver abaixo) —
 * aqui só respondemos pelo resto.
 */
export function atributoOk(tagName, attr) {
    const t = String(tagName || '').toUpperCase();
    const a = String(attr || '').toLowerCase();
    if (a.startsWith('on')) return false;              // handlers, nunca
    if (a === 'class' || a === 'style') return true;   // filtrados adiante
    // Antes dos casos por tag: a menção @entidade é um <a> e precisa levar
    // a entidade junto, senão o link morre a cada gravação.
    /* `data-campo` entra na mesma lista: o campo vinculado (span.tm-campo)
       precisa dos tres para saber o que reler no cadastro. `data-sumiu`
       fica de FORA de proposito — ele e o aviso de "objeto nao encontrado",
       recalculado a cada leitura. Gravado, viraria lapide permanente de uma
       entidade que pode ter voltado a existir. */
    if (a === 'data-entity' || a === 'data-cat' || a === 'data-campo' || a === 'contenteditable') return true;
    if (t === 'A') return a === 'href' || a === 'target' || a === 'rel';
    if (t === 'IMG') return ['src', 'alt', 'title', 'loading'].includes(a);
    if (t === 'TD' || t === 'TH') return a === 'colspan' || a === 'rowspan';
    return false;
}

/**
 * URL de link/imagem segura? Bloqueia `javascript:` e outros esquemas
 * executáveis. Caminho relativo (sem esquema) passa — é URL legítima e
 * derrubá-la apagaria o src de imagens do próprio site.
 */
export function urlOk(url) {
    const u = String(url || '').trim().toLowerCase();
    if (!u) return false;
    const esquema = u.match(/^([a-z][a-z0-9+.-]*):/);
    if (!esquema) return true;                       // relativa ou âncora
    if (esquema[1] === 'http' || esquema[1] === 'https') return true;
    return u.startsWith('data:image/');              // só data: de imagem
}

/** Só as classes que este sistema desenha: as `tm-*` e a menção. */
export function filtrarClasses(valor) {
    return String(valor || '')
        .split(/\s+/)
        .filter(c => c && (c.startsWith('tm-') || c === 'wbt-mention'))
        .join(' ');
}

/** Devolve só as declarações CSS da lista branca. */
export function filtrarEstilo(cssText) {
    return String(cssText || '')
        .split(';')
        .map(d => d.trim())
        .filter(Boolean)
        .filter(d => {
            const prop = d.slice(0, d.indexOf(':')).trim().toLowerCase();
            if (!CSS_OK.has(prop)) return false;
            const val = d.slice(d.indexOf(':') + 1).toLowerCase();
            return !val.includes('url(') && !val.includes('expression');
        })
        .map(d => d.replace(/\s*:\s*/, ': '))
        .join('; ');
}

/**
 * Passa o HTML pela faxina. Usa o DOM — só roda no navegador.
 * Chamado ao COLAR (mantém o editor limpo) e ao SALVAR (é o que as outras
 * telas vão renderizar, então é a fronteira que importa de verdade).
 */
export function limparHTML(html) {
    const caixa = document.createElement('div');
    caixa.innerHTML = String(html || '');

    const visitar = (no) => {
        // Copiar a lista: vamos mexer nos filhos durante a caminhada.
        [...no.childNodes].forEach(filho => {
            if (filho.nodeType === Node.COMMENT_NODE) return filho.remove();
            if (filho.nodeType !== Node.ELEMENT_NODE) return;

            const acao = decidirTag(filho.tagName);
            if (acao === 'remover') return filho.remove();

            if (acao === 'desembrulhar') {
                visitar(filho);
                filho.replaceWith(...filho.childNodes);
                return;
            }

            [...filho.attributes].forEach(({ name, value }) => {
                if (!atributoOk(filho.tagName, name)) return filho.removeAttribute(name);
                if (name === 'class') {
                    const limpo = filtrarClasses(value);
                    limpo ? filho.setAttribute('class', limpo) : filho.removeAttribute('class');
                } else if (name === 'style') {
                    const limpo = filtrarEstilo(value);
                    limpo ? filho.setAttribute('style', limpo) : filho.removeAttribute('style');
                } else if ((name === 'href' || name === 'src') && !urlOk(value)) {
                    filho.removeAttribute(name);
                }
            });

            visitar(filho);
        });
    };

    visitar(caixa);
    return caixa.innerHTML;
}
