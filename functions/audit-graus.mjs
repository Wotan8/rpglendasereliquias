/**
 * Audita o catálogo pela escada de Grau/Fio (skill balancear-item §4b).
 *
 *   Fio de arma      = modificador/equação nos VDs de Dano ou Acerto
 *   Grau             = Fio + 1
 *   Grau de proteção = taxa por slot contra a tabela ×1,35
 *
 * Só lê. Não grava nada.
 *
 *   node functions/audit-graus.mjs            (resumo)
 *   node functions/audit-graus.mjs --todos    (lista item a item)
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const TODOS = process.argv.includes('--todos');

const grab = async c => (await db.collection(`system/data/${c}`).get()).docs.map(d => ({ id: d.id, ...d.data() }));
const [eq, vds, sks, attrs] = await Promise.all(
    ['equipment', 'derivedValues', 'skills', 'attributes'].map(grab));

const vdNome = id => (vds.find(v => v.id === id) || {}).nome || `?${id}`;
const r2 = v => Math.round(v * 100) / 100;
const TAXA_BASE = { 'Leve': 0.20, 'Média': 0.22, 'Pesada': 0.30 };
const taxaNoGrau = (base, g) => r2(base * Math.pow(1.35, g - 1));

/* Fio literal de uma equação: soma dos termos numéricos (os refs de ficha são
   o corpo do personagem, não poder do item). */
function fioDaEquacao(equacao) {
    let fio = 0;
    for (const t of equacao) {
        if (t.tipo === 'ficha' || t.tipo === 'sort') continue;
        const v = parseFloat(t.valor);
        if (isNaN(v)) continue;
        fio += (t.op === '-') ? -v : v;
    }
    return fio;
}

const armas = [], protecoes = [], focos = [], problemas = [];

for (const e of eq) {
    const tags = e.tags || [];
    const vinc = e.valoresDerivadosVinculados || [];
    const classe = tags.find(t => TAXA_BASE[t]);
    const ehEscudo = tags.includes('Escudo');
    const ehArma = e.tipo === 'Arma' || !!e.formulaDano;

    /* --- Proteção --- */
    if (classe || ehEscudo) {
        // Só a Blindagem geral entra na taxa por slot. As tipadas (Contundente,
        // Vermelha...) são fraqueza e resistência da peça — somá-las aqui fazia
        // uma armadura com fraqueza cair fora da escada.
        const bl = vinc.filter(v => vdNome(v.id) === 'Blindagem')
            .reduce((s, v) => s + (Number(v.modificador) || 0), 0);
        const slots = 1 + (e.slotsAdicionais || []).reduce((s, x) => s + (x.quantidade || 0), 0);
        if (ehEscudo) {
            protecoes.push({ nome: e.nome, classe: 'Escudo', slots: 1, bl: r2(bl), taxa: r2(bl), grau: 1, nota: 'escudo não escala por Grau' });
        } else {
            const taxa = r2(bl / slots);
            const base = TAXA_BASE[classe];
            let grau = null;
            for (let g = 0; g <= 5; g++) if (Math.abs(taxa - taxaNoGrau(base, g)) < 0.015) { grau = g; break; }
            protecoes.push({ nome: e.nome, classe, slots, bl: r2(bl), taxa, grau });
            if (grau === null) problemas.push(`TAXA FORA DA ESCADA · ${e.nome} (${classe}): ${taxa}/slot não bate com nenhum Grau (base ${base})`);
        }
        continue;
    }

    /* --- Foco mágico --- */
    const acertoMagico = vinc.find(v => vdNome(v.id) === 'Acerto Mágico');
    if (acertoMagico) {
        const fio = Array.isArray(acertoMagico.equacao) ? fioDaEquacao(acertoMagico.equacao) : (Number(acertoMagico.modificador) || 0);
        focos.push({ nome: e.nome, fio, grau: fio + 1 });
        continue;
    }

    /* --- Arma / projétil --- */
    if (ehArma || tags.some(t => ['Flecha', 'Virote', 'Munição'].includes(t))) {
        let fio = 0; const canais = [];
        for (const v of vinc) {
            const n = vdNome(v.id);
            if (!n.startsWith('Dano') && !n.startsWith('Acerto')) continue;
            const f = Array.isArray(v.equacao) ? fioDaEquacao(v.equacao) : (Number(v.modificador) || 0);
            fio += f;
            if (f) canais.push(`${n} ${f > 0 ? '+' : ''}${f}`);
        }
        armas.push({ nome: e.nome, dado: e.formulaDano || '—', cat: e.categoriaArma || '—', fio, grau: fio + 1, canais });
        if (fio > 4) problemas.push(`FIO ACIMA DO TETO · ${e.nome}: ${fio} Fios (máximo 4 = Grau 5)`);
        // Rede e Enredantes não causam dano por design — não são falha de cadastro.
        if (ehArma && !e.formulaDano && !tags.includes('Enredante')) problemas.push(`ARMA SEM DADO · ${e.nome}: tipo Arma sem formulaDano`);
        if (ehArma && !e.categoriaArma) problemas.push(`ARMA SEM CATEGORIA · ${e.nome}`);
    }
}

