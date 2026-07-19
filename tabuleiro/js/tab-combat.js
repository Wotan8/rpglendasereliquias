// =============================================
// TABULEIRO — Janela de Combate
// Sincroniza com Painel do Mestre > Mesas > Combate
// =============================================
import { db, doc, setDoc, updateDoc, getDoc } from '../../painel-mestre/js/firebase-config.js';
import { T, esc, toast } from './tab-state.js';
import { refCombate, refEstado } from './tab-main.js';
import { VITAIS } from './tab-hud.js';

let janelaAberta = false;

export function initCombat() {
    window._renderCombate = render;
    const win = document.getElementById('tbCombatWin');
    // Arrastar a janela
    const head = win.querySelector('.tb-win-head');
    let drag = null;
    head.addEventListener('pointerdown', e => {
        if (e.target.closest('button')) return;
        drag = { x: e.clientX, y: e.clientY, l: win.offsetLeft, t: win.offsetTop };
        head.setPointerCapture(e.pointerId);
    });
    head.addEventListener('pointermove', e => {
        if (!drag) return;
        win.style.left = Math.max(0, drag.l + e.clientX - drag.x) + 'px';
        win.style.top = Math.max(0, drag.t + e.clientY - drag.y) + 'px';
        win.style.right = 'auto';
    });
    head.addEventListener('pointerup', () => drag = null);
}

window.tbToggleCombate = function() {
    janelaAberta = !janelaAberta;
    document.getElementById('tbCombatWin').classList.toggle('open', janelaAberta);
    render();
};

async function salvar(participantes, patchExtra) {
    try {
        await setDoc(refCombate(), { participantes, atualizadoEm: Date.now(), ...(patchExtra || {}) }, { merge: true });
    } catch (e) { console.error(e); toast('❌ Erro ao salvar combate', 'danger'); }
}

