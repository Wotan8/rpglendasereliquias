/**
 * Varre todas as mecânicas atrás de ref/alvo que apontam para PERÍCIA sem o
 * prefixo "Perícia: ". Sem o prefixo, getRefValue casa antes com um VD homônimo
 * e a mecânica lê o número errado, em silêncio.
 *
 *   node functions/normalizar-refs-pericia.mjs            (dry-run)
 *   node functions/normalizar-refs-pericia.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');

const grab = async c => (await db.collection(`system/data/${c}`).get()).docs.map(d => ({ id: d.id, ...d.data() }));
const [mechs, skills, dvs] = await Promise.all(['mechanics', 'skills', 'derivedValues'].map(grab));

const nomesPericia = new Set(skills.map(s => s.nome));
const nomesDv = new Set(dvs.map(d => d.nome));
const ATRIBUTOS = new Set(['FOR','DES','VIG','INT','RAC','PRS','PRE','MAN','AUT',
    'Força','Destreza','Vigor','Inteligência','Raciocínio','Perseverança','Presença','Manipulação','Autocontrole']);

// Perícia sem prefixo = ambígua. Se também existe VD com o mesmo nome, está QUEBRADA hoje.
const precisaPrefixo = n => typeof n === 'string' && !n.startsWith('Perícia: ')
    && !ATRIBUTOS.has(n) && nomesPericia.has(n);

const colisoes = [...nomesPericia].filter(n => nomesDv.has(n)).sort();
console.log(`Nomes que existem como perícia E como VD (${colisoes.length}):\n  ${colisoes.join(', ')}\n`);

/* Dois grupos que NÃO podem ser tratados igual:
   - SEGURO: o nome só existe como perícia. Pôr o prefixo não muda resultado
     nenhum hoje, só tira a ambiguidade para o futuro.
   - MUDA COMPORTAMENTO: o nome existe como perícia E como VD. Hoje resolve
     para o VD; com o prefixo passa a resolver para a perícia. Só com --incluir-ambiguos. */
const INCLUIR_AMBIGUOS = process.argv.includes('--incluir-ambiguos');

const seguros = [], mudam = [];
for (const m of mechs) {
    const cfg = JSON.parse(JSON.stringify(m.config || {}));
    const achados = [];
    let temAmbiguo = false;

    for (const c of cfg.calculos || []) {
        // `alvo` de perícia também leva prefixo (nunca renomeia alvo que é VD)
        if (precisaPrefixo(c.alvo) && !nomesDv.has(c.alvo)) {
            achados.push(`alvo "${c.alvo}"`); c.alvo = `Perícia: ${c.alvo}`;
        }
        for (const t of c.equacao || []) {
            if (t.tipo !== 'ficha' || !precisaPrefixo(t.ref)) continue;
            const ambiguo = nomesDv.has(t.ref);
            if (ambiguo && !INCLUIR_AMBIGUOS) { temAmbiguo = true; continue; }
            achados.push(`ref "${t.ref}"${ambiguo ? '  ⚠️ passa a ler a PERÍCIA (hoje lê o VD)' : ''}`);
            if (ambiguo) temAmbiguo = true;
            t.ref = `Perícia: ${t.ref}`;
        }
    }
    if (achados.length) (temAmbiguo ? mudam : seguros).push({ id: m.id, nome: m.nome, fonte: m.fonte, achados, cfg });
    else if (temAmbiguo) mudam.push({ id: m.id, nome: m.nome, fonte: m.fonte, achados: ['(só o ref ambíguo — segurado)'], cfg: null });
}

console.log(`=== SEGURAS: só existem como perícia, prefixo é no-op (${seguros.length}) ===`);
for (const a of seguros) {
    console.log(`  ${a.nome}  [${a.fonte}]`);
    for (const x of a.achados) console.log(`      ${x}`);
}
console.log(`\n=== MUDAM COMPORTAMENTO — precisam da sua decisão (${mudam.length}) ===`);
for (const a of mudam) {
    console.log(`  ${a.nome}  [${a.fonte}]  ${a.id}`);
    for (const x of a.achados) console.log(`      ${x}`);
}
if (!INCLUIR_AMBIGUOS && mudam.length) console.log('\n  (rode com --incluir-ambiguos para corrigir estas também)');

const aplicar = INCLUIR_AMBIGUOS ? [...seguros, ...mudam].filter(a => a.cfg) : seguros;
if (!APPLY) { console.log(`\nDRY-RUN — ${aplicar.length} seria(m) gravada(s).`); process.exit(); }
for (const a of aplicar) {
    await db.doc(`system/data/mechanics/${a.id}`).update({ config: a.cfg, atualizadoEm: new Date() });
}
console.log(`\n✔ ${aplicar.length} mecânica(s) normalizada(s).`);
process.exit();
