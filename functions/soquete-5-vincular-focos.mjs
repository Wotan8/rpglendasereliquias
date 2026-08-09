/**
 * Passo 5 do soquete mágico v2 — os focos deixam de ser inertes.
 *
 * Cada foco ganha um vínculo em `Acerto Mágico`, espelhando a arma:
 *
 *   arma:  Item: Qualidade + Item: Afiação  min Teto de Ofício: Braço  + FOR
 *   foco:  Item: Qualidade                  min Teto de Ofício: <Esc>  + <attr> + Perícia: <escola>
 *
 * ⚠ A ORDEM DOS TERMOS É A REGRA. O motor faz fold sequencial da esquerda para
 * a direita, sem parênteses: o `min` tem que vir logo depois da Qualidade. Se o
 * atributo vier antes, o teto capa o Alvo inteiro em vez de capar só o que a
 * peça entrega — e o personagem trained ficaria com Alvo 5.
 *
 * `Item: Afiação` não entra: o equivalente do foco seria o Reforço Arcano, que
 * ainda não existe como campo (ver cabeçalho do passo 4).
 *
 * Instrumentos do Bardo: a família decide o atributo e a perícia (corda DES,
 * percussão FOR, sopro VIG), como a arma decide entre FOR e DES no §6.3.
 * Ficam de fora os instrumentos marcados para outra classe (Chocalho do Xamã,
 * Apito do Druida) — instrumento não é o foco daquelas escolas.
 *
 *   node functions/soquete-5-vincular-focos.mjs            (dry-run)
 *   node functions/soquete-5-vincular-focos.mjs --apply
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

/* escola → [atributo, perícia] */
const ESCOLA = {
    Pallomancia:   ['PRE', 'Devoção em Palla'],
    Necromancia:   ['PRS', 'Talismã Profano'],
    Abismancia:    ['PRS', 'Abismancia'],
    Totemancia:    ['INT', 'Totemismo'],
    Runomancia:    ['INT', 'Runomancia'],
    'Sonoromancia/corda':     ['DES', 'Inst. de Corda'],
    'Sonoromancia/percussão': ['FOR', 'Inst. de Percussão'],
    'Sonoromancia/sopro':     ['VIG', 'Inst. de Sopro'],
};
const tetoDe = k => `Teto de Ofício: ${k.split('/')[0]}`;

/* item (nome exato) → chave de escola. Só entram os que o catálogo desambigua
   sozinho, por tag de classe ou por tipo de foco. */
const FOCOS = {
    'Símbolo Sagrado de Madeira':             'Pallomancia',
    'Talismã Profano Rústico':                'Necromancia',
    'Coração de Osso de Corisco':             'Necromancia',
    'Diário de Necromancia':                  'Necromancia',
    'Talismã Profano do Ouvinte das Sombras': 'Necromancia',
    'Talismã Abissal Rústico':                'Abismancia',
    'Talismã Abissal':                        'Abismancia',
    'Diário de Rituais em Branco':            'Abismancia',
    'Totem Pessoal Entalhado':                'Totemancia',
    'Totem de Garras':                        'Totemancia',
    'Grimório de Aprendiz':                   'Runomancia',
    'Alaúde Clássico':   'Sonoromancia/corda',
    'Harpa de Colo':     'Sonoromancia/corda',
    'Rabeca':            'Sonoromancia/corda',
    'Tambor de Mão':     'Sonoromancia/percussão',
    'Címbalos':          'Sonoromancia/percussão',
    'Pandeireta':        'Sonoromancia/percussão',
    'Flauta de Madeira': 'Sonoromancia/sopro',
    'Gaita de Foles':    'Sonoromancia/sopro',
    'Trompa de Caça':    'Sonoromancia/sopro',
};
/* Sem tag de classe e sem nome que resolva — não chuto. */
const AMBIGUOS = ['Caderno de Notas de Vasteluna', 'Grimório dos Ecos Cifrados'];

const montar = chave => {
    const [attr, per] = ESCOLA[chave];
    return [
        { tipo: 'ficha', ref: 'Item: Qualidade' },
        { op: 'min', tipo: 'ficha', ref: tetoDe(chave) },
        { op: '+', tipo: 'ficha', ref: attr },
        { op: '+', tipo: 'ficha', ref: `Perícia: ${per}` },
    ];
};

/* ═══ ASSERTS — reproduz o fold e prova que o teto capa só a peça ═══ */
const fold = (eq, ctx) => {
    const val = t => (t.tipo === 'ficha' ? (ctx[t.ref] ?? 0) : Number(t.valor) || 0);
    let r = val(eq[0]);
    for (let i = 1; i < eq.length; i++) {
        const v = val(eq[i]), op = eq[i].op || '+';
        if (op === '+') r += v; else if (op === '-') r -= v;
        else if (op === '×') r *= v; else if (op === '÷') r = v !== 0 ? r / v : 0;
        else if (op === 'min') r = Math.min(r, v); else if (op === 'max') r = Math.max(r, v);
    }
    return r;
};
const eqPalla = montar('Pallomancia');
/* Sem Domínio: teto = PRE = 5. Foco Q5. Alvo = min(5,5) + 5 + 5 = 15. */
assert.equal(fold(eqPalla, { 'Item: Qualidade': 5, 'Teto de Ofício: Pallomancia': 5, PRE: 5, 'Perícia: Devoção em Palla': 5 }), 15,
    'foco Q5 com teto no atributo: Alvo 15');
