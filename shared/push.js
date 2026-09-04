/* =====================================================================
   🔔 PUSH — pedir a permissão e guardar o aparelho
   ---------------------------------------------------------------------
   As notificações já chegam em tempo real na página aberta (`onSnapshot`
   no doc do usuário, em menu-firebase.js). Isto é o passo além: o aviso
   que alcança o jogador com o site FECHADO.

   O DESENHO. O navegador entrega push por APARELHO, não por conta: o
   mesmo jogador no celular e no computador são dois tokens. Por isso
   `users.fcmTokens` é um ARRAY, e não um campo só — guardar um único
   token faria o login novo apagar o aviso do aparelho anterior, em
   silêncio.

   A LIMPEZA. Token morre: o usuário desinstala o app, limpa o site,
   troca de aparelho. Quem descobre isso é o servidor, no momento do
   envio — só ele recebe o `messaging/registration-token-not-registered`.
   Por isso a poda mora na function, e não aqui (ver `avisarPush` em
   functions/index.js).

   ⚠️ A CHAVE VAPID. É a credencial pública de Web Push do projeto, e
   nasce no Console do Firebase (Configurações do projeto → Cloud
   Messaging → Certificados push da Web → Gerar par de chaves). Ela é
   PÚBLICA — pode ficar aqui no código, como a apiKey. Sem ela nada
   quebra: `ativarPush` devolve o motivo e a tela continua igual.
   ===================================================================== */

/* O SDK do Messaging entra por `import()` la embaixo, e nao aqui em cima:
   sao ~40 kB que so servem a quem clica no botao. Toda visita ao Portal
   pagaria por eles se o import fosse estatico. */
import { doc, updateDoc, arrayUnion, arrayRemove }
    from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

/** Chave pública de Web Push do projeto. Vazia = push desligado no site. */
export const VAPID = 'BIbyxORGy9HvX9lfNQK8xo2tLng5-a1wa8svmQvZMBkEAm8PJDR1ZhIEFra0XUmZZUQotEU56FpW4aoTB0TCeBo';

/** Onde o token deste aparelho fica guardado, para não repetir o pedido. */
const CHAVE_LOCAL = 'lr_fcm_token';

/**
 * O que dá para fazer aqui e agora. Três estados, não dois: "não dá neste
 * navegador" é diferente de "dá, mas o usuário recusou" — e cada um pede
 * uma frase diferente na tela.
 *
 * Devolve 'sem-suporte' | 'sem-chave' | 'negado' | 'ligado' | 'desligado'.
 */
export async function estadoPush() {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return 'sem-suporte';
    if (!('PushManager' in window)) return 'sem-suporte';
    if (!VAPID) return 'sem-chave';
    if (Notification.permission === 'denied') return 'negado';
    if (Notification.permission === 'granted' && localStorage.getItem(CHAVE_LOCAL)) return 'ligado';
    return 'desligado';
}

/**
 * Pede a permissão e guarda o token deste aparelho no doc do usuário.
 *
 * `db` e `uid` vêm de quem chama — este módulo não sabe (nem precisa saber)
 * como o site inicializa o Firebase.
 *
 * Devolve `{ ok, motivo }`. Nunca lança: push é conveniência, e uma tela
 * que estoura por causa de uma conveniência é pior do que uma sem push.
 */
