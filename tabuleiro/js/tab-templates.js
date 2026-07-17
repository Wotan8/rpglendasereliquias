// =============================================
// TABULEIRO — Templates de Área (AoE) + Terreno Difícil (FASE 4)
// Formas: círculo, cone, linha, retângulo — com hit-testing de tokens,
// marcação de alvos e duração em rodadas (expira no tracker de combate).
// Geometria pura exportada (testável em Node).
// =============================================
import { T, esc, toast, gridSize, markDirty, escalaCanvas, unidadesParaPx } from './tab-state.js';
import { addObj, updObj, delObj, maxZ } from './tab-objects.js';

// ---------- GEOMETRIA PURA ----------
function distPontoSeg(p, a, b) {
    const l2 = (b.x-a.x)**2 + (b.y-a.y)**2;
    if (!l2) return Math.hypot(p.x-a.x, p.y-a.y);
    let t = ((p.x-a.x)*(b.x-a.x) + (p.y-a.y)*(b.y-a.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (a.x + t*(b.x-a.x)), p.y - (a.y + t*(b.y-a.y)));
}
function normAng(a) { while (a < -Math.PI) a += Math.PI*2; while (a > Math.PI) a -= Math.PI*2; return a; }

/**
 * Um círculo (token: centro c, raio rt) intersecta o template?
 * Template: { forma:'circulo'|'cone'|'linha'|'ret', origem, destino, raio, ang }
 * - circulo: origem + raio (px)
 * - cone: origem, direção até destino, comprimento = |destino-origem|, abertura ang (graus)
 * - linha: origem→destino com largura = raio (px)
 * - ret: origem/destino como cantos opostos
 */
export function templateAtingeCirculo(tpl, c, rt) {
    if (tpl.forma === 'circulo') {
        return Math.hypot(c.x - tpl.origem.x, c.y - tpl.origem.y) <= (tpl.raio || 0) + rt;
    }
    if (tpl.forma === 'linha') {
        return distPontoSeg(c, tpl.origem, tpl.destino) <= (tpl.raio || 10) / 2 + rt;
    }
    if (tpl.forma === 'ret') {
        const x0 = Math.min(tpl.origem.x, tpl.destino.x) - rt, x1 = Math.max(tpl.origem.x, tpl.destino.x) + rt;
        const y0 = Math.min(tpl.origem.y, tpl.destino.y) - rt, y1 = Math.max(tpl.origem.y, tpl.destino.y) + rt;
        return c.x >= x0 && c.x <= x1 && c.y >= y0 && c.y <= y1;
    }
    if (tpl.forma === 'cone') {
        const L = Math.hypot(tpl.destino.x - tpl.origem.x, tpl.destino.y - tpl.origem.y);
        const d = Math.hypot(c.x - tpl.origem.x, c.y - tpl.origem.y);
        if (d > L + rt) return false;
        if (d <= rt) return true; // origem dentro do token
        const dir = Math.atan2(tpl.destino.y - tpl.origem.y, tpl.destino.x - tpl.origem.x);
        const aC = Math.atan2(c.y - tpl.origem.y, c.x - tpl.origem.x);
        const meia = ((tpl.ang || 60) * Math.PI / 180) / 2;
        const desvio = Math.abs(normAng(aC - dir));
        // folga angular pelo raio do token
        const folga = d > 1e-6 ? Math.asin(Math.min(1, rt / d)) : Math.PI;
        return desvio <= meia + folga;
    }
    return false;
}

/** Lista tokens do canvas atingidos pelo template. */
export function tokensAtingidos(tpl) {
    const gs = gridSize();
    const out = [];
    for (const o of T.objects.values()) {
        if (o.tipo !== 'token') continue;
        const rt = ((o.tamanhoCelulas || 1) * gs) / 2;
        if (templateAtingeCirculo(tpl, { x: o.x, y: o.y }, rt)) out.push(o);
    }
    return out;
}

// ---------- ESTADO DA FERRAMENTA ----------
export const tplCfg = {
    forma: 'circulo',   // circulo | cone | linha | ret
    ang: 60,            // abertura do cone (graus)
    largura: 1,         // largura da linha (células)
    cor: '#f97316',
    alpha: 0.35,
    duracao: 0,         // rodadas (0 = permanente até remover)
};

export function initTemplates() {
    // Sub-barra de templates
    document.querySelectorAll('[data-tpl]').forEach(b => b.addEventListener('click', () => {
        tplCfg.forma = b.dataset.tpl;
        document.querySelectorAll('[data-tpl]').forEach(x => x.classList.toggle('active', x.dataset.tpl === tplCfg.forma));
    }));
    const bind = (id, campo, parse) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', () => tplCfg[campo] = parse ? parse(el.value) : el.value);
    };
    bind('tplAng', 'ang', v => parseInt(v) || 60);
    bind('tplLarg', 'largura', v => parseFloat(v) || 1);
    bind('tplCor', 'cor');
    bind('tplAlpha', 'alpha', v => (parseInt(v) || 35) / 100);
    bind('tplDur', 'duracao', v => parseInt(v) || 0);
    // Terreno difícil
    const tm = document.getElementById('terMult');
    if (tm) tm.addEventListener('change', () => window._terMult = parseFloat(tm.value) || 2);
    window._terMult = 2;
}

