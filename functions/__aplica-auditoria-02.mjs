/**
 * Auditoria — lote 2. Depende do lote 1 (Redutor do Bardo já achatado em 0).
 *
 *   1. Condição `Provocado`, empilhável até 3 (−2 no Alvo por nível).
 *   2. Os dois Brilhos do Pallacerdote: teto de alvos + Provocado por
 *      resistência. "Todos" era imensurável — o §1.3 mede em alvos declarados.
 *   3. As 4 canções com dano: dado a 85% de uma arma com Qualidade = Custo e
 *      Afiação = Custo, e a área compensando em alvos. O (Composição)d4 do
 *      LAMENTO vira dado fixo — fórmula variável não se mede.
 *   4. Câmbio 3:1 da Carga no Compêndio de Hemomancia e na classe Sangral.
 *   5. Grava `regua` em tudo que esta auditoria mediu — sem isso o Mapa de
 *      Conflito continua mostrando as classes como "nunca auditada".
 *
 *   node functions/__aplica-auditoria-02.mjs            (dry-run)
 *   node functions/__aplica-auditoria-02.mjs --apply
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
const HOJE = '2026-08-12';

/* ═══ A régua, reproduzida a partir da unidade — não copiada ═══ */
const U = 3.445, DANO = 1 / U, ALVO_UN = 0.585 / U, ATRIB = 4, BLIND = 2;
const P_RESIST = 0.42;                 // Redutor 0: 0,70 de conjurar × 0,60 de o alvo falhar
const P_CHANCE8 = 0.70 * 0.8;
const DADOS = { '1d10': 5.5, '1d12': 6.5, '2d6': 7 };
const unDano = (d) => (DADOS[d] + ATRIB - BLIND) * DANO;
const ATORDOADO = 1.32, PROSTRADO = 0.47, AMEDRONTADO = 0.17, EMPURRAO = 0.333;
const PROVOCADO = (n) => 2 * n * ALVO_UN;
const CARGA = 3 * DANO;                // 1 Carga = 3 Vitalidade
assert.ok(Math.abs(CARGA - 0.871) < 0.002, 'o câmbio 3:1 tem que sair da taxa de dano');
assert.ok(Math.abs(ALVO_UN - 0.170) < 0.001, 'a taxa de Alvo tem que sair da unidade');

const regua = (unidades, custo) => ({
    razao: Number((unidades / custo).toFixed(2)),
    unidades: Number(unidades.toFixed(2)), custo, em: HOJE,
});

