// =============================================
// AREA MESAS — Inventário Geral + Caixa do Mestre + Personagens
// =============================================
import { db, collection, getDocs, doc, getDoc, setDoc, deleteDoc, updateDoc, query, where, onSnapshot, writeBatch, increment } from './firebase-config.js';
import * as S from './state.js';
import { showAlert, escapeHtml } from './ui-utils.js';
// Os construtores de seletor do Criador (mecanicas, VDs com Equacao de Valor,
// status vitais, atributos, pericias, condicoes): o formulario de item da mesa
// mostra exatamente os mesmos controles do cadastro de Equipamento.
import * as SEL from '../../painel-criador/js/painel-mechanics.js';
import {
    camposDaInstancia, valorDoItem, coletarCampos, aplicarVisibilidade,
    instanciarDoModelo, modeloDaInstancia, htmlFormulario, htmlBarraFerramentas, ligarFormulario,
} from '../../shared/equip-campos.js?v=14';
import { ensureNpcSystemData } from './npc-system-data.js';
import {
    ESTADO_EQUIP, FORMA_EQUIP, qtdDe, ehContainer, escolherQtd, dividirPilha,
    pressaoItem, htmlInventario, tratarClique, iniciarArrasto, cabeNoConteiner, tplDoItem,
    desgastarConteiner, GATILHO,
} from '../../shared/inventario-motor.js?v=7';
import { patchRestauracao, textoConfirmacao, botaoRestaurarHTML, modeloDoItem } from '../../shared/restaurar-item.js?v=1';
import { confirmar } from '../../shared/dialogo.js?v=1';


const _catalogoMestre = () => (window._systemData?.equipment || window._mestreCatalog || [])
    .filter(t => t.publicado !== false);

window._loadMesaInventarios = loadMesaInventarios;
window._loadPersonagensInventario = loadPersonagensInventario;

/* ===== TEMPO REAL =====
   O jogador mexe no inventario pela ficha e o painel do Mestre repinta sozinho.
   A escuta cobre os donos DESTA mesa (personagens + Caixa do Mestre) e o que
   ela entrega vira o cache que as listas leem — sem isso cada repintura
   relia a colecao `items` inteira. */
let _unsubItens = null;
let _ouvindoMesa = null;
let _itensCache = null;

async function _ouvirItensDaMesa() {
    if (_ouvindoMesa === S.currentMesaId) return;
    pararDeOuvirItens();
    const mesaId = S.currentMesaId;
    if (!mesaId) return;
    const chars = await _fetchMesaCharacters();
    // `in` do Firestore aceita 30 valores; mesa maior que isso cai no fetch cheio.
    const donos = [_getCaixaMestreId(mesaId), ...chars.map(c => c.id)].filter(Boolean);
    if (!donos.length || donos.length > 30) return;

    _ouvindoMesa = mesaId;
    let primeira = true;
    _unsubItens = onSnapshot(
        query(collection(db, 'items'), where('characterId', 'in', donos)),
        snap => {
            _itensCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            // A primeira entrega e o que os loaders acabaram de pintar; repintar
            // aqui so duplicaria o trabalho.
            if (primeira) { primeira = false; return; }
            _repintarInventarios();
        },
        e => { console.warn('items/onSnapshot', e); _ouvindoMesa = null; }
    );
}

/** Solta a escuta ao fechar a mesa (chamada por closeMesa). */
export function pararDeOuvirItens() {
    if (_unsubItens) { try { _unsubItens(); } catch (e) { /* ja solto */ } }
    _unsubItens = null; _ouvindoMesa = null; _itensCache = null;
    _estadoInv.clear(); _accAbertos.clear(); _donos.clear();
}
window._pararDeOuvirItens = pararDeOuvirItens;

/** Repinta as duas listas de inventario que podem estar na tela. */
function _repintarInventarios() {
    loadMesaInventarios();
    if (document.getElementById('mesaCharactersInventoryContainer')?.style.display !== 'none') {
        loadPersonagensInventario();
    }
}

function _getCaixaMestreId(mesaId) {
    return '__caixa_mestre__' + mesaId;
}

async function loadMesaInventarios() {
    if (!S.currentMesaId) return;
    const el = document.getElementById('mesaInventarioContent'); 
    if (!el) return;
    _ouvirItensDaMesa();
    try {
        const allItems = await _fetchAllItems();
        const caixaId = _getCaixaMestreId(S.currentMesaId);
        const caixaItems = allItems.filter(it => it.characterId === caixaId);

        el.innerHTML = _buildCaixaDoMestreHTML(caixaItems);
        _pintarHosts(el, allItems);
    } catch (e) { console.error(e); showAlert('❌ Erro ao carregar inventários', 'danger'); }
}

async function loadPersonagensInventario() {
    if (!S.currentMesaId) return;
    const el = document.getElementById('mesaCharactersInventoryContainer'); 
    if (!el) return;
    _ouvirItensDaMesa();
    el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted)">Carregando inventários...</div>';
    try {
        const chars = await _fetchMesaCharacters();
        const allItems = await _fetchAllItems();
        
        const caixaId = _getCaixaMestreId(S.currentMesaId);
        const caixaItems = allItems.filter(it => it.characterId === caixaId);

        let html = _buildCaixaDoMestreHTML(caixaItems);

        if (!chars.length) {
            html += '<div style="text-align:center;padding:30px;color:var(--muted)">Nenhum personagem nesta mesa</div>';
        } else {
            html += `<div style="margin-top: 20px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; padding-left:10px; border-left:4px solid var(--primary);">
                            <h3 style="color:var(--light); margin:0;">Inventário dos Personagens</h3>
                            <button onclick="_transferAllLooseItems()" style="background:rgba(6,182,212,.15);border:1px solid rgba(6,182,212,.35);color:var(--lr-arcane);padding:4px 10px;border-radius:6px;cursor:pointer;font-size:.78rem;font-weight:700;transition:all .2s">Pegar Itens Soltos</button>
                        </div>
                        <div class="accordion-group">`;
            for (const c of chars) {
                const charItems = allItems.filter(it => it.characterId === c.id);
                html += _buildCharacterInventoryAccordionHTML(c, charItems);
            }
            html += `</div></div>`;
        }

        el.innerHTML = html;
        _pintarHosts(el, allItems, chars);
    } catch (e) { console.error(e); showAlert('❌ Erro ao carregar inventários', 'danger'); }
}

async function _fetchMesaCharacters() {
    const chars = S.mesaCharacters || [];
    if (!chars.length) {
        const snap = await getDocs(query(collection(db, 'char'), where('mesaId', '==', S.currentMesaId)));
        snap.forEach(d => {
            const raw = d.data();
            const f = raw.fields || {};
            chars.push({ id: d.id, nome: f.nome || raw.nome || '', ownerUid: raw.ownerUid || '', ownerEmail: raw.ownerEmail || '', ...raw });
        });
        S.setMesaCharacters(chars);
    }
    return chars;
}

async function _fetchAllItems() {
    if (_itensCache) return _itensCache;
    const itemsSnap = await getDocs(collection(db, 'items'));
    const allItems = []; itemsSnap.forEach(d => allItems.push({ id: d.id, ...d.data() }));
    return allItems;
}

/* ===================================================================
   LISTAS — motor de inventário compartilhado
   O MESMO motor da Ficha de Combate do Tabuleiro e da Ficha de NPC
   (shared/inventario-motor.js): arrasta pela alça ⠿ para equipar, tirar do
   corpo, guardar em contêiner ou juntar pilha igual. Cada dono (Caixa do
   Mestre e cada personagem) tem a sua instância, delimitada pelo próprio
   host — arrastar de um personagem para outro continua sendo o 🔄 Transferir.
   =================================================================== */

/** Estado de tela por dono: o que está expandido e quais contêineres abertos. */
const _estadoInv = new Map();
function _estadoDe(ownerId) {
    if (!_estadoInv.has(ownerId)) _estadoInv.set(ownerId, { abertos: new Set(), contAbertos: new Set() });
    return _estadoInv.get(ownerId);
}

/* Acordeões abertos sobrevivem à repintura — sem isto, cada atualização em
   tempo real fechava o inventário que o Mestre estava lendo. */
