/**
 * Teto de Ofício aparece para quem tem a arte — e só para quem tem.
 *
 * Dois defeitos simétricos na ficha:
 *  a) os 6 Tetos de escola são `todoPersonagem: true` → um Guerreiro carrega
 *     "Teto de Ofício: Pallomancia" na tela sem ter nada a ver com isso;
 *  b) os 10 Domínios têm `derivedValueIds: []` → quem TEM o Domínio não vê o
 *     próprio Teto, porque os 4 marciais são `todoPersonagem: false` e ninguém
 *     os declara. É o mesmo bug do Caolho (a mecânica calcula, o campo some).
 *
 * Correção: desliga o universal dos 6 de escola e faz cada peculiaridade que
 * mexe no Teto declarar esse Teto em derivedValueIds — o Domínio sempre, e a
 * pec da escola também, para o conjurador da classe ver o seu limite mesmo
 * antes de subir o Domínio.
 *
 * Esconder o campo NÃO altera número: derived-values.js calcula os DVs fora da
 * grid de propósito (o comentário do passo 2 do recalc diz isso), então o
 * min(Qualidade, Teto) do foco continua valendo para quem não vê o campo.
 *
 * node functions/tetos-visibilidade.mjs           (dry-run)
 * node functions/tetos-visibilidade.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');

/* Teto → peculiaridades que devem declará-lo. A pec de escola entra junto do
   Domínio; os marciais não têm pec de classe própria (a classe herda o Domínio). */
const VINCULOS = [
    { teto: 'Teto de Ofício: Braço',        pecs: ['Domínio de Armas de Braço'] },
    { teto: 'Teto de Ofício: Precisão',     pecs: ['Domínio de Armas de Precisão'] },
    { teto: 'Teto de Ofício: Disparo',      pecs: ['Domínio de Disparo'] },
    { teto: 'Teto de Ofício: Proteção',     pecs: ['Domínio de Proteção'] },
    { teto: 'Teto de Ofício: Necromancia',  pecs: ['Domínio de Necromancia',  'Necromancia'],  universal: false },
    { teto: 'Teto de Ofício: Abismancia',   pecs: ['Domínio de Abismancia',   'Abismancia'],   universal: false },
    { teto: 'Teto de Ofício: Sonoromancia', pecs: ['Domínio de Sonoromancia', 'Sonoromancia'], universal: false },
    { teto: 'Teto de Ofício: Pallomancia',  pecs: ['Domínio de Pallomancia',  'Pallomancia'],  universal: false },
    { teto: 'Teto de Ofício: Runomancia',   pecs: ['Domínio de Runomancia',   'Runomancia'],   universal: false },
    { teto: 'Teto de Ofício: Totemancia',   pecs: ['Domínio de Totemancia',   'Totemancia'],   universal: false },
];

const grab = async col => (await db.collection(`system/data/${col}`).get()).docs;
const [pecDocs, dvDocs] = await Promise.all(['peculiarities', 'derivedValues'].map(grab));
const pecPorNome = n => pecDocs.find(d => d.data().nome === n);
const dvPorNome = n => dvDocs.find(d => d.data().nome === n);

const erros = [], backup = {}, escritas = [];

for (const v of VINCULOS) {
    const dv = dvPorNome(v.teto);
    if (!dv) { erros.push(`valor derivado "${v.teto}" não existe`); continue; }

    if (v.universal === false && dv.data().todoPersonagem !== false) {
        backup['dv:' + dv.id] = { nome: v.teto, todoPersonagem: dv.data().todoPersonagem };
        escritas.push({
            ref: dv.ref, dados: { todoPersonagem: false },
            log: `OCULTA  ${v.teto.padEnd(32)} deixa de aparecer na ficha de todo mundo`,
        });
    }

    for (const nomePec of v.pecs) {
        const p = pecPorNome(nomePec);
        if (!p) { erros.push(`peculiaridade "${nomePec}" não existe`); continue; }
        const atuais = (p.data().derivedValueIds || []).map(x => typeof x === 'object' ? x.id : x);
        if (atuais.includes(dv.id)) { console.log(`  · ${nomePec}: já declara ${v.teto}`); continue; }

        backup['pec:' + p.id] = backup['pec:' + p.id] || { nome: nomePec, derivedValueIds: p.data().derivedValueIds };
        escritas.push({
            ref: p.ref, dados: { derivedValueIds: [...atuais, dv.id] },
            log: `MOSTRA  ${nomePec.padEnd(32)} passa a declarar "${v.teto}"`,
        });
    }
}

if (erros.length) {
    console.error('\n❌ Conferência falhou, nada foi escrito:');
    erros.forEach(e => console.error('   ' + e));
    process.exit(1);
}

console.log('\n' + escritas.map(e => '  ' + e.log).join('\n'));

if (!APPLY) {
    console.log(`\n🔎 DRY-RUN — ${escritas.length} escrita(s). Rode com --apply para gravar.`);
    process.exit(0);
}

const fs = await import('node:fs');
const arq = `functions/_backup-tetos-visibilidade-${Date.now()}.json`;
fs.writeFileSync(arq, JSON.stringify(backup, null, 2), 'utf8');

const batch = db.batch();
for (const e of escritas) batch.update(e.ref, e.dados);
await batch.commit();
console.log(`\n✅ ${escritas.length} escrita(s) aplicadas. Backup: ${arq}`);
process.exit(0);
