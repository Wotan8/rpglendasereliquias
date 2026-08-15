// =============================================
// TABULEIRO — ⚔️ Janela de Conflito (combate v3, Livro §6.1–6.8)
//
// A troca de golpes deixa de ser "loga no chat e a mesa resolve": o conflito
// vira um objeto na cena (`cena.conflito`), então TODO MUNDO vê a mesma coisa
// e cada um responde pelo seu personagem.
//
//   1. 🎲 ACERTO  — o atacante rola 1d10 contra o Alvo do golpe (Graus = Alvo − dado).
//   2. 🛡️ DEFESA  — cada alvo escolhe UMA Defesa da própria ficha (ou nenhuma = 0).
//                   Passa quando os Graus são iguais ou maiores que a Defesa.
//                   Grátis até Reflexo − 1 por rodada; da próxima em diante, 1 ENER.
//   3. 💥 DANO    — o atacante rola a fórmula da arma; a Blindagem do alvo desconta
//                   (piso 1: golpe que passou sempre machuca).
//   4. 🔁 CONTRA  — atacante que errou feio abre a guarda: contra-ataque acerta
//                   automático, custa 1 ENER e consome uma defesa da rodada.
//   5. ✅ APLICAR — o cliente do MESTRE debita VIT/ENER e aplica as condições
//                   (as regras do banco não deixam jogador escrever ficha alheia —
//                   mesmo caminho da expiração de condições, ver tab-combat).
//
// 🕵️ O MESTRE vê e opera TODO dado da janela — o do atacante e o do defensor —
// e cada rolagem tem, ao lado do 🎲, um campo para digitar o que o dado FÍSICO
// deu na mesa. Nada aqui obriga a rolar no computador.
//
// Writes: 1 por etapa, no doc de combate que já existe. Nenhuma coleção nova.
// =============================================
import { setDoc, db as _db, doc as _doc, updateDoc as _upd, deleteDoc as _del } from '../../painel-mestre/js/firebase-config.js';
import { T, esc, toast, uid, normChave, valorComponente, gridSize, pxParaUnidades } from './tab-state.js';
import { golpesDe, golpesCacheados, escolherGolpe, golpesCorpoACorpo, alcanceDoGolpe } from './tab-golpes.js';
import { refCombate } from './tab-main.js';
import { cenaAtiva, comCenaAtivaPatch } from '../../shared/combate-cenas.js';
import { bonusDoAtaque } from '../../shared/marca-de-caca.js';
import { destinoDoProjetil, gastarUm } from '../../shared/projeteis.js';
import { addObj } from './tab-objects.js';
import { participanteDoToken, valorVdDaFonte, fonteDoParticipante, VITAIS } from './tab-hud.js';
import { aplicarCondicaoEmVarios, marcarFalhaDeConjuracao } from './tab-combat.js';
import { logChat } from './tab-chat.js';
import { grausDoAtaque, golpePassa, abriuGuarda, rolarFormula, danoFinal,
         defesasLivres, custoDaDefesa, soODado,
         podeContraAtacar as regraContraAtaque } from './tab-conflito-calc.js';

const DADO_DESARMADO = '1d4';   // §6.8: contra-ataque sem arma

let el = null;
let _sys = null;              // registro do sistema (VDs) — 1 carga por sessão
const _emVoo = new Set();     // conflitos com aplicação em curso neste cliente

export function initConflito() {
    el = document.createElement('div');
    el.id = 'tbConflito';
    el.className = 'tb-conflito';
    document.body.appendChild(el);
    window._renderConflito = render;
    render();
}

const cena = () => cenaAtiva(T.combate);
const conflito = () => cena()?.conflito || null;
const part = (pid) => (cena()?.participantes || []).find(x => x.id === pid) || null;

/** Salva o conflito (e, quando preciso, os participantes junto — orçamento de defesa). */
async function salvar(conf, participantes) {
    const patch = participantes ? { conflito: conf, participantes } : { conflito: conf };
    try {
        await setDoc(refCombate(), { ...comCenaAtivaPatch(T.combate, patch), atualizadoEm: Date.now() }, { merge: true });
    } catch (e) { console.error(e); toast('❌ Erro ao salvar o conflito', 'danger'); }
}

// ---------- quem pode mexer ----------
/** Controla este participante? O mestre no secreto opera a mesa inteira. */
function controla(pid) {
    if (T.isMaster && T.mode === 'public') return false;   // a TV não joga
    if (T.isMaster && T.mode === 'secret') return true;
    const p = part(pid);
    if (!p?.characterId) return false;
    return T.chars.find(c => c.id === p.characterId)?.ownerUid === T.user?.uid;
}
const souMestre = () => T.isMaster && T.mode === 'secret';

