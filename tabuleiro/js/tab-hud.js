// =============================================
// TABULEIRO — HUD de Tokens (FASE 5)
// - Vitais ao vivo (chars: listener no doc; NPCs/custom: participante do combate)
// - Condições (char.conditions + condicoes do combate)
// - Menu radial de token
// - Rolar iniciativa direto do mapa (1d10 + VD Iniciativa)
// =============================================
import { db, doc, onSnapshot, setDoc } from '../../painel-mestre/js/firebase-config.js';
import { T, esc, toast, markDirty, uid, can, selecionar, bonusIniciativa, DADO_INICIATIVA } from './tab-state.js';
import { refCombate } from './tab-main.js';
import { updObj, delObj, abrirPropriedades } from './tab-objects.js';
import { SENSORES } from './tab-fog.js';
import { cenaAtiva, comCenaAtivaPatch } from '../../shared/combate-cenas.js';

// charId -> { hp, hpMax, ener, enerMax, san, sanMax, conds:[{icone,nome}] }
export const VITAIS = new Map();
const unsubsVitais = [];

export function initHud() {
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
            });
            // VDs ao vivo: subir a Percepção na ficha muda o alcance de visão do
            // token na hora, sem precisar reabrir o Tabuleiro.
            const ch = T.chars.find(x => x.id === c.id);
            if (ch) ch.derivedTotals = d.derivedTotals || ch.derivedTotals || {};
            markDirty();
            // A janela de Combate lê os vitais do personagem DAQUI (VITAIS), então
            // sem este repinte ela ficava com o número velho quando o dano vinha do
            // Painel do Mestre ou da própria ficha. É barato: sai na hora se a
            // janela estiver fechada.
            window._renderCombate?.();
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
        // condições extras vindas do combate
        const p = participanteDoToken(o);
        const conds = [...v.conds, ...((p?.condicoes || []).map(n => ({ icone: '☠️', nome: n })))];
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
        conds: (p.condicoes || []).map(n => ({ icone: '☠️', nome: n })),
    };
}

export function participanteDoToken(o) {
    const parts = cenaAtiva(T.combate).participantes || [];
    if (o.vinculo?.tipo === 'char') return parts.find(p => p.characterId === o.vinculo.id) || null;
    if (o.vinculo?.tipo === 'npc') return parts.find(p => p.npcId === o.vinculo.id) || null;
    return parts.find(p => p.isCustom && p.name === o.nome) || null;
}

/** Barras visíveis para o usuário atual? (config por token: todos|dono|mestre|off) */
export function barrasVisiveis(o) {
    const modo = o.barras || 'todos';
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
    if (!c || !(c.participantes || []).length) return null;
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
        acoes.push({ ic: '📋', tip: 'Abrir ficha do NPC', fn: () => window.tbAbrirNpcModal?.(o.vinculo.id, !secreto) });
    }
    // 🔒 Token bloqueado: nenhuma ação de manipulação; Mestre vê apenas o desbloqueio
    if (o.bloqueado) {
        if (secreto) acoes.push({ ic: '🔒', tip: 'Desbloquear objeto', fn: () => window.tbDesbloquearObj?.(o.id) });
    } else if (secreto) {
        acoes.push({ ic: '🎲', tip: `Rolar iniciativa (1d${DADO_INICIATIVA} + Iniciativa)`, fn: () => rolarIniciativa(o) });
        acoes.push({ ic: o.visao?.ativa ? '👁️' : '🙈', tip: 'Alternar visão', fn: () => updObj(o.id, { visao: { ...(o.visao||{}), ativa: !o.visao?.ativa } }) });
        acoes.push({ ic: o.luz?.ativa ? '🔦' : '💡', tip: 'Alternar luz', fn: () => updObj(o.id, { luz: { ...(o.luz||{ alcance: 3 }), ativa: !o.luz?.ativa } }) });
        acoes.push({ ic: o.invisivel ? '✨' : '👻', tip: o.invisivel ? 'Tornar visível' : 'Tornar invisível', fn: () => updObj(o.id, { invisivel: !o.invisivel }) });
        acoes.push({ ic: '☠️', tip: 'Adicionar condição', fn: () => adicionarCondicao(o) });
        acoes.push({ ic: '📐', tip: 'Tamanho...', fn: () => {
            const t = prompt('Tamanho em células (0.5, 1, 2, 3...):', o.tamanhoCelulas || 1);
            if (t) updObj(o.id, { tamanhoCelulas: parseFloat(t) || 1 });
        }});
        acoes.push({ ic: '🪜', tip: 'Elevação...', fn: () => {
            const e = prompt('Elevação (na unidade do canvas):', o.elev || 0);
            if (e !== null) updObj(o.id, { elev: parseFloat(e) || 0 });
        }});
        acoes.push({ ic: '⚙️', tip: 'Propriedades', fn: () => { selecionar(o.id); abrirPropriedades(o.id); markDirty(); } });
        acoes.push({ ic: '🗑️', tip: 'Remover token', fn: () => delObj(o.id), danger: true });
    }
    if (!acoes.length) return;

    const R = 74;
    el.innerHTML = `<div class="tb-radial-centro">${esc((o.nome||'?')[0].toUpperCase())}</div>` +
        acoes.map((a, i) => {
            const ang = -Math.PI / 2 + (i / acoes.length) * Math.PI * 2;
            const x = Math.cos(ang) * R, y = Math.sin(ang) * R;
            return `<button class="tb-radial-item ${a.danger ? 'tb-radial-danger' : ''}" data-i="${i}" title="${esc(a.tip)}"
                style="transform:translate(${x.toFixed(0)}px,${y.toFixed(0)}px)">${a.ic}</button>`;
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

async function adicionarCondicao(o) {
    const p = participanteDoToken(o);
    if (!p) { toast('⚠️ Token sem participante no combate — role a iniciativa primeiro', 'warning'); return; }
    // Delega ao picker de condições do módulo de combate (tab-combat.js)
    if (window.tbCombCondAdd) {
        window.tbCombCondAdd(p.id);
    } else {
        // Fallback caso o módulo de combate não esteja carregado
        const nome = prompt('Condição (ex: Envenenado, Caído):');
        if (!nome) return;
        const parts = (cenaAtiva(T.combate).participantes || []).map(pp => ({ ...pp }));
        const pp = parts.find(x => x.id === p.id); if (!pp) return;
        pp.condicoes = [...(pp.condicoes || []), nome.trim()];
        try { await setDoc(refCombate(), { ...comCenaAtivaPatch(T.combate, { participantes: parts }), atualizadoEm: Date.now() }, { merge: true }); }
        catch (e) { toast('❌ Erro', 'danger'); }
    }
}
