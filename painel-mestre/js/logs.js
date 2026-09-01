// =============================================
// PAINEL DO MESTRE — Logs / Audit Trail
// =============================================

import { db, collection, addDoc } from './firebase-config.js';
import { currentUser, currentMesaId } from './state.js';

// Mapeia seções legadas para categorias exibidas nos filtros
const SECTION_TO_CATEGORY = {
    characters: 'Personagens',
    npcs: 'NPCs',
    items: 'Itens & Loja',
    apoios: 'Apoios',
    notifications: 'Notificações',
    mesa: 'Mesa',
    geral: 'Geral'
};

/**
 * addLog — Registra ação no histórico do sistema (coleção 'logs')
 * @param {string} userEmail - Email do usuário (ou msg direta)
 * @param {string} action - Descrição da ação
 * @param {string} [characterName] - Nome do personagem afetado
 * @param {string} [section] - Seção do sistema (characters, npcs, etc)
 * @param {object} [options] - Metadados extras:
 *   { charId, mesaId, category, changes: [{label, from, to}] }
 */
export async function addLog(userEmail, action, characterName = '', section = 'geral', options = {}) {
    try {
        // Suporte legado: se chamado com apenas 1 argumento, trata como action
        if (!action && userEmail) {
            action = userEmail;
            userEmail = currentUser?.email || 'Mestre';
        }

        await addDoc(collection(db, 'logs'), {
            /* O autor é sempre a conta logada, nunca o parâmetro. As rules
               exigem que `user` seja o e-mail do token — trilha que aceita
               autor forjado não serve de trilha. O parâmetro continua existindo
               para as chamadas antigas, mas só decide o `userName` exibido. */
            user: currentUser?.email || userEmail || 'Sistema',
            userName: currentUser?.displayName || userEmail || 'Mestre',
            action: action,
            character: characterName,
            section: section,
            category: options.category || SECTION_TO_CATEGORY[section] || 'Geral',
            charId: options.charId || null,
            mesaId: options.mesaId !== undefined ? options.mesaId : (currentMesaId || null),
            changes: Array.isArray(options.changes) ? options.changes : [],
            origin: 'painel-mestre',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Erro ao registrar log:', error);
    }
}
window.addLog = addLog;
