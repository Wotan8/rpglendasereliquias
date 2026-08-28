// =============================================
// TABULEIRO — HUD de Tokens (FASE 5)
// - Vitais ao vivo (chars: listener no doc; NPCs/custom: participante do combate)
// - Condições (char.conditions + condicoes do combate)
// - Menu radial de token
// - Rolar iniciativa direto do mapa (1d10 + VD Iniciativa)
// =============================================
import { db, doc, onSnapshot, setDoc } from '../../painel-mestre/js/firebase-config.js';
import { T, esc, ico, toast, markDirty, uid, can, selecionar, bonusIniciativa, DADO_INICIATIVA, tokenDoUsuario, deslocamentosDoToken, valorComponente, participanteDoToken, espelhosDoVital } from './tab-state.js';
import { refCombate } from './tab-main.js';
import { updObj, delObj, abrirPropriedades } from './tab-objects.js';
import { SENSORES } from './tab-fog.js';
import { cenaAtiva, comCenaAtivaPatch, condicoesAgrupadas } from '../../shared/combate-cenas.js';
import { fichaComBonus } from '../../shared/bonus-temporario.js?v=1';
import { logChat } from './tab-chat.js';

import { perguntar } from '../../shared/dialogo.js?v=2';
// charId -> { hp, hpMax, ener, enerMax, san, sanMax, conds:[{icone,nome}] }
export const VITAIS = new Map();
const unsubsVitais = [];

// ⚔️ VDs marcados como "Status de Combate" no Criador (statusCombate: true) —
// exibidos no card da janela de Combate e sobre o token, abaixo das barras.
// Registro carregado 1x por sessão (mesmo cache das janelas de ficha).
export let VDS_COMBATE = [];   // [{ id, key, nome, icone, prefixo, sufixo, campoAtual, todoPersonagem }]
let _sysHud = null, _calcNpcHud = null;
const _vdsCache = new WeakMap();   // derivedTotals/valoresDer (obj do snapshot) -> valores prontos
const _npcCalcCache = new WeakMap();   // doc do NPC -> { key: final } calculado

/**
 * Finais dos VDs de um NPC, calculados pelo MESMO motor do editor. O doc só
 * guarda overrides/atual (por id) — sem isto, VD vinculado sem override não
 * existe fora do editor. Cache por identidade do doc (snapshot novo recalcula).
 */
function finaisDoNpc(n) {
    if (!n || !_calcNpcHud || !_sysHud) return null;
    let r = _npcCalcCache.get(n);
    if (r) return r;
    try {
        const calc = _calcNpcHud(n, _sysHud, {});
        r = {};
        for (const [k, d] of Object.entries(calc.derived || {})) r[k] = d.final;
    } catch (e) { console.warn('calc VD do NPC', e); r = {}; }
    _npcCalcCache.set(n, r);
    return r;
}

/** Valor ATUAL de um recurso do NPC/char por VD (ou null quando não há). */
export function atualDoVd(fonte, dv) {
    const raw = fonte?.derivedTotals
        ? VITAIS.get(fonte.id)?.dvAtuais?.[`dv_${dv.key}_atual`]
        : fonte?.valoresDer?.atual?.[dv.key];
    const n = parseFloat(String(raw ?? '').replace(',', '.'));
    return isNaN(n) ? null : n;
}

/**
 * VDs VINCULADOS ao personagem — a MESMA regra da ficha: derivedValueIds da
 * raça/classe + peculiaridades da raça/classe/tribo + as individuais.
 * (Era privada da janela de ficha; mora aqui porque o HUD também filtra.)
 */
