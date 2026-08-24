// =============================================================
// DIÁLOGOS DA MESA — toast, confirmar e perguntar
//
// O DESIGN-SYSTEM.md ja descrevia o toast ("filete dourado a esquerda") e o
// lendas-reliquias.css ja estilizava `dialog` e `[class*="toast"]`. Faltava o
// corpo: nao existia nenhum JS de dialogo em shared/, e o vazio foi preenchido
// por 176 caixas do sistema operacional — 57 alert() e 14 confirm() so na
// Ficha, 12 prompt() no Tabuleiro.
//
// Na mesa isso e uma caixa cinza do Android por cima do mapa, sem tema, sem o
// vermelho de perigo, no meio da sessao. Aqui esta o substituto.
//
// ⚠️ `confirmar` e `perguntar` devolvem PROMESSA — o nativo era sincrono.
// Quem chama precisa de `await`:
//     if (!confirm('Excluir?')) return;      →  if (!await confirmar('Excluir?')) return;
// Em handler de onclick isso nao muda nada (o retorno ja era ignorado), mas a
// funcao que o contem precisa ser `async`.
//
// Usa <dialog> nativo de proposito: foco preso, Esc e camada de topo vem de
// graca do navegador — e camada de topo e o que faz o dialogo aparecer por
// cima do canvas do Tabuleiro sem disputa de z-index.
// =============================================================