const _accAbertos = new Set();
window.toggleAccordion = function(elId) {
    const el = document.getElementById(elId);
    if (!el) return;
    const fechado = el.style.display === 'none';
    el.style.display = fechado ? 'block' : 'none';
    fechado ? _accAbertos.add(elId) : _accAbertos.delete(elId);
};

/** Partes do corpo do dono → slots equipáveis (mesma regra da ficha de NPC). */
function _slotsDoDono(partes) {
    const slots = {};
    (partes || []).forEach(bp => {
        const qty = Math.max(1, parseInt(bp.slots) || 1);
        for (let i = 0; i < qty; i++) {
            const key = qty > 1 ? `${bp.id}_${i + 1}` : bp.id;
            slots[key] = { label: qty > 1 ? `${bp.nome} ${i + 1}` : bp.nome, icon: bp.icone || '🦴', part: bp, partId: bp.id };
        }
    });
    return slots;
}

/** Itens e dono de cada host pintado agora — as ações leem daqui. */
const _donos = new Map();   // ownerId → { itens, char }

function _buildCaixaDoMestreHTML(caixaItems) {
    const caixaId = _getCaixaMestreId(S.currentMesaId);
    return `<div class="sessao-card" data-inv-dono="${escapeHtml(caixaId)}" style="margin-bottom:14px;border:2px solid rgba(245,158,11,.25)">
        <div class="sessao-card-header" style="background:linear-gradient(135deg,rgba(245,158,11,.08),rgba(245,158,11,.02))">
            <div class="sessao-titulo" style="color:var(--lr-gold)">📦 Caixa do Mestre</div>
            <div style="display:flex;gap:8px;align-items:center">
                <span class="sessao-data">${caixaItems.length} item(ns)</span>
                <button onclick="_openMestreItemFormModal('${S.currentMesaId}', null, '${caixaId}')" style="background:rgba(245,158,11,.15);border:1px solid rgba(245,158,11,.35);color:var(--lr-gold);padding:4px 10px;border-radius:6px;cursor:pointer;font-size:.78rem;font-weight:700;transition:all .2s">➕ Criar Item</button>
            </div>
        </div>
        <div style="padding:10px"><div data-inv-owner="${escapeHtml(caixaId)}"></div></div>
    </div>`;
}

function _buildCharacterInventoryAccordionHTML(char, charItems) {
    const cid = char.id;
    const bodyId = `acc_body_${cid}`;
    const aberto = _accAbertos.has(bodyId);
    const f = char.fields || {};
    const nomeReal = f.nome || char.nome || 'Sem nome';
    const equipped = charItems.filter(i => i.equipado && !i.parentItemId);
    const totalPressure = equipped.reduce((sum, it) => sum + pressaoItem(it, charItems), 0);

    return `
    <div class="accordion-item" data-inv-dono="${escapeHtml(cid)}" style="margin-bottom:8px; background:var(--lr-bg-1); border:1px solid var(--border); border-radius:8px;">
        <div class="accordion-header" style="padding:12px 16px; display:flex; justify-content:space-between; align-items:center; cursor:pointer;" onclick="toggleAccordion('${bodyId}')">
            <div style="font-weight:bold; color:var(--light);">🎭 ${escapeHtml(nomeReal)}</div>
            <div style="display:flex; gap:12px; align-items:center;">
                <span style="background:rgba(245,158,11,.15);color:var(--lr-gold);padding:3px 10px;border-radius:8px;font-size:.78rem;font-weight:700">⚖️ Pressão: ${totalPressure.toFixed(2)}</span>
                <span style="font-size:0.8rem; color:var(--muted);">${charItems.length} itens</span>
                <span style="color:var(--muted);">▼</span>
            </div>
        </div>
        <div class="accordion-body" id="${bodyId}" style="display:${aberto ? 'block' : 'none'}; padding:16px; border-top:1px solid var(--border);">
            <div style="margin-bottom:12px; display:flex; gap:8px; justify-content:flex-end;">
                <button class="btn btn-secondary btn-small" onclick="_transferCharacterLooseItems('${cid}')">Pegar Itens Soltos</button>
                <button class="btn btn-secondary btn-small" onclick="_openMestreItemFormModal('${S.currentMesaId}', null, '${cid}')">➕ Criar Item p/ Personagem</button>
            </div>
            <div data-inv-owner="${escapeHtml(cid)}"></div>
        </div>
    </div>`;
}

/** Pinta o motor em cada host `[data-inv-owner]` que acabou de entrar na tela.
 *  Exportado para __check-mesa-inventario.html (pintar a lista sem Firestore). */
export function _pintarHosts(raizEl, allItems, chars = []) {
    raizEl.querySelectorAll('[data-inv-owner]').forEach(host => {
        const ownerId = host.dataset.invOwner;
        const itens = allItems.filter(i => i.characterId === ownerId);
        const char = chars.find(c => c.id === ownerId) || null;
        _donos.set(ownerId, { itens, char });

        const st = _estadoDe(ownerId);
        const ctx = {
            raiz: host,
            itens,
            get sys() { return window._npcSys || window._systemData || null; },
            abertos: st.abertos,
            contAbertos: st.contAbertos,
            dica: 'arraste ⠿: equipar/desequipar entre seções · guardar em contêiner · juntar pilha igual · soltar no cartão de outro dono transfere',
            // Soltar fora desta lista: se caiu no cartão de OUTRO dono, transfere.
            // O cartão inteiro vale, então o acordeão nem precisa estar aberto.
            externo: (sob) => {
                const cartao = sob.closest?.('[data-inv-dono]');
                const para = cartao?.dataset.invDono;
                if (!para || para === ownerId) return null;
                return { tipo: 'externo', para, el: cartao };
            },
            rotuloSlot: (k) => _slotsDoDono(char?.partesDoCorpo)[k]?.label || k,
            botoes: (i) => `
                <button type="button" class="lr-inv-btn" title="Editar item" data-mesaitem="editar" data-id="${escapeHtml(i.id)}">✏️</button>
                <button type="button" class="lr-inv-btn" title="Transferir" data-mesaitem="transferir" data-id="${escapeHtml(i.id)}">🔄</button>
                <button type="button" class="lr-inv-btn perigo" title="Excluir" data-mesaitem="excluir" data-id="${escapeHtml(i.id)}">🗑️</button>`,
            repintar: _repintarInventarios,
            acoes: {
                equipar: (id) => _equiparMestre(ownerId, id),
                desequipar: (id) => _desequiparMestre(ownerId, id),
                mover: (id, alvo) => _moverItemMestre(ownerId, id, alvo),
                fundir: (id, alvoId) => _fundirPilhasMestre(ownerId, id, alvoId),
                qtd: (id, delta) => _setQtdMestre(ownerId, id, delta),
                externo: (id, alvo) => _transferirArrastando(ownerId, id, alvo.para),
            },
        };

        host.innerHTML = htmlInventario(ctx);
        // Propriedade e não addEventListener: o host é redesenhado a cada
        // repintura e listener acumulado dispararia a ação várias vezes.
        host.onclick = (e) => {
            const bt = e.target.closest('[data-mesaitem]');
            if (bt) {
                const { mesaitem, id } = bt.dataset;
                if (mesaitem === 'editar') window._openMestreItemFormModal(S.currentMesaId, id, ownerId);
                else if (mesaitem === 'transferir') window._openMestreTransferModal(id, S.currentMesaId);
                else if (mesaitem === 'excluir') window._deleteMestreItem(id);
                return;
            }
            tratarClique(ctx, e);
        };
        host.onpointerdown = (e) => {
            const grab = e.target.closest?.('[data-grab]');
            if (grab) iniciarArrasto(ctx, grab, e);
        };
    });
}

/* ---- Ações de arrasto (mesmas do Tabuleiro, com o log do painel) ---- */

const _itemDoDono = (ownerId, itemId) => (_donos.get(ownerId)?.itens || []).find(x => x.id === itemId);

function _logMesaItem(ownerId, acao, changes) {
    if (!window.addLog) return;
    window.addLog(S.currentUser?.email, acao, '', 'items', {
        charId: ownerId, mesaId: S.currentMesaId, category: 'Inventário', changes,
    });
}

