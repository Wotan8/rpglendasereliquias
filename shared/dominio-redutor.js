/**
 * O redutor da Arte — a perícia é a porta.
 * Livro de 12 Páginas, p. 6 ("Quem pode usar") e p. 7 ("Conjurar").
 *
 *   perícia 0 ................ não usa a Arte (arma, foco ou escola)
 *   Qualidade ≤ perícia ...... usa normal
 *   Qualidade > perícia ...... redutor = Qualidade − perícia, subtraído do ALVO
 *
 * Até o Núcleo v2 a porta era uma peculiaridade à parte — o "Domínio", vinte
 * docs com escada própria de EXP. Agora é o nível da própria Perícia de Arte
 * na ficha: `dots['sk_combate_arma']`, `dots['sk_classe_hemomancia']`. Item e
 * módulo apontam para a perícia por `periciaId` (id do doc em
 * system/data/skills); a chave do dot sai de `chaveDaPericia()`.
 *
 * O redutor da perícia SOMA com o Redutor próprio da magia. Não vale o maior:
 * os dois se acumulam.
 *
 * Cada ponto de redutor custa um sexto do DPR no par de referência (Alvo 7,
 * Defesa 1): a chance cai 0,10 sobre 0,60. É linear.
 *
 * Módulo puro: não lê Firestore, não toca no DOM. Quem chama traz os números.
 */

const CATEGORIA = {
    mental: 'mental', fisico: 'fisico', fisica: 'fisico', social: 'social',
    combate: 'combate', defensiva: 'combate', exclusivo: 'exclusivo', classe: 'exclusivo',
};

/**
 * A chave do dot desta perícia na ficha — a MESMA conta do system-data-loader
 * (geral: `sk_<categoria>_<slug sem acento>`) e do core.js (exclusiva de
 * classe: `sk_classe_<nome minúsculo>`, acento vira `_`). Duas contas em dois
 * lugares divergem; esta é a cópia que o Tabuleiro e a ficha compartilham.
 */
export function chaveDaPericia(skill) {
    if (!skill?.nome) return null;
    const cat = CATEGORIA[String(skill.categoria || 'mental').toLowerCase()] || 'mental';
    const nome = String(skill.nome).toLowerCase();
    if (cat === 'exclusivo' && !skill.todoPersonagem) return 'sk_classe_' + nome.replace(/[^a-z0-9]/g, '_');
    const slug = nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '_').replace(/__+/g, '_');
    return `sk_${cat}_${slug}`;
}

/** Idem, partindo do id do doc. `null` quando o id não está no cadastro. */
export function chaveDaPericiaPorId(periciaId, skills) {
    if (!periciaId) return null;
    return chaveDaPericia((skills || []).find(s => s.id === periciaId));
}

/** Nível da Perícia de Arte na ficha, pela chave do dot. */
export function nivelDoDominio(dots, chave) {
    if (!dots || !chave) return 0;
    return Number(dots[chave] ?? 0) || 0;
}

/**
 * O redutor que a perícia baixa põe no Alvo.
 * Qualidade e nível fora da escala 0–10 (Q5 + Aura 5) são presos nela: peça
 * sem Qualidade cadastrada vale 0, e 0 nunca gera redutor.
 *
 * COM FOCO, a perícia responde à MAIOR exigência posta sobre ela — a da magia
 * ou a do foco, o que for maior. Nunca as duas somadas: é uma perícia só, e
 * cobrar duas vezes pelo mesmo treino seria imposto duplo.
 *
 * O foco soma a própria Qualidade no Alvo (25 mecânicas fazem isso); sem olhar
 * para ele, um talismã caro compraria Alvo com dinheiro no lugar de EXP. Com o
 * max, a conta se fecha sozinha:
 *
 *     Alvo + Qf − (Qf − N)  =  Alvo + N
 *
 * ou seja, a contribuição LÍQUIDA do foco é `min(Qf, N)`:
 * **o foco rende até o nível da perícia, e nem um ponto além.**
 */
