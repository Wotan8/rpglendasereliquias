/**
 * Passo 3 do soquete mágico v2 — `atributoChave` nas 11 classes (hoje null em
 * todas). Definição adotada: **o atributo do teste principal da classe** — o
 * mesmo que entra no Alvo quando ela faz aquilo que só ela faz.
 *
 * A sigla é o formato de ref do motor ("PRE", "DES"...), igual ao que as
 * equações usam. Atributo é chave de código, não documento.
 *
 * ⚠ Nenhum código lê esse campo hoje. Gravar é reversível e não muda nada na
 * mesa; serve para o balanceamento e para o que vier depois.
 *
 * Quatro classes são empate na contagem de perícias e a escolha veio do teste
 * principal, não da maioria — vão marcadas com «?» no relatório.
 *
 *   node functions/soquete-3-atributo-chave.mjs            (dry-run)
 *   node functions/soquete-3-atributo-chave.mjs --apply
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

/* classe → [sigla, por quê, empate?] */
const CHAVE = {
    'Pallacerdote':         ['PRE', 'Devoção em Palla e Símbolo Sagrado, os dois PRE', false],
    'Adepto de Thannathog': ['PRS', 'o grimório manda "Teste de Convocar: PRS + Liderança + Talismã"', false],
    'Invocador do Abismo':  ['PRS', 'Abismancia, a perícia da escola, é PRS', false],
    'Bardo':                ['PRE', 'Presença Sonoral; PRE aparece em 3 das 9 perícias', false],
    'Runimago':             ['INT', 'Erudição e Gravação Rúnica; INT em 2 das 3', false],
    'Guerreiro':            ['FOR', 'Ímpeto e Controle; §6.3 dá FOR às armas de braço', false],
    'Ladino':               ['DES', 'DES em 4 das 5 perícias — sem discussão', false],
    'Sangral':              ['DES', 'Moldar Sangue cobre 7 dos 13 rituais, e é DES', true],
    'Caçador':              ['DES', 'Pontaria; §6.3 dá DES ao Disparo (INT/DES/RAC empatam 2×2×2)', true],
    'Xamã':                 ['PRE', 'Comunhão com Ecos; PRE em 3 das 5 (PRS vem logo atrás)', true],
    'Druida':               ['INT', 'INT em 3 das 6, todas de Alquimancia (Ferinismo puxa AUT)', true],
};

/* ═══ ASSERTS ═══ */
const SIGLAS = new Set(['FOR', 'DES', 'VIG', 'INT', 'RAC', 'PRE', 'PRS', 'AUT', 'MAN']);
assert.equal(Object.keys(CHAVE).length, 11, 'as 11 classes têm que estar listadas');
for (const [c, [sig]] of Object.entries(CHAVE)) assert.ok(SIGLAS.has(sig), `sigla inválida em ${c}: ${sig}`);
assert.equal(CHAVE['Ladino'][0], 'DES', 'Ladino é DES por 4 das 5 perícias');
assert.ok(Object.values(CHAVE).filter(v => v[2]).length === 4, 'quatro empates declarados');
console.log('✅ 15 asserts passaram.\n');

/* ═══ GRAVAÇÃO ═══ */
const col = db.collection('system/data/classes');
const cls = (await col.get()).docs.map(d => ({ id: d.id, ...d.data() }));

const erros = [], plano = [];
for (const [nome, [sigla, porque, empate]] of Object.entries(CHAVE)) {
    const achados = cls.filter(c => c.nome === nome);
    if (achados.length !== 1) { erros.push(`classe "${nome}": ${achados.length} achadas (esperado 1)`); continue; }
    const atual = achados[0].atributoChave;
    if (atual && atual !== sigla) { erros.push(`"${nome}" já tem atributoChave "${atual}" — não sobrescrevo`); continue; }
    plano.push({ id: achados[0].id, nome, sigla, porque, empate, jaTinha: atual === sigla });
}
const semPlano = cls.filter(c => !Object.keys(CHAVE).includes(c.nome));
for (const c of semPlano) erros.push(`classe "${c.nome}" existe no banco e não está na lista`);

console.log('=== Passo 3: atributoChave ===\n');
for (const p of plano) {
    console.log(`  ${p.empate ? '?' : ' '} ${p.nome.padEnd(22)} ${p.sigla}   ${p.porque}`);
}
console.log(`\n  «?» = empate na contagem; a escolha veio do teste principal.`);
if (erros.length) { console.error('\n🔴 ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
if (plano.length !== 11) { console.error(`\n🔴 ABORTADO: ${plano.length} classes no plano (esperado 11).`); process.exit(1); }

if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }
for (const p of plano) if (!p.jaTinha) await col.doc(p.id).update({ atributoChave: p.sigla, updatedAt: Date.now() });
console.log(`\n✅ Gravado em ${plano.filter(p => !p.jaTinha).length} classes.`);
process.exit(0);
