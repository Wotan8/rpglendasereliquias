/* ═══════════════════════════════════════════════════════════
   wb-main.js — Orquestrador das ferramentas novas
   ────────────────────────────────────────────────
   Carrega DEPOIS do wb-core.js. Quando o núcleo dispara
   'wb:data-ready' (dados reais já em memória), este módulo:
     1. injeta os itens de menu das novas ferramentas na
        sidebar existente (com data-tool p/ o core ignorá-los);
     2. injeta o modal próprio das ferramentas;
     3. roteia cada clique para o módulo certo, reaproveitando
        o mesmo #contentBody das categorias legadas.
   Nenhuma linha do núcleo é reescrita — só estendida.
   ═══════════════════════════════════════════════════════════ */

import { Eco }        from './wb-ecosystem.js';
import { Calendario } from './wb-calendario.js';
import { Timeline }   from './wb-timeline.js';
import { Grafos }     from './wb-grafos.js';
import { Editor }     from './wb-editor.js';
import { Mural }      from './wb-mural.js';
import { Busca }      from './wb-busca.js';

const TOOLS = [
    { tool: 'timeline', icon: '📜', label: 'Linha do Tempo', render: () => Timeline.render() },
    { tool: 'grafos',   icon: '🕸️', label: 'Grafos de Conexão', render: () => Grafos.render() },
    { tool: 'editor',   icon: '✒️', label: 'Escritório do Cronista', render: () => Editor.render() },
    { tool: 'mural',    icon: '📌', label: 'Mural de Ideias', render: () => Mural.render() },
];

function injectNav() {
    const nav = document.getElementById('sidebarNav');
    if (!nav || nav.querySelector('[data-tool]')) return;

    const divider = document.createElement('div');
    divider.className = 'nav-divider';
    nav.appendChild(divider);

    const header = document.createElement('div');
    header.className = 'wbt-nav-header';
    header.textContent = '⚒️ Ferramentas do Cronista';
    nav.appendChild(header);

    for (const t of TOOLS) {
        const el = document.createElement('div');
        el.className = 'nav-category';
        el.dataset.tool = t.tool;            // o core ignora itens com data-tool
        el.innerHTML = `<span class="nav-icon">${t.icon}</span><span class="nav-label">${t.label}</span>`;
        el.addEventListener('click', () => activate(t));
        nav.appendChild(el);
    }
}

function injectModal() {
    if (document.getElementById('wbToolModal')) return;
    const m = document.createElement('div');
    m.className = 'modal wbt-modal';
    m.id = 'wbToolModal';
    m.innerHTML = `
        <div class="modal-content wbt-modal__content">
            <button class="modal-close wbt-modal__close" data-close>✕</button>
            <div id="wbToolModalBody"></div>
        </div>`;
    document.body.appendChild(m);
    m.addEventListener('click', (e) => { if (e.target === m) m.classList.remove('active'); });
}

async function activate(tool) {
    // marca ativo na sidebar (some do estado das categorias legadas)
    document.querySelectorAll('.nav-category').forEach(n =>
        n.classList.toggle('active', n.dataset.tool === tool.tool));
    document.body.classList.remove('wbt-focus');
    try {
        await tool.render();
    } catch (err) {
        console.error(`[${tool.tool}]`, err);
        document.getElementById('contentBody').innerHTML =
            `<div class="wbt-empty">Erro ao carregar a ferramenta. Veja o console (F12).</div>`;
    }
}

/* ── Última aba aberta ─────────────────────────────────────────
   Quem estava no Escritório e volta amanhã cai no Dashboard e navega de
   novo. Categoria legada e ferramenta nova são o MESMO `.nav-category` no
   DOM, e as duas reagem a `click` — então gravar qual foi e CLICAR nela na
   volta serve para as duas, sem uma linha no wb-core.js (que tem outra
   frente trabalhando em cima). */
export const KEY_ABA = 'wb-ultima-aba';
const chaveDoItem = (el) =>
    el.dataset.tool ? 'tool:' + el.dataset.tool
        : el.dataset.category ? 'cat:' + el.dataset.category : '';

export function lembrarAba() {
    document.getElementById('sidebarNav')?.addEventListener('click', (e) => {
        const item = e.target.closest('.nav-category'); if (!item) return;
        const chave = chaveDoItem(item);
        if (chave) { try { localStorage.setItem(KEY_ABA, chave); } catch { /* sem memória, paciência */ } }
    });
}

export function restaurarAba() {
    let salvo = '';
    try { salvo = localStorage.getItem(KEY_ABA) || ''; } catch { return; }
    const [tipo, valor] = salvo.split(':');
    // O valor vira seletor: só nome de aba passa. Lixo no localStorage
    // (versão antiga, mão humana) estouraria o querySelector e derrubaria
    // o resto da inicialização junto.
    if (!/^[\w-]+$/.test(valor || '') || (tipo !== 'tool' && tipo !== 'cat')) return;
    const el = document.querySelector(
        tipo === 'tool' ? `.nav-category[data-tool="${valor}"]` : `.nav-category[data-category="${valor}"]`);
    el?.click();
}

/* Espera o núcleo carregar os dados reais antes de habilitar as ferramentas. */
document.addEventListener('wb:data-ready', async () => {
    await Eco.load();            // raças, classes, tribos mecânicas, personagens e linhagens
    await Calendario.load();     // regras do calendário (usadas por timeline)
    injectModal();
    injectNav();
    // Antes do injectSidebarToggle: ele escuta clique na sidebar para recolher
    // o drawer no celular, e o clique programático daqui recolheria o menu
    // sozinho a cada abertura da página.
    restaurarAba();
    wireGlobalSearch();          // busca única: a barra do topo abre a paleta
    injectSidebarToggle();       // recolher/expandir menu lateral
    lembrarAba();
    Busca.init();                // atalho Ctrl/Cmd-K
    console.log('⚒️ Ferramentas do Cronista prontas.');
}, { once: true });

