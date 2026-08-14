// =============================================
// TABULEIRO — Fog Persistente & Visão (FASE 3)
// - Memória de exploração compartilhada da mesa (grade de bits por célula,
//   salva em base64 no doc do canvas, com debounce)
// - Teste "token dentro da visão atual" (esconder inimigos fora de visão)
// - Utilidades de sensores
// =============================================
import { updateDoc } from '../../painel-mestre/js/firebase-config.js';
import { T, gridSize, markDirty, toast, tokenInvisivel } from './tab-state.js';
import { refCanvas } from './tab-main.js';
import { pontoEmPoligono } from './tab-grid.js';

// Estado local da exploração (grade de bits, 1 bit por célula do grid)
const EXP = {
    x0: 0, y0: 0, cols: 0, rows: 0,   // origem/dimensão em CÉLULAS
    bits: null,                        // Uint8Array (1 byte = 8 células)
    sujo: false,
    carregadaDe: null,                 // canvasId de onde carregou
    versao: 0,                         // contador p/ invalidar o fog composto em cache
    ultimoB64: null,                   // último `dados` sincronizado (salvo ou carregado) — corta o merge do eco
};

/** Muda a cada célula nova explorada — chave de cache do fog composto. */
export function versaoExploracao() { return EXP.versao; }
let saveTimer = null;

export const SENSORES = [
    { id: 'padrao',       nome: '👁️ Padrão (precisa de luz)' },
    { id: 'noturna',      nome: '🌙 Visão noturna' },
    { id: 'verInvisivel', nome: '✨ Ver o invisível' },
    { id: 'tremorsense',  nome: '🌊 Tremorsense (ignora paredes, mesma elevação)' },
    { id: 'verdadeira',   nome: '🔮 Visão verdadeira' },
];

// ---------- carga / persistência ----------
export function carregarExploracao() {
    const e = T.canvas?.exploracao;
    const trocouCanvas = EXP.carregadaDe !== T.canvasId;
    EXP.carregadaDe = T.canvasId;
    if (!e || !e.dados) {
        // Doc sem exploração = ninguém explorou nada. Limpar também aqui é o que faz o
        // "Resetar exploração" do mestre chegar nos outros clientes — antes cada um
        // guardava a própria grade e o primeiro a explorar de novo regravava tudo.
        // `sujo` protege quem ainda tem células novas esperando o debounce do save.
        if (trocouCanvas || !EXP.sujo) {
            clearTimeout(saveTimer);
            EXP.x0 = 0; EXP.y0 = 0; EXP.cols = 0; EXP.rows = 0; EXP.bits = null; EXP.sujo = false;
            EXP.ultimoB64 = null;
            EXP.versao++;
            markDirty();
        }
        return;
    }
    // Eco do que já está aplicado (o próprio save voltando, duas vezes: a
    // compensação local e o ack do servidor): o merge O(células) rodava
    // inteiro à toa, no meio do arrasto.
    if (!trocouCanvas && e.dados === EXP.ultimoB64) return;
    try {
        const bin = atob(e.dados);
        const inBits = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) inBits[i] = bin.charCodeAt(i);
        if (trocouCanvas || !EXP.bits) {
            EXP.x0 = e.x0 | 0; EXP.y0 = e.y0 | 0; EXP.cols = e.cols | 0; EXP.rows = e.rows | 0;
            EXP.bits = inBits;
            EXP.sujo = false;
            EXP.versao++;
        } else {
            // MERGE (OR): outro cliente pode ter explorado células diferentes
            const cols = e.cols | 0, rows = e.rows | 0, x0 = e.x0 | 0, y0 = e.y0 | 0;
            for (let y = 0; y < rows; y++) {
                for (let x = 0; x < cols; x++) {
                    const i = y * cols + x;
                    if (inBits[i >> 3] & (1 << (i & 7))) marcarCelula(x + x0, y + y0);
                }
            }
            // marcarCelula seta sujo apenas para células novas; snapshot recebido não precisa re-salvar
        }
        EXP.ultimoB64 = e.dados;
        markDirty();
    } catch (err) { console.warn('exploracao load', err); }
}

