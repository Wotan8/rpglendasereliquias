// =============================================
// LOTE 2 do passe de realismo — as 51 Vestimentas de system/data/equipment.
// ---------------------------------------------
// Mesmas regras do lote 1: kg e METROS (maior dimensão na forma própria da
// peça; tira/faixa mede enrolada). Dimensão citada na descrição é canônica
// (Armadura Leve 95 cm, Colete 65 cm, Manto de Patrulha 110 cm, Manto Negro
// 1,60 m, Sussurrante 1,5 m, Luvas Furtivas 22 cm, máscaras 15–22 cm, Chapéu
// do caulos aba 35 cm, Faixa do Trovador 45 cm). Par (botas, grevas, luvas)
// pesa como o par e mede uma peça. NÃO mexe em pressaoBase — a regra do Livro
// "roupa não conta Carga" depende de consertar mechanics-engine.js:545 antes.
//
//   node functions/lote2-vestimentas-peso-tamanho.mjs            (dry-run)
//   node functions/lote2-vestimentas-peso-tamanho.mjs --apply
// =============================================
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

// id → [peso kg, tamanho m]
const PROPOSTA = {
    // ===== ARMADURAS DE CORPO =====
    yQmPAJyVt2llucvps2T9: [25, 1.7],     // Armadura Completa (traje inteiro de placas)
    KqnSLS1ywzKN5t9cpo6f: [30, 1.7],     // Armadura de Torneio
    OEjQimOjvFLOS8BabuER: [15, 1.3],     // Meia-Armadura
    FHLawkyVZJaxrXK9rrZV: [18, 1.2],     // Cota de Placas (placas sobre malha)
    '9qX5AeuWEeYPHxEqGzmi': [7, 0.7],    // Couraça de Placas
    qPh5qxN9zNLasEX4stSt: [9, 0.9],      // Brigandina
    EapXrA8DJoDNcVuLohEw: [10, 1],       // Cota de Malha (camisão até a coxa)
    '8XuhaUAmScNwTNi5qCpI': [5.5, 0.65], // Peitoral de Aço
    TbHJlQuBvlgPUKEhfaBr: [6, 0.95],     // Couro Cravejado
    sddVujtg3XWEHsHy0SsQ: [5, 0.95],     // Couro Reforçado
    OPqT80DIhBtZDNJ3zuLd: [4, 0.9],      // Couro Batido
    PfoooIHJnmiOixMFQs0T: [3, 0.9],      // Couro Leve
    qT6I3ONz391Qexgbyupv: [3, 0.9],      // Gibão Acolchoado
    dl0Kdhw9dTHNMc8VpWy9: [3.5, 0.95],   // Armadura Leve (desc: gibão 95 cm)
    GQKLNw8jE9whdKNTTBpE: [2, 1.2],      // Manto de Linho
    // ===== PEÇAS DE PLACAS AVULSAS =====
    LIBKPaaVNVm4zr0iOt7Q: [3, 0.35],     // Elmo de Placas
    '0RyzAAEEZHYPnAVEnjRx': [3, 0.4],    // Ombreiras de Placas (par)
    cOClzFEoxw636jLnTREt: [2.5, 0.45],   // Braçadeiras de Placas (par)
    Uwmp641iRmYgEHMJO5tp: [4, 0.7],      // Grevas de Placas (par)
    '6lh0aTu49jIyhJVKbUkR': [2.5, 0.3],  // Escarpes de Placas (par)
    JvV8QgXOkkr2Y0HH3Nsx: [2.5, 0.45],   // Faldar de Placas
    IHsxEQ0NlXbocp03RaEJ: [1.5, 0.25],   // Gorjal de Aço
    // ===== AVULSAS MÉDIAS E LEVES =====
    '1PJoiDWDyfil7H2VwpBq': [2.5, 0.45], // Botas Ferradas (par)
    Ri1G1MHRy6NJS4sJQ7at: [1, 0.35],     // Braçadeiras de Couro (par)
    '14XT1pPGoWf601QR8CTP': [6, 0.9],    // Calças de Malha (par de chausses)
    uRi57lm8Tgbl2wiAsd3a: [1.5, 0.4],    // Coifa de Malha
    FNrOwjvpgRs6VkTSevfL: [1.5, 0.35],   // Gorjal de Malha
    DayPlV9a7zwehj8zQNd8: [1.2, 0.2],    // Cinturão Rebitado (enrolado)
    RUhJ283MYy10wQeqhnHq: [0.8, 0.2],    // Cinta Acolchoada (enrolada)
    OvEqX8IqjPPLH51C1seP: [0.5, 0.3],    // Capuz Acolchoado
    OVY6hazUSCTxOkSQT1cc: [1, 0.55],     // Mangas Acolchoadas (par)
    o3wNRICjaIRKGJdbBC5X: [0.4, 0.2],    // Gola de Couro
    // ===== ROUPAS, MANTOS, MÁSCARAS, LUVAS =====
    Pj1czgfYLOU5nBMn4NfB: [1.5, 1],      // Roupas Comuns
    '0QGyIzSLKgZMnek2uyT8': [1.2, 1],    // Roupas Escuras Simples
    Wp9Fntk5jtqyiunCcsX2: [2, 1],        // Roupas Reforçadas
    CSuA8Lr5MMdqK3RJyVVG: [1.2, 1.3],    // Vestes Litúrgicas Simples (túnica longa)
    XJNEz4E7ybunoAyw84VF: [1.5, 1.1],    // Vestes Tribais Simples
    Vl4KhKxPc3DUhcW9mdAU: [1.5, 1.4],    // Capa com Capuz Puída
    GDKLHtCLw7GmI0YusFff: [1.8, 1.1],    // Manto de Patrulha (desc: 110 cm)
    JjKICILOqhMOwGm4IORw: [2, 1.4],      // Manto do Viajante
    MtpF4L59vgkE3hxgMCwl: [2.2, 1.6],    // Manto Negro do Exílio (desc: 1,60 m)
    kCxxM0x6c9ASUq7V309W: [2, 1.5],      // Manto Sussurrante da Fenda (desc: 1,5 m)
    XHGxem60dILwCa73x22n: [0.8, 0.65],   // Colete do Jovem Artista (desc: 65 cm)
    lCC9zqgxba87JVGmHVPE: [0.3, 0.35],   // Chapéu do caulos (desc: aba 35 cm)
    DKQOnnFgwTJXwJOT5giA: [0.3, 0.45],   // Faixa do Trovador Viajante (desc: 45 cm)
    jZ0i7FnUiUw2XxSUGNkq: [0.2, 0.25],   // Luvas de couro (par)
    aZnRyMeAZ3dvYvwGEJRC: [0.15, 0.22],  // Luvas Furtivas (desc: 22 cm)
    NkG8ZvCHz73OwJRGbuaF: [0.1, 0.15],   // Máscara de Furtividade Noturna (15 cm)
    '6MCAC8PiAk2DMH6YVki2': [0.3, 0.2],  // Máscara do Aprendiz (20 cm)
    '5DW39caSkGaqWfyqZsXd': [0.3, 0.22], // Máscara do Ator Silencioso (22 cm)
    WWNKTRlbuCufdq65bC1S: [0.1, 0.15],   // Máscara do Corredor Silencioso (meia-face)
};

