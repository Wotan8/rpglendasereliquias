// =============================================
// BADGE DE VERSÃO — canto inferior direito, em todas as páginas
//
// Existe para responder uma pergunta de deploy: "esta aba está rodando a versão
// que eu acabei de publicar?". Mostra DOIS números, porque eles divergem:
//
//   ativo    → VERSION do Service Worker que controla ESTA aba agora.
//              É quem serve os assets do cache. Pode estar velho.
//   servidor → VERSION dentro de /sw.js no servidor. É o que foi publicado.
//
// Iguais  → badge discreta, tudo em dia.
// Difere  → badge alaranjada com "↻", ou seja: recarregue, você está no antigo.
//
// A VERSION mora SÓ no sw.js. Nenhuma página precisa ser editada quando ela
// muda — este arquivo é carregado por js/global-favicon.js, que já está em
// todas as páginas.
//
// Versão da própria página é opcional: <meta name="page-version" content="x">.
// =============================================

const ID = 'lr-version-badge';

/** Pergunta ao worker que controla a aba qual VERSION ele roda. */
function versaoDoWorkerAtivo(timeoutMs = 1500) {
    return new Promise(resolve => {
        const sw = navigator.serviceWorker;
        if (!sw || !sw.controller) return resolve(null);

        const canal = new MessageChannel();
        const timer = setTimeout(() => resolve(null), timeoutMs);
        canal.port1.onmessage = e => {
            clearTimeout(timer);
            resolve(e.data && e.data.version ? e.data.version : null);
        };
        try {
            sw.controller.postMessage({ type: 'GET_VERSION' }, [canal.port2]);
        } catch {
            clearTimeout(timer);
            resolve(null);
        }
    });
}

/** Lê a VERSION declarada no sw.js publicado. Exportada para teste. */
export function extrairVersao(texto) {
    const m = String(texto || '').match(/const\s+VERSION\s*=\s*['"]([^'"]+)['"]/);
    return m ? m[1] : null;
}

/** Busca /sw.js furando cache — senão o próprio SW devolveria a cópia velha. */
async function versaoNoServidor() {
    try {
        const r = await fetch(`/sw.js?cb=${Date.now()}`, { cache: 'no-store' });
        if (!r.ok) return null;
        return extrairVersao(await r.text());
    } catch {
        return null;
    }
}

function versaoDaPagina() {
    return document.querySelector('meta[name="page-version"]')?.content?.trim() || null;
}

/** Decide o que a badge mostra. Pura, para poder ser testada. */
export function montarRotulo({ ativo, servidor, pagina }) {
    const desatualizado = !!(ativo && servidor && ativo !== servidor);
    let texto;
    if (ativo && servidor) texto = desatualizado ? `${ativo} → ${servidor}` : ativo;
    else texto = ativo || servidor || '—';

    // O ↻ vai colado no texto, não como separador: como separador ele só
    // aparecia quando existisse versão de página, ou seja, sumia justamente no
    // caso comum — que é quando o aviso de "recarregue" mais importa.
    const partes = [desatualizado ? `${texto} ↻` : texto];
    if (pagina) partes.push(`pág ${pagina}`);

    const titulo = [
        `Service Worker ativo nesta aba: ${ativo || '(nenhum — sem cache)'}`,
        `Publicado no servidor: ${servidor || '(não lido)'}`,
        pagina ? `Versão da página: ${pagina}` : null,
        desatualizado ? '\n⚠️ Esta aba roda a versão antiga. Recarregue para atualizar.' : null,
    ].filter(Boolean).join('\n');

    return { texto: partes.join('  ·  '), desatualizado, titulo };
}

function estilizar() {
    if (document.getElementById(ID + '-css')) return;
    const css = document.createElement('style');
    css.id = ID + '-css';
    // pointer-events:none para nunca roubar clique; volta a receber no hover
    // só para o title aparecer. Sai da impressão e some em telas estreitas.
    // Toda regra de tema/normal é escopada em :not(.lr-stale). Sem isso,
    // `:root[data-theme] #id` (especificidade 1,2,0) venceria `#id.lr-stale`
    // (1,1,0) e a badge desatualizada perderia o alaranjado — que é justamente
    // o único momento em que ela precisa chamar atenção.
    css.textContent = `
#${ID}{position:fixed;right:6px;bottom:4px;z-index:2147483000;
  font:600 11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;
  letter-spacing:.02em;padding:2px 7px;border-radius:999px;
  border:1px solid transparent;backdrop-filter:blur(4px);
  transition:opacity .15s;user-select:none;white-space:nowrap}
#${ID}:not(.lr-stale){color:#94a3b8;background:rgba(15,23,42,.55);
  border-color:rgba(148,163,184,.35);opacity:.8;pointer-events:none}
#${ID}:not(.lr-stale):hover{opacity:1}
#${ID}.lr-stale{color:#fdba74;background:rgba(120,53,15,.78);
  border-color:rgba(251,146,60,.55);opacity:.95;pointer-events:auto;cursor:help}
@media (prefers-color-scheme: light){
  #${ID}:not(.lr-stale){color:#475569;background:rgba(248,250,252,.8);
    border-color:rgba(100,116,139,.4)}
}
:root[data-theme="light"] #${ID}:not(.lr-stale){color:#475569;
  background:rgba(248,250,252,.8);border-color:rgba(100,116,139,.4)}
:root[data-theme="dark"] #${ID}:not(.lr-stale){color:#94a3b8;
  background:rgba(15,23,42,.55);border-color:rgba(148,163,184,.35)}
@media print{#${ID}{display:none}}
/* Tela estreita: encolhe em vez de esconder — em celular a versão importa
   igual. Só tamanho/posição aqui, cor e estado continuam nas regras acima. */
@media (max-width:520px){
  #${ID}{font-size:8px;padding:0 4px;right:2px;bottom:1px;letter-spacing:0}
}`;
    document.head.appendChild(css);
}

