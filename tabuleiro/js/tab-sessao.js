// =============================================
// TABULEIRO — Painel da Sessão (Etapa 3)
// Só mestre + modo secreto (as rules nem deixam jogador ler 'sessoes'/'frentes').
// - Janela lateral lendo a sessão aberta (fase preparo/aoVivo) do Painel:
//   cenas (marcar/pular pro mapa), segredos (revelar/telão), inbox, encontros.
// - T.frentes ao vivo: relógios de canvas com frenteId renderizam da frente
//   (mestre) e espelham {fatias,cheias} no objeto para o público ver anônimo.
// =============================================
import { db, collection, doc, onSnapshot, setDoc, updateDoc, query, where } from '../../painel-mestre/js/firebase-config.js';
import { T, esc, toast, markDirty } from './tab-state.js';
import { refCombate, refLegenda, trocarCanvas } from './tab-main.js';
import { transicaoDeCena } from './tab-cena.js';
import { updObj } from './tab-objects.js';

let SES = null;

const refSessao = () => doc(db, 'mesas', T.mesaId, 'sessoes', SES.id);

export function initSessao() {
    if (!(T.isMaster && T.mode === 'secret')) return;
    T.frentes = {};

    // Frentes ao vivo (painel + relógios vinculados)
    T.unsubs.push(onSnapshot(collection(db, 'mesas', T.mesaId, 'frentes'), s => {
        T.frentes = {};
        s.forEach(d => { T.frentes[d.id] = { id: d.id, ...d.data() }; });
        espelharRelogios();
        markDirty();
        render();
    }));
    // ponytail: espelho cobre só o canvas aberto; primeiro snapshot pode chegar
    // antes dos objetos — uma re-checagem tardia resolve o boot. Canvas trocado
    // atualiza na próxima mudança de frente ou reabertura do Tabuleiro.
    setTimeout(espelharRelogios, 3000);

    // Sessão aberta (uma por vez: preparo ou aoVivo)
    T.unsubs.push(onSnapshot(query(collection(db, 'mesas', T.mesaId, 'sessoes'),
        where('fase', 'in', ['preparo', 'aoVivo'])), s => {
        SES = null;
        s.forEach(d => { if (!SES) SES = { id: d.id, ...d.data() }; });
        render();
    }));

    montarJanela();
    const btn = document.getElementById('btnSessao');
    if (btn) btn.onclick = () => document.getElementById('tbSessaoWin').classList.toggle('open');
}

// ---------- ESPELHO DOS RELÓGIOS VINCULADOS ----------
function espelharRelogios() {
    if (!T.objects) return;
    for (const o of T.objects.values()) {
        if (o.tipo !== 'relogio' || !o.frenteId) continue;
        const f = T.frentes[o.frenteId];
        if (!f) continue;
        const esp = { fatias: f.relogio?.fatias || 6, cheias: Math.min(f.relogio?.cheias || 0, f.relogio?.fatias || 6) };
        if (o.espelho?.fatias !== esp.fatias || o.espelho?.cheias !== esp.cheias) {
            updObj(o.id, { espelho: esp });
        }
    }
}

// ---------- JANELA ----------
function montarJanela() {
    const win = document.createElement('div');
    win.className = 'tb-window';
    win.id = 'tbSessaoWin';
    win.style.cssText = 'left:16px;right:auto;width:360px';
    win.innerHTML = `
        <div class="tb-win-head">📋 Sessão <button class="tb-mini-btn" onclick="document.getElementById('tbSessaoWin').classList.remove('open')">✕</button></div>
        <div class="tb-win-body" id="tbSessaoBody"></div>`;
    document.body.appendChild(win);
    // Arrastar (mesmo padrão da janela de combate)
    const head = win.querySelector('.tb-win-head');
    let drag = null;
    head.addEventListener('pointerdown', e => {
        if (e.target.closest('button')) return;
        drag = { x: e.clientX, y: e.clientY, l: win.offsetLeft, t: win.offsetTop };
        head.setPointerCapture(e.pointerId);
    });
    head.addEventListener('pointermove', e => {
        if (!drag) return;
        win.style.left = (drag.l + e.clientX - drag.x) + 'px';
        win.style.top = (drag.t + e.clientY - drag.y) + 'px';
        win.style.right = 'auto';
    });
    head.addEventListener('pointerup', () => drag = null);
}

