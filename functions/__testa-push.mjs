/**
 * Manda UM push de teste para os aparelhos de um usuário — e não escreve
 * nada no Firestore.
 *
 * O gatilho de verdade (`avisarPush`) dispara quando uma notificação nova
 * entra em `users/{uid}.notifications`. Testar por ali sujaria a lista do
 * jogador com um aviso falso que ele teria de apagar depois. Aqui o envio
 * é direto ao FCM: prova a corrente inteira (chave VAPID → token do
 * aparelho → FCM → o handler `push` do sw.js) sem tocar no dado dele.
 *
 *   node functions/__testa-push.mjs igorestevamalvesdesouza@gmail.com
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({
    credential: admin.credential.cert(
        require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')),
});
const db = admin.firestore();

const alvo = process.argv[2];
if (!alvo) {
    console.error('uso: node functions/__testa-push.mjs <email ou uid>');
    process.exit(1);
}

const porEmail = await db.collection('users').where('email', '==', alvo).limit(1).get();
const snap = porEmail.empty ? await db.collection('users').doc(alvo).get() : porEmail.docs[0];
if (!snap.exists) {
    console.error('usuário não encontrado:', alvo);
    process.exit(1);
}

const tokens = (snap.data().fcmTokens || []).filter(t => typeof t === 'string' && t);
console.log(`${snap.id} — ${tokens.length} aparelho(s) registrado(s)`);
if (!tokens.length) {
    console.error('Nenhum aparelho. Entre no Portal → aba Notificações → "🔕 Receber avisos neste aparelho".');
    process.exit(1);
}

const r = await admin.messaging().sendEachForMulticast({
    tokens,
    notification: { title: 'Lendas e Relíquias', body: '🔔 Teste de push — se você está lendo isto, funciona.' },
    data: { url: '/index.html', tag: 'teste' },
    webpush: { fcmOptions: { link: '/index.html' } },
});

r.responses.forEach((res, i) => {
    const fim = '…' + tokens[i].slice(-12);
    console.log(res.success ? `  ✅ ${fim}` : `  ❌ ${fim} — ${res.error?.code}: ${res.error?.message}`);
});
console.log(`${r.successCount} entregue(s), ${r.failureCount} falha(s)`);
process.exit(0);
