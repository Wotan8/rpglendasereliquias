// =============================================
// LOTE 1 do passe de realismo — as 68 Armas de system/data/equipment.
// ---------------------------------------------
// Decisões de 25/08/2026: peso em kg e tamanho em METROS (maior dimensão da
// peça; peça flexível — funda, rede, boleadeira — mede ENROLADA/dobrada,
// porque alcance é campo próprio e a Integridade sai do porte físico real).
// Dimensão citada na descrição da peça é canônica e vence a referência
// histórica (Garnute 80 cm, Menin 45 cm, Sítio Gélida 1,10 m, celene 22 cm,
// Karu 35 cm, Sussurro Final lâmina de 30 cm → 45 cm com o cabo).
//
//   node functions/lote1-armas-peso-tamanho.mjs            (dry-run: tabela)
//   node functions/lote1-armas-peso-tamanho.mjs --apply
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
    // ===== A DISTÂNCIA =====
    xQEojSDVgH9sFm6vbk33: [1.1, 1.3],    // Arco Composto
    '39ZKSAczI4qKglgKS4TM': [1.2, 1.9],  // Arco de Guerra
    ALb2U5upOCyBKPIojPxI: [0.6, 0.8],    // Arco Garnute (desc: ~80 cm)
    sfzp6riivr1eUmK39J49: [0.9, 1.8],    // Arco Longo
    tTzxihbagzkqxiuE6GFa: [0.7, 1.5],    // Arco Simples
    '7kl4ZoxZOZBRBKZc6e3b': [2.5, 0.7],  // Besta de Caça
    ARdYzBjOifuTbnUHcmC3: [1.5, 0.4],    // Besta de Mão
    h90MpVpEdT4AF2RbMjCc: [4, 0.9],      // Besta de Repetição
    nme5hEDF7At5B6PjBvs0: [7, 1.1],      // Besta de Sítio Gélida (desc: 1,10 m)
    DfdBrVOvQbnVCwweDL37: [3, 0.75],     // Besta Leve
    rBpuYjfve54tvYkyI7tQ: [1.2, 0.45],   // Besta Menin (desc: ~45 cm)
    d0X0lhpP8gpi3j3RGO6i: [5.5, 0.95],   // Besta Pesada
    Fred4GA8MITv3xHeS0uX: [0.1, 0.15],   // Funda (tira enrolada)
    // ===== DUAS MÃOS =====
    RnaMs4juBMJhCqOZ7Esz: [3, 2.2],      // Alabarda
    tckYT8dyitEVHPOfm6dC: [0.5, 1.1],    // Arco Curto
    '9dYW9o9ko7S2MKyP5O5B': [1.8, 1.8],  // Bordão ("altura de um homem")
    fQX7FeyoQzRn0fWjF3iX: [1.5, 1.3],    // Espada Simples
    f2wooet91dGJubk6ucZZ: [3.5, 2],      // Espinho Uqatá
    WG7r3Bowo4fdOTROTvbw: [2.2, 1.9],    // Ferrão Uqatá
    qB2TvAOUt3cQop1SO2Z6: [2.8, 1.9],    // Foice de Guerra
    lHRwLrC9bKKOWFH44Bjw: [2.3, 1.8],    // Foice Simples de Guerra
    '9CPVRnb24yJ4a9vBPaXY': [2.8, 2.1],  // Glaive
    '5L5mFBoRn6sCkdrFwipK': [3.5, 3.2],  // Lança de Cavalaria
    rQOmsY8TSDF8SnRwbjAj: [2.5, 1.5],    // Machado de Guerra
    qJGHrnjWLgGhgfiHDIUY: [0.8, 0.35],   // Machado de Mão Karu (desc: 35 cm)
    jzhk402MrhKGdsMQ2jPK: [4.5, 1.4],    // Malho
    OemmZAmIu76vCoaUDtFz: [5, 1.2],      // Marreta de Guerra
    MpbogmywsSlZYqpetKum: [3, 1.7],      // Montante
    // ===== ESCUDOS =====
    EeT7vga2tQpZY3EMODla: [1.2, 0.35],   // Broquel
    '7ZPRRHEmFsDCl1QwmPaq': [6, 1.4],    // Escudo de Torre
    rOFaQ9s3vpZVZx35p1Z5: [4, 1.1],      // Escudo Grande
    qLcoeoXdCi0l0lV5clon: [3, 0.8],      // Escudo Médio
    // ===== UMA MÃO =====
    tqh4k3DsBOu4Im5Vm9W8: [0.35, 0.35],  // Adaga
    QpC1CfQjKuyNzg9AB3mb: [0.3, 0.3],    // Adaga de Arremesso
    JN0zgbZo5jYLHT1Lh7nE: [0.5, 0.35],   // Adaga de Lastro (lastro pesa)
    zi9TIukmEuSgdjcbvChZ: [0.3, 0.3],    // Adaga simples (desc: 15–40 cm)
    ecLZzzPwJsCaxmaVbYxG: [0.8, 1.8],    // Azagaia
    ZTxdg3gAcYLFMGptLRKu: [1, 0.4],      // Boleadeira (enrolada)
    '9M9OjweNmVvALEOZpNGY': [1.5, 0.7],  // Clava
    HfxLe6LAYMjKe7kkYxyc: [0.2, 0.4],    // Dardo
    JHLWAH2vFJ0czPBuNE3y: [0.9, 0.75],   // Espada Curta
    Rw8xvD7MehCYboC2kV0F: [1.2, 0.95],   // Espada de Infantaria
    nq1EwX8xTZGaXLsurtv8: [1.3, 1.1],    // Espada Longa
    '0B9kaEhyRF30FU4jXJxE': [0.2, 0.3],  // Estilete
    VtMEOudwZVJpHyaDAZSO: [1.2, 1.1],    // Estoque
    n21SPgsSuaXRXCX2n0Gi: [0.2, 0.25],   // Faca
    bMmHtD2rbJTRuljt2zZq: [0.25, 0.22],  // Faca celene (desc: 22 cm)
    dgT1AVqh2QrI7l72TkvX: [0.2, 0.25],   // Faca de Arremesso
    mEyQV5HlCsL5iPNCLPUO: [0.3, 0.28],   // Faca de Caça
    rx9OlLlwgGWmVt7so70k: [0.15, 0.2],   // Faca de Sangria
    N9sXCo7WXH6fv0gBIGXo: [1.2, 0.9],    // Farpa Uqatá
    fbs4aSXhMFXFDr82gvRQ: [1, 0.85],     // Ferpa Uqatá
    XzIqmNboZb0tPfn4AFqK: [1.2, 1.5],    // Lança Curta
    vl5EvBLTXqxg5ABO6z4s: [1.2, 0.6],    // Maça
    bNt5yNkStpz4sSbe0ASI: [1.5, 0.65],   // Maça de Armas
    pWy6N9gaGCTp5Md5SGts: [0.7, 0.4],    // Machadinha
    IxU3Z7xlQCMvGGhOLyzN: [1.5, 0.75],   // Machado de Batalha
    uo8HaioqjXpRpJGRhaKj: [2, 0.9],      // Mangual (cabo + corrente + peso)
    '2iCZWB05YIm3WdmbcuWm': [0.4, 0.45], // O Sussurro Final (lâmina 30 cm + cabo)
    ewJXDAEZRP0IhPSDjrxr: [1, 0.6],      // Porrete
    '5oRLKAX8zfbOKG8CLhJA': [0.4, 0.4],  // Punhal
    HXuX8ieCB6yQUJ0YMH8m: [3, 0.5],      // Rede (dobrada)
    XsXFh4LEpPFb0oJNOemz: [1, 0.95],     // Sabre
    Ev2ESpLWUrlrz4ud8sLl: [0.25, 0.12],  // Soqueira
    // ===== VERSÁTEIS =====
    JLWh4To2pYcRP8YtHxWz: [1.6, 1.2],    // Espada Bastarda
    I0rWcP0xXoOE0IiqeDZo: [1.8, 2],      // Lança
    DtocQ5yqLVrb1SXJDwmS: [2, 0.8],      // Martelo de Guerra
    odZdyNazveb8FHH6qazd: [2, 1.9],      // Tridente
};

