// =============================================
// COMBAT SYSTEM — Full migration from mestre.html
// =============================================
import { db, collection, getDocs, getDoc, setDoc, updateDoc, doc, onSnapshot, query, where, deleteField } from './firebase-config.js';
import * as S from './state.js';
import { showAlert, escapeHtml } from './ui-utils.js';
import { cenasDoDoc, cenaAtiva, comCenaAtivaPatch, comCenaNova, semCena, comTrocaDeCena } from '../../shared/combate-cenas.js';
import { confirmar, perguntar } from '../../shared/dialogo.js?v=2';

let combatListeners = {};

// Vitais aceitam meio ponto (VIT 21,9), e somar/subtrair 1 repetidas vezes em
// float acumula lixo: virava "9.899999999999999/21.9" na tela e no doc. Arredonda
// na CONTA (o que é gravado e sincronizado com a ficha) e na exibição, que
// também mostra valor vindo sujo de fora.
const vNum = (v) => Math.round((Number(v) || 0) * 100) / 100;

// ===== PERSISTÊNCIA (sincroniza com o Tabuleiro/VTT) =====
// Doc de combate como veio do servidor — a base para remontar as CENAS sem
// perder as que não estão abertas (ver shared/combate-cenas.js).
let _docCombate = null;

const refDocCombate = () => doc(db, 'mesas', S.currentMesaId, 'tabuleiro-meta', 'combate');

// Campos que ESTE painel edita. O resto do participante (condições aplicadas no
// Tabuleiro, vínculos) vem sempre da cópia mais nova do servidor.
const CAMPOS_DO_PAINEL = ['name', 'type', 'details', 'initiative', 'combatAbilities',
    'hpCurrent', 'hpMax', 'enerCurrent', 'enerMax', 'sanCurrent', 'sanMax'];

/** Participante pronto para gravar: sem campo local (`__*`) e sem sobrescrever o alheio. */
function paraGravar(local, remoto) {
    const limpo = {};
    for (const [k, v] of Object.entries(local)) if (!k.startsWith('__')) limpo[k] = v;
    if (!remoto) return limpo;
    const meus = {};
    for (const k of CAMPOS_DO_PAINEL) if (k in limpo) meus[k] = limpo[k];
    return { ...remoto, ...meus };
}

let _persistTimer = null;
function persistCombat() {
    if (!S.currentMesaId) return;
    clearTimeout(_persistTimer);
    _persistTimer = setTimeout(async () => {
        _persistTimer = null;   // é o que destrava o listener a receber mudança de fora
        try {
            // 🔒 O Tabuleiro escreve na MESMA lista. Mandar a cópia local inteira
            // apagava o que chegou de lá enquanto este write esperava os 400ms —
            // uma condição aplicada no tabuleiro sumia sozinha. Merge por id.
            const remotos = cenaAtiva(_docCombate).participantes || [];
            const participantes = S.combatParticipants.map(p =>
                paraGravar(p, remotos.find(x => x.id === p.id)));
            // grava DENTRO da cena aberta; o helper devolve o doc com o espelho
            const novo = comCenaAtivaPatch(_docCombate, { participantes });
            _docCombate = { ..._docCombate, ...novo };
            await setDoc(refDocCombate(), { ...novo, atualizadoEm: Date.now() }, { merge: true });
        } catch (e) { console.warn('persistCombat', e); }
    }, 400);
}

/** Escreve um doc já montado pelos helpers de cena e recarrega a lista. */
async function salvarCenas(novo) {
    _docCombate = { ..._docCombate, ...novo };
    try { await setDoc(refDocCombate(), { ...novo, atualizadoEm: Date.now() }, { merge: true }); }
    catch (e) { console.warn('salvarCenas', e); }
    S.setCombatParticipants(cenaAtiva(_docCombate).participantes || []);
    renderCombatList();
}

window.combatCenaTrocar = (id) => salvarCenas(comTrocaDeCena(_docCombate, id));
window.combatCenaNova = async () => {
    const nome = await perguntar('Nome da cena de combate:', { valor: 'Cena ' + (cenasDoDoc(_docCombate).length + 1) });
    if (nome === null) return;
    salvarCenas(comCenaNova(_docCombate, 'c' + Date.now().toString(36), nome.trim() || 'Nova cena'));
};
window.combatCenaRenomear = async () => {
    const atual = cenaAtiva(_docCombate);
    const nome = await perguntar('Nome da cena:', { valor: atual.nome || '' });
    if (nome === null) return;
    salvarCenas(comCenaAtivaPatch(_docCombate, { nome: nome.trim() || 'Cena' }));
};
window.combatCenaApagar = async () => {
    const atual = cenaAtiva(_docCombate);
    if (!await confirmar(`Apagar a cena "${atual.nome}" e os participantes dela?`, { perigo: true })) return;
    salvarCenas(semCena(_docCombate, atual.id));
};

