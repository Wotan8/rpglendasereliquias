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
import { alcanceGolpe, condDoParticipante } from '../../shared/combate-cenas.js';
import { avaliarFormas } from '../../shared/conjuracao.js';
import { abrirModal, fecharModal } from './tab-main.js';
import { fonteDoParticipante } from './tab-hud.js';
import { db, getDocs, collection } from '../../painel-mestre/js/firebase-config.js';
import { projeteisCompativeis, municaoDaArma } from '../../shared/projeteis.js';

const cache = new Map();   // 'char:id' | 'npc:id' -> linhas

export const chaveDoParticipante = (p) =>
    p?.npcId ? 'npc:' + p.npcId : p?.characterId ? 'char:' + p.characterId : null;

/** Golpes disponíveis do participante (arma, foco e partes do corpo). */
export async function golpesDe(p) {
    const chave = chaveDoParticipante(p);
    if (!chave) return [];
    if (cache.has(chave)) return cache.get(chave);
    try {
        const m = await import('./tab-ficha-win.js?v=10');
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

// =============================================
// 🪄 FORMAS DE CONJURAÇÃO
// Magia não sai de arma nem de perna: sai de uma VOZ, de um foco, de um
// instrumento. Quem diz isso é o módulo da classe — cada coluna marcada com
// "🪄 forma de conjurar" no Criador aponta o Valor Derivado que dá o Acerto.
// (No Bardo são 4: Vocal, Corda, Percussão, Sopro. O "[V, S]" do nome da magia
// é só a legenda humana de quais colunas estão preenchidas.)
//
// O cadastro `castingForms` enriquece isso: diz o que a forma EXIGE (um item
// com certa tag, uma parte do corpo inteira) e que CONDIÇÕES a impedem — é o
// que faz o "não pode falar" do Afogando virar regra executável em vez de
// texto na descrição.
//
// Sem Forma cadastrada a coluna ainda funciona: vale o nome e o Acerto do VD,
// e nada bloqueia. O cadastro só acrescenta.
// =============================================
let _formas = null;

export async function carregarFormasConjuracao() {
    if (_formas) return _formas;
    try {
        const snap = await getDocs(collection(db, 'system/data/castingForms'));
        _formas = [];
        snap.forEach(d => { const x = d.data(); if (x.publicado !== false) _formas.push({ id: d.id, ...x }); });
    } catch (e) {
        console.warn('⚠️ Formas de Conjuração indisponíveis — as colunas valem sem requisito.', e);
        _formas = [];
    }
    return _formas;
}

/**
 * As opções de conjuração de uma skill, prontas para o mesmo picker dos golpes.
 * Aqui só se faz o I/O — quem decide o que está bloqueado é `avaliarFormas`
 * (shared/conjuracao.js), que é puro e tem teste.
 *
 * @param p        participante da cena
 * @param veiculos [{ vdId, label, vdNome }] — colunas marcadas do item da skill
 * @param linhas   golpes do participante (trazem itens equipados, tags e partes)
 */
export async function formasDeConjurar(p, veiculos, linhas) {
    if (!veiculos?.length) return [];
    const formas = await carregarFormasConjuracao();
    const fonte = fonteDoParticipante(p);
    const equip = linhas || [];

    const avaliadas = avaliarFormas(veiculos, formas, {
        acertoDoVd: nome => valorComponente(nome, fonte),
        condicoes: (p?.condicoes || []).map(c => condDoParticipante(c).nome),
        condicaoPorId: id => (T.condicoesSistema || []).find(c => c.id === id)?.nome || null,
        // Item empunhado vira linha de ataque; a linha carrega as tags do item
        // e do modelo (ver tab-ficha-win) — é assim que a Rabeca é reconhecida.
        itensEquipados: equip.filter(l => !l.desarmado).map(l => ({ nome: l.nome, tags: l.tags || [] })),
        // Golpe desarmado = parte do corpo que existe e funciona.
        partesInteiras: equip.filter(l => l.desarmado).map(l => l.nome),
    });

    return avaliadas.map(f => ({
        ...f,
        dano: '', tiposGolpe: [], distancia: false, desarmado: false,
        veiculo: true,
        estadoEquip: f.comItem ? `com ${f.comItem}` : '',
    }));
}

/** Uma linha do picker: nome + Acerto + dano + tipos. */
function rotulo(l) {
    if (l.veiculo) {
        return `${l.icone || '🪄'} <b>${esc(l.nome)}</b>`
            + (l.acerto != null ? ` <span class="tb-muted">🎯 Acerto ${l.acerto}</span>` : ' <span class="tb-muted">🎯 sem Acerto na ficha</span>')
            + (l.estadoEquip ? ` <i class="tb-muted">${esc(l.estadoEquip)}</i>` : '')
            + (l.indisponivel ? ` <span class="tb-golpe-bloq">🚫 ${esc(l.indisponivel)}</span>` : '');
    }
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
    // Uma opção só decide sozinha — mas só se ela puder ser usada. Escolher
    // automaticamente uma forma bloqueada seria conjurar com a boca afogada.
    if (lista.length === 1 && !lista[0].indisponivel) return Promise.resolve(lista[0]);
    return new Promise(resolve => {
        window.__tbGolpeEscolhido = (i) => {
            delete window.__tbGolpeEscolhido;
            fecharModal();
            resolve(i < 0 ? null : lista[i]);
        };
        abrirModal(titulo, `
            ${dica ? `<div class="tb-muted" style="font-size:.8rem;margin-bottom:10px">${esc(dica)}</div>` : ''}
            ${lista.map((l, i) => `<button class="tb-btn tb-btn-small" style="display:block;width:100%;margin-bottom:6px;text-align:left"
                ${l.indisponivel ? 'disabled' : ''} onclick="__tbGolpeEscolhido(${i})">${rotulo(l)}</button>`).join('')}
            <div class="tb-modal-actions"><button class="tb-btn" onclick="__tbGolpeEscolhido(-1)">✖ Cancelar</button></div>
        `);
    });
}


// =============================================
// 🏹 PROJÉTEIS — escolher a munição antes do tiro
//
// A arma diz o que come (`tipoProjetil`), o projétil carrega a tag, e a munição
// conta esteja onde estiver na mochila — inclusive dentro da aljava. Quem
// decide o que casa é shared/projeteis.js; aqui é só I/O e tela.
// =============================================

/** O catálogo de equipamento do sistema (para instância→modelo do projétil). */
async function catalogoDeItens() {
    try {
        const m = await import('./tab-ficha-win.js?v=10');
        return (await m.registroSistema())?.equipment || [];
    } catch (e) { console.warn('catálogo de itens', e); return []; }
}

/** Os maços que servem para esta arma, com o inventário já carregado. */
export async function projeteisPara(p, linha) {
    if (!linha || !municaoDaArma(linha, []).length) {
        // A linha já traz `tipoProjetil` resolvido (instância > modelo), então
        // não precisa do catálogo para saber SE gasta munição.
        if (!(linha?.tipoProjetil || []).length) return [];
    }
    const m = await import('./tab-ficha-win.js?v=10');
    const itens = m.itensCarregados(p?.npcId ? 'npc' : 'char', p?.npcId || p?.characterId);
    const catalog = await catalogoDeItens();
    return projeteisCompativeis(itens, catalog, linha);
}

/**
 * Pergunta qual munição usar. Uma opção decide sozinha; nenhuma devolve
 * `false`, e quem chama aborta o tiro — atirar sem flecha não é opção.
 * @returns Promise<maço|null|false>
 */
export function escolherProjetil(titulo, macos) {
    const lista = macos || [];
    if (!lista.length) return Promise.resolve(false);
    if (lista.length === 1) return Promise.resolve(lista[0]);
    return new Promise(resolve => {
        window.__tbProjEscolhido = (i) => {
            delete window.__tbProjEscolhido;
            fecharModal();
            resolve(i < 0 ? null : lista[i]);
        };
        abrirModal(titulo, `
            <div class="tb-muted" style="font-size:.8rem;margin-bottom:10px">O maço escolhido perde 1 no disparo.</div>
            ${lista.map((m, i) => `<button class="tb-btn tb-btn-small" style="display:block;width:100%;margin-bottom:6px;text-align:left"
                onclick="__tbProjEscolhido(${i})">🏹 <b>${esc(m.nome)}</b>
                <span class="tb-muted">×${m.quantidade}</span>
                ${m.dentroDe ? '<span class="tb-muted">· na bolsa</span>' : ''}
                <span class="tb-muted">· ${m.chanceRecuperar}% de sobrar</span></button>`).join('')}
            <div class="tb-modal-actions"><button class="tb-btn" onclick="__tbProjEscolhido(-1)">✖ Cancelar</button></div>
        `);
    });
}
