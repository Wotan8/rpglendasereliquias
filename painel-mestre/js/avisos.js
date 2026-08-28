// =============================================
// AVISOS DO MESTRE
// O sistema sempre soube avisar o jogador; não tinha caminho de volta. Esta é
// a caixa de entrada do mestre: uma fila em `avisos_mestre`, escrita só pelo
// servidor, que o painel escuta em tempo real.
//
// Fica na barra do topo, e não numa aba, porque aviso não pertence a área
// nenhuma — chega de qualquer canto do sistema.
// =============================================

import { db, collection, query, where, orderBy, onSnapshot, doc, updateDoc, getDocs, functions, httpsCallable } from './firebase-config.js';
import { escapeHtml, showAlert } from './ui-utils.js';
import { confirmar } from '../../shared/dialogo.js?v=2';
import * as S from './state.js';

let avisos = [];
let janela = null;
let parar = null;   // encerra o onSnapshot

const QUANDO = (ts) => {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

const ICONE = {
    'personagem-entregue': '📜',
    'item-para-mesa': '🎁',
    geral: '📣',
};

/** Liga a escuta. Chamada uma vez, quando o painel confirma que é mestre. */
export function iniciarAvisos() {
    if (parar) return;
    // Sem orderBy no servidor: `criadoEm` só existe depois que o servidor
    // resolve o timestamp, e um aviso recém-criado ficaria de fora do índice
    // por um instante. A ordenação é feita aqui, que é barato para uma fila.
    const q = query(collection(db, 'avisos_mestre'), where('status', '==', 'novo'));
    parar = onSnapshot(q, (snap) => {
        avisos = snap.docs.map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (b.criadoEm?.seconds || 0) - (a.criadoEm?.seconds || 0));
        pintarBadge();
        if (janela?.open) pintarLista();
    }, (e) => {
        // Sem permissão ou sem rede: o painel segue funcionando sem a caixa.
        console.warn('avisos do mestre indisponíveis:', e.message);
    });
}

function pintarBadge() {
    const badge = document.getElementById('avisosBadge');
    if (!badge) return;
    badge.textContent = avisos.length;
    badge.hidden = avisos.length === 0;
}

function pintarLista() {
    const lista = document.getElementById('avisosLista');
    if (!lista) return;

    const conta = document.getElementById('avisosConta');
    if (conta) conta.textContent = avisos.length ? String(avisos.length) : '';
    const lerTudo = document.getElementById('btnLerTudo');
    if (lerTudo) lerTudo.hidden = avisos.length === 0;

    if (avisos.length === 0) {
        lista.innerHTML = `<div class="avisos-vazio">Nada esperando por você.<br>
            Quando um jogador entregar um personagem ou mandar algo para a mesa, aparece aqui.</div>`;
        return;
    }

    lista.innerHTML = avisos.map(a => {
        const msg = String(a.mensagem || '');
        // Ficha de item colada pelo jogador passa fácil de mil caracteres: o
        // cartão mostra o começo e abre o resto no clique (o corte é do CSS).
        const comprida = msg.length > 220;
        return `
        <div class="aviso" data-id="${escapeHtml(a.id)}">
            <div class="aviso-icone">${ICONE[a.tipo] || ICONE.geral}</div>
            <div class="aviso-corpo">
                <div class="aviso-titulo">${escapeHtml(a.titulo || 'Aviso')}</div>
                <div class="aviso-msg">${escapeHtml(msg)}</div>
                ${comprida ? `<button type="button" class="aviso-mais" onclick="avisoVerTudo(this)">Ver tudo</button>` : ''}
                <div class="aviso-pe">
                    ${a.jogador ? `<span>👤 ${escapeHtml(a.jogador)}</span>` : ''}
                    ${a.criadoEm ? `<span>🕐 ${QUANDO(a.criadoEm)}</span>` : ''}
                </div>
            </div>
            <div class="aviso-bts">
                ${a.referencia?.colecao === 'npcs'
            ? `<button class="btn btn-primary btn-small" onclick="avisoIrParaNpc('${escapeHtml(a.referencia.id)}')">Ver NPC</button>`
            : ''}
                <button class="btn btn-secondary btn-small" onclick="avisoMarcarLido('${escapeHtml(a.id)}')">✓ Resolvido</button>
                ${a.tipo === 'item-para-mesa'
            ? `<button class="btn btn-danger btn-small" onclick="avisoRecusarItem('${escapeHtml(a.id)}')">Recusar</button>`
            : ''}
            </div>
        </div>`;
    }).join('');
}

