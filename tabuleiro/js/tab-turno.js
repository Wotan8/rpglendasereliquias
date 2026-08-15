// =============================================
// TABULEIRO — ⚔️ Painel do Turno (combate mecânico, Livro §6.2)
// O turno tem 1 Ação Padrão + 1 Ação de Movimento (a Livre é incidental).
// O painel aparece para quem CONTROLA o token da vez — o dono do personagem,
// ou o mestre (modo secreto) para NPC/custom — e só com a cena INICIADA.
//
// Cascata: Ação Padrão → golpes da ficha / skills · Movimento → deslocamentos
// da ficha (arrasto limitado que já existe) · Livre/Completa → só quando o
// personagem tem skill com esse custo · Guardar · Encerrar.
//
// MIRA (T.mira): preview 100% local (0 writes) — o write só sai na confirmação
// (1 no chat + 1 no doc da cena pelo gasto da ação).
// Alcances contam a partir da BORDA do token (tab-mira-calc).
// =============================================
import { setDoc } from '../../painel-mestre/js/firebase-config.js';
import { T, esc, toast, markDirty, gridSize, upcEm, unidadeEm, valorComponente, selecionar, deslocamentosDoToken, alcanceDeVisaoDoToken, efeitoCondDoToken } from './tab-state.js';
import { refCombate } from './tab-main.js';
import { derivedDoToken } from './tab-render.js';
import { abrirConflito } from './tab-conflito.js';
import {
    cenaAtiva, comCenaAtivaPatch, participanteDaVez, faccaoDoParticipante,
    acoesNovas, podeGastar, gastarAcao, alvoValido, alcanceGolpe,
    efeitoDasCondicoes, porqueCondicao,
    guardadoValido, indiceNaOrdem, recursoInsuficiente, RECURSO_NOME, custoDaMecanica, custoVital,
} from '../../shared/combate-cenas.js';
import { shapeDaMira, alvoAoAlcance, fracaoCoberta, COBERTURA_MINIMA_CONJURADOR } from './tab-mira-calc.js';
import { retornoDoTurno } from '../../shared/retorno-recurso.js';
import { melhorDisparo } from '../../shared/alcance-disparo.js';
import { golpesDe, golpesCacheados, escolherGolpe, metaDoGolpe, alcanceDoGolpe, limparCacheGolpes, formasDeConjurar, projeteisPara, escolherProjetil } from './tab-golpes.js';
import { gastarUm } from '../../shared/projeteis.js';
import { templateAtingeCirculo } from './tab-templates.js';
import { tokenAtivoDoCombate, participanteDoToken, VITAIS, vdsCombateDaFonte } from './tab-hud.js';
import { carregarCondicoesSistema, aplicarCondicaoEmVarios } from './tab-combat.js';
import { logChat } from './tab-chat.js';

// Abertura do arco do golpe corpo a corpo (graus). Régua de mesa da UI —
// o alcance vem da arma + Tamanho; o arco só diz o quão "largo" é o balanço.
const ARCO_GOLPE_GRAUS = 90;

let el = null;
let sub = null;            // submenu aberto: 'padrao'|'movimento'|'livre'|'completa'|null
let golpesCache = null;    // { chave: 'tipo:id', linhas } — 1 query por token/vez
let vezAnterior = null;    // pid da última vez renderizada — virou, limpa submenu/mira

export function initTurno() {
    el = document.createElement('div');
    el.id = 'tbTurno';
    el.className = 'tb-turno';
    document.body.appendChild(el);
    window._renderTurno = render;
    window._miraClique = miraClique;
    window._miraMove = miraMove;
    window._miraCancelar = cancelarMira;
    window._turnoGastouMovimento = gastouMovimento;
    render();
}

// ---------- quem controla a vez ----------
const cena = () => cenaAtiva(T.combate);
function controlaVez(p) {
    if (!p) return false;
    if (T.isMaster && T.mode === 'secret') return true;   // mestre age por todos (inclusive jogador ausente)
    if (p.characterId) return T.chars.find(c => c.id === p.characterId)?.ownerUid === T.user?.uid;
    return false;   // NPC/custom são do mestre
}
// NPC: o doc INTEIRO (ver tab-combat) — recorte fura o cache dos VDs e o motor
// de cálculo precisa de raça/classe/peculiaridades para os finais.
const fonteDoParticipante = (p) => {
    if (p?.characterId) return T.chars.find(c => c.id === p.characterId) || null;
    if (p?.npcId) return T.npcs.find(x => x.id === p.npcId) || null;
    return null;
};

/** Vitais ATUAIS do participante ({ vit, ener, san }) — para checar custo de skill. */
function recursosDe(p) {
    if (p?.characterId) {
        const v = VITAIS.get(p.characterId);
        return v ? { vit: v.hp, ener: v.ener, san: v.san, vitMax: v.hpMax, enerMax: v.enerMax, sanMax: v.sanMax } : null;
    }
    if (p?.npcId) {
        const vd = T.npcs.find(x => x.id === p.npcId)?.valoresDer || {};
        const at = vd.atual || {};
        return { vit: at.VIT ?? vd.VIT, ener: at.ENER ?? vd.ENER, san: at.SAN ?? vd.SAN,
                 vitMax: vd.VIT, enerMax: vd.ENER, sanMax: vd.SAN };
    }
    return { vit: p?.hpCurrent, ener: p?.enerCurrent, san: p?.sanCurrent };
}

// ---------- recursos: Status Vitais E Valores Derivados de classe ----------
const _norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/**
 * Quanto o participante TEM do recurso `alvo` da mecânica de custo.
 * O alvo é o NOME do cadastro: "Energia Atual" (vital) ou "Graça de Palla"
 * (VD com campo Atual — recurso de classe). null = desconhecido (não bloqueia).
 * @returns { tem, nome } ou null
 */
function temDoRecurso(p, alvo) {
    const a = _norm(alvo);
    const vitais = recursosDe(p) || {};
    // `max` só interessa a quem DEVOLVE recurso (retorno de fim de turno); quem
    // gasta nunca encosta nele.
    if (/^(energia|ener)/.test(a)) return { tem: vitais.ener ?? null, max: vitais.enerMax ?? null, nome: 'Energia' };
    if (/^(vitalidade|vit)/.test(a)) return { tem: vitais.vit ?? null, max: vitais.vitMax ?? null, nome: 'Vitalidade' };
    if (/^(sanidade|san)/.test(a)) return { tem: vitais.san ?? null, max: vitais.sanMax ?? null, nome: 'Sanidade' };
    // VD (recurso de classe): o atual manda; sem atual, o máximo
    const dv = vdsCombateDaFonte(fonteDoParticipante(p)).find(d => _norm(d.nome) === a);
    if (!dv) return null;
    return { tem: dv.atual ?? dv.valor, max: dv.valor ?? null, nome: dv.nome };
}

/** Falta recurso para ESTA forma de pagar? { nome, tem, qtd } ou null. */
function faltaPara(p, custo) {
    const r = temDoRecurso(p, custo.alvo);
    if (!r || r.tem == null) return null;   // desconhecido não bloqueia
    return r.tem < custo.qtd ? { nome: r.nome, tem: r.tem, qtd: custo.qtd } : null;
}

/** Botão de skill: custo sempre visível; sem recurso = desabilitado com o motivo. */
function skillBtnHtml(s, custoAcao, i, recursos, p) {
    const custoTxt = s.custo ? ` <i>(${esc(String(s.custo))})</i>` : '';
    // Custos declarados por mecânica: basta UMA forma pagável para liberar
    if (s.custos?.length) {
        const faltas = s.custos.map(c => faltaPara(p, c));
        const pagaveis = s.custos.filter((c, k) => !faltas[k]);
        if (!pagaveis.length) {
            const f = faltas.find(Boolean);
            return `<button class="tb-btn tb-btn-small tb-turno-sem-recurso" disabled
                title="Custo: ${esc(String(s.custo))} — ${esc(f.nome)} atual ${f.tem}, precisa de ${f.qtd}">
                ✨ ${esc(s.nome)}${custoTxt} <b>Não tem ${esc(f.nome)} o suficiente</b></button>`;
        }
        const dica = s.custos.length > 1 ? ` — ${pagaveis.length} forma(s) de pagar` : '';
        return `<button class="tb-btn tb-btn-small" onclick="tbTurnoSkill('${custoAcao}',${i})" title="${esc(s.efeito)}${esc(dica)}">✨ ${esc(s.nome)}${custoTxt}${s.custos.length > 1 ? ' <b class="tb-turno-multi">⇄</b>' : ''}</button>`;
    }
    // sem mecânica: custo em texto ("2 ENER") contra os vitais
    const falta = recursoInsuficiente(s.custo, recursos);
    if (falta) {
        return `<button class="tb-btn tb-btn-small tb-turno-sem-recurso" disabled
            title="Custo: ${esc(String(s.custo))} — ${RECURSO_NOME[falta.recurso]} atual ${falta.tem}, precisa de ${falta.qtd}">
            ✨ ${esc(s.nome)}${custoTxt} <b>Não tem ${RECURSO_NOME[falta.recurso]} o suficiente</b></button>`;
    }
    return `<button class="tb-btn tb-btn-small" onclick="tbTurnoSkill('${custoAcao}',${i})" title="${esc(s.efeito)}">✨ ${esc(s.nome)}${custoTxt}</button>`;
}