/* ═══ O plano, item a item ═══ */
const P = {};
P['ONDA DE CHOQUE SONORAL [P, S]'] = {
    custo: 3, alvos: 3,
    efeito: 'Explosão de 5m, até 3 alvos: 1d10 de dano de impacto, empurra 1,5m por GS; teste de VIG ou Atordoado.',
    un: P_RESIST * (unDano('1d10') + ATORDOADO + EMPURRAO) * 3,
};
P['MARCHA DO CATACLISMO [P, S]'] = {
    custo: 4, alvos: 5,
    efeito: 'Até 5 inimigos em 8m testam VIG vs GS. Falha: 1d12 de dano e Prostrado. Causa dano estrutural em construções.',
    un: P_RESIST * (unDano('1d12') + PROSTRADO) * 5,
};
P['LAMENTO DA BANSHEE [V, S]'] = {
    custo: 4, alvos: 5,
    efeito: 'Até 5 inimigos em 6m: 1d12 de dano sônico, AUT vs GS. Falha: Amedrontado. Necróticos/abissais: dano dobrado.',
    un: P_RESIST * (unDano('1d12') + AMEDRONTADO) * 5,
};
P['TROMBETA DO JULGAMENTO [S]'] = {
    custo: 5, alvos: 4,
    efeito: 'Cone de (Composição × 200)m, até 4 alvos. VIG vs GS. Falha: 2d6 de dano, empurra 3m por GS e Atordoado por 1 turno. Ouvido a 1km. Falha Crítica: ricocheteia.',
    un: P_RESIST * (unDano('2d6') + ATORDOADO + EMPURRAO) * 4,
};
/* Os Brilhos têm Redutor próprio (−3 e −1), então P total difere entre eles. */
P['Brilho Chamativo da Fé I'] = {
    custo: 1, alvos: 5, cond: 'Provocado', rodadas: 5,
    efeito: 'Até 5 alvos em 6m testam AUT vs GS. Falha: Provocado 1 por 1 cena (−2 no Alvo de qualquer ataque que não seja contra você).',
    un: 0.18 * PROVOCADO(1) * 5 * 5,
};
P['Brilho Provocativo da Fé I'] = {
    custo: 1, alvos: 3, cond: 'Provocado', rodadas: 5,
    efeito: 'Até 3 rivais em 6m testam AUT vs GS. Falha: Provocado 1 por 1 cena (−2 no Alvo de qualquer ataque que não seja contra você).',
    un: 0.33 * PROVOCADO(1) * 5 * 3,
};
/* Mexidas no lote 1, que trocou alvos e efeito mas não gravou régua. */
P['GRITO DISSONANTE [V, S]'] = { custo: 1, un: P_CHANCE8 * ATORDOADO * 2 };
P['INTIMIDAÇÃO SÔNICA [V, P]'] = { custo: 1, un: P_RESIST * AMEDRONTADO * 5 * 3 };
P['NANA DO ENTORPECIMENTO [V, C]'] = { custo: 2, un: P_RESIST * (0.10 + 0.37) * 5 * 3 };
P['Escudo Hemático'] = { custo: Number((2 * CARGA).toFixed(2)), un: 3 * 0.154 * 5 };

for (const [nome, p] of Object.entries(P)) {
    const r = p.un / p.custo;
    assert.ok(r >= 1.00 && r <= 1.70, `${nome} saiu da faixa: ${r.toFixed(2)}x`);
}

/* ═══ Montagem ═══ */
const col = db.collection('system/data/classModules');
const mods = (await col.get()).docs.map((d) => ({ id: d.id, ...d.data() }));
const plano = [];
for (const m of mods) {
    const lbl = Object.fromEntries((m.schema || []).map((f) => [f.key, String(f.label || '')]));
    const kE = Object.keys(lbl).find((x) => /^efeito/i.test(lbl[x]));
    let mexeu = false;
    const itens = (m.itensPredefinidos || []).map((it) => {
        const p = P[it.nome];
        if (!p) return it;
        const novo = { ...it, valores: { ...it.valores }, regua: regua(p.un, p.custo) };
        plano.push({ item: it.nome, o: 'régua', para: `${novo.regua.razao}x  (${novo.regua.unidades} un / custo ${p.custo})` });
        if (p.efeito) {
            if (kE) novo.valores[kE] = p.efeito;
            if (it.descricao && it.descricao !== it.nome) novo.descricao = p.efeito;
            plano.push({ item: it.nome, o: 'efeito', para: p.efeito.slice(0, 66) + '...' });
        }
        if (p.alvos) {
            novo.alvosMax = p.alvos;
            const base = (it.condicoesAplicadas || []).filter((c) => c && c.condicao);
            novo.condicoesAplicadas = p.cond
                ? [{ condicao: p.cond, portao: 'resistencia', chance: null, alvos: p.alvos, rodadas: p.rodadas }]
                : base.map((c) => ({ ...c, alvos: p.alvos }));
            plano.push({ item: it.nome, o: 'alvos', para: `alvosMax ${p.alvos}` + (p.cond ? ` + ${p.cond}` : '') });
        }
        mexeu = true;
        return novo;
    });
    if (mexeu) m._novos = itens;
}

console.log('=== PLANO ===');
for (const x of plano) console.log(`  [${x.o.padEnd(6)}] ${x.item.slice(0, 30).padEnd(32)} ${x.para}`);
const achados = new Set(plano.map((x) => x.item));
console.log(`\n  itens: ${achados.size}/${Object.keys(P).length}   módulos tocados: ${mods.filter((m) => m._novos).length}`);
assert.equal(achados.size, Object.keys(P).length, 'todo item do plano tem que ter sido encontrado no banco');

