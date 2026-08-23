/**
 * Reação → Defesa: o VD raiz das 8 Defesas passa a seguir o padrão de Acerto e Dano.
 *
 *   Acerto  → Acerto Corpo a Corpo, Acerto à Distância, ...
 *   Dano    → Dano Eólico, Dano Aquático, ...
 *   Reação  → Defesa: Esquiva, Defesa: Aparar, ...   ← único fora do padrão
 *
 * Resolução de ref é EXATA sobre a chave normalizada (tab-state.js valorComponente),
 * e DEFESA ≠ DEFESAESQUIVA. Não há colisão com os tipados.
 *
 * NÃO toca em "Reação" que não é o VD: reação química (Régua §8 Alquimancia,
 * Fluxomancia), "reação humana ao som" (Sonoromancia), "Reação por Dose" (Aspectus).
 *
 * NÃO toca nos textos pré-combate-v3 (cap. 3, cap. 4, 6 condições, Régua §0.2 e §7),
 * que descrevem a Reação com fórmula própria ou como ação reativa — os dois conceitos
 * que o v3 removeu. Renomear ali só trocaria o nome de um texto errado.
 *
 *   node functions/migrar-reacao-para-defesa.mjs            (dry-run)
 *   node functions/migrar-reacao-para-defesa.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const D = db.collection('system').doc('data');
const APPLY = process.argv.includes('--apply');
const plano = [];

/* ── 1) o VD raiz ── */
const VD_ID = 'zOnIyHOUHCCTDUrOyYgr';
const vd = (await D.collection('derivedValues').doc(VD_ID).get()).data();
if (vd.nome !== 'Reação') throw new Error(`VD já renomeado ou id errado: ${vd.nome}`);
const DESC_NOVA = 'Modificador GENÉRICO de defesa, que vale para todas as oito Defesas — mesmo papel '
    + 'que o "Acerto" tem para os Acertos tipados e o "Dano" para os Danos por Essência. '
    + 'A BASE aqui é 0: não tem fórmula própria e só muda por peculiaridade, condição, postura ou magia. '
    + 'Cada Defesa tipada é "Defesa + Perícia de defesa − 1", então um "−1 na Defesa" desce para as oito '
    + 'de uma vez. Quem rola é sempre o atacante.';
plano.push({ o: `derivedValues/${VD_ID}`, q: 'nome "Reação" → "Defesa" + descrição',
    f: () => D.collection('derivedValues').doc(VD_ID).update({ nome: 'Defesa', descricao: DESC_NOVA,
        atualizadoEm: admin.firestore.FieldValue.serverTimestamp() }) });

/* ── 2) as 8 fórmulas, que citam por ref de NOME ── */
for (const doc of (await D.collection('mechanics').get()).docs) {
    const d = doc.data();
    if (!/^Defesa: .+\(fórmula\)$/.test(d.nome || '')) continue;
    const j = JSON.stringify(d.config);
    if (!j.includes('"ref":"Reação"')) continue;
    const cfg = JSON.parse(j.replaceAll('"ref":"Reação"', '"ref":"Defesa"'));
    plano.push({ o: `mechanics/${doc.id}`, q: `${d.nome}: ref Reação → Defesa`,
        f: () => doc.ref.update({ config: cfg,
            previewTexto: String(d.previewTexto || '').replaceAll('[Reação]', '[Defesa]') }) });
}

/* ── 3) os capítulos onde o texto JÁ está em v3 ── */
const ART = {
    'art-regras-jogador-01': [['ex.: Reação, Carga', 'ex.: Defesa, Carga']],
    'art-regras-jogador-06': [
        ['Defesa = Reação + Perícia de defesa − 1', 'Defesa: &lt;perícia&gt; = Defesa + Perícia de defesa − 1'],
        ['A <strong>Reação</strong> não tem mais fórmula própria',
         'A <strong>Defesa</strong> sozinha é o modificador genérico e não tem fórmula própria'],
        ['um "−1 na Reação" desça', 'um "−1 na Defesa" desça'],
    ],
    'art-regras-jogador-09': [
        ['Percepção, Reação, Iniciativa', 'Percepção, Defesa, Iniciativa'],
        ['sua Reação e as perícias de defesa', 'sua Defesa e as perícias de defesa'],
    ],
};
for (const [id, pares] of Object.entries(ART)) {
    const ref = db.collection('worldbuilding-articles').doc(id);
    const a = (await ref.get()).data();
    let h = a.contentHTML;
    const feitos = [];
    for (const [de, para] of pares) {
        if (!h.includes(de)) { console.log(`  ⚠ âncora não encontrada em ${id}: "${de.slice(0,50)}"`); continue; }
        h = h.replaceAll(de, para); feitos.push(de.slice(0, 40));
    }
    if (feitos.length) plano.push({ o: `artigo ${id}`, q: `${feitos.length} trecho(s): ${feitos.join(' · ')}`,
        f: () => ref.update({ contentHTML: h, updatedAt: Date.now() }) });
}

console.log(`\n${plano.length} mudanças${APPLY ? '' : ' (DRY-RUN)'}:\n`);
for (const p of plano) console.log(`  ${p.o}\n      ${p.q}`);
if (APPLY) { for (const p of plano) await p.f(); console.log('\n✅ aplicado'); }
else console.log('\nRode com --apply para gravar.');
process.exit(0);
