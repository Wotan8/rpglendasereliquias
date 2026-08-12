// =============================================
// TABULEIRO — Estado Global
// Lendas e Relíquias — VTT
// =============================================
// As duas dependências são módulos folha (não importam ninguém), então não
// fecham ciclo: tab-perf serve ao cache de mapas por versão, e combate-cenas
// dá a cena ativa para a visibilidade do loot oculto por teste.
import { PERF } from './tab-perf.js';
import { cenaAtiva } from '../../shared/combate-cenas.js';

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
    reguasRecebidas: {},     // uid -> Date.now() LOCAL de quando a régua chegou (expiração sem relógio cruzado)

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
    selection: null,         // id do objeto selecionado (único)
    selecionados: [],        // ids da seleção por retângulo; com 1 item espelha `selection`
    dragAtivo: false,        // arrasto de objeto em andamento (segura o save da exploração)
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
    // Vitrine: fica ACIMA de tudo, inclusive do fog (é `abaixoDaLuz: false` que
    // manda o desenho para o passe de overlay). O que entra aqui nasce oculto do
    // público — quem libera é o 👁️ de cada objeto.
    { id: 'mostrar', nome: '🖼️ Mostrar', tipo: 'mostrar', ordem: 4, visivelPublico: true, abaixoDaLuz: false },
];

/**
 * Camadas do canvas + as PADRÃO que faltarem. Canvas criado antes de uma camada
 * nova existir não some do mapa nem precisa de migração no banco: a camada
 * aparece na hora de carregar e só é gravada se o mestre mexer nas camadas.
 */
export function mesclarCamadasPadrao(camadas) {
    const atuais = Array.isArray(camadas) ? camadas : [];
    const faltando = CAMADAS_PADRAO.filter(p => !atuais.some(c => c.id === p.id));
    return faltando.length ? [...atuais, ...faltando] : atuais;
}

export const PERMISSOES_LISTA = [
    { key: 'moverToken',   label: 'Mover o próprio token' },
    { key: 'moverSoNoTurno', label: 'Mover SÓ como ação de turno (deslocamento da ficha, no turno do token)' },
    { key: 'verAlemDoMapa',label: 'Ver o canva além do mapa' },
    { key: 'desenhar',     label: 'Desenhar no canva' },
    { key: 'addTexto',     label: 'Adicionar texto' },
    { key: 'addImagem',    label: 'Adicionar imagens' },
    { key: 'medir',        label: 'Usar a régua' },
    { key: 'alfinete',     label: 'Colocar alfinetes' },
    { key: 'abrirNpc',     label: 'Abrir ficha de NPCs exibidos' },
    { key: 'interagirCenario', label: 'Interagir com o cenário (portas, janelas, luzes, loot)' },
];

/** Objetos da camada de luz que o jogador pode ver e acionar com `interagirCenario`.
 *  Os riscos (paredes) continuam invisíveis — senão o mapa entrega a própria planta. */
export const CENARIO_INTERATIVO = new Set(['porta', 'janela', 'luz']);

