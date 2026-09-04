// =============================================
// PODER DO NPC — "quanto EXP custaria montar esta ficha do zero"
//
// Poder = EXP Total: a somatória do custo em EXP de TUDO que o NPC tem —
// atributos, perícias, peculiaridades e itens de Módulo de Classe. É o número
// que permite comparar duas fichas sem abrir as duas: um NPC de Poder 400 vale
// o dobro de um de Poder 200, venha o valor de atributo, de perícia ou de
// peculiaridade.
//
// As fórmulas são as MESMAS da ficha de personagem (ficha-v1.7_1/js/exp-upgrade.js
// e race-peculiarities.js). Se o custo mudar lá, muda aqui.
// =============================================

import { poderDeItem, custoDeDom } from '../../shared/poder.js?v=2';

/** Custo do degrau `nivel` (não acumulado). Atributo: 5×N. Perícia: custoEvolucao×N. */
function custoDoDegrau(nivel, porNivel) {
    return nivel * porNivel;
}

/** Custo acumulado de 0 até `nivel`: porNivel × (1+2+...+N). */
function custoAcumulado(nivel, porNivel) {
    const n = Math.max(0, Math.floor(Number(nivel) || 0));
    let total = 0;
    for (let i = 1; i <= n; i++) total += custoDoDegrau(i, porNivel);
    return total;
}

/** Custo em EXP de uma peculiaridade até o nível `nivel` — a conta mora em shared/poder.js (custoDeDom). */
function custoPeculiaridade(reg, nivel, sys) {
    return custoDeDom(reg, nivel, sys.mechsById || {});
}

/** Custo de um item de Módulo de Classe: o do pré-cadastro, se ele tiver o seu. */
function custoItemDeModulo(def, item) {
    const predefs = def.itensPredefinidos || [];
    const predef = predefs.find(p =>
        (item._predefId && p.id === item._predefId) ||
        (item._predefNome && p.nome === item._predefNome));
    if (predef && predef.custoExpProprio !== null && predef.custoExpProprio !== undefined && predef.custoExpProprio !== '') {
        return Number(predef.custoExpProprio) || 0;
    }
    return Number(def.custoExpPorItem) || 0;
}

/**
 * Poder do NPC = EXP Total da ficha.
 * @param {object} npc  NPC normalizado (schema v2)
 * @param {object} sys  registros de ensureNpcSystemData()
 * @param {object} opts { attrSiglas, resolveModulo }
 * @returns {{ total:number, partes:Array }}
 */
export function calcularPoderNpc(npc, sys, opts = {}) {
    const partes = [];
    if (!npc || !sys) return { total: 0, partes };

    const attrSiglas = opts.attrSiglas || ['INT', 'RAC', 'PRS', 'FOR', 'DES', 'VIG', 'PRE', 'MAN', 'AUT'];
    const resolveModulo = opts.resolveModulo || (v => v?.snapshot || null);

    /* --- Atributos: 5 EXP × nível, degrau a degrau --- */
    {
        const itens = [];
        let exp = 0;
        for (const sigla of attrSiglas) {
            const nivel = Math.max(0, Math.floor(Number(npc.atributos?.[sigla]) || 0));
            if (!nivel) continue;
            const c = custoAcumulado(nivel, 5);
            exp += c;
            itens.push({ nome: sigla, nivel, exp: c });
        }
        partes.push({ chave: 'atributos', icone: '💪', label: 'Atributos', exp, itens });
    }

    /* --- Perícias estruturadas: custoEvolucao (padrão 4) × nível --- */
    {
        const porId = {};
        (sys.skills || []).forEach(s => { porId[s.id] = s; });
        const itens = [];
        let exp = 0;
        for (const p of (npc.periciasEstruturadas || [])) {
            const nivel = Math.max(0, Math.floor(Number(p.nivel) || 0));
            if (!nivel) continue;
            const reg = porId[p.refId];
            const c = custoAcumulado(nivel, Number(reg?.custoEvolucao) || 4);
            exp += c;
            itens.push({ nome: reg?.nome || p.refId || 'Perícia', nivel, exp: c });
        }
        partes.push({ chave: 'pericias', icone: '🎯', label: 'Perícias', exp, itens });
    }

    /* --- Peculiaridades (inclusive as herdadas de raça, classe e tribo) --- */
    {
        const itens = [];
        let exp = 0;
        for (const p of (npc.peculiaridades || [])) {
            const reg = p.refId ? sys.pecsById?.[p.refId] : null;
            if (!reg) continue; // personalizada não tem custo cadastrado
            const nivel = Math.max(1, Math.floor(Number(p.nivel) || 1));
            const c = custoPeculiaridade(reg, nivel, sys);
            if (!c) continue;
            exp += c;
            itens.push({ nome: reg.nome || 'Peculiaridade', nivel, exp: c });
        }
        partes.push({ chave: 'peculiaridades', icone: '🧬', label: 'Peculiaridades', exp, itens });
    }

    /* --- Itens de Módulo de Classe (magias, focos, talentos...) --- */
    {
        const itens = [];
        let exp = 0;
        for (const vinc of (npc.modulosClasse || [])) {
            const def = resolveModulo(vinc);
            if (!def) continue;
            let expMod = 0;
            for (const item of (vinc.itens || [])) expMod += custoItemDeModulo(def, item);
            if (!expMod) continue;
            exp += expMod;
            itens.push({ nome: def.titulo || 'Módulo', nivel: (vinc.itens || []).length, exp: expMod });
        }
        partes.push({ chave: 'modulos', icone: '🧩', label: 'Módulos de Classe', exp, itens });
    }

    /* --- Itens (Livro, p. 12): (Qualidade + Afiação) × 5, +10 por Encantamento, +25 por Aura — quando o chamador traz o inventário --- */
    if (Array.isArray(opts.itens) && opts.itens.length) {
        const itens = [];
        let exp = 0;
        for (const it of opts.itens) {
            const c = poderDeItem(it, opts.regras || null);
            if (!c) continue;
            exp += c; itens.push({ nome: it.nome || 'Item', nivel: Number(it.qualidade) || 0, exp: c });
        }
        if (exp) partes.push({ chave: 'itens', icone: '🗡️', label: 'Itens', exp, itens });
    }

    const total = partes.reduce((s, p) => s + p.exp, 0);
    return { total, partes };
}

/** Texto do title= do selo: a conta aberta, uma linha por frente. */
export function resumoPoderNpc(poder) {
    const linhas = ['⚡ Poder = EXP Total — o que custaria montar esta ficha do zero', ''];
    for (const p of poder.partes) {
        linhas.push(`${p.icone} ${p.label}: ${p.exp} EXP`);
        for (const i of p.itens.slice(0, 12)) {
            linhas.push(`   · ${i.nome} ${i.nivel ? `(${i.nivel})` : ''} — ${i.exp}`);
        }
        if (p.itens.length > 12) linhas.push(`   · … +${p.itens.length - 12}`);
    }
    linhas.push('', `= ${poder.total} EXP`);
    return linhas.join('\n');
}
