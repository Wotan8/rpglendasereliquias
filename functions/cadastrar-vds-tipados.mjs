/**
 * Cria os Valores Derivados tipados de combate (canais de dano/defesa).
 *
 *   4 Acerto por entrega   (escopoItem 'coluna')
 *  13 Dano por essência    (escopoItem 'dano')
 *  13 Blindagem por essência (global)
 *
 * Os canais FÍSICOS já existem e NÃO são tocados: `Acerto` (agregador genérico),
 * `Dano` e `Blindagem`. Com eles o total da família fica em 33.
 *
 * As 13 essências saem da tabela de Responsividade do Compêndio de Sonoromancia.
 *
 *   node functions/cadastrar-vds-tipados.mjs            (dry-run)
 *   node functions/cadastrar-vds-tipados.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');

const BLOCO = { blocoId: 'combat-canais', blocoNome: 'Combate — Canais', blocoOrdem: 7 };
const AUTOR = 'M2rZzlQkzxTrrddeFQ10S6zsfX62';

/* Mesma derivação de `key` do system-data-loader.js (buildDerivedValuesFromFirebase). */
const keyDe = nome => nome.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/[^A-Z0-9]/g, '_').replace(/__+/g, '_').replace(/^_|_$/g, '');

/* [nome curto, ícone, glosa da essência] */
const ESSENCIAS = [
    ['Cinza',      '🌫️', 'Vento'],
    ['Azul-Claro', '💧', 'Água'],
    ['Azul',       '💙', 'Vida'],
    ['Púrpura',    '💜', 'Necrótica'],
    ['Verde',      '🌿', 'Natureza'],
    ['Rosa',       '💎', 'Cristal'],
    ['Amarela',    '☀️', 'Luz'],
    ['Vermelha',   '🔥', 'Fogo'],
    ['Marrom',     '⛰️', 'Terra'],
    ['Branca',     '⬜', 'Espaço'],
    ['Prateada',   '⏳', 'Temporal'],
    ['Preta',      '🕳️', 'Abissal'],
    ['Dourada',    '⭐', 'Estelar']
];

const ACERTOS = [
    ['Acerto Corpo a Corpo', '🗡️', 'FOR (ou DES, se a arma tiver a tag Precisa) + Perícia: Arma + Acerto + Fio'],
    ['Acerto à Distância',   '🏹', 'DES + Perícia: Disparo + Acerto + Fio'],
    ['Acerto Desarmado',     '👊', 'FOR + Perícia: Briga + Acerto'],
    ['Acerto Mágico',        '✨', 'atributo e perícia da escola + Acerto + Fio do foco']
];

const novos = [];

for (const [nome, icone, formula] of ACERTOS) {
    novos.push({
        nome, icone, escopoItem: 'coluna', ordem: 1 + novos.length, todoPersonagem: true,
        descricao: `Acerto para este tipo de entrega. A BASE aqui é 0 — o valor de cada arma sai da `
            + `Equação de Valor montada no próprio item, no cadastro de Equipamentos: `
            + `${formula}. O termo "Acerto" na equação puxa o modificador genérico `
            + `(peculiaridades, condições, escudo), que vale para todos os tipos.`
    });
}

for (const [cor, icone, glosa] of ESSENCIAS) {
    novos.push({
        nome: `Dano ${cor}`, icone, escopoItem: 'dano', ordem: 10 + novos.length, todoPersonagem: false,
        descricao: `Parcela de dano da Essência ${cor} (${glosa}). Soma-se ao golpe como canal `
            + `separado e subtrai a Blindagem ${cor} do alvo, não a Blindagem física. `
            + `Cada canal é clampado em 0 antes de somar; o piso de 1 vale para o golpe inteiro.`
    });
}

for (const [cor, icone, glosa] of ESSENCIAS) {
    novos.push({
        nome: `Blindagem ${cor}`, icone, escopoItem: '', ordem: 30 + novos.length, todoPersonagem: false,
        descricao: `Resistência à Essência ${cor} (${glosa}). Subtrai apenas da parcela de dano ${cor}. `
            + `Valor negativo é fraqueza (o canal passa a somar dano). Referência de potência: `
            + `1,80 no Grau 1 e 5,64 no Grau 5 — é quanto compra um golpe inteiro de sobrevivência.`
    });
}

/* ===== Conferências antes de gravar ===== */
const grab = async c => (await db.collection(`system/data/${c}`).get()).docs.map(d => ({ id: d.id, ...d.data() }));
const [vds, sks] = await Promise.all([grab('derivedValues'), grab('skills')]);
const ATRIBUTOS = ['INT','RAC','PRS','FOR','DES','VIG','PRE','MAN','AUT',
    'Inteligência','Raciocínio','Perseverança','Força','Destreza','Vigor','Presença','Manipulação','Autocontrole'];

const nomesUsados = new Set([...vds.map(v => v.nome), ...sks.map(s => s.nome), ...ATRIBUTOS]);
const keysUsadas = new Set(vds.map(v => keyDe(v.nome)));
const erros = [];

for (const n of novos) {
    if (nomesUsados.has(n.nome)) erros.push(`nome já existe (VD, perícia ou atributo): "${n.nome}"`);
    const k = keyDe(n.nome);
    if (keysUsadas.has(k)) erros.push(`key colide com VD existente: "${n.nome}" → ${k}`);
    keysUsadas.add(k);
}
const dup = novos.map(n => n.nome).filter((n, i, a) => a.indexOf(n) !== i);
if (dup.length) erros.push(`nomes duplicados na própria lista: ${dup.join(', ')}`);

console.log(`Novos VDs: ${novos.length}  (${ACERTOS.length} Acerto · ${ESSENCIAS.length} Dano · ${ESSENCIAS.length} Blindagem)`);
console.log(`Bloco: ${BLOCO.blocoNome} [${BLOCO.blocoId}] ordem ${BLOCO.blocoOrdem}\n`);
for (const n of novos) console.log(`  ${n.icone} ${n.nome.padEnd(24)} key=${keyDe(n.nome).padEnd(26)} escopoItem=${n.escopoItem || 'global'}  todoPersonagem=${n.todoPersonagem}`);

if (erros.length) { console.error('\n❌ ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
console.log('\n✅ Sem colisão de nome nem de key.');

if (!APPLY) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

const agora = admin.firestore.Timestamp.now();
const batch = db.batch();
for (const n of novos) {
    batch.set(db.collection('system/data/derivedValues').doc(), {
        nome: n.nome, icone: n.icone, descricao: n.descricao, ordem: n.ordem,
        escopoItem: n.escopoItem, todoPersonagem: n.todoPersonagem,
        ...BLOCO,
        prefixo: '', sufixo: '', mecanicaIds: [],
        campoAtual: false, campoEditavel: false, statusCombate: false,
        characterCreationRule: false, characterCreationMin: null, characterCreationMax: null,
        publicado: true, criadoPor: AUTOR, criadoEm: agora, createdAt: agora, updatedAt: agora, versao: 1
    });
}
await batch.commit();
console.log(`\n✅ ${novos.length} Valores Derivados gravados.`);
process.exit(0);