/** Seletor de cenas no topo da lista (no Tabuleiro isso vira abas). */
function barraDeCenas() {
    const cenas = cenasDoDoc(_docCombate);
    const ativa = cenaAtiva(_docCombate).id;
    return `<div class="combat-cenas">
        <select class="combat-cena-sel" onchange="combatCenaTrocar(this.value)" title="Cena de combate">
            ${cenas.map(c => `<option value="${c.id}" ${c.id === ativa ? 'selected' : ''}>
                🎬 ${escapeHtml(c.nome || 'Cena')} (${(c.participantes || []).length})</option>`).join('')}
        </select>
        <button class="btn btn-sm" onclick="combatCenaNova()" title="Nova cena">➕ Cena</button>
        <button class="btn btn-sm" onclick="combatCenaRenomear()" title="Renomear a cena aberta">✏️</button>
        ${cenas.length > 1 ? `<button class="btn btn-sm btn-danger" onclick="combatCenaApagar()" title="Apagar a cena aberta">🗑️</button>` : ''}
    </div>`;
}

window._loadCombatFromMesa = async function() {
    if (!S.currentMesaId) return;
    try {
        const snap = await getDoc(refDocCombate());
        Object.values(combatListeners).forEach(u => { if (typeof u === 'function') u(); });
        combatListeners = {};
        if (snap.exists()) {
            _docCombate = snap.data();
            const parts = cenaAtiva(_docCombate).participantes || [];
            S.setCombatParticipants(parts);
            parts.forEach(p => {
                if (p.characterId) setupCombatListener(p.characterId, p.id);
                if (p.npcId) setupCombatNpcListener(p.npcId, p.id);
            });
        } else {
            _docCombate = null;
            S.setCombatParticipants([]);
        }
        // O mestre também mexe nas cenas pelo Tabuleiro. Sem ouvir o doc, este
        // lado remontaria `cenas` a partir de uma cópia velha e APAGARIA a cena
        // criada lá. O listener só atualiza a base do merge; a lista aqui só é
        // redesenhada quando a cena ABERTA muda, para não atropelar edição em
        // andamento. Um listener, um doc — o mesmo que o tabuleiro já paga.
        combatListeners.__doc = onSnapshot(refDocCombate(), s => {
            if (!s.exists()) return;
            _docCombate = s.data();
            const parts = cenaAtiva(_docCombate).participantes || [];
            // Write meu ainda na fila (o mestre está mexendo AQUI): o snapshot é
            // velho por definição, ignorar. Sem essa guarda, o eco do próprio
            // write redesenharia a lista no meio da digitação.
            if (_persistTimer) return;
            // compara sem os campos locais (`__`), senão o eco do próprio write
            // parece sempre diferente e a lista repinta à toa
            if (JSON.stringify(parts) === JSON.stringify(S.combatParticipants.map(p => paraGravar(p)))) return;
            // as condições da ficha são locais: preserva ao adotar a lista remota
            const condsLocais = new Map(S.combatParticipants.map(p => [p.id, p.__conds]));
            S.setCombatParticipants(parts.map(p =>
                condsLocais.has(p.id) ? { ...p, __conds: condsLocais.get(p.id) } : p));
            // participante que entrou pelo Tabuleiro também precisa do listener de
            // vitais aqui — senão a barra dele só se mexe depois de recarregar
            parts.forEach(p => {
                if (combatListeners[p.id]) return;
                if (p.characterId) setupCombatListener(p.characterId, p.id);
                if (p.npcId) setupCombatNpcListener(p.npcId, p.id);
            });
            pintarCombate();
        }, e => console.warn('combate doc', e));
        renderCombatList();
    } catch (e) { console.warn('loadCombat', e); }
};

