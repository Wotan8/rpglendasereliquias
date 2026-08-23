/**
 * PARTE MORTA -> PARTE DE GUARDA
 *
 * O cadastro vinha tentando dizer "empunho na mão, mas CARREGO nas costas"
 * enfiando as duas partes em `equipavelEm`. Como `formaEquipar` é um valor só,
 * a parte extra virava letra morta: aparecia no modal de equipar e não oferecia
 * estado nenhum, porque Costas não empunha.
 *
 * Agora existe `equipavelEmGuardado` (ver shared/equip-slots.js, formaNoSlot).
 * Este script move a parte morta de uma lista para a outra. A Forma de Equipar
 * NÃO muda — o arco continua sendo empunhado na mão.
 *
 *   node functions/migrar-partes-de-guarda.mjs            # dry-run
 *   node functions/migrar-partes-de-guarda.mjs --apply    # grava
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');

const CAPACIDADE = { segurar: 'podeSegurar', empunhar: 'podeEmpunhar', vestir: 'podeVestir', fixar: 'podeFixar' };

const partes = {};
(await db.collection('system/data/bodyParts').get()).forEach(d => { partes[d.id] = { id: d.id, ...d.data() }; });

let achados = 0, mexidos = 0, semSaida = 0;

for (const col of ['system/data/equipment', 'items']) {
    const snap = await db.collection(col).get();
    for (const d of snap.docs) {
        const x = d.data();
        const forma = x.formaEquipar;
        if (!forma || !CAPACIDADE[forma]) continue;

        const lista = (x.equipavelEm || []).map(id => partes[id]).filter(Boolean);
        if (lista.length < 2) continue;                       // uma parte só: nada a separar

        const usa = lista.filter(p => p[CAPACIDADE[forma]]);
        const mortas = lista.filter(p => !p[CAPACIDADE[forma]]);
        if (!mortas.length) continue;
        achados++;

        // Sem NENHUMA parte que aceite a forma, o problema é outro (é o caso que
        // corrigir-forma-equipar.mjs trata trocando a forma). Não é aqui.
        if (!usa.length) {
            semSaida++;
            console.log(`  ⚠️  [${col.split('/').pop()}] ${x.nome || d.id}: nenhuma parte aceita "${forma}" — caso de corrigir-forma-equipar.mjs`);
            continue;
        }

        // Guardar exige podeFixar (ou, na falta, podeSegurar). Parte que não faz
        // nem um nem outro sai da lista: ali a peça não tem como ficar.
        const guardaveis = mortas.filter(p => p.podeFixar || p.podeSegurar);
        const perdidas = mortas.filter(p => !p.podeFixar && !p.podeSegurar);

        const jaTinha = x.equipavelEmGuardado || [];
        const novoGuardado = [...new Set([...jaTinha, ...guardaveis.map(p => p.id)])];
        const novoUso = usa.map(p => p.id);

        mexidos++;
        console.log(`  ${APPLY ? '✍️ ' : '· '}[${col.split('/').pop()}] ${x.nome || d.id} (${forma})`);
        console.log(`      usa: ${usa.map(p => p.nome).join(', ')}   ·   guarda: ${guardaveis.map(p => p.nome).join(', ') || '—'}`
            + (perdidas.length ? `   ·   descartadas: ${perdidas.map(p => p.nome).join(', ')}` : ''));

        if (APPLY) {
            await d.ref.update({
                equipavelEm: novoUso,
                equipavelEmGuardado: novoGuardado,
                lastModified: new Date().toISOString(),
            });
        }
    }
}

console.log(`\n${achados} peça(s) com parte morta · ${mexidos} ${APPLY ? 'migradas' : 'a migrar'} · ${semSaida} fora do escopo`);
if (!APPLY) console.log('Rode de novo com --apply para gravar.');
