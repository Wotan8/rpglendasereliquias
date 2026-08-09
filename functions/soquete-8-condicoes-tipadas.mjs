/**
 * Passo 8 — condições em campo tipado, e o piso de Chance.
 *
 * Hoje a condição é uma palavra solta na prosa ("Falha: Amedrontado"). A régua
 * acha por regex e o Tabuleiro não tem como mostrar ícone no token. Passa a
 * existir, ao lado dos outros campos tipados do passo 7:
 *
 *   condicoesAplicadas: [{ condicao, portao, chance }]
 *
 * `portao` é 'chance' ou 'resistencia' — NUNCA os dois. Foi decisão da frente de
 * condições e está certa: os dois portões se multiplicam e esvaziam a condição.
 * Quando o texto traz um teste de resistência ("testa AUT vs GS"), o portão é o
 * teste e `chance` fica null.
 *
 * ═══ PISO DE CHANCE = 5 ═══
 *
 * Chance é desconto linear: valor × (Chance ÷ 10). Matematicamente correto, mas
 * a régua mede valor ESPERADO e não enxerga variância. Cego com Chance 3 custa 1
 * e entrega 1,57 de valor esperado — e falha em 70% das vezes. Uma habilidade
 * que na maioria dos turnos não faz nada tem a mesma nota na planilha e uma
 * experiência de mesa completamente diferente.
 *
 * O piso 5 garante que nenhuma habilidade seja majoritariamente nada. O efeito
 * colateral é desejável: com piso 5, Cego (5,23 cheio) não cabe em custo 1 de
 * jeito nenhum — cegar deixa de ser efeito barato, que é como tem que ser.
 *
 *   node functions/soquete-8-condicoes-tipadas.mjs            (dry-run)
 *   node functions/soquete-8-condicoes-tipadas.mjs --apply
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

export const PISO_CHANCE = 5;

/** nome canônico → radical que aparece na prosa */
const CANONICO = {
    Atordoado: /\batordoad/i, Cego: /\bceg[oa]\b|\bcegueira\b/i, Ofuscado: /\bofuscad|\bofusca\b/i,
    Agarrado: /\bagarrad/i, Amedrontado: /\bamedrontad/i, Lento: /\blent[oa]\b/i,
    Prostrado: /\bprostrad/i, Surdo: /\bsurd[oa]\b/i, Exaustão: /\bexaust/i,
};
/** O texto declara teste de resistência? Então o portão é ele.
 *  Duas formas: "testa AUT vs GS" e "teste de VIG ou Atordoado". */
const TEM_RESISTENCIA = /\b(testa|testam|teste de)\s+[\w\s+]{1,24}?(vs|contra)\s*(gs|graus)|teste de \w+ ou\b/i;

/** Aplicar é diferente de REMOVER. "ignora Exaustão" e "remove 1 condição
 *  mental (ex.: cegueira leve)" não aplicam nada — citam a condição para dizer
 *  que ela some. Sem esta trava a régua cobra a magia por um efeito ao contrário. */
const VERBO_REMOCAO = /\b(ignora|ignoram|remove|removem|imune|cura|dissipa|livra|anula|protege contra)\b/i;
const remocao = (s, nome) => {
    /* Toda menção da condição precisa estar sob um verbo de remoção nos ~60
       caracteres anteriores. Se qualquer uma estiver solta, a magia aplica. */
    for (const m of s.matchAll(new RegExp(CANONICO[nome].source, 'gi'))) {
        if (!VERBO_REMOCAO.test(s.slice(Math.max(0, m.index - 60), m.index))) return false;
    }
    return true;
};

export function extrairCondicoes(txt) {
    const s = String(txt || '');
    const chanceDecl = /chance\s*(\d+)/i.exec(s);
    const resist = TEM_RESISTENCIA.test(s);
    const out = [];
    for (const [nome, re] of Object.entries(CANONICO)) {
        if (!re.test(s)) continue;
        if (remocao(s, nome)) continue;
        if (resist) out.push({ condicao: nome, portao: 'resistencia', chance: null });
        else out.push({ condicao: nome, portao: 'chance', chance: chanceDecl ? +chanceDecl[1] : 10 });
    }
    return out;
}

/* ═══ ASSERTS ═══ */
assert.deepEqual(extrairCondicoes('Falha: Amedrontado por 1 cena'),
    [{ condicao: 'Amedrontado', portao: 'chance', chance: 10 }],
    'sem teste declarado, o portão é Chance e o padrão é 10');