/** ± na quantidade da pilha. */
async function _setQtdMestre(ownerId, itemId, delta) {
    const i = _itemDoDono(ownerId, itemId); if (!i) return;
    const q = Math.max(1, qtdDe(i) + delta);
    if (q === qtdDe(i)) return;
    try { await updateDoc(doc(db, 'items', itemId), { quantidade: q }); }
    catch (e) { console.error(e); showAlert('❌ Erro: ' + e.message, 'danger'); }
    _repintarInventarios();
}

/** Soltar sobre pilha idêntica: soma as quantidades e junta. */
async function _fundirPilhasMestre(ownerId, origemId, alvoId) {
    const a = _itemDoDono(ownerId, origemId);
    const b = _itemDoDono(ownerId, alvoId);
    if (!a || !b) return;
    const q = await escolherQtd(a, `Juntar quantos "${a.nome || 'item'}" nesta pilha?`);
    if (q == null) return;
    const plano = dividirPilha(a, q);
    const total = qtdDe(b) + plano.qtd;
    try {
        const lote = writeBatch(db);
        lote.update(doc(db, 'items', b.id), { quantidade: total });
        if (plano.move) lote.delete(doc(db, 'items', a.id));
        else lote.update(doc(db, 'items', a.id), { quantidade: plano.restante });
        await lote.commit();
        _logMesaItem(ownerId, `🧺 ${plano.qtd}× "${a.nome || 'Item'}" juntado na pilha`, [
            { label: 'Item', from: a.nome || origemId, to: b.nome || alvoId },
            { label: 'Quantidade', from: String(qtdDe(b)), to: String(total) },
        ]);
        _repintarInventarios();
    } catch (e) { console.error(e); showAlert('❌ Erro: ' + e.message, 'danger'); }
}

/** Soltar em contêiner ('cont:<id>') ou fora dele ('root'). */
async function _moverItemMestre(ownerId, itemId, alvo) {
    const i = _itemDoDono(ownerId, itemId); if (!i) return;

    if (alvo === 'root') {
        if (!i.parentItemId) return;
        try {
            await updateDoc(doc(db, 'items', itemId), { parentItemId: null });
            _logMesaItem(ownerId, `📤 Item "${i.nome || itemId}" tirado do contêiner`, [
                { label: 'Item', from: i.nome || itemId, to: i.nome || itemId },
                { label: 'Contêiner', from: 'dentro', to: '—' },
            ]);
            _repintarInventarios();
        } catch (e) { console.error(e); showAlert('❌ Erro: ' + e.message, 'danger'); }
        return;
    }

    const contId = alvo.slice(5);
    if (contId === itemId || i.parentItemId === contId) return;
    const c = _itemDoDono(ownerId, contId); if (!c) return;
    /* Capacidade trava, peso avisa — a régua é a do cadastro e mora no motor
       compartilhado, para a mesma bolsa não aceitar coisas diferentes em cada
       inventário. */
    const veredito = cabeNoConteiner(i, c, _donos.get(ownerId)?.itens, tplDoItem(c, window._npcSys || window._systemData || {}));
    if (!veredito.ok) { if (veredito.motivo) showAlert('📦 ' + veredito.motivo, 'warning'); return; }

    const q = await escolherQtd(i, `Mover quantos "${i.nome || 'item'}" para ${c.nome || 'o contêiner'}?`);
    if (q == null) return;
    const plano = dividirPilha(i, q);
    const dentro = { parentItemId: contId, equipado: false, estadoEquip: null, slotAnatomico: null, slotsOcupados: [] };
    try {
        if (plano.move) {
            await updateDoc(doc(db, 'items', itemId), dentro);
        } else {
            // divide a pilha: o original fica com o resto, o clone entra no contêiner
            const lote = writeBatch(db);
            lote.update(doc(db, 'items', itemId), { quantidade: plano.restante });
            const { id: _id, ...campos } = i;
            const novoId = 'item-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
            lote.set(doc(db, 'items', novoId), { ...campos, id: novoId, quantidade: plano.qtd, ...dentro });
            await lote.commit();
        }
        _estadoDe(ownerId).contAbertos.add(contId);
        await _desgastarPorConteudo(ownerId, c);
        _logMesaItem(ownerId, `📦 ${plano.qtd}× "${i.nome || 'Item'}" guardado em "${c.nome || 'contêiner'}"`, [
            { label: 'Item', from: i.nome || itemId, to: i.nome || itemId },
            { label: 'Contêiner', from: '—', to: c.nome || contId },
            { label: 'Quantidade', from: String(qtdDe(i)), to: String(plano.qtd) },
        ]);
        _repintarInventarios();
    } catch (e) { console.error(e); showAlert('❌ Erro: ' + e.message, 'danger'); }
}

/**
 * Soltou no cartão de outro dono: transfere. Pilha pergunta quanto vai —
 * o 🔄 Transferir continua existindo para destino fora da tela (outro NPC,
 * personagem de outra mesa).
 */
async function _transferirArrastando(deId, itemId, paraId) {
    const i = _itemDoDono(deId, itemId); if (!i) return;
    const destino = _donos.get(paraId);
    const nomeDestino = destino?.char
        ? (destino.char.fields?.nome || destino.char.nome || 'personagem')
        : 'Caixa do Mestre';

    const q = await escolherQtd(i, `Passar quantos "${i.nome || 'item'}" para ${nomeDestino}?`);
    if (q == null) return;
    const plano = dividirPilha(i, q);

    const ownerUid = destino?.char?.ownerUid || S.currentUser?.uid || '';
    const dono = {
        characterId: paraId,
        ownerType: paraId.startsWith('__caixa_mestre__') ? 'caixa' : 'char',
        ownerUid, ownerId: ownerUid,
        equipado: false, slotAnatomico: null, slotsOcupados: [], estadoEquip: null,
        parentItemId: null,
        lastModified: new Date().toISOString(),
    };

    try {
        const lote = writeBatch(db);
        if (plano.move) {
            lote.set(doc(db, 'items', itemId), dono, { merge: true });
            // Contêiner viaja com o que tem dentro — senão o conteúdo fica
            // pendurado no dono antigo, invisível e sem como recuperar.
            for (const filho of _filhosDe(deId, itemId)) {
                lote.set(doc(db, 'items', filho.id), { ...dono, parentItemId: itemId }, { merge: true });
            }
        } else {
            // Pilha dividida: o original fica com o resto, o clone é que viaja.
            lote.update(doc(db, 'items', itemId), { quantidade: plano.restante });
            const { id: _id, ...campos } = i;
            const novoId = 'item-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
            lote.set(doc(db, 'items', novoId), { ...campos, ...dono, id: novoId, quantidade: plano.qtd });
        }
        await lote.commit();

        const changes = [
            { label: 'Item', from: i.nome || itemId, to: i.nome || itemId },
            { label: 'Quantidade', from: String(qtdDe(i)), to: String(plano.qtd) },
            { label: 'Personagem (ID)', from: deId, to: paraId },
        ];
        _logMesaItem(paraId, `🔁 ${plano.qtd}× "${i.nome || 'Item'}" recebido (arrastado pelo Mestre)`, changes);
        _logMesaItem(deId, `🔁 ${plano.qtd}× "${i.nome || 'Item'}" saiu do inventário (arrastado pelo Mestre)`, changes);
        showAlert(`✅ ${plano.qtd}× "${i.nome || 'Item'}" para ${nomeDestino}`, 'success');
        _repintarInventarios();
    } catch (e) { console.error(e); showAlert('❌ Erro: ' + e.message, 'danger'); }
}

/** Itens guardados DENTRO de um contêiner, em qualquer profundidade. */
function _filhosDe(ownerId, contId) {
    const todos = _donos.get(ownerId)?.itens || [];
    const fila = [contId], saida = [];
    while (fila.length) {
        const pai = fila.pop();
        for (const x of todos) {
            if (x.parentItemId === pai && !saida.includes(x)) { saida.push(x); fila.push(x.id); }
        }
    }
    return saida;
}

