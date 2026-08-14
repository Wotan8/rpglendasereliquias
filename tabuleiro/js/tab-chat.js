// =============================================
// TABULEIRO — 💬 Chat da mesa + diário de acontecimentos (POR CANVAS)
// Fonte: mesas/{id}/tabuleiros/{canvasId}/chat/{msgId} — 1 doc por mensagem,
// 1 write por ação de quem AGIU (os outros recebem pelo snapshot). Trocar de
// canvas troca o chat junto (o listener re-assina em sincChatDoCanvas).
// Boot lê só as últimas 80 mensagens; o resto fica no banco sem custar read.
//
// Dois tipos de linha:
//   fala — mensagem digitada, com a identidade escolhida (conta ou personagem)
//   log  — acontecimento curto (rolagem, movimento, item, condição, rodada),
//          escrito pelo cliente de quem fez a ação via logChat()/logMovimento()
// =============================================
import { db, collection, addDoc, onSnapshot, query, orderBy, limit } from '../../painel-mestre/js/firebase-config.js';
import { T, esc, pxParaUnidades, fmtDist } from './tab-state.js';

const MAX_MSGS = 80;
const CHAVE_IDENT = 'tb_chat_ident';
const CHAVE_JANELA = 'tb_chat_janela';   // { l, t, w, h, transp }

let mensagens = [];      // mais antiga primeiro, no máximo MAX_MSGS
let unsubChat = null;
let el = null;           // a janela
let aberto = false;
let naoLidas = 0;

const refChat = () => collection(db, 'mesas', T.mesaId, 'tabuleiros', T.canvasId, 'chat');
const nomeConta = () => T.isMaster ? 'Mestre' : (T.usersMap[T.user?.uid]?.nome || 'Jogador');

// ---------- identidade (conta ou personagem) ----------
function opcoesIdentidade() {
    const meus = T.chars.filter(c => c.ownerUid === T.user?.uid).map(c => c.nome);
    return [nomeConta(), ...meus];
}
function identidade() {
    const salvo = localStorage.getItem(CHAVE_IDENT);
    return opcoesIdentidade().includes(salvo) ? salvo : nomeConta();
}

// ---------- API: registrar acontecimento (só o cliente de quem AGIU chama) ----------
export function logChat(texto) {
    if (!T.mesaId || !T.canvasId || !texto) return;
    addDoc(refChat(), { t: Date.now(), uid: T.user?.uid || null, nome: nomeConta(), tipo: 'log', texto })
        .catch(e => console.warn('chat log', e));
}

// Movimento tem debounce por token (mesmo 1,5s dos "soltos"): segurar a seta
// vira UMA linha com a distância total, não uma linha por célula.
const movPend = new Map();   // tokenId -> { origem, timer }
export function logMovimento(o, origem) {
    const pend = movPend.get(o.id);
    if (pend) clearTimeout(pend.timer);
    const origem0 = pend ? pend.origem : { ...origem };
    movPend.set(o.id, {
        origem: origem0,
        timer: setTimeout(() => {
            movPend.delete(o.id);
            const atual = T.objects.get(o.id); if (!atual) return;
            const px = Math.hypot((atual.x || 0) - origem0.x, (atual.y || 0) - origem0.y);
            if (px < 1) return;   // voltou para onde estava
            logChat(`👣 ${atual.nome || 'Token'} moveu ${fmtDist(pxParaUnidades(px, atual))}`);
        }, 1500),
    });
}

// ---------- boot / troca de canvas ----------
export function initChat() {
    montarJanela();
    const btn = document.getElementById('btnChat');
    if (btn) btn.onclick = () => toggleChat();
}