function render() {
    const body = document.getElementById('tbCombatBody');
    if (!body || !janelaAberta) return;
    const c = T.combate;
    const parts = (c?.participantes || []).slice().sort((a, b) => (b.initiative||0) - (a.initiative||0));
    const turno = c?.turnoAtual || 0;
    const secreto = T.mode === 'secret';

    if (!parts.length) {
        body.innerHTML = '<div class="tb-muted" style="padding:16px;text-align:center">Nenhum participante.<br>Adicione pelo Painel do Mestre › Mesas › ⚔️ Combate.</div>';
        return;
    }

    let topo = '';
    if (secreto) {
        topo = `<div class="tb-combat-controls">
            <button class="tb-btn tb-btn-small" onclick="tbCombTurno(-1)">⏮️</button>
            <span class="tb-combat-round">Turno ${turno + 1}/${parts.length}${c?.rodada ? ' · Rodada ' + c.rodada : ''}</span>
            <button class="tb-btn tb-btn-small" onclick="tbCombTurno(1)">⏭️</button>
            <button class="tb-btn tb-btn-small" title="${c?.visivelPublicoCombate === false ? 'Exibir ao público' : 'Ocultar do público'}" onclick="tbCombVisibilidade()">${T.estado?.combateVisivelPublico ? '👁️' : '🚫'} público</button>
        </div>`;
    } else {
        topo = `<div class="tb-combat-controls"><span class="tb-combat-round">Ordem dos turnos${c?.rodada ? ' · Rodada ' + c.rodada : ''}</span></div>`;
    }

    body.innerHTML = topo + parts.map((p, i) => {
        const atual = i === turno % parts.length;
        const podeCtrl = secreto;
        const barra = (label, cur, max, cor) => {
            const pct = max > 0 ? Math.max(0, Math.min(100, (cur / max) * 100)) : 0;
            return `<div class="tb-cstat">
                ${podeCtrl ? `<button class="tb-cstat-btn" onclick="tbCombStat('${p.id}','${label}',-1)">−</button>` : ''}
                <span class="tb-cstat-lb">${label}</span>
                <div class="tb-cstat-bar"><div style="width:${pct}%;background:${cor}"></div></div>
                <span class="tb-cstat-v">${cur}/${max}</span>
                ${podeCtrl ? `<button class="tb-cstat-btn" onclick="tbCombStat('${p.id}','${label}',1)">+</button>` : ''}
            </div>`;
        };
        let hpC = p.hpCurrent ?? 0, hpM = p.hpMax ?? 0;
        let enerC = p.enerCurrent ?? 0, enerM = p.enerMax ?? 0;
        let sanC = p.sanCurrent ?? 0, sanM = p.sanMax ?? 0;

        if (p.characterId) {
            const v = VITAIS.get(p.characterId);
            if (v) {
                hpC = v.hp; hpM = v.hpMax;
                enerC = v.ener; enerM = v.enerMax;
                sanC = v.san; sanM = v.sanMax;
            }
        } else if (p.npcId) {
            const n = T.npcs.find(x => x.id === p.npcId);
            if (n) {
                const vd = n.valoresDer || {};
                const atual = vd.atual || {};
                hpM = vd.VIT || hpM;
                enerM = vd.ENER || enerM;
                sanM = vd.SAN || sanM;
                hpC = (atual.VIT !== undefined && atual.VIT !== null) ? Math.min(atual.VIT, hpM) : hpM;
                enerC = (atual.ENER !== undefined && atual.ENER !== null) ? Math.min(atual.ENER, enerM) : enerM;
                sanC = (atual.SAN !== undefined && atual.SAN !== null) ? Math.min(atual.SAN, sanM) : sanM;
            }
        }

        const stats = secreto ? `
            ${barra('VIT', hpC, hpM, 'linear-gradient(90deg,#10b981,#34d399)')}
            ${barra('ENER', enerC, enerM, 'linear-gradient(90deg,#f59e0b,#fbbf24)')}
            ${barra('SAN', sanC, sanM, 'linear-gradient(90deg,#6366f1,#8b5cf6)')}` : '';
        const conds = (p.condicoes || []).map((cd, ci) =>
            `<span class="tb-cond">${esc(cd)}${secreto ? ` <b onclick="tbCombCondRm('${p.id}',${ci})">✕</b>` : ''}</span>`).join('');
        const abrirNpc = secreto && p.npcId ? `onclick="tbAbrirNpcModal('${p.npcId}')" style="cursor:pointer" title="Abrir ficha do NPC"` : '';
        return `<div class="tb-combat-p ${atual ? 'atual' : ''}">
            <div class="tb-combat-init">${p.initiative ?? 0}</div>
            <div style="flex:1;min-width:0">
                <div class="tb-combat-nome" ${abrirNpc}>${esc(p.name || '?')} ${p.npcId && secreto ? '📋' : ''} <span class="tb-combat-tipo">${esc(p.type || '')}</span></div>
                ${secreto && p.details ? `<div class="tb-muted" style="font-size:.72rem">${esc(p.details)}</div>` : ''}
                ${stats}
                <div class="tb-conds">${conds}${secreto ? `<button class="tb-cond-add" onclick="tbCombCondAdd('${p.id}')">➕ condição</button>` : ''}</div>
            </div>
            ${secreto ? `<button class="tb-mini-btn tb-danger" onclick="tbCombRemover('${p.id}')" title="Remover">🗑️</button>` : ''}
        </div>`;
    }).join('');
}

// ===== Ações (modo secreto) =====
window.tbCombTurno = async function(dir) {
    const c = T.combate || {}; const n = (c.participantes || []).length || 1;
    let turno = (c.turnoAtual || 0) + dir;
    let rodada = c.rodada || 1;
    const rodadaAntes = rodada;
    if (turno >= n) { turno = 0; rodada++; }
    if (turno < 0) { turno = n - 1; rodada = Math.max(1, rodada - 1); }
    await salvar(c.participantes || [], { turnoAtual: turno, rodada });
    // F4.3: expira templates com duração ao virar a rodada
    if (rodada > rodadaAntes) {
        try { const m = await import('./tab-templates.js'); m.expirarTemplates(rodada); } catch (e) {}
    }
};