/* --- Dominância: duas peças só competem se cobrirem AS MESMAS partes do corpo.
   Contar slots não basta — Braçadeiras (Braço) e Couraça (Torso) têm 2 slots
   cada e não disputam nada. --- */
const cobertura = it => [
    ...(it.equipavelEm || []),
    ...(it.slotsAdicionais || []).map(s => `${s.id}x${s.quantidade}`)
].sort().join('|');
const penal = it => JSON.stringify([
    (it.atributosVinculados || []).map(v => `${v.id}${v.modificador}`).sort(),
    (it.periciasVinculadas || []).map(v => `${v.id}${v.modificador}`).sort()
]);

for (const a of protecoes) for (const b of protecoes) {
    if (a.nome >= b.nome || a.classe !== b.classe) continue;
    if (r2(a.bl) !== r2(b.bl)) continue;
    const pa = eq.find(x => x.nome === a.nome), pb = eq.find(x => x.nome === b.nome);
    if (cobertura(pa) !== cobertura(pb)) continue;   // partes diferentes = não competem
    if (penal(pa) !== penal(pb)) continue;           // penalidade diferente = troca legítima
    const ca = pa.preco ?? 0, cb = pb.preco ?? 0;
    if (ca !== cb) problemas.push(`DOMINADO · ${ca > cb ? a.nome : b.nome} (L$ ${Math.max(ca, cb)}) cobre as mesmas partes que ${ca > cb ? b.nome : a.nome} (L$ ${Math.min(ca, cb)}), com a mesma Blindagem e a mesma penalidade — e custa mais`);
}

/* ===== Relatório ===== */
const dist = arr => { const d = {}; for (const x of arr) d[`Grau ${x.grau ?? '?'}`] = (d[`Grau ${x.grau ?? '?'}`] || 0) + 1; return d; };

console.log(`\n═══ AUDITORIA DE GRAU — ${eq.length} itens no catálogo ═══\n`);
console.log(`Armas e projéteis : ${String(armas.length).padStart(3)}   ${JSON.stringify(dist(armas))}`);
console.log(`Proteções         : ${String(protecoes.length).padStart(3)}   ${JSON.stringify(dist(protecoes))}`);
console.log(`Focos mágicos     : ${String(focos.length).padStart(3)}   ${JSON.stringify(dist(focos))}`);

const acimaDoG1 = [...armas, ...focos].filter(x => x.grau !== 1);
console.log(`\n─── Itens acima do Grau 1 (${acimaDoG1.length}) ───`);
if (!acimaDoG1.length) console.log('  nenhum — catálogo 100% inicial');
for (const a of acimaDoG1) console.log(`  Grau ${a.grau}  ${a.nome.padEnd(28)} ${a.fio > 0 ? '+' : ''}${a.fio} Fio   ${(a.canais || []).join(' · ')}`);

console.log(`\n─── Proteções por classe ───`);
for (const c of ['Leve', 'Média', 'Pesada', 'Escudo']) {
    const l = protecoes.filter(p => p.classe === c);
    if (!l.length) continue;
    const taxas = [...new Set(l.map(p => p.taxa))].sort((a, b) => a - b);
    console.log(`  ${c.padEnd(7)} ${String(l.length).padStart(2)} peças · taxa/slot: ${taxas.join(', ')}`);
}

console.log(`\n─── Problemas (${problemas.length}) ───`);
if (!problemas.length) console.log('  nenhum');
for (const p of [...new Set(problemas)].sort()) console.log(`  ⚠ ${p}`);

if (TODOS) {
    console.log(`\n─── Todas as armas ───`);
    for (const a of armas.sort((x, y) => x.nome.localeCompare(y.nome)))
        console.log(`  Grau ${a.grau}  ${a.nome.padEnd(30)} ${String(a.dado).padEnd(12)} ${a.cat}`);
    console.log(`\n─── Todas as proteções ───`);
    for (const p of protecoes.sort((x, y) => x.classe.localeCompare(y.classe) || x.nome.localeCompare(y.nome)))
        console.log(`  Grau ${p.grau ?? '?'}  ${p.classe.padEnd(7)} ${p.nome.padEnd(26)} ${String(p.slots).padStart(2)} slots  Bl ${String(p.bl).padStart(5)}  ${p.taxa}/slot`);
}
console.log('');
process.exit(0);
