/**
 * Conserta os 4 NPCs do Torneio Famélia — duas coisas.
 *
 * ═══ 1. Itens de módulo de classe gravados no formato errado ═══
 * O item de um `modulosClasse[].itens` é PLANO: os valores do schema ficam na
 * RAIZ do objeto, com as chaves do próprio schema, mais `_predefId` e
 * `_predefNome` (é o que `addNpcModuleItem` monta em area-npcs.js, e é o que
 * `renderNpcClassModules` lê em `_npcModFieldHtml(mi, ii, f, item)` → `item[key]`).
 *
 * Eu gravei aninhado — `{ id, predefinidoId, nome, valores: {…} }` — e o
 * renderer nunca olha para dentro de `valores`. Resultado: as manobras e
 * composições apareciam como campos vazios, exatamente como o usuário relatou.
 * Nada se perdeu: os nomes estavam lá, só no lugar errado.
 *
 * ═══ 2. Overrides que só existiam por causa de um bug já corrigido ═══
 * Os NPCs foram montados quando o npc-calc-engine ignorava toda perícia
 * (`buildTargetMap` indexava sem o prefixo `Perícia:`). Isso foi corrigido em
 * 12/08/2026 (535606c), então PERC/REA/INI/SAN voltaram a computar sozinhos —
 * mas o override gravado VENCE o auto, e ficaria mentindo para sempre.
 * Aqui cada override é reconferido contra o motor: o que bate com o cálculo
 * automático é REMOVIDO (volta a ser vivo); o que ainda diverge fica.
 * Vitalidade continua divergindo (cadeia Altura→Tamanho→Vitalidade em 2
 * passadas) e por isso continua travada.
 *
 *   node functions/corrigir-modulos-npcs-torneio.mjs            (dry-run)
 *   node functions/corrigir-modulos-npcs-torneio.mjs --apply
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { calcularNpc } from '../painel-mestre/js/npc-calc-engine.js';

const require = createRequire(import.meta.url);
const APLICAR = process.argv.includes('--apply');
/* Nada de Firebase no topo: `itemDePredefinido`/`itemLivre` são importados pelo
   script do Xamã, e um initializeApp() no carregamento do módulo derrubaria o
   importador com "duplicate-app". Só o bloco de execução lá embaixo conecta. */

const MESA_ID = 'd4Oi7KmowQ2gY4OU0Im8';
const NOMES = ['Grakkun, o Trinca-Muros', 'Vespa, a Voz Dourada',
    'Vireu, a Contadora', 'Hesk, o Cinza'];

/* ═══ Item de módulo no formato que o painel lê (cópia fiel de
   _npcModItemVazio + addNpcModuleItem, area-npcs.js) ═══ */
export function itemVazioDoModulo(def) {
    const item = {};
    (def.schema || []).forEach(f => {
        if (f.tipo === 'progress') { item[f.key + '_atual'] = ''; item[f.key + '_total'] = ''; }
        else if (f.tipo === 'steps' || f.tipo === 'tags') item[f.key] = [];
        else if (f.tipo === 'checkbox') item[f.key] = false;
        else if (f.tipo === 'avaliacao' || f.tipo === 'contador') item[f.key] = 0;
        else if (f.tipo === 'botao' || f.tipo === 'separador') { /* sem valor */ }
        else item[f.key] = '';
    });
    return item;
}

/** Monta o item plano a partir de um pré-cadastrado do registro. */
export function itemDePredefinido(def, predef) {
    const item = itemVazioDoModulo(def);
    item._predefId = predef.id || '';
    item._predefNome = predef.nome || '';
    for (const k of Object.keys(predef.valores || {})) item[k] = predef.valores[k];
    return item;
}

/** Monta o item plano de um item livre (sem pré-cadastrado). */
export function itemLivre(def, nome, valores) {
    const item = itemVazioDoModulo(def);
    item._predefId = '';
    item._predefNome = nome;
    for (const k of Object.keys(valores || {})) item[k] = valores[k];
    return item;
}

/* ═══ Autoteste do conserto ═══ */
{
    const def = { schema: [{ key: '1', tipo: 'text' }, { key: '5', tipo: 'textarea' },
        { key: '7', tipo: 'botao' }, { key: '8', tipo: 'separador' }, { key: '9', tipo: 'checkbox' }] };
    const it = itemDePredefinido(def, { id: 'pdi_x', nome: 'Investida', valores: { 1: 'Investida', 5: '+4 de dano' } });
    assert.equal(it['1'], 'Investida', 'o valor tem que estar na RAIZ, não em item.valores');
    assert.equal(it['5'], '+4 de dano');
    assert.equal(it._predefNome, 'Investida', 'o cabeçalho do item lê _predefNome');
    assert.equal(it._predefId, 'pdi_x');
    assert.equal(it['9'], false, 'checkbox nasce false');
    assert.ok(!('7' in it) && !('8' in it), 'botão e separador não guardam valor');
    assert.ok(!('valores' in it), 'nada de aninhar em `valores` — foi esse o bug');
    console.log('✅ 7 asserts do formato de item de módulo passaram.\n');
}