export function dvsVinculadosChar(ch, sys) {
    const ids = new Set();
    const addIds = (lista) => (lista || []).forEach(x => {
        const id = (typeof x === 'object' && x) ? x.id : x;
        if (id) ids.add(id);
    });
    const addPecs = (lista) => (lista || []).forEach(p => {
        const pid = (typeof p === 'object' && p) ? p.id : p;
        addIds(sys.pecsById?.[pid]?.derivedValueIds);
    });
    const norm = sys.norm;
    const raca = ch.raca ? sys.racesByNome?.[norm(ch.raca)] : null;
    const classe = ch.classe ? sys.classesByNome?.[norm(ch.classe)] : null;
    const tribo = ch.tribo ? sys.tribesByNome?.[norm(ch.tribo)] : null;
    addIds(raca?.derivedValueIds);
    addIds(classe?.derivedValueIds);
    addPecs(raca?.peculiaridadeIds);
    addPecs(classe?.bonusIniciais);       // a ficha soma bonusIniciais + peculiaridadeIds
    addPecs(classe?.peculiaridadeIds);
    addPecs(tribo?.peculiaridadeIds);
    addPecs(ch.peculiaridadesIndividuais);
    return ids;
}
export const dvAplicaChar = (dv, vinc) => dv.todoPersonagem || vinc.has(dv.id);

/** O VD statusCombate vale para esta fonte? Char pela regra da ficha; NPC pelos `vinculados`. */
function vdAplicaFonte(dv, fonte, vincChar) {
    if (fonte.derivedTotals) return vincChar ? dvAplicaChar(dv, vincChar) : true;
    const vinc = fonte.valoresDer?.vinculados;
    return Array.isArray(vinc) ? (dv.todoPersonagem || vinc.includes(dv.key)) : true;   // NPC legado: sem lista, vale o que tem valor
}

export function vdsCombateDaFonte(fonte) {
    if (!fonte || !VDS_COMBATE.length) return [];
    const base = fonte.derivedTotals || fonte.valoresDer;
    if (!base || typeof base !== 'object') return [];
    let r = _vdsCache.get(base);
    if (r) return r;
    const vincChar = (fonte.derivedTotals && _sysHud) ? dvsVinculadosChar(fonte, _sysHud) : null;
    // NPC: os finais saem do motor (o doc não os guarda)
    const finaisNpc = fonte.valoresDer ? finaisDoNpc(fonte) : null;
    r = [];
    for (const dv of VDS_COMBATE) {
        if (!vdAplicaFonte(dv, fonte, vincChar)) continue;
        let v = finaisNpc?.[dv.key];
        if (v == null) v = valorComponente(dv.nome, fonte);
        // NPC legado sem cálculo: o valor travado vive em overrides[id]
        if (v == null && fonte.valoresDer?.overrides) {
            const o = parseFloat(fonte.valoresDer.overrides[dv.key]);
            if (!isNaN(o)) v = o;
        }
        if (v == null || v === 0) continue;   // 0/ausente = ruído, fica de fora
        // valor ATUAL (VDs com campo Atual/Máx): char grava em
        // derivedValues['dv_<key>_atual'] na ficha; NPC em valoresDer.atual[key]
        r.push({ ...dv, valor: v, atual: dv.campoAtual ? atualDoVd(fonte, dv) : null });
    }
    _vdsCache.set(base, r);
    return r;
}

/**
 * Valor FINAL de um VD qualquer para uma fonte (char ou NPC) — o caminho que o
 * card já usa, aberto para quem precisa de VD que não é Status de Combate
 * (as 8 Defesas e as Blindagens, no conflito). null = a ficha não tem o VD.
 * @param dv { key, nome } do registro do sistema
 */
export function valorVdDaFonte(fonte, dv) {
    if (!fonte || !dv) return null;
    if (fonte.valoresDer) {
        const f = finaisDoNpc(fonte)?.[dv.key];
        if (f != null) return f;
    }
    const v = valorComponente(dv.nome, fonte);
    if (v != null) return v;
    const o = parseFloat(fonte.valoresDer?.overrides?.[dv.key]);
    return isNaN(o) ? null : o;
}

/**
 * Keys de VD que o CADASTRO declara como espelho de um vital (`espelhaVD`).
 * Mora aqui porque o registro do sistema já está carregado no HUD; a conta é
 * pura e vive em tab-state. Quem grava vital de NPC passa isto adiante, para o
 * espelho seguir a declaração e não um valor que por acaso bateu.
 */
export function espelhosDoVitalNpc(stat) {
    return espelhosDoVital(stat, _sysHud?.derivedValues);
}

