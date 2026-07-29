// =============================================
// 📚 ABA CONHECIMENTO — biblioteca do personagem
// ---------------------------------------------
// Mostra os livros escritos no Worldbuilding (Escritório do Cronista) com
// os capítulos que ESTE personagem já desbloqueou (leitura liberada) e os
// que ainda faltam, dizendo exatamente o que falta para abrir cada um.
//
// As travas vêm do Painel do Criador → aba Conhecimento (system/data/knowledge).
// A avaliação em si mora em conhecimento-calc.js (pura e testada); aqui só
// ligamos os fios com a ficha:
//   • valores da ficha  → _resolveSheetRef()      (mechanics-engine.js)
//   • mecânica booleana → _cmCheckMechanicCost()  (class-modules-renderer.js)
//   • equipamento       → _meMatchItemsByReq()    (mechanics-engine.js)
// Nenhuma conta nova: é o mesmo motor que já valida Módulos de Classe.
// =============================================

import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { statusDoCapitulo } from './conhecimento-calc.js';

let _carregado = false;
let _livros = [], _capitulos = [], _regras = {};

const _esc = (s) => String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* Ligações com o motor da ficha. Tudo com guarda: se um script não carregou,
   o requisito falha fechado em vez de liberar leitura por engano. */
const leitor = {
    ficha: (ref) => typeof _resolveSheetRef === 'function' ? (_resolveSheetRef(ref, 1) || 0) : 0,
    mecanica: (id) => typeof _cmCheckMechanicCost === 'function'
        ? _cmCheckMechanicCost(id)
        : { ok: false, label: 'Mecânica indisponível' },
    // Exige o item EQUIPADO (qualquer forma: efeitos ativos / segurando / fixado),
    // não só guardado na mochila.
    equipamento: (id) => {
        const tpl = (window._inventoryState?.catalog || []).find(t => t.id === id);
        const qtd = typeof _meCountEquipReq === 'function' ? _meCountEquipReq({ equipamentoId: id }) : 0;
        return { ok: qtd > 0, nome: tpl?.nome || id };
    },
};

document.addEventListener('DOMContentLoaded', () => {
    const bind = () => {
        const tab = document.querySelector('.tab[data-tab="tabConhecimento"]');
        if (!tab) return false;
        tab.addEventListener('click', () => { if (!_carregado) carregarConhecimento(); else renderConhecimento(); });
        return true;
    };
    if (!bind()) setTimeout(bind, 1000);
});

// Ficha recarregada (troca de personagem) → os desbloqueios mudam.
document.addEventListener('systemDataReady', () => { _carregado = false; });

// Exposta porque abas-condicionais.js precisa saber se existe biblioteca
// antes do jogador abrir a aba (este arquivo e module, entao nao vaza sozinho).
window.carregarConhecimento = () => carregarConhecimento();
// abas-condicionais.js decide pela CONTAGEM, nao pelo DOM: o container so
// ganha conteudo quando a aba abre, e a aba so abre se ela existir.
// null = ainda nao deu pra saber, e nesse caso a aba fica visivel.
window.temConhecimento = () => _carregado ? (window._conhecimentoVisivel > 0) : null;
async function carregarConhecimento() {
    const cont = document.getElementById('conhecimentoContainer');
    if (!cont) return;
    cont.innerHTML = '<p style="font-size:12px;color:var(--muted);text-align:center;padding:20px 0;">Carregando biblioteca...</p>';

    try {
        const [bSnap, aSnap, kSnap] = await Promise.all([
            getDocs(collection(window.db, 'worldbuilding-books')),
            getDocs(collection(window.db, 'worldbuilding-articles')),
            getDocs(collection(window.db, 'system/data/knowledge')),
        ]);
        _livros = [];
        bSnap.forEach(d => _livros.push({ ...d.data(), id: d.id }));
        _livros.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.title || '').localeCompare(b.title || ''));

        _capitulos = [];
        aSnap.forEach(d => _capitulos.push({ ...d.data(), id: d.id }));
        _capitulos.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.createdAt ?? 0) - (b.createdAt ?? 0));

        // Toda regra salva vale como trava, publicada ou não: um cadeado em
        // rascunho que não tranca nada é pior do que um cadeado a mais.
        _regras = {};
        kSnap.forEach(d => {
            const r = d.data();
            if (r.capituloId) _regras[r.capituloId] = { ...r, id: d.id };
        });

        _carregado = true;
        renderConhecimento();
    } catch (e) {
        console.error('❌ Erro ao carregar Conhecimento:', e);
        cont.innerHTML = '<p style="font-size:12px;color:var(--danger,#ef4444);text-align:center;padding:20px 0;">Erro ao carregar a biblioteca.</p>';
    }
}

