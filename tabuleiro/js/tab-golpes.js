// =============================================
// TABULEIRO — 🗡️ "Com o que você bate?"
//
// Toda ação ofensiva sai de ALGUMA COISA: uma arma empunhada, um foco mágico
// ou uma parte do corpo. É de lá que vêm o Acerto (o Alvo da rolagem), o dado
// de dano, o tipo de golpe (que Blindagem barra) e o alcance.
//
// Este módulo é a porta única para isso: lista as opções da ficha, deixa quem
// age escolher quando há mais de uma, e devolve a linha escolhida pronta para
// virar `meta.golpe` da mira e, depois, o cabeçalho da janela de conflito.
//
// As linhas vêm de `linhasDeAtaque` (tab-ficha-win) — a MESMA conta da ficha,
// com uma query de itens por personagem, cacheada por vez.
// =============================================
import { T, esc, valorComponente } from './tab-state.js';
import { alcanceGolpe } from '../../shared/combate-cenas.js';
import { abrirModal, fecharModal } from './tab-main.js';
import { fonteDoParticipante } from './tab-hud.js';

const cache = new Map();   // 'char:id' | 'npc:id' -> linhas

export const chaveDoParticipante = (p) =>
    p?.npcId ? 'npc:' + p.npcId : p?.characterId ? 'char:' + p.characterId : null;

/** Golpes disponíveis do participante (arma, foco e partes do corpo). */
export async function golpesDe(p) {
    const chave = chaveDoParticipante(p);
    if (!chave) return [];
    if (cache.has(chave)) return cache.get(chave);
    try {
        const m = await import('./tab-ficha-win.js?v=9');
        const linhas = await m.linhasDeAtaque(p.npcId ? 'npc' : 'char', p.npcId || p.characterId);
        cache.set(chave, linhas);
        return linhas;
    } catch (e) { console.warn('golpes do participante', e); return []; }
}

/** O inventário mudou (equipou/soltou): a próxima consulta recarrega. */
export function limparCacheGolpes() { cache.clear(); }

/** Versão SÍNCRONA para quem pinta tela: `null` = ainda não carregou. */
export function golpesCacheados(p) {
    const chave = chaveDoParticipante(p);
    return chave && cache.has(chave) ? cache.get(chave) : null;
}

/** Alcance real do golpe em metros: arma + 5% do Tamanho, mínimo 1 (§6.x). */
export function alcanceDoGolpe(l, p) {
    if (l?.distancia) return null;   // arma a distância não tem alcance de braço
    const tamanho = valorComponente('Tamanho', fonteDoParticipante(p)) || 0;
    return alcanceGolpe(l?.alcanceM, tamanho);
}

/** Só o que serve para bater de perto — o contra-ataque é corpo a corpo (§6.8). */
export const golpesCorpoACorpo = (linhas) => (linhas || []).filter(l => !l.distancia);

/** `meta.golpe` da mira: o que a janela de conflito precisa saber do golpe. */
export function metaDoGolpe(l) {
    if (!l) return null;
    return {
        nome: l.nome || '',
        dano: l.dano || '',
        acerto: l.acerto ?? null,
        tipos: (l.tiposGolpe || []).map(t => t.nome),
        distancia: !!l.distancia,
        desarmado: !!l.desarmado,
    };
}

/** Uma linha do picker: nome + Acerto + dano + tipos. */
function rotulo(l) {
    const tipos = (l.tiposGolpe || []).map(t => `${t.icone} ${t.nome}`).join(' ');
    return `${l.desarmado ? (l.icone || '👊') : l.distancia ? '🏹' : '⚔️'} <b>${esc(l.nome || 'Golpe')}</b>`
        + (l.acerto != null ? ` <span class="tb-muted">🎯 Acerto ${l.acerto}</span>` : ' <span class="tb-muted">🎯 sem Acerto na ficha</span>')
        + (l.dano ? ` <span class="tb-muted">💥 ${esc(l.dano)}</span>` : '')
        + (tipos ? ` <span class="tb-muted">${esc(tipos)}</span>` : '')
        + (l.estadoEquip ? ` <i class="tb-muted">${esc(l.estadoEquip)}</i>` : '');
}

/**
 * Pergunta com o que a ação vai ser feita. Uma opção só decide sozinha (não
 * existe escolha a fazer); nenhuma devolve null e a ação segue sem Acerto —
 * o mestre digita o Alvo na janela de conflito.
 * @returns Promise<linha|null>
 */
export function escolherGolpe(titulo, linhas, dica) {
    const lista = linhas || [];
    if (!lista.length) return Promise.resolve(null);
    if (lista.length === 1) return Promise.resolve(lista[0]);
    return new Promise(resolve => {
        window.__tbGolpeEscolhido = (i) => {
            delete window.__tbGolpeEscolhido;
            fecharModal();
            resolve(i < 0 ? null : lista[i]);
        };
        abrirModal(titulo, `
            ${dica ? `<div class="tb-muted" style="font-size:.8rem;margin-bottom:10px">${esc(dica)}</div>` : ''}
            ${lista.map((l, i) => `<button class="tb-btn tb-btn-small" style="display:block;width:100%;margin-bottom:6px;text-align:left"
                onclick="__tbGolpeEscolhido(${i})">${rotulo(l)}</button>`).join('')}
            <div class="tb-modal-actions"><button class="tb-btn" onclick="__tbGolpeEscolhido(-1)">✖ Cancelar</button></div>
        `);
    });
}
