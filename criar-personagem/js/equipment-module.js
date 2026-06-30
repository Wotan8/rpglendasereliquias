/* ===== PHASE 7 — O Equipamento ===== */

function initPhase7(container) {
    let html = createNarratorBox(NARRADOR_TEXTOS.equipamento);

    // Equipment from class
    const className = wizardState.classeSelecionada;
    const classData = className ? window._systemData.classes.find(c => c.nome === className) : null;
    const equipList = classData?.equipamentoInicial || classData?.equipInicial || [];

    html += `
        <div class="section">
            <div class="section-title">⚔️ Equipamento Inicial da Classe</div>
    `;

    if (equipList.length > 0) {
        html += `<p style="font-size:.85rem;color:var(--muted);margin:0 0 12px;">Marque os itens que deseja levar:</p>`;
        for (const item of equipList) {
            const itemName = typeof item === 'object' ? item.nome : item;
            const checked = wizardState.equipamentoSelecionado.includes(itemName) ? 'checked' : '';
            html += `
                <label style="display:flex;align-items:center;gap:8px;padding:6px 0;cursor:pointer;font-size:.9rem;">
                    <input type="checkbox" ${checked} onchange="toggleEquipItem('${escHtml(itemName)}', this.checked)">
                    <span>${escHtml(itemName)}</span>
                </label>
            `;
        }
    } else {
        html += `<p style="color:var(--muted);font-size:.85rem;">Nenhum equipamento inicial definido para ${escHtml(className || 'esta classe')}. Converse com seu Narrador.</p>`;
    }

    html += `</div>`;

    // Item Customizado (Substitui Objeto Pessoal)
    const slots = [
        {v:'cabeca', l:'Cabeça'}, {v:'pescoco', l:'Pescoço'}, {v:'tronco', l:'Tronco'},
        {v:'ombros', l:'Ombros'}, {v:'costas', l:'Costas'}, {v:'bracos', l:'Braços'},
        {v:'mao_dir', l:'Mão Dir.'}, {v:'mao_esq', l:'Mão Esq.'},
        {v:'dedo_1', l:'Anel 1'}, {v:'dedo_2', l:'Anel 2'}, {v:'dedo_3', l:'Anel 3'},
        {v:'dedo_4', l:'Anel 4'}, {v:'dedo_5', l:'Anel 5'}, {v:'dedo_6', l:'Anel 6'},
        {v:'dedo_7', l:'Anel 7'}, {v:'dedo_8', l:'Anel 8'}, {v:'dedo_9', l:'Anel 9'}, {v:'dedo_10', l:'Anel 10'},
        {v:'cintura', l:'Cintura'}, {v:'pernas', l:'Pernas'}, {v:'pes', l:'Pés'}
    ];
    const restricoes = wizardState.customItem?.slotRestrito || [];
    const slotsOptions = slots.map(s => `<option value="${s.v}" ${restricoes.includes(s.v) ? 'selected' : ''}>${s.l}</option>`).join('');

    html += `
        <div class="section">
            <div class="section-title">🎒 Objeto Pessoal</div>
            <p style="font-size:.85rem;color:var(--muted);margin:0 0 12px;">
                <strong>Opcional.</strong> Crie um item personalizado para começar sua jornada. Pode ser uma arma de herança, um amuleto, ou qualquer equipamento que conte uma história. Nota: Este item não terá um bônus efetivo no personagem, servindo apenas como um item de valor sentimental e narrativo.
            </p>
            <div class="row">
                <div class="field" style="flex:2">
                    <label>Nome do Item</label>
                    <input type="text" id="customItemNome" placeholder="Ex: Espada enferrujada"
                        value="${escHtml(wizardState.customItem?.nome || '')}"
                        oninput="updateCustomItem()">
                </div>
                <div class="field" style="flex:1">
                    <label>Tipo</label>
                    <select id="customItemTipo" onchange="updateCustomItem(); toggleCustomItemFields();">
                        <option value="Objeto" ${wizardState.customItem?.tipo === 'Objeto' ? 'selected' : ''}>📦 Objeto</option>
                        <option value="Arma" ${wizardState.customItem?.tipo === 'Arma' ? 'selected' : ''}>⚔️ Arma</option>
                        <option value="Vestimenta" ${wizardState.customItem?.tipo === 'Vestimenta' ? 'selected' : ''}>🧥 Vestimenta</option>
                        <option value="Acessório" ${wizardState.customItem?.tipo === 'Acessório' ? 'selected' : ''}>💍 Acessório</option>
                        <option value="Projétil" ${wizardState.customItem?.tipo === 'Projétil' ? 'selected' : ''}>🎯 Projétil</option>
                        <option value="Container" ${wizardState.customItem?.tipo === 'Container' ? 'selected' : ''}>📦 Container</option>
                    </select>
                </div>
            </div>

            <div class="row">
                <div class="field" style="flex:1">
                    <label>Vestir em (Restrição)</label>
                    <select id="customItemSlotRestrito" multiple size="4" onchange="updateCustomItem()">
                        ${slotsOptions}
                    </select>
                    <small style="color:var(--muted); font-size: 0.8rem;">Segure Ctrl/Cmd para selecionar vários. Deixe vazio para Livre.</small>
                </div>
            </div>
            
            <div class="row" id="customItemArmaRow" style="display:${wizardState.customItem?.tipo === 'Arma' ? 'flex' : 'none'};">
                <div class="field">
                    <label>Categoria da Arma</label>
                    <select id="customItemCategoriaArma" onchange="updateCustomItem()">
                        <option value="uma_mao" ${wizardState.customItem?.categoriaArma === 'uma_mao' ? 'selected' : ''}>🗡️ Uma Mão</option>
                        <option value="duas_maos" ${wizardState.customItem?.categoriaArma === 'duas_maos' ? 'selected' : ''}>⚔️ Duas Mãos</option>
                        <option value="versatil" ${wizardState.customItem?.categoriaArma === 'versatil' ? 'selected' : ''}>🔄 Versátil</option>
                        <option value="escudo" ${wizardState.customItem?.categoriaArma === 'escudo' ? 'selected' : ''}>🛡️ Escudo</option>
                        <option value="distancia" ${wizardState.customItem?.categoriaArma === 'distancia' ? 'selected' : ''}>🏹 À Distância</option>
                    </select>
                </div>
            </div>

            <div class="row">
                <div class="field">
                    <label>Peso</label>
                    <input type="number" id="customItemPeso" value="${wizardState.customItem?.peso ?? 1}" min="0" step="0.1" oninput="updateCustomItem()">
                </div>
                <div class="field">
                    <label>Tamanho</label>
                    <input type="number" id="customItemTamanho" value="${wizardState.customItem?.tamanho ?? 1}" min="0" oninput="updateCustomItem()">
                </div>
                <div class="field" id="customItemQtdField" style="display:${['Container','Arma'].includes(wizardState.customItem?.tipo) ? 'none' : 'block'}">
                    <label>Quantidade</label>
                    <input type="number" id="customItemQtd" value="${wizardState.customItem?.quantidade ?? 1}" min="1" oninput="updateCustomItem()">
                </div>
            </div>

            <div class="row" id="customItemContainerRow" style="display:${wizardState.customItem?.tipo === 'Container' ? 'flex' : 'none'};">
                <div class="field">
                    <label>Peso Máximo</label>
                    <input type="number" id="customItemPesoMax" value="${wizardState.customItem?.pesoMaximoContainer ?? 10}" min="0" step="0.1" oninput="updateCustomItem()">
                </div>
                <div class="field">
                    <label>Multiplicador</label>
                    <input type="number" id="customItemMult" value="${wizardState.customItem?.multiplicadorPressao ?? 1}" min="0" step="0.01" oninput="updateCustomItem()">
                </div>
            </div>

            <div class="field">
                <label>Descrição</label>
                <textarea id="customItemDesc" rows="2" placeholder="O que é? Por que é importante?" oninput="updateCustomItem()">${escHtml(wizardState.customItem?.descricao || '')}</textarea>
            </div>

            <div class="field">
                <label>Imagem (URL)</label>
                <input type="text" id="customItemImagem" placeholder="https://..." value="${escHtml(wizardState.customItem?.imagemUrl || '')}" oninput="updateCustomItem()">
            </div>
        </div>
    `;

    // Memória condicional ao objeto
    html += createMemoryBox('equipamento_objeto', 'Como este item chegou às suas mãos? Quem o possuía antes de você?', true);

    container.innerHTML = html;
}