if (!APLICAR) {
    console.log('\n(dry-run — nada gravado. Rode com --apply para valer.)');
    process.exit(0);
}

const lote = db.batch();
for (const m of mods.filter((x) => x._novos)) lote.update(col.doc(m.id), { itensPredefinidos: m._novos });

/* Condição Provocado */
const conds = await db.collection('system/data/conditions').get();
if (!conds.docs.some((d) => d.data().nome === 'Provocado')) {
    const agora = admin.firestore.Timestamp.now();
    const desc = [
        'O alvo foi marcado e não consegue ignorar quem o marcou.',
        '· **−2 no Alvo por nível** em ataques contra qualquer alvo que não seja quem provocou.',
        '',
        `**Empilha até Provocado 3** (−6 no Alvo). ${PROVOCADO(1).toFixed(2)} un/rodada por nível = 2 × 0,170 (§1.1); no teto são ${PROVOCADO(3).toFixed(2)} un/rodada — entre Imobilizado (0,69) e Cego (1,05).`,
        '',
        'O preço é o **teto**: contra quem já ia atacar o provocador a penalidade não incide, então a régua cobra conservador de propósito.',
        '',
        '## Repetir no mesmo alvo',
        'Como o Atordoado (§6.1), subir de nível cobra do portão: cada nível já aplicado dá ao alvo **Vantagem cumulativa** no teste de resistência. Sem isso, empilhar sairia de graça.',
    ].join('\n');
    lote.set(db.collection('system/data/conditions').doc(), {
        nome: 'Provocado', icone: '🎯', duracao: '1 cena', removivel: true, publicado: true,
        descricao: desc, efeitoMecanicaIds: [], criadoPor: AUTOR, versao: 1,
        criadoEm: agora, atualizadoEm: agora,
    });
    console.log('  + condição Provocado criada');
}

/* Câmbio da Carga: capítulo do Compêndio de Hemomancia + descrição da classe */
const SECAO = '<h2>A Bolha e o preço do sangue</h2>'
    + '<p><strong>1 Carga custa 3 de Vitalidade.</strong> É o câmbio único da Bolha Sanguínea, e vale nas duas direções: '
    + 'o Sangral sangra a si mesmo a 3 por Carga, e a Absorção Hemática recolhe sangue derramado alheio pela mesma conta '
    + '(dano ÷ 3). Não há arbitragem entre as duas fontes — sangue é sangue.</p>'
    + '<p>Pela Régua de Balanceamento (§1.1), 1 ponto de Vitalidade vale 0,290 unidades, logo <strong>1 Carga = 0,871 unidades</strong> '
    + 'e 1 Energia compra pouco mais de uma Carga. Antes deste câmbio a Carga era contada como se valesse uma Energia inteira, '
    + 'e o catálogo inteiro do Sangral aparecia 3,45× mais barato do que custava de verdade.</p>';
const arts = await db.collection('worldbuilding-articles').get();
const cap = arts.docs.find((d) => d.data().bookId === 'book_ms3gb8zgr21roi');
if (cap && !/A Bolha e o preço do sangue/.test(cap.data().contentHTML || '')) {
    lote.update(cap.ref, { contentHTML: (cap.data().contentHTML || '') + SECAO, updatedAt: Date.now() });
    console.log('  + seção gravada no Compêndio de Hemomancia');
}
const cls = db.collection('system/data/classes').doc('XevJOxgWAYuTCljNiJMv');
const sg = await cls.get();
const NOTA = '\n\nA Bolha Sanguínea tem câmbio fixo: 1 Carga custa 3 de Vitalidade — do próprio Sangral, ou de sangue alheio já derramado (dano ÷ 3).';
if (!/câmbio fixo/.test(sg.data().descricao || '')) {
    lote.update(cls, { descricao: (sg.data().descricao || '') + NOTA });
    console.log('  + câmbio anotado na descrição da classe Sangral');
}

await lote.commit();
console.log('\n✅ gravado.');
