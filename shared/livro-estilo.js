/* =====================================================================
   🎨 APARÊNCIA DO LIVRO — a tipografia e o papel que o autor escolheu
   ---------------------------------------------------------------------
   O `texto-mundo.css` desenha TODO capítulo do Cronista, nas cinco telas
   que leem livro (Escritório, ficha, Tabuleiro/Painel, Cronista público,
   Laboratorium). Ele continua sendo a folha única — o que muda é que
   agora cada valor dele passa por uma variável `--tm-*`, e este arquivo
   é quem preenche essas variáveis a partir do doc do livro.

   Estilo NÃO vira CSS gravado no HTML do capítulo. Vira custom property
   no CONTAINER. Duas razões:

     · o HTML já gravado dos 13 livros que existem não precisa migrar —
       livro sem `estilo` não emite variável nenhuma, e o `texto-mundo.css`
       cai no valor que sempre teve;
     · mudar a fonte do livro não pode exigir reescrever os capítulos.

   Uso, igual nas cinco telas:

       import { estiloDoLivro } from '../shared/livro-estilo.js';
       `<div class="texto-mundo" ${estiloDoLivro(livro)}>${cap.contentHTML}</div>`

   ===================================================================== */

/* Só famílias que o site JÁ carrega, mais as pilhas genéricas do sistema.
   Oferecer o catálogo do Google Fonts significaria baixar fonte por livro,
   e um capítulo que espera webfont é um capítulo que pisca em branco. */
export const FONTES = [
    ['', 'Padrão do site'],
    ["'Cormorant Garamond', Georgia, serif", 'Cormorant — serifada de leitura'],
    ["'Cinzel', 'Times New Roman', serif", 'Cinzel — capitular, epigráfica'],
    ["'Inter', system-ui, sans-serif", 'Inter — sem serifa, limpa'],
    ['Georgia, "Times New Roman", serif', 'Georgia — serifada clássica'],
    ['ui-monospace, "Cascadia Mono", Consolas, monospace', 'Monoespaçada — nota de campo'],
];

/**
 * Os botões da aparência. `var` é a custom property que o texto-mundo.css
 * consome; `tipo` diz ao formulário que campo desenhar.
 *
 * Mexeu aqui, o formulário do Escritório e as cinco telas de leitura
 * acompanham sozinhos — é por isso que a lista mora aqui e não lá.
 */
export const ESTILO_CAMPOS = [
    { k: 'fonteTexto',  var: '--tm-fonte',        tipo: 'fonte', label: 'Fonte do texto' },
    { k: 'fonteTitulo', var: '--tm-fonte-titulo', tipo: 'fonte', label: 'Fonte dos títulos' },
    { k: 'tamanho',     var: '--tm-tamanho',      tipo: 'medida', label: 'Corpo do texto', min: 0.8, max: 1.6, passo: 0.05, sufixo: 'rem', dica: 'Tudo escala junto — título, citação e legenda são múltiplos deste corpo.' },
    { k: 'entrelinha',  var: '--tm-entrelinha',   tipo: 'medida', label: 'Entrelinha', min: 1.2, max: 2.2, passo: 0.05, sufixo: '', dica: 'Espaço entre as linhas. Papel apertado cansa; largo demais desmancha o parágrafo.' },
    { k: 'largura',     var: '--tm-largura',      tipo: 'medida', label: 'Largura da mancha', min: 40, max: 110, passo: 1, sufixo: 'ch', dica: 'Em caracteres por linha. Entre 60 e 75 é a faixa de livro; acima de 90 o olho perde a linha na volta.' },
    { k: 'corTexto',    var: '--tm-cor',          tipo: 'cor', label: 'Cor do texto' },
    { k: 'corTitulo',   var: '--tm-cor-titulo',   tipo: 'cor', label: 'Cor dos títulos' },
    { k: 'corDestaque', var: '--tm-cor-destaque', tipo: 'cor', label: 'Cor dos fios e citações' },
    { k: 'fundo',       var: '--tm-fundo',        tipo: 'cor', label: 'Cor do papel' },
    { k: 'fundoImagem', var: '--tm-fundo-img',    tipo: 'imagem', label: 'Papel (imagem)', dica: 'Vira textura repetida atrás do texto. Papel escuro pede texto claro — confira o contraste antes de publicar.' },
];

/** Sobrevive a doc velho, a `estilo` nulo e a campo que virou lixo. */
export function estiloDoLivro_obj(livro) {
    const e = livro && livro.estilo;
    return (e && typeof e === 'object') ? e : {};
}

/**
 * O atributo `style="…"` do container, com uma custom property por campo
 * preenchido. Campo vazio NÃO emite variável — é assim que o livro sem
 * aparência escolhida continua exatamente como sempre foi.
 *
 * Devolve o atributo inteiro (ou ''), para o chamador só interpolar.
 */
export function estiloDoLivro(livro) {
    const css = estiloInline(livro);
    return css ? ` style="${css}"` : '';
}

/**
 * As declarações cruas, sem o `style="…"` em volta — para o container que
 * já existe no HTML e recebe por `setAttribute('style', …)`, como o
 * <article> do Cronista público e a amostra do formulário.
 */
export function estiloInline(livro) {
    const e = estiloDoLivro_obj(livro);
    const partes = [];
    for (const campo of ESTILO_CAMPOS) {
        const v = String(e[campo.k] ?? '').trim();
        if (!v) continue;
        if (campo.tipo === 'imagem') partes.push(`${campo.var}:url("${cssSeguro(v)}")`);
        else if (campo.tipo === 'medida') partes.push(`${campo.var}:${cssSeguro(v)}${campo.sufixo || ''}`);
        else partes.push(`${campo.var}:${cssSeguro(v)}`);
    }
    return partes.join(';');
}

/**
 * O valor entra num atributo `style="…"`, então `"` fecharia o atributo e
 * `;` abriria outra declaração. Quem grava é o mestre autenticado — o alvo
 * não é conteúdo hostil, é impedir que uma URL de papel com aspas quebre o
 * HTML da página inteira.
 *
 * A aspa SIMPLES fica. É ela que segura o nome de família com espaço nas
 * pilhas de FONTES (`'Cormorant Garamond', Georgia, serif`), e dentro de um
 * atributo com aspas duplas ela não fecha coisa nenhuma.
 */
function cssSeguro(v) {
    return String(v).replace(/["<>\\]/g, '').replace(/;/g, ',').slice(0, 300);
}

/** Uma medida já com sufixo, para a prévia do formulário. */
export function comSufixo(campo, valor) {
    const v = String(valor ?? '').trim();
    return v ? v + (campo.sufixo || '') : '';
}
