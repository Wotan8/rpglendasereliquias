/**
 * Passo 6 do soquete mágico v2 — TRIAGEM (só leitura, não grava nada).
 *
 * Migrar as magias para a régua de dado exige uma decisão por item, e decisão
 * de design é do dono do sistema. O que a máquina faz sem chutar: separar o que
 * tem dano do que não tem, extrair dado / custo / redutor do texto livre, e
 * medir cada magia com dano contra a régua.
 *
 * A régua (1 Energia ≈ 1d8 contra Blindagem 2): o dado esperado é
 *
 *     dado médio ≈ custo em Energia × 4,5   −   (barreira que a parcela pula)
 *
 * O que sai desta triagem é a lista de decisões, não a migração.
 *
 *   node functions/soquete-6-triagem-magias.mjs
 *   node functions/soquete-6-triagem-magias.mjs --detalhe
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

/* ═══ EXTRAÇÃO ═══ */
/** Média de uma notação de dado: "2d6" → 7, "1d4+1" → 3,5. */
export function mediaDado(txt) {
    const m = /(\d*)d(\d+)\s*([+-]\s*\d+)?/i.exec(txt || '');
    if (!m) return null;
    const n = parseInt(m[1] || '1', 10), faces = parseInt(m[2], 10);
    const mod = m[3] ? parseInt(m[3].replace(/\s/g, ''), 10) : 0;
    return n * (faces + 1) / 2 + mod;
}
/** Energia declarada no texto de custo. "1D + 1G" → 1 · "2 Cargas" → 0. */
export function custoEnergia(txt) {
    const s = String(txt || '');
    const m = /(\d+)\s*(Energia|D\b|ENER)/i.exec(s);
    return m ? parseInt(m[1], 10) : 0;
}
export const dadoEsperado = (energia, barreira) => energia * 4.5 - (2 - barreira);

/* ═══ ASSERTS ═══ */
assert.equal(mediaDado('2d6'), 7);
assert.equal(mediaDado('1d4+1'), 3.5);
assert.equal(mediaDado('(Cargas)d6'), 3.5, 'dado com contador vira 1dN — o multiplicador é do Mestre');
assert.equal(mediaDado('sem dado nenhum'), null);
assert.equal(custoEnergia('1D + 1G'), 1);
assert.equal(custoEnergia('2 Energia'), 2);
assert.equal(custoEnergia('1-3 Cargas'), 0, 'Carga não é Energia');
assert.equal(dadoEsperado(1, 2), 4.5, '1 Energia contra Blindagem 2 → 1d8');
assert.equal(dadoEsperado(1, 0), 2.5, '1 Energia contra Blindagem Arcana 0 → 1d4');
assert.equal(dadoEsperado(2, 2), 9, '2 Energia → 2d8');
console.log('✅ 10 asserts passaram.\n');

/* ═══ LEITURA ═══ */
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const grab = async c => (await db.collection(`system/data/${c}`).get()).docs.map(d => ({ id: d.id, ...d.data() }));
const [cls, mods] = await Promise.all(['classes', 'classModules'].map(grab));
const DETALHE = process.argv.includes('--detalhe');

const classeDoModulo = {};
for (const c of cls) for (const e of (c.modulosDaClasse || [])) if (typeof e === 'string') classeDoModulo[e] = c.nome;

const linhas = [];
for (const m of mods) {
    const lbl = Object.fromEntries((m.schema || []).map(f => [f.key, String(f.label || '')]));
    const chave = re => Object.keys(lbl).find(k => re.test(lbl[k]));
    const kCusto = chave(/custo/i), kEfeito = chave(/efeito|o que faz/i), kRed = chave(/redutor/i);
    for (const it of (m.itensPredefinidos || [])) {
        const v = it.valores || {};
        const texto = [it.descricao, v[kEfeito]].filter(Boolean).join(' ');
        linhas.push({
            classe: classeDoModulo[m.id] || '—', modulo: m.titulo || m.id, nome: it.nome || '?',
            dado: mediaDado(texto), dadoTxt: (/(\d*d\d+)/i.exec(texto) || [])[1] || '',
            custoTxt: String(v[kCusto] ?? '').trim(), energia: custoEnergia(v[kCusto]),
            redutor: Number(String(v[kRed] ?? '').replace(/[^\d-]/g, '')) || 0,
        });
    }
}

