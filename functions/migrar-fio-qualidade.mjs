/**
 * Passo 1 da migração v2: Grau e Fio viram QUALIDADE (um número só, 0–5).
 *
 *   campo  `fio`         → `qualidade`      (mesmo valor; o antigo é apagado)
 *   ref    'Item: Fio'   → 'Item: Qualidade' nas Equações de Valor dos vínculos
 *
 * O motor aceita os dois nomes durante a transição (alias em _ME_ITEM_PROPS),
 * então este script pode rodar antes ou depois do deploy sem quebrar ficha.
 * Instâncias antigas dentro de fichas de personagem NÃO são varridas — é para
 * elas que o alias continua existindo.
 *
 *   node functions/migrar-fio-qualidade.mjs            (dry-run)
 *   node functions/migrar-fio-qualidade.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

// A frota inteira de armas com equação de Dano usa 'Item: Fio' exatamente 1 vez.
const REFS_ESPERADAS = 58;

const col = db.collection('system/data/equipment');
const docs = (await col.get()).docs;

let comCampo = 0, refs = 0, conflitos = 0;
const mudancas = [];

for (const d of docs) {
    const e = d.data();
    const patch = {};
    let motivos = [];

    if (e.fio !== undefined) {
        if (e.qualidade !== undefined && e.qualidade !== e.fio) {
            console.error(`🔴 CONFLITO · ${e.nome}: fio=${e.fio} e qualidade=${e.qualidade} divergem`);
            conflitos++;
            continue;
        }
        comCampo++;
        patch.qualidade = e.fio;
        patch.fio = admin.firestore.FieldValue.delete();
        motivos.push(`campo fio=${JSON.stringify(e.fio)}`);
    }

    if (Array.isArray(e.valoresDerivadosVinculados)) {
        let nRefs = 0;
        const novo = e.valoresDerivadosVinculados.map(v => {
            if (!Array.isArray(v.equacao)) return v;
            let tocado = false;
            const eq = v.equacao.map(t => {
                if (t && t.ref === 'Item: Fio') { nRefs++; tocado = true; return { ...t, ref: 'Item: Qualidade' }; }
                return t;
            });
            return tocado ? { ...v, equacao: eq } : v;
        });
        if (nRefs) {
            patch.valoresDerivadosVinculados = novo;
            refs += nRefs;
            motivos.push(`${nRefs} ref(s) 'Item: Fio'`);
        }
    }

    if (motivos.length) mudancas.push({ ref: d.ref, patch, nome: e.nome, motivos });
}

console.log(`\n=== migrar fio → qualidade · ${docs.length} itens no catálogo ===\n`);
for (const m of mudancas) console.log(`  ${m.nome.padEnd(30)} ${m.motivos.join(' · ')}`);
console.log(`\nitens com campo fio : ${comCampo}`);
console.log(`refs 'Item: Fio'    : ${refs}   (esperado: ${REFS_ESPERADAS})`);
console.log(`itens a gravar      : ${mudancas.length}`);

if (conflitos) { console.error(`\n🔴 ABORTADO — ${conflitos} conflito(s) fio × qualidade.`); process.exit(1); }
if (refs !== REFS_ESPERADAS) {
    console.error(`\n🔴 ABORTADO — contagem de refs (${refs}) não bate com o esperado (${REFS_ESPERADAS}). Confira antes de aplicar.`);
    process.exit(1);
}
if (!APLICAR) { console.log('\n(dry-run — nada gravado. Use --apply.)'); process.exit(0); }

let lote = db.batch(), pendentes = 0, gravados = 0;
for (const m of mudancas) {
    lote.update(m.ref, m.patch);
    if (++pendentes === 400) { await lote.commit(); gravados += pendentes; lote = db.batch(); pendentes = 0; }
}
if (pendentes) { await lote.commit(); gravados += pendentes; }
console.log(`\n✅ ${gravados} itens gravados.`);
process.exit(0);