// ===== ADD TO COMBAT =====
window.addCharacterToCombat = async function() {
    try {
        if (!S.currentMesaId) { showAlert('⚠️ Nenhuma mesa aberta', 'warning'); return; }
        const snap = await getDocs(query(collection(db, 'char'), where('mesaId', '==', S.currentMesaId)));
        const chars = [];
        snap.forEach(d => { chars.push({ id: d.id, ...d.data() }); });
        if (!chars.length) { showAlert('❌ Nenhum personagem nesta mesa', 'danger'); return; }
        const opts = chars.map(c => { const f = c.fields || {}; const nome = f.nome || c.nome || 'Sem nome'; const jogador = c.ownerEmail || c.jogador || '-'; return `<option value="${c.id}" data-name="${nome.toLowerCase()}">${nome} (${jogador})</option>`; }).join('');
        const m = document.createElement('div'); m.className = 'modal active';
        m.innerHTML = `<div class="modal-content" style="max-width:500px"><div class="modal-header"><span class="modal-title">Adicionar Jogador</span><button class="modal-close" onclick="this.closest('.modal').remove()">✕</button></div><div class="modal-body"><div class="form-group"><label class="form-label">🔍 Buscar</label><input type="text" class="form-input" id="searchCharCombat" placeholder="Filtrar..." oninput="filterCombatSelect('searchCharCombat','selChar')"></div><div class="form-group"><label class="form-label">Personagem</label><select class="form-select" id="selChar" size="6" style="height:180px">${opts}</select></div><div class="form-group"><label class="form-label">Iniciativa</label><input type="number" class="form-input" id="charInit" value="0" min="0"></div><div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px"><button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancelar</button><button class="btn btn-success" onclick="confirmAddChar()">Adicionar</button></div></div></div>`;
        document.body.appendChild(m); window._tempChars = chars;
        m.addEventListener('click', e => { if (e.target === m) m.remove(); });
    } catch (e) { console.error(e); showAlert('❌ Erro', 'danger'); }
};

window.filterCombatSelect = function(searchId, selectId) {
    const s = document.getElementById(searchId).value.toLowerCase();
    const sel = document.getElementById(selectId);
    for (let i = 0; i < sel.options.length; i++) {
        const o = sel.options[i];
        o.style.display = (o.text.toLowerCase().includes(s) || (o.dataset.name||'').includes(s)) ? '' : 'none';
    }
    for (let i = 0; i < sel.options.length; i++) { if (sel.options[i].style.display !== 'none') { sel.selectedIndex = i; break; } }
};

window.confirmAddChar = function() {
    const id = document.getElementById('selChar').value;
    const init = parseInt(document.getElementById('charInit').value) || 0;
    const c = window._tempChars.find(x => x.id === id); if (!c) return;
    const f = c.fields || {}; const d = c.dots || {};
    const nome = f.nome || c.nome || 'Sem nome';
    const raca = f.raca || c.raca || '-';
    const classe = f.classe || c.classe || '-';
    // Status Vitais: lê valores pré-calculados do documento (a ficha salva hpMax/enerMax/sanMax
    // via mecânicas do Firebase). Fallback legado para fichas ainda não recalculadas.
    const vitMax = c.hpMax || ((d.vig || c.vig || 1) + (d.tamanho || c.tamanho || 5));
    const enerMax = c.enerMax || ((d.prs || c.prs || 1) + (d.aut || c.aut || 1));
    const sanMax = c.sanMax || 100;
    const pid = 'char-' + Date.now();
    S.combatParticipants.push({ id: pid, characterId: id, name: nome, type: 'Jogador', initiative: init, details: `${raca} - ${classe}`, hpCurrent: c.hpCurrent !== undefined ? c.hpCurrent : vitMax, hpMax: vitMax, enerCurrent: c.enerCurrent !== undefined ? c.enerCurrent : enerMax, enerMax: enerMax, sanCurrent: c.sanCurrent !== undefined ? c.sanCurrent : sanMax, sanMax: sanMax });
    setupCombatListener(id, pid);
    renderCombatList(); document.querySelector('.modal.active')?.remove();
    showAlert('✅ Jogador adicionado!', 'success');
};

