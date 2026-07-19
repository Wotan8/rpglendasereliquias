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
    injectSearchButton();
    Busca.init();                // atalho Ctrl/Cmd-K
    console.log('⚒️ Ferramentas do Cronista prontas.');
}, { once: true });

/* Botão de busca global no topo da sidebar. */
function injectSearchButton() {
    const nav = document.getElementById('sidebarNav');
    if (!nav || document.getElementById('wbBuscaBtn')) return;
    const btn = document.createElement('button');
    btn.id = 'wbBuscaBtn';
    btn.className = 'wbt-search-btn';
    btn.innerHTML = `<span>🔍 Buscar no mundo</span><kbd>Ctrl K</kbd>`;
    btn.onclick = () => Busca.open();
    nav.insertBefore(btn, nav.firstChild);
}

/* Busca global pediu para abrir uma linhagem específica. */
document.addEventListener('wb:goto-lineage', async (e) => {
    const grafosTool = TOOLS.find(t => t.tool === 'grafos');
    if (grafosTool) {
        await activate(grafosTool);
        Grafos.openLineageById?.(e.detail);
    }
});
