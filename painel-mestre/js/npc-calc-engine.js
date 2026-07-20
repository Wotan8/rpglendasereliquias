// =============================================
// NPC CALC ENGINE — Motor de cálculo PURO para a Ficha de NPC v2.
// Interpreta o mesmo formato de mecânicas do Painel de Criador
// (tipos: modificar, limitar, narrativo, conceder, condicional),
// mas sem depender do DOM nem do `state` global da ficha v1.7.
//
// Entrada:  npcData (schema v2) + sys (de ensureNpcSystemData)
// Saída:    { attrs, derived, infos, avisos }
// =============================================

const ATTR_SIGLAS = ['INT', 'RAC', 'PRS', 'FOR', 'DES', 'VIG', 'PRE', 'MAN', 'AUT'];

const ATTR_NOMES = {
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

            // Efeitos não-automáticos viram informação para o mestre
            if (mech.tipo === 'narrativo' || mech.tipo === 'conceder' || mech.tipo === 'condicional'
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
    return { ops, limites, infos };
}

/* ===== Aplicação de operações sobre um valor ===== */

function applyOpsToValue(target, baseValue, ops, limites, ctx, fontes) {
    let value = baseValue;
    const mine = ops.filter(o => o.target === target);

    // 1) SET (=) sobrescreve a base
    for (const o of mine) {
        if (o.op === '=') {
            value = resolveCalcValue(o.calc, ctx);
            fontes.push({ fonte: o.fonte, texto: `= ${fmt(value)}` });
        }
    }
    // 2) Somas e subtrações
    for (const o of mine) {
        const v = (o.op === '+' || o.op === '-') ? resolveCalcValue(o.calc, ctx) : null;
        if (o.op === '+') { value += v; fontes.push({ fonte: o.fonte, texto: `+${fmt(v)}` }); }
        else if (o.op === '-') { value -= v; fontes.push({ fonte: o.fonte, texto: `-${fmt(v)}` }); }
    }
    // 3) Multiplicações e divisões
    for (const o of mine) {
        if (o.op === '×' || o.op === '*') { const v = resolveCalcValue(o.calc, ctx); value *= v; fontes.push({ fonte: o.fonte, texto: `×${fmt(v)}` }); }
        else if (o.op === '÷' || o.op === '/') { const v = resolveCalcValue(o.calc, ctx); if (v !== 0) value /= v; fontes.push({ fonte: o.fonte, texto: `÷${fmt(v)}` }); }
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

function fmt(v) { return Number.isInteger(v) ? v : parseFloat(Number(v).toFixed(1)); }

/* ===== FUNÇÃO PRINCIPAL ===== */

/**
 * Calcula atributos efetivos e valores derivados de um NPC (schema v2).
 *
 * @returns {{
 *   attrs:   { [SIGLA]: { base, bonus, final, fontes[] } },
 *   derived: { [key]: { key, nome, icone, isVital, auto, override, final, fontes[] } },
 *   infos:   [{ fonte, texto, icone }],
 *   avisos:  string[]
 * }}
 */
export function calcularNpc(npc, sys) {
    const avisos = new Set();
    const targetMap = buildTargetMap(sys);
    const nivel = parseInt(npc.nivel) || 1;

    const { ops, limites, infos } = gatherOperations(npc, sys, targetMap, avisos);

    // --- Contexto compartilhado pelas equações ---
    const ctx = { nivel, targetMap, attrsFinais: {}, derivedFinais: {}, skillLevels: {}, avisos };
    
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
    const allOps = [...intrinsecas, ...ops];

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

    return { attrs, derived, infos, avisos: [...avisos] };
}

export { ATTR_SIGLAS };