/** Energia ATUAL do participante (null = desconhecida, não bloqueia). */
function enerDe(pid) {
    const p = part(pid);
    if (p?.characterId) return VITAIS.get(p.characterId)?.ener ?? null;
    if (p?.npcId) {
        const vd = T.npcs.find(x => x.id === p.npcId)?.valoresDer || {};
        return (vd.atual || {}).ENER ?? vd.ENER ?? null;
    }
    return p?.enerCurrent ?? null;
}

// ---------- VDs de Defesa e Blindagem ----------
async function carregarSys() {
    if (_sys) return _sys;
    const m = await import('./tab-ficha-win.js?v=11');
    _sys = await m.registroSistema();
    render();
    return _sys;
}

/** As 8 Defesas do bloco "defesa" do registro (Esquiva, Aparar, ...). */
function defesasDoSistema() {
    return (_sys?.derivedValues || []).filter(d => d.blocoId === 'defesa');
}

/** Defesas COM valor para esta ficha: [{ nome, curto, valor }]. */
function defesasDe(pid) {
    const fonte = fonteDoParticipante(part(pid));
    if (!fonte) return [];
    const out = [];
    for (const dv of defesasDoSistema()) {
        const v = valorVdDaFonte(fonte, dv);
        if (v == null) continue;
        out.push({ nome: dv.nome, curto: String(dv.nome).replace(/^Defesa:?\s*/i, ''), icone: dv.icone || '🛡️', valor: Math.max(0, Number(v) || 0) });
    }
    return out;
}

/**
 * Orçamento de defesas da RODADA: grátis = Reflexo − 1 (mínimo 1); acabou,
 * cada defesa custa 1 Energia. O contador zera sozinho na virada da rodada
 * (fica marcado com a rodada em que foi gasto, igual ao turno guardado).
 */
function orcamentoDefesa(pid) {
    const p = part(pid);
    const reflexo = valorComponente('Reflexo', fonteDoParticipante(p)) ?? 0;
    const livres = defesasLivres(reflexo);
    const rodada = cena()?.rodada || 1;
    const usadas = (p?.defesas?.rodada === rodada) ? (p.defesas.usadas || 0) : 0;
    return { livres, usadas, restam: Math.max(0, livres - usadas), custo: custoDaDefesa(usadas, livres), reflexo };
}

/** Participantes com +1 defesa gasta por `pid` nesta rodada. */
function comDefesaGasta(pid) {
    const rodada = cena()?.rodada || 1;
    return (cena()?.participantes || []).map(x => {
        if (x.id !== pid) return { ...x };
        const usadas = (x.defesas?.rodada === rodada ? (x.defesas.usadas || 0) : 0) + 1;
        return { ...x, defesas: { rodada, usadas } };
    });
}

/**
 * Blindagem do alvo contra ESTE golpe. Golpe tipado (cortante/perfurante/
 * contundente) bate na Blindagem daquele tipo; um golpe que é dos dois usa a
 * MENOR (o atacante escolhe o ângulo). Sem tipo, vale a Blindagem geral.
 */
function blindagemDe(pid, tipos) {
    const fonte = fonteDoParticipante(part(pid));
    if (!fonte) return 0;
    const vds = _sys?.derivedValues || [];
    const acha = (nome) => vds.find(d => normChave(d.nome) === normChave(nome));
    const vals = [];
    for (const t of (tipos || [])) {
        const dv = acha(`Blindagem ${t}`);
        const v = dv ? valorVdDaFonte(fonte, dv) : null;
        if (v != null) vals.push(Number(v) || 0);
    }
    if (vals.length) return Math.min(...vals);
    const geral = acha('Blindagem');
    const v = geral ? valorVdDaFonte(fonte, geral) : null;
    return Math.max(0, Number(v) || 0);
}

// ---------- abertura ----------
/**
 * Abre o conflito a partir da mira confirmada.
 * @param atacante participante da vez
 * @param tokAtacante token dele no canvas
 * @param acao  { nome, icone, dano, tipos, custoAcao, alvoAcerto, condicao, efeito }
 * @param alvos tokens atingidos
 */