export function redutorDoDominio(qualidade, nivel, qualidadeFoco = 0) {
    const presa = v => Math.min(10, Math.max(0, Number(v) || 0));
    return Math.max(0, Math.max(presa(qualidade), presa(qualidadeFoco)) - presa(nivel));
}

/**
 * Quanto o foco de fato acrescenta ao Alvo, já descontado o redutor que ele
 * mesmo provoca. Serve para a ficha explicar o número em vez de só mostrá-lo.
 */
export function focoLiquido(qualidadeFoco, nivel) {
    const presa = v => Math.min(10, Math.max(0, Number(v) || 0));
    return Math.min(presa(qualidadeFoco), presa(nivel));
}

/**
 * O redutor total do teste: o próprio da magia mais o da perícia.
 * `redutorProprio` chega como está cadastrado — "-3", -3 ou 3 — e o sinal é
 * ignorado: redutor é sempre subtração.
 */
export function redutorTotal({ redutorProprio = 0, qualidade = 0, nivel = 0, qualidadeFoco = 0 } = {}) {
    return Math.abs(Number(redutorProprio) || 0) + redutorDoDominio(qualidade, nivel, qualidadeFoco);
}

/**
 * Sem a perícia da Arte, a peça não gera linha de ataque e a magia não abre.
 * Nível 0 é ausência, não "nível zero que ainda usa".
 *
 * Peça sem `periciaId` — armadura, mochila, ingrediente — não tem porta: passa.
 */
export function podeUsar(chave, dots) {
    if (!chave) return true;
    return nivelDoDominio(dots, chave) > 0;
}

/**
 * O Alvo já com o redutor, e a fórmula para a ficha mostrar.
 * Devolve `null` em `alvo` quando o VD ainda não resolveu, para o chamador
 * distinguir "0" de "não sei".
 */
export function alvoComRedutor({ alvoBase, redutorProprio = 0, qualidade = 0, nivel = 0, qualidadeFoco = 0 } = {}) {
    const red = redutorTotal({ redutorProprio, qualidade, nivel, qualidadeFoco });
    const base = Number(alvoBase);
    const temBase = alvoBase !== null && alvoBase !== undefined && Number.isFinite(base);
    return {
        redutor: red,
        redutorDominio: redutorDoDominio(qualidade, nivel, qualidadeFoco),
        alvo: temBase ? base - red : null,
        formula: temBase && red ? `${base} − ${red} = ${base - red}` : null,
    };
}

/**
 * O redutor de uma linha de magia, somando tudo que a subtrai do Alvo.
 *
 * Uma função só, chamada pela ficha E pelo Tabuleiro. A regra da casa nasceu de
 * um erro: o Redutor do Véu foi implementado só no Tabuleiro e a ficha nunca
 * soube dele. Conta em dois lugares diverge; a de um lugar, não.
 *
 * @param mod        o módulo de classe (schema, custoExpPorItem)
 * @param item       a linha do jogador (os valores digitados)
 * @param predef     o item pré-cadastrado, se houver (traz `qualidade`)
 * @param dots       os níveis da ficha
 * @param alvoKey    a chave do campo de Alvo. Campo `redutor` sem `vinculadoA`
 *                   vale para TODOS os Alvos da linha — é o caso do Bardo, que
 *                   tem um VD por forma de conjurar.
 * @param resolveEq  avaliador de equação do lado de quem chama. Sem ele, o valor
 *                   sai do campo digitado.
 * @param focos      itens equipados que servem de foco, cada um `{chave, qualidade}`.
 *                   Só o da MESMA perícia do módulo conta — talismã de Necromancia
 *                   não ajuda a tocar alaúde.
 * @param chave      a chave do dot da Perícia de Arte do módulo (o chamador resolve
 *                   `mod.periciaId` com `chaveDaPericiaPorId`). Sem ela, o módulo
 *                   não tem porta e só o Redutor próprio conta.
 */
