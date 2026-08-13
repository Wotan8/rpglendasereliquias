// =============================================
// TABULEIRO — Janela de Combate
// Sincroniza com Painel do Mestre > Mesas > Combate
// =============================================
import { db, doc, setDoc, updateDoc, getDoc } from '../../painel-mestre/js/firebase-config.js';
import { T, esc, toast, uid, alvoDoTeste, grausDoDado, fmtGraus, vNum, patchVitalAtualNpc } from './tab-state.js';
import { refCombate, refEstado, abrirModal, fecharModal } from './tab-main.js';
import { VITAIS } from './tab-hud.js';
import { cenasDoDoc, cenaAtiva, comCenaAtivaPatch, comCenaNova, semCena, comTrocaDeCena } from '../../shared/combate-cenas.js';

let janelaAberta = false;

// Janela flutuante de ficha de combate (NPC/personagem) — módulo carregado só
// quando alguém abre a primeira janela.
window.tbFichaWin = async function(tipo, id) {
    try { (await import('./tab-ficha-win.js?v=7')).abrirFichaWin(tipo, id); }
    catch (e) { console.error(e); toast('❌ Erro ao abrir a janela de combate', 'danger'); }
};

export function initCombat() {
    window._renderCombate = render;
    const win = document.getElementById('tbCombatWin');
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
    document.getElementById('tbCombatWin').classList.toggle('open', janelaAberta);
    render();
};

/** Participantes da cena ABERTA (é o que a janela mostra e edita). */
const partsDaCena = () => cenaAtiva(T.combate).participantes || [];

