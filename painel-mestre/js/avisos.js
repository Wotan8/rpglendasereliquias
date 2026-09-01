// =============================================
// AVISOS DO MESTRE
// O sistema sempre soube avisar o jogador; não tinha caminho de volta. Esta é
// a caixa de entrada do mestre: uma fila em `avisos_mestre`, escrita só pelo
// servidor, que o painel escuta em tempo real.
//
// Fica DENTRO da mesa: todo aviso nasce de uma, porque é o jogador quem
// escolhe para qual mesa manda a peça ou entrega o personagem. O botão só
// aparece na mesa que tem algo esperando — a fila é global, o que se vê é o
// pedaço dela que é daquela mesa.
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
    // Dinheiro que voltou, e cobrança que não bateu: os dois vêm do webhook do
    // Mercado Pago e ninguém mais os cria. Sem ícone próprio caíam no 📣 e se
    // perdiam no meio da fila.
    'estorno': '💸',
    'valor-divergente': '⚠️',
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

/**
 * Os avisos que a mesa aberta tem de resolver.
 *
 * Sem mesa aberta, nenhum — o botão vive dentro da mesa.
 *
 * Aviso com `mesaId` vazio entra em todas: são os que o servidor gravou sem
 * mesa (personagem entregue por uma ficha que não estava vinculada). Deixá-los
 * fora de todas as mesas os tornaria invisíveis, e ninguém resolveria.
 */
function avisosDaMesa() {
    const mesa = S.currentMesaId;
    if (!mesa) return [];
    return avisos.filter(a => a.mesaId === mesa || !a.mesaId);
}

function pintarBadge() {
    const daMesa = avisosDaMesa();
    const bt = document.getElementById('btnAvisos');
    if (bt) bt.hidden = daMesa.length === 0;
    const badge = document.getElementById('avisosBadge');
    if (!badge) return;
    badge.textContent = daMesa.length;
    badge.hidden = daMesa.length === 0;
}

/** Chamada quando a mesa aberta muda: o botão e a janela seguem a mesa. */
export function avisosTrocouDeMesa() {
    pintarBadge();
    if (!S.currentMesaId) janela?.close();
    else if (janela?.open) pintarLista();
}
window.avisosTrocouDeMesa = avisosTrocouDeMesa;

/**
 * A mensagem de "item para a mesa" é duas coisas coladas: o aviso que o
 * SERVIDOR escreve ("A peça saiu do Repertório de X...") e, depois de ` — "`,
 * a descrição que o JOGADOR escreveu, entre aspas.
 *
 * Vale separar porque as duas se leem diferente: a primeira é recado curto, a
 * segunda é a ficha do item, com as quebras de linha que o jogador digitou no
 * textarea — e que o HTML engolia, virando o paredão de texto.
 */
function separarMensagem(msg) {
    const s = String(msg || '').trim();
    const corte = s.lastIndexOf(' — "');
    if (corte < 0 || !s.endsWith('"')) return { aviso: s, item: '' };
    return { aviso: s.slice(0, corte).trim(), item: s.slice(corte + 4, -1).trim() };
}

/**
 * O título vem pronto do servidor ("Igor mandou 1x Influência para a mesa"),
 * mas o aviso carrega `referencia.nome` à parte — dá para achar o nome dentro
 * da frase e doura-lo. É o que o Mestre procura na lista: o QUE chegou.
 *
 * Casa só em fronteira de palavra: item chamado "Pá" não pode acender o "pa"
 * de "para". Sem casamento limpo, o título sai inteiro como está.
 */