/** Chamado pelo trocarCanvas: cada canvas tem o próprio chat. */
export function sincChatDoCanvas() {
    if (unsubChat) { unsubChat(); unsubChat = null; }
    mensagens = [];
    render();
    if (!T.canvasId) return;
    unsubChat = onSnapshot(query(refChat(), orderBy('t', 'desc'), limit(MAX_MSGS)), s => {
        let novas = 0;
        s.docChanges().forEach(ch => {
            if (ch.type === 'removed') { mensagens = mensagens.filter(m => m.id !== ch.doc.id); return; }
            if (mensagens.some(m => m.id === ch.doc.id)) return;
            mensagens.push({ id: ch.doc.id, ...ch.doc.data() });
            novas++;
        });
        if (!novas && !s.docChanges().length) return;
        mensagens.sort((a, b) => (a.t || 0) - (b.t || 0));
        if (mensagens.length > MAX_MSGS) mensagens = mensagens.slice(-MAX_MSGS);
        // badge: só o que chegou de OUTRO cliente com a janela fechada
        const deOutros = s.docChanges().some(ch => ch.type === 'added' && ch.doc.data().uid !== T.user?.uid);
        if (!aberto && deOutros) { naoLidas = Math.min(99, naoLidas + novas); atualizarBadge(); }
        render();
    }, e => console.warn('chat', e));
    T.unsubs.push(() => { if (unsubChat) unsubChat(); });
}

// ---------- janela ----------
function cfgJanela() { try { return JSON.parse(localStorage.getItem(CHAVE_JANELA)) || {}; } catch (e) { return {}; } }
function salvarJanela(patch) {
    localStorage.setItem(CHAVE_JANELA, JSON.stringify({ ...cfgJanela(), ...patch }));
}

/**
 * Segura a janela inteira dentro da tela. A posição é salva POR APARELHO, mas o
 * mesmo aparelho gira e o mesmo login abre no celular depois do PC: sem isto, a
 * janela reabria em `left: 900` numa tela de 375 e o chat "não abria" — estava
 * aberto, fora do viewport. Mesma rede de segurança da janela de ficha.
 */
function clampJanela() {
    if (!el?.isConnected) return;
    if (el.offsetWidth > window.innerWidth - 8) el.style.width = Math.max(240, window.innerWidth - 8) + 'px';
    if (el.offsetHeight > window.innerHeight - 8) el.style.height = Math.max(180, window.innerHeight - 8) + 'px';
    // sem `left` explícito a janela está no canto padrão do CSS — não mexer
    if (el.style.left) {
        el.style.left = Math.max(0, Math.min(el.offsetLeft, window.innerWidth - el.offsetWidth)) + 'px';
        el.style.top = Math.max(0, Math.min(el.offsetTop, window.innerHeight - Math.min(el.offsetHeight, 48))) + 'px';
    }
}