/** Condições que vieram da FICHA do participante (char ao vivo por VITAIS, NPC pelo doc). */
function condsDaFicha(p) {
    if (p.characterId) return (VITAIS.get(p.characterId)?.conds || []).map(c => c.nome).filter(Boolean);
    if (p.npcId) return (T.npcs.find(n => n.id === p.npcId)?.conditions || []).map(c => c?.nome || c).filter(Boolean);
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
window.tbCenaNova = () => {
    const nome = prompt('Nome da cena de combate:', 'Cena ' + (cenasDoDoc(T.combate).length + 1));
    if (nome === null) return;
    salvarDoc(comCenaNova(T.combate, 'c' + uid(), nome.trim() || 'Nova cena'));
};
window.tbCenaRenomear = (id) => {
    const atual = cenasDoDoc(T.combate).find(c => c.id === id);
    const nome = prompt('Nome da cena:', atual?.nome || '');
    if (nome === null) return;
    salvarDoc(comCenaAtivaPatch(T.combate, { nome: nome.trim() || 'Cena' }));
};
window.tbCenaApagar = (id) => {
    const c = cenasDoDoc(T.combate).find(x => x.id === id);
    if (!confirm(`Apagar a cena "${c?.nome || ''}" e os participantes dela?`)) return;
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
/** Ficha de onde sai o Alvo do participante (char do Tabuleiro ou NPC). */
function fonteDoParticipante(p) {
    if (p.characterId) return T.chars.find(c => c.id === p.characterId) || null;   // { derivedTotals, dots }
    if (p.npcId) {
        const n = T.npcs.find(x => x.id === p.npcId);
        return n ? { valoresDer: n.valoresDer, atributos: n.atributos, pericias: n.pericias } : null;
    }
    return null;
}
/** Alvo resolvido pela ficha, ou null (mestre digita/edita na mão). */
function alvoSugerido(t, p) {
    const r = alvoDoTeste(t.nome, fonteDoParticipante(p), t.mod || 0);
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
        topo = `<div class="tb-combat-controls">
            <button class="tb-btn tb-btn-small" onclick="tbCombTurno(-1)">⏮️</button>
            <span class="tb-combat-round">Turno ${turno + 1}/${parts.length}${c?.rodada ? ' · Rodada ' + c.rodada : ''}</span>
            <button class="tb-btn tb-btn-small" onclick="tbCombTurno(1)">⏭️</button>
            <button class="tb-btn tb-btn-small" title="${T.estado?.combateVisivelPublico ? 'Ocultar do público' : 'Exibir ao público'}" onclick="tbCombVisibilidade()">${T.estado?.combateVisivelPublico ? '👁️' : '🚫'} público</button>
        </div>`;
    } else {
        topo = `<div class="tb-combat-controls"><span class="tb-combat-round">Ordem dos turnos${c?.rodada ? ' · Rodada ' + c.rodada : ''}</span></div>`;
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
        const atual = i === turno % parts.length;
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

        const stats = secreto ? `
            ${barra('VIT', hpC, hpM, 'linear-gradient(90deg,#10b981,#34d399)')}
            ${barra('ENER', enerC, enerM, 'linear-gradient(90deg,#f59e0b,#fbbf24)')}
            ${barra('SAN', sanC, sanM, 'linear-gradient(90deg,#6366f1,#8b5cf6)')}` : '';
        // Condição tem DUAS fontes: a do combate (`p.condicoes`) e a da ficha do
        // personagem/NPC. Quem aplica pelo combate grava nas duas, mas quem aplica
        // pela ficha só tem a de lá — e essa não aparecia aqui. A janela mostra a
        // união; o ✕ só existe para as do combate, que são as que este lado tira.
        const daFicha = condsDaFicha(p).filter(n => !(p.condicoes || []).includes(n));
        const conds = (p.condicoes || []).map((cd, ci) =>
            `<span class="tb-cond">${esc(cd)}${secreto ? ` <b onclick="tbCombCondRm('${p.id}',${ci})">✕</b>` : ''}</span>`).join('')
            + daFicha.map(n => `<span class="tb-cond" title="Aplicada na ficha — remova por lá">${esc(n)}</span>`).join('');
        const abrirNpc = secreto && p.npcId ? `onclick="tbAbrirNpcModal('${p.npcId}')" style="cursor:pointer" title="Abrir ficha do NPC"` : '';
        // 🪟 Janela de combate: mestre no secreto abre de NPC e personagem;
        // no público cada jogador abre só a do PRÓPRIO personagem.
        const fichaRef = p.npcId ? ['npc', p.npcId] : p.characterId ? ['char', p.characterId] : null;
        const donoDoChar = p.characterId && T.chars.find(c => c.id === p.characterId)?.ownerUid === T.user?.uid;
        const btnJanela = fichaRef && (secreto || donoDoChar)
            ? `<button class="tb-mini-btn" title="Janela de combate (ficha ao vivo)" onclick="tbFichaWin('${fichaRef[0]}','${fichaRef[1]}')">⚔️</button>` : '';
        return `<div class="tb-combat-p ${atual ? 'atual' : ''}">
            <div class="tb-combat-init">${p.initiative ?? 0}</div>
            <div style="flex:1;min-width:0">
                <div class="tb-combat-nome" ${abrirNpc}>${esc(p.name || '?')} ${p.npcId && secreto ? '📋' : ''} <span class="tb-combat-tipo">${esc(p.type || '')}</span></div>
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
window.tbCombTurno = async function(dir) {
    const c = cenaAtiva(T.combate); const n = (c.participantes || []).length || 1;
    let turno = (c.turnoAtual || 0) + dir;
    let rodada = c.rodada || 1;
    const rodadaAntes = rodada;
    if (turno >= n) { turno = 0; rodada++; }
    if (turno < 0) { turno = n - 1; rodada = Math.max(1, rodada - 1); }
    await salvar(c.participantes || [], { turnoAtual: turno, rodada });
    // F4.3: expira templates com duração ao virar a rodada
    if (rodada > rodadaAntes) {
        try { const m = await import('./tab-templates.js'); m.expirarTemplates(rodada); } catch (e) {}
    }
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
                    patchVitalAtualNpc(npcSnap.data().valoresDer?.atual, stat, p[cur]));
            }
        } catch (e) { console.warn('sync npc stat', e); }
    }
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
    return _systemConditions;
}

function fecharCondPicker() {
    document.getElementById('tbCondPickerOverlay')?.remove();
}

/**
 * Picker de condição (registro do sistema + personalizada), desacoplado de quem
 * aplica: o combate aplica no participante, a janela de ficha aplica no doc.
 * @param aplicar (nome, tplOuNull) => Promise
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
        <input type="text" class="tb-cond-picker-search" id="tbCondSearch" placeholder="🔍 Buscar condição..." autocomplete="off">
        <div class="tb-cond-picker-list" id="tbCondList">
            ${itensHtml || '<div class="tb-muted" style="text-align:center;padding:16px">Nenhuma condição cadastrada no sistema</div>'}
        </div>
        <div class="tb-cond-picker-custom">
            <div class="tb-section-title">✏️ Condição Personalizada</div>
            <input type="text" id="tbCondCustomNome" placeholder="Nome da condição (ex: Atordoado)">
            <button class="tb-btn tb-btn-success tb-btn-small" id="tbCondCustomBtn">➕ Criar e Aplicar</button>
        </div>
    </div>`;

    document.body.appendChild(overlay);

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
            await aplicar(c.nome, c);
            fecharCondPicker();
        };
    });

    // Condição personalizada
    document.getElementById('tbCondCustomBtn').onclick = async () => {
        const nome = document.getElementById('tbCondCustomNome')?.value?.trim();
        if (!nome) { toast('⚠️ Insira o nome da condição', 'warning'); return; }
        await aplicar(nome, null);
        fecharCondPicker();
    };

    // Fechar ao clicar fora
    overlay.addEventListener('click', e => { if (e.target === overlay) fecharCondPicker(); });
}

window.tbCombCondAdd = (pid) => escolherCondicao((nome, tpl) => aplicarCondicaoCombate(pid, nome, tpl));