function render() {
    const el = document.getElementById('tbSessaoBody'); if (!el) return;
    if (!SES) {
        el.innerHTML = '<div class="tb-muted" style="text-align:center;padding:20px;font-size:.82rem">Nenhuma sessão aberta.<br>Prepare uma no Painel do Mestre → Mesa → 🎬 Sessão.</div>';
        return;
    }
    const s = SES;
    const cenas = (s.cenas || []).map((c, i) => `
        <div style="display:flex;align-items:center;gap:6px;padding:3px 0">
            <input type="checkbox" ${c.feita ? 'checked' : ''} onchange="tbSesCena(${i}, this.checked)" style="width:15px;height:15px;cursor:pointer">
            <span style="flex:1;font-size:.8rem;${c.feita ? 'text-decoration:line-through;opacity:.5' : ''}" title="${esc(c.notas || '')}">${esc(c.titulo)}</span>
            ${c.canvasId ? `<button class="tb-mini-btn" title="Ir para o mapa desta cena" onclick="tbSesIrMapa('${c.canvasId}')">🗺️</button>` : ''}
        </div>`).join('') || '<div class="tb-muted" style="font-size:.75rem">Sem cenas</div>';
    const segredos = (s.segredos || []).map(x => `
        <div style="display:flex;align-items:center;gap:6px;padding:3px 0">
            <span style="flex:1;font-size:.8rem;${x.revelado ? 'text-decoration:line-through;opacity:.5' : ''}">🗝️ ${esc(x.texto)}</span>
            ${x.revelado ? '' : `<button class="tb-mini-btn" title="Marcar como revelado" onclick="tbSesRevelar('${x.id}', false)">✅</button>
            <button class="tb-mini-btn" title="Revelar no telão (teleprompter)" onclick="tbSesRevelar('${x.id}', true)">🎬</button>`}
        </div>`).join('') || '<div class="tb-muted" style="font-size:.75rem">Sem segredos</div>';
    const encontros = (s.encontros || []).map(e2 => `
        <div style="display:flex;align-items:center;gap:6px;padding:3px 0">
            <span style="flex:1;font-size:.8rem">⚔️ ${esc(e2.nome || 'Encontro')} <span class="tb-muted" style="font-size:.7rem">(${(e2.participantes || []).length})</span></span>
            <button class="tb-mini-btn" title="Iniciar este combate" onclick="tbSesEncontro('${e2.id}')">▶️</button>
        </div>`).join('') || '<div class="tb-muted" style="font-size:.75rem">Sem encontros</div>';
    const frentes = Object.values(T.frentes || {}).filter(f => f.status === 'ativa')
        .sort((a, b) => ((b.relogio?.cheias || 0) / (b.relogio?.fatias || 1)) - ((a.relogio?.cheias || 0) / (a.relogio?.fatias || 1)))
        .map(f => `<div style="display:flex;gap:6px;font-size:.75rem;padding:2px 0">
            <span style="flex:1">${esc(f.nome || '')}</span>
            <span class="tb-muted">${Math.min(f.relogio?.cheias || 0, f.relogio?.fatias || 6)}/${f.relogio?.fatias || 6}</span>
        </div>`).join('');
    const sec = (t, corpo) => `<div style="margin-bottom:10px"><div style="font-size:.7rem;font-weight:800;color:var(--tb-muted);text-transform:uppercase;margin-bottom:3px">${t}</div>${corpo}</div>`;

    el.innerHTML = `
        <div style="font-weight:800;font-size:.85rem;margin-bottom:8px">Sessão ${s.numero || '?'} <span class="tb-muted" style="font-weight:400;font-size:.72rem">· ${s.fase === 'aoVivo' ? '🔴 ao vivo' : '📋 preparo'}${s.dataJogo ? ' · 🎮 ' + esc(s.dataJogo) : ''}</span></div>
        ${s.inicioForte ? `<div style="border-left:3px solid var(--tb-primary);padding:4px 8px;margin-bottom:10px;font-size:.78rem">🔥 ${esc(s.inicioForte)}</div>` : ''}
        ${sec('Cenas', cenas)}
        ${sec('Segredos', segredos)}
        ${sec('Encontros', encontros)}
        ${frentes ? sec('Frentes', frentes) : ''}
        <input type="text" class="tb-input" placeholder="📥 Capturar (Enter grava)" style="width:100%"
            onkeydown="if(event.key==='Enter')tbSesInbox(this)">`;
}

// ---------- AÇÕES (escrevem no MESMO doc que o Painel assina) ----------
window.tbSesCena = async function(i, feita) {
    if (!SES) return;
    const cenas = (SES.cenas || []).map(c => ({ ...c }));
    if (!cenas[i]) return;
    cenas[i].feita = feita;
    try { await updateDoc(refSessao(), { cenas }); } catch (e) { toast('❌ Erro', 'danger'); }
};

window.tbSesIrMapa = async function(canvasId) {
    await transicaoDeCena(() => trocarCanvas(canvasId, false));
};

window.tbSesRevelar = async function(segId, telao) {
    if (!SES) return;
    const segredos = (SES.segredos || []).map(x => ({ ...x }));
    const seg = segredos.find(x => x.id === segId); if (!seg) return;
    seg.revelado = true; seg.reveladoEm = Date.now();
    try {
        await updateDoc(refSessao(), { segredos });
        if (telao) {
            await setDoc(refLegenda(), { texto: seg.texto, vel: 24, ativo: true, t: Date.now() }, { merge: true });
            toast('🎬 Segredo no telão');
        } else toast('🗝️ Revelado');
    } catch (e) { toast('❌ Erro', 'danger'); }
};

window.tbSesEncontro = async function(encId) {
    if (!SES) return;
    const enc = (SES.encontros || []).find(x => x.id === encId); if (!enc) return;
    if (!confirm(`Iniciar "${enc.nome}"? Substitui o combate atual.`)) return;
    try {
        await setDoc(refCombate(), { participantes: enc.participantes || [], turnoAtual: 0, rodada: 1, atualizadoEm: Date.now() }, { merge: true });
        toast('⚔️ Encontro iniciado');
    } catch (e) { toast('❌ Erro', 'danger'); }
};

window.tbSesInbox = async function(input) {
    if (!SES) return;
    const texto = input.value.trim(); if (!texto) return;
    const inbox = [...(SES.inbox || []), { texto, t: Date.now() }];
    input.value = '';
    try { await updateDoc(refSessao(), { inbox }); toast('📥 Capturado'); }
    catch (e) { toast('❌ Erro', 'danger'); }
};