export async function abrirConflito(atacante, tokAtacante, acao, alvos) {
    carregarSys().catch(e => console.warn('registro do sistema p/ conflito', e));
    const conf = {
        id: 'cf' + uid(), t: Date.now(), fase: 'acerto',
        atacante: { pid: atacante?.id || null, nome: atacante?.name || '?', tokenId: tokAtacante?.id || null },
        acao: {
            nome: acao.nome || 'Ação', icone: acao.icone || '⚔️', dano: acao.dano || '',
            tipos: acao.tipos || [], custoAcao: acao.custoAcao || 'padrao',
            alvoAcerto: acao.alvoAcerto ?? null, efeito: acao.efeito || '',
            // De QUE Valor Derivado saiu o Alvo. Sem isto a janela dizia só
            // "Acerto", que não corresponde a VD nenhum da ficha do arqueiro —
            // o dele é "Acerto à Distância".
            acertoNome: acao.acertoNome || '', acertoIcone: acao.acertoIcone || '',
            condicao: acao.condicao || null,
            // 🏹 O maço escolhido no picker. Fica no doc porque quem resolve o
            // destino da flecha é o mesmo cliente que rolou o Acerto.
            projetil: acao.projetil || null,
        },
        // 🎯 Marca de Caça: medida AQUI, na abertura, e guardada no doc — quem
        // rola o dado pode ser outro cliente, e a ficha do caçador não está lá.
        marca: bonusDoAtaque(
            alvos.map(o => { const p = participanteDoToken(o); return { pid: p?.id || null, condicoes: p?.condicoes || [] }; }),
            {
                cacadorPid: atacante?.id || null,
                marcaDeCaca: valorComponente('Marca de Caça', fonteDoParticipante(atacante)),
            }),
        rolagem: null, contra: [], condAplicada: false,
        alvos: alvos.map(o => {
            const p = participanteDoToken(o);
            return {
                tokenId: o.id, pid: p?.id || null, nome: o.nome || p?.name || '?',
                defesaNome: null, defesa: 0, escolhido: false, defesaPaga: false,
                passou: null, bruto: null, blindagem: 0, dano: null, meia: false,
            };
        }),
    };
    await salvar(conf);
}

// ---------- 1) acerto ----------
/** Lê o campo de resultado manual (dado rolado na mesa). null quando vazio. */
function manual(id) {
    const v = document.getElementById(id)?.value;
    if (v == null || String(v).trim() === '') return null;
    const n = parseFloat(String(v).replace(',', '.'));
    return isNaN(n) ? null : n;
}

window.tbConfRolarAcerto = async (naMesa) => {
    const c = conflito(); if (!c || c.fase !== 'acerto') return;
    if (!controla(c.atacante.pid)) return;
    // O Alvo digitado à mão manda (o mestre corrigindo); senão soma a marca.
    const bonusMarca = Number(c.marca?.acerto) || 0;
    const alvo = manual('cfAlvoAcerto') ?? (c.acao.alvoAcerto == null ? null : c.acao.alvoAcerto + bonusMarca);
    if (alvo == null || isNaN(alvo)) { toast('⚠️ Informe o Alvo do ataque (Acerto + modificadores)', 'warning'); return; }
    let dado;
    if (naMesa) {
        dado = manual('cfManualAcerto');
        if (dado == null || dado < 1 || dado > 10) { toast('⚠️ Digite o d10 rolado na mesa (1 a 10)', 'warning'); return; }
        dado = Math.round(dado);
    } else {
        dado = 1 + Math.floor(Math.random() * 10);
    }
    const graus = grausDoAtaque(alvo, dado);
    const rolagem = { dado, alvo, graus, critico: dado === 1, falha: dado === 10, abriu: abriuGuarda(graus, dado), naMesa: !!naMesa };
    // 10 no dado nunca passa: os alvos não gastam defesa nenhuma com isso
    const erroSeco = dado === 10;
    const alvos = c.alvos.map(a => erroSeco ? { ...a, escolhido: true, passou: false, defesaNome: '—', defesa: 0 } : a);
    await salvar({ ...c, rolagem, alvos, fase: erroSeco ? 'aplicar' : 'defesa' });
    // 🔁 A música quebrou: quem tem retorno de recurso no fim do turno perde o
    // que juntou. Marca aqui porque é o único ponto que sabe se o teste passou.
    if (graus <= 0) await marcarFalhaDeConjuracao(c.atacante?.pid);
    // 🏹 A flecha saiu: gasta do maço e decide se sobrou inteira.
    if (c.acao?.projetil) await resolverProjetil(c, graus > 0);
    logChat(`🎯 ${c.atacante.nome} ataca com ${c.acao.nome}: d10 ${dado}${naMesa ? ' (mesa)' : ''} vs Alvo ${alvo}${bonusMarca ? ` (${c.acao.alvoAcerto} +${bonusMarca} da Marca de Caça)` : ''} → ${graus > 0 ? '+' : ''}${graus} Graus`
        + (dado === 1 ? ' ✨ crítico!' : dado === 10 ? ' 💀 falha crítica!' : ''));
};

/**
 * 🏹 O que acontece com a munição depois do tiro.
 *
 * Gasta 1 do maço SEMPRE (a flecha saiu, acertando ou não) e então sorteia se
 * ela sobrou inteira. Sobrando, vira loot no mapa: onde o alvo está se acertou
 * (cravada nele), por perto se errou (passou batido). Não sobrando, o chat
 * avisa que quebrou — senão a munição sumiria sem explicação.
 *
 * Só o dono do tiro executa: dois clientes com a aba aberta gastariam duas.
 */