function renderConhecimento() {
    const cont = document.getElementById('conhecimentoContainer');
    if (!cont) return;

    let totalLiberados = 0, totalCapitulos = 0;
    const blocos = [];

    for (const livro of _livros) {
        if (!livro.public) continue;   // livro privado nem existe para o jogador
        const caps = _capitulos.filter(c => c.bookId === livro.id);
        const linhas = [];
        let liberadosNoLivro = 0, visiveisNoLivro = 0;

        caps.forEach((cap, i) => {
            const st = statusDoCapitulo(cap, _regras[cap.id], leitor);
            if (st.estado === 'oculto') return;
            visiveisNoLivro++;
            if (st.liberado) liberadosNoLivro++;
            linhas.push(linhaCapitulo(cap, i + 1, st));
        });

        if (!visiveisNoLivro) continue;
        totalLiberados += liberadosNoLivro;
        totalCapitulos += visiveisNoLivro;

        blocos.push(`
            <div class="cnh-livro">
                <div class="cnh-livro-head">
                    ${livro.cover ? `<div class="cnh-capa" style="background-image:url('${_esc(livro.cover)}')"></div>` : '<div class="cnh-capa">📖</div>'}
                    <div style="flex:1;min-width:0">
                        <div class="cnh-livro-titulo">${_esc(livro.title || 'Livro sem título')}</div>
                        ${livro.description ? `<div class="cnh-livro-desc">${_esc(livro.description)}</div>` : ''}
                        <div class="cnh-progresso">📖 ${liberadosNoLivro} de ${visiveisNoLivro} capítulos desbloqueados</div>
                    </div>
                </div>
                <div class="cnh-capitulos">${linhas.join('')}</div>
            </div>`);
    }

    // Sinal para abas-condicionais.js: e o mesmo numero que o jogador ve, ja
    // filtrado pelos livros que alcancam este personagem — nao o total do mundo.
    window._conhecimentoVisivel = totalCapitulos;

    cont.innerHTML = blocos.length
        ? `<div class="cnh-resumo">📚 ${totalLiberados} de ${totalCapitulos} capítulos ao seu alcance</div>${blocos.join('')}`
        : '<p style="font-size:12px;color:var(--muted);text-align:center;padding:20px 0;">Nenhum livro disponível para leitura ainda.</p>';
}

function linhaCapitulo(cap, num, st) {
    const titulo = _esc(cap.title || 'Sem título');

    if (st.liberado) {
        return `
        <div class="cnh-cap cnh-cap--aberto" onclick="window.lerCapitulo('${_esc(cap.id)}')" title="Clique para ler">
            <span class="cnh-cap-num">${num}</span>
            <div style="flex:1;min-width:0">
                <div class="cnh-cap-titulo">${titulo}</div>
                ${cap.synopsis ? `<div class="cnh-cap-syn">${_esc(cap.synopsis)}</div>` : ''}
            </div>
            <span class="cnh-selo cnh-selo--ok">📖 Ler</span>
        </div>`;
    }

    const conector = st.modo === 'qualquer' ? 'Basta UM destes:' : 'Falta cumprir:';
    const faltas = st.resultados.map(r => `
        <li class="${r.ok ? 'cnh-req--ok' : 'cnh-req--falta'}">
            ${r.ok ? '✅' : '🔒'} ${_esc(r.label)}
            ${(!r.ok && r.atual !== undefined) ? `<span class="cnh-req-atual">(você tem ${r.atual})</span>` : ''}
        </li>`).join('');

    return `
    <div class="cnh-cap cnh-cap--travado">
        <span class="cnh-cap-num">${num}</span>
        <div style="flex:1;min-width:0">
            <div class="cnh-cap-titulo">${titulo}</div>
            ${_regras[cap.id]?.dica ? `<div class="cnh-cap-syn">💡 ${_esc(_regras[cap.id].dica)}</div>` : ''}
            <div class="cnh-req-titulo">${conector}</div>
            <ul class="cnh-reqs">${faltas}</ul>
        </div>
        <span class="cnh-selo cnh-selo--lock">🔒</span>
    </div>`;
}

/* Leitura — reaproveita o modal de detalhes que já existe na ficha. */
window.lerCapitulo = function (capId) {
    const cap = _capitulos.find(c => c.id === capId);
    const modal = document.getElementById('detailModal');
    const body = document.getElementById('detailModalBody');
    if (!cap || !modal || !body) return;

    const livro = _livros.find(l => l.id === cap.bookId);
    body.innerHTML = `
        <div class="cnh-leitura">
            ${livro ? `<div class="cnh-leitura-livro">📗 ${_esc(livro.title || '')}</div>` : ''}
            <h2 class="cnh-leitura-titulo">${_esc(cap.title || 'Sem título')}</h2>
            ${cap.synopsis ? `<p class="cnh-leitura-syn">${_esc(cap.synopsis)}</p>` : ''}
            <div class="cnh-leitura-corpo texto-mundo">${cap.contentHTML || '<p><em>Capítulo ainda sem conteúdo.</em></p>'}</div>
        </div>`;
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
};
