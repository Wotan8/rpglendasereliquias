/**
 * As duas pontas de cadastro que faltavam na Runomancia.
 *
 * 1. EROSÃO — a condição que carrega a perda permanente de Vitalidade máxima.
 *
 *    O Erosor arranca VIT máxima "para sempre". Escrever isso direto no campo
 *    de VIT Máxima da ficha seria escrita destrutiva e invisível: ninguém
 *    olhando o token saberia por que aquele corpo encolheu, e desfazer um erro
 *    de mesa viraria arqueologia. Como CONDIÇÃO, a perda fica à vista no token,
 *    acumula nível a nível, espelha na ficha pelo caminho que já existe, e o
 *    Mestre pode remover se a mesa decidir que houve engano.
 *
 * 2. As runas passivas precisam de um lugar declarado para as condições que
 *    aplicam sozinhas — este script só confere que o campo é lido; quem grava
 *    é o Laboratorium na emissão.
 *
 *   node functions/__aplica-erosao-e-passiva.mjs           (só mostra)
 *   node functions/__aplica-erosao-e-passiva.mjs --apply   (grava)
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');
const AUTOR = 'M2rZzlQkzxTrrddeFQ10S6zsfX62';
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

const EROSAO = {
    nome: 'Erosão', icone: '🕳️', duracao: 'permanente',
    acumulaNiveis: true, nivelMaximo: 99, removivel: false, afetaTabuleiro: true,
    reduzVitalidadeMaxima: true,
    descricao: 'Carne que não volta. O Erosor não abre um buraco no corpo — ele tira '
        + 'do corpo a parte que fecharia o buraco.\n\n'
        + '· **−N na Vitalidade MÁXIMA**, permanentemente;\n'
        + '· acumula: cada aplicação soma ao que já foi perdido;\n'
        + '· **não é removível** por cura, descanso ou tempo.\n\n'
        + 'Só a Runomancia produz esta condição, e só com um Erosor gravado no circuito. '
        + 'É a coisa mais cara de aprender do ofício, e a única que a mesa não desfaz.',
};

const cond = await db.collection('system/data/conditions').get();
const ja = cond.docs.find(d => norm(d.data().nome) === 'erosao');

console.log(`\n🕳️  ${ja ? 'JÁ EXISTE' : 'CRIAR'}  ${EROSAO.icone} ${EROSAO.nome}`);
console.log(`    duração: ${EROSAO.duracao} · acumula até ${EROSAO.nivelMaximo} · removível: ${EROSAO.removivel}`);
console.log(`    reduzVitalidadeMaxima: ${EROSAO.reduzVitalidadeMaxima}`);
console.log(`\n    ${EROSAO.descricao.split('\n')[0]}`);

if (APLICAR) {
    const dados = { ...EROSAO, publicado: true, efeitoMecanicaIds: [], criadoPor: AUTOR, atualizadoEm: new Date(), versao: 1 };
    if (ja) await db.doc(`system/data/conditions/${ja.id}`).set(dados, { merge: true });
    else await db.collection('system/data/conditions').add({ ...dados, criadoEm: new Date() });
}

/* ---- o Erosor aponta a condição que ele aplica ---- */
const erosorRef = db.doc('system/data/runicElements/sig_erosor');
const erosor = await erosorRef.get();
if (erosor.exists) {
    console.log('\n🟣 Erosor → passa a declarar a condição que aplica: "Erosão"');
    if (APLICAR) await erosorRef.set({ condicaoAplicada: 'Erosão', atualizadoEm: new Date() }, { merge: true });
} else {
    console.log('\n❌ sig_erosor não existe — rode antes __aplica-runomancia-em-jogo.mjs');
    process.exit(1);
}

console.log(`\n${APLICAR ? '✅ GRAVADO' : '🔍 SIMULAÇÃO (rode com --apply para gravar)'}`);
console.log(`Condições no registro: ${cond.size}${ja ? '' : ' → ' + (cond.size + 1)}`);
process.exit(0);
