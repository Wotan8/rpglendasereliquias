/**
 * "SEGURAR" NUMA PARTE QUE NÃO SEGURA
 *
 * Um item só oferece um estado de equipar se a PARTE tiver a capacidade
 * correspondente (ficha-v1.7_1/js/inventory.js, _getAvailableStates):
 * segurar→podeSegurar, empunhar→podeEmpunhar, vestir→podeVestir, fixar→podeFixar.
 *
 * Quando o cadastro diz `formaEquipar: 'segurar'` e a única parte listada em
 * `equipavelEm` não tem `podeSegurar`, a lista de estados sai vazia — o modal
 * de equipar abre mudo e o Confirmar nunca habilita. Foi o que aconteceu com o
 * Kit de Primeiros Socorros na Cintura: só Mão segura, e um kit no cinto está
 * FIXADO, não segurado.
 *
 * Este script varre o catálogo e as instâncias procurando essa combinação
 * impossível, e troca a forma para a que a parte realmente aceita.
 *
 *   node functions/corrigir-forma-equipar.mjs            # dry-run
 *   node functions/corrigir-forma-equipar.mjs --apply    # grava
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');

const CAPACIDADE = { segurar: 'podeSegurar', empunhar: 'podeEmpunhar', vestir: 'podeVestir', fixar: 'podeFixar' };
// Ordem de preferência ao trocar: o que mais se parece com o que estava lá.
// "Segurar" e "fixar" são os dois modos que NÃO ligam efeito, então trocar
// segurar→fixar não muda nada mecanicamente — só destrava a janela.
const ALTERNATIVA = { segurar: ['fixar', 'vestir'], empunhar: ['vestir', 'fixar'], vestir: ['fixar'], fixar: ['vestir'] };

const partes = {};
(await db.collection('system/data/bodyParts').get()).forEach(d => { partes[d.id] = { id: d.id, ...d.data() }; });

/* Trocar a forma só é seguro entre os modos que NÃO ligam efeito — "Segurar" e
   "Fixar" são exatamente esses (ver itemFormasAtuais em inventory.js). Mexer em
   empunhar/vestir mudaria o que a peça FAZ, então esses só entram no relatório. */
const TROCA_SEGURA = new Set(['segurar', 'fixar']);

/**
 * A forma serve em TODAS as partes que o item lista? Parte listada que não
 * aceita a forma é letra morta: o slot aparece no modal e não oferece estado.
 * Devolve a forma que cobriria todas, quando existir.
 */
function diagnosticar(forma, equipavelEm) {
    if (!forma || !CAPACIDADE[forma]) return null;
    const lista = (equipavelEm || []).map(id => partes[id]).filter(Boolean);
    if (!lista.length) return null;                     // sem restrição = qualquer parte serve
    const mortas = lista.filter(p => !p[CAPACIDADE[forma]]);
    if (!mortas.length) return null;                    // todas aceitam: está ok

    const nova = (ALTERNATIVA[forma] || []).find(f => lista.every(p => p[CAPACIDADE[f]]));
    return {
        de: forma,
        para: (nova && TROCA_SEGURA.has(forma) && TROCA_SEGURA.has(nova)) ? nova : null,
        sugestao: nova || null,
        mortas: mortas.map(p => p.nome).join(', '),
        partes: lista.map(p => p.nome).join(', '),
    };
}

let achados = 0, corrigidos = 0;

for (const col of ['system/data/equipment', 'items']) {
    const snap = await db.collection(col).get();
    for (const d of snap.docs) {
        const x = d.data();
        const dg = diagnosticar(x.formaEquipar, x.equipavelEm);
        if (!dg) continue;
        achados++;
        const alvo = dg.para ? `→ ${dg.para}`
            : dg.sugestao ? `→ ${dg.sugestao} (MANUAL: mudaria o efeito da peça)`
            : '→ (nenhuma forma cobre todas as partes)';
        console.log(`  ${dg.para && APPLY ? '✍️ ' : '· '}[${col.split('/').pop()}] ${x.nome || d.id}: ${dg.de} ${alvo}`);
        console.log(`      partes: ${dg.partes}   ·   não aceitam "${dg.de}": ${dg.mortas}`);
        if (dg.para) {
            corrigidos++;
            if (APPLY) await d.ref.update({ formaEquipar: dg.para, lastModified: new Date().toISOString() });
        }
    }
}

console.log(`\n${achados} peça(s) com parte morta no cadastro · ${corrigidos} ${APPLY ? 'corrigidas' : 'corrigíveis em automático'}`);
if (!APPLY) console.log('Rode de novo com --apply para gravar.');