export function redutorDaLinha({ mod, item, predef = null, dots = {}, alvoKey = '', resolveEq = null, focos = [], chave = null } = {}) {
    const partes = [];
    let somaDominio = true;

    for (const f of (mod?.schema || [])) {
        if (f.tipo !== 'redutor') continue;
        if (f.vinculadoA && alvoKey && f.vinculadoA !== alvoKey) continue;
        if (f.vinculadoA && !alvoKey) continue;
        const daEquacao = resolveEq && Array.isArray(f.equacao) && f.equacao.length
            ? Number(resolveEq(f.equacao)) : NaN;
        const v = Math.abs(Number.isFinite(daEquacao) && daEquacao !== 0
            ? daEquacao
            : Number(item?.[f.key] ?? predef?.valores?.[f.key] ?? 0) || 0);
        if (v) partes.push({ valor: v, nome: String(f.label || 'Redutor').replace(/:$/, '') });
        if (f.somaDominio === false) somaDominio = false;
    }

    // Legado: campo de texto cujo RÓTULO casa /^redutor/i, com a chave variando
    // por escola. Só entra se nenhum campo novo respondeu.
    if (!partes.length) {
        const legado = (mod?.schema || []).find(f => f.tipo !== 'redutor' && /^redutor/i.test(f.label || ''));
        const v = legado ? Math.abs(Number(item?.[legado.key] ?? predef?.valores?.[legado.key] ?? 0) || 0) : 0;
        if (v) partes.push({ valor: v, nome: 'Redutor' });
    }

    let nivel = 0, qualidade = 0, semDominio = false, qFoco = 0;
    const porta = chave ?? mod?.periciaChave ?? null;
    if (somaDominio && porta) {
        nivel = nivelDoDominio(dots, porta);
        qualidade = predef?.qualidade ?? mod.custoExpPorItem ?? 0;
        semDominio = !podeUsar(porta, dots);
        qFoco = Math.max(0, ...(focos || [])
            .filter(f => f?.chave === porta)
            .map(f => Number(f.qualidade) || 0), 0);
        const rd = redutorDoDominio(qualidade, nivel, qFoco);
        if (rd) partes.push({
            valor: rd,
            nome: qFoco > qualidade ? `Perícia ${nivel} < foco Q${qFoco}` : `Perícia ${nivel} < Q${qualidade}`,
        });
    }

    const redutor = partes.reduce((s, p) => s + p.valor, 0);
    return redutor ? { redutor, partes, nivel, qualidade, qualidadeFoco: qFoco, semDominio } : null;
}

/* ------------------------------------------------------------------ *
 * Auto-teste. `node shared/dominio-redutor.js`
 * ------------------------------------------------------------------ */
