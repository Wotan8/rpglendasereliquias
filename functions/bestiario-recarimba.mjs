/**
 * Recarimba toda criatura cujo `nivelAmeaca` não bate mais com a ficha.
 *
 * Genérico e re-executável de propósito: sempre que um rider ganhar preço,
 * um dado mudar ou uma condição for cadastrada, rode isto de novo. Ele não
 * decide nada — só recomputa a força pela régua e reescreve o começo do
 * carimbo (`Grau · força×`), deixando o resto da linha intacto: densidade,
 * cláusula de doma, Lealdade e a nota do fim continuam como estavam.
 *
 * A força de uma ficha é a MELHOR LINHA de ataque dela contando o rider
 * daquela linha — que é como a régua sempre mediu. O que faltava, até esta
 * semana, era o rider ter preço: "Derrubada" e "Sangrar" não existiam no
 * catálogo, então valiam zero na conta e o carimbo saía subestimado.
 *
 *     P     = clamp((min(Alvo,9) − 1) ÷ 10, 0 ; 0,9)
 *     golpe = P × max(1, dado_médio + bônus − 2) ÷ 3,90
 *     rider = (valor da condição por rodada) × P     ← só vale se o golpe entrar
 *     força = max sobre as linhas de (golpe + rider)
 *
 * ⚠️ NEVARA é ficha de mesa (`mesaId` preenchido). O usuário autorizou mexer
 * em ficha de mesa nesta sessão. Ela é a única que DESCE — o carimbo dela
 * estava superestimado, não subestimado.
 *
 *   node functions/bestiario-recarimba.mjs            (dry-run)
 *   node functions/bestiario-recarimba.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');
const AUTOR = 'igorestevamalvesdesouza@gmail.com';
const U = 3.90, DANO = 0.290, BLD_REF = 2;
const TOLERANCIA = 0.02;

const br = (x, c = 2) => x.toFixed(c).replace('.', ',');
const medio = d => { const m = /(\d+)d(\d+)/.exec(String(d)); return m ? Number(m[1]) * (Number(m[2]) + 1) / 2 : NaN; };
const GRAUS = [[0.15, 'Inofensiva'], [0.35, 'Praga'], [0.75, 'Comum'], [1.5, 'Séria'], [3.0, 'Grave']];
const grauDe = x => (GRAUS.find(([t]) => x < t) || [null, 'Calamidade'])[1];

/* Valor por rodada de cada condição que aparece como rider. Todo número sai
   da descrição da própria condição no catálogo — nenhum é chutado aqui. */
const eletro = N => (N + Math.floor(BLD_REF / 2)) * DANO + 0.320 + (N >= 2 ? (N - 1) * DANO : 0);
const RIDER = {
    'Prostrado': () => 0.47,                    // catálogo: +0,47 un/rodada contra atacante corpo-a-corpo
    'Amedrontado': () => 0.17,                  // catálogo: 0,17 un/rodada
    'Hemorragia': n => 0.29 * (n || 1),         // catálogo: 0,29 por nível, parado
    'Eletrocutado': n => eletro(n || 1),        // dano (N + metade da Blindagem) + 0,32 por perder a Reação
    'Necrose': n => (1 / U) * (n || 1),         // mesma taxa do Definhado por ponto de VIT Máxima
    'Peçonha': n => 1.16 * (n || 1),            // 2 × 0,58, a taxa do Toxis (Régua §8.6)
    'Veneno Cristalizante': () => 0.63,         // 2 dano/rodada + fração pelo Deslocamento
    'Dilacerar': n => 0.154 * (n || 1),         // espelho do Blindado
    'Náusea': () => 0.10,                       // faixa do Lento, e menos que ele
    'Drenado': n => 0.29 * (n || 1),
    'Entorpecido': () => 0.50, 'Imobilizado': () => 0.33, 'Desorientado': () => 0.17,
    'Corrompido': n => 0.17 * (n || 1), 'Definhado': n => 0.29 * (n || 1),
    'Infecção': () => 0,                        // economia de CENA, 0,00 un em combate
    'Dreno de Luz': () => 0,                    // idem
};

/* Linha que entrega DOIS golpes no mesmo turno — a regra de segunda arma do
   §6.10, escrita como "A. Padrão + A. Movimento … XdY+Z cada". Conta em dobro,
   e é o que faz a Nevara valer 2,67× em vez de 1,33×: sem isto o recarimbo
   REBAIXARIA a ficha, e o erro seria do meu parser, não dela. */
const golpesNaLinha = l => (/segunda arma|A\. Padrão \+ A\. Movimento/.test(l) && /\bcada\b/.test(l)) ? 2 : 1;

const forcaDaFicha = atq => {
    let melhor = 0, det = null;
    for (const l of String(atq).split('\n')) {
        const g = /Alvo (\d+)[^,]*, (\d+d\d+)(?:\+(\d+))?/.exec(l);
        if (!g) continue;
        const P = Math.max(0, Math.min((Math.min(+g[1], 9) - 1) / 10, 0.9));
        const n = golpesNaLinha(l);
        const golpe = n * P * Math.max(1, medio(g[2]) + (g[3] ? +g[3] : 0) - 2) / U;
        let rider = 0; const quais = [];
        for (const [nome, f] of Object.entries(RIDER)) {
            const m = new RegExp(`\\b${nome}\\b(?:\\s+(\\d+))?`).exec(l);
            if (!m) continue;
            rider += f(m[1] ? +m[1] : null) * P;
            quais.push(`${nome}${m[1] ? ' ' + m[1] : ''}`);
        }
        if (golpe + rider > melhor) melhor = golpe + rider, det = { linha: l.trim(), golpe, rider, quais, P };
    }
    return { forca: melhor, det };
};

