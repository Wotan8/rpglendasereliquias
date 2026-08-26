// =============================================
// VARREDURA: toda instância em `items` (personagens, NPCs, aliados, caixa)
// volta a ficar IGUAL ao cadastro — pedido do usuário em 25/08/2026.
// ---------------------------------------------
// A semântica é a do botão "♻️ Restaurar do cadastro": patchRestauracao() de
// shared/restaurar-item.js, o MESMO código das cinco telas — campos de
// CAMPOS_EQUIPAMENTO com renomes (imagemUrl→imagem, mecanicaIds→
// mecanicaIdsProprias), campo que o modelo não define vira null, espelhos
// name/description das telas antigas, modeloId gravado. Posse, slot,
// equipado e QUANTIDADE nunca são tocados (merge + patch sem essas chaves).
//
// Desvio deliberado do botão: `avaria` é PRESERVADA. O botão conserta de
// propósito (é a UI de conserto); uma varredura em massa consertando tudo
// seria ferreiro grátis para a mesa inteira.
//
// Casamento: modeloId/origemTemplateId → nome+tipo → nome único (o mesmo da
// migração de peso/tamanho). Sem modelo = peça personalizada, fica como está.
// Bônus: instância casada por nome ganha `modeloId` — vira vínculo permanente.
//
//   node functions/sincronizar-instancias-catalogo.mjs            (dry-run)
//   node functions/sincronizar-instancias-catalogo.mjs --apply
// =============================================
import { createRequire } from 'node:module';
import { patchRestauracao } from '../shared/restaurar-item.js';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

const norm = (s) => String(s || '').trim().toLowerCase();

const catSnap = await db.collection('system/data/equipment').get();
const porId = new Map(), porNomeTipo = new Map(), porNome = new Map();
catSnap.forEach(d => {
    const x = { id: d.id, ...d.data() };
    porId.set(d.id, x);
    porNomeTipo.set(norm(x.nome) + '|' + norm(x.tipo), x);
    porNome.set(norm(x.nome), porNome.has(norm(x.nome)) ? null : x);
});
const acha = (x) => {
    const ref = x.modeloId || x.origemTemplateId;
    if (ref && porId.has(ref)) return porId.get(ref);
    const nome = norm(x.nome ?? x.name);
    return porNomeTipo.get(nome + '|' + norm(x.tipo)) || porNome.get(nome) || null;
};

// dois valores "iguais" para efeito de escrita? (null do patch = ausente no doc)
// Ordem de chave NÃO conta: o Firestore devolve mapas na ordem dele, e equação
// {tipo,ref,op} do doc é a mesma coisa que {op,tipo,ref} do patch.
const canon = (v) => {
    if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
    return JSON.stringify(v);
};
const igual = (a, b) => {
    if (a == null && b == null) return true;
    if (typeof a === 'number' || typeof b === 'number') return Number(a) === Number(b);
    return canon(a) === canon(b);
};

/* Três classes de instância casada:
   COMPLETA  — nome bate com o modelo: restauração integral.
   VESTIDA   — nome próprio mas MESMO tipo (disfarce/adereço de mesa, ex.
               "Embrulho de pano" sobre Pó de Cristal): mecânica volta ao
               cadastro, mas nome/descrição/imagem — a CARA — ficam.
   SUSPEITA  — nome E tipo divergem do modelo (ref mentirosa, ex. "LANÇA"
               com modeloId de Lun): NÃO TOCA; lista para o mestre. */
const CARA = ['nome', 'name', 'descricao', 'description', 'imagem'];

const snap = await db.collection('items').get();
let total = 0, casados = 0, completas = 0, vestidas = 0, ganhamModelo = 0, comAvaria = 0;
const personalizados = [], suspeitas = [], vestidasLista = [], porCampo = {};
const writes = [];

snap.forEach(d => {
    const x = { id: d.id, ...d.data() };
    total++;
    const tpl = acha(x);
    if (!tpl) { personalizados.push(`${x.nome || x.name || '?'} (${x.tipo || '—'})`); return; }
    casados++;

    const nomeProprio = x.nome && norm(x.nome) !== norm(tpl.nome);
    if (nomeProprio && norm(x.tipo) !== norm(tpl.tipo)) {
        suspeitas.push(`items/${d.id} · "${x.nome}" (${x.tipo}) sobre modelo "${tpl.nome}" (${tpl.tipo}) — conferir a ref`);
        return;
    }

    const p = patchRestauracao(tpl);
    delete p.avaria;            // desvio deliberado: varredura não é ferreiro
    delete p.lastModified;      // só entra se houver mudança de verdade
    if (nomeProprio) { for (const k of CARA) delete p[k]; }

    const mudanca = {};
    for (const [k, v] of Object.entries(p)) {
        if (!igual(x[k], v)) { mudanca[k] = v; porCampo[k] = (porCampo[k] || 0) + 1; }
    }
    if (!Object.keys(mudanca).length) return;

    if (nomeProprio) { vestidas++; vestidasLista.push(`${x.nome} (mecânica de ${tpl.nome})`); }
    else completas++;
    if (mudanca.modeloId && !(x.modeloId || x.origemTemplateId)) ganhamModelo++;
    if ((Number(x.avaria) || 0) > 0) comAvaria++;
    mudanca.lastModified = new Date().toISOString();
    writes.push([d.ref, mudanca]);
});

console.log(`items: ${total} · casados ${casados} · personalizados (ficam) ${personalizados.length}`);
console.log(`restauração COMPLETA: ${completas} · VESTIDAS (mecânica só, cara fica): ${vestidas} · SUSPEITAS (não toca): ${suspeitas.length}`);
console.log(`ganham modeloId (vínculo novo): ${ganhamModelo} · com avaria preservada: ${comAvaria}\n`);
console.log('mudanças por campo:');
Object.entries(porCampo).sort((a, b) => b[1] - a[1]).forEach(([k, n]) => console.log(`  ${k.padEnd(26)} ${n}`));
console.log(`\nVESTIDAS (${vestidas}):`);
vestidasLista.forEach(l => console.log('  · ' + l));
console.log(`\nSUSPEITAS (${suspeitas.length}):`);
suspeitas.forEach(l => console.log('  · ' + l));

if (!APLICAR) { console.log('\nDRY-RUN — rode com --apply para gravar.'); process.exit(0); }

let n = 0, batch = db.batch();
for (const [ref, p] of writes) {
    batch.set(ref, p, { merge: true });
    if (++n >= 400) { await batch.commit(); batch = db.batch(); n = 0; }
}
if (n) await batch.commit();
console.log(`\n✅ ${writes.length} instâncias sincronizadas com o cadastro.`);
process.exit(0);
