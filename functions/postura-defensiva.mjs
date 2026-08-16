/**
 * 🛡️ Postura Defensiva: sai o Abalado, entra a quebra por Ação Padrão.
 *
 * Como estava: "Você fica Blindado 5 e Abalado 2 até trocar de postura" — quem
 * se defende ficava com −2 no Alvo de TODOS os testes. Na mesa isso não se
 * sustenta: postura defensiva é abrir mão de atacar, não ficar ruim de tudo.
 *
 * Como fica: a postura dá a Blindagem e nada mais. Em troca, ela ARREBENTA na
 * primeira Ação Padrão — quem parte para cima larga a guarda. Quem marca isso
 * é `saiComAcaoPadrao` na condição aplicada, que o Painel do Turno lê.
 *
 *   node functions/postura-defensiva.mjs            (dry-run)
 *   node functions/postura-defensiva.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');

const TEXTO = 'Ação Livre. Você fica Blindado 5 até trocar de postura. '
    + 'Usar qualquer Ação Padrão larga a guarda: a postura e a Blindagem caem na hora.';

const snap = await db.collection('system/data/classModules').get();
const lote = db.batch();
let n = 0;
console.log('='.repeat(66));
console.log('Postura Defensiva' + (APPLY ? ' — GRAVANDO' : ' — DRY-RUN'));
console.log('='.repeat(66));

for (const d of snap.docs) {
    const m = d.data();
    const itens = (m.itensPredefinidos || []).map(pd => ({ ...pd }));
    let mexeu = false;
    for (const pd of itens) {
        if (!/postura defensiva/i.test(pd.nome || '')) continue;
        const antes = (pd.condicoesAplicadas || []).map(c => c.condicao).join(', ');
        // 1) fora o Abalado; 2) o Blindado passa a cair com Ação Padrão
        const novas = (pd.condicoesAplicadas || [])
            .filter(c => !/abalado/i.test(c.condicao || ''))
            .map(c => ({ ...c, saiComAcaoPadrao: true }));
        pd.condicoesAplicadas = novas;
        pd.descricao = TEXTO;
        if (pd.valores && pd.valores['5']) pd.valores = { ...pd.valores, 5: TEXTO };
        console.log(`  [${m.titulo}] ${pd.nome}`);
        console.log(`     condições: ${antes}  →  ${novas.map(c => c.condicao + ' (sai com Ação Padrão)').join(', ')}`);
        mexeu = true;
    }
    if (mexeu) { lote.update(d.ref, { itensPredefinidos: itens }); n++; }
}

console.log(`\n${n} módulo(s) a atualizar.`);
if (!APPLY) { console.log('DRY-RUN. Rode com --apply para gravar.'); process.exit(0); }
if (n) await lote.commit();
console.log('✅ gravado.');
process.exit(0);