export async function ativarPush(app, db, uid) {
    const estado = await estadoPush();
    if (estado === 'sem-suporte') return { ok: false, motivo: 'Este navegador não entrega notificações.' };
    if (estado === 'sem-chave') return { ok: false, motivo: 'O push ainda não foi configurado no projeto.' };

    /* O pedido de permissão SÓ pode sair de um gesto do usuário. Chamar isto
       no carregamento faz o navegador negar de vez em alguns casos — e o
       "negado" do Chrome é definitivo até o usuário ir nas configurações. */
    const permissao = await Notification.requestPermission().catch(() => 'denied');
    if (permissao !== 'granted') return { ok: false, motivo: 'Permissão negada no navegador.' };

    try {
        /* Reaproveita o Service Worker do site em vez de registrar um
           `firebase-messaging-sw.js` à parte: dois workers no mesmo escopo
           brigam pelo controle da página, e o nosso já trata o evento
           `push` (ver sw.js). */
        const registro = await navigator.serviceWorker.ready;
        const { getMessaging, getToken, isSupported } =
            await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js');
        if (!(await isSupported().catch(() => false))) {
            return { ok: false, motivo: 'Este navegador não entrega notificações.' };
        }
        const token = await getToken(getMessaging(app), {
            vapidKey: VAPID,
            serviceWorkerRegistration: registro,
        });
        if (!token) return { ok: false, motivo: 'O navegador não devolveu um token.' };

        await updateDoc(doc(db, 'users', uid), { fcmTokens: arrayUnion(token) });
        localStorage.setItem(CHAVE_LOCAL, token);
        return { ok: true, motivo: 'Este aparelho vai receber os avisos.' };
    } catch (e) {
        /* O código do erro VAI para a tela. A primeira versão dizia só "não deu
           para registrar este aparelho", e isso não diz nada a ninguém: o
           `messaging/token-subscribe-failed` (o serviço de push recusou) e o
           `messaging/permission-blocked` pedem coisas opostas de quem lê. */
        console.warn('push indisponível:', e);
        const codigo = e?.code || e?.name || '';
        return {
            ok: false,
            motivo: 'Não deu para registrar este aparelho' + (codigo ? ` (${codigo})` : '') + '.',
            codigo,
        };
    }
}

/**
 * O que roda sozinho a cada login.
 *
 * O jogador aceitou UMA vez, no celular dele. Daí em diante todo login novo
 * (sessão expirada, outro dia, app reinstalado) precisa registrar o token de
 * novo — o token é do APARELHO, e some quando o site perde os dados locais.
 * Sem isto, ele aceitava uma vez e os avisos calavam sozinhos depois.
 *
 * Com permissão já concedida, NÃO há janela nenhuma: só pega o token e grava.
 * Sem permissão ainda, pergunta UMA vez por aparelho e nunca mais — site que
 * repete o pedido de notificação a cada visita é site que a pessoa bloqueia.
 */
const CHAVE_JA_PERGUNTOU = 'lr_push_perguntado';

export async function garantirPush(app, db, uid) {
    const estado = await estadoPush();
    if (estado === 'ligado') return { ok: true, motivo: 'já registrado' };
    if (estado !== 'desligado') return { ok: false, motivo: estado };

    // `desligado` cobre dois casos bem diferentes.
    if (Notification.permission !== 'granted') {
        if (localStorage.getItem(CHAVE_JA_PERGUNTOU)) return { ok: false, motivo: 'já perguntamos uma vez' };
        localStorage.setItem(CHAVE_JA_PERGUNTOU, '1');
    }
    return ativarPush(app, db, uid);
}

/**
 * Tira ESTE aparelho da lista. Não mexe na permissão do navegador — isso é
 * decisão que mora nas configurações dele, e desfazer pelo site deixaria o
 * usuário sem entender por que o botão não volta a funcionar.
 */
export async function desativarPush(db, uid) {
    const token = localStorage.getItem(CHAVE_LOCAL);
    localStorage.removeItem(CHAVE_LOCAL);
    if (!token) return { ok: true, motivo: 'Este aparelho já estava fora.' };
    try {
        await updateDoc(doc(db, 'users', uid), { fcmTokens: arrayRemove(token) });
        return { ok: true, motivo: 'Este aparelho não recebe mais avisos.' };
    } catch (e) {
        console.warn('não deu para remover o token:', e);
        return { ok: false, motivo: 'Não deu para remover este aparelho.' };
    }
}
