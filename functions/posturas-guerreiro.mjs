/**
 * As quatro manobras do Guerreiro que só tinham sabor — ganham número.
 *
 * Eram o último buraco de conteúdo do sistema: "sacrificando sua defesa por
 * letalidade" não diz quanto, e o que não tem número não se mede nem se
 * balanceia. Números pela régua (dano 0,290/ponto · Blindagem 0,154/pt/rodada
 * · Alvo 0,170/pt/rodada · Prostrado 0,47 · cena = 5 rodadas):
 *
 *   Postura Ofensiva  +2 dano, −2 Reação      2,90 − 1,70 = 1,20×
 *   Postura Defensiva +3 Blindagem, −2 Alvo   3,05 − 1,70 = 1,35×
 *   Investida         +4 dano (com corrida)          1,16 = 1,16×
 *   Romper Defesa     ignora Blindagem + Prostrado   1,05 = 1,05×
 *
 * O Romper Defesa CAI de 2 para 1 Energia: a 2 ele entregaria 0,53× e seria
 * armadilha. Ignorar Blindagem parece grande e vale pouco na régua, porque a
 * Blindagem típica de mesa é 2.
 *
 * O sabor original de cada uma é preservado — a frase que existia continua
 * abrindo o texto, e a mecânica entra depois dos dois-pontos.
 *
 *   node functions/posturas-guerreiro.mjs            (dry-run)
 *   node functions/posturas-guerreiro.mjs --apply
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');
const MOD = 'manobras_guerreiro';

/* Texto com hífen ASCII, nunca "−" (U+2212): a régua normaliza, mas o resto
   do sistema não, e a penalidade some sem aviso em qualquer parser ingênuo. */
const MEC_1_ENER = 'gT5DZcIaG69aYuEjdXwQ';   // "-1 ENER"
const P = [
    {
        nome: 'Postura Ofensiva', esperado: 1.20,
        texto: 'Adota uma base puramente agressiva, sacrificando sua defesa por letalidade: '
             + '+2 de dano em cada golpe e -2 na sua Reação. Dura até você trocar de postura.',
        dur: [1, 'cena'], alvos: 1,
    },
    {
        nome: 'Postura Defensiva', esperado: 1.35,
        texto: 'Adota uma base cautelosa, focada inteiramente em resistir aos golpes inimigos e sobreviver ao avanço adversário: '
             + '+3 de Blindagem e -2 no Alvo dos seus ataques. Dura até você trocar de postura.',
        dur: [1, 'cena'], alvos: 1,
    },
    {
        nome: 'Investida', esperado: 1.16,
        texto: 'Uma carga agressiva e veloz que usa o próprio peso e o momento da corrida para potencializar o impacto: '
             + 'exige mover ao menos 4,5m em linha reta antes do golpe e concede +4 de dano neste ataque.',
        dur: [0, 'instantaneo'], alvos: 1,
    },
    {
        nome: 'Romper Defesa', esperado: 1.05, custo: '1 Energia', mecCusto: MEC_1_ENER,
        texto: 'Um ataque avassalador desenhado para quebrar a guarda e desestabilizar a base do inimigo: '
             + 'ignora a Blindagem do alvo neste golpe e, com sucesso, o alvo fica Prostrado.',
        dur: [0, 'instantaneo'], alvos: 1,
        cond: [{ condicao: 'Prostrado', portao: 'resistencia', chance: null, alvos: 1, rodadas: 1 }],
    },
];

/* ═══ ASSERTS ═══ */
assert.equal(P.length, 4);
assert.ok(P.every(p => p.esperado >= 1.00 && p.esperado <= 1.70), 'todas dentro da faixa 1,00–1,70');
/* Nenhuma pode reescrever o efeito de uma condição da paleta (redundância
   DUPLICADA do audit-redundancia): Inabalável é "+2 de Blindagem". */
assert.ok(!P.some(p => /\+\s*2\s*de Blindagem/i.test(p.texto)), 'não reescrever o Inabalável');
/* Nenhuma pode dar bônus por Grau sobre o que os Graus já fazem. */
assert.ok(!P.some(p => /Graus?[^.;]{0,40}(?:ignora|reduz)[^.;]{0,20}(?:Rea[çc][ãa]o|Alvo)/i.test(p.texto)), 'sem redundância de Graus');
/* O sabor original tem que sobreviver: cada texto novo começa como o antigo. */
console.log('✅ 4 asserts.\n');

const ref = db.collection('system/data/classModules').doc(MOD);
const snap = await ref.get();
if (!snap.exists) { console.error('🔴 módulo manobras_guerreiro não achado'); process.exit(1); }
const m = snap.data();
const erros = [], plano = [];
const itens = (m.itensPredefinidos || []).map(it => {
    const p = P.find(x => x.nome === it.nome);
    if (!p) return it;
    const antes = String(it.descricao || '');
    /* o sabor antigo tem que ser o começo do novo — se não for, alguém mexeu
       no texto e este script está sobrescrevendo trabalho alheio */
    const raiz = antes.replace(/[.:].*$/s, '').slice(0, 28);
    if (raiz && !p.texto.startsWith(raiz.slice(0, 20))) erros.push(`${p.nome}: o sabor original mudou — confira antes de sobrescrever`);
    const valores = { ...(it.valores || {}), 5: p.texto };
    if (p.custo) valores[3] = p.custo;
    /* O custo REAL é a mecânica do botão, não o texto do campo "Custo:" —
       trocar só o texto deixaria o Romper Defesa cobrando 2 de Energia. */
    if (p.mecCusto) valores[4] = p.mecCusto;
    plano.push({ nome: p.nome, antes, depois: p.texto, custo: p.custo || valores[3], esperado: p.esperado });
    return {
        ...it, descricao: p.texto, valores,
        duracaoValor: p.dur[0], duracaoUnidade: p.dur[1], alvosMax: p.alvos,
        ...(p.cond ? { condicoesAplicadas: p.cond } : {}),
    };
});
const faltando = P.filter(p => !plano.some(x => x.nome === p.nome));
if (faltando.length) erros.push(`não achadas: ${faltando.map(p => p.nome).join(', ')}`);

console.log('=== Posturas e golpes do Guerreiro ===\n');
for (const p of plano) {
    console.log(`▸ ${p.nome}  (${p.custo})  → ~${p.esperado.toFixed(2)}×`);
    console.log(`   antes: ${p.antes.slice(0, 88)}`);
    console.log(`   agora: ${p.depois.slice(0, 88)}`);
    console.log(`          ${p.depois.slice(88, 176)}`);
}
if (erros.length) { console.error('\n🔴 ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }
await ref.update({ itensPredefinidos: itens, atualizadoEm: admin.firestore.Timestamp.now() });
console.log('\n✅ Gravado.');
process.exit(0);
