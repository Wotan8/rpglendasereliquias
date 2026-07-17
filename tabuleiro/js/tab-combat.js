// =============================================
// TABULEIRO — Janela de Combate
// Sincroniza com Painel do Mestre > Mesas > Combate
// =============================================
import { db, doc, setDoc, updateDoc, getDoc } from '../../painel-mestre/js/firebase-config.js';
import { T, esc, toast } from './tab-state.js';
import { refCombate, refEstado } from './tab-main.js';

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
        const stats = secreto ? `
            ${barra('VIT', p.hpCurrent ?? 0, p.hpMax ?? 0, 'linear-gradient(90deg,#10b981,#34d399)')}
            ${barra('ENER', p.enerCurrent ?? 0, p.enerMax ?? 0, 'linear-gradient(90deg,#f59e0b,#fbbf24)')}
            ${barra('SAN', p.sanCurrent ?? 0, p.sanMax ?? 0, 'linear-gradient(90deg,#6366f1,#8b5cf6)')}` : '';
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
    p[cur] = Math.max(0, Math.min((p[cur] ?? 0) + amt, p[max] ?? 999));
    await salvar(parts);
    // Se for personagem de jogador, reflete na ficha (char doc)
    if (p.characterId) {
        try {
            const campo = { VIT: 'hpCurrent', ENER: 'enerCurrent', SAN: 'sanCurrent' }[stat];
            await updateDoc(doc(db, 'char', p.characterId), { [campo]: p[cur] });
        } catch (e) { console.warn('sync char', e); }
    }
};

window.tbCombCondAdd = async function(pid) {
    const cond = prompt('Condição (ex: Envenenado, Caído, Atordoado):');
    if (!cond) return;
    const parts = (T.combate?.participantes || []).map(p => ({ ...p }));
    const p = parts.find(x => x.id === pid); if (!p) return;
    p.condicoes = [...(p.condicoes || []), cond.trim()];
    await salvar(parts);
};

window.tbCombCondRm = async function(pid, i) {
    const parts = (T.combate?.participantes || []).map(p => ({ ...p }));
    const p = parts.find(x => x.id === pid); if (!p) return;
    p.condicoes = (p.condicoes || []).filter((_, ci) => ci !== i);
    await salvar(parts);
};

window.tbCombRemover = async function(pid) {
    if (!confirm('Remover do combate?')) return;
    const parts = (T.combate?.participantes || []).filter(p => p.id !== pid);
    await salvar(parts);
};