function agendarSave() {
    if (!EXP.sujo) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
        if (!EXP.bits || !T.canvasId) return;
        // Arrasto em andamento: o payload da exploração (dezenas de KB) entra
        // na frente dos writes de posição no MESMO stream do Firestore e o
        // token remoto congela esperando o upload. Espera o arrasto acabar.
        if (T.dragAtivo) { agendarSave(); return; }
        try {
            let bin = '';
            const b = EXP.bits;
            for (let i = 0; i < b.length; i += 0x8000) {
                bin += String.fromCharCode.apply(null, b.subarray(i, Math.min(i + 0x8000, b.length)));
            }
            const dados = btoa(bin);
            await updateDoc(refCanvas(), {
                exploracao: { x0: EXP.x0, y0: EXP.y0, cols: EXP.cols, rows: EXP.rows, dados },
            });
            EXP.ultimoB64 = dados;
            EXP.sujo = false;
        } catch (e) { console.warn('exploracao save', e); }
    }, 3000);
}

export async function resetarExploracao() {
    EXP.bits = null; EXP.cols = EXP.rows = 0; EXP.sujo = false; EXP.versao++;
    try { await updateDoc(refCanvas(), { exploracao: null }); toast('🌫️ Memória de exploração resetada'); markDirty(); }
    catch (e) { toast('❌ Erro ao resetar exploração', 'danger'); }
}
window.tbResetExploracao = resetarExploracao;

// ---------- grade de bits ----------
function garantirCapacidade(cx, cy) {
    // Expande a grade (com folga de 16 células) para conter a célula (cx, cy)
    if (!EXP.bits) {
        EXP.x0 = cx - 16; EXP.y0 = cy - 16; EXP.cols = 33; EXP.rows = 33;
        EXP.bits = new Uint8Array(Math.ceil((EXP.cols * EXP.rows) / 8));
        return;
    }
    if (cx >= EXP.x0 && cy >= EXP.y0 && cx < EXP.x0 + EXP.cols && cy < EXP.y0 + EXP.rows) return;
    const nx0 = Math.min(EXP.x0, cx - 16), ny0 = Math.min(EXP.y0, cy - 16);
    const nx1 = Math.max(EXP.x0 + EXP.cols, cx + 17), ny1 = Math.max(EXP.y0 + EXP.rows, cy + 17);
    const ncols = nx1 - nx0, nrows = ny1 - ny0;
    if (ncols * nrows > 1_500_000) return; // limite de segurança (~190KB)
    const novo = new Uint8Array(Math.ceil((ncols * nrows) / 8));
    for (let y = 0; y < EXP.rows; y++) {
        for (let x = 0; x < EXP.cols; x++) {
            const i = y * EXP.cols + x;
            if (EXP.bits[i >> 3] & (1 << (i & 7))) {
                const j = (y + EXP.y0 - ny0) * ncols + (x + EXP.x0 - nx0);
                novo[j >> 3] |= (1 << (j & 7));
            }
        }
    }
    EXP.x0 = nx0; EXP.y0 = ny0; EXP.cols = ncols; EXP.rows = nrows; EXP.bits = novo;
}

function marcarCelula(cx, cy) {
    garantirCapacidade(cx, cy);
    if (!EXP.bits) return;
    const x = cx - EXP.x0, y = cy - EXP.y0;
    if (x < 0 || y < 0 || x >= EXP.cols || y >= EXP.rows) return;
    const i = y * EXP.cols + x;
    const antes = EXP.bits[i >> 3] & (1 << (i & 7));
    if (!antes) { EXP.bits[i >> 3] |= (1 << (i & 7)); EXP.sujo = true; EXP.versao++; }
}

export function celulaExplorada(cx, cy) {
    if (!EXP.bits) return false;
    const x = cx - EXP.x0, y = cy - EXP.y0;
    if (x < 0 || y < 0 || x >= EXP.cols || y >= EXP.rows) return false;
    const i = y * EXP.cols + x;
    return !!(EXP.bits[i >> 3] & (1 << (i & 7)));
}

/**
 * Rasteriza a área VISÍVEL AGORA na memória de exploração (modo público).
 * Uma célula conta como explorada se estiver na LoS de alguma visão e,
 * quando o sensor exige luz, também dentro de alguma área iluminada.
 * @param visaoEntries [{ poly, sensor, precisaLuz }]
 * @param litPolys 'dia' | [poly] (áreas iluminadas)
 */
