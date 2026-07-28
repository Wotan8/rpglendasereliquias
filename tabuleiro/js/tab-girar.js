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
import { T, toast, markDirty, tokenDoUsuario, can } from './tab-state.js';
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

/** O token só precisa mirar se a visão (ou a luz) dele for um cone. */
export function temCone(o) {
    const ang = (v) => v != null && v > 0 && v < 360;
    return !!(o && o.tipo === 'token' && ((o.visao?.ativa && ang(o.visao.angulo)) || (o.luz?.ativa && ang(o.luz.angulo))));
}

export function initGirar() {
    window.addEventListener('keydown', (e) => {
        if (e.target.matches?.('input,textarea,select')) return;
        const k = e.key.toLowerCase();
        if (k !== 'q' && k !== 'e') return;
        const o = T.selection && T.objects.get(T.selection);
        if (!podeGirar(o)) return;
        e.preventDefault();
        const passo = e.shiftKey ? PASSO_FINO : PASSO;
        const rot = girarToken(o.id, k === 'q' ? -passo : passo);
        if (rot != null) toast(`🧭 ${o.nome || 'Token'} olhando para ${rot}°`);
    });
}

/** Quem pode girar ESTE token agora? Exportado para o render desenhar a alça. */
export const podeGirarToken = podeGirar;
