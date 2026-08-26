// =============================================
// NPC CALC ENGINE — Motor de cálculo PURO para a Ficha de NPC v2.
// Interpreta o mesmo formato de mecânicas do Painel de Criador
// (tipos: modificar, limitar, narrativo, conceder, condicional,
//  condicional_encadeado),
// mas sem depender do DOM nem do `state` global da ficha v1.7.
//
// Entrada:  npcData (schema v2) + sys (de ensureNpcSystemData)
// Saída:    { attrs, derived, infos, avisos }
// =============================================

// O motor e puro: importa em vez de olhar `window` como o resto do painel faz.
import { integridadeZerada } from '../../shared/inventario-motor.js?v=10';

const ATTR_SIGLAS = ['INT', 'RAC', 'PRS', 'FOR', 'DES', 'VIG', 'PRE', 'MAN', 'AUT'];

export const ATTR_NOMES = {
    'Inteligência': 'INT', 'Raciocínio': 'RAC', 'Perseverança': 'PRS',
    'Força': 'FOR', 'Destreza': 'DES', 'Vigor': 'VIG',
    'Presença': 'PRE', 'Manipulação': 'MAN', 'Autocontrole': 'AUT'
};

// Aliases legados de status vitais
const VITAL_ALIASES = {
    'Vitalidade Máxima': 'VIT_MAX',
    'Energia Máxima': 'ENER_MAX',
    'Sanidade Máxima': 'SAN_MAX'
};

/**
 * Constrói o mapa alvo→campo para NPCs a partir dos registros.
 * Campos: "ATTR:FOR" | "DV:<key>" | null (não aplicável em NPC)
 */
function buildTargetMap(sys) {
    const map = {};
    ATTR_SIGLAS.forEach(s => map[s] = 'ATTR:' + s);
    Object.entries(ATTR_NOMES).forEach(([nome, sigla]) => map[nome] = 'ATTR:' + sigla);
    
    (sys.vitalStats || []).forEach(vs => { 
        map[vs.nome] = 'DV:' + vs.key; 
        map[vs.key] = 'DV:' + vs.key; 
        map[`${vs.nome} Máxima`] = 'DV:' + vs.key;
        map[`${vs.nome} Máximo`] = 'DV:' + vs.key;
    });
    (sys.derivedValues || []).forEach(dv => { map[dv.nome] = 'DV:' + dv.key; map[dv.key] = 'DV:' + dv.key; });
    
    (sys.skills || []).forEach(s => {
        map[s.nome] = 'SKILL:' + s.id;
        // O construtor de equações do Criador grava a ref COM o prefixo
        // ("Perícia: Lâminas") — é ele que separa a perícia de um VD homônimo.
        // Sem esta entrada, toda equação de arma com perícia resolvia 0 no NPC
        // (o furo "perícia vale 0"): a ref não casava e caía no aviso.
        map['Perícia: ' + s.nome] = 'SKILL:' + s.id;
    });

    Object.entries(VITAL_ALIASES).forEach(([nome, key]) => {
        if (!map[nome]) map[nome] = 'DV:' + key;
    });
    
    return map;
}

/* ===== Resolução de equações (mesmo formato da ficha v1.7) ===== */

function resolveEquation(equacao, ctx) {
    if (!Array.isArray(equacao) || equacao.length === 0) return 0;
    let result = resolveTerm(equacao[0], ctx);
    for (let i = 1; i < equacao.length; i++) {
        const t = equacao[i];
        const val = resolveTerm(t, ctx);
        const op = t.op || '+';
        if (op === '+') result += val;
        else if (op === '-') result -= val;
        else if (op === '×' || op === '*') result *= val;
        else if (op === '÷' || op === '/') result = val !== 0 ? result / val : result;
        else if (op === 'min') result = Math.min(result, val);
        else if (op === 'max') result = Math.max(result, val);
    }
    return result;
}

/* Propriedades do item em escopo — refs "Item: ..." e "Projétil: ...".
 * Cópia fiel de _ME_ITEM_PROPS (ficha-v1.7_1/js/mechanics-engine.js): os dois
 * motores são reimplementações paralelas por design, e divergir aqui faz o
 * mesmo item render números diferentes na ficha e no painel do mestre.
 * `fio` é o nome antigo da Qualidade — alias mantido para item não migrado. */
const _NPC_ITEM_PROPS = {
    'Peso/Pressão': it => it.pressaoOverride ?? it.pressaoBase ?? it.peso,
    'Tamanho': it => it.tamanho,
    'Multiplicador de Pressão': (it, tpl) => it.multiplicadorPressao ?? tpl?.multiplicadorPressao ?? 1,
    'Capacidade do Container': (it, tpl) => it.capacidadeContainer ?? tpl?.capacidadeContainer,
    'Preço': (it, tpl) => it.preco ?? tpl?.preco,
    'Liga': (it, tpl) => it.liga ?? tpl?.liga,
    'Qualidade': (it, tpl) => it.qualidade ?? tpl?.qualidade ?? it.fio ?? tpl?.fio ?? 0,
    'Fio': (it, tpl) => it.qualidade ?? tpl?.qualidade ?? it.fio ?? tpl?.fio ?? 0,
    'Afiação': (it, tpl) => it.afiacao ?? tpl?.afiacao ?? 0,
    'Quantidade': it => it.quantidade ?? 1
};

function _npcPropDe(item, prop, ctx) {
    const fn = _NPC_ITEM_PROPS[prop];
    if (!fn || !item) return 0;
    const tpl = item.modeloId ? (ctx.equipCatalog || []).find(t => t.id === item.modeloId) : null;
    const num = parseFloat(fn(item, tpl));   // Liga vem como string ('0'..'5')
    return isNaN(num) ? 0 : num;
}

function _npcItemProp(prop, ctx) {
    if (!ctx?.itemEscopo) return 0;
    return _npcPropDe((ctx.inventoryItems || []).find(i => i.id === ctx.itemEscopo), prop, ctx);
}

/** Arco e besta dão o dado; a Qualidade e a Afiação vêm do maço apontado. */
function _npcProjetilProp(prop, ctx) {
    if (!ctx?.itemEscopo) return 0;
    const items = ctx.inventoryItems || [];
    const arma = items.find(i => i.id === ctx.itemEscopo);
    if (!arma || !arma.projetilId) return 0;
    return _npcPropDe(items.find(i => i.id === arma.projetilId), prop, ctx);
}

function resolveTerm(term, ctx) {
    if (!term) return 0;
    if (term.tipo === 'ficha') return resolveRef(term.ref, ctx);
    if (term.tipo === 'sort') return rollSortTerm(term);
    return parseFloat(term.valor) || 0;
}

