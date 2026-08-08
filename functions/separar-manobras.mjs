/**
 * Separa "Manobras" em dois módulos — Guerreiro e Ladino.
 *
 * O PROBLEMA: um módulo só, apontado pelas duas classes. O portão de classe
 * existe e está em cada item ("Classe da Manobra Guerreiro/Ladino"), mas
 * guardado em `custoCriacaoMecanicaIds` — a lista de CUSTO. Ela calcula e não
 * barra. O bloqueio de verdade é `bloqueioMecanicaIds` + `cadastrarBloqueio`
 * (ficha: _checkModuleBlockStatus), e estava vazio. Resultado: Guerreiro
 * comprando manobra de Ladino.
 *
 * A CORREÇÃO: dois módulos, cada um com o portão da própria classe no campo
 * que barra. A divisão 9/10 não é palpite — sai do portão que cada item já
 * carregava.
 *
 * Também corrige o Salto Predatório: "Com 5+ Graus, ignora 1 de Reação" é
 * redundante, porque 5 Graus já derrubam 5 de Reação (Livro §6.4).
 *
 *   node functions/separar-manobras.mjs            (dry-run)
 *   node functions/separar-manobras.mjs --apply
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');
const GATE = { Guerreiro: 'HnMa2uFYj57bf5i2nK2s', Ladino: 'QCTGftt6FPARGxBC6tWz' };
const NOVO = { Guerreiro: 'manobras_guerreiro', Ladino: 'manobras_ladino' };

/* Salto Predatório — o degrau tem que entregar ALÉM do que os Graus já dão. */
const SALTO_DE = 'Com 5+ Graus de acerto, ignora 1 de Reação.';
const SALTO_PARA = 'Com 5+ Graus de acerto, ignora 6 de Reação.';

const [modsSnap, clsSnap] = await Promise.all([
    db.collection('system/data/classModules').get(),
    db.collection('system/data/classes').get(),
]);
const velho = modsSnap.docs.find(d => d.id === 'Manobras');
assert.ok(velho, 'módulo Manobras não achado');
const m = velho.data();

/* divisão pelo portão que o item já carrega */
const porClasse = { Guerreiro: [], Ladino: [] };
const erros = [];
for (const it of (m.itensPredefinidos || [])) {
    const s = JSON.stringify(it);
    const g = s.includes(GATE.Guerreiro), l = s.includes(GATE.Ladino);
    if (g && l) { erros.push(`${it.nome}: carrega os DOIS portões`); continue; }
    if (!g && !l) { erros.push(`${it.nome}: sem portão de classe`); continue; }
    /* o portão sai da lista de custo: ele nunca foi custo, e agora mora no
       módulo. Deixá-lo ali cobraria EXP por ser da própria classe. */
    const limpo = { ...it };
    for (const k of ['custoCriacaoMecanicaIds', 'custoEdicaoMecanicaIds', 'custoRemocaoMecanicaIds', 'mecanicaIds'])
        if (Array.isArray(limpo[k])) limpo[k] = limpo[k].filter(x => x !== GATE.Guerreiro && x !== GATE.Ladino);
    if (limpo.nome === 'Salto Predatório') {
        let achou = false;
        if (String(limpo.descricao || '').includes(SALTO_DE)) { limpo.descricao = limpo.descricao.replace(SALTO_DE, SALTO_PARA); achou = true; }
        const v = { ...(limpo.valores || {}) };
        for (const [k, val] of Object.entries(v))
            if (typeof val === 'string' && val.includes(SALTO_DE)) { v[k] = val.replace(SALTO_DE, SALTO_PARA); achou = true; }
        limpo.valores = v;
        if (!achou) erros.push('Salto Predatório: texto da Reação não achado');
    }
    porClasse[g ? 'Guerreiro' : 'Ladino'].push(limpo);
}
if (porClasse.Guerreiro.length !== 9) erros.push(`Guerreiro: ${porClasse.Guerreiro.length} itens (esperado 9)`);
if (porClasse.Ladino.length !== 10) erros.push(`Ladino: ${porClasse.Ladino.length} itens (esperado 10)`);
for (const id of Object.values(NOVO)) if (modsSnap.docs.some(d => d.id === id)) erros.push(`módulo ${id} já existe`);

const classesDe = c => clsSnap.docs.filter(d => (d.data().modulosDaClasse || []).includes('Manobras') && d.data().nome === c);
for (const c of ['Guerreiro', 'Ladino']) if (!classesDe(c).length) erros.push(`classe ${c} não aponta para Manobras`);

console.log('=== Separar Manobras ===\n');
for (const c of ['Guerreiro', 'Ladino']) {
    console.log(`▸ ${NOVO[c]}  (${porClasse[c].length} itens) · bloqueio: "Classe da Manobra ${c}"`);
    console.log(`   ${porClasse[c].map(i => i.nome).join(' · ')}`);
}
console.log(`\n  Salto Predatório: "${SALTO_DE}" → "${SALTO_PARA}"`);
console.log('  Portão de classe SAI de custoCriacaoMecanicaIds e vira bloqueio do módulo.');
console.log('  Módulo "Manobras" antigo: despublicado (2 fichas com dado órfão, ambas erradas — um Guerreiro com Salto Predatório e um Xamã com Postura Ofensiva).');
if (erros.length) { console.error('\n🔴 ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

const agora = admin.firestore.Timestamp.now();
const batch = db.batch();
for (const c of ['Guerreiro', 'Ladino']) {
    batch.set(db.collection('system/data/classModules').doc(NOVO[c]), {
        ...m,
        titulo: `Manobras de ${c}`,
        itensPredefinidos: porClasse[c],
        bloqueioMecanicaIds: [GATE[c]],
        cadastrarBloqueio: true,
        criadoEm: agora, atualizadoEm: agora, versao: 1,
    });
    for (const d of classesDe(c)) {
        const lista = (d.data().modulosDaClasse || []).filter(x => x !== 'Manobras');
        batch.update(d.ref, { modulosDaClasse: [...lista, NOVO[c]], atualizadoEm: agora });
    }
}
batch.update(velho.ref, { publicado: false, titulo: 'Manobras (aposentado — ver Manobras de Guerreiro/Ladino)', atualizadoEm: agora });
await batch.commit();
console.log('\n✅ Dois módulos criados, classes reapontadas, antigo aposentado.');
process.exit(0);