const npcs = (await db.collection('npcs').get()).docs.map(d => ({ id: d.id, ...d.data() }));
const erros = [], plano = [], quedas = [];

for (const n of npcs) {
    if (n.tipo !== 'criatura' || !n.ataques) continue;
    const am = String(n.criatura?.nivelAmeaca || '');
    const c = (/(\d+,\d+)×/.exec(am) || [])[1];
    if (!c) continue;                                   // sem carimbo numérico, nada a recontar
    const carimbo = Number(c.replace(',', '.'));
    const { forca, det } = forcaDaFicha(n.ataques);
    if (!det || Math.abs(forca - carimbo) < TOLERANCIA) continue;

    const amNovo = am.replace(/^[^·]+·\s*\d+,\d+×/, `${grauDe(forca)} · ${br(forca)}×`);
    if (amNovo === am) { erros.push(`"${n.nome}": não consegui reescrever o começo do nivelAmeaca — "${am.slice(0, 60)}"`); continue; }
    /* TRAVA: carimbo que DESCE quase sempre é o parser daqui deixando de contar
       alguma coisa da ficha — segundo golpe, Transbordo, área —, não a ficha ser
       mais fraca. Foi o que quase aconteceu com a Nevara. Só desce com
       --permitir-queda, e o relatório diz o que precisa ser olhado à mão. */
    if (forca < carimbo && !process.argv.includes('--permitir-queda')) {
        quedas.push({ nome: n.nome, carimbo, forca, det });
        continue;
    }
    plano.push({ nome: n.nome, ref: db.collection('npcs').doc(n.id), mesa: !!n.mesaId,
        carimbo, forca, det, am, amNovo,
        grauAntes: grauDe(carimbo), grauDepois: grauDe(forca), sobe: forca > carimbo });
}

/* ── relatório ── */
console.log(`\n=== Recarimbo · ${plano.length} criaturas fora de sincronia (tolerância ${TOLERANCIA}) ===\n`);
console.log('ficha                     carimbo →   real     Δ       Grau                      o que manda na conta');
for (const p of plano.sort((a, b) => b.forca - a.forca)) {
    const d = p.forca - p.carimbo;
    const mudaGrau = p.grauAntes !== p.grauDepois;
    console.log(
        `${(p.mesa ? '⚑ ' : '  ') + p.nome.slice(0, 23).padEnd(24)} ${(br(p.carimbo) + '×').padStart(7)} → ${(br(p.forca) + '×').padStart(6)}  ${((d > 0 ? '+' : '') + br(d)).padStart(6)}  ` +
        `${(mudaGrau ? `${p.grauAntes} → ${p.grauDepois}` : p.grauAntes).padEnd(24)} ${p.det.quais.join(', ') || '(só o dado)'}`);
}
console.log(`\n   ⚑ = ficha de mesa (mesaId preenchido)`);
if (quedas.length) {
    console.log(`\n⚠ ${quedas.length} ficha(s) em que a conta DEU MENOS que o carimbo — NÃO alteradas.`);
    console.log(`   Carimbo que desce quase sempre é o parser daqui deixando de contar alguma coisa`);
    console.log(`   (segundo golpe, Transbordo, área), não a ficha ser mais fraca:`);
    for (const q of quedas) console.log(`     ${q.nome.padEnd(22)} ${br(q.carimbo)}× → ${br(q.forca)}×   manda: ${q.det.linha.slice(0, 70)}`);
    console.log(`   Para forçar mesmo assim: --permitir-queda`);
}

console.log('\n--- linha a linha ---');
for (const p of plano) {
    console.log(`\n── ${p.nome}${p.mesa ? '  ⚑ mesa' : ''}`);
    console.log(`   de:   ${p.am.slice(0, 105)}`);
    console.log(`   para: ${p.amNovo.slice(0, 105)}`);
    console.log(`   manda: ${p.det.linha.slice(0, 95)}`);
    console.log(`          golpe ${br(p.det.golpe)} + rider ${br(p.det.rider)} (P ${br(p.det.P)}) [${p.det.quais.join(', ') || '—'}]`);
}

if (erros.length) { console.log('\n❌ ERROS — nada foi gravado:'); erros.forEach(e => console.log('   ' + e)); process.exit(1); }
console.log(`\n✅ conferências OK. Só o começo do carimbo muda; densidade, doma, Lealdade e a nota do fim ficam.`);

if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

const iso = new Date().toISOString();
const batch = db.batch();
for (const p of plano) batch.update(p.ref, { 'criatura.nivelAmeaca': p.amNovo, lastUpdate: iso, lastUpdateBy: AUTOR });
await batch.commit();
console.log(`\n✅ ${plano.length} carimbos atualizados.`);
process.exit(0);
