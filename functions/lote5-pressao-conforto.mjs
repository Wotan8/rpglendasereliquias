// =============================================
// LOTE 5 — Pressão/conforto: pressaoBase = peso × conforto no catálogo.
// ---------------------------------------------
// Doutrina de 25/08/2026 (usuário): o multiplicador normal é ×1 e o campo
// fica VAZIO (pressão = peso, sem espelho que defase). Menor que 1 só para
// peça bem distribuída no corpo, muito confortável ou de luxo — ápice ×0,5.
// Maior que 1 para peça desajeitada — teto ×1,5.
//
// Camadas usadas aqui:
//   ×0,5  roupa/manto/máscara/talismã VESTIDO sem função de armadura
//         (o antigo "roupa não conta" do VD Carga vira "conta metade")
//   ×0,7  transporte desenhado para carregar: mochilas e aljavas
//   ×0,8  acolchoados e armadura de pano (o conforto do gambeson)
//   ×0,9  placas AJUSTADAS e couro vestido (distribui, mas é aço: paga 90%)
//   ×1    todo o resto — malha inclusive (pendura no ombro, o clássico
//         mal-distribuído) e TODA arma empunhada
//   ×1,2  desajeitados: Armadura de Torneio, Escudo de Torre, Caixa de Ferro,
//         Besta de Sítio Gélida, Lança de Cavalaria
//   ×1,5  ápice do desconforto: Caixote da Feira
//
// Corte de relevância: peça só entra se |peso×mult − peso| ≥ 0,1 kg — abaixo
// disso a pressão não muda nada na mesa e o campo vazio é mais saudável.
//
//   node functions/lote5-pressao-conforto.mjs            (dry-run)
//   node functions/lote5-pressao-conforto.mjs --apply
// =============================================
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

// id → multiplicador de conforto
const MULT = {
    // ===== ×0,5 — vestidos sem função de armadura =====
    Pj1czgfYLOU5nBMn4NfB: 0.5,   // Roupas Comuns
    '0QGyIzSLKgZMnek2uyT8': 0.5, // Roupas Escuras Simples
    Wp9Fntk5jtqyiunCcsX2: 0.5,   // Roupas Reforçadas
    CSuA8Lr5MMdqK3RJyVVG: 0.5,   // Vestes Litúrgicas Simples
    XJNEz4E7ybunoAyw84VF: 0.5,   // Vestes Tribais Simples
    Vl4KhKxPc3DUhcW9mdAU: 0.5,   // Capa com Capuz Puída
    GDKLHtCLw7GmI0YusFff: 0.5,   // Manto de Patrulha
    JjKICILOqhMOwGm4IORw: 0.5,   // Manto do Viajante
    MtpF4L59vgkE3hxgMCwl: 0.5,   // Manto Negro do Exílio (luxo)
    kCxxM0x6c9ASUq7V309W: 0.5,   // Manto Sussurrante da Fenda
    XHGxem60dILwCa73x22n: 0.5,   // Colete do Jovem Artista
    lCC9zqgxba87JVGmHVPE: 0.5,   // Chapéu do caulos
    DKQOnnFgwTJXwJOT5giA: 0.5,   // Faixa do Trovador Viajante
    '6MCAC8PiAk2DMH6YVki2': 0.5, // Máscara do Aprendiz
    '5DW39caSkGaqWfyqZsXd': 0.5, // Máscara do Ator Silencioso
    c4QmJCS9GRtMeYDCeoDH: 0.5,   // Coração de Osso de Corisco (talismã no cinto)
    p6qm9eEVLI6GVh9smExT: 0.5,   // Talismã Profano do Ouvinte das Sombras
    U5vYWPeeJkBGWFhk9kf1: 0.5,   // Talismã Abissal Rústico
    VDw9lj6sMHQA52XL9CAl: 0.5,   // Talismã Abissal (Objeto)
    // ===== ×0,7 — transporte desenhado =====
    ZaiM8Il1M3bSK4ZRgJb2: 0.7,   // Mochila Grande
    HnIxcU6DDiZs3E6dRi19: 0.7,   // Mochila Maior de Couro
    H6UXwOyWTIpGwUveC9lh: 0.7,   // Mochila Média de Couro
    WULulL3svqyU7eBqI3xU: 0.7,   // Mochila Menor de Couro
    Yfi7pCMbb8qjHzNeKN3Z: 0.7,   // Mochila Pequena de Couro
    SxTTOWcvzqO2kBYMfBe8: 0.7,   // Aljava de Caça
    HKuJ4GCz6MHFh59RDHM1: 0.7,   // Aljava Virotes
    // ===== ×0,8 — acolchoados e pano-armadura =====
    qT6I3ONz391Qexgbyupv: 0.8,   // Gibão Acolchoado
    OvEqX8IqjPPLH51C1seP: 0.8,   // Capuz Acolchoado
    OVY6hazUSCTxOkSQT1cc: 0.8,   // Mangas Acolchoadas
    RUhJ283MYy10wQeqhnHq: 0.8,   // Cinta Acolchoada
    GQKLNw8jE9whdKNTTBpE: 0.8,   // Manto de Linho
    // ===== ×0,9 — placas ajustadas e couro vestido =====
    yQmPAJyVt2llucvps2T9: 0.9,   // Armadura Completa
    OEjQimOjvFLOS8BabuER: 0.9,   // Meia-Armadura
    FHLawkyVZJaxrXK9rrZV: 0.9,   // Cota de Placas
    '9qX5AeuWEeYPHxEqGzmi': 0.9, // Couraça de Placas
    '8XuhaUAmScNwTNi5qCpI': 0.9, // Peitoral de Aço
    qPh5qxN9zNLasEX4stSt: 0.9,   // Brigandina
    TbHJlQuBvlgPUKEhfaBr: 0.9,   // Couro Cravejado
    sddVujtg3XWEHsHy0SsQ: 0.9,   // Couro Reforçado
    OPqT80DIhBtZDNJ3zuLd: 0.9,   // Couro Batido
    PfoooIHJnmiOixMFQs0T: 0.9,   // Couro Leve
    dl0Kdhw9dTHNMc8VpWy9: 0.9,   // Armadura Leve
    LIBKPaaVNVm4zr0iOt7Q: 0.9,   // Elmo de Placas
    '0RyzAAEEZHYPnAVEnjRx': 0.9, // Ombreiras de Placas
    cOClzFEoxw636jLnTREt: 0.9,   // Braçadeiras de Placas
    Uwmp641iRmYgEHMJO5tp: 0.9,   // Grevas de Placas
    '6lh0aTu49jIyhJVKbUkR': 0.9, // Escarpes de Placas
    JvV8QgXOkkr2Y0HH3Nsx: 0.9,   // Faldar de Placas
    IHsxEQ0NlXbocp03RaEJ: 0.9,   // Gorjal de Aço
    '1PJoiDWDyfil7H2VwpBq': 0.9, // Botas Ferradas
    Ri1G1MHRy6NJS4sJQ7at: 0.9,   // Braçadeiras de Couro
    DayPlV9a7zwehj8zQNd8: 0.9,   // Cinturão Rebitado
    // ===== ×1,2 — desajeitados =====
    KqnSLS1ywzKN5t9cpo6f: 1.2,   // Armadura de Torneio (cerimonial, rígida)
    '7ZPRRHEmFsDCl1QwmPaq': 1.2, // Escudo de Torre
    uMqdxwznvzmxwR0tGeg6: 1.2,   // Caixa de Ferro sem Fechadura
    nme5hEDF7At5B6PjBvs0: 1.2,   // Besta de Sítio Gélida
    '5L5mFBoRn6sCkdrFwipK': 1.2, // Lança de Cavalaria
    // ===== ×1,5 — ápice do desconforto =====
    to5FSxkn4Krx1QwypuRx: 1.5,   // Caixote da Feira
};

