// =============================================
// LOTE 3 do passe de realismo — os 88 Objetos de system/data/equipment.
// ---------------------------------------------
// Mesmas regras dos lotes 1–2: kg e METROS (maior dimensão na forma própria;
// papel/pergaminho na folha ou no rolo; descrição canônica vence). Padrões
// deste lote: ERVA/INGREDIENTE = porção de boticário (0,1 kg / 15 cm, salvo
// exceção com forma própria); RECEITA = pergaminho enrolado (50 g / 25 cm);
// TOTEM mantém o peso já deliberado da frente de Totemancia e conserta só o
// tamanho (que veio copiado do peso — seixo de rio não tem 1,6 m).
//
//   node functions/lote3-objetos-peso-tamanho.mjs            (dry-run)
//   node functions/lote3-objetos-peso-tamanho.mjs --apply
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
    // ===== INGREDIENTES (porção de boticário) =====
    t6ipNS6cTLJhlgHX4N1Z: [0.1, 0.15],   // Acônito
    LBsALJ4rlzAFrKBtP9r0: [0.1, 0.15],   // Aroeira
    NgyzrzpxUKnGbcwhRiUd: [0.1, 0.15],   // Arruda
    e8KHCoRwyYBYh8PiKFuq: [0.3, 0.3],    // Babosa (folha gorda)
    vhVFAkuS3R3YFCJG3X0T: [0.1, 0.15],   // Beladona
    sJjE3TI77XM0ae2QkzcC: [0.1, 0.2],    // Casca de Salgueiro-Branco
    bj61HicMGmOy95RtVSZD: [0.1, 0.15],   // Cicuta
    GumGBmjJ7u7uOVCAQiPs: [0.1, 0.15],   // Confrei
    '9qZT3r0chsNJUMysLn65': [0.1, 0.15], // Dedaleira
    '8taAy9XiMra95tdqLJxj': [0.2, 0.25], // Flor-Cadáver
    u1afHRdtd0WH4PHwOaI2: [0.1, 0.12],   // Fungo-do-Véu
    WFcIyOYYd90edMxwfcqN: [0.1, 0.15],   // Hortelã-Brava
    greuFte5Z2I2EkTNgoPj: [0.1, 0.15],   // Losna
    ZIepksQ5MjpqqZD7Tu9l: [0.3, 0.25],   // Mandrágora (raiz)
    mcgR8aezNBRGoYkH8q7H: [0.1, 0.12],   // Olho-de-Boneca
    o4xIxLOQ0IVqqvTusxc0: [0.1, 0.15],   // Papoula-Parda
    '7jDLyP7Ez3zVuqsjzHNt': [0.1, 0.15], // Rosa-de-Jericó
    '5JFWkqtcrQoqTCPgc5YT': [0.1, 0.1],  // Sangue-de-Dragão (resina)
    O8R84PUXnkPiUIYtPV5t: [0.1, 0.15],   // Sempre-Viva
    zOhwsDs8DTy93XlvHcTd: [0.1, 0.15],   // Urtiga
    mBYAkcgVV5vXtgBFMRhL: [0.1, 0.15],   // Valeriana
    l3xg8tJSRpMheGpredbJ: [0.1, 0.15],   // Visco
    '8eiF9MQZW7lN8KEZQ8eq': [0.5, 0.1],  // Cinábrio (minério)
    BvIi0UyHlHynC48sAfBr: [0.5, 0.15],   // Sal-Gema
    // ===== MOEDAS =====
    PkSO0Iwuzq2StIR2VZfN: [0.01, 0.02],  // Lun (mantém — já real)
    '2qm8MqA4GEK0wioPUbCb': [0.1, 0.06], // Ka'Lun (mantém — já real)
    xCpMZhd5GNIc0ESZF03w: [0.02, 0.03],  // Moeda Sombria
    // ===== MATÉRIAS (penas) =====
    dUScqh1LLZ9m4PSA5VZu: [0.01, 0.4],   // Pena de Urubu Rei-Coveiro (desc: 35–45 cm)
    H7LChx1TQBsLmePHZOpp: [0.3, 0.4],    // Penas Duras de Penacho-Bravo Alfa (desc: 30–40 cm)
    // ===== INSTRUMENTOS =====
    zu6yhZRwFznRXoj6cgZQ: [2, 1],        // Alaúde Clássico
    uYZKGtwtmi68XVmtoimL: [0.05, 0.12],  // Apito Druida de Osso
    GQiDu8Bw4dLeAja8ZrvJ: [0.3, 0.25],   // Chocalho Cerimonial
    hzrTF9PautsYA0B1gC79: [1.5, 0.35],   // Címbalos (par)
    '2elmpmL3TjW22jEASsiD': [0.3, 0.4],  // Flauta de Madeira ("cabe no bolso")
    '81WnI7zFLygaORmPtywF': [3, 0.6],    // Gaita de Foles
    UcuTS6SIICgzA7KUlSrU: [4, 0.9],      // Harpa de Colo
    rHr6E0mToDxKoxbLNQax: [0.5, 0.25],   // Pandeireta
    hWBKRFGAwN60ZkfCKX5Q: [1.5, 0.6],    // Rabeca
    dk3XYSvu1vCIrXwkh7n6: [1.5, 0.35],   // Tambor de Mão
    BuuflbY9vKUzEPQHQsXJ: [1.5, 0.5],    // Trompa de Caça
    // ===== TOMOS E DOCUMENTOS =====
    ZXon8rjIoro7EzjifTwh: [0.3, 0.2],    // Caderno de Notas de Vasteluna ("bolso")
    ynGSpNTfW4smW1jbR7sf: [0.4, 0.25],   // Diário de Necromancia
    '1jBOsEW8QtAVVJqdXbFc': [0.4, 0.25], // Diário de Rituais em Branco
    Nd2JdAK9XjYop7I81VrZ: [1, 0.3],      // Grimório de Aprendiz
    zH3r3yRMySu5jMmnXHMm: [1.5, 0.3],    // Grimório dos Ecos Cifrados (desc: 30 cm)
    mddq8NgwrjGFJpevguI0: [0.1, 0.3],    // Os Contos de Thalion Vassek (papéis dobrados)
    fKYCiMFjxuqocb2UJxtE: [0.05, 0.3],   // Planta do Subsolo de Velmora (mapa dobrado)
    qSyAYnU87bEryafc6i0J: [0.05, 0.25],  // Receita — Corrosiva Simples I
    vCoezoJDvihow6SaoHay: [0.05, 0.25],  // Receita — Antídoto Simples I
    kCZ7ibEq80PpuU1buXlj: [0.05, 0.25],  // Receita — Cura Rápida
    lK8uZKd0rECHB53Bq8Vv: [0.05, 0.25],  // Receita — Estímulo Simples I
    RkwfQF5bE3IxQtVlMWlp: [0.05, 0.25],  // Receita — Regeneração Simples I
    '0rsmkjnfEeRq5tL6GLXx': [0.05, 0.25],// Receita — Veneno Simples I
    DVTcjzoXM1mEd6nCrPue: [0.05, 0.25],  // Receita — Entorpecente Simples I
    ovKeecjK9HFRd0lML1dL: [0.05, 0.25],  // Receita — Ilusória Simples I
    przvBeVLIk1Nmvczmlge: [0.02, 0.3],   // Papel de Gravação (folha)
    LJCHobW008VRvITcj7tV: [0.05, 0.3],   // Papel Rúnico (folhas)
    // ===== KITS E ESTOJOS =====
    p0YHj0wCBTipnL2sAZ1P: [0.3, 0.2],    // Bolsa de Ervas Rituais
    '3X4SVVWO6qQZsRdaTASA': [2, 0.35],   // Bolsa de Reagentes (frascos + pilão)
    uPp2wdSmTRfh3Jv9q7Cy: [2, 0.35],     // Estojo de Campo (desc: 35 cm)
    '2fTwbYGD3EPscus6Rsny': [2.5, 0.3],  // Estojo do Herborista (desc: 30 cm, madeira)
    tNbeTL32TkKXwzkz23ov: [1.5, 0.3],    // Kit de Gravação Rúnica
    C64t0Ks8pMiAtlukMhur: [1.5, 0.3],    // Kit de Herbalismo de osso (desc: ~30 cm)
    leRWJZ6A41GjFqSnP0RQ: [0.3, 0.2],    // Kit de Larápio Simples (enrolado de couro)
    '3ChX3Cu6L2rzC3lcfwpl': [2, 0.35],   // Kit de Sobrevivência Primal (corda 5 m + cantil)
    rgcbNs3pUrfldPlJofBO: [2, 0.3],      // Kit do Embalsamador de Valdris (desc: 30 cm)
    // ===== FERRAMENTAS E INSUMOS DE BANCADA =====
    YuiO7thL4SkjJFOcBoz5: [0.05, 0.1],   // Agulhas Rituais
    X4E2WBdDlBdwCnrj0eEE: [0.1, 0.15],   // Gazua Simples
    BW9Blji245mZvE0zkJbU: [0.1, 0.1],    // Giz de Selos (mantém — já real)
    D8UVPXxAbNdulxK6zyvE: [0.05, 0.2],   // Pincel de Escripta
    S7JpGp7VvF05gFFJHbjZ: [0.5, 0.2],    // Talhadeira Fina
    ZSrHx9wvRsuIvAtHEqDM: [1.5, 0.3],    // Talhadeira Pesada
    hm9oRXpeWtDBBgkQjsuW: [0.2, 0.08],   // Tinta Rúnica Comum (vidro)
    '55FZX7VuZNIyRLStHasq': [0.2, 0.08], // Tinta Rúnica Fina (vidro)
    IredBabVR2e2W9mdhVFE: [0.2, 0.08],   // Tinta-Mestra (vidro)
    // ===== TOTENS (peso da frente de Totemancia mantido; só o tamanho) =====
    C5YRxwOXpqIGcvxm8ouq: [0.4, 0.4],    // Totem Bruto de Madeira (galho — mantém)
    '6tNNof99UkQTQEr986I6': [0.3, 0.3],  // Totem da Mensageira (mantém)
    suARsYs8eWetO1m1ZKxo: [0.4, 0.35],   // Totem da Sentinela (ponta de lança em cabo curto)
    dPvcjkDmoY6mOtjf7b3V: [0.3, 0.25],   // Totem de Garras (amuleto)
    afMcqDx8mBQRAKFaMBia: [0.3, 0.25],   // Totem de Madeira de Antiqua (lasca)
    oslXaPJF6FJAvEwuaIU8: [0.5, 0.4],    // Totem de Osso Curtido (osso longo)
    arPrCgrvVA4ENCXSIGFo: [1.6, 0.12],   // Totem de Pedra do Leito (seixo de rio)
    ufcRjv7UgiC6GEKjspC3: [0.5, 0.3],    // Totem do Enforcado (nó num toco)
    XqVcbQiacPbWCTYesKuE: [0.5, 0.4],    // Totem do Lenhador (cabo de machado gasto)
    '0JXTiGebYQOGeIiwJfj2': [0.4, 0.25], // Totem do Pregoeiro (sino num punho)
    b7fj0ypq4t3HAUoUGeOj: [1.2, 0.35],   // Totem do Velho Urso (crânio)
    D8gkrgcHG2zpjbSLgopr: [0.3, 0.2],    // Totem Pessoal Entalhado ("pequeno")
    // ===== OUTROS =====
    VDw9lj6sMHQA52XL9CAl: [0.2, 0.15],   // Talismã Abissal (amuleto)
};

const integ = (liga, tam) => Math.max(3, Math.round(((Number.isFinite(Number(liga)) ? Number(liga) : 1) + tam * 3) * 3));

const snap = await db.collection('system/data/equipment').get();
const pecas = [];
snap.forEach(d => { const x = d.data(); if ((x.tipo || '') === 'Objeto') pecas.push({ id: d.id, ...x }); });

const semProposta = pecas.filter(a => !PROPOSTA[a.id]);
const idsExtras = Object.keys(PROPOSTA).filter(id => !pecas.some(a => a.id === id));
if (semProposta.length || idsExtras.length) {
    for (const a of semProposta) console.log(`❌ objeto sem proposta: ${a.nome} (${a.id})`);
    for (const id of idsExtras) console.log(`❌ id na proposta não é objeto do catálogo: ${id}`);
    process.exit(1);
}

console.log('Objeto | peso kg | tamanho m | Integridade');
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
console.log(`\n✅ ${pecas.length} objetos atualizados.`);
process.exit(0);