assert.deepEqual(extrairCondicoes('1 alvo a 6m testa AUT vs GS. Falha: Lento'),
    [{ condicao: 'Lento', portao: 'resistencia', chance: null }],
    'com teste de resistência, o portão é o teste — nunca os dois');
assert.equal(extrairCondicoes('nada aqui').length, 0, 'prosa sem condição não inventa condição');
assert.equal(extrairCondicoes('Surdo + Atordoado').length, 2, 'duas condições na mesma habilidade');
assert.equal(extrairCondicoes('Alvo recebe +1 Blindagem e ignora Exaustão por 1 cena').length, 0,
    '"ignora Exaustão" REMOVE — não aplica');
assert.equal(extrairCondicoes('remove 1 condição mental (ex.: medo, ofuscamento/cegueira leve)').length, 0,
    'remover condição não é aplicar condição');
assert.equal(extrairCondicoes('Explosão de 5m: teste de VIG ou Atordoado')[0].portao, 'resistencia',
    '"teste de X ou <condição>" também é portão de resistência');
assert.ok(PISO_CHANCE === 5, 'piso de Chance');
/* O piso reprova o que a régua sozinha aprovaria: Cego C=3 custa 1 e passa em
   valor esperado (1,57), mas falha 70% das vezes. */
assert.ok(5.23 * 3 / 10 > 1.00 && 3 < PISO_CHANCE,
    'Cego C=3 passaria na régua e é exatamente o caso que o piso existe para barrar');
console.log('✅ 6 asserts passaram.\n');

/* ═══ LEITURA ═══ */
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

const [modSnap, condSnap] = await Promise.all([
    db.collection('system/data/classModules').get(),
    db.collection('system/data/conditions').get(),
]);
const mods = modSnap.docs.map(d => ({ id: d.id, ...d.data() }));
const cadastradas = new Set(condSnap.docs.map(d => d.data().nome));

const orfas = Object.keys(CANONICO).filter(n => !cadastradas.has(n));
const achadas = [], violacoes = [];
for (const m of mods) {
    const lbl = Object.fromEntries((m.schema || []).map(f => [f.key, String(f.label || '')]));
    const kE = Object.keys(lbl).find(k => /efeito|o que faz/i.test(lbl[k]));
    let mexeu = false;
    const itens = (m.itensPredefinidos || []).map(it => {
        const texto = [String(it.descricao || ''), String((it.valores || {})[kE] || '')]
            .filter(Boolean).reduce((a, b) => (a.includes(b) || b.includes(a) ? (a.length >= b.length ? a : b) : a + ' ' + b), '');
        const conds = extrairCondicoes(texto);
        if (conds.length) {
            achadas.push({ classe: m.titulo, nome: it.nome, conds });
            for (const c of conds) if (c.portao === 'chance' && c.chance < PISO_CHANCE) violacoes.push(`${it.nome}: ${c.condicao} com Chance ${c.chance}`);
        }
        mexeu = true;
        return { ...it, condicoesAplicadas: conds };
    });
    if (mexeu) m._novos = itens;
}

console.log('=== Passo 8: condições tipadas ===\n');
console.log(`  ${achadas.length} habilidades aplicam condição:\n`);
for (const a of achadas.sort((x, y) => x.classe.localeCompare(y.classe))) {
    console.log(`    ${a.classe.slice(0, 22).padEnd(23)} ${a.nome.slice(0, 28).padEnd(29)} ` +
        a.conds.map(c => `${c.condicao}(${c.portao === 'chance' ? 'C' + c.chance : 'resist'})`).join(' + '));
}
console.log(`\n  Portão por resistência: ${achadas.flatMap(a => a.conds).filter(c => c.portao === 'resistencia').length}`);
console.log(`  Portão por Chance:      ${achadas.flatMap(a => a.conds).filter(c => c.portao === 'chance').length}`);
console.log(`  Piso de Chance ${PISO_CHANCE} — violações: ${violacoes.length || 'nenhuma'}`);
violacoes.forEach(v => console.log(`    ⚠ ${v}`));
if (orfas.length) console.log(`\n  ⚠ citadas na prosa mas NÃO cadastradas: ${orfas.join(', ')}`);

if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }
const col = db.collection('system/data/classModules');
for (const m of mods.filter(x => x._novos)) await col.doc(m.id).update({ itensPredefinidos: m._novos, updatedAt: Date.now() });
console.log(`\n✅ Campo condicoesAplicadas gravado (${achadas.length} com condição).`);
process.exit(0);