const snap = await db.collection('system/data/equipment').get();
const cat = new Map();
snap.forEach(d => cat.set(d.id, { id: d.id, ...d.data() }));

const linhas = [];
const writes = [];
for (const [id, mult] of Object.entries(MULT)) {
    const x = cat.get(id);
    if (!x) { console.log(`❌ id não existe no catálogo: ${id}`); process.exit(1); }
    const alvo = Math.round(Number(x.peso) * mult * 100) / 100;
    if (Math.abs(alvo - Number(x.peso)) < 0.1) {
        linhas.push(`  (corte) ${x.nome}: ${x.peso} ×${mult} = ${alvo} — diferença < 0,1 kg, fica vazio`);
        continue;
    }
    linhas.push(`  ${x.nome} [${x.tipo}] · peso ${x.peso} ×${mult} → pressão ${alvo}${x.pressaoBase != null ? ` (tinha ${x.pressaoBase})` : ''}`);
    writes.push([id, alvo]);
}
console.log(`${writes.length} peças recebem pressaoBase (de ${Object.keys(MULT).length} avaliadas):\n`);
linhas.sort().forEach(l => console.log(l));

// quem já tem pressaoBase e NÃO está na lista? (não deveria existir)
let fora = 0;
cat.forEach(x => { if (x.pressaoBase != null && x.pressaoBase !== '' && !MULT[x.id]) { fora++; console.log(`⚠️ pressaoBase fora da doutrina: ${x.nome} = ${x.pressaoBase}`); } });
if (!fora) console.log('\n(nenhuma peça fora da lista tem pressaoBase — campo vazio = ×1 ✓)');

if (!APLICAR) { console.log('\nDRY-RUN — rode com --apply para gravar.'); process.exit(0); }
const agora = new Date().toISOString();
const batch = db.batch();
for (const [id, alvo] of writes) {
    batch.update(db.collection('system/data/equipment').doc(id), { pressaoBase: alvo, atualizadoEm: agora, updatedAt: agora });
}
await batch.commit();
console.log(`\n✅ ${writes.length} peças com pressaoBase gravada.`);
process.exit(0);
