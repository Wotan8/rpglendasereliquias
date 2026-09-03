/* =====================================================================
   SANIDADE DO SISTEMA — as regras que o cadastro não consegue impedir

   O projeto tem 37 auditorias em functions/. Todas são node, todas leem o
   Firestore com credencial de admin, e todas só rodam quando alguém as roda.
   O criador nunca as viu. Isso importa porque os erros que elas pegam são
   SILENCIOSOS: o cadastro salva bonito, a ficha não reclama, e a régua fica
   torta até alguém desconfiar na mesa.

   Aqui moram as regras que dependem só do `sys` — o mesmo objeto que o Painel
   do Criador já tem carregado. Sem Firestore, sem DOM, sem rede: entra o
   cadastro, sai a lista do que está errado. Quem desenha a tela é o painel.

   O que NÃO entra: regra que precise ler `char`/`npcs` (personagens), que é
   coleção grande e não está na mão do painel. Essas continuam em functions/.
   ===================================================================== */

import { ACAO, recursoDoPredef } from './parse-custo.js';

/* Comparação de nome sempre por aqui: o cadastro tem "Perícia" e "Pericia",
   "Célere" e "Celere", e a mesa não distingue os dois. */
const norm = (s) => String(s ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .toLowerCase().trim();

/** Os cálculos de uma mecânica, sempre como lista (o formato antigo tinha um só). */
function calculosDa(mec) {
    const cfg = (mec && mec.config) || {};
    if (Array.isArray(cfg.calculos) && cfg.calculos.length) return cfg.calculos;
    if (cfg.alvo || cfg.valor != null) return [{ operacao: cfg.operacao || '+', alvo: cfg.alvo, equacao: [] }];
    return [];
}

const alvosDe = (c) => (Array.isArray(c.alvo) ? c.alvo : [c.alvo]).filter(Boolean);

/* =====================================================================
   OS ALVOS QUE A FICHA SABE RESOLVER

   `_resolveSheetRef` (ficha-v1.7_1/js/mechanics-engine.js) consulta o
   TARGET_MAP e, quando o nome não está lá, devolve 0. Não avisa, não loga,
   não pinta de vermelho: a mecânica passa a somar zero e continua na tela
   como se funcionasse. Foi assim que os apontamentos para o VD "Reação"
   sobreviveram à renomeação dele para "Defesa" no combate v3.

   A metade DINÂMICA do mapa (perícias, VDs, status vitais, partes do corpo,
   elementos rúnicos, limites de módulo) é reconstruída aqui a partir do
   mesmo `sys`. A metade ESTÁTICA — atributos e um punhado de campos fixos —
   está copiada abaixo, e `sanidade.test.mjs` lê o mechanics-engine e falha
   se as duas listas divergirem. Cópia sem guarda vira mentira; com o teste,
   vira espelho.
   ===================================================================== */
export const ALVOS_FIXOS = [
    // atributos, por sigla e por nome
    'INT', 'RAC', 'PRS', 'FOR', 'DES', 'VIG', 'PRE', 'MAN', 'AUT',
    'Inteligência', 'Raciocínio', 'Perseverança', 'Força', 'Destreza', 'Vigor',
    'Presença', 'Manipulação', 'Autocontrole',
    // status vitais e campos da ficha
    'Vitalidade Máxima', 'Energia Máxima', 'Sanidade Máxima', 'Blindagem',
    // perícias do Núcleo v2 (32 gerais + 8 de Escola), mais os apelidos antigos
    // que o TARGET_MAP ainda resolve para a chave nova
    'Anatomia', 'Medicina', 'Erudição', 'História', 'Tradição', 'Ofícios', 'Ofício Intel.',
    'Relíquia', 'Religião', 'Fluxomancia', 'Essência', 'Herbalismo', 'Investigação',
    'Percepção', 'Observação', 'Resiliência',
    'Acrobacia', 'Agilidade', 'Atletismo', 'Furtividade', 'Prestidigitação', 'Montaria',
    'Sobrevivência', 'Domar', 'Labuta', 'Ofício Braç.',
    'Barganha', 'Diplomacia', 'Lábia', 'Malandragem', 'Sedução', 'Intimidação',
    'Liderança', 'Performance', 'Empatia',
    'Arma', 'Precisão', 'Briga', 'Disparo', 'Arremesso', 'Arremessar',
    'Esquiva', 'Desviar', 'Evadir', 'Aparar', 'Contra-Ataque', 'Contra-Ataq.',
    'Bloquear', 'Cobertura', 'Proteger',
    'Hemomancia', 'Abismancia', 'Abismo', 'Necromancia', 'Pallomancia', 'Sonoromancia',
    'Totemancia', 'Runomancia', 'Alquimancia', 'Alquimia',
    // avulsos
    'Ações por turno', 'EXP',
];

/** Refs que o resolvedor trata ANTES de olhar o TARGET_MAP. */
const PREFIXOS_LIVRES = ['Item: ', 'Projétil: ', 'Elemento Rúnico: ', 'Limite: ', 'Parte do Corpo: '];
const AVULSOS_LIVRES = ['Nível', 'Pressão Total (Equipados)'];

/**
 * Todo nome que a ficha consegue transformar em número, montado do cadastro.
 *
 * Mapa e não conjunto porque o nome ORIGINAL faz falta: é ele que aparece na
 * sugestão de "você quis dizer", e ninguém reconhece "desloc. aquatico".
 *
 * @param {object} sys  { skills, derivedValues, vitalStats, bodyParts, classes, classModules, runicElements }
 * @returns {Map<string,string>} nome normalizado -> nome como está no cadastro
 */
export function alvosConhecidos(sys = {}) {
    const set = new Map();
    const put = (n) => { if (n) set.set(norm(n), String(n)); };

    ALVOS_FIXOS.forEach(put);
    AVULSOS_LIVRES.forEach(put);

    for (const s of (sys.skills || [])) { put(s.nome); put('Perícia: ' + s.nome); }
    // Perícia de classe entra por ID e vira nome; o alias sem prefixo também vale.
    for (const c of (sys.classes || [])) {
        if (c.publicado === false) continue;
        for (const ref of (c.pericClasse || [])) {
            const nome = typeof ref === 'object' && ref ? ref.nome
                : ((sys.skills || []).find(s => s.id === ref) || {}).nome || ref;
            put(nome); put('Perícia: ' + nome);
        }
    }
    for (const d of (sys.derivedValues || [])) {
        put(d.nome);
        if (d.campoAtual) { put(`${d.nome} (Atual)`); put(`${d.nome} (Máximo)`); }
    }
    for (const v of (sys.vitalStats || [])) {
        put(`${v.nome} Máxima`); put(`${v.nome} Máximo`); put(`${v.nome} Atual`);
    }
    for (const b of (sys.bodyParts || [])) put(`Parte do Corpo: ${b.nome}`);
    for (const e of (sys.runicElements || [])) put(`Elemento Rúnico: ${e.nome}`);
    for (const m of (sys.classModules || [])) if (m.mecanicaLimiteId) put('Limite: ' + m.titulo);

    return set;
}

/** Um nome que a ficha resolve? Prefixo livre passa sem consultar catálogo. */
function resolve(nome, conhecidos) {
    const s = String(nome ?? '').trim();
    if (!s) return true;                                  // vazio é outro problema, não este
    if (PREFIXOS_LIVRES.some(p => s.startsWith(p))) return true;
    return conhecidos.has(norm(s));
}

const palavras = (s) => norm(s).split(/[^a-z0-9]+/).filter(Boolean);

/**
 * O nome certo, quando o errado é só uma abreviatura do certo.
 *
 * Não é enfeite: os três casos reais do banco eram mecânicas mirando
 * "Deslocamento Aquático" enquanto o Valor Derivado se chama "Desloc.
 * Aquático". Dizer só "não existe" deixa o criador procurando; dizer "existe
 * 'Desloc. Aquático'" resolve na hora.
 *
 * Casa palavra por palavra, aceitando que uma seja abreviatura da outra
 * (mínimo de 4 letras, para "de"/"da" não casarem com tudo).
 *
 * @returns {string|null} o nome conhecido mais parecido, ou null
 */
export function sugerirParecido(nome, conhecidos) {
    const alvo = palavras(nome);
    if (!alvo.length) return null;
    let melhor = null, melhorNota = 0;
    for (const c of conhecidos.values()) {
        const cand = palavras(c);
        if (!cand.length) continue;
        let nota = 0;
        for (const a of alvo) {
            if (cand.some(b => b === a
                || (a.length >= 4 && b.startsWith(a))
                || (b.length >= 4 && a.startsWith(b)))) nota++;
        }
        // precisa casar TUDO e ter mais de uma palavra, senão "Arma" acha "Armadura"
        if (nota === alvo.length && nota === cand.length && nota > 1 && nota > melhorNota) {
            melhorNota = nota; melhor = c;
        }
    }
    return melhor;
}

/* =====================================================================
   AS REGRAS
   Cada uma recebe o `sys` inteiro e devolve achados. Achado é um fato com
   endereço: `modulo`+`itemId` mandam o painel abrir o registro certo.
   ===================================================================== */

const achado = (modulo, itemId, onde, problema) => ({ modulo, itemId, onde, problema });

/** Predefinidos de todos os módulos de classe publicados, já com o dono junto. */
function* predefs(sys) {
    for (const m of (sys.classModules || [])) {
        if (m.publicado === false) continue;              // módulo aposentado não vai à mesa
        for (const p of (m.itensPredefinidos || [])) yield { m, p };
    }
}

/** Onde a condição realmente cai quando a habilidade dispara. */
function nivelEfetivo(def, pedido) {
    if (!def || def.acumulaNiveis !== true) return 1;
    return def.nivelMaximo != null ? Math.min(pedido, def.nivelMaximo) : pedido;
}

const condPorNome = (sys) => {
    const m = {};
    for (const c of (sys.conditions || [])) m[norm(c.nome)] = c;
    return m;
};

export const REGRAS = [
    {
        id: 'ref-quebrada',
        titulo: 'Referência que a ficha lê como zero',
        gravidade: 'grave',
        porque: 'A mecânica aponta para um nome que não existe mais no cadastro. '
            + 'A ficha não acusa erro: devolve 0 e segue. Foi o que aconteceu com o VD '
            + '"Reação" quando ele virou "Defesa" — quem não foi renomeado junto passou '
            + 'a somar nada, em silêncio.',
        rodar(sys) {
            const conhecidos = alvosConhecidos(sys);
            const talvez = (n) => {
                const p = sugerirParecido(n, conhecidos);
                return p ? `. Existe "${p}" — era esse?` : '';
            };
            const out = [];
            for (const mec of (sys.mechanics || [])) {
                for (const c of calculosDa(mec)) {
                    for (const alvo of alvosDe(c)) {
                        if (!resolve(alvo, conhecidos)) {
                            out.push(achado('mechanics', mec.id, mec.nome || mec.id,
                                `o alvo "${alvo}" não existe no cadastro — a mecânica não altera nada${talvez(alvo)}`));
                        }
                    }
                    for (const t of (Array.isArray(c.equacao) ? c.equacao : [])) {
                        if (t && t.tipo === 'ficha' && t.ref && !resolve(t.ref, conhecidos)) {
                            out.push(achado('mechanics', mec.id, mec.nome || mec.id,
                                `a equação lê "${t.ref}", que não existe — entra como 0${talvez(t.ref)}`));
                        }
                    }
                }
            }
            return out;
        },
    },
    {
        id: 'ref-pericia',
        titulo: 'Perícia citada sem o prefixo, com VD de mesmo nome',
        gravidade: 'grave',
        porque: 'Sem "Perícia: " na frente, o resolvedor casa primeiro com o Valor '
            + 'Derivado homônimo e a mecânica lê o número errado. Não é aviso de estilo: '
            + 'hoje, nesses casos, a conta já está errada.',
        rodar(sys) {
            const pericias = new Set((sys.skills || []).map(s => norm(s.nome)));
            const vds = new Set((sys.derivedValues || []).map(d => norm(d.nome)));
            const ambiguo = (n) => typeof n === 'string' && !/^Perícia:\s/i.test(n)
                && pericias.has(norm(n)) && vds.has(norm(n));
            const out = [];
            for (const mec of (sys.mechanics || [])) {
                for (const c of calculosDa(mec)) {
                    for (const alvo of alvosDe(c)) {
                        if (ambiguo(alvo)) out.push(achado('mechanics', mec.id, mec.nome || mec.id,
                            `o alvo "${alvo}" existe como perícia E como Valor Derivado — hoje vai no VD. `
                            + `Escreva "Perícia: ${alvo}" se a intenção era a perícia`));
                    }
                    for (const t of (Array.isArray(c.equacao) ? c.equacao : [])) {
                        if (t && t.tipo === 'ficha' && ambiguo(t.ref)) {
                            out.push(achado('mechanics', mec.id, mec.nome || mec.id,
                                `a equação lê "${t.ref}", ambíguo entre perícia e Valor Derivado — hoje vai no VD`));
                        }
                    }
                }
            }
            return out;
        },
    },
    {
        id: 'nivel-condicao',
        titulo: 'Nível de condição que não chega à mesa',
        gravidade: 'grave',
        porque: 'O Tabuleiro só honra `nivel` quando a condição tem `acumulaNiveis`, '
            + 'e ainda corta por `nivelMaximo`. Sem a flag, "Célere 5" entra em 1: a '
            + 'habilidade entrega uma fração do que a Régua cobrou, e nada avisa.',
        rodar(sys) {
            const conds = condPorNome(sys);
            const out = [];
            for (const { m, p } of predefs(sys)) {
                for (const c of (p.condicoesAplicadas || [])) {
                    const def = conds[norm(c.condicao)];
                    if (!def) {
                        out.push(achado('classModules', m.id, `${m.titulo || m.id} › ${p.nome}`,
                            `aplica a condição "${c.condicao}", que não existe no cadastro`));
                        continue;
                    }
                    if (c.nivel == null) continue;
                    const entra = nivelEfetivo(def, c.nivel);
                    if (entra === c.nivel) continue;
                    out.push(achado('classModules', m.id, `${m.titulo || m.id} › ${p.nome}`,
                        `${c.condicao} ${c.nivel} entra em ${entra} `
                        + (def.acumulaNiveis === true
                            ? `(teto ${def.nivelMaximo} na condição)`
                            : `(a condição não tem "acumula níveis")`)));
                }
            }
            return out;
        },
    },
    {
        id: 'nivel-na-prosa',
        titulo: 'Nível prometido no texto que a mesa não entrega',
        gravidade: 'grave',
        porque: 'Irmã da anterior, e mais funda: aqui o nível está escrito na descrição '
            + '("fica Blindado 8 por 1 cena"). O carimbo da Régua foi calculado sobre o '
            + 'número da prosa, então a habilidade está precificada por um efeito que '
            + 'ela não entrega.',
        rodar(sys) {
            const conds = condPorNome(sys);
            // do nome mais longo para o mais curto: "Marcado pela Caça" antes de "Marcado"
            const nomes = (sys.conditions || []).map(c => c.nome).filter(Boolean)
                .sort((a, b) => b.length - a.length);
            const out = [];
            for (const { m, p } of predefs(sys)) {
                const texto = [p.descricao, ...Object.values(p.valores || {})]
                    .filter(v => typeof v === 'string').join(' ');
                if (!texto) continue;
                const jaVisto = new Set();
                for (const nome of nomes) {
                    const re = new RegExp(`\\b${nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+(\\d+)\\b`, 'gi');
                    for (const mt of texto.matchAll(re)) {
                        const pedido = Number(mt[1]);
                        if (!(pedido > 1) || jaVisto.has(nome + pedido)) continue;
                        jaVisto.add(nome + pedido);
                        const entra = nivelEfetivo(conds[norm(nome)], pedido);
                        if (entra === pedido) continue;
                        out.push(achado('classModules', m.id, `${m.titulo || m.id} › ${p.nome}`,
                            `o texto promete "${nome} ${pedido}", chega ${entra}`
                            + (p.regua?.razao != null ? ` — carimbo ${p.regua.razao}×` : '')));
                    }
                }
            }
            return out;
        },
    },
    {
        id: 'condicao-repetida',
        titulo: 'Condição declarada duas vezes na mesma habilidade',
        gravidade: 'aviso',
        porque: 'Aplicar a mesma condição duas vezes não empilha nada — pede uma conta '
            + 'que não muda resultado. Costuma ser sobra de edição.',
        rodar(sys) {
            const out = [];
            for (const { m, p } of predefs(sys)) {
                const vistas = new Set(), repetidas = new Set();
                for (const c of (p.condicoesAplicadas || [])) {
                    const k = norm(c.condicao);
                    if (!k) continue;
                    if (vistas.has(k)) repetidas.add(c.condicao); else vistas.add(k);
                }
                for (const nome of repetidas) {
                    out.push(achado('classModules', m.id, `${m.titulo || m.id} › ${p.nome}`,
                        `"${nome}" aparece mais de uma vez em Condições Aplicadas`));
                }
            }
            return out;
        },
    },
    {
        id: 'custo-carimbado',
        titulo: 'Carimbo da Régua com denominador velho',
        gravidade: 'aviso',
        porque: 'A v1 da régua media unidades ÷ recurso e esquecia a ação. O §0.6 diz: '
            + 'custo total = recursos + ação. Carimbo que não foi refeito depois disso '
            + 'tem denominador pequeno demais e a razão sai INFLADA — a habilidade '
            + 'parece aprovada sem estar.',
        rodar(sys) {
            const out = [];
            for (const { m, p } of predefs(sys)) {
                if (p.economia !== 'combate' || p.regua?.custo == null) continue;
                if (ACEITAS[p.nome]) continue;
                const campos = (m.schema || []).filter(f => /custo/i.test(f.label || '') && f.tipo !== 'select_botao');
                const degrau = Number((String(m.titulo || '').match(/custo\s+(\d+)/i) || [])[1] || 0);
                const esperado = (recursoDoPredef(campos, p.valores) || degrau) + (ACAO[p.valores?.acao] ?? 1.0);
                if (!esperado) continue;                              // custo ilegível: não julga
                if (Math.abs(esperado - p.regua.custo) <= 0.06) continue;
                const real = p.regua.unidades / esperado;
                out.push(achado('classModules', m.id, `${m.titulo || m.id} › ${p.nome}`,
                    `carimbado custo ${p.regua.custo} → ${p.regua.razao}×; `
                    + `recursos + ação dão ${esperado.toFixed(2)} → ${real.toFixed(2)}×`
                    + (real < 1 || real > 2 ? ' (FORA DA FAIXA)' : '')));
            }
            return out;
        },
    },
];

/* Divergências já examinadas e aceitas. Auditoria que grita sobre o que já foi
   julgado vira ruído — mas o motivo fica aqui, para ninguém "consertar" de novo.
   Espelha a lista de functions/audit-custo-carimbado.mjs. */
export const ACEITAS = {
    'Corte de Passagem': 'numerador da família "ataque extra" não é reproduzível pelo modelo — está SUBdimensionada',
    'Golpe Cruzado': 'mesmo caso do Corte de Passagem',
    'Transcendência — Receptor': 'alternativa de pagamento é julgamento, não erro',
};

/**
 * Roda tudo. Regra que estourar não derruba as outras: o erro vira achado.
 * @param {object} sys  coleções de system/data, cada uma um array de docs com `id`
 * @returns {{regras: Array, total: number, graves: number}}
 */
export function auditar(sys = {}) {
    const regras = REGRAS.map(r => {
        let achados;
        try { achados = r.rodar(sys) || []; }
        catch (e) {
            return { ...r, quebrou: String(e && e.message || e), achados: [] };
        }
        return { ...r, achados };
    });
    const total = regras.reduce((n, r) => n + r.achados.length, 0);
    const graves = regras.filter(r => r.gravidade === 'grave')
        .reduce((n, r) => n + r.achados.length, 0);
    return { regras, total, graves };
}
