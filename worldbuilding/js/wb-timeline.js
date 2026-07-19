/* ═══════════════════════════════════════════════════════════
   wb-timeline.js — Linha do Tempo (3 visões)
   ────────────────────────────────────────────
   • Rio do Tempo   — eventos históricos (worldbuilding-history)
                      agrupados por Era, com fases lunares.
   • Faixas (Swimlanes) — uma faixa por Tribo/Civilização; cada
                      evento aparece na faixa das tribos envolvidas,
                      posicionado horizontalmente pelo ano.
   • Gerações       — vidas dos membros das linhagens (nascimento→
                      morte) como barras, revelando quem foi
                      contemporâneo de quem.

   Eventos continuam sendo entradas reais de História (só ganham
   `dataMundo`). Gerações leem as linhagens (Eco.lineages).
   ═══════════════════════════════════════════════════════════ */

import { db, doc, updateDoc } from './firebase-config.js';
import { WB, esc, ToolModal, setTitle, contentBody, imgOf } from './wb-utils.js';
import { Calendario } from './wb-calendario.js';
import { Eco } from './wb-ecosystem.js';

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
    let visao = 'rio';   // 'rio' | 'faixas' | 'geracoes'

    const eventos = () => (WB().data.history || []).filter(h => h.tipo !== 'Era');
    const tribos = () => WB().data.factions || [];
    const absOf = (e) => e.dataMundo ? Calendario.toAbsoluteDay(e.dataMundo) : -Infinity;

    /* ══════════════ Render principal ══════════════ */
    function render() {
        setTitle('📜 Linha do Tempo');
        const segBtn = (v, label) => `<button class="wbt-seg__btn ${visao === v ? 'is-active' : ''}" data-visao="${v}">${label}</button>`;

        let corpo = '';
        if (visao === 'rio') corpo = renderRio();
        else if (visao === 'faixas') corpo = renderFaixas();
        else corpo = renderGeracoes();

        contentBody().innerHTML = `
            ${Calendario.configPanelHTML()}
            <div class="wbt-toolbar">
                <div class="wbt-seg">
                    ${segBtn('rio', '🌊 Rio do Tempo')}
                    ${segBtn('faixas', '🏊 Faixas por Tribo')}
                    ${segBtn('geracoes', '⚜️ Gerações')}
                </div>
                <span style="flex:1"></span>
                ${visao !== 'geracoes' ? `
                    <select id="tlEra" class="form-select">${eraOptions()}</select>
                    <select id="tlFac" class="form-select">${facOptions()}</select>
                    <button class="btn btn-secondary" id="tlNew">➕ Datar evento</button>` : ''}
            </div>
            ${visao === 'rio' ? `<div class="wbt-chips" id="tlCats" style="margin-bottom:1rem">${catChips()}</div>` : ''}
            ${corpo}`;

        bind();
        Calendario.bindConfig((reopen) => { render(); if (reopen) document.getElementById('calPanel').open = true; });
    }

    function passa(e) {
        if (filtros.era !== 'all') {
            const era = e.dataMundo ? Calendario.eraOf(e.dataMundo.ano) : null;
            if (!era || era.id !== filtros.era) return false;
        }
        if (filtros.categorias.size && !filtros.categorias.has(e.tipo)) return false;
        if (filtros.faccao !== 'all' && !((e.faccoesEnvolvidas || []).some(f => f.id === filtros.faccao))) return false;
        return true;
    }

    /* ══════════════ VISÃO 1 — Rio do Tempo ══════════════ */
    function renderRio() {
        const evs = eventos().filter(passa).sort((a, b) => absOf(a) - absOf(b));
        if (!evs.length)
            return `<div class="wbt-empty">Nenhum evento datado com estes filtros.<br>
                Use "Datar evento" para posicionar uma entrada da História na régua.</div>`;
        let html = '<div class="wbt-timeline" id="tlRoot">', eraAtual = undefined;
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
            html += cardRio(e);
        }
        return html + '</div>';
    }

    function cardRio(e) {
        const c = CATEGORIAS[e.tipo] || CATEGORIAS['Evento'];
        const data = e.dataMundo
            ? `${esc(Calendario.formatDate(e.dataMundo))} ${Calendario.moonPhases(e.dataMundo).map(m => `<span class="wbt-moon" title="${esc(m.name)}">${m.icon}</span>`).join('')}`
            : '<span class="wbt-muted">sem data no calendário</span>';
        const facs = (e.faccoesEnvolvidas || []).map(f => `<span class="wbt-tag">⚔️ ${esc(f.nome)}</span>`).join('');
        return `
            <article class="wbt-event" style="--cat-cor:${c.cor}" data-ev="${e.id}">
                <span class="wbt-event__date">${data}</span>
                <h4 class="wbt-event__title">${c.icon} ${esc(e.nome)}</h4>
                <p class="wbt-event__desc">${esc((e.descricao || '').slice(0, 220))}</p>
                <div class="wbt-event__tags"><span class="wbt-tag wbt-tag--cat" style="color:${c.cor};border-color:${c.cor}">${esc(e.tipo || 'Evento')}</span>${facs}</div>
                <span class="wbt-event__actions">
                    <button class="wbt-x" data-date="${e.id}" title="Datar/editar">📅</button>
                    <button class="wbt-x" data-open="${e.id}" title="Abrir ficha">📖</button>
                </span>
            </article>`;
    }

    /* ══════════════ VISÃO 2 — Faixas por Tribo ══════════════ */
    function renderFaixas() {
        const evs = eventos().filter(e => e.dataMundo && passa(e));
        const ts = tribos();
        if (!ts.length) return `<div class="wbt-empty">Cadastre Tribos &amp; Civilizações para ver as faixas.</div>`;
        if (!evs.length) return `<div class="wbt-empty">Nenhum evento datado envolvendo tribos ainda.</div>`;

        const anos = evs.map(e => e.dataMundo.ano);
        let min = Math.min(...anos), max = Math.max(...anos);
        if (min === max) { min -= 1; max += 1; }
        const span = max - min;
        const xPct = (ano) => ((ano - min) / span) * 100;

        // régua de eras no topo
        const eraBands = Calendario.eras().filter(er => er.anoInicio != null).map(er => {
            const a = Math.max(er.anoInicio, min);
            const b = Math.min(er.anoFim ?? max, max);
            if (b < a) return '';
            return `<div class="wbt-lane-era" style="left:${xPct(a)}%;width:${xPct(b) - xPct(a)}%;--era-cor:${er.cor || 'var(--lr-bronze)'}"
                        title="${esc(er.nome)}"><span>${esc(er.nome)}</span></div>`;
        }).join('');

        const lanes = ts.map(t => {
            const evsT = evs.filter(e => (e.faccoesEnvolvidas || []).some(f => f.id === t.id));
            const dots = evsT.map(e => {
                const c = CATEGORIAS[e.tipo] || CATEGORIAS['Evento'];
                return `<button class="wbt-lane-dot" style="left:${xPct(e.dataMundo.ano)}%;--cat-cor:${c.cor}"
                            data-open="${e.id}" title="${esc(e.nome)} (${e.dataMundo.ano})">${c.icon}</button>`;
            }).join('');
            return `
                <div class="wbt-lane">
                    <div class="wbt-lane-label">${imgOf(t) ? `<img src="${esc(imgOf(t))}" class="wbt-lane-img">` : '⚔️'} ${esc(t.nome)}</div>
                    <div class="wbt-lane-track">${dots || '<span class="wbt-muted" style="padding-left:.5rem">—</span>'}</div>
                </div>`;
        }).join('');

        return `
            <div class="wbt-swimlanes">
                <div class="wbt-lane wbt-lane--head">
                    <div class="wbt-lane-label wbt-muted">Anos ${min} → ${max}</div>
                    <div class="wbt-lane-track wbt-lane-track--ruler">${eraBands}</div>
                </div>
                ${lanes}
            </div>`;
    }

    /* ══════════════ VISÃO 3 — Gerações (linhagens) ══════════════ */
    function renderGeracoes() {
        const lins = Eco.lineages || [];
        const vidas = [];
        for (const l of lins) {
            for (const m of (l.members || [])) {
                if (!m.nascimento) continue;
                vidas.push({
                    linNome: l.nome, cor: l.cor || 'var(--lr-gold)',
                    nome: nomeMembro(m), nasc: m.nascimento,
                    morte: m.morte, ref: m.ref,
                });
            }
        }
        if (!vidas.length)
            return `<div class="wbt-empty">Nenhum membro de linhagem tem datas ainda.<br>
                Vá em <b>Grafos → ⚜️ Linhagens</b>, edite uma linhagem e clique em 📅 num membro para definir nascimento/morte.</div>`;

        const anoN = (v) => v.nasc.ano;
        const anoM = (v) => v.morte ? v.morte.ano : Math.max(...vidas.map(x => x.morte?.ano ?? x.nasc.ano)) + 5;
        let min = Math.min(...vidas.map(anoN));
        let max = Math.max(...vidas.map(anoM));
        if (min === max) { min -= 1; max += 1; }
        const span = max - min;
        const xPct = (ano) => ((ano - min) / span) * 100;

        vidas.sort((a, b) => anoN(a) - anoN(b));
        const barras = vidas.map(v => {
            const x1 = xPct(anoN(v)), x2 = xPct(anoM(v));
            const vivo = !v.morte;
            return `
                <div class="wbt-life">
                    <div class="wbt-life-label" style="--lin-cor:${v.cor}" title="${esc(v.linNome)}">
                        <span class="wbt-life-dot"></span>${esc(v.nome)}</div>
                    <div class="wbt-life-track">
                        <button class="wbt-life-bar ${vivo ? 'is-alive' : ''}" style="left:${x1}%;width:${Math.max(x2 - x1, 1.5)}%;--lin-cor:${v.cor}"
                            data-openref="${esc(v.ref)}"
                            title="${esc(v.nome)}: ${v.nasc.ano}${v.morte ? ' – ' + v.morte.ano : ' – vivo'}">
                            <span>${v.nasc.ano}${v.morte ? '–' + v.morte.ano : '–'}</span>
                        </button>
                    </div>
                </div>`;
        }).join('');

        // marcadores de era ao fundo
        const eraBands = Calendario.eras().filter(er => er.anoInicio != null).map(er => {
            const a = Math.max(er.anoInicio, min), b = Math.min(er.anoFim ?? max, max);
            if (b < a) return '';
            return `<div class="wbt-lane-era" style="left:${xPct(a)}%;width:${xPct(b) - xPct(a)}%;--era-cor:${er.cor || 'var(--lr-bronze)'}"><span>${esc(er.nome)}</span></div>`;
        }).join('');

        return `
            <div class="wbt-generations">
                <div class="wbt-life wbt-life--head">
                    <div class="wbt-life-label wbt-muted">Anos ${min} → ${max}</div>
                    <div class="wbt-life-track wbt-lane-track--ruler">${eraBands}</div>
                </div>
                ${barras}
            </div>`;
    }

    function nomeMembro(m) {
        if (m.fonte === 'char') return (Eco.chars.find(c => c.id === m.id)?.nome) || m.nome || '?';
        return (WB().data.npcs || []).find(n => n.id === m.id)?.nome || m.nome || '?';
    }

    /* ══════════════ Filtros ══════════════ */
    const eraOptions = () =>
        `<option value="all">Todas as eras</option>` +
        Calendario.eras().map(e => `<option value="${e.id}" ${filtros.era === e.id ? 'selected' : ''}>⏳ ${esc(e.nome)}</option>`).join('');
    const catChips = () =>
        Object.entries(CATEGORIAS).map(([k, c]) =>
            `<button class="wbt-chip ${filtros.categorias.has(k) ? 'is-active' : ''}" data-cat="${esc(k)}"
              style="${filtros.categorias.has(k) ? `background:${c.cor};border-color:${c.cor};color:#0e1116` : ''}">${c.icon} ${esc(k)}</button>`).join('');
    const facOptions = () =>
        `<option value="all">Todas as tribos</option>` +
        tribos().map(f => `<option value="${f.id}" ${filtros.faccao === f.id ? 'selected' : ''}>${esc(f.nome)}</option>`).join('');

    /* ══════════════ Datar evento ══════════════ */
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
        ['dtAno', 'dtMes', 'dtDia'].forEach(x => document.getElementById(x).oninput = preview);
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

    /* ══════════════ Eventos de UI ══════════════ */
    function bind() {
        document.querySelectorAll('[data-visao]').forEach(b => b.onclick = () => { visao = b.dataset.visao; render(); });

        const tlNew = document.getElementById('tlNew');
        if (tlNew) tlNew.onclick = () => {
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

        const tlEra = document.getElementById('tlEra');
        if (tlEra) tlEra.onchange = (e) => { filtros.era = e.target.value; render(); };
        const tlFac = document.getElementById('tlFac');
        if (tlFac) tlFac.onchange = (e) => { filtros.faccao = e.target.value; render(); };
        const tlCats = document.getElementById('tlCats');
        if (tlCats) tlCats.onclick = (e) => {
            const b = e.target.closest('[data-cat]'); if (!b) return;
            const k = b.dataset.cat;
            filtros.categorias.has(k) ? filtros.categorias.delete(k) : filtros.categorias.add(k);
            render();
        };

        // cliques em eventos / vidas (delegação no corpo, um único listener persistente)
        const body = contentBody();
        if (!body._tlBound) {
            body._tlBound = true;
            body.addEventListener('click', (e) => {
                const dt = e.target.closest('[data-date]');
                const op = e.target.closest('[data-open]');
                const rf = e.target.closest('[data-openref]');
                if (dt) openDateEditor(dt.dataset.date);
                else if (op) ToolModal.openEntry('history', op.dataset.open);
                else if (rf) {
                    const [fonte, id] = rf.dataset.openref.split(':');
                    if (fonte === 'npcs') ToolModal.openEntry('npcs', id);
                    else window.open(`../ficha-v1.7_1/ficha-v1.7_1.html?id=${id}`, '_blank');
                }
            });
        }
    }

    return { render };
})();