const esc = (t) => t == null ? '' : String(t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** As quatro cores de significado do sistema. Tudo o mais cai em 'info'. */
const TIPOS = new Set(['sucesso', 'erro', 'aviso', 'info']);
const tipoValido = (t) => TIPOS.has(t) ? t : 'info';

// ===================== TOAST =====================

/* A pilha e criada na primeira vez e fica. Nome SEM "toast" de proposito: o
   lendas-reliquias.css neutraliza `[class*="toast"] [class*="toast"]`, entao
   um container chamado "toasts" apagaria o estilo de todos os filhos. */
function pilha() {
    let el = document.querySelector('.lr-avisos');
    if (!el) {
        el = document.createElement('div');
        el.className = 'lr-avisos';
        el.setAttribute('role', 'status');
        el.setAttribute('aria-live', 'polite');
        document.body.appendChild(el);
    }
    return el;
}

const ICONE = { sucesso: '✅', erro: '❌', aviso: '⚠️', info: 'ℹ️' };

/**
 * Aviso que passa sozinho. Substitui `alert()`: como o retorno do alert nunca
 * era lido, a troca nao mexe em fluxo nenhum — so para de travar a tela.
 *
 * @param {string} msg
 * @param {'sucesso'|'erro'|'aviso'|'info'} [tipo]
 * @param {number} [ms] quanto fica na tela. Erro fica mais tempo.
 */
export function toast(msg, tipo = 'info', ms) {
    const t = tipoValido(tipo);
    const el = document.createElement('div');
    el.className = `lr-toast lr-toast-${t}`;
    el.innerHTML = `<span class="lr-toast-ico" aria-hidden="true">${ICONE[t]}</span>
        <span class="lr-toast-msg">${esc(msg)}</span>
        <button type="button" class="lr-toast-x" aria-label="Fechar aviso">✕</button>`;

    const sair = () => {
        if (!el.isConnected) return;
        el.classList.add('lr-toast-saindo');
        // se a animacao estiver desligada (prefers-reduced-motion), o
        // transitionend nunca chega: o setTimeout e a rede.
        el.addEventListener('transitionend', () => el.remove(), { once: true });
        setTimeout(() => el.remove(), 400);
    };
    el.querySelector('.lr-toast-x').addEventListener('click', sair);

    pilha().appendChild(el);
    setTimeout(sair, ms ?? (t === 'erro' ? 7000 : 4000));
    return el;
}

// ===================== DIÁLOGO =====================

/**
 * Abre o dialogo e resolve com o que `ler(d)` devolver, ou com `cancelado`.
 *
 * Nao depende do evento `close`: ele chega numa TAREFA, e aba em segundo plano
 * pode segurar a fila — a promessa ficaria pendurada e o `await` de quem
 * chamou nunca voltaria. `submit` e `cancel` sao sincronos, entao e neles que
 * a decisao e lida. O <dialog> continua sendo nativo pelo que importa: foco
 * preso, Esc e camada de topo.
 *
 * O Confirmar e submit (o Enter dentro do campo cai nele de graca); o Cancelar
 * e botao comum; Esc dispara `cancel`. Os tres passam por `terminar`, que so
 * responde uma vez.
 */
function abrir(html, ler, cancelado) {
    const d = document.createElement('dialog');
    d.className = 'lr-dialogo';
    d.innerHTML = html;
    document.body.appendChild(d);

    return new Promise(resolve => {
        let respondido = false;
        const terminar = (valor) => {
            if (respondido) return;
            respondido = true;
            try { if (d.open) d.close(); } catch { /* ja fechado */ }
            d.remove();
            resolve(valor);
        };
        // submit cobre o clique no Confirmar E o Enter dentro do campo
        d.querySelector('form').addEventListener('submit', (e) => {
            e.preventDefault();          // quem fecha e o terminar, nao o form
            terminar(ler(d));
        });
        d.querySelector('.lr-dialogo-cancel').addEventListener('click', () => terminar(cancelado));
        d.addEventListener('cancel', () => terminar(cancelado));   // Esc
        d.showModal();
    });
}

/** Cabecalho + corpo, comuns aos dois dialogos. `pre-line` porque as mensagens
 *  herdadas do confirm() usam \n para separar paragrafo. */
const corpo = (titulo, msg) => `
    ${titulo ? `<h2 class="lr-dialogo-titulo">${esc(titulo)}</h2>` : ''}
    <p class="lr-dialogo-msg">${esc(msg)}</p>`;

/**
 * Substitui `confirm()`. Devolve PROMESSA de booleano.
 *
 * @param {string} msg
 * @param {{titulo?:string, ok?:string, cancelar?:string, perigo?:boolean}} [opts]
 *        `perigo: true` pinta o botao de vermelho sangue E deixa o foco no
 *        Cancelar — em acao destrutiva, o Enter distraido nao pode confirmar.
 */
export function confirmar(msg, opts = {}) {
    const { titulo = '', ok = 'Confirmar', cancelar = 'Cancelar', perigo = false } = opts;
    /* O Confirmar vem PRIMEIRO no HTML para o Enter dentro do form escolher
       ele, e a ordem visual e invertida no CSS — cancelar a esquerda. */
    const html = `<form class="lr-dialogo-form">
        ${corpo(titulo, msg)}
        <div class="lr-dialogo-botoes">
            <button type="submit" class="lr-dialogo-ok${perigo ? ' lr-dialogo-perigo' : ''}">${esc(ok)}</button>
            <button type="button" class="lr-dialogo-cancel">${esc(cancelar)}</button>
        </div>
    </form>`;
    const p = abrir(html, () => true, false);
    // showModal ja focou o primeiro focavel (o Confirmar); em acao destrutiva
    // isso e o botao errado.
    if (perigo) document.querySelector('.lr-dialogo .lr-dialogo-cancel')?.focus();
    return p;
}

/**
 * Substitui `prompt()`. Devolve PROMESSA de string, ou `null` se cancelou —
 * mesmo contrato do nativo, inclusive o `''` de quem apaga tudo e confirma.
 *
 * Devolve STRING mesmo com `tipo: 'number'`: quem chama ja faz o parseFloat, e
 * mudar isso silenciosamente quebraria a conta de quem espera texto.
 *
 * @param {string} msg
 * @param {{valor?:string, tipo?:string, placeholder?:string, titulo?:string,
 *          ok?:string, cancelar?:string, passo?:string}} [opts]
 */
export function perguntar(msg, opts = {}) {
    const { valor = '', tipo = 'text', placeholder = '', titulo = '',
        ok = 'Confirmar', cancelar = 'Cancelar', passo = 'any' } = opts;
    const html = `<form class="lr-dialogo-form">
        ${corpo(titulo, msg)}
        <input class="lr-dialogo-input" type="${esc(tipo)}"
            ${tipo === 'number' ? `step="${esc(passo)}"` : ''}
            value="${esc(valor)}" placeholder="${esc(placeholder)}" autofocus>
        <div class="lr-dialogo-botoes">
            <button type="submit" class="lr-dialogo-ok">${esc(ok)}</button>
            <button type="button" class="lr-dialogo-cancel">${esc(cancelar)}</button>
        </div>
    </form>`;
    // `null` cancelado, valor do campo confirmado — o contrato do prompt(),
    // inclusive o '' de quem apaga tudo e confirma.
    return abrir(html, (d) => d.querySelector('.lr-dialogo-input').value, null);
}

/* Ponte para os scripts classicos (a Ficha e o Tabuleiro carregam boa parte do
   codigo fora de modulo). Quem e modulo importa direto. */
if (typeof window !== 'undefined') {
    window.LRDialogo = { toast, confirmar, perguntar };
}
