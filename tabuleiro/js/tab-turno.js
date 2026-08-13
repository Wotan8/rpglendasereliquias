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
import { T, esc, toast, markDirty, gridSize, upcEm, unidadeEm, valorComponente, selecionar, deslocamentosDoToken } from './tab-state.js';
import { refCombate } from './tab-main.js';
import {
    cenaAtiva, comCenaAtivaPatch, participanteDaVez, faccaoDoParticipante,
    acoesNovas, podeGastar, gastarAcao, alvoValido, alcanceGolpe,
    guardadoValido, indiceNaOrdem, recursoInsuficiente, RECURSO_NOME,
} from '../../shared/combate-cenas.js';
import { shapeDaMira, alvoAoAlcance } from './tab-mira-calc.js';
import { templateAtingeCirculo } from './tab-templates.js';
import { tokenAtivoDoCombate, participanteDoToken, VITAIS } from './tab-hud.js';
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
const fonteDoParticipante = (p) => {
    if (p?.characterId) return T.chars.find(c => c.id === p.characterId) || null;
    if (p?.npcId) { const n = T.npcs.find(x => x.id === p.npcId); return n ? { valoresDer: n.valoresDer, atributos: n.atributos, pericias: n.pericias } : null; }
    return null;
};

/** Vitais ATUAIS do participante ({ vit, ener, san }) — para checar custo de skill. */
function recursosDe(p) {
    if (p?.characterId) {
        const v = VITAIS.get(p.characterId);
        return v ? { vit: v.hp, ener: v.ener, san: v.san } : null;
    }
    if (p?.npcId) {
        const vd = T.npcs.find(x => x.id === p.npcId)?.valoresDer || {};
        const at = vd.atual || {};
        return { vit: at.VIT ?? vd.VIT, ener: at.ENER ?? vd.ENER, san: at.SAN ?? vd.SAN };
    }
    return { vit: p?.hpCurrent, ener: p?.enerCurrent, san: p?.sanCurrent };
}

