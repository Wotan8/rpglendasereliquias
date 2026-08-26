/**
 * XAMÃ — a Pec "Totemancia" vira "Totemancia Xamânica", evoluível Nv 1–2.
 *
 * O NÍVEL DELA É QUANTAS VERTENTES O XAMÃ TEM, não o poder delas:
 *   Nv 1 (de graça, com a classe) — uma vertente, escolhida no pool
 *   Nv 2 (40 EXP)                 — destrava a segunda vertente
 *
 * O poder de cada vertente é a Pec da vertente (1–5), que trava o Custo das
 * magias. Separar as duas perguntas é o que faz a escada funcionar: com uma
 * Pec só, espalhar (3+3 = 48 EXP) saía mais barato que especializar
 * (5 = 56 EXP), e o generalismo virava dominante. Com o pedágio de 40 na
 * porta, o especialista paga 56 e o generalista 80.
 *
 * CORREÇÃO: a Pec já estava vinculada ao Xamã por `bonusIniciais`
 * (nivelInicial 1) — o diagnóstico anterior de "Pec órfã" estava errado, e a
 * entrada que eu tinha posto em `peculiaridadeIds` era duplicata. Sai aqui.
 *
 *   node functions/xama-totemancia-xamanica.mjs            (dry-run)
 *   node functions/xama-totemancia-xamanica.mjs --apply
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
const PEC = 'ekws3sw5gzCvu6Th6Edo';

const pec = (await D.collection('peculiarities').doc(PEC).get()).data();
if (pec.nome !== 'Totemancia') throw new Error(`ancora nao bate: ${pec.nome}`);
if ((pec.mecanicaIds || []).length) throw new Error('a Pec ja tem mecanica — conferir antes');

const DESC = 'A arte espiritual da Essência: ouvir o que a vida deixou e tocar o que ainda vive. '
    + 'O nível desta Peculiaridade é QUANTAS vertentes o Xamã pratica, não o quanto ele sabe em cada uma. '
    + 'Nv 1 — uma vertente, escolhida na criação entre Espiritismo e Voduísmo. '
    + 'Nv 2 — o Xamã pode tomar a segunda vertente. '
    + 'A profundidade de cada uma é a Peculiaridade da própria vertente (1–5), que limita o Custo das magias.';

console.log(`${APPLY ? 'APLICANDO' : 'DRY-RUN'}\n`);
console.log(`  Pec ${PEC}: "Totemancia" -> "Totemancia Xamânica", Nv 1-2 (Nv2 = 40 EXP)`);

if (APPLY) {
    const vd = await D.collection('derivedValues').add({
        nome: 'Totemancia Xamânica', icone: '🜁',
        descricao: 'Quantas vertentes da Totemancia o Xamã pratica. 1 = uma vertente · 2 = as duas. '
            + 'Não é o poder das vertentes — esse é o nível de Espiritismo e de Voduísmo, cada um 1–5.',
        todoPersonagem: false, publicado: true, escopoItem: '', prefixo: '', sufixo: '',
        campoAtual: false, campoEditavel: false, statusCombate: false,
        characterCreationRule: false, characterCreationMin: null, characterCreationMax: null,
        blocoId: 'totemancia', blocoNome: 'Totemancia', blocoOrdem: 40, ordem: 1,
        mecanicaIds: [], versao: 1, criadoPor: AUTOR, criadoEm: ts(), atualizadoEm: ts(),
    });
    const mec = await D.collection('mechanics').add({
        nome: 'Totemancia Xamânica — vertentes praticadas',
        descricao: '+1 por nível em Totemancia Xamânica. Nv 1 destrava uma vertente (escolhida no pool '
            + 'da criação); Nv 2 destrava a segunda. O Nv 2 é caro de propósito: é o pedágio da largura, '
            + 'e sem ele espalhar sairia mais barato que especializar.',
        tipo: 'modificar', fonte: 'classe', escopo: 'proprio', duracao: 'permanente',
        duracaoEspecial: '', duracaoTurnos: null, empilhamento: 'soma',
        evoluivel: true, nivelMaximo: 2,
        progressao: { 1: { custoExp: 0, termos: { 0: 1 } }, 2: { custoExp: 40, termos: { 0: 2 } } },
        progressaoApenasCriacao: false, progressaoTipoExp: 'custo', condicaoAplicacao: '',
        config: { calculos: [{ alvo: 'Totemancia Xamânica', operacao: '+', equacao: [{ valor: 1 }] }] },
        previewTexto: '+1 por nível em Totemancia Xamânica (Nv1 1 vertente · Nv2 as duas)',
        tags: ['Xamã', 'Escola de Magia'], publicado: true, versao: 1,
        criadoPor: AUTOR, criadoEm: ts(), atualizadoEm: ts(),
    });
    await D.collection('derivedValues').doc(vd.id).update({ mecanicaIds: [mec.id] });
    await D.collection('peculiarities').doc(PEC).update({
        nome: 'Totemancia Xamânica', descricao: DESC,
        mecanicaIds: [mec.id],
        derivedValueIds: [...new Set([...(pec.derivedValueIds || []), vd.id])],
        atualizadoEm: ts(), updatedAt: ts(),
    });
    console.log(`     VD ${vd.id} · mec ${mec.id}`);
}

// desfaz a duplicata que eu criei: a Pec ja vem por bonusIniciais
const xamaDoc = (await D.collection('classes').get()).docs.find(d => d.data().nome === 'Xamã');
const x = xamaDoc.data();
const limpo = (x.peculiaridadeIds || []).filter(id => id !== PEC);
console.log(`\n  peculiaridadeIds: ${JSON.stringify(x.peculiaridadeIds)}`);
console.log(`                 -> ${JSON.stringify(limpo)}   (a Pec ja vem por bonusIniciais)`);
if (APPLY) {
    await xamaDoc.ref.update({ peculiaridadeIds: limpo, atualizadoEm: ts() });
    console.log('\nAPLICADO');
} else console.log('\nDRY-RUN — rode com --apply');
process.exit(0);