/**
 * Ficha por trás de um participante da cena (char da mesa ou NPC).
 *
 * 🌀 Quando o participante carrega bônus TEMPORÁRIOS (as sobras da Dádiva, de
 * quem está incorporado), a ficha sai daqui já somada. É o ponto único por
 * onde toda leitura passa — mira, conflito, HUD e golpes enxergam o empréstimo
 * sem nenhum deles precisar saber que existe incorporação acontecendo. E o doc
 * do personagem no banco continua intocado: o urso é da cena, não da ficha.
 */
export function fonteDoParticipante(p) {
    const base = p?.characterId ? (T.chars.find(c => c.id === p.characterId) || null)
        : p?.npcId ? (T.npcs.find(x => x.id === p.npcId) || null)
        : null;
    return base && p?.bonusTemp?.length ? fichaComBonus(base, p.bonusTemp) : base;
}

export function vdsCombateDoToken(o) {
    if (o.vinculo?.tipo === 'char') {
        const ch = T.chars.find(c => c.id === o.vinculo.id);
        return ch ? vdsCombateDaFonte(ch) : [];
    }
    if (o.vinculo?.tipo === 'npc') {
        const n = T.npcs.find(x => x.id === o.vinculo.id);
        return n?.valoresDer ? vdsCombateDaFonte(n) : [];
    }
    return [];
}

export function initHud() {
    // ⚔️ registro dos VDs de Status de Combate (lazy, sem segurar o boot).
    // O motor de cálculo vem junto: o doc do NPC NÃO guarda o valor final dos
    // VDs (só overrides/atual por id), então o card calcula igual ao editor.
    import('../../painel-mestre/js/npc-calc-engine.js?v=1.11')
        .then(m => { _calcNpcHud = m.calcularNpc; })
        .catch(e => console.warn('motor de NPC no HUD', e));
    import('../../painel-mestre/js/npc-system-data.js')
        .then(m => m.ensureNpcSystemData())
        .then(sys => {
            _sysHud = sys;
            VDS_COMBATE = (sys.derivedValues || []).filter(d => d.statusCombate)
                .map(d => ({
                    id: d.id, key: d.key, nome: d.nome, icone: d.icone || '📊',
                    prefixo: d.prefixo || '', sufixo: d.sufixo || '',
                    campoAtual: d.campoAtual === true, todoPersonagem: d.todoPersonagem === true,
                }));
            markDirty();
            window._renderCombate?.();
        })
        .catch(e => console.warn('VDs de Status de Combate', e));
    // Listener por personagem da mesa (poucos docs; barato)
    for (const c of T.chars) {
        const u = onSnapshot(doc(db, 'char', c.id), snap => {
            if (!snap.exists()) return;
            const d = snap.data(), dt = d.dots || {};
            // Status Vitais: lê valores pré-calculados do documento (mecânicas do Firebase).
            // Fallback legado para fichas que ainda não possuem hpMax/enerMax/sanMax salvos.
            const hpMax = d.hpMax || ((dt.vig || d.vig || 1) + (dt.tamanho || d.tamanho || 5));
            const enerMax = d.enerMax || ((dt.prs || d.prs || 1) + (dt.aut || d.aut || 1));
            const sanMax = d.sanMax || 100;
            VITAIS.set(c.id, {
                hp: d.hpCurrent !== undefined ? d.hpCurrent : hpMax, hpMax,
                ener: d.enerCurrent !== undefined ? d.enerCurrent : enerMax, enerMax,
                san: d.sanCurrent !== undefined ? d.sanCurrent : sanMax, sanMax,
                conds: (d.conditions || []).map(x => ({ icone: x.icone || '💀', nome: x.nome || '' })),
                // objetos completos (descrição, tempo) — a janela de ficha exibe e edita
                condsFull: d.conditions || [],
                // inputs crus da ficha — o ATUAL dos VDs de combate mora em dv_<key>_atual
                dvAtuais: d.derivedValues || {},
            });
            // VDs ao vivo: subir a Percepção na ficha muda o alcance de visão do
            // token na hora, sem precisar reabrir o Tabuleiro.
            const ch = T.chars.find(x => x.id === c.id);
            if (ch) ch.derivedTotals = d.derivedTotals || ch.derivedTotals || {};
            markDirty();
            // Atributos/perícias ao vivo também: o Alvo dos 🎯 Testes lê de dots
            if (ch) ch.dots = d.effectiveDots || d.dots || ch.dots || {};
            if (ch) ch.classModuleData = d.classModuleData || ch.classModuleData || {};
            if (ch) ch.peculiaridadesIndividuais = d.peculiaridadesIndividuais || ch.peculiaridadesIndividuais || [];
            // A janela de Combate lê os vitais do personagem DAQUI (VITAIS), então
            // sem este repinte ela ficava com o número velho quando o dano vinha do
            // Painel do Mestre ou da própria ficha. É barato: sai na hora se a
            // janela estiver fechada.
            window._renderCombate?.();
            window._renderFichaWins?.();
        }, () => {});
        unsubsVitais.push(u);
        T.unsubs.push(u);
    }
}

