// =============================================
// LOTE 6 — a boca e o conteúdo aceito dos 11 contêineres do catálogo.
// ---------------------------------------------
// Dois campos novos (ver cabeNoConteiner em shared/inventario-motor.js):
//   tamanhoMaximoItem — maior peça que passa pela boca, em metros. TRAVA.
//   tagsAceitas       — contêiner de propósito único. TRAVA. Vazio = tudo.
// Regra usada: bolsa/mochila/caixa recebe peça até o PRÓPRIO tamanho (a boca
// não é maior que o corpo); aljava e moedeira ganham a tag do que carregam.
// Conteúdo que JÁ está dentro nunca é revalidado — só a próxima soltura.
//
//   node functions/lote6-conteiner-boca-e-tags.mjs            (dry-run)
//   node functions/lote6-conteiner-boca-e-tags.mjs --apply
// =============================================
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

// id → { tamanhoMaximoItem, tagsAceitas }
const PROPOSTA = {
    SxTTOWcvzqO2kBYMfBe8: { tamanhoMaximoItem: 0.9,  tagsAceitas: ['Flecha'] },          // Aljava de Caça
    HKuJ4GCz6MHFh59RDHM1: { tamanhoMaximoItem: 0.5,  tagsAceitas: ['Virote'] },          // Aljava Virotes
    TUjJU3tmhRqiK4OwhKxo: { tamanhoMaximoItem: 0.1,  tagsAceitas: ['Moeda', 'Gema'] },   // Bolsa de Couro (Luns)
    dVPAnCIFH6Br5wBjGzgb: { tamanhoMaximoItem: 0.1,  tagsAceitas: ['Moeda', 'Gema'] },   // Saco de Luns Simples
    ZaiM8Il1M3bSK4ZRgJb2: { tamanhoMaximoItem: 0.7,  tagsAceitas: [] },                  // Mochila Grande
    HnIxcU6DDiZs3E6dRi19: { tamanhoMaximoItem: 0.5,  tagsAceitas: [] },                  // Mochila Maior de Couro
    H6UXwOyWTIpGwUveC9lh: { tamanhoMaximoItem: 0.6,  tagsAceitas: [] },                  // Mochila Média de Couro
    WULulL3svqyU7eBqI3xU: { tamanhoMaximoItem: 0.3,  tagsAceitas: [] },                  // Mochila Menor de Couro
    Yfi7pCMbb8qjHzNeKN3Z: { tamanhoMaximoItem: 0.25, tagsAceitas: [] },                  // Mochila Pequena de Couro
    uMqdxwznvzmxwR0tGeg6: { tamanhoMaximoItem: 0.5,  tagsAceitas: [] },                  // Caixa de Ferro sem Fechadura
    to5FSxkn4Krx1QwypuRx: { tamanhoMaximoItem: 1,    tagsAceitas: [] },                  // Caixote da Feira
};

const snap = await db.collection('system/data/equipment').get();
const conts = [];
snap.forEach(d => { const x = d.data(); if (x.tipo === 'Container' || x.ehContainer) conts.push({ id: d.id, ...x }); });

const faltando = conts.filter(c => !PROPOSTA[c.id]);
const sobrando = Object.keys(PROPOSTA).filter(id => !conts.some(c => c.id === id));
if (faltando.length || sobrando.length) {
    faltando.forEach(c => console.log(`❌ contêiner sem proposta: ${c.nome} (${c.id})`));
    sobrando.forEach(id => console.log(`❌ id na proposta não é contêiner: ${id}`));
    process.exit(1);
}

// o que existe no catálogo e caberia em cada um (amostra do efeito real)
const todos = []; snap.forEach(d => todos.push(d.data()));
console.log('Contêiner | tam | boca | só aceita | quantos itens do catálogo passam');
for (const c of conts.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))) {
    const p = PROPOSTA[c.id];
    const passam = todos.filter(i => {
        if (i.tipo === 'Container' || i.ehContainer) return false;
        if ((Number(i.tamanho) || 1) > p.tamanhoMaximoItem + 1e-9) return false;
        if (!p.tagsAceitas.length) return true;
        return (i.tags || []).some(t => p.tagsAceitas.some(a => a.toLowerCase() === String(t).trim().toLowerCase()));
    });
    console.log(`${c.nome} | ${c.tamanho} m | ${p.tamanhoMaximoItem} m | ${p.tagsAceitas.join('/') || '(tudo)'} | ${passam.length}`
        + (p.tagsAceitas.length ? ` → ${passam.map(i => i.nome).join(', ')}` : ''));
}

if (!APLICAR) { console.log('\nDRY-RUN — rode com --apply para gravar.'); process.exit(0); }
const agora = new Date().toISOString();
const batch = db.batch();
for (const c of conts) {
    const p = PROPOSTA[c.id];
    batch.update(db.collection('system/data/equipment').doc(c.id), {
        tamanhoMaximoItem: p.tamanhoMaximoItem,
        tagsAceitas: p.tagsAceitas,
        atualizadoEm: agora, updatedAt: agora,
    });
}
await batch.commit();
console.log(`\n✅ ${conts.length} contêineres com boca e tags gravadas.`);
process.exit(0);