// ===== Utils =====
export function esc(t) {
    if (t == null) return '';
    return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

/**
 * Ícone do sprite SVG de tabuleiro.html. Os <symbol> moram lá (assim os botões
 * estáticos não esperam módulo nenhum); aqui só devolvemos a referência, para
 * não existir uma segunda cópia dos traços dentro do JS.
 * @param {string} nome — sem o prefixo `i-`. Ex.: ico('dado')
 */
export function ico(nome) { return `<svg class="tb-ico"><use href="#i-${nome}"/></svg>`; }

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
 * Desempilha a próxima parada válida da trilha de navegação entre mapas
 * (continental → regional → local). Entradas de canvases excluídos são
 * puladas — sem isso o "Voltar" abriria um canvas que não existe mais.
 */
export function popNavegacaoValida(stack, existe) {
    while (stack.length) {
        const alvo = stack.pop();
        if (existe(alvo.id)) return alvo;
    }
    return null;
}

// Lista das imagens da camada 'mapa', em cache e ordenada por z (topo primeiro).
// Sem isto, `mapaSobPonto` varria TODOS os objetos do canvas — e ele é chamado
// uma vez por amostra de meia célula dentro de medirTrajeto, que roda a cada
// movimento do dedo. Num tabuleiro cheio isso virava dezenas de milhares de
// iterações por frame e travava o arrasto. Invalidação: PERF.mapVersion.
// Invalidação por três sinais, não só pela versão: a versão cobre edição de mapa,
// mas trocar de canvas substitui o Map inteiro e um add/remove sem notificação
// mudaria só o tamanho. Um cache que serve dado velho em silêncio é pior que
// nenhum cache — as três comparações custam nada.
let _mapas = null, _mapasVer = -1, _mapasRef = null, _mapasTam = -1;
function mapasDoCanvas() {
    if (_mapas && _mapasVer === PERF.mapVersion && _mapasRef === T.objects && _mapasTam === T.objects.size) {
        return _mapas;
    }
    const out = [];
    for (const o of T.objects.values()) {
        if (o.tipo === 'imagem' && o.layerId === 'mapa') out.push(o);
    }
    out.sort((a, b) => (b.z || 0) - (a.z || 0));
    _mapas = out;
    _mapasVer = PERF.mapVersion; _mapasRef = T.objects; _mapasTam = T.objects.size;
    return _mapas;
}

export function mapaSobPonto(pt) {
    for (const o of mapasDoCanvas()) {          // topo primeiro: o 1º que contém ganha
        if (pt.x >= o.x && pt.x <= o.x + (o.w || 0) && pt.y >= o.y && pt.y <= o.y + (o.h || 0)) return o;
    }
    return null;
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

/** Horas de marcha efetiva em um "dia de viagem" — a base que converte dias em horas. */
export const HORAS_DE_MARCHA = 8;

/** Duração em "X dias Yh Zmin", contando dias de marcha (não de 24 h). */
export function fmtDuracao(totalHoras, horasPorDia = HORAS_DE_MARCHA) {
    const totalMin = Math.round(totalHoras * 60);
    if (!(totalMin > 0)) return 'menos de 1min';
    const minPorDia = horasPorDia * 60;
    const dias = Math.floor(totalMin / minPorDia);
    const resto = totalMin - dias * minPorDia;
    const h = Math.floor(resto / 60), min = resto - h * 60;
    const p = [];
    if (dias) p.push(`${dias} dia${dias > 1 ? 's' : ''}`);
    if (h) p.push(`${h}h`);
    if (min) p.push(`${min}min`);
    return p.join(' ');
}

/** Texto da rota: distância + tempo de viagem segundo `porDia` (unidades/dia; 0 = sem cálculo). */
export function fmtViagem(info, porDia, horasPorDia = HORAS_DE_MARCHA) {
    let s = `🛤️ ${fmtDist(info)}`;
    if (porDia > 0) {
        const totalHoras = (info.valor / porDia) * horasPorDia;
        s += ` · ⏱️ ${fmtDuracao(totalHoras, horasPorDia)} a ${porDia} ${info.unidade}/dia`;
    }
    return s;
}

// Referência de deslocamento: a pé, um grupo de humanos cobre ~25 km num dia de
// marcha (≈3 km/h em 8 h, já contando as pausas). Serve de placeholder para o
// mestre não ter que adivinhar — convertido para a unidade do canvas.
const REF_METROS_POR_DIA = 25000;
const POR_METRO = { m: 1, cm: 100, km: 0.001, ft: 3.28084, mi: 0.000621371, passos: 1.32 };
export function refViagemPorDia(unidade) {
    const v = REF_METROS_POR_DIA * (POR_METRO[unidade] ?? 1);
    return v >= 100 ? Math.round(v) : Math.round(v * 10) / 10;
}

/**
 * `rot` do token → graus no referencial do canvas.
 * O token guarda a direção com **0° = para cima**, crescendo no sentido horário
 * (ver tab-girar.js). O canvas e o `atan2` usam **0° = para a direita**. Esta
 * conversão precisa existir num lugar só: o indicador da bússola convertia e o
 * raycasting do cone não, então a visão saía 90° torta em relação à frente do
 * token — e ao arrastar, o cone apontava para o lado do movimento.
 */
export function rotParaCanvas(rot) { return (rot || 0) - 90; }

/**
 * O snapshot que chegou é eco ATRASADO de um write meu?
 * Durante um arrasto saem vários writes do mesmo objeto. Se um intermediário
 * aterrissa depois do write final, aplicá-lo joga o token de volta para o meio do
 * caminho — é o tremor ao soltar e o "não termina o percurso". Só descarta o que
 * é meu e mais antigo que o último que eu emiti; write de outro usuário sempre passa.
 */
export function ehEcoAtrasado(local, novo, meuUid) {
    if (!local || !meuUid || novo?.lastWriter !== meuUid) return false;
    return (local.__meuWrite || 0) > (novo?.atualizadoEm || 0);
}

/**
 * O doc do canvas mudou em algo ALÉM da exploração (fog persistente)?
 * O save da exploração aterrissa a cada ~3s durante um arrasto no público, e
 * tratá-lo como mudança de configuração invalidava mapa, hash de paredes,
 * fog e painéis em TODOS os aparelhos — era o "token remoto congela por
 * segundos" de quem assistia ao arrasto. Comparação por JSON: se a ordem de
 * chaves variar entre snapshots, retorna true à toa — falha para o lado
 * seguro (perde a otimização, nunca engole configuração nova).
 */
export function configDoCanvasMudou(antes, depois) {
    if (!antes || !depois || antes.id !== depois.id) return true;
    const semExp = ({ exploracao, ...resto }) => resto;
    return JSON.stringify(semExp(antes)) !== JSON.stringify(semExp(depois));
}

// ---- 📖 Capítulos exibidos para a mesa (tabuleiro-meta/estado.livroExibido) ----
// Formato atual: { caps: [id], foco: id, t }. O antigo era um capítulo só
// (`capId`) — mesa que ficou parada desde então continua funcionando sem migração.
/** Todos os capítulos que o mestre deixou disponíveis agora. */
export function capsExibidos(exib) {
    if (Array.isArray(exib?.caps)) return exib.caps.filter(Boolean);
    return exib?.capId ? [exib.capId] : [];
}
/** O que abre sozinho na tela de todo mundo — o último "Exibir" do mestre. */
export function focoExibido(exib) {
    return exib?.foco || exib?.capId || null;
}

/** TTL da régua remota, contado do RECEBIMENTO local (ms). */
export const REGUA_TTL_MS = 6000;

/**
 * A régua compartilhada de `uidDono` deve ser desenhada NESTA janela?
 * A régua do próprio uid é pulada porque a janela que está medindo já a desenha
 * ao vivo em `T.temp`. A exceção é o PÚBLICO do mestre (a TV): é outra janela,
 * com o mesmo uid e sem `T.temp` nenhum — sem isso a régua do arrasto dele
 * chegava nos jogadores e nunca na própria TV.
 */
export function reguaVisivelAqui(uidDono) {
    if (uidDono !== T.user?.uid) return true;
    return T.mode === 'public' && T.temp?.tipo !== 'medida';
}

/**
 * Carimbo local de chegada de cada régua compartilhada. O `t` que vem no doc é
 * do relógio do OUTRO aparelho — um celular minutos atrasado fazia a régua
 * nascer "expirada" e nunca aparecer. O `t` só serve para detectar que a régua
 * MUDOU (é comparado consigo mesmo, do mesmo remetente); a expiração usa o
 * relógio local de quem desenha, via este carimbo.
 * @returns novo mapa uid -> Date.now() local do último recebimento
 */
export function marcarRecebimentoReguas(antigas, novas, recebidas, agora) {
    const out = {};
    for (const [uid, r] of Object.entries(novas || {})) {
        if (!r) continue;
        const antes = antigas?.[uid];
        const inalterada = antes && antes.t === r.t && recebidas?.[uid] != null;
        out[uid] = inalterada ? recebidas[uid] : agora;
    }
    return out;
}

/** Fração da célula que o token precisa andar para a visão dar um passo. */
export const FOG_PASSO_CELULA = 0.25;
/** Piso de tempo entre dois passos da visão, em ms (~14 atualizações/s). */
export const FOG_INTERVALO_MS = 70;

// ---- Taxa de escrita durante o arrasto ----
// O Firestore aguenta ~1 escrita SUSTENTADA por segundo em cada documento; acima
// disso ele enfileira e a latência cresce. O arrasto escrevia o doc do token a
// cada 100ms (10/s) — o excesso virava fila no servidor e o outro aparelho só via
// o movimento vários segundos depois. Menos escritas + lerp mais longo dão o mesmo
// movimento suave do outro lado, com um terço do tráfego.
/** Intervalo mínimo entre escritas de posição durante o arrasto (ms). */
export const DRAG_WRITE_MS = 300;
/** Passo mínimo, em células, para uma escrita intermediária valer a pena. */
export const DRAG_PASSO_CELULA = 0.5;
/** Lerp do token remoto quando ainda não dá para medir o ritmo (1º trecho). */
export const LERP_TOKEN_MS = 320;
/** Piso e teto da duração do lerp — protege de rajada e de pausa longa. */
export const LERP_MIN_MS = 120;
// Teto = arrasto mais lento que ainda é arrasto (meia célula por segundo). Acima
// disso o outro lado está praticamente parado, e esticar o trecho viraria câmera
// lenta: melhor um passo curto e o token esperando de verdade.
export const LERP_MAX_MS = 1000;

/**
 * Quanto o token remoto leva para percorrer o trecho recém-chegado.
 * O intervalo entre as escritas do arrasto VARIA: o portão é de meia célula, então
 * quem arrasta devagar escreve a cada segundo e quem corre escreve a cada 300ms.
 * Com duração FIXA o token chegava e ficava parado esperando a próxima posição —
 * era o "pulando" de quem assiste. Interpolar pelo intervalo MEDIDO faz o trecho
 * terminar bem quando o próximo aterrissa, e o movimento fica contínuo.
 */
export function duracaoLerp(intervalo) {
    if (!(intervalo > 0)) return LERP_TOKEN_MS;
    return Math.min(LERP_MAX_MS, Math.max(LERP_MIN_MS, intervalo));
}

/**
 * Passou o bastante — em distância **e** em tempo — para valer uma atualização?
 * Serve ao passo da visão e à escrita de posição no arrasto, que têm o mesmo
 * formato de problema: a distância corta o movimento insignificante, e o tempo
 * segura o movimento rápido, onde o limiar de distância cai a cada quadro.
 */
export function deveAtualizarPasso(atual, novo, passoMin, msDesdeUltimo = Infinity, intervaloMin = 0) {
    if (!atual) return true;
    if (msDesdeUltimo < intervaloMin) return false;
    return Math.hypot(novo.x - atual.x, novo.y - atual.y) >= passoMin;
}

/**
 * Direção de um deslocamento, no referencial de `rot` (0 = para cima, horário).
 * É a metade inversa do `rotParaCanvas` — moram juntas porque um desencontro
 * entre as duas é justamente o que torce o cone de visão ao arrastar o token.
 * `null` quando o passo é curto demais: sem esse piso o token fica tremendo de
 * lado a cada pixel do arrasto.
 */
export function anguloDoMovimento(dx, dy, minimo = 4) {
    if (Math.hypot(dx, dy) < minimo) return null;
    return ((Math.round(Math.atan2(dy, dx) * 180 / Math.PI) + 90) % 360 + 360) % 360;
}

// ===== ALCANCE DE VISÃO =====
// Chaves de VD no formato que a ficha gera: nome sem acento, maiúsculas, "_" no resto.
export const DV_PERCEPCAO_VISUAL = 'PERCEPCAO_VISUAL';
export const DV_PERCEPCAO = 'PERCEPCAO';
export const BONUS_PERCEPCAO_VISAO = 2;
export const MULT_VISAO_DIA = 3;

const numOuNulo = (v) => { const n = parseFloat(v); return isNaN(n) ? null : n; };

/**
 * Alcance efetivo da visão de um token, em unidades do canvas.
 *  - fonte 'percepcao': VD "Percepção Visual" + 2. Esse VD não é de todo
 *    personagem, e a ficha calcula 0 para quem não o tem vinculado — por isso o
 *    corte é por VALOR (0 = não tem) e cai para "Percepção" + 2, que é padrão.
 *  - de DIA o alcance triplica, venha de valor fixo ou da percepção.
 *  - sem ficha (NPC, token custom) não há percepção: volta ao valor fixo, para o
 *    token não cegar por causa da configuração.
 * @param visao   objeto `visao` do token
 * @param derived totais de VD do personagem; {} ou null quando não houver ficha
 * @param dia     o canvas está em modo Dia?
 */
export function alcanceDeVisao(visao, derived, dia) {
    let base = numOuNulo(visao?.alcance) ?? 6;
    if (visao?.alcanceFonte === 'percepcao') {
        const visual = numOuNulo(derived?.[DV_PERCEPCAO_VISUAL]) || 0;
        const geral = numOuNulo(derived?.[DV_PERCEPCAO]) || 0;
        const p = visual > 0 ? visual : geral;
        if (p > 0) base = p + BONUS_PERCEPCAO_VISAO;
    }
    if (!(base > 0)) base = 0;
    return dia ? base * MULT_VISAO_DIA : base;
}

// ===== INICIATIVA =====
// Rolagem do mapa: 1d10 + o VD Iniciativa do personagem/NPC.
// A ficha grava `derivedTotals.INICIATIVA`; o NPC v2 espelha o valor final em
// `valoresDer.INI` (mesmo espelho legado de onde saem VIT/ENER/SAN aqui).
export const DV_INICIATIVA = 'INICIATIVA';
export const DADO_INICIATIVA = 10;

/** Bônus de Iniciativa a partir dos VDs (ficha ou NPC). 0 quando não houver. */
export function bonusIniciativa(fonte) {
    if (!fonte) return 0;
    const v = numOuNulo(fonte[DV_INICIATIVA]) ?? numOuNulo(fonte.INI)
        ?? numOuNulo(fonte.overrides?.[DV_INICIATIVA]);
    return v ?? 0;
}

// ===== TESTES DA CENA (Roll Under d10, Graus de Sucesso) =====
// Regra (Livro do Jogador, cap. 2): Alvo = Atributo + Perícia + Bônus − Redutor;
// rola 1d10, resultado ≤ Alvo é sucesso; Graus = Alvo − dado. 1 é crítico
// (sucesso automático), 10 é falha crítica (falha automática).

const semAcento = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
/** "Percepção Visual" → "PERCEPCAO_VISUAL" (formato das chaves de derivedTotals). */
export function normChave(nome) {
    return semAcento(nome).trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

const ATRIBUTOS_SIGLA = {
    INT: 'int', INTELIGENCIA: 'int', RAC: 'rac', RACIOCINIO: 'rac', PRS: 'prs', PERSEVERANCA: 'prs',
    FOR: 'for', FORCA: 'for', DES: 'des', DESTREZA: 'des', VIG: 'vig', VIGOR: 'vig',
    PRE: 'pre', PRESENCA: 'pre', MAN: 'man', MANIPULACAO: 'man', AUT: 'aut', AUTOCONTROLE: 'aut',
};
// Siglas legadas do espelho do NPC (valoresDer)
const VD_ALIAS_NPC = { PERCEPCAO: 'PERC', INICIATIVA: 'INI', REACAO: 'REA', BLINDAGEM: 'BLD', VITALIDADE: 'VIT', ENERGIA: 'ENER', SANIDADE: 'SAN', DETERMINACAO: 'DET' };

/**
 * Valor de UM componente de teste na ficha. Ordem: VD → atributo → perícia.
 * @param fonte char do Tabuleiro ({ derivedTotals, dots }) ou NPC ({ valoresDer, atributos, pericias })
 * @returns número ou null quando não achou (o Alvo fica editável na UI)
 */
export function valorComponente(nome, fonte) {
    if (!fonte) return null;
    const norm = normChave(nome);
    if (!norm) return null;
    // 1) VD — ficha espelha em derivedTotals; NPC em valoresDer (+ extras nomeados)
    const vd = numOuNulo(fonte.derivedTotals?.[norm]);
    if (vd != null) return vd;
    if (fonte.valoresDer) {
        const k = fonte.valoresDer[norm] != null ? norm : VD_ALIAS_NPC[norm];
        const v = k != null ? numOuNulo(fonte.valoresDer[k]) : null;
        if (v != null) return v;
        for (const x of fonte.valoresDer.extras || []) {
            if (normChave(x.nome) === norm) { const n = parseFloat(x.valor); if (!isNaN(n)) return n; }
        }
    }
    // 2) atributo (sigla ou nome completo)
    const sig = ATRIBUTOS_SIGLA[norm];
    if (sig) {
        const d = numOuNulo(fonte.dots?.['attr_' + sig]);
        if (d != null) return d;
        const a = numOuNulo(fonte.atributos?.[sig.toUpperCase()]);
        if (a != null) return a;
    }
    // 3) perícia — char: dots `sk_<grupo>_<nome>`, onde cada caractere especial
    // virou `_` ("precisão" → precis_o). O `_` do nome vira curinga de 0–1 chars
    // para casar tanto espaço removido quanto acento normalizado.
    const alvoMin = semAcento(nome).trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
    if (fonte.dots) {
        for (const [k, v] of Object.entries(fonte.dots)) {
            if (!k.startsWith('sk_')) continue;
            const resto = k.replace(/^sk_[a-z]+_/, '');
            const re = new RegExp('^' + resto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/_/g, '.?') + '$');
            if (re.test(alvoMin)) { const n = numOuNulo(v); if (n != null) return n; }
        }
    }
    // NPC: perícias em texto, uma por linha ("Herbalismo 4 = 8d10")
    if (typeof fonte.pericias === 'string') {
        for (const linha of fonte.pericias.split('\n')) {
            const m = linha.match(/^(.+?)\s+(\d+(?:[.,]\d+)?)\s*(=|$)/);
            if (m && normChave(m[1]) === norm) return parseFloat(m[2].replace(',', '.'));
        }
    }
    return null;
}

/**
 * Alvo de um teste "Raciocínio + Observação + 2" contra uma ficha.
 * Termos numéricos somam direto; termos não resolvidos marcam `incompleto`
 * (a UI deixa o mestre digitar o Alvo na mão).
 */
export function alvoDoTeste(componentes, fonte, mod = 0) {
    const partes = [];
    let alvo = Number(mod) || 0, incompleto = false;
    for (const bruto of String(componentes || '').split('+')) {
        const t = bruto.trim();
        if (!t) continue;
        const num = Number(t.replace(',', '.'));
        if (!isNaN(num)) { alvo += num; partes.push({ nome: t, valor: num }); continue; }
        const v = valorComponente(t, fonte);
        partes.push({ nome: t, valor: v });
        if (v == null) incompleto = true; else alvo += v;
    }
    return { alvo, partes, incompleto };
}

/** Graus de Sucesso de um d10 contra o Alvo (1 = crítico, 10 = falha crítica). */
export function grausDoDado(alvo, dado) {
    if (dado === 1) return Math.max(alvo - 1, 0);    // sucesso automático
    if (dado === 10) return Math.min(alvo - 10, -1); // falha automática
    return alvo - dado;
}
/** +2 / 0 / -1 — como a mesa fala. */
export function fmtGraus(g) { return g > 0 ? '+' + g : String(g); }

// ===== VITAIS (Combate ⇄ Ficha) =====
// Vitais aceitam meio ponto (VIT 21,9) e somar/subtrair 1 em float acumula lixo:
// virava "9.899999999999999/21.9". Arredonda na CONTA (o que é gravado e
// sincronizado com a ficha) e na exibição, que também recebe valor sujo de fora.
export const vNum = (v) => Math.round((Number(v) || 0) * 100) / 100;

/** Valor "de mesa" de um VD com `arredondaMesa` — mesma regra da ficha
 *  (dvValorDeMesa): piso, com mínimo 1 quando o valor é positivo. */
export function dvMesa(v) {
    if (!(v > 0)) return Math.floor(v) || 0;
    return Math.max(1, Math.floor(v));
}

// Siglas legadas que o combate escreve direto em valoresDer.atual do NPC.
const NPC_ATUAL_LEGADO = new Set(['VIT', 'ENER', 'SAN', 'PERC', 'INI', 'REA', 'BLD']);
const NPC_VITAL_LONGO = { vit: 'vitalidade', ener: 'energia', san: 'sanidade' };

/**
 * Patch (updateDoc) que grava um vital ATUAL do NPC na sigla legada E nas
 * chaves do sistema que a espelham dentro de `valoresDer.atual` — por nome
 * ("VITALIDADE" começa com "vit") ou por valor igual ao da sigla (par formado
 * pelo editor). Sem o espelho, a Ficha de NPC abre com o número velho.
 * @param atualObj  valoresDer.atual como está no doc
 * @param stat      'VIT' | 'ENER' | 'SAN'
 * @param valor     novo valor atual
 */
export function patchVitalAtualNpc(atualObj, stat, valor) {
    const patch = { [`valoresDer.atual.${stat}`]: valor };
    const sigNorm = stat.toLowerCase();
    for (const [k, v] of Object.entries(atualObj || {})) {
        if (NPC_ATUAL_LEGADO.has(k)) continue;
        const nomeNorm = k.toLowerCase().replace(/[^a-z]/g, '');
        if (nomeNorm.startsWith(sigNorm) || nomeNorm.startsWith(NPC_VITAL_LONGO[sigNorm] || sigNorm)) {
            patch[`valoresDer.atual.${k}`] = valor;
        } else if (v === atualObj[stat]) {
            patch[`valoresDer.atual.${k}`] = valor;
        }
    }
    return patch;
}

/**
 * Divide uma pilha de itens para mover/dropar `qtd` unidades.
 * `move: true` = a pilha inteira vai (basta trocar o dono/pai do doc);
 * `move: false` = sai um clone com `qtd` e o doc original fica com `restante`.
 * Clampa em [1, total] — pedir 99 de 12 move os 12, pedir 0 move 1.
 * Mora no motor de inventário: o Painel do Mestre divide pilha do mesmo jeito.
 */
export { dividirPilha } from '../../shared/inventario-motor.js?v=2';

// ===== DESLOCAMENTOS DA FICHA =====
const DESLOC_LABEL = { DESLOC_TERRESTRE: 'Terrestre', DESLOC_AQUATICO: 'Aquático', DESLOC_VERTICAL: 'Vertical', DESLOC_AEREO: 'Aéreo' };

/**
 * Tipos de deslocamento disponíveis do token, em metros (>0 apenas).
 * Char: VDs DESLOC_* dos derivedTotals. NPC: extras "Desloc. Aéreo = 15m" +
 * legado valoresDer.DESLOCAMENTO ("8m, Carga 12m" → 8).
 */
export function deslocamentosDoToken(o, chars, npcs) {
    const out = [];
    if (o?.vinculo?.tipo === 'char') {
        const dt = (chars || []).find(c => c.id === o.vinculo.id)?.derivedTotals || {};
        for (const k of Object.keys(dt)) {
            if (!k.startsWith('DESLOC_')) continue;
            const v = numOuNulo(dt[k]);
            if (v > 0) out.push({
                tipo: DESLOC_LABEL[k] || (k.slice(7).charAt(0) + k.slice(8).toLowerCase()).replace(/_/g, ' '),
                metros: Math.round(v * 10) / 10,
            });
        }
        out.sort((a, b) => b.metros - a.metros);
    }
    if (o?.vinculo?.tipo === 'npc') {
        const vd = (npcs || []).find(x => x.id === o.vinculo.id)?.valoresDer || {};
        const visto = new Set();
        const add = (tipo, valor) => {
            const m = parseFloat(String(valor ?? '').replace(',', '.'));
            const chave = normChave(tipo);
            if (m > 0 && !visto.has(chave)) { visto.add(chave); out.push({ tipo, metros: m }); }
        };
        for (const x of vd.extras || []) {
            const nm = String(x.nome || '');
            if (!/desloc/i.test(nm)) continue;
            add(nm.replace(/^desloc(amento)?\.?\s*/i, '').trim() || 'Terrestre', x.valor);
        }
        if (vd.DESLOCAMENTO) add('Terrestre', vd.DESLOCAMENTO);
    }
    return out;
}

/**
 * Limite do arrasto em unidades do canvas. Com o snap de grid ativo, arredonda
 * PARA CIMA até a célula cheia — senão 13,1 m num grid de 1,5 m/célula
 * travaria o token a meio passo da última célula que ele alcançaria.
 */
export function limiteDeslocamento(metros, upc, snapAtivo) {
    if (!(metros > 0)) return 0;
    if (!snapAtivo || !(upc > 0)) return metros;
    return Math.ceil(metros / upc - 1e-9) * upc;
}

// ===== LOOT OCULTO POR TESTE =====
/**
 * Melhor resultado (em Graus) do usuário entre TODOS os testes da cena ativa.
 * null = nunca fez teste nenhum (item com teste configurado fica invisível,
 * inclusive com limiar 0 — 0 é um sucesso sem Graus, não ausência de teste).
 */
export function melhorGrauDoUsuario(combate, meusCharIds) {
    if (!combate || !meusCharIds?.length) return null;
    const cena = cenaAtiva(combate);
    const meusPids = (cena.participantes || [])
        .filter(p => meusCharIds.includes(p.characterId)).map(p => p.id);
    let melhor = null;
    for (const t of cena.testes || []) {
        for (const pid of meusPids) {
            const g = t.resultados?.[pid]?.graus;
            if (typeof g === 'number') melhor = melhor == null ? g : Math.max(melhor, g);
        }
    }
    return melhor;
}

/** O loot está escondido deste jogador? (só faz sentido no modo público) */
export function lootOculto(o, melhorGrau) {
    if (o?.tipo !== 'loot' || o.testeGraus == null || o.reveladoPublico) return false;
    return !(typeof melhorGrau === 'number' && melhorGrau >= o.testeGraus);
}

/** De qual VD o alcance saiu — para explicar o número na UI. */
export function fonteDoAlcance(visao, derived) {
    if (visao?.alcanceFonte !== 'percepcao') return 'fixo';
    if ((numOuNulo(derived?.[DV_PERCEPCAO_VISUAL]) || 0) > 0) return 'visual';
    if ((numOuNulo(derived?.[DV_PERCEPCAO]) || 0) > 0) return 'geral';
    return 'fixo';   // sem ficha ou sem percepção nenhuma
}

/**
 * Política de fog para quem está olhando. Vive aqui, isolada e testável, porque
 * um único booleano dela já deixou o jogador ver o mapa inteiro: o modo ☀️ Dia
 * pulava o fog no público, e paredes deixavam de tapar a vista de dia.
 * Invariante: com a luz dinâmica LIGADA, o jogador SEMPRE recebe fog.
 */
export function politicaDeFog({ luzAtiva, modo, ehMestre }) {
    if (!luzAtiva) return { aplica: false, exigeLuz: false, veuLeve: false, recortaLuzes: false };
    const dia = modo === 'dia';
    return {
        aplica: true,               // de dia também: parede tapa a vista
        exigeLuz: !dia,             // de dia a linha de visão basta, sem precisar de luz
        veuLeve: dia && ehMestre,   // véu de 35% é só ajuda visual na tela do mestre
        recortaLuzes: ehMestre,     // o jogador só enxerga pelas próprias visões
    };
}

/** Seleção única (usada por clique, menu de contexto e menu radial). */
export function selecionar(id) {
    T.selection = id || null;
    T.selecionados = id ? [id] : [];
}

/**
 * Campos do card de Geografia/Propriedade visíveis no modo atual.
 * `campos` = [[chave, rótulo]]. O mestre vê tudo que tem conteúdo; o jogador
 * só o que o mestre liberou em `publicos` ({campo: true}, salvo no alfinete).
 */
export function camposRevelados(campos, dados, publicos, ehMestre) {
    return (campos || []).filter(([k]) => {
        const v = dados?.[k];
        const tem = Array.isArray(v) ? v.length > 0 : v != null && v !== '';
        return tem && (ehMestre || !!publicos?.[k]);
    });
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
    // 📦 Loot escondido por teste: invisível no público até o jogador bater os
    // Graus (T._meuMelhorGrau é recalculado no snapshot do combate — ver tab-main)
    if (o.tipo === 'loot' && lootOculto(o, T._meuMelhorGrau)) return false;
    return true;
}

/** Token pertence ao usuário atual? */
export function tokenDoUsuario(o) {
    if (o.tipo !== 'token' || o.vinculo?.tipo !== 'char') return false;
    const ch = T.chars.find(c => c.id === o.vinculo.id);
    return !!ch && ch.ownerUid === T.user?.uid;
}

/**
 * Tokens que ditam o que a TELA enxerga (fog, visão, tokens desenhados).
 * O mestre não tem token: no PÚBLICO (a TV da sessão) a tela passa a ser a
 * união da visão do GRUPO. Sem isso o mestre entrava como "mestre" no público
 * e a TV entregava sala iluminada vazia e NPC que ninguém estava vendo.
 */
export function tokensDaVisao() {
    if (T.mode === 'secret') return [];
    const out = [];
    for (const o of T.objects.values()) {
        if (o.tipo !== 'token' || o.vinculo?.tipo !== 'char') continue;
        if (T.isMaster ? objVisivel(o) : tokenDoUsuario(o)) out.push(o);
    }
    return out;
}