/** Vitais + condições de um token (ou null). */
export function vitaisDoToken(o) {
    if (o.vinculo?.tipo === 'char') {
        const v = VITAIS.get(o.vinculo.id);
        if (!v) return null;
        // Condições da FICHA + as da cena. A mesma condição vive nas duas
        // listas (o combate espelha na ficha), então agrupa: um ícone por
        // condição, com o nível mais alto — senão o token vira mostruário.
        const p = participanteDoToken(o);
        const conds = condicoesAgrupadas([...v.conds, ...(p?.condicoes || [])]);
        return { ...v, conds };
    }
    const p = participanteDoToken(o);
    if (!p) {
        if (o.vinculo?.tipo === 'npc') {
            const n = T.npcs.find(x => x.id === o.vinculo.id);
            if (n) {
                const vd = n.valoresDer || {};
                const atual = vd.atual || {};
                const hpMax = vd.VIT || 10;
                const enerMax = vd.ENER || 5;
                const sanMax = vd.SAN || 100;
                return {
                    hp: (atual.VIT !== undefined && atual.VIT !== null) ? Math.min(atual.VIT, hpMax) : hpMax, hpMax,
                    ener: (atual.ENER !== undefined && atual.ENER !== null) ? Math.min(atual.ENER, enerMax) : enerMax, enerMax,
                    san: (atual.SAN !== undefined && atual.SAN !== null) ? Math.min(atual.SAN, sanMax) : sanMax, sanMax,
                    conds: []
                };
            }
        }
        return null;
    }
    return {
        hp: p.hpCurrent ?? 0, hpMax: p.hpMax ?? 0,
        ener: p.enerCurrent ?? 0, enerMax: p.enerMax ?? 0,
        san: p.sanCurrent ?? 0, sanMax: p.sanMax ?? 100,
        conds: condicoesAgrupadas(p.condicoes || []),
    };
}

// A busca mora em tab-state (deslocamento, visão e render também precisam dela).
// Reexportada aqui porque meia dúzia de módulos já a importam por este caminho.
export { participanteDoToken };

/**
 * O token está numa cena de combate EM ANDAMENTO? Só aí o movimento passa a
 * ser ação de turno — antes do START não existe vez para gastar, e travar o
 * token nesse limbo deixaria o jogador parado sem nada a fazer.
 */
export function emCombateAtivo(o) {
    return !!cenaAtiva(T.combate)?.iniciado && !!participanteDoToken(o);
}

/** Barras visíveis para o usuário atual? (por token: todos|dono|mestre|off; vazio = padrão do canvas) */
export function barrasVisiveis(o) {
    const modo = o.barras || T.canvas?.barrasPadrao || 'todos';
    if (modo === 'off') return false;
    if (T.mode === 'secret') return true;   // no público (TV) nem o mestre vê barra de mestre
    if (modo === 'mestre') return false;
    if (modo === 'dono') {
        if (o.vinculo?.tipo !== 'char') return false;
        const ch = T.chars.find(c => c.id === o.vinculo.id);
        return ch?.ownerUid === T.user?.uid;
    }
    return true; // 'todos'
}

