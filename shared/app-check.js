// =============================================
// APP CHECK — o site provando que é o site
//
// Sem isto, qualquer pessoa com um login válido chama as Cloud Functions e o
// Firestore direto por `curl`, de fora do navegador — e o cadastro é aberto,
// então conseguir um login é de graça. O App Check faz o Firebase exigir um
// token que só a página de verdade, rodando no domínio de verdade, obtém.
//
// ORDEM DE ADOÇÃO (inverter derruba o site inteiro):
//   1. o cliente passa a MANDAR token  ← é o que este arquivo faz
//   2. alguns dias em monitoramento, olhando o painel do App Check
//   3. só então ligar a exigência, serviço por serviço
// Enquanto o passo 3 não acontece, token ausente ou inválido não bloqueia
// nada: serve para o painel mostrar quem já está mandando.
//
// É o provedor **Enterprise**, e não o v3: o Google descontinuou o reCAPTCHA
// clássico para App Check em 2026 — o painel do Firebase até desenha o
// formulário do v3, mas com os campos desabilitados.
//
// A chave do site é PÚBLICA: ela vive no HTML de qualquer jeito, como a v3 do
// checkout. O que não pode vazar é o segredo, e Enterprise nem tem segredo do
// lado do cliente.
// =============================================

import { initializeAppCheck, ReCaptchaEnterpriseProvider }
    from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app-check.js';

const CHAVE_DO_SITE = '6LciZKUtAAAAAMFaj_fnQA9NUQwZLTeDYEExTJXd';

let ligado = false;

/**
 * Liga o App Check no app do Firebase. Idempotente: várias páginas importam
 * este módulo e algumas inicializam o Firebase mais de uma vez na mesma tela —
 * a segunda chamada não faz nada.
 *
 * Nunca deixa exceção escapar. Uma falha aqui (rede, script do Google
 * bloqueado, extensão do navegador) não pode impedir a página de carregar:
 * enquanto a exigência não estiver ligada, o Firebase funciona sem token.
 */
export function ligarAppCheck(app) {
    if (ligado || !app) return;
    try {
        initializeAppCheck(app, {
            provider: new ReCaptchaEnterpriseProvider(CHAVE_DO_SITE),
            isTokenAutoRefreshEnabled: true,
        });
        ligado = true;
    } catch (e) {
        console.warn('App Check não iniciou:', e?.message || e);
    }
}