/**
 * Aplica uma condição ao participante do combate e sincroniza com a ficha.
 * @param {string} pid - ID do participante no combate
 * @param {string} nome - Nome da condição
 * @param {object|null} tpl - Template da condição do sistema (ou null para personalizada)
 */
async function aplicarCondicaoCombate(pid, nome, tpl) {
    const parts = partsDaCena().map(p => ({ ...p }));
    const p = parts.find(x => x.id === pid); if (!p) return;
    p.condicoes = [...(p.condicoes || []), nome.trim()];
    await salvar(parts);
    toast(`☠️ Condição "${esc(nome)}" aplicada`);

    // Sincronizar com a ficha do personagem (char doc)
    if (p.characterId) {
        try {
            const charSnap = await getDoc(doc(db, 'char', p.characterId));
            if (charSnap.exists()) {
                const charData = charSnap.data();
                const conditions = charData.conditions || [];
                conditions.push({
                    nome: nome.trim(),
                    icone: tpl?.icone || '☠️',
                    descricao: tpl?.descricao || '',
                    tempoAtual: '',
                    tempoRestante: tpl?.duracao || '',
                    modeloId: tpl?.id || null,
                    efeitoMecanicaIds: tpl?.efeitoMecanicaIds || []
                });
                await updateDoc(doc(db, 'char', p.characterId), { conditions });
            }
        } catch (e) { console.warn('sync condition to char', e); }
    }

    // Sincronizar com a ficha do NPC (npcs doc)
    if (p.npcId) {
        try {
            const npcSnap = await getDoc(doc(db, 'npcs', p.npcId));
            if (npcSnap.exists()) {
                const npcData = npcSnap.data();
                const conditions = npcData.conditions || [];
                conditions.push({
                    nome: nome.trim(),
                    icone: tpl?.icone || '☠️',
                    descricao: tpl?.descricao || '',
                    tempoAtual: '',
                    tempoRestante: tpl?.duracao || '',
                    modeloId: tpl?.id || null,
                    efeitoMecanicaIds: tpl?.efeitoMecanicaIds || []
                });
                await updateDoc(doc(db, 'npcs', p.npcId), { conditions });
            }
        } catch (e) { console.warn('sync condition to npc', e); }
    }
}

window.tbCombCondRm = async function(pid, i) {
    const parts = partsDaCena().map(p => ({ ...p }));
    const p = parts.find(x => x.id === pid); if (!p) return;
    const removida = (p.condicoes || [])[i];
    p.condicoes = (p.condicoes || []).filter((_, ci) => ci !== i);
    await salvar(parts);

    // Sincronizar remoção na ficha do personagem
    if (p.characterId && removida) {
        try {
            const charSnap = await getDoc(doc(db, 'char', p.characterId));
            if (charSnap.exists()) {
                const charData = charSnap.data();
                let conditions = charData.conditions || [];
                const idx = conditions.findIndex(c => c.nome === removida);
                if (idx >= 0) {
                    conditions.splice(idx, 1);
                    await updateDoc(doc(db, 'char', p.characterId), { conditions });
                }
            }
        } catch (e) { console.warn('sync condition removal to char', e); }
    }

    // Sincronizar remoção na ficha do NPC
    if (p.npcId && removida) {
        try {
            const npcSnap = await getDoc(doc(db, 'npcs', p.npcId));
            if (npcSnap.exists()) {
                const npcData = npcSnap.data();
                let conditions = npcData.conditions || [];
                const idx = conditions.findIndex(c => c.nome === removida);
                if (idx >= 0) {
                    conditions.splice(idx, 1);
                    await updateDoc(doc(db, 'npcs', p.npcId), { conditions });
                }
            }
        } catch (e) { console.warn('sync condition removal to npc', e); }
    }
};

window.tbCombRemover = async function(pid) {
    if (!confirm('Remover do combate?')) return;
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
    if (!confirm(`Apagar o teste "${t?.nome || ''}" e os resultados dele?`)) return;
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
        const s = prompt(`Alvo de ${p.name} em "${t.nome}":`);
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
};

/** Teste feito fisicamente na mesa: o mestre digita os Graus direto. */
window.tbTesteInserir = async function(tid, pid) {
    const testes = testesDaCena();
    const t = testes.find(x => x.id === tid); if (!t) return;
    const p = partsDaCena().find(x => x.id === pid); if (!p) return;
    const s = prompt(`Graus de ${p.name} em "${t.nome}" (+2, 0, -1...):`);
    if (s === null) return;
    const graus = parseInt(String(s).replace('+', ''), 10);
    if (isNaN(graus)) { toast('⚠️ Valor inválido — digite um número de Graus', 'warning'); return; }
    t.resultados[pid] = { graus, dado: null, alvo: null };
    await salvar(partsDaCena(), { testes });
};