function setupCombatListener(charId, pid) {
    const unsub = onSnapshot(doc(db, 'char', charId), snap => {
        if (!snap.exists()) return;
        const d = snap.data(), f = d.fields || {}, dt = d.dots || {};
        const p = S.combatParticipants.find(x => x.id === pid); if (!p) return;
        // Status Vitais: lê valores pré-calculados do documento (mecânicas do Firebase).
        // Fallback legado para fichas que ainda não possuem hpMax/enerMax/sanMax salvos.
        const vm = d.hpMax || ((dt.vig || d.vig || 1) + (dt.tamanho || d.tamanho || 5));
        const em = d.enerMax || ((dt.prs || d.prs || 1) + (dt.aut || d.aut || 1));
        const sm = d.sanMax || 100;
        p.hpCurrent = d.hpCurrent !== undefined ? d.hpCurrent : vm; p.hpMax = vm;
        p.enerCurrent = d.enerCurrent !== undefined ? d.enerCurrent : em; p.enerMax = em;
        p.sanCurrent = d.sanCurrent !== undefined ? d.sanCurrent : sm; p.sanMax = sm;
        p.name = f.nome || d.nome || p.name;
        // condições da FICHA (local, prefixo __ não vai para o banco) — é o que
        // deixa a lista daqui mostrar o mesmo que a janela do Tabuleiro
        const condsAntes = JSON.stringify(p.__conds || []);
        p.__conds = (d.conditions || []).map(c => c?.nome).filter(Boolean);
        updateParticipantStats(pid);
        // repinte inteiro SÓ quando a lista de condições muda: a ficha salva
        // sozinha o tempo todo e redesenhar a lista a cada save roubaria o foco
        // de quem estiver digitando iniciativa ou habilidades aqui.
        if (JSON.stringify(p.__conds) !== condsAntes) pintarCombate();
        persistCombat();
    }); combatListeners[pid] = unsub;
}

function setupCombatNpcListener(npcId, pid) {
    const unsub = onSnapshot(doc(db, 'npcs', npcId), snap => {
        if (!snap.exists()) return;
        const n = snap.data();
        const p = S.combatParticipants.find(x => x.id === pid); if (!p) return;
        
        const vd = n.valoresDer || {};
        const atual = vd.atual || {};
        const vitMax = vd.VIT || p.hpMax;
        const enerMax = vd.ENER || p.enerMax;
        const sanMax = vd.SAN || p.sanMax;
        
        p.hpCurrent = (atual.VIT !== undefined && atual.VIT !== null) ? Math.min(atual.VIT, vitMax) : vitMax; p.hpMax = vitMax;
        p.enerCurrent = (atual.ENER !== undefined && atual.ENER !== null) ? Math.min(atual.ENER, enerMax) : enerMax; p.enerMax = enerMax;
        p.sanCurrent = (atual.SAN !== undefined && atual.SAN !== null) ? Math.min(atual.SAN, sanMax) : sanMax; p.sanMax = sanMax;
        p.name = n.nome || p.name;
        const condsAntes = JSON.stringify(p.__conds || []);
        p.__conds = (n.conditions || []).map(c => c?.nome).filter(Boolean);

        updateParticipantStats(pid);
        if (JSON.stringify(p.__conds) !== condsAntes) pintarCombate();
        persistCombat();
    });
    combatListeners[pid] = unsub;
}

function updateParticipantStats(pid) {
    const p = S.combatParticipants.find(x => x.id === pid); if (!p) return;
    ['vit','ener','san'].forEach(stat => {
        const cur = stat === 'vit' ? p.hpCurrent : stat === 'ener' ? p.enerCurrent : p.sanCurrent;
        const max = stat === 'vit' ? p.hpMax : stat === 'ener' ? p.enerMax : p.sanMax;
        const pct = max > 0 ? (cur/max)*100 : 0;
        const el = document.getElementById(`combat-${stat}-${pid}`);
        const fill = document.getElementById(`combat-${stat}-fill-${pid}`);
        if (el) el.textContent = `${vNum(cur)}/${vNum(max)}`;
        if (fill) { fill.style.width = pct + '%'; if (stat === 'vit') fill.style.background = pct <= 25 ? 'linear-gradient(90deg,#dc2626,#ef4444)' : 'linear-gradient(90deg,#10b981,#34d399)'; if (stat === 'san') fill.style.background = pct <= 25 ? 'linear-gradient(90deg,#dc2626,#ef4444)' : 'linear-gradient(90deg,#6366f1,#8b5cf6)'; }
    });
}

