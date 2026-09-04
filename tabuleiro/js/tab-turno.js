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
import { T, esc, toast, markDirty, gridSize, upcEm, unidadeEm, unidadesParaPx, valorComponente, selecionar, deslocamentosDoToken, alcanceDeVisaoDoToken, registrarFlutuante, trazerParaFrente, efeitoCondDoToken } from './tab-state.js';
import { addObj } from './tab-objects.js';
import { refCombate } from './tab-main.js';
import { derivedDoToken } from './tab-render.js';
import { abrirConflito } from './tab-conflito.js';
import {
    cenaAtiva, comCenaAtivaPatch, participanteDaVez, faccaoDoParticipante,
    acoesNovas, podeGastar, gastarAcao, alvoValido, alcanceGolpe,
    efeitoDasCondicoes, porqueCondicao,
    guardadoValido, indiceNaOrdem, recursoInsuficiente, RECURSO_NOME, custoDaMecanica,
} from '../../shared/combate-cenas.js';
import { areaDoInstrumento, explicaArea } from '../../shared/instrumento-area.js?v=1';
import { bolsaFecha, reparticaoValida, partesDaReparticao, custosDaSkill, rotuloDosCustos, moduloDeclaraCusto, custoDeclaradoZero } from '../../shared/skill-custo.js?v=1';
import { indexarPredefs, interpretarSkill, afetaDaCondicao, rotuloDaCondicao } from '../../shared/skill-runtime.js?v=3';
import { miraDaRuna, gastarUso } from '../../shared/runa-em-jogo.js?v=1';
import { resolverMedida, ehFormula } from '../../shared/medida-formula.js?v=1';
import { shapeDaMira, alvoAoAlcance, fracaoCoberta, COBERTURA_MINIMA_CONJURADOR,
         porqueLocalInvalido, localSob } from './tab-mira-calc.js';
import { retornoDoTurno } from '../../shared/retorno-recurso.js';
import { melhorDisparo, bracoDeArremesso } from '../../shared/alcance-disparo.js';
import { golpesDe, golpesCacheados, escolherGolpe, metaDoGolpe, alcanceDoGolpe, limparCacheGolpes, formasDeConjurar, projeteisPara, escolherProjetil } from './tab-golpes.js';
import { gastarUm } from '../../shared/projeteis.js';
import { templateAtingeCirculo } from './tab-templates.js';
import { updObj } from './tab-objects.js';
import { tokenAtivoDoCombate, participanteDoToken, VITAIS, vdsCombateDaFonte, fonteDoParticipante } from './tab-hud.js';
import { carregarCondicoesSistema, aplicarCondicaoEmVarios, marcarFalhaDeConjuracao } from './tab-combat.js';
import { grausDoAtaque } from './tab-conflito-calc.js';
import { calcularDadiva, rotuloDoGanho, tetoDoAtributo, mesaDeSorteio } from '../../shared/dadiva.js?v=3';
import { janelaDeSorteio, sorteioDoMestre, janelaDoVeu } from './tab-dadiva-sorteio.js?v=2';
import { bonusDosGanhos } from '../../shared/bonus-temporario.js?v=1';
import { porqueNaoPodeIncorporar, custoEscalonado, dadivasDoHospede, ehAncestral,
         quemFicaInerte, CONDICAO_TRANSE, custoDaProjecao } from '../../shared/incorporacao.js?v=2';
import { oQueDesfazer, comecarRitual, precisaSegundoEstagio, miraDoSegundoEstagio } from '../../shared/turno-efeitos.js?v=1';
import { logChat } from './tab-chat.js';

import { confirmar, perguntar } from '../../shared/dialogo.js?v=2';
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
    registrarFlutuante(el);
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
    // 🌀 Projetor: enquanto o personagem está projetado no hóspede, quem joga o
    // token do hóspede é o dono do personagem — na iniciativa do PRÓPRIO
    // hóspede, que já está na cena. Ninguém muda de lugar na ordem.
    if (p.controladoPor) return T.chars.find(c => c.id === p.controladoPor)?.ownerUid === T.user?.uid;
    return false;   // NPC/custom são do mestre
}
// ⚠️ A ficha do participante vem de tab-hud e de lugar nenhum mais. Havia aqui
// uma cópia local desta função, idêntica na aparência, que SOMBREAVA a
// importada — e por isso o painel do turno lia a ficha CRUA, sem os bônus
// temporários da Dádiva. Custo e mira saíam sem o empréstimo dentro.

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

/**
 * Falta recurso para ESTA forma de pagar? { nome, tem, qtd } ou null.
 * Uma forma pode ser composta ("1 Energia + 2 Sanidade"): falta uma parte,
 * falta a forma inteira — pagar metade de um ritual não é pagar.
 */