/* Busca ÚNICA: reaproveita a barra "Buscar…" do topo da sidebar como gatilho
   da paleta de busca (a mais completa — LORE + mecânica + linhagens, com teclado).
   Removemos o botão redundante e desativamos a busca inline do núcleo. */
function wireGlobalSearch() {
    document.getElementById('wbBuscaBtn')?.remove();          // remove o botão duplicado, se existir
    const input = document.getElementById('globalSearch');
    if (!input) return;
    input.readOnly = true;                                    // vira um "gatilho" — não filtra mais inline
    input.placeholder = '🔍 Buscar no mundo (Ctrl K)';
    input.style.cursor = 'pointer';
    const open = (e) => { e.preventDefault(); input.blur(); Busca.open(); };
    input.addEventListener('focus', open);
    input.addEventListener('click', open);
}

/* Botão para recolher o menu lateral — 3 estados em vai-e-volta:
   full (ícones + nomes) ⇄ icons (só emojis) ⇄ hidden (menu oculto).
   O botão fica SEMPRE visível (flutuante, fixo), para reabrir mesmo oculto.
   No celular a sidebar vira um "drawer": em 'full' sobrepõe o conteúdo com
   fundo escuro; em 'icons' vira um trilho fino à esquerda; em 'hidden' some. */
function injectSidebarToggle() {
    if (document.getElementById('wbNavToggle')) return;

    const KEY = 'wb-nav-state';
    const STATES = ['full', 'icons', 'hidden'];
    const GLYPH = { full: '«', icons: '‹', hidden: '☰' };
    const TIPS = {
        full: 'Recolher para só ícones',
        icons: 'Ocultar o menu',
        hidden: 'Mostrar o menu',
    };
    const isMobile = () => window.matchMedia('(max-width: 860px)').matches;

    // Botão flutuante, sempre visível (fora da sidebar, para sobreviver ao 'hidden').
    const btn = document.createElement('button');
    btn.id = 'wbNavToggle';
    btn.className = 'wb-nav-toggle';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Alternar menu lateral');
    document.body.appendChild(btn);

    // Fundo escuro do drawer (só aparece no celular, em 'full').
    let backdrop = document.getElementById('wbNavBackdrop');
    if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.id = 'wbNavBackdrop';
        backdrop.className = 'wb-nav-backdrop';
        document.body.appendChild(backdrop);
    }

    let current = 'full';
    let dir = 1; // sentido do vai-e-volta no vetor STATES
    const idx = () => STATES.indexOf(current);

    function apply(state) {
        current = STATES.includes(state) ? state : 'full';
        document.body.classList.toggle('wb-sidebar-collapsed', current === 'icons');
        document.body.classList.toggle('wb-sidebar-hidden', current === 'hidden');
        btn.textContent = GLYPH[current];
        btn.title = TIPS[current];
        btn.dataset.state = current;
        const nova = document.getElementById('btnNewEntry');
        if (nova) {
            nova.textContent = current === 'full' ? '➕ Nova Entrada' : '➕';
            nova.title = 'Nova Entrada';
        }
        try { localStorage.setItem(KEY, current); } catch { }
    }

    // Clique: caminha no vetor [full, icons, hidden] em vai-e-volta (ping-pong).
    btn.onclick = () => {
        let i = idx();
        if (i <= 0) dir = 1;
        else if (i >= STATES.length - 1) dir = -1;
        apply(STATES[i + dir]);
    };

    // Toca no fundo escuro → oculta o menu (fecha o drawer).
    backdrop.onclick = () => { dir = -1; apply('hidden'); };

    // Rótulos → tooltip (aparecem no modo só-ícones) e acessibilidade.
    document.querySelectorAll('.sidebar-nav .nav-category').forEach(el => {
        const label = el.querySelector('.nav-label')?.textContent?.trim();
        if (label && !el.dataset.tip) el.dataset.tip = label;
    });

    // No celular, ao escolher uma aba com o drawer aberto, recolhe para ícones
    // (libera a tela para o conteúdo sem perder a navegação rápida).
    document.getElementById('sidebarNav')?.addEventListener('click', (e) => {
        if (!e.target.closest('.nav-category')) return;
        if (isMobile() && current === 'full') { dir = 1; apply('icons'); }
    }, true);
    document.getElementById('btnNewEntry')?.addEventListener('click', () => {
        if (isMobile() && current === 'full') { dir = 1; apply('icons'); }
    }, true);

    // Estado inicial: preferência salva; senão, no celular começa em 'icons'
    // (trilho compacto, conteúdo em primeiro plano) e no desktop em 'full'.
    let saved = '';
    try { saved = localStorage.getItem(KEY) || ''; } catch { }
    if (!saved) {
        try { if (localStorage.getItem('wb-sidebar-collapsed') === '1') saved = 'icons'; } catch { }
    }
    if (!STATES.includes(saved)) saved = isMobile() ? 'icons' : 'full';
    dir = saved === 'hidden' ? -1 : 1;
    apply(saved);
}

/* Busca global pediu para abrir uma linhagem específica. */
document.addEventListener('wb:goto-lineage', async (e) => {
    const grafosTool = TOOLS.find(t => t.tool === 'grafos');
    if (grafosTool) {
        await activate(grafosTool);
        Grafos.openLineageById?.(e.detail);
    }
});
