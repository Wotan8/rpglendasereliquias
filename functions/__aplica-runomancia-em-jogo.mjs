/**
 * RUNOMANCIA EM JOGO — etapas 1 e 2 da definição aprovada.
 *
 * Etapa 1 · três Elementos Rúnicos novos em system/data/runicElements:
 *     Sublimador — converte a forma física da essência em forma de essência
 *     Erosor     — dano verdadeiro que arranca VIT máxima para sempre
 *     Impressor  — escolhe QUAL condição a natureza aplica
 *   · oito condições novas em system/data/conditions.
 *
 * Etapa 2 · repertório físico/essência/crítico em cada um dos 14 Aspectus,
 *   o canal de dano de cada um, o pedágio de Sanidade do Abissal e a trava de
 *   aprendizado do Poder.
 *
 * Nada aqui inventa número: as escadas de custo e de sessões saem das mesmas
 * tabelas que o Compêndio já usa (§5.1 e §11.2, em painel-runic.js), e os
 * Valores Derivados são resolvidos POR NOME contra o registro — id errado
 * viraria canal errado em silêncio.
 *
 * Idempotente: rodar de novo sobrescreve os mesmos documentos.
 *
 *   node functions/__aplica-runomancia-em-jogo.mjs           (só mostra)
 *   node functions/__aplica-runomancia-em-jogo.mjs --apply   (grava)
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');
const AUTOR = 'M2rZzlQkzxTrrddeFQ10S6zsfX62';

const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

/* ===== as MESMAS tabelas do Compêndio (painel-runic.js) ===== */
const SESS = { iniciante: [2, 3, 4], intermediario: [4, 5, 6], avancado: [6, 8, 10], mestre: [10, 12, 15] };
const CUSTO_MODULADOR = { iniciante: [2, 5, 10], intermediario: [5, 10, 20], avancado: [10, 20, 40] };
const CP_PASSAGEM = [{ x: 8, y: 50, tipo: 'entrada', rotulo: 'in' }, { x: 92, y: 50, tipo: 'saida', rotulo: 'out' }];

const niveis = (custos, sess, props) => custos.map((c, i) => ({
    nivel: i + 1, custoEss: c, custoExp: c, sessoesEstudo: sess[i],
    capacidade: null, taxa: null, propriedades: props[i] || '',
}));

/* =====================================================================
   ETAPA 1a — os três Sigilus novos
   ===================================================================== */
const SIGILUS_NOVOS = [
    {
        id: 'sig_sublimador',
        nome: 'Sublimador', nomeLatim: 'Sublimator',
        tipoElemento: 'sigilus', categoria: 'modulador', complexidade: 'avancado', maxNivel: 3,
        flags: ['sublimador'],
        descricao: 'Desfaz a matéria do efeito e o entrega como essência pura. Sem ele a runa fere na '
            + 'FORMA FÍSICA da sua natureza — a Terra é pedra e machuca como pedra, contra a Blindagem comum. '
            + 'Com ele a mesma Terra sai como Dano Telúrico, e só a Blindagem Telúrica do alvo apara.',
        limites: 'Obrigatório em Temporal e Espacial — tempo e distância não têm matéria para arremessar. '
            + 'O Abissal dispensa: ele já existe em todos os estados. Não miniaturiza.',
        posicaoRegra: 'Depois do Núcleo, antes do Emissor',
        niveis: niveis(CUSTO_MODULADOR.avancado, SESS.avancado, [
            'sublima metade do dano', 'sublima três quartos do dano', 'sublima o dano inteiro',
        ]),
        pontosConexao: CP_PASSAGEM, ordem: 46,
    },
    {
        id: 'sig_impressor',
        nome: 'Impressor', nomeLatim: 'Impressor',
        tipoElemento: 'sigilus', categoria: 'modulador', complexidade: 'intermediario', maxNivel: 3,
        flags: ['impressor'],
        descricao: 'Molda a essência para que ela deixe uma marca escolhida, e não a que a natureza deixaria '
            + 'sozinha. Sem Impressor a runa aplica a PRIMEIRA condição do repertório do seu Aspectus — o fogo '
            + 'queima, a terra derruba, o sangue sangra. Com ele, o fogo aterroriza.',
        limites: 'Impressor sem Núcleo é inerte: não há essência aspectada para moldar. A condição de crítico '
            + 'só pode ser escolhida no Nv3, e continua exigindo acerto crítico.',
        posicaoRegra: 'Depois do Núcleo, antes do Emissor',
        niveis: niveis(CUSTO_MODULADOR.intermediario, SESS.intermediario, [
            '1 condição do repertório do Aspectus',
            'até 2 condições; +20% de chance em uma delas',
            'até 3 condições, uma podendo ser a de crítico; +40% de chance distribuível',
        ]),
        pontosConexao: CP_PASSAGEM, ordem: 47,
    },
    {
        id: 'sig_erosor',
        nome: 'Erosor', nomeLatim: 'Erosor',
        tipoElemento: 'sigilus', categoria: 'modulador', complexidade: 'avancado', maxNivel: 3,
        flags: ['erosor', 'proibido'],
        descricao: 'A ferida que não fecha. Troca toda a escada de dano da runa por uma quantia pequena e '
            + 'VERDADEIRA — ignora toda Blindagem, entra direto na Vitalidade — e a mesma quantia sai da '
            + 'VITALIDADE MÁXIMA do alvo, para sempre. Nv3 acrescenta 1d4.',
        limites: 'Só aceita os Aspectus que sabem desfazer: Vida, Abissal, Sangue, Necrótico, Espacial, '
            + 'Temporal, Fogo, Natureza. Usos por cena = nível do Erosor, e pode atingir o mesmo corpo mais '
            + 'de uma vez. Aprender custa o dobro de sessões. Não miniaturiza.',
        posicaoRegra: 'Depois do Núcleo, antes do Emissor',
        niveis: niveis(CUSTO_MODULADOR.avancado, SESS.avancado.map(s => s * 2), [
            '1 de dano verdadeiro; 1 uso por cena',
            '2 de dano verdadeiro; 2 usos por cena',
            '3 + 1d4 de dano verdadeiro; 3 usos por cena',
        ]),
        pontosConexao: CP_PASSAGEM, ordem: 48,
    },
];