/**
 * 🧱 Sobrecarga cobra Integridade quando o conteudo muda. So cobra de conteiner
 * que passou do teto cadastrado. Zerou, rompe: os filhos perdem o parentItemId
 * e reaparecem em Itens Soltos. Nada e apagado.
 */
async function _desgastarPorConteudo(ownerId, cont) {
    const itens = _donos.get(ownerId)?.itens || [];
    const tpl = tplDoItem(cont, window._npcSys || window._systemData || {});
    const r = desgastarConteiner(cont, itens, tpl, GATILHO.conteudo);
    if (!r.perda) return;
    try {
        await updateDoc(doc(db, 'items', cont.id), { avaria: increment(r.perda) });
        if (r.rompeu) {
            const lote = writeBatch(db);
            for (const id of r.filhos) lote.update(doc(db, 'items', id), { parentItemId: null });
            await lote.commit();
            _logMesaItem(ownerId, `🎒 "${cont.nome || 'Contêiner'}" rompeu — ${r.filhos.length} item(ns) para Itens Soltos`,
                [{ label: 'Integridade', from: 'sobrecarregado', to: '0' }]);
            showAlert(`🎒 ${cont.nome || 'O contêiner'} rompeu — ${r.filhos.length} item(ns) foram para Itens Soltos`, 'warning');
        }
    } catch (e) { console.error('desgaste', e); }
}

/** Tirar do corpo. */
async function _desequiparMestre(ownerId, itemId) {
    const i = _itemDoDono(ownerId, itemId); if (!i) return;
    try {
        await setDoc(doc(db, 'items', itemId), {
            equipado: false, slotAnatomico: null, slotsOcupados: [], estadoEquip: null,
            lastModified: new Date().toISOString(),
        }, { merge: true });
        _logMesaItem(ownerId, `🎒 Item "${i.nome || itemId}" desequipado pelo Mestre`,
            [{ label: 'Equipado', from: 'Sim', to: 'Não' }]);
        _repintarInventarios();
    } catch (e) { console.error(e); showAlert('❌ Erro: ' + e.message, 'danger'); }
}

/* ---- EQUIPAR: escolhe slot e estado, igual à Ficha de NPC ---- */
function _equiparMestre(ownerId, itemId) {
    const dono = _donos.get(ownerId);
    const item = _itemDoDono(ownerId, itemId);
    if (!item) return;

    const slots = _slotsDoDono(dono?.char?.partesDoCorpo);
    const slotKeys = Object.keys(slots);
    if (!slotKeys.length) {
        showAlert('⚠️ Este dono não tem partes do corpo cadastradas — só a ficha pode equipar.', 'warning');
        return;
    }

    // Um item de vários slots (armadura completa, arma de duas mãos) bloqueia todos.
    const ocupados = new Set((dono.itens || []).filter(i => i.equipado && i.id !== itemId)
        .flatMap(i => window.EquipSlots.slotsDoItem(i)));
    const permitidas = Array.isArray(item.equipavelEm) && item.equipavelEm.length ? new Set(item.equipavelEm) : null;
    // Onde a peça é só carregada, sem efeito (arco nas Costas, escudo no Braço).
    const guardaveis = new Set(window.EquipSlots.partesDeGuarda(item, _catalogoMestre()));

    /* O estado tem de seguir o slot: numa parte de guarda a peça só pode ser
       Fixada. Cada opção carrega os estados que aquele slot aceita, e o
       onchange desliga o resto — sem isso dava para escolher "Empunhado" nas
       Costas, e a ficha depois recusava em silêncio. */
    const estadosPorSlot = {};
    const opts = slotKeys.map(k => {
        const s = slots[k];
        const ehGuarda = guardaveis.has(s.part.id);
        const bloqueadoPorParte = permitidas && !permitidas.has(s.part.id) && !ehGuarda;
        const ocupado = ocupados.has(k);
        estadosPorSlot[k] = window.EquipSlots.estadosNoSlot(item, s.part, _catalogoMestre());
        const semEstado = !bloqueadoPorParte && estadosPorSlot[k].length === 0;
        return `<option value="${k}" ${bloqueadoPorParte || ocupado || semEstado ? 'disabled' : ''}>${s.icon} ${escapeHtml(s.label)}${ocupado ? ' (ocupado)' : ''}${bloqueadoPorParte ? ' (não permitido)' : ''}${ehGuarda ? ' 🎒 guardar' : ''}${semEstado ? ' (não aceita)' : ''}</option>`;
    }).join('');

    const forma = item.formaEquipar;
    const estadoOpts = Object.entries(ESTADO_EQUIP).map(([v, rot]) => {
        const [icone, formaDoEstado] = FORMA_EQUIP[v];
        const bloqueado = forma && formaDoEstado !== forma;
        return `<option value="${v}" ${bloqueado ? 'disabled' : ''} ${!bloqueado && forma ? 'selected' : ''}>${icone} ${rot}</option>`;
    }).join('');

    document.getElementById('mestreEquipModal')?.remove();
    const modal = document.createElement('div');
    modal.className = 'inv-modal active';
    modal.id = 'mestreEquipModal';
    modal.innerHTML = `<div class="inv-modal-content" style="max-width:420px">
        <div class="inv-modal-header">
            <span class="inv-modal-title">⬆️ Equipar: ${escapeHtml(item.nome || 'Item')}</span>
            <button class="inv-modal-close" onclick="this.closest('.inv-modal').remove()">✕</button>
        </div>
        <div class="inv-modal-body">
            <div class="inv-form-group"><label class="inv-form-label">Slot anatômico</label>
                <select id="mestreEquipSlot" class="inv-form-select"
                    onchange="window._mestreEstadosDoSlot(this.value)">${opts}</select></div>
            <div class="inv-form-group" style="margin-top:10px"><label class="inv-form-label">Estado</label>
                <select id="mestreEquipEstado" class="inv-form-select">${estadoOpts}</select></div>
            ${window.EquipSlots.escolheMaos(item) ? `
            <div class="inv-form-group" style="margin-top:10px"><label class="inv-form-label">✋ Mãos</label>
                <select id="mestreEquipMaos" class="inv-form-select">
                    <option value="1" ${Number(item.maosUsadas) === 2 ? '' : 'selected'}>🤚 1 Mão</option>
                    <option value="2" ${Number(item.maosUsadas) === 2 ? 'selected' : ''}>🤲 2 Mãos</option>
                </select></div>` : ''}
        </div>
        <div class="inv-modal-footer">
            <button class="inv-btn-cancel" onclick="this.closest('.inv-modal').remove()">Cancelar</button>
            <button class="inv-btn-save" onclick="window._confirmMestreEquip('${escapeHtml(ownerId)}','${escapeHtml(itemId)}')">✅ Equipar</button>
        </div>
    </div>`;
    document.body.appendChild(modal);
    modal._estadosPorSlot = estadosPorSlot;
    window._mestreEstadosDoSlot(document.getElementById('mestreEquipSlot')?.value);
}

/** O estado segue o slot: parte de guarda só aceita Fixado. */
window._mestreEstadosDoSlot = function(slotKey) {
    const modal = document.getElementById('mestreEquipModal');
    const sel = document.getElementById('mestreEquipEstado');
    if (!modal || !sel) return;
    const permitidos = (modal._estadosPorSlot || {})[slotKey] || [];
    let primeiro = null;
    for (const op of sel.options) {
        op.disabled = permitidos.length > 0 && !permitidos.includes(op.value);
        if (!op.disabled && primeiro === null) primeiro = op.value;
    }
    if (primeiro !== null) sel.value = primeiro;
};

