// =============================================
// LOTE 4 (final) do passe de realismo — Consumíveis (21), Containers (11),
// Acessórios (8), Projéteis (5) e Relíquia (1) de system/data/equipment.
// ---------------------------------------------
// Mesmas regras dos lotes 1–3. Consumível = a porção/frasco servido; loções
// padronizadas em 0,2 kg / 10 cm. Mochila Média fica em 0,60 m — é a âncora
// publicada no Livro §5 (Integridade 11). Além de peso/tamanho, este lote
// conserta DOIS tetos absurdos de contêiner de moedas (aviso de sobrecarga):
// Bolsa de Couro (Luns) 300 kg → 3 kg e Saco de Luns Simples 20 kg → 10 kg
// (mil luns = 10 kg). Nenhum outro pesoMaximoContainer muda.
//
//   node functions/lote4-resto-peso-tamanho.mjs            (dry-run)
//   node functions/lote4-resto-peso-tamanho.mjs --apply
// =============================================
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

// id → [peso kg, tamanho m, pesoMaximoContainer?]
const PROPOSTA = {
    // ===== ACESSÓRIOS =====
    DEZWXEsiCgFnRhHPcoxx: [0.8, 0.9],    // Bengala do Patriarca (desc: 90 cm)
    RMZlTk9r5ROpcQZkRt1y: [0.6, 0.2],    // Binóculos do Cartógrafo (desc: 20 cm)
    tXdWU1HQAM1VBtLuDTLK: [0.05, 0.05],  // Broche da Guilda (desc: 5 cm)
    c4QmJCS9GRtMeYDCeoDH: [0.3, 0.15],   // Coração de Osso de Corisco (desc: 15 cm)
    '2Sez6XESV6JZ24I3P3JI': [0.1, 0.12], // Símbolo Sagrado de Madeira
    U5vYWPeeJkBGWFhk9kf1: [0.2, 0.15],   // Talismã Abissal Rústico
    p6qm9eEVLI6GVh9smExT: [0.3, 0.15],   // Talismã Profano do Ouvinte (desc: 15 cm)
    B1SlFYC6gyP7wxjzhtOr: [0.1, 0.12],   // Talismã Profano Rústico
    // ===== CONSUMÍVEIS =====
    MiRv1nQZ3H3duwUyhhWK: [0.2, 0.15],   // Bandagens de Linho (rolo)
    wba7TSTKTBR9S4qwVt6R: [2, 0.4],      // Carne de Penacho-Bravo Alfa (peito)
    yOwBcss9bs1Evpb16Kgu: [0.6, 0.15],   // Cerveja de Cevada (caneca)
    NFcOb4vnE9K39gBgXdQm: [0.1, 0.2],    // Cheiro Verde de Vasteluna (maço)
    rvaarhqUkQa1QFr9rvcV: [0.6, 0.2],    // Ensopado do Dia (tigela)
    U4dRS6S4ysxgzDNNYrvE: [0.3, 0.12],   // Frascos de Dosagem de Cerâmica
    nXEruOrsAjsBZIHlTJMl: [0.6, 0.15],   // Hidromel da Casa (caneca)
    WkLvyzZS2n3TbxZGc1li: [0.1, 0.2],    // Incenso Consagrado (bastões)
    SpKeEyHMo7ZbbExuPPbP: [0.5, 0.2],    // Kit de Primeiros Socorros (bolsa)
    ZN565lYKFOziTQV9FisN: [0.2, 0.1],    // Loção de Cegueira I
    CM8bvIExn78DrmtPv0EH: [0.2, 0.1],    // Loção de cura 2 (+4)
    '1sNbpAQ5klaO5Ornmho5': [0.2, 0.1],  // Loção de Medo I
    '0Tw0DY3JnqzgouK9D1pv': [0.2, 0.1],  // Loção Paralisante I
    GCX5abqvMBYrsiLwK5Be: [0.5, 0.25],   // Pão Rústico
    tAfq54u9t3iu8KEdNAIg: [0.1, 0.1],    // Pó de Cristal de Sono (papel encerado)
    w9FYAeJfE9oBlquTW7OH: [0.4, 0.15],   // Pó de Derrubada (saquinho)
    tMVVZecDHs9gqYjTcY8F: [0.5, 0.15],   // Porção de Água Potável
    qqnIrgYkQxPPIiciZzfP: [0.5, 0.15],   // Porção de Hidromel
    Z40KL4WAUNN8yGAlGahU: [0.5, 0.2],    // Ração de viagem (pacote/dia)
    N5RTIn5wkUoeMS6TGDvX: [0.2, 0.15],   // Vela que Não Apaga com Vento
    kaEU53gZAtPjS7mz9Vn5: [1, 0.3],      // Vinho Tinto (garrafa)
    // ===== CONTAINERS (3º valor = pesoMaximoContainer, só onde muda) =====
    SxTTOWcvzqO2kBYMfBe8: [0.5, 0.75],       // Aljava de Caça (desc: 75 cm)
    HKuJ4GCz6MHFh59RDHM1: [0.5, 0.35],       // Aljava Virotes (desc: 35 cm)
    TUjJU3tmhRqiK4OwhKxo: [0.05, 0.12, 3],   // Bolsa de Couro (Luns) — teto 300→3
    dVPAnCIFH6Br5wBjGzgb: [0.05, 0.1, 10],   // Saco de Luns Simples — teto 20→10
    uMqdxwznvzmxwR0tGeg6: [6, 0.5],          // Caixa de Ferro ("dois antebraços")
    to5FSxkn4Krx1QwypuRx: [8, 1],            // Caixote da Feira
    ZaiM8Il1M3bSK4ZRgJb2: [2, 0.7],          // Mochila Grande
    HnIxcU6DDiZs3E6dRi19: [3, 0.5],          // Mochila Maior de Couro (desc: 50 cm)
    H6UXwOyWTIpGwUveC9lh: [2, 0.6],          // Mochila Média de Couro (âncora do Livro §5)
    WULulL3svqyU7eBqI3xU: [1.2, 0.3],        // Mochila Menor de Couro (desc: 30 cm)
    Yfi7pCMbb8qjHzNeKN3Z: [0.8, 0.25],       // Mochila Pequena de Couro
    // ===== PROJÉTEIS =====
    iOcXbhorJm76fopr6cWT: [0.05, 0.7],   // Flecha de Penacho (desc: 70 cm)
    BIAzUVkYHmHBgB44IkGh: [0.05, 0.7],   // Flecha de Penacho Envenenada +1
    JtnD7ZWxWpA1D4WPXbRC: [0.08, 0.4],   // Virote Perfurante
    YSxegZYHfaxOtpjI3Rkw: [1.2, 1.7],    // Lança de Simples (desc: 1,70 m)
    jub45wicHxglhXgoOhWs: [0.5, 1.1],    // Zarabatana da Víbora Uqatá (desc: 1,10 m)
    // ===== RELÍQUIA =====
    hTqKivrhSnVFzYzbyrLM: [0.8, 0.3],    // Especulum Fatu (espelho de mão)
};

