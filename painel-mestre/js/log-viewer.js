// =============================================
// LOG VIEWER — Componente reutilizável
// =============================================
// Visualizador de logs em TEMPO REAL (onSnapshot) com filtro
// profissional e avançado. Usado por:
//   • Painel do Mestre > Histórico  (todos os logs)
//   • Painel do Mestre > Mesas > Logs (logs da mesa atual)
//
// Cada log mostra um resumo claro; clicar expande os detalhes
// (tabela de alterações Antes → Depois + metadados).

import { db, collection, query, where, orderBy, limit, onSnapshot } from './firebase-config.js';
import { escapeHtml } from './ui-utils.js';

const CATEGORY_COLORS = [
    '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
    '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16'
];

function catColor(cat) {
    let h = 0;
    const s = String(cat || 'Geral');
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return CATEGORY_COLORS[h % CATEGORY_COLORS.length];
}

function debounce(fn, ms) {
    let t = null;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

/**
 * Cria um visualizador de logs.
 * @param {object} cfg
 *   cfg.filtersContainerId — div onde a barra de filtros é montada
 *   cfg.listContainerId    — div onde a lista de logs é renderizada
 *   cfg.idPrefix           — prefixo único para ids internos
 *   cfg.mesaId             — se definido, mostra apenas logs desta mesa
 *   cfg.charIds            — (opcional) charIds da mesa, para incluir logs
 *                            antigos sem mesaId gravado
 *   cfg.maxLogs            — limite (padrão 1000)
 */
export function createLogViewer(cfg) {
    const P = cfg.idPrefix || 'lv';
    const MAX = cfg.maxLogs || 1000;
    let allLogs = [];
    let unsubs = [];
    let expanded = new Set();
    let quickRange = 'all';
    let started = false;

    const $ = id => document.getElementById(P + '_' + id);

    /* ================ FILTER BAR UI ================ */

    function buildFiltersUI() {
        const c = document.getElementById(cfg.filtersContainerId);
        if (!c) return;
        c.innerHTML = `
        <div class="lv-panel">
            <div class="lv-row lv-row-main">
                <div class="lv-field lv-grow">
                    <label class="form-label">🔍 Buscar</label>
                    <input type="text" class="form-input" id="${P}_search" placeholder="Ação, campo alterado, valor, usuário, personagem...">
                </div>
                <div class="lv-field">
                    <label class="form-label">Categoria</label>
                    <select class="form-select" id="${P}_category"><option value="">Todas</option></select>
                </div>
                <div class="lv-field">
                    <label class="form-label">Personagem</label>
                    <select class="form-select" id="${P}_character"><option value="">Todos</option></select>
                </div>
                <div class="lv-field">
                    <label class="form-label">Usuário</label>
                    <select class="form-select" id="${P}_user"><option value="">Todos</option></select>
                </div>
                <div class="lv-field">
                    <label class="form-label">Origem</label>
                    <select class="form-select" id="${P}_origin"><option value="">Todas</option></select>
                </div>
            </div>
            <div class="lv-row lv-row-secondary">
                <div class="lv-chips" id="${P}_chips">
                    <button class="lv-chip active" data-range="all">Tudo</button>
                    <button class="lv-chip" data-range="today">Hoje</button>
                    <button class="lv-chip" data-range="24h">24h</button>
                    <button class="lv-chip" data-range="7d">7 dias</button>
                    <button class="lv-chip" data-range="30d">30 dias</button>
                </div>
                <div class="lv-field lv-date">
                    <label class="form-label">De</label>
                    <input type="datetime-local" class="form-input" id="${P}_from">
                </div>
                <div class="lv-field lv-date">
                    <label class="form-label">Até</label>
                    <input type="datetime-local" class="form-input" id="${P}_to">
                </div>
                <div class="lv-field">
                    <label class="form-label">Ordem</label>
                    <select class="form-select" id="${P}_sort">
                        <option value="desc">Mais recentes</option>
                        <option value="asc">Mais antigos</option>
                    </select>
                </div>
                <button class="btn btn-secondary btn-small" id="${P}_clear" title="Limpar filtros">🧹 Limpar</button>
                <button class="btn btn-secondary btn-small" id="${P}_export" title="Exportar resultado filtrado em CSV">📥 CSV</button>
                <button class="btn btn-secondary btn-small" id="${P}_expandall" title="Expandir/recolher todos">⤢ Expandir</button>
            </div>
            <div class="lv-statusbar">
                <span id="${P}_count" class="log-count">Carregando…</span>
                <span class="lv-live" title="Atualização em tempo real"><span class="lv-live-dot"></span> TEMPO REAL</span>
            </div>
        </div>`;

        // listeners
        $('search').addEventListener('input', debounce(applyAndRender, 250));
        ['category', 'character', 'user', 'origin', 'sort'].forEach(id => $(id).addEventListener('change', applyAndRender));
        ['from', 'to'].forEach(id => $(id).addEventListener('change', () => { quickRange = 'custom'; syncChips(); applyAndRender(); }));
        $('chips').querySelectorAll('.lv-chip').forEach(ch => ch.addEventListener('click', () => {
            quickRange = ch.dataset.range;
            $('from').value = ''; $('to').value = '';
            syncChips(); applyAndRender();
        }));
        $('clear').addEventListener('click', clearFilters);
        $('export').addEventListener('click', exportCsv);
        $('expandall').addEventListener('click', toggleExpandAll);
    }

    function syncChips() {
        const chips = $('chips'); if (!chips) return;
        chips.querySelectorAll('.lv-chip').forEach(ch => ch.classList.toggle('active', ch.dataset.range === quickRange));
    }

    function clearFilters() {
        ['search', 'from', 'to'].forEach(id => { const el = $(id); if (el) el.value = ''; });
        ['category', 'character', 'user', 'origin'].forEach(id => { const el = $(id); if (el) el.value = ''; });
        const s = $('sort'); if (s) s.value = 'desc';
        quickRange = 'all'; syncChips();
        applyAndRender();
    }

    function populateSelect(id, values, current) {
        const el = $(id); if (!el) return;
        const first = el.options[0].outerHTML;
        el.innerHTML = first + values.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
        if (current && values.includes(current)) el.value = current;
    }

    function refreshFilterOptions() {
        const uniq = fn => [...new Set(allLogs.map(fn).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
        populateSelect('category', uniq(l => logCategory(l)), $('category')?.value);
        populateSelect('character', uniq(l => l.character), $('character')?.value);
        populateSelect('user', uniq(l => l.user), $('user')?.value);
        populateSelect('origin', uniq(l => l.origin), $('origin')?.value);
    }

    /* ================ FILTERING ================ */

    function rangeStart() {
        const now = Date.now();
        if (quickRange === 'today') { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); }
        if (quickRange === '24h') return now - 864e5;
        if (quickRange === '7d') return now - 7 * 864e5;
        if (quickRange === '30d') return now - 30 * 864e5;
        return null;
    }

    function logCategory(l) { return l.category || ({ characters: 'Personagens', npcs: 'NPCs', items: 'Itens & Loja', notifications: 'Notificações', apoios: 'Apoios' })[l.section] || l.section || 'Geral'; }

    function filteredLogs() {
        const search = ($('search')?.value || '').toLowerCase().trim();
        const cat = $('category')?.value || '';
        const char = $('character')?.value || '';
        const user = $('user')?.value || '';
        const origin = $('origin')?.value || '';
        const from = $('from')?.value ? new Date($('from').value).getTime() : null;
        const to = $('to')?.value ? new Date($('to').value).getTime() : null;
        const qs = rangeStart();
        const sortAsc = ($('sort')?.value || 'desc') === 'asc';

        let out = allLogs.filter(l => {
            const t = l.timestamp ? new Date(l.timestamp).getTime() : 0;
            if (qs !== null && t < qs) return false;
            if (from !== null && t < from) return false;
            if (to !== null && t > to) return false;
            if (cat && logCategory(l) !== cat) return false;
            if (char && (l.character || '') !== char) return false;
            if (user && (l.user || '') !== user) return false;
            if (origin && (l.origin || '') !== origin) return false;
            if (search) {
                const hay = [
                    l.action, l.user, l.userName, l.character, logCategory(l), l.origin,
                    ...(Array.isArray(l.changes) ? l.changes.map(c => `${c.label} ${c.from} ${c.to}`) : [])
                ].join(' ').toLowerCase();
                if (!hay.includes(search)) return false;
            }
            return true;
        });
        out.sort((a, b) => {
            const ta = a.timestamp || '', tb = b.timestamp || '';
            return sortAsc ? ta.localeCompare(tb) : tb.localeCompare(ta);
        });
        return out;
    }

    /* ================ RENDER ================ */

    function renderList() {
        const list = document.getElementById(cfg.listContainerId);
        if (!list) return;
        const logs = filteredLogs();

        const count = $('count');
        if (count) count.textContent = `${logs.length} de ${allLogs.length} log(s)`;

        if (!logs.length) {
            list.innerHTML = '<div class="no-logs">Nenhum log encontrado com os filtros atuais</div>';
            return;
        }

        let html = '';
        let lastDay = '';
        for (const log of logs) {
            const d = log.timestamp ? new Date(log.timestamp) : null;
            const dayKey = d ? d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) : 'Sem data';
            if (dayKey !== lastDay) {
                html += `<div class="lv-day-header">📅 ${escapeHtml(dayKey)}</div>`;
                lastDay = dayKey;
            }
            html += renderEntry(log, d);
        }
        list.innerHTML = html;

        // expand/collapse
        list.querySelectorAll('.log-entry[data-logid]').forEach(el => {
            el.addEventListener('click', (ev) => {
                if (ev.target.closest('a,button,input,select')) return;
                const id = el.dataset.logid;
                if (expanded.has(id)) expanded.delete(id); else expanded.add(id);
                el.classList.toggle('expanded');
            });
        });
    }

    function renderEntry(log, d) {
        const time = d ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--';
        const cat = logCategory(log);
        const color = catColor(cat);
        const hasDetails = (Array.isArray(log.changes) && log.changes.length > 0) || log.charId || log.mesaId;
        const isExp = expanded.has(log.id);
        const nChanges = Array.isArray(log.changes) ? log.changes.length : 0;

        let details = '';
        if (hasDetails) {
            const rows = (log.changes || []).map(c => `
                <tr>
                    <td class="lv-ch-label">${escapeHtml(c.label || '')}</td>
                    <td class="lv-ch-from">${escapeHtml(String(c.from ?? ''))}</td>
                    <td class="lv-ch-arrow">→</td>
                    <td class="lv-ch-to">${escapeHtml(String(c.to ?? ''))}</td>
                </tr>`).join('');
            details = `
            <div class="lv-details">
                ${rows ? `<table class="lv-changes-table">
                    <thead><tr><th>O que mudou</th><th>Antes</th><th></th><th>Depois</th></tr></thead>
                    <tbody>${rows}</tbody>
                </table>` : ''}
                <div class="lv-meta">
                    ${log.origin ? `<span>🧭 Origem: <b>${escapeHtml(log.origin)}</b></span>` : ''}
                    ${log.section ? `<span>📂 Seção: <b>${escapeHtml(log.section)}</b></span>` : ''}
                    ${log.charId ? `<span>🆔 Personagem: <b>${escapeHtml(log.charId)}</b></span>` : ''}
                    ${log.mesaId ? `<span>🎲 Mesa: <b>${escapeHtml(log.mesaId)}</b></span>` : ''}
                    ${log.timestamp ? `<span>🕒 ${escapeHtml(new Date(log.timestamp).toLocaleString('pt-BR'))}</span>` : ''}
                </div>
            </div>`;
        }

        return `
        <div class="log-entry lv-entry ${isExp ? 'expanded' : ''} ${hasDetails ? 'lv-clickable' : ''}" data-logid="${escapeHtml(log.id)}" style="border-left-color:${color}">
            <div class="lv-entry-head">
                <span class="lv-time">${time}</span>
                <span class="lv-badge" style="background:${color}22;color:${color};border-color:${color}55">${escapeHtml(cat)}</span>
                ${log.character ? `<span class="lv-char">🎭 ${escapeHtml(log.character)}</span>` : ''}
                <span class="lv-user" title="${escapeHtml(log.user || '')}">👤 ${escapeHtml(log.userName || log.user || 'Sistema')}</span>
                ${hasDetails ? `<span class="lv-expander">${nChanges ? nChanges + ' detalhe(s)' : 'detalhes'} <span class="lv-chevron">▾</span></span>` : ''}
            </div>
            <div class="log-action lv-action">${escapeHtml(log.action || '')}</div>
            ${details}
        </div>`;
    }

    function toggleExpandAll() {
        const logs = filteredLogs();
        const allOpen = logs.every(l => expanded.has(l.id));
        if (allOpen) expanded.clear();
        else logs.forEach(l => expanded.add(l.id));
        renderList();
    }

    function exportCsv() {
        const logs = filteredLogs();
        const esc = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
        const lines = ['Data/Hora;Categoria;Personagem;Usuário;Ação;Detalhes;Origem;Mesa;CharId'];
        for (const l of logs) {
            const det = (l.changes || []).map(c => `${c.label}: ${c.from} → ${c.to}`).join(' | ');
            lines.push([
                l.timestamp ? new Date(l.timestamp).toLocaleString('pt-BR') : '',
                logCategory(l), l.character || '', l.user || '', l.action || '', det,
                l.origin || '', l.mesaId || '', l.charId || ''
            ].map(esc).join(';'));
        }
        const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'logs_' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.csv';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }

    const applyAndRender = () => renderList();

    /* ================ REALTIME SUBSCRIPTION ================ */

    function mergeSnapshot(docs) {
        const map = new Map(allLogs.map(l => [l.id, l]));
        docs.forEach(d => map.set(d.id, d));
        allLogs = [...map.values()];
        // manter limite em memória (mais recentes primeiro)
        allLogs.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
        if (allLogs.length > MAX) allLogs = allLogs.slice(0, MAX);
        refreshFilterOptions();
        renderList();
    }

    function start() {
        if (started) return;
        started = true;
        buildFiltersUI();

        const list = document.getElementById(cfg.listContainerId);
        if (list) list.innerHTML = '<div class="no-logs">Carregando logs em tempo real…</div>';

        try {
            if (cfg.mesaId) {
                // Logs da mesa: where simples (sem orderBy → não exige índice composto)
                const q1 = query(collection(db, 'logs'), where('mesaId', '==', cfg.mesaId));
                unsubs.push(onSnapshot(q1, snap => {
                    const docs = []; snap.forEach(d => docs.push({ id: d.id, ...d.data() }));
                    mergeSnapshot(docs);
                }, err => onError(err)));

                // Compat: logs antigos que só têm charId (sem mesaId), em lotes de 10
                const ids = Array.isArray(cfg.charIds) ? cfg.charIds.filter(Boolean) : [];
                for (let i = 0; i < ids.length; i += 10) {
                    const batch = ids.slice(i, i + 10);
                    const q2 = query(collection(db, 'logs'), where('charId', 'in', batch));
                    unsubs.push(onSnapshot(q2, snap => {
                        const docs = []; snap.forEach(d => docs.push({ id: d.id, ...d.data() }));
                        mergeSnapshot(docs);
                    }, err => console.warn('log-viewer charId batch:', err)));
                }
            } else {
                const q0 = query(collection(db, 'logs'), orderBy('timestamp', 'desc'), limit(MAX));
                unsubs.push(onSnapshot(q0, snap => {
                    const docs = []; snap.forEach(d => docs.push({ id: d.id, ...d.data() }));
                    allLogs = docs;
                    refreshFilterOptions();
                    renderList();
                }, err => onError(err)));
            }
        } catch (e) { onError(e); }
    }

    function onError(err) {
        console.error('❌ log-viewer:', err);
        const list = document.getElementById(cfg.listContainerId);
        if (list) list.innerHTML = '<div class="no-logs">❌ Erro ao carregar logs em tempo real</div>';
    }

    function stop() {
        unsubs.forEach(u => { try { u(); } catch (e) { /* ignore */ } });
        unsubs = [];
        started = false;
        allLogs = [];
        expanded.clear();
    }

    return { start, stop, get mesaId() { return cfg.mesaId; } };
}
