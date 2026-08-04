/**
 * Passo 3b da migração v2: o min() do Domínio nas equações de Dano.
 *
 *   antes   Dano = FOR + Item: Qualidade + Item: Afiação
 *   depois  Dano = min(Item: Qualidade + Item: Afiação, Teto de Ofício) + FOR
 *
 * O resolveEquation é um fold sequencial, então a ordem dos termos faz a conta:
 *   [Qualidade, +Afiação, min Teto, +FOR]  →  min(Q+A, teto) + FOR
 * Besta preserva a potência no lugar do FOR. O teto de cada arma sai da própria
 * equação de Acerto já cadastrada (perícia + atributo), não de lista à mão:
 *
 *   Perícia: Disparo            → Teto de Ofício: Disparo
 *   Perícia: Arremessar         → Teto de Ofício: Precisão
 *   Perícia: Arma + DES         → Teto de Ofício: Precisão
 *   Perícia: Arma/Briga + FOR   → Teto de Ofício: Braço
 *
 *   node functions/armas-dominio-min.mjs            (dry-run)
 *   node functions/armas-dominio-min.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');
const ESPERADAS = 58;

const grab = async c => (await db.collection(`system/data/${c}`).get());
const [eqSnap, vdSnap] = await Promise.all([grab('equipment'), grab('derivedValues')]);
const vds = vdSnap.docs.map(d => ({ id: d.id, ...d.data() }));
const vdNome = id => (vds.find(v => v.id === id) || {}).nome || `?${id}`;

for (const t of ['Teto de Ofício: Braço', 'Teto de Ofício: Precisão', 'Teto de Ofício: Disparo'])
    if (!vds.some(v => v.nome === t)) { console.error(`🔴 VD "${t}" não existe — rode cadastrar-dominios.mjs primeiro.`); process.exit(1); }

const refsDe = eq => (eq || []).map(t => t.ref).filter(Boolean);

function tetoDaArma(vinc) {
    const acertos = vinc.filter(v => /^Acerto/.test(vdNome(v.id)) && Array.isArray(v.equacao));
    const refs = acertos.flatMap(v => refsDe(v.equacao));
    if (refs.includes('Perícia: Disparo')) return 'Teto de Ofício: Disparo';
    if (refs.includes('Perícia: Arremessar')) return 'Teto de Ofício: Precisão';
    if (refs.includes('DES')) return 'Teto de Ofício: Precisão';
    if (refs.includes('FOR')) return 'Teto de Ofício: Braço';
    return null;
}

let n = 0, porTeto = {};
const mudancas = [], erros = [];

for (const d of eqSnap.docs) {
    const e = d.data();
    const vinc = e.valoresDerivadosVinculados || [];
    const danoIdx = vinc.findIndex(v => vdNome(v.id) === 'Dano'
        && Array.isArray(v.equacao) && refsDe(v.equacao).includes('Item: Qualidade'));
    if (danoIdx < 0) continue;

    const eq = vinc[danoIdx].equacao;
    const [t0, t1, t2] = eq;
    const shapeOk = eq.length === 3
        && (t0.ref === 'FOR' || typeof t0.valor === 'number')
        && t1.op === '+' && t1.ref === 'Item: Qualidade'
        && t2.op === '+' && t2.ref === 'Item: Afiação';
    if (!shapeOk) { erros.push(`FORMA INESPERADA · ${e.nome}: ${JSON.stringify(eq)}`); continue; }

    const teto = tetoDaArma(vinc);
    if (!teto) { erros.push(`SEM TETO · ${e.nome}: equação de Acerto não diz a entrega`); continue; }

    const base = t0.ref === 'FOR'
        ? { op: '+', tipo: 'ficha', ref: 'FOR' }
        : { op: '+', valor: t0.valor };
    const nova = [
        { tipo: 'ficha', ref: 'Item: Qualidade' },
        { op: '+', tipo: 'ficha', ref: 'Item: Afiação' },
        { op: 'min', tipo: 'ficha', ref: teto },
        base
    ];
    const novoVinc = vinc.map((v, i) => i === danoIdx ? { ...v, equacao: nova } : v);
    n++;
    porTeto[teto] = (porTeto[teto] || 0) + 1;
    mudancas.push({ ref: d.ref, patch: { valoresDerivadosVinculados: novoVinc }, nome: e.nome, teto });
}

console.log(`\n=== min() do Domínio nas equações de Dano ===\n`);
for (const m of mudancas) console.log(`  ${m.nome.padEnd(30)} ${m.teto.replace('Teto de Ofício: ', '')}`);
console.log(`\narmas a gravar : ${n}   (esperado: ${ESPERADAS})`);
for (const [t, c] of Object.entries(porTeto)) console.log(`  ${t.replace('Teto de Ofício: ', '').padEnd(10)} ${c}`);
for (const er of erros) console.error(`  🔴 ${er}`);

if (erros.length || n !== ESPERADAS) { console.error(`\n🔴 ABORTADO — contagem/forma não bate.`); process.exit(1); }
if (!APLICAR) { console.log('\n(dry-run — nada gravado. Use --apply.)'); process.exit(0); }

let lote = db.batch();
for (const m of mudancas) lote.update(m.ref, m.patch);
await lote.commit();
console.log(`\n✅ ${n} armas gravadas.`);
process.exit(0);
