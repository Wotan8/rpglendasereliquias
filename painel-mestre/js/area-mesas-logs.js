// =============================================
// ÁREA MESAS — Sub-aba LOGS (tempo real)
// =============================================
// Exibe todos os logs dos personagens vinculados à mesa atual,
// em tempo real, com filtro profissional/avançado (log-viewer).

import { db, collection, query, where, getDocs } from './firebase-config.js';
import * as S from './state.js';
import { createLogViewer } from './log-viewer.js';

let viewer = null;
let viewerMesaId = null;

async function getMesaCharIds(mesaId) {
    // IDs dos personagens vinculados à mesa (para compat com logs antigos sem mesaId)
    try {
        const snap = await getDocs(query(collection(db, 'char'), where('mesaId', '==', mesaId)));
        const ids = [];
        snap.forEach(d => ids.push(d.id));
        return ids;
    } catch (e) {
        console.warn('⚠️ Mesa Logs: não foi possível listar personagens da mesa:', e);
        return [];
    }
}

window._loadMesaLogs = async function () {
    const mesaId = S.currentMesaId;
    if (!mesaId) return;

    // Já assinado para esta mesa? Nada a fazer (tempo real já ativo)
    if (viewer && viewerMesaId === mesaId) return;

    // Trocou de mesa → encerra a assinatura anterior
    if (viewer) { viewer.stop(); viewer = null; }

    const list = document.getElementById('mesaLogsList');
    if (list) list.innerHTML = '<div class="no-logs">Carregando logs da mesa…</div>';

    const charIds = await getMesaCharIds(mesaId);

    viewer = createLogViewer({
        filtersContainerId: 'mesaLogsFilters',
        listContainerId: 'mesaLogsList',
        idPrefix: 'mlog',
        mesaId: mesaId,
        charIds: charIds,
        maxLogs: 1000
    });
    viewerMesaId = mesaId;
    viewer.start();
};

window._stopMesaLogs = function () {
    if (viewer) { viewer.stop(); viewer = null; viewerMesaId = null; }
    const filters = document.getElementById('mesaLogsFilters');
    const list = document.getElementById('mesaLogsList');
    if (filters) filters.innerHTML = '';
    if (list) list.innerHTML = '<div class="no-logs">Abra a aba Logs para carregar</div>';
};
