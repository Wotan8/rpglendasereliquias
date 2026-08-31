/**
 * Bestiário — consertos 03.
 *
 *  1. Duas peculiaridades evolutivas de criatura, Nv 1–10, custo ancorado no VIG
 *     (degrau i custa 5i — a mesma curva do atributo, total 275 no Nv10):
 *
 *       Carne Dura  +3 Vitalidade Máxima por nível  — o que VIG dá, sem dar Energia
 *       Pele Dura   +1 Blindagem por nível         — ≈ +2,76 de Vitalidade contra
 *                   o par de referência (0,60 de dano evitado × 4,6 rodadas)
 *
 *     Carne Dura estraga o loot: músculo denso e fibroso, carne de má qualidade.
 *
 *  2. Fantoche deixa de ser Inofensivo. É zumbi deteriorado: mais lento, com
 *     dano necrótico e couro insensível. O "difícil de morrer" vira BLINDAGEM,
 *     não Vitalidade — ele vem em até 10 (Limite de Fantoches = PRE + Servos), e
 *     Vitalidade alta vezes dez trava o combate em vez de apertá-lo.
 *
 *  3. Papa-Noite registra a forma diurna (0,20 m) no comportamento. Uma ficha só,
 *     a noturna — que é a que se enfrenta.
 *
 *   node functions/bestiario-consertos-03.mjs            (dry-run)
 *   node functions/bestiario-consertos-03.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');
const AUTOR_UID = 'M2rZzlQkzxTrrddeFQ10S6zsfX62';
const AUTOR = 'igorestevamalvesdesouza@gmail.com';
const U = 3.90;

const grab = async c => (await db.collection(c).get()).docs.map(d => ({ id: d.id, ...d.data() }));
const [mechs, pecs, vds, npcs] = await Promise.all([
    grab('system/data/mechanics'), grab('system/data/peculiarities'),
    grab('system/data/derivedValues'), grab('npcs')]);
const erros = [];

/* ── diagnóstico do alvo da Pele Dura ── */
const blNat = vds.find(v => v.nome === 'Blindagem');
if (!blNat) erros.push('VD "Blindagem" não achado');
else {
    console.log(`\nAlvo da Pele Dura — VD "Blindagem" [${blNat.id}]`);
    console.log(`   ${String(blNat.descricao || '(sem descrição)').slice(0, 300)}`);
    for (const mid of (blNat.mecanicaIds || [])) {
        const m = mechs.find(x => x.id === mid);
        if (m) console.log(`   mec "${m.nome}": ${m.previewTexto || JSON.stringify(m.config?.calculos)}`);
    }
    const alimenta = mechs.filter(m => /Blindagem"/.test(JSON.stringify(m.config?.calculos || [])));
    console.log(`   mecanicas que escrevem em Blindagem: ${alimenta.map(m => `"${m.nome}"`).join(', ') || 'NENHUMA'}`);
}

/* ── 1 · as duas peculiaridades ── */
const NIVEIS = 10;
const escada = (porNivel) => {
    const p = {};
    for (let i = 1; i <= NIVEIS; i++) p[String(i)] = { custoExp: 5 * i, termos: { 0: porNivel * i } };
    return p;
};
const NOVAS = [
    { nome: 'Carne Dura', icone: '🥩', alvo: 'Vitalidade Máxima', porNivel: 3,
      preview: `+3 em Vitalidade Máxima 📈 Nv1-${NIVEIS}`,
      descricao: 'Músculo denso e fibroso, envolto em tecido conjuntivo espesso. Cada nível soma 3 de '
        + 'Vitalidade Máxima — exatamente o que um degrau de Vigor daria, e pelo mesmo preço, com a '
        + 'diferença de que não rende Energia nem resistência. Existe para a criatura que já bateu no '
        + 'teto natural de Vigor e ainda precisa aguentar mais.\n\n'
        + 'O preço está no abate: a carne é dura, fibrosa e de sabor ruim. Cada nível piora — no Nv1 é '
        + 'carne de bicho velho, no Nv5 só serve cozida por meio dia, no Nv10 não se come. '
        + 'Caçador que a abate leva o couro, os ossos e a decepção.' },
    { nome: 'Pele Dura', icone: '🛡️', alvo: 'Blindagem', porNivel: 1,
      preview: `+1 em Blindagem 📈 Nv1-${NIVEIS}`,
      descricao: 'Couro grosso, escama, quitina ou placa óssea. Cada nível soma 1 de Blindagem — '
        + 'que, contra o atacante de referência, evita 0,60 de dano por rodada e ao longo de um combate '
        + 'de 4,6 rodadas vale perto de 2,8 de Vitalidade. É por isso que custa o mesmo que Carne Dura.\n\n'
        + 'Cuidado ao subir muito: a partir de Blindagem 5 o piso de dano 1 por golpe passa a dominar, e '
        + 'cada nível novo rende cada vez menos contra arma comum. Contra golpe fraco, porém, ela é quase '
        + 'total — e é essa a sensação que ela existe para dar.' },
];
for (const n of NOVAS) if (pecs.some(p => p.nome === n.nome)) erros.push(`peculiaridade "${n.nome}" já existe`);
for (const n of NOVAS) if (mechs.some(m => m.nome === n.nome)) erros.push(`mecânica "${n.nome}" já existe`);

/* ── 2 · Fantoche ── */
const fantoches = npcs.filter(n => n.nome === 'Fantoche');
if (fantoches.length !== 1) erros.push(`Fantoche: ${fantoches.length} docs`);
const fant = fantoches[0];
const FANT = {
    ataques: 'Ataque natural (A. Padrão): Alvo 5, 1d4+1 e Necrose 1 — a carne que ele toca apodrece.',
    vit: 9, bld: 2, desloc: '3m',
    comportamento: 'Nenhum. Executa a última ordem até cair. Não desvia, não recua, não pensa — e não '
        + 'sente. O corpo já está deteriorado quando é erguido: lento, inchado e insensível. Não é a '
        + 'Vitalidade que o segura de pé, é a Blindagem: golpe fraco quase não o marca, golpe forte o '
        + 'derruba de uma vez.',
};

/* ── 3 · Papa-Noite ── */
const papas = npcs.filter(n => n.nome === 'Papa-Noite');
if (papas.length !== 1) erros.push(`Papa-Noite: ${papas.length} docs`);
const papa = papas[0];
const PAPA_COMP = 'Solitário. Hostil.\n\nDUAS FORMAS. De dia tem 20 centímetros e cabe na palma da mão — '
    + 'inofensivo, pegável, e é assim que se caça um. Ao anoitecer chega aos 4 metros, e esta ficha é '
    + 'a forma noturna. Quem sabe disso caça de manhã; quem não sabe, encontra à noite.';

/* ── relatório ── */
const p = 0.4, liqAntes = Math.max(1, 2.5 + 0 - 2), liqDepois = Math.max(1, 2.5 + 1 - 2);
console.log('\n\n=== Bestiário · consertos 03 ===');
console.log('\n1 · PECULIARIDADES NOVAS (Nv 1–10, degrau i custa 5i, total 275 no Nv10)');
for (const n of NOVAS) {
    console.log(`\n   ${n.icone} ${n.nome} — ${n.preview}`);
    console.log(`      Nv:      ${[1, 2, 3, 5, 10].map(i => `${i}→+${n.porNivel * i}`).join('  ')}`);
    console.log(`      custo:   ${[1, 2, 3, 5, 10].map(i => `${i}→${5 * i}`).join('  ')}  (acumulado Nv10 = ${Array.from({ length: 10 }, (_, k) => 5 * (k + 1)).reduce((a, b) => a + b)})`);
}
console.log('\n2 · FANTOCHE');
console.log(`      ataque   "${(fant?.data ? '' : '')}${fant ? fant.ataques : ''}"`);
console.log(`            →  "${FANT.ataques}"`);
console.log(`      Vit      ${fant?.valoresDer?.VIT} → ${FANT.vit}   ·   Bld ${fant?.valoresDer?.BLD} → ${FANT.bld}   ·   Desloc ${fant?.valoresDer?.DESLOCAMENTO} → ${FANT.desloc}`);
console.log(`      força    ${(p * liqAntes / U).toFixed(2)}× → ${(p * liqDepois / U).toFixed(2)}× de dano puro; com Necrose 1 ≈ 0,26× → sai de Inofensiva para Praga`);
console.log(`      horda    10 fantoches = 1,5× de dano e ${10 * FANT.vit} de carne (grupo de 4 tem 72) → limpa em ${(10 * FANT.vit / (4 * U)).toFixed(1)} rodadas`);
console.log('\n3 · PAPA-NOITE — forma diurna registrada no comportamento; Vitalidade 42 (forma noturna) inalterada.');

if (erros.length) { console.error('\n🔴 ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

/* ── gravação ── */
const agora = admin.firestore.Timestamp.now();
const iso = new Date().toISOString();
const batch = db.batch();
for (const n of NOVAS) {
    const mecRef = db.collection('system/data/mechanics').doc();
    batch.set(mecRef, {
        nome: n.nome, descricao: n.preview, fonte: 'individual', tipo: 'modificar',
        duracao: 'permanente', duracaoTurnos: null, duracaoEspecial: '', escopo: 'proprio',
        condicaoAplicacao: '', empilhamento: 'soma',
        config: { calculos: [{ alvo: n.alvo, operacao: '+', equacao: [{ tipo: 'fixo', valor: n.porNivel }] }] },
        evoluivel: true, nivelMaximo: NIVEIS, progressaoApenasCriacao: false,
        progressaoTipoExp: 'custo', progressao: escada(n.porNivel),
        tags: ['Criatura', 'Avulsa'], publicado: true, previewTexto: n.preview,
        criadoPor: AUTOR_UID, criadoEm: agora, atualizadoEm: agora, versao: 1,
    });
    batch.set(db.collection('system/data/peculiarities').doc(), {
        nome: n.nome, icone: n.icone, fonte: 'individual', fonteRef: '', quandoSeAplica: 'na_criacao',
        ehVantagem: true, concedeAura: false, auraVinculadaId: '', auraGrauConcedido: null,
        derivedValueIds: [], tags: ['Criatura', 'Avulsa'], publicado: true,
        descricao: n.descricao, mecanicaIds: [mecRef.id],
        criadoPor: AUTOR_UID, criadoEm: agora, atualizadoEm: agora, versao: 2,
    });
}
batch.update(fant.__ref || db.collection('npcs').doc(fant.id), {
    ataques: FANT.ataques,
    'valoresDer.VIT': FANT.vit, 'valoresDer.BLD': FANT.bld, 'valoresDer.DESLOCAMENTO': FANT.desloc,
    'criatura.comportamento': FANT.comportamento,
    lastUpdate: iso, lastUpdateBy: AUTOR,
});
batch.update(db.collection('npcs').doc(papa.id), {
    'criatura.comportamento': PAPA_COMP, lastUpdate: iso, lastUpdateBy: AUTOR,
});
await batch.commit();
console.log('\n✅ 2 peculiaridades + 2 mecânicas criadas · Fantoche e Papa-Noite atualizados.');
process.exit(0);