/* Sem treino no atributo: teto = PRE = 2 morde a Qualidade 5, mas NÃO o resto. */
assert.equal(fold(eqPalla, { 'Item: Qualidade': 5, 'Teto de Ofício: Pallomancia': 2, PRE: 2, 'Perícia: Devoção em Palla': 4 }), 8,
    'o teto capa só o que a peça entrega (2), não o Alvo inteiro');
/* Com o Domínio (+10) o teto para de morder. */
assert.equal(fold(eqPalla, { 'Item: Qualidade': 5, 'Teto de Ofício: Pallomancia': 12, PRE: 2, 'Perícia: Devoção em Palla': 4 }), 11,
    'com Domínio a Qualidade rende inteira');
/* A armadilha da ordem: atributo antes do min faria o teto capar tudo. */
const errada = [eqPalla[2], eqPalla[3], eqPalla[0], eqPalla[1]];
assert.ok(fold(errada, { 'Item: Qualidade': 5, 'Teto de Ofício: Pallomancia': 2, PRE: 2, 'Perícia: Devoção em Palla': 4 }) === 2,
    'ordem errada capa o Alvo inteiro em 2 — é exatamente o que a ordem certa evita');
assert.equal(new Set(Object.values(FOCOS)).size, 8, 'as 8 chaves de escola são usadas');
console.log('✅ 5 asserts passaram (inclusive a prova da ordem dos termos).\n');

/* ═══ GRAVAÇÃO ═══ */
const grab = async c => (await db.collection(`system/data/${c}`).get()).docs.map(d => ({ id: d.id, ...d.data() }));
const [eq, vds, sks] = await Promise.all(['equipment', 'derivedValues', 'skills'].map(grab));
const acertoMagico = vds.find(v => v.nome === 'Acerto Mágico');
const nomesVD = new Set(vds.map(v => v.nome)), nomesSk = new Set(sks.map(s => s.nome));

const erros = [], plano = [];
if (!acertoMagico) erros.push('VD "Acerto Mágico" não encontrado');
for (const chave of Object.keys(ESCOLA)) {
    if (!nomesVD.has(tetoDe(chave))) erros.push(`VD "${tetoDe(chave)}" não existe — rode o passo 4 antes`);
    if (!nomesSk.has(ESCOLA[chave][1])) erros.push(`perícia "${ESCOLA[chave][1]}" não existe`);
}
for (const [nome, chave] of Object.entries(FOCOS)) {
    const achados = eq.filter(i => i.nome === nome);
    if (achados.length !== 1) { erros.push(`item "${nome}": ${achados.length} achados (esperado 1)`); continue; }
    const it = achados[0];
    if ((it.valoresDerivadosVinculados || []).some(v => v.id === acertoMagico?.id)) {
        erros.push(`"${nome}" já tem vínculo de Acerto Mágico`); continue;
    }
    plano.push({ id: it.id, nome, chave, atuais: it.valoresDerivadosVinculados || [] });
}

console.log('=== Passo 5: vincular focos ao Acerto Mágico ===\n');
let ult = '';
for (const p of plano.sort((a, b) => a.chave.localeCompare(b.chave) || a.nome.localeCompare(b.nome))) {
    if (p.chave !== ult) { const [a, s] = ESCOLA[p.chave]; console.log(`\n  ${p.chave}  →  min(Qualidade, ${tetoDe(p.chave)}) + ${a} + [Perícia: ${s}]`); ult = p.chave; }
    console.log(`      ${p.nome}`);
}
console.log(`\n  ${plano.length} focos vinculados.`);
console.log(`\n  NÃO vinculados — o catálogo não desambigua a escola, e eu não chuto:`);
AMBIGUOS.forEach(n => console.log(`      ${n}   (tag só "Tomo", sem tag de classe)`));

if (erros.length) { console.error('\n🔴 ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
if (plano.length !== Object.keys(FOCOS).length) { console.error(`\n🔴 ABORTADO: ${plano.length}/${Object.keys(FOCOS).length} no plano.`); process.exit(1); }

if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }
const col = db.collection('system/data/equipment');
for (const p of plano) {
    await col.doc(p.id).update({
        valoresDerivadosVinculados: [...p.atuais, { id: acertoMagico.id, equacao: montar(p.chave) }],
        updatedAt: Date.now(),
    });
}
console.log(`\n✅ ${plano.length} focos vinculados.`);
process.exit(0);