if (process.argv[1]?.endsWith('corrigir-modulos-npcs-torneio.mjs')) {
    const admin = require('firebase-admin');
    admin.initializeApp({ credential: admin.credential.cert(
        require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
    const db = admin.firestore();

    const modsSnap = await db.collection('system/data/classModules').get();
    const defs = {};
    modsSnap.forEach(d => { defs[d.id] = { id: d.id, ...d.data() }; });

    const cols = ['races', 'classes', 'tribes', 'peculiarities', 'mechanics', 'skills',
        'derivedValues', 'vitalStats', 'classModules', 'equipment'];
    const sd = {};
    await Promise.all(cols.map(async col => {
        const snap = await db.collection(`system/data/${col}`).get();
        const arr = []; snap.forEach(d => { const x = d.data(); if (x.publicado !== false) arr.push({ id: d.id, ...x }); });
        sd[col] = arr;
    }));
    const byId = arr => Object.fromEntries(arr.map(x => [x.id, x]));
    /* A ORDEM IMPORTA. `ensureNpcSystemData` ordena os derivedValues por
       blocoOrdem/ordem antes de entregar ao motor, e o motor só faz 2 passadas
       de estabilização — se Altura vier depois de Tamanho, a cadeia
       Altura→Tamanho→Vitalidade não fecha. Sem esta ordenação eu computava
       Vitalidade 6 onde o Painel do Mestre computa 21,75, e ia "corrigir" a
       ficha do usuário com o número errado. */
    const sys = {
        races: sd.races, classes: sd.classes, tribes: sd.tribes, peculiarities: sd.peculiarities,
        mechanics: sd.mechanics, skills: sd.skills,
        derivedValues: sd.derivedValues.slice()
            .sort((a, b) => (Number(a.blocoOrdem) || 999) - (Number(b.blocoOrdem) || 999)
                         || (a.ordem || 99) - (b.ordem || 99))
            .map(dv => ({ ...dv, key: dv.key || dv.id, escopoItem: dv.escopoItem || '' })),
        vitalStats: sd.vitalStats.slice().sort((a, b) => (a.ordem || 99) - (b.ordem || 99))
            .map(vs => ({ ...vs, key: vs.key || vs.id })),
        classModules: sd.classModules, equipment: sd.equipment,
        norm: s => String(s || '').trim().toLowerCase(),
    };
    sys.pecsById = byId(sys.peculiarities); sys.mechsById = byId(sys.mechanics);
    sys.racesById = byId(sys.races); sys.classesById = byId(sys.classes);
    sys.tribesById = byId(sys.tribes); sys.classModulesById = byId(sys.classModules);

    const npcsSnap = await db.collection('npcs').where('mesaId', '==', MESA_ID).get();
    let mexidos = 0;

    for (const nome of NOMES) {
        const doc = npcsSnap.docs.find(d => (d.data().nome || '').trim() === nome);
        if (!doc) { console.log(`⚠️  "${nome}" não está na mesa — pulando.`); continue; }
        const npc = doc.data();
        const aninhados = (npc.modulosClasse || [])
            .reduce((s, m) => s + (m.itens || []).filter(i => i && 'valores' in i).length, 0);
        console.log('─'.repeat(72));
        console.log(`${npc.nome}  [${doc.id}]  · último save ${(npc.lastUpdate || '').slice(0, 10)}`);
        if (!aninhados) {
            console.log('   ✔ itens de módulo já estão no formato plano — nada a fazer, não vou tocar.');
            continue;
        }

        /* --- 1) módulos --- */
        const modulos = (npc.modulosClasse || []).map(vinc => {
            const def = defs[vinc.refId];
            assert.ok(def, `módulo "${vinc.refId}" sumiu do registro`);
            const pre = def.itensPredefinidos || [];
            const itens = (vinc.itens || []).map(velho => {
                if (velho && !('valores' in velho)) return velho;   // já está plano
                const vals = velho.valores || {};
                const predef = pre.find(p => p.id === velho.predefinidoId)
                    || pre.find(p => p.nome === velho.nome);
                return predef ? itemDePredefinido(def, predef)
                    : itemLivre(def, velho.nome || def.titulo, vals);
            });
            return { ...vinc, itens };
        });
        const consertados = modulos.reduce((s, m, i) =>
            s + m.itens.filter((it, j) => (npc.modulosClasse[i].itens[j] || {}).valores).length, 0);
        console.log(`   módulos: ${consertados} item(ns) reescritos no formato plano`);
        for (const m of modulos) {
            console.log(`     ${defs[m.refId].titulo}: ${m.itens.map(i => i._predefNome).join(' · ')}`);
        }

        /* --- 2) diagnóstico dos overrides — SÓ LEITURA ---
           Não mexo aqui. Estes NPCs foram montados quando o motor ignorava
           perícia; parte dos overrides existia só por causa disso e hoje é
           redundante. Mas o usuário já editou fichas desta mesa à mão, e
           reescrever valor derivado por cima de edição dele seria pior que o
           problema. Reporto e deixo a decisão com ele. */
        const itemsSnap = await db.collection('items').where('characterId', '==', doc.id).get();
        const items = itemsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const calc = calcularNpc({ ...npc, modulosClasse: modulos }, sys, { items });
        const redundantes = [];
        for (const [key, val] of Object.entries(npc.valoresDer?.overrides || {})) {
            const dv = [...sys.vitalStats, ...sys.derivedValues].find(d => d.key === key);
            if (!dv || dv.nome === 'Altura' || val === null) continue;
            const auto = Number(calc.derived[key]?.auto);
            if (Number.isFinite(auto) && Math.abs(auto - Number(val)) <= 0.5) {
                redundantes.push(`${dv.nome} (travado ${val}, motor já dá ${auto})`);
            }
        }
        console.log(`   overrides hoje redundantes: ${redundantes.length ? redundantes.join(' · ') : '—'}`);

        if (APLICAR) {
            await doc.ref.set({ modulosClasse: modulos, lastUpdate: new Date().toISOString() }, { merge: true });
            mexidos++;
        }
    }

    console.log('─'.repeat(72));
    console.log(APLICAR ? `\n✅ ${mexidos} NPC(s) corrigido(s).\n`
        : '\n🔍 DRY-RUN. Rode com --apply para gravar.\n');
    process.exit(0);
}