function toggleEquipItem(itemName, checked) {
    if (checked) {
        if (!wizardState.equipamentoSelecionado.includes(itemName)) {
            wizardState.equipamentoSelecionado.push(itemName);
        }
    } else {
        wizardState.equipamentoSelecionado = wizardState.equipamentoSelecionado.filter(i => i !== itemName);
    }
    saveWizardToStorage();
}

window.toggleCustomItemFields = function() {
    const tipo = document.getElementById('customItemTipo')?.value;
    const armaRow = document.getElementById('customItemArmaRow');
    const contRow = document.getElementById('customItemContainerRow');
    const qtdField = document.getElementById('customItemQtdField');
    
    if (armaRow) armaRow.style.display = tipo === 'Arma' ? 'flex' : 'none';
    if (contRow) contRow.style.display = tipo === 'Container' ? 'flex' : 'none';
    if (qtdField) qtdField.style.display = (tipo === 'Container' || tipo === 'Arma') ? 'none' : 'block';
};

window.updateCustomItem = function() {
    const nome = document.getElementById('customItemNome')?.value || '';
    if (!nome.trim()) {
        wizardState.customItem = null;
        saveWizardToStorage();
        return;
    }
    
    const tipo = document.getElementById('customItemTipo')?.value || 'Objeto';
    const selectSlot = document.getElementById('customItemSlotRestrito');
    const slotRestrito = Array.from(selectSlot?.selectedOptions || []).map(opt => opt.value);
    const categoriaArma = document.getElementById('customItemCategoriaArma')?.value || 'uma_mao';
    const peso = parseFloat(document.getElementById('customItemPeso')?.value) || 0;
    const tamanho = parseInt(document.getElementById('customItemTamanho')?.value) || 0;
    const quantidade = parseInt(document.getElementById('customItemQtd')?.value) || 1;
    const pesoMax = parseFloat(document.getElementById('customItemPesoMax')?.value) || 0;
    const mult = parseFloat(document.getElementById('customItemMult')?.value) || 1;
    const desc = document.getElementById('customItemDesc')?.value || '';
    const imagemUrl = document.getElementById('customItemImagem')?.value || '';

    wizardState.customItem = {
        nome,
        tipo,
        slotRestrito,
        peso,
        tamanho,
        quantidade: (tipo === 'Container' || tipo === 'Arma') ? 1 : quantidade,
        descricao: desc,
        imagemUrl,
        ehContainer: tipo === 'Container'
    };

    if (tipo === 'Arma') {
        wizardState.customItem.categoriaArma = categoriaArma;
    }
    if (tipo === 'Container') {
        wizardState.customItem.pesoMaximoContainer = pesoMax;
        wizardState.customItem.multiplicadorPressao = mult;
    }

    saveWizardToStorage();
};
