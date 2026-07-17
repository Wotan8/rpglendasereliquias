// =============================================
// TABULEIRO — Clima & Telhados (FASE 6)
// Partículas leves (chuva, neve, cinzas, névoa) desenhadas em espaço de tela,
// configuradas por canvas (sincroniza). Telhados: imagens com flag `telhado`
// desenhadas acima dos tokens, com fade quando um token controlado entra.
// =============================================
import { T } from './tab-state.js';

const MAX_PARTICULAS = { chuva: 220, neve: 160, cinzas: 110, nevoa: 26 };
let parts = [];
let tipoAtual = 'nenhum';

export function climaAtivo() {
    const c = T.canvas?.clima;
    return c && c.tipo && c.tipo !== 'nenhum' ? c : null;
}

function resetParticulas(tipo, w, h, intensidade) {
    tipoAtual = tipo;
    const n = Math.round((MAX_PARTICULAS[tipo] || 100) * (intensidade || 1));
    parts = [];
    for (let i = 0; i < n; i++) parts.push(novaParticula(tipo, w, h, true));
}
function novaParticula(tipo, w, h, qualquerY) {
    const y = qualquerY ? Math.random() * h : -20;
    switch (tipo) {
        case 'chuva': return { x: Math.random() * (w + 200) - 100, y, vx: -2.2, vy: 14 + Math.random() * 8, len: 12 + Math.random() * 10, a: 0.25 + Math.random() * 0.3 };
        case 'neve': return { x: Math.random() * w, y, vx: 0, vy: 0.8 + Math.random() * 1.2, r: 1.5 + Math.random() * 2.5, fase: Math.random() * 6.28, a: 0.5 + Math.random() * 0.4 };
        case 'cinzas': return { x: Math.random() * w, y: qualquerY ? Math.random() * h : h + 10, vx: 0, vy: -(0.5 + Math.random() * 1), r: 1 + Math.random() * 2, fase: Math.random() * 6.28, a: 0.35 + Math.random() * 0.35, quente: Math.random() < 0.25 };
        case 'nevoa': return { x: Math.random() * w, y: Math.random() * h, vx: 0.15 + Math.random() * 0.25, vy: 0, r: 90 + Math.random() * 160, a: 0.05 + Math.random() * 0.06 };
        default: return { x: 0, y: 0 };
    }
}

/**
 * Desenha o clima em espaço de TELA (chamar com transform identidade ajustada a dpr).
 * Retorna true se há animação em andamento (render deve continuar marcando dirty).
 */
export function desenharClima(ctx, w, h) {
    const c = climaAtivo();
    if (!c) { parts = []; tipoAtual = 'nenhum'; return false; }
    if (tipoAtual !== c.tipo || !parts.length) resetParticulas(c.tipo, w, h, c.intensidade || 1);
    const t = Date.now() / 1000;
    ctx.save();
    for (const p of parts) {
        switch (c.tipo) {
            case 'chuva':
                p.x += p.vx; p.y += p.vy;
                if (p.y > h + 20) Object.assign(p, novaParticula('chuva', w, h, false));
                ctx.strokeStyle = `rgba(160,200,255,${p.a})`;
                ctx.lineWidth = 1.2;
                ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.vx * 1.4, p.y + p.len); ctx.stroke();
                break;
            case 'neve':
                p.y += p.vy; p.x += Math.sin(t * 1.2 + p.fase) * 0.6;
                if (p.y > h + 10) Object.assign(p, novaParticula('neve', w, h, false));
                ctx.fillStyle = `rgba(240,248,255,${p.a})`;
                ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
                break;
            case 'cinzas':
                p.y += p.vy; p.x += Math.sin(t * 0.8 + p.fase) * 0.5;
                if (p.y < -10) Object.assign(p, novaParticula('cinzas', w, h, false));
                ctx.fillStyle = p.quente ? `rgba(251,146,60,${p.a})` : `rgba(148,150,160,${p.a})`;
                ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
                break;
            case 'nevoa': {
                p.x += p.vx;
                if (p.x - p.r > w) p.x = -p.r;
                const g = ctx.createRadialGradient(p.x, p.y, p.r * 0.2, p.x, p.y, p.r);
                g.addColorStop(0, `rgba(200,210,225,${p.a})`);
                g.addColorStop(1, 'rgba(200,210,225,0)');
                ctx.fillStyle = g;
                ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
                break;
            }
        }
    }
    ctx.restore();
    return true;
}

// ---------- TELHADOS ----------
/**
 * Alpha do telhado: 0.25 quando um token relevante está sob ele, 1 caso contrário.
 * Público: tokens do próprio jogador · Secreto: token selecionado ou qualquer token de personagem.
 */
export function alphaTelhado(o) {
    const dentro = (t) => t.x >= o.x && t.x <= o.x + (o.w || 0) && t.y >= o.y && t.y <= o.y + (o.h || 0);
    if (T.mode === 'secret') {
        const sel = T.selection && T.objects.get(T.selection);
        if (sel?.tipo === 'token' && dentro(sel)) return 0.25;
        for (const t of T.objects.values()) {
            if (t.tipo === 'token' && t.vinculo?.tipo === 'char' && dentro(t)) return 0.25;
        }
        return 1;
    }
    for (const t of T.objects.values()) {
        if (t.tipo !== 'token' || t.vinculo?.tipo !== 'char') continue;
        const ch = T.chars.find(c => c.id === t.vinculo.id);
        if (ch?.ownerUid === T.user?.uid && dentro(t)) return 0.25;
    }
    return 1;
}