// ===== ADD NPC =====
window.addNpcToCombat = async function() {
    try {
        const snap = await getDocs(collection(db, 'npcs'));
        const npcs = []; snap.forEach(d => npcs.push({ id: d.id, ...d.data() }));
        if (!npcs.length) { showAlert('❌ Nenhum NPC', 'danger'); return; }
        const opts = npcs.map(n => `<option value="${n.id}" data-name="${(n.nome||'').toLowerCase()}">${n.nome} (${n.tipo||'NPC'})</option>`).join('');
        const m = document.createElement('div'); m.className = 'modal active';
        m.innerHTML = `<div class="modal-content" style="max-width:500px"><div class="modal-header"><span class="modal-title">Adicionar NPC/Criatura</span><button class="modal-close" onclick="this.closest('.modal').remove()">✕</button></div><div class="modal-body"><div class="form-group"><label class="form-label">🔍 Buscar</label><input type="text" class="form-input" id="searchNpcCombat" placeholder="Filtrar..." oninput="filterCombatSelect('searchNpcCombat','selNpc')"></div><div class="form-group"><label class="form-label">NPC/Criatura</label><select class="form-select" id="selNpc" size="6" style="height:180px">${opts}</select></div><div class="form-group"><label class="form-label">Iniciativa</label><input type="number" class="form-input" id="npcInit" value="0" min="0"></div><div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px"><button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancelar</button><button class="btn btn-success" onclick="confirmAddNpc()">Adicionar</button></div></div></div>`;
        document.body.appendChild(m); window._tempNpcs = npcs;
        m.addEventListener('click', e => { if (e.target === m) m.remove(); });
    } catch (e) { console.error(e); showAlert('❌ Erro', 'danger'); }
};

window.confirmAddNpc = function() {
    const id = document.getElementById('selNpc').value;
    const init = parseInt(document.getElementById('npcInit').value) || 0;
    const n = window._tempNpcs.find(x => x.id === id); if (!n) return;
    
    const vd = n.valoresDer || {};
    const atual = vd.atual || {};
    
    const vitMax = vd.VIT || 10;
    const enerMax = vd.ENER || 5;
    const sanMax = vd.SAN || 100;
    
    const vitCur = (atual.VIT !== undefined && atual.VIT !== null) ? Math.min(atual.VIT, vitMax) : vitMax;
    const enerCur = (atual.ENER !== undefined && atual.ENER !== null) ? Math.min(atual.ENER, enerMax) : enerMax;
    const sanCur = (atual.SAN !== undefined && atual.SAN !== null) ? Math.min(atual.SAN, sanMax) : sanMax;

    const pid = 'npc-' + Date.now();
    S.combatParticipants.push({ 
        id: pid, npcId: id, name: n.nome, type: n.tipo === 'criatura' ? 'Criatura' : 'NPC', 
        initiative: init, details: `${n.raca||'N/A'} | ${n.papel||'-'}`, 
        hpCurrent: vitCur, hpMax: vitMax, enerCurrent: enerCur, enerMax: enerMax, sanCurrent: sanCur, sanMax: sanMax, 
        isNpc: true 
    });
    setupCombatNpcListener(id, pid);
    renderCombatList(); document.querySelector('.modal.active')?.remove();
    showAlert('✅ NPC adicionado!', 'success');
};

// ===== ADD CUSTOM =====
window.addCustomToCombat = function() {
    const m = document.createElement('div'); m.className = 'modal active';
    m.innerHTML = `<div class="modal-content" style="max-width:600px"><div class="modal-header"><span class="modal-title">Inimigo Personalizado</span><button class="modal-close" onclick="this.closest('.modal').remove()">✕</button></div><div class="modal-body"><div class="form-group"><label class="form-label">Nome *</label><input type="text" class="form-input" id="custName" placeholder="Ex: Goblin"></div><div class="form-group"><label class="form-label">Detalhes</label><input type="text" class="form-input" id="custDetails" placeholder="Tipo, Papel..."></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px"><div class="form-group" style="margin:0"><label class="form-label">⚔️ Iniciativa</label><input type="number" class="form-input" id="custInit" value="0" style="text-align:center"></div><div class="form-group" style="margin:0"><label class="form-label">❤️ VIT</label><input type="number" class="form-input" id="custVIT" value="10" style="text-align:center"></div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px"><div class="form-group" style="margin:0"><label class="form-label">🔥 ENER</label><input type="number" class="form-input" id="custENER" value="5" style="text-align:center"></div><div class="form-group" style="margin:0"><label class="form-label">🧠 SAN</label><input type="number" class="form-input" id="custSAN" value="50" style="text-align:center"></div></div><div class="form-group"><label class="form-label">⚔️ Habilidades</label><textarea class="form-textarea" id="custAbil" rows="3" placeholder="Ataques, resistências..."></textarea></div><div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px"><button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancelar</button><button class="btn btn-success" onclick="confirmAddCustom()">Adicionar</button></div></div></div>`;
    document.body.appendChild(m);
    m.addEventListener('click', e => { if (e.target === m) m.remove(); });
};

