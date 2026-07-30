/* ===== DETAIL MODAL — Raça, Classe, Peculiaridade ===== */
/* Modal de detalhes expandidos, reutilizado para os 3 tipos. */

/* ===== BLOQUEIO DE SELECTS ===== */

/**
 * Bloqueia os selects de Raça, Classe e Tribo para usuários sem privilégio.
 * Chamada após o role check no firebase.js e após cada change de select.
 * Lógica:
 *   - Se o usuário é Criador ou Mestre, selects ficam sempre editáveis
 *   - Caso contrário, selects com valor já selecionado ficam disabled
 *   - Selects vazios permanecem editáveis (primeira escolha)
 */
function lockSelectsIfNeeded() {
    const isPrivileged = window.isCreator || window.isMestre;
    const selects = ['selRaca', 'selClasse', 'selTribo'];

    selects.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;

        if (isPrivileged) {
            // Privilegiado: sempre editável
            el.disabled = false;
            el.classList.remove('select-locked');
        } else if (el.value && el.value !== '') {
            // Não privilegiado com valor: bloquear
            el.disabled = true;
            el.classList.add('select-locked');
        } else {
            // Não privilegiado sem valor: permitir primeira escolha
            el.disabled = false;
            el.classList.remove('select-locked');
        }
    });

    // === EXP Total e EXP Restante: sempre bloqueados para jogadores ===
    const expFields = ['exp', 'exp_total'];
    expFields.forEach(key => {
        const el = document.querySelector(`[data-key="${key}"]`);
        if (!el) return;

        if (isPrivileged) {
            el.readOnly = false;
            el.classList.remove('field-locked');
        } else {
            el.readOnly = true;
            el.classList.add('field-locked');
        }
    });

    // === Virtude e Vício: bloqueados após preenchimento ===
    const lockAfterSet = ['virtude', 'vicio'];
    lockAfterSet.forEach(key => {
        const el = document.querySelector(`[data-key="${key}"]`);
        if (!el) return;

        if (isPrivileged) {
            el.readOnly = false;
            el.classList.remove('field-locked');
        } else if (el.value && el.value.trim() !== '') {
            el.readOnly = true;
            el.classList.add('field-locked');
        } else {
            el.readOnly = false;
            el.classList.remove('field-locked');
        }
    });
}

/* ===== OPEN / CLOSE MODAL ===== */

/**
 * Abre o modal de detalhes.
 * @param {'raca'|'classe'|'peculiaridade'} type
 * @param {string} name - Nome da raça/classe ou pecKey da peculiaridade
 * @param {string} [sourceKey] - Para peculiaridades: raceKey/classeNome/triboNome
 */