// ---------- skills do participante (classModuleData / modulosClasse) ----------
// A instância na ficha guarda `_predefId`; a MIRA e o custo de ação vivem no
// item pré-definido do REGISTRO (system/data/classModules) — cadastrados no
// Painel do Criador. Skill sem cadastro cai no formulário manual da hora.
const S_NOME = (it) => it._predefNome || it.nome || it.Nome || 'Habilidade';
const S_EFEITO = (it) => it.efeito || it.Efeito || it.descricao || it.Descricao || '';
// O campo de custo vem do SCHEMA do módulo (key livre): pega a primeira chave
// com "custo" que não seja meta (custoAcao/custoExp/custoEquip/custoCriacao).
const S_CUSTO = (it) => {
    if (it?.custo != null && it.custo !== '') return it.custo;
    if (it?.Custo != null && it.Custo !== '') return it.Custo;
    for (const [k, v] of Object.entries(it || {})) {
        if (/custo/i.test(k) && !/acao|exp|equip|criacao|remocao/i.test(k) && v != null && v !== '') return v;
    }
    return '';
};

/** "Ação Padrão"/"Ação Livre"/... (rótulo do cadastro) → custo de ação (§6.2). */
function acaoDoRotulo(rotulo) {
    const r = String(rotulo || '').toLowerCase();
    if (/livre/.test(r)) return 'livre';
    if (/movimento/.test(r)) return 'movimento';
    if (/completa|inteira|turno inteiro/.test(r)) return 'completa';
    return 'padrao';
}

/**
 * MIRA no formato da Régua v2 — os pré-definidos auditados já carregam
 * formaArea/tamanhoArea/alcance/alvosMax/anguloCone/faccao/condicoesAplicadas.
 * Converte para o formato do runtime; null quando o predef não tem nada disso.
 * "onda" = área a partir do próprio conjurador (círculo da borda do token).
 */
function miraDaReguaV2(pd) {
    if (!pd) return null;
    const temArea = !!pd.formaArea && Number(pd.tamanhoArea) > 0;
    const temAlvos = Number(pd.alvosMax) > 0;
    if (!temArea && !temAlvos) return null;
    const afeta = pd.faccao === 'inimigo' ? 'inimigos' : pd.faccao === 'aliado' ? 'aliados' : 'todos';
    const cond = (pd.condicoesAplicadas || [])[0] || null;
    const base = {
        afeta,
        condicaoNome: cond?.condicao || null,
        condicaoRodadas: Number(cond?.rodadas) || 0,
        condicaoMaxAlvos: Number(cond?.alvos) || 0,   // 0 = todos os atingidos
        // 🚪 O PORTÃO é o que torna a habilidade contestável (§6.1): Chance ou
        // teste de resistência. Sem portão e sem dano não há o que rolar — o
        // efeito simplesmente acontece, e abrir janela de conflito seria pedir
        // um Acerto que a habilidade nunca teve.
        condicaoPortao: cond?.portao || null,
    };
    if (temArea) {
        const forma = /cone/i.test(pd.formaArea) ? 'cone' : /linha/i.test(pd.formaArea) ? 'linha' : 'circulo';
        return {
            ...base, tipo: 'geometria', forma,
            origem: (forma === 'circulo' && Number(pd.alcance) > 0) ? 'livre' : 'token',
            alcanceM: Number(pd.alcance) || 0,
            raioM: Number(pd.tamanhoArea) || 0,
            comprimentoM: Number(pd.tamanhoArea) || 0,
            larguraM: Math.max(1, (Number(pd.tamanhoArea) || 0) / 3),
            angGraus: Number(pd.anguloCone) || 60,
            maxAlvos: 99,
        };
    }
    return {
        ...base, tipo: 'alvos',
        alcanceM: Number(pd.alcance) || Number(pd.tamanhoArea) || 0,
        maxAlvos: Number(pd.alvosMax) || 1,
    };
}

let skillsCache = null;   // { chave: 'tipo:id', lista } — resolvido 1x por vez/turno

function itensBrutos(p) {
    const out = [];
    if (p?.characterId) {
        const ch = T.chars.find(c => c.id === p.characterId);
        for (const its of Object.values(ch?.classModuleData || {})) {
            if (Array.isArray(its)) for (const it of its) out.push(it);
        }
    } else if (p?.npcId) {
        const n = T.npcs.find(x => x.id === p.npcId);
        for (const vinc of n?.modulosClasse || []) {
            for (const it of vinc?.itens || []) out.push(it);
        }
    }
    return out;
}

function skillsDe(p) {
    const chave = p?.npcId ? 'npc:' + p.npcId : p?.characterId ? 'char:' + p.characterId : null;
    if (!chave) return [];
    if (skillsCache?.chave === chave) return skillsCache.lista || [];
    carregarSkills(chave, p);
    return [];
}

