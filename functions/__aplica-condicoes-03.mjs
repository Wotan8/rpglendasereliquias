/**
 * Auditoria — lote 3: as 8 condições que faltavam.
 *
 * Efeito que dura mais de 1 turno, ou que fica no personagem até um gatilho,
 * tem que vir de uma CONDIÇÃO nomeada. Sem isso a mesa rastreia de cabeça e a
 * régua não tem o que medir. A varredura achou 45 habilidades nessa situação;
 * ~20 são economia de cena (§3.3) e não precisam, 4 já tinham condição no
 * catálogo e só precisavam apontar, e o resto cai nestas oito.
 *
 * Toda taxa sai do §1.1, nenhuma é arbitrada:
 *   ±1 no Alvo, por rodada ........ 0,170
 *   +1 Blindagem, por rodada ...... 0,154
 *   turno inteiro roubado ......... 1,000
 *   ignorar a Defesa .............. 0,320
 *   Ação de Movimento ............. 0,333  (§0.5)
 *
 *   node functions/__aplica-condicoes-03.mjs            (dry-run)
 *   node functions/__aplica-condicoes-03.mjs --apply
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({
    credential: admin.credential.cert(
        require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')),
});
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');
const AUTOR = 'M2rZzlQkzxTrrddeFQ10S6zsfX62';

/* ═══ Taxas, reproduzidas a partir da unidade ═══ */
const U = 3.445;
const ALVO = 0.585 / U;          // 0,170
const BLIND = 0.53 / U;          // 0,154
const IGNORA_DEFESA = (0.70 - 0.53) * 6.5 / U;   // 0,320
const MOVIMENTO = 0.333;         // Ação de Movimento inteira (§0.5)
assert.ok(Math.abs(ALVO - 0.170) < 0.001 && Math.abs(BLIND - 0.154) < 0.001);
assert.ok(Math.abs(IGNORA_DEFESA - 0.320) < 0.002,
    'a taxa de "ignorar a Defesa" é a mesma que o §1.1 rotula como "atacar quem não pode reagir"');

/* Deslocamento Terrestre = FOR + DES + Perícia: Agilidade + Tamanho.
   Na linha de base (FOR 4, DES 3, Agilidade 2, Tamanho 1) são 10 m — e é
   ESTIMATIVA: o §0.2 fixa FOR e a perícia de arma, não DES nem Tamanho. */
const DESLOC_BASE = 10;
const POR_METRO = MOVIMENTO / DESLOC_BASE;        // 0,0333 un/rodada por metro
assert.ok(Math.abs(POR_METRO - 0.0333) < 0.001);

const br = (x) => x.toFixed(3).replace('.', ',');