/** Abre a mensagem cortada. O botão vira "Ver menos" e fecha de volta. */
window.avisoVerTudo = function (bt) {
    const cartao = bt.closest('.aviso'); if (!cartao) return;
    const aberto = cartao.classList.toggle('aberto');
    bt.textContent = aberto ? 'Ver menos' : 'Ver tudo';
};

function montarJanela() {
    janela = document.createElement('dialog');
    janela.className = 'lr-avisos';
    janela.innerHTML = `
        <div class="avisos-topo">
            <span class="avisos-titulo">📣 Avisos dos jogadores <span class="avisos-conta" id="avisosConta"></span></span>
            <div class="avisos-acoes">
                <button class="avisos-icone" id="btnLerTudo" onclick="avisoMarcarTudo()"
                    title="Marcar todos como resolvidos" aria-label="Marcar todos como resolvidos">
                    <svg class="lr-ico"><use href="#i-check"/></svg></button>
                <button class="avisos-icone" onclick="this.closest('dialog').close()"
                    title="Fechar" aria-label="Fechar">
                    <svg class="lr-ico"><use href="#i-fechar"/></svg></button>
            </div>
        </div>
        <div class="avisos-lista" id="avisosLista"></div>`;
    document.body.appendChild(janela);
    janela.addEventListener('click', e => { if (e.target === janela) janela.close(); });
}

window.abrirAvisos = function () {
    if (!janela) montarJanela();
    pintarLista();
    janela.showModal();
};

window.avisoMarcarLido = async function (id) {
    try {
        await updateDoc(doc(db, 'avisos_mestre', id), {
            status: 'lido',
            lidoEm: new Date().toISOString(),
            lidoPor: S.currentUser?.email || '',
        });
        // O onSnapshot tira da lista sozinho (a consulta é por status === novo).
    } catch (e) {
        console.error('erro ao marcar aviso:', e);
        showAlert('❌ Não foi possível marcar o aviso.', 'danger');
    }
};

/* Recusar um envio de item: a peça sai da Caixa e volta ao Repertório do
   jogador, que é avisado. Tudo no servidor, numa gravação só — daqui a gente
   só pede e mostra o resultado. */
window.avisoRecusarItem = async function (id) {
    const aviso = avisos.find(a => a.id === id);
    const oQue = aviso?.referencia?.nome || 'a peça';
    if (!await confirmar(
        `Recusar ${oQue}? Ela volta para o Repertório de ${aviso?.jogador || 'quem mandou'}, que será avisado.`,
        { ok: 'Recusar e devolver' })) return;

    try {
        const recusar = httpsCallable(functions, 'recusarItemDaMesa');
        const r = (await recusar({ avisoId: id })).data;
        showAlert(`↩️ ${r.quantidade}x ${r.nome} devolvido(s) para ${r.jogador || 'o jogador'}.`, 'success');
        // O onSnapshot tira o aviso da lista sozinho (status deixou de ser 'novo').
    } catch (e) {
        console.error('erro ao recusar item:', e);
        showAlert('❌ ' + e.message, 'danger');
    }
};

window.avisoMarcarTudo = async function () {
    const pendentes = [...avisos];
    if (!pendentes.length) return;
    for (const a of pendentes) await window.avisoMarcarLido(a.id);
    showAlert(`✅ ${pendentes.length} aviso(s) resolvidos.`, 'success');
};

/** Leva o mestre até o NPC que o aviso cita, já com a busca preenchida. */
window.avisoIrParaNpc = async function (npcId) {
    janela?.close();
    if (typeof window.switchTab === 'function') await window.switchTab('npcs');
    // O painel de NPCs filtra por texto; achar o nome é o caminho mais curto
    // que não depende de API interna dele.
    try {
        const alvo = avisos.find(a => a.referencia?.id === npcId);
        const campo = document.getElementById('npcSearchInput');
        if (campo && alvo?.referencia?.nome) {
            campo.value = alvo.referencia.nome;
            campo.dispatchEvent(new Event('input', { bubbles: true }));
        }
    } catch (e) { /* a aba abriu, que é o essencial */ }
};

/** Usada pelo e2e e por quem quiser conferir a fila sem abrir a janela. */
export async function contarAvisos() {
    const snap = await getDocs(query(collection(db, 'avisos_mestre'), where('status', '==', 'novo')));
    return snap.size;
}