/**
 * Sobe a badge até não cobrir nenhum elemento fixo/sticky.
 *
 * O canto inferior direito é disputado: o Tabuleiro põe #tbCoords (coordenadas
 * e zoom) exatamente ali. Em vez de tratar página por página — o que exigiria
 * editar cada uma, justo o que esta badge existe para evitar — ela mede o que
 * está embaixo e se afasta. Só considera fixed/sticky: o canvas de fundo do
 * Tabuleiro cobre a tela inteira e empurraria a badge para fora sem isso.
 */
function desviarDeObstaculos(el, tentativas = 4) {
    // Interseção de retângulos, e não amostragem de pontos: #tbCoords começa
    // vazio, com 16x6px, e passava entre as amostras — a badge continuava por
    // cima até o mouse mexer. Retângulo não tem esse ponto cego.
    // Só HUD conta como obstáculo. O Tabuleiro tem canvas e overlay fixos
    // cobrindo a tela inteira: tratá-los como obstáculo mandava a badge para
    // 800px de altura, o limite de segurança abortava, e ela não saía do lugar.
    const ehFundo = o => o.width > innerWidth * 0.6 && o.height > innerHeight * 0.6;
    const fixos = [...document.body.querySelectorAll('*')].filter(n => {
        if (n === el || n.contains(el)) return false;
        const cs = getComputedStyle(n);
        if (cs.position !== 'fixed' && cs.position !== 'sticky') return false;
        if (cs.display === 'none' || cs.visibility === 'hidden') return false;
        return !ehFundo(n.getBoundingClientRect());
    });
    if (!fixos.length) return;

    let baixo = 4;
    for (let i = 0; i < tentativas; i++) {
        const r = el.getBoundingClientRect();
        if (!r.width) return;
        // 4px de folga: encostar não é sobrepor, mas fica feio
        const bate = fixos.filter(n => {
            const o = n.getBoundingClientRect();
            if (!o.width || !o.height) return false;
            return !(r.right < o.left - 4 || r.left > o.right + 4
                  || r.bottom < o.top - 4 || r.top > o.bottom + 4);
        });
        if (!bate.length) return;

        const topoMaisAlto = Math.min(...bate.map(n => n.getBoundingClientRect().top));
        const novo = Math.round(window.innerHeight - topoMaisAlto + 6);
        if (novo <= baixo || novo > window.innerHeight * 0.5) return;  // não sobe sem fim
        baixo = novo;
        el.style.bottom = baixo + 'px';
    }
}

function render({ texto, desatualizado, titulo }) {
    estilizar();
    let el = document.getElementById(ID);
    if (!el) {
        el = document.createElement('div');
        el.id = ID;
        document.body.appendChild(el);
    }
    el.textContent = texto;
    el.title = titulo;
    el.classList.toggle('lr-stale', desatualizado);

    // Depois do layout: a HUD da página pode nem existir ainda no primeiro frame.
    // O segundo passe pega HUD que só aparece depois (coordenadas do Tabuleiro
    // só ganham tamanho quando o mouse entra no canvas).
    const reposicionar = () => { el.style.bottom = ''; desviarDeObstaculos(el); };
    requestAnimationFrame(reposicionar);
    setTimeout(reposicionar, 1200);

    if (!el.dataset.reposicionaNoResize) {
        el.dataset.reposicionaNoResize = '1';
        let t;
        addEventListener('resize', () => { clearTimeout(t); t = setTimeout(reposicionar, 150); });
    }
}

export async function mostrarBadgeDeVersao() {
    if (!document.body) {
        document.addEventListener('DOMContentLoaded', mostrarBadgeDeVersao, { once: true });
        return;
    }
    const [ativo, servidor] = await Promise.all([versaoDoWorkerAtivo(), versaoNoServidor()]);
    render(montarRotulo({ ativo, servidor, pagina: versaoDaPagina() }));

    // Troca de worker (deploy aplicado) → redesenha sem precisar de F5.
    navigator.serviceWorker?.addEventListener?.('controllerchange', () => {
        setTimeout(mostrarBadgeDeVersao, 300);
    });
}
