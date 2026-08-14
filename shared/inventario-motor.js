// =============================================================
// MOTOR DE INVENTÁRIO — lista, expandir, contêiner, pilha e arrasto
//
// Um só motor para as duas listas de inventário que arrastam item:
//   · Ficha de Combate do Tabuleiro  (tabuleiro/js/tab-ficha-win.js)
//   · Inventário da Ficha de NPC     (painel-mestre/js/npc-inventario.js)
//
// O motor NÃO escreve no banco: ele desenha, detecta o alvo do arrasto e
// chama de volta quem o instanciou. Cada host decide o que é "equipar"
// (o Tabuleiro grava direto; o Painel grava e ainda registra log).
//
// Contexto esperado (`ctx`):
//   raiz        HTMLElement que delimita a instância (nada fora dele é alvo)
//   itens       array de itens do dono (inclui os que estão dentro de contêiner)
//   abertos     Set de ids com o detalhe expandido
//   contAbertos Set de ids de contêiner abertos
//   sys         registro do sistema (window._npcSys) — opcional, enriquece o detalhe
//   idCanvas    id do <canvas> do mapa; só o Tabuleiro passa (habilita dropar no mapa)
//   dica        texto curto sob a pressão
//   semQtd      true esconde os botões ± de quantidade (leitura da pilha só)
//   botoes      (item) => HTML de ações extras na linha  — opcional
//   repintar    () => void
//   acoes       { equipar, desequipar, mover, fundir, mapa, qtd }
// =============================================================

export const EMOJI_TIPO = {
    'Arma': '⚔️', 'Vestimenta': '🧥', 'Acessório': '💍', 'Projétil': '🎯',
    'Container': '📦', 'Objeto': '📦', 'Consumível': '🧪', 'Relíquia': '✨',
};
export const ESTADO_EQUIP = { empunhado: 'Empunhado', segurar: 'Segurado', vestido: 'Vestido', fixado: 'Fixado' };
export const FORMA_EQUIP = { empunhado: ['✊', 'empunhar'], segurar: ['🖐️', 'segurar'], vestido: ['👕', 'vestir'], fixado: ['📌', 'fixar'] };
export const CAT_ARMA = { uma_mao: '🗡️ Uma mão', duas_maos: '⚔️ Duas mãos', versatil: '🔄 Versátil', escudo: '🛡️ Escudo', distancia: '🏹 A distância' };

export const qtdDe = (i) => Math.max(1, parseInt(i?.quantidade) || 1);
export const ehContainer = (i) => !!(i && (i.ehContainer || i.tipo === 'Container'));

