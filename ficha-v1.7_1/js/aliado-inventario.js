/* =====================================================================
   ALIADO INVENTÁRIO — Ficha de Personagem > Aliados > Ficha do Aliado
   =====================================================================
   Dá ao jogador as MESMAS permissões de criação/gerenciamento de itens
   que ele tem para o próprio personagem, agora aplicadas ao NPC aliado:
   criar, editar, excluir, equipar (usando as partes do corpo do NPC)
   e transferir itens.

   - Itens ficam na coleção 'items' com characterId = npcId.
   - Logs seguem a lógica do CharLogger (coleção 'logs', categoria
     'Inventário'), sempre citando o aliado no texto da ação.
   - Transferência: o jogador pode enviar para o SEU personagem,
     personagens/Caixa do Mestre da sua mesa e para aliados permitidos
     (seus próprios aliados ou aliados de personagens da mesma mesa).
===================================================================== */
(function () {
    'use strict';

    const FIRESTORE_URL = 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

    /* ♻️ Restaurar item ao cadastro. shared/restaurar-item.js é MÓDULO e este
       arquivo é script clássico: entra por import dinâmico e fica em cache
       aqui. Se falhar, o botão só não aparece — nada quebra. */
    let _RI = null;
    import('../../shared/restaurar-item.js?v=1')
        .then(m => { _RI = m; })
        .catch(e => console.error('❌ shared/restaurar-item.js não carregou:', e));

    const _catalogo = () => window._systemData?.equipment || window._inventoryState?.catalog || [];

    const TIPO_EMOJI = {
        'Arma': '⚔️', 'Vestimenta': '🧥', 'Acessório': '💍', 'Projétil': '🎯',
        'Container': '📦', 'Objeto': '📦', 'Consumível': '🧪', 'Relíquia': '✨'
    };
    const _emoji = t => TIPO_EMOJI[t] || '📦';

    const EQUIP_STATES = {
        empunhado: { label: 'Empunhado', icon: '✊', forma: 'empunhar' },
        segurar:   { label: 'Segurado',  icon: '🖐️', forma: 'segurar' },
        vestido:   { label: 'Vestido',   icon: '👕', forma: 'vestir' },
        fixado:    { label: 'Fixado',    icon: '📌', forma: 'fixar' }
    };

    const AI = {
        npc: null,      // NPC aliado atualmente aberto
        items: []       // Itens do aliado (characterId == npc.id)
    };
    window._aliadoInvState = AI;

    function esc(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    function _npcNome() { return AI.npc?.nome || 'Aliado'; }

    /* ============ LOG (mesma lógica do CharLogger) ============ */
    function _log(action, changes) {
        if (!window.CharLogger) return;
        try {
            window.CharLogger.logEvent({
                category: 'Inventário',
                action,
                changes: changes || []
            });
        } catch (e) { /* ignore */ }
    }

    /* ============ PARTES DO CORPO DO ALIADO ============ */
    function _aliadoBodyParts() {
        // Partes definidas pelo Mestre no NPC; fallback: anatomia padrão do sistema
        if (Array.isArray(AI.npc?.partesDoCorpo) && AI.npc.partesDoCorpo.length > 0) {
            return AI.npc.partesDoCorpo;
        }
        return (window._systemData?.bodyParts || []).filter(bp => bp.ehPadrao)
            .map(bp => ({ ...bp, slots: bp.slots || 1 }));
    }

    function _bodySlots() {
        const slots = {};
        _aliadoBodyParts().forEach(bp => {
            const qty = Math.max(1, parseInt(bp.slots) || 1);
            for (let i = 0; i < qty; i++) {
                const key = qty > 1 ? `${bp.id}_${i + 1}` : bp.id;
                // partId é o que shared/equip-slots.js espera
                slots[key] = { label: qty > 1 ? `${bp.nome} ${i + 1}` : bp.nome, icon: bp.icone || '🦴', part: bp, partId: bp.id };
            }
        });
        return slots;
    }

    /* ============ FIRESTORE HELPERS ============ */
    async function _fs() { return import(FIRESTORE_URL); }

    async function _loadItems() {
        if (!AI.npc?.id || !window.db) return;
        const { collection, getDocs, query, where } = await _fs();
        const q = query(collection(window.db, 'items'), where('characterId', '==', AI.npc.id));
        const snap = await getDocs(q);
        const items = [];
        snap.forEach(d => items.push({ id: d.id, ...d.data() }));
        AI.items = items;
    }

    /* ============ ABERTURA / RENDER PRINCIPAL ============ */
    window.renderAliadoInventario = async function (npc) {
        AI.npc = npc;
        const root = document.getElementById('aliadoInvRoot');
        if (!root) return;
        root.innerHTML = '<div style="color:var(--muted);font-size:.85rem;padding:8px">⏳ Carregando inventário do aliado...</div>';
        try {
            await _loadItems();
            _renderList();
        } catch (e) {
            console.error('❌ Erro ao carregar inventário do aliado:', e);
            root.innerHTML = '<div style="color:var(--danger)">❌ Erro ao carregar o inventário do aliado.</div>';
        }
    };

    function _itemPressure(item) {
        const base = item.pressaoOverride != null ? item.pressaoOverride
            : (item.pressaoBase != null ? item.pressaoBase : (item.peso || 0));
        if (item.ehContainer) {
            const inside = AI.items.filter(i => i.parentItemId === item.id);
            const w = inside.reduce((s, i) => s + ((i.peso || 0) * Math.max(1, parseInt(i.quantidade) || 1)), 0);
            return base + (w * (item.multiplicadorPressao || 1));
        }
        return base * Math.max(1, parseInt(item.quantidade) || 1);
    }

    function _renderList() {
        const root = document.getElementById('aliadoInvRoot');
        if (!root) return;

        const top = AI.items.filter(i => !i.parentItemId);
        const equipped = top.filter(i => i.equipado);
        const loose = top.filter(i => !i.equipado);
        const inside = AI.items.filter(i => i.parentItemId);
        const pressao = equipped.reduce((s, i) => s + _itemPressure(i), 0);
        const slots = _bodySlots();

        const partes = _aliadoBodyParts();
        const partesHtml = partes.length
            ? partes.map(bp => `<span style="display:inline-block;background:rgba(139,92,246,.12);border:1px solid rgba(139,92,246,.3);border-radius:6px;padding:2px 8px;margin:2px;font-size:.78rem">${bp.icone || '🦴'} ${esc(bp.nome)}${(bp.slots || 1) > 1 ? ` ×${bp.slots}` : ''}</span>`).join('')
            : '<span style="color:var(--muted);font-size:.8rem">Nenhuma parte do corpo definida (o Mestre gerencia a anatomia no Painel).</span>';

        const row = (item, isEq) => {
            const img = item.imagem || item.imagemUrl;
            const slotLbl = isEq && item.slotAnatomico ? (slots[item.slotAnatomico]?.label || item.slotAnatomico) : '';
            const estado = isEq && item.estadoEquip ? (EQUIP_STATES[item.estadoEquip]?.label || item.estadoEquip) : '';
            return `<div class="inv-item-row ${isEq ? 'inv-equipped' : ''}" style="display:flex;align-items:center;padding:8px;gap:6px">
                ${img ? `<img src="${esc(img)}" style="max-height:1.5em;border-radius:4px;object-fit:contain">` : `<span>${_emoji(item.tipo)}</span>`}
                <div class="inv-item-info" style="flex:1">
                    <span class="inv-item-name">${esc(item.nome || 'Sem nome')}</span>
                    <span class="inv-item-meta">${esc(item.tipo || '')} | Peso: ${parseFloat(item.peso || 0).toFixed(2)}${slotLbl ? ' | ' + esc(slotLbl) : ''}${estado ? ' | ' + estado : ''}</span>
                </div>
                <span class="inv-badge inv-badge-qty">×${Math.max(1, parseInt(item.quantidade) || 1)}</span>
                <div class="inv-item-actions" onclick="event.stopPropagation()" style="display:flex;gap:4px">
                    ${isEq
                        ? `<button class="inv-btn" title="Desequipar" onclick="AliadoInventario.unequip('${item.id}')">⬇️</button>`
                        : `<button class="inv-btn" title="Equipar" onclick="AliadoInventario.openEquip('${item.id}')">⬆️</button>`}
                    <button class="inv-btn" style="background:rgba(6,182,212,.12);color:var(--lr-arcane)" title="Transferir" onclick="AliadoInventario.openTransfer('${item.id}')">🔄</button>
                    <button class="inv-btn" style="background:rgba(139,92,246,.12);color:var(--primary,#8b5cf6)" title="Editar" onclick="AliadoInventario.openForm('${item.id}')">✏️</button>
                    <button class="inv-btn inv-btn-delete" title="Excluir" onclick="AliadoInventario.remove('${item.id}')">🗑️</button>
                </div>
            </div>`;
        };

        let html = `
        <div style="margin-bottom:12px">
            <div style="font-weight:700;font-size:.85rem;color:var(--muted);margin-bottom:4px">🦴 Partes do corpo do aliado (slots de equipamento)</div>
            <div>${partesHtml}</div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <span class="inv-badge" style="background:rgba(245,158,11,.15);color:var(--lr-gold);padding:3px 10px;border-radius:8px;font-size:.78rem;font-weight:700">⚖️ Pressão (equipados): ${pressao.toFixed(2)}</span>
            <button class="btn" style="background:#256B42;color:#fff;border-color:#256B42" onclick="AliadoInventario.openForm(null)">➕ Criar Item</button>
        </div>
        <div class="inv-section"><div class="inv-section-title">🎒 Equipados <span class="inv-section-count">${equipped.length}</span></div><div class="inv-section-grid">
            ${equipped.length ? equipped.map(i => row(i, true)).join('') : '<div class="inv-empty-small">Nenhum item equipado</div>'}
        </div></div>
        <div class="inv-section" style="margin-top:12px"><div class="inv-section-title">📋 Itens Soltos <span class="inv-section-count">${loose.length}</span></div><div class="inv-section-grid">
            ${loose.length ? loose.map(i => row(i, false)).join('') : '<div class="inv-empty-small">Nenhum item solto</div>'}
        </div></div>`;

        if (inside.length) {
            html += `<div class="inv-section" style="margin-top:12px"><div class="inv-section-title">📂 Dentro de Containers <span class="inv-section-count">${inside.length}</span></div><div class="inv-section-grid">
                ${inside.map(i => row(i, false)).join('')}
            </div></div>`;
        }

        root.innerHTML = html;
    }

    /* ============ CRIAR / EDITAR ITEM ============ */

    const TIPOS_ITEM = ['Objeto', 'Arma', 'Vestimenta', 'Acessório', 'Projétil', 'Container', 'Consumível', 'Relíquia'];
    const FORMAS_EQUIPAR = [['', '— Livre —'], ['segurar', 'Segurar'], ['empunhar', 'Empunhar'], ['vestir', 'Vestir'], ['fixar', 'Fixar']];
    const CATEGORIAS_ARMA = [
        ['uma_mao', '🗡️ Arma de Uma Mão'], ['duas_maos', '⚔️ Arma de Duas Mãos'],
        ['versatil', '🔄 Arma Versátil'], ['escudo', '🛡️ Escudo'], ['distancia', '🏹 Arma a Distância'],
    ];

    /** Arma e contêiner são peça única: não têm campo de quantidade. */
    const _naoEmpilha = (tipo, ehContainer) => tipo === 'Container' || tipo === 'Arma' || !!ehContainer;
    const _ehContainer = (tipo, flag) => tipo === 'Container' || !!flag;

    const _opt = (valor, rotulo, selecionado, extra = '') =>
        `<option value="${valor}"${extra} ${selecionado ? 'selected' : ''}>${rotulo}</option>`;
    const _opts = (pares, atual) => pares.map(([v, rotulo]) => _opt(v, rotulo, v === atual)).join('');

    const _grupo = (label, corpo, attrs = '') =>
        `<div class="inv-form-group"${attrs}><label class="inv-form-label">${label}</label>${corpo}</div>`;
    const _grupoLargo = (label, corpo) =>
        `<div class="inv-form-group inv-form-wide"><label class="inv-form-label">${label}</label>${corpo}</div>`;
    const _numero = (id, valor, extra = '') =>
        `<input type="number" id="${id}" class="inv-form-input" value="${valor}"${extra}>`;
    const _select = (id, opcoes, extra = '') =>
        `<select id="${id}" class="inv-form-select"${extra}>${opcoes}</select>`;

    function openForm(editItemId) {
        if (!AI.npc?.id) return;
        const item = editItemId ? AI.items.find(i => i.id === editItemId) : null;
        const isEdit = !!item;

        const semQtd = _naoEmpilha(item?.tipo, item?.ehContainer);
        const container = _ehContainer(item?.tipo, item?.ehContainer);

        // Uma parte do corpo do aliado por linha; nenhuma marcada = item Livre.
        const partesOpts = _aliadoBodyParts().map(bp => _opt(
            bp.id, `${bp.icone || '🦴'} ${esc(bp.nome)}`,
            Array.isArray(item?.equipavelEm) && item.equipavelEm.includes(bp.id))).join('');

        const campos = [
            _grupoLargo('Nome *', `<input type="text" id="aif_nome" class="inv-form-input" value="${esc(item?.nome || '')}" placeholder="Nome do item">`),
            _grupo('Tipo', _select('aif_tipo',
                TIPOS_ITEM.map(t => _opt(t, `${_emoji(t)} ${t}`, item?.tipo === t)).join(''),
                ' onchange="AliadoInventario._toggleFormFields()"')),
            _grupo('Equipável em (partes do aliado)',
                `<select id="aif_equipavelEm" class="inv-form-select" multiple size="4">${partesOpts}</select>`
                + '<small style="color:var(--muted);font-size:.8rem">Ctrl/Cmd p/ múltiplos. Vazio = Livre.</small>'),
            _grupo('Forma de equipar', _select('aif_formaEquipar', _opts(FORMAS_EQUIPAR, item?.formaEquipar || ''))),
            _grupo('Categoria da Arma *', _select('aif_categoriaArma',
                _opt('', '— Selecione —', !item?.categoriaArma, ' disabled') + _opts(CATEGORIAS_ARMA, item?.categoriaArma)),
                ` id="aif_catArmaGroup" style="display:${item?.tipo === 'Arma' ? 'flex' : 'none'}"`),
            _grupo('Peso', _numero('aif_peso', item?.peso ?? 1, ' min="0" step="0.1"')),
            _grupo('Tamanho', _numero('aif_tamanho', item?.tamanho ?? 1, ' min="0"')),
            _grupo('Quantidade', _numero('aif_quantidade', semQtd ? 1 : (item?.quantidade || 1), ' min="1"'),
                ` id="aif_qtyGroup" style="display:${semQtd ? 'none' : 'flex'}"`),
            `<div id="aif_containerFields" class="inv-form-group inv-form-wide" style="display:${container ? 'grid' : 'none'};grid-template-columns:1fr 1fr;gap:12px">`
            + _grupo('⚖️ Peso Máximo', _numero('aif_pesoMaximo', item?.pesoMaximoContainer || 10, ' min="0" step="0.1"'))
            + _grupo('✖️ Mult. Pressão', _numero('aif_multPressao', item?.multiplicadorPressao || 1, ' min="0" step="0.01"'))
            + '</div>',
            _grupoLargo('Descrição', `<textarea id="aif_desc" class="inv-form-textarea" rows="3">${esc(item?.descricao || '')}</textarea>`),
            _grupoLargo('Imagem', CampoImagem.html({ id: 'aif_imagem', classe: 'inv-form-input', valor: item?.imagem || item?.imagemUrl || '', pasta: 'imagens/itens' })),
        ].join('');

        document.getElementById('aliadoItemFormModal')?.remove();
        const modal = document.createElement('div');
        modal.className = 'inv-modal active';
        modal.id = 'aliadoItemFormModal';
        modal.style.zIndex = '10001';
        modal.innerHTML = `<div class="inv-modal-content" style="max-width:600px">
            <div class="inv-modal-header">
                <span class="inv-modal-title">${isEdit ? '✏️ Editar Item' : '➕ Criar Item'} — ${esc(_npcNome())}</span>
                <button class="inv-modal-close" onclick="this.closest('.inv-modal').remove()">✕</button>
            </div>
            <div class="inv-modal-body">
                <div class="inv-form-grid">${campos}</div>
                ${isEdit ? `<input type="hidden" id="aif_editId" value="${item.id}">` : ''}
            </div>
            <div class="inv-modal-footer">
                ${(isEdit && _RI?.modeloDoItem(item, _catalogo()))
                    ? _RI.botaoRestaurarHTML('AliadoInventario.restaurar()') : ''}
                <button class="inv-btn-cancel" onclick="this.closest('.inv-modal').remove()">Cancelar</button>
                <button class="inv-btn-save" onclick="AliadoInventario.saveForm()">💾 Salvar</button>
            </div>
        </div>`;
        document.body.appendChild(modal);
    }

    function _toggleFormFields() {
        const tipo = document.getElementById('aif_tipo')?.value;
        const cat = document.getElementById('aif_catArmaGroup');
        const qty = document.getElementById('aif_qtyGroup');
        const cont = document.getElementById('aif_containerFields');
        if (cat) cat.style.display = tipo === 'Arma' ? 'flex' : 'none';
        if (cont) cont.style.display = tipo === 'Container' ? 'grid' : 'none';
        if (qty) {
            if (tipo === 'Container' || tipo === 'Arma') {
                qty.style.display = 'none';
                const qi = document.getElementById('aif_quantidade'); if (qi) qi.value = 1;
            } else qty.style.display = 'flex';
        }
    }

    /** ♻️ Joga o cadastro do catálogo por cima do que foi alterado nesta peça. */
    async function restaurar() {
        if (!_RI) return;
        const editId = document.getElementById('aif_editId')?.value || '';
        const item = AI.items.find(i => i.id === editId);
        const tpl = _RI.modeloDoItem(item, _catalogo());
        const patch = _RI.patchRestauracao(tpl);
        if (!patch) { alert('⚠️ Este item não veio do catálogo — não há cadastro a restaurar.'); return; }
        if (!confirm(_RI.textoConfirmacao(item, tpl))) return;
        try {
            const { doc, setDoc } = await _fs();
            await setDoc(doc(window.db, 'items', editId), patch, { merge: true });
            _log(`♻️ Item "${item.nome || ''}" do aliado "${_npcNome()}" restaurado ao cadastro de "${tpl.nome}"`, [
                { label: 'Aliado', from: _npcNome(), to: _npcNome() },
                { label: 'Item', from: item.nome || '', to: tpl.nome || '' }
            ]);
            document.getElementById('aliadoItemFormModal')?.remove();
            await _loadItems();
            _renderList();
        } catch (e) {
            console.error('❌ Erro ao restaurar item do aliado:', e);
            alert('Erro ao restaurar item: ' + e.message);
        }
    }

    async function saveForm() {
        const nome = document.getElementById('aif_nome')?.value?.trim();
        if (!nome) { alert('Nome obrigatório'); return; }
        if (!AI.npc?.id || !window.currentUser) { alert('Erro: aliado ou usuário não carregado'); return; }

        const editId = document.getElementById('aif_editId')?.value || '';
        const tipo = document.getElementById('aif_tipo')?.value || 'Objeto';
        const isContainer = tipo === 'Container';
        const categoriaArma = document.getElementById('aif_categoriaArma')?.value || null;
        if (tipo === 'Arma' && !categoriaArma) { alert('Selecione a categoria da arma'); return; }

        const equipOpts = document.getElementById('aif_equipavelEm')?.selectedOptions;
        const equipavelEm = equipOpts ? Array.from(equipOpts).map(o => o.value) : [];
        const old = editId ? AI.items.find(i => i.id === editId) : null;

        const itemData = {
            nome, tipo,
            categoriaArma: tipo === 'Arma' ? categoriaArma : null,
            peso: parseFloat(document.getElementById('aif_peso')?.value) || 1,
            tamanho: parseInt(document.getElementById('aif_tamanho')?.value) || 1,
            quantidade: (isContainer || tipo === 'Arma') ? 1 : Math.max(1, parseInt(document.getElementById('aif_quantidade')?.value) || 1),
            descricao: document.getElementById('aif_desc')?.value?.trim() || '',
            imagem: document.getElementById('aif_imagem')?.value?.trim() || '',
            equipavelEm: equipavelEm.length ? equipavelEm : null,
            formaEquipar: document.getElementById('aif_formaEquipar')?.value || null,
            characterId: AI.npc.id,
            ownerType: 'npc',
            ownerUid: old?.ownerUid || window.currentUser.uid,
            ownerId: old?.ownerId || window.currentUser.uid,
            ehContainer: isContainer,
            pesoMaximoContainer: isContainer ? (parseFloat(document.getElementById('aif_pesoMaximo')?.value) || 10) : null,
            multiplicadorPressao: isContainer ? (parseFloat(document.getElementById('aif_multPressao')?.value) || 1) : null,
            pressaoBase: parseFloat(document.getElementById('aif_peso')?.value) || 1,
            criadoPor: window.isMestre ? 'mestre' : 'jogador',
            lastModified: new Date().toISOString()
        };

        try {
            const { doc, setDoc } = await _fs();
            if (editId) {
                await setDoc(doc(window.db, 'items', editId), itemData, { merge: true });
                _log(`🎒 Item "${nome}" do aliado "${_npcNome()}" editado`, [
                    { label: 'Aliado', from: _npcNome(), to: _npcNome() },
                    { label: 'Item', from: old?.nome || nome, to: nome },
                    { label: 'Quantidade', from: String(old?.quantidade ?? ''), to: String(itemData.quantidade) }
                ]);
            } else {
                itemData.equipado = false;
                itemData.slotAnatomico = null;
                itemData.estadoEquip = null;
                itemData.parentItemId = null;
                const newId = 'item-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
                itemData.id = newId;
                await setDoc(doc(window.db, 'items', newId), itemData);
                _log(`🎒 Item adicionado ao aliado "${_npcNome()}": "${nome}"` + (itemData.quantidade > 1 ? ` (x${itemData.quantidade})` : ''), [
                    { label: 'Aliado', from: '—', to: _npcNome() },
                    { label: 'Item', from: '—', to: nome },
                    { label: 'Tipo', from: '—', to: tipo },
                    { label: 'Quantidade', from: '—', to: String(itemData.quantidade) }
                ]);
            }
            document.getElementById('aliadoItemFormModal')?.remove();
            await _loadItems();
            _renderList();
        } catch (e) {
            console.error('❌ Erro ao salvar item do aliado:', e);
            alert('Erro ao salvar item: ' + e.message);
        }
    }

    async function remove(itemId) {
        const item = AI.items.find(i => i.id === itemId);
        if (!item || !confirm(`Excluir o item "${item.nome || 'item'}" do aliado?`)) return;
        try {
            const { doc, deleteDoc } = await _fs();
            await deleteDoc(doc(window.db, 'items', itemId));
            _log(`🗑️ Item removido do aliado "${_npcNome()}": "${item.nome || '(item)'}"`, [
                { label: 'Aliado', from: _npcNome(), to: _npcNome() },
                { label: 'Item', from: item.nome || '(item)', to: '—' },
                { label: 'Quantidade', from: String(item.quantidade || 1), to: '—' }
            ]);
            await _loadItems();
            _renderList();
        } catch (e) {
            console.error('❌ Erro ao excluir item do aliado:', e);
            alert('Erro ao excluir item: ' + e.message);
        }
    }

    /* ============ EQUIPAR / DESEQUIPAR ============ */
    function openEquip(itemId) {
        const item = AI.items.find(i => i.id === itemId);
        if (!item) return;
        const slots = _bodySlots();
        const slotKeys = Object.keys(slots);
        if (!slotKeys.length) { alert('O aliado não tem partes do corpo definidas. Peça ao Mestre para configurar a anatomia no Painel.'); return; }

        // Item de vários slots bloqueia todos eles, não só o principal.
        const ocupados = new Set(AI.items.filter(i => i.equipado && i.id !== itemId)
            .flatMap(i => window.EquipSlots.slotsDoItem(i)));
        const permitidas = Array.isArray(item.equipavelEm) && item.equipavelEm.length ? new Set(item.equipavelEm) : null;

        const opts = slotKeys.map(k => {
            const s = slots[k];
            const bloq = permitidas && !permitidas.has(s.part.id);
            const ocup = ocupados.has(k);
            return `<option value="${k}" ${bloq || ocup ? 'disabled' : ''}>${s.icon} ${esc(s.label)}${ocup ? ' (ocupado)' : ''}${bloq ? ' (não permitido)' : ''}</option>`;
        }).join('');

        const forma = item.formaEquipar;
        const estadoOpts = Object.entries(EQUIP_STATES).map(([v, s]) => {
            const bloq = forma && s.forma !== forma;
            return `<option value="${v}" ${bloq ? 'disabled' : ''} ${!bloq && forma ? 'selected' : ''}>${s.icon} ${s.label}</option>`;
        }).join('');

        document.getElementById('aliadoEquipModal')?.remove();
        const modal = document.createElement('div');
        modal.className = 'inv-modal active';
        modal.id = 'aliadoEquipModal';
        modal.style.zIndex = '10001';
        modal.innerHTML = `<div class="inv-modal-content" style="max-width:420px">
            <div class="inv-modal-header">
                <span class="inv-modal-title">⬆️ Equipar: ${esc(item.nome || 'Item')}</span>
                <button class="inv-modal-close" onclick="this.closest('.inv-modal').remove()">✕</button>
            </div>
            <div class="inv-modal-body">
                <div class="inv-form-group"><label class="inv-form-label">Slot anatômico</label>
                    <select id="aliadoEquipSlot" class="inv-form-select">${opts}</select></div>
                <div class="inv-form-group" style="margin-top:10px"><label class="inv-form-label">Estado</label>
                    <select id="aliadoEquipEstado" class="inv-form-select">${estadoOpts}</select></div>
                ${window.EquipSlots.escolheMaos(item) ? `
                <div class="inv-form-group" style="margin-top:10px"><label class="inv-form-label">✋ Mãos</label>
                    <select id="aliadoEquipMaos" class="inv-form-select">
                        <option value="1" ${Number(item.maosUsadas) === 2 ? '' : 'selected'}>🤚 1 Mão</option>
                        <option value="2" ${Number(item.maosUsadas) === 2 ? 'selected' : ''}>🤲 2 Mãos</option>
                    </select></div>` : ''}
            </div>
            <div class="inv-modal-footer">
                <button class="inv-btn-cancel" onclick="this.closest('.inv-modal').remove()">Cancelar</button>
                <button class="inv-btn-save" onclick="AliadoInventario.confirmEquip('${itemId}')">✅ Equipar</button>
            </div>
        </div>`;
        document.body.appendChild(modal);
    }

    async function confirmEquip(itemId) {
        const item = AI.items.find(i => i.id === itemId);
        if (!item) return;
        const slot = document.getElementById('aliadoEquipSlot')?.value;
        const estado = document.getElementById('aliadoEquipEstado')?.value;
        if (!slot || !estado) return;

        const maos = Number(document.getElementById('aliadoEquipMaos')?.value)
            || window.EquipSlots.maosDoItem(item);

        const nomeParte = pid => _aliadoBodyParts().find(b => b.id === pid)?.nome || pid;
        const plano = window.EquipSlots.planejarEquipar({ ...item, maosUsadas: maos }, slot, AI.items, _bodySlots(), {
            catalog: window._inventoryState?.catalog,
            labelParte: nomeParte,
        });
        if (plano.faltaMao) {
            alert(`Falta ${plano.faltaMao} livre para empunhar esta arma. Desequipe algo antes.`);
            return;
        }

        try {
            const { doc, setDoc } = await _fs();
            await setDoc(doc(window.db, 'items', itemId), {
                equipado: true, slotAnatomico: slot, slotsOcupados: plano.extras,
                slotAnatomico2: plano.maoExtra, maosUsadas: maos,
                estadoEquip: estado, parentItemId: null,
                lastModified: new Date().toISOString()
            }, { merge: true });
            _log(`🎒 Item "${item.nome}" equipado no aliado "${_npcNome()}"`, [
                { label: 'Equipado', from: 'Não', to: `Sim (${slot} / ${estado})` }
            ]);
            document.getElementById('aliadoEquipModal')?.remove();
            await _loadItems();
            _renderList();
        } catch (e) { console.error(e); alert('Erro ao equipar: ' + e.message); }
    }

    async function unequip(itemId) {
        const item = AI.items.find(i => i.id === itemId);
        if (!item) return;
        try {
            const { doc, setDoc } = await _fs();
            await setDoc(doc(window.db, 'items', itemId), {
                equipado: false, slotAnatomico: null, slotsOcupados: [], estadoEquip: null,
                lastModified: new Date().toISOString()
            }, { merge: true });
            _log(`🎒 Item "${item.nome}" desequipado do aliado "${_npcNome()}"`, [
                { label: 'Equipado', from: 'Sim', to: 'Não' }
            ]);
            await _loadItems();
            _renderList();
        } catch (e) { console.error(e); alert('Erro ao desequipar: ' + e.message); }
    }

    /* ============ TRANSFERÊNCIA (a partir do aliado) ============ */
    async function openTransfer(itemId) {
        const item = AI.items.find(i => i.id === itemId);
        if (!item || !window.currentCharacterId) return;

        document.getElementById('aliadoTransferModal')?.remove();
        const modal = document.createElement('div');
        modal.className = 'inv-modal active';
        modal.id = 'aliadoTransferModal';
        modal.style.zIndex = '10001';
        modal.innerHTML = `<div class="inv-modal-content" style="max-width:500px">
            <div class="inv-modal-header">
                <span class="inv-modal-title">🔄 Transferir: ${esc(item.nome || 'Item')}</span>
                <button class="inv-modal-close" onclick="this.closest('.inv-modal').remove()">✕</button>
            </div>
            <div class="inv-modal-body">
                <div style="text-align:center;padding:30px;color:var(--muted)">⏳ Carregando alvos...</div>
            </div>
        </div>`;
        document.body.appendChild(modal);

        try {
            const { doc, getDoc, collection, getDocs } = await _fs();
            const charId = window.currentCharacterId;

            const charSnap = await getDoc(doc(window.db, 'char', charId));
            const charData = charSnap.exists() ? charSnap.data() : {};
            const mesaId = charData.mesaId || null;
            const meuNome = charData.fields?.nome || charData.nome || 'Meu personagem';

            const targets = [];
            const allowedCharIds = new Set([charId]);

            // 1) Meu próprio personagem (dono do aliado)
            targets.push({ id: charId, nome: `${meuNome} (meu personagem)`, kind: 'char', ownerUid: charData.ownerUid || window.currentUser?.uid || '' });

            // 2) Personagens e Caixa da mesa
            const charSnaps = await getDocs(collection(window.db, 'char'));
            if (mesaId) {
                targets.push({ id: '__caixa_mestre__' + mesaId, nome: 'Caixa do Mestre', kind: 'caixa', isCaixaMestre: true });
                charSnaps.forEach(d => {
                    const data = d.data();
                    if (data.mesaId === mesaId) {
                        allowedCharIds.add(d.id);
                        if (d.id !== charId) {
                            const f = data.fields || {};
                            targets.push({ id: d.id, nome: f.nome || data.nome || 'Sem nome', kind: 'char', ownerUid: data.ownerUid || '', ownerEmail: data.ownerEmail || data.userEmail || '' });
                        }
                    }
                });
            }

            // 3) Aliados permitidos (meus + da mesa), exceto o próprio aliado
            const npcSnaps = await getDocs(collection(window.db, 'npcs'));
            npcSnaps.forEach(d => {
                if (d.id === AI.npc.id) return;
                const n = d.data();
                const vincs = Array.isArray(n.vinculos) ? n.vinculos : [];
                const permitido = vincs.some(v =>
                    v.tipo === 'personagem' &&
                    String(v.relacao || '').toLowerCase() === 'aliado' &&
                    allowedCharIds.has(v.id)
                );
                if (permitido) {
                    targets.push({ id: d.id, nome: n.nome || 'Sem nome', kind: 'npc', ownerEmail: n.papel || (n.tipo === 'criatura' ? 'Criatura aliada' : 'NPC aliado') });
                }
            });

            window._aliadoTransferTargets = {};
            targets.forEach(t => { window._aliadoTransferTargets[t.id] = t; });

            const body = modal.querySelector('.inv-modal-body');
            let qtyHtml = '';
            if ((item.quantidade || 1) > 1) {
                qtyHtml = `<div class="inv-form-group" style="padding:0 15px 15px 15px;border-bottom:1px solid var(--border-color,#334155);margin-bottom:10px">
                    <label class="inv-form-label" style="text-align:center;font-weight:bold">Quantidade a transferir (Máximo: ${item.quantidade})</label>
                    <input type="number" id="aliadoTransferQty" class="inv-form-input" style="text-align:center;font-size:1.2rem;width:100px;margin:0 auto;display:block" value="0" min="0" max="${item.quantidade}">
                </div>`;
            }

            body.innerHTML = `${qtyHtml}<div class="inv-transfer-list">
                ${targets.map(t => `<div class="inv-transfer-target ${t.isCaixaMestre ? 'inv-transfer-target-master' : ''}"
                    onclick="AliadoInventario.executeTransfer('${itemId}','${t.id}')">
                    <div class="inv-transfer-target-name">${t.isCaixaMestre ? '📦' : (t.kind === 'npc' ? '🤝' : '🎭')} ${esc(t.nome)}</div>
                    ${t.ownerEmail ? `<div class="inv-transfer-target-meta">${t.kind === 'npc' ? '' : '👤 '}${esc(t.ownerEmail)}</div>` : ''}
                </div>`).join('')}
            </div>`;
        } catch (e) {
            console.error('❌ Erro ao carregar alvos:', e);
            const body = modal.querySelector('.inv-modal-body');
            if (body) body.innerHTML = `<div style="text-align:center;padding:30px;color:#ef4444">❌ Erro ao carregar alvos: ${esc(e.message)}</div>`;
        }
    }

    async function executeTransfer(itemId, targetId) {
        const item = AI.items.find(i => i.id === itemId);
        const target = (window._aliadoTransferTargets || {})[targetId];
        if (!item || !target) return;

        let transferQty = item.quantidade || 1;
        let partial = false;
        if (transferQty > 1) {
            const qtyInput = document.getElementById('aliadoTransferQty');
            const inputQty = parseInt(qtyInput?.value, 10);
            if (isNaN(inputQty) || inputQty <= 0) { alert('Quantidade inválida ou igual a zero. Informe a quantidade acima da lista de alvos.'); return; }
            if (inputQty > transferQty) { alert('O aliado não possui essa quantidade toda. Transferência cancelada.'); return; }
            if (inputQty < transferQty) partial = true;
            transferQty = inputQty;
        }

        const msg = transferQty > 1
            ? `Transferir ${transferQty}x "${item.nome || 'item'}" para ${target.nome}?`
            : `Transferir "${item.nome || 'item'}" para ${target.nome}?`;
        if (!confirm(msg)) return;

        try {
            const { doc, setDoc, getDoc } = await _fs();
            const updateData = {
                characterId: targetId,
                equipado: false, slotAnatomico: null, slotsOcupados: [], estadoEquip: null, parentItemId: null,
                lastModified: new Date().toISOString()
            };
            if (target.kind === 'npc') {
                updateData.ownerType = 'npc';
            } else if (target.kind === 'caixa') {
                updateData.ownerType = 'caixa';
            } else {
                updateData.ownerType = 'char';
                try {
                    const snap = await getDoc(doc(window.db, 'char', targetId));
                    if (snap.exists()) {
                        const td = snap.data();
                        updateData.ownerUid = td.ownerUid || target.ownerUid || '';
                        updateData.ownerId = td.ownerUid || target.ownerUid || '';
                    }
                } catch (e) { /* ignore */ }
            }

            if (partial) {
                const newId = 'item-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
                const newItemData = { ...item, ...updateData, id: newId, quantidade: transferQty };
                await setDoc(doc(window.db, 'items', newId), newItemData);
                await setDoc(doc(window.db, 'items', itemId), { quantidade: item.quantidade - transferQty, lastModified: new Date().toISOString() }, { merge: true });
            } else {
                await setDoc(doc(window.db, 'items', itemId), updateData, { merge: true });
            }

            _log(`🔁 Item "${item.nome || 'item'}"${transferQty > 1 ? ` (x${transferQty})` : ''} transferido do aliado "${_npcNome()}" para ${target.nome}`, [
                { label: 'Item', from: item.nome || '(item)', to: item.nome || '(item)' },
                { label: 'Quantidade transferida', from: '—', to: String(transferQty) },
                { label: 'Origem', from: `Aliado ${_npcNome()}`, to: '—' },
                { label: 'Destino', from: '—', to: target.nome }
            ]);

            document.getElementById('aliadoTransferModal')?.remove();
            await _loadItems();
            _renderList();

            // Se o destino for o personagem atual, atualiza o inventário da ficha
            if (target.kind === 'char' && targetId === window.currentCharacterId && typeof loadCharacterItems === 'function') {
                loadCharacterItems(window.currentCharacterId);
            }

            alert(`✅ Item "${item.nome}" transferido com sucesso!`);
        } catch (e) {
            console.error('❌ Erro ao transferir item do aliado:', e);
            alert('❌ Erro ao transferir item: ' + e.message);
        }
    }

    /* ============ API PÚBLICA ============ */
    window.AliadoInventario = {
        open: window.renderAliadoInventario,
        openForm, saveForm, restaurar, remove,
        openEquip, confirmEquip, unequip,
        openTransfer, executeTransfer,
        _toggleFormFields
    };
})();