window.confirmAddCustom = function() {
    const name = document.getElementById('custName').value.trim();
    if (!name) { showAlert('❌ Insira um nome', 'danger'); return; }
    const vit = parseInt(document.getElementById('custVIT').value)||10, ener = parseInt(document.getElementById('custENER').value)||5, san = parseInt(document.getElementById('custSAN').value)||50;
    S.combatParticipants.push({ id: 'custom-' + Date.now(), name, type: 'Inimigo', initiative: parseInt(document.getElementById('custInit').value)||0, details: document.getElementById('custDetails').value.trim()||'Personalizado', hpCurrent: vit, hpMax: vit, enerCurrent: ener, enerMax: ener, sanCurrent: san, sanMax: san, combatAbilities: document.getElementById('custAbil').value.trim(), isCustom: true });
    renderCombatList(); document.querySelector('.modal.active')?.remove();
    showAlert('✅ Inimigo adicionado!', 'success');
};

// ===== COMBAT CONTROLS =====
window.adjustCombatStat = function(pid, stat, amt, ev) {
    if (ev) ev.stopPropagation();
    const p = S.combatParticipants.find(x => x.id === pid); if (!p) return;
    if (stat === 'vit') p.hpCurrent = vNum(Math.max(0, Math.min(p.hpCurrent + amt, p.hpMax)));
    else if (stat === 'ener') p.enerCurrent = vNum(Math.max(0, Math.min(p.enerCurrent + amt, p.enerMax)));
    else if (stat === 'san') p.sanCurrent = vNum(Math.max(0, Math.min(p.sanCurrent + amt, p.sanMax)));
    updateParticipantStats(pid);
    persistCombat();

    // ===== Sincronização bidirecional: Combat → Ficha/NPC =====
    const curMap = { vit: 'hpCurrent', ener: 'enerCurrent', san: 'sanCurrent' };
    const atualMap = { vit: 'vit_atual', ener: 'ener_atual', san: 'san_atual' };
    const siglaMap = { vit: 'VIT', ener: 'ENER', san: 'SAN' };
    const novoVal = stat === 'vit' ? p.hpCurrent : stat === 'ener' ? p.enerCurrent : p.sanCurrent;

    // Personagem de jogador → atualizar doc char
    if (p.characterId) {
        updateDoc(doc(db, 'char', p.characterId), {
            [curMap[stat]]: novoVal,
            [`derivedValues.${atualMap[stat]}`]: String(novoVal)
        }).catch(e => console.warn('sync char stat', e));
    }

    // NPC → atualizar doc npcs (legacy + system key)
    if (p.npcId) {
        (async () => {
            try {
                const npcSnap = await getDoc(doc(db, 'npcs', p.npcId));
                if (!npcSnap.exists()) return;
                const npcData = npcSnap.data();
                const atualObj = npcData.valoresDer?.atual || {};
                const legacyKey = siglaMap[stat]; // VIT, ENER ou SAN
                const patch = { [`valoresDer.atual.${legacyKey}`]: novoVal };
                // Também atualizar chaves do sistema que existam no atual
                // (chaves que NÃO são legacy e cujo valor antigo coincidia com o legacy)
                const LEGACY_KEYS = new Set(['VIT','ENER','SAN','PERC','INI','REA','BLD']);
                for (const [k, v] of Object.entries(atualObj)) {
                    if (LEGACY_KEYS.has(k)) continue;
                    // Se o valor dessa chave do sistema é igual ao antigo valor legacy,
                    // ou se ela corresponde à sigla (prefixo normalizado)
                    const nomeNorm = k.toLowerCase().replace(/[^a-z]/g, '');
                    const sigNorm = legacyKey.toLowerCase();
                    if (nomeNorm.startsWith(sigNorm) || nomeNorm.startsWith(sigNorm === 'vit' ? 'vitalidade' : sigNorm === 'ener' ? 'energia' : 'sanidade')) {
                        patch[`valoresDer.atual.${k}`] = novoVal;
                    } else if (v === atualObj[legacyKey]) {
                        // Fallback: se o valor é idêntico ao legacy antigo, é provável espelho
                        patch[`valoresDer.atual.${k}`] = novoVal;
                    }
                }
                await updateDoc(doc(db, 'npcs', p.npcId), patch);
            } catch (e) { console.warn('sync npc stat', e); }
        })();
    }
};

