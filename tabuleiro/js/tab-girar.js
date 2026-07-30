// =============================================
// TABULEIRO — Girar o token (mirar a visão em cone)
// Um token com amplitude < 360° só enxerga para onde está virado, mas o
// campo "Direção" mora no painel de Propriedades, que é do mestre. Sem
// isto o jogador com visão em cone fica preso olhando para 0° — girar
// vira decisão de mesa que ele não consegue tomar.
//
// Mora fora do tab-tools.js de propósito: registra o próprio listener e
// não disputa arquivo com as ferramentas de ponteiro.
// =============================================
import { T, markDirty, tokenDoUsuario, can, anguloDoMovimento } from './tab-state.js';
import { worldToScreen } from './tab-render.js';
import { updObj } from './tab-objects.js';

const PASSO = 15;        // graus por toque
const PASSO_FINO = 45;   // com Shift

/** Mesma regra de quem pode mover: dono do token, ou o mestre. */
function podeGirar(o) {
    if (!o || o.tipo !== 'token' || o.bloqueado) return false;
    if (T.isMaster) return true;
    return tokenDoUsuario(o) && can('moverToken');
}

/** Gira `graus` (relativo) e normaliza para 0–359. */
export function girarToken(id, graus) {
    const o = T.objects.get(id);
    if (!podeGirar(o)) return null;
    const rot = ((Math.round((o.rot || 0) + graus) % 360) + 360) % 360;
    o.rot = rot;
    delete o.__fogPos;      // o cone mudou: o fog recalcula já
    updObj(id, { rot });
    markDirty();
    return rot;
}
window.tbGirarToken = girarToken;

// A conversão de ângulo vive em tab-state.js, junto com `rotParaCanvas`
// (as duas metades da mesma convenção). Reexportado para não mexer nos imports.
export { anguloDoMovimento };

/** O token só precisa mirar se a visão (ou a luz) dele for um cone. */
export function temCone(o) {
    const ang = (v) => v != null && v > 0 && v < 360;
    return !!(o && o.tipo === 'token' && ((o.visao?.ativa && ang(o.visao.angulo)) || (o.luz?.ativa && ang(o.luz.angulo))));
}

/* ── Botões ↺ ↻ ancorados ao token ────────────────────────
   No celular não há Q/E: sem estes botões o jogador de tablet
   simplesmente não consegue mirar o cone. Servem também de dica
   no desktop, onde a tecla continua valendo. */
let barra = null, ultimoEstilo = '';

function garantirBarra() {
    if (barra) return barra;
    barra = document.createElement('div');
    barra.id = 'tbGirarBar';
    barra.hidden = true;
    barra.innerHTML = `<button data-gira="-1" title="Girar à esquerda (Q)">↺</button>
                       <button data-gira="1" title="Girar à direita (E)">↻</button>`;
    // pointerdown, não click: o canvas escuta pointerdown e roubaria o gesto
    barra.addEventListener('pointerdown', (e) => {
        const b = e.target.closest('[data-gira]');
        if (!b) return;
        e.preventDefault(); e.stopPropagation();
        const o = T.selection && T.objects.get(T.selection);
        if (o) girarToken(o.id, Number(b.dataset.gira) * (e.shiftKey ? PASSO_FINO : PASSO));
    });
    document.body.appendChild(barra);
    return barra;
}

/** Ancora os botões ao token. Recebe centro e raio em coordenadas de MUNDO. */
export function posicionarBotoesGirar(o, cx, cy, r) {
    const el = garantirBarra();
    const p = worldToScreen({ x: cx, y: cy });
    const raioTela = r * T.cam.z;
    const estilo = `left:${Math.round(p.x)}px;top:${Math.round(p.y - raioTela - 26)}px`;
    if (estilo !== ultimoEstilo) { el.style.cssText = estilo; ultimoEstilo = estilo; }
    el.hidden = false;
}

export function esconderBotoesGirar() {
    if (barra && !barra.hidden) barra.hidden = true;
}

export function initGirar() {
    window.addEventListener('keydown', (e) => {
        if (e.target.matches?.('input,textarea,select')) return;
        const k = e.key.toLowerCase();
        if (k !== 'q' && k !== 'e') return;
        const o = T.selection && T.objects.get(T.selection);
        if (!podeGirar(o)) return;
        e.preventDefault();
        girarToken(o.id, (k === 'q' ? -1 : 1) * (e.shiftKey ? PASSO_FINO : PASSO));
    });
}

/** Quem pode girar ESTE token agora? Exportado para o render desenhar a alça. */
export const podeGirarToken = podeGirar;