if (typeof process !== 'undefined' && process.argv?.[1]?.endsWith('dominio-redutor.js')) {
    const { strict: assert } = await import('node:assert');

    // a chave do dot: a mesma do loader da ficha e do core.js
    assert.equal(chaveDaPericia({ nome: 'Arma', categoria: 'combate' }), 'sk_combate_arma');
    assert.equal(chaveDaPericia({ nome: 'Precisão', categoria: 'combate' }), 'sk_combate_precisao', 'acento sai');
    assert.equal(chaveDaPericia({ nome: 'Ofício Braç.', categoria: 'fisica' }), 'sk_fisico_oficio_brac_', 'categoria legada e ponto');
    assert.equal(chaveDaPericia({ nome: 'Hemomancia', categoria: 'exclusivo' }), 'sk_classe_hemomancia', 'exclusiva de classe');
    assert.equal(chaveDaPericia({ nome: 'Erudição Rúnica', categoria: 'exclusivo' }), 'sk_classe_erudi__o_r_nica', 'exclusiva: acento vira _ e não some');
    assert.equal(chaveDaPericia({ nome: 'Erudição', categoria: 'exclusivo', todoPersonagem: true }), 'sk_exclusivo_erudicao');
    assert.equal(chaveDaPericia(null), null);
    assert.equal(chaveDaPericiaPorId('x', [{ id: 'x', nome: 'Disparo', categoria: 'combate' }]), 'sk_combate_disparo');
    assert.equal(chaveDaPericiaPorId('y', [{ id: 'x', nome: 'Disparo', categoria: 'combate' }]), null, 'id fora do cadastro não vira porta');

    // escala básica
    assert.equal(redutorDoDominio(5, 0), 5);
    assert.equal(redutorDoDominio(5, 5), 0);
    assert.equal(redutorDoDominio(1, 3), 0, 'perícia acima da Qualidade não vira bônus');
    assert.equal(redutorDoDominio(null, 0), 0, 'peça sem Qualidade não gera redutor');
    assert.equal(redutorDoDominio(12, 0), 10, 'Qualidade fora da escala é presa em 10 (Q5 + Aura 5)');

    // soma com o Redutor próprio, e o sinal não importa
    assert.equal(redutorTotal({ redutorProprio: -2, qualidade: 3, nivel: 1 }), 4);
    assert.equal(redutorTotal({ redutorProprio: 2, qualidade: 3, nivel: 1 }), 4);
    assert.equal(redutorTotal({ redutorProprio: '-4', qualidade: 3, nivel: 3 }), 4);

    // o gate
    const ARMA = 'sk_combate_arma';
    assert.equal(podeUsar(ARMA, { [ARMA]: 1 }), true);
    assert.equal(podeUsar(ARMA, { [ARMA]: 0 }), false, 'nível 0 é ausência');
    assert.equal(podeUsar(ARMA, {}), false);
    assert.equal(podeUsar(null, {}), true, 'peça sem perícia passa (armadura, mochila)');

    // o Alvo e a fórmula
    const a = alvoComRedutor({ alvoBase: 7, redutorProprio: -2, qualidade: 3, nivel: 1 });
    assert.deepEqual([a.redutor, a.alvo, a.formula], [4, 3, '7 − 4 = 3']);
    assert.equal(alvoComRedutor({ alvoBase: 7, qualidade: 1, nivel: 1 }).formula, null, 'sem redutor, sem fórmula');
    assert.equal(alvoComRedutor({ alvoBase: null, qualidade: 5 }).alvo, null, 'VD não resolvido não vira 0');

    // no par de referência, cada ponto tira um sexto do DPR
    const P = alvo => Math.max(0, Math.min(9, alvo - 1)) / 10;
    assert.equal(P(7), 0.6);
    assert.equal(P(7 - redutorDoDominio(5, 0)), 0.1, 'Q5 sem a perícia entrega 1/6 do normal');

    /* ---- redutorDaLinha: os dois formatos e o Bardo ---- */
    const HEMO = 'sk_classe_hemomancia', SONO = 'sk_classe_sonoromancia';
    const dots = { [HEMO]: 1 };
    const modNovo = {
        periciaId: 'sk_hemo', custoExpPorItem: 3,
        schema: [{ key: '2', label: 'Teste:', tipo: 'select_vd' },
                 { key: '3', label: 'Redutor:', tipo: 'redutor', vinculadoA: '2', somaDominio: true }],
    };
    // Armadura Sanguínea: Rp 2 + perícia (3−1) = 4
    let r = redutorDaLinha({ mod: modNovo, item: { 3: '-2' }, dots, alvoKey: '2', chave: HEMO });
    assert.equal(r.redutor, 4);
    assert.deepEqual(r.partes.map(p => p.valor), [2, 2]);
    // vinculado a outro Alvo: o Redutor próprio não entra, o da perícia sim
    assert.equal(redutorDaLinha({ mod: modNovo, item: { 3: '-2' }, dots, alvoKey: 'outro', chave: HEMO }).redutor, 2);
    // a equação vence o campo digitado quando resolve para algo
    assert.equal(redutorDaLinha({
        mod: { ...modNovo, schema: [modNovo.schema[0], { ...modNovo.schema[1], equacao: [{ tipo: 'fixo', valor: 3 }] }] },
        item: { 3: '-2' }, dots, alvoKey: '2', chave: HEMO, resolveEq: eq => eq[0].valor,
    }).redutor, 5);
    // somaDominio: false tira a perícia da conta
    assert.equal(redutorDaLinha({
        mod: { ...modNovo, schema: [modNovo.schema[0], { ...modNovo.schema[1], somaDominio: false }] },
        item: { 3: '-2' }, dots, alvoKey: '2', chave: HEMO,
    }).redutor, 2);
    // sem chave o módulo não tem porta: só o Redutor próprio
    assert.equal(redutorDaLinha({ mod: modNovo, item: { 3: '-2' }, dots, alvoKey: '2' }).redutor, 2);
    // `mod.periciaChave` serve de chave quando o chamador já anotou o módulo
    assert.equal(redutorDaLinha({ mod: { ...modNovo, periciaChave: HEMO }, item: { 3: '-2' }, dots, alvoKey: '2' }).redutor, 4);
    // Bardo: `vinculadoA` vazio vale para todos os VDs da linha
    const modBardo = { periciaId: 'sk_sono', custoExpPorItem: 5,
        schema: [{ key: '4', label: 'Vocal', tipo: 'select_vd' }, { key: '5', label: 'Inst. Corda', tipo: 'select_vd' },
                 { key: '3', label: 'Redutor', tipo: 'redutor', vinculadoA: '', somaDominio: true }] };
    for (const k of ['4', '5'])
        assert.equal(redutorDaLinha({ mod: modBardo, item: { 3: 0 }, dots: { [SONO]: 1 }, alvoKey: k, chave: SONO }).redutor, 4,
            'A SINFONIA na perícia 1 leva 4, em qualquer instrumento');
    // legado: rótulo casa, tipo é texto
    assert.equal(redutorDaLinha({
        mod: { schema: [{ key: '4', label: 'Redutor:', tipo: 'text' }] }, item: { 4: '-3' },
    }).redutor, 3);
    // sem redutor nenhum devolve null, para o chip não desenhar "− 0"
    assert.equal(redutorDaLinha({ mod: modNovo, item: { 3: 0 }, dots: { [HEMO]: 3 }, alvoKey: '2', chave: HEMO }), null);

    /* ---- o foco ---- */
    // a perícia responde ao MAIOR: magia ou foco, nunca a soma
    assert.equal(redutorDoDominio(1, 1, 3), 2, 'foco Q3 com perícia 1 pede 2');
    assert.equal(redutorDoDominio(4, 1, 2), 3, 'magia Q4 manda: o foco menor não muda nada');
    assert.equal(redutorDoDominio(3, 1, 3), 2, 'iguais não somam — é uma perícia só');
    assert.equal(redutorDoDominio(1, 3, 1), 0, 'foco dentro da perícia não cobra nada');

    // a identidade que dá sentido à regra: o foco rende min(Qf, N)
    for (const [qf, n] of [[3, 1], [5, 2], [1, 3], [0, 4], [5, 5]]) {
        const liquido = qf - redutorDoDominio(0, n, qf);   // o que ele soma, menos o que provoca
        assert.equal(liquido, focoLiquido(qf, n), `foco Q${qf} com perícia ${n}`);
        assert.equal(liquido, Math.min(qf, n), 'o foco rende até o nível da perícia, e não além');
    }

    // Bardo perícia 1, canção Q1, alaúde Q3 — o caso que motivou a regra
    const bardo = alvoComRedutor({ alvoBase: 7 + 3, qualidade: 1, nivel: 1, qualidadeFoco: 3 });
    assert.equal(bardo.alvo, 8, 'Alvo 7 + 3 do foco − 2 de redutor = 8, ou seja +1 = o nível');

    // só o foco da MESMA perícia conta
    const modF = { periciaId: 'sk_sono', custoExpPorItem: 1, schema: [] };
    const dotsF = { [SONO]: 1 };
    assert.equal(redutorDaLinha({ mod: modF, item: {}, dots: dotsF, chave: SONO,
        focos: [{ chave: 'sk_classe_necromancia', qualidade: 5 }] }), null, 'talismã de outra escola não pesa');
    assert.equal(redutorDaLinha({ mod: modF, item: {}, dots: dotsF, chave: SONO,
        focos: [{ chave: SONO, qualidade: 4 }] }).redutor, 3);
    assert.match(redutorDaLinha({ mod: modF, item: {}, dots: dotsF, chave: SONO,
        focos: [{ chave: SONO, qualidade: 4 }] }).partes[0].nome, /foco Q4/,
        'a ficha precisa dizer que foi o FOCO que pesou, não a magia');

    console.log('dominio-redutor: ok');
}