function openDetailModal(type, name, sourceKey) {
    const modal = document.getElementById('detailModal');
    const body = document.getElementById('detailModalBody');
    if (!modal || !body) return;

    let html = '';
    if (type === 'raca') {
        html = buildRaceDetailHTML(name);
    } else if (type === 'classe') {
        html = buildClassDetailHTML(name);
    } else if (type === 'peculiaridade') {
        html = buildPeculiarityDetailHTML(name, sourceKey);
    }

    if (!html) return;

    body.innerHTML = html;
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeDetailModal() {
    const modal = document.getElementById('detailModal');
    if (!modal) return;
    modal.classList.add('hidden');
    document.body.style.overflow = '';
}

/* ===== UTIL ===== */
function _escDetail(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}

function _renderImageSection(url) {
    if (!url) return '';
    return `<div class="detail-img-wrapper"><img class="detail-img" src="${_escDetail(url)}" alt="Imagem" loading="lazy"></div>`;
}

function _renderField(label, value) {
    if (!value) return '';
    return `<div class="detail-field"><span class="detail-field-label">${_escDetail(label)}</span><span class="detail-field-value">${_escDetail(value)}</span></div>`;
}

function _renderTextBlock(title, text) {
    if (!text) return '';
    return `
        <div class="detail-section">
            <div class="detail-section-title">${_escDetail(title)}</div>
            <div class="detail-section-text">${_escDetail(text)}</div>
        </div>`;
}

/* ===== RAÇA DETAIL ===== */

function buildRaceDetailHTML(raceName) {
    if (!raceName) return '';
    const raceData = (window._systemData?.races || []).find(r => r.nome === raceName);
    if (!raceData) return `<div class="detail-empty">Dados da raça "${_escDetail(raceName)}" não encontrados.</div>`;

    let html = '';

    // Imagem
    html += _renderImageSection(raceData.imagemUrl);

    // Título
    html += `<div class="detail-title-row">
        <span class="detail-title">🧬 ${_escDetail(raceData.nome)}</span>
    </div>`;

    if (raceData.subtitulo) {
        html += `<div class="detail-subtitle">${_escDetail(raceData.subtitulo)}</div>`;
    }

    // Campos básicos
    html += '<div class="detail-fields-grid">';
    html += _renderField('Expectativa de Vida', raceData.expectativaVida);
    html += _renderField('Tendência', raceData.tendencia);
    html += _renderField('Aparência', raceData.aparencia);
    html += _renderField('Habitat', raceData.habitat);
    html += '</div>';

    // História / Lore
    html += _renderTextBlock('📜 História', raceData.historia || raceData.lore);

    // Curiosidades
    if (raceData.curiosidades) {
        html += _renderTextBlock('💡 Curiosidades', raceData.curiosidades);
    }

    // 📖 Livro vinculado (Worldbuilding) — leitura dos capítulos liberados
    html += window.lvSecaoHTML ? window.lvSecaoHTML(raceData) : '';

    // Peculiaridades vinculadas
    const raceBuilt = window.RACES?.[raceName];
    if (raceBuilt?.peculiaridades?.length > 0) {
        html += `<div class="detail-section">
            <div class="detail-section-title">⚡ Peculiaridades</div>
            <div class="detail-pec-list">`;
        for (const pec of raceBuilt.peculiaridades) {
            const isNeg = pec.negativo ? 'negativo' : 'positivo';
            html += `<div class="detail-pec-item ${isNeg}">
                <span class="detail-pec-icon">${pec.icone || '📋'}</span>
                <span class="detail-pec-name">${_escDetail(pec.nome)}</span>
                ${pec.descricao ? `<span class="detail-pec-desc">${_escDetail(pec.descricao)}</span>` : ''}
            </div>`;
        }
        html += '</div></div>';
    }

    return html;
}

/* ===== CLASSE DETAIL ===== */

function buildClassDetailHTML(className) {
    if (!className) return '';
    const classData = (window._systemData?.classes || []).find(c => c.nome === className);
    if (!classData) return `<div class="detail-empty">Dados da classe "${_escDetail(className)}" não encontrados.</div>`;

    let html = '';

    // Imagem
    html += _renderImageSection(classData.imagemUrl);

    // Título
    html += `<div class="detail-title-row">
        <span class="detail-title">⚔️ ${_escDetail(classData.nome)}</span>
    </div>`;

    if (classData.arquetipo) {
        html += `<div class="detail-subtitle">${_escDetail(classData.arquetipo)}</div>`;
    }

    // Campos básicos
    html += '<div class="detail-fields-grid">';
    html += _renderField('Especialidade', classData.especialidade);
    html += _renderField('Arquétipo', classData.arquetipo);
    html += '</div>';

    // Descrição
    html += _renderTextBlock('📖 Descrição', classData.descricao);

    // Citação icônica
    if (classData.citacao || classData.citacaoIconica) {
        const citacao = classData.citacao || classData.citacaoIconica;
        html += `<div class="detail-section">
            <div class="detail-quote">"${_escDetail(citacao)}"</div>
        </div>`;
    }

    // Papel em cena
    if (classData.papelEmCombate || classData.papelForaCombate) {
        html += `<div class="detail-section">
            <div class="detail-section-title">🎭 Papel em Cena</div>`;
        if (classData.papelEmCombate) {
            html += `<div class="detail-role-item"><strong>⚔️ Em Combate:</strong> ${_escDetail(classData.papelEmCombate)}</div>`;
        }
        if (classData.papelForaCombate) {
            html += `<div class="detail-role-item"><strong>🏕️ Fora de Combate:</strong> ${_escDetail(classData.papelForaCombate)}</div>`;
        }
        html += '</div>';
    }

    // Perícias de Classe
    if (window.CLASS_SKILLS?.[className]?.length > 0) {
        html += `<div class="detail-section">
            <div class="detail-section-title">📚 Perícias de Classe</div>
            <div class="detail-tag-list">`;
        for (const sk of window.CLASS_SKILLS[className]) {
            html += `<span class="detail-tag">${_escDetail(sk)}</span>`;
        }
        html += '</div></div>';
    }



    // Recursos de Classe
    if (window.CLASS_RESOURCES?.[className]?.length > 0) {
        html += `<div class="detail-section">
            <div class="detail-section-title">💎 Recursos de Classe</div>
            <div class="detail-tag-list">`;
        for (const res of window.CLASS_RESOURCES[className]) {
            html += `<span class="detail-tag">${_escDetail(res.label || res)}</span>`;
        }
        html += '</div></div>';
    }

    // 📖 Livro vinculado (Worldbuilding) — leitura dos capítulos liberados
    html += window.lvSecaoHTML ? window.lvSecaoHTML(classData) : '';

    // Peculiaridades de Classe
    if (window.CLASS_PECULIARITIES?.[className]?.length > 0) {
        html += `<div class="detail-section">
            <div class="detail-section-title">⚡ Peculiaridades de Classe</div>
            <div class="detail-pec-list">`;
        for (const pec of window.CLASS_PECULIARITIES[className]) {
            const isNeg = pec.negativo ? 'negativo' : 'positivo';
            html += `<div class="detail-pec-item ${isNeg}">
                <span class="detail-pec-icon">${pec.icone || '📋'}</span>
                <span class="detail-pec-name">${_escDetail(pec.nome)}</span>
                ${pec.descricao ? `<span class="detail-pec-desc">${_escDetail(pec.descricao)}</span>` : ''}
            </div>`;
        }
        html += '</div></div>';
    }

    return html;
}

/* ===== PECULIARIDADE DETAIL ===== */

function buildPeculiarityDetailHTML(pecKey, sourceKey) {
    // Buscar peculiaridade em todas as fontes
    let pec = null;
    let fonteLabel = '';

    if (sourceKey && window.RACES?.[sourceKey]) {
        pec = window.RACES[sourceKey].peculiaridades.find(p => p.key === pecKey);
        if (pec) fonteLabel = `🧬 Raça: ${sourceKey}`;
    }
    if (!pec && sourceKey && window.CLASS_PECULIARITIES?.[sourceKey]) {
        pec = window.CLASS_PECULIARITIES[sourceKey].find(p => p.key === pecKey);
        if (pec) fonteLabel = `⚔️ Classe: ${sourceKey}`;
    }
    if (!pec && sourceKey && window.TRIBES?.[sourceKey]) {
        pec = window.TRIBES[sourceKey].peculiaridades?.find(p => p.key === pecKey);
        if (pec) fonteLabel = `🏕️ Tribo: ${sourceKey}`;
    }

    // Fallback: buscar em tudo
    if (!pec) {
        if (window.RACES) {
            for (const rk of Object.keys(window.RACES)) {
                pec = window.RACES[rk].peculiaridades.find(p => p.key === pecKey);
                if (pec) { fonteLabel = `🧬 Raça: ${rk}`; break; }
            }
        }
        if (!pec && window.CLASS_PECULIARITIES) {
            for (const ck of Object.keys(window.CLASS_PECULIARITIES)) {
                pec = window.CLASS_PECULIARITIES[ck].find(p => p.key === pecKey);
                if (pec) { fonteLabel = `⚔️ Classe: ${ck}`; break; }
            }
        }
        if (!pec && window.TRIBES) {
            for (const tk of Object.keys(window.TRIBES)) {
                pec = window.TRIBES[tk].peculiaridades?.find(p => p.key === pecKey);
                if (pec) { fonteLabel = `🏕️ Tribo: ${tk}`; break; }
            }
        }
    }

    if (!pec) return `<div class="detail-empty">Peculiaridade não encontrada.</div>`;

    const dotKey = 'pec_' + pec.key;
    const currentLevel = pec.tipo === 'evolutivo'
        ? (state.dots?.[dotKey] || pec.nivelAtual || 1)
        : (pec.nivel || 1);

    let html = '';

    // Título com ícone e badge
    html += `<div class="detail-title-row">
        <span class="detail-title">${pec.icone || '📋'} ${_escDetail(pec.nome)}</span>
        <span class="detail-level-badge ${pec.negativo ? 'negativo' : 'positivo'}">Nv ${currentLevel}</span>
    </div>`;

    // Fonte
    if (fonteLabel) {
        html += `<div class="detail-subtitle">${fonteLabel}</div>`;
    }

    // Tipo
    html += `<div class="detail-subtitle" style="margin-top:2px;font-style:normal;">
        ${pec.tipo === 'evolutivo' ? '📈 Evolutiva' : '📌 Fixa'}
        ${pec.negativo ? ' · ⚠️ Negativa' : ' · ✅ Positiva'}
    </div>`;

    // Descrição completa (sem truncar)
    if (pec.descricao) {
        html += `<div class="detail-section">
            <div class="detail-section-title">📖 Descrição</div>
            <div class="detail-section-text">${_escDetail(pec.descricao)}</div>
        </div>`;
    }

    // Efeito atual
    if (pec.tipo !== 'evolutivo' && pec.efeito) {
        html += `<div class="detail-section">
            <div class="detail-section-title">⚡ Efeito</div>
            <div class="detail-section-text">${_escDetail(pec.efeito)}</div>
        </div>`;
    }

    // Progressão de níveis (evolutivas)
    if (pec.tipo === 'evolutivo' && pec.niveis) {
        html += `<div class="detail-section">
            <div class="detail-section-title">📈 Progressão por Nível</div>
            <table class="detail-progression-table">
                <thead><tr><th>Nível</th><th>Custo</th><th>Efeito</th></tr></thead>
                <tbody>`;
        const sortedLevels = Object.keys(pec.niveis).map(Number).sort((a, b) => a - b);
        for (const lvl of sortedLevels) {
            const ni = pec.niveis[lvl];
            const isCurrentLevel = lvl === currentLevel;
            const highlightClass = isCurrentLevel ? 'current-level' : '';
            html += `<tr class="${highlightClass}">
                <td class="detail-lvl-cell">${lvl}${isCurrentLevel ? ' ◀' : ''}</td>
                <td class="detail-cost-cell">${_escDetail(ni.custo || '—')}</td>
                <td class="detail-effect-cell">${_escDetail(ni.efeito || '—')}</td>
            </tr>`;
        }
        html += '</tbody></table></div>';
    }

    // Mecânicas vinculadas
    if (pec.mecanicas?.length > 0 && typeof generatePreviewText === 'function') {
        html += `<div class="detail-section">
            <div class="detail-section-title">⚙️ Mecânicas Vinculadas</div>
            <div class="detail-mech-list">`;
        for (const m of pec.mecanicas) {
            const preview = generatePreviewText(m);
            if (preview) {
                html += `<div class="detail-mech-item">
                    <span class="detail-mech-bullet">•</span>
                    <span>${_escDetail(preview)}</span>
                </div>`;
            }
        }
        html += '</div></div>';
    }

    // Aura vinculada
    if (pec.auraVinculadaId && window.AURAS) {
        const auraDef = window.AURAS.find(a => a.id === pec.auraVinculadaId);
        if (auraDef) {
            html += `<div class="detail-section">
                <div class="detail-section-title">🌟 Aura Vinculada</div>
                <div class="detail-aura-info">
                    <span class="detail-aura-name">${_escDetail(auraDef.nome)}</span>
                    <span class="detail-aura-grade">Grau ${pec.auraGrauConcedido || 1}</span>
                </div>
            </div>`;
        }
    }

    // Distribuição (alvos já escolhidos)
    if (pec.mecanicas) {
        for (const mech of pec.mecanicas) {
            if (mech.tipo !== 'distribuir') continue;
            // Fonte canônica: state.mecanicasAplicadas (mechanics-engine).
            // state.distribuirAlvos é formato legado (array de strings).
            const aplicada = state.mecanicasAplicadas?.[mech.id]?.alvosEscolhidos;
            const legado = state.distribuirAlvos?.[`dist_${mech.id}`];
            const saved = (Array.isArray(aplicada) && aplicada.length)
                ? aplicada.map(a => `${a.nome}${a.valor != null ? ` (+${a.valor})` : ''}`)
                : legado;
            if (saved && saved.length > 0) {
                html += `<div class="detail-section">
                    <div class="detail-section-title">🎯 Distribuição</div>
                    <div class="detail-tag-list">`;
                for (const alvo of saved) {
                    // ᛟ Elementos Rúnicos: encurta o prefixo para caber na pill
                    const label = String(alvo).replace('Elemento Rúnico: ', 'ᛟ ');
                    html += `<span class="detail-tag">${_escDetail(label)}</span>`;
                }
                html += '</div></div>';
            }
        }
    }

    return html;
}

/* ===== INFO BUTTON CLICK HANDLERS ===== */

/**
 * Abre modal de detalhes para o select de Raça.
 */
function openRaceDetail() {
    const val = document.getElementById('selRaca')?.value;
    if (val) openDetailModal('raca', val);
}

/**
 * Abre modal de detalhes para o select de Classe.
 */
function openClassDetail() {
    const val = document.getElementById('selClasse')?.value;
    if (val) openDetailModal('classe', val);
}

/**
 * Abre modal de detalhes para o select de Tribo.
 * Reutiliza a lógica de raça para simplificar (tribo usa mesma estrutura).
 */
function openTriboDetail() {
    // Tribos não têm modal de detalhes dedicado por ora,
    // mas podemos mostrar suas peculiaridades via um mini-modal
    const val = document.getElementById('selTribo')?.value;
    if (!val) return;
    // Build a simple detail from tribe data
    const tribeData = (window._systemData?.tribes || []).find(t => t.nome === val);
    if (!tribeData) return;

    let html = '';
    html += _renderImageSection(tribeData.imagemUrl);
    html += `<div class="detail-title-row">
        <span class="detail-title">🏕️ ${_escDetail(tribeData.nome)}</span>
    </div>`;
    if (tribeData.subtitulo) {
        html += `<div class="detail-subtitle">${_escDetail(tribeData.subtitulo)}</div>`;
    }
    html += _renderTextBlock('📖 Descrição', tribeData.descricao);

    // 📖 Livro vinculado (Worldbuilding) — leitura dos capítulos liberados
    html += window.lvSecaoHTML ? window.lvSecaoHTML(tribeData) : '';

    // Peculiaridades de tribo
    const tribe = window.TRIBES?.[val];
    if (tribe?.peculiaridades?.length > 0) {
        html += `<div class="detail-section">
            <div class="detail-section-title">⚡ Peculiaridades</div>
            <div class="detail-pec-list">`;
        for (const pec of tribe.peculiaridades) {
            const isNeg = pec.negativo ? 'negativo' : 'positivo';
            html += `<div class="detail-pec-item ${isNeg}">
                <span class="detail-pec-icon">${pec.icone || '📋'}</span>
                <span class="detail-pec-name">${_escDetail(pec.nome)}</span>
                ${pec.descricao ? `<span class="detail-pec-desc">${_escDetail(pec.descricao)}</span>` : ''}
            </div>`;
        }
        html += '</div></div>';
    }

    const modal = document.getElementById('detailModal');
    const body = document.getElementById('detailModalBody');
    if (!modal || !body) return;
    body.innerHTML = html;
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

/* ===== CLOSE ON BACKDROP CLICK ===== */
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('detailModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            // Close if clicked on backdrop (not on content)
            if (e.target === modal) {
                closeDetailModal();
            }
        });
    }
});