function faltaPara(p, forma) {
    // 🎵 BOLSA (Bardo): o custo é um total repartível entre as moedas. Não
    // adianta olhar moeda por moeda — quem tem 2 de Harmonia e 1 de Energia
    // paga uma canção de 3. O que falta é a SOMA não fechar.
    if (forma?.pool) {
        const b = bolsaFecha(forma, (m) => temDoRecurso(p, m)?.tem ?? null);
        if (b.ok) return null;
        return { nome: (forma.moedas || []).join(' + '), tem: b.disponivel, qtd: b.total };
    }
    for (const parte of forma?.partes || []) {
        const r = temDoRecurso(p, parte.alvo);
        if (!r || r.tem == null) continue;   // desconhecido não bloqueia
        if (r.tem < parte.qtd) return { nome: r.nome, tem: r.tem, qtd: parte.qtd };
    }
    return null;
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

/**
 * A habilidade se declara FORA DE COMBATE no próprio texto?
 *
 * O campo "Ação:" do cadastro é a resposta oficial, mas nem toda habilidade foi
 * preenchida — e o texto de muitas já diz, em maiúsculas, "FORA DE COMBATE"
 * (Buscar Vestígio: "chamar um Eco leva o tempo que leva"). Sem isto elas caem
 * como Ação Livre e aparecem no meio da rodada, oferecendo um botão que não
 * deveria existir ali. Ler o texto não inventa regra: só obedece o que já está
 * escrito nele.
 */
function textoDizForaDeCombate(txt) {
    return /\bfora de combate\b/i.test(String(txt || '').normalize('NFD').replace(/[̀-ͯ]/g, ''));
}

/** "Ação Padrão"/"Ação Livre"/... (rótulo do cadastro) → custo de ação (§6.2). */
function acaoDoRotulo(rotulo) {
    const r = String(rotulo || '').toLowerCase();
    // 🕯️ "Fora de combate" é uma opção do cadastro que o painel ignorava: o
    // ritual de oito horas caía como Ação Padrão e ainda pedia mira. Não
    // consome ação do turno e não tem alvo no mapa — quem resolve é a mesa.
    if (/fora de combate|prolongad/.test(r)) return 'fora';
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
/* A leitura da mira do cadastro mora em shared/skill-runtime.js
 * (miraDeCadastro) — a MESMA que o Painel do Criador usa para dizer o que
 * está incompleto. Havia aqui uma segunda cópia, e duas cópias da mesma
 * regra foi o que já produziu o bug do sombreamento. Uma só. */

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

/** Quantas vezes se insiste no registro antes de desistir e seguir sem ele. */
const SKILLS_MAX_TENTATIVAS = 3;

function skillsDe(p) {
    const chave = p?.npcId ? 'npc:' + p.npcId : p?.characterId ? 'char:' + p.characterId : null;
    if (!chave) return [];
    if (skillsCache?.chave === chave) {
        // Lista montada sem o registro: insiste (o registro pode ter chegado
        // agora) e devolve o que já tem para o painel não piscar vazio.
        if (skillsCache.parcial && skillsCache.tentativas < SKILLS_MAX_TENTATIVAS) {
            carregarSkills(chave, p, skillsCache.tentativas);
        }
        return skillsCache.lista || [];
    }
    carregarSkills(chave, p, 0);
    return [];
}

/**
 * 🔁 Retorno de recurso: regra do MÓDULO, não da magia (ver
 * shared/retorno-recurso.js). Só viaja se estiver ligada no cadastro.
 *
 * ⚠️ É `function` e mora AQUI FORA de propósito. Isto já foi um `const` dentro
 * de carregarSkills, DEPOIS do ponto que o chamava: a zona morta temporal fazia
 * a montagem do índice lançar ReferenceError, o catch engolia, e o índice de
 * pré-definidos ficava VAZIO. Resultado: toda habilidade do sistema perdia
 * custo e mira e caía no diálogo "Como aplicar". Um `const` mal posicionado
 * apagava o cadastro inteiro do Tabuleiro, em silêncio.
 */
function cfgRetorno(mod) {
    if (!String(mod?.retornoRecurso || '').trim()) return null;
    return {
        retornoRecurso: String(mod.retornoRecurso).trim(),
        retornoBonusParado: Number(mod.retornoBonusParado) || 0,
        retornoExigeSucesso: !!mod.retornoExigeSucesso,
        retornoZeraSeFalhar: !!mod.retornoZeraSeFalhar,
    };
}

/**
 * ᛟ As runas que este participante pode ativar agora.
 *
 * Duas fontes, e o cânone trata as duas igual: peça gravada no inventário
 * (Escripta e Talha) e tatuagem que virou Peculiaridade. Tatuagem PASSIVA não
 * entra — ela já está valendo o tempo todo, não é ação de turno.
 *
 * Nada aqui é ação nova: cada runa vira uma entrada com o mesmo formato das
 * habilidades de classe, e segue pelos mesmos trilhos.
 */
async function runasDe(p) {
    const tipo = p?.npcId ? 'npc' : 'char';
    const id = p?.npcId || p?.characterId;
    if (!id) return [];
    let itens = [];
    try {
        const m = await import('./tab-ficha-win.js?v=14');
        itens = m.itensCarregados(tipo, id) || [];
    } catch (e) { console.warn('itens para runas', e); return []; }

    const out = [];
    for (const it of itens) {
        const b = it?.runa;
        if (!b || !b.mira) continue;
        // Peça com os usos zerados não é opção: ela devia ter sumido.
        const restam = it.usosRestantes;
        if (!b.permanente && Number.isFinite(Number(restam)) && Number(restam) <= 0) continue;
        // Runa que dispara sozinha (Gatilho/Sensor) não é ação de quem carrega.
        if (b.ativacao?.modo === 'automatica') continue;

        const mira = miraDaRuna(b);
        const usosTxt = b.permanente ? 'permanente' : `${restam ?? b.usos} uso(s)`;
        out.push({
            nome: `ᛟ ${b.nome || it.nome || 'Runa'}`,
            efeito: [b.dano ? `dano ${b.dano}` : '', b.canal && b.canal !== 'Dano' ? b.canal : '',
                     ...(b.condicoesAplicadas || []).map(c => `${c.condicao} ${c.nivel}`)].filter(Boolean).join(' · '),
            custo: usosTxt,
            custos: [],            // a carga é da peça, não da ficha
            veiculos: [],
            retorno: null,
            mira,
            // Parte XIV: qualquer um ativa com 1 Ação Padrão.
            acao: 'padrao',
            diagnostico: { ok: true, faltas: [] },
            _runa: { itemId: it.id, bloco: b },
        });
    }
    return out;
}

async function carregarSkills(chave, p, tentativas = 0) {
    // marcador de "carregando": impede o render seguinte de disparar outra
    skillsCache = { chave, lista: skillsCache?.chave === chave ? (skillsCache.lista || []) : [], parcial: false, tentativas };
    let mechsById = {};
    let sysDVs = [];
    let idx = indexarPredefs([]);
    let registroOk = false;
    try {
        const m = await import('./tab-ficha-win.js?v=14');
        const sys = await m.registroSistema();
        mechsById = sys.mechsById || {};
        sysDVs = sys.derivedValues || [];
        idx = indexarPredefs(Object.values(sys.classModulesById || {}));
        registroOk = idx.total > 0;
        if (!registroOk) console.warn('⚠️ registro do sistema veio sem módulos de classe');
    } catch (e) {
        console.error('❌ registro do sistema p/ skills do turno — habilidades vão sair sem custo e sem mira', e);
    }

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

    // 🧠 UM interpretador só, o mesmo que o Painel do Criador usa para listar o
    // que está incompleto (shared/skill-runtime.js). Ele tem cadeia de recurso
    // para achar o pré-definido — id, nome, nome sem o "[V, S]" — e devolve um
    // diagnóstico dizendo o que faltou. Skill nova, módulo novo: entram por aqui
    // sem nenhum caso especial.
    const lista = itensBrutos(p).map(it => {
        const r = interpretarSkill(it, {
            idx, custosDaSkill, moduloDeclaraCusto, custoDeclaradoZero,
            mechPorId: (id) => mechsById[id], custoDaMecanica, registroOk,
        });
        if (!r.diagnostico.ok) {
            console.warn(`⚠️ Skill "${r.nome}" não saiu completa:`,
                r.diagnostico.faltas.map(f => `${f.campo}: ${f.porque}`));
        }
        const pd = r.pd;
        return {
            nome: r.nome,
            efeito: r.efeito || S_EFEITO(pd?.valores || {}),
            // Texto do botão: o que o cadastro declara. Sem custo cadastrado o
            // campo livre da ficha ainda vale como AVISO (não é debitado).
            custo: rotuloDosCustos(r.custos) || S_CUSTO(it) || S_CUSTO(pd?.valores || {}),
            custos: r.custos,
            veiculos: veiculosDaSkill(it, r.modulo?.schema, pd),
            retorno: cfgRetorno(r.modulo),
            mira: r.mira,
            // §6.2. O texto que se declara "FORA DE COMBATE" manda em tudo:
            // ele é a intenção escrita pelo autor da habilidade, e o campo
            // "Ação:" nem sempre foi preenchido.
            acao: textoDizForaDeCombate(r.efeito || S_EFEITO(pd?.valores || {}))
                ? 'fora'
                : (it.custoAcao || pd?.custoAcao || pd?.mira?.custoAcao || acaoDoRotulo(it.acao || pd?.valores?.acao)),
            diagnostico: r.diagnostico,
        };
    });
    // ᛟ As runas entram na MESMA lista, no mesmo formato. É o que faz a runa
    // ser jogável sem nenhum motor novo: ela atravessa tbTurnoSkill, a mira e a
    // janela de conflito pelos trilhos que as habilidades de classe já usam.
    lista.push(...await runasDe(p));

    // Registro que não chegou não pode virar cache definitivo: com ele fora
    // TODA skill fica sem custo e sem mira, e o painel manteria esse estado
    // torto até a vez virar. Marca como parcial para o próximo render tentar
    // de novo — com teto, senão um registro indisponível viraria laço.
    skillsCache = { chave, lista, parcial: !registroOk, tentativas: (tentativas + 1) };
    render();
}

// ---------- escrita (gasto de ação) ----------
async function salvarCena(patch) {
    try {
        await setDoc(refCombate(), { ...comCenaAtivaPatch(T.combate, patch), atualizadoEm: Date.now() }, { merge: true });
    } catch (e) { console.error(e); toast('❌ Erro ao salvar o turno', 'danger'); }
}
async function gastar(custo) {
    if (custo === 'livre' || custo === 'fora') return;   // incidental / ritual — não consome
    const novas = gastarAcao(cena().acoesTurno, custo);
    // 🛡️ Postura larga a guarda: quem estava defendendo e parte para cima
    // perde a postura e o bônus dela. É o preço de trocar defesa por ataque.
    const parts = (custo === 'padrao' || custo === 'completa')
        ? semPosturaDeQuemAgiu(participanteDaVez(cena())?.id) : null;
    // otimista: o snapshot confirma; o painel não pisca esperando a rede
    T.combate = { ...comCenaAtivaPatch(T.combate, parts ? { acoesTurno: novas, participantes: parts } : { acoesTurno: novas }) };
    render();
    await salvarCena(parts ? { acoesTurno: novas, participantes: parts } : { acoesTurno: novas });
}

/**
 * Participantes com a POSTURA de `pid` desfeita — as condições que o cadastro
 * marcou com `saiComAcaoPadrao`. Devolve null quando não havia nenhuma, para
 * não escrever `participantes` à toa em todo golpe do combate.
 */
function semPosturaDeQuemAgiu(pid) {
    if (!pid) return null;
    const parts = cena()?.participantes || [];
    const p = parts.find(x => x.id === pid);
    const caem = (p?.condicoes || []).filter(cd => cd && typeof cd === 'object' && cd.saiComAcaoPadrao);
    if (!caem.length) return null;
    logChat(`🛡️ ${p.name || '?'} largou a guarda ao agir: ${caem.map(c => `${c.icone || '☠️'} ${c.nome}`).join(', ')}`);
    toast(`🛡️ Postura desfeita: ${caem.map(c => c.nome).join(', ')}`, 'warning');
    return parts.map(x => x.id !== pid ? { ...x }
        : { ...x, condicoes: (x.condicoes || []).filter(cd => !(cd && typeof cd === 'object' && cd.saiComAcaoPadrao)) });
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

/** Aparecer conta como abrir: o painel da vez sobe para cima das outras janelas. */
function abrirPainel() {
    if (el.classList.contains('open')) return;
    el.classList.add('open');
    trazerParaFrente(el);
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
    fora:      L('🕯️ ', '') + 'Ritual' + L('', ' (fora de combate)'),
};

function render() {
    if (!el) return;
    const c = cena();
    const p = c?.iniciado ? participanteDaVez(c) : null;
    if (p && p.id !== vezAnterior) {   // a vez virou: nada do turno anterior sobrevive
        vezAnterior = p.id; sub = null; golpesCache = null; skillsCache = null;
        // 🔄 O inventário muda FORA do Tabuleiro: restaurar um item ao cadastro,
        // equipar pela ficha, o mestre mexer pelo Painel. Nada disso avisa aqui.
        // A virada da vez é o momento barato de reler — uma query por turno, e
        // o painel para de oferecer arma que não existe mais (ou de ignorar a
        // Qualidade que acabou de ser corrigida).
        limparCacheGolpes();
        if (T.mira) { T.mira = null; markDirty(); }
    }
    if (!p || !controlaVez(p) || (T.isMaster && T.mode === 'public')) {
        // 🛡️ Fora da minha vez: se tenho turno GUARDADO válido, o painel vira o
        // botão de agir agora (interromper). Sem interrupção encadeada.
        const guardados = guardadosQuePossoAgir(c);
        if (guardados.length) {
            abrirPainel();
            el.innerHTML = htmlGuardados(guardados);
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

    abrirPainel();

    // 🎯 modo mira: o painel vira a barra de confirmação
    if (T.mira) {
        const m = T.mira;
        const status = m.tipo === 'alvos'
            ? `${m.alvos.length}/${m.maxAlvos || 1} alvo(s)`
            : m.tipo === 'locais'
                ? `${m.locais.length}/${m.maxAlvos || 1} local(is)`
                : (m.travada ? 'posição marcada' : 'clique no mapa para mirar');
        const pronto = m.tipo === 'alvos' ? m.alvos.length
            : m.tipo === 'locais' ? m.locais.length : m.travada;
        el.innerHTML = `<div class="tb-turno-head">${m.tipo === 'locais' ? '📍' : '🎯'} ${esc(m.meta?.nome || 'Mira')} <span class="tb-turno-hint">${status}</span></div>
            <div class="tb-turno-acoes">
                <button class="tb-btn tb-btn-success" onclick="tbTurnoConfirmarMira()" ${pronto ? '' : 'disabled'}>✅ Confirmar</button>
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
        // 😮‍💨 Recuperar Fôlego (Livro §6.2): o turno INTEIRO parado devolve
        // 1 Energia. Ação base de todo mundo, só existe dentro do combate.
        const recFolego = recursosDe(p);
        const folegoCheio = recFolego?.ener != null && recFolego?.enerMax != null && Number(recFolego.ener) >= Number(recFolego.enerMax);
        const travaFolego = porqueCondicao(efCond, 'bloqueia_completa');
        const folegoHtml = (acoes.padrao && acoes.movimento)
            ? `<button class="tb-btn tb-turno-btn ${travaFolego ? 'tb-turno-travado' : ''}" onclick="tbTurnoFolego()"
                ${folegoCheio || travaFolego ? 'disabled' : ''}
                title="${esc(travaFolego ? 'Bloqueado por: ' + travaFolego : folegoCheio ? 'Energia já está no máximo' : 'Gasta o turno INTEIRO (as duas ações) parado para recuperar 1 Energia')}">${travaFolego ? '🚫 ' : ''}😮‍💨 ${L('', 'Recuperar ')}Fôlego</button>` : '';
        body = `<div class="tb-turno-acoes">
            ${semAcoes ? '' : btn('padrao', ROTULO_ACAO.padrao, acoes.padrao, 'Atacar, usar habilidade, magia ou item')}
            ${semAcoes ? '' : btn('movimento', ROTULO_ACAO.movimento, acoes.movimento, 'Mover pelo deslocamento da ficha')}
            ${temLivre ? btn('livre', ROTULO_ACAO.livre, true, 'Incidental — não consome ação') : ''}
            ${temCompleta && !semAcoes ? btn('completa', ROTULO_ACAO.completa, acoes.padrao && acoes.movimento, 'Habilidades que consomem o turno inteiro') : ''}
            ${folegoHtml}
            <!-- 🕯️ Ritual "Fora de combate" NÃO tem botão aqui, de propósito. O
                 painel do turno só é desenhado com o combate INICIADO e na sua
                 vez — então um botão "fora de combate" só apareceria dentro do
                 combate, que é o contrário do que o cadastro diz. Quem resolve
                 rito de oito horas é a mesa. -->
            ${podeGuardar ? `<button class="tb-btn tb-turno-btn" onclick="tbTurnoGuardar()" title="Guarda as DUAS ações: você pode interromper e agir a qualquer momento até o fim DESTA rodada — depois perde">🛡️ Guardar<span class="tb-so-largo"> Turno</span></button>` : ''}
            <button class="tb-btn tb-turno-btn ${semAcoes && !conflitoPendente() ? 'tb-btn-primary' : ''}"
                ${conflitoPendente() ? 'disabled' : ''}
                title="${esc(motivoConflito() || 'Passa a vez para o próximo da ordem')}"
                onclick="tbTurnoEncerrar()">⏭️ Encerrar<span class="tb-so-largo"> Turno</span>${conflitoPendente() ? ` <i class="tb-so-largo">(${cena()?.conflito?.fase === 'fim' ? 'feche o conflito' : 'conflito em curso'})</i>` : ''}</button>
        </div>`;
    }

    el.innerHTML = `<div class="tb-turno-head">
            ${c.retomar ? '⚡' : '⚔️'} <span class="tb-so-largo">Vez de </span><b class="tb-turno-nome">${esc(p.name || '?')}</b>${c.retomar ? ' <span class="tb-turno-hint">(turno guardado — interrompendo)</span>' : ''} <span class="tb-turno-hint">R${c.rodada || 1}</span>
            <span class="tb-turno-chips">${chip(acoes.padrao && !efCond.bloqueia.padrao, '⚡')}${chip(acoes.movimento && !efCond.bloqueia.movimento, '👣')}</span>
            ${avisoCondicoes(efCond)}
        </div>${body}${htmlGuardados(guardadosQuePossoAgir(c))}`;
}

/**
 * 🛡️ Quem guardou o turno e EU posso mandar agir agora.
 *
 * O mestre controla todo mundo — e era justamente ele que nunca via esta
 * lista: o bloco só era desenhado no ramo "não é a minha vez", e a vez é
 * sempre do mestre quando ele joga no modo secreto. NPC que guardava o turno
 * ficava sem botão nenhum, e o mestre não tinha como fazê-lo interromper.
 * Agora a tira aparece TAMBÉM embaixo do painel normal.
 *
 * Fora: interrupção encadeada (`c.retomar`), o próprio dono da vez, e o mestre
 * espiando o modo público — ali ele não age por ninguém.
 */
function guardadosQuePossoAgir(c) {
    if (!c?.iniciado || c.retomar) return [];
    if (T.isMaster && T.mode === 'public') return [];
    const daVez = participanteDaVez(c);
    return (c.participantes || [])
        .filter(x => guardadoValido(c, x) && controlaVez(x) && x.id !== daVez?.id);
}

/** A tira de "⚡ fulano: agir agora" — vazia quando ninguém guardou. */
function htmlGuardados(guardados) {
    if (!guardados.length) return '';
    return `<div class="tb-turno-head">🛡️ Turno guardado <span class="tb-turno-hint">vale até o fim desta rodada</span></div>
        <div class="tb-turno-acoes">${guardados.map(g =>
            `<button class="tb-btn tb-turno-btn tb-btn-primary" onclick="tbTurnoAgirAgora('${g.id}')">⚡ ${esc(g.name || '?')}: agir agora</button>`).join('')}
        </div>`;
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
/**
 * Há janela de conflito no ar? Enquanto houver, ninguém passa a vez.
 *
 * Vale até a janela ser FECHADA, não até o conflito ser resolvido: na fase
 * 'fim' o resultado ainda está na tela esperando o "✅ Fechar", e passar a vez
 * ali some com o placar do golpe antes de todo mundo ler. `tbConfFechar` apaga
 * o conflito da cena, e é isso que solta o botão.
 *
 * O mestre no modo secreto é isento: é ele quem conduz a mesa.
 */
function conflitoPendente() {
    if (T.isMaster && T.mode === 'secret') return false;
    return !!cena()?.conflito;
}

/** Por que o Encerrar Turno está travado — a tela tem de dizer o que fazer. */
function motivoConflito() {
    const cf = cena()?.conflito;
    if (!cf || (T.isMaster && T.mode === 'secret')) return '';
    return cf.fase === 'fim'
        ? 'Feche a janela do conflito antes de passar a vez'
        : 'Termine o conflito aberto antes de passar a vez';
}

window.tbTurnoEncerrar = async () => {
    if (conflitoPendente()) { toast('⚠️ ' + motivoConflito(), 'warning'); return; }
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

/**
 * 😮‍💨 Recuperar Fôlego (Livro §6.2): passa o turno INTEIRO parado — sem mover,
 * sem atacar — e recupera 1 Energia. Só dentro do combate (fora dele quem
 * devolve Energia são os descansos). O crédito respeita o máximo da ficha;
 * token sem Energia rastreada só registra no chat para a mesa anotar.
 */
window.tbTurnoFolego = async () => {
    const c = cena();
    const p = participanteDaVez(c);
    if (!p || !podeGastar(c.acoesTurno, 'completa')) return;
    const r = temDoRecurso(p, 'Energia');
    if (r?.tem != null && r?.max != null && Number(r.tem) >= Number(r.max)) {
        toast('⚡ Energia já está no máximo', 'warning'); return;
    }
    sub = null;
    await gastar('completa');
    if (r?.tem != null) {
        const novo = r.max != null ? Math.min(Number(r.max), Number(r.tem) + 1) : Number(r.tem) + 1;
        await creditarRecurso(p, 'Energia', novo);
        logChat(`😮‍💨 ${p.name || '?'} gasta o turno inteiro recuperando o fôlego: +1 Energia (${r.tem} → ${novo})`);
        toast('😮‍💨 Fôlego recuperado: +1 Energia');
    } else {
        logChat(`😮‍💨 ${p.name || '?'} gasta o turno inteiro recuperando o fôlego (+1 Energia — anote na ficha)`);
        toast('😮‍💨 Fôlego recuperado — anote a Energia na ficha');
    }
};

/** ⚡ Usa o turno guardado AGORA: interrompe a ordem; ao encerrar, volta. */
window.tbTurnoAgirAgora = async (pid) => {
    const c = cena();
    const p = (c.participantes || []).find(x => x.id === pid);
    if (!p || !guardadoValido(c, p) || c.retomar) return;
    // O guardado só vale uma vez e interrompe a ordem de todo mundo — clique
    // sem querer aqui custa o turno inteiro, então confirma.
    const daVez = participanteDaVez(c);
    if (!await confirmar(
        `${p.name || 'Este personagem'} interrompe no meio do turno de ${daVez?.name || '?'}.\n\n`
        + 'O turno guardado é consumido e a ordem volta ao normal quando ele encerrar.',
        { titulo: '⚡ Agir agora?', ok: 'Agir agora' })) return;
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
    const desc = await perguntar(`O que ${p?.name || 'o personagem'} faz?`,
        { titulo: custo === 'movimento' ? 'Ação de Movimento' : 'Ação Padrão' });
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

/**
 * 💀 O que a PEÇA aplica ao acertar — arma e munição somam.
 *
 * A flecha envenenada envenena porque o cadastro dela diz isso, não porque
 * alguém escreveu "flecha envenenada" em algum `if`. Arma e projétil entram
 * juntos: as duas encostaram no alvo.
 */
function condicoesDoEquipamento(golpe, projetil) {
    const ids = [...new Set([...(golpe?.condicaoIds || []), ...(projetil?.condicaoIds || [])]
        .map(x => (typeof x === 'object' && x) ? x.id : x).filter(Boolean))];
    return ids.map(id => {
        const c = (T.condicoesSistema || []).find(x => x.id === id);
        return c ? { nome: c.nome, rodadas: 0, maxAlvos: 0, deItem: true } : null;
    }).filter(Boolean);
}

window.tbTurnoGolpe = async (i) => {
    const g = golpesCache?.linhas?.[i]; if (!g) return;
    const p = participanteDaVez(cena());
    const tok = tokenAtivoDoCombate();
    if (!tok) { toast('⚠️ O participante da vez não tem token neste canvas', 'warning'); return; }
    const meta = {
        nome: g.nome, efeito: g.dano ? `dano ${g.dano}` : '', custoAcao: 'padrao',
        golpe: metaDoGolpe(g),
    };
    // 🏹 A munição vale para o ATAQUE COMUM também, não só para a manobra que
    // dispara. Sem esta linha o arco atirava de aljava vazia e nunca gastava
    // flecha: só o caminho das habilidades passava pelo pedágio.
    const proj = await municaoParaOGolpe(p, g);
    if (proj === false) return;   // sem munição, ou cancelou: nada gasto
    if (proj) meta.projetil = proj;
    meta.condicoesItem = condicoesDoEquipamento(g, proj);
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
    // 🎼 INSTRUMENTO não dá bordoada: ele SOA. A forma e o tamanho saem da
    // família e da Qualidade da peça (shared/instrumento-area.js) — a Rabeca
    // mirava como espada porque nada aqui sabia que ela era um instrumento.
    const area = areaDoInstrumento(g.tags, g.qualidade);
    if (area) {
        armarMira({
            tipo: 'geometria', forma: area.forma,
            origem: area.forma === 'circulo' ? 'token' : 'token',
            raioM: area.metros, comprimentoM: area.metros,
            larguraM: Math.max(1, area.metros / 3),
            angGraus: area.ang || 60, alcanceM: 0, maxAlvos: 99, afeta: 'inimigos',
            meta: { ...meta, detalhe: explicaArea(area) },
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
        const forma = s.custos[formaPaga];
        const f = faltaPara(p, forma);
        if (f) { toast(`⚠️ Não tem ${f.nome} o suficiente (${f.tem}/${f.qtd})`, 'warning'); return; }
        if (forma.pool) {
            // 🎵 Bolsa: quem toca reparte os pontos entre as moedas antes de mirar
            const partes = await repartirBolsa(s, forma);
            if (!partes) return;                       // cancelou: nada foi gasto
            _custosAPagar = partes;
        } else {
            // uma forma pode ser composta ("1 Energia + 2 Sanidade"): paga inteira
            _custosAPagar = forma.partes;              // debitado na confirmação da mira
        }
        _retornoCfg = s.retorno;
    } else {
        // Sem custo cadastrado: o campo livre da ficha ainda avisa, mas não há
        // o que debitar — inventar um débito aqui cobraria a moeda errada.
        const falta = recursoInsuficiente(s.custo, recursosDe(p));
        if (falta) { toast(`⚠️ Não tem ${RECURSO_NOME[falta.recurso]} o suficiente (${falta.tem}/${falta.qtd})`, 'warning'); return; }
        _custosAPagar = [];
        _retornoCfg = s.retorno;
    }
    // 🕯️ Ritual fora de combate: não gasta ação do turno e não tem alvo no
    // mapa. Cobra o recurso, registra no chat e devolve a cena para a mesa —
    // pedir uma mira para um rito de oito horas nunca fez sentido.
    // 🕯️ Sem botão no painel, este ramo é rede de segurança: se um ritual
    // chegar aqui por outro caminho (atalho, cadastro novo, chamada externa),
    // ele NÃO pode gastar a ação do turno nem pedir mira. Era exatamente isso
    // que acontecia antes de `acaoDoRotulo` conhecer "Fora de combate".
    if (custo === 'fora') {
        sub = null;
        await pagarCustos(p);
        logChat(`🕯️ ${p?.name || '?'} realizou ${s.nome}${s.custo ? ` · custo: ${s.custo}` : ''} — ritual fora de combate`);
        toast(`🕯️ ${s.nome}: ritual fora de combate — sem alvo no mapa`);
        render();
        return;
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
        // ᛟ A peça que vai gastar um uso, e o Alvo gravado nela. A janela de
        // conflito lê `semRolagem` para não rolar dado nenhum (Lei do Relógio).
        if (s._runa) {
            cfg.meta.runaItemId = s._runa.itemId;
            cfg.meta.semRolagem = true;
            // 🧱 O que o Manifestador constrói, e com que matéria. Sem isto o
            // Tabuleiro miraria o chão e não poria nada nele.
            cfg.meta.manifestacao = s._runa.bloco.manifestacao || null;
            cfg.meta.manifestaCom = s._runa.bloco.mira || null;
            cfg.meta.golpe = {
                nome: s.nome, dano: s._runa.bloco.dano || '',
                acerto: s._runa.bloco.alvo || 0,
                acertoNome: 'Alvo da Runa', acertoIcone: 'ᛟ',
                tipos: [],
                // ᛟ Runa com canal de Essência: dano de Essência, barrado só pela Blindagem Arcana.
                essencia: s._runa.bloco.canal && s._runa.bloco.canal !== 'Dano' ? String(s._runa.bloco.canal).replace(/^Dano /, '') : null,
                distancia: true, desarmado: false,
            };
        }
        // 🎲 Quantidade que sai do DADO: habilidade com `alvosPorGraus` rola a
        // conjuração ANTES de mirar, e os Graus dizem quantos alvos/locais
        // cabem. Falhou, não há o que mirar — a ação já foi gasta.
        if (s.mira.alvosPorGraus) {
            const n = await alvosPelosGraus(p, s, cfg, custo);
            if (n === false) return;       // cancelou o picker: nada gasto
            if (n === 0) return;           // falhou: já gastou e logou
            cfg.maxAlvos = n;
        }
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
        cfg.meta.condicoesItem = condicoesDoEquipamento(golpe, proj);
        armarMira(cfg, tok);
        sub = null;
        return;
    }
    // 🛑 Registro fora do ar NÃO é "sem cadastro". Antes isto caía no mesmo
    // diálogo manual e parecia falta de cadastro numa habilidade que estava
    // cadastrada. Falha de leitura tem de dizer que é falha de leitura.
    if (s.diagnostico?.registroIndisponivel) {
        toast('⚠️ O registro do sistema não carregou — recarregue a página antes de usar habilidades', 'danger');
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
/**
 * 🎲 Quantos alvos/locais a habilidade rende NESTE uso.
 *
 * Habilidade cadastrada com "quantidade pelos Graus" (Convocar Manada) rola a
 * conjuração antes de mirar: o Alvo sai da forma de conjurar escolhida, e cada
 * Grau de Sucesso vale um alvo a mais. Passar com Grau 0 já rende 1 — passou,
 * veio pelo menos um. Falhar não rende nada, e a ação foi gasta assim mesmo.
 *
 * @returns número de alvos · 0 se falhou · false se o jogador cancelou
 */
async function alvosPelosGraus(p, s, cfg, custo) {
    const linhas = await golpesDe(p);
    let acerto = null, comQue = '';
    if (s.veiculos?.length) {
        const formas = await formasDeConjurar(p, s.veiculos, linhas);
        const livres = formas.filter(f => !f.indisponivel);
        if (!livres.length) {
            await escolherGolpe(`🪄 ${esc(p?.name || 'O personagem')} não tem como conjurar “${esc(s.nome)}” agora`,
                formas, 'Nenhuma das formas desta magia está disponível — veja o motivo em cada uma.');
            return false;
        }
        const escolhido = livres.length === 1 ? livres[0]
            : await escolherGolpe(`🪄 Como ${esc(p?.name || 'o personagem')} conjura “${esc(s.nome)}”?`,
                formas, 'O Acerto da rolagem decide quantos alvos a habilidade rende.');
        if (!escolhido) return false;
        acerto = escolhido.acerto; comQue = escolhido.nome || '';
    }
    if (acerto == null) {
        toast('⚠️ Esta habilidade rende alvos pelos Graus, mas a forma de conjurar não tem Acerto na ficha', 'warning');
        return false;
    }

    const dado = 1 + Math.floor(Math.random() * 10);
    const graus = grausDoAtaque(acerto, dado);
    const passou = dado !== 10 && graus >= 0;
    const teto = Number(cfg.maxAlvos) || 99;
    const quantos = passou ? Math.max(1, Math.min(graus || 1, teto)) : 0;

    logChat(`🎲 ${p?.name || '?'} conjura ${s.nome}${comQue ? ` (${comQue})` : ''}: `
        + `1d10 = ${dado} vs Alvo ${acerto} → ${passou ? `${graus} Grau(s)` : 'falhou'}`
        + (passou ? ` · ${quantos} alvo(s)` : ''));

    if (!passou) {
        await gastar(custo);
        await pagarCustos(p);
        // 🎵 Quem devolve recurso ao fim do turno perde o retorno ao errar
        // (Bardo: "e perde tudo se errar") — o mesmo caminho do conflito.
        try { await marcarFalhaDeConjuracao(p.id); } catch (e) { /* sem retorno cadastrado */ }
        toast(`🎲 ${s.nome}: falhou (1d10 = ${dado} vs ${acerto})`, 'warning');
        render();
        return 0;
    }
    toast(`🎲 ${dado} vs ${acerto} → ${graus} Grau(s): até ${quantos} alvo(s)`);
    return quantos;
}

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

/**
 * 🎵 REPARTIR A BOLSA (Bardo): a canção custa N, e quem toca decide de onde
 * sai cada ponto. Abre com tudo na primeira moeda que der conta e deixa
 * ajustar; o ✅ só libera quando a soma fecha o total exato.
 * @returns Promise<partes[]|null> — null = cancelou
 */
function repartirBolsa(s, forma) {
    const p = participanteDaVez(cena());
    const temDe = (m) => temDoRecurso(p, m)?.tem ?? null;
    const moedas = forma.moedas || [];
    // sugestão: enche na ordem das moedas com o que cada uma aguenta
    const sug = {}; let resta = forma.total;
    for (const m of moedas) {
        const tem = temDe(m);
        const usa = tem == null ? resta : Math.min(resta, Math.max(0, tem));
        sug[m] = usa; resta -= usa;
    }
    if (resta > 0 && moedas.length) sug[moedas[0]] += resta;   // desconhecido: cai na primeira

    return new Promise(resolve => {
        window.__tbBolsaOk = () => {
            const split = {};
            for (const m of moedas) split[m] = parseFloat(document.getElementById('bolsa_' + normChaveMoeda(m))?.value) || 0;
            const v = reparticaoValida(forma, split, temDe);
            if (!v.ok) { toast(`⚠️ ${v.porque}`, 'warning'); return; }
            delete window.__tbBolsaOk; delete window.__tbBolsaCancel;
            window.tbFecharModal();
            resolve(partesDaReparticao(forma, split));
        };
        window.__tbBolsaCancel = () => {
            delete window.__tbBolsaOk; delete window.__tbBolsaCancel;
            window.tbFecharModal(); resolve(null);
        };
        window._tbAbrirModal(`💰 “${esc(s.nome)}” custa ${forma.total}`, `
            <div class="tb-muted" style="font-size:.8rem;margin-bottom:10px">
                Reparta como quiser entre as moedas — a soma tem que dar <b>${forma.total}</b>.
            </div>
            <div class="tb-form-grid">
                ${moedas.map(m => {
                    const tem = temDe(m);
                    return `<label>${esc(m)} ${tem != null ? `<span class="tb-muted">(tem ${tem})</span>` : ''}
                        <input type="number" id="bolsa_${normChaveMoeda(m)}" value="${sug[m] || 0}" min="0"
                               ${tem != null ? `max="${tem}"` : ''} step="any"></label>`;
                }).join('')}
            </div>
            <div class="tb-modal-actions">
                <button class="tb-btn tb-btn-success" onclick="__tbBolsaOk()">✅ Pagar</button>
                <button class="tb-btn" onclick="__tbBolsaCancel()">✖ Cancelar</button>
            </div>`);
    });
}
const normChaveMoeda = (m) => String(m || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]/g, '');

/** Skill com mais de uma forma de pagar: quem usa escolhe qual recurso gasta. */
function escolherComoPagar(s, custoAcao, i, pagaveis) {
    const p = participanteDaVez(cena());
    window._tbAbrirModal(`💰 Como pagar “${esc(s.nome)}”?`, `
        <div class="tb-muted" style="font-size:.8rem;margin-bottom:10px">Esta habilidade aceita mais de uma forma de pagamento — escolha qual recurso gastar:</div>
        ${pagaveis.map(({ c, k }) => {
            // Cada parte da forma mostra quanto o personagem tem daquela moeda
            const tem = (c.partes || []).map(parte => {
                const r = temDoRecurso(p, parte.alvo);
                return r?.tem != null ? `${esc(r.nome)} ${r.tem}` : null;
            }).filter(Boolean).join(' · ');
            return `<button class="tb-btn tb-btn-small" style="display:block;width:100%;margin-bottom:6px;text-align:left"
                onclick="tbFecharModal();tbTurnoSkill('${custoAcao}',${i},${k})">
                ${esc(c.label || 'Pagar')} — <b>${esc(c.rotulo)}</b>${tem ? ` <span class="tb-muted">(tem ${tem})</span>` : ''}</button>`;
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
        logChat(`💰 ${p.name || '?'}: −${custo.qtd} ${r.nome} (${r.tem} → ${novo})`);
    } catch (e) { console.warn('pagar custo', e); }
}

/**
 * O alcance do DISPARO deste participante: o maior tiro que ele tem em mãos,
 * já cortado pela FOR (ver shared/alcance-disparo.js). Sem arma de tiro — ou
 * com o alcance dela não cadastrado — dá 0, e a mira não abre.
 */
function alcanceDoDisparoDe(p) {
    const fonte = fonteDoParticipante(p);
    const forca = valorComponente('FOR', fonte);
    // 🤾 Peça de arremesso não tem alcance próprio: chega até onde o braço
    // joga (FOR + Atletismo + Arremessar × N). valorComponente devolve null
    // quando não acha, e null vira 0 dentro de bracoDeArremesso.
    const braco = bracoDeArremesso(forca,
        valorComponente('Atletismo', fonte), valorComponente('Arremessar', fonte));
    return melhorDisparo(golpesCacheados(p) || [], forca, braco);
}

/**
 * Uma medida da mira já resolvida em metros para ESTE conjurador.
 * O cadastro pode trazer número ("4") ou fórmula da ficha ("(Liderança + PRE)"
 * — o Raio de ERGUER FANTOCHES). Quem resolve o nome é o valorComponente, que
 * já acha atributo, perícia e Valor Derivado tanto em ficha quanto em NPC.
 */
function medidaDaMira(v, p, padrao = 0) {
    const fonte = fonteDoParticipante(p);
    return resolverMedida(v, (nome) => valorComponente(nome, fonte), { padrao });
}

/**
 * 🌀 Fecha uma incorporação: calcula a Dádiva, aplica as sobras como bônus
 * temporários, põe Em Transe no corpo que ficou para trás e — no Projetor —
 * passa o controle do token do hóspede para o dono do personagem.
 *
 * Tudo mora no participante da cena: some quando a cena acabar, e o doc do
 * personagem no banco não é tocado.
 */
async function aplicarIncorporacao(m, p, tok, tokAlvo) {
    const c = cena();
    const pAlvo = participanteDoToken(tokAlvo);
    const hospede = pAlvo?.npcId ? T.npcs.find(x => x.id === pAlvo.npcId) : null;
    if (!hospede || !pAlvo) { toast('⚠️ O alvo não tem ficha para incorporar', 'warning'); cancelarMira(); return; }

    const modo = m.incorporacao;                       // 'receptor' | 'projetor'
    const meta = m.meta || {};
    const custoAcao = meta.custoAcao || 'padrao';
    const ancestral = ehAncestral(hospede);

    // As sobras: o que o hóspede tem de melhor que quem conjura. O catálogo diz
    // o que é Sentido, Deslocamento e perícia social — quem classifica é o
    // CADASTRO, não este arquivo.
    let cat = { derivedValues: [], pericias: [], auras: [] };
    try {
        const sys = await (await import('./tab-ficha-win.js?v=14')).registroSistema();
        cat = { derivedValues: sys.derivedValues || [], pericias: sys.skills || [], auras: sys.auras || [] };
    } catch (e) {
        console.warn('registro do sistema p/ Dádiva', e);
        toast('⚠️ Registro do sistema indisponível — a Dádiva não pôde ser calculada', 'warning');
        cancelarMira(); return;
    }
    const fontePersonagem = fonteDoParticipante(p);
    const fichaHospede = achatarFicha(hospede, cat);
    const fichaPersonagem = achatarFicha(fontePersonagem, cat);
    // ⛔ Teto do herdado: 5 sem Aura, +1 por grau de Aura ligada ao atributo
    // (Yotun 6 de FOR), e teto racial declarado vence tudo (Pogo 3). Sem isto
    // um Eco poderoso levava um personagem comum além do teto do sistema.
    const teto = (sigla) => tetoDoAtributo(sigla, {
        auras: fontePersonagem?.auras || {},
        catalogoAuras: cat.auras || [],
        tetoRacial: fontePersonagem?.tetoRacialAtributo || null,
    });
    // 🎲 O Mestre rola antes de qualquer coisa ser gasta. Cancelar aqui não
    // custa ação nem recurso — por isso a janela vem antes do `gastar`.
    // Os dois modos cobram Sanidade, mas por medidas diferentes, e misturá-las
    // é o erro que estava aqui: o Projetor pagava pelas unidades da Dádiva, que
    // são cortadas pelo TETO de quem recebe — logo mediam o espaço que sobrava
    // na ficha do Xamã, não a força do hóspede. Veterano no teto pagava zero.
    let ganhos = [], modulos = [], unidades = 0;
    let extra = { sanidade: 0, excedente: 0 }, notaCusto = '';

    if (modo === 'receptor') {
        // 🎲 O Mestre rola antes de qualquer coisa ser gasta.
        const chaves = dadivasDoHospede(hospede, m.exigeVinculo);
        const linhas = mesaDeSorteio(chaves, fichaHospede, cat);
        let sorteio;
        if (linhas.length) {
            const escolhas = await janelaDeSorteio(hospede, linhas, modo);
            if (!escolhas) { cancelarMira(); return; }
            sorteio = sorteioDoMestre(escolhas);
        }
        const dadivas = chaves
            .map(k => calcularDadiva(k, fichaHospede, fichaPersonagem, cat, { ancestral, teto, sorteio }))
            .filter(d => d && (d.ganhos.length || d.modulos.length));
        ganhos = dadivas.flatMap(d => d.ganhos);
        modulos = dadivas.flatMap(d => d.modulos);
        unidades = dadivas.reduce((t, d) => t + (d.unidades || 0), 0);
        extra = custoEscalonado(unidades);
    } else {
        // 🌫️ A projeção não recebe Dádiva — não há o que sortear. Paga pelo
        // Poder do hóspede e pela profundidade da camada.
        // Alvo do teste desta habilidade, quando o cadastro declara um — serve
        // só para a janela mostrar quanto o Redutor do Véu deixa dele.
        const alvoBase = Number.isFinite(meta.golpe?.acerto) ? meta.golpe.acerto : null;
        const veu = await janelaDoVeu(hospede, (v) => custoDaProjecao(hospede, v), alvoBase);
        if (!veu) { cancelarMira(); return; }
        const c = custoDaProjecao(hospede, veu);
        extra = { sanidade: c.sanidade, excedente: 0 };
        notaCusto = ` · Poder ${c.poder}, Véu ${veu}`
            + (c.redutor ? ` · Redutor ${c.redutor} no teste de Transcendência`
                + (alvoBase != null ? ` (Alvo ${alvoBase} → ${alvoBase - c.redutor})` : '') : '');
    }

    // Receptor leva as sobras; Projetor vai para o corpo do hóspede e não
    // ganha empréstimo nenhum — ele passa a JOGAR o hóspede.
    const bonus = modo === 'receptor' ? bonusDosGanhos(ganhos, `${meta.nome}: ${hospede.nome || '?'}`) : [];
    const { inerte } = quemFicaInerte(modo);
    const pidInerte = inerte === 'hospede' ? pAlvo.id : p.id;

    T.mira = null; markDirty();
    await gastar(custoAcao);
    await pagarCustos(p);

    // Um write só com tudo: bônus, controle e a marca de que a cena tem uma
    // incorporação aberta (é por ela que o desfazer encontra o par).
    const parts = (c.participantes || []).map(x => {
        if (x.id === p.id) {
            return modo === 'receptor'
                ? { ...x, bonusTemp: bonus, modulosEmprestados: modulos, incorporacao: { modo, com: pAlvo.id, nome: hospede.nome || '' } }
                : { ...x, incorporacao: { modo, com: pAlvo.id, nome: hospede.nome || '' } };
        }
        if (x.id === pAlvo.id && modo === 'projetor') {
            return { ...x, controladoPor: p.characterId || null, incorporacao: { modo: 'hospedeiro', com: p.id, nome: p.name || '' } };
        }
        return x;
    });
    await salvarCena({ participantes: parts });

    if (extra.sanidade > 0) await pagarCusto(p, { alvo: 'Sanidade', qtd: extra.sanidade });
    await aplicarCondicaoEmVarios([pidInerte], CONDICAO_TRANSE, 0, p.id)
        .catch(e => console.warn('Em Transe', e));

    const resumo = ganhos.length ? ganhos.map(rotuloDoGanho).join(' · ') : 'nada a emprestar';
    logChat(`🌀 ${p.name || '?'} — ${meta.nome} (${modo === 'projetor' ? 'Projetor' : 'Receptor'}) com ${hospede.nome || '?'}`
        + (ancestral ? ' [Ancestral: dobro]' : '')
        + (modo === 'receptor' ? ` → ${resumo}` : ` → passa a agir pelo corpo dele, na iniciativa dele`)
        + (modulos.length ? ` · ✨ ${modulos.length} módulo(s) de habilidade emprestado(s)` : '')
        + (modo === 'receptor' ? ` · entrega ${unidades.toFixed(2)} un` : notaCusto)
        + (extra.sanidade ? ` · −${extra.sanidade} Sanidade` + (extra.excedente ? ` pelo excedente (${extra.excedente.toFixed(2)} un)` : '') : ''));

    toast(modo === 'projetor'
        ? `🌀 ${p.name || '?'} projetou-se em ${hospede.nome || '?'} — jogue pelo token dele`
        : `🌀 ${resumo}${extra.sanidade ? ` · −${extra.sanidade} SAN` : ''}`);
    render();
}

/**
 * 🌀 Vórtice na Fenda: quem conjura e o token tocado somem daqui e aparecem no
 * destino escolhido. Os dois vão juntos e lado a lado.
 */
async function aplicarTeleporte(m, p, tok) {
    const destino = (m.locais || [])[0];
    if (!destino) { toast('⚠️ Escolha o destino', 'warning'); return; }
    const meta = m.meta || {};
    const custo = meta.custoAcao || 'padrao';
    const gs = gridSize();
    const levados = [tok, ...(m.alvos || []).map(id => T.objects.get(id)).filter(Boolean)]
        .filter((o, i, a) => o && a.indexOf(o) === i);

    T.mira = null; markDirty();
    await gastar(custo);
    await pagarCustos(p);

    // Lado a lado no destino, para dois tokens não ocuparem o mesmo ponto
    levados.forEach((o, i) => {
        const dx = i === 0 ? 0 : gs * (i % 2 ? 1 : -1) * Math.ceil(i / 2);
        updObj(o.id, { x: destino.x + dx, y: destino.y });
    });

    logChat(`🌀 ${p.name || '?'} usou ${meta.nome || 'Vórtice'} → ${levados.map(o => o.nome || '?').join(' e ')} `
        + `atravessam para (${Math.round(destino.x / gs)}, ${Math.round(destino.y / gs)})`);
    toast(`🌀 ${levados.length} atravessaram a fenda`);
    render();
}

/**
 * 🕯️ Invocação Abissal: o rito ocupa rodadas. Marca o participante, cobra o
 * custo agora e deixa o resto para o fim de cada rodada (tab-combat avança as
 * etapas). Enquanto dura, quem conjura não tem Defesa.
 */
async function comecarRitualDaSkill(m, p) {
    const c = cena();
    const meta = m.meta || {};
    T.mira = null; markDirty();
    await gastar(meta.custoAcao || 'padrao');
    await pagarCustos(p);

    const ritual = comecarRitual({
        nome: meta.nome || 'Ritual', rodadas: m.ritualRodadas,
        rodadaAtual: c?.rodada || 1, semDefesa: !!m.ritualSemDefesa,
    });
    await salvarCena({
        participantes: (c.participantes || []).map(x => x.id === p.id ? { ...x, ritual } : x),
    });
    logChat(`🕯️ ${p.name || '?'} começou ${ritual.nome} — ${ritual.total} rodadas`
        + (ritual.semDefesa ? ', e não pode se defender enquanto dura' : '')
        + `. Cada rodada resolve uma parte dos passos.`);
    toast(`🕯️ ${ritual.nome}: ${ritual.total} rodadas${ritual.semDefesa ? ' · sem Defesa' : ''}`);
    render();
}

/**
 * ⏪ Estilhaçar Causa: o alvo volta ao estado de antes do último turno dele.
 * Volta para onde estava, e o dano que causou desde então se recupera.
 * O retrato foi tirado por tab-combat no começo do turno do alvo.
 */
async function desfazerTurnoDoAlvo(m, p, tokAlvo) {
    const c = cena();
    const pAlvo = participanteDoToken(tokAlvo);
    const meta = m.meta || {};
    const custo = meta.custoAcao || 'padrao';

    T.mira = null; markDirty();
    await gastar(custo);
    await pagarCustos(p);

    const retrato = pAlvo?.retratoTurno;
    if (!retrato) {
        logChat(`⏪ ${p.name || '?'} usou ${meta.nome} em ${tokAlvo.nome || '?'} — mas não há turno dele registrado para desfazer`);
        toast('⏪ Este alvo ainda não teve turno nesta cena — nada a desfazer', 'warning');
        render(); return;
    }

    const agora = {
        tokens: [...T.objects.values()].filter(o => o.tipo === 'token').map(o => ({ id: o.id, x: o.x, y: o.y })),
        vitais: (c.participantes || []).map(x => {
            if (x.characterId) { const v = VITAIS.get(x.characterId); return { pid: x.id, vit: v?.hp ?? null }; }
            return { pid: x.id, vit: T.npcs.find(n => n.id === x.npcId)?.valoresDer?.atual?.VIT ?? null };
        }),
    };
    const d = oQueDesfazer(retrato, agora);

    for (const t of d.tokens) updObj(t.id, { x: t.x, y: t.y });
    for (const v of d.vitais) {
        const alvoP = (c.participantes || []).find(x => x.id === v.pid);
        if (alvoP) await window.tbCombSetVital?.(v.pid, 'VIT', v.vit);
    }

    const quem = d.vitais.map(v => (c.participantes || []).find(x => x.id === v.pid)?.name || '?');
    logChat(`⏪ ${p.name || '?'} usou ${meta.nome} em ${tokAlvo.nome || '?'} — o último turno dele foi desfeito`
        + (d.tokens.length ? ` · voltou para onde estava` : '')
        + (quem.length ? ` · dano recuperado em ${quem.join(', ')}` : ''));
    toast(`⏪ Turno de ${tokAlvo.nome || '?'} desfeito`);
    render();
}

/** Ficha achatada no formato que a Dádiva consome. */
function achatarFicha(f, cat) {
    if (!f) return { vds: {}, atributos: {}, pericias: {}, vitais: {}, modulos: [] };
    const vds = {};
    for (const dv of (cat.derivedValues || [])) {
        const v = valorComponente(dv.nome, f);
        if (v != null) vds[dv.key || dv.nome] = Number(v) || 0;
    }
    const atributos = {};
    for (const a of ['FOR', 'DES', 'VIG', 'INT', 'RAC', 'PRS', 'PRE', 'MAN', 'AUT']) {
        const v = valorComponente(a, f);
        if (v != null) atributos[a] = Number(v) || 0;
    }
    const pericias = {};
    for (const s of (cat.pericias || [])) {
        const v = valorComponente(s.nome, f);
        if (v != null) pericias[s.nome] = Number(v) || 0;
    }
    const vt = VITAIS.get(f.id) || null;
    const vitais = {
        vitMax: vt?.hpMax ?? Number(f.valoresDer?.overrides?.VIT) ?? 0,
        enerMax: vt?.enerMax ?? Number(f.valoresDer?.overrides?.ENER) ?? 0,
    };
    const modulos = (f.modulosClasse || []).map(x => x.refId).filter(Boolean);
    return { vds, atributos, pericias, vitais, modulos };
}

/**
 * Desfaz a incorporação: o empréstimo sai, o controle volta e o Em Transe é
 * removido dos dois lados. Chamado quando a condição sai ou a cena fecha.
 */
window.tbTurnoDesfazerIncorporacao = async (pid) => {
    const c = cena();
    const p = (c?.participantes || []).find(x => x.id === pid);
    if (!p?.incorporacao) return;
    const parceiro = p.incorporacao.com;
    const parts = (c.participantes || []).map(x => {
        if (x.id !== pid && x.id !== parceiro) return x;
        const { incorporacao, bonusTemp, modulosEmprestados, controladoPor, ...limpo } = x;
        return limpo;
    });
    await salvarCena({ participantes: parts });
    logChat(`🌀 ${p.name || '?'}: a incorporação com ${esc(p.incorporacao.nome || '?')} terminou — o emprestado voltou`);
    render();
};

/** Converte a mira CADASTRADA (metros) para o runtime (px no ponto do token). */
function miraDoCadastro(m, s, custo, p) {
    // 🏹 Alcance que sai da ARMA, não do cadastro: a manobra do Caçador vale
    // até onde a flecha dele chega, e isso muda quando ele troca de arco.
    // 👁️ "Alcance da visão": vale até onde o token ENXERGA — já cortado pelas
    // condições (Cego zera, Ofuscado corta pela metade). É o alcance da
    // incorporação: o Xamã comunga com o Eco que consegue ver.
    const tokV = tokenAtivoDoCombate();
    const alcance = m.alcanceVisao ? alcanceDeVisaoDoToken(tokV, derivedDoToken(tokV), T.canvas?.luzDinamica?.modo === 'dia')
        : m.alcanceDoDisparo ? alcanceDoDisparoDe(p).metros
        : medidaDaMira(m.alcanceM, p);
    return {
        tipo: m.tipo, forma: m.forma || 'circulo', origem: m.origem || 'token',
        alcanceM: alcance, raioM: medidaDaMira(m.raioM, p),
        comprimentoM: medidaDaMira(m.comprimentoM, p), larguraM: medidaDaMira(m.larguraM, p),
        angGraus: Number(m.angGraus) || 60, maxAlvos: Number(m.maxAlvos) || 1,
        afeta: m.afeta || 'todos',
        // 🌀 Incorporação: quem o alvo tem de ser, e o que acontece ao confirmar
        exigeVinculo: m.exigeVinculo || null,
        incorporacao: m.incorporacao || null,
        // 🕯️/⏪/🌀 mecânicas que atravessam o turno
        ritualRodadas: Number(m.ritualRodadas) || 0,
        ritualSemDefesa: !!m.ritualSemDefesa,
        desfazTurno: !!m.desfazTurno,
        depoisLocais: Number(m.depoisLocais) || 0,
        alcanceDestinoM: m.alcanceDestinoM ?? null,
        meta: {
            nome: s.nome, efeito: s.efeito, custoSkill: s.custo, custoAcao: custo,
            condicao: m.condicaoNome ? { nome: m.condicaoNome, rodadas: Number(m.condicaoRodadas) || 0, maxAlvos: Number(m.condicaoMaxAlvos) || 0 } : null,
            condicoes: m.condicoes || [],
            condicoesExclusivas: !!m.condicoesExclusivas,
            portao: m.condicaoPortao || null,
        },
    };
}

/**
 * ⚖️ "Escolha na conjuração: X, OU Y."
 *
 * Habilidade marcada como exclusiva no cadastro entrega UMA das condições, não
 * todas. Antes disso existir, a Composição de Batalha aplicava a lista inteira
 * em todo mundo que a onda pegasse.
 *
 * @returns Promise<condição escolhida | null se cancelou>
 */
function escolherCondicaoExclusiva(nomeSkill, condicoes) {
    return new Promise(resolve => {
        window.__tbCondEscolhida = (i) => {
            delete window.__tbCondEscolhida;
            window.tbFecharModal?.();
            resolve(i < 0 ? null : condicoes[i]);
        };
        window._tbAbrirModal(`⚖️ Qual efeito de “${esc(nomeSkill || 'habilidade')}”?`, `
            <div class="tb-muted" style="font-size:.8rem;margin-bottom:10px">Esta habilidade entrega <b>um</b> dos efeitos — escolha qual:</div>
            ${condicoes.map((cd, i) => `<button class="tb-btn tb-btn-small" style="display:block;width:100%;margin-bottom:6px;text-align:left"
                onclick="__tbCondEscolhida(${i})">☠️ <b>${esc(rotuloDaCondicao(cd))}${cd.nivel > 1 ? ' ' + cd.nivel : ''}</b>
                ${cd.rodadas ? `<span class="tb-muted">· ${cd.rodadas} rodada(s)</span>` : ''}
                ${cd.maxAlvos ? `<span class="tb-muted">· até ${cd.maxAlvos} alvo(s)</span>` : ''}</button>`).join('')}
            <div class="tb-modal-actions"><button class="tb-btn" onclick="__tbCondEscolhida(-1)">✖ Cancelar</button></div>
        `);
    });
}

/**
 * 🧱 O Manifestador põe no mapa o que o projeto escolheu.
 *
 * As cinco manifestações não viram a mesma coisa: Parede e Plataforma são
 * GEOMETRIA (desenho na camada de tokens, e a parede entra na conta de
 * bloqueio de luz e passagem porque `desenho` já é o que o motor de visão
 * lê); Objeto e Forma orgânica viram LOOT, que o mapa já sabe criar e
 * anunciar; Escudo não vai ao chão — vai no corpo de quem foi mirado, como
 * Blindado.
 *
 * A duração é a do nível do Manifestador, e fica gravada no objeto: quem
 * limpa é o fim da cena, não este código.
 */
async function manifestarNoMapa(m, meta, p) {
    const chave = String(meta.manifestacao || '').toLowerCase();
    const cfgM = meta.manifestaCom || {};
    const gs = gridSize() || 50;
    const locais = (m.locais || []).length ? m.locais : (m.cursor ? [m.cursor] : []);
    if (!locais.length) { toast('⚠️ A manifestação precisa de um ponto no mapa', 'warning'); return; }
    const nome = meta.nome || 'Manifestação';
    const material = cfgM.material || 'essência';
    const dur = cfgM.duracao || '1 turno sem fluxo';
    // O volume vira tamanho no mapa: 0,1 m³ é um escudo, 2 m³ é uma parede de
    // verdade. A raiz cúbica é a aresta, e a aresta em metros vira quadrados.
    // A raiz cúbica do volume é a aresta em metros; `unidadesParaPx` converte
    // pela escala do MAPA sob o ponto — a mesma régua da fita métrica, senão a
    // parede sairia com tamanho errado em mapa de escala diferente.
    const arestaM = Math.max(0.5, Math.cbrt(Number(cfgM.volumeM3) || 0.1));
    const ref = locais[0] || null;
    const px = Math.max(gs * 0.5, unidadesParaPx(arestaM, ref));

    // 🕰️ O prazo entra no objeto AGORA, em rodada absoluta. Guardar "1 turno"
    // como texto obrigaria quem limpa a interpretar prosa; guardar a rodada em
    // que morre faz a limpeza ser uma comparação de número.
    const rodadaAtual = cena()?.rodada || 1;
    const rodadasDe = (txt) => /turno/i.test(txt) ? 1 : /minuto/i.test(txt) ? 10 : 0;   // 0 = a cena inteira
    const dura = rodadasDe(dur);
    const base = {
        layerId: 'tokens', visivelPublico: true,
        manifestacao: {
            runa: nome, chave, duracao: dur, material, porPid: p?.id || null,
            // null = dura a cena e some quando ela encerra
            expiraNaRodada: dura ? rodadaAtual + dura : null,
        },
    };

    try {
        if (chave === 'escudo') {
            // Não ocupa chão: veste quem foi mirado.
            const pids = (m.alvos || []).map(id => participanteDoToken(T.objects.get(id))?.id).filter(Boolean);
            const alvos = pids.length ? pids : (p?.id ? [p.id] : []);
            if (alvos.length) {
                await aplicarCondicaoEmVarios(alvos, 'Blindado', 0, p?.id, 1);
                logChat(`🛡️ ${nome}: escudo de ${material} em ${alvos.length} alvo(s) — dura ${dur}`);
            }
            return;
        }

        for (const loc of locais) {
            if (chave === 'parede' || chave === 'plataforma') {
                const meia = px / 2;
                const cantos = [{ x: loc.x - meia, y: loc.y - meia }, { x: loc.x + meia, y: loc.y + meia }];
                // A LAJE que se vê, na camada dos tokens.
                await addObj({
                    ...base, tipo: 'desenho', forma: 'ret', pontos: cantos,
                    cor: chave === 'parede' ? '#8b7355' : '#5b8ba8',
                    nome: `${nome} (${material})`,
                    vit: Math.max(1, Math.round((Number(cfgM.volumeM3) || 0.1) * 10)),
                });
                // ⚠️ E, só para a PAREDE, o segmento que BLOQUEIA — que tem de
                // ir na camada `luz`. Quem lê obstáculo é coletarParedes(), e
                // ela filtra por `layerId !== 'luz'`: desenho em qualquer outra
                // camada é pintura, não parede. Plataforma é chão onde não
                // havia — dá para pisar e dá para enxergar por cima.
                if (chave === 'parede') {
                    await addObj({
                        ...base, layerId: 'luz', tipo: 'desenho', forma: 'ret', pontos: cantos,
                        nome: `${nome} — bloqueio`,
                    });
                }
            } else {
                // objeto e forma orgânica: o mapa já sabe criar e anunciar loot
                await addObj({
                    ...base, tipo: 'loot', x: loc.x, y: loc.y,
                    nome: `${nome} (${material})`, quantidade: 1,
                    item: { nome: `${nome} (${material})`, quantidade: 1, tipo: 'Objeto',
                            descricao: `Manifestado por runa. Existe por ${dur}.` },
                });
            }
        }
        logChat(`🧱 ${nome}: ${locais.length} ${chave} de ${material} — dura ${dur}`);
    } catch (e) {
        console.error('manifestar no mapa', e);
        toast('❌ Não consegui manifestar no mapa — veja o console', 'danger');
    }
}

/**
 * ᛟ A peça perdeu um uso. Zerou, a INSTÂNCIA some da ficha — e o modelo fica
 * no catálogo, que é de onde sai a próxima cópia. Tatuagem não conta usos.
 */
async function gastarUsoDaRuna(itemId) {
    try {
        const m = await import('./tab-ficha-win.js?v=14');
        const p = participanteDaVez(cena());
        const itens = m.itensCarregados(p?.npcId ? 'npc' : 'char', p?.npcId || p?.characterId) || [];
        const item = itens.find(i => i.id === itemId);
        if (!item) return;
        const r = gastarUso(item);
        if (r.permanente) return;
        const { db: _db, doc: _doc, updateDoc: _upd, deleteDoc: _del } =
            await import('../../painel-mestre/js/firebase-config.js');
        if (r.acabou) {
            await _del(_doc(_db, 'items', itemId));
            logChat(`ᛟ ${item.nome || 'A runa'} gastou o último uso e se apagou — o cadastro dela fica no catálogo.`);
        } else {
            await _upd(_doc(_db, 'items', itemId), { usosRestantes: r.restante });
            logChat(`ᛟ ${item.nome || 'Runa'}: ${r.restante} uso(s) restante(s)`);
        }
        limparCacheGolpes();
    } catch (e) { console.warn('gastar uso da runa', e); }
}

/** As condições que a ação aplica: a lista nova, ou a única do formato antigo. */
function condicoesDaAcao(acao) {
    if (acao?.condicoes?.length) return acao.condicoes;
    return acao?.condicao?.nome ? [acao.condicao] : [];
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
        alvos: [], locais: [], travada: false,
    };
    render();
    markDirty();
    toast(cfg.tipo === 'alvos'
        ? `🎯 Clique nos alvos (até ${cfg.maxAlvos || 1}) e confirme`
        : cfg.tipo === 'locais'
            ? `📍 Clique em até ${cfg.maxAlvos || 1} ponto(s) VAZIO(s) do mapa e confirme`
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
    if (m.tipo === 'locais') {
        // 📍 Clique marca um pedaço de CHÃO; clique em cima de um já marcado
        // desmarca. Nada de token entra aqui — o alvo é o lugar.
        const raioMarca = gs * 0.4;
        const ja = localSob(m.locais, w, raioMarca);
        if (ja >= 0) { m.locais.splice(ja, 1); render(); markDirty(); return; }
        if (m.locais.length >= (m.maxAlvos || 1)) {
            toast(`⚠️ Máximo de ${m.maxAlvos || 1} local(is)`, 'warning'); return;
        }
        const rTok = ((tok.tamanhoCelulas || 1) * gs) / 2;
        const tokens = [...T.objects.values()]
            .filter(o => o.tipo === 'token')
            .map(o => ({ x: o.x, y: o.y, r: ((o.tamanhoCelulas || 1) * gs) / 2 }));
        const motivo = porqueLocalInvalido({ x: tok.x, y: tok.y }, rTok, m.alcancePx, w, tokens, gs * 0.5, m.locais);
        if (motivo) { toast(`⚠️ Não dá para escolher aqui: ${motivo}`, 'warning'); return; }
        m.locais.push({ x: w.x, y: w.y });
        render(); markDirty();
        return;
    }
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
        // 🌀 Incorporação: o alvo tem de ser um hóspede válido (Aliado Animal
        // vinculado à ficha, ou Eco). Não há seletor — a validação é aqui, e
        // "só na cena" sai de graça: fora dela não há token para clicar.
        if (m.exigeVinculo) {
            const pAlvo = participanteDoToken(alvo);
            const hospede = pAlvo?.npcId ? T.npcs.find(x => x.id === pAlvo.npcId) : null;
            const charId = participanteDaVez(cena())?.characterId;
            const motivo = porqueNaoPodeIncorporar({ hospede, charId, exige: m.exigeVinculo });
            if (motivo) { toast(`⚠️ ${alvo.nome || 'Alvo'}: ${motivo}`, 'warning'); return; }
        }
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
    // 'alvos' e 'locais' não têm forma seguindo o cursor: nada a repintar
    if (!m || m.travada || m.tipo === 'alvos' || m.tipo === 'locais') return;
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

    // 📍 Mira por LOCAIS: não atinge criatura nenhuma — o resultado é o chão
    // escolhido. Gasta a ação, cobra o recurso e deixa os pontos no chat, em
    // célula, para o mestre pôr o que a habilidade traz exatamente ali.
    if (m.tipo === 'locais') {
        const pts = m.locais || [];
        const meta = m.meta || {};
        const custo = meta.custoAcao || 'padrao';
        T.mira = null; markDirty();
        await gastar(custo);
        await pagarCustos(p);
        const emCelula = pts.map(q => `(${Math.round(q.x / gs)}, ${Math.round(q.y / gs)})`).join(' · ');
        logChat(`📍 ${p.name || '?'} usou ${meta.nome || 'ação'} em ${pts.length} local(is): ${emCelula}`
            + (meta.efeito ? ` · ${meta.efeito}` : '')
            + (meta.custoSkill ? ` · custo: ${meta.custoSkill}` : ''));
        toast(`📍 ${pts.length} local(is) marcado(s) — ponha no mapa o que a habilidade traz`);
        render();
        return;
    }

    // 🌀 Mira em dois estágios (Vórtice na Fenda): escolhidos os tokens que
    // vão junto, agora se escolhe PARA ONDE. Não confirma nada ainda.
    if (precisaSegundoEstagio(m, m.alvos) && m.estagio !== 2) {
        const nova = miraDoSegundoEstagio(m);
        T.mira = { ...m, ...nova, estagio: 2, locais: [],
            alcancePx: pxDe(medidaDaMira(nova.alcanceM, p), tok), travada: false };
        render(); markDirty();
        toast('🌀 Agora clique no destino — um ponto vazio do mapa');
        return;
    }
    // Chegou ao destino: leva quem foi tocado (e quem conjura) para lá.
    if (m.estagio === 2) { await aplicarTeleporte(m, p, tok); return; }

    // 🌀 Incorporação (Fusão Selvagem / Transcendência): resolve por caminho
    // próprio — não é ataque, não abre conflito, e o que sai é um empréstimo.
    if (m.incorporacao) {
        const alvo = T.objects.get((m.alvos || [])[0]);
        if (alvo) { await aplicarIncorporacao(m, p, tok, alvo); return; }
    }

    // 🕯️ Ritual de N rodadas (Invocação Abissal): não resolve agora. Ocupa as
    // rodadas, e enquanto dura quem conjura fica sem Defesa.
    if (m.ritualRodadas > 1) { await comecarRitualDaSkill(m, p); return; }

    // ⏪ Desfazer o último turno do alvo (Estilhaçar Causa).
    if (m.desfazTurno) {
        const alvo = T.objects.get((m.alvos || [])[0]);
        if (alvo) { await desfazerTurnoDoAlvo(m, p, alvo); return; }
    }

    // alvos atingidos
    let atingidos = [];
    const minha = faccaoDoToken(tok);
    if (m.tipo === 'alvos') {
        atingidos = m.alvos.map(id => T.objects.get(id)).filter(Boolean);
    } else {
        const shape = shapeDaMira(m, { x: tok.x, y: tok.y, r: rTok }, m.cursor);
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
    if (meta.manifestacao) await manifestarNoMapa(m, meta, p);
    if (meta.runaItemId) await gastarUsoDaRuna(meta.runaItemId);
    await pagarCustos(p);   // 💰 debita o recurso (mecânica ou texto do cadastro)
    if (custo === 'livre') render();
    // 🤝 Aplica direto, SEM janela de conflito, quando não há o que rolar:
    //   · buff em aliado — ninguém se defende de um buff;
    //   · habilidade SEM PORTÃO e sem dano — marcar não é atacar. A Presa do
    //     Caçador escolhe o alvo e pronto; pedir um Acerto ali seria inventar
    //     uma rolagem que o cadastro não tem (portão 'nenhum', §6.1).
    const semRolagem = !meta.golpe?.dano && (!meta.portao || meta.portao === 'nenhum');
    if (atingidos.length && (m.afeta === 'aliados' || semRolagem)) {
        // "Escolha na conjuração: X, OU Y" — pergunta antes de aplicar qualquer
        // uma. Só quem age vê a pergunta; o cadastro diz se há escolha.
        let condicoes = condicoesDaAcao(meta);
        if (meta.condicoesExclusivas && condicoes.length > 1) {
            const esc1 = await escolherCondicaoExclusiva(meta.nome, condicoes);
            if (!esc1) { toast('✖ Efeito não escolhido — a ação já foi gasta'); return; }
            condicoes = [esc1];
        }
        // Uma habilidade pode aplicar mais de uma condição (Postura Defensiva
        // dá Blindado e Abalado). Cada uma tem o seu próprio teto de alvos — e
        // a SUA facção: a onda da Composição de Batalha varre os dois lados,
        // mas Fortalecido é para aliado e Abalado para inimigo.
        for (const cd of condicoes) {
            const afetaCd = afetaDaCondicao(cd);
            const alvosDaCd = afetaCd
                ? atingidos.filter(o => alvoValido(afetaCd, minha, faccaoDoToken(o)))
                : atingidos;
            let pids = alvosDaCd.map(o => participanteDoToken(o)?.id).filter(Boolean);
            if (!pids.length) continue;
            if (cd.maxAlvos > 0 && pids.length > cd.maxAlvos) {
                pids = pids.slice(0, cd.maxAlvos);
                toast(`☠️ ${cd.nome} limitada a ${cd.maxAlvos} alvo(s) pelo cadastro — valem os primeiros`, 'warning');
            }
            aplicarCondicaoEmVarios(pids, cd.nome, cd.rodadas || 0, p?.id, cd.nivel || 1,
                cd.saiComAcaoPadrao ? { saiComAcaoPadrao: true } : null)
                .catch(e => console.warn('condição da skill', e));
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
            arcano: meta.golpe?.arcano || null, essencia: meta.golpe?.essencia || null,
            distancia: !!meta.golpe?.distancia, magia: !!meta.golpe?.magia,
            alvoAcerto: meta.golpe?.acerto ?? null,
            acertoNome: meta.golpe?.acertoNome || '', acertoIcone: meta.golpe?.acertoIcone || '',
            condicao: meta.condicao || null,
            condicoes: meta.condicoes || [],
            projetil: meta.projetil || null,
            condicoesItem: meta.condicoesItem || [],
            // ᛟ Lei do Relógio: a runa entrega sem rolar; só a Defesa contesta.
            semRolagem: !!meta.semRolagem, runaItemId: meta.runaItemId || null,
        }, atingidos);
        return;
    }
    toast(`${icone} Nenhum alvo na área`);
};