/* =====================================================================
   ETAPA 1b — as oito condições novas
   ===================================================================== */
const CONDICOES_NOVAS = [
    {
        nome: 'Fratura', icone: '🦴', duracao: 'até ser tratada',
        acumulaNiveis: false, removivel: true, afetaTabuleiro: true,
        descricao: 'Osso partido. O membro está lá e não responde.\n\n'
            + '· o membro atingido sai de uso enquanto durar;\n'
            + '· sem a mão: não empunha, não segura;\n'
            + '· sem a perna: **Deslocamento pela metade**.\n\n'
            + 'Cura natural não resolve — precisa de talha, tempo e alguém que saiba. '
            + 'É a marca de crítico da Terra, do Cristal e do Espacial.',
        multiplicadorDeslocamento: 0.5,
    },
    {
        nome: 'Chaga', icone: '🩸', duracao: '1 cena',
        acumulaNiveis: false, removivel: true, afetaTabuleiro: true,
        descricao: 'A ferida que não fecha — carne queimada, apodrecida ou crescida errado.\n\n'
            + '· **bloqueia toda recuperação natural de Vitalidade** enquanto durar;\n'
            + '· cura mágica funciona **pela metade**.\n\n'
            + 'É a marca de crítico das naturezas que não querem só machucar: Fogo, Vida, '
            + 'Necrótico, Natureza e Sangue.',
    },
    {
        nome: 'Alento', icone: '🌬️', duracao: '1 cena',
        acumulaNiveis: true, nivelMaximo: 3, removivel: true,
        descricao: 'O fôlego devolvido — ar limpo, seiva, o segundo vento.\n\n'
            + '· **recupera N de Energia por turno**, no fim do turno de quem a carrega.\n\n'
            + '0,290 un por ponto recuperado (§1.1). Repertório de essência do Vento e da Vida.',
    },
    {
        nome: 'Serenidade', icone: '🕊️', duracao: '1 cena',
        acumulaNiveis: true, nivelMaximo: 3, removivel: true,
        descricao: 'A mente que se assenta. Luz que espanta o que sussurrava.\n\n'
            + '· **recupera N de Sanidade por turno**, no fim do turno de quem a carrega.\n\n'
            + '0,290 un por ponto recuperado (§1.1). É o contrário direto do que o Abissal faz — '
            + 'e a razão de a Luz e a Vida serem as naturezas que os Invocadores procuram.',
    },
    {
        nome: 'Ligeireza', icone: '⏩', duracao: '1 rodada',
        acumulaNiveis: false, nivelMaximo: 1, removivel: true, afetaTabuleiro: true,
        descricao: 'O tempo abrindo espaço dentro do instante.\n\n'
            + '· **+1 Ação Padrão** no turno — a ação com que se faz algo *ou* se anda.\n\n'
            + '⚠️ É o efeito mais caro do sistema: meio turno a mais. Por isso **não empilha, '
            + 'não sobe de nível e dura em rodadas, nunca por cena**. Repertório de essência do Temporal.',
        acoesExtras: { padrao: 1 },
    },
    {
        nome: 'Estagnado', icone: '⏸️', duracao: '1 rodada',
        acumulaNiveis: false, nivelMaximo: 1, removivel: true, afetaTabuleiro: true,
        descricao: 'O instante pesando. O corpo chega atrasado à própria intenção.\n\n'
            + '· **−1 Ação Padrão** no turno.\n\n'
            + '⚠️ Metade do turno a menos. Mesmas travas da **Ligeireza**: não empilha, '
            + 'não sobe de nível, dura em rodadas.',
        acoesExtras: { padrao: -1 },
    },
    {
        nome: 'Envelhecido', icone: '⏳', duracao: 'até ser tratada',
        acumulaNiveis: true, nivelMaximo: 3, removivel: true,
        descricao: 'Anos empurrados para dentro do corpo. Cabelo branco em uma rodada.\n\n'
            + '· **−N em FOR, VIG e DES**;\n'
            + '· **+N÷2 em INT e PRE** (arredondado para baixo).\n\n'
            + 'É idade, não iniciativa: o corpo não desenvelhece sozinho. Marca de crítico do Temporal.',
    },
    {
        nome: 'Rejuvenescido', icone: '⌛', duracao: 'até ser tratada',
        acumulaNiveis: true, nivelMaximo: 3, removivel: true,
        descricao: 'Anos arrancados. O corpo volta a ser o que era, com a cabeça que ainda não era.\n\n'
            + '· **+N em FOR, VIG e DES**;\n'
            + '· **−N÷2 em INT e PRE** (arredondado para baixo).\n\n'
            + 'O espelho do **Envelhecido**, e igualmente indesejada por quem não pediu. '
            + 'Marca de crítico do Temporal.',
    },
    {
        nome: 'Delírio', icone: '🌀', duracao: '1 cena',
        acumulaNiveis: true, nivelMaximo: 3, removivel: true, afetaTabuleiro: true,
        descricao: 'O que o Abismo mostra quando olha de volta.\n\n'
            + '· o alvo **não distingue aliado de inimigo**: ao atacar, o Mestre sorteia o alvo entre '
            + 'todos os tokens ao alcance;\n'
            + '· **−N no Alvo** de qualquer teste que dependa de enxergar o mundo como ele é.\n\n'
            + 'Repertório de essência do Abissal, e a marca de crítico dele — nesse caso, **permanente**.',
    },
];

