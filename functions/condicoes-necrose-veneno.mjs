/**
 * Condições novas: NECROSE e VENENO — e o conserto das duas refs mortas.
 *
 * A varredura da leva de criaturas achou dois nomes de condição escritos no
 * texto de ataque de fichas de cânone que NÃO existiam no catálogo:
 *   · Fantoche  — "1d4+1 e Necrose 1 — a carne que ele toca apodrece"
 *   · Serpente  — "Toxis 1"
 * A mesa lia o nome e não tinha regra atrás. O usuário decidiu (31/08/2026)
 * cadastrar as duas de verdade, com "Toxis" renomeado para **Veneno**.
 *
 * ── COMO CADA UMA SE SEPARA DA VIZINHA ──────────────────────────────
 * O catálogo já tinha cinco condições nessa vizinhança. Nenhuma das duas
 * novas repete nenhuma delas — o que separa é sempre a SAÍDA e o que é
 * atacado:
 *
 *   Queimadura   N dano/rodada, ignora Blindagem   sai com 1 Ação, automático
 *   Hemorragia   N dano/rodada, dobra se mover     sai com 1 Ação + Anatomia
 *   Chaga        bloqueia recuperação (sem nível)  sai no fim da cena
 *   Definhado    VIT Máxima −N                     sai no Descanso Longo
 *   Erosão       VIT Máxima −N, permanente         não sai (só Runomancia)
 *   ─────────────────────────────────────────────────────────────────
 *   NECROSE      VIT Máxima −N, ACUMULA            NÃO sai no descanso:
 *                                                  só cortando (Ação+Anatomia),
 *                                                  e cortar dói
 *   VENENO       N dano/rodada, ignora Blindagem   NÃO estanca nem apaga:
 *                                                  só antídoto, Herbalismo
 *                                                  ou o fim da cena
 *
 * A Necrose é o meio-termo que faltava entre Definhado (sai dormindo) e
 * Erosão (nunca sai): sai, mas custa carne. O Veneno é o meio-termo entre
 * Queimadura (sai de graça) e Hemorragia (sai com teste): não sai por
 * esforço nenhum dentro do turno — é o único dano contínuo que a vítima não
 * consegue interromper sozinha.
 *
 * ── PREÇO ───────────────────────────────────────────────────────────
 * Base v3, unidade 3,90 → 1 ponto de dano por rodada = 1 ÷ 3,90 = 0,256 un.
 *   Veneno N   = 0,256 × N un/rodada. Mesma taxa da Hemorragia parada; a
 *                saída mais difícil é compensada por não dobrar com movimento.
 *   Necrose N  = 0,256 × N un. Mesma taxa do Definhado por ponto de VIT
 *                Máxima; sobreviver ao Descanso Longo (pior) é compensado
 *                por poder ser cortada no meio da cena (melhor).
 *
 * ⚠️ CONSEQUÊNCIA QUE ESTE SCRIPT NÃO RESOLVE SOZINHO: as duas fichas que
 * já citavam esses nomes passam a carregar um efeito que agora TEM preço, e
 * que o carimbo de força delas nunca contou. O relatório mostra o quanto
 * cada uma estoura, e a decisão de ajustar dado ou tirar o efeito é sua —
 * este script não recalibra ficha de cânone sozinho.
 *
 *   node functions/condicoes-necrose-veneno.mjs            (dry-run)
 *   node functions/condicoes-necrose-veneno.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');
const AUTOR = 'igorestevamalvesdesouza@gmail.com';
const CRIADOR = 'M2rZzlQkzxTrrddeFQ10S6zsfX62';   // mesmo criadoPor do resto do catálogo

const U = 3.90;
const TAXA = 1 / U;                                 // 1 ponto de dano/rodada em "un"
const br = (x, c = 3) => x.toFixed(c).replace('.', ',');
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

const NOVAS = [
{
    nome: 'Necrose', icone: '🖤', duracao: 'até ser cortada', removivel: true,
    acumulaNiveis: true, nivelMaximo: 5, afetaTabuleiro: true, reduzVitalidadeMaxima: true,
    descricao:
`A carne em volta da ferida morre, e o que morreu não volta sozinho.

· **−N na Vitalidade Máxima** enquanto durar;
· **acumula** — cada nova aplicação soma à necrose que já está lá, até **5**;
· o **Descanso Longo não remove**: dormir não desfaz carne morta;
· sai com **1 Ação Padrão + teste de Perícia: Anatomia** (cortar fora), ou com cura mágica de Vida ou Luz;
· **cortar dói**: quem corta causa **1 de dano** por nível removido.

Vale **${br(TAXA)} un por nível** — a mesma taxa do Definhado por ponto de Vitalidade Máxima. Sobreviver ao Descanso Longo é pior que o Definhado; poder ser cortada no meio da cena é melhor. As duas coisas se anulam e a taxa fica a mesma.

O lugar dela na escada: o **Definhado** sai dormindo, a **Erosão** não sai nunca. A Necrose sai, e cobra carne para sair.

É o que a Necrótica deixa quando toca sem matar — a mordida do Avarbus, a mão do Fantoche.`,
},
{
    nome: 'Veneno', icone: '☠️', duracao: 'até o antídoto ou o fim da cena', removivel: true,
    acumulaNiveis: false, afetaTabuleiro: true,
    descricao:
`Já está no sangue. Não adianta apertar a ferida.

· **N de dano por rodada**, no fim do turno do alvo;
· **ignora Blindagem** — não entrou pela armadura, entrou pelo corpo;
· **não estanca e não apaga**: nenhuma ação da vítima interrompe;
· sai com **antídoto**, com **1 Ação Padrão + teste de Perícia: Herbalismo** de quem souber, ou sozinho **no fim da cena**;
· enquanto durar, **cura comum restaura metade** — o corpo está ocupado com outra coisa.

Vale **${br(TAXA)} un/rodada por nível**, a mesma taxa da Hemorragia parada. A saída mais difícil é compensada por não dobrar com movimento: a Hemorragia cobra a fuga, o Veneno é indiferente a ela.

O lugar dele na escada: a **Queimadura** sai de graça com uma ação, a **Hemorragia** sai com uma ação e um teste que pode falhar. O Veneno é o único dano contínuo que a vítima **não consegue interromper sozinha** — precisa de outra pessoa, de um frasco, ou de tempo.

Não empilha: reaplicar usa o maior N.`,
},
];

/* Fichas que citam (ou deviam citar) os nomes.
 *
 *   modo 'manter'    — o texto JÁ diz o nome certo; não se mexe em uma letra.
 *                      O que muda é que agora existe regra atrás do nome.
 *   modo 'restaurar' — o rider SUMIU. A passada v3 (bestiario-v3-lote*.mjs)
 *                      reescreveu `ataques` a partir de um parser que só
 *                      guardava "Alvo N, XdY" e descartava o que vinha depois.
 *                      A Serpente perdeu o "Toxis 1" ali. Não é invenção
 *                      repor: a tabela de carimbo da própria skill /bestiario
 *                      declara o alvo dela como 0,35× com a nota "a diferença
 *                      é o Toxis 1 da mordida, que a conta de DPR puro não vê".
 *                      O projeto sempre contou com o efeito; o texto é que o
 *                      perdeu.
 */
