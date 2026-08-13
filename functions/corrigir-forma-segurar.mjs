/**
 * "Segurar" desliga TODO efeito do item — ver itemFormasAtuais() em
 * ficha-v1.7_1/js/inventory.js: estado 'segurar' retorna ['segurando'] e nunca
 * 'efeitos'. Logo, peça com vínculo mecânico cadastrada como Segurar fica MUDA
 * na ficha: o arco não soma acerto, o escudo não soma Blindagem, o totem não faz
 * nada. O certo para item de mão que produz efeito é Empunhar.
 *
 * Este script varre catálogo e instâncias e troca segurar → empunhar SÓ onde a
 * peça aplica algum efeito. Item inerte (erva, receita, tinta, comida, moeda)
 * continua Segurar de propósito — é para isso que a forma existe.
 *
 * Instância herda do modelo (equip-campos.js: HERDA_DO_MODELO), então o efeito é
 * resolvido como `instancia.campo ?? modelo.campo` — senão uma Adaga com os
 * vínculos vazios no doc passaria por inerte.
 *
 *   node functions/corrigir-forma-segurar.mjs          → só relata (dry-run)
 *   node functions/corrigir-forma-segurar.mjs --aplicar → grava
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const serviceAccount = require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const APLICAR = process.argv.includes('--aplicar');
const CATALOGO = 'system/data/equipment';

/** Campos que, preenchidos, fazem a peça produzir efeito em alguém. */
const VINCULOS = ['mecanicaIds', 'valoresDerivadosVinculados', 'statusVitaisVinculados',
    'condicaoIds', 'atributosVinculados', 'periciasVinculadas'];

const aplicaEfeito = (item, modelo = null) => {
    const campo = (k) => item?.[k] ?? modelo?.[k];
    return VINCULOS.some(k => (campo(k) || []).length > 0)
        || !!String(campo('formulaDano') || '').trim()
        || (item?.tipo ?? modelo?.tipo) === 'Arma';  // arma se empunha, tendo dano cadastrado ou não
};

const docs = async (col) => (await db.collection(col).get()).docs.map(d => ({ id: d.id, ...d.data() }));

const catalogo = await docs(CATALOGO);
const porId = new Map(catalogo.map(i => [i.id, i]));

// Mão e Língua Longa são as únicas partes com podeEmpunhar; só nelas o estado
// 'segurar' vira 'empunhado' sem deixar o item num slot que não o aceita.
// (slotAnatomico é `<partId>_<n>` — a mão direita e a esquerda são a mesma parte.)
const maos = new Set((await docs('system/data/bodyParts')).filter(p => p.podeEmpunhar).map(p => p.id));
const ehMao = (slot) => maos.has(String(slot || '').replace(/_\d+$/, ''));

const alvos = { [CATALOGO]: [], items: [] };
for (const col of [CATALOGO, 'items']) {
    for (const i of col === CATALOGO ? catalogo : await docs(col)) {
        if (i.formaEquipar !== 'segurar') continue;
        const modelo = i.modeloId ? porId.get(i.modeloId) : null;
        if (!aplicaEfeito(i, modelo)) continue;
        // Já equipado como 'segurar': só trocar a forma deixaria o item parado
        // num estado que continua sem efeito. O estado vai junto.
        const trocaEstado = i.estadoEquip === 'segurar' && ehMao(i.slotAnatomico);
        alvos[col].push({ i, trocaEstado, herdado: !aplicaEfeito(i) });
    }
}

for (const [col, arr] of Object.entries(alvos)) {
    console.log(`\n### ${col} — ${arr.length} peça(s) mudas`);
    for (const { i, trocaEstado, herdado } of arr) {
        console.log(`  ${(i.nome || '(sem nome)').padEnd(38)} [${i.tipo || '?'}]`
            + `${herdado ? ' (efeito herdado do modelo)' : ''}${trocaEstado ? ' + estadoEquip→empunhado' : ''}`);
    }
}

const total = alvos[CATALOGO].length + alvos.items.length;
if (!APLICAR) {
    console.log(`\n${total} doc(s) seriam alterados. Rode com --aplicar para gravar.`);
    process.exit();
}

for (const [col, arr] of Object.entries(alvos)) {
    for (let n = 0; n < arr.length; n += 400) {
        const lote = db.batch();
        for (const { i, trocaEstado } of arr.slice(n, n + 400)) {
            const patch = { formaEquipar: 'empunhar' };
            if (trocaEstado) patch.estadoEquip = 'empunhado';
            lote.update(db.doc(`${col}/${i.id}`), patch);
        }
        await lote.commit();
    }
}
console.log(`\n✅ ${total} doc(s) corrigidos para 'empunhar'.`);
process.exit();