window._confirmMestreEquip = async function(ownerId, itemId) {
    const dono = _donos.get(ownerId);
    const item = _itemDoDono(ownerId, itemId); if (!item) return;
    const slot = document.getElementById('mestreEquipSlot')?.value;
    const estado = document.getElementById('mestreEquipEstado')?.value;
    if (!slot || !estado) return;

    const bodySlots = _slotsDoDono(dono?.char?.partesDoCorpo);
    const maos = Number(document.getElementById('mestreEquipMaos')?.value)
        || window.EquipSlots.maosDoItem(item);
    const nomeParte = pid => (dono?.char?.partesDoCorpo || []).find(b => b.id === pid)?.nome || pid;

    const plano = window.EquipSlots.planejarEquipar({ ...item, maosUsadas: maos }, slot, dono.itens, bodySlots, {
        catalog: _catalogoMestre(), labelParte: nomeParte,
    });
    if (plano.faltaMao) {
        showAlert(`⚠️ Falta ${plano.faltaMao} livre para empunhar esta arma. Desequipe algo antes.`, 'warning');
        return;
    }

    try {
        await setDoc(doc(db, 'items', itemId), {
            equipado: true, slotAnatomico: slot, slotsOcupados: plano.extras,
            slotAnatomico2: plano.maoExtra, maosUsadas: maos,
            estadoEquip: estado, parentItemId: null,
            lastModified: new Date().toISOString(),
        }, { merge: true });
        _logMesaItem(ownerId, `🎒 Item "${item.nome}" equipado pelo Mestre`,
            [{ label: 'Equipado', from: 'Não', to: `Sim (${slot} / ${estado})` }]);
        document.getElementById('mestreEquipModal')?.remove();
        _repintarInventarios();
    } catch (e) { console.error(e); showAlert('❌ Erro: ' + e.message, 'danger'); }
};

// ===== CRUD MODAL =====
// MESMOS campos do cadastro de Equipamento do Painel do Criador
// (shared/equip-campos.js), só que gravando em `items/<id>`: mexe nesta peça e
// em mais nenhuma, o catálogo fica intacto. Campo novo no cadastro aparece
// sozinho aqui. É o mesmo formulário da Ficha de NPC (npc-inventario.js).

/** Registros que os seletores do formulário consomem. */
function _cachesDoForm() {
    const sys = window._npcSys || window._systemData || {};
    return {
        derivedValues: sys.derivedValues || [],
        vitalStats: sys.vitalStats || [],
        skills: sys.skills || [],
        mechanics: sys.mechanics || window._systemData?.mechanics || [],
        conditions: sys.conditions || window._systemData?.conditions || [],
        bodyParts: sys.bodyParts || window._systemData?.bodyParts || [],
    };
}

/** Registros do sistema + as Condições, que não vêm no pacote da ficha de NPC. */
async function _ensureCachesDoForm() {
    await ensureNpcSystemData();
    if (!window._systemData) window._systemData = {};
    if (!(window._systemData.conditions || []).length) {
        try {
            const snap = await getDocs(collection(db, 'system/data/conditions'));
            const arr = [];
            snap.forEach(d => { const x = d.data(); if (x.publicado !== false) arr.push({ id: d.id, ...x }); });
            window._systemData.conditions = arr;
            if (window._npcSys) window._npcSys.conditions = arr;
        } catch (e) { console.warn('conditions', e); window._systemData.conditions = []; }
    }
}

/** Redesenha os campos do formulário para um item (ou semente de um modelo). */
function _pintarCamposMestre(item, modelo) {
    const corpoEl = document.querySelector('#invFormModal .inv-modal-body');
    const grade = corpoEl?.querySelector('[data-ef-form]');
    if (!grade) return;
    const caches = _cachesDoForm();
    window._mechCache = caches.mechanics;   // os construtores de seletor leem daqui
    grade.innerHTML = htmlFormulario(camposDaInstancia(),
        f => valorDoItem(item, f), { sel: SEL, caches, modelo });

    const nota = corpoEl.querySelector('[data-nota-modelo]');
    if (nota) nota.innerHTML = modelo
        ? `<div class="inv-form-nota">📘 Cópia completa de <b>${escapeHtml(modelo.nome || 'modelo do catálogo')}</b> —
            cadastro inteiro trazido, inclusive vínculos e equações. O que você mudar aqui vale
            <b>só para este item</b>, e mexer no catálogo depois <b>não altera</b> esta peça.</div>`
        : '';
    const mid = corpoEl.querySelector('#mif_modeloId');
    if (mid) mid.value = modelo?.id || '';
    const qi = corpoEl.querySelector('#mif_qtdInicial');
    if (qi) qi.value = item?.quantidade ?? '';
    aplicarVisibilidade(corpoEl);
}

window._openMestreItemFormModal = async function(mesaId, editItemId, targetCharId) {
    document.getElementById('invFormModal')?.remove();

    let item = null;
    if (editItemId) {
        try {
            const snap = await getDoc(doc(db, 'items', editItemId));
            if (snap.exists()) item = { id: snap.id, ...snap.data() };
        } catch (e) { console.error(e); }
    }
    const isEdit = !!item;

    await _ensureCachesDoForm();
    const cat = _catalogoMestre();
    const modelo = item ? modeloDoItem(item, cat) : null;

    // Buscar no catálogo só ao CRIAR: trocar o modelo de um item que já existe
    // apagaria o que o Mestre ajustou nele.
    const buscaHtml = (!isEdit && cat.length) ? `
        <div class="inv-form-catalogo">
            <label class="inv-form-label" for="mif_buscaCat">📚 Partir de um equipamento do catálogo</label>
            <input type="search" id="mif_buscaCat" class="inv-form-input" autocomplete="off"
                placeholder="🔍 Buscar por nome, tipo ou tag — ou deixe em branco para item personalizado"
                oninput="window._mestreFiltrarCatalogo()">
            <select id="mif_listaCat" class="inv-form-select" size="6"
                onchange="window._mestreUsarModelo(this.value)"></select>
            <small class="inv-form-hint">O item nasce vinculado ao modelo: o que você não preencher
                continua seguindo o catálogo.</small>
        </div>` : '';

    /* "Salvar no Catálogo" — quem tem papel de criador publica direto; o Mestre
       grava RASCUNHO (publicado:false), que é a fresta que firestore.rules abre.
       A peça aparece no Painel do Criador com o selo 📝 Rasc e some dos pickers
       até ser publicada. */
    const catalogoHtml = isEdit ? '' : `
        <label class="inv-form-check inv-form-wide" style="margin-top:10px">
            <input type="checkbox" id="mif_salvarCatalogo" checked>
            <span>📚 Salvar no Catálogo${_ehCriador() ? '' : ' <em>(como rascunho, para o Criador publicar)</em>'}</span>
        </label>`;

    const modal = document.createElement('div');
    modal.className = 'inv-modal active ef-form-modal';
    modal.id = 'invFormModal';
    modal.innerHTML = `<div class="inv-modal-content" style="max-width:860px">
        <div class="inv-modal-header">
            <span class="inv-modal-title">${isEdit ? '✏️ Editar Item' : '➕ Criar Item'}</span>
            <button class="inv-modal-close" onclick="this.closest('.inv-modal').remove()">✕</button>
        </div>
        <div class="inv-modal-body">
            ${buscaHtml}
            ${htmlBarraFerramentas()}
            <div data-nota-modelo></div>
            <div data-ef-form></div>
            ${catalogoHtml}
            <input type="hidden" id="mif_mesaId" value="${escapeHtml(mesaId || '')}">
            <input type="hidden" id="mif_targetCharId" value="${escapeHtml(targetCharId || '')}">
            <input type="hidden" id="mif_modeloId" value="${escapeHtml(item?.modeloId || '')}">
            <input type="hidden" id="mif_qtdInicial" value="${escapeHtml(String(item?.quantidade ?? ''))}">
            ${isEdit ? `<input type="hidden" id="mif_editId" value="${escapeHtml(item.id)}">` : ''}
        </div>
        <div class="inv-modal-footer">
            ${isEdit && modelo ? botaoRestaurarHTML('window._restaurarMestreItem()') : ''}
            <button class="inv-btn-cancel" onclick="this.closest('.inv-modal').remove()">Cancelar</button>
            <button class="inv-btn-save" onclick="_saveMestreItem()">💾 Salvar</button>
        </div>
    </div>`;
    document.body.appendChild(modal);

    _pintarCamposMestre(item, modelo);
    if (!isEdit && cat.length) window._mestreFiltrarCatalogo();

    // Busca de campo, abrir/recolher seções, campos condicionais e contadores
    ligarFormulario(modal.querySelector('.inv-modal-body'));
};