/* =====================================================================
   ETAPA 2 — repertório e regras dos 14 Aspectus
   `canal` e as condições são resolvidos POR NOME contra o registro.
   ===================================================================== */
const ASPECTUS = {
    fogo:      { canal: 'Dano Ígneo',      fisica: ['Queimadura', 'Inflamado'],                  essencia: ['Queimadura', 'Amedrontado', 'Exaustão'],                 critico: 'Chaga',   erosor: true },
    'água':    { canal: 'Dano Aquático',   fisica: ['Prostrado', 'Entorpecido'],                 essencia: ['Afogando', 'Lento'],                                     critico: 'Afogando' },
    terra:     { canal: 'Dano Telúrico',   fisica: ['Prostrado', 'Imobilizado'],                 essencia: ['Ancorado', 'Lento'],                                     critico: 'Fratura' },
    vento:     { canal: 'Dano Eólico',     fisica: ['Prostrado', 'Desorientado'],                essencia: ['Surdo', 'Alento'],                                       critico: 'Surdo' },
    luz:       { canal: 'Dano Luminoso',   fisica: ['Queimadura', 'Ofuscado'],                   essencia: ['Ofuscado', 'Exposto', 'Serenidade'],                     critico: 'Cego' },
    vida:      { canal: 'Dano Espiritual', fisica: ['Sobrecarregado', 'Prostrado'],              essencia: ['Fortalecido', 'Vigorado', 'Alento', 'Serenidade'],       critico: 'Chaga',   erosor: true, danoVerdadeiro: true },
    cristal:   { canal: 'Dano Cristalino', fisica: ['Hemorragia', 'Exposto'],                    essencia: ['Amplificado', 'Opaco'],                                  critico: 'Fratura' },
    temporal:  { canal: 'Dano Temporal',   fisica: [],                                           essencia: ['Lento', 'Célere', 'Ligeireza', 'Estagnado'],             critico: 'Envelhecido', criticoAlt: 'Rejuvenescido', erosor: true, sublimadorObrigatorio: true },
    espacial:  { canal: 'Dano Espacial',   fisica: [],                                           essencia: ['Ancorado', 'Desorientado'],                              critico: 'Fratura', erosor: true, sublimadorObrigatorio: true },
    'necrótico':{ canal: 'Dano Necrótico',  fisica: ['Definhado', 'Drenado'],                     essencia: ['Definhado', 'Corrompido', 'Amedrontado'],                critico: 'Chaga',   erosor: true },
    natureza:  { canal: 'Dano Natural',    fisica: ['Imobilizado', 'Agarrado', 'Hemorragia'],    essencia: ['Vigorado', 'Entorpecido'],                               critico: 'Chaga',   erosor: true },
    sangue:    { canal: 'Dano Sanguíneo',  fisica: ['Hemorragia', 'Prostrado', 'Entorpecido'],   essencia: ['Hemorragia', 'Pacto de Sangue', 'Drenado'],              critico: 'Chaga',   erosor: true },
    abissal:   { canal: 'Dano Abissal',    fisica: ['CORINGA'],                                  essencia: ['Amedrontado', 'Corrompido', 'Delírio', 'Desorientado'],  critico: 'Delírio', erosor: true, coringa: true, sanidadeAprender: 4, sanidadeGravar: 2, periciaExigida: 'Abismancia' },
    poder:     { canal: 'Dano Áureo',      fisica: [],                                           essencia: [],                                                        bloqueadoAprendizado: true },
};