/* ===== CLOSE ON ESC KEY ===== */
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const modal = document.getElementById('detailModal');
        if (modal && !modal.classList.contains('hidden')) {
            closeDetailModal();
        }
    }
});


/* ===== IDENTITY MODAL ===== */

function openIdentityDetail() {
    const modal = document.getElementById('detailModal');
    const body = document.getElementById('detailModalBody');
    if (!modal || !body) return;

    let html = buildIdentityDetailHTML();
    if (!html) return;

    body.innerHTML = html;
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function updateIdentityField(key, value) {
    // Update the hidden input in the main DOM so gatherData picks it up
    const el = document.querySelector(`input[type="hidden"][data-key="${key}"]`) || document.querySelector(`[data-key="${key}"]`);
    if (el) {
        el.value = value;
    }
    // Update state directly just in case
    if (typeof state !== 'undefined' && state.fields) {
        state.fields[key] = value;
    }
    
    // Trigger autosave
    if (typeof scheduleAutosave === 'function') scheduleAutosave();
}

function buildIdentityDetailHTML() {
    // Pega os valores direto do DOM (já que state.fields não é populado no load inicial)
    const getField = (key) => document.querySelector(`[data-key="${key}"]`)?.value || '';
    
    let nome = getField('nome');
    let idade = getField('idade');
    let aparencia = getField('aparencia');
    let motivacao = getField('motivacao');
    let medo = getField('medo');
    let arrependimento = getField('arrependimento');

    // Parse arrependimento fallback
    if (!arrependimento && typeof state !== 'undefined' && state.notes) {
        const vesperaNote = state.notes.find(n => n.titulo === '🌅 A Véspera da Partida' || n.titulo === '💭 Últimas Reflexões');
        if (vesperaNote && vesperaNote.conteudo) {
            const match = vesperaNote.conteudo.match(/<b>Arrependimento:<\/b>\s*(.*?)(?:<br>|$)/);
            if (match && match[1] && match[1] !== '—') {
                arrependimento = match[1].trim();
                const hiddenInput = document.querySelector('input[type="hidden"][data-key="arrependimento"]');
                if (hiddenInput) hiddenInput.value = arrependimento;
            }
        }
    }

    const nomeLabel = (nome.trim().indexOf(' ') !== -1) ? 'Nome Completo' : 'Nome';
    
    // Using the same layout structure as other modals
    let html = `
        <div class="detail-header" style="margin-bottom: 24px;">
            <div class="detail-title">Identidade Final</div>
            <div class="detail-subtitle">Conheça os detalhes mais profundos de ${nome}</div>
        </div>
        
        <div class="detail-section" style="margin-bottom: 20px; text-align: center;">
            <label style="display:block; margin-bottom: 8px; color: var(--muted); font-size: 0.85rem; font-weight: bold;">Imagem do Personagem</label>
            <div id="identityImgWrap">
                ${state.charImg ? '<img id="identityImgPreview" src="' + state.charImg + '" style="max-width: 100%; max-height: 300px; border-radius: 12px; object-fit: cover; border: 2px solid var(--soft);">' : '<div style="padding: 40px; border: 2px dashed var(--soft); border-radius: 12px; color: var(--muted);">Nenhuma imagem definida</div>'}
            </div>
            <div style="margin-top: 10px;">
                <input type="file" id="identityImgUpload" accept="image/*" onchange="handleIdentityImgUpload(this)" style="display:none;">
                <button class="btn" style="font-size: 0.8rem; padding: 6px 12px;" onclick="document.getElementById('identityImgUpload').click()">📷 Alterar Imagem</button>
            </div>
        </div>

        <div class="detail-section">
            <div class="field" style="margin-bottom: 16px;">
                <label style="display:block; margin-bottom: 4px; color: var(--muted); font-weight: bold;">${nomeLabel}</label>
                <input type="text" value="${nome}" readonly disabled style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--soft); background:var(--lr-bg-1); color: var(--text); font-family: inherit;">
            </div>
            
            <div class="field" style="margin-bottom: 16px;">
                <label style="display:block; margin-bottom: 4px; color: var(--muted); font-weight: bold;">Idade</label>
                <input type="number" value="${idade}" placeholder="Sua idade" style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--soft); background: var(--bg); color: var(--text); font-family: inherit;" oninput="updateIdentityField('idade', this.value)">
            </div>
            
            <div class="field" style="margin-bottom: 16px;">
                <label style="display:block; margin-bottom: 4px; color: var(--muted); font-weight: bold;">Aparência</label>
                <textarea rows="3" placeholder="Descreva a aparência..." style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--soft); background: var(--bg); color: var(--text); resize: vertical; font-family: inherit;" oninput="updateIdentityField('aparencia', this.value)">${aparencia}</textarea>
            </div>
            
            <div class="field" style="margin-bottom: 16px;">
                <label style="display:block; margin-bottom: 4px; color: var(--muted); font-weight: bold;">Motivação</label>
                <textarea rows="2" placeholder="O que te faz levantar toda manhã?" style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--soft); background: var(--bg); color: var(--text); resize: vertical; font-family: inherit;" oninput="updateIdentityField('motivacao', this.value)">${motivacao}</textarea>
            </div>
            
            <div class="field" style="margin-bottom: 16px;">
                <label style="display:block; margin-bottom: 4px; color: var(--muted); font-weight: bold;">Medo</label>
                <textarea rows="2" placeholder="O que te mantém acordado à noite?" style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--soft); background: var(--bg); color: var(--text); resize: vertical; font-family: inherit;" oninput="updateIdentityField('medo', this.value)">${medo}</textarea>
            </div>
            
            <div class="field" style="margin-bottom: 16px;">
                <label style="display:block; margin-bottom: 4px; color: var(--muted); font-weight: bold;">Arrependimento</label>
                <textarea rows="2" placeholder="Do que você se arrepende?" style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--soft); background: var(--bg); color: var(--text); resize: vertical; font-family: inherit;" oninput="updateIdentityField('arrependimento', this.value)">${arrependimento}</textarea>
            </div>
        </div>
    `;

    return html;
}

function handleIdentityImgUpload(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (ev) {
        state.charImg = ev.target.result;
        
        // Atualiza a imagem na ficha principal caso exista e seja visível
        const mainImg = document.getElementById('charImgPreview');
        if (mainImg) {
            mainImg.src = state.charImg;
            mainImg.style.display = 'block';
            const placeholder = document.getElementById('charImgPlaceholder');
            if (placeholder) placeholder.style.display = 'none';
        }

        // Reabre o modal para atualizar a visualização da imagem
        openIdentityDetail();
        if (typeof scheduleAutosave === 'function') scheduleAutosave();
    };
    reader.readAsDataURL(file);
}
