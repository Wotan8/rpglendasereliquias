/* ===== CUSTO DE UMA HABILIDADE DE CLASSE — leitura do cadastro =====
 *
 * O Painel do Criador deixou o custo escrito de QUATRO jeitos diferentes, um
 * por geração de módulo. Este arquivo é o único lugar que sabe ler os quatro,
 * para o Tabuleiro cobrar a mesma coisa que a ficha mostra.
 *
 *   1) `select_botao` → mecânica de custo ("Pagar Energia", "Pagar Graça").
 *      Dois desses no mesmo módulo = DUAS FORMAS de pagar, e quem usa escolhe.
 *      (Sangral, Guerreiro, Ladino, Pallacerdote, Xamã, Invocador)
 *   2) campo do schema com "Custo" no rótulo → texto livre, tipo
 *      "2 Energia ou 1 Energia + 2 Sanidade". "ou" separa alternativas;
 *      "e"/"+"/"," somam dentro da mesma alternativa.
 *      (Xamã, Adepto de Thannathog, Invocador, Pallacerdote)
 *   3) TÍTULO do módulo em degraus — "Custo 3 — Clímax" — com o recurso no
 *      próprio módulo. É como o Bardo cobra: o degrau é o preço, e a moeda é
 *      a Harmonia. Sem isto, nenhuma canção mostrava custo nenhum.
 *   4) nada — habilidade gratuita (loções prontas, vínculos do Ferinismo).
 *
 * A `regua.custo` do pré-definido NÃO entra aqui: ela é o denominador da
 * auditoria de balanceamento (quanto a habilidade entrega por ponto de
 * recurso), não o preço de mesa. Usá-la cobrava "2 ENER" de um Bardo que na
 * verdade paga 1 Harmonia.
 *
 * Saída: lista de ALTERNATIVAS. Cada alternativa é um pagamento completo:
 *   { rotulo, label, partes: [{ alvo, qtd }] }
 * `alvo` é o NOME do recurso como está escrito no cadastro ("Energia",
 * "Harmonia", "Graça de Palla"); quem consome resolve contra os Status Vitais
 * e os Valores Derivados do personagem.
 */

/** Palavras que aparecem com número mas não são recurso pagável. */
const NAO_E_RECURSO = /^(a[çc][ãa]o|a[çc][õo]es|min|minutos?|horas?|turnos?|rodadas?|dias?|cenas?|n[íi]ve(l|is)|oferendas?|pontos?|metros?|m)$/i;

/**
 * "1 Ação Prolongada" tem número e nome, mas tempo não é moeda. Decide pela
 * PRIMEIRA palavra: "Bolha de Sangue" é recurso, "Ação Prolongada" não é.
 */
const ehMoeda = (nome) => {
    const primeira = String(nome || '').trim().split(/\s+/)[0] || '';
    return !!primeira && !NAO_E_RECURSO.test(primeira);
};

/** Tira acento e caixa — comparação de nome de recurso é frouxa de propósito. */
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

/**
 * O recurso que um rótulo de campo sugere: "Custo em Energia" → "Energia",
 * "Custo Sanidade:" → "Sanidade", "Custo:" → '' (não diz qual).
 */
