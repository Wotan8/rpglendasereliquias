// =============================================
// PAINEL DO MESTRE — Logs / Audit Trail
// =============================================

import { db, collection, addDoc } from './firebase-config.js';
import { currentUser } from './state.js';

/**
 * addLog — Registra ação no histórico do sistema (coleção 'logs')
 * @param {string} userEmail - Email do usuário (ou msg direta)
 * @param {string} action - Descrição da ação
 * @param {string} [characterName] - Nome do personagem afetado
 * @param {string} [section] - Seção do sistema (characters, npcs, etc)
 */
export async function addLog(userEmail, action, characterName = '', section = 'geral') {
    try {
        // Suporte legado: se chamado com apenas 1 argumento, trata como action
        if (!action && userEmail) {
            action = userEmail;
            userEmail = currentUser?.email || 'Mestre';
        }

        await addDoc(collection(db, 'logs'), {
            user: userEmail || currentUser?.email || 'Sistema',
            action: action,
            character: characterName,
            section: section,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Erro ao registrar log:', error);
    }
}
window.addLog = addLog;