// espelha integridadeMax do motor (liga vazia lê 1)
const integ = (liga, tam) => Math.max(3, Math.round(((Number.isFinite(Number(liga)) ? Number(liga) : 1) + tam * 3) * 3));

const snap = await db.collection('system/data/equipment').get();
const armas = [];
snap.forEach(d => { const x = d.data(); if ((x.tipo || '') === 'Arma') armas.push({ id: d.id, ...x }); });

const semProposta = armas.filter(a => !PROPOSTA[a.id]);
const idsExtras = Object.keys(PROPOSTA).filter(id => !armas.some(a => a.id === id));
if (semProposta.length || idsExtras.length) {
    for (const a of semProposta) console.log(`❌ arma sem proposta: ${a.nome} (${a.id})`);
    for (const id of idsExtras) console.log(`❌ id na proposta não é arma do catálogo: ${id}`);
    process.exit(1);
}

console.log('Arma | peso kg | tamanho m | Integridade');
for (const a of armas.sort((x, y) => (x.nome || '').localeCompare(y.nome || '', 'pt-BR'))) {
    const [p, t] = PROPOSTA[a.id];
    console.log(`${a.nome} | ${a.peso} → ${p} | ${a.tamanho} → ${t} | ${integ(a.liga, Number(a.tamanho) || 1)} → ${integ(a.liga, t)}`);
}

if (!APLICAR) { console.log('\nDRY-RUN — rode com --apply para gravar.'); process.exit(0); }
const agora = new Date().toISOString();
const batch = db.batch();
for (const a of armas) {
    const [peso, tamanho] = PROPOSTA[a.id];
    batch.update(db.collection('system/data/equipment').doc(a.id), { peso, tamanho, atualizadoEm: agora, updatedAt: agora });
}
await batch.commit();
console.log(`\n✅ ${armas.length} armas atualizadas.`);
process.exit(0);