/** Botão de skill: custo sempre visível; sem recurso = desabilitado com o motivo. */
function skillBtnHtml(s, custoAcao, i, recursos) {
    const falta = recursoInsuficiente(s.custo, recursos);
    const custoTxt = s.custo ? ` <i>(${esc(String(s.custo))})</i>` : '';
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
    const predefPorId = new Map();
    try {
        const m = await import('./tab-ficha-win.js?v=8');
        const sys = await m.registroSistema();
        for (const mod of Object.values(sys.classModulesById || {})) {
            for (const pd of mod.itensPredefinidos || []) predefPorId.set(pd.id, pd);
        }
    } catch (e) { console.warn('registro do sistema p/ skills do turno', e); }
    const lista = itensBrutos(p).map(it => {
        const pd = it._predefId ? predefPorId.get(it._predefId) : null;
        return {
            nome: S_NOME(it),
            efeito: S_EFEITO(it) || pd?.descricao || '',
            custo: S_CUSTO(it),
            mira: it.mira || pd?.mira || null,
            acao: it.custoAcao || pd?.custoAcao || pd?.mira?.custoAcao || 'padrao',   // §6.2
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

// ---------- render ----------
const ROTULO_ACAO = { padrao: '⚡ Ação Padrão', movimento: '👣 Ação de Movimento', livre: '🕊️ Ação Livre', completa: '⏳ Ação Completa (as duas)' };

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
        const btn = (id, rot, habil, titulo) =>
            `<button class="tb-btn tb-turno-btn" onclick="tbTurnoSub('${id}')" ${habil ? '' : 'disabled'} title="${esc(titulo || '')}">${rot}</button>`;
        // 🛡️ Guardar = delay: só faz sentido com o turno INTEIRO (as duas ações)
        // e nunca no meio de uma interrupção (não se encadeia guardado).
        const podeGuardar = acoes.padrao && acoes.movimento && !c.retomar;
        body = `<div class="tb-turno-acoes">
            ${semAcoes ? '' : btn('padrao', ROTULO_ACAO.padrao, acoes.padrao, 'Atacar, usar habilidade, magia ou item')}
            ${semAcoes ? '' : btn('movimento', ROTULO_ACAO.movimento, acoes.movimento, 'Mover pelo deslocamento da ficha')}
            ${temLivre ? btn('livre', ROTULO_ACAO.livre, true, 'Incidental — não consome ação') : ''}
            ${temCompleta && !semAcoes ? btn('completa', ROTULO_ACAO.completa, acoes.padrao && acoes.movimento, 'Habilidades que consomem o turno inteiro') : ''}
            ${podeGuardar ? `<button class="tb-btn tb-turno-btn" onclick="tbTurnoGuardar()" title="Guarda as DUAS ações: você pode interromper e agir a qualquer momento até o fim DESTA rodada — depois perde">🛡️ Guardar Turno</button>` : ''}
            <button class="tb-btn tb-turno-btn ${semAcoes ? 'tb-btn-primary' : ''}" onclick="tbTurnoEncerrar()">⏭️ Encerrar Turno</button>
        </div>`;
    }

    el.innerHTML = `<div class="tb-turno-head">
            ${c.retomar ? '⚡' : '⚔️'} Vez de <b>${esc(p.name || '?')}</b>${c.retomar ? ' <span class="tb-turno-hint">(turno guardado — interrompendo)</span>' : ''} · Rodada ${c.rodada || 1}
            <span class="tb-turno-chips">${chip(acoes.padrao, '⚡')}${chip(acoes.movimento, '👣')}</span>
        </div>${body}`;
}

function subMenu(qual, p, skills, acoes) {
    const voltar = `<button class="tb-mini-btn" onclick="tbTurnoSub(null)" title="Voltar">←</button>`;
    if (qual === 'movimento') {
        const tok = tokenAtivoDoCombate();
        const deslocs = tok ? deslocamentosDoToken(tok, T.chars, T.npcs) : [];
        return `<div class="tb-turno-lista">${voltar}
            ${deslocs.map((d, i) => `<button class="tb-btn tb-btn-small" onclick="tbTurnoMover(${i})">👣 ${esc(d.tipo)} — ${d.metros} m</button>`).join('')
              || '<span class="tb-muted">Sem deslocamento na ficha — mova pelo arrasto e gaste manualmente:</span>'}
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
            ${skillsPadrao.map((s, i) => skillBtnHtml(s, 'padrao', i, rec)).join('')}
            <button class="tb-btn tb-btn-small" onclick="tbTurnoGastarAvulso('padrao')" title="Qualquer outra Ação Padrão (descreva no chat)">✅ Outra ação</button>
        </div>`;
    }
    // livre / completa: só as skills com esse custo
    const lista = skills.filter(s => s.acao === qual);
    const rec = recursosDe(p);
    return `<div class="tb-turno-lista">${voltar}
        ${lista.map((s, i) => skillBtnHtml(s, qual, i, rec)).join('')}
    </div>`;
}

async function carregarGolpes(chave, p) {
    golpesCache = { chave, linhas: null };
    try {
        const m = await import('./tab-ficha-win.js?v=8');
        const linhas = await m.linhasDeAtaque(p.npcId ? 'npc' : 'char', p.npcId || p.characterId);
        golpesCache = { chave, linhas };
    } catch (e) { console.warn('golpes do turno', e); golpesCache = { chave, linhas: [] }; }
    render();
}

// ---------- handlers do painel ----------
window.tbTurnoSub = (qual) => { sub = qual; render(); };

window.tbTurnoEncerrar = async () => {
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
window.tbTurnoMover = (i) => {
    const tok = tokenAtivoDoCombate(); if (!tok) return;
    const d = deslocamentosDoToken(tok, T.chars, T.npcs)[i]; if (!d) return;
    T.moverDesloc = { tokenId: tok.id, tipo: d.tipo, metros: d.metros, doTurno: true };
    selecionar(tok.id);
    sub = null;
    render();
    toast(`👣 ${d.tipo}: arraste o token — até ${d.metros} m. A ação é gasta ao soltar.`);
    markDirty();
};

/** tab-tools avisa quando o arrasto limitado do turno terminou. */
async function gastouMovimento(tokenId, foiDoTurno) {
    const c = cena();
    if (!c?.iniciado || !foiDoTurno) return;
    const tok = tokenAtivoDoCombate();
    if (!tok || tok.id !== tokenId || !controlaVez(participanteDaVez(c))) return;
    if ((c.acoesTurno || acoesNovas()).movimento) await gastar('movimento');
}

// ---------- golpe CaC ----------
window.tbTurnoGolpe = (i) => {
    const g = golpesCache?.linhas?.[i]; if (!g) return;
    const p = participanteDaVez(cena());
    const tok = tokenAtivoDoCombate();
    if (!tok) { toast('⚠️ O participante da vez não tem token neste canvas', 'warning'); return; }
    const tamanho = valorComponente('Tamanho', fonteDoParticipante(p)) || 0;
    const alcanceM = alcanceGolpe(g.alcanceM, tamanho);
    armarMira({
        tipo: 'cac', alcanceM, angGraus: ARCO_GOLPE_GRAUS, afeta: 'inimigos',
        meta: { nome: g.nome, efeito: g.dano ? `dano ${g.dano}` : '', custoAcao: 'padrao', detalhe: `alcance ${Math.round(alcanceM * 100) / 100} m (arma ${g.alcanceM || 0} m + 5% do Tamanho${g.alcanceM ? '' : ', mínimo 1 m'})` },
    }, tok);
    sub = null;
};

// ---------- skills ----------
window.tbTurnoSkill = async (custo, i) => {
    const p = participanteDaVez(cena());
    const s = skillsDe(p).filter(x => x.acao === custo)[i];
    if (!s) return;
    // re-checa o custo na hora do clique (o HTML pode estar velho)
    const falta = recursoInsuficiente(s.custo, recursosDe(p));
    if (falta) { toast(`⚠️ Não tem ${RECURSO_NOME[falta.recurso]} o suficiente (${falta.tem}/${falta.qtd})`, 'warning'); return; }
    const tok = tokenAtivoDoCombate();
    if (!tok) { toast('⚠️ O participante da vez não tem token neste canvas', 'warning'); return; }
    if (s.mira?.tipo) {
        armarMira(miraDoCadastro(s.mira, s, custo), tok);
        sub = null;
        return;
    }
    // Sem mira cadastrada: os PARÂMETROS são regra — só o mestre os define.
    // O jogador usa a ação assim mesmo (gasta e loga); a resolução fica na mesa.
    if (!(T.isMaster && T.mode === 'secret')) {
        sub = null;
        await gastar(custo);
        logChat(`✨ ${p?.name || '?'} usou ${s.nome}${s.custo ? ` · custo: ${s.custo}` : ''} — sem mira cadastrada, efeitos com o mestre`);
        toast(`✨ ${s.nome} usada — a mira desta habilidade ainda não foi cadastrada; o mestre resolve os alvos`);
        return;
    }
    abrirMiraManual(s, custo, tok);
};

/** Converte a mira CADASTRADA (metros) para o runtime (px no ponto do token). */
function miraDoCadastro(m, s, custo) {
    return {
        tipo: m.tipo, forma: m.forma || 'circulo', origem: m.origem || 'token',
        alcanceM: Number(m.alcanceM) || 0, raioM: Number(m.raioM) || 0,
        comprimentoM: Number(m.comprimentoM) || 0, larguraM: Number(m.larguraM) || 0,
        angGraus: Number(m.angGraus) || 60, maxAlvos: Number(m.maxAlvos) || 1,
        afeta: m.afeta || 'todos',
        meta: {
            nome: s.nome, efeito: s.efeito, custoSkill: s.custo, custoAcao: custo,
            condicao: m.condicaoNome ? { nome: m.condicaoNome, rodadas: Number(m.condicaoRodadas) || 0 } : null,
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
    const p = participanteDoToken(o);
    if (p) return faccaoDoParticipante(p);
    return o.vinculo?.tipo === 'char' ? 'aliados' : o.vinculo?.tipo === 'npc' ? 'inimigos' : 'neutros';
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
            atingidos.push(o);
        }
        // área que afeta a própria facção inclui o conjurador se ele estiver dentro
        if (m.afeta !== 'inimigos' && templateAtingeCirculo(shape, { x: tok.x, y: tok.y }, rTok)) atingidos.unshift(tok);
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
    if (custo === 'livre') render();
    // ☠️ Condição vinculada da skill: aplica em todos os alvos atingidos que
    // participam da cena (o motor de rodadas expira sozinho, com aviso ao mestre)
    if (meta.condicao?.nome && atingidos.length) {
        const pids = atingidos.map(o => participanteDoToken(o)?.id).filter(Boolean);
        if (pids.length) aplicarCondicaoEmVarios(pids, meta.condicao.nome, meta.condicao.rodadas || 0).catch(e => console.warn('condição da skill', e));
    }
    toast(nomes.length ? `${icone} ${nomes.length} alvo(s): ${nomes.join(', ')}` : `${icone} Nenhum alvo na área`);
};