window.tbCombVisibilidade = async function() {
    const atual = !!T.estado?.combateVisivelPublico;
    await setDoc(refEstado(), { combateVisivelPublico: !atual }, { merge: true });
    toast(!atual ? '👁️ Combate visível ao público' : '🚫 Combate oculto do público');
};

window.tbCombStat = async function(pid, stat, amt) {
    const parts = (T.combate?.participantes || []).map(p => ({ ...p }));
    const p = parts.find(x => x.id === pid); if (!p) return;
    const map = { VIT: ['hpCurrent', 'hpMax'], ENER: ['enerCurrent', 'enerMax'], SAN: ['sanCurrent', 'sanMax'] };
    const [cur, max] = map[stat];

    // Ler valores corretos da Ficha (VITAIS) se possível, ignorando cache do combate
    let curVal = p[cur] ?? 0;
    let maxVal = p[max] ?? 999;
    if (p.characterId) {
        const v = VITAIS.get(p.characterId);
        if (v) {
            const vmap = { VIT: ['hp','hpMax'], ENER: ['ener','enerMax'], SAN: ['san','sanMax'] };
            curVal = v[vmap[stat][0]];
            maxVal = v[vmap[stat][1]];
        }
    } else if (p.npcId) {
        const n = T.npcs.find(x => x.id === p.npcId);
        if (n) {
            const vd = n.valoresDer || {};
            const atual = vd.atual || {};
            maxVal = vd[stat] || maxVal;
            if (atual[stat] !== undefined && atual[stat] !== null) {
                curVal = Math.min(atual[stat], maxVal);
            } else {
                curVal = maxVal;
            }
        }
    }

    const novoVal = Math.max(0, Math.min(curVal + amt, maxVal));
    p[cur] = novoVal;
    await salvar(parts);

    // ===== Sincronização bidirecional: Combat → Ficha =====
    const atualMap = { VIT: 'vit_atual', ENER: 'ener_atual', SAN: 'san_atual' };
    const curMap = { VIT: 'hpCurrent', ENER: 'enerCurrent', SAN: 'sanCurrent' };

    // Personagem de jogador → atualizar doc char
    if (p.characterId) {
        try {
            await updateDoc(doc(db, 'char', p.characterId), {
                [curMap[stat]]: novoVal,
                [`derivedValues.${atualMap[stat]}`]: String(novoVal)
            });
        } catch (e) { console.warn('sync char stat', e); }
    }

    // NPC → atualizar doc npcs (legacy + system key)
    if (p.npcId) {
        try {
            const npcSnap = await getDoc(doc(db, 'npcs', p.npcId));
            if (npcSnap.exists()) {
                const npcData = npcSnap.data();
                const atualObj = npcData.valoresDer?.atual || {};
                const patch = { [`valoresDer.atual.${stat}`]: p[cur] };
                // Também atualizar chaves do sistema que existam no atual
                const LEGACY_KEYS = new Set(['VIT','ENER','SAN','PERC','INI','REA','BLD']);
                for (const [k, v] of Object.entries(atualObj)) {
                    if (LEGACY_KEYS.has(k)) continue;
                    const nomeNorm = k.toLowerCase().replace(/[^a-z]/g, '');
                    const sigNorm = stat.toLowerCase();
                    if (nomeNorm.startsWith(sigNorm) || nomeNorm.startsWith(sigNorm === 'vit' ? 'vitalidade' : sigNorm === 'ener' ? 'energia' : 'sanidade')) {
                        patch[`valoresDer.atual.${k}`] = p[cur];
                    } else if (v === atualObj[stat]) {
                        patch[`valoresDer.atual.${k}`] = p[cur];
                    }
                }
                await updateDoc(doc(db, 'npcs', p.npcId), patch);
            }
        } catch (e) { console.warn('sync npc stat', e); }
    }
};