function tituloComNome(titulo, nome) {
    const t = String(titulo || 'Aviso');
    const n = String(nome || '').trim();
    if (!n) return escapeHtml(t);

    const solto = (c) => c === undefined || !/[\p{L}\p{N}]/u.test(c);
    let i = t.indexOf(n), de = 0;
    while (i >= 0 && !(solto(t[i - 1]) && solto(t[i + n.length]))) {
        de = i + 1;
        i = t.indexOf(n, de);
    }
    if (i < 0) return escapeHtml(t);

    return escapeHtml(t.slice(0, i))
        + `<span class="aviso-titulo-nome">${escapeHtml(n)}</span>`
        + escapeHtml(t.slice(i + n.length));
}

/** O texto do item, com a primeira linha (o nome) em destaque. */
function blocoDoItem(texto) {
    if (!texto) return '';
    const linhas = texto.split(/\r?\n/);
    const primeira = linhas[0].trim();
    // Primeira linha curta é o nome do item. Se o jogador colou tudo num
    // paragrafo só, não há nome para destacar — dourar o paredão inteiro seria
    // pior que não dourar nada.
    const temNome = linhas.length > 1 && primeira.length <= 120;
    const resto = temNome ? linhas.slice(1).join('\n').replace(/^\s*\n/, '') : texto;
    return `<div class="aviso-item">
                ${temNome ? `<div class="aviso-item-nome">${escapeHtml(primeira)}</div>` : ''}
                <div class="aviso-item-corpo">${escapeHtml(resto)}</div>
            </div>`;
}

function pintarLista() {
    const lista = document.getElementById('avisosLista');
    if (!lista) return;

    const daMesa = avisosDaMesa();

    const conta = document.getElementById('avisosConta');
    if (conta) conta.textContent = daMesa.length ? String(daMesa.length) : '';
    const lerTudo = document.getElementById('btnLerTudo');
    if (lerTudo) lerTudo.hidden = daMesa.length === 0;
    const mesa = document.getElementById('avisosMesa');
    if (mesa) mesa.textContent = S.currentMesaData?.nome || '';

    if (daMesa.length === 0) {
        lista.innerHTML = `<div class="avisos-vazio">Nada esperando por você nesta mesa.<br>
            Quando um jogador entregar um personagem ou mandar algo para cá, aparece aqui.</div>`;
        return;
    }

    lista.innerHTML = daMesa.map(a => {
        const { aviso, item } = separarMensagem(a.mensagem);
        // Ficha de item colada pelo jogador passa fácil de mil caracteres: o
        // cartão mostra o começo e abre o resto no clique (o corte é do CSS).
        const comprida = item.length > 260;
        return `
        <div class="aviso" data-id="${escapeHtml(a.id)}">
            <div class="aviso-icone">${ICONE[a.tipo] || ICONE.geral}</div>
            <div class="aviso-corpo">
                <div class="aviso-titulo">${tituloComNome(a.titulo, a.referencia?.nome)}</div>
                <div class="aviso-msg">${escapeHtml(aviso)}</div>
                ${blocoDoItem(item)}
                ${comprida ? `<button type="button" class="aviso-mais" onclick="avisoVerTudo(this)">Ver tudo</button>` : ''}
                <div class="aviso-pe">
                    ${a.jogador ? `<span>👤 ${escapeHtml(a.jogador)}</span>` : ''}
                    ${a.criadoEm ? `<span>🕐 ${QUANDO(a.criadoEm)}</span>` : ''}
                    ${!a.mesaId ? `<span class="aviso-semmesa" title="O servidor gravou este aviso sem mesa — ele aparece em todas até alguém resolver">⚠️ sem mesa</span>` : ''}
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
    janela.className = 'lr-caixa-avisos';
    janela.innerHTML = `
        <div class="avisos-topo">
            <span class="avisos-titulo">📣 Avisos dos jogadores <span class="avisos-conta" id="avisosConta"></span>
                <span class="avisos-mesa" id="avisosMesa"></span></span>
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
    if (!S.currentMesaId) return;   // a caixa é da mesa aberta
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
    // Só os desta mesa: "marcar tudo" nunca limpa a fila de outra.
    const pendentes = avisosDaMesa();
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