/** Filtra o catálogo por nome, tipo ou tag. Sem busca, mostra tudo. */
window._mestreFiltrarCatalogo = function() {
    const lista = document.getElementById('mif_listaCat');
    if (!lista) return;
    const q = (document.getElementById('mif_buscaCat')?.value || '').trim().toLowerCase();
    const casa = (t) => !q || [t.nome, t.tipo, ...(t.tags || [])]
        .some(v => String(v || '').toLowerCase().includes(q));
    const achados = _catalogoMestre().filter(casa)
        .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

    lista.innerHTML = achados.length
        ? achados.slice(0, 200).map(t => {
            const det = [t.tipo, t.liga != null ? 'Liga ' + t.liga : '', t.formulaDano].filter(Boolean).join(' · ');
            return `<option value="${escapeHtml(t.id)}">${escapeHtml(t.nome || 'Sem nome')}${det ? ' — ' + escapeHtml(det) : ''}</option>`;
        }).join('')
        : '<option value="" disabled>Nenhum equipamento encontrado</option>';
};

/** Escolheu um modelo: semeia os campos e vincula a instância a ele. */
window._mestreUsarModelo = function(templateId) {
    const tpl = _catalogoMestre().find(t => t.id === templateId);
    if (!tpl) return;
    _pintarCamposMestre(instanciarDoModelo(tpl), tpl);
};

/** ♻️ Joga o cadastro do catálogo por cima do que foi alterado nesta peça. */
window._restaurarMestreItem = async function() {
    const editId = document.getElementById('mif_editId')?.value || '';
    if (!editId) return;
    try {
        const snap = await getDoc(doc(db, 'items', editId));
        const item = snap.exists() ? { id: snap.id, ...snap.data() } : null;
        const tpl = modeloDoItem(item, _catalogoMestre());
        const patch = patchRestauracao(tpl);
        if (!patch) { showAlert('⚠️ Este item não veio do catálogo — não há cadastro a restaurar.', 'warning'); return; }
        if (!await confirmar(textoConfirmacao(item, tpl))) return;

        await setDoc(doc(db, 'items', editId), patch, { merge: true });
        if (window.addLog) {
            window.addLog(S.currentUser?.email, `♻️ Item "${item.nome || ''}" restaurado ao cadastro de "${tpl.nome}"`,
                '', 'items', {
                    charId: item.characterId || null, mesaId: S.currentMesaId, category: 'Inventário',
                    changes: [{ label: 'Item', from: item.nome || '', to: tpl.nome || '' }]
                });
        }
        showAlert('♻️ Item restaurado ao cadastro!', 'success');
        document.getElementById('invFormModal')?.remove();
        _repintarInventarios();
    } catch (e) {
        console.error('❌ Erro ao restaurar item:', e);
        showAlert('❌ Erro: ' + e.message, 'danger');
    }
};

/** Papel de criador — só ele publica direto em system/data/* (firestore.rules). */
const _ehCriador = () => window._papelUsuario === 'criador';

/**
 * 📚 Grava a peça no cadastro de Equipamentos do Painel do Criador.
 *
 * Modelo de mesmo nome e tipo é reaproveitado em vez de duplicado: sem isso o
 * catálogo enche de repetição a cada item criado na mesa.
 *
 * @returns id do modelo (novo ou reaproveitado), ou null.
 */
