/* ═══════════════════════════════════════════════════════════
   wb-timeline.js — Linha do Tempo (o Rio do Tempo)
   ─────────────────────────────────────────────────
   • Eventos = entradas da coleção REAL worldbuilding-history
     (tipos: Evento, Guerra, Fundação, Catástrofe, Descoberta,
     Tratado…). NÃO cria coleção paralela.
   • Cada evento é datado no calendário customizado via campo
     `dataMundo: { ano, mes, dia }` acrescentado à entrada.
   • Agrupa por Era (worldbuilding-history tipo 'Era'), mostra
     fases lunares, e filtra por Era / Categoria / Facção.
   ═══════════════════════════════════════════════════════════ */

import { db, doc, updateDoc } from './firebase-config.js';
import { WB, esc, ToolModal, setTitle, contentBody } from './wb-utils.js';
import { Calendario } from './wb-calendario.js';

/* Categorias mapeadas aos "tipos" reais da categoria História */
export const CATEGORIAS = {
    'Guerra':      { cor: 'var(--lr-blood)',   icon: '⚔️' },
    'Descoberta':  { cor: 'var(--lr-abyssal)', icon: '✨' },
    'Fundação':    { cor: 'var(--lr-gold)',    icon: '🏛️' },
    'Tratado':     { cor: 'var(--lr-nature)',  icon: '🕊️' },
    'Catástrofe':  { cor: '#a34d6b',           icon: '☄️' },
    'Político':    { cor: 'var(--lr-bronze)',  icon: '👑' },
    'Desastre Natural': { cor: '#7d8698',      icon: '🌋' },
    'Período':     { cor: '#7d8698',           icon: '⌛' },
    'Evento':      { cor: 'var(--lr-arcane)',  icon: '📜' },
};