const integ = (liga, tam) => Math.max(3, Math.round(((Number.isFinite(Number(liga)) ? Number(liga) : 1) + tam * 3) * 3));

const TIPOS = ['Consumível', 'Container', 'Acessório', 'Projétil', 'Relíquia'];
const snap = await db.collection('system/data/equipment').get();
const pecas = [];
snap.forEach(d => { const x = d.data(); if (TIPOS.includes(x.tipo || '')) pecas.push({ id: d.id, ...x }); });

const semProposta = pecas.filter(a => !PROPOSTA[a.id]);
const idsExtras = Object.keys(PROPOSTA).filter(id => !pecas.some(a => a.id === id));
if (semProposta.length || idsExtras.length) {
    for (const a of semProposta) console.log(`❌ peça sem proposta: ${a.nome} (${a.id})`);
    for (const id of idsExtras) console.log(`❌ id na proposta não é do lote: ${id}`);
    process.exit(1);
}

console.log('Peça | peso kg | tamanho m | Integridade | teto contêiner');
for (const a of pecas.sort((x, y) => (x.tipo + x.nome).localeCompare(y.tipo + y.nome, 'pt-BR'))) {
    const [p, t, pmax] = PROPOSTA[a.id];
    const teto = pmax != null ? ` | pmax ${a.pesoMaximoContainer} → ${pmax}` : '';
    console.log(`[${a.tipo}] ${a.nome} | ${a.peso} → ${p} | ${a.tamanho} → ${t} | ${integ(a.liga, Number(a.tamanho) || 1)} → ${integ(a.liga, t)}${teto}`);
}

if (!APLICAR) { console.log('\nDRY-RUN — rode com --apply para gravar.'); process.exit(0); }
const agora = new Date().toISOString();
const batch = db.batch();
for (const a of pecas) {
    const [peso, tamanho, pmax] = PROPOSTA[a.id];
    const upd = { peso, tamanho, atualizadoEm: agora, updatedAt: agora };
    if (pmax != null) upd.pesoMaximoContainer = pmax;
    batch.update(db.collection('system/data/equipment').doc(a.id), upd);
}
await batch.commit();
console.log(`\n✅ ${pecas.length} peças atualizadas (2 tetos de contêiner corrigidos).`);
process.exit(0);