async function carregarSkills(chave, p) {
    skillsCache = { chave, lista: [] };
    // índice global de pré-definidos (o id `pdi_...` é único entre módulos).
    // Se o registro falhar, as skills da FICHA continuam listadas — só ficam
    // sem a mira cadastrada (caem no fluxo de "mira não cadastrada").
    const normNome = (s2) => String(s2 || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const predefPorId = new Map(), predefPorNome = new Map();
    let mechsById = {};
    let sysDVs = [];
    try {
        const m = await import('./tab-ficha-win.js?v=11');
        const sys = await m.registroSistema();
        mechsById = sys.mechsById || {};
        sysDVs = sys.derivedValues || [];
        for (const mod of Object.values(sys.classModulesById || {})) {
            for (const pd of mod.itensPredefinidos || []) {
                const ref = { pd, schema: mod.schema || [], retorno: cfgRetorno(mod) };
                predefPorId.set(pd.id, ref);
                predefPorNome.set(normNome(pd.nome), ref);
            }
        }
    } catch (e) { console.warn('registro do sistema p/ skills do turno', e); }

    // 💰 Custos REAIS: cada campo `select_botao` do schema aponta uma mecânica
    // de custo ("Pagar Energia" → -1 ENER · "Pagar Graça" → -1 Graça). Uma skill
    // com dois desses tem DUAS formas de pagar, e quem usa escolhe qual.
    const custosDaSkill = (it, schema, pd) => {
        const out = [];
        for (const f of schema || []) {
            if (f.tipo !== 'select_botao') continue;
            const mechId = it?.[f.key] || pd?.valores?.[f.key];
            if (!mechId) continue;
            const c = custoDaMecanica(mechsById[mechId]);
            if (c && !out.some(x => x.alvo === c.alvo && x.qtd === c.qtd)) out.push({ ...c, label: f.label || '' });
        }
        return out;
    };

    // 🔁 Retorno de recurso: regra do MÓDULO, não da magia (ver
    // shared/retorno-recurso.js). Só viaja se estiver ligada no cadastro.
    const cfgRetorno = mod => (String(mod?.retornoRecurso || '').trim() ? {
        retornoRecurso: String(mod.retornoRecurso).trim(),
        retornoBonusParado: Number(mod.retornoBonusParado) || 0,
        retornoExigeSucesso: !!mod.retornoExigeSucesso,
        retornoZeraSeFalhar: !!mod.retornoZeraSeFalhar,
    } : null);

    // 🪄 Formas de conjurar da skill: as colunas do módulo marcadas com
    // "é forma de conjurar" no Criador. Cada uma aponta o VD que dá o Acerto —
    // é isso que faz o Bardo escolher entre Vocal e Sopro em vez de entre o
    // Estilete e a perna. Coluna vazia no item = aquela forma não serve para
    // ESTA magia (é literalmente o "[V, S]" do nome, em dado).
    const vdsPorId = new Map((sysDVs || []).map(dv => [dv.id, dv]));
    const veiculosDaSkill = (it, schema, pd) => {
        const out = [];
        for (const f of schema || []) {
            if (f.tipo !== 'select_vd' || !f.ehVeiculo) continue;
            const vdId = it?.[f.key] || pd?.valores?.[f.key];
            if (!vdId) continue;
            const dv = vdsPorId.get(vdId);
            out.push({ vdId, label: f.label || dv?.nome || '', vdNome: dv?.nome || f.label || '' });
        }
        return out;
    };

    // Custo pelo SCHEMA: o campo cujo LABEL fala em custo (a key é numérica nos
    // módulos — "3" pode ser "Redutor", que NÃO é custo). Sem label de custo,
    // vale o custo auditado pela Régua v2 (regua.custo, em ENER).
    const custoDoSchema = (it, schema) => {
        for (const f of schema || []) {
            if (!/custo/i.test(f.label || '')) continue;
            const v = it?.[f.key];
            if (v != null && v !== '' && v !== '0') return v;
        }
        return '';
    };
    const lista = itensBrutos(p).map(it => {
        // item de NPC nem sempre carrega _predefId — o nome resolve o registro
        const ref = (it._predefId && predefPorId.get(it._predefId)) || predefPorNome.get(normNome(S_NOME(it))) || null;
        // Sem o predefinido não há mira, e a habilidade cai no diálogo manual
        // "não tem mira cadastrada" — que parece bug de mira e é, na verdade,
        // o REGISTRO não ter chegado. Deixa o motivo no console.
        if (!ref) {
            console.warn(`⚠️ Skill "${S_NOME(it)}": predefinido não encontrado`,
                { _predefId: it._predefId || null, predefsIndexados: predefPorId.size });
        }
        const pd = ref?.pd || null;
        const custos = custosDaSkill(it, ref?.schema, pd);
        // texto: os custos declarados por mecânica mandam; senão campo/Régua v2
        const custo = custos.length ? custos.map(c => c.rotulo).join(' ou ')
            : (custoDoSchema(it, ref?.schema) || S_CUSTO(it) || S_CUSTO(pd?.valores || {})
               || (pd?.regua?.custo > 0 ? `${pd.regua.custo} ENER` : ''));
        return {
            nome: S_NOME(it),
            efeito: S_EFEITO(it) || S_EFEITO(pd?.valores || {}) || pd?.descricao || '',
            custo, custos,
            veiculos: veiculosDaSkill(it, ref?.schema, pd),
            retorno: ref?.retorno || null,
            mira: it.mira || pd?.mira || miraDaReguaV2(pd),
            acao: it.custoAcao || pd?.custoAcao || pd?.mira?.custoAcao || acaoDoRotulo(it.acao || pd?.valores?.acao),   // §6.2
        };
    });
    skillsCache = { chave, lista };
    render();
}

// ---------- escrita (gasto de ação) ----------
async function salvarCena(patch) {
    try {
        await setDoc(refCombate(), { ...comCenaAtivaPatch(T.combate, patch), atualizadoEm: Date.now() }, { merge: true });
    } catch (e) { console.error(e); toast('❌ Erro ao salvar o turno', 'danger'); }
}
async function gastar(custo) {
    if (custo === 'livre') return;   // incidental — não consome
    const novas = gastarAcao(cena().acoesTurno, custo);
    // otimista: o snapshot confirma; o painel não pisca esperando a rede
    T.combate = { ...comCenaAtivaPatch(T.combate, { acoesTurno: novas }) };
    render();
    await salvarCena({ acoesTurno: novas });
}

/**
 * Faixa do que as condições estão fazendo com quem está na vez. Mostra só o que
 * MUDA alguma coisa — sem condição configurada, não ocupa espaço nenhum.
 */
function avisoCondicoes(ef) {
    const itens = [];
    for (const n of ef.niveis) itens.push(`${n.icone} ${esc(n.nome)} <b>nv ${n.nivel}${n.maximo ? '/' + n.maximo : ''}</b>${n.efeito ? ` — ${esc(n.efeito)}` : ''}`);
    if (ef.multDesloc !== 1) itens.push(`🏃 Deslocamento ×${ef.multDesloc} <i>(${esc(porqueCondicao(ef, 'multDesloc'))})</i>`);
    if (ef.deslocBloqueados.length) itens.push(`⛔ Sem ${ef.deslocBloqueados.map(esc).join(', ')}`);
    if (ef.multVisao !== 1) itens.push(`👁️ Visão ×${ef.multVisao} <i>(${esc(porqueCondicao(ef, 'multVisao'))})</i>`);
    if (ef.naoPodeSerAlvo) itens.push(`🛡️ Não pode ser alvo`);
    if (ef.faccaoForcada) itens.push(`🔀 Lutando como <b>${esc(ef.faccaoForcada)}</b>`);
    for (const t of ef.porRodada) itens.push(`🩸 ${esc(t.condicao)}: ${esc(t.valor)} por rodada`);
    for (const t of ef.testes) itens.push(`🎲 ${esc(t.condicao)}: sai com <b>${esc(t.nome)}</b>${t.mod ? ` (${t.mod > 0 ? '+' : ''}${t.mod})` : ''}`);
    if (!itens.length) return '';
    return `<div class="tb-turno-cond">${itens.join(' · ')}</div>`;
}

// ---------- render ----------
// O que está em `.tb-so-largo` some no celular: o painel vira uma faixa de uma
// linha só no rodapé, e "Ação de Movimento" não cabe — "👣 Movimento" cabe e
// diz o mesmo. No desktop o rótulo continua inteiro.
const L = (curto, resto) => `${curto}<span class="tb-so-largo">${resto}</span>`;
const ROTULO_ACAO = {
    padrao:    L('⚡ ', 'Ação ') + 'Padrão',
    movimento: L('👣 ', 'Ação de ') + 'Movimento',
    livre:     L('🕊️ ', 'Ação ') + 'Livre',
    completa:  L('⏳ ', 'Ação ') + 'Completa' + L('', ' (as duas)'),
};

function render() {
    if (!el) return;
    const c = cena();
    const p = c?.iniciado ? participanteDaVez(c) : null;
    if (p && p.id !== vezAnterior) {   // a vez virou: nada do turno anterior sobrevive
        vezAnterior = p.id; sub = null; golpesCache = null; skillsCache = null;
        if (T.mira) { T.mira = null; markDirty(); }
    }
    if (!p || !controlaVez(p) || (T.isMaster && T.mode === 'public')) {
        // 🛡️ Fora da minha vez: se tenho turno GUARDADO válido, o painel vira o
        // botão de agir agora (interromper). Sem interrupção encadeada.
        const guardados = (c?.iniciado && !c.retomar && !(T.isMaster && T.mode === 'public'))
            ? (c.participantes || []).filter(x => guardadoValido(c, x) && controlaVez(x)) : [];
        if (guardados.length) {
            el.classList.add('open');
            el.innerHTML = `<div class="tb-turno-head">🛡️ Turno guardado <span class="tb-turno-hint">vale até o fim desta rodada</span></div>
                <div class="tb-turno-acoes">${guardados.map(g =>
                    `<button class="tb-btn tb-turno-btn tb-btn-primary" onclick="tbTurnoAgirAgora('${g.id}')">⚡ ${esc(g.name || '?')}: agir agora</button>`).join('')}
                </div>`;
            return;
        }
        el.classList.remove('open'); el.innerHTML = '';
        if (T.mira) { T.mira = null; markDirty(); }
        return;
    }
    const acoes = c.acoesTurno || acoesNovas();
    // 💀 Condições da vez: o que elas PROÍBEM some do painel com o motivo à mostra.
    const efCond = efeitoDasCondicoes(p.condicoes || [], T.condicoesSistema);
    const skills = skillsDe(p);
    const temLivre = skills.some(s => s.acao === 'livre');
    const temCompleta = skills.some(s => s.acao === 'completa');
    const semAcoes = !acoes.padrao && !acoes.movimento;

    el.classList.add('open');

    // 🎯 modo mira: o painel vira a barra de confirmação
    if (T.mira) {
        const m = T.mira;
        const status = m.tipo === 'alvos'
            ? `${m.alvos.length}/${m.maxAlvos || 1} alvo(s)`
            : (m.travada ? 'posição marcada' : 'clique no mapa para mirar');
        el.innerHTML = `<div class="tb-turno-head">🎯 ${esc(m.meta?.nome || 'Mira')} <span class="tb-turno-hint">${status}</span></div>
            <div class="tb-turno-acoes">
                <button class="tb-btn tb-btn-success" onclick="tbTurnoConfirmarMira()" ${m.tipo === 'alvos' ? (m.alvos.length ? '' : 'disabled') : (m.travada ? '' : 'disabled')}>✅ Confirmar</button>
                <button class="tb-btn" onclick="_miraCancelar()">✖ Cancelar</button>
            </div>`;
        return;
    }

    const chip = (on, txt) => `<span class="tb-turno-chip ${on ? 'on' : 'off'}">${txt}</span>`;
    let body = '';
    if (sub) body = subMenu(sub, p, skills, acoes);
    else {
        // Ação proibida por condição fica desabilitada COM o nome da condição no
        // title: "por que não consigo mover?" tem que ter resposta na própria tela.
        const btn = (id, rot, habil, titulo) => {
            const trava = porqueCondicao(efCond, 'bloqueia_' + id);
            const ok = habil && !trava;
            const dica = trava ? `Bloqueado por: ${trava}` : (titulo || '');
            return `<button class="tb-btn tb-turno-btn ${trava ? 'tb-turno-travado' : ''}" onclick="tbTurnoSub('${id}')" ${ok ? '' : 'disabled'} title="${esc(dica)}">${trava ? '🚫 ' : ''}${rot}</button>`;
        };
        // 🛡️ Guardar = delay: só faz sentido com o turno INTEIRO (as duas ações)
        // e nunca no meio de uma interrupção (não se encadeia guardado).
        const podeGuardar = acoes.padrao && acoes.movimento && !c.retomar;
        body = `<div class="tb-turno-acoes">
            ${semAcoes ? '' : btn('padrao', ROTULO_ACAO.padrao, acoes.padrao, 'Atacar, usar habilidade, magia ou item')}
            ${semAcoes ? '' : btn('movimento', ROTULO_ACAO.movimento, acoes.movimento, 'Mover pelo deslocamento da ficha')}
            ${temLivre ? btn('livre', ROTULO_ACAO.livre, true, 'Incidental — não consome ação') : ''}
            ${temCompleta && !semAcoes ? btn('completa', ROTULO_ACAO.completa, acoes.padrao && acoes.movimento, 'Habilidades que consomem o turno inteiro') : ''}
            ${podeGuardar ? `<button class="tb-btn tb-turno-btn" onclick="tbTurnoGuardar()" title="Guarda as DUAS ações: você pode interromper e agir a qualquer momento até o fim DESTA rodada — depois perde">🛡️ Guardar<span class="tb-so-largo"> Turno</span></button>` : ''}
            <button class="tb-btn tb-turno-btn ${semAcoes && !conflitoPendente() ? 'tb-btn-primary' : ''}"
                ${conflitoPendente() ? 'disabled' : ''}
                title="${conflitoPendente() ? 'Termine o conflito aberto antes de passar a vez' : 'Passa a vez para o próximo da ordem'}"
                onclick="tbTurnoEncerrar()">⏭️ Encerrar<span class="tb-so-largo"> Turno</span>${conflitoPendente() ? ' <i class="tb-so-largo">(conflito em curso)</i>' : ''}</button>
        </div>`;
    }

    el.innerHTML = `<div class="tb-turno-head">
            ${c.retomar ? '⚡' : '⚔️'} <span class="tb-so-largo">Vez de </span><b class="tb-turno-nome">${esc(p.name || '?')}</b>${c.retomar ? ' <span class="tb-turno-hint">(turno guardado — interrompendo)</span>' : ''} <span class="tb-turno-hint">R${c.rodada || 1}</span>
            <span class="tb-turno-chips">${chip(acoes.padrao && !efCond.bloqueia.padrao, '⚡')}${chip(acoes.movimento && !efCond.bloqueia.movimento, '👣')}</span>
            ${avisoCondicoes(efCond)}
        </div>${body}`;
}

/**
 * Botões de deslocamento da ficha. §6.2: a Ação Padrão também pode ser gasta
 * andando (quem tem pressa troca o golpe por mais distância) — por isso o
 * mesmo bloco aparece nos dois submenus, mudando só qual ação é debitada.
 */
function htmlDeslocs(custoAcao) {
    const tok = tokenAtivoDoCombate();
    const deslocs = tok ? deslocamentosDoToken(tok, T.chars, T.npcs) : [];
    if (!deslocs.length) {
        return custoAcao === 'movimento'
            ? '<span class="tb-muted">Sem deslocamento na ficha — mova pelo arrasto e gaste manualmente:</span>' : '';
    }
    return deslocs.map((d, i) => `<button class="tb-btn tb-btn-small" onclick="tbTurnoMover(${i},'${custoAcao}')"
        title="${custoAcao === 'padrao' ? 'Gasta a Ação PADRÃO para andar' : 'Gasta a Ação de Movimento'}">👣 ${esc(d.tipo)} — ${d.metros} m${custoAcao === 'padrao' ? ' <i>(com a Padrão)</i>' : ''}</button>`).join('');
}

function subMenu(qual, p, skills, acoes) {
    const voltar = `<button class="tb-mini-btn" onclick="tbTurnoSub(null)" title="Voltar">←</button>`;
    if (qual === 'movimento') {
        return `<div class="tb-turno-lista">${voltar}
            ${htmlDeslocs('movimento')}
            <button class="tb-btn tb-btn-small" onclick="tbTurnoGastarAvulso('movimento')" title="Levantar, sacar item, abrir porta...">✅ Outro movimento</button>
        </div>`;
    }
    if (qual === 'padrao') {
        // golpes chegam async (1 query de itens); o cache evita re-pedir no mesmo turno
        const chave = (p.npcId ? 'npc:' + p.npcId : 'char:' + p.characterId);
        const golpes = golpesCache?.chave === chave ? golpesCache.linhas : null;
        if (golpes === null && (p.npcId || p.characterId)) carregarGolpes(chave, p);
        const skillsPadrao = skills.filter(s => s.acao === 'padrao');
        const rec = recursosDe(p);
        return `<div class="tb-turno-lista">${voltar}
            ${golpes === null ? '<span class="tb-muted">⏳ golpes…</span>'
                : golpes.map((g, i) => `<button class="tb-btn tb-btn-small" onclick="tbTurnoGolpe(${i})" title="${esc(g.dano ? 'Dano ' + g.dano : '')}">⚔️ ${esc(g.nome)}${g.dano ? ` <i>💥${esc(g.dano)}</i>` : ''}</button>`).join('')}
            ${skillsPadrao.map((s, i) => skillBtnHtml(s, 'padrao', i, rec, p)).join('')}
            ${htmlDeslocs('padrao')}
            <button class="tb-btn tb-btn-small" onclick="tbTurnoGastarAvulso('padrao')" title="Qualquer outra Ação Padrão (descreva no chat)">✅ Outra ação</button>
        </div>`;
    }
    // livre / completa: só as skills com esse custo
    const lista = skills.filter(s => s.acao === qual);
    const rec = recursosDe(p);
    return `<div class="tb-turno-lista">${voltar}
        ${lista.map((s, i) => skillBtnHtml(s, qual, i, rec, p)).join('')}
    </div>`;
}

async function carregarGolpes(chave, p) {
    golpesCache = { chave, linhas: null };
    golpesCache = { chave, linhas: await golpesDe(p) };   // cache compartilhado (tab-golpes)
    render();
}

// ---------- handlers do painel ----------
window.tbTurnoSub = (qual) => { sub = qual; render(); };

/**
 * ⚔️ Conflito aberto e ainda por resolver? O jogador não passa a vez no meio
 * de uma troca de golpes — a defesa e o dano do alvo ficariam órfãos. Em 'fim'
 * o conflito já está resolvido (só falta fechar a janela) e a vez pode passar.
 * O MESTRE nunca fica preso: ele destrava a mesa quando algo emperra.
 */
function conflitoPendente() {
    if (T.isMaster && T.mode === 'secret') return false;
    const cf = cena()?.conflito;
    return !!cf && cf.fase !== 'fim';
}

window.tbTurnoEncerrar = async () => {
    if (conflitoPendente()) { toast('⚠️ Resolva o conflito aberto antes de encerrar o turno', 'warning'); return; }
    sub = null;
    logChat(`⏭️ ${participanteDaVez(cena())?.name || '?'} encerrou o turno`);
    await window.tbCombTurno(1);
};

/**
 * 🛡️ Guardar = DELAY: guarda as duas ações e passa a vez. O dono pode
 * interromper e agir a qualquer momento até o fim DESTA rodada (⚡ Agir agora);
 * virou a rodada, perdeu — não acumula e ninguém joga dois turnos seguidos.
 */
window.tbTurnoGuardar = async () => {
    sub = null;
    const c = cena();
    const p = participanteDaVez(c);
    if (!p) return;
    const parts = (c.participantes || []).map(x => x.id === p.id ? { ...x, guardadoNaRodada: c.rodada || 1 } : x);
    // otimista: o tbCombTurno logo abaixo monta o write a partir do T.combate —
    // sem isto, a virada sobrescreveria o guardado com a lista velha.
    T.combate = { ...comCenaAtivaPatch(T.combate, { participantes: parts }) };
    logChat(`🛡️ ${p.name || '?'} guardou o turno (pode agir até o fim da rodada)`);
    await window.tbCombTurno(1);
};

/** ⚡ Usa o turno guardado AGORA: interrompe a ordem; ao encerrar, volta. */
window.tbTurnoAgirAgora = async (pid) => {
    const c = cena();
    const p = (c.participantes || []).find(x => x.id === pid);
    if (!p || !guardadoValido(c, p) || c.retomar) return;
    // O guardado só vale uma vez e interrompe a ordem de todo mundo — clique
    // sem querer aqui custa o turno inteiro, então confirma.
    const daVez = participanteDaVez(c);
    if (!confirm(`⚡ ${p.name || 'Este personagem'} vai interromper agora, no meio do turno de ${daVez?.name || '?'}?\n\n`
        + 'O turno guardado é consumido e a ordem volta ao normal quando ele encerrar.')) return;
    const parts = (c.participantes || []).map(x => x.id === pid ? { ...x, guardadoNaRodada: null } : x);
    await salvarCena({
        participantes: parts,
        retomar: { turnoAtual: c.turnoAtual || 0, acoes: c.acoesTurno || acoesNovas() },
        turnoAtual: Math.max(0, indiceNaOrdem(c, pid)),
        acoesTurno: acoesNovas(),
    });
    logChat(`⚡ ${p.name || '?'} interrompe com o turno guardado!`);
};

/** Ação gasta sem mira (descrita pelo jogador): pede o texto, gasta e loga. */
window.tbTurnoGastarAvulso = async (custo) => {
    const p = participanteDaVez(cena());
    const desc = prompt(`O que ${p?.name || 'o personagem'} faz com a ${custo === 'movimento' ? 'Ação de Movimento' : 'Ação Padrão'}?`);
    if (desc === null) return;
    sub = null;
    await gastar(custo);
    logChat(`${custo === 'movimento' ? '👣' : '⚡'} ${p?.name || '?'}: ${desc.trim() || 'ação'}`);
};

/** Mover pelo deslocamento: arma o arrasto limitado que já existe (T.moverDesloc). */
window.tbTurnoMover = (i, custoAcao) => {
    const tok = tokenAtivoDoCombate(); if (!tok) return;
    const d = deslocamentosDoToken(tok, T.chars, T.npcs)[i]; if (!d) return;
    const custo = custoAcao === 'padrao' ? 'padrao' : 'movimento';
    T.moverDesloc = { tokenId: tok.id, tipo: d.tipo, metros: d.metros, doTurno: true, custoAcao: custo };
    selecionar(tok.id);
    sub = null;
    render();
    toast(`👣 ${d.tipo}: arraste o token — até ${d.metros} m. A ${custo === 'padrao' ? 'Ação Padrão' : 'Ação de Movimento'} é gasta ao soltar.`);
    markDirty();
};

/** tab-tools avisa quando o arrasto limitado do turno terminou. */
async function gastouMovimento(tokenId, foiDoTurno, custoAcao) {
    const c = cena();
    if (!c?.iniciado || !foiDoTurno) return;
    const tok = tokenAtivoDoCombate();
    if (!tok || tok.id !== tokenId || !controlaVez(participanteDaVez(c))) return;
    const custo = custoAcao === 'padrao' ? 'padrao' : 'movimento';
    if ((c.acoesTurno || acoesNovas())[custo]) await gastar(custo);
}

// ---------- golpe ----------
/**
 * 🏹 Alcance de uma arma a DISTÂNCIA: 3× o alcance de visão do próprio token.
 * Sempre 3×, sem depender do ambiente — o `dia: true` do cálculo é justamente o
 * multiplicador ×3 já testado, aplicado aqui sobre a base (fixa ou por
 * Percepção), esteja o canvas de dia ou de noite.
 */
function alcanceDeTiro(tok) {
    return alcanceDeVisaoDoToken(tok, derivedDoToken(tok), true);
}

window.tbTurnoGolpe = (i) => {
    const g = golpesCache?.linhas?.[i]; if (!g) return;
    const p = participanteDaVez(cena());
    const tok = tokenAtivoDoCombate();
    if (!tok) { toast('⚠️ O participante da vez não tem token neste canvas', 'warning'); return; }
    const meta = {
        nome: g.nome, efeito: g.dano ? `dano ${g.dano}` : '', custoAcao: 'padrao',
        golpe: metaDoGolpe(g),
    };
    // 🏹 Arma a distância não balança arco nenhum: escolhe o alvo dentro do
    // triplo da visão (o tiro enxerga mais longe do que a mão alcança).
    if (g.distancia) {
        const alcanceM = alcanceDeTiro(tok);
        armarMira({
            tipo: 'alvos', alcanceM, maxAlvos: 1, afeta: 'inimigos',
            meta: { ...meta, detalhe: `alcance ${Math.round(alcanceM * 100) / 100} m (3× a visão do token)` },
        }, tok);
        sub = null;
        return;
    }
    const tamanho = valorComponente('Tamanho', fonteDoParticipante(p)) || 0;
    const alcanceM = alcanceGolpe(g.alcanceM, tamanho);
    armarMira({
        tipo: 'cac', alcanceM, angGraus: ARCO_GOLPE_GRAUS, afeta: 'inimigos',
        meta: { ...meta, detalhe: `alcance ${Math.round(alcanceM * 100) / 100} m (arma ${g.alcanceM || 0} m + 5% do Tamanho${g.alcanceM ? '' : ', mínimo 1 m'})` },
    }, tok);
    sub = null;
};

// ---------- skills ----------
window.tbTurnoSkill = async (custo, i, formaPaga) => {
    const p = participanteDaVez(cena());
    const s = skillsDe(p).filter(x => x.acao === custo)[i];
    if (!s) return;
    // 💰 Custos por mecânica: com mais de uma forma pagável, quem usa escolhe
    if (s.custos?.length && formaPaga == null) {
        const pagaveis = s.custos.map((c, k) => ({ c, k })).filter(({ c }) => !faltaPara(p, c));
        if (!pagaveis.length) {
            const f = s.custos.map(c => faltaPara(p, c)).find(Boolean);
            toast(`⚠️ Não tem ${f.nome} o suficiente (${f.tem}/${f.qtd})`, 'warning'); return;
        }
        if (pagaveis.length > 1) { escolherComoPagar(s, custo, i, pagaveis); return; }
        formaPaga = pagaveis[0].k;
    }
    if (s.custos?.length) {
        const f = faltaPara(p, s.custos[formaPaga]);
        if (f) { toast(`⚠️ Não tem ${f.nome} o suficiente (${f.tem}/${f.qtd})`, 'warning'); return; }
        _custosAPagar = [s.custos[formaPaga]];   // debitado na confirmação da mira
        _retornoCfg = s.retorno;
    } else {
        // re-checa o custo em texto na hora do clique (o HTML pode estar velho)
        const falta = recursoInsuficiente(s.custo, recursosDe(p));
        if (falta) { toast(`⚠️ Não tem ${RECURSO_NOME[falta.recurso]} o suficiente (${falta.tem}/${falta.qtd})`, 'warning'); return; }
        // 💰 Custo só em TEXTO ("2 ENER") também é debitado: era o furo — quem
        // não tinha mecânica de custo cadastrada usava a habilidade de graça.
        _custosAPagar = custosDoTexto(s.custo);
        _retornoCfg = s.retorno;
    }
    const tok = tokenAtivoDoCombate();
    if (!tok) { toast('⚠️ O participante da vez não tem token neste canvas', 'warning'); return; }
    if (s.mira?.tipo) {
        // 🏹 Habilidade que mira "ao alcance do disparo": sem arma de tiro em
        // mãos (ou com o alcance dela não cadastrado) a mira abriria com 0 m e
        // nada seria alvo. Diz o motivo em vez de abrir uma mira morta.
        if (s.mira.alcanceDoDisparo) {
            const d = alcanceDoDisparoDe(p);
            if (!d.metros) {
                toast('⚠️ Sem arma de disparo em mãos (ou o alcance dela não está cadastrado)', 'warning');
                return;
            }
            if (d.limitadoPorFor) {
                toast(`🏹 ${d.arma}: ${d.metros} m — a sua FOR limita o alcance da arma`);
            }
        }
        const cfg = miraDoCadastro(s.mira, s, custo, p);
        // 🗡️ Habilidade que MACHUCA sai de uma arma, de um foco ou do corpo:
        // é de lá que vêm o Acerto (o Alvo da rolagem), o dado de dano e o tipo
        // de golpe. Com mais de um equipado, quem age escolhe.
        const golpe = await escolherGolpeDaAcao(p, s, cfg);
        if (golpe === false) return;   // cancelou o picker: nada foi gasto
        if (golpe) cfg.meta.golpe = metaDoGolpe(golpe);
        // 🏹 Arma que gasta munição: escolhe o maço ANTES de armar a mira. Sem
        // flecha não há tiro, e é melhor descobrir isso agora que depois de
        // gastar a ação.
        const proj = await municaoParaOGolpe(p, golpe);
        if (proj === false) return;
        if (proj) cfg.meta.projetil = proj;
        armarMira(cfg, tok);
        sub = null;
        return;
    }
    // Sem mira cadastrada: os PARÂMETROS são regra — só o mestre os define.
    // O jogador usa a ação assim mesmo (gasta e loga); a resolução fica na mesa.
    if (!(T.isMaster && T.mode === 'secret')) {
        sub = null;
        await gastar(custo);
        await pagarCustos(p);
        logChat(`✨ ${p?.name || '?'} usou ${s.nome}${s.custo ? ` · custo: ${s.custo}` : ''} — sem mira cadastrada, efeitos com o mestre`);
        toast(`✨ ${s.nome} usada — a mira desta habilidade ainda não foi cadastrada; o mestre resolve os alvos`);
        return;
    }
    abrirMiraManual(s, custo, tok);
};

/**
 * 🏹 Escolhe (e reserva) a munição do golpe.
 * @returns maço escolhido · null (arma não gasta munição) · false (aborta)
 */
async function municaoParaOGolpe(p, golpe) {
    if (!golpe || !(golpe.tipoProjetil || []).length) return null;
    const macos = await projeteisPara(p, golpe);
    if (!macos.length) {
        toast(`🏹 Sem munição para ${golpe.nome}: falta ${(golpe.tipoProjetil || []).join(' ou ')}`, 'warning');
        return false;
    }
    const escolhido = await escolherProjetil(`🏹 Qual munição ${esc(p?.name || '')} usa no disparo?`, macos);
    if (!escolhido) return false;
    return escolhido;
}

/**
 * Com o que esta habilidade vai bater? Só pergunta em ação OFENSIVA (a que
 * pode pegar inimigo) — buff em aliado não tem Acerto nem dano de arma.
 * @returns linha do golpe · null (segue sem arma) · false (cancelou)
 */
async function escolherGolpeDaAcao(p, s, cfg) {
    if (cfg.afeta === 'aliados') return null;
    // 🎯 Habilidade SEM PORTÃO não é ataque: ela acontece. Perguntar com o que
    // ela bate faria a ação herdar o dado de dano da arma escolhida — foi o
    // que transformou A Presa (que só marca) numa janela de conflito pedindo
    // Acerto. Habilidade sem condição cadastrada tem portão nulo e continua
    // perguntando, que é o caso do ataque comum com arma.
    if (cfg.meta?.portao === 'nenhum') return null;
    const linhas = await golpesDe(p);

    // 🪄 Magia declara COM O QUE se conjura (colunas marcadas no módulo da
    // classe). Quando declara, a pergunta é essa e só essa: oferecer o Estilete
    // e a perna para um Grito Dissonante [V, S] era o bug — nenhum dos dois
    // conjura, e o Acerto deles não é o da magia.
    if (s.veiculos?.length) {
        const formas = await formasDeConjurar(p, s.veiculos, linhas);
        const livres = formas.filter(f => !f.indisponivel);
        if (!livres.length) {
            // Todas bloqueadas: mostra a lista explicando o porquê de cada uma,
            // em vez de um "não pode" mudo.
            await escolherGolpe(
                `🪄 ${esc(p?.name || 'O personagem')} não tem como conjurar “${esc(s.nome)}” agora`, formas,
                'Nenhuma das formas desta magia está disponível — veja o motivo em cada uma.');
            return false;
        }
        const escolhido = await escolherGolpe(
            `🪄 Como ${esc(p?.name || 'o personagem')} conjura “${esc(s.nome)}”?`, formas,
            'O Acerto da rolagem sai da forma escolhida.');
        return escolhido || (livres.length > 1 ? false : null);
    }

    // arma a distância não serve para uma habilidade de arco/cone que nasce no
    // corpo; para mira de alvos vale tudo que estiver equipado
    const uteis = cfg.tipo === 'cac' ? linhas.filter(l => !l.distancia) : linhas;
    if (!uteis.length) return null;
    const escolhido = await escolherGolpe(
        `🗡️ Com o que ${esc(p?.name || 'o personagem')} usa “${esc(s.nome)}”?`, uteis,
        'O Acerto, o dado de dano e o tipo de golpe da janela de conflito saem daqui.');
    return escolhido || (uteis.length > 1 ? false : null);
}

// Custos da skill em uso, debitados na confirmação da mira.
let _custosAPagar = [];
// Config de retorno da skill em uso — anda junto com o custo até o débito.
let _retornoCfg = null;

/** Custo em TEXTO ("2 ENER + 1 SAN") no mesmo formato dos custos por mecânica. */
function custosDoTexto(txt) {
    return custoVital(txt).map(c => ({
        alvo: RECURSO_NOME[c.recurso], qtd: c.qtd, rotulo: `−${c.qtd} ${RECURSO_NOME[c.recurso]}`,
    }));
}

/** Skill com mais de uma forma de pagar: quem usa escolhe qual recurso gasta. */
function escolherComoPagar(s, custoAcao, i, pagaveis) {
    const p = participanteDaVez(cena());
    window._tbAbrirModal(`💰 Como pagar “${esc(s.nome)}”?`, `
        <div class="tb-muted" style="font-size:.8rem;margin-bottom:10px">Esta habilidade aceita mais de uma forma de pagamento — escolha qual recurso gastar:</div>
        ${pagaveis.map(({ c, k }) => {
            const r = temDoRecurso(p, c.alvo);
            return `<button class="tb-btn tb-btn-small" style="display:block;width:100%;margin-bottom:6px;text-align:left"
                onclick="tbFecharModal();tbTurnoSkill('${custoAcao}',${i},${k})">
                ${esc(c.label || 'Pagar')} — <b>${esc(c.rotulo)}</b>${r?.tem != null ? ` <span class="tb-muted">(tem ${r.tem} de ${esc(r.nome)})</span>` : ''}</button>`;
        }).join('')}
    `);
}

/**
 * Debita o recurso escolhido. Vital vai para o doc da ficha (mesmo caminho do
 * card de combate); VD de classe vai para o campo Atual do VD.
 */
async function pagarCustos(p) {
    const lista = _custosAPagar;
    const cfg = _retornoCfg;
    _custosAPagar = []; _retornoCfg = null;
    for (const c of lista) await pagarCusto(p, c);
    await acumularRetorno(p, cfg, lista);
}

/**
 * 🔁 Guarda no participante quanto saiu DO recurso que volta no fim do turno.
 * Fica no doc da cena (e não numa variável) porque quem fecha o turno pode ser
 * outro cliente — o mestre virando a ordem enquanto o jogador conjurou.
 */
async function acumularRetorno(p, cfg, custosPagos) {
    if (!cfg?.retornoRecurso || !p) return;
    const alvo = _norm(cfg.retornoRecurso);
    const gasto = (custosPagos || [])
        .filter(c => _norm(c.alvo) === alvo)
        .reduce((t, c) => t + (Number(c.qtd) || 0), 0);
    if (!gasto) return;   // conjurou pagando outra moeda: não gera retorno
    const c = cena();
    const parts = (c.participantes || []).map(x => x.id !== p.id ? x : {
        ...x, retornoTurno: { ...cfg, gastou: ((x.retornoTurno?.gastou) || 0) + gasto, falhou: !!x.retornoTurno?.falhou },
    });
    await salvarCena({ participantes: parts });
}

/**
 * 🔁 Fecha o turno: devolve o recurso que a classe manda devolver, ou zera se a
 * conjuração falhou. Chamado por tab-combat na virada — mora aqui porque é aqui
 * que estão os helpers que sabem escrever num VD de classe.
 *
 * @param parado ainda tinha a Ação de Movimento quando o turno acabou
 */
window.tbFecharTurnoRetorno = async function (pid, parado) {
    const c = cena();
    const p = (c?.participantes || []).find(x => x.id === pid);
    const pend = p?.retornoTurno;
    if (!p || !pend?.retornoRecurso) return;

    const { ganho, zera, motivo } = retornoDoTurno(pend, { ...pend, parado });
    const r = temDoRecurso(p, pend.retornoRecurso);

    if ((zera || ganho > 0) && r?.tem != null) {
        // Teto: o recurso não passa do máximo da ficha.
        const novo = zera ? 0 : (r.max != null ? Math.min(r.max, r.tem + ganho) : r.tem + ganho);
        await creditarRecurso(p, pend.retornoRecurso, novo);
        logChat(zera
            ? `🔇 ${p.name || '?'}: ${motivo} (${r.nome} ${r.tem} → 0)`
            : `🎵 ${p.name || '?'} recupera ${novo - r.tem} de ${r.nome} — ${motivo} (${r.tem} → ${novo})`);
    }
    // Zera o acumulador SEMPRE, mesmo sem ganho: senão o gasto deste turno
    // pagaria o retorno do turno seguinte.
    await salvarCena({ participantes: (c.participantes || []).map(x => x.id !== pid ? x : { ...x, retornoTurno: null }) });
};

/** Escreve um recurso (vital ou VD de classe) num valor absoluto. */
async function creditarRecurso(p, nome, novo) {
    const a = _norm(nome);
    const vital = /^(energia|ener)/.test(a) ? 'ENER' : /^(vitalidade|vit)/.test(a) ? 'VIT' : /^(sanidade|san)/.test(a) ? 'SAN' : null;
    try {
        if (vital) return void await window.tbCombSetVital?.(p.id, vital, novo);
        const dv = vdsCombateDaFonte(fonteDoParticipante(p)).find(d => _norm(d.nome) === a);
        if (dv) await window.tbCombSetVd?.(p.id, dv.key, novo);
    } catch (e) { console.warn('creditar recurso', e); }
}

async function pagarCusto(p, custo) {
    if (!custo || !p) return;
    const r = temDoRecurso(p, custo.alvo);
    if (!r || r.tem == null) return;   // desconhecido: a mesa resolve
    const novo = Math.max(0, r.tem - custo.qtd);
    const a = _norm(custo.alvo);
    const vital = /^(energia|ener)/.test(a) ? 'ENER' : /^(vitalidade|vit)/.test(a) ? 'VIT' : /^(sanidade|san)/.test(a) ? 'SAN' : null;
    try {
        if (vital) {
            await window.tbCombSetVital?.(p.id, vital, novo);
        } else {
            const dv = vdsCombateDaFonte(fonteDoParticipante(p)).find(d => _norm(d.nome) === a);
            if (dv) await window.tbCombSetVd?.(p.id, dv.key, novo);
        }
        logChat(`💰 ${p.name || '?'}: ${custo.rotulo} (${r.nome} ${r.tem} → ${novo})`);
    } catch (e) { console.warn('pagar custo', e); }
}

/**
 * O alcance do DISPARO deste participante: o maior tiro que ele tem em mãos,
 * já cortado pela FOR (ver shared/alcance-disparo.js). Sem arma de tiro — ou
 * com o alcance dela não cadastrado — dá 0, e a mira não abre.
 */
function alcanceDoDisparoDe(p) {
    const forca = valorComponente('FOR', fonteDoParticipante(p));
    return melhorDisparo(golpesCacheados(p) || [], forca);
}

/** Converte a mira CADASTRADA (metros) para o runtime (px no ponto do token). */
function miraDoCadastro(m, s, custo, p) {
    // 🏹 Alcance que sai da ARMA, não do cadastro: a manobra do Caçador vale
    // até onde a flecha dele chega, e isso muda quando ele troca de arco.
    const alcance = m.alcanceDoDisparo ? alcanceDoDisparoDe(p).metros : (Number(m.alcanceM) || 0);
    return {
        tipo: m.tipo, forma: m.forma || 'circulo', origem: m.origem || 'token',
        alcanceM: alcance, raioM: Number(m.raioM) || 0,
        comprimentoM: Number(m.comprimentoM) || 0, larguraM: Number(m.larguraM) || 0,
        angGraus: Number(m.angGraus) || 60, maxAlvos: Number(m.maxAlvos) || 1,
        afeta: m.afeta || 'todos',
        meta: {
            nome: s.nome, efeito: s.efeito, custoSkill: s.custo, custoAcao: custo,
            condicao: m.condicaoNome ? { nome: m.condicaoNome, rodadas: Number(m.condicaoRodadas) || 0, maxAlvos: Number(m.condicaoMaxAlvos) || 0 } : null,
            portao: m.condicaoPortao || null,
        },
    };
}

/** Skill sem mira cadastrada: o MESTRE configura na hora (parâmetro é regra). */
async function abrirMiraManual(s, custo, tok) {
    const un = unidadeEm({ x: tok.x, y: tok.y }) || 'm';
    let conds = [];
    try { conds = await carregarCondicoesSistema(); } catch (e) {}
    window._tbAbrirModal(`🎯 Como aplicar “${esc(s.nome)}”?`, `
        <div class="tb-muted" style="font-size:.78rem;margin-bottom:8px">Esta habilidade ainda não tem mira cadastrada no Criador — defina aqui (vale só para este uso; cadastre no Criador para valer sempre).</div>
        <div class="tb-form-grid">
            <label>Tipo<select id="mm_tipo">
                <option value="alvos">🎯 Alvos escolhidos</option>
                <option value="circulo">⭕ Área: círculo</option>
                <option value="cone">📐 Área: cone</option>
                <option value="linha">📏 Área: linha</option>
                <option value="cac">⚔️ Golpe (arco no token)</option>
            </select></label>
            <label>Afeta<select id="mm_afeta">
                <option value="todos">Todos</option>
                <option value="inimigos">Só inimigos</option>
                <option value="aliados">Só aliados</option>
            </select></label>
            <label>Alcance (${esc(un)})<input type="number" id="mm_alc" value="10" min="0" step="0.5"></label>
            <label>Raio/Comprimento (${esc(un)})<input type="number" id="mm_raio" value="3" min="0" step="0.5"></label>
            <label>Ângulo (cone)<input type="number" id="mm_ang" value="60" min="10" max="180"></label>
            <label>Máx. de alvos<input type="number" id="mm_max" value="1" min="1" max="20"></label>
            <label>☠️ Aplica condição<select id="mm_cond">
                <option value="">— nenhuma —</option>
                ${conds.map(cd => `<option value="${esc(cd.nome)}">${esc(cd.icone || '☠️')} ${esc(cd.nome)}</option>`).join('')}
            </select></label>
            <label>⏱️ Por quantas rodadas<input type="number" id="mm_condRod" min="0" placeholder="vazio = até remover"></label>
        </div>
        <div class="tb-modal-actions"><button class="tb-btn tb-btn-success" onclick="tbTurnoMiraManualOk('${esc(s.nome)}','${custo}')">🎯 Mirar</button></div>
    `);
    window._miraManualSkill = s;
}
window.tbTurnoMiraManualOk = (nome, custo) => {
    const v = (id) => document.getElementById(id)?.value;
    const s = window._miraManualSkill; if (!s) return;
    const tipo = v('mm_tipo');
    const tok = tokenAtivoDoCombate(); if (!tok) return;
    const condNome = v('mm_cond');
    armarMira({
        tipo: tipo === 'alvos' ? 'alvos' : tipo === 'cac' ? 'cac' : 'geometria',
        forma: tipo, origem: tipo === 'circulo' ? 'livre' : 'token',
        alcanceM: parseFloat(v('mm_alc')) || 0,
        raioM: parseFloat(v('mm_raio')) || 0,
        comprimentoM: parseFloat(v('mm_raio')) || 0,
        larguraM: Math.max(1, (parseFloat(v('mm_raio')) || 0) / 3),
        angGraus: parseInt(v('mm_ang')) || 60,
        maxAlvos: parseInt(v('mm_max')) || 1,
        afeta: v('mm_afeta') || 'todos',
        meta: {
            nome: s.nome, efeito: s.efeito, custoSkill: s.custo, custoAcao: custo,
            condicao: condNome ? { nome: condNome, rodadas: parseInt(v('mm_condRod')) || 0 } : null,
        },
    }, tok);
    window.tbFecharModal();
    sub = null;
};

// ---------- runtime da mira ----------
/** metros → px no ponto do token (respeita a escala do mapa sob ele). */
function pxDe(metros, tok) {
    const upc = upcEm({ x: tok.x, y: tok.y }) || 1;   // unidades por célula
    return (Number(metros) || 0) / upc * gridSize();
}

function armarMira(cfg, tok) {
    const gs = gridSize();
    T.mira = {
        ...cfg,
        tokenId: tok.id,
        alcancePx: pxDe(cfg.alcanceM, tok),
        raioPx: pxDe(cfg.raioM, tok),
        comprimentoPx: pxDe(cfg.comprimentoM, tok),
        larguraPx: pxDe(cfg.larguraM, tok),
        cursor: { x: tok.x + gs, y: tok.y },
        alvos: [], travada: false,
    };
    render();
    markDirty();
    toast(cfg.tipo === 'alvos'
        ? `🎯 Clique nos alvos (até ${cfg.maxAlvos || 1}) e confirme`
        : '🎯 Clique no mapa para posicionar e confirme');
}

function cancelarMira() {
    if (!T.mira) return;
    T.mira = null;
    render();
    markDirty();
}

/** Facção efetiva de um token do mapa (participante da cena, ou palpite pelo vínculo). */
function faccaoDoToken(o) {
    // 🔀 Condição que força facção (Dominado, Enfeitiçado) manda mais que a
    // facção gravada: é o ponto único por onde TODA validação de alvo passa,
    // então trocar aqui já vira o lado do token na mira, na área e no conflito.
    const forcada = efeitoCondDoToken(o).faccaoForcada;
    if (forcada) return forcada;
    const p = participanteDoToken(o);
    if (p) return faccaoDoParticipante(p);
    return o.vinculo?.tipo === 'char' ? 'aliados' : o.vinculo?.tipo === 'npc' ? 'inimigos' : 'neutros';
}

/** Token intocável por condição (Etéreo). Devolve o motivo, ou '' se dá para mirar. */
function porqueNaoPodeSerAlvo(o) {
    const ef = efeitoCondDoToken(o);
    return ef.naoPodeSerAlvo ? (ef.motivos.naoPodeSerAlvo || []).join(', ') : '';
}

/** Clique do mapa em modo mira (chamado pelo tab-tools). */
function miraClique(w) {
    const m = T.mira; if (!m) return;
    const tok = T.objects.get(m.tokenId); if (!tok) { cancelarMira(); return; }
    const gs = gridSize();
    if (m.tipo === 'alvos') {
        // toggle de token sob o clique
        let alvo = null;
        for (const o of T.objects.values()) {
            if (o.tipo !== 'token') continue;
            const r = ((o.tamanhoCelulas || 1) * gs) / 2;
            if (Math.hypot(o.x - w.x, o.y - w.y) <= r) { alvo = o; break; }
        }
        if (!alvo) return;
        const ja = m.alvos.indexOf(alvo.id);
        if (ja >= 0) { m.alvos.splice(ja, 1); render(); markDirty(); return; }
        const intocavel = porqueNaoPodeSerAlvo(alvo);
        if (intocavel) { toast(`⚠️ ${alvo.nome || 'Alvo'} não pode ser alvo (${intocavel})`, 'warning'); return; }
        const minha = faccaoDoToken(tok);
        if (!alvoValido(m.afeta, minha, faccaoDoToken(alvo))) { toast(`⚠️ ${alvo.nome || 'Alvo'} não é ${m.afeta === 'aliados' ? 'aliado' : 'inimigo'}`, 'warning'); return; }
        const rA = ((tok.tamanhoCelulas || 1) * gs) / 2, rB = ((alvo.tamanhoCelulas || 1) * gs) / 2;
        if (!alvoAoAlcance({ x: tok.x, y: tok.y }, rA, { x: alvo.x, y: alvo.y }, rB, m.alcancePx)) { toast('⚠️ Fora do alcance', 'warning'); return; }
        if (m.alvos.length >= (m.maxAlvos || 1)) { toast(`⚠️ Máximo de ${m.maxAlvos} alvo(s)`, 'warning'); return; }
        m.alvos.push(alvo.id);
    } else {
        m.cursor = w;
        m.travada = true;   // clicou = marcou; o botão Confirmar aplica
    }
    render();
    markDirty();
}

/** Movimento do mouse com mira armada e não travada: o preview segue o cursor. */
function miraMove(w) {
    const m = T.mira;
    if (!m || m.travada || m.tipo === 'alvos') return;
    m.cursor = w;
    markDirty();
}

window.tbTurnoConfirmarMira = async () => {
    const m = T.mira; if (!m) return;
    const c = cena();
    const p = participanteDaVez(c);
    const tok = T.objects.get(m.tokenId);
    if (!p || !tok) { cancelarMira(); return; }
    const gs = gridSize();
    const rTok = ((tok.tamanhoCelulas || 1) * gs) / 2;

    // alvos atingidos
    let atingidos = [];
    if (m.tipo === 'alvos') {
        atingidos = m.alvos.map(id => T.objects.get(id)).filter(Boolean);
    } else {
        const shape = shapeDaMira(m, { x: tok.x, y: tok.y, r: rTok }, m.cursor);
        const minha = faccaoDoToken(tok);
        for (const o of T.objects.values()) {
            if (o.tipo !== 'token' || o.id === tok.id) continue;
            const r = ((o.tamanhoCelulas || 1) * gs) / 2;
            if (!templateAtingeCirculo(shape, { x: o.x, y: o.y }, r)) continue;
            if (!alvoValido(m.afeta, minha, faccaoDoToken(o))) continue;
            if (porqueNaoPodeSerAlvo(o)) continue;   // a área varre por cima do Etéreo
            atingidos.push(o);
        }
        // 🙅 O CONJURADOR só entra na própria área se estiver mesmo dentro dela.
        // Cone e linha nascem na BORDA do token, então encostam nele sempre — o
        // toque simples fazia quem lançava virar alvo do próprio golpe. Vale a
        // cobertura: mais da metade do corpo dentro da forma.
        if (m.afeta !== 'inimigos') {
            const dentro = (p) => templateAtingeCirculo(shape, p, 0);
            if (fracaoCoberta({ x: tok.x, y: tok.y }, rTok, dentro) > COBERTURA_MINIMA_CONJURADOR) atingidos.unshift(tok);
        }
    }

    const nomes = atingidos.map(o => o.nome || '?');
    const meta = m.meta || {};
    const icone = m.tipo === 'cac' ? '⚔️' : '✨';
    const custoTxt = meta.custoAcao === 'livre' ? 'Ação Livre' : meta.custoAcao === 'completa' ? 'Ação Completa' : meta.custoAcao === 'movimento' ? 'Ação de Movimento' : 'Ação Padrão';
    logChat(`${icone} ${p.name || '?'} usou ${meta.nome || 'ação'} (${custoTxt})` +
        (nomes.length ? ` → 🎯 ${nomes.join(', ')}` : ' → ninguém na área') +
        (meta.efeito ? ` · ${meta.efeito}` : '') +
        (meta.custoSkill ? ` · custo: ${meta.custoSkill}` : '') +
        (meta.detalhe ? ` · ${meta.detalhe}` : ''));
    const custo = meta.custoAcao || 'padrao';
    T.mira = null;
    markDirty();
    await gastar(custo);
    await pagarCustos(p);   // 💰 debita o recurso (mecânica ou texto do cadastro)
    if (custo === 'livre') render();
    // 🤝 Aplica direto, SEM janela de conflito, quando não há o que rolar:
    //   · buff em aliado — ninguém se defende de um buff;
    //   · habilidade SEM PORTÃO e sem dano — marcar não é atacar. A Presa do
    //     Caçador escolhe o alvo e pronto; pedir um Acerto ali seria inventar
    //     uma rolagem que o cadastro não tem (portão 'nenhum', §6.1).
    const semRolagem = !meta.golpe?.dano && (!meta.portao || meta.portao === 'nenhum');
    if (atingidos.length && (m.afeta === 'aliados' || semRolagem)) {
        let pids = atingidos.map(o => participanteDoToken(o)?.id).filter(Boolean);
        if (meta.condicao?.nome && pids.length) {
            if (meta.condicao.maxAlvos > 0 && pids.length > meta.condicao.maxAlvos) {
                pids = pids.slice(0, meta.condicao.maxAlvos);
                toast(`☠️ Condição limitada a ${meta.condicao.maxAlvos} alvo(s) pelo cadastro — valem os primeiros`, 'warning');
            }
            aplicarCondicaoEmVarios(pids, meta.condicao.nome, meta.condicao.rodadas || 0, p?.id).catch(e => console.warn('condição da skill', e));
        }
        // "aliado(s)" só quando forem mesmo aliados — A Presa marca inimigo.
        const quem = m.afeta === 'aliados' ? 'aliado(s)' : 'alvo(s)';
        toast(`${icone} ${nomes.length} ${quem}: ${nomes.join(', ')}`);
        return;
    }
    // ⚔️ Com alvo, a ação vira CONFLITO: acerto → defesa → dano → aplicação.
    // A janela resolve dano e condições na ficha de quem levou (tab-conflito).
    if (atingidos.length) {
        await abrirConflito(p, tok, {
            nome: meta.nome || 'ação', icone, efeito: meta.efeito || '', custoAcao: custo,
            dano: meta.golpe?.dano || '', tipos: meta.golpe?.tipos || [],
            alvoAcerto: meta.golpe?.acerto ?? null,
            acertoNome: meta.golpe?.acertoNome || '', acertoIcone: meta.golpe?.acertoIcone || '',
            condicao: meta.condicao || null,
            projetil: meta.projetil || null,
        }, atingidos);
        return;
    }
    toast(`${icone} Nenhum alvo na área`);
};