/* ===================== leitura ===================== */
const [dvSnap, condSnap, runSnap] = await Promise.all([
    db.collection('system/data/derivedValues').get(),
    db.collection('system/data/conditions').get(),
    db.collection('system/data/runicElements').get(),
]);
const dvPorNome = new Map(dvSnap.docs.map(d => [norm(d.data().nome), d.id]));
const condPorNome = new Map(condSnap.docs.map(d => [norm(d.data().nome), d.id]));
const runPorId = new Map(runSnap.docs.map(d => [d.id, d.data()]));

/* trava de sanidade: o registro tem de ser o que a definição assumiu.
   ⚠️ Os ids do seed saíram de `'asp_' + nome.toLowerCase()`, então carregam
   acento: asp_água, asp_necrótico. Normalizar aqui apagaria o documento certo
   e criaria um irmão vazio ao lado. */
assert.ok(runSnap.size >= 60, `runicElements com ${runSnap.size} docs — esperava 64+`);
for (const k of Object.keys(ASPECTUS)) {
    assert.ok(runPorId.has('asp_' + k), `Aspectus "asp_${k}" não existe no registro`);
}
assert.equal(Object.keys(ASPECTUS).length, 14, 'os quatorze Aspectus do cânone');

console.log('\n═══════ ETAPA 1a · ELEMENTOS RÚNICOS NOVOS ═══════');
const escreverElemento = (e) => ({
    nome: e.nome, nomeLatim: e.nomeLatim, tipoElemento: e.tipoElemento,
    categoria: e.categoria, complexidade: e.complexidade, maxNivel: e.maxNivel,
    descricao: e.descricao, limites: e.limites, posicaoRegra: e.posicaoRegra,
    flags: e.flags, niveis: e.niveis, pontosConexao: e.pontosConexao,
    imagemUrl: '', ordem: e.ordem, publicado: true, cor: '',
    criadoPor: AUTOR, atualizadoEm: new Date(),
});
for (const e of SIGILUS_NOVOS) {
    const ja = runPorId.has(e.id);
    console.log(`  ${ja ? '♻️ ' : '✨'} ${String(e.nome).padEnd(12)} ${e.categoria}/${e.complexidade} · `
        + `Ess ${e.niveis.map(n => n.custoEss).join('/')} · sessões ${e.niveis.map(n => n.sessoesEstudo).join('/')}`);
    if (APLICAR) await db.doc(`system/data/runicElements/${e.id}`).set(escreverElemento(e), { merge: true });
}