// ===== Cache de condições do sistema =====
let _systemConditions = null;

async function carregarCondicoesSistema() {
    if (_systemConditions) return _systemConditions;
    try {
        const { getDocs: gd, collection: col } = await import('../../painel-mestre/js/firebase-config.js');
        const snap = await gd(col(db, 'system/data/conditions'));
        _systemConditions = [];
        snap.forEach(d => {
            const data = d.data();
            if (data.publicado !== false) _systemConditions.push({ id: d.id, ...data });
        });
        _systemConditions.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
    } catch (e) {
        console.warn('⚠️ Não foi possível carregar condições do sistema:', e);
        _systemConditions = [];
    }
    return _systemConditions;
}

function fecharCondPicker() {
    document.getElementById('tbCondPickerOverlay')?.remove();
}

window.tbCombCondAdd = async function(pid) {
    const conditions = await carregarCondicoesSistema();
    const overlay = document.createElement('div');
    overlay.id = 'tbCondPickerOverlay';
    overlay.className = 'tb-cond-picker-overlay';

    const itensHtml = conditions.map((c, i) =>
        `<div class="tb-cond-picker-item" data-idx="${i}">
            <span class="tb-cpi-icon">${esc(c.icone || '💀')}</span>
            <span class="tb-cpi-nome">${esc(c.nome || 'Sem nome')}</span>
            ${c.duracao ? `<span class="tb-cpi-sub">⏱️ ${esc(c.duracao)}</span>` : ''}
        </div>`
    ).join('');

    overlay.innerHTML = `<div class="tb-cond-picker">
        <div class="tb-cond-picker-head">
            <span>☠️ Aplicar Condição</span>
            <button class="tb-mini-btn" onclick="document.getElementById('tbCondPickerOverlay')?.remove()">✕</button>
        </div>
        <input type="text" class="tb-cond-picker-search" id="tbCondSearch" placeholder="🔍 Buscar condição..." autocomplete="off">
        <div class="tb-cond-picker-list" id="tbCondList">
            ${itensHtml || '<div class="tb-muted" style="text-align:center;padding:16px">Nenhuma condição cadastrada no sistema</div>'}
        </div>
        <div class="tb-cond-picker-custom">
            <div class="tb-section-title">✏️ Condição Personalizada</div>
            <input type="text" id="tbCondCustomNome" placeholder="Nome da condição (ex: Atordoado)">
            <button class="tb-btn tb-btn-success tb-btn-small" id="tbCondCustomBtn">➕ Criar e Aplicar</button>
        </div>
    </div>`;

    document.body.appendChild(overlay);

    // Busca
    const searchEl = document.getElementById('tbCondSearch');
    searchEl.focus();
    searchEl.oninput = () => {
        const q = searchEl.value.toLowerCase().trim();
        document.querySelectorAll('#tbCondList .tb-cond-picker-item').forEach(el => {
            const nome = el.querySelector('.tb-cpi-nome')?.textContent?.toLowerCase() || '';
            el.style.display = (!q || nome.includes(q)) ? '' : 'none';
        });
    };

    // Clique em condição do sistema
    document.querySelectorAll('#tbCondList .tb-cond-picker-item').forEach(el => {
        el.onclick = async () => {
            const idx = parseInt(el.dataset.idx);
            const c = conditions[idx];
            if (!c) return;
            await aplicarCondicaoCombate(pid, c.nome, c);
            fecharCondPicker();
        };
    });

    // Condição personalizada
    document.getElementById('tbCondCustomBtn').onclick = async () => {
        const nome = document.getElementById('tbCondCustomNome')?.value?.trim();
        if (!nome) { toast('⚠️ Insira o nome da condição', 'warning'); return; }
        await aplicarCondicaoCombate(pid, nome, null);
        fecharCondPicker();
    };

    // Fechar ao clicar fora
    overlay.addEventListener('click', e => { if (e.target === overlay) fecharCondPicker(); });
};