export function esc(t) {
    if (t == null) return '';
    return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function fmtN(v) {
    const n = Number(v);
    return isNaN(n) ? String(v ?? '') : (Number.isInteger(n) ? n : parseFloat(n.toFixed(2)));
}

/** Duas pilhas são do MESMO item? (nome + tipo + modelo do catálogo; contêiner nunca) */
export function itensIdenticos(a, b) {
    if (!a || !b || a.id === b.id || ehContainer(a) || ehContainer(b)) return false;
    const nome = (s) => String(s || '').trim().toLowerCase();
    return nome(a.nome) === nome(b.nome) && (a.tipo || '') === (b.tipo || '')
        && (a.modeloId || a.origemTemplateId || '') === (b.modeloId || b.origemTemplateId || '');
}

/**
 * Como dividir uma pilha ao mover `qtd` de `item`.
 * `move: true` = a pilha inteira vai junto (só troca de dono/pai);
 * `move: false` = o original fica com `restante` e um clone leva `qtd`.
 */
export function dividirPilha(item, qtd) {
    const total = Math.max(1, parseInt(item?.quantidade) || 1);
    const q = Math.max(1, Math.min(parseInt(qtd) || 1, total));
    if (q >= total) return { move: true, qtd: total };
    return { move: false, qtd: q, restante: total - q };
}

/** Quantos mover/dropar. null = cancelou. Pilha de 1 nem pergunta. */
export function escolherQtd(i, msg) {
    const total = qtdDe(i);
    if (total === 1) return 1;
    const s = prompt(`${msg} (1–${total})`, total);
    if (s === null) return null;
    return parseInt(s) || total;
}

/** Modelo do catálogo do item (o dano costuma morar LÁ, não na instância). */
export function tplDoItem(i, sys) {
    const ref = i?.modeloId || i?.origemTemplateId;
    return ref ? (sys?.equipment || []).find(t => t.id === ref) || null : null;
}
/** Dado do modo atual: com 2 mãos, `formulaDano2Maos` vence (equip-slots.js). */
export function formulaDanoDoItem(i, sys) {
    const tpl = tplDoItem(i, sys);
    const ES = globalThis.EquipSlots;
    return ES ? ES.formulaDanoPorMaos(i, tpl) : (i?.formulaDano || tpl?.formulaDano || '');
}

/** Pressão de um item: contêiner soma o conteúdo pelo multiplicador; pilha multiplica. */
export function pressaoItem(i, itens) {
    const base = i.pressaoOverride != null ? i.pressaoOverride : (i.pressaoBase != null ? i.pressaoBase : (i.peso || 0));
    if (ehContainer(i)) {
        const dentro = (itens || []).filter(x => x.parentItemId === i.id);
        const w = dentro.reduce((s, x) => s + ((x.peso || 0) * qtdDe(x)), 0);
        return base + w * (i.multiplicadorPressao || 1);
    }
    return base * qtdDe(i);
}

// ===== RENDER =====

/** Detalhe expandido: TODAS as informações do item (instância + modelo do catálogo). */
function detalheItem(ctx, i) {
    const sys = ctx.sys;
    const l = [];
    const tpl = tplDoItem(i, sys);
    l.push(`<b>Tipo:</b> ${esc(i.tipo || 'Objeto')}${i.categoriaArma ? ' · ' + (CAT_ARMA[i.categoriaArma] || esc(i.categoriaArma)) : ''}`);
    l.push(`<b>Peso:</b> ${fmtN(i.peso || 0)} · <b>Tamanho:</b> ${fmtN(i.tamanho ?? 1)} · <b>Qtd:</b> ${qtdDe(i)} · <b>Pressão:</b> ${fmtN(pressaoItem(i, ctx.itens))}`);
    const f = formulaDanoDoItem(i, sys);
    if (f) l.push(`<b>💥 Dano:</b> ${esc(f)}${!i.formulaDano && tpl ? ' <i>(do modelo)</i>' : ''}`);
    l.push(i.equipado
        ? `<b>🎽 Equipado:</b> ${esc(ESTADO_EQUIP[i.estadoEquip] || 'sim')}${i.slotAnatomico ? ' · ' + esc(ctx.rotuloSlot?.(i.slotAnatomico) || i.slotAnatomico) : ''}`
        : '🎽 Não equipado');
    if (i.formaEquipar) l.push(`<b>Forma de equipar:</b> ${esc(i.formaEquipar)}`);
    if (ehContainer(i)) {
        const nDentro = (ctx.itens || []).filter(x => x.parentItemId === i.id).length;
        l.push(`<b>📦 Contêiner:</b> peso máx ${fmtN(i.pesoMaximoContainer || 0)} · pressão ×${fmtN(i.multiplicadorPressao ?? 1)} · ${nDentro} item(ns) dentro`);
    }
    // Vínculos com VDs e Status Vitais — instância vence o modelo, como na ficha
    const dvs = (Array.isArray(i.valoresDerivadosVinculados) && i.valoresDerivadosVinculados.length)
        ? i.valoresDerivadosVinculados : (tpl?.valoresDerivadosVinculados || []);
    for (const v of dvs) {
        const def = (sys?.derivedValues || []).find(d => d.id === (v.id || v));
        const eq = Array.isArray(v.equacao) && v.equacao.length;
        l.push(`<b>📊 ${esc(def?.nome || 'Valor Derivado')}:</b> ${eq ? 'por equação (ver ficha)' : (Number(v.modificador) > 0 ? '+' : '') + fmtN(v.modificador || 0)}`);
    }
    const svs = (Array.isArray(i.statusVitaisVinculados) && i.statusVitaisVinculados.length)
        ? i.statusVitaisVinculados : (tpl?.statusVitaisVinculados || []);
    for (const s of svs) {
        const def = (sys?.vitalStats || []).find(v => v.id === (s.id || s));
        const mod = Number(s.modificador) || 0;
        l.push(`<b>❤️ ${esc(def?.nome || 'Status Vital')}:</b> ${mod > 0 ? '+' : ''}${fmtN(mod)}`);
    }
    if (i.descricao || tpl?.descricao) l.push(esc(i.descricao || tpl.descricao));
    if (tpl) l.push(`<i>Modelo do catálogo: ${esc(tpl.nome || '')}</i>`);
    return `<div class="lr-inv-item-det">${l.join('<br>')}</div>`;
}

function itemRow(ctx, i, dentro) {
    const cont = ehContainer(i);
    const img = i.imagem || i.imagemUrl;
    // `semQtd`: host que não deixa mexer na quantidade (jogador no Tabuleiro —
    // quem cria e destrói item é o mestre). Some com os ±, o número fica.
    const podeQtd = !ctx.semQtd && !(i.tipo === 'Arma' || cont);
    const extra = [];
    if (i.equipado) {
        extra.push(ESTADO_EQUIP[i.estadoEquip] || 'Equipado');
        if (i.slotAnatomico) extra.push(ctx.rotuloSlot?.(i.slotAnatomico) || i.slotAnatomico);
    }
    return `<div class="lr-inv-item ${i.equipado ? 'eq' : ''} ${dentro ? 'dentro' : ''}" data-toggleitem="${esc(i.id)}">
        <span class="lr-inv-grab" data-grab="${esc(i.id)}" title="Arraste: equipar, contêiner, pilha igual${ctx.idCanvas ? ' ou mapa' : ''}">⠿</span>
        ${cont ? `<button type="button" class="lr-inv-chev" data-conttoggle="${esc(i.id)}" title="Abrir/fechar contêiner">${ctx.contAbertos.has(i.id) ? '▾' : '▸'}</button>` : ''}
        ${img ? `<img class="lr-inv-item-img" src="${esc(img)}" alt="">` : `<span class="lr-inv-item-ic">${EMOJI_TIPO[i.tipo] || '📦'}</span>`}
        <div class="lr-inv-item-info">
            <span class="lr-inv-item-nome">${esc(i.nome || 'Sem nome')}</span>
            <span class="lr-inv-item-meta">${esc(i.tipo || '')} · ⚖️ ${fmtN(i.peso || 0)}${extra.length ? ' · ' + esc(extra.join(' · ')) : ''}</span>
        </div>
        <span class="lr-inv-qty">${podeQtd ? `<button type="button" data-qdelta="-1" data-item="${esc(i.id)}">−</button>` : ''}<b>×${qtdDe(i)}</b>${podeQtd ? `<button type="button" data-qdelta="1" data-item="${esc(i.id)}">+</button>` : ''}</span>
        ${ctx.botoes ? `<span class="lr-inv-acoes" data-acoes>${ctx.botoes(i)}</span>` : ''}
    </div>
    ${ctx.abertos.has(i.id) ? detalheItem(ctx, i) : ''}`;
}

/** Item de topo + conteúdo do contêiner (quando aberto), indentado. */
function grupoItem(ctx, i) {
    let html = itemRow(ctx, i, false);
    if (ehContainer(i) && ctx.contAbertos.has(i.id)) {
        const filhos = (ctx.itens || []).filter(x => x.parentItemId === i.id);
        html += filhos.map(f => itemRow(ctx, f, true)).join('')
            || '<div class="lr-inv-cont-vazio">vazio — arraste um item para cá</div>';
    }
    return html;
}

/** HTML completo da lista: pressão + Equipados + Soltos (contêineres aninhados). */
export function htmlInventario(ctx) {
    const itens = ctx.itens || [];
    const top = itens.filter(i => !i.parentItemId);
    const eq = top.filter(i => i.equipado);
    const soltos = top.filter(i => !i.equipado);
    const pressao = eq.reduce((s, i) => s + pressaoItem(i, itens), 0);

    const secao = (t, lista) => `<div class="lr-inv-sec">${t} <span class="lr-inv-count">${lista.length}</span></div>`
        + (lista.length ? lista.map(i => grupoItem(ctx, i)).join('') : '<div class="lr-inv-vazio">Nada aqui.</div>');

    return `<div class="lr-inv" data-drop="root">
        <div class="lr-inv-pressao">⚖️ Pressão (equipados): <b>${fmtN(pressao)}</b>
            ${ctx.dica ? `<span class="lr-inv-dica">${esc(ctx.dica)}</span>` : ''}</div>
        <div data-sec="eq">${secao('🎽 Equipados', eq)}</div>
        <div data-sec="soltos">${secao('📋 Soltos', soltos)}</div>
    </div>`;
}

// ===== INTERAÇÃO =====

/**
 * Cliques da lista: quantidade, abrir/fechar contêiner, expandir detalhe.
 * Devolve true quando tratou o evento (o host para por aí).
 */
export function tratarClique(ctx, e) {
    if (e.target.closest('[data-grab]')) return true;    // alça de arrasto não expande o item
    if (e.target.closest('[data-acoes]')) return false;  // botões próprios do host

    const q = e.target.closest('[data-qdelta]');
    if (q) { ctx.acoes.qtd?.(q.dataset.item, Number(q.dataset.qdelta)); return true; }

    const chev = e.target.closest('[data-conttoggle]');
    if (chev) {
        const cid = chev.dataset.conttoggle;
        ctx.contAbertos.has(cid) ? ctx.contAbertos.delete(cid) : ctx.contAbertos.add(cid);
        ctx.repintar();
        return true;
    }
    const row = e.target.closest('[data-toggleitem]');
    if (row && ctx.raiz.contains(row)) {
        const iid = row.dataset.toggleitem;
        ctx.abertos.has(iid) ? ctx.abertos.delete(iid) : ctx.abertos.add(iid);
        ctx.repintar();
        return true;
    }
    return false;
}

/** O que está sob o dedo/mouse durante o arrasto (o fantasma é pointer-events:none). */
export function alvoSob(ctx, item, x, y) {
    const sob = document.elementFromPoint(x, y);
    if (!sob) return null;
    if (ctx.idCanvas && sob.id === ctx.idCanvas) return { tipo: 'mapa' };
    const row = sob.closest?.('[data-toggleitem]');
    if (row && ctx.raiz.contains(row) && row.dataset.toggleitem !== item.id) {
        const outro = (ctx.itens || []).find(z => z.id === row.dataset.toggleitem);
        if (itensIdenticos(item, outro)) return { tipo: 'merge', id: outro.id, el: row };
        if (outro && ehContainer(outro) && !ehContainer(item) && item.parentItemId !== outro.id) {
            return { tipo: 'drop', drop: 'cont:' + outro.id, el: row };
        }
        // linha sem ação própria: vale a SEÇÃO onde ela está (equipar/desequipar)
    }
    const sec = sob.closest?.('[data-sec]');
    if (sec && ctx.raiz.contains(sec)) {
        if (sec.dataset.sec === 'eq' && !item.equipado) return { tipo: 'equipar', el: sec };
        if (sec.dataset.sec === 'soltos' && item.equipado) return { tipo: 'desequipar', el: sec };
        if (sec.dataset.sec === 'soltos' && item.parentItemId) return { tipo: 'drop', drop: 'root', el: sec };
        return null;
    }
    const raiz = sob.closest?.('[data-drop="root"]');
    if (raiz && ctx.raiz.contains(raiz) && item.parentItemId) return { tipo: 'drop', drop: 'root', el: raiz };
    return null;
}

/**
 * Arrasto por ponteiro: fantasma segue o dedo, alvo acende, soltar executa.
 * Pointer events, não HTML5 DnD: funciona igual no mouse e no TOQUE (o celular
 * é o hardware-alvo). A alça ⠿ tem touch-action:none — arrastar por ela não
 * briga com o scroll da lista, que segue no resto da linha.
 */
export function iniciarArrasto(ctx, grab, e) {
    const id = grab.dataset.grab;
    const item = (ctx.itens || []).find(x => x.id === id);
    if (!item) return;
    e.preventDefault();
    try { grab.setPointerCapture(e.pointerId); } catch (err) { /* evento sintético (__check) */ }

    const ghost = document.createElement('div');
    ghost.className = 'lr-inv-ghost';
    ghost.textContent = `${EMOJI_TIPO[item.tipo] || '📦'} ${item.nome || 'Item'} ×${qtdDe(item)}`;
    document.body.appendChild(ghost);

    let alvoEl = null;
    const pintar = (ev) => {
        ghost.style.left = ev.clientX + 'px';
        ghost.style.top = ev.clientY + 'px';
        const alvo = alvoSob(ctx, item, ev.clientX, ev.clientY);
        ghost.classList.toggle('no-mapa', alvo?.tipo === 'mapa');
        if (alvoEl && alvoEl !== alvo?.el) alvoEl.classList.remove('lr-inv-alvo');
        alvoEl = alvo?.el || null;
        alvoEl?.classList.add('lr-inv-alvo');
    };
    const limpar = () => {
        grab.removeEventListener('pointermove', pintar);
        grab.removeEventListener('pointerup', soltar);
        grab.removeEventListener('pointercancel', limpar);
        ghost.remove();
        alvoEl?.classList.remove('lr-inv-alvo');
    };
    const soltar = (ev) => {
        const alvo = alvoSob(ctx, item, ev.clientX, ev.clientY);
        limpar();
        if (!alvo) return;
        if (alvo.tipo === 'mapa') ctx.acoes.mapa?.(id, { x: ev.clientX, y: ev.clientY });
        else if (alvo.tipo === 'merge') ctx.acoes.fundir?.(id, alvo.id);
        else if (alvo.tipo === 'equipar') ctx.acoes.equipar?.(id);
        else if (alvo.tipo === 'desequipar') ctx.acoes.desequipar?.(id);
        else ctx.acoes.mover?.(id, alvo.drop);
    };
    grab.addEventListener('pointermove', pintar);
    grab.addEventListener('pointerup', soltar);
    grab.addEventListener('pointercancel', limpar);
    pintar(e);
}