const integ = (liga, tam) => Math.max(3, Math.round(((Number.isFinite(Number(liga)) ? Number(liga) : 1) + tam * 3) * 3));

const snap = await db.collection('system/data/equipment').get();
const pecas = [];
snap.forEach(d => { const x = d.data(); if ((x.tipo || '') === 'Vestimenta') pecas.push({ id: d.id, ...x }); });

const semProposta = pecas.filter(a => !PROPOSTA[a.id]);
const idsExtras = Object.keys(PROPOSTA).filter(id => !pecas.some(a => a.id === id));
if (semProposta.length || idsExtras.length) {
    for (const a of semProposta) console.log(`❌ vestimenta sem proposta: ${a.nome} (${a.id})`);
    for (const id of idsExtras) console.log(`❌ id na proposta não é vestimenta do catálogo: ${id}`);
    process.exit(1);
}

console.log('Peça | peso kg | tamanho m | Integridade');
for (const a of pecas.sort((x, y) => (x.nome || '').localeCompare(y.nome || '', 'pt-BR'))) {
    const [p, t] = PROPOSTA[a.id];
    console.log(`${a.nome} | ${a.peso} → ${p} | ${a.tamanho} → ${t} | ${integ(a.liga, Number(a.tamanho) || 1)} → ${integ(a.liga, t)}`);
}

if (!APLICAR) { console.log('\nDRY-RUN — rode com --apply para gravar.'); process.exit(0); }
const agora = new Date().toISOString();
const batch = db.batch();
for (const a of pecas) {
    const [peso, tamanho] = PROPOSTA[a.id];
    batch.update(db.collection('system/data/equipment').doc(a.id), { peso, tamanho, atualizadoEm: agora, updatedAt: agora });
}
await batch.commit();
console.log(`\n✅ ${pecas.length} vestimentas atualizadas.`);
process.exit(0);
