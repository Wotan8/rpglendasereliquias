// =============================================
// AUDITORIA — o nível declarado em condicoesAplicadas chega à mesa?
// ---------------------------------------------
// Falha silenciosa: `empilharCondicao` (tabuleiro/js/tab-combat.js) só honra
// `nivel` quando a CONDIÇÃO tem `acumulaNiveis: true`, e ainda corta por
// `nivelMaximo`. Sem a flag, "Célere 5" entra em 1 — a habilidade entrega uma
// fração do que a Régua cobrou, e nada na tela avisa.
//
// Já pegou dois: Célere 5 (Passos Sombrios) e Fortalecido 2 (COMPOSIÇÃO DE
// BATALHA, do Bardo), os dois entrando em 1.
//
// SÓ LEITURA. Rodar: node functions/audit-condicao-nivel.mjs
// Sai com código 1 se achar divergência, para poder entrar em pipeline.
// =============================================
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const D = db.collection('system').doc('data');

const conds = {};
for (const doc of (await D.collection('conditions').get()).docs) conds[doc.data().nome] = doc.data();

let furos = 0, checadas = 0;
for (const doc of (await D.collection('classModules').get()).docs) {
    if (doc.data().publicado === false) continue;   // módulo aposentado não vai à mesa
    for (const p of (doc.data().itensPredefinidos || [])) {
        for (const c of (p.condicoesAplicadas || [])) {
            if (c.nivel == null) continue;
            checadas++;
            const def = conds[c.condicao];
            if (!def) { furos++; console.log(`!! ${doc.id}::${p.nome} → condição "${c.condicao}" não existe no cadastro`); continue; }
            const efetivo = def.acumulaNiveis !== true ? 1
                : (def.nivelMaximo != null ? Math.min(c.nivel, def.nivelMaximo) : c.nivel);
            if (efetivo === c.nivel) continue;
            furos++;
            console.log(`!! ${doc.id}::${p.nome} → ${c.condicao} ${c.nivel} entra em ${efetivo} `
                + `(acumulaNiveis=${def.acumulaNiveis === true}, nivelMaximo=${def.nivelMaximo ?? '—'})`);
        }
    }
}
console.log(furos
    ? `\n❌ ${furos} de ${checadas} níveis não chegam à mesa.`
    : `✅ os ${checadas} níveis declarados chegam à mesa inteiros.`);
process.exit(furos ? 1 : 0);
