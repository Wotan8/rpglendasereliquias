// =============================================
// TABULEIRO — Estado Global
// Lendas e Relíquias — VTT
// =============================================

export const T = {
    // Contexto
    mesaId: null,
    mode: 'secret',          // 'secret' | 'public'
    user: null,
    isMaster: false,
    mesa: null,              // doc da mesa
    chars: [],               // personagens da mesa
    npcs: [],                // npcs da mesa
    npcsTodos: [],           // catálogo completo (o snapshot já traz tudo — filtrar é de graça)
    usersMap: {},            // uid -> {email, nome}

    // Canvas (cenas)
    canvases: [],            // lista de tabuleiros da mesa
    canvasId: null,
    canvas: null,            // doc do canvas ativo (camadas, grid, escala, luz, permissões)
    objects: new Map(),      // id -> objeto
    estado: {},              // tabuleiro-meta/estado (canvasAtivoId, combateVisivelPublico)
    combate: null,           // tabuleiro-meta/combate
    reguasRemotas: {},       // uid -> medição compartilhada

    // Permissões resolvidas p/ usuário atual (modo público)
    perms: {},

    // Câmera
    cam: { x: 0, y: 0, z: 1 },

    // Ferramentas
    tool: 'select',
    drawShape: 'livre',      // livre | linha | ret | elipse
    drawColor: '#3b82f6',
    drawWidth: 4,
    drawFill: false,
    textCfg: { cor: '#ffffff', corBorda: '#000000', usaBorda: true, fonte: 'Arial', tamanho: 28, bold: false, italico: false },
    measureCfg: { forma: 'linha', snap: 'centro', exib: 'instantaneo', medirToken: true, mostrarOutros: true },
    luzCfg: { alcance: 6, cor: '#ffdd99', intensidade: 0.9 },

    // Interação
    selection: null,         // id do objeto selecionado
    activeLayerId: 'tokens',
    hoverId: null,
    temp: null,              // desenho/medição em andamento

    // Render
    imgCache: new Map(),
    dirty: true,

    // FASE 2 — sincronização
    anims: new Map(),        // id -> { x0, y0, t0, dur } (lerp de tokens remotos)
    camTween: null,          // tween de câmera em andamento
    cursoresRemotos: {},     // uid -> cursor
    pingsAtivos: [],         // pings em animação

    // FASE 3 — visão
    visiveisAgora: null,     // [{ poly, sensor, precisaLuz }] (público)
    _litPolys: null,         // 'dia' | [poly]
    andarAtivo: null,        // filtro de andar (secreto); null = todos

    unsubs: [],
    unsubObjetos: null,
    unsubCanvasDoc: null,
};

export const CAMADAS_PADRAO = [
    { id: 'mapa',   nome: '🗺️ Mapa',   tipo: 'mapa',   ordem: 0, visivelPublico: true,  abaixoDaLuz: true },
    { id: 'tokens', nome: '🎭 Tokens', tipo: 'tokens', ordem: 1, visivelPublico: true,  abaixoDaLuz: true },
    { id: 'dm',     nome: '🕵️ DM',     tipo: 'dm',     ordem: 2, visivelPublico: false, abaixoDaLuz: true },
    { id: 'luz',    nome: '💡 Luz',    tipo: 'luz',    ordem: 3, visivelPublico: false, abaixoDaLuz: false },
];

export const PERMISSOES_LISTA = [
    { key: 'moverToken',   label: 'Mover o próprio token' },
    { key: 'verAlemDoMapa',label: 'Ver o canva além do mapa' },
    { key: 'desenhar',     label: 'Desenhar no canva' },
    { key: 'addTexto',     label: 'Adicionar texto' },
    { key: 'addImagem',    label: 'Adicionar imagens' },
    { key: 'medir',        label: 'Usar a régua' },
    { key: 'alfinete',     label: 'Colocar alfinetes' },
    { key: 'abrirNpc',     label: 'Abrir ficha de NPCs exibidos' },
    { key: 'interagirCenario', label: 'Interagir com o cenário (portas, janelas, luzes)' },
];