/**
 * Aplica uma condição ao participante do combate e sincroniza com a ficha.
 * @param {string} pid - ID do participante no combate
 * @param {string} nome - Nome da condição
 * @param {object|null} tpl - Template da condição do sistema (ou null para personalizada)
 */
async function aplicarCondicaoCombate(pid, nome, tpl) {
    const parts = (T.combate?.participantes || []).map(p => ({ ...p }));
    const p = parts.find(x => x.id === pid); if (!p) return;
    p.condicoes = [...(p.condicoes || []), nome.trim()];
    await salvar(parts);
    toast(`☠️ Condição "${esc(nome)}" aplicada`);

    // Sincronizar com a ficha do personagem (char doc)
    if (p.characterId) {
        try {
            const charSnap = await getDoc(doc(db, 'char', p.characterId));
            if (charSnap.exists()) {
                const charData = charSnap.data();
                const conditions = charData.conditions || [];
                conditions.push({
                    nome: nome.trim(),
                    icone: tpl?.icone || '☠️',
                    descricao: tpl?.descricao || '',
                    tempoAtual: '',
                    tempoRestante: tpl?.duracao || '',
                    modeloId: tpl?.id || null,
                    efeitoMecanicaIds: tpl?.efeitoMecanicaIds || []
                });
                await updateDoc(doc(db, 'char', p.characterId), { conditions });
            }
        } catch (e) { console.warn('sync condition to char', e); }
    }

    // Sincronizar com a ficha do NPC (npcs doc)
    if (p.npcId) {
        try {
            const npcSnap = await getDoc(doc(db, 'npcs', p.npcId));
            if (npcSnap.exists()) {
                const npcData = npcSnap.data();
                const conditions = npcData.conditions || [];
                conditions.push({
                    nome: nome.trim(),
                    icone: tpl?.icone || '☠️',
                    descricao: tpl?.descricao || '',
                    tempoAtual: '',
                    tempoRestante: tpl?.duracao || '',
                    modeloId: tpl?.id || null,
                    efeitoMecanicaIds: tpl?.efeitoMecanicaIds || []
                });
                await updateDoc(doc(db, 'npcs', p.npcId), { conditions });
            }
        } catch (e) { console.warn('sync condition to npc', e); }
    }
}

window.tbCombCondRm = async function(pid, i) {
    const parts = (T.combate?.participantes || []).map(p => ({ ...p }));
    const p = parts.find(x => x.id === pid); if (!p) return;
    const removida = (p.condicoes || [])[i];
    p.condicoes = (p.condicoes || []).filter((_, ci) => ci !== i);
    await salvar(parts);

    // Sincronizar remoção na ficha do personagem
    if (p.characterId && removida) {
        try {
            const charSnap = await getDoc(doc(db, 'char', p.characterId));
            if (charSnap.exists()) {
                const charData = charSnap.data();
                let conditions = charData.conditions || [];
                const idx = conditions.findIndex(c => c.nome === removida);
                if (idx >= 0) {
                    conditions.splice(idx, 1);
                    await updateDoc(doc(db, 'char', p.characterId), { conditions });
                }
            }
        } catch (e) { console.warn('sync condition removal to char', e); }
    }

    // Sincronizar remoção na ficha do NPC
    if (p.npcId && removida) {
        try {
            const npcSnap = await getDoc(doc(db, 'npcs', p.npcId));
            if (npcSnap.exists()) {
                const npcData = npcSnap.data();
                let conditions = npcData.conditions || [];
                const idx = conditions.findIndex(c => c.nome === removida);
                if (idx >= 0) {
                    conditions.splice(idx, 1);
                    await updateDoc(doc(db, 'npcs', p.npcId), { conditions });
                }
            }
        } catch (e) { console.warn('sync condition removal to npc', e); }
    }
};

window.tbCombRemover = async function(pid) {
    if (!confirm('Remover do combate?')) return;
    const parts = (T.combate?.participantes || []).filter(p => p.id !== pid);
    await salvar(parts);
};
