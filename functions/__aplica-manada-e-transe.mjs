/**
 * 1) Convocar Manada (Ferinismo) ganha a mira nova de LOCAIS:
 *    alcance (Percepção × 2) m e a quantidade de pontos saindo dos Graus da
 *    conjuração — mínimo 1 ao passar, teto 5. Decisão de mesa do Mestre.
 *
 * 2) Condição "Em Transe": o corpo de quem projeta a consciência (Fusão
 *    Selvagem — Projetor, Transcendência — Projetor) fica inerte enquanto a
 *    fusão durar. Canon da Totemancia: "Forma Projetor deixa o corpo inerte."
 *
 *   node functions/__aplica-manada-e-transe.mjs           (só mostra)
 *   node functions/__aplica-manada-e-transe.mjs --apply   (grava)
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

/* ===== 1) Convocar Manada ===== */
const MOD = 'ally_animal', PREDEF = 'pdi_1784476430077_ymj2z5';
const CAMPOS = {
    formaArea: 'locais',
    alcance: '(Percepção * 2)',   // fórmula: escala com a ficha do Druida
    alvosMax: 5,                  // TETO; quantos vêm de fato sai dos Graus
    alvosPorGraus: true,
    faccao: 'aliado',
};

const refMod = db.doc(`system/data/classModules/${MOD}`);
const snapMod = await refMod.get();
let mudou = 0;
if (!snapMod.exists) {
    console.log('❌ módulo do Ferinismo não encontrado');
} else {
    const lista = [...(snapMod.data().itensPredefinidos || [])];
    const i = lista.findIndex(p => p.id === PREDEF);
    if (i < 0) console.log('❌ Convocar Manada não encontrada');
    else {
        const pd = lista[i];
        const antes = { formaArea: pd.formaArea, alcance: pd.alcance, alvosMax: pd.alvosMax, alvosPorGraus: pd.alvosPorGraus, faccao: pd.faccao };
        lista[i] = { ...pd, ...CAMPOS };
        console.log('\n✔ Convocar Manada');
        console.log(`   antes : ${JSON.stringify(antes)}`);
        console.log(`   depois: ${JSON.stringify(CAMPOS)}`);
        console.log('   regra : quem conjura aponta pontos VAZIOS até (Percepção × 2) m;');
        console.log('           cada Grau de Sucesso vale um ponto, mínimo 1 ao passar, teto 5.');
        if (APLICAR) await refMod.update({ itensPredefinidos: lista, atualizadoEm: new Date() });
        mudou++;
    }
}

/* ===== 2) Condição "Em Transe" ===== */
// Campos no formato do registro de Condições (system/data/conditions).
// Campos exatamente como as outras condições do registro (ver
// shared/combate-cenas.js → efeitoDasCondicoes): `afetaTabuleiro` liga a
// configuração de VTT, `bloqueiaAcoes` lista o que some do painel do turno.
const TRANSE = {
    nome: 'Em Transe',
    icone: '🌀',
    descricao: 'O corpo ficou para trás.\n\n'
        + '· **não age**: nenhuma ação do turno, nem livre;\n'
        + '· **não se move**: Deslocamento zerado;\n'
        + '· **não se defende**: quem ataca o corpo em transe não encontra Defesa.\n\n'
        + 'Sai sozinha quando a projeção acaba — ou quando o corpo morre, e aí o '
        + 'que estava projetado tem problema maior.\n\n'
        + 'Canon da Totemancia: "Forma Projetor deixa o corpo inerte. Se o corpo '
        + 'morrer, o Selo de Vida se rompe."',
    duracao: 'enquanto durar a projeção',
    removivel: true,
    publicado: true,
    efeitoMecanicaIds: [],
    // ----- configuração de Tabuleiro -----
    afetaTabuleiro: true,
    bloqueiaAcoes: ['padrao', 'movimento', 'livre', 'completa'],
    multiplicadorDeslocamento: 0,
    versao: 1,
};

const col = db.collection('system/data/conditions');
const jaTem = await col.where('nome', '==', TRANSE.nome).get();
if (!jaTem.empty) {
    console.log(`\n⏭️  Condição "${TRANSE.nome}" já existe (${jaTem.docs[0].id}) — não duplico`);
} else {
    console.log(`\n✔ Condição nova: ${TRANSE.icone} ${TRANSE.nome}`);
    console.log(`   ${TRANSE.descricao}`);
    console.log(`   tabuleiro: bloqueia ${TRANSE.bloqueiaAcoes.join('/')} · Deslocamento ×${TRANSE.multiplicadorDeslocamento}`);
    if (APLICAR) await col.add({ ...TRANSE, criadoEm: new Date() });
    mudou++;
}

console.log(`\n${APLICAR ? 'GRAVADO' : 'SIMULAÇÃO (rode com --apply para gravar)'} — ${mudou} mudança(s)`);
process.exit(0);