export function recursoDoRotulo(label) {
    const limpo = String(label || '')
        .replace(/custo/gi, ' ')
        .replace(/\bem\b|\bde\b|\bd[eo]s\b/gi, ' ')
        .replace(/[:\-–—()]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return ehMoeda(limpo) ? limpo : '';
}

/**
 * Texto de custo → alternativas.
 * @param {string} texto     "2 Energia ou 1 Energia + 2 Sanidade"
 * @param {string} padrao    recurso quando o texto traz só o número ("4")
 */
export function custoDoTexto(texto, padrao = '') {
    const bruto = String(texto ?? '').trim();
    if (!bruto) return [];

    const alternativas = [];
    for (const alt of bruto.split(/\bou\b/i)) {
        const partes = [];
        // "+", "," e o " e " solto somam dentro da MESMA alternativa
        for (const pedaco of alt.split(/[+,]|\se\s/i)) {
            const m = String(pedaco).trim().match(/^(\d+(?:[.,]\d+)?)\s*(?:de\s+|em\s+)?(.*)$/i);
            if (!m) continue;
            const qtd = parseFloat(m[1].replace(',', '.'));
            if (!(qtd > 0)) continue;
            // corta parênteses e sobras: "Sanidade (por rodada)" → "Sanidade"
            const nome = m[2].replace(/\(.*$/, '').replace(/[.;:]+$/, '').trim();
            if (nome && !ehMoeda(nome)) continue;          // "1 Ação Prolongada" não é moeda
            const alvo = nome || padrao;
            if (!alvo) continue;                           // número sem moeda e sem padrão
            partes.push({ alvo, qtd });
        }
        if (partes.length) alternativas.push(comRotulo({ partes }));
    }
    return alternativas;
}

/** Preenche `rotulo` a partir das partes: "3 Energia + 10 Sanidade". */
function comRotulo(forma) {
    return {
        label: forma.label || '',
        partes: forma.partes,
        rotulo: forma.partes.map(p => `${p.qtd} ${p.alvo}`).join(' + '),
    };
}

/** O degrau de custo que o TÍTULO do módulo declara ("Custo 3 — Clímax" → 3). */
export function degrauDoTitulo(titulo) {
    const m = String(titulo || '').match(/custo\s*(\d+(?:[.,]\d+)?)/i);
    const n = m ? parseFloat(m[1].replace(',', '.')) : 0;
    return n > 0 ? n : 0;
}

/**
 * Todas as formas de pagar UMA habilidade.
 *
 * @param {object}   o
 * @param {object}   o.modulo      definição do módulo de classe (schema, título…)
 * @param {object}   o.predef      item pré-definido do registro
 * @param {object}   o.item        instância na ficha (vence o pré-definido)
 * @param {Function} o.mechPorId   id → mecânica
 * @param {Function} o.custoDaMecanica  leitor de mecânica de custo (injetado
 *                   para este arquivo não depender de combate-cenas.js)
 * @returns {Array} alternativas — vazio quando a habilidade não custa nada
 */
export function custosDaSkill({ modulo, predef, item, mechPorId, custoDaMecanica }) {
    const schema = modulo?.schema || [];
    const valor = (key) => {
        const a = item?.[key];
        if (a != null && a !== '') return a;
        const b = predef?.valores?.[key];
        return (b != null && b !== '') ? b : '';
    };

    // (1) mecânicas de custo — cada botão é uma forma inteira de pagar
    const porMecanica = [];
    for (const f of schema) {
        if (f.tipo !== 'select_botao') continue;
        const mech = mechPorId?.(valor(f.key));
        const c = mech && custoDaMecanica?.(mech);
        if (!c) continue;
        const forma = comRotulo({ label: f.label || '', partes: [{ alvo: c.alvo, qtd: c.qtd }] });
        forma.rotulo = c.rotulo || forma.rotulo;
        if (!porMecanica.some(x => x.rotulo === forma.rotulo)) porMecanica.push(forma);
    }
    if (porMecanica.length) return porMecanica;

    // (2) campo de texto com "Custo" no rótulo
    for (const f of schema) {
        if (!/custo/i.test(f.label || '')) continue;
        if (f.tipo === 'select_botao') continue;           // já tratado acima
        const txt = valor(f.key);
        if (txt === '' || txt === '0') continue;
        const formas = custoDoTexto(txt, recursoDoRotulo(f.label) || recursoDoModulo(modulo));
        if (formas.length) return formas.map(x => ({ ...x, label: f.label || '' }));
    }

    // (3) degrau no título do módulo, pago na moeda do módulo (Bardo).
    // A moeda aceita ALTERNATIVA como qualquer outro custo: `custoRecurso` com
    // "Harmonia ou Energia" num módulo "Custo 2" vira duas formas de pagar, e
    // quem usa escolhe a que tem. Com uma moeda só, sai uma forma — igual a
    // antes. Quem decide se a classe pode trocar de moeda é o CADASTRO; o
    // motor só passou a saber ler a decisão.
    const degrau = degrauDoTitulo(modulo?.titulo);
    const moeda = recursoDoModulo(modulo);
    if (degrau && moeda) {
        const formas = custoDoTexto(
            moeda.split(/\bou\b/i).map(m => `${degrau} ${m.trim()}`).filter(x => x.trim()).join(' ou '));
        if (formas.length) return formas.map(x => ({ ...x, label: modulo.titulo || '' }));
    }

    // (4) sem custo cadastrado
    return [];
}

/**
 * A moeda do módulo. `custoRecurso` é o campo explícito; na falta dele vale o
 * recurso que o módulo DEVOLVE (`retornoRecurso`) — quem devolve Harmonia no
 * fim do turno é exatamente quem gastou Harmonia para conjurar.
 */
export function recursoDoModulo(modulo) {
    return String(modulo?.custoRecurso || modulo?.retornoRecurso || '').trim();
}

/**
 * O MÓDULO tem alguma forma de declarar custo?
 *
 * Serve para separar duas coisas que pareciam iguais: "esqueceram de preencher
 * o custo" e "esta habilidade não custa nada, por desenho". Um módulo de
 * Receita de Loções não tem campo de custo em lugar nenhum — a loção já foi
 * preparada, e usar é beber. Cobrar isso como falta é ruído.
 */
export function moduloDeclaraCusto(modulo) {
    const schema = modulo?.schema || [];
    if (schema.some(f => f.tipo === 'select_botao')) return true;
    if (schema.some(f => /custo/i.test(f.label || ''))) return true;
    return !!(degrauDoTitulo(modulo?.titulo) && recursoDoModulo(modulo));
}

/**
 * O cadastro declara EXPLICITAMENTE que não custa recurso?
 * "—", "-", "0", "Gatilho", "Nenhum" no campo de custo são declarações de
 * gratuidade, não campos vazios. O Ladino usa as duas primeiras.
 */
export function custoDeclaradoZero(modulo, predef, item) {
    const schema = modulo?.schema || [];
    for (const f of schema) {
        if (!/custo/i.test(f.label || '') || f.tipo === 'select_botao') continue;
        const v = String(item?.[f.key] ?? predef?.valores?.[f.key] ?? '').trim();
        if (v === '') continue;
        if (/^(—|–|-|0|nenhum[ao]?|gratuit[ao]|sem custo|gatilho|livre|passiv[ao])$/i.test(v)) return true;
    }
    return false;
}

/** Texto curto para o botão: "1 Harmonia" ou "2 Energia ou 1 Graça". */
export function rotuloDosCustos(formas) {
    return (formas || []).map(f => f.rotulo).filter(Boolean).join(' ou ');
}

/** Nomes de recurso iguais? (frouxo: acento e caixa não contam) */
export function mesmoRecurso(a, b) {
    return norm(a) === norm(b);
}
