/**
 * Raio-x das armas VERSÁTEIS: o cadastro sustenta o modo de duas mãos?
 *
 * "Versátil" é a arma que o dono decide empunhar com uma ou com as duas mãos
 * (shared/equip-slots.js → escolheMaos). O motor lê:
 *   • formulaDano2Maos                  → o dado quando empunhada com as duas
 *   • valoresDerivadosVinculados[].maos → 0/ausente = sempre, 1 = uma, 2 = duas
 *
 * Sem esses campos a arma é Versátil só no rótulo: mesmo dado e mesmo bônus nas
 * duas pegadas, e a escolha no modal de equipar não muda nada na ficha.
 *
 *   node functions/audit-armas-versateis.mjs             (só relata)
 *   node functions/audit-armas-versateis.mjs --aplicar   (grava a correção)
 *
 * O QUE ELE CORRIGE — e só isto:
 *   formulaDano no formato antigo "1d8 / 1d10" vira formulaDano "1d8" +
 *   formulaDano2Maos "1d10". A barra era a convenção de texto para versátil
 *   (ver .claude/skills/balancear-item), e o motor NÃO sabe lê-la: ele
 *   concatena o bônus na string inteira e mostra "1d8 / 1d10+5" na ficha e no
 *   Tabuleiro. Partir a string é conserto de bug, não decisão de balanceamento.
 *
 * O QUE ELE NÃO FAZ, de propósito:
 *   arma versátil sem a barra nunca teve dois dados cadastrados. Escolher o
 *   dado de duas mãos e precificar bônus por pegada é régua de balanceamento
 *   (Livro: Régua de Balanceamento), não escada automática — o script mostra a
 *   sugestão e para aí.
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const serviceAccount = require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const APLICAR = process.argv.includes('--aplicar');

/** Escada de dados do sistema — usada só para SUGERIR, nunca para gravar. */
const ESCADA = ['1d4', '1d6', '1d8', '1d10', '1d12', '2d6', '2d8', '2d10', '2d12'];
const degrauAcima = (d) => {
    const i = ESCADA.indexOf(String(d || '').trim().toLowerCase());
    return (i < 0 || i + 1 >= ESCADA.length) ? null : ESCADA[i + 1];
};

/** "1d8 / 1d10" → ['1d8','1d10']. Qualquer outra coisa → null. */
function partirBarra(formula) {
    const partes = String(formula || '').split('/').map(s => s.trim()).filter(Boolean);
    return partes.length === 2 ? partes : null;
}

const col = db.collection('system/data/equipment');
const eq = (await col.get()).docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }));
const dvNome = Object.fromEntries((await db.collection('system/data/derivedValues').get())
    .docs.map(d => [d.id, d.data().nome || d.id]));
const nome = i => i.nome || '(sem nome)';

const versateis = eq.filter(i => i.tipo === 'Arma' && i.categoriaArma === 'versatil');
console.log(`CATÁLOGO: ${eq.length} itens · ${versateis.length} arma(s) Versátil(eis)\n`);
if (!versateis.length) { console.log('Nenhuma arma Versátil cadastrada.'); process.exit(0); }

const planos = [], jaOk = [], pendentes = [], semDado = [];

for (const a of versateis) {
    const base = String(a.formulaDano || '').trim();
    if (String(a.formulaDano2Maos || '').trim()) { jaOk.push(a); continue; }
    if (!base) { semDado.push(a); continue; }

    const par = partirBarra(base);
    if (par) planos.push({ a, de: base, uma: par[0], duas: par[1] });
    else pendentes.push({ a, base, sugestao: degrauAcima(base) });
}

/* ---- Relatório ---------------------------------------------------------- */

console.log(`### ✅ JÁ TÊM o dado de duas mãos — ${jaOk.length}`);
jaOk.forEach(a => console.log(`   ${nome(a)}: ${a.formulaDano} · 2 mãos ${a.formulaDano2Maos}`));

console.log(`\n### 🔧 BARRA A PARTIR (o motor não lê "/" — hoje sai "1d8 / 1d10+5") — ${planos.length}`);
planos.forEach(p => console.log(`   ${nome(p.a)}: "${p.de}"  →  formulaDano "${p.uma}" + formulaDano2Maos "${p.duas}"`));

console.log(`\n### ⏸️ SEM SEGUNDO DADO CADASTRADO (decisão sua) — ${pendentes.length}`);
pendentes.forEach(p => console.log(
    `   ${nome(p.a)}: ${p.base} nas duas pegadas` +
    (p.sugestao ? `  · sugestão de degrau: ${p.sugestao}` : '  · dado fora da escada')));
if (pendentes.length) console.log('   (o script não grava aqui: escolher o dado é régua de balanceamento)');

console.log(`\n### 🔴 VERSÁTIL SEM DADO NENHUM — ${semDado.length}`);
semDado.forEach(a => console.log(`   ${nome(a)} — cadastre formulaDano ou troque a categoria`));

/* Bônus por pegada: informativo. Nenhuma escada automática precifica isso. */
const semPegada = versateis.filter(a =>
    (a.valoresDerivadosVinculados || []).length &&
    !(a.valoresDerivadosVinculados || []).some(v => Number(v.maos) > 0));
console.log(`\n### ⚠️ VD sem pegada — o mesmo bônus com uma ou duas mãos — ${semPegada.length}`);
semPegada.forEach(a => console.log(`   ${nome(a)}: ` +
    (a.valoresDerivadosVinculados || []).map(v => dvNome[v.id] || v.id).join(', ')));
if (semPegada.length) console.log('   (marque `maos` no vínculo pelo Painel do Criador se quiser diferenciar)');

/* ---- Gravação ----------------------------------------------------------- */

if (!planos.length) { console.log('\nNada a gravar.'); process.exit(0); }
if (!APLICAR) {
    console.log(`\n(ensaio) ${planos.length} arma(s) a corrigir. Rode com --aplicar para gravar.`);
    process.exit(0);
}

const agora = new Date().toISOString();
const batch = db.batch();
for (const p of planos) {
    batch.update(p.a.ref, {
        formulaDano: p.uma, formulaDano2Maos: p.duas,
        atualizadoEm: agora, updatedAt: agora,
    });
}
await batch.commit();
console.log(`\n✅ ${planos.length} arma(s) Versátil(eis) corrigidas.`);