async function _publicarNoCatalogo(dados, nome) {
    const catalogo = window._systemData?.equipment || [];
    const igual = catalogo.find(t =>
        String(t.nome || '').trim().toLowerCase() === nome.toLowerCase()
        && (t.tipo || '') === (dados.tipo || ''));
    if (igual) return igual.id;

    const modelo = {
        ...modeloDaInstancia({ ...dados, nome }),
        publicado: _ehCriador(),
        versao: 1,
        criadoPor: S.currentUser?.uid || '',
        criadoEm: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    const novoId = 'equip-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
    await setDoc(doc(db, 'system/data/equipment', novoId), modelo);

    // Cache local: a peça aparece no picker sem recarregar a página.
    if (Array.isArray(window._systemData?.equipment)) {
        window._systemData.equipment.push({ id: novoId, ...modelo });
    }
    showAlert(modelo.publicado
        ? `📚 "${nome}" entrou no catálogo`
        : `📚 "${nome}" foi para o catálogo como rascunho — publique no Painel do Criador`, 'success');
    return novoId;
}

window._saveMestreItem = async function() {
    const dados = coletarCampos(camposDaInstancia());

    const nome = String(dados.nome || '').trim();
    if (!nome) { showAlert('⚠️ Nome obrigatório', 'warning'); return; }
    if (dados.tipo === 'Arma' && !dados.categoriaArma) { showAlert('⚠️ Selecione a categoria da arma', 'warning'); return; }

    const mesaId = document.getElementById('mif_mesaId')?.value;
    const editId = document.getElementById('mif_editId')?.value || '';
    const targetCharId = document.getElementById('mif_targetCharId')?.value;
    const isContainer = dados.tipo === 'Container' || !!dados.ehContainer;

    let old = null;
    if (editId) {
        try { const snap = await getDoc(doc(db, 'items', editId)); if (snap.exists()) old = snap.data(); }
        catch (e) { /* segue sem o anterior */ }
    }

    let modeloId = document.getElementById('mif_modeloId')?.value || null;
    if (!editId && document.getElementById('mif_salvarCatalogo')?.checked) {
        try {
            const novo = await _publicarNoCatalogo(dados, nome);
            if (novo) modeloId = novo;
        } catch (e) {
            console.error('❌ catálogo:', e);
            showAlert('⚠️ Item salvo na mesa, mas não entrou no catálogo: ' + e.message, 'warning');
        }
    }

    const itemData = {
        ...dados,
        nome,
        // A instância guarda a imagem em `imagem`; `imagemUrl` é chave do catálogo
        imagem: dados.imagemUrl || '',
        // Mecânicas da instância não se misturam com as do modelo
        mecanicaIdsProprias: dados.mecanicaIds || [],
        ehContainer: isContainer,
        equipavelEm: (dados.equipavelEm || []).length ? dados.equipavelEm : null,
        formaEquipar: dados.formaEquipar || '',
        categoriaArma: dados.tipo === 'Arma' ? dados.categoriaArma : null,
        peso: Number(dados.peso) || 1,
        // Metros, fracionado: 0,1 = 10 cm.
        tamanho: Number(dados.tamanho) || 1,
        pressaoBase: dados.pressaoBase != null ? Number(dados.pressaoBase) : (Number(dados.peso) || 1),
        // Vínculo com o catálogo: é ele que faz campo em branco herdar do modelo
        modeloId,
        characterId: targetCharId,
        ownerUid: old?.ownerUid || S.currentUser?.uid || '',
        lastModified: new Date().toISOString(),
    };
    delete itemData.imagemUrl;
    delete itemData.mecanicaIds;
    if (!isContainer) { itemData.pesoMaximoContainer = null; itemData.multiplicadorPressao = null; itemData.capacidadeContainer = null; }
    // Arma e contêiner nunca empilham. Nos demais: mantém a pilha atual ao
    // editar; ao criar do catálogo, nasce com o "padrão ao instanciar" do modelo.
    const qtdSemente = parseInt(document.getElementById('mif_qtdInicial')?.value) || 0;
    itemData.quantidade = (isContainer || dados.tipo === 'Arma')
        ? 1
        : Math.max(1, parseInt(old?.quantidade) || qtdSemente || 1);

    try {
        if (editId) {
            await setDoc(doc(db, 'items', editId), itemData, { merge: true });
        } else {
            itemData.equipado = false;
            itemData.slotAnatomico = null;
            itemData.estadoEquip = null;
            itemData.parentItemId = null;
            itemData.criadoPor = 'mestre';
            const newId = 'item-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
            itemData.id = newId;
            await setDoc(doc(db, 'items', newId), itemData);
        }
        // 📜 Log da alteração de inventário
        if (window.addLog) {
            window.addLog(S.currentUser?.email,
                editId ? `🎒 Item "${nome}" editado pelo Mestre` : `🎒 Item "${nome}" adicionado pelo Mestre`,
                '', 'items', {
                    charId: targetCharId || null, mesaId: mesaId || S.currentMesaId, category: 'Inventário',
                    changes: [
                        { label: 'Item', from: editId ? nome : '—', to: nome },
                        { label: 'Tipo', from: '', to: String(dados.tipo || '') },
                        { label: 'Quantidade', from: '', to: String(itemData.quantidade) }
                    ]
                });
        }

        showAlert('✅ Item salvo!', 'success');
        document.getElementById('invFormModal')?.remove();
        _repintarInventarios();
    } catch (e) {
        console.error('❌ Erro ao salvar item:', e);
        showAlert('❌ Erro: ' + e.message, 'danger');
    }
};

window._deleteMestreItem = async function(itemId) {
    if (!await confirmar('Excluir este item?', { perigo: true })) return;
    try {
        // Capturar dados do item ANTES de deletar (para o log)
        let itemInfo = null;
        try {
            const snap = await getDoc(doc(db, 'items', itemId));
            if (snap.exists()) itemInfo = snap.data();
        } catch (e) { /* ignore */ }

        await deleteDoc(doc(db, 'items', itemId));

        // 📜 Log da remoção
        if (window.addLog) {
            window.addLog(S.currentUser?.email,
                `🗑️ Item "${itemInfo?.nome || itemId}" excluído pelo Mestre`,
                '', 'items', {
                    charId: itemInfo?.characterId || null, mesaId: S.currentMesaId, category: 'Inventário',
                    changes: [
                        { label: 'Item', from: itemInfo?.nome || itemId, to: '—' },
                        { label: 'Quantidade', from: String(itemInfo?.quantidade ?? '—'), to: '—' }
                    ]
                });
        }

        showAlert('✅ Item excluído', 'success');
        _repintarInventarios();
    } catch (e) {
        console.error('❌ Erro ao excluir:', e);
        showAlert('❌ Erro: ' + e.message, 'danger');
    }
};

// ===== TRANSFER MODAL =====
window._openMestreTransferModal = async function(itemId, mesaId) {
    let existing = document.getElementById('mestreTransferModal');
    if (existing) existing.remove();

    let itemNome = 'Item';
    try {
        const snap = await getDoc(doc(db, 'items', itemId));
        if (snap.exists()) itemNome = snap.data().nome || 'Item';
    } catch(e) {}

    const modal = document.createElement('div');
    modal.className = 'inv-modal active';
    modal.id = 'mestreTransferModal';
    modal.innerHTML = `<div class="inv-modal-content" style="max-width:550px">
        <div class="inv-modal-header">
            <span class="inv-modal-title">🔄 Transferir: ${escapeHtml(itemNome)}</span>
            <button class="inv-modal-close" onclick="this.closest('.inv-modal').remove()">✕</button>
        </div>
        <div class="inv-modal-body">
            <div style="display:flex; flex-direction:column; gap:12px;">
                <div class="form-group" style="margin-bottom: 0;">
                    <input type="text" id="mt_search" class="inv-form-input" placeholder="🔍 Buscar personagem por nome ou e-mail..." oninput="window._filterMestreTransfer()">
                </div>
                <div class="sub-tabs" style="display:flex; overflow-x:auto; gap:4px;">
                    <button class="sub-tab-btn active" onclick="window._setMestreTransferScope('mesa', this)" style="padding:6px 10px; font-size:0.85rem;">Mesa Atual</button>
                    <button class="sub-tab-btn" onclick="window._setMestreTransferScope('caixa', this)" style="padding:6px 10px; font-size:0.85rem;">Caixa do Mestre</button>
                    <button class="sub-tab-btn" onclick="window._setMestreTransferScope('todas', this)" style="padding:6px 10px; font-size:0.85rem;">Todas as Mesas</button>
                    <button class="sub-tab-btn" onclick="window._setMestreTransferScope('avulsos', this)" style="padding:6px 10px; font-size:0.85rem;">Avulsos</button>
                    <button class="sub-tab-btn" onclick="window._setMestreTransferScope('npcs_mesa', this)" style="padding:6px 10px; font-size:0.85rem;">NPCs da Mesa</button>
                    <button class="sub-tab-btn" onclick="window._setMestreTransferScope('npcs_todos', this)" style="padding:6px 10px; font-size:0.85rem;">Todos os NPCs</button>
                </div>
                <div id="mt_results" style="display:grid; gap:8px; max-height:40vh; overflow-y:auto; padding:4px;">
                    <div style="text-align:center;color:var(--muted)">Carregando...</div>
                </div>
            </div>
        </div>
    </div>`;
    document.body.appendChild(modal);

    window._mestreTransferData = {
        itemId: itemId,
        mesaId: mesaId,
        scope: 'mesa',
        chars: [],
        npcs: []
    };

    try {
        const [snap, npcSnap] = await Promise.all([
            getDocs(query(collection(db, 'char'), where('mesaId', '==', mesaId))),
            getDocs(collection(db, 'npcs'))
        ]);
        const allChars = [];
        snap.forEach(d => {
            const data = d.data();
            const f = data.fields || {};
            allChars.push({
                id: d.id,
                nome: f.nome || data.nome || 'Sem nome',
                ownerUid: data.ownerUid || '',
                ownerEmail: data.ownerEmail || data.userEmail || '',
                mesaId: data.mesaId || null
            });
        });
        const allNpcs = [];
        npcSnap.forEach(d => {
            const data = d.data();
            allNpcs.push({
                id: d.id,
                nome: data.nome || 'Sem nome',
                papel: data.papel || '',
                tipo: data.tipo || 'npc',
                mesaId: data.mesaId || null,
                vinculos: Array.isArray(data.vinculos) ? data.vinculos : []
            });
        });
        window._mestreTransferData.chars = allChars;
        window._mestreTransferData.npcs = allNpcs;
        window._filterMestreTransfer();
    } catch (e) {
        document.getElementById('mt_results').innerHTML = `<div style="text-align:center;color:#ef4444">❌ Erro: ${e.message}</div>`;
    }
};

window._setMestreTransferScope = function(scope, btnEl) {
    window._mestreTransferData.scope = scope;
    const btns = btnEl.parentElement.querySelectorAll('.sub-tab-btn');
    btns.forEach(b => b.classList.remove('active'));
    btnEl.classList.add('active');
    window._filterMestreTransfer();
};

window._filterMestreTransfer = function() {
    const data = window._mestreTransferData;
    const search = (document.getElementById('mt_search')?.value || '').toLowerCase();
    const resultsContainer = document.getElementById('mt_results');
    
    if (data.scope === 'caixa') {
        resultsContainer.innerHTML = `<div style="display:flex;flex-direction:column;gap:4px;padding:14px 16px;background:var(--lr-bg-1);border:2px solid rgba(245,158,11,.2);border-radius:10px;cursor:pointer;transition:all .2s"
            onclick="_executeMestreTransfer('${data.itemId}','${_getCaixaMestreId(data.mesaId)}','${S.currentUser?.uid||''}')">
            <div style="font-weight:700;font-size:.95rem;color:var(--lr-gold)">📦 Caixa do Mestre</div>
            <div style="font-size:.78rem;color:var(--muted)">Mesa Atual</div>
        </div>`;
        return;
    }

    // Escopos de NPC — o mestre pode buscar/filtrar qualquer NPC cadastrado
    // ou apenas os vinculados à mesa atual.
    if (data.scope === 'npcs_mesa' || data.scope === 'npcs_todos') {
        let npcs = data.npcs || [];
        if (data.scope === 'npcs_mesa') {
            npcs = npcs.filter(n => n.mesaId === data.mesaId || (n.vinculos || []).some(v => v.tipo === 'mesa' && v.id === data.mesaId));
        }
        if (search) {
            npcs = npcs.filter(n => n.nome.toLowerCase().includes(search) || (n.papel || '').toLowerCase().includes(search));
        }
        if (!npcs.length) {
            resultsContainer.innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted)">Nenhum NPC encontrado</div>';
            return;
        }
        resultsContainer.innerHTML = npcs.slice(0, 100).map(n => `
            <div style="display:flex;flex-direction:column;gap:4px;padding:14px 16px;background:var(--lr-bg-1);border:2px solid rgba(16,185,129,.15);border-radius:10px;cursor:pointer;transition:all .2s"
                onmouseenter="this.style.borderColor='#10b981';this.style.background='rgba(16,185,129,.08)'"
                onmouseleave="this.style.borderColor='rgba(16,185,129,.15)';this.style.background='rgba(15,23,42,.5)'"
                onclick="_executeMestreTransfer('${data.itemId}','${n.id}','', true)">
                <div style="font-weight:700;font-size:.95rem;color:var(--light)">${n.tipo === 'criatura' ? '🐉' : '👤'} ${escapeHtml(n.nome)}</div>
                ${n.papel ? `<div style="font-size:.78rem;color:var(--muted)">${escapeHtml(n.papel)}</div>` : ''}
                ${n.mesaId && data.scope === 'npcs_todos' ? `<div style="font-size:.7rem;color:var(--lr-arcane)">Mesa ID: ${n.mesaId}</div>` : ''}
            </div>
        `).join('');
        return;
    }

    let filtered = data.chars;
    if (data.scope === 'mesa') {
        filtered = filtered.filter(c => c.mesaId === data.mesaId);
    } else if (data.scope === 'todas') {
        filtered = filtered.filter(c => c.mesaId != null);
    } else if (data.scope === 'avulsos') {
        filtered = filtered.filter(c => !c.mesaId);
    }

    if (search) {
        filtered = filtered.filter(c => c.nome.toLowerCase().includes(search) || c.ownerEmail.toLowerCase().includes(search));
    }

    if (!filtered.length) {
        resultsContainer.innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted)">Nenhum personagem encontrado</div>';
        return;
    }

    resultsContainer.innerHTML = filtered.map(c => `
        <div style="display:flex;flex-direction:column;gap:4px;padding:14px 16px;background:var(--lr-bg-1);border:2px solid rgba(139,92,246,.12);border-radius:10px;cursor:pointer;transition:all .2s"
            onmouseenter="this.style.borderColor='#8b5cf6';this.style.background='rgba(139,92,246,.08)'"
            onmouseleave="this.style.borderColor='rgba(139,92,246,.12)';this.style.background='rgba(15,23,42,.5)'"
            onclick="_executeMestreTransfer('${data.itemId}','${c.id}','${c.ownerUid || ''}')">
            <div style="font-weight:700;font-size:.95rem;color:var(--light)">🎭 ${escapeHtml(c.nome)}</div>
            ${c.ownerEmail ? `<div style="font-size:.78rem;color:var(--muted)">👤 ${escapeHtml(c.ownerEmail)}</div>` : ''}
            ${c.mesaId && data.scope === 'todas' ? `<div style="font-size:.7rem;color:var(--lr-arcane)">Mesa ID: ${c.mesaId}</div>` : ''}
        </div>
    `).join('');
};