export const Timeline = (() => {
    const filtros = { era: 'all', categorias: new Set(), faccao: 'all' };

    /* Só entram na régua entradas de história que NÃO são "Era" */
    const eventos = () =>
        (WB().data.history || []).filter(h => h.tipo !== 'Era');

    /* ── Render principal ───────────────────────────────── */
    function render() {
        setTitle('📜 Linha do Tempo');
        const evs = eventos()
            .filter(passa)
            .sort((a, b) => absOf(a) - absOf(b));

        contentBody().innerHTML = `
            ${Calendario.configPanelHTML()}
            <div class="wbt-toolbar">
                <select id="tlEra" class="form-select">${eraOptions()}</select>
                <div class="wbt-chips" id="tlCats">${catChips()}</div>
                <select id="tlFac" class="form-select">${facOptions()}</select>
                <span style="flex:1"></span>
                <button class="btn btn-secondary" id="tlNew">➕ Datar evento no calendário</button>
            </div>
            <div class="wbt-timeline" id="tlRoot">${renderRio(evs)}</div>`;

        bind();
        Calendario.bindConfig((reopen) => { render(); if (reopen) document.getElementById('calPanel').open = true; });
    }

    const absOf = (e) => e.dataMundo ? Calendario.toAbsoluteDay(e.dataMundo) : -Infinity;

    function passa(e) {
        if (filtros.era !== 'all') {
            const era = e.dataMundo ? Calendario.eraOf(e.dataMundo.ano) : null;
            if (!era || era.id !== filtros.era) return false;
        }
        if (filtros.categorias.size && !filtros.categorias.has(e.tipo)) return false;
        if (filtros.faccao !== 'all' &&
            !((e.faccoesEnvolvidas || []).some(f => f.id === filtros.faccao))) return false;
        return true;
    }

    function renderRio(evs) {
        if (!evs.length)
            return `<div class="wbt-empty">Nenhum evento datado com estes filtros.<br>
                Use "Datar evento" para posicionar uma entrada da História na régua do tempo.</div>`;

        let html = '', eraAtual = undefined;
        for (const e of evs) {
            const era = e.dataMundo ? Calendario.eraOf(e.dataMundo.ano) : null;
            const eraId = era?.id ?? (e.dataMundo ? '_semera' : '_semdata');
            if (eraId !== eraAtual) {
                eraAtual = eraId;
                const nome = era?.nome || (e.dataMundo ? 'Fora das Eras' : 'Sem data no calendário');
                const range = era ? `${era.anoInicio ?? '?'} — ${era.anoFim ?? 'presente'}` : '';
                html += `<div class="wbt-era" style="--era-cor:${era?.cor || 'var(--lr-bronze)'}">
                    <span class="wbt-era__name">${esc(nome)}</span>
                    <span class="wbt-era__range">${range}</span></div>`;
            }
            html += card(e);
        }
        return html;
    }

    function card(e) {
        const c = CATEGORIAS[e.tipo] || CATEGORIAS['Evento'];
        const data = e.dataMundo
            ? `${esc(Calendario.formatDate(e.dataMundo))} ${Calendario.moonPhases(e.dataMundo).map(m => `<span class="wbt-moon" title="${esc(m.name)}">${m.icon}</span>`).join('')}`
            : '<span class="wbt-muted">sem data no calendário</span>';
        const facs = (e.faccoesEnvolvidas || [])
            .map(f => `<span class="wbt-tag">⚔️ ${esc(f.nome)}</span>`).join('');
        return `
            <article class="wbt-event" style="--cat-cor:${c.cor}" data-ev="${e.id}">
                <span class="wbt-event__date">${data}</span>
                <h4 class="wbt-event__title">${c.icon} ${esc(e.nome)}</h4>
                <p class="wbt-event__desc">${esc((e.descricao || '').slice(0, 220))}</p>
                <div class="wbt-event__tags"><span class="wbt-tag wbt-tag--cat" style="color:${c.cor};border-color:${c.cor}">${esc(e.tipo || 'Evento')}</span>${facs}</div>
                <span class="wbt-event__actions">
                    <button class="wbt-x" data-date="${e.id}" title="Datar/editar no calendário">📅</button>
                    <button class="wbt-x" data-open="${e.id}" title="Abrir ficha">📖</button>
                </span>
            </article>`;
    }

    /* ── Opções de filtro ───────────────────────────────── */
    const eraOptions = () =>
        `<option value="all">Todas as eras</option>` +
        Calendario.eras().map(e => `<option value="${e.id}" ${filtros.era === e.id ? 'selected' : ''}>⏳ ${esc(e.nome)}</option>`).join('');

    const catChips = () =>
        Object.entries(CATEGORIAS).map(([k, c]) =>
            `<button class="wbt-chip ${filtros.categorias.has(k) ? 'is-active' : ''}" data-cat="${esc(k)}"
              style="${filtros.categorias.has(k) ? `background:${c.cor};border-color:${c.cor};color:#0e1116` : ''}">${c.icon} ${esc(k)}</button>`).join('');

    const facOptions = () =>
        `<option value="all">Todas as facções</option>` +
        (WB().data.factions || []).map(f => `<option value="${f.id}" ${filtros.faccao === f.id ? 'selected' : ''}>${esc(f.nome)}</option>`).join('');

    /* ── Datar evento (grava dataMundo direto na entrada) ── */
    function openDateEditor(id) {
        const e = eventos().find(x => x.id === id);
        if (!e) return;
        const d = e.dataMundo || { ano: Calendario.eras()[0]?.anoInicio ?? 0, mes: 0, dia: 1 };
        ToolModal.open(`
            <span class="wbt-kind">📅 Datar no calendário do mundo</span>
            <h2>${esc(e.nome)}</h2>
            <div class="wbt-form">
                <div class="wbt-row2">
                    <label>Ano <input id="dtAno" class="form-input" type="number" value="${d.ano}"></label>
                    <label>Dia <input id="dtDia" class="form-input" type="number" min="1" value="${d.dia}"></label>
                </div>
                <label>Mês <select id="dtMes" class="form-select">${Calendario.monthOptions(d.mes)}</select></label>
                <p class="wbt-muted" id="dtPreview"></p>
                <div class="wbt-actions">
                    ${e.dataMundo ? '<button class="btn btn-secondary" id="dtClear">Remover data</button>' : ''}
                    <button class="btn btn-success" id="dtSave">💾 Salvar data</button>
                </div>
            </div>`);

        const preview = () => {
            const dd = { ano: +document.getElementById('dtAno').value || 0, mes: +document.getElementById('dtMes').value, dia: Math.max(1, +document.getElementById('dtDia').value || 1) };
            document.getElementById('dtPreview').textContent = Calendario.formatDate(dd);
        };
        ['dtAno', 'dtMes', 'dtDia'].forEach(id2 => document.getElementById(id2).oninput = preview);
        preview();

        document.getElementById('dtSave').onclick = async () => {
            const dataMundo = {
                ano: +document.getElementById('dtAno').value || 0,
                mes: +document.getElementById('dtMes').value,
                dia: Math.max(1, +document.getElementById('dtDia').value || 1),
            };
            dataMundo.sortKey = Calendario.toAbsoluteDay(dataMundo);
            await updateDoc(doc(db, 'worldbuilding-history', id), { dataMundo });
            await WB().reload();
            ToolModal.close(); render();
        };
        const clr = document.getElementById('dtClear');
        if (clr) clr.onclick = async () => {
            await updateDoc(doc(db, 'worldbuilding-history', id), { dataMundo: null });
            await WB().reload();
            ToolModal.close(); render();
        };
    }

    /* ── Eventos de UI ──────────────────────────────────── */
    function bind() {
        document.getElementById('tlNew').onclick = () => {
            const semData = eventos().filter(e => !e.dataMundo);
            if (!semData.length) { WB().showAlert('Todos os eventos já têm data. Crie novas entradas em 📜 História.', 'warning'); return; }
            ToolModal.open(`<h2>Escolha o evento para datar</h2>
                <div class="wbt-picklist">${semData.map(e =>
                    `<button class="wbt-pick" data-pick="${e.id}">${(CATEGORIAS[e.tipo] || CATEGORIAS.Evento).icon} ${esc(e.nome)} <span class="wbt-muted">${esc(e.tipo || '')}</span></button>`).join('')}</div>`);
            document.querySelector('.wbt-picklist').onclick = (ev) => {
                const b = ev.target.closest('[data-pick]'); if (!b) return;
                ToolModal.close(); openDateEditor(b.dataset.pick);
            };
        };
        document.getElementById('tlEra').onchange = (e) => { filtros.era = e.target.value; render(); };
        document.getElementById('tlFac').onchange = (e) => { filtros.faccao = e.target.value; render(); };
        document.getElementById('tlCats').onclick = (e) => {
            const b = e.target.closest('[data-cat]'); if (!b) return;
            const k = b.dataset.cat;
            filtros.categorias.has(k) ? filtros.categorias.delete(k) : filtros.categorias.add(k);
            render();
        };
        document.getElementById('tlRoot').onclick = (e) => {
            const dt = e.target.closest('[data-date]');
            const op = e.target.closest('[data-open]');
            if (dt) openDateEditor(dt.dataset.date);
            if (op) ToolModal.openEntry('history', op.dataset.open);
        };
    }

    return { render };
})();