/**
 * Restaura VIT/ENER/SAN de um participante ao máximo.
 * Exclusivo do Mestre — a ficha do jogador não tem esse atalho.
 * Delega em adjustCombatStat para reusar toda a sincronização
 * (doc char / doc npcs) que ela já faz.
 */
window.restoreCombatStats = async function(pid, ev) {
    if (ev) ev.stopPropagation();
    const p = S.combatParticipants.find(x => x.id === pid); if (!p) return;
    if (!await confirmar(`Restaurar ❤️ VIT, 🔥 ENER e 🧠 SAN de "${p.name}" ao máximo?`)) return;
    window.adjustCombatStat(pid, 'vit', (p.hpMax || 0) - (p.hpCurrent || 0));
    window.adjustCombatStat(pid, 'ener', (p.enerMax || 0) - (p.enerCurrent || 0));
    window.adjustCombatStat(pid, 'san', (p.sanMax || 0) - (p.sanCurrent || 0));
    showAlert(`✅ Status de ${p.name} restaurados`, 'success');
};

window.updateInitiative = function(pid, v) { const p = S.combatParticipants.find(x => x.id === pid); if (p) p.initiative = parseInt(v)||0; persistCombat(); };
window.updateCustomAbilities = function(pid, v) { const p = S.combatParticipants.find(x => x.id === pid); if (p) p.combatAbilities = v; persistCombat(); };

window.sortCombatByInitiative = function() { S.combatParticipants.sort((a, b) => b.initiative - a.initiative); renderCombatList(); showAlert('✅ Ordenado!', 'success'); };

window.clearCombat = async function() {
    if (!await confirmar('Limpar toda a lista de combate?', { perigo: true })) return;
    Object.values(combatListeners).forEach(u => { if (typeof u === 'function') u(); }); combatListeners = {};
    S.setCombatParticipants([]); renderCombatList(); showAlert('✅ Limpo!', 'success');
};

window.removeFromCombat = function(pid) {
    if (combatListeners[pid]) { combatListeners[pid](); delete combatListeners[pid]; }
    S.setCombatParticipants(S.combatParticipants.filter(p => p.id !== pid)); renderCombatList(); showAlert('✅ Removido', 'success');
};

window.openCombatNpcModal = function(pid) { const p = S.combatParticipants.find(x => x.id === pid); if (p?.npcId && window.openNpcEditModal) window.openNpcEditModal(p.npcId); };

// ===== RENDER =====
/** Redesenha E grava — é o caminho de quem MEXEU na lista aqui. */
export function renderCombatList() {
    persistCombat();
    pintarCombate();
}