async function resolverProjetil(c, acertou) {
    const pj = c.acao.projetil;
    if (!pj?.id || !controla(c.atacante?.pid)) return;

    // 1) tira do inventário
    try {
        const g = gastarUm(pj);
        if (g.acabou) await _del(_doc(_db, 'items', pj.id));
        else await _upd(_doc(_db, 'items', pj.id), { quantidade: g.restante });
    } catch (e) { console.warn('gastar projétil', e); }

    const d = destinoDoProjetil({ acertou, chanceRecuperar: pj.chanceRecuperar });
    if (!d.caiu) {
        logChat(`🏹 ${esc(pj.nome)} quebrou no disparo`);
        return;
    }

    // 2) cai no mapa. Onde o alvo está (cravada), ou perto dele quando errou.
    // O `addObj` já anuncia todo loot no chat — não repetir a linha aqui.
    const tokAlvo = T.objects.get(c.alvos?.[0]?.tokenId);
    if (!tokAlvo) return;
    const g = gridSize() || 50;
    const desvio = () => (Math.random() - 0.5) * g * 2;   // ~1 quadrado para cada lado
    const x = tokAlvo.x + (d.onde === 'perto' ? desvio() : 0);
    const y = tokAlvo.y + (d.onde === 'perto' ? desvio() : 0);

    try {
        await addObj({
            tipo: 'loot', layerId: 'tokens', x, y,
            nome: pj.nome, quantidade: 1, visivelPublico: true,
            item: { nome: pj.nome, quantidade: 1, modeloId: pj.modeloId || null, tipo: 'Projétil' },
        });
    } catch (e) { console.warn('dropar projétil', e); }
}

// ---------- 2) defesa ----------
window.tbConfDefesa = async (i, valor, nome) => {
    if (valor === '' || valor == null) return;   // voltou ao "— escolha —": não decide nada
    const c = conflito(); if (!c || c.fase !== 'defesa') return;
    const a = c.alvos[i]; if (!a || a.escolhido || !controla(a.pid)) return;
    const semDefesa = String(nome || '') === 'sem defesa';
    const orc = a.pid ? orcamentoDefesa(a.pid) : { custo: 0 };
    const paga = !semDefesa && orc.custo > 0;
    if (paga) {
        const ener = enerDe(a.pid);
        if (ener != null && ener < 1) { toast(`⚠️ ${a.nome} não tem Energia para outra defesa nesta rodada`, 'warning'); return; }
    }
    const alvos = c.alvos.map((x, k) => k !== i ? x : {
        ...x, escolhido: true, defesaNome: semDefesa ? 'sem defesa' : (nome || '—'),
        defesa: Number(valor) || 0, defesaPaga: paga,
        meia: /absorver/i.test(nome || ''),
        passou: golpePassa(c.rolagem.graus, Number(valor) || 0, c.rolagem.dado),
    });
    const todos = alvos.every(x => x.escolhido);
    // sem fórmula de dano não há o que rolar — vai direto para aplicar (condições)
    const proxima = !todos ? 'defesa' : (c.acao.dano ? 'dano' : 'aplicar');
    // defesa declarada consome o orçamento da rodada (a de graça e a paga)
    await salvar({ ...c, alvos, fase: proxima }, semDefesa ? null : comDefesaGasta(a.pid));
};

// ---------- 3) dano ----------
window.tbConfRolarDano = async (naMesa) => {
    const c = conflito(); if (!c || c.fase !== 'dano') return;
    if (!controla(c.atacante.pid)) return;
    let total, detalhe;
    if (naMesa) {
        total = manual('cfManualDano');
        if (total == null) { toast('⚠️ Digite o dano rolado na mesa', 'warning'); return; }
        detalhe = `${total} (rolado na mesa)`;
    } else {
        const r = rolarFormula(c.acao.dano, { critico: !!c.rolagem?.critico });
        total = r.total; detalhe = r.detalhe;
    }
    const alvos = c.alvos.map(a => {
        if (!a.passou) return { ...a, bruto: 0, dano: 0 };
        const bl = blindagemDe(a.pid, c.acao.tipos);
        // 🎯 só a linha da presa leva a marca — o dano é por alvo
        const bruto = total + (Number(c.marca?.danoPorPid?.[a.pid]) || 0);
        return { ...a, bruto, blindagem: bl, dano: danoFinal(bruto, bl, a.meia) };
    });
    await salvar({ ...c, alvos, brutoDetalhe: detalhe, fase: 'aplicar' });
    const marcados = alvos.filter(a => Number(c.marca?.danoPorPid?.[a.pid]) > 0);
    logChat(`💥 Dano de ${c.acao.nome}: ${detalhe} = ${total}`
        + (marcados.length ? ` · 🎯 +${c.marca.danoPorPid[marcados[0].pid]} da Marca de Caça em ${marcados.map(a => a.nome).join(', ')}` : ''));
};

