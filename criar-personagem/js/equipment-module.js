/* ===== PHASE 7 — O Equipamento ===== */

function initPhase7(container) {
    let html = createNarratorBox(NARRADOR_TEXTOS.equipamento);

    // === KITS DE REPERTÓRIO ===
    const itensRepertorioEquip = wizardState.itensRepertorioSelecionados?.filter(i => i.personagemItensVinculados?.length > 0) || [];
    
    if (itensRepertorioEquip.length > 0) {
        html += `<div class="section">`;
        html += `<div class="section-title">🎒 Equipamentos de Repertório</div>`;
        html += `<p style="font-size:.85rem;color:var(--muted);margin:0 0 12px;">Os seguintes pacotes de equipamento foram adquiridos através do seu repertório e serão adicionados ao seu inventário:</p>`;
        html += `<div class="kits-selection-container" style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px;">`;
        
        itensRepertorioEquip.forEach((repItem, index) => {
            const repCardId = `rep-kit-details-${index}`;
            html += `
                <div class="rep-kit-card" style="border: 1px solid var(--accent); border-radius: 8px; background: var(--bg-card); padding: 12px; margin-bottom: 8px;">
                    <div style="font-weight:bold; font-size:1rem; color:var(--text); display:flex; justify-content:space-between; align-items:center; cursor:pointer;" onclick="const el = document.getElementById('${repCardId}'); el.style.display = el.style.display === 'none' ? 'block' : 'none';">
                        <div style="display:flex; align-items:center; gap:8px;">
                            <span style="font-size:1.2rem;">✨</span> ${escHtml(repItem.nome)}
                        </div>
                        <span style="font-size:0.8rem; color:var(--muted);">▼ Detalhes</span>
                    </div>
                    <div id="${repCardId}" class="rep-kit-details" style="display: block; padding-top: 12px; margin-top: 8px; border-top: 1px dashed var(--soft);">
                        <div style="display:flex; flex-direction:column;">
            `;
            
            for (const eqObj of repItem.personagemItensVinculados) {
                const eqId = typeof eqObj === 'string' ? eqObj : (eqObj.itemId || eqObj.id);
                const baseQtd = typeof eqObj === 'string' ? 1 : (eqObj.quantidade || 1);
                const packageQtd = repItem.quantidadeConsumida || 1;
                const eqQtd = baseQtd * packageQtd;
                try {
                    const eq = window._systemData?.equipment?.find(e => String(e.id) === String(eqId));
                    if (eq) {
                        const eqClone = { ...eq, quantidade: eqQtd };
                        html += window.renderEquipmentItemDetails(eqClone);
                    }
                } catch (e) {
                    console.error('Erro ao renderizar item do repertório:', e);
                }
            }
            
            html += `
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += `</div></div>`;
    }

    // Equipment from class
    const className = wizardState.classeSelecionada;
    const classData = className ? window._systemData.classes.find(c => c.nome === className) : null;
    const kitsIniciais = classData?.kitsIniciais || [];

    html += `
        <div class="section">
            <div class="section-title">⚔️ Equipamento Inicial da Classe</div>
    `;

    try {
        const safeKitsIniciais = Array.isArray(kitsIniciais) ? kitsIniciais : [];
        if (safeKitsIniciais.length > 0) {
            html += `<p style="font-size:.85rem;color:var(--muted);margin:0 0 12px;">Escolha um dos kits iniciais para a sua classe:</p>`;
            
            html += `<div class="kits-selection-container" style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px;">`;
            safeKitsIniciais.forEach((kit, index) => {
                if (!kit || typeof kit !== 'object') return;

                const kitId = kit.id || `kit_${index}`;
                const isSelected = wizardState.kitInicialSelecionado === kitId;
                const checked = isSelected ? 'checked' : '';
                
                html += `
                    <div class="kit-card" id="kit-card-${escHtml(kitId)}" style="border: 1px solid ${isSelected ? 'var(--accent)' : 'var(--soft)'}; border-radius: 8px; background: ${isSelected ? 'var(--bg-card)' : 'transparent'}; transition: all 0.2s;">
                        <label style="display:flex;align-items:center;gap:12px;padding:12px;cursor:pointer;margin:0;">
                            <input type="radio" name="kitInicial" value="${escHtml(kitId)}" ${checked} onchange="window.selectKitInicial('${escHtml(kitId)}')" style="margin: 0; flex-shrink: 0;">
                            <div style="font-weight:bold; font-size:1rem; color:var(--text);">${escHtml(kit.nome || 'Kit Desconhecido')}</div>
                        </label>
                `;

                // Detalhes do kit, ocultos se não selecionado
                html += `<div class="kit-details" id="kit-details-${escHtml(kitId)}" style="display: ${isSelected ? 'block' : 'none'}; padding: 0 16px 16px 16px; border-top: 1px dashed var(--soft); margin-top: 4px; padding-top: 16px;">`;
                
                const safeEquipamentos = Array.isArray(kit.equipamentos) ? kit.equipamentos : [];
                if (safeEquipamentos.length > 0) {
                    html += `<div style="display:flex; flex-direction:column;">`;
                    for (const eqItem of safeEquipamentos) {
                        const eqId = typeof eqItem === 'string' ? eqItem : (eqItem.itemId || eqItem.id);
                        const eqQtd = typeof eqItem === 'string' ? 1 : (eqItem.quantidade || eqItem.qtd || 1);
                        try {
                            const eq = window._systemData?.equipment?.find(e => String(e.id) === String(eqId));
                            if (eq) {
                                const eqClone = { ...eq, quantidade: eqQtd };
                                html += window.renderEquipmentItemDetails(eqClone);
                            }
                        } catch (e) {
                            console.error('Erro ao renderizar item do kit:', e);
                            html += `<div style="color: var(--danger); font-size: 0.9rem; padding: 8px; margin-bottom: 12px;">Erro ao carregar item (ID: ${escHtml(String(eqId))})</div>`;
                        }
                    }
                    html += `</div>`;
                } else {
                    html += `<div style="color: var(--muted); font-size: 0.9rem;">Este kit está vazio.</div>`;
                }
                html += `</div></div>`; // fecha kit-details e kit-card
            });
            html += `</div>`;

        } else {
            html += `<p style="color:var(--muted);font-size:.85rem;">Nenhum kit inicial definido para ${escHtml(className || 'esta classe')}. Converse com seu Narrador.</p>`;
        }
    } catch (errKit) {
        console.error("Erro fatal ao processar kits:", errKit);
        html += `<div style="color:var(--danger); padding:12px; border:1px solid var(--danger); border-radius:8px;">Erro ao carregar os kits da classe. Verifique o console.</div>`;
    }

    html += `</div>`;

    // Item Customizado (Substitui Objeto Pessoal)
    const racaClassData = wizardState.racaSelecionada ? window._systemData.races?.find(r => r.nome === wizardState.racaSelecionada) : null;
    const partesDoCorpo = (racaClassData?.partesDoCorpo && racaClassData.partesDoCorpo.length > 0) ? racaClassData.partesDoCorpo : (window._systemData.bodyParts?.filter(bp => bp.ehPadrao) || []);
    
    const equipavelEm = wizardState.customItem?.equipavelEm || [];
    const slotsOptions = partesDoCorpo.map(bpItem => {
        const bp = window._systemData.bodyParts?.find(b => b.id === bpItem.id) || bpItem;
        const selected = equipavelEm.includes(bp.id) ? 'selected' : '';
        return `<option value="${bp.id}" data-segurar="${!!bp.podeSegurar}" data-empunhar="${!!bp.podeEmpunhar}" data-vestir="${!!bp.podeVestir}" data-fixar="${!!bp.podeFixar}" ${selected}>${bp.icone || '🦴'} ${bp.nome || bp.id}</option>`;
    }).join('');

    let mecanicasMesaHtml = '';
    const mecanicasMesa = wizardState.mesaVinculada?.mecanicasObjetoPessoal || [];
    if (mecanicasMesa.length > 0 && window._systemData.mechanics) {
        // mecanicasMesa pode ser array de strings (IDs) ou objetos (caso tenha sido salvo diferente). Tratar ambos:
        const mechs = mecanicasMesa.map(idOuObj => {
            const idStr = typeof idOuObj === 'object' ? idOuObj.id : idOuObj;
            return window._systemData.mechanics.find(m => m.id === idStr);
        }).filter(Boolean);
        
        if (mechs.length > 0) {
            mecanicasMesaHtml = `
            <div style="background: rgba(0, 150, 255, 0.1); border: 1px solid rgba(0, 150, 255, 0.3); border-radius: 8px; padding: 12px; margin-bottom: 16px;">
                <div style="font-size: 0.9rem; font-weight: bold; color: var(--lr-arcane); margin-bottom: 8px;">
                    ✨ Bônus da Campanha (${escHtml(wizardState.mesaVinculada.nome || 'Mesa')})
                </div>
                <div style="font-size: 0.85rem; color: var(--light); margin-bottom: 8px;">
                    O seu Objeto Pessoal receberá automaticamente as seguintes mecânicas ao concluir a criação do personagem:
                </div>
                <div style="display: flex; flex-direction: column; gap: 8px;">
                    ${mechs.map(m => {
                        let icone = '⚙️';
                        if (m.tipo === 'conceder') icone = '✨';
                        if (m.tipo === 'modificar') icone = '⚡';
                        if (m.tipo === 'limitar') icone = '🔒';
                        return `
                        <div style="display: flex; align-items: flex-start; gap: 8px; background:var(--lr-bg-1); padding: 8px; border-radius: 6px;">
                            <span style="font-size: 1.1rem; line-height: 1;">${icone}</span>
                            <div>
                                <strong style="color: var(--light); font-size: 0.85rem;">${escHtml(m.nome)}</strong>
                                <div style="font-size: 0.8rem; color: var(--muted); margin-top: 2px;">${escHtml(m.descricao)}</div>
                            </div>
                        </div>
                        `;
                    }).join('')}
                </div>
            </div>`;
        }
    }

    html += `
        <div class="section">
            <div class="section-title">🎒 Objeto Pessoal</div>
            <p style="font-size:.85rem;color:var(--muted);margin:0 0 12px;">
                <strong>Opcional.</strong> Crie um item personalizado para começar sua jornada. Pode ser uma arma de herança, um amuleto, ou qualquer equipamento que conte uma história.${mecanicasMesa.length > 0 ? '' : ' Nota: Este item não terá um bônus efetivo no personagem, servindo apenas como um item de valor sentimental e narrativo.'}
            </p>
            ${mecanicasMesaHtml}
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
                        <option value="Consumível" ${wizardState.customItem?.tipo === 'Consumível' ? 'selected' : ''}>🧪 Consumível</option>
                    </select>
                </div>
            </div>

            <div class="row">
                <div class="field" style="flex:1">
                    <label>Equipável em</label>
                    <select id="customItemEquipavelEm" multiple size="4" onchange="window.updateCustomItemFormaEquiparOptions(); updateCustomItem();">
                        ${slotsOptions}
                    </select>
                    <small style="color:var(--muted); font-size: 0.8rem;">Segure Ctrl/Cmd para selecionar vários. Deixe vazio para Livre.</small>
                </div>
                <div class="field" style="flex:1">
                    <label>Forma de equipar</label>
                    <select id="customItemFormaEquipar" onchange="updateCustomItem()">
                        <!-- Preenchido dinamicamente por updateCustomItemFormaEquiparOptions() na carga inicial -->
                    </select>
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
                <label>Imagem</label>
                ${CampoImagem.html({ id: 'customItemImagem', valor: wizardState.customItem?.imagemUrl || '', pasta: 'imagens/itens', attrs: 'oninput="updateCustomItem()"' })}
            </div>
        </div>
    `;

    // Memória condicional ao objeto
    html += createMemoryBox('equipamento_objeto', 'Como este item chegou às suas mãos? Quem o possuía antes de você?', true);

    container.innerHTML = html;

    // Atualiza opções da forma de equipar com base nas seleções atuais (ou livre se vazio)
    setTimeout(() => {
        if (window.updateCustomItemFormaEquiparOptions) {
            window.updateCustomItemFormaEquiparOptions(wizardState.customItem?.formaEquipar);
        }
    }, 0);
}

window.updateCustomItemFormaEquiparOptions = function(savedValue) {
    const equipSelect = document.getElementById('customItemEquipavelEm');
    const formaSelect = document.getElementById('customItemFormaEquipar');
    if (!equipSelect || !formaSelect) return;

    let canSegurar = false;
    let canEmpunhar = false;
    let canVestir = false;
    let canFixar = false;

    if (equipSelect.selectedOptions.length === 0) {
        canSegurar = canEmpunhar = canVestir = canFixar = true;
    } else {
        Array.from(equipSelect.selectedOptions).forEach(opt => {
            if (opt.dataset.segurar === 'true') canSegurar = true;
            if (opt.dataset.empunhar === 'true') canEmpunhar = true;
            if (opt.dataset.vestir === 'true') canVestir = true;
            if (opt.dataset.fixar === 'true') canFixar = true;
        });
    }

    const currentVal = savedValue !== undefined ? savedValue : formaSelect.value;
    let html = '<option value="">— Livre —</option>';
    if (canSegurar) html += `<option value="segurar" ${currentVal === 'segurar' ? 'selected' : ''}>Segurar</option>`;
    if (canEmpunhar) html += `<option value="empunhar" ${currentVal === 'empunhar' ? 'selected' : ''}>Empunhar</option>`;
    if (canVestir) html += `<option value="vestir" ${currentVal === 'vestir' ? 'selected' : ''}>Vestir</option>`;
    if (canFixar) html += `<option value="fixar" ${currentVal === 'fixar' ? 'selected' : ''}>Fixar</option>`;

    formaSelect.innerHTML = html;
    if (currentVal && !html.includes(`value="${currentVal}"`)) {
        formaSelect.value = '';
        if (savedValue === undefined) updateCustomItem(); // Forma antiga inválida, atualiza state
    }
};

window.selectKitInicial = function(kitId) {
    wizardState.kitInicialSelecionado = kitId;
    saveWizardToStorage();
    
    // Toggle UI without rerendering the whole phase
    const allCards = document.querySelectorAll('.kit-card');
    const allDetails = document.querySelectorAll('.kit-details');
    
    allCards.forEach(card => {
        card.style.border = '1px solid var(--soft)';
        card.style.background = 'transparent';
    });
    
    allDetails.forEach(detail => {
        detail.style.display = 'none';
    });
    
    const selectedCard = document.getElementById(`kit-card-${kitId}`);
    const selectedDetails = document.getElementById(`kit-details-${kitId}`);
    
    if (selectedCard) {
        selectedCard.style.border = '1px solid var(--accent)';
        selectedCard.style.background = 'var(--bg-card)';
    }
    if (selectedDetails) {
        selectedDetails.style.display = 'block';
    }
};

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
    const selectEquip = document.getElementById('customItemEquipavelEm');
    const equipavelEm = Array.from(selectEquip?.selectedOptions || []).map(opt => opt.value);
    const formaEquipar = document.getElementById('customItemFormaEquipar')?.value || null;
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
        equipavelEm: equipavelEm.length > 0 ? equipavelEm : null,
        formaEquipar,
        peso,
        tamanho,
        quantidade: (tipo === 'Container' || tipo === 'Arma') ? 1 : quantidade,
        descricao: desc,
        imagem: imagemUrl,
        imagemUrl, // mantemos por compatibilidade com legado
        ehContainer: tipo === 'Container',
        pressaoBase: peso
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

window.viewImageModal = function(url) {
    const modalExistente = document.getElementById('imageViewerModal');
    if (modalExistente) modalExistente.remove();

    const modalHtml = `
        <div id="imageViewerModal" class="detail-modal" onclick="this.remove()" style="display:flex; justify-content:center; align-items:center; z-index:99999; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); cursor:pointer;">
            <img src="${escHtml(url)}" style="max-width:90%; max-height:90%; border-radius:12px; box-shadow:0 10px 40px rgba(0,0,0,0.9);" onclick="event.stopPropagation()">
            <button class="detail-modal-close" style="position:absolute; top:20px; right:20px; background:var(--danger); color:#fff; border:none; border-radius:50%; width:40px; height:40px; font-size:20px; cursor:pointer;" onclick="document.getElementById('imageViewerModal').remove()">✕</button>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
};

window.renderEquipmentItemDetails = function(eq) {
    const imgUrl = eq.imagem || eq.imagemUrl || eq.iconeUrl;
    const imgHtml = imgUrl ? `<img src="${escHtml(imgUrl)}" onclick="window.viewImageModal('${escHtml(imgUrl)}')" title="Clique para ampliar" style="cursor:pointer; width:48px; height:48px; object-fit:contain; border-radius:6px; margin-right:12px; background:var(--lr-bg-1); padding:4px; border:1px solid var(--soft); transition: transform 0.2s, border-color 0.2s;" onmouseover="this.style.transform='scale(1.1)'; this.style.borderColor='var(--accent)';" onmouseout="this.style.transform='scale(1)'; this.style.borderColor='var(--soft)';" onerror="this.style.display='none'">` : '';

    let html = `<div class="equipment-item-detail" style="border-left: 3px solid var(--accent); padding-left: 12px; margin-bottom: 16px; display: flex; align-items: flex-start;">`;
    
    if (imgUrl) {
        html += imgHtml;
    }
    
    html += `<div style="flex:1;">`;
    
    // Header (Name + Type)
    html += `<div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 4px;">`;
    const qtdStr = eq.quantidade && eq.quantidade > 1 ? `<span style="color:var(--primary); margin-right:4px;">${eq.quantidade}x</span>` : '';
    html += `<div style="font-weight:bold; font-size:.95rem; color:var(--text);">${qtdStr}${escHtml(eq.nome)}</div>`;
    html += `<div style="font-size:.75rem; color:var(--muted); text-transform:uppercase;">${escHtml(eq.tipo || 'Item')}</div>`;
    html += `</div>`;
    
    // Description
    if (eq.descricao) {
        html += `<div style="font-size:.85rem; color:var(--muted); margin-bottom: 8px;">${escHtml(eq.descricao)}</div>`;
    }
    
    // Stats grid
    const stats = [];
    if (eq.peso) stats.push(`Peso: ${eq.peso}`);
    if (eq.tamanho) stats.push(`Tam: ${eq.tamanho}`);
    if (eq.categoriaArma) stats.push(`Arma: ${escHtml(eq.categoriaArma.replace('_', ' '))}`);
    if (eq.danoFisico) stats.push(`Dano Fís: ${escHtml(eq.danoFisico)}`);
    if (eq.danoMagico) stats.push(`Dano Mág: ${escHtml(eq.danoMagico)}`);
    if (eq.alcance) stats.push(`Alcance: ${escHtml(eq.alcance)}`);
    if (eq.protecaoFisica) stats.push(`Prot. Fís: ${eq.protecaoFisica}`);
    if (eq.protecaoMagica) stats.push(`Prot. Mág: ${eq.protecaoMagica}`);
    if (eq.propriedadesArma && Array.isArray(eq.propriedadesArma) && eq.propriedadesArma.length > 0) {
        stats.push(`Propriedades: ${eq.propriedadesArma.join(', ')}`);
    }
    
    if (stats.length > 0) {
        html += `<div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom: 8px;">`;
        for (const stat of stats) {
            html += `<span style="font-size:.75rem; background:var(--bg-secondary); border: 1px solid var(--soft); padding:2px 6px; border-radius:4px; color:var(--text);">${stat}</span>`;
        }
        html += `</div>`;
    }
    
    // Mechanics
    if (Array.isArray(eq.mecanicaIds) && eq.mecanicaIds.length > 0) {
        html += `<div class="detail-pec-mechanics" style="margin-top: 8px; display: flex; flex-direction: column; gap: 4px;">`;
        for (const mechId of eq.mecanicaIds) {
            try {
                const mech = window._systemData?.mechanics?.find(m => m.id === mechId);
                if (mech) {
                    const isNeg = mech.tipo === 'modificar' && mech.config?.operacao === '-';
                    const color = isNeg ? 'var(--danger)' : 'var(--success)';
                    const icon = isNeg ? '⚠️' : '⚡';
                    
                    html += `<div class="detail-mechanic-item" style="border-left: 2px solid ${color}; padding-left: 8px; background:var(--lr-bg-1); border-radius: 0 4px 4px 0; padding-top: 4px; padding-bottom: 4px;">`;
                    html += `<div style="font-size:.8rem; font-weight:bold; color:var(--text);">${icon} ${escHtml(mech.nome || 'Efeito Especial')}</div>`;
                    
                    const parts = [];
                    if (mech.tipo) parts.push(`Tipo: ${escHtml(mech.tipo)}`);
                    if (mech.config?.alvo) parts.push(`Alvo: ${escHtml(mech.config.alvo)}`);
                    if (mech.config?.operacao) parts.push(`Op: ${escHtml(mech.config.operacao)}`);
                    if (mech.config?.valor != null) parts.push(`Valor: ${escHtml(String(mech.config.valor))}`);
                    if (mech.config?.textoEfeito) parts.push(`Efeito: ${escHtml(mech.config.textoEfeito)}`);
                    
                    if (parts.length > 0) {
                        html += `<div style="font-size:.75rem; color:var(--muted); margin-top:2px;">${parts.join(' · ')}</div>`;
                    }
                    html += `</div>`;
                }
            } catch (errMech) {
                console.error("Erro ao renderizar mecânica:", errMech);
            }
        }
        html += `</div>`;
    }
    
    html += `</div></div>`;
    return html;
};
