// =============================================
// ÁREA HISTÓRICO — Logs em TEMPO REAL
// =============================================
// Exibe todos os logs do sistema (coleção 'logs') com atualização
// em tempo real (onSnapshot) e filtro profissional/avançado.
// A UI de filtros e a lista são montadas pelo componente log-viewer.

import { createLogViewer } from './log-viewer.js';

let viewer = null;

export async function onTabActivated() {
    if (!viewer) {
        viewer = createLogViewer({
            filtersContainerId: 'historicoFilters',
            listContainerId: 'logsList',
            idPrefix: 'hist',
            maxLogs: 1000
        });
        viewer.start();
    }
}

// Compat: chamadas antigas de filterLogs() no HTML não quebram
window.filterLogs = function () { /* filtros agora são gerenciados pelo log-viewer */ };
