// =============================================
// TABULEIRO — Cenas & Teleprompter (FASE 6)
// - Transição de cena com fade-out → pré-carregamento dos mapas → fade-in
//   (aplicada no modo público quando o mestre troca o canvas "AO VIVO")
// - Teleprompter/legendas cinematográficas sincronizadas
// =============================================
import { setDoc, onSnapshot } from '../../painel-mestre/js/firebase-config.js';
import { T, esc, toast, markDirty } from './tab-state.js';
import { refLegenda } from './tab-main.js';
import { getImg } from './tab-render.js';

// ---------- FADE DE CENA ----------
let overlay = null;
export function initCena() {
    overlay = document.getElementById('tbFadeOverlay');

    // Teleprompter
    T.unsubs.push(onSnapshot(refLegenda(), s => {
        const d = s.exists() ? s.data() : null;
        aplicarLegenda(d);
    }));
    const btn = document.getElementById('btnTeleprompter');
    if (btn) btn.onclick = abrirModalTeleprompter;
}

/** Fade-out, troca de canvas (fn), espera mapas carregarem, fade-in. */
export async function transicaoDeCena(trocarFn) {
    if (!overlay) { await trocarFn(); return; }
    overlay.classList.add('ativo');
    await esperar(320);
    await trocarFn();
    await esperarMapasCarregarem(2500);
    overlay.classList.remove('ativo');
}

function esperar(ms) { return new Promise(r => setTimeout(r, ms)); }

async function esperarMapasCarregarem(timeout) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
        let pendente = false;
        for (const o of T.objects.values()) {
            if (o.tipo === 'imagem' && o.layerId === 'mapa' && o.url) {
                const e = T.imgCache.get(o.url);
                if (!e) { getImg(o.url); pendente = true; }
                else if (!e.ok && !e.img?.complete) pendente = true;
            }
        }
        if (!pendente) return;
        await esperar(120);
    }
}

// ---------- TELEPROMPTER / LEGENDAS ----------
function aplicarLegenda(d) {
    const el = document.getElementById('tbLegenda');
    if (!el) return;
    if (!d || !d.ativo || !d.texto) {
        el.classList.remove('ativo');
        el.innerHTML = '';
        return;
    }
    const dur = Math.max(6, Math.min(120, d.vel || 24)); // segundos p/ o texto atravessar
    el.innerHTML = `<div class="tb-legenda-texto" style="animation-duration:${dur}s">${esc(d.texto).replace(/\n/g, '<br>')}</div>`;
    el.classList.add('ativo');
}

function abrirModalTeleprompter() {
    const atual = T._legendaRascunho || '';
    window._tbAbrirModal('🎬 Teleprompter / Legendas', `
        <div class="tb-form-grid tb-form-grid-1">
            <label>Texto (narração, legenda, prólogo...)
                <textarea id="tp_texto" rows="6" placeholder="Era uma noite fria em Valdrek...">${esc(atual)}</textarea></label>
        </div>
        <div class="tb-form-grid">
            <label>Duração da rolagem (s)<input type="number" id="tp_vel" value="24" min="6" max="120"></label>
        </div>
        <div class="tb-modal-actions">
            <button class="tb-btn tb-btn-danger" onclick="tbLegendaParar()">⏹️ Parar exibição</button>
            <button class="tb-btn tb-btn-success" onclick="tbLegendaExibir()">▶️ Exibir a todos</button>
        </div>`);
}
window.tbLegendaExibir = async function() {
    const texto = document.getElementById('tp_texto').value;
    const vel = parseInt(document.getElementById('tp_vel').value) || 24;
    T._legendaRascunho = texto;
    if (!texto.trim()) { toast('⚠️ Escreva algum texto', 'warning'); return; }
    try {
        await setDoc(refLegenda(), { texto, vel, ativo: true, t: Date.now() }, { merge: true });
        window.tbFecharModal();
        toast('🎬 Legenda em exibição para todos');
    } catch (e) { toast('❌ Erro', 'danger'); }
};
window.tbLegendaParar = async function() {
    try { await setDoc(refLegenda(), { ativo: false, t: Date.now() }, { merge: true }); window.tbFecharModal(); }
    catch (e) { toast('❌ Erro', 'danger'); }
};
