/**
 * Audita o catálogo pela escada de Qualidade (v2 — Liga ≥ Qualidade ≥ Afiação).
 *
 *   Qualidade de arma      = campo `qualidade` (`fio` pré-migração)
 *   Qualidade de proteção  = taxa por slot contra a escada antiga (morre no
 *                            passo 2 da migração, Blindagem inteira por peça)
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
/* Blindagem inteira (v2): total do corpo por classe × Qualidade. Peça avulsa
   nunca passa do total da classe na sua Qualidade. Escudos têm valor fixo. */
const TOTAL_CLASSE = {
    'Leve': [1, 1, 2, 2, 3, 3],
    'Média': [2, 3, 3, 4, 5, 6],
    'Pesada': [3, 4, 5, 6, 7, 9]
};
const ESCUDOS = { 'Broquel': 0, 'Escudo de Torre': 2, 'Escudo Grande': 1, 'Escudo Médio': 1 };
const TAXA_BASE = { 'Leve': 1, 'Média': 1, 'Pesada': 1 };   // só detecção de classe pela tag

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
        const q = Number(e.qualidade ?? e.fio) || 0;

        if (!Number.isInteger(bl))
            problemas.push(`BLINDAGEM FRACIONÁRIA · ${e.nome}: ${bl} — a v2 só aceita inteiro declarado na peça`);

        if (ehEscudo) {
            protecoes.push({ nome: e.nome, classe: 'Escudo', slots: 1, bl: r2(bl), grau: 0, nota: 'escudo não escala Blindagem por Qualidade' });
            if (e.nome in ESCUDOS && bl !== ESCUDOS[e.nome])
                problemas.push(`ESCUDO FORA DA TABELA · ${e.nome}: Blindagem ${bl} (fixo da v2: ${ESCUDOS[e.nome]})`);
        } else {
            protecoes.push({ nome: e.nome, classe, slots, bl: r2(bl), grau: q });
            const teto = (TOTAL_CLASSE[classe] || [])[Math.min(q, 5)];
            if (teto != null && bl > teto)
                problemas.push(`BLINDAGEM ACIMA DO TOTAL DA CLASSE · ${e.nome} (${classe} Q${q}): ${bl} > ${teto}`);

            /* Opção A: em proteção a Blindagem é valor de cadastro, gravado à
               mão quando a peça sobe de Qualidade (Livro, 5.6). O erro que isso
               permite é silencioso — subir a Qualidade e esquecer a Blindagem.
               `blindagemQ0` é a âncora que torna esse esquecimento visível. */
            const q0 = e.blindagemQ0;
            const ref = Number(e.reforco) || 0;
            if (q0 === undefined) {
                problemas.push(`SEM ÂNCORA · ${e.nome}: falta blindagemQ0 (rode protecao-qualidade-base.mjs)`);
            } else if (q === 0 && ref === 0 && bl !== Number(q0)) {
                problemas.push(`BLINDAGEM DIVERGE DA BASE · ${e.nome}: ${bl} sem Qualidade nem Reforço, mas blindagemQ0 é ${q0}`);
            } else if ((q > 0 || ref > 0) && bl <= Number(q0)) {
                const pago = [q > 0 ? `Qualidade ${q}` : null, ref > 0 ? `Reforço ${ref}` : null].filter(Boolean).join(' e ');
                problemas.push(`PAGOU E NÃO GRAVOU · ${e.nome} (${classe}): ${pago}, mas a Blindagem ${bl} continua na base ${q0} — grave o valor novo (§5.5/§5.6)`);
            }
            // A corrente: Liga ≥ Qualidade ≥ Reforço (o Reforço é a Afiação da proteção)
            if (ref > q)
                problemas.push(`REFORÇO ACIMA DA QUALIDADE · ${e.nome} (${classe}): Reforço ${ref} com Qualidade ${q}`);
            // fraqueza tipada precisa acompanhar a Blindagem: delta = floor(bl/2) − bl
            for (const v of vinc) {
                const n = vdNome(v.id);
                if (/^Blindagem .+/.test(n) && Number(v.modificador) < 0) {
                    const esperado = Math.floor(bl / 2) - bl;
                    if (Number(v.modificador) !== esperado)
                        problemas.push(`FRAQUEZA DESCASADA · ${e.nome}: ${n} ${v.modificador} (esperado ${esperado} para Blindagem ${bl})`);
                }
            }
        }
        continue;
    }

    /* --- Foco mágico --- */
    const acertoMagico = vinc.find(v => vdNome(v.id) === 'Acerto Mágico');
    if (acertoMagico) {
        const fio = Array.isArray(acertoMagico.equacao) ? fioDaEquacao(acertoMagico.equacao) : (Number(acertoMagico.modificador) || 0);
        focos.push({ nome: e.nome, fio, grau: fio });
        continue;
    }

    /* --- Arma / projétil --- */
    if (ehArma || tags.some(t => ['Flecha', 'Virote', 'Munição'].includes(t))) {
        // A Qualidade é campo (`qualidade`; `fio` é o nome antigo, pré-migração).
        // Os canais arcanos continuam saindo dos vínculos de Dano por Essência —
        // um por canal, e a soma deles também não passa da Qualidade (Livro, 5.5).
        const fio = Number(e.qualidade ?? e.fio) || 0;
        const afiacao = Number(e.afiacao) || 0;
        const liga = e.liga == null ? null : Number(e.liga);
        const canais = [];
        let arcanoTotal = 0;
        for (const v of vinc) {
            const n = vdNome(v.id);
            if (!/^Dano .+/.test(n)) continue;               // Dano <Essência>
            const f = Array.isArray(v.equacao) ? fioDaEquacao(v.equacao) : (Number(v.modificador) || 0);
            arcanoTotal += f;
            if (f) canais.push(`${n} ${f > 0 ? '+' : ''}${f}`);
        }
        armas.push({ nome: e.nome, dado: e.formulaDano || '—', cat: e.categoriaArma || '—', fio, grau: fio, canais });

        /* As travas encaixadas do Livro, 5.5 — v2: Liga ≥ Qualidade ≥ Afiação */
        if (fio > 5) problemas.push(`QUALIDADE ACIMA DO TETO · ${e.nome}: ${fio} (máximo 5 = Graal)`);
        if (liga != null && fio > liga)
            problemas.push(`QUALIDADE ACIMA DA LIGA · ${e.nome}: Qualidade ${fio} com Liga ${liga} (o teto é a própria Liga)`);
        if (afiacao > fio)
            problemas.push(`AFIAÇÃO ACIMA DA QUALIDADE · ${e.nome}: Afiação ${afiacao} com Qualidade ${fio}`);
        if (arcanoTotal > fio)
            problemas.push(`AFIAÇÃO ARCANA ACIMA DA QUALIDADE · ${e.nome}: ${arcanoTotal} somando os canais, com Qualidade ${fio}`);
        if (fio > 0 && liga == null)
            problemas.push(`QUALIDADE SEM LIGA · ${e.nome}: Qualidade ${fio} numa peça sem Liga declarada`);
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
const dist = arr => { const d = {}; for (const x of arr) d[`Q${x.grau ?? '?'}`] = (d[`Q${x.grau ?? '?'}`] || 0) + 1; return d; };

console.log(`\n═══ AUDITORIA DE QUALIDADE — ${eq.length} itens no catálogo ═══\n`);
console.log(`Armas e projéteis : ${String(armas.length).padStart(3)}   ${JSON.stringify(dist(armas))}`);
console.log(`Proteções         : ${String(protecoes.length).padStart(3)}   ${JSON.stringify(dist(protecoes))}`);
console.log(`Focos mágicos     : ${String(focos.length).padStart(3)}   ${JSON.stringify(dist(focos))}`);

const acimaDoQ0 = [...armas, ...focos].filter(x => x.grau !== 0);
console.log(`\n─── Itens acima da Qualidade 0 (${acimaDoQ0.length}) ───`);
if (!acimaDoQ0.length) console.log('  nenhum — catálogo 100% inicial');
for (const a of acimaDoQ0) console.log(`  Q${a.grau}  ${a.nome.padEnd(28)} +${a.fio} de dano   ${(a.canais || []).join(' · ')}`);

console.log(`\n─── Proteções por classe ───`);
for (const c of ['Leve', 'Média', 'Pesada', 'Escudo']) {
    const l = protecoes.filter(p => p.classe === c);
    if (!l.length) continue;
    const valores = [...new Set(l.map(p => p.bl))].sort((a, b) => a - b);
    console.log(`  ${c.padEnd(7)} ${String(l.length).padStart(2)} peças · Blindagem: ${valores.join(', ')}`);
}

console.log(`\n─── Problemas (${problemas.length}) ───`);
if (!problemas.length) console.log('  nenhum');
for (const p of [...new Set(problemas)].sort()) console.log(`  ⚠ ${p}`);

if (TODOS) {
    console.log(`\n─── Todas as armas ───`);
    for (const a of armas.sort((x, y) => x.nome.localeCompare(y.nome)))
        console.log(`  Q${a.grau}  ${a.nome.padEnd(30)} ${String(a.dado).padEnd(12)} ${a.cat}`);
    console.log(`\n─── Todas as proteções ───`);
    for (const p of protecoes.sort((x, y) => x.classe.localeCompare(y.classe) || x.nome.localeCompare(y.nome)))
        console.log(`  Q${p.grau ?? '?'}  ${p.classe.padEnd(7)} ${p.nome.padEnd(26)} ${String(p.slots).padStart(2)} slots  Bl ${String(p.bl).padStart(3)}`);
}
console.log('');
process.exit(0);
