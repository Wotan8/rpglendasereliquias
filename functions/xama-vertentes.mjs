/**
 * XAMÃ — passo 1 e 2 das vertentes.
 *
 * 1) A Peculiaridade "Totemancia" (fonte: classe) existe desde 04/2026 e NUNCA
 *    foi vinculada ao Xamã — o `peculiaridadeIds` da classe só tinha o Domínio.
 *    Por isso ela não aparecia na ficha e não dava para upar.
 *
 * 2) Duas vertentes internas, cada uma com Pec própria e nível 1–5:
 *      Espiritismo (Verde) — Ecos dos mortos, o que o Verde já consumiu
 *      Voduísmo    (Azul)  — o vivo à distância, o Azul pescado antes de sumir
 *    O nível TRAVA a escada de habilidades: Custo N exige vertente N. Sem esse
 *    gate a escada de EXP é superlinear e espalhar sai mais barato que
 *    especializar (3+3 custa 48 EXP, 5+0 custa 56) — o generalismo viraria
 *    dominante, que é o oposto da intenção.
 *
 * 3) "Golpes do Verde" sai de jogo: o Eco é o core do Xamã. O módulo é
 *    DESPUBLICADO e desvinculado, não apagado — dá para voltar atrás.
 *
 *   node functions/xama-vertentes.mjs            (dry-run)
 *   node functions/xama-vertentes.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const D = db.collection('system').doc('data');
const APPLY = process.argv.includes('--apply');
const AUTOR = 'M2rZzlQkzxTrrddeFQ10S6zsfX62';
const ts = () => admin.firestore.FieldValue.serverTimestamp();
const plano = [];

const xamaDoc = (await D.collection('classes').get()).docs.find(d => d.data().nome === 'Xamã');
const xama = xamaDoc.data();

// escada 4N, com o nível 1 vindo de graça com a classe
const PROGRESSAO = {
    1: { custoExp: 0, termos: { 0: 1 } },
    2: { custoExp: 8, termos: { 0: 2 } },
    3: { custoExp: 12, termos: { 0: 3 } },
    4: { custoExp: 16, termos: { 0: 4 } },
    5: { custoExp: 20, termos: { 0: 5 } },
};

const VERTENTES = [
    { nome: 'Espiritismo', essencia: 'Verde',
      desc: 'A vertente do Xamã que pesca na Essência Verde: Ecos da Alma que os mortos deixaram e que o Verde já consumiu. Cravar totens, buscar vestígios, comungar e incorporar. O nível desta vertente é o teto de Custo das habilidades de Espiritismo que o Xamã pode usar.' },
    { nome: 'Voduísmo', essencia: 'Azul',
      desc: 'A vertente do Xamã que pesca na Essência Azul: a vida que ainda não foi consumida pelo Verde. Uma parte viva do alvo — cabelo, sangue, carne — mantém o Azul por uma janela curta, e quem amarra o elo antes que ele apague age sobre o dono à distância. O nível desta vertente é o teto de Custo das habilidades de Voduísmo que o Xamã pode usar.' },
];

const jaVD = {}, jaPec = {};
for (const doc of (await D.collection('derivedValues').get()).docs) jaVD[doc.data().nome] = doc.id;
for (const doc of (await D.collection('peculiarities').get()).docs) jaPec[doc.data().nome] = doc.id;

const novosPecIds = [];
for (const v of VERTENTES) {
    if (jaPec[v.nome]) { console.log(`  ok   Pec "${v.nome}" já existe (${jaPec[v.nome]})`); novosPecIds.push(jaPec[v.nome]); continue; }
    console.log(`  ${APPLY ? 'CRIA' : 'DRY '} VD + mecânica + Pec "${v.nome}" (${v.essencia}), níveis 1–5, escada 0/8/12/16/20 EXP`);
    if (!APPLY) { novosPecIds.push(`<${v.nome}>`); continue; }

    const vd = await D.collection('derivedValues').add({
        nome: v.nome, icone: v.essencia === 'Verde' ? '🌿' : '🪡',
        descricao: `Nível da vertente ${v.nome} (Essência ${v.essencia}). Nasce 0 e sobe pela Peculiaridade. `
            + `É o TETO de Custo das habilidades desta vertente: vertente ${v.nome} 3 usa até Custo 3.`,
        todoPersonagem: false, publicado: true, escopoItem: '', prefixo: '', sufixo: '',
        campoAtual: false, campoEditavel: false, statusCombate: false,
        characterCreationRule: false, characterCreationMin: null, characterCreationMax: null,
        blocoId: 'totemancia', blocoNome: 'Totemancia', blocoOrdem: 40, ordem: 10,
        mecanicaIds: [], versao: 1, criadoPor: AUTOR, criadoEm: ts(), atualizadoEm: ts(),
    });
    const mec = await D.collection('mechanics').add({
        nome: `${v.nome} — nível da vertente`,
        descricao: `Sobe o Valor Derivado ${v.nome} em 1 por nível (Nv1 1 · Nv5 5).`,
        tipo: 'modificar', fonte: 'classe', escopo: 'proprio', duracao: 'permanente',
        duracaoEspecial: '', duracaoTurnos: null, empilhamento: 'soma',
        evoluivel: true, nivelMaximo: 5, progressao: PROGRESSAO,
        progressaoApenasCriacao: false, progressaoTipoExp: 'custo', condicaoAplicacao: '',
        config: { calculos: [{ alvo: v.nome, operacao: '+', equacao: [{ valor: 1 }] }] },
        previewTexto: `+1 por nível em ${v.nome}`,
        tags: ['Xamã', 'Vertente'], publicado: true, versao: 1,
        criadoPor: AUTOR, criadoEm: ts(), atualizadoEm: ts(),
    });
    await D.collection('derivedValues').doc(vd.id).update({ mecanicaIds: [mec.id] });
    const pec = await D.collection('peculiarities').add({
        nome: v.nome, descricao: v.desc, ehVantagem: true, fonte: 'classe', fonteRef: '',
        quandoSeAplica: 'passivo', concedeAura: false, auraVinculadaId: null, auraGrauConcedido: null,
        mecanicaIds: [mec.id], mecanicaExpCriacao: [], derivedValueIds: [vd.id],
        tags: ['Vertente', 'Xamã'], publicado: true, versao: 1,
        criadoPor: AUTOR, criadoEm: ts(), atualizadoEm: ts(), updatedAt: ts(),
    });
    console.log(`       VD ${vd.id} · mec ${mec.id} · Pec ${pec.id}`);
    novosPecIds.push(pec.id);
}

// ── a Pec de classe órfã + as duas vertentes entram na classe ──
const PEC_TOTEMANCIA = 'ekws3sw5gzCvu6Th6Edo';
const pecs = [...new Set([...(xama.peculiaridadeIds || []), PEC_TOTEMANCIA, ...novosPecIds])];
console.log(`\n  peculiaridadeIds: ${JSON.stringify(xama.peculiaridadeIds)} → ${JSON.stringify(pecs)}`);

// ── Golpes do Verde sai ──
const mods = (xama.modulosDaClasse || []).filter(m => m !== 'mod_verde_xama');
console.log(`  modulosDaClasse: ${JSON.stringify(xama.modulosDaClasse)} → ${JSON.stringify(mods)}`);

if (APPLY) {
    await xamaDoc.ref.update({ peculiaridadeIds: pecs, modulosDaClasse: mods,
        especialidade: 'Espiritismo | Voduísmo | Totemancia', atualizadoEm: ts() });
    await D.collection('classModules').doc('mod_verde_xama').update({
        publicado: false,
        nome: 'Golpes do Verde (aposentado — o Eco é o core do Xamã)',
    });
    console.log('\nAPLICADO');
} else console.log('\nDRY-RUN — rode com --apply');
process.exit(0);