// ---------- 4) contra-ataque (§6.8) ----------
/** Distância BORDA a BORDA entre dois tokens, na unidade do canvas. */
function distanciaEntreTokens(idA, idB) {
    const a = T.objects.get(idA), b = T.objects.get(idB);
    if (!a || !b) return null;
    const gs = gridSize();
    const rA = ((a.tamanhoCelulas || 1) * gs) / 2, rB = ((b.tamanhoCelulas || 1) * gs) / 2;
    const px = Math.max(0, Math.hypot(b.x - a.x, b.y - a.y) - rA - rB);
    return pxParaUnidades(px, { x: a.x, y: a.y }).valor;
}

/**
 * 🔁 Este alvo pode contra-atacar? (§6.8) — junta o estado da mesa (ficha,
 * tokens, posição) e entrega para a REGRA, que mora no módulo puro.
 * @returns { ok, motivo, linhas, pericia }
 */
function podeContra(c, a, linhas) {
    if (!a?.pid) return { ok: false, motivo: 'está fora da cena', linhas: [] };
    const p = part(a.pid);
    const pericia = valorComponente('Contra-Ataque', fonteDoParticipante(p)) ?? 0;
    // o alcance de cada golpe já sai resolvido (arma + 5% do Tamanho)
    const golpes = golpesCorpoACorpo(linhas).map(l => ({ ...l, alcanceM: alcanceDoGolpe(l, p) ?? 0 }));
    const r = regraContraAtaque({
        pericia, energia: enerDe(a.pid),
        jaContraAtacou: (c.contra || []).some(x => x.pid === a.pid),
        distanciaM: distanciaEntreTokens(a.tokenId, c.atacante.tokenId),
        golpes,
    });
    return { ...r, pericia };
}

/** Arma o contra-ataque: o defensor escolhe COM O QUE responde. */
window.tbConfContra = async (i) => {
    const c = conflito(); if (!c || !c.rolagem?.abriu) return;
    const a = c.alvos[i]; if (!a?.pid || !controla(a.pid)) return;
    const p = part(a.pid);
    const linhas = await golpesDe(p);
    const pode = podeContra(c, a, linhas);
    if (!pode.ok) { toast(`⚠️ ${a.nome} não pode contra-atacar: ${pode.motivo}`, 'warning'); return; }
    const escolhido = await escolherGolpe(
        `🔁 Com o que ${esc(a.nome)} contra-ataca?`, pode.linhas,
        'Só o DADO da arma entra (§6.8): sem o seu Dano e sem os bônus da peça. Custa 1 Energia e uma defesa da rodada.');
    if (!escolhido && pode.linhas.length > 1) return;   // cancelou
    const linha = escolhido || pode.linhas[0];
    // §6.8: o contra-ataque usa o DADO cru da arma; sem dado, o desarmado 1d4
    const formula = soODado(linha?.dano) || DADO_DESARMADO;
    const contra = [...(c.contra || []), {
        pid: a.pid, nome: a.nome, arma: linha?.nome || 'desarmado', formula,
        pericia: pode.pericia, bruto: null, dano: null, blindagem: 0, aplicado: false,
    }];
    await salvar({ ...c, contra }, comDefesaGasta(a.pid));
    toast(`🔁 ${a.nome} contra-ataca com ${linha?.nome || 'o corpo'} — role o ${formula} (custa 1 Energia)`);
};

window.tbConfRolarContra = async (k, naMesa) => {
    const c = conflito(); if (!c) return;
    const ct = (c.contra || [])[k]; if (!ct || ct.bruto != null || !controla(ct.pid)) return;
    let dadoTotal, detalhe;
    if (naMesa) {
        dadoTotal = manual(`cfManualContra${k}`);
        if (dadoTotal == null) { toast('⚠️ Digite o dado rolado na mesa', 'warning'); return; }
        detalhe = `${dadoTotal} (mesa)`;
    } else {
        const r = rolarFormula(ct.formula);
        dadoTotal = r.total; detalhe = r.detalhe;
    }
    // Dano = dado da arma + Contra-Ataque − Blindagem do agressor (piso 1)
    const bl = blindagemDe(c.atacante.pid, []);
    const bruto = dadoTotal + (Number(ct.pericia) || 0);
    const contra = (c.contra || []).map((x, j) => j !== k ? x : { ...x, bruto, blindagem: bl, dano: danoFinal(bruto, bl, false), detalhe });
    await salvar({ ...c, contra });
};

window.tbConfFechar = async () => { await salvar(null); };