/** Cria o objeto template no Firestore ao confirmar o gesto. */
export async function confirmarTemplate(origem, destino) {
    const gs = gridSize();
    const tpl = {
        tipo: 'template', layerId: 'tokens',
        forma: tplCfg.forma,
        origem, destino,
        raio: tplCfg.forma === 'circulo'
            ? Math.hypot(destino.x - origem.x, destino.y - origem.y)
            : tplCfg.largura * gs,
        ang: tplCfg.ang,
        cor: tplCfg.cor, alpha: tplCfg.alpha,
        duracao: tplCfg.duracao,
        rodadaCriada: T.combate?.rodada || 1,
        alvos: [],
        x: origem.x, y: origem.y, z: maxZ() + 1,
        visivelPublico: true,
    };
    const atingidos = tokensAtingidos(tpl);
    const id = await addObj(tpl);
    if (atingidos.length) abrirPopupAlvos(id, atingidos);
    else toast('🎯 Template criado (nenhum token na área)');
    return id;
}

function abrirPopupAlvos(tplId, tokens) {
    window._tbAbrirModal('🎯 Tokens na área do template', `
        <div class="tb-list">${tokens.map(t =>
            `<div class="tb-list-row">${esc(t.nome || 'Token')} <span class="tb-muted" style="font-size:.72rem;margin-left:auto">${t.vinculo?.tipo || 'custom'}</span></div>`).join('')}
        </div>
        <div class="tb-modal-actions">
            <button class="tb-btn" onclick="tbFecharModal()">Fechar</button>
            <button class="tb-btn tb-btn-success" onclick="tbMarcarAlvos('${tplId}')">🎯 Marcar alvos</button>
        </div>`);
    window._tbAlvosTemp = tokens.map(t => t.id);
}
window.tbMarcarAlvos = function(tplId) {
    updObj(tplId, { alvos: window._tbAlvosTemp || [] });
    window.tbFecharModal();
    toast('🎯 Alvos marcados no mapa');
};

/**
 * Expira templates com duração ao virar a rodada.
 * Chamado por tab-combat quando `rodada` aumenta (apenas no cliente do mestre).
 */
export async function expirarTemplates(rodadaAtual) {
    if (!T.isMaster) return;
    for (const o of [...T.objects.values()]) {
        if (o.tipo !== 'template' || !(o.duracao > 0)) continue;
        if (rodadaAtual >= (o.rodadaCriada || 1) + o.duracao) {
            await delObj(o.id);
            toast(`⏳ Template expirou (${o.forma})`, 'warning');
        }
    }
}

// ---------- TERRENO DIFÍCIL (polígono do mestre, camada dm) ----------
/** Finaliza o polígono de terreno difícil desenhado pelo mestre. */
export async function confirmarTerreno(pontos) {
    if (!pontos || pontos.length < 3) { toast('⚠️ Terreno precisa de pelo menos 3 pontos', 'warning'); return; }
    await addObj({
        tipo: 'terreno', layerId: 'dm',
        pontos, mult: window._terMult || 2,
        x: pontos[0].x, y: pontos[0].y,
        visivelPublico: false,
    });
    toast(`🟨 Terreno difícil x${window._terMult || 2} criado`);
}

/** Lista de terrenos do canvas (para custo de movimento/régua). */
export function terrenosDoCanvas() {
    const out = [];
    for (const o of T.objects.values()) {
        if (o.tipo === 'terreno' && o.pontos?.length >= 3) out.push({ pontos: o.pontos, mult: o.mult || 2 });
    }
    return out;
}