/** Objetos da camada de luz que o jogador pode ver e acionar com `interagirCenario`.
 *  Os riscos (paredes) continuam invisíveis — senão o mapa entrega a própria planta. */
export const CENARIO_INTERATIVO = new Set(['porta', 'janela', 'luz']);

// ===== Utils =====
export function esc(t) {
    if (t == null) return '';
    return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

export function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

export function toast(msg, type = 'success') {
    const el = document.createElement('div');
    el.className = 'tb-toast tb-toast-' + type;
    el.textContent = msg;
    document.getElementById('tbToasts').appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 350); }, 2600);
}

export function markDirty() { T.dirty = true; }

// Escala helpers -----------------------------------------------------------
export function gridSize() { return T.canvas?.grid?.size || 70; }
export function escalaCanvas() { return T.canvas?.escala || { valorPorCelula: 1.5, unidade: 'm' }; }

/** Unidades de medida disponíveis (o `id` é o que fica salvo — não renomear os antigos). */
export const UNIDADES = [
    { id: 'm',      nome: 'm — metros' },
    { id: 'cm',     nome: 'cm — centímetros' },
    { id: 'km',     nome: 'km — quilômetros' },
    { id: 'ft',     nome: 'ft — pés' },
    { id: 'mi',     nome: 'mi — milhas' },
    { id: 'passos', nome: 'passos' },
];
export function optsUnidade(sel) {
    return UNIDADES.map(u => `<option value="${u.id}" ${sel === u.id ? 'selected' : ''}>${u.nome}</option>`).join('');
}

/** Converte distância em pixels de mundo para unidades, considerando um mapa sob o ponto (se houver). */
export function pxParaUnidades(distPx, worldPt) {
    let vpc = escalaCanvas().valorPorCelula, un = escalaCanvas().unidade;
    if (worldPt) {
        const mapa = mapaSobPonto(worldPt);
        if (mapa && mapa.larguraReal > 0 && mapa.w > 0) {
            // px do mapa por unidade
            const pxPorUn = mapa.w / mapa.larguraReal;
            return { valor: distPx / pxPorUn, unidade: mapa.unidade || un, celulas: distPx / gridSize() };
        }
    }
    return { valor: (distPx / gridSize()) * vpc, unidade: un, celulas: distPx / gridSize() };
}

/**
 * Unidades → pixels de mundo. Se `pt` for informado, usa a escala do mapa sob o ponto
 * (mesma regra da régua) — sem isso "9 m de visão" não batia com "9 m" medidos.
 */
export function unidadesParaPx(valor, pt) {
    return (valor / (upcEm(pt) || 1)) * gridSize();
}

// Escala de MAPA: `larguraReal` ⇄ largura em px ------------------------------
// Invariante: um mapa com `larguraReal` ocupa exatamente (larguraReal / valorPorCelula)
// células do grid. Mexer num lado move o outro — senão a régua e o grid medem coisas
// diferentes e o campo "Largura real p/ régua" vira decoração.
export function pxDeLarguraReal(larguraReal) {
    return (larguraReal / (escalaCanvas().valorPorCelula || 1)) * gridSize();
}
export function larguraRealDePx(w) {
    return Math.round(((w / gridSize()) * (escalaCanvas().valorPorCelula || 1)) * 100) / 100;
}
/** Depois de redimensionar a imagem na mão: patch que reencaixa `larguraReal` (ou {} se nada muda). */
export function sincLarguraReal(o) {
    if (!o || o.tipo !== 'imagem' || !(o.larguraReal > 0) || !(o.w > 0)) return {};
    const larguraReal = larguraRealDePx(o.w);
    if (larguraReal === o.larguraReal) return {};
    o.larguraReal = larguraReal;
    return { larguraReal };
}