/* Sorteia um valor inteiro entre min e max (inclusive) para termos do tipo 'sort'. */
function rollSortTerm(term) {
    let lo = parseFloat(term.min);
    let hi = parseFloat(term.max);
    if (isNaN(lo) && isNaN(hi)) return 0;
    if (isNaN(lo)) lo = hi;
    if (isNaN(hi)) hi = lo;
    lo = Math.round(lo);
    hi = Math.round(hi);
    if (lo > hi) { const tmp = lo; lo = hi; hi = tmp; }
    return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

/**
 * Resolve uma referência de ficha ("Força", "Nível", nome de derivado...)
 * usando o contexto do NPC. Refs sem correspondência valem 0 e geram aviso.
 */
function resolveRef(ref, ctx) {
    if (!ref) return 0;
    if (ref === 'Nível') return ctx.nivel;

    // Propriedades do item que concedeu a op (ctx.itemEscopo) e do maço que
    // ele aponta. Espelha _ME_ITEM_PROPS/_meProjetilProp da ficha — sem isto,
    // a arma de um NPC perde a Qualidade e a Afiação em silêncio.
    if (ref.startsWith('Item: ')) return _npcItemProp(ref.slice(6), ctx);
    if (ref.startsWith('Projétil: ')) return _npcProjetilProp(ref.slice(10), ctx);

    const target = ctx.targetMap[ref];
    if (target && target.startsWith('ATTR:')) {
        return ctx.attrsFinais[target.slice(5)] || 0;
    }
    if (target && target.startsWith('DV:')) {
        return ctx.derivedFinais[target.slice(3)] || 0;
    }
    if (target && target.startsWith('SKILL:')) {
        return ctx.skillLevels[target.slice(6)] || 0;
    }
    // Perícias não vinculadas retornam 0 sem gerar aviso de erro para não poluir
    if (target && target.startsWith('SKILL:')) {
        return 0; // Já tratado acima, mas mantido por segurança. (Fallback para skills é 0 natural).
    }

    // Outros campos da ficha não modelados no NPC → 0 (com aviso)
    ctx.avisos.add(`Referência "${ref}" não se aplica a NPCs — tratada como 0.`);
    return 0;
}

function resolveCalcValue(calc, ctx) {
    if (!calc) return 0;
    if (Array.isArray(calc.equacao) && calc.equacao.length > 0) return resolveEquation(calc.equacao, ctx);
    if (calc.valorTipo !== 'ficha') return parseFloat(calc.valor) || 0;
    return resolveRef(calc.valorRef, ctx) * (calc.valorMultiplicador || 1);
}

/* ===== Verificação de Equipamento (booleano / condicional_encadeado) =====
 * Conta itens do inventário do NPC (ctx.inventoryItems) que casam com um
 * requisito (equipamento específico, tag ou tipo) equipados nas formas
 * exigidas (efeitos ativos / segurando / fixado — nenhuma = qualquer forma). */

function _npcReqTarget(req) {
    req = req || {};
    if (req.targetTipo === 'tag' || (req.tag && !req.equipamentoId)) return { kind: 'tag', value: req.tag || '' };
    if (req.targetTipo === 'tipo' || (req.tipoEquipamento && !req.equipamentoId)) return { kind: 'tipo', value: req.tipoEquipamento || '' };
    return { kind: 'equipamento', value: req.equipamentoId || req.id || '' };
}

function _npcReqFormas(req) {
    req = req || {};
    if (Array.isArray(req.formasEquip)) return req.formasEquip.filter(f => ['efeitos', 'segurando', 'fixado'].includes(f));
    return req.exigeEfeitosOn === true ? ['efeitos'] : [];
}

function _npcReqNome(req, ctx) {
    const t = _npcReqTarget(req);
    if (t.kind === 'tag') return `Tag "${t.value}"`;
    if (t.kind === 'tipo') return `Tipo ${t.value}`;
    const tpl = (ctx.equipCatalog || []).find(x => x.id === t.value);
    return tpl?.nome || t.value;
}

/** Modelo do catalogo do item — a Integridade herda dele quando a instancia cala. */
function _npcTplDoItem(item, catalogo) {
    if (!item?.modeloId) return null;
    return (catalogo || []).find(t => t.id === item.modeloId) || null;
}

function _npcItemFormas(item, catalogo) {
    const formas = [];
    /* Integridade zerada silencia a peca: continua equipada, continua pesando,
       nao faz mais nada. O predicado esta duplicado em tres arquivos (ficha,
       Tabuleiro, motor de NPC) e o corte tem de ser nos tres — senao item
       arruinado segue dando bonus em duas telas. */
    if (integridadeZerada(item, _npcTplDoItem(item, catalogo))) return formas;

    if (!item.equipado || item.parentItemId || item.estadoEquip === 'armazenado') return formas;
    if (item.estadoEquip === 'fixado') { formas.push('fixado'); return formas; }
    if (item.estadoEquip === 'segurar') { formas.push('segurando'); return formas; }
    let efeitosOn = true;
    if (item.formaEquipar) {
        const equipToStateMap = { 'segurar': 'segurar', 'empunhar': 'empunhado', 'vestir': 'vestido', 'fixar': 'fixado' };
        if (item.estadoEquip !== equipToStateMap[item.formaEquipar]) efeitosOn = false;
    }
    if (efeitosOn) formas.push('efeitos');
    return formas;
}

/** Itens do NPC que casam com o alvo do requisito (sem filtrar por forma de equipar). */
function _npcMatchItems(req, ctx) {
    const items = Array.isArray(ctx?.inventoryItems) ? ctx.inventoryItems : [];
    const catalog = Array.isArray(ctx?.equipCatalog) ? ctx.equipCatalog : [];
    const target = _npcReqTarget(req);

    if (target.kind === 'tag') {
        const tag = target.value;
        return items.filter(i => {
            if (Array.isArray(i.tags) && i.tags.includes(tag)) return true;
            const tpl = i.modeloId ? catalog.find(t => t.id === i.modeloId) : catalog.find(t => t.nome === i.nome);
            return !!(tpl && Array.isArray(tpl.tags) && tpl.tags.includes(tag));
        });
    }
    if (target.kind === 'tipo') {
        const tipo = target.value;
        return items.filter(i => {
            if (i.tipo) return i.tipo === tipo;
            const tpl = i.modeloId ? catalog.find(t => t.id === i.modeloId) : catalog.find(t => t.nome === i.nome);
            return !!(tpl && tpl.tipo === tipo);
        });
    }
    const eqId = target.value;
    const tpl = catalog.find(t => t.id === eqId);
    return items.filter(i => i.modeloId === eqId || (tpl && i.nome === tpl.nome));
}

/** Item equipado numa das formas exigidas (lista vazia = qualquer forma equipada). */
function _npcItemEquipValido(item, formas, catalogo) {
    // Peca arruinada nao serve de requisito: _npcItemFormas devolve lista vazia.
    const atuais = _npcItemFormas(item, catalogo);
    if (!atuais.length) return false;
    if (!formas || formas.length === 0) return true;
    return formas.some(f => atuais.includes(f));
}

/** Soma a quantidade dos itens do NPC que casam com o requisito, equipados nas formas exigidas. */
function _npcCountReq(req, ctx) {
    const formas = _npcReqFormas(req);
    return _npcMatchItems(req, ctx)
        .filter(i => _npcItemEquipValido(i, formas, ctx?.equipCatalog))
        .reduce((s, i) => s + (parseInt(i.quantidade, 10) || 1), 0);
}

/** Itens com Efeitos Ativos — os que aplicam as próprias mecânicas. */
function _npcItensComEfeitos(ctx) {
    const items = Array.isArray(ctx?.inventoryItems) ? ctx.inventoryItems : [];
    return items.filter(i => _npcItemFormas(i, ctx?.equipCatalog).includes('efeitos'));
}

/**
 * Itens afetados por uma mecânica `escopoAplicacao: 'itens'`.
 * Filtro vazio = todos os itens com Efeitos Ativos.
 */
function _npcItensDoFiltro(filtro, ctx) {
    const reqs = Array.isArray(filtro)
        ? filtro.filter(r => r && (r.equipamentoId || r.tag || r.tipoEquipamento || r.targetTipo))
        : [];
    if (reqs.length === 0) return _npcItensComEfeitos(ctx);

    const vistos = new Set();
    const out = [];
    for (const req of reqs) {
        const formas = _npcReqFormas(req);
        for (const it of _npcMatchItems(req, ctx)) {
            if (vistos.has(it.id) || !_npcItemEquipValido(it, formas.length ? formas : ['efeitos'])) continue;
            vistos.add(it.id);
            out.push(it);
        }
    }
    return out;
}

/* ===== Verificação de Classe (booleano / condicional_encadeado) ===== */

/** Lista as classes do NPC (nomes), resolvendo o campo híbrido classeRef
 *  (registro OU personalizado) com fallback no campo legado npc.classe. */
function _npcClasses(npc, sys) {
    const out = [];
    const ref = npc?.classeRef;
    if (ref && typeof ref === 'object') {
        if (ref.refId && sys?.classesById?.[ref.refId]?.nome) out.push(sys.classesById[ref.refId].nome);
        else if (ref.custom) out.push(String(ref.custom));
    }
    if (out.length === 0 && npc?.classe) out.push(String(npc.classe));
    return out;
}

function _npcNormClasse(s) {
    return String(s || '').trim().toLowerCase();
}

/** true se o NPC (ctx.classes) possuir TODAS as classes exigidas. */
function _npcHasAllClasses(classesReq, ctx) {
    const reqs = (Array.isArray(classesReq) ? classesReq : []).filter(Boolean);
    if (reqs.length === 0) return false;
    const have = (Array.isArray(ctx?.classes) ? ctx.classes : []).map(_npcNormClasse);
    return reqs.every(c => have.includes(_npcNormClasse(c)));
}

function _npcCompare(valor, comp, a, b) {
    comp = comp || '>=';
    if (comp === 'entre') {
        if (isNaN(a) || isNaN(b)) return false;
        const lo = Math.min(a, b), hi = Math.max(a, b);
        return valor >= lo && valor <= hi;
    }
    if (isNaN(a)) return false;
    if (comp === '<') return valor < a;
    if (comp === '<=') return valor <= a;
    if (comp === '==') return valor === a;
    if (comp === '!=') return valor !== a;
    if (comp === '>=') return valor >= a;
    if (comp === '>') return valor > a;
    return false;
}

/* ===== Resolução de Condicional Encadeado (tabela de resolução) =====
 * Modo numérico: avalia a equação de valor com o contexto do NPC e percorre as
 * condições em ordem — a primeira que casar define o resultado.
 * Modo equipamento: conta os itens do inventário do NPC por vínculo e avalia
 * as verificações de cada condição (individuais e/ou Σ total somado). */
function resolveChainedConditional(config, ctx) {
    if (config?.modoVerificacao === 'equipamento') {
        const reqs = Array.isArray(config?.equipReqs) ? config.equipReqs : [];
        const counts = reqs.map(r => _npcCountReq(r, ctx));
        const total = counts.reduce((s, c) => s + c, 0);
        const condicoes = Array.isArray(config?.condicoes) ? config.condicoes : [];

        let valorSaida = config?.valorPadrao ?? '';
        let condicaoIndex = -1;
        for (let i = 0; i < condicoes.length; i++) {
            const c = condicoes[i] || {};
            const vers = Array.isArray(c.verificacoes) ? c.verificacoes : [];
            if (vers.length === 0) continue;
            let ok = true;
            for (const v of vers) {
                const val = v.alvo === 'total' ? total : (counts[parseInt(v.alvo, 10) || 0] ?? 0);
                if (!_npcCompare(val, v.comparacao || '>=', parseFloat(v.valorA), parseFloat(v.valorB))) { ok = false; break; }
            }
            if (ok) { valorSaida = c.resultado ?? ''; condicaoIndex = i; break; }
        }
        return { valorEquacao: total, valorSaida, condicaoIndex, counts, modo: 'equipamento' };
    }

    if (config?.modoVerificacao === 'classe') {
        const condicoes = Array.isArray(config?.condicoes) ? config.condicoes : [];
        let valorSaida = config?.valorPadrao ?? '';
        let condicaoIndex = -1;
        for (let i = 0; i < condicoes.length; i++) {
            const c = condicoes[i] || {};
            const reqs = (Array.isArray(c.classesReq) ? c.classesReq : []).filter(Boolean);
            if (reqs.length === 0) continue;
            if (_npcHasAllClasses(reqs, ctx)) { valorSaida = c.resultado ?? ''; condicaoIndex = i; break; }
        }
        return { valorEquacao: (ctx?.classes || []).length, valorSaida, condicaoIndex, modo: 'classe' };
    }

    const eq = Array.isArray(config?.equacaoValor) ? config.equacaoValor : [];
    const valorEquacao = resolveEquation(eq, ctx);
    const condicoes = Array.isArray(config?.condicoes) ? config.condicoes : [];

    let valorSaida = config?.valorPadrao ?? '';
    let condicaoIndex = -1;

    for (let i = 0; i < condicoes.length; i++) {
        const c = condicoes[i] || {};
        const ok = _npcCompare(valorEquacao, c.comparacao || '<', parseFloat(c.valorA), parseFloat(c.valorB));
        if (ok) {
            valorSaida = c.resultado ?? '';
            condicaoIndex = i;
            break;
        }
    }

    return { valorEquacao, valorSaida, condicaoIndex };
}

/* ===== Resolução de Booleano (equação comparativa OU verificação de equipamento) com contexto de NPC =====
 * Suporta múltiplas verificações (config.verificacoes, combinadas por
 * config.operadorLogico 'e'|'ou'). Config legada (campos no topo) = 1 verificação. */
function _npcEvalBoolVerif(v, ctx) {
    v = v || {};
    if (v.modoVerificacao === 'classe') {
        const reqs = (Array.isArray(v.classesReq) ? v.classesReq : []).filter(Boolean);
        const charClasses = Array.isArray(ctx?.classes) ? ctx.classes : [];
        const resultado = _npcHasAllClasses(reqs, ctx);
        return {
            valA: charClasses.length, valB: reqs.length, op: '>=', resultado,
            modo: 'classe', charClasses, classesReq: reqs
        };
    }
    if (v.modoVerificacao === 'equipamento') {
        const reqs = Array.isArray(v.equipReqs) ? v.equipReqs : [];
        const eqQ = Array.isArray(v.equacaoQtdMin) ? v.equacaoQtdMin : [];
        const qtdMin = eqQ.length > 0 ? resolveEquation(eqQ, ctx) : 1;
        const counts = reqs.map(r => _npcCountReq(r, ctx));
        const resultado = reqs.length > 0 && counts.every(c => c >= qtdMin);
        return {
            valA: counts.length ? Math.min(...counts) : 0,
            valB: qtdMin, op: '>=', resultado,
            modo: 'equipamento', counts, qtdMin,
            reqNomes: reqs.map(r => _npcReqNome(r, ctx))
        };
    }
    const valA = resolveEquation(Array.isArray(v.equacaoA) ? v.equacaoA : [], ctx);
    const valB = resolveEquation(Array.isArray(v.equacaoB) ? v.equacaoB : [], ctx);
    const op = v.operadorComparacao || '>=';
    let resultado = false;
    if (op === '==') resultado = valA === valB;
    else if (op === '!=') resultado = valA !== valB;
    else if (op === '>') resultado = valA > valB;
    else if (op === '>=') resultado = valA >= valB;
    else if (op === '<') resultado = valA < valB;
    else if (op === '<=') resultado = valA <= valB;
    return { valA, valB, op, resultado, modo: 'numerico' };
}

function resolveBooleano(config, ctx) {
    const verifs = (Array.isArray(config?.verificacoes) && config.verificacoes.length > 0)
        ? config.verificacoes : [config || {}];
    const operadorLogico = config?.operadorLogico === 'ou' ? 'ou' : 'e';
    const resultados = verifs.map(v => _npcEvalBoolVerif(v, ctx));
    const resultado = operadorLogico === 'ou'
        ? resultados.some(r => r.resultado)
        : resultados.every(r => r.resultado);
    const valorSaida = resultado ? (config?.valorVerdadeiro ?? '') : (config?.valorFalso ?? '');
    const first = resultados[0] || { valA: 0, valB: 0, op: '>=', modo: 'numerico' };
    return { ...first, resultado, valorSaida, resultados, operadorLogico, multi: resultados.length > 1 };
}

/* ===== Expansão recursiva de mecânicas encadeadas =====
 * Avalia as mecânicas vinculadas a um resultado (✅/❌ de um booleano ou a
 * faixa que casou de um condicional encadeado) usando o contexto do NPC e
 * devolve uma linha de texto por mecânica, com a mensagem de cada uma.
 * Booleanos e encadeados aninhados são resolvidos recursivamente; 'visited'
 * evita ciclos e 'depth' limita/indenta a profundidade da cadeia. */
function _expandTriggered(trigIds, sys, ctx, depth, visited) {
    const linhas = [];
    if (!Array.isArray(trigIds) || trigIds.length === 0 || depth > 8) return linhas;
    const indent = '\u00A0\u00A0'.repeat(Math.max(depth - 1, 0)) + '↳ ';

    for (const id of trigIds) {
        if (!id || visited.has(id)) continue;
        visited.add(id);
        const mech = sys.mechsById?.[id];
        if (!mech) { linhas.push(`${indent}⚠️ Mecânica "${id}" não encontrada no registro.`); continue; }
        const config = mech.config || {};
        const nome = mech.nome || 'Mecânica';
        try {
            if (mech.tipo === 'booleano') {
                const res = resolveBooleano(config, ctx);
                const msg = String(res.valorSaida ?? '').trim();
                linhas.push(`${indent}🔀 ${nome}: ${res.resultado ? '✅' : '❌'}${msg ? ` "${msg}"` : ''}`);
                const nested = res.resultado ? (config.efeitoTrueIds || []) : (config.efeitoFalseIds || []);
                linhas.push(..._expandTriggered(nested, sys, ctx, depth + 1, visited));
            } else if (mech.tipo === 'condicional_encadeado') {
                const res = resolveChainedConditional(config, ctx);
                const msg = String(res.valorSaida ?? '').trim();
                linhas.push(`${indent}🔗 ${nome}: "${msg}"`);
                if (res.condicaoIndex >= 0) {
                    const cond = (Array.isArray(config.condicoes) ? config.condicoes : [])[res.condicaoIndex];
                    linhas.push(..._expandTriggered(cond?.efeitoMecanicaIds, sys, ctx, depth + 1, visited));
                }
            } else if (mech.tipo === 'modificar') {
                const calculos = Array.isArray(config.calculos) && config.calculos.length
                    ? config.calculos
                    : [{ alvo: config.alvo, operacao: config.operacao, valor: config.valor, valorTipo: config.valorTipo || 'fixo', valorRef: config.valorRef, valorMultiplicador: config.valorMultiplicador, equacao: config.equacao }];
                const partes = [];
                for (const calc of calculos) {
                    if (!calc || calc.alvo === 'EXP') continue;
                    const alvos = Array.isArray(calc.alvo) ? calc.alvo : [calc.alvo];
                    const val = fmt(resolveCalcValue(calc, ctx));
                    for (const alvo of alvos) {
                        if (alvo) partes.push(`${calc.operacao === '=' ? '= ' : (calc.operacao || '+')}${val} em ${alvo}`);
                    }
                }
                linhas.push(`${indent}⚙️ ${nome}: ${partes.join('; ') || '(sem cálculos)'} — aplicar manualmente na ficha do NPC`);
            } else {
                const texto = mech.previewTexto || config.textoEfeito || mech.descricao || '';
                linhas.push(`${indent}📋 ${nome}${texto ? `: ${texto}` : ''}`);
            }
        } catch (e) {
            linhas.push(`${indent}⚠️ Erro ao avaliar mecânica encadeada "${nome}".`);
        }
    }
    return linhas;
}

/* ===== Coleta de mecânicas das peculiaridades do NPC ===== */

/**
 * Ajusta a config de uma mecânica evoluível para o nível da peculiaridade.
 */
function configNoNivel(mech, nivel) {
    let config = mech.config || {};
    if (!mech.evoluivel || !mech.progressao) return config;
    const prog = mech.progressao[String(nivel)];
    if (!prog) return config;

    config = JSON.parse(JSON.stringify(config));
    const tipo = mech.tipo;
    if (tipo === 'modificar' || tipo === 'limitar') {
        if (prog.termos && Array.isArray(config.calculos)) {
            for (const calc of config.calculos) {
                if (!Array.isArray(calc.equacao)) continue;
                let fixoIdx = 0;
                for (const term of calc.equacao) {
                    if (term.tipo !== 'ficha' && term.tipo !== 'sort') {
                        const ov = prog.termos[String(fixoIdx)];
                        if (ov !== undefined && ov !== '') term.valor = ov;
                        fixoIdx++;
                    }
                }
            }
        } else if (tipo === 'modificar' && prog.valor !== undefined) {
            config.valor = prog.valor;
        } else if (tipo === 'limitar') {
            const limVal = prog.valorLimite !== undefined ? prog.valorLimite : prog.valor;
            if (limVal !== undefined) {
                if (config.valorMaximo !== undefined) config.valorMaximo = limVal;
                if (config.valorMinimo !== undefined) config.valorMinimo = limVal;
            }
        }
    }
    return config;
}

/**
 * Extrai as "operações" (bônus/limites) e "infos" (efeitos narrativos)
 * de todas as peculiaridades com refId do NPC.
 */
function gatherOperations(npc, sys, targetMap, avisos) {
    const ops = [];      // { target, op, valor|calc, fonte }
    const limites = [];  // { target, tipoLimite, calc, calcMin, fonte }
    const infos = [];    // { fonte, texto, icone }
    const encadeadas = []; // { config, fonte, icone, nome } — avaliadas após os valores finais
    const booleanas = [];  // { config, fonte, icone, nome } — avaliadas após os valores finais

    for (const pecRef of (npc.peculiaridades || [])) {
        // Peculiaridade personalizada: apenas informativa
        if (!pecRef.refId) {
            if (pecRef.nomeCustom) {
                infos.push({
                    fonte: pecRef.nomeCustom + ' (personalizada)',
                    texto: [pecRef.efeitoManual, pecRef.descricao].filter(Boolean).join(' — ') || 'Sem efeito mecânico automático.',
                    icone: pecRef.icone || '✏️'
                });
            }
            continue;
        }

        const pec = sys.pecsById[pecRef.refId];
        if (!pec) { avisos.add(`Peculiaridade "${pecRef.refId}" não encontrada no registro.`); continue; }
        const nivel = pecRef.nivel || 1;
        const fonteLabel = pec.nome + (pecRef.fonte ? ` (${pecRef.fonte})` : '');

        for (const mechId of (pec.mecanicaIds || [])) {
            const mech = sys.mechsById[mechId];
            if (!mech) { avisos.add(`Mecânica "${mechId}" (${pec.nome}) não encontrada.`); continue; }

            const isConditional = mech.condicaoAplicacao && String(mech.condicaoAplicacao).trim() !== '';
            const isPermanent = !mech.duracao || mech.duracao === 'permanente';
            const config = configNoNivel(mech, nivel);

            // Condicional Encadeado permanente e sem condição → avaliado
            // automaticamente com os valores finais do NPC (após as demais mecânicas)
            if (mech.tipo === 'condicional_encadeado' && !isConditional && isPermanent) {
                encadeadas.push({ config, fonte: fonteLabel, icone: pec.icone || '🔗', nome: mech.nome || '', id: mechId });
                continue;
            }

            // Booleano permanente e sem condição → avaliado automaticamente
            // com os valores finais do NPC (após as demais mecânicas)
            if (mech.tipo === 'booleano' && !isConditional && isPermanent) {
                booleanas.push({ config, fonte: fonteLabel, icone: pec.icone || '🔀', nome: mech.nome || '', id: mechId });
                continue;
            }

            // Distribuir: exige escolha de alvos (regra de criação de PJ)
            // → vira informação para o mestre aplicar manualmente
            if (mech.tipo === 'distribuir' && !isConditional && isPermanent) {
                const pool = config.pool === 'Personalizado' && Array.isArray(config.poolPersonalizado) && config.poolPersonalizado.length
                    ? config.poolPersonalizado.join(', ') : (config.pool || '?');
                const texto = mech.previewTexto
                    || `Distribuir: ${config.operacao || '+'}${config.valorPorAlvo ?? '?'} em ${config.quantidadeAlvos ?? '?'} alvos de [${pool}]`;
                infos.push({ fonte: fonteLabel, texto: `🎲 ${texto} — aplicar manualmente na ficha do NPC`, icone: pec.icone || '🎲' });
                continue;
            }

            // Efeitos não-automáticos viram informação para o mestre
            if (mech.tipo === 'narrativo' || mech.tipo === 'conceder' || mech.tipo === 'condicional'
                || mech.tipo === 'condicional_encadeado'
                || isConditional || !isPermanent) {
                let texto = mech.previewTexto || config.textoEfeito || mech.descricao || mech.nome || '';
                if (mech.evoluivel && mech.progressao?.[String(nivel)]) {
                    const prog = mech.progressao[String(nivel)];
                    texto = prog.textoEfeito || prog.descricao || texto;
                }
                if (isConditional) texto += ` [Condição: ${mech.condicaoAplicacao}]`;
                if (!isPermanent && mech.duracao) texto += ` [Duração: ${mech.duracao}]`;
                infos.push({ fonte: fonteLabel, texto, icone: pec.icone || '📋' });
                continue;
            }

            if (mech.tipo === 'modificar') {
                const calculos = Array.isArray(config.calculos) && config.calculos.length
                    ? config.calculos
                    : [{ alvo: config.alvo, operacao: config.operacao, valor: config.valor, valorTipo: config.valorTipo || 'fixo', valorRef: config.valorRef, valorMultiplicador: config.valorMultiplicador, equacao: config.equacao }];
                for (const calc of calculos) {
                    if (calc.alvo === 'EXP') continue; // EXP é regra de criação de PJ
                    const alvos = Array.isArray(calc.alvo) ? calc.alvo : [calc.alvo];
                    for (const alvo of alvos) {
                        if (!alvo) continue;
                        const target = targetMap[alvo];
                        if (!target) {
                            infos.push({ fonte: fonteLabel, texto: `${calc.operacao || '+'} em "${alvo}" (alvo fora da ficha de NPC — aplicar manualmente)`, icone: '⚠️' });
                            continue;
                        }
                        ops.push({ target, op: calc.operacao || '+', calc, fonte: fonteLabel });
                    }
                }
            }

            if (mech.tipo === 'limitar') {
                const calculos = Array.isArray(config.calculos) && config.calculos.length
                    ? config.calculos
                    : [{ alvo: config.alvo, tipoLimite: config.tipoLimite, valor: config.valorMaximo ?? config.valorMinimo, valorMinimo: config.valorMinimo, valorTipo: 'fixo' }];
                for (const calc of calculos) {
                    const target = targetMap[calc.alvo];
                    if (!target) continue;
                    limites.push({ target, tipoLimite: calc.tipoLimite, calc, fonte: fonteLabel });
                }
            }
        }
    }
    return { ops, limites, infos, encadeadas, booleanas };
}

/* ===== Operações vindas dos ITENS EQUIPADOS =====
 * Até aqui o motor de NPC só percorria npc.peculiaridades: as mecânicas dos
 * itens equipados (do modelo do catálogo, da instância, e os Valores Derivados
 * Vinculados) nunca eram aplicadas — uma espada "+2 de Acerto" não fazia nada
 * num NPC. Esta função corrige isso.
 *
 * Devolve as ops separadas: as de alvo global vão para o bag do NPC; as de
 * alvo marcado com `escopoItem` ficam presas ao item que as concedeu, para que
 * duas armas equipadas não somem no mesmo número.
 *
 * ponytail: espelha _meItensDoFiltro/_meBonusBag da ficha (mechanics-engine.js).
 * Os dois motores já são reimplementações paralelos por design — unificá-los é
 * reescrita, não feature. Se divergirem, o teste a acrescentar é aqui.
 */
function gatherItemOperations(sys, targetMap, ctx, avisos) {
    const globais = [];
    const porItem = {};   // { itemId: [ops] }
    const dvEscopo = {};  // { 'DV:key': 'coluna'|'dano' }
    for (const dv of (sys.derivedValues || [])) {
        if (dv.escopoItem) dvEscopo['DV:' + dv.key] = dv.escopoItem;
    }

    const pushOp = (itemId, op) => {
        // `donoItemId` viaja com a op para que as refs "Item: ..." resolvam
        // contra a peça que concedeu o bônus — inclusive quando ela cai no bag
        // global (vínculo com escopo:'global', como a penalidade do Escudo
        // de Torre). É o equivalente do _meSetItemScope da ficha.
        op.donoItemId = itemId || null;
        if (itemId && dvEscopo[op.target]) {
            (porItem[itemId] = porItem[itemId] || []).push(op);
        } else {
            globais.push(op);
        }
    };

    /** Converte uma mecânica 'modificar' em ops, atribuídas ao item informado. */
    const opsDaMecanica = (mech, itemId, fonteLabel) => {
        if (!mech || mech.tipo !== 'modificar') return;
        const isConditional = mech.condicaoAplicacao && String(mech.condicaoAplicacao).trim() !== '';
        const isPermanent = !mech.duracao || mech.duracao === 'permanente';
        if (isConditional || !isPermanent) return;

        const config = mech.config || {};
        const calculos = Array.isArray(config.calculos) && config.calculos.length
            ? config.calculos
            : [{ alvo: config.alvo, operacao: config.operacao, valor: config.valor, valorTipo: config.valorTipo || 'fixo', valorRef: config.valorRef, valorMultiplicador: config.valorMultiplicador, equacao: config.equacao }];

        for (const calc of calculos) {
            if (calc.alvo === 'EXP') continue;
            for (const alvo of (Array.isArray(calc.alvo) ? calc.alvo : [calc.alvo])) {
                if (!alvo) continue;
                const target = targetMap[alvo];
                if (!target) {
                    avisos.add(`Item "${fonteLabel}": alvo "${alvo}" não existe na ficha de NPC — aplicar manualmente.`);
                    continue;
                }
                pushOp(itemId, { target, op: calc.operacao || '+', calc, fonte: fonteLabel });
            }
        }
    };

    // 1) Mecânicas dos próprios itens equipados com Efeitos Ativos
    for (const item of _npcItensComEfeitos(ctx)) {
        const tpl = item.modeloId ? (ctx.equipCatalog || []).find(t => t.id === item.modeloId) : null;
        const label = item.nome || tpl?.nome || 'Item';

        for (const mechId of (tpl?.mecanicaIds || [])) opsDaMecanica(sys.mechsById[mechId], item.id, label);
        for (const mechId of (item.mecanicaIdsProprias || [])) opsDaMecanica(sys.mechsById[mechId], item.id, label);

        // Valores Derivados Vinculados: a Equação de Valor substitui o
        // modificador fixo (legado); instância vence modelo. escopo:'global'
        // no vínculo força o bag do NPC mesmo em DV com escopoItem (mesma
        // regra da ficha).
        const dvList = item.valoresDerivadosVinculados || tpl?.valoresDerivadosVinculados || [];
        for (const dvObj of dvList) {
            // Vínculo preso a uma pegada (dvObj.maos) só vale naquela pegada.
            if (globalThis.EquipSlots && !globalThis.EquipSlots.vinculoValeComMaos(dvObj, item)) continue;
            const dvId = dvObj.id || dvObj;
            const dvDef = (sys.derivedValues || []).find(d => d.id === dvId);
            if (!dvDef) continue;
            const scopeId = dvObj.escopo === 'global' ? null : item.id;
            const temEq = Array.isArray(dvObj.equacao) && dvObj.equacao.length;
            const mod = Number(dvObj.modificador) || 0;
            if (!temEq && !mod) continue;
            pushOp(scopeId, {
                target: 'DV:' + dvDef.key, op: '+',
                calc: temEq ? { equacao: dvObj.equacao } : { valorTipo: 'fixo', valor: mod },
                fonte: label
            });
        }
    }

    // 2) Mecânicas de peculiaridade marcadas como "aplica nos itens equipados"
    //    (ex: "todo item com tag Adaga recebe +1 de Dano")
    for (const pecRef of (npcPecRefs(ctx) || [])) {
        const pec = sys.pecsById[pecRef.refId];
        if (!pec) continue;
        for (const mechId of (pec.mecanicaIds || [])) {
            const mech = sys.mechsById[mechId];
            if (!mech || mech.escopoAplicacao !== 'itens') continue;
            for (const it of _npcItensDoFiltro(mech.itemFiltro, ctx)) {
                opsDaMecanica(mech, it.id, `${pec.nome} → ${it.nome || 'item'}`);
            }
        }
    }

    return { globais, porItem, dvEscopo };
}

/** Referências de peculiaridade do NPC guardadas no contexto. */
function npcPecRefs(ctx) {
    return (ctx && ctx.pecRefs) ? ctx.pecRefs.filter(p => p && p.refId) : [];
}

/* Tipos de golpe físico — espelho de TIPOS_GOLPE (item-scope-calc.js): os
 * dois motores são reimplementações paralelas por design. É o que diz quais
 * das três Blindagens tipadas do alvo barram o dano. */
const _NPC_TIPOS_GOLPE = {
    cortante: { nome: 'Cortante', icone: '🗡️' },
    perfurante: { nome: 'Perfurante', icone: '🏹' },
    contundente: { nome: 'Contundente', icone: '🔨' },
};

/** Tipos de golpe do item (1 ou mais): instância vence modelo; string legada
 *  vira lista de um. Sem repetição, na ordem do cadastro. */
function _npcTiposGolpe(item, catalog) {
    let t = item?.tipoGolpe;
    if ((t == null || t === '' || (Array.isArray(t) && !t.length)) && item?.modeloId) {
        t = (catalog || []).find(x => x.id === item.modeloId)?.tipoGolpe;
    }
    const lista = Array.isArray(t) ? t : (t ? [t] : []);
    const vistos = new Set();
    const out = [];
    for (const x of lista) {
        const chave = String(x || '').toLowerCase().trim();
        if (!_NPC_TIPOS_GOLPE[chave] || vistos.has(chave)) continue;
        vistos.add(chave);
        out.push({ chave, ..._NPC_TIPOS_GOLPE[chave] });
    }
    return out;
}

/** Fórmula de dano do item: instância vence o modelo do catálogo. */
function _npcFormulaDano(item, catalog) {
    if (item?.formulaDano) return String(item.formulaDano).trim();
    if (item?.modeloId) {
        const tpl = (catalog || []).find(t => t.id === item.modeloId);
        if (tpl?.formulaDano) return String(tpl.formulaDano).trim();
    }
    return '';
}

/* ===== Aplicação de operações sobre um valor ===== */

function applyOpsToValue(target, baseValue, ops, limites, ctx, fontes) {
    let value = baseValue;
    const mine = ops.filter(o => o.target === target);

    /* Resolve a op com o item que a concedeu em escopo, e devolve o escopo
       anterior — sem isto, "Item: Qualidade" resolveria 0 no bag global. */
    const valorDaOp = o => {
        const anterior = ctx.itemEscopo;
        ctx.itemEscopo = o.donoItemId || null;
        try { return resolveCalcValue(o.calc, ctx); }
        finally { ctx.itemEscopo = anterior; }
    };

    // 1) SET (=) sobrescreve a base
    for (const o of mine) {
        if (o.op === '=') {
            value = valorDaOp(o);
            fontes.push({ fonte: o.fonte, texto: `= ${fmt(value)}` });
        }
    }
    // 2) Somas e subtrações
    for (const o of mine) {
        const v = (o.op === '+' || o.op === '-') ? valorDaOp(o) : null;
        if (o.op === '+') { value += v; fontes.push({ fonte: o.fonte, texto: `+${fmt(v)}` }); }
        else if (o.op === '-') { value -= v; fontes.push({ fonte: o.fonte, texto: `-${fmt(v)}` }); }
    }
    // 3) Multiplicações e divisões
    for (const o of mine) {
        if (o.op === '×' || o.op === '*') { const v = valorDaOp(o); value *= v; fontes.push({ fonte: o.fonte, texto: `×${fmt(v)}` }); }
        else if (o.op === '÷' || o.op === '/') { const v = valorDaOp(o); if (v !== 0) value /= v; fontes.push({ fonte: o.fonte, texto: `÷${fmt(v)}` }); }
    }
    // 4) Limites
    for (const l of limites.filter(x => x.target === target)) {
        if (l.tipoLimite === 'bloqueio') { value = 0; fontes.push({ fonte: l.fonte, texto: 'bloqueado (= 0)' }); }
        else if (l.tipoLimite === 'maximo') { const m = resolveCalcValue(l.calc, ctx); if (value > m) { value = m; fontes.push({ fonte: l.fonte, texto: `máx ${fmt(m)}` }); } }
        else if (l.tipoLimite === 'minimo') { const m = resolveCalcValue(l.calc, ctx); if (value < m) { value = m; fontes.push({ fonte: l.fonte, texto: `mín ${fmt(m)}` }); } }
        else if (l.tipoLimite === 'clamp') {
            const max = resolveCalcValue(l.calc, ctx);
            const min = parseFloat(l.calc.valorMinimo) || 0;
            const clamped = Math.min(Math.max(value, min), max);
            if (clamped !== value) { value = clamped; fontes.push({ fonte: l.fonte, texto: `entre ${fmt(min)} e ${fmt(max)}` }); }
        }
    }
    return value;
}

function fmt(v) { return Number.isInteger(v) ? v : parseFloat(Number(v).toFixed(2)); }

/* ===== FUNÇÃO PRINCIPAL ===== */

/**
 * Calcula atributos efetivos e valores derivados de um NPC (schema v2).
 *
 * @returns {{
 *   attrs:   { [SIGLA]: { base, bonus, final, fontes[] } },
 *   derived: { [key]: { key, nome, icone, isVital, auto, override, final, fontes[] } },
 *   porItem: [{ itemId, nome, tipo, estadoEquip, dano, colunas[] }],
 *   infos:   [{ fonte, texto, icone }],
 *   avisos:  string[]
 * }}
 */
export function calcularNpc(npc, sys, opts = {}) {
    const avisos = new Set();
    const targetMap = buildTargetMap(sys);
    const nivel = parseInt(npc.nivel) || 1;

    const { ops, limites, infos, encadeadas, booleanas } = gatherOperations(npc, sys, targetMap, avisos);

    // --- Contexto compartilhado pelas equações ---
    const ctx = {
        nivel, targetMap, attrsFinais: {}, derivedFinais: {}, skillLevels: {}, avisos,
        // Inventário do NPC (para mecânicas com Verificação de Equipamento)
        inventoryItems: Array.isArray(opts.items) ? opts.items : [],
        equipCatalog: Array.isArray(sys.equipment) ? sys.equipment : [],
        // Classes do NPC (para mecânicas com Verificação de Classe)
        classes: _npcClasses(npc, sys),
        // Peculiaridades do NPC (para mecânicas com escopoAplicacao: 'itens')
        pecRefs: Array.isArray(npc.peculiaridades) ? npc.peculiaridades : []
    };

    // Operações vindas dos itens equipados (globais + presas a cada item)
    const itemOps = gatherItemOperations(sys, targetMap, ctx, avisos);
    
    // Alimenta o contexto com os níveis das perícias estruturadas do NPC
    if (Array.isArray(npc.periciasEstruturadas)) {
        npc.periciasEstruturadas.forEach(ps => {
            if (ps.refId) ctx.skillLevels[ps.refId] = ps.nivel || 0;
        });
    }

    // --- 1) Atributos: base (dots do NPC) + operações de mecânicas ---
    const attrs = {};
    for (const sigla of ATTR_SIGLAS) {
        const base = parseInt(npc.atributos?.[sigla]) || 0;
        const fontes = [];
        const final = applyOpsToValue('ATTR:' + sigla, base, ops, limites, ctx, fontes);
        attrs[sigla] = { base, bonus: fmt(final - base), final: fmt(final), fontes };
        ctx.attrsFinais[sigla] = final;
    }

    // --- 2) Valores derivados + status vitais ---
    // Base 0 — as mecânicas dos próprios registros (derivedValues/vitalStats)
    // definem o cálculo, mais quaisquer mecânicas das peculiaridades do NPC.
    const dvDefs = [
        ...sys.vitalStats.map(vs => ({ ...vs, isVital: true })),
        ...sys.derivedValues.map(dv => ({ ...dv, isVital: false }))
    ];

    // Injeta as mecânicas intrínsecas dos registros de DV como operações
    const intrinsecas = [];
    for (const def of dvDefs) {
        for (const mechId of (def.mecanicaIds || [])) {
            const mech = sys.mechsById[mechId];
            if (!mech || mech.tipo !== 'modificar') continue;
            const isConditional = mech.condicaoAplicacao && String(mech.condicaoAplicacao).trim() !== '';
            const isPermanent = !mech.duracao || mech.duracao === 'permanente';
            if (isConditional || !isPermanent) continue;
            const config = mech.config || {};
            const calculos = Array.isArray(config.calculos) && config.calculos.length
                ? config.calculos
                : [{ alvo: config.alvo, operacao: config.operacao, valor: config.valor, valorTipo: config.valorTipo || 'fixo', valorRef: config.valorRef, valorMultiplicador: config.valorMultiplicador, equacao: config.equacao }];
            for (const calc of calculos) {
                // Alvo implícito e explícito das intrínsecas: SEMPRE o próprio DV
                const alvoTarget = 'DV:' + def.key;
                intrinsecas.push({ target: alvoTarget, op: calc.operacao || '+', calc, fonte: `Fórmula (${def.nome})` });
            }
        }
    }
    const allOps = [...intrinsecas, ...ops, ...itemOps.globais];

    // Duas passadas para estabilizar referências cruzadas entre derivados
    const derived = {};
    for (let pass = 0; pass < 2; pass++) {
        for (const def of dvDefs) {
            const fontes = [];
            const auto = fmt(applyOpsToValue('DV:' + def.key, 0, allOps, limites, ctx, fontes));
            const overrideRaw = npc.valoresDer?.overrides?.[def.key];
            const hasOverride = overrideRaw !== undefined && overrideRaw !== null && overrideRaw !== '';
            const final = hasOverride ? (parseFloat(overrideRaw) || 0) : auto;
            derived[def.key] = {
                key: def.key, nome: def.nome, icone: def.icone || null,
                isVital: def.isVital, campoAtual: def.isVital || def.campoAtual === true,
                auto, override: hasOverride ? fmt(parseFloat(overrideRaw) || 0) : null,
                final: fmt(final), fontes: pass === 1 ? fontes : []
            };
            ctx.derivedFinais[def.key] = final;
        }
    }

    // --- 2b) Totais por item equipado (Valores Derivados com Escopo por Item) ---
    // Base = valor final global do DV (já com raça/classe/peculiaridade dentro);
    // em cima disso aplicamos APENAS as ops presas àquele item.
    const porItem = [];
    for (const item of _npcItensComEfeitos(ctx)) {
        const minhasOps = itemOps.porItem[item.id] || [];
        const colunas = [];
        let somaDano = 0;
        let temBonusDano = false;

        for (const def of dvDefs) {
            const escopo = itemOps.dvEscopo['DV:' + def.key];
            if (!escopo) continue;

            const base = Number(derived[def.key]?.final) || 0;
            const total = fmt(applyOpsToValue('DV:' + def.key, base, minhasOps, [], ctx, []));
            const bonus = fmt(total - base);

            if (escopo === 'dano') {
                somaDano += total;
                if (bonus !== 0) temBonusDano = true;
                continue;
            }
            colunas.push({
                key: def.key, nome: def.nome, icone: def.icone || '📊',
                prefixo: def.prefixo || '', sufixo: def.sufixo || '',
                base: fmt(base), bonus, total
            });
        }

        // SEM fórmula não há dano: um escudo não causa dano só porque o NPC tem
        // bônus global de dano. O bônus só significa algo grudado num dado.
        const formula = _npcFormulaDano(item, ctx.equipCatalog);
        const somaFmt = fmt(somaDano);
        let dano = '';
        if (formula) dano = somaFmt !== 0 ? `${formula}${somaFmt > 0 ? '+' : ''}${somaFmt}` : formula;

        if (!formula && temBonusDano) {
            avisos.add(`"${item.nome || item.id}" concede bônus de Dano mas não tem Fórmula de Dano — o bônus não aparece. Preencha a Fórmula de Dano do equipamento.`);
        }

        if (formula || colunas.some(c => c.bonus !== 0)) {
            porItem.push({
                itemId: item.id,
                nome: item.nome || 'Item',
                tipo: item.tipo || 'Objeto',
                estadoEquip: item.estadoEquip || null,
                // sem dado não há golpe: o tipo só significa algo grudado numa fórmula
                tiposGolpe: formula ? _npcTiposGolpe(item, ctx.equipCatalog) : [],
                dano, colunas
            });
        }
    }

    // --- 3) Booleanas e Condicionais Encadeadas: avaliadas com os valores FINAIS do NPC ---
    for (const b of (booleanas || [])) {
        try {
            const res = resolveBooleano(b.config, ctx);
            const nomePrefix = b.nome ? `${b.nome}: ` : '';
            const opLabels = { '==': '==', '!=': '!=', '>': '>', '>=': '≥', '<': '<', '<=': '≤' };
            const _verifTxt = (r) => {
                if (r.modo === 'equipamento') {
                    const detalhe = (r.reqNomes || []).map((n, i) => `${n}=${fmt(r.counts?.[i] ?? 0)}`).join(', ');
                    return `🎒 [${detalhe || 'sem vínculos'}] ≥ ${fmt(r.qtdMin)} cada → ${r.resultado ? '✅' : '❌'}`;
                }
                if (r.modo === 'classe') {
                    const tem = (r.charClasses || []).join(', ') || 'sem classe';
                    const precisa = (r.classesReq || []).join(' E ') || '?';
                    return `⚔️ [${tem}] precisa de [${precisa}] → ${r.resultado ? '✅' : '❌'}`;
                }
                return `${fmt(r.valA)} ${opLabels[r.op] || r.op} ${fmt(r.valB)} → ${r.resultado ? '✅' : '❌'}`;
            };
            let texto;
            if (res.multi) {
                const joinLbl = res.operadorLogico === 'ou' ? ' OU ' : ' E ';
                const partes = res.resultados.map(r => `(${_verifTxt(r)})`);
                texto = `🔀 ${nomePrefix}${partes.join(joinLbl)} → ${res.resultado ? '✅' : '❌'} "${res.valorSaida}"`;
            } else {
                texto = `🔀 ${nomePrefix}${_verifTxt(res)} "${res.valorSaida}"`;
            }
            infos.push({ fonte: b.fonte, texto, icone: b.icone || '🔀' });

            // Mecânicas acionadas pelo resultado: cadeia resolvida recursivamente,
            // cada mecânica em sua própria linha, abaixo da que a acionou
            const trigIds = res.resultado ? (b.config?.efeitoTrueIds || []) : (b.config?.efeitoFalseIds || []);
            for (const linha of _expandTriggered(trigIds, sys, ctx, 1, new Set(b.id ? [b.id] : []))) {
                infos.push({ fonte: b.fonte, texto: linha, icone: '\u00A0' });
            }
        } catch (e) {
            avisos.add(`Erro ao avaliar mecânica booleana "${b.nome || '?'}" (${b.fonte}).`);
        }
    }

    for (const enc of (encadeadas || [])) {
        try {
            const res = resolveChainedConditional(enc.config, ctx);
            const nomePrefix = enc.nome ? `${enc.nome}: ` : '';
            let texto;
            if (res.modo === 'equipamento') {
                const reqs = Array.isArray(enc.config?.equipReqs) ? enc.config.equipReqs : [];
                const detalhe = reqs.map((r, i) => `${_npcReqNome(r, ctx)}=${fmt(res.counts?.[i] ?? 0)}`).join(', ');
                texto = `🔗 ${nomePrefix}🎒 [${detalhe || 'sem vínculos'}] (Σ ${fmt(res.valorEquacao)}) → "${res.valorSaida}"`;
            } else if (res.modo === 'classe') {
                const tem = (ctx.classes || []).join(', ') || 'sem classe';
                texto = `🔗 ${nomePrefix}⚔️ [${tem}] → "${res.valorSaida}"`;
            } else {
                texto = `🔗 ${nomePrefix}${fmt(res.valorEquacao)} → "${res.valorSaida}"`;
            }
            infos.push({ fonte: enc.fonte, texto, icone: enc.icone || '🔗' });

            // Mecânicas acionadas pela faixa que casou: cadeia resolvida
            // recursivamente, cada mecânica em sua própria linha, abaixo
            if (res.condicaoIndex >= 0) {
                const cond = (Array.isArray(enc.config?.condicoes) ? enc.config.condicoes : [])[res.condicaoIndex];
                for (const linha of _expandTriggered(cond?.efeitoMecanicaIds, sys, ctx, 1, new Set(enc.id ? [enc.id] : []))) {
                    infos.push({ fonte: enc.fonte, texto: linha, icone: '\u00A0' });
                }
            }
        } catch (e) {
            avisos.add(`Erro ao avaliar condicional encadeada "${enc.nome || '?'}" (${enc.fonte}).`);
        }
    }

    return { attrs, derived, porItem, infos, avisos: [...avisos] };
}

export { ATTR_SIGLAS };