function montarJanela() {
    el = document.createElement('div');
    el.className = 'tb-window tb-chat';
    el.id = 'tbChatWin';
    el.innerHTML = `
        <div class="tb-win-head" id="tbChatHead">
            <span>💬 Chat</span>
            <span style="display:flex;gap:4px">
                <button class="tb-mini-btn" id="tbChatTransp" title="Alternar fundo (padrão / transparente)">🫧</button>
                <button class="tb-mini-btn" onclick="tbToggleChat()" title="Fechar">✕</button>
            </span>
        </div>
        <div class="tb-win-body tb-chat-lista" id="tbChatLista"></div>
        <div class="tb-chat-input">
            <select id="tbChatIdent" title="Falar como conta ou personagem"></select>
            <input type="text" id="tbChatTexto" maxlength="400" placeholder="Mensagem…" autocomplete="off">
            <button class="tb-mini-btn" id="tbChatEnviar" title="Enviar (Enter)">➤</button>
        </div>`;
    document.body.appendChild(el);

    // posição/tamanho/fundo salvos por aparelho
    const c = cfgJanela();
    if (c.l != null) { el.style.left = c.l + 'px'; el.style.top = c.t + 'px'; el.style.right = 'auto'; }
    if (c.w) { el.style.width = c.w + 'px'; el.style.height = c.h + 'px'; }
    if (c.transp) el.classList.add('transp');

    // arrastar pelo cabeçalho (mesmo padrão da janela de Combate)
    const head = el.querySelector('#tbChatHead');
    let drag = null;
    head.addEventListener('pointerdown', e => {
        if (e.target.closest('button')) return;
        drag = { x: e.clientX, y: e.clientY, l: el.offsetLeft, t: el.offsetTop };
        head.setPointerCapture(e.pointerId);
    });
    head.addEventListener('pointermove', e => {
        if (!drag) return;
        el.style.left = Math.max(0, Math.min(drag.l + e.clientX - drag.x, window.innerWidth - 80)) + 'px';
        el.style.top = Math.max(0, Math.min(drag.t + e.clientY - drag.y, window.innerHeight - 48)) + 'px';
        el.style.right = 'auto';
    });
    head.addEventListener('pointerup', () => {
        if (drag) salvarJanela({ l: el.offsetLeft, t: el.offsetTop });
        drag = null;
    });

    // tamanho: resize nativo do navegador; grava com folga
    let timerRO = null;
    new ResizeObserver(() => {
        if (!aberto) return;
        clearTimeout(timerRO);
        timerRO = setTimeout(() => salvarJanela({ w: el.offsetWidth, h: el.offsetHeight }), 400);
    }).observe(el);

    el.querySelector('#tbChatTransp').onclick = () => {
        el.classList.toggle('transp');
        salvarJanela({ transp: el.classList.contains('transp') });
    };
    el.querySelector('#tbChatEnviar').onclick = enviar;
    el.querySelector('#tbChatTexto').addEventListener('keydown', e => { if (e.key === 'Enter') enviar(); });
    el.querySelector('#tbChatIdent').addEventListener('change', e => localStorage.setItem(CHAVE_IDENT, e.target.value));
}

function toggleChat() {
    aberto = !aberto;
    el.classList.toggle('open', aberto);
    if (aberto) {
        naoLidas = 0; atualizarBadge();
        preencherIdentidades();
        render();
        clampJanela();   // só dá para medir depois de `open` (antes é display:none)
        el.querySelector('#tbChatTexto').focus();
    }
}
window.tbToggleChat = toggleChat;
// girar o celular também pode jogar a janela para fora
window.addEventListener('resize', () => { if (aberto) clampJanela(); });

function atualizarBadge() {
    const b = document.getElementById('tbChatBadge');
    if (!b) return;
    b.style.display = naoLidas ? '' : 'none';
    b.textContent = naoLidas;
}

function preencherIdentidades() {
    const sel = el.querySelector('#tbChatIdent');
    const atual = identidade();
    sel.innerHTML = opcoesIdentidade().map(n => `<option ${n === atual ? 'selected' : ''}>${esc(n)}</option>`).join('');
}

async function enviar() {
    const inp = el.querySelector('#tbChatTexto');
    const texto = inp.value.trim();
    if (!texto || !T.canvasId) return;
    inp.value = '';
    try {
        await addDoc(refChat(), {
            t: Date.now(), uid: T.user?.uid || null,
            nome: el.querySelector('#tbChatIdent')?.value || identidade(),
            tipo: 'fala', texto,
        });
    } catch (e) { console.error(e); inp.value = texto; }
}

const hora = (t) => new Date(t || 0).toLocaleTimeString().slice(0, 5);

function render() {
    const lista = el?.querySelector('#tbChatLista');
    if (!lista || !aberto) return;
    const noFim = lista.scrollHeight - lista.scrollTop - lista.clientHeight < 40;
    lista.innerHTML = mensagens.map(m => m.tipo === 'log'
        ? `<div class="tb-chat-log" title="${esc(m.nome || '')} · ${hora(m.t)}">${esc(m.texto)}</div>`
        : `<div class="tb-chat-msg"><span class="tb-chat-hora">${hora(m.t)}</span> <b>${esc(m.nome || '?')}</b>: ${esc(m.texto)}</div>`
    ).join('') || '<div class="tb-muted" style="text-align:center;padding:12px">Nenhuma mensagem neste canvas ainda.</div>';
    if (noFim) lista.scrollTop = lista.scrollHeight;
}