/** Token do participante ativo do combate (anel pulsante). */
export function tokenAtivoDoCombate() {
    const c = T.combate && cenaAtiva(T.combate);
    if (!c || !c.iniciado || !(c.participantes || []).length) return null;   // sem START não há "vez"
    // O anel de turno vale no público também: é a informação mais básica da mesa
    // ("é a sua vez") e não vaza nada — token fora da visão nem chega a ser
    // desenhado. O painel de combate continua preso ao `combateVisivelPublico`.
    const parts = c.participantes.slice().sort((a, b) => (b.initiative||0) - (a.initiative||0));
    const p = parts[(c.turnoAtual || 0) % parts.length];
    if (!p) return null;
    for (const o of T.objects.values()) {
        if (o.tipo !== 'token') continue;
        if (p.characterId && o.vinculo?.tipo === 'char' && o.vinculo.id === p.characterId) return o;
        if (p.npcId && o.vinculo?.tipo === 'npc' && o.vinculo.id === p.npcId) return o;
        if (p.isCustom && o.nome === p.name) return o;
    }
    return null;
}

// ---------- ROLAR INICIATIVA DO MAPA ----------
/** VDs de onde sai a Iniciativa do token: ficha do personagem ou NPC. */
function fonteIniciativa(o) {
    if (o.vinculo?.tipo === 'char') return T.chars.find(c => c.id === o.vinculo.id)?.derivedTotals || null;
    if (o.vinculo?.tipo === 'npc') return T.npcs.find(n => n.id === o.vinculo.id)?.valoresDer || null;
    return null;   // token custom não tem ficha — rola o dado puro
}

export async function rolarIniciativa(o) {
    // ⚔️ Iniciativa rola UMA vez por cena: quem já tem número não rola de novo
    // (o mestre ainda pode editar o valor na mão pela janela de Combate).
    const jaTem = participanteDoToken(o);
    if (jaTem && jaTem.initiative > 0) {
        toast(`⚠️ ${o.nome || 'Token'} já rolou iniciativa (${jaTem.initiative}) nesta cena — edite no Painel se precisar`, 'warning');
        return;
    }
    const dado = 1 + Math.floor(Math.random() * DADO_INICIATIVA);
    const bonus = bonusIniciativa(fonteIniciativa(o));
    const total = dado + bonus;
    const parts = (cenaAtiva(T.combate).participantes || []).map(p => ({ ...p }));
    let p = participanteDoToken(o);
    if (p) {
        p = parts.find(x => x.id === p.id);
        p.initiative = total;
    } else {
        // cria participante mínimo a partir do token
        const v = vitaisDoToken(o) || { hp: 10, hpMax: 10, ener: 5, enerMax: 5, san: 100, sanMax: 100 };
        const novo = {
            id: (o.vinculo?.tipo || 'tok') + '-' + Date.now(),
            name: o.nome || 'Token', initiative: total,
            type: o.vinculo?.tipo === 'char' ? 'Jogador' : o.vinculo?.tipo === 'npc' ? 'NPC' : 'Inimigo',
            details: 'Adicionado pelo Tabuleiro',
            hpCurrent: v.hp, hpMax: v.hpMax, enerCurrent: v.ener, enerMax: v.enerMax,
            sanCurrent: v.san, sanMax: v.sanMax,
        };
        if (o.vinculo?.tipo === 'char') novo.characterId = o.vinculo.id;
        if (o.vinculo?.tipo === 'npc') { novo.npcId = o.vinculo.id; novo.isNpc = true; }
        if (!o.vinculo || o.vinculo.tipo === 'custom') novo.isCustom = true;
        parts.push(novo);
    }
    try {
        await setDoc(refCombate(), { ...comCenaAtivaPatch(T.combate, { participantes: parts }), atualizadoEm: Date.now() }, { merge: true });
        toast(`🎲 Iniciativa de ${esc(o.nome || 'token')}: ${total} (1d${DADO_INICIATIVA}: ${dado}${bonus ? ` ${bonus > 0 ? '+' : '−'} ${Math.abs(bonus)}` : ''})`);
        logChat(`🎲 Iniciativa de ${o.nome || 'token'}: ${total} (1d${DADO_INICIATIVA}: ${dado}${bonus ? `, bônus ${bonus > 0 ? '+' : ''}${bonus}` : ''})`);
    } catch (e) { toast('❌ Erro ao rolar iniciativa', 'danger'); }
}