/** Desistir no meio (a ação já foi gasta — isto só limpa a janela). */
window.tbConfCancelar = async () => {
    const c = conflito(); if (!c) return;
    if (!controla(c.atacante.pid)) return;
    if (!confirm('Cancelar este conflito? A ação já gasta não volta.')) return;
    await salvar(null);
};

// ---------- 5) aplicação (só no cliente do mestre) ----------
/** Sobrou algo para debitar na ficha? (dano, Energia de defesa paga, contra-ataque) */
function precisaAplicar(c) {
    if (!c) return false;
    if (c.fase === 'aplicar') return true;
    return (c.contra || []).some(x => x.bruto != null && !x.aplicado);
}

async function aplicar(c) {
    if (_emVoo.has(c.id)) return;
    _emVoo.add(c.id);
    try {
        const alvos = c.alvos.map(a => ({ ...a }));
        for (const a of alvos) {
            if (!a.pid) continue;
            if (a.passou && a.dano > 0 && !a.aplicado) { await window.tbCombStat?.(a.pid, 'VIT', -a.dano); a.aplicado = true; }
            if (a.defesaPaga && !a.enerPaga) { await window.tbCombStat?.(a.pid, 'ENER', -1); a.enerPaga = true; }
        }
        let condAplicada = !!c.condAplicada;
        if (!condAplicada && c.acao.condicao?.nome) {
            let pids = alvos.filter(a => a.passou && a.pid).map(a => a.pid);
            if (c.acao.condicao.maxAlvos > 0 && pids.length > c.acao.condicao.maxAlvos) pids = pids.slice(0, c.acao.condicao.maxAlvos);
            if (pids.length) await aplicarCondicaoEmVarios(pids, c.acao.condicao.nome, c.acao.condicao.rodadas || 0, c.atacante?.pid).catch(e => console.warn('condição do conflito', e));
            condAplicada = true;
        }
        const contra = (c.contra || []).map(x => ({ ...x }));
        for (const ct of contra) {
            if (ct.bruto == null || ct.aplicado) continue;
            await window.tbCombStat?.(ct.pid, 'ENER', -1);
            if (c.atacante.pid && ct.dano > 0) await window.tbCombStat?.(c.atacante.pid, 'VIT', -ct.dano);
            ct.aplicado = true;
            logChat(`🔁 Contra-ataque de ${ct.nome} em ${c.atacante.nome}: ${ct.detalhe || ct.formula}`
                + `${ct.pericia ? ` + ${ct.pericia} (Contra-Ataque)` : ''}${ct.blindagem ? ` − ${ct.blindagem} (blindagem)` : ''} = −${ct.dano} VIT · 1 Energia`);
        }
        if (c.fase === 'aplicar') {
            const linha = alvos.map(a => a.passou
                ? `${a.nome}: −${a.dano} VIT${a.blindagem ? ` (blindagem ${a.blindagem})` : ''}${a.meia ? ' 🪨 absorvido, não letal' : ''}`
                : c.rolagem?.falha ? `${a.nome}: o golpe passou longe`
                : `${a.nome}: defendeu com ${a.defesaNome || '—'}${a.defesa ? ` (${a.defesa})` : ''}${a.defesaPaga ? ' · 1 Energia' : ''}`).join(' · ');
            logChat(`⚔️ ${c.acao.nome} → ${linha || 'sem alvos'}`);
            const foraDaCena = alvos.filter(a => a.passou && !a.pid).map(a => a.nome);
            if (foraDaCena.length) toast(`⚠️ Fora da cena (sem participante): ${foraDaCena.join(', ')} — aplique na mão`, 'warning');
        }
        await salvar({ ...c, alvos, contra, condAplicada, fase: 'fim' });
    } finally { _emVoo.delete(c.id); }
}

// ---------- render ----------
/**
 * Uma linha de rolagem: 🎲 do sistema OU o número do dado FÍSICO da mesa.
 * @param args argumentos fixos antes do flag (ex.: `${k},` no contra-ataque)
 */
function linhaRolagem({ rotulo, fn, args = '', idManual, dica, extra }) {
    return `<div class="tb-conflito-roll">
        <b>${rotulo}</b>
        ${extra || ''}
        <button class="tb-btn tb-btn-small tb-btn-primary" onclick="${fn}(${args}false)">🎲 Rolar</button>
        <span class="tb-conflito-manual" title="Resultado do dado rolado na mesa">✍️
            <input type="number" id="${idManual}" placeholder="${esc(dica)}" step="any">
            <button class="tb-btn tb-btn-small" onclick="${fn}(${args}true)">Usar</button>
        </span>
    </div>`;
}

