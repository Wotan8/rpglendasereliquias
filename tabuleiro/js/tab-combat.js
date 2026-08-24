// =============================================
// TABULEIRO — Janela de Combate
// Sincroniza com Painel do Mestre > Mesas > Combate
// =============================================
import { db, doc, setDoc, updateDoc, getDoc } from '../../painel-mestre/js/firebase-config.js';
import { T, esc, toast, uid, alvoDoTeste, grausDoDado, fmtGraus, vNum, patchVitalAtualNpc, markDirty,
         registrarFlutuante, trazerParaFrente } from './tab-state.js';
import { refCombate, refEstado, abrirModal, fecharModal } from './tab-main.js';
import { VITAIS, vdsCombateDaFonte, espelhosDoVitalNpc, fonteDoParticipante } from './tab-hud.js';
import { cenasDoDoc, cenaAtiva, comCenaAtivaPatch, comCenaNova, semCena, comTrocaDeCena, condDoParticipante, tirarCondicoesExpiradas, FACCOES, faccaoDoParticipante, acoesNovas, participanteDaVez, efeitoDasCondicoes, alvoDoTickRodada } from '../../shared/combate-cenas.js';
import { rolarFormula } from './tab-conflito-calc.js';
import { tirarRetrato, avancarRitual } from '../../shared/turno-efeitos.js?v=1';
import { logChat } from './tab-chat.js';
import { CONDICAO_TRANSE } from '../../shared/incorporacao.js?v=1';

import { confirmar, perguntar } from '../../shared/dialogo.js?v=2';
let janelaAberta = false;

// Janela flutuante de ficha de combate (NPC/personagem) — módulo carregado só
// quando alguém abre a primeira janela.
window.tbFichaWin = async function(tipo, id) {
    try { (await import('./tab-ficha-win.js?v=13')).abrirFichaWin(tipo, id); }
    catch (e) { console.error(e); toast('❌ Erro ao abrir a janela de combate', 'danger'); }
};

export function initCombat() {
    window._renderCombate = render;
    window._checarCondicoesRodada = checarCondicoesRodada;
    // O registro de condições deixou de ser só do picker: deslocamento, visão,
    // mira e render leem dele a cada quadro. Sem carregar no boot, o mapa passa
    // a primeira meia dúzia de segundos ignorando toda condição — e ninguém
    // repara que está ignorando. Falha de rede degrada para "nenhum efeito".
    carregarCondicoesSistema().then(() => markDirty()).catch(() => {});
    const win = document.getElementById('tbCombatWin');
    registrarFlutuante(win);
    // Arrastar a janela
    const head = win.querySelector('.tb-win-head');
    let drag = null;
    head.addEventListener('pointerdown', e => {
        if (e.target.closest('button')) return;
        drag = { x: e.clientX, y: e.clientY, l: win.offsetLeft, t: win.offsetTop };
        head.setPointerCapture(e.pointerId);
    });
    head.addEventListener('pointermove', e => {
        if (!drag) return;
        win.style.left = Math.max(0, drag.l + e.clientX - drag.x) + 'px';
        win.style.top = Math.max(0, drag.t + e.clientY - drag.y) + 'px';
        win.style.right = 'auto';
    });
    head.addEventListener('pointerup', () => drag = null);
}

window.tbToggleCombate = function() {
    janelaAberta = !janelaAberta;
    const win = document.getElementById('tbCombatWin');
    win.classList.toggle('open', janelaAberta);
    if (janelaAberta) trazerParaFrente(win);   // abriu = vai para cima das outras
    render();
};

/** Participantes da cena ABERTA (é o que a janela mostra e edita). */
const partsDaCena = () => cenaAtiva(T.combate).participantes || [];

/** Condições que vieram da FICHA do participante ({icone, nome}; char ao vivo por VITAIS, NPC pelo doc). */
function condsDaFicha(p) {
    if (p.characterId) return (VITAIS.get(p.characterId)?.conds || []).filter(c => c.nome);
    if (p.npcId) return (T.npcs.find(n => n.id === p.npcId)?.conditions || [])
        .map(c => ({ icone: c?.icone || '☠️', nome: c?.nome || c })).filter(c => c.nome);
    return [];
}

/**
 * Grava a cena ABERTA. O doc sai inteiro de `docDeCenas` (dentro dos helpers),
 * então o espelho que a ficha lê nunca fica para trás — ver shared/combate-cenas.js.
 */
async function salvar(participantes, patchExtra) {
    try {
        await setDoc(refCombate(),
            { ...comCenaAtivaPatch(T.combate, { participantes, ...(patchExtra || {}) }), atualizadoEm: Date.now() },
            { merge: true });
    } catch (e) { console.error(e); toast('❌ Erro ao salvar combate', 'danger'); }
}

/** Escreve o doc já montado por um helper de cena (criar/trocar/apagar). */
async function salvarDoc(docNovo) {
    try {
        await setDoc(refCombate(), { ...docNovo, atualizadoEm: Date.now() }, { merge: true });
    } catch (e) { console.error(e); toast('❌ Erro ao salvar as cenas', 'danger'); }
}

window.tbCenaTrocar = (id) => salvarDoc(comTrocaDeCena(T.combate, id));
window.tbCenaNova = async () => {
    const nome = await perguntar('Como se chama a cena?',
        { titulo: 'Nova cena de combate', valor: 'Cena ' + (cenasDoDoc(T.combate).length + 1), ok: 'Criar' });
    if (nome === null) return;
    salvarDoc(comCenaNova(T.combate, 'c' + uid(), nome.trim() || 'Nova cena'));
};
window.tbCenaRenomear = async (id) => {
    const atual = cenasDoDoc(T.combate).find(c => c.id === id);
    const nome = await perguntar('Novo nome da cena:', { titulo: 'Renomear cena', valor: atual?.nome || '' });
    if (nome === null) return;
    salvarDoc(comCenaAtivaPatch(T.combate, { nome: nome.trim() || 'Cena' }));
};
window.tbCenaApagar = async (id) => {
    const c = cenasDoDoc(T.combate).find(x => x.id === id);
    if (!await confirmar(`A cena "${c?.nome || ''}" e todos os participantes dela somem.`,
        { titulo: 'Apagar cena', ok: 'Apagar', perigo: true })) return;
    salvarDoc(semCena(T.combate, id));
};

/** Abas das cenas — só no secreto: quem cria e alterna é o mestre. */
function abasDeCena() {
    const cenas = cenasDoDoc(T.combate);
    const ativa = cenaAtiva(T.combate).id;
    return `<div class="tb-cena-abas">
        ${cenas.map(c => `<button class="tb-cena-aba ${c.id === ativa ? 'ativa' : ''}"
            onclick="${c.id === ativa ? `tbCenaRenomear('${c.id}')` : `tbCenaTrocar('${c.id}')`}"
            title="${c.id === ativa ? 'Clique para renomear' : 'Abrir esta cena'}">
            ${esc(c.nome || 'Cena')}<span class="tb-cena-n">${(c.participantes || []).length}</span>
            ${c.id === ativa && cenas.length > 1 ? `<span class="tb-cena-x" onclick="event.stopPropagation();tbCenaApagar('${c.id}')" title="Apagar cena">✕</span>` : ''}
        </button>`).join('')}
        <button class="tb-cena-aba nova" onclick="tbCenaNova()" title="Nova cena de combate">＋</button>
    </div>`;
}

// ===== 🎯 TESTES DA CENA (Graus de Sucesso) =====
// ⚠️ A ficha do participante vem de tab-hud e de lugar nenhum mais: havia aqui
// uma segunda cópia desta função, e o Alvo dos testes da cena saía sem os
// bônus temporários da Dádiva. Um Xamã incorporado testava com a ficha dele.
/** Alvo resolvido pela ficha, ou null (mestre digita/edita na mão). */
function alvoSugerido(t, p) {
    // 😟 A condição que penaliza "todos os testes" penaliza ESTE também: o
    // Abalado −2 entra aqui junto com o modificador de dificuldade do pedido.
    const mod = (t.mod || 0) + (efeitoDasCondicoes(p?.condicoes || [], T.condicoesSistema).modAlvo || 0);
    const r = alvoDoTeste(t.nome, fonteDoParticipante(p), mod);
    return (!r.partes.length || r.incompleto) ? null : r.alvo;
}
/** Linhas de teste do card de um participante. */
function testesDoCard(testes, p, secreto) {
    const linhas = testes.filter(t => (t.participantes || []).includes(p.id)).map(t => {
        const r = t.resultados?.[p.id];
        const rotulo = `<span class="tb-teste-nome">${esc(t.nome)}${t.mod ? ` (${t.mod > 0 ? '+' : ''}${t.mod})` : ''}</span>`;
        if (r) {
            const cls = r.graus > 0 ? 'pos' : r.graus < 0 ? 'neg' : 'zero';
            return `<div class="tb-teste-row">${rotulo}
                <span class="tb-grau ${cls}" title="${r.dado ? `d10: ${r.dado} · Alvo ${r.alvo}` : 'resultado inserido na mão'}">${fmtGraus(r.graus)}</span>
                ${secreto ? `<button class="tb-mini-btn" title="Rolar de novo" onclick="tbTesteRolar('${t.id}','${p.id}')">🎲</button>` : ''}</div>`;
        }
        if (!secreto) return `<div class="tb-teste-row">${rotulo}<span class="tb-grau aguarda" title="aguardando o teste">…</span></div>`;
        const alvo = alvoSugerido(t, p);
        return `<div class="tb-teste-row">${rotulo}
            <span class="tb-teste-alvo-lb">Alvo</span><input type="number" class="tb-teste-alvo" id="tstAlvo_${t.id}_${p.id}" value="${alvo ?? ''}" placeholder="?">
            <button class="tb-mini-btn" title="Rolar 1d10 (1 crítico · 10 falha crítica)" onclick="tbTesteRolar('${t.id}','${p.id}')">🎲</button>
            <button class="tb-mini-btn" title="Inserir os Graus (teste feito fisicamente)" onclick="tbTesteInserir('${t.id}','${p.id}')">✏️</button></div>`;
    });
    return linhas.length ? `<div class="tb-testes-card">${linhas.join('')}</div>` : '';
}