window._executeMestreTransfer = async function(itemId, targetCharId, targetOwnerUid, isNpc = false) {
    if (!await confirmar('Transferir este item para o destino selecionado?')) return;
    try {
        // Capturar item ANTES da transferência (para o log)
        let itemInfo = null;
        try {
            const snap = await getDoc(doc(db, 'items', itemId));
            if (snap.exists()) itemInfo = snap.data();
        } catch (e) { /* ignore */ }

        const updateData = {
            characterId: targetCharId,
            equipado: false,
            slotAnatomico: null,
            estadoEquip: null,
            parentItemId: null,
            lastModified: new Date().toISOString()
        };
        if (isNpc) {
            // Destino é um NPC: preserva o ownerUid atual do item
            updateData.ownerType = 'npc';
        } else {
            updateData.ownerType = targetCharId.startsWith('__caixa_mestre__') ? 'caixa' : 'char';
            updateData.ownerUid = targetOwnerUid;
            updateData.ownerId = targetOwnerUid;
        }
        await setDoc(doc(db, 'items', itemId), updateData, { merge: true });

        /* Contêiner viaja com o que tem dentro. Sem isto o conteúdo continuava
           com o characterId do dono ANTIGO: some da lista dele (tem
           parentItemId) e não aparece no destino (characterId errado). */
        if (itemInfo?.ehContainer || itemInfo?.tipo === 'Container') {
            const todos = await _fetchAllItems();
            const fila = [itemId], dentro = [];
            while (fila.length) {
                const pai = fila.pop();
                for (const x of todos) {
                    if (x.parentItemId === pai && !dentro.includes(x)) { dentro.push(x); fila.push(x.id); }
                }
            }
            for (const filho of dentro) {
                await setDoc(doc(db, 'items', filho.id),
                    { ...updateData, parentItemId: filho.parentItemId }, { merge: true });
            }
        }

        // 📜 Log da transferência (um log para a origem e outro para o destino)
        if (window.addLog) {
            const nomeItem = itemInfo?.nome || itemId;
            const origemCharId = itemInfo?.characterId || null;
            const changes = [
                { label: 'Item', from: nomeItem, to: nomeItem },
                { label: 'Personagem (ID)', from: String(origemCharId || '—'), to: String(targetCharId || '—') }
            ];
            window.addLog(S.currentUser?.email, `🔁 Item "${nomeItem}" transferido pelo Mestre`, '', 'items', {
                charId: targetCharId || null, mesaId: S.currentMesaId, category: 'Inventário', changes
            });
            if (origemCharId && origemCharId !== targetCharId) {
                window.addLog(S.currentUser?.email, `🔁 Item "${nomeItem}" saiu do inventário (transferência)`, '', 'items', {
                    charId: origemCharId, mesaId: S.currentMesaId, category: 'Inventário', changes
                });
            }
        }

        showAlert('✅ Item transferido com sucesso!', 'success');
        document.getElementById('mestreTransferModal')?.remove();
        
        _repintarInventarios();
    } catch (e) {
        console.error('❌ Erro ao transferir:', e);
        showAlert('❌ Erro: ' + e.message, 'danger');
    }
};

window._transferCharacterLooseItems = async function(charId) {
    if (!await confirmar('Transferir todos os itens soltos deste personagem para a Caixa do Mestre?')) return;
    try {
        const allItems = await _fetchAllItems();
        const charItems = allItems.filter(it => it.characterId === charId && !it.parentItemId && !it.equipado);
        
        if(charItems.length === 0) {
            showAlert('Não há itens soltos para transferir.', 'info');
            return;
        }

        const caixaId = _getCaixaMestreId(S.currentMesaId);
        const promises = charItems.map(item => {
            return setDoc(doc(db, 'items', item.id), {
                characterId: caixaId,
                ownerUid: S.currentUser?.uid || '',
                ownerId: S.currentUser?.uid || '',
                lastModified: new Date().toISOString()
            }, { merge: true });
        });

        await Promise.all(promises);
        showAlert('✅ Itens transferidos com sucesso!', 'success');
        _repintarInventarios();
    } catch (e) {
        console.error('❌ Erro ao transferir itens soltos:', e);
        showAlert('❌ Erro: ' + e.message, 'danger');
    }
};

window._transferAllLooseItems = async function() {
    if (!await confirmar('Transferir todos os itens soltos de TODOS os personagens para a Caixa do Mestre?')) return;
    try {
        const allItems = await _fetchAllItems();
        const chars = S.mesaCharacters || [];
        const charIds = chars.map(c => c.id);
        
        const looseItems = allItems.filter(it => charIds.includes(it.characterId) && !it.parentItemId && !it.equipado);
        
        if(looseItems.length === 0) {
            showAlert('Não há itens soltos para transferir.', 'info');
            return;
        }

        const caixaId = _getCaixaMestreId(S.currentMesaId);
        const promises = looseItems.map(item => {
            return setDoc(doc(db, 'items', item.id), {
                characterId: caixaId,
                ownerUid: S.currentUser?.uid || '',
                ownerId: S.currentUser?.uid || '',
                lastModified: new Date().toISOString()
            }, { merge: true });
        });

        await Promise.all(promises);
        showAlert('✅ Itens transferidos com sucesso!', 'success');
        _repintarInventarios();
    } catch (e) {
        console.error('❌ Erro ao transferir itens soltos:', e);
        showAlert('❌ Erro: ' + e.message, 'danger');
    }
};