function render() {
    if (!el) return;
    const c = conflito();
    if (!c) { el.classList.remove('open'); el.innerHTML = ''; return; }
    if (!_sys) carregarSys().catch(() => {});
    el.classList.add('open');

    const r = c.rolagem;
    const souAtacante = controla(c.atacante.pid);
    const cabeca = `<div class="tb-conflito-head">${esc(c.acao.icone)} <b>${esc(c.atacante.nome)}</b> · ${esc(c.acao.nome)}
        ${c.acao.dano ? `<span class="tb-turno-hint">💥 ${esc(c.acao.dano)}</span>` : ''}
        ${souMestre() ? '<span class="tb-turno-hint">🕵️ mesa inteira</span>' : ''}
        ${souAtacante && c.fase !== 'fim' ? `<button class="tb-mini-btn" style="margin-left:auto" title="Cancelar o conflito" onclick="tbConfCancelar()">✖</button>` : ''}</div>`;

    const rolagem = r ? `<div class="tb-conflito-rolagem ${r.critico ? 'crit' : r.falha ? 'falha' : ''}">
        🎲 d10 <b>${r.dado}</b>${r.naMesa ? ' <i>(mesa)</i>' : ''} vs Alvo ${r.alvo} → <b>${r.graus > 0 ? '+' : ''}${r.graus} Graus</b>
        ${r.critico ? ' ✨ crítico (passa por qualquer Defesa, dado cheio no dano)' : ''}
        ${r.falha ? ' 💀 falha crítica (erro automático)' : ''}
        ${!r.critico && !r.falha && r.abriu ? ' 🔁 guarda aberta — cabe contra-ataque' : ''}
    </div>` : '';

    let corpo = '';
    if (c.fase === 'acerto') {
        corpo = souAtacante
            ? linhaRolagem({
                rotulo: `${c.acao.acertoIcone || '🎯'} ${esc(c.acao.acertoNome || 'Acerto')}`,
                fn: 'tbConfRolarAcerto', idManual: 'cfManualAcerto', dica: 'd10 da mesa',
                extra: `<label class="tb-conflito-alvoin">Alvo <input type="number" id="cfAlvoAcerto" value="${c.acao.alvoAcerto ?? ''}" step="any" placeholder="?"></label>`,
              })
            : `<div class="tb-turno-acoes"><span class="tb-muted">⏳ esperando ${esc(c.atacante.nome)} rolar o Acerto…</span></div>`;
    } else {
        corpo = `<div class="tb-conflito-alvos">${c.alvos.map((a, i) => linhaAlvo(c, a, i)).join('') || '<span class="tb-muted">Nenhum alvo.</span>'}</div>`;
        if (c.fase === 'dano') {
            corpo += souAtacante
                ? linhaRolagem({ rotulo: `💥 Dano (${esc(c.acao.dano)})`, fn: 'tbConfRolarDano', idManual: 'cfManualDano', dica: 'dano da mesa' })
                : '<div class="tb-turno-acoes"><span class="tb-muted">⏳ esperando o dano…</span></div>';
        }
        corpo += (c.contra || []).map((ct, k) => linhaContra(ct, k)).join('');
        if (c.fase === 'aplicar') corpo += `<div class="tb-turno-acoes"><span class="tb-muted">⏳ aplicando na ficha dos alvos…</span></div>`;
        if (c.fase === 'fim') {
            corpo += `<div class="tb-turno-acoes">
                ${c.brutoDetalhe ? `<span class="tb-turno-hint">💥 ${esc(c.brutoDetalhe)}</span>` : ''}
                <button class="tb-btn tb-btn-success" onclick="tbConfFechar()">✅ Fechar</button>
            </div>`;
        }
    }
    el.innerHTML = cabeca + rolagem + corpo;

    // ⏱️ a aplicação na ficha é sempre do mestre (regras do banco)
    if (souMestre() && precisaAplicar(c)) {
        aplicar(c).catch(e => { console.error(e); toast('❌ Erro ao aplicar o conflito', 'danger'); });
    }
}

/** Contra-ataque já declarado: rola (ou recebe o dado da mesa) e mostra o saldo. */
function linhaContra(ct, k) {
    if (ct.bruto == null) {
        return controla(ct.pid)
            ? linhaRolagem({ rotulo: `🔁 Contra-ataque de ${esc(ct.nome)}${ct.arma ? ` com ${esc(ct.arma)}` : ''} (${esc(ct.formula)}${ct.pericia ? ` + ${ct.pericia}` : ''})`,
                             fn: 'tbConfRolarContra', args: `${k},`, idManual: `cfManualContra${k}`, dica: 'dado da mesa' })
            : `<div class="tb-conflito-alvo"><span class="tb-conflito-nome">🔁 ${esc(ct.nome)} contra-ataca</span><span class="tb-muted">⏳ rolando…</span></div>`;
    }
    return `<div class="tb-conflito-alvo">
        <span class="tb-conflito-nome">🔁 ${esc(ct.nome)} contra-ataca${ct.arma ? ` <span class="tb-muted">com ${esc(ct.arma)}</span>` : ''}</span>
        <span class="tb-conflito-dir"><b class="tb-conflito-hit">−${ct.dano} VIT</b>
            <span class="tb-muted">${esc(ct.detalhe || ct.formula)}${ct.pericia ? ` +${ct.pericia}` : ''}${ct.blindagem ? ` −${ct.blindagem} blindagem` : ''} · 1 Energia</span></span>
    </div>`;
}