/** Só redesenha. Quem veio de fora (listener) não pode regravar o que recebeu. */
function pintarCombate() {
    // Selo com o nº de participantes na sub-aba ⚔️ Combate. Fica aqui, e não em
    // `renderCombatList`, porque o listener do Tabuleiro entra direto por esta
    // função — é por aqui que TODO repinte passa.
    window._mesaAtualizarSelos?.();
    const el = document.getElementById('combatList'); if (!el) return;
    const cenas = barraDeCenas();
    if (!S.combatParticipants.length) { el.innerHTML = cenas + '<div class="no-combat">Nenhum participante nesta cena</div>'; return; }
    el.innerHTML = cenas + S.combatParticipants.map(p => {
        const isPlayer = p.type === 'Jogador', isNpc = p.isNpc === true, isCustom = p.isCustom === true;
        const hasStats = isPlayer || isNpc || isCustom, hasCtrl = isNpc || isCustom;
        let stats = '', abil = '';
        if (hasStats) {
            const vp = p.hpMax > 0 ? (p.hpCurrent/p.hpMax)*100 : 0, ep = p.enerMax > 0 ? (p.enerCurrent/p.enerMax)*100 : 0, sp = p.sanMax > 0 ? (p.sanCurrent/p.sanMax)*100 : 0;
            const vc = vp <= 25 ? 'linear-gradient(90deg,#dc2626,#ef4444)' : 'linear-gradient(90deg,#10b981,#34d399)';
            const sc = sp <= 25 ? 'linear-gradient(90deg,#dc2626,#ef4444)' : 'linear-gradient(90deg,#6366f1,#8b5cf6)';
            const btn = (stat, id) => hasCtrl ? `<button class="combat-stat-btn" onclick="adjustCombatStat('${p.id}','${stat}',-1,event)">−</button>` : '';
            const btnP = (stat, id) => hasCtrl ? `<button class="combat-stat-btn" onclick="adjustCombatStat('${p.id}','${stat}',1,event)">+</button>` : '';
            stats = `<div class="combat-stats">
                <div class="combat-stat-item ${hasCtrl?'combat-stat-npc':''}">${btn('vit')}<span class="combat-stat-label">❤️ VIT</span><div class="combat-stat-bar"><div class="combat-stat-fill" id="combat-vit-fill-${p.id}" style="width:${vp}%;background:${vc}"></div></div><span class="combat-stat-value" id="combat-vit-${p.id}">${vNum(p.hpCurrent)}/${vNum(p.hpMax)}</span>${btnP('vit')}</div>
                <div class="combat-stat-item ${hasCtrl?'combat-stat-npc':''}">${btn('ener')}<span class="combat-stat-label">🔥 ENER</span><div class="combat-stat-bar"><div class="combat-stat-fill" id="combat-ener-fill-${p.id}" style="width:${ep}%;background:linear-gradient(90deg,#f59e0b,#fbbf24)"></div></div><span class="combat-stat-value" id="combat-ener-${p.id}">${vNum(p.enerCurrent)}/${vNum(p.enerMax)}</span>${btnP('ener')}</div>
                <div class="combat-stat-item ${hasCtrl?'combat-stat-npc':''}">${btn('san')}<span class="combat-stat-label">🧠 SAN</span><div class="combat-stat-bar"><div class="combat-stat-fill" id="combat-san-fill-${p.id}" style="width:${sp}%;background:${sc}"></div></div><span class="combat-stat-value" id="combat-san-${p.id}">${vNum(p.sanCurrent)}/${vNum(p.sanMax)}</span>${btnP('san')}</div>
            </div>`;
        }
        if (isCustom) abil = `<div class="combat-abilities-container" onclick="event.stopPropagation()"><label class="combat-abilities-label">⚔️ Habilidades:</label><textarea class="combat-abilities-input" onchange="updateCustomAbilities('${p.id}',this.value)">${p.combatAbilities||''}</textarea></div>`;
        const click = isNpc ? `onclick="openCombatNpcModal('${p.id}')" style="cursor:pointer"` : '';
        const cls = isCustom ? 'combat-participant-custom' : isNpc ? 'combat-participant-npc' : '';
        const npcHint = isNpc ? '<span style="font-size:.7rem;color:var(--lr-text-2);margin-left:5px">📋 detalhes</span>' : '';
        const btnRestore = hasStats ? `<button class="btn btn-secondary btn-small" onclick="restoreCombatStats('${p.id}',event)" title="Restaurar VIT/ENER/SAN ao máximo">🛌</button>` : '';
        // Condições: as do combate (aplicadas no Tabuleiro) + as da ficha. Aqui é
        // leitura — quem aplica e tira é o Tabuleiro ou a ficha, e as duas pontas
        // escrevem nos mesmos docs, então isto reflete na hora.
        // condição nova é objeto {nome, icone, expiraNaRodada}; a legada é string
        const conds = [...new Set([...(p.condicoes || []).map(c => (c && c.nome) || c), ...(p.__conds || [])])];
        const condsHtml = conds.length
            ? `<div class="combat-conds">${conds.map(c => `<span class="combat-cond">${escapeHtml(c)}</span>`).join('')}</div>`
            : '';
        return `<div class="combat-participant ${cls}" ${click}><div class="combat-initiative"><div class="combat-initiative-value">${p.initiative}</div><div class="combat-initiative-label">Iniciativa</div></div><div style="flex:1"><div class="combat-name">${escapeHtml(p.name)}${npcHint}</div><span class="combat-type">${p.type}</span><div class="combat-details">${escapeHtml(p.details||'')}</div>${stats}${condsHtml}${abil}</div><div class="combat-actions" onclick="event.stopPropagation()"><input type="number" class="combat-initiative-input" value="${p.initiative}" onchange="updateInitiative('${p.id}',this.value)">${btnRestore}<button class="btn btn-danger btn-small" onclick="removeFromCombat('${p.id}')">🗑️</button></div></div>`;
    }).join('');
}