// ---------- MENU RADIAL ----------
export function abrirMenuRadial(o, sx, sy) {
    fecharMenuRadial();
    const el = document.createElement('div');
    el.id = 'tbRadial';
    el.className = 'tb-radial';
    const secreto = T.mode === 'secret' && T.isMaster;
    const acoes = [];

    if (o.vinculo?.tipo === 'npc' && (secreto || can('abrirNpc'))) {
        acoes.push({ ic: 'prancheta', tip: 'Abrir ficha do NPC', fn: () => window.tbAbrirNpcModal?.(o.vinculo.id, !secreto) });
    }
    // 🪟 Janela de combate (ficha ao vivo): mestre em NPC/char; jogador no próprio token
    if (o.vinculo?.tipo === 'npc' && secreto) {
        acoes.push({ ic: 'espadas', tip: 'Janela de combate do NPC', fn: () => window.tbFichaWin?.('npc', o.vinculo.id) });
    }
    if (o.vinculo?.tipo === 'char' && (secreto || tokenDoUsuario(o))) {
        acoes.push({ ic: 'espadas', tip: 'Janela de combate (ficha ao vivo)', fn: () => window.tbFichaWin?.('char', o.vinculo.id) });
    }
    // 👣 Mover pelo deslocamento da ficha: só no TURNO do token (mestre em
    // qualquer token com ficha — ajuda a deslocar NPC na medida; jogador no
    // próprio token, com a permissão de mover).
    const meuTurno = tokenAtivoDoCombate()?.id === o.id;
    const deslocs = (!o.bloqueado && meuTurno && (secreto || (tokenDoUsuario(o) && can('moverToken'))))
        ? deslocamentosDoToken(o, T.chars, T.npcs) : [];
    if (deslocs.length) {
        acoes.push({ ic: 'mover', tip: 'Mover pelo deslocamento da ficha (até o máximo em metros)', fn: () => abrirPickerDesloc(o, deslocs, sx, sy) });
    }
    // 🔒 Token bloqueado: nenhuma ação de manipulação; Mestre vê apenas o desbloqueio
    if (o.bloqueado) {
        if (secreto) acoes.push({ ic: 'cadeado', tip: 'Desbloquear objeto', fn: () => window.tbDesbloquearObj?.(o.id) });
    } else if (secreto) {
        acoes.push({ ic: 'dado', tip: `Rolar iniciativa (1d${DADO_INICIATIVA} + Iniciativa)`, fn: () => rolarIniciativa(o) });
        acoes.push({ ic: o.visao?.ativa ? 'olho' : 'olho-off', tip: 'Alternar visão', fn: () => updObj(o.id, { visao: { ...(o.visao||{}), ativa: !o.visao?.ativa } }) });
        acoes.push({ ic: o.luz?.ativa ? 'luz' : 'luz-off', tip: 'Alternar luz', fn: () => updObj(o.id, { luz: { ...(o.luz||{ alcance: 3 }), ativa: !o.luz?.ativa } }) });
        acoes.push({ ic: o.invisivel ? 'brilho' : 'fantasma', tip: o.invisivel ? 'Tornar visível' : 'Tornar invisível', fn: () => updObj(o.id, { invisivel: !o.invisivel }) });
        acoes.push({ ic: 'caveira', tip: 'Adicionar condição', fn: () => adicionarCondicao(o) });
        acoes.push({ ic: 'redimensionar', tip: 'Tamanho...', fn: async () => {
            const t = await perguntar('Quantas células o token ocupa?',
                { titulo: 'Tamanho do token', valor: o.tamanhoCelulas || 1, tipo: 'number', placeholder: '0,5 · 1 · 2 · 3' });
            if (t) updObj(o.id, { tamanhoCelulas: parseFloat(t) || 1 });
        }});
        acoes.push({ ic: 'elevacao', tip: 'Elevação...', fn: async () => {
            const e = await perguntar('Elevação, na unidade do canvas:',
                { titulo: 'Elevação do token', valor: o.elev || 0, tipo: 'number' });
            if (e !== null) updObj(o.id, { elev: parseFloat(e) || 0 });
        }});
        acoes.push({ ic: 'engrenagem', tip: 'Propriedades', fn: () => { selecionar(o.id); abrirPropriedades(o.id); markDirty(); } });
        acoes.push({ ic: 'lixeira', tip: 'Remover token', fn: () => delObj(o.id), danger: true });
    } else if (tokenDoUsuario(o) && !o.bloqueado) {
        // Jogador no PRÓPRIO token: iniciativa direto do mapa
        acoes.push({ ic: 'dado', tip: `Rolar iniciativa (1d${DADO_INICIATIVA} + Iniciativa)`, fn: () => rolarIniciativa(o) });
    }
    if (!acoes.length) return;

    const R = 74;
    // (sem o círculo central com a inicial — só ocupava o meio do clique)
    el.innerHTML = acoes.map((a, i) => {
            const ang = -Math.PI / 2 + (i / acoes.length) * Math.PI * 2;
            const x = Math.cos(ang) * R, y = Math.sin(ang) * R;
            return `<button class="tb-radial-item ${a.danger ? 'tb-radial-danger' : ''}" data-i="${i}" title="${esc(a.tip)}"
                style="transform:translate(${x.toFixed(0)}px,${y.toFixed(0)}px)">${ico(a.ic)}</button>`;
        }).join('');
    el.style.left = sx + 'px';
    el.style.top = sy + 'px';
    document.body.appendChild(el);
    el.querySelectorAll('.tb-radial-item').forEach(b => b.onclick = (ev) => {
        ev.stopPropagation();
        acoes[+b.dataset.i].fn();
        fecharMenuRadial();
    });
    setTimeout(() => document.addEventListener('pointerdown', function fecha(ev) {
        if (!el.contains(ev.target)) { fecharMenuRadial(); document.removeEventListener('pointerdown', fecha); }
    }), 10);
}
export function fecharMenuRadial() { document.getElementById('tbRadial')?.remove(); }

