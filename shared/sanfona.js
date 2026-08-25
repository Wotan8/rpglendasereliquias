/* =====================================================================
   SANFONA — expandir e recolher tudo, num lugar só

   Marca-se o BLOCO com `data-sanfona` e `ligarSanfona(raiz)` põe o botão
   "Expandir/Recolher tudo" no cabeçalho dele, mantendo o rótulo em dia.

   Duas formas de dobra convivem no projeto, e o botão comanda as duas:

     · <details class="lr-sanfona"> — a forma nova, sem JS de estado.

           <details class="lr-sanfona" data-sanfona>
               <summary>🧩 Módulos de Classe</summary>
               <details class="lr-sanfona"><summary>Custo 1</summary>…</details>
               <details class="lr-sanfona"><summary>Custo 2</summary>…</details>
           </details>

     · classe no elemento — a forma antiga, que os Módulos de Classe da ficha e
       os grupos de Equipamentos usam. Trocá-los por <details> mexeria em
       impressão, arrasto e teste; não vale o risco só pelo botão. O bloco diz
       QUAL classe significa fechado e quem são as dobras:

           <div data-sanfona data-sanfona-classe="cm-collapsed">
               <h3 data-sanfona-barra>Módulos de Classe</h3>
               <div class="secao cm-collapsed" data-sanfona-item>…</div>
           </div>

   Idempotente: pode chamar de novo depois de re-renderizar a lista, que não
   duplica botão. É o caso normal aqui — a ficha de NPC reconstrói o HTML dos
   módulos a cada edição de campo.

   O desenho (seta, botão, o que some em bloco estreito) mora em sanfona.css.
   ===================================================================== */

const ABRIR = { ico: '⊞', txt: 'Expandir tudo' };
const FECHAR = { ico: '⊟', txt: 'Recolher tudo' };

/**
 * As dobras que este bloco comanda, com uma interface só para as duas formas.
 * Netas contam; o próprio bloco e dobras de um bloco aninhado, não.
 */
function dobrasDe(bloco) {
    const cls = bloco.dataset.sanfonaClasse;
    const meu = (el) => el !== bloco && el.closest('[data-sanfona]') === bloco;

    if (cls) {
        return [...bloco.querySelectorAll('[data-sanfona-item]')].filter(meu).map(el => ({
            get aberto() { return !el.classList.contains(cls); },
            abrir(v) { el.classList.toggle(cls, !v); },
        }));
    }
    /* `[data-sanfona-item]` cobre o <details> que tem desenho próprio e não
       quer a setinha padrão — as gavetas do formulário de item usam um chevron
       e continuam com ele. */
    const sel = 'details.lr-sanfona, details[data-sanfona-item]';
    return [...bloco.querySelectorAll(sel)].filter(meu).map(el => ({
        get aberto() { return el.open; },
        abrir(v) { el.open = v; },
    }));
}

/** O botão diz o que VAI fazer, não em que estado está. */
function pintar(botao, bloco) {
    const dobras = dobrasDe(bloco);
    // Com uma dobra só não há "tudo": o botão some em vez de mentir.
    botao.hidden = dobras.length < 2;
    if (botao.hidden) return;

    /* Basta UMA aberta para o botão virar "recolher"; ele só oferece expandir
       quando não há nada aberto. O contrário — expandir enquanto sobrar uma
       fechada — obrigava dois cliques para limpar a tela, que é o motivo de
       alguém procurar este botão. */
    const algumAberto = dobras.some(d => d.aberto);
    const m = algumAberto ? FECHAR : ABRIR;
    botao.querySelector('.lr-sanf-ico').textContent = m.ico;
    botao.querySelector('.lr-sanf-txt').textContent = m.txt;
    botao.title = `${m.txt} (${dobras.filter(d => d.aberto).length}/${dobras.length} abertos)`;
    botao.setAttribute('aria-label', m.txt);
    botao.dataset.acao = algumAberto ? 'fechar' : 'abrir';
}

/**
 * Liga (ou reavalia) as sanfonas de uma raiz.
 * @param {ParentNode} [raiz=document]
 */
export function ligarSanfona(raiz = document) {
    /* A própria raiz conta: quem re-renderiza uma lista chama com o bloco em
       mãos, e `querySelectorAll` nunca devolve o elemento em que foi chamado. */
    const blocos = [...raiz.querySelectorAll('[data-sanfona]')];
    if (raiz.matches?.('[data-sanfona]')) blocos.unshift(raiz);

    for (const bloco of blocos) {
        /* O botão vive no cabeçalho: o `<summary>` do bloco, ou o elemento que
           a tela marcou com [data-sanfona-barra] quando o bloco não é um
           <details>. */
        const barra = bloco.querySelector(':scope > [data-sanfona-barra]')
            || bloco.querySelector(':scope > summary');
        if (!barra) continue;

        let botao = barra.querySelector(':scope > .lr-sanf-tudo');
        if (!botao) {
            botao = document.createElement('button');
            botao.type = 'button';
            botao.className = 'lr-sanf-tudo';
            botao.innerHTML = '<span class="lr-sanf-ico"></span><span class="lr-sanf-txt"></span>';
            botao.addEventListener('click', (e) => {
                /* Dentro de um <summary> — ou de um cabeçalho que dobra ao
                   clique — o evento fecharia o bloco de fora, que é o contrário
                   do que quem clicou em "Recolher tudo" quer. */
                e.preventDefault();
                e.stopPropagation();
                const abrir = botao.dataset.acao === 'abrir';
                for (const d of dobrasDe(bloco)) d.abrir(abrir);
                pintar(botao, bloco);
            });
            barra.appendChild(botao);
        }

        if (!bloco.dataset.sanfonaLigado) {
            bloco.dataset.sanfonaLigado = '1';
            // O rótulo acompanha quem abre uma dobra na mão. `toggle` não
            // borbulha, daí a captura.
            bloco.addEventListener('toggle', (e) => {
                if (e.target !== bloco) pintar(botao, bloco);
            }, true);
            /* Dobra por CLASSE não dispara evento nenhum. O clique de quem a
               dobrou já passou por aqui — só falta a classe entrar, e isso
               acontece no mesmo tique. Não uso requestAnimationFrame: em aba de
               segundo plano ele não chega e o rótulo ficaria mentindo. */
            if (bloco.dataset.sanfonaClasse) {
                bloco.addEventListener('click', () => setTimeout(() => pintar(botao, bloco), 0));
            }
        }
        pintar(botao, bloco);
    }
}

/* Ponte para os scripts clássicos (a ficha de NPC e o inventário não são
   módulos). Módulo novo importa a função. */
if (typeof window !== 'undefined') {
    window.LRSanfona = { ligarSanfona };
}
