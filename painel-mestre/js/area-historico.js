// =============================================
// ÁREA HISTÓRICO — Logs
// =============================================

import { db, collection, getDocs, query, orderBy, limit } from './firebase-config.js';
import { escapeHtml } from './ui-utils.js';

let allLogs = [];

export async function onTabActivated() { await loadLogs(); }

async function loadLogs() {
    try {
        const snap = await getDocs(query(collection(db, 'logs'), orderBy('timestamp', 'desc'), limit(500)));
        allLogs = [];
        snap.forEach(d => allLogs.push({ id: d.id, ...d.data() }));
        console.log(`📜 ${allLogs.length} logs carregados`);
        renderLogs(allLogs);
    } catch (error) {
        console.error('❌ Erro logs:', error);
        const list = document.getElementById('logsList');
        if (list) list.innerHTML = '<div class="no-logs">Erro ao carregar histórico</div>';
    }
}

function renderLogs(logs) {
    const list = document.getElementById('logsList');
    if (!list) return;
    if (logs.length === 0) { list.innerHTML = '<div class="no-logs">Nenhum log encontrado</div>'; return; }

    list.innerHTML = logs.map(log => {
        const ts = log.timestamp ? new Date(log.timestamp).toLocaleString('pt-BR') : '-';
        return `
            <div class="log-entry">
                <div class="log-time">${ts}</div>
                <div class="log-user">${escapeHtml(log.user || 'Sistema')}</div>
                <div class="log-action">
                    ${escapeHtml(log.action || '')}
                    ${log.character ? ` — <span class="log-character">${escapeHtml(log.character)}</span>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

window.filterLogs = function() {
    const search = (document.getElementById('logSearchInput')?.value || '').toLowerCase();
    const section = document.getElementById('logFilterSection')?.value || '';
    let filtered = allLogs;
    if (search) filtered = filtered.filter(l => (l.action||'').toLowerCase().includes(search) || (l.user||'').toLowerCase().includes(search) || (l.character||'').toLowerCase().includes(search));
    if (section) filtered = filtered.filter(l => l.section === section);
    renderLogs(filtered);
};