/**
 * Nova lista `vinculos` do NPC ao entrar/sair de uma mesa.
 * Troca só o vínculo de mesa e preserva os outros tipos — o editor de NPCs salva
 * essa lista de volta, então perder um item aqui apaga o vínculo lá.
 */
export function vinculosComMesa(vinculos, mesaId, vincular) {
    const out = (Array.isArray(vinculos) ? vinculos : []).filter(v => v && v.tipo !== 'mesa');
    if (vincular) out.push({ tipo: 'mesa', id: mesaId });
    return out;
}

export function mapaSobPonto(pt) {
    let melhor = null;
    for (const o of T.objects.values()) {
        if (o.tipo !== 'imagem' || o.layerId !== 'mapa') continue;
        if (pt.x >= o.x && pt.x <= o.x + (o.w||0) && pt.y >= o.y && pt.y <= o.y + (o.h||0)) {
            if (!melhor || (o.z||0) > (melhor.z||0)) melhor = o;
        }
    }
    return melhor;
}

/** Configuração de grid consolidada (F4). */
export function cfgGrid() {
    const g = T.canvas?.grid || {};
    return { gs: gridSize(), tipo: g.tipo || 'quad', diagonal: g.diagonal || 'eucl' };
}

/** Unidades por CÉLULA no ponto dado (usa a escala do mapa sob o ponto, se houver). */
export function upcEm(pt) {
    const e = escalaCanvas();
    if (pt) {
        const mapa = mapaSobPonto(pt);
        if (mapa && mapa.larguraReal > 0 && mapa.w > 0) {
            return (mapa.larguraReal / mapa.w) * gridSize();
        }
    }
    return e.valorPorCelula || 1;
}

/** Unidade de medida no ponto dado. */
export function unidadeEm(pt) {
    const e = escalaCanvas();
    if (pt) {
        const mapa = mapaSobPonto(pt);
        if (mapa && mapa.larguraReal > 0) return mapa.unidade || e.unidade;
    }
    return e.unidade;
}

export function fmtDist(d) {
    const v = d.valor >= 100 ? Math.round(d.valor) : Math.round(d.valor * 10) / 10;
    return `${v} ${d.unidade}`;
}

// Permissões ---------------------------------------------------------------
export function can(perm) {
    if (T.mode === 'secret' && T.isMaster) return true;
    if (T.isMaster) return true;
    return !!T.perms?.[perm];
}

/** Camadas visíveis no modo atual, ordenadas. */
export function camadasVisiveis() {
    const cs = (T.canvas?.camadas || []).slice().sort((a, b) => (a.ordem||0) - (b.ordem||0));
    if (T.mode === 'secret') return cs;
    return cs.filter(c => {
        if (c.tipo === 'dm') return false;
        // a camada de luz entra só para o cenário interativo (filtro fino em objVisivel)
        if (c.tipo === 'luz') return can('interagirCenario');
        return c.visivelPublico !== false;
    });
}

export function getCamada(id) { return (T.canvas?.camadas || []).find(c => c.id === id); }

/** O objeto é visível no modo atual? */
export function objVisivel(o) {
    const cam = getCamada(o.layerId);
    if (!cam) return T.mode === 'secret';
    if (T.mode === 'secret') return true;
    if (cam.tipo === 'dm') return false;
    if (cam.tipo === 'luz') return CENARIO_INTERATIVO.has(o.tipo) && can('interagirCenario');
    if (cam.visivelPublico === false) return false;
    if (o.visivelPublico === false) return false;
    return true;
}

/** Token pertence ao usuário atual? */
export function tokenDoUsuario(o) {
    if (o.tipo !== 'token' || o.vinculo?.tipo !== 'char') return false;
    const ch = T.chars.find(c => c.id === o.vinculo.id);
    return !!ch && ch.ownerUid === T.user?.uid;
}
