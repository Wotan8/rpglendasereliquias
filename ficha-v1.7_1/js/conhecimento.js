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
import { pubDoLivro, versaoDoLivro } from '../../shared/livros-pub.js';
import { estiloDoLivro, formatoAttr } from '../../shared/livro-estilo.js';
import { resolverCampos, carregadorPadrao } from '../../shared/campo-vinculado.js';
import { montarMusica, pararMusica } from '../../shared/musica-capitulo.js';

/* Um carregador por sessao: o cache dele evita reler a colecao a cada
   capitulo aberto. `window.db` porque a ficha inicializa o Firebase antes
   deste modulo rodar. */
let _cc = null;
const _carregarCampos = (cat) =>
    (_cc || (_cc = carregadorPadrao({ db: window.db, collection, getDocs })))(cat);

let _carregado = false;
let _livros = [], _capitulos = [], _regras = {};

const _esc = (s) => String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* Selo de versão do livro — o jogador vê qual edição está lendo sem abrir.
   Vazio quando o autor não marcou versão (ver shared/livros-pub.js). */
const _seloVersao = (livro) => {
    const v = versaoDoLivro(livro);
    return v ? ` <span class="cnh-versao">🔖 ${_esc(v)}</span>` : '';
};

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


/**
 * Livros VINCULADOS a este personagem: os da raca, classe, tribo ou
 * peculiaridade dele. E so metade da conta — a outra metade e a publicacao
 * do livro (shared/livros-pub.js), avaliada em renderConhecimento().
 *
 * Uma fonte pode carregar mais de um livro (Druida: Alquimancia + Totemancia).
 * Os dois formatos salvos vem normalizados por window.lvNormalizar:
 *   { bookId, capituloIds: [] }   // capituloIds vazio = livro inteiro
 *
 * Retorna Map bookId -> Set(capituloIds) ou null quando o livro inteiro vale.
 */
function _livrosDoPersonagem() {
    const sd = window._systemData || {};
    const val = k => (document.querySelector('[data-key="' + k + '"]') || {}).value || '';
    const acha = (lista, nome) => nome && (lista || []).find(d => d.nome === nome || d.id === nome);

    const fontes = [
        // o proprio personagem e uma fonte: e onde o mestre amarra um livro
        // direto nele pelo Tabuleiro (mesmo formato `livrosVinculados`)
        window.state || null,
        acha(sd.races, val('raca')),
        acha(sd.classes, val('classe')),
        acha(sd.tribes, val('tribo')),
    ];
    // Peculiaridades do personagem tambem podem carregar livro.
    const pecs = (window.state && window.state.peculiarities) || [];
    for (const p of pecs) fontes.push(acha(sd.peculiarities, p && (p.nome || p.key || p)));

    const mapa = new Map();
    // Livro amarrado DIRETO no personagem pelo mestre passa por cima da regra de
    // publicacao: ele escolheu a dedo quem le. Vai colado no Map (a chamada e uma
    // so) para nao ter de mudar a assinatura em toda a cadeia.
    mapa.diretos = new Set(window.lvNormalizar(window.state || null).map(v => v.bookId));
    for (const f of fontes) {
        for (const lv of window.lvNormalizar(f)) {
            const caps = Array.isArray(lv.capituloIds) ? lv.capituloIds.filter(Boolean) : [];
            if (!mapa.has(lv.bookId)) mapa.set(lv.bookId, caps.length ? new Set(caps) : null);
            else if (mapa.get(lv.bookId) && caps.length) caps.forEach(c => mapa.get(lv.bookId).add(c));
            else mapa.set(lv.bookId, null);   // outra fonte libera o livro inteiro
        }
    }
    return mapa;
}

function renderConhecimento() {
    const cont = document.getElementById('conhecimentoContainer');
    if (!cont) return;

    let totalLiberados = 0, totalCapitulos = 0;
    const blocos = [];

    const alcance = _livrosDoPersonagem();

    for (const livro of _livros) {
        // Publicacao do livro (shared/livros-pub.js): "Geral" e "Conhecimento Geral"
        // valem para qualquer personagem; "Conhecimento Vinculo" so para quem tem
        // raca/classe/tribo/peculiaridade apontando para o livro.
        const p = pubDoLivro(livro);
        const vinculado = alcance.has(livro.id);
        const direto = alcance.diretos?.has(livro.id);
        if (!(p.geral || p.conhGeral || (p.conhVinculo && vinculado) || direto)) continue;
        // O vinculo pode liberar so alguns capitulos; publicacao aberta e o livro inteiro.
        const soEsses = (p.geral || p.conhGeral) ? null : alcance.get(livro.id);
        const caps = _capitulos.filter(c => c.bookId === livro.id
            && (!soEsses || soEsses.has(c.id)));
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

        // Livro fechado por padrão (igual à estante do Cronista): a aba abre
        // mostrando a lombada de tudo que o personagem alcança, e o sumário de
        // um livro só aparece quando ele pede.
        blocos.push(`
            <details class="cnh-livro">
                <summary class="cnh-livro-head">
                    <span class="cnh-caret">▸</span>
                    ${livro.cover
                        ? `<div class="cnh-capa" style="background-image:url('${_esc(livro.cover)}')" data-zoom="${_esc(livro.cover)}" data-zoom-alt="${_esc(livro.title || '')}" title="Ver a capa maior"></div>`
                        : '<div class="cnh-capa">📖</div>'}
                    <div style="flex:1;min-width:0">
                        <div class="cnh-livro-titulo">${_esc(livro.title || 'Livro sem título')}${_seloVersao(livro)}</div>
                        ${livro.description ? `<div class="cnh-livro-desc">${_esc(livro.description)}</div>` : ''}
                        <div class="cnh-progresso">📖 ${liberadosNoLivro} de ${visiveisNoLivro} capítulos desbloqueados</div>
                    </div>
                </summary>
                <div class="cnh-capitulos">${linhas.join('')}</div>
            </details>`);
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

/* Quem fecha o modal de detalhes é o detail-modal.js, e ele não sabe que
   existe trilha. Em vez de ir mexer lá — e acoplar dois módulos por causa
   de um `pause()` — a leitura observa a própria classe do modal: voltou o
   `hidden`, a música para. Registrado uma vez só. */
let _obsModal = null;
function _cortarMusicaAoFechar(modal) {
    if (_obsModal) return;
    _obsModal = new MutationObserver(() => { if (modal.classList.contains('hidden')) pararMusica(); });
    _obsModal.observe(modal, { attributes: true, attributeFilter: ['class'] });
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
            ${livro ? `<div class="cnh-leitura-livro">📗 ${_esc(livro.title || '')}${_seloVersao(livro)}</div>` : ''}
            <h2 class="cnh-leitura-titulo">${_esc(cap.title || 'Sem título')}</h2>
            ${cap.synopsis ? `<p class="cnh-leitura-syn">${_esc(cap.synopsis)}</p>` : ''}
            <div class="cnh-leitura-corpo texto-mundo">${cap.contentHTML || '<p><em>Capítulo ainda sem conteúdo.</em></p>'}</div>
        </div>`;
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    /* Depois de pintar: o texto ja esta na tela com a RESERVA de cada campo
       vinculado, e o valor fresco entra por cima quando chegar. Ninguem
       espera rede para comecar a ler. */
    resolverCampos(body, _carregarCampos);
    montarMusica(body.querySelector('.cnh-leitura'), cap);
    _cortarMusicaAoFechar(modal);
};
