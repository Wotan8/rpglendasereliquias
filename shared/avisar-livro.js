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

   QUEM RECEBE
   A publicação do livro (shared/livros-pub.js) decide:

     geral / conhGeral  → todo jogador: o livro está na estante de todos
     mestre (só)        → só quem é mestre
     conhVinculo (só)   → quem tem raça/classe/tribo/peculiaridade apontando
                          para o livro

   O ÚLTIMO CASO ERA UM BURACO, e deixou de ser. A conta do vínculo morava
   dentro da ficha e lia o DOM dela, então de fora ninguém sabia responder
   quem alcança o quê — o aviso avisava só os mestres e dizia que não sabia
   dos jogadores. Agora a conta é pura (shared/alcance-livros.js) e cada
   ficha grava um ESPELHO (`livrosAlcance`) no save que já fazia.

   O espelho tem um estado que não é "sim" nem "não": AUSENTE. Ficha que não
   foi salva desde que o espelho passou a existir não tem o campo, e contar
   isso como "não alcança" deixaria o jogador de fora do aviso justamente
   por não ter aberto a ficha. Então `alvos()` separa três grupos: quem
   alcança, quem não alcança, e quem não dá para saber — e só o terceiro
   torna a resposta inexata.
   ===================================================================== */

import { pubDoLivro, versaoDoLivro } from './livros-pub.js';
import { alcanceGravado } from './alcance-livros.js';

/** Papéis que contam como mestre no site (mesma leitura das rules). */
const EH_MESTRE = (u) => ['mestre', 'criador'].includes(String(u?.role || ''));

/**
 * Divide a lista de usuários em quem recebe e por quê.
 *
 * `usuarios`    [{ id, role, … }] — de getDocs(collection(db,'users'))
 * `personagens` [{ ownerUid, livrosAlcance, … }] — de getDocs(collection(db,'char')).
 *               Opcional: sem ela, livro de vínculo volta ao comportamento
 *               antigo (mestres, e assumidamente inexato).
 */
export function alvos(livro, usuarios, personagens) {
    const p = pubDoLivro(livro);
    const todos = usuarios || [];
    if (p.geral || p.conhGeral) {
        return { ids: todos.map(u => u.id), motivo: 'todo mundo que entra no site vê este livro', ressalva: '', exato: true };
    }
    const mestres = todos.filter(EH_MESTRE).map(u => u.id);
    if (p.conhVinculo) return porVinculo(livro, mestres, personagens);
    if (p.mestre) return { ids: mestres, motivo: 'este livro é só do mestre', ressalva: '', exato: true };
    return { ids: [], motivo: 'este livro não está publicado em lugar nenhum — ninguém o vê ainda', ressalva: '', exato: true };
}

/**
 * Livro de vínculo: quem tem PERSONAGEM que alcança o livro, mais os
 * mestres (que enxergam tudo).
 *
 * O terceiro grupo é o que importa: dono de ficha SEM espelho não entra
 * como "não alcança" — entra como "não sei", e é ele que torna a resposta
 * inexata. Ele também entra na lista de avisados, porque errar avisando é
 * muito mais barato que errar calando.
 */
function porVinculo(livro, mestres, personagens) {
    if (!Array.isArray(personagens)) {
        return {
            ids: mestres,
            motivo: 'este livro só aparece para quem tem vínculo, e só os mestres são certeza',
            ressalva: 'a lista de personagens não veio, então daqui não dá para saber quais jogadores alcançam',
            exato: false,
        };
    }
    const alcancam = new Set(), semEspelho = new Set();
    for (const c of personagens) {
        const dono = c.ownerUid;
        if (!dono) continue;
        const espelho = alcanceGravado(c);
        if (espelho === null) semEspelho.add(dono);
        else if (espelho.includes(livro.id)) alcancam.add(dono);
    }
    // O mestre enxerga o livro de qualquer jeito.
    mestres.forEach(m => alcancam.add(m));
    semEspelho.forEach(u => { if (!alcancam.has(u)) alcancam.add(u); });

    const n = semEspelho.size;
    return {
        ids: [...alcancam],
        motivo: 'quem tem personagem vinculado a este livro, mais os mestres',
        /* Separado do motivo de propósito: o motivo diz QUEM, a ressalva diz
           por que a conta não fecha. Juntos numa frase só, a tela repetia o
           mesmo texto duas vezes. */
        ressalva: n
            ? `${n} ${n > 1 ? 'pessoas entram' : 'pessoa entra'} por precaução: a ficha ${n > 1 ? 'delas' : 'dela'} `
                + 'não é salva desde a última atualização, e ficha não salva não diz o que alcança'
            : '',
        exato: n === 0,
    };
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