function render() {
    const body = document.getElementById('tbCombatBody');
    if (!body || !janelaAberta) return;
    const secreto = T.mode === 'secret';
    const cena = cenaAtiva(T.combate);
    const parts = (cena.participantes || []).slice().sort((a, b) => (b.initiative||0) - (a.initiative||0));
    const testes = cena.testes || [];
    // As abas são do mestre: o público vê só a cena que ele deixou aberta.
    const abas = secreto ? abasDeCena() : '';

    if (!parts.length) {
        body.innerHTML = abas + '<div class="tb-muted" style="padding:16px;text-align:center">Nenhum participante nesta cena.<br>Adicione pelo Painel do Mestre › Mesas › ⚔️ Combate.</div>';
        return;
    }
    // normaliza: remover participantes deixava turnoAtual fora da lista ("Turno 5/3")
    const c = cena;
    const turno = ((c?.turnoAtual || 0) % parts.length + parts.length) % parts.length;

    let topo = '';
    if (secreto) {
        // ⚔️ Turno mecânico: o turno 1 só existe depois do START do mestre.
        const btnCena = cena.iniciado
            ? `<button class="tb-btn tb-btn-small tb-btn-danger" onclick="tbCombEncerrarCena()" title="Encerrar o combate (o painel de turno some)">⏹️</button>`
            : `<button class="tb-btn tb-btn-small tb-btn-success" onclick="tbCombIniciarCena()" title="Iniciar o combate — trava as iniciativas e abre o turno 1">▶️ Iniciar</button>`;
        topo = `<div class="tb-combat-controls">
            ${btnCena}
            <button class="tb-btn tb-btn-small" onclick="tbCombTurno(-1)" ${cena.iniciado ? '' : 'disabled'}>⏮️</button>
            <span class="tb-combat-round">${cena.iniciado ? `Turno ${turno + 1}/${parts.length}${c?.rodada ? ' · Rodada ' + c.rodada : ''}` : '🕰️ Preparando — role as iniciativas'}</span>
            <button class="tb-btn tb-btn-small" onclick="tbCombTurno(1)" ${cena.iniciado ? '' : 'disabled'}>⏭️</button>
            <button class="tb-btn tb-btn-small" title="${T.estado?.combateVisivelPublico ? 'Ocultar do público' : 'Exibir ao público'}" onclick="tbCombVisibilidade()">${T.estado?.combateVisivelPublico ? '👁️' : '🚫'} público</button>
        </div>`;
    } else {
        topo = `<div class="tb-combat-controls"><span class="tb-combat-round">${cena.iniciado ? `Ordem dos turnos${c?.rodada ? ' · Rodada ' + c.rodada : ''}` : '🕰️ O mestre ainda não iniciou o combate'}</span></div>`;
    }

    // 🎯 Testes pedidos pelo mestre (além da iniciativa) — gerência só no secreto
    if (secreto) {
        topo += `<div class="tb-testes-sec">
            <span class="tb-testes-titulo">🎯 Testes</span>
            ${testes.map(t => `<span class="tb-teste-tag">${esc(t.nome)}${t.mod ? ` (${t.mod > 0 ? '+' : ''}${t.mod})` : ''}
                <b class="tb-teste-x" title="Apagar teste" onclick="tbTesteApagar('${t.id}')">✕</b></span>`).join('')}
            <button class="tb-btn tb-btn-small" onclick="tbTesteNovo()">➕ Pedir teste</button>
        </div>`;
    }

    body.innerHTML = abas + topo + parts.map((p, i) => {
        const atual = !!cena.iniciado && i === turno % parts.length;
        const podeCtrl = secreto;
        const barra = (label, cur, max, cor) => {
            const pct = max > 0 ? Math.max(0, Math.min(100, (cur / max) * 100)) : 0;
            return `<div class="tb-cstat">
                ${podeCtrl ? `<button class="tb-cstat-btn" onclick="tbCombStat('${p.id}','${label}',-1)">−</button>` : ''}
                <span class="tb-cstat-lb">${label}</span>
                <div class="tb-cstat-bar"><div style="width:${pct}%;background:${cor}"></div></div>
                <span class="tb-cstat-v">${vNum(cur)}/${vNum(max)}</span>
                ${podeCtrl ? `<button class="tb-cstat-btn" onclick="tbCombStat('${p.id}','${label}',1)">+</button>` : ''}
            </div>`;
        };
        let hpC = p.hpCurrent ?? 0, hpM = p.hpMax ?? 0;
        let enerC = p.enerCurrent ?? 0, enerM = p.enerMax ?? 0;
        let sanC = p.sanCurrent ?? 0, sanM = p.sanMax ?? 0;

        if (p.characterId) {
            const v = VITAIS.get(p.characterId);
            if (v) {
                hpC = v.hp; hpM = v.hpMax;
                enerC = v.ener; enerM = v.enerMax;
                sanC = v.san; sanM = v.sanMax;
            }
        } else if (p.npcId) {
            const n = T.npcs.find(x => x.id === p.npcId);
            if (n) {
                const vd = n.valoresDer || {};
                const atual = vd.atual || {};
                hpM = vd.VIT || hpM;
                enerM = vd.ENER || enerM;
                sanM = vd.SAN || sanM;
                hpC = (atual.VIT !== undefined && atual.VIT !== null) ? Math.min(atual.VIT, hpM) : hpM;
                enerC = (atual.ENER !== undefined && atual.ENER !== null) ? Math.min(atual.ENER, enerM) : enerM;
                sanC = (atual.SAN !== undefined && atual.SAN !== null) ? Math.min(atual.SAN, sanM) : sanM;
            }
        }

        // ⚔️ VDs de Status de Combate (statusCombate no Criador) abaixo de SAN —
        // com campo Atual/Máx viram BARRA com −/+ (igual VIT/ENER/SAN); sem, chip.
        const vdsCombate = secreto ? vdsCombateDaFonte(fonteDoParticipante(p)) : [];
        const vdBarra = (d) => {
            const max = d.valor, cur = d.atual ?? max;
            const pct = max > 0 ? Math.max(0, Math.min(100, (cur / max) * 100)) : 0;
            return `<div class="tb-cstat" title="${esc(d.nome)}">
                ${podeCtrl ? `<button class="tb-cstat-btn" onclick="tbCombVd('${p.id}','${esc(d.key)}',-1)">−</button>` : ''}
                <span class="tb-cstat-lb">${esc(d.icone)}</span>
                <div class="tb-cstat-bar"><div style="width:${pct}%;background:linear-gradient(90deg,#b45309,#f59e0b)"></div></div>
                <span class="tb-cstat-v">${vNum(cur)}/${vNum(max)}</span>
                ${podeCtrl ? `<button class="tb-cstat-btn" onclick="tbCombVd('${p.id}','${esc(d.key)}',1)">+</button>` : ''}
            </div>`;
        };
        // 🛡️ O que as CONDIÇÕES somam neste VD (Postura Defensiva → Blindado).
        // Sem isto o chip da condição aparecia e a Blindagem seguia 0 na tela —
        // a mesa via o efeito ligado e o número desligado.
        const vdComCondicao = (d, part) => {
            const bonus = efeitoDasCondicoes(part?.condicoes || [], T.condicoesSistema)
                .modVd?.[String(d.nome || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()] || 0;
            const total = (Number(d.valor) || 0) + bonus;
            const dica = bonus ? `${esc(d.nome)}: ${d.valor} de base ${bonus > 0 ? '+' : '−'} ${Math.abs(bonus)} por condição` : esc(d.nome);
            return `<span class="tb-combat-vd" title="${dica}">${esc(d.icone)} <span class="tb-combat-vd-nome">${esc(d.nome)}</span> `
                + `<b>${esc(String(d.prefixo))}${total}${esc(String(d.sufixo))}</b>`
                + (bonus ? ` <i class="tb-combat-vd-bonus">${bonus > 0 ? '+' : ''}${bonus}</i>` : '') + `</span>`;
        };
        const vdsHtml = vdsCombate.length
            ? vdsCombate.filter(d => d.campoAtual && d.valor > 0).map(vdBarra).join('')
              + (vdsCombate.some(d => !(d.campoAtual && d.valor > 0))
                ? `<div class="tb-combat-vds">${vdsCombate.filter(d => !(d.campoAtual && d.valor > 0)).map(d =>
                    vdComCondicao(d, p)).join('')}</div>`
                : '')
            : '';
        const stats = secreto ? `
            ${barra('VIT', hpC, hpM, 'linear-gradient(90deg,#10b981,#34d399)')}
            ${barra('ENER', enerC, enerM, 'linear-gradient(90deg,#f59e0b,#fbbf24)')}
            ${barra('SAN', sanC, sanM, 'linear-gradient(90deg,#6366f1,#8b5cf6)')}
            ${vdsHtml}` : '';
        const donoDoChar = p.characterId && T.chars.find(c => c.id === p.characterId)?.ownerUid === T.user?.uid;
        // Condição tem DUAS fontes: a do combate (`p.condicoes`) e a da ficha do
        // personagem/NPC. Quem aplica pelo combate grava nas duas, mas quem aplica
        // pela ficha só tem a de lá — e essa não aparecia aqui. A janela mostra a
        // união; o ✕ só existe para as do combate, que são as que este lado tira.
        // Detalhe (nome, descrição, tempo) é do MESTRE e do DONO do token; para o
        // resto da mesa a condição é só o ícone — igual ao token no mapa.
        const detalhes = secreto || donoDoChar;
        const rodadaAtual = c?.rodada || 1;
        // Condição que acumula mostra o nível junto do nome — "Exaustão" e
        // "Exaustão nv 4" são situações muito diferentes para caberem no mesmo chip.
        const nivelTxt = cd => (cd.nivel > 1 ? ` <i class="tb-cond-nv">nv ${cd.nivel}</i>` : '');
        const chip = (cd, titulo, extra = '') => detalhes
            ? `<span class="tb-cond" title="${esc(titulo || cd.descricao || '')}">${esc(cd.icone)} ${esc(cd.nome)}${nivelTxt(cd)}${cd.expiraNaRodada ? ` <i class="tb-cond-t" title="acaba na rodada ${cd.expiraNaRodada}">⏱${Math.max(0, cd.expiraNaRodada - rodadaAtual)}</i>` : ''}${extra}</span>`
            : `<span class="tb-cond">${esc(cd.icone)}</span>`;
        const nomesCombate = (p.condicoes || []).map(cd => condDoParticipante(cd).nome);
        const daFicha = condsDaFicha(p).filter(x => !nomesCombate.includes(x.nome));
        const conds = (p.condicoes || []).map((cd, ci) =>
            chip(condDoParticipante(cd), '', secreto ? ` <b onclick="tbCombCondRm('${p.id}',${ci})">✕</b>` : '')).join('')
            + daFicha.map(x => chip({ ...x, expiraNaRodada: null }, 'Aplicada na ficha — remova por lá')).join('');
        const abrirNpc = secreto && p.npcId ? `onclick="tbAbrirNpcModal('${p.npcId}')" style="cursor:pointer" title="Abrir ficha do NPC"` : '';
        // 🪟 Janela de combate: mestre no secreto abre de NPC e personagem;
        // no público cada jogador abre só a do PRÓPRIO personagem.
        const fichaRef = p.npcId ? ['npc', p.npcId] : p.characterId ? ['char', p.characterId] : null;
        const btnJanela = fichaRef && (secreto || donoDoChar)
            ? `<button class="tb-mini-btn" title="Janela de combate (ficha ao vivo)" onclick="tbFichaWin('${fichaRef[0]}','${fichaRef[1]}')">⚔️</button>` : '';
        // Facção: o mestre define no select; todos veem o pontinho de cor
        const fac = faccaoDoParticipante(p);
        const facSel = secreto
            ? `<select class="tb-faccao-sel" onchange="tbCombFaccao('${p.id}',this.value)" title="Facção (define quem é aliado de quem para as skills)">
                ${FACCOES.map(([v, l]) => `<option value="${v}" ${fac === v ? 'selected' : ''}>${l}</option>`).join('')}
               </select>`
            : `<span class="tb-faccao-dot" title="${esc(FACCOES.find(f => f[0] === fac)?.[1] || '')}">${fac === 'aliados' ? '🟢' : fac === 'neutros' ? '⚪' : '🔴'}</span>`;
        return `<div class="tb-combat-p ${atual ? 'atual' : ''}">
            <div class="tb-combat-init">${p.initiative ?? 0}</div>
            <div style="flex:1;min-width:0">
                <div class="tb-combat-nome" ${abrirNpc}>${esc(p.name || '?')} ${p.npcId && secreto ? '📋' : ''} <span class="tb-combat-tipo">${esc(p.type || '')}</span> ${facSel}</div>
                ${secreto && p.details ? `<div class="tb-muted" style="font-size:.72rem">${esc(p.details)}</div>` : ''}
                ${stats}
                ${testesDoCard(testes, p, secreto)}
                <div class="tb-conds">${conds}${secreto ? `<button class="tb-cond-add" onclick="tbCombCondAdd('${p.id}')">➕ condição</button>` : ''}</div>
            </div>
            <div class="tb-combat-acoes">
                ${btnJanela}
                ${secreto ? `<button class="tb-mini-btn tb-danger" onclick="tbCombRemover('${p.id}')" title="Remover">🗑️</button>` : ''}
            </div>
        </div>`;
    }).join('');
}

// ===== Ações (modo secreto) =====

/** ▶️ START do mestre: o turno 1 só existe a partir daqui. */
window.tbCombIniciarCena = async function() {
    const c = cenaAtiva(T.combate);
    const parts = c.participantes || [];
    if (!parts.length) { toast('⚠️ A cena não tem participantes', 'warning'); return; }
    const semIni = parts.filter(p => !(p.initiative > 0));
    if (semIni.length && !await confirmar(
        `${semIni.length} participante(s) sem iniciativa: ${semIni.map(p => p.name).join(', ')}.`,
        { titulo: 'Iniciar assim mesmo?', ok: 'Iniciar' })) return;
    await salvar(parts.map(p => ({ ...p, guardadoNaRodada: null })), { iniciado: true, turnoAtual: 0, rodada: 1, acoesTurno: acoesNovas(), retomar: null });
    const vez = participanteDaVez({ ...c, turnoAtual: 0 });
    toast('⚔️ Combate iniciado!');
    logChat(`⚔️ Combate iniciado — Rodada 1, vez de ${vez?.name || '?'}`);
    await aplicarRunasPassivas(parts);
};

/**
 * 🪡 Tatuagem PASSIVA: runa sem lógica de gatilho está sempre ligada, então
 * ela não é ação de turno — o que ela dá, dá desde o primeiro instante da
 * cena. Roda na abertura porque é aqui que a lista de participantes está
 * fechada, e só o cliente que iniciou executa (senão duas abas aplicariam
 * duas vezes).
 */
async function aplicarRunasPassivas(parts) {
    let sys = null;
    try {
        const m = await import('./tab-ficha-win.js?v=13');
        sys = await m.registroSistema();
    } catch (e) { console.warn('registro p/ runas passivas', e); return; }
    const pecs = sys?.pecsById || {};

    for (const p of parts) {
        const ch = p.characterId ? T.chars.find(x => x.id === p.characterId) : null;
        const np = p.npcId ? T.npcs.find(x => x.id === p.npcId) : null;
        const lista = (ch?.peculiaridadesIndividuais || np?.peculiaridades || np?.peculiaridadeIds || []);
        for (const ref of lista) {
            const id = (typeof ref === 'object' && ref) ? ref.id : ref;
            const r = pecs[id]?.runa;
            if (!r?.passiva || !(r.condicoesPermanentes || []).length) continue;
            for (const cd of r.condicoesPermanentes) {
                await aplicarCondicaoEmVarios([p.id], cd.condicao, 0, null, cd.nivel || 1)
                    .catch(e => console.warn('runa passiva', e));
            }
            logChat(`🪡 ${p.name || '?'}: a runa tatuada "${r.nome || '?'}" está ligada — `
                + r.condicoesPermanentes.map(c => `${c.condicao} ${c.nivel || 1}`).join(' · '));
        }
    }
}

window.tbCombEncerrarCena = async function() {
    if (!await confirmar('Participantes e iniciativas ficam; o painel de turno some.',
        { titulo: 'Encerrar o combate desta cena?', ok: 'Encerrar' })) return;
    await salvar(partsDaCena(), { iniciado: false, retomar: null });
    logChat('🕊️ Combate encerrado pelo mestre');
    // 🧱 Nada manifestado por runa sobrevive à cena: o fluxo que sustentava a
    // parede acabou junto com o combate.
    await limparManifestacoes({ tudo: true });
    // 🌀 E ninguém sai do combate preso dentro de outro corpo.
    await desfazerIncorporacoes();
};

/**
 * 🌀 Devolve o emprestado de toda incorporação ainda de pé.
 *
 * O transe é da CENA: acabou o combate, o Xamã volta ao próprio corpo mesmo
 * que ninguém tenha tirado a condição. Sem isto, encerrar a cena deixaria o
 * personagem com os bônus da Dádiva e o token do hóspede sob controle dele
 * até alguém lembrar de desfazer na mão.
 *
 * Um write por incorporação, e elas são raras — não vale fila para isso.
 */
async function desfazerIncorporacoes() {
    const c = cenaAtiva(T.combate);
    // Só o lado que TEM a Dádiva emprestada; o hospedeiro é limpo junto por ele.
    const presos = (c?.participantes || []).filter(p => p.incorporacao && p.incorporacao.modo !== 'hospedeiro');
    for (const p of presos) {
        try { await window.tbTurnoDesfazerIncorporacao?.(p.id); }
        catch (e) { console.warn('desfazer incorporação no fim da cena', e); }
    }
}

/**
 * 🧱 Apaga o que as runas manifestaram e já venceu.
 *
 * `tudo: true` varre tudo (fim de cena). Sem ele, só o que passou da rodada
 * marcada — o escudo de 1 turno some sozinho, a parede de 1 cena fica.
 *
 * A parede cria DOIS objetos (a laje que se vê e o bloqueio na camada `luz`),
 * e os dois carregam a mesma marca: varrer por `manifestacao` pega o par
 * inteiro sem precisar saber que são dois.
 *
 * Só o mestre executa. Dois clientes varrendo o mesmo objeto dariam dois
 * deletes, e o segundo falharia no console sem motivo aparente.
 */
async function limparManifestacoes({ tudo = false } = {}) {
    if (!T.isMaster) return;
    const rodada = cenaAtiva(T.combate)?.rodada || 1;
    const mortos = [];
    for (const o of T.objects.values()) {
        const mf = o.manifestacao;
        if (!mf) continue;
        if (tudo || (mf.expiraNaRodada != null && rodada >= mf.expiraNaRodada)) mortos.push(o);
    }
    if (!mortos.length) return;
    // A laje e o bloqueio da mesma parede contam como UMA coisa no chat.
    const nomes = [...new Set(mortos.map(o => o.manifestacao.runa || 'manifestação'))];
    try {
        const { delObj } = await import('./tab-objects.js');
        for (const o of mortos) await delObj(o.id);
        logChat(`🧱 ${tudo ? 'A cena acabou e o' : 'O'} que as runas manifestaram se desfez: ${nomes.join(', ')}`);
    } catch (e) { console.warn('limpar manifestações', e); }
}

/** Facção do participante — é o que diz quem é aliado de quem para as skills. */
window.tbCombFaccao = async function(pid, valor) {
    const parts = partsDaCena().map(p => ({ ...p }));
    const p = parts.find(x => x.id === pid); if (!p) return;
    p.faccao = valor;
    await salvar(parts);
};

window.tbCombTurno = async function(dir) {
    const c = cenaAtiva(T.combate); const n = (c.participantes || []).length || 1;
    // ⚡ Fim de um turno GUARDADO em uso: não avança — volta ao turno que foi
    // interrompido, com as ações que ele ainda tinha.
    if (c.retomar && dir > 0) {
        const volta = c.retomar;
        await salvar(c.participantes || [], { turnoAtual: volta.turnoAtual || 0, acoesTurno: volta.acoes || acoesNovas(), retomar: null });
        const vez = participanteDaVez({ ...c, turnoAtual: volta.turnoAtual || 0 });
        logChat(`↩️ De volta ao turno de ${vez?.name || '?'}`);
        return;
    }
    let turno = (c.turnoAtual || 0) + dir;
    let rodada = c.rodada || 1;
    const rodadaAntes = rodada;
    if (turno >= n) { turno = 0; rodada++; }
    if (turno < 0) { turno = n - 1; rodada = Math.max(1, rodada - 1); }

    // 💤 Quem está Inconsciente/Petrificado não tem vez: a ordem passa por cima.
    // O `voltas` existe porque a mesa inteira pode cair de uma vez — sem ele o
    // laço giraria para sempre procurando alguém acordado.
    const parts = c.participantes || [];
    const pulados = [];
    for (let voltas = 0; voltas < n; voltas++) {
        const alvo = parts[turno];
        if (!alvo || !efeitoDoParticipante(alvo).perdeTurno) break;
        pulados.push(alvo.name || '?');
        turno += (dir < 0 ? -1 : 1);
        if (turno >= n) { turno = 0; rodada++; }
        if (turno < 0) { turno = n - 1; rodada = Math.max(1, rodada - 1); }
    }
    if (pulados.length) logChat(`💤 Turno pulado: ${pulados.join(', ')}`);
    // 🔁 O turno de quem estava na vez ACABOU: é agora, antes das ações serem
    // repostas, que dá para saber se ele ficou parado. Quem credita é o
    // tab-turno (é lá que moram os helpers de VD); voltar o turno não paga
    // retorno de novo — é correção de engano do mestre.
    if (dir > 0) {
        const saindo = participanteDaVez(c);
        if (saindo?.retornoTurno?.retornoRecurso) {
            await window.tbFecharTurnoRetorno?.(saindo.id, !!(c.acoesTurno || {}).movimento);
        }
    }
    // ⏪ Retrato do turno que COMEÇA: onde cada token está e como estão os
    // vitais de todos. É o que Estilhaçar Causa desfaz — sem ele, "voltar ao
    // estado de antes" não teria a que voltar. Um por participante, sobrescrito
    // a cada turno dele.
    // 🕯️ E é aqui que os rituais de N rodadas avançam uma etapa.
    let partsNovos = c.participantes || [];
    if (dir > 0) {
        partsNovos = comRetratoDoTurno(partsNovos, parts[turno]?.id, rodada);
        if (rodada > rodadaAntes) {
            partsNovos = await avancarRituais(partsNovos, rodada);
            // 🧱 e o que foi manifestado por prazo curto vence aqui
            limparManifestacoes().catch(e => console.warn('limpar manifestações', e));
        }
    }

    // ⚔️ turno novo = ações cheias (1 Padrão + 1 Movimento, §6.2).
    // A expiração de condições NÃO acontece aqui: quem vira a rodada pode ser
    // um jogador (encerrando o próprio turno) e as rules não deixam ele limpar
    // ficha de NPC — o MESTRE expira pelo snapshot (checarCondicoesRodada).
    await salvar(partsNovos, { turnoAtual: turno, rodada, acoesTurno: acoesNovas() });
    if (c.iniciado) {
        const vez = participanteDaVez({ ...c, turnoAtual: turno });
        if (vez) logChat(`▶️ Vez de ${vez.name || '?'}${rodada !== rodadaAntes ? ` (Rodada ${rodada})` : ''}`);
    }
    // F4.3: expira templates com duração ao virar a rodada
    if (rodada > rodadaAntes) {
        if (!c.iniciado) logChat(`🔄 Rodada ${rodada}`);   // com cena iniciada a vez já anuncia a rodada
        try { const m = await import('./tab-templates.js'); m.expirarTemplates(rodada); } catch (e) {}
    }
};

/** Vitais atuais de um participante, no formato do retrato. */
function vitaisDoParticipante(p) {
    if (p.characterId) {
        const v = VITAIS.get(p.characterId);
        return { pid: p.id, vit: v?.hp ?? null, ener: v?.ener ?? null, san: v?.san ?? null };
    }
    const vd = T.npcs.find(x => x.id === p.npcId)?.valoresDer?.atual || {};
    return { pid: p.id, vit: vd.VIT ?? null, ener: vd.ENER ?? null, san: vd.SAN ?? null };
}

/**
 * ⏪ Guarda no participante o retrato do turno que começa agora.
 * É o que Estilhaçar Causa desfaz: posição dos tokens e vitais de todos.
 */
function comRetratoDoTurno(participantes, pid, rodada) {
    if (!pid) return participantes;
    const tokens = [...T.objects.values()]
        .filter(o => o.tipo === 'token')
        .map(o => ({ id: o.id, x: o.x, y: o.y }));
    const vitais = participantes.map(vitaisDoParticipante);
    const retrato = tirarRetrato({ pid, rodada, tokens, vitais });
    return participantes.map(x => x.id === pid ? { ...x, retratoTurno: retrato } : x);
}

/**
 * 🕯️ Rituais de N rodadas avançam uma etapa por rodada. No fim de cada uma,
 * resolve-se a parte dela; ao completar, o ritual sai do participante e a mesa
 * é avisada de que chegou a hora do desfecho.
 */
async function avancarRituais(participantes, rodada) {
    let mudou = false;
    const out = participantes.map(p => {
        if (!p.ritual) return p;
        const r = avancarRitual(p.ritual);
        mudou = true;
        if (r.completou) {
            logChat(`🕯️ ${p.name || '?'}: ${p.ritual.nome} — ritual COMPLETO (${r.etapa}/${r.total}). `
                + `O Mestre resolve o desfecho no lugar do rito.`);
            const { ritual, ...limpo } = p;
            return limpo;
        }
        logChat(`🕯️ ${p.name || '?'}: ${p.ritual.nome} — ${r.etapa}/${r.total} dos passos resolvidos`);
        return { ...p, ritual: r.ritual };
    });
    return mudou ? out : participantes;
}

// ---- ⏱️ Expiração de condições — SEMPRE no cliente do mestre (secreto) ----
// Disparada pelo snapshot do doc de combate: qualquer cliente pode ter virado a
// rodada, mas quem remove (participante + ficha) e recebe o aviso é o mestre.
let _rodadaChecada = null;
export async function checarCondicoesRodada() {
    if (!T.isMaster || T.mode !== 'secret') return;
    const c = cenaAtiva(T.combate);
    if (!c?.iniciado) { _rodadaChecada = null; return; }
    const chave = `${c.id}:${c.rodada || 1}`;
    if (_rodadaChecada === chave) return;
    _rodadaChecada = chave;
    const { participantes, expiradas } = tirarCondicoesExpiradas(c.participantes || [], c.rodada || 1);
    if (expiradas.length) {
        await salvar(participantes);
        for (const e of expiradas) await aposRemoverCondicao(participantes.find(x => x.id === e.pid), e.cond.nome);
        logChat(`⏱️ Acabou: ${expiradas.map(e => `${e.cond.icone} ${e.cond.nome} (${e.pNome})`).join(' · ')}`);
        avisoCondicoesExpiradas(expiradas);
    }
    // Depois de expirar: quem sobrou sangra, regenera e tenta se soltar.
    await aplicarTickDeRodada(participantes);
    await pedirTestesDeSaida(participantes, 'virada_da_rodada');
}

/** 🔁 A conjuração falhou: marca no acumulador do turno de quem conjurou. */
export async function marcarFalhaDeConjuracao(pid) {
    if (!pid) return;
    const c = cenaAtiva(T.combate);
    const p = (c?.participantes || []).find(x => x.id === pid);
    if (!p?.retornoTurno?.retornoRecurso || p.retornoTurno.falhou) return;
    const parts = c.participantes.map(x => x.id !== pid ? x
        : { ...x, retornoTurno: { ...x.retornoTurno, falhou: true } });
    await salvar(parts);
}

/**
 * 🩸 Sangrando, Queimando, Regenerando: o efeito por rodada de cada condição.
 * Roda uma vez por rodada, no cliente do MESTRE (mesma trava do expirar) —
 * qualquer outro cliente aplicaria o dano de novo, e ninguém quer sangrar duas
 * vezes porque dois jogadores estavam com a aba aberta.
 */
async function aplicarTickDeRodada(participantes) {
    const linhas = [];
    for (const p of participantes) {
        for (const t of efeitoDoParticipante(p).porRodada) {
            const alvo = alvoDoTickRodada(t.efeito);
            if (!alvo) continue;
            const r = rolarFormula(t.valor);
            if (!(r.total > 0)) continue;
            await window.tbCombStat(p.id, alvo.stat, alvo.sinal * r.total);
            linhas.push(`${t.icone} ${p.name || '?'} ${alvo.sinal < 0 ? '−' : '+'}${r.total} ${alvo.stat} (${t.condicao}${r.dados.length ? ' · ' + r.detalhe : ''})`);
        }
    }
    if (linhas.length) logChat(`🩸 Por rodada: ${linhas.join(' · ')}`);
}

/**
 * 🎲 Condição que sai com teste: cria o teste da cena já preenchido com o que o
 * cadastro mandou. Reusa o mesmo `cena.testes` do "🎯 Pedir teste" do mestre —
 * quando o resultado sai positivo, `tbTesteRolar` tira a condição sozinho.
 */
async function pedirTestesDeSaida(participantes, quando) {
    const testes = (cenaAtiva(T.combate).testes || []).map(t => ({ ...t, resultados: { ...(t.resultados || {}) } }));
    let mudou = false;
    for (const p of participantes) {
        for (const t of efeitoDoParticipante(p).testes) {
            if (t.quando !== quando) continue;
            // um teste por condição por rodada: se já existe e este participante
            // está nele, não empilha outro pedido igual
            const ja = testes.find(x => x.condSaida?.condicao === t.condicao && (x.participantes || []).includes(p.id));
            if (ja) continue;
            const irmao = testes.find(x => x.condSaida?.condicao === t.condicao && x.nome === t.nome && x.mod === t.mod);
            if (irmao) { irmao.participantes = [...(irmao.participantes || []), p.id]; }
            else testes.push({
                id: 't' + uid(), nome: t.nome, mod: t.mod, participantes: [p.id], resultados: {},
                condSaida: { condicao: t.condicao, sucessoRemove: t.sucessoRemove },
            });
            mudou = true;
        }
    }
    if (!mudou) return;
    await salvar(participantes, { testes });
    logChat(`🎲 Teste para se livrar de condição pedido — role no card do participante`);
}

// ---- ⏱️ Aviso do mestre: condições cujo tempo acabou (com direito a prolongar) ----
let _expiradas = [];
function avisoCondicoesExpiradas(lista) {
    _expiradas = lista;
    abrirModal('⏱️ Condições que terminaram', `
        <div class="tb-muted" style="font-size:.8rem;margin-bottom:10px">O tempo destas condições acabou na virada da rodada e elas já saíram dos participantes. Se alguma ainda vale, prolongue:</div>
        ${lista.map((e, i) => `<div class="tb-list-row" id="expRow_${i}">
            <span style="flex:1;min-width:0">${esc(e.cond.icone)} <b>${esc(e.cond.nome)}</b> — ${esc(e.pNome)}</span>
            <input type="number" id="expN_${i}" value="1" min="1" style="width:56px" title="rodadas a mais">
            <button class="tb-btn tb-btn-small" onclick="tbCondProlongar(${i})">↩️ Prolongar</button>
        </div>`).join('')}
        <div class="tb-modal-actions"><button class="tb-btn" onclick="tbFecharModal()">✅ Entendido</button></div>
    `);
}
window.tbCondProlongar = async function(i) {
    const e = _expiradas[i]; if (!e) return;
    const nr = Math.max(1, parseInt(document.getElementById('expN_' + i)?.value) || 1);
    const parts = partsDaCena().map(p => ({ ...p }));
    const p = parts.find(x => x.id === e.pid);
    if (!p) { toast('⚠️ O participante não está mais na cena', 'warning'); return; }
    const rodada = cenaAtiva(T.combate).rodada || 1;
    p.condicoes = [...(p.condicoes || []), { ...e.cond, expiraNaRodada: rodada + nr }];
    await salvar(parts);
    await sincAdicaoFicha(p, { ...e.cond, duracao: nr }, null);
    document.getElementById('expRow_' + i)?.remove();
    toast(`↩️ "${e.cond.nome}" prolongada por +${nr} rodada(s)`);
    logChat(`↩️ ${e.cond.icone} ${e.cond.nome} (${e.pNome}) prolongada por +${nr} rodada(s)`);
};

window.tbCombVisibilidade = async function() {
    const atual = !!T.estado?.combateVisivelPublico;
    await setDoc(refEstado(), { combateVisivelPublico: !atual }, { merge: true });
    toast(!atual ? '👁️ Combate visível ao público' : '🚫 Combate oculto do público');
};

window.tbCombStat = async function(pid, stat, amt) {
    const parts = partsDaCena().map(p => ({ ...p }));
    const p = parts.find(x => x.id === pid); if (!p) return;
    const map = { VIT: ['hpCurrent', 'hpMax'], ENER: ['enerCurrent', 'enerMax'], SAN: ['sanCurrent', 'sanMax'] };
    const [cur, max] = map[stat];

    // Ler valores corretos da Ficha (VITAIS) se possível, ignorando cache do combate
    let curVal = p[cur] ?? 0;
    let maxVal = p[max] ?? 999;
    if (p.characterId) {
        const v = VITAIS.get(p.characterId);
        if (v) {
            const vmap = { VIT: ['hp','hpMax'], ENER: ['ener','enerMax'], SAN: ['san','sanMax'] };
            curVal = v[vmap[stat][0]];
            maxVal = v[vmap[stat][1]];
        }
    } else if (p.npcId) {
        const n = T.npcs.find(x => x.id === p.npcId);
        if (n) {
            const vd = n.valoresDer || {};
            const atual = vd.atual || {};
            maxVal = vd[stat] || maxVal;
            if (atual[stat] !== undefined && atual[stat] !== null) {
                curVal = Math.min(atual[stat], maxVal);
            } else {
                curVal = maxVal;
            }
        }
    }

    const novoVal = vNum(Math.max(0, Math.min(curVal + amt, maxVal)));
    p[cur] = novoVal;
    await salvar(parts);

    // ===== Sincronização bidirecional: Combat → Ficha =====
    const atualMap = { VIT: 'vit_atual', ENER: 'ener_atual', SAN: 'san_atual' };
    const curMap = { VIT: 'hpCurrent', ENER: 'enerCurrent', SAN: 'sanCurrent' };

    // Personagem de jogador → atualizar doc char
    if (p.characterId) {
        try {
            await updateDoc(doc(db, 'char', p.characterId), {
                [curMap[stat]]: novoVal,
                [`derivedValues.${atualMap[stat]}`]: String(novoVal)
            });
        } catch (e) { console.warn('sync char stat', e); }
    }

    // NPC → atualizar doc npcs (legacy + system key)
    if (p.npcId) {
        try {
            const npcSnap = await getDoc(doc(db, 'npcs', p.npcId));
            if (npcSnap.exists()) {
                await updateDoc(doc(db, 'npcs', p.npcId),
                    patchVitalAtualNpc(npcSnap.data().valoresDer?.atual, stat, p[cur], espelhosDoVitalNpc(stat)));
            }
        } catch (e) { console.warn('sync npc stat', e); }
    }
};

/**
 * ± no ATUAL de um VD de Status de Combate (campoAtual) direto no card.
 * Grava onde a FICHA lê: char em derivedValues['dv_<key>_atual'];
 * NPC em valoresDer.atual[<key>]. Os snapshots repintam todo mundo.
 */
/** Grava o ATUAL de um VD num valor absoluto (usado pelo pagamento de custo). */
window.tbCombSetVd = async function(pid, key, valor) {
    const p = partsDaCena().find(x => x.id === pid); if (!p) return;
    const v = vNum(Math.max(0, valor));
    if (p.characterId) await updateDoc(doc(db, 'char', p.characterId), { [`derivedValues.dv_${key}_atual`]: String(v) });
    else if (p.npcId) await updateDoc(doc(db, 'npcs', p.npcId), { [`valoresDer.atual.${key}`]: v });
};

/** Grava um vital num valor absoluto — reusa o caminho do tbCombStat (delta). */
window.tbCombSetVital = async function(pid, stat, valor) {
    const p = partsDaCena().find(x => x.id === pid); if (!p) return;
    const map = { VIT: 'hpCurrent', ENER: 'enerCurrent', SAN: 'sanCurrent' };
    let atual = p[map[stat]] ?? 0;
    if (p.characterId) { const v = VITAIS.get(p.characterId); if (v) atual = { VIT: v.hp, ENER: v.ener, SAN: v.san }[stat]; }
    else if (p.npcId) {
        const vd = T.npcs.find(x => x.id === p.npcId)?.valoresDer || {};
        atual = (vd.atual || {})[stat] ?? vd[stat] ?? atual;
    }
    const delta = vNum(valor) - vNum(atual);
    if (delta) await window.tbCombStat(pid, stat, delta);
};

window.tbCombVd = async function(pid, key, amt) {
    const p = partsDaCena().find(x => x.id === pid); if (!p) return;
    const d = vdsCombateDaFonte(fonteDoParticipante(p)).find(x => x.key === key); if (!d) return;
    const novo = vNum(Math.max(0, Math.min((d.atual ?? d.valor) + amt, d.valor)));
    try {
        if (p.characterId) {
            await updateDoc(doc(db, 'char', p.characterId), { [`derivedValues.dv_${key}_atual`]: String(novo) });
        } else if (p.npcId) {
            await updateDoc(doc(db, 'npcs', p.npcId), { [`valoresDer.atual.${key}`]: novo });
        }
    } catch (e) { console.warn('vd atual', e); toast('❌ Erro ao salvar o valor', 'danger'); }
};

// ===== Cache de condições do sistema =====
let _systemConditions = null;

export async function carregarCondicoesSistema() {
    if (_systemConditions) return _systemConditions;
    try {
        const { getDocs: gd, collection: col } = await import('../../painel-mestre/js/firebase-config.js');
        const snap = await gd(col(db, 'system/data/conditions'));
        _systemConditions = [];
        snap.forEach(d => {
            const data = d.data();
            if (data.publicado !== false) _systemConditions.push({ id: d.id, ...data });
        });
        _systemConditions.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
    } catch (e) {
        console.warn('⚠️ Não foi possível carregar condições do sistema:', e);
        _systemConditions = [];
    }
    // Deslocamento, visão, render e mira leem o registro por `T` — tab-state é
    // módulo folha e não pode importar este arquivo sem fechar ciclo.
    T.condicoesSistema = _systemConditions;
    return _systemConditions;
}

/** Efeito somado das condições de um participante, com o registro já carregado. */
export function efeitoDoParticipante(p) {
    return efeitoDasCondicoes(p?.condicoes || [], T.condicoesSistema);
}

function fecharCondPicker() {
    document.getElementById('tbCondPickerOverlay')?.remove();
}

// Emojis prontos da condição personalizada (males, controles e uns buffs)
const EMOJIS_COND = ['☠️', '💀', '🔥', '❄️', '⚡', '🩸', '💤', '😵', '🤢', '😨', '🕸️', '⛓️', '🌀', '💫', '🐌', '🛡️', '💪', '✨', '🍀', '👁️'];

/**
 * Picker de condição (registro do sistema + personalizada), desacoplado de quem
 * aplica: o combate aplica no participante, a janela de ficha aplica no doc.
 * @param aplicar (cond, tplOuNull) => Promise — cond = { nome, icone, descricao, duracao }
 *        `duracao` em rodadas (0 = até remover).
 */
export async function escolherCondicao(aplicar) {
    const conditions = await carregarCondicoesSistema();
    const overlay = document.createElement('div');
    overlay.id = 'tbCondPickerOverlay';
    overlay.className = 'tb-cond-picker-overlay';

    const itensHtml = conditions.map((c, i) =>
        `<div class="tb-cond-picker-item" data-idx="${i}">
            <span class="tb-cpi-icon">${esc(c.icone || '💀')}</span>
            <span class="tb-cpi-nome">${esc(c.nome || 'Sem nome')}</span>
            ${c.duracao ? `<span class="tb-cpi-sub">⏱️ ${esc(c.duracao)}</span>` : ''}
        </div>`
    ).join('');

    overlay.innerHTML = `<div class="tb-cond-picker">
        <div class="tb-cond-picker-head">
            <span>☠️ Aplicar Condição</span>
            <button class="tb-mini-btn" onclick="document.getElementById('tbCondPickerOverlay')?.remove()">✕</button>
        </div>
        <label class="tb-check tb-check-sm" style="padding:6px 10px" title="Ao virar a rodada, o contador desce; no fim, a condição sai sozinha (o mestre é avisado)">
            ⏱️ Duração <input type="number" id="tbCondDur" min="1" placeholder="∞" style="width:64px"> rodadas (vazio = até remover)
        </label>
        <input type="text" class="tb-cond-picker-search" id="tbCondSearch" placeholder="🔍 Buscar condição..." autocomplete="off">
        <div class="tb-cond-picker-list" id="tbCondList">
            ${itensHtml || '<div class="tb-muted" style="text-align:center;padding:16px">Nenhuma condição cadastrada no sistema</div>'}
        </div>
        <div class="tb-cond-picker-custom">
            <div class="tb-section-title">✏️ Condição Personalizada</div>
            <div style="display:flex;gap:6px">
                <select id="tbCondCustomIcone" title="Ícone da condição (é o que aparece no token)">
                    ${EMOJIS_COND.map(e2 => `<option>${e2}</option>`).join('')}
                </select>
                <input type="text" id="tbCondCustomNome" placeholder="Nome (ex: Atordoado)" style="flex:1">
            </div>
            <input type="text" id="tbCondCustomDesc" placeholder="Descrição / efeito (opcional)">
            <button class="tb-btn tb-btn-success tb-btn-small" id="tbCondCustomBtn">➕ Criar e Aplicar</button>
        </div>
    </div>`;

    document.body.appendChild(overlay);
    const duracaoEscolhida = () => Math.max(0, parseInt(document.getElementById('tbCondDur')?.value) || 0);

    // Busca
    const searchEl = document.getElementById('tbCondSearch');
    searchEl.focus();
    searchEl.oninput = () => {
        const q = searchEl.value.toLowerCase().trim();
        document.querySelectorAll('#tbCondList .tb-cond-picker-item').forEach(el => {
            const nome = el.querySelector('.tb-cpi-nome')?.textContent?.toLowerCase() || '';
            el.style.display = (!q || nome.includes(q)) ? '' : 'none';
        });
    };

    // Clique em condição do sistema
    document.querySelectorAll('#tbCondList .tb-cond-picker-item').forEach(el => {
        el.onclick = async () => {
            const idx = parseInt(el.dataset.idx);
            const c = conditions[idx];
            if (!c) return;
            await aplicar({ nome: c.nome, icone: c.icone || '☠️', descricao: c.descricao || '', duracao: duracaoEscolhida() }, c);
            fecharCondPicker();
        };
    });

    // Condição personalizada
    document.getElementById('tbCondCustomBtn').onclick = async () => {
        const nome = document.getElementById('tbCondCustomNome')?.value?.trim();
        if (!nome) { toast('⚠️ Insira o nome da condição', 'warning'); return; }
        await aplicar({
            nome,
            icone: document.getElementById('tbCondCustomIcone')?.value || '☠️',
            descricao: document.getElementById('tbCondCustomDesc')?.value?.trim() || '',
            duracao: duracaoEscolhida(),
        }, null);
        fecharCondPicker();
    };

    // Fechar ao clicar fora
    overlay.addEventListener('click', e => { if (e.target === overlay) fecharCondPicker(); });
}

window.tbCombCondAdd = (pid) => escolherCondicao((cond, tpl) => aplicarCondicaoCombate(pid, cond, tpl));

/**
 * Aplica uma condição ao participante do combate e sincroniza com a ficha.
 * @param {string} pid - ID do participante no combate
 * @param {object} cond - { nome, icone, descricao, duracao } vindo do picker
 * @param {object|null} tpl - Template da condição do sistema (ou null para personalizada)
 */
/**
 * 📈 Põe a condição no participante respeitando o cadastro.
 * Condição que ACUMULA e já está lá sobe de nível (até o teto) em vez de virar
 * uma segunda linha igual; qualquer outra entra como sempre entrou.
 * @returns { condicoes, nivel, subiu, noTeto }
 */
function empilharCondicao(condicoesAtuais, cond, tpl, niveis = 1) {
    const lista = condicoesAtuais || [];
    // Quantos degraus esta aplicação vale. "fica Fortalecido 2" entra em 2, não
    // em 1 — antes o nível do cadastro se perdia e toda condição valia 1.
    const passo = Math.max(1, Number(niveis) || 1);
    if (!tpl?.acumulaNiveis) return { condicoes: [...lista, cond], nivel: 1, subiu: false, noTeto: false };

    const teto = Number(tpl.nivelMaximo) > 0 ? Number(tpl.nivelMaximo) : Infinity;
    const i = lista.map(condDoParticipante)
        .findIndex(c => (c.nome || '').toLowerCase() === (cond.nome || '').toLowerCase());
    if (i < 0) {
        const n = Math.min(passo, teto);
        return { condicoes: [...lista, { ...cond, nivel: n }], nivel: n, subiu: false, noTeto: false };
    }

    const atual = condDoParticipante(lista[i]);
    const novo = Math.min(atual.nivel + passo, teto);
    return {
        condicoes: lista.map((cd, idx) => idx === i ? { ...condDoParticipante(cd), nivel: novo } : cd),
        nivel: novo, subiu: novo > atual.nivel, noTeto: novo === atual.nivel,
    };
}

async function aplicarCondicaoCombate(pid, cond, tpl) {
    const parts = partsDaCena().map(p => ({ ...p }));
    const p = parts.find(x => x.id === pid); if (!p) return;
    const rodada = cenaAtiva(T.combate).rodada || 1;
    const nova = {
        nome: cond.nome.trim(),
        icone: cond.icone || '☠️',
        descricao: cond.descricao || '',
        expiraNaRodada: cond.duracao > 0 ? rodada + cond.duracao : null,
    };
    const emp = empilharCondicao(p.condicoes, nova, tpl);
    p.condicoes = emp.condicoes;
    await salvar(parts);
    const prazo = cond.duracao > 0 ? ` por ${cond.duracao} rodada(s)` : '';
    if (emp.noTeto) {
        toast(`📈 "${cond.nome}" já está no nível máximo (${emp.nivel})`, 'warning');
        logChat(`📈 ${p.name || '?'}: ${nova.icone} ${cond.nome} já no teto (nv ${emp.nivel})`);
    } else if (emp.subiu) {
        toast(`📈 "${cond.nome}" subiu para o nível ${emp.nivel}`);
        logChat(`📈 ${p.name || '?'}: ${nova.icone} ${cond.nome} → nv ${emp.nivel}`);
    } else {
        toast(`☠️ Condição "${cond.nome}" aplicada${prazo}`);
        logChat(`☠️ ${p.name || '?'}: +${nova.icone} ${cond.nome}${prazo}`);
    }
    // Nível novo de condição que já estava lá não duplica a linha na ficha.
    if (!emp.subiu && !emp.noTeto) await sincAdicaoFicha(p, cond, tpl);
}

/** Espelha a condição recém-aplicada na ficha (char ou NPC) do participante. */
async function sincAdicaoFicha(p, cond, tpl) {
    const alvo = p.characterId ? ['char', p.characterId] : p.npcId ? ['npcs', p.npcId] : null;
    if (!alvo) return;
    try {
        const snap = await getDoc(doc(db, alvo[0], alvo[1]));
        if (!snap.exists()) return;
        const conditions = snap.data().conditions || [];
        conditions.push({
            nome: cond.nome.trim(),
            icone: cond.icone || tpl?.icone || '☠️',
            descricao: cond.descricao || tpl?.descricao || '',
            tempoAtual: '',
            tempoRestante: cond.duracao > 0 ? `${cond.duracao} rodada(s)` : (tpl?.duracao || ''),
            modeloId: tpl?.id || null,
            efeitoMecanicaIds: tpl?.efeitoMecanicaIds || []
        });
        await updateDoc(doc(db, alvo[0], alvo[1]), { conditions });
    } catch (e) { console.warn('sync condition to ficha', e); }
}

/**
 * ✨ Skill com condição vinculada: aplica a condição em VÁRIOS participantes de
 * uma vez (1 write no doc + espelho nas fichas). O nome resolve contra o
 * registro do sistema (ícone/descrição); sem registro vira personalizada.
 */
export async function aplicarCondicaoEmVarios(pids, nome, rodadas, porPid, nivel = 1, extra = null) {
    if (!pids?.length || !nome) return;
    const tpl = (await carregarCondicoesSistema()).find(c => (c.nome || '').toLowerCase() === nome.toLowerCase()) || null;
    const rodada = cenaAtiva(T.combate).rodada || 1;
    let parts = partsDaCena().map(p => ({ ...p }));
    const cond = {
        nome: tpl?.nome || nome, icone: tpl?.icone || '☠️', descricao: tpl?.descricao || '',
        expiraNaRodada: rodadas > 0 ? rodada + rodadas : null,
        // Quem aplicou: só a Presa do Caçador usa hoje, mas guardar sempre não
        // custa nada e é o que permite "a marca é de quem marcou".
        porPid: porPid || null,
        // 🛡️ Marcas que o CADASTRO pendura na aplicação (não na condição em si):
        // `saiComAcaoPadrao` é a Postura Defensiva — a guarda cai quando quem
        // está de guarda parte para cima.
        ...(extra || {}),
    };
    // 🛡️ POSTURA é uma só: "até trocar de postura" está no texto das duas
    // (Defensiva e Ofensiva). Entrar numa larga a outra — senão dava para
    // acumular a Blindagem da Defensiva com o dano da Ofensiva.
    if (cond.saiComAcaoPadrao) {
        parts = parts.map(p => !pids.includes(p.id) ? p : {
            ...p,
            condicoes: (p.condicoes || []).filter(cd => !(cd && typeof cd === 'object' && cd.saiComAcaoPadrao)),
        });
    }
    // 🎯 Condição EXCLUSIVA: uma presa por caçador. Marcar outra solta a
    // anterior, senão o Caçador acumularia presas de graça.
    if (tpl?.exclusivaPorAplicador && porPid) {
        parts = parts.map(p => ({
            ...p,
            condicoes: (p.condicoes || []).filter(cd =>
                !(cd && typeof cd === 'object' && cd.porPid === porPid
                  && String(cd.nome || '').toLowerCase() === String(cond.nome).toLowerCase())),
        }));
    }
    const alvos = [];
    const subiram = [];
    for (const pid of pids) {
        const p = parts.find(x => x.id === pid); if (!p) continue;
        const emp = empilharCondicao(p.condicoes, { ...cond }, tpl, nivel);
        p.condicoes = emp.condicoes;
        (emp.subiu || emp.noTeto ? subiram : alvos).push(p);
    }
    if (!alvos.length && !subiram.length) return;
    await salvar(parts);
    const prazo = rodadas > 0 ? ` (${rodadas} rodada${rodadas > 1 ? 's' : ''})` : '';
    if (alvos.length) logChat(`☠️ ${cond.icone} ${cond.nome}${prazo} em: ${alvos.map(p => p.name || '?').join(', ')}`);
    if (subiram.length) logChat(`📈 ${cond.icone} ${cond.nome} subiu de nível em: ${subiram.map(p => p.name || '?').join(', ')}`);
    for (const p of alvos) await sincAdicaoFicha(p, { nome: cond.nome, icone: cond.icone, descricao: cond.descricao, duracao: rodadas || 0 }, tpl);
}

/** Tira da ficha (char ou NPC) a condição removida do combate, pelo nome. */
/**
 * 🌀 Tirar "Em Transe" DESFAZ a incorporação.
 *
 * O Xamã e o Druida deixam um token inerte e agem pelo outro; a condição no
 * inerte é o que diz que o transe está de pé. Quando ela sai — por remoção do
 * mestre, por expirar na rodada, ou por o alvo se livrar dela — o emprestado
 * tem de voltar: os bônus da Dádiva, os módulos, e o controle do token.
 *
 * Mora aqui, e não dentro de `sincRemocaoFicha`, porque aquilo espelha
 * condição na ficha e mais nada. Os três pontos que removem condição passam
 * por esta função em vez daquela.
 */
async function aposRemoverCondicao(p, nome) {
    await sincRemocaoFicha(p, nome);
    if (!p || !nome) return;
    const norm = (x) => String(x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    if (norm(nome) !== norm(CONDICAO_TRANSE)) return;
    if (!p.incorporacao) return;
    try { await window.tbTurnoDesfazerIncorporacao?.(p.id); }
    catch (e) { console.warn('desfazer incorporação ao sair do transe', e); }
}

async function sincRemocaoFicha(p, nome) {
    if (!p || !nome) return;
    const alvo = p.characterId ? ['char', p.characterId] : p.npcId ? ['npcs', p.npcId] : null;
    if (!alvo) return;
    try {
        const snap = await getDoc(doc(db, alvo[0], alvo[1]));
        if (!snap.exists()) return;
        const conditions = snap.data().conditions || [];
        const idx = conditions.findIndex(c => c.nome === nome);
        if (idx >= 0) {
            conditions.splice(idx, 1);
            await updateDoc(doc(db, alvo[0], alvo[1]), { conditions });
        }
    } catch (e) { console.warn('sync condition removal to ficha', e); }
}

window.tbCombCondRm = async function(pid, i) {
    const parts = partsDaCena().map(p => ({ ...p }));
    const p = parts.find(x => x.id === pid); if (!p) return;
    const removida = condDoParticipante((p.condicoes || [])[i]).nome;
    p.condicoes = (p.condicoes || []).filter((_, ci) => ci !== i);
    await salvar(parts);
    if (removida) logChat(`✨ ${p.name || '?'}: −${removida}`);
    await aposRemoverCondicao(p, removida);
};

window.tbCombRemover = async function(pid) {
    if (!await confirmar('Remover do combate?', { ok: 'Remover', perigo: true })) return;
    const parts = partsDaCena().filter(p => p.id !== pid);
    await salvar(parts);
};

// ===== 🎯 AÇÕES DOS TESTES DA CENA =====
/** Cópia rasa dos testes da cena aberta, pronta para editar e salvar. */
const testesDaCena = () => (cenaAtiva(T.combate).testes || []).map(t => ({ ...t, resultados: { ...(t.resultados || {}) } }));

window.tbTesteNovo = function() {
    const parts = partsDaCena();
    if (!parts.length) { toast('⚠️ A cena não tem participantes', 'warning'); return; }
    abrirModal('🎯 Pedir teste', `
        <div class="tb-form-grid tb-form-grid-1">
            <label>Teste (componentes somados: perícia, atributo ou VD)
                <input type="text" id="tst_nome" placeholder="Ex.: Raciocínio + Observação · Percepção + Furtividade"></label>
        </div>
        <div class="tb-form-grid">
            <label>Modificador (dificuldade: −2 difícil, +1 fácil...)<input type="number" id="tst_mod" value="0"></label>
        </div>
        <div class="tb-form-grid tb-form-grid-1">
            <label>Quem faz o teste</label>
            ${parts.map(p => `<label class="tb-check tb-check-sm"><input type="checkbox" data-tstpid="${p.id}" checked> ${esc(p.name || '?')} <span class="tb-muted">${esc(p.type || '')}</span></label>`).join('')}
        </div>
        <div class="tb-modal-actions"><button class="tb-btn tb-btn-success" onclick="tbTesteCriar()">🎯 Pedir</button></div>`);
};

window.tbTesteCriar = async function() {
    const nome = document.getElementById('tst_nome')?.value?.trim();
    if (!nome) { toast('⚠️ Diga qual é o teste (ex.: Raciocínio + Observação)', 'warning'); return; }
    const mod = parseFloat(document.getElementById('tst_mod')?.value) || 0;
    const pids = [...document.querySelectorAll('#tbModal input[data-tstpid]:checked')].map(i => i.dataset.tstpid);
    if (!pids.length) { toast('⚠️ Escolha pelo menos um participante', 'warning'); return; }
    const testes = [...testesDaCena(), { id: 't' + uid(), nome, mod, participantes: pids, resultados: {} }];
    await salvar(partsDaCena(), { testes });
    fecharModal();
    toast(`🎯 Teste "${nome}" pedido para ${pids.length} participante(s)`);
};

window.tbTesteApagar = async function(tid) {
    const t = testesDaCena().find(x => x.id === tid);
    if (!await confirmar(`O teste "${t?.nome || ''}" e os resultados dele somem.`,
        { titulo: 'Apagar teste', ok: 'Apagar', perigo: true })) return;
    await salvar(partsDaCena(), { testes: testesDaCena().filter(x => x.id !== tid) });
};

/** Rola 1d10 contra o Alvo (do input, do resultado anterior ou da ficha). */
window.tbTesteRolar = async function(tid, pid) {
    const testes = testesDaCena();
    const t = testes.find(x => x.id === tid); if (!t) return;
    const p = partsDaCena().find(x => x.id === pid); if (!p) return;
    const input = document.getElementById(`tstAlvo_${tid}_${pid}`);
    let alvo = input && input.value !== '' ? parseFloat(input.value)
        : (typeof t.resultados[pid]?.alvo === 'number' ? t.resultados[pid].alvo : alvoSugerido(t, p));
    if (alvo == null || isNaN(alvo)) {
        const s = await perguntar(`Alvo de ${p.name} em "${t.nome}":`, { tipo: 'number' });
        if (s === null) return;
        alvo = parseFloat(s);
        if (isNaN(alvo)) { toast('⚠️ Alvo inválido', 'warning'); return; }
    }
    const dado = 1 + Math.floor(Math.random() * 10);
    const graus = grausDoDado(alvo, dado);
    t.resultados[pid] = { graus, dado, alvo };
    await salvar(partsDaCena(), { testes });
    toast(`🎲 ${esc(p.name)} — ${esc(t.nome)}: d10 ${dado} vs Alvo ${alvo} → ${fmtGraus(graus)}` +
        (dado === 1 ? ' ✨ crítico!' : dado === 10 ? ' 💀 falha crítica!' : ''));
    logChat(`🎯 ${p.name} — ${t.nome}: d10 ${dado} vs Alvo ${alvo} → ${fmtGraus(graus)}` +
        (dado === 1 ? ' ✨ crítico' : dado === 10 ? ' 💀 falha crítica' : ''));
    await resolverTesteDeSaida(t, pid, graus);
};

/**
 * 🎲 Teste que existia para se livrar de uma condição: passou (Grau positivo),
 * a condição sai — inteira, ou um nível de cada vez quando ela acumula.
 * Chamada pelos DOIS caminhos de resultado (rolar no mapa e digitar na mão),
 * porque teste rolado na mesa física livra tanto quanto o rolado aqui.
 */
async function resolverTesteDeSaida(teste, pid, graus) {
    const cfg = teste?.condSaida;
    if (!cfg || !(graus > 0)) return;
    const parts = partsDaCena().map(p => ({ ...p }));
    const p = parts.find(x => x.id === pid); if (!p) return;

    const alvo = (p.condicoes || []).map(condDoParticipante)
        .findIndex(c => (c.nome || '').toLowerCase() === (cfg.condicao || '').toLowerCase());
    if (alvo < 0) return;

    const atual = condDoParticipante(p.condicoes[alvo]);
    const cai = cfg.sucessoRemove === 'um_nivel' && atual.nivel > 1;
    if (cai) {
        p.condicoes = p.condicoes.map((cd, i) => i === alvo ? { ...condDoParticipante(cd), nivel: atual.nivel - 1 } : cd);
    } else {
        p.condicoes = p.condicoes.filter((_, i) => i !== alvo);
    }
    // O teste cumpriu o papel para este participante — sai do pedido.
    const testes = testesDaCena().map(x => x.id !== teste.id ? x : {
        ...x, participantes: (x.participantes || []).filter(id => id !== pid),
    }).filter(x => (x.participantes || []).length);

    await salvar(parts, { testes });
    if (cai) {
        toast(`📉 ${p.name}: ${atual.nome} caiu para o nível ${atual.nivel - 1}`);
        logChat(`📉 ${p.name || '?'}: ${atual.icone} ${atual.nome} nv ${atual.nivel} → ${atual.nivel - 1}`);
    } else {
        toast(`✅ ${p.name} se livrou de ${atual.nome}`);
        logChat(`✅ ${p.name || '?'} se livrou de ${atual.icone} ${atual.nome}`);
        await aposRemoverCondicao(p, atual.nome);
    }
}

/** Teste feito fisicamente na mesa: o mestre digita os Graus direto. */
window.tbTesteInserir = async function(tid, pid) {
    const testes = testesDaCena();
    const t = testes.find(x => x.id === tid); if (!t) return;
    const p = partsDaCena().find(x => x.id === pid); if (!p) return;
    const s = await perguntar(`Graus de ${p.name} em "${t.nome}":`,
        { tipo: 'number', placeholder: '+2, 0, -1...' });
    if (s === null) return;
    const graus = parseInt(String(s).replace('+', ''), 10);
    if (isNaN(graus)) { toast('⚠️ Valor inválido — digite um número de Graus', 'warning'); return; }
    t.resultados[pid] = { graus, dado: null, alvo: null };
    await salvar(partsDaCena(), { testes });
    logChat(`🎯 ${p.name} — ${t.nome}: ${fmtGraus(graus)} (rolado na mesa)`);
    await resolverTesteDeSaida(t, pid, graus);
};