/* ═══ As oito ═══ */
const NOVAS = [
    {
        nome: 'Abalado', icone: '😖', duracao: '1 cena',
        efeito: '· **−N no Alvo** de todos os testes.',
        valor: (n = 1) => n * ALVO,
        conta: `${br(ALVO)} un/rodada por nível = 1 × 0,170 (§1.1).`,
        nota: 'É o gêmeo neutro do **Corrompido**, que faz o mesmo mas só sai com Luz e carrega o sabor Necrótico. Empilha até 3.',
    },
    {
        nome: 'Fortalecido', icone: '💪', duracao: '1 cena',
        efeito: '· **+N no Alvo** de todos os testes.',
        valor: (n = 1) => n * ALVO,
        conta: `${br(ALVO)} un/rodada por nível = 1 × 0,170 (§1.1).`,
        nota: 'É o espelho do **Abalado**, e o irmão limpo do **Vennire** — que dá o mesmo bônus mas cobra Sanidade. Empilha até 3.',
    },
    {
        nome: 'Blindado', icone: '🛡️', duracao: '1 cena',
        efeito: '· **+N de Blindagem**.',
        valor: (n = 1) => n * BLIND,
        conta: `${br(BLIND)} un/rodada por nível = 0,53 × 1 ÷ 3,445 — só rende no golpe que entra (§1.1).`,
        nota: 'Diferente do **Inabalável**, que dá +2 de Blindagem mas cobra metade do Deslocamento. Empilha até 3.',
    },
    {
        nome: 'Exposto', icone: '🎯', duracao: '1 cena',
        efeito: '· **−N na Defesa** — todo atacante ganha +N no Alvo contra este alvo.',
        valor: (n = 1) => n * ALVO,
        conta: `${br(ALVO)} un/rodada por nível: baixar a Defesa em 1 é o mesmo que dar +1 no Alvo a quem ataca (§1.1).`,
        nota: 'É o preço que as posturas ofensivas pagam pela letalidade. Empilha até 3.',
    },
    {
        nome: 'Entorpecido', icone: '🥱', duracao: '1 cena',
        efeito: '· perde **1 das 2 ações** do turno, à escolha do alvo.',
        valor: () => 0.500,
        conta: '0,500 un/rodada = metade do turno roubado (1,000 é o turno inteiro, §1.1).',
        nota: 'Meio Atordoado: o alvo ainda age, mas escolhe entre atacar e se mover. Não empilha — dois níveis seriam o turno inteiro, e isso já é **Atordoado**.',
    },
    {
        nome: 'Drenado', icone: '🩸', duracao: '1 cena',
        efeito: '· perde **N** de um recurso (Energia, Graça, Harmonia) e **não o recupera** até o fim da cena.',
        valor: (n = 1) => n * 1.00,
        conta: '1,00 un por ponto: 1 Energia = 1,00 unidade, a âncora do §4.1.',
        nota: 'O valor é o recurso negado, não uma penalidade por rodada — por isso não multiplica por rodadas.',
    },
    {
        nome: 'Oculto', icone: '🌑', duracao: '1 cena',
        efeito: '· ataques deste alvo **ignoram a Defesa** de quem ele atacar;\n· quem quiser não o perder de vista gasta um teste de Percepção.',
        valor: () => IGNORA_DEFESA,
        conta: `${br(IGNORA_DEFESA)} un/rodada = (0,70 − 0,53) × 6,5 ÷ 3,445 (§1.1).`,
        nota: 'O §1.1 rotula essa taxa como "atacar quem não pode reagir", mas a conta dela é a Defesa não se aplicando — que é o que importa, já que a Reação quase sempre é 0.',
    },
    {
        nome: 'Célere', icone: '💨', duracao: '1 cena',
        efeito: '· **+N × 1,5 m** de Deslocamento.',
        valor: (n = 1) => n * 1.5 * POR_METRO,
        conta: `${br(1.5 * POR_METRO)} un/rodada por nível. A Ação de Movimento inteira vale 0,333 (§0.5) e move o Deslocamento Terrestre completo — ${DESLOC_BASE} m na linha de base (FOR + DES + Perícia: Agilidade + Tamanho). Logo 1 m vale ${br(POR_METRO)}.`,
        nota: `A base de ${DESLOC_BASE} m é **estimativa**: o §0.2 fixa FOR e a perícia de arma, não DES, Agilidade nem Tamanho. Mexer nela move o preço de toda velocidade do sistema.`,
    },
];

console.log('=== AS OITO ===');
for (const c of NOVAS) {
    console.log(`\n${c.icone} ${c.nome}  [${c.duracao}]`);
    console.log(`   ${c.efeito.replace(/\n/g, '\n   ')}`);
    console.log(`   valor: ${br(c.valor(1))} un/rodada (N=1)   ·   N=3: ${br(c.valor(3))}`);
}

/* Travas de sanidade contra o catálogo que já existe. */
const porNome = Object.fromEntries(NOVAS.map((c) => [c.nome, c]));
assert.ok(porNome['Abalado'].valor(1) === porNome['Fortalecido'].valor(1), 'penalidade e bônus de Alvo custam igual');
assert.ok(porNome['Entorpecido'].valor(1) < 1.32, 'Entorpecido tem que valer menos que Atordoado');
assert.ok(porNome['Blindado'].valor(2) > 0.21, 'Blindado 2 supera Inabalável, que cobra Deslocamento pelo mesmo +2');
assert.ok(porNome['Célere'].valor(1) < 0.10, 'velocidade é barata: não está no DPR da linha de base');

const col = db.collection('system/data/conditions');
const existentes = (await col.get()).docs.map((d) => d.data().nome);
const faltam = NOVAS.filter((c) => !existentes.includes(c.nome));
console.log(`\n  ${existentes.length} condições no banco · ${faltam.length} a criar: ${faltam.map((c) => c.nome).join(', ') || '—'}`);

if (!APLICAR) {
    console.log('\n(dry-run — nada gravado. Rode com --apply para valer.)');
    process.exit(0);
}
const lote = db.batch();
const agora = admin.firestore.Timestamp.now();
for (const c of faltam) {
    const empilha = /Empilha até 3/.test(c.nota);
    const descricao = [
        c.efeito, '',
        c.conta, '',
        c.nota,
        empilha ? '\n## Repetir no mesmo alvo\nComo o **Atordoado** (§6.1), subir de nível cobra do portão: cada nível já aplicado dá ao alvo **Vantagem cumulativa** no teste de resistência, ou **−1 na Chance**. Sem isso, empilhar sairia de graça.' : '',
    ].join('\n').trim();
    lote.set(col.doc(), {
        nome: c.nome, icone: c.icone, duracao: c.duracao, descricao,
        removivel: true, publicado: true, efeitoMecanicaIds: [],
        criadoPor: AUTOR, versao: 1, criadoEm: agora, atualizadoEm: agora,
    });
}
await lote.commit();
console.log(`\n✅ ${faltam.length} condições criadas.`);