console.log('\n═══════ ETAPA 1b · CONDIÇÕES NOVAS ═══════');
let condCriadas = 0;
for (const c of CONDICOES_NOVAS) {
    const ja = condPorNome.get(norm(c.nome));
    console.log(`  ${ja ? '♻️  já existe:' : '✨ criar:    '} ${c.icone} ${String(c.nome).padEnd(15)} ${c.duracao}`);
    if (APLICAR) {
        const dados = { ...c, publicado: true, efeitoMecanicaIds: [], criadoPor: AUTOR, atualizadoEm: new Date(), versao: 1 };
        if (ja) await db.doc(`system/data/conditions/${ja}`).set(dados, { merge: true });
        else {
            const ref = await db.collection('system/data/conditions').add({ ...dados, criadoEm: new Date() });
            condPorNome.set(norm(c.nome), ref.id);
        }
    } else if (!ja) condPorNome.set(norm(c.nome), '(nova)');
    condCriadas++;
}

console.log('\n═══════ ETAPA 2 · REPERTÓRIO DOS 14 ASPECTUS ═══════');
const faltando = [];
const refCond = (nome) => {
    if (nome === 'CORINGA') return { coringa: true };
    const id = condPorNome.get(norm(nome));
    if (!id) { faltando.push(nome); return null; }
    return { condicao: nome, condicaoId: id === '(nova)' ? null : id };
};

for (const [chave, a] of Object.entries(ASPECTUS)) {
    const docId = 'asp_' + chave;
    const atual = runPorId.get(docId);
    const canalId = dvPorNome.get(norm(a.canal));
    if (!canalId) faltando.push(`VD ${a.canal}`);

    const patch = {
        canalDano: a.canal,
        canalDanoVdId: canalId || null,
        condicoesFisicas: a.fisica.map(refCond).filter(Boolean),
        condicoesEssencia: a.essencia.map(refCond).filter(Boolean),
        condicaoCritica: a.critico ? [a.critico, a.criticoAlt].filter(Boolean).map(refCond).filter(Boolean) : [],
        sublimadorObrigatorio: !!a.sublimadorObrigatorio,
        aceitaErosor: !!a.erosor,
        formaFisicaCoringa: !!a.coringa,
        danoVerdadeiro: !!a.danoVerdadeiro,
        bloqueadoAprendizado: !!a.bloqueadoAprendizado,
        periciaExigida: a.periciaExigida || null,
        sanidadePorNivelAprender: a.sanidadeAprender || 0,
        sanidadePorNivelGravar: a.sanidadeGravar || 0,
        atualizadoEm: new Date(),
    };

    const marcas = [
        a.sublimadorObrigatorio ? 'Sublimador obrigatório' : null,
        a.erosor ? 'aceita Erosor' : null,
        a.coringa ? 'CORINGA (todas as formas físicas)' : null,
        a.danoVerdadeiro ? 'dano verdadeiro' : null,
        a.bloqueadoAprendizado ? '🚫 BLOQUEADO para aprendizado' : null,
        a.sanidadeAprender ? `Sanidade ${a.sanidadeAprender}×Nv ao aprender, ${a.sanidadeGravar}×Nv ao gravar` : null,
    ].filter(Boolean);

    console.log(`\n  ${(atual?.nome || chave).padEnd(11)} → ${a.canal}`);
    console.log(`     física:   ${a.fisica.join(' · ') || '—'}`);
    console.log(`     essência: ${a.essencia.join(' · ') || '—'}`);
    console.log(`     crítico:  ${[a.critico, a.criticoAlt].filter(Boolean).join(' · ') || '—'}`);
    if (marcas.length) console.log(`     ⚑ ${marcas.join(' · ')}`);

    if (APLICAR) await db.doc(`system/data/runicElements/${docId}`).set(patch, { merge: true });
}

/* ===================== fecho ===================== */
if (faltando.length) {
    console.log(`\n❌ NÃO RESOLVIDO (${faltando.length}): ${[...new Set(faltando)].join(', ')}`);
    console.log('   Referência que não resolve vale 0 em silêncio — corrija antes de gravar.');
    process.exit(1);
}

if (APLICAR) {
    writeFileSync('functions/_backup-aspectus-antes.json', JSON.stringify(
        Object.keys(ASPECTUS).map(k => ({ id: 'asp_' + k, antes: runPorId.get('asp_' + k) })), null, 2));
}
console.log(`\n${APLICAR ? '✅ GRAVADO' : '🔍 SIMULAÇÃO (rode com --apply para gravar)'}`
    + ` — ${SIGILUS_NOVOS.length} elementos, ${condCriadas} condições, ${Object.keys(ASPECTUS).length} Aspectus`);
console.log('Todas as referências de condição e de Valor Derivado resolveram contra o registro.');
process.exit(0);