const REFS = [
    { nome: 'Fantoche', modo: 'manter', de: 'Necrose 1', nivel: 1, cond: 'Necrose', alvoDeDesign: 0.15 },
    { nome: 'Serpente', modo: 'restaurar', rider: ' e Veneno 1 — a peçonha entra com a mordida', nivel: 1, cond: 'Veneno', alvoDeDesign: 0.35 },
];

const grab = async c => (await db.collection(c).get()).docs;
const [condDocs, npcDocs] = await Promise.all([grab('system/data/conditions'), grab('npcs')]);
const erros = [];

for (const n of NOVAS) if (condDocs.some(d => norm(d.data().nome) === norm(n.nome)))
    erros.push(`condição "${n.nome}" JÁ existe no catálogo — este script criaria duplicata`);

const medio = d => { const m = /(\d+)d(\d+)/.exec(String(d)); return m ? Number(m[1]) * (Number(m[2]) + 1) / 2 : NaN; };
const patches = [];
for (const r of REFS) {
    const doc = npcDocs.find(d => (d.data().nome || '') === r.nome);
    if (!doc) { erros.push(`"${r.nome}" não achado em npcs`); continue; }
    const n = doc.data();
    const atq = String(n.ataques || '');
    let atqDepois;
    if (r.modo === 'manter') {
        if (!atq.includes(r.de)) { erros.push(`"${r.nome}": esperava achar "${r.de}" em ataques e não achei — confira à mão:\n      ${atq.split('\n')[0]}`); continue; }
        atqDepois = atq;                       // o texto já está certo; só o catálogo mudou
    } else {
        if (new RegExp(r.cond, 'i').test(atq)) { erros.push(`"${r.nome}": já cita "${r.cond}" — nada a restaurar`); continue; }
        const linhas = atq.split('\n');
        const i = linhas.findIndex(l => /Alvo\s*\d/.test(l));
        if (i < 0) { erros.push(`"${r.nome}": nenhuma linha com "Alvo N" para receber o rider`); continue; }
        linhas[i] = linhas[i].replace(/\.(\s*(\[|$))/, `${r.rider}.$1`);
        atqDepois = linhas.join('\n');
        if (atqDepois === atq) { erros.push(`"${r.nome}": não consegui inserir o rider na linha "${linhas[i]}"`); continue; }
    }

    /* quanto o efeito, agora precificado, soma ao carimbo que a ficha já tem */
    const linha = (atq.split('\n').find(l => /Alvo\s*\d/.test(l)) || '').trim();
    const g = /Alvo (\d+)[^,]*, (\d+d\d+)(?:\+(\d+))?/.exec(linha);
    const P = g ? Math.max(0, Math.min((Math.min(+g[1], 9) - 1) / 10, 0.9)) : 0;
    const liq = g ? Math.max(1, medio(g[2]) + (g[3] ? +g[3] : 0) - 2) : 0;
    const forcaGolpe = P * liq / U;
    const forcaCond = TAXA * r.nivel;
    patches.push({ ref: doc.ref, ...r, atqAntes: atq, atqDepois,
        forcaGolpe, forcaCond, total: forcaGolpe + forcaCond });
}

/* ── relatório ── */
console.log(`\n=== Duas condições novas · base ${br(U, 2)} · 1 ponto de dano/rodada = ${br(TAXA)} un ===\n`);
for (const n of NOVAS) {
    console.log(`══ ${n.icone}  ${n.nome}   (${n.duracao}${n.acumulaNiveis ? `, acumula até ${n.nivelMaximo}` : ', não acumula'})`);
    console.log(n.descricao.split('\n').map(s => '   ' + s).join('\n') + '\n');
}

console.log('--- as duas refs, agora com regra atrás ---');
for (const p of patches) {
    console.log(`\n── ${p.nome}   (${p.modo === 'manter' ? 'texto intocado — só o catálogo mudou' : 'RESTAURA o rider que a passada v3 apagou'})`);
    console.log(`   de:   ${p.atqAntes.split('\n')[0]}`);
    console.log(`   para: ${p.atqDepois.split('\n')[0]}`);
}

console.log('\n--- ⚠ o que isso faz com o carimbo de força das duas ---');
console.log('ficha        golpe    + condição   = total   alvo de projeto   estouro');
for (const p of patches) {
    const est = (p.total - p.alvoDeDesign) / p.alvoDeDesign * 100;
    console.log(`${p.nome.padEnd(12)} ${(br(p.forcaGolpe, 2) + '×').padStart(6)}   ${(br(p.forcaCond, 2) + '×').padStart(7)}    ${(br(p.total, 2) + '×').padStart(6)}   ${(br(p.alvoDeDesign, 2) + '×').padStart(13)}   ${est > 0 ? '+' : ''}${br(est, 0)}%`);
}
console.log(`
   NÃO recalibrei nenhuma das duas — ficha de cânone não se mexe sozinha.
   As saídas, se quiser fechar depois:
     · Fantoche  — tirar a Necrose (volta a 0,15×, exatamente o alvo dele) ou
                   baixar o dado de 1d4+1 para 1d2+1 e manter a Necrose.
     · Serpente  — manter. A tabela da própria skill /bestiario já diz que o
                   vão de 0,19× para 0,35× "é o Toxis da mordida, que a conta
                   de DPR puro não vê" — ou seja, o projeto já contava com ele.`);

if (erros.length) { console.log('\n❌ ERROS — nada foi gravado:'); erros.forEach(e => console.log('   ' + e)); process.exit(1); }
console.log('\n✅ conferências OK: nenhuma das duas condições já existe, e as duas refs foram achadas nas fichas.');

if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

const agora = admin.firestore.Timestamp.now();
const iso = new Date().toISOString();
const batch = db.batch();
for (const n of NOVAS) batch.set(db.collection('system/data/conditions').doc(), {
    ...n, publicado: true, efeitoMecanicaIds: [], versao: 1,
    criadoPor: CRIADOR, criadoEm: agora, atualizadoEm: agora,
});
for (const p of patches) batch.update(p.ref, { ataques: p.atqDepois, lastUpdate: iso, lastUpdateBy: AUTOR });
await batch.commit();
console.log(`\n✅ ${NOVAS.length} condições cadastradas e ${patches.length} fichas apontando para elas.`);
process.exit(0);
