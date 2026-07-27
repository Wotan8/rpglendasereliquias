// =============================================
// PAINEL DO MESTRE — Notificações do jogador
// Formato ÚNICO lido pelo menu (menu/js/menu-firebase.js).
// Antes cada tela montava o objeto na mão e os formatos divergiram:
// o menu lê `timestamp`, `isNew`, `type` e `data.highlight`, mas o painel
// gravava `date`, `read` e `highlight` na raiz — resultado: "Invalid Date",
// badge sem contar, ícone errado e botão de excluir inerte.
// =============================================
import { db, doc, writeBatch, arrayUnion } from './firebase-config.js';
import * as S from './state.js';

// Tipos entendidos pelo menu: 'master_message' | 'inventory_item_received' | 'exp_received'
export function buildNotification({ type = 'master_message', message, highlight = 'normal', data = {} }) {
    return {
        id: 'notif_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11),
        type,
        message,
        timestamp: Date.now(),
        isNew: true,
        data: { ...data, highlight, sentBy: S.currentUser?.email || 'Mestre' }
    };
}

/**
 * Envia a MESMA notificação para vários jogadores num único writeBatch.
 * Usa arrayUnion: nada é lido antes, então não existe corrida entre dois
 * mestres (nem com a Cloud Function) sobrescrevendo o array um do outro.
 * O menu ordena por `timestamp`, então acrescentar no fim não muda a ordem exibida.
 * @returns {Promise<number>} quantidade de jogadores notificados
 */
export async function notifyUsers(uids, payload) {
    const alvos = [...new Set((uids || []).filter(Boolean))];
    if (!alvos.length) return 0;

    // ponytail: 500 é o teto de operações por batch do Firestore; fatiar se a mesa crescer
    const batch = writeBatch(db);
    alvos.forEach(uid => {
        batch.update(doc(db, 'users', uid), {
            notifications: arrayUnion(buildNotification(payload))
        });
    });
    await batch.commit();
    return alvos.length;
}