/**
 * Escolha do tipo de deslocamento (terrestre/aquático/vertical/aéreo/extras da
 * ficha). Um tipo só pula o menu e já arma o arrasto limitado — quem executa é
 * o tab-tools, lendo `T.moverDesloc` no próximo arrasto do token.
 */
function abrirPickerDesloc(o, deslocs, sx, sy) {
    if (deslocs.length === 1) { armarDesloc(o, deslocs[0]); return; }
    const menu = document.createElement('div');
    menu.id = 'tbDeslocPicker';
    menu.className = 'tb-ctx open';
    menu.style.left = Math.min(sx, window.innerWidth - 240) + 'px';
    menu.style.top = Math.min(sy, window.innerHeight - deslocs.length * 38 - 12) + 'px';
    menu.innerHTML = deslocs.map((d, i) =>
        `<div class="tb-ctx-item" data-i="${i}">👣 ${esc(d.tipo)} — <b>${d.metros} m</b></div>`).join('');
    document.body.appendChild(menu);
    menu.querySelectorAll('.tb-ctx-item').forEach(it => it.onclick = () => {
        armarDesloc(o, deslocs[+it.dataset.i]);
        menu.remove();
    });
    setTimeout(() => document.addEventListener('pointerdown', function fecha(ev) {
        if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('pointerdown', fecha); }
    }), 10);
}
function armarDesloc(o, d) {
    T.moverDesloc = { tokenId: o.id, tipo: d.tipo, metros: d.metros };
    selecionar(o.id);
    toast(`👣 ${d.tipo}: arraste o token — até ${d.metros} m. Esc cancela.`);
    markDirty();
}

async function adicionarCondicao(o) {
    const p = participanteDoToken(o);
    if (!p) { toast('⚠️ Token sem participante no combate — role a iniciativa primeiro', 'warning'); return; }
    // Delega ao picker de condições do módulo de combate (tab-combat.js)
    if (window.tbCombCondAdd) {
        window.tbCombCondAdd(p.id);
    } else {
        // Fallback caso o módulo de combate não esteja carregado
        const nome = await perguntar('Qual condição?', { titulo: 'Adicionar condição', placeholder: 'Ex: Envenenado, Caído' });
        if (!nome) return;
        const parts = (cenaAtiva(T.combate).participantes || []).map(pp => ({ ...pp }));
        const pp = parts.find(x => x.id === p.id); if (!pp) return;
        pp.condicoes = [...(pp.condicoes || []), nome.trim()];
        try { await setDoc(refCombate(), { ...comCenaAtivaPatch(T.combate, { participantes: parts }), atualizadoEm: Date.now() }, { merge: true }); }
        catch (e) { toast('❌ Erro', 'danger'); }
    }
}