const comDano = linhas.filter(l => l.dado !== null);
const semDano = linhas.length - comDano.length;

console.log('═'.repeat(74));
console.log(`TRIAGEM — ${linhas.length} magias/manobras em ${mods.length} módulos`);
console.log('═'.repeat(74));
console.log(`  com dado de dano : ${String(comDano.length).padStart(3)}  (${(comDano.length / linhas.length * 100).toFixed(0)}%)`);
console.log(`  sem dado de dano : ${String(semDano).padStart(3)}  (${(semDano / linhas.length * 100).toFixed(0)}%)  ← controle, suporte, vínculo, ritual`);
console.log(`\n  Confirma o eixo: a régua de dado governa a minoria. O grosso precisa`);
console.log(`  de uma régua de controle/suporte, que ainda não existe.\n`);

console.log('─'.repeat(74));
console.log('MAGIAS COM DANO — dado atual × dado que a régua pede');
console.log('─'.repeat(74));
console.log('  classe          magia                      dado   Ener  esperado  veredito');
const fora = [];
for (const l of comDano.sort((a, b) => a.classe.localeCompare(b.classe) || a.nome.localeCompare(b.nome))) {
    /* Sem custo em Energia declarado, a régua não tem denominador — fica "?". */
    if (!l.energia) {
        console.log(`  ${l.classe.slice(0, 14).padEnd(15)} ${l.nome.slice(0, 25).padEnd(26)} ${l.dadoTxt.padEnd(6)}  —     —         ? custo não é Energia ("${l.custoTxt}")`);
        continue;
    }
    /* Parcela de Essência enfrenta Blindagem Arcana 0 no catálogo de hoje. */
    const esp = dadoEsperado(l.energia, 0);
    const razao = l.dado / esp;
    const ver = razao > 1.6 ? '🔴 forte demais' : razao < 0.6 ? '🔵 fraca demais' : '✅ na faixa';
    if (razao > 1.6 || razao < 0.6) fora.push({ ...l, esp, razao });
    console.log(`  ${l.classe.slice(0, 14).padEnd(15)} ${l.nome.slice(0, 25).padEnd(26)} ${l.dadoTxt.padEnd(6)}  ${l.energia}     ${esp.toFixed(1).padStart(4)}      ${ver} (${razao.toFixed(2)}×)`);
}

if (fora.length) {
    console.log('\n' + '─'.repeat(74));
    console.log(`DECISÕES PENDENTES — ${fora.length} fora da faixa`);
    console.log('─'.repeat(74));
    for (const f of fora.sort((a, b) => b.razao - a.razao)) {
        console.log(`  ${f.nome}  (${f.classe})`);
        console.log(`     ${f.dadoTxt} = ${f.dado} contra ${f.esp.toFixed(1)} esperado por ${f.energia} Energia → ${f.razao.toFixed(2)}×`);
        console.log(`     custo declarado: "${f.custoTxt}"`);
    }
}

if (DETALHE) {
    console.log('\n' + '─'.repeat(74));
    console.log('SEM DANO — precisam da régua de controle/suporte');
    console.log('─'.repeat(74));
    for (const l of linhas.filter(l => l.dado === null).sort((a, b) => a.classe.localeCompare(b.classe))) {
        console.log(`  ${l.classe.slice(0, 14).padEnd(15)} ${l.nome.slice(0, 34).padEnd(35)} custo: ${l.custoTxt || '—'}`);
    }
}
console.log('\n' + '═'.repeat(74));
console.log('Só leitura — nada foi gravado. Rode com --detalhe para ver as sem dano.');
console.log('═'.repeat(74) + '\n');
process.exit(0);
