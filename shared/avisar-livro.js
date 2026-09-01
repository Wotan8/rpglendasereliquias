/* =====================================================================
   🔔 AVISO DE VERSÃO DE LIVRO — quem tem acesso descobre que mudou
   ---------------------------------------------------------------------
   Livro que muda em silêncio é o jogador citando a regra da semana passada
   no meio da sessão. Quando a versão sobe, quem enxerga o livro recebe um
   aviso.

   POR QUE `users.notifications` E NÃO UM CANAL NOVO
   O sino do Portal já escuta o doc do usuário por `onSnapshot`
   (menu/js/menu-firebase.js): a badge acende, a lista preenche e a
   notificação que chega com a página aberta ainda vira toast. Nada disso
   precisa de rede própria, de permissão do navegador nem de service
   worker — então funciona igual no navegador e no PWA instalado, hoje,
   sem depender do push (que vem depois). Um canal novo seria construir de
   novo o que já está de pé, e com um caminho a menos de funcionar dentro
   do app instalado.

   QUEM RECEBE — e o buraco honesto
   A publicação do livro (shared/livros-pub.js) decide:

     geral / conhGeral  → todo jogador: o livro está na estante de todos
     mestre (só)        → só quem é mestre
     conhVinculo (só)   → quem tem raça/classe/tribo/peculiaridade apontando
                          para o livro… e ISSO NÃO DÁ PARA SABER DAQUI.

   O vínculo é calculado dentro da ficha, lendo o personagem aberto
   (`_livrosDoPersonagem` em conhecimento.js, que lê o DOM da ficha).
   Descobrir de fora exigiria abrir todos os personagens de todos os
   jogadores a cada aviso. Então livro só-de-vínculo avisa os mestres, e
   `alvos()` devolve isso explicado — a tela mostra a frase e oferece
   "avisar todo mundo mesmo assim". Preferimos um buraco declarado a um
   número que parece exato e não é.
   ===================================================================== */

import { pubDoLivro, versaoDoLivro } from './livros-pub.js';

/** Papéis que contam como mestre no site (mesma leitura das rules). */
const EH_MESTRE = (u) => ['mestre', 'criador'].includes(String(u?.role || ''));

/**
 * Divide a lista de usuários em quem recebe e por quê.
 * `usuarios`: [{ id, role, ... }] — como vem de getDocs(collection(db,'users')).
 */
export function alvos(livro, usuarios) {
    const p = pubDoLivro(livro);
    const todos = usuarios || [];
    if (p.geral || p.conhGeral) {
        return { ids: todos.map(u => u.id), motivo: 'todo mundo que entra no site vê este livro', exato: true };
    }
    const mestres = todos.filter(EH_MESTRE).map(u => u.id);
    if (p.conhVinculo) {
        return {
            ids: mestres,
            motivo: 'este livro só aparece para quem tem vínculo, e o vínculo mora na ficha de cada personagem — '
                + 'daqui dá para avisar os mestres com certeza, os jogadores não',
            exato: false,
        };
    }
    if (p.mestre) return { ids: mestres, motivo: 'este livro é só do mestre', exato: true };
    return { ids: [], motivo: 'este livro não está publicado em lugar nenhum — ninguém o vê ainda', exato: true };
}

/** A entrada, no formato que `normalizeNotification` do Portal já entende. */
export function avisoDeVersao(livro, versaoAntes) {
    const nova = versaoDoLivro(livro) || '?';
    const antes = String(versaoAntes || '').trim();
    return {
        id: 'livro_' + livro.id + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9),
        type: 'livro_versao',
        message: `📖 "${livro.title || 'Livro sem título'}" ${antes ? `saiu da ${antes} para a ${nova}` : `está na ${nova}`}. `
            + 'Vale reler o que mudou antes da próxima sessão.',
        timestamp: Date.now(),
        isNew: true,
        data: { highlight: 'importante', bookId: livro.id },
    };
}

/**
 * Grava o aviso no doc de cada alvo. `deps` traz o Firestore de quem chama
 * (o Escritório importa de worldbuilding/js/firebase-config.js, e este
 * arquivo é lido por telas que carregam o SDK de jeitos diferentes).
 *
 * Devolve { enviados, falhas }. Uma falha NÃO derruba as outras: avisar
 * sete de oito jogadores é melhor do que avisar nenhum porque o doc de um
 * deles está estranho.
 */
export async function enviarAviso({ db, doc, getDoc, updateDoc }, ids, aviso, MAX = 100) {
    let enviados = 0; const falhas = [];
    for (const uid of ids) {
        try {
            const ref = doc(db, 'users', uid);
            const snap = await getDoc(ref);
            if (!snap.exists()) { falhas.push(uid); continue; }
            const lista = [aviso, ...(snap.data().notifications || [])];
            if (lista.length > MAX) lista.length = MAX;
            await updateDoc(ref, { notifications: lista });
            enviados++;
        } catch (e) {
            console.warn('[aviso-livro]', uid, e);
            falhas.push(uid);
        }
    }
    return { enviados, falhas };
}
