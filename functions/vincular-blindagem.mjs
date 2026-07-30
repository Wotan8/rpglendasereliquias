/**
 * Pente fino de Blindagem nas vestimentas/armaduras.
 *
 * Blindagem é Valor Derivado global (hV1UIhcVb4Ip7lgsqtLm), então o vínculo usa
 * o campo que já existe: valoresDerivadosVinculados = [{id, modificador}].
 * Nada de código muda — inventory.js já soma isso em mechanicBonuses ao equipar.
 *
 * Escala vigente, lida das 16 peças do Livro que já estavam vinculadas:
 *   Leve 1-2 | Média I 3 | Média II-III 4 | Pesada I 5 | Pesada II 6 | Pesada III 7
 *   Escudos: Broquel 1 | Médio 2 | Grande 3 | Torre 4
 *
 * node functions/vincular-blindagem.mjs          → dry-run + auditoria
 * node functions/vincular-blindagem.mjs --write  → grava
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const serviceAccount = require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const WRITE = process.argv.includes('--write');
const BLINDAGEM = 'hV1UIhcVb4Ip7lgsqtLm';

/**
 * Só peças que a descrição afirma serem armadura. Vestuário sem proteção fica
 * de fora por regra do Livro — "Roupas Comuns: Não oferecem Blindagem".
 */
const NOVOS = {
    // "couro curtido de alta qualidade" — mesma faixa do Couro Batido (2)
    'Armadura Leve': 2,
    // a própria descrição abre com "couro bruto que oferece proteção básica" (1)
    'Manto de Linho': 1,
};

const eq = await db.collection('system/data/equipment').get();
const itens = eq.docs.map(d => ({ ref: d.ref, ...d.data() }));
const blindagemDe = i => (i.valoresDerivadosVinculados || []).find(x => x.id === BLINDAGEM)?.modificador;

const lote = db.batch();
let mudados = 0;

console.log('########## A VINCULAR ##########');
for (const [nome, valor] of Object.entries(NOVOS)) {
    const item = itens.find(i => i.nome === nome);
    if (!item) { console.log(`  ❌ não encontrado: ${nome}`); continue; }
    const atual = blindagemDe(item);
    if (atual === valor) { console.log(`  = ${nome}: já está em ${valor}`); continue; }

    const resto = (item.valoresDerivadosVinculados || []).filter(x => x.id !== BLINDAGEM);
    lote.update(item.ref, { valoresDerivadosVinculados: [...resto, { id: BLINDAGEM, modificador: valor }] });
    console.log(`  + ${nome}: ${atual ?? '—'} → ${valor}`);
    mudados++;
}

// ===== Auditoria: nada com tag de armadura pode ficar sem Blindagem =====
const armaduras = itens.filter(i => (i.tags || []).includes('Armadura') || (i.tags || []).includes('Escudo'));
const semBlindagem = armaduras.filter(i => blindagemDe(i) === undefined && !(i.nome in NOVOS));

console.log(`\n########## COBERTURA ##########`);
console.log(`peças com tag Armadura ou Escudo: ${armaduras.length}`);
console.log(`sem Blindagem após esta rodada: ${semBlindagem.length}`);
semBlindagem.forEach(i => console.log(`  ⚠️ ${i.nome}`));

// ===== Auditoria: a escala bate com as tags de peso? =====
const FAIXA = { Leve: [1, 2], 'Média': [3, 4], Pesada: [5, 7] };
console.log(`\n########## ESCALA vs TAG DE PESO ##########`);
for (const i of armaduras) {
    const bl = i.nome in NOVOS ? NOVOS[i.nome] : blindagemDe(i);
    const peso = ['Leve', 'Média', 'Pesada'].find(t => (i.tags || []).includes(t));
    if (!peso || bl === undefined) continue;
    const [min, max] = FAIXA[peso];
    const fora = bl < min || bl > max ? `  ⚠️ fora da faixa ${min}-${max}` : '';
    console.log(`  ${String(bl).padStart(2)}  ${peso.padEnd(7)} ${i.nome}${fora}`);
}

// ===== Vestuário sem proteção: confirma que segue zerado de propósito =====
const vestuario = itens.filter(i => i.tipo === 'Vestimenta' && !(i.tags || []).includes('Armadura'));
const comBlindagemIndevida = vestuario.filter(i => blindagemDe(i) !== undefined);
console.log(`\n########## VESTUÁRIO SEM PROTEÇÃO (${vestuario.length}) ##########`);
console.log(`Regra do Livro: "Roupas Comuns — Não oferecem Blindagem". Mantidos em zero.`);
if (comBlindagemIndevida.length) comBlindagemIndevida.forEach(i => console.log(`  ⚠️ tem Blindagem mas não é armadura: ${i.nome} = ${blindagemDe(i)}`));
else console.log('  nenhum tem Blindagem — coerente.');

if (!mudados) { console.log('\nNada a gravar.'); process.exit(); }
if (WRITE) { await lote.commit(); console.log(`\n✅ ${mudados} peça(s) vinculada(s).`); }
else console.log('\n(dry-run — rode com --write para gravar)');
process.exit();
