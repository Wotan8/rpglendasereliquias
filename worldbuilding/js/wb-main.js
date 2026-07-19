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

/* Espera o núcleo carregar os dados reais antes de habilitar as ferramentas. */
document.addEventListener('wb:data-ready', async () => {
    await Eco.load();            // raças, classes, tribos mecânicas, personagens e linhagens
    await Calendario.load();     // regras do calendário (usadas por timeline)
    injectModal();
    injectNav();
    wireGlobalSearch();          // busca única: a barra do topo abre a paleta
    injectSidebarToggle();       // recolher/expandir menu lateral
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

/* Botão para recolher o menu lateral (mostra só os emojis quando recolhido). */
function injectSidebarToggle() {
    const header = document.querySelector('.sidebar .sidebar-header');
    if (!header || document.getElementById('wbSidebarToggle')) return;
    const btn = document.createElement('button');
    btn.id = 'wbSidebarToggle';
    btn.className = 'wb-sidebar-toggle';
    btn.title = 'Recolher / expandir menu';
    btn.setAttribute('aria-label', 'Recolher menu lateral');
    btn.textContent = '⏴';
    const KEY = 'wb-sidebar-collapsed';
    const apply = (collapsed) => {
        document.body.classList.toggle('wb-sidebar-collapsed', collapsed);
        btn.textContent = collapsed ? '⏵' : '⏴';
        const nova = document.getElementById('btnNewEntry');
        if (nova) { nova.textContent = collapsed ? '➕' : '➕ Nova Entrada'; nova.title = 'Nova Entrada'; }
        try { localStorage.setItem(KEY, collapsed ? '1' : '0'); } catch { }
    };
    btn.onclick = () => apply(!document.body.classList.contains('wb-sidebar-collapsed'));
    header.appendChild(btn);
    // Tooltips (visíveis só no modo recolhido) a partir do rótulo de cada aba.
    document.querySelectorAll('.sidebar-nav .nav-category').forEach(el => {
        const label = el.querySelector('.nav-label')?.textContent?.trim();
        if (label && !el.dataset.tip) el.dataset.tip = label;
    });
    let saved = '0';
    try { saved = localStorage.getItem(KEY) || '0'; } catch { }
    apply(saved === '1');
}

/* Busca global pediu para abrir uma linhagem específica. */
document.addEventListener('wb:goto-lineage', async (e) => {
    const grafosTool = TOOLS.find(t => t.tool === 'grafos');
    if (grafosTool) {
        await activate(grafosTool);
        Grafos.openLineageById?.(e.detail);
    }
});