export function registrarExploracaoCelulas(visaoEntries, litPolys) {
    if (T.canvas?.luzDinamica?.memoria === false) return; // memória desativável
    const gs = gridSize();
    const dia = litPolys === 'dia';
    const iluminado = (p) => dia || (litPolys || []).some(poly => poly?.length >= 3 && pontoEmPoligono(p, poly));
    let marcou = false;
    for (const e of visaoEntries || []) {
        const poly = e.poly;
        if (!poly || poly.length < 3) continue;
        let minX = 1e12, minY = 1e12, maxX = -1e12, maxY = -1e12;
        for (const p of poly) { if (p.x<minX)minX=p.x; if (p.y<minY)minY=p.y; if (p.x>maxX)maxX=p.x; if (p.y>maxY)maxY=p.y; }
        const cx0 = Math.floor(minX / gs), cx1 = Math.floor(maxX / gs);
        const cy0 = Math.floor(minY / gs), cy1 = Math.floor(maxY / gs);
        if ((cx1 - cx0) * (cy1 - cy0) > 40_000) continue; // segurança
        for (let cy = cy0; cy <= cy1; cy++) {
            for (let cx = cx0; cx <= cx1; cx++) {
                if (celulaExplorada(cx, cy)) continue;
                const centro = { x: cx * gs + gs / 2, y: cy * gs + gs / 2 };
                if (!pontoEmPoligono(centro, poly)) continue;
                if (e.precisaLuz && !iluminado(centro)) continue;
                marcarCelula(cx, cy); marcou = true;
            }
        }
    }
    if (marcou) agendarSave();
}

/**
 * Desenha a memória explorada num contexto já em coordenadas de MUNDO.
 * Usado pelo fog para o estado intermediário ("já visto").
 */
export function desenharExploracao(ctx2, rect) {
    if (!EXP.bits) return false;
    const gs = gridSize();
    const cx0 = Math.max(EXP.x0, Math.floor(rect.x0 / gs));
    const cx1 = Math.min(EXP.x0 + EXP.cols - 1, Math.floor(rect.x1 / gs));
    const cy0 = Math.max(EXP.y0, Math.floor(rect.y0 / gs));
    const cy1 = Math.min(EXP.y0 + EXP.rows - 1, Math.floor(rect.y1 / gs));
    let desenhou = false;
    ctx2.beginPath();
    for (let cy = cy0; cy <= cy1; cy++) {
        let runIni = null;
        for (let cx = cx0; cx <= cx1 + 1; cx++) {
            const on = cx <= cx1 && celulaExplorada(cx, cy);
            if (on && runIni === null) runIni = cx;
            else if (!on && runIni !== null) {
                ctx2.rect(runIni * gs, cy * gs, (cx - runIni) * gs, gs);
                runIni = null; desenhou = true;
            }
        }
    }
    if (desenhou) ctx2.fill();
    return desenhou;
}

// ---------- visibilidade de tokens ----------
/**
 * O ponto está dentro de alguma visão atual do observador?
 * Respeita a exigência de luz do sensor (`T._litPolys` vem do render).
 * `T.visiveisAgora` = [{ poly, sensor, precisaLuz }].
 */
export function pontoVisivelAgora(p) {
    const entries = T.visiveisAgora || [];
    const lit = T._litPolys;
    const iluminado = () => lit === 'dia' || (Array.isArray(lit) && lit.some(poly => poly?.length >= 3 && pontoEmPoligono(p, poly)));
    for (const e of entries) {
        if (!e.poly || !pontoEmPoligono(p, e.poly)) continue;
        if (e.precisaLuz && !iluminado()) continue;
        return e;
    }
    return null;
}

/**
 * Decide se um token deve ser DESENHADO para o usuário atual (modo público).
 * Regras F3.1/F3.3:
 * - luz dinâmica desligada → tudo visível (comportamento clássico)
 * - tokens próprios sempre visíveis
 * - invisível: só com sensor verInvisivel/verdadeira cobrindo o ponto
 * - demais: precisam estar na área "visível agora"
 *
 * 🔧 Futura otimização: roda por token A CADA QUADRO e cada chamada testa
 * ponto-em-polígono contra todas as visões (polígono de raycast tem centenas de
 * vértices). Com o mestre agora entrando por aqui no público, são 3 telas
 * pagando o custo. Cachear o resultado por `PERF.fogKey` (só muda quando visão
 * ou parede muda) resolve sem tocar na regra.
 */
export function tokenVisivelParaMim(o, meusTokens) {
    if (T.mode === 'secret') return true;   // público é a TV: vale para o mestre também
    const luz = T.canvas?.luzDinamica;
    // Invisível por PROPRIEDADE do token ou por CONDIÇÃO aplicada — some igual.
    const invis = tokenInvisivel(o);
    if (!luz?.ativa) return invis ? false : true;
    if (meusTokens.some(t => t.id === o.id)) return true;
    const hit = pontoVisivelAgora({ x: o.x, y: o.y });
    if (!hit) return false;
    if (invis) {
        return hit.sensor === 'verInvisivel' || hit.sensor === 'verdadeira';
    }
    return true;
}
