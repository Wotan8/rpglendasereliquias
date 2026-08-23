/**
 * AUDITORIA — o nível prometido no TEXTO chega à mesa?
 *
 * Irmã da audit-condicao-nivel.mjs, e mais funda: aquela só enxerga o nível
 * declarado em `condicoesAplicadas`. Esta lê o nível escrito na prosa
 * ("fica Blindado 8 por 1 cena") e compara com o que a condição permite.
 *
 * Dois modos de falha, os dois silenciosos:
 *   · condição sem `acumulaNiveis` ignora o nível e entra em 1;
 *   · `nivelMaximo` corta por cima — "Blindado 8" vira Blindado 3.
 *
 * Isso não é só cosmético: o carimbo `regua` foi calculado sobre o número da
 * prosa, então a habilidade está precificada por um efeito que ela não entrega.
 *
 * SÓ LEITURA. Sai com 1 se achar divergência.
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const D = db.collection('system').doc('data');

const conds = {};
for (const doc of (await D.collection('conditions').get()).docs) conds[doc.data().nome] = doc.data();
const nomes = Object.keys(conds).sort((a, b) => b.length - a.length);

const classeDe = {};
for (const doc of (await D.collection('classes').get()).docs)
    for (const m of (doc.data().modulosDaClasse || [])) classeDe[m] = doc.data().nome;

let furos = 0, ok = 0;
const porClasse = {};
for (const doc of (await D.collection('classModules').get()).docs) {
    const m = doc.data();
    if (m.publicado === false) continue;
    for (const p of (m.itensPredefinidos || [])) {
        const texto = [p.descricao, ...Object.values(p.valores || {})].filter(v => typeof v === 'string').join(' ');
        for (const nome of nomes) {
            // "Blindado 8", "Abalado 4", "Provocado 3" — nível colado no nome
            const re = new RegExp(`\\b${nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+(\\d+)\\b`, 'gi');
            for (const mt of texto.matchAll(re)) {
                const pedido = Number(mt[1]);
                if (!(pedido > 1)) continue;
                const def = conds[nome];
                const entra = def?.acumulaNiveis !== true ? 1
                    : (def.nivelMaximo != null ? Math.min(pedido, def.nivelMaximo) : pedido);
                if (entra === pedido) { ok++; continue; }
                furos++;
                const cls = classeDe[doc.id] || '?';
                (porClasse[cls] = porClasse[cls] || []).push(
                    `${p.nome}: prosa diz "${nome} ${pedido}", chega ${entra}`
                    + ` (${def?.acumulaNiveis === true ? `teto ${def.nivelMaximo}` : 'não acumula níveis'})`
                    + `${p.regua?.razao != null ? ` — carimbo ${p.regua.razao}x` : ''}`);
                break;
            }
        }
    }
}
for (const [cls, arr] of Object.entries(porClasse)) {
    console.log(`\n${cls}`);
    arr.forEach(x => console.log(`  ! ${x}`));
}
console.log(furos ? `\n${furos} niveis prometidos que nao chegam a mesa (${ok} chegam inteiros).`
                  : `\nTodos os ${ok} niveis escritos na prosa chegam a mesa.`);
process.exit(furos ? 1 : 0);