function linhaAlvo(c, a, i) {
    const meu = controla(a.pid);
    const orc = a.pid ? orcamentoDefesa(a.pid) : null;
    let dir;
    if (!a.escolhido) {
        const defs = a.pid ? defesasDe(a.pid) : [];
        const custo = orc?.custo || 0;
        // acabaram as grátis e não há Energia: só resta encaixar o golpe
        const semEner = custo > 0 && (enerDe(a.pid) ?? 1) < 1;
        dir = meu
            ? `<select class="tb-conflito-def" onchange="tbConfDefesa(${i}, this.selectedOptions[0].dataset.v, this.selectedOptions[0].dataset.n)">
                    <option value="" data-v="" data-n="">— escolha a defesa —</option>
                    <option value="0" data-v="0" data-n="sem defesa">🚫 Não defender (0)</option>
                    ${defs.map(d => `<option value="${d.valor}" data-v="${d.valor}" data-n="${esc(d.curto)}" ${semEner ? 'disabled' : ''}>${d.icone} ${esc(d.curto)} — ${d.valor}${custo ? ' · 1 ENER' : ''}</option>`).join('')}
               </select>${defs.length ? '' : '<span class="tb-muted"> sem Defesa na ficha</span>'}`
              + (semEner ? '<span class="tb-muted"> sem Energia para outra defesa nesta rodada</span>' : '')
            : '<span class="tb-muted">⏳ escolhendo a defesa…</span>';
    } else if (a.passou) {
        dir = `<b class="tb-conflito-hit">☠️ passou</b> ${a.defesaNome && a.defesaNome !== '—' ? `<span class="tb-muted">(${esc(a.defesaNome)} ${a.defesa}${a.defesaPaga ? ' · 1 ENER' : ''})</span>` : ''}`
            + (a.dano != null ? ` <b>−${a.dano} VIT</b>${a.blindagem ? ` <span class="tb-muted">após blindagem ${a.blindagem}</span>` : ''}${a.meia ? ' 🪨' : ''}` : '');
    } else if (c.rolagem?.falha) {
        dir = '<b class="tb-conflito-miss">💀 passou longe</b>';
    } else {
        dir = `<b class="tb-conflito-miss">🛡️ defendeu</b> <span class="tb-muted">(${esc(a.defesaNome || '—')}${a.defesa ? ' ' + a.defesa : ''}${a.defesaPaga ? ' · 1 ENER' : ''})</span>`;
    }
    // 🔁 guarda aberta: quem foi atacado pode contra-atacar (§6.8). As travas
    // (perícia, alcance corpo a corpo, Energia) já aparecem no próprio botão.
    let btnContra = '';
    if (c.rolagem?.abriu && a.pid && meu && a.escolhido) {
        const linhas = golpesCacheados(part(a.pid));
        if (linhas === null) {
            golpesDe(part(a.pid)).then(render).catch(() => {});   // carrega e repinta
            btnContra = ' <span class="tb-muted">⏳ conferindo o contra-ataque…</span>';
        } else {
            const pode = podeContra(c, a, linhas);
            btnContra = ` <button class="tb-btn tb-btn-small" ${pode.ok ? '' : 'disabled'}
                title="${esc(pode.ok ? 'Acerta automático, ignora a Defesa. Custa 1 Energia e uma defesa da rodada.' : 'Não pode contra-atacar: ' + pode.motivo)}"
                onclick="tbConfContra(${i})">🔁 Contra-atacar (1 ENER)</button>`;
        }
    }
    const orcTxt = orc && (meu || souMestre())
        ? ` <span class="tb-conflito-orc" title="Defesas grátis por rodada = Reflexo − 1 (mínimo 1); as extras custam 1 Energia">🛡️ ${orc.restam}/${orc.livres}${orc.restam ? '' : ' · extra custa 1 ENER'}</span>` : '';
    return `<div class="tb-conflito-alvo">
        <span class="tb-conflito-nome">🎯 ${esc(a.nome)}${a.pid ? '' : ' <span class="tb-muted">(fora da cena)</span>'}${orcTxt}</span>
        <span class="tb-conflito-dir">${dir}${btnContra}</span>
    </div>`;
}
