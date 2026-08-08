/**
 * RÉGUA DE CONTROLE E SUPORTE — só leitura, não grava nada.
 *
 * 96% das 109 magias não têm dado de dano. Este script converte o que elas
 * fazem para uma moeda única e compara com o que custam.
 *
 * ═══ LINHA DE BASE (derivada do banco, §6.3–6.5) ═══
 *   guerreiro Q0: Alvo 7 · P(acerto) 0,70 · P(dano entra) 0,53
 *   dano líquido 6,5 → DPR 3,445 · Vitalidade 18 → combate de 5 rodadas
 *
 *   1 UNIDADE = 3,445 = o que um guerreiro entrega em 1 rodada.
 *
 * ═══ PREMISSAS DECLARADAS ═══
 *  1. Efeito em INIMIGO passa por dois testes (o seu e a defesa dele): P=0,53.
 *     Efeito em ALIADO ou em si mesmo passa só pelo seu: P=0,70. Suporte é 32%
 *     mais confiável que ataque, e a régua tem que refletir isso.
 *  2. Duração além da cena não rende mais EM COMBATE. Buff de 1 dia é capado em
 *     5 rodadas. O valor fora de combate é real e esta régua não o mede.
 *  3. 1 Energia compra 1,00 unidade — ancorado na magia de dano de 1 Energia,
 *     que entrega exatamente uma rodada de guerreiro por conjuração.
 *  4. Graça, Carga e Sanidade NÃO têm taxa declarada. O script deriva a taxa
 *     implícita dos próprios dados em vez de eu arbitrar um número.
 *  5. A classificação do efeito vem de regex sobre a prosa. É triagem, não
 *     veredito: o que não casar sai listado como "não classificado", nunca
 *     zerado em silêncio.
 *
 *   node functions/audit-regua-controle.mjs
 *   node functions/audit-regua-controle.mjs --naoclassificadas
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

/* ═══ A RÉGUA ═══ */
const DPR_BASE = 3.445, P_INIMIGO = 0.53, P_ALIADO = 0.70, RODADAS_CENA = 5;

/** Preço em unidades de cada efeito, por rodada em que ele vale. */
export const TAXA = {
    dano:       1 / DPR_BASE,           // 1 ponto de dano
    cura:       1 / DPR_BASE,           // 1 ponto curado = 1 de dano desfeito
    blindagem:  P_INIMIGO / DPR_BASE,   // +1 Blindagem só rende no golpe que entra
    alvo:       0.585 / DPR_BASE,       // ±1 no Alvo move o DPR em 0,585
    acaoNegada: 1,                      // 1 turno roubado = 1 rodada de DPR
    /* Desprevenido: §6.4 diz que quem não sabe que está sendo atacado NÃO rola
       defesa. O golpe deixa de precisar dos dois testes e passa a precisar de um:
       0,70 × 6,5 = 4,55 contra 0,53 × 6,5 = 3,445. A diferença é o preço. */
    desprevenido: (P_ALIADO - P_INIMIGO) * 6.5 / DPR_BASE,
    /* Reposicionar de graça vale a Ação de Movimento, que não é a Padrão de onde
       sai o dano. ÂNCORA A CONFIRMAR: 1/3 do turno (Padrão + Movimento + Livre). */
    reposicionar: 1 / 3,
    /* Desarmar: o alvo gasta uma ação para recuperar a arma. Vale a ação. */
    desarme:    1,
};

/** A regra da casa: custo × efeito tem que fechar em 1:1 ou melhor. */
export const RAZAO_MINIMA = 1.00;

/**
 * Preço das condições, medido pela branch `condicoes` contra esta mesma régua.
 * `porRodada` distingue as que valem enquanto duram das que valem uma vez.
 * Conferido de forma independente: Atordoado 1,32 = 1,00 (turno roubado) + 0,32
 * (sem Reação, a taxa de desprevenido do §1.1). Bate.
 */
/**
 * As condições vêm do banco (`system/data/conditions`), não daqui. O valor está
 * declarado na descrição de cada uma — a frente de condições mede contra esta
 * mesma régua, então ler de lá mantém as duas em sincronia sozinhas.
 *
 * Três não declaram valor e são conhecidas por decisão, não por conta:
 *   Agarrado  troca 1:1 (rouba uma ação, custa uma ao agarrador) → líquido 0
 *   Surdo     ~0 em combate; é economia de cena
 *   Exaustão  trilha de dias, fora do escopo de combate
 */
export const SEM_VALOR_DECLARADO = {
    /* Agarrado NÃO é troca 1:1. O alvo perde o TURNO INTEIRO — Ação Padrão
       (1,00) e Ação de Movimento (0,33), já que Deslocamento vai a zero e a
       única ação disponível é tentar escapar. O agarrador paga apenas a Ação
       Padrão (1,00), e mantém a dele de Movimento.
           roubado 1,33  −  pago 1,00  =  +0,33 por rodada
       ⚠ `CONDICOES.md` registra "1,00 roubado por 1,00 pago" (líquido zero).
       Divergência real entre as duas frentes: lá o roubo é só a Padrão, aqui é
       o turno. Vale alinhar — foi o que fazia Imobilizar medir 0,00×. */
    Agarrado: 0.33,
    Surdo: 0,        // ~0 em combate; é economia de cena
    'Exaustão': 0,   // trilha de dias, fora do escopo de combate
};
/** Agarrado rende enquanto durar, não uma vez. */
const POR_RODADA_FORCADO = new Set(['Agarrado']);

export function lerCondicoes(docs) {
    const mapa = {};
    for (const c of docs) {
        const nome = String(c.nome || '').trim();
        if (!nome) continue;
        const d = String(c.descricao || '').replace(/\s+/g, ' ');
        const m = /([\d]+[,.][\d]+)\s*(un|unidade)/i.exec(d);
        const un = m ? parseFloat(m[1].replace(',', '.')) : SEM_VALOR_DECLARADO[nome];
        if (un == null) continue;
        /* A condição declara a PRÓPRIA duração. Quando a habilidade não diz
           quanto dura, é essa que vale — "enquanto o agarrador pagar" é a cena,
           não uma rodada. Sem isso, condição sustentada valia um quinto. */
        /* TRILHAS: a descrição declara o topo primeiro e depois os degraus, no
           formato "Nível 2 vale 1,00 ... nível 1 vale 0,10". Sem ler isso, quem
           aplica Acelerado 1 é medido como Acelerado 3 — 14× a mais. */
        const porNivel = {};
        for (const g of d.matchAll(/n[íi]vel\s*(\d)\s*(?:vale|=)\s*([\d]+[,.][\d]+)/gi)) {
            porNivel[+g[1]] = parseFloat(g[2].replace(',', '.'));
        }
        const topo = /(?:no|do)\s+n[íi]vel\s*(\d)/i.exec(d);
        if (topo && Object.keys(porNivel).length) porNivel[+topo[1]] = un;
        mapa[nome] = {
            un,
            porRodada: POR_RODADA_FORCADO.has(nome) || /un\/rod|unidades?\s*\/\s*rodada|por rodada/i.test(d),
            rodadas: duracaoEmRodadas(String(c.duracao || '')),
            ...(Object.keys(porNivel).length ? { porNivel } : {}),
        };
    }
    return mapa;
}
/** Preenchido na leitura do banco, logo abaixo. */
export let VALOR_CONDICAO = {};

/**
 * Uma magia tem TRÊS eixos, não um: magnitude × duração × alvos. Jogar todo o
 * buraco na magnitude é o que produzia prescrições absurdas ("+10 no Alvo").
 * Esta função procura o conserto mais barato em cada eixo, e a combinação
 * equilibrada — e diz quando um eixo sozinho não alcança.
 *
 * A duração tem teto: além da cena (5 rodadas) não rende mais em combate.
 */
export function prescrever({ unidades, esperado, alvos = 1, rodadas = 1 }) {
    if (unidades <= 0) return ['sem efeito medível — precisa de número na descrição'];
    const f = esperado / unidades;            // fator que falta
    const out = [];

    const porDuracao = Math.ceil(rodadas * f);
    if (porDuracao <= RODADAS_CENA) out.push(`só duração: ${rodadas} → ${porDuracao} rodada(s)` + (porDuracao >= RODADAS_CENA ? ' (a cena inteira)' : ''));
    else out.push(`só duração NÃO alcança (precisaria de ${porDuracao} rodadas, o teto é ${RODADAS_CENA})`);

    out.push(`só alvos: ${alvos} → ${Math.ceil(alvos * f)}`);
    out.push(`só magnitude: ×${f.toFixed(1)} no número do efeito`);

    /* Combinação equilibrada: reparte o fator entre os eixos que ainda têm folga,
       porque dobrar duas coisas pouco é mais palatável na mesa que quadruplicar uma. */
    const folgaDur = RODADAS_CENA / rodadas;
    const durAlvo = Math.min(folgaDur, Math.sqrt(f));
    const restante = f / durAlvo;
    if (durAlvo > 1.05 && restante > 1.05) {
        out.push(`COMBINADO: duração ${rodadas} → ${Math.ceil(rodadas * durAlvo)} rodada(s)  +  alvos ${alvos} → ${Math.ceil(alvos * restante)}`);
    }
    return out;
}

/**
 * Um bônus que só vale numa fatia dos testes não vale o mesmo que um universal.
 * "+2 no Alvo" vale 0,170 por rodada porque assume que TODA rodada usa. Se só
 * vale em testes de uma perícia, ou só contra um tipo de inimigo, vale a fração
 * das rodadas em que a condição acontece.
 *
 * Sem isso, um bônus estreito e longo estoura a régua: uma zona que dá "+2 em
 * testes de Pallomancia por 1 dia" aparecia valendo cinco vezes o que custa.
 *
 * ÂNCORAS A CONFIRMAR — estimativas de frequência de mesa, não derivadas.
 */
export function fatorCondicional(clausula) {
    const s = String(clausula || '').toLowerCase();
    const regras = [
        [/social|moral|persuas|intimidaç|etiqueta/, 0.10],
        [/de (pallomancia|hemomancia|abismancia|runomancia|sonoromancia|totemancia|alquimancia)/, 0.20],
        [/de (percepção|furtividade|atletismo|vig|aut|for|des|int|rac|prs|pre|man)\b/, 0.25],
        [/contra (necrótic|abissal|mortos-vivos|espírit)/, 0.30],
        [/ataque|acerto|todos os testes|de todos/, 1.00],
    ];
    const casam = regras.filter(([re]) => re.test(s)).map(([, v]) => v);
    /* A cláusula MAIS AMPLA manda: "Percepção e Ataque" vale por Ataque, não por
       Percepção — o bônus está disponível nas duas situações, não só na estreita. */
    return casam.length ? Math.max(...casam) : 1.00;
}

/**
 * P(o golpe entra) para um Alvo de ataque, contra o defensor de referência
 * (Reação + perícia = 5). Convolução exata sobre os 10 resultados do d10, com o
 * piso de 10% do crítico natural na defesa. Mesma conta do §0.1.
 */
export function pEntra(alvoAtaque, alvoDefesaBase = 5) {
    let soma = 0;
    for (let r = 1; r <= Math.min(alvoAtaque, 9); r++) {
        const graus = alvoAtaque - r;
        const escapa = Math.max(0.1, Math.min(Math.max(alvoDefesaBase - graus, 0), 9) / 10);
        soma += 1 - escapa;
    }
    return soma / 10;
}

/** Rodadas em que o efeito vale, capadas na cena. */
export function duracaoEmRodadas(txt) {
    const s = String(txt || '').toLowerCase();
    if (/permanente|1 dia|por dia|até remover/.test(s)) return RODADAS_CENA;
    /* "Enquanto tocar" e "até o fim da cena" são a cena inteira; sem isso as
       canções sustentadas do Bardo valiam 1 rodada. */
    /* Qualquer "enquanto ..." é sustentação e vale a cena: "enquanto tocar",
       "enquanto o agarrador pagar", "enquanto mantiver". */
    if (/cena|\benquanto\b|manter ritmo|sustentad|at[ée] (levantar|escapar|ser removid)/.test(s)) return RODADAS_CENA;
    if (/instant[âa]neo/.test(s)) return 1;
    const min = /(\d+)\s*min/.exec(s);
    if (min) return RODADAS_CENA;
    /* "Graus de Sucesso = turnos" é duração variável. A média de Graus no par de
       referência (Alvo 7) é 3, então a duração esperada é 3 rodadas. */
    if (/graus? de sucesso\s*=\s*(turnos|rodadas)|(\d+\s*)?(turno|rodada)s?\s*por\s*grau/i.test(s)) return 3;
    const t = /(\d+)\s*(turno|rodada)/.exec(s);
    if (t) return Math.min(parseInt(t[1], 10), RODADAS_CENA);
    return 1;
}

/** Efeitos achados na prosa → unidades entregues. */
/**
 * Campos tipados mandam sobre a prosa. Foram criados no passo 7 exatamente para
 * a régua parar de adivinhar — usá-los é o ponto. Prosa é fallback.
 */
/**
 * `formaArea` diz o DESENHO, não a quem a área pega — e isso muda a contagem:
 * área sobre aliados alcança o grupo (4), sobre inimigos a média de mesa (3).
 * Sem o texto para desempatar, círculo valia 3 para todo mundo e canções de
 * buff perdiam um quarto do valor sem que nada nelas tivesse mudado.
 */
export function alvosDeTipado(t, texto = '') {
    if (!t) return null;
    if (Number.isFinite(t.alvosMax)) return t.alvosMax;
    if (t.formaArea && t.formaArea !== 'nenhuma') {
        return /aliad|do grupo|companheir/i.test(String(texto)) ? 4 : 3;
    }
    return null;
}
export function rodadasDeTipado(t) {
    if (!t?.duracaoUnidade) return null;
    if (t.duracaoUnidade === 'instantaneo') return 1;
    if (['cena', 'sustentada', 'permanente', 'dia'].includes(t.duracaoUnidade)) return RODADAS_CENA;
    /* `turno` sem valor é duração VARIÁVEL — quase sempre "Graus de Sucesso =
       turnos". Os Graus médios no par de referência são 3, não 1. Tratar como 1
       corta a magia em dois terços sem que nada nela seja curto. */
    if (t.duracaoUnidade === 'turno') return Math.min(t.duracaoValor ?? 3, RODADAS_CENA);
    return null;
}

export function medirEfeito(texto, duracaoTxt, tipados) {
    /* Corta tudo a partir de "Falha:" / "Consequência:" — vários textos trazem o
       que acontece quando o teste FALHA no mesmo campo do efeito, e medir isso
       conta como entrega o que na verdade é punição. */
    /* CUIDADO: "Falha:" no INÍCIO de um trecho é o que acontece quando o
       CONJURADOR falha — punição, não entrega. Mas "se falha:" no meio da frase
       é o ALVO falhando na resistência, e aí é o efeito normal da magia. Cortar
       os dois decapita toda magia baseada em teste de resistência. */
    /* Onde cortar o "Falha:". A regra não é a posição na frase — é se existe um
       TESTE DE RESISTÊNCIA antes dele. Havendo teste, a falha é do ALVO e o que
       vem depois é o efeito normal da magia ("VIG vs GS. Falha: Atordoado").
       Sem teste, a falha é do conjurador e é punição, que não se mede como
       entrega. Cortar sempre decapita toda magia baseada em resistência. */
    const bruto = String(texto || '');
    const temResistencia = /\b(testa|testam|teste de|vs|contra)\s+[\w\s+:]{0,20}\b(gs|graus|percepção|aut|vig|prs|for|des|int|rac|pre|man)\b/i.test(bruto);
    const s = temResistencia ? bruto
        : bruto.split(/(?:^|[.;]\s*)(?:Falha(?:\s+Crítica)?|Consequência)\s*:/i)[0];
    const rod = rodadasDeTipado(tipados) ?? duracaoEmRodadas(duracaoTxt || s);
    const achados = [];
    let u = 0;

    const dado = /(\d*)d(\d+)\s*([+-]\s*\d+)?/i.exec(s);
    if (dado) {
        /* Contador variável: "(Composição)d4" e "(PRE + Composição)d6" são N
           dados, não um. Sem isso a magia inteira é medida por um dado só. O
           valor típico de perícia/atributo na faixa útil é 3. */
        const antesDoDado = s.slice(0, dado.index);
        const varDados = /\(([^)]+)\)\s*$/.exec(antesDoDado);
        const nVar = varDados && !/^\s*\d+\s*$/.test(varDados[1])
            ? (varDados[1].split('+').length * 3) : null;
        const n = nVar ?? parseInt(dado[1] || '1', 10);
        const f = parseInt(dado[2], 10);
        const mod = dado[3] ? parseInt(dado[3].replace(/\s/g, ''), 10) : 0;
        const media = n * (f + 1) / 2 + mod;
        if (nVar) achados.push(`(${varDados[1]}) ≈ ${nVar} dados`);
        u += media * TAXA.dano * P_INIMIGO / P_INIMIGO; achados.push(`dano ${dado[0]}=${media}`);
    }
    /* Devolver RECURSO vale a taxa do recurso, não a da cura: 1 Energia
       restaurada é 1,00 unidade pela própria âncora do sistema. Confundir os
       dois subconta a magia em 3,4×. */
    const RECURSOS = 'Energia|ENER|DET|Graça|Carga|Sanidade|SAN';
    /* "recuperam 1 de Energia" — o "de" entre o número e o recurso é natural em
       português e fazia a devolução passar em branco. */
    const recurso = new RegExp(`(?:restaura|devolve|recupera)\\w*\\D{0,15}?(\\d+)\\s*(?:de\\s+)?(${RECURSOS})`, 'i').exec(s);
    if (recurso) { const n = +recurso[1]; u += n * (P_ALIADO / P_INIMIGO); achados.push(`+${n} ${recurso[2]}`); }

    /* DRENAR recurso do inimigo vale o mesmo que devolver a um aliado: tirar 1
       Energia é negar 1 unidade de conjuração. Faltava, e era o que fazia o
       Acorde Debilitante parecer fraco. */
    const drena = new RegExp(`perde(?:m)?\\s+(\\d+)\\s*(?:de\\s+)?(${RECURSOS})`, 'i').exec(s);
    if (drena) { const n = +drena[1]; u += n; achados.push(`-${n} ${drena[2]} do alvo`); }
    /* "perdem toda a DET" — o pool inteiro. Energia = PRS + AUT, típico 7. */
    if (new RegExp(`perde(?:m)?\\s+tod[ao]\\s+a?\\s*(${RECURSOS})`, 'i').test(s)) {
        u += 7; achados.push('-pool inteiro de recurso');
    }

    const cura = /(?:cura|restaura|recupera|regenera)\D{0,20}(\d+)\s*(?:de\s+)?(?:Vitalidade|PV)?/i.exec(s);
    if (cura && !recurso) { const n = +cura[1]; u += n * TAXA.cura * (P_ALIADO / P_INIMIGO); achados.push(`cura ${n}`); }

    const blind = /\+\s*(\d+)\s*(?:de\s+)?blindagem/i.exec(s);
    if (blind) { const n = +blind[1]; u += n * TAXA.blindagem * rod * (P_ALIADO / P_INIMIGO); achados.push(`+${n} Blind ×${rod}r`); }

    /* TODOS os modificadores de Alvo da frase, não só o primeiro: "inimigos −1 e
       aliados +1" são dois efeitos, e contar um só corta a magia pela metade.
       Cada um leva o desconto de condicionalidade da sua própria cláusula. */
    /* O qualificador tanto pode vir depois ("no Alvo de testes de X") quanto
       antes ("Todo teste de X tem +2 no Alvo"). Olha a FRASE inteira. */
    for (const m of s.matchAll(/([+-])\s*(\d+)\s*(?:no|de|em)\s+alvo/gi)) {
        const ini = s.lastIndexOf('.', m.index) + 1;
        const fim = s.indexOf('.', m.index);
        const frase = s.slice(ini, fim === -1 ? undefined : fim);
        /* Penalidade que o atacante aceita em si mesmo (Golpe Giratório: "ataca
           todos os adjacentes, -2 no Alvo") não é debuff — é preço. Contar como
           benefício inverte o sinal do que a manobra faz. */
        if (m[1] === '-' && /\batac\w+\b|\bseu ataque\b|\bneste ataque\b/i.test(frase) && !/inimigo|alvo recebe|sofrem/i.test(frase)) {
            achados.push(`(-${m[2]} Alvo é preço do atacante, não conta)`);
            continue;
        }
        const n = +m[2], cond = fatorCondicional(frase);
        u += n * TAXA.alvo * rod * cond;
        achados.push(`${m[1]}${n} Alvo ×${rod}r${cond < 1 ? ` ×${cond} cond.` : ''}`);
    }

    /* CONDIÇÕES NOMEADAS — valores da tabela cadastrada (branch `condicoes`),
       não mais regex adivinhando "atordoado". Se a habilidade declarar Chance,
       o valor entra descontado: (Chance ÷ 10) × valor cheio. */
    /* `condicoesAplicadas` é a declaração do item e MANDA sobre o texto: traz a
       condição, o portão (chance/resistência) e — desde o refino — `alvos` e
       `rodadas` PRÓPRIOS. Isso conserta a magia de dano instantâneo com condição
       que dura: o item declara duração 0, mas o Prostrado do Marcha custa uma
       ação para levantar. Ler a duração do item ali dava zero. */
    const declaradas = Array.isArray(tipados?.condicoesAplicadas) ? tipados.condicoesAplicadas : [];
    /* Declarar VAZIO é declarar: "esta habilidade não aplica condição nenhuma".
       Sem isso, nomear as condições que a magia REMOVE ("remove 1 condição
       mental: Amedrontado, Ofuscado ou Cego") faz a régua cobrar por aplicá-las
       — a Luz da Vontade saltou para 5,30× só por trocar apelido por nome. */
    const declarouVazio = Array.isArray(tipados?.condicoesAplicadas) && !declaradas.length;
    let uCondPropria = 0;   /* condição com alvos próprios: fora do ×alvos global */
    for (const [nome, valor] of Object.entries(VALOR_CONDICAO)) {
        const decl = declaradas.find(x => x.condicao === nome);
        if (!decl && declarouVazio) continue;
        if (!decl && !new RegExp(`\\b${nome}`, 'i').test(s)) continue;
        /* Rede de segurança para quem ainda não declarou o campo: condição
           citada logo depois de "remove/dissipa/imune" é o que sai, não o que entra. */
        if (!decl && new RegExp(`(?:remove|dissipa|encerra|imune a|protege contra)\\b[^.;]{0,60}\\b${nome}`, 'i').test(s)) continue;
        const c = /chance\s*(\d+)/i.exec(s);
        const chance = (decl?.portao === 'chance' && decl.chance != null)
            ? Math.min(10, decl.chance) / 10
            : (c ? Math.min(10, +c[1]) / 10 : 1);
        /* TRILHAS (Congelamento, Acelerado, Exaustão) declaram o nível MAIS
           ALTO na descrição de propósito — errar para cima faz a régua reclamar,
           errar para baixo passa calado. Quem aplica nível menor declara
           `nivel`, e o valor daquele degrau sai da própria descrição. */
        const un = (decl?.nivel != null && valor.porNivel?.[decl.nivel] != null)
            ? valor.porNivel[decl.nivel] : valor.un;
        /* Duração: a declarada na condição manda; depois a da habilidade; por
           último a que a própria condição traz do banco. */
        const rodCond = decl?.rodadas ?? (tipados?.duracaoUnidade ? rod : (valor.rodadas ?? rod));
        const v = valor.porRodada ? un * Math.min(rodCond, RODADAS_CENA) : un;
        const bruto = v * chance;
        if (decl?.alvos != null) { uCondPropria += bruto * decl.alvos; }
        else { u += bruto; }
        achados.push(`${nome}${decl?.nivel != null ? ` Nv${decl.nivel}` : ''} ${valor.porRodada ? `×${Math.min(rodCond, RODADAS_CENA)}r ` : ''}${decl?.alvos > 1 ? `×${decl.alvos}alv ` : ''}= ${(bruto * (decl?.alvos ?? 1)).toFixed(2)}${chance < 1 ? ` (C${(chance * 10).toFixed(0)})` : ''}`);
    }
    /* ── CATEGORIAS QUE A RÉGUA TINHA TAXA E NÃO ACIONAVA ──────────────────
       As taxas de Desarme e Reposicionar existem em TAXA desde o início e
       nenhum texto as disparava: o Desarme do Guerreiro media zero tendo uma
       taxa de 1,000 esperando por ele. */
    if (/\ba arma d[oa] alvo cai|desarma(?:r|do)?\b|toma a arma/i.test(s)) {
        u += TAXA.desarme; achados.push('desarme');
    }
    /* Mover-se sem comer o ataque de oportunidade é o reposicionamento de
       graça — a âncora de 1/3 de turno da §1.1. */
    /* `[^.;]` não servia: "D. Terrestre" tem ponto no meio e cortava a busca
       antes de chegar ao "sem provocar". */
    if (/(?:mov[ea]|desloca|recua|retira|teleporta)\w*[^;]{0,60}sem provocar/i.test(s)) {
        u += TAXA.reposicionar; achados.push('reposicionar de graça');
    }
    /* Sair sem levar o ataque de oportunidade NEGA um ataque inimigo — coisa
       diferente de só se mover, e é o que a taxa de reposicionar (1/3, e ainda
       "a confirmar") não cobre. Vale uma ação negada, descontada por só valer
       quando o inimigo teria mesmo revidado. */
    if (/sem provocar[^.;]{0,30}(?:contra-?ataque|rea[çc][ãa]o|ataque)/i.test(s)) {
        u += TAXA.acaoNegada * 0.5; achados.push('nega o contra-ataque');
    }
    /* Mover normalmente derruba a sua Reação; preservá-la é manter a defesa. */
    if (/sem reduzir a Rea[çc][ãa]o/i.test(s)) {
        u += TAXA.alvo; achados.push('mantém a Reação');
    }
    /* Dano FIXO, sem dado: "1 de dano sônico". O parser de dados não vê, e
       era o que deixava a Nota Penetrante inteira em branco. */
    if (!dado) {
        const fixo = /(\d+)\s+de\s+dano/i.exec(s);
        if (fixo) { const n = +fixo[1]; u += n * TAXA.dano; achados.push(`dano fixo ${n}`); }
    }
    /* Reação é a rolagem de defesa: −1 nela é −1 no Alvo daquele teste. Mesma
       taxa, sem inventar categoria nova. */
    const reacao = /([+-])\s*(\d+)\s*(?:na |de |a )?Rea[çc][ãa]o/i.exec(s);
    if (reacao) { u += +reacao[2] * TAXA.alvo * rod; achados.push(`${reacao[1]}${reacao[2]} Reação ×${rod}r`); }
    /* Modificador escrito SEM a palavra "Alvo": "+1 em testes relacionados",
       "−1 em Percepção auditiva". É modificador do Alvo daqueles testes, e leva
       o desconto de cláusula estreita como qualquer outro (§1.4). */
    const emTestes = /([+-])\s*(\d+)\s+em\s+(testes[^.;,]{0,25}|(?:Percep|Atlet|Furtiv|Briga|Pontar|Vigor|Vontade|Persua|Intimid|Etiquet|Fluxom|Medicin|Sobreviv)\w*[^.;,]{0,20})/i.exec(s);
    if (emTestes) {
        /* fatorCondicional espera a cláusula na forma "de <perícia>"; sem o
           prefixo, "Percepção auditiva" caía no default 1,00 e a Nota
           Penetrante ia a 3,42× por um −1 que só vale para ouvir. */
        const f = fatorCondicional('de ' + emTestes[3]);
        u += +emTestes[2] * TAXA.alvo * rod * f;
        achados.push(`${emTestes[1]}${emTestes[2]} em ${emTestes[3].trim().slice(0, 22)} ×${rod}r${f < 1 ? ` ×${f} cond.` : ''}`);
    }

    /* Ação negada genérica, para o que não tem nome de condição. */
    if (!/atordoad/i.test(s) && /paralis|imobiliz|não pode agir|perde a (próxima )?a[çc][ãa]o/i.test(s)) {
        u += TAXA.acaoNegada * Math.min(rod, RODADAS_CENA); achados.push(`ação negada ×${Math.min(rod, RODADAS_CENA)}r`);
    }
    /* Modificador de dano: +N de dano por golpe, enquanto durar. */
    const dmg = /\+\s*(\d+)\s*(?:de\s+)?dano/i.exec(s);
    if (dmg) { const n = +dmg[1]; u += n * TAXA.dano * rod; achados.push(`+${n} dano ×${rod}r`); }
    /* Absorver os primeiros N pontos de CADA ataque é blindagem por golpe, não
       por rodada: previne N em todo golpe que entra, enquanto durar. */
    const absorve = /absorve\D{0,20}(\d+)\s*(?:pontos?\s*)?(?:de\s+)?dano/i.exec(s);
    if (absorve) {
        const n = +absorve[1];
        u += n * TAXA.dano * P_INIMIGO * rod * (P_ALIADO / P_INIMIGO);
        achados.push(`absorve ${n}/golpe ×${rod}r`);
    }
    /* Dado multiplicado por contador: "(Cargas gastas + 1) agulhas ... 1d4+1".
       Sem isso o dado é contado uma vez só. Usa 3 como valor típico do contador. */
    const varios = /\((?:\w+\s*)+(?:\+\s*\d+)?\)\s*(agulhas|proj[ée]teis|dardos|c[óo]pias|membros)/i.exec(s);
    if (varios && dado) {
        const extra = 3 - 1;    // contador típico 3, o primeiro já foi contado
        const media = /(\d*)d(\d+)\s*([+-]\s*\d+)?/i.exec(s);
        const mv = parseInt(media[1] || '1', 10) * (parseInt(media[2], 10) + 1) / 2
            + (media[3] ? parseInt(media[3].replace(/\s/g, ''), 10) : 0);
        u += extra * mv * TAXA.dano;
        achados.push(`×${extra + 1} ${varios[1]}`);
    }
    /* Negar defesa vale a Blindagem que deixa de subtrair (referência 2). */
    if (/ignora(?:r|ndo)?\s+(?:a\s+)?(blindagem|reação|defesa)/i.test(s)) {
        u += 2 * TAXA.dano * rod; achados.push(`ignora defesa ×${rod}r`);
    }
    /* Atacar quem não pode reagir — §6.4: sem defesa, o golpe só precisa acertar. */
    if (/desprevenid|surpres|sem que perceba|não sabe que|pelas costas|furtiv|sorrateir|não pode (se )?defender|sem reação/i.test(s)) {
        u += TAXA.desprevenido; achados.push('desprevenido');
    }
    /* Movimento de graça / movimento extra. */
    if (/move-se|movimenta-se|desloca-se|sem gastar (a )?ação de movimento|movimento (extra|adicional|grátis|gratuito)|reposiciona/i.test(s)) {
        u += TAXA.reposicionar; achados.push('reposiciona');
    }
    /* Desarmar / tomar o item da mão. */
    if (/desarma|derruba a arma|solta a arma|perde a arma/i.test(s)) {
        u += TAXA.desarme; achados.push('desarme');
    }
    /* MULTI-ATAQUE — "ataca todos os adjacentes" faz N ataques no lugar de 1.
       O ganho é (N − 1) ataques, descontada a penalidade que a manobra impõe. */
    const multi = /atac[ao]\s+(?:contra\s+)?todos os inimigos|golpeia todos/i.test(s);
    if (multi) {
        const pen = /-\s*(\d+)\s*(?:no|de|em)\s+alvo/i.exec(s);
        const alvoAtaque = 7 - (pen ? +pen[1] : 0);
        const dprComPen = pEntra(alvoAtaque) * 6.5;
        const extras = (multiplicadorAlvos(s) - 1) * dprComPen / DPR_BASE;
        /* o primeiro ataque substitui o que você faria de qualquer jeito */
        const perdaNoPrimeiro = (DPR_BASE - dprComPen) / DPR_BASE;
        u += extras - perdaNoPrimeiro;
        achados.push(`multi-ataque: +${(multiplicadorAlvos(s) - 1)} alvos a Alvo ${alvoAtaque} = ${(extras - perdaNoPrimeiro).toFixed(2)}`);
    }
    /* AÇÃO EXTRA — a coisa mais cara do jogo. Uma ação a mais por turno é uma
       rodada inteira de DPR a mais, por rodada que durar. */
    /* "gratuita"/"livre" faltavam: o Ladino executa Furto "como ação gratuita"
       e a manobra media zero — a coisa mais cara do jogo, em branco. */
    /* "Se matar um inimigo: +1 ação" não tinha a palavra extra/adicional e
       passava em branco — a coisa mais cara do jogo, invisível na Cólera. */
    const acaoExtra = /\+\s*(\d+)\s*a[çc][ãa]o|\+?\s*(\d+)?\s*a[çc][ãa]o (adicional|extra|gratuita|livre)|ganha(?:r)? (\d+ )?a[çc][ãa]o/i.exec(s);
    if (acaoExtra) { const n = +(acaoExtra[1] || acaoExtra[2] || 1); u += n * TAXA.acaoNegada * rod; achados.push(`+${n} ação ×${rod}r`); }
    /* CONTRA-ATAQUE — um ataque a mais, disparado por gatilho do inimigo.
       Vale uma rodada de DPR (1,000), mas só acontece quando o gatilho ocorre:
       o inimigo errar é ~30% no par de referência, matar é menos. Metade, por
       ser gatilho e não escolha. */
    if (/contra-?ataque|contra-?atacar/i.test(s) && !/sem provocar contra-?ataque/i.test(s)) {
        u += TAXA.acaoNegada * 0.5; achados.push('contra-ataque (gatilho)');
    }
    /* Devolver dano: metade do que entrou (~6,5 líquido) é ~3,2 de dano, e
       ainda depende de passar num teste. Metade, mesma lógica do gatilho. */
    if (/(?:cause|causa|devolve|reflete)\w*\s+metade do dano/i.test(s)) {
        u += 6.5 / 2 * TAXA.dano * 0.5; achados.push('reflete metade do dano (gatilho)');
    }
    /* Roubar ação por turno é o espelho: mesma taxa, sinal trocado. */
    const acaoPerdida = /perde(?:m)?\s+(\d+)\s+a[çc][ãa]o(?:\/|\s+por\s+)turno/i.exec(s);
    if (acaoPerdida) { const n = +acaoPerdida[1]; u += n * TAXA.acaoNegada * rod; achados.push(`-${n} ação/turno ×${rod}r`); }
    /* "Alvo = + Perícia" soma a perícia inteira no Alvo. Perícia treinada ~3. */
    if (/alvo\s*=\s*\+\s*(?:sua\s+)?(?:perícia|precisão|furtividade|\w+)/i.test(s)) {
        u += 3 * TAXA.alvo * rod; achados.push(`Alvo += perícia (~3) ×${rod}r`);
    }
    /* Ignorar a Reação é ignorar a defesa inteira, não só a Blindagem. */
    if (/ignora(?:r)?\s+(?:a\s+)?rea[çc][ãa]o/i.test(s)) { u += TAXA.desprevenido; achados.push('ignora Reação'); }
    /* Dano escalonado por Grau: Graus médios = 3 no par de referência. */
    const porGrau = /\+\s*(\d+)\s*(?:de\s+)?dano\s+por\s+grau/i.exec(s);
    if (porGrau) { const n = +porGrau[1]; u += n * 3 * TAXA.dano; achados.push(`+${n} dano/Grau (~3)`); }

    /* MULTIPLICADOR DE ALVOS — o efeito vale por cabeça atingida. Sem isso,
       "golpeia todos em volta" era medido como se pegasse um só. */
    const alvos = alvosDeTipado(tipados, s) ?? multiplicadorAlvos(s);
    if (alvos > 1 && u > 0) { u *= alvos; achados.push(`×${alvos} alvos`); }
    u += uCondPropria;   /* já multiplicado pelos alvos DELA */
    return { unidades: u, achados, alvos, rodadas: rod };
}

/** Quantos alvos o efeito pega. Grade quadrada: "em volta" = 8 adjacentes, mas
 *  a média de mesa é ~3 encostados. Grupo = 4. Números conservadores de
 *  propósito: superestimar alvo infla toda magia de área. */
export function multiplicadorAlvos(txt) {
    const s = String(txt || '').toLowerCase();
    /* "Até N alvos" é explícito e manda. */
    const ate = /at[ée]\s+(\d+)\s+alvos?/.exec(s);
    if (ate) return +ate[1];
    /* Grupo de aliados: 4 é o tamanho da mesa. */
    if (/todos (os )?(aliados|do grupo)|o grupo|aliados\s+(em|num|a)\s|todos em volta/.test(s)) return 4;
    /* Área de efeito. "Aliados/Inimigos em 6m", cone, explosão, zona — nenhum
       desses traz a palavra "raio", e era por isso que passavam como alvo único. */
    /* "Inimigos <qualquer coisa>" no plural já é área — não exige a preposição. */
    if (/\binimigos\b|em área|na área|em um raio|num raio|raio de|cone de|explos[ãa]o de|zona de/.test(s)) return 3;
    if (/em volta|ao redor|adjacent/.test(s)) return 3;
    return 1;
}

/* ═══ ASSERTS ═══ */
assert.ok(Math.abs(TAXA.dano - 0.290) < 0.001, '1 ponto de dano = 0,290 unidade');
assert.ok(Math.abs(TAXA.blindagem - 0.154) < 0.001, '+1 Blindagem/rodada = 0,154 unidade');
assert.ok(Math.abs(TAXA.alvo - 0.170) < 0.001, '±1 Alvo/rodada = 0,170 unidade');
assert.ok(TAXA.cura > TAXA.blindagem, 'curar 1 vale mais que dar 1 Blindagem: cura sempre rende, Blindagem só no golpe que entra');
assert.equal(duracaoEmRodadas('1 cena'), 5);
assert.equal(duracaoEmRodadas('1 turno'), 1);
assert.equal(duracaoEmRodadas('10 turnos'), 5, 'duração acima da cena não rende mais em combate');
assert.equal(duracaoEmRodadas(''), 1);
/* Os asserts de condição rodam DEPOIS da leitura do banco — a tabela vem de lá. */
assert.ok(medirEfeito('nada aqui').achados.length === 0, 'prosa sem efeito medível não inventa número');
console.log('✅ 10 asserts passaram.\n');

/* ═══ LEITURA ═══ */
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const grab = async c => (await db.collection(`system/data/${c}`).get()).docs.map(d => ({ id: d.id, ...d.data() }));
const [cls, mods, mecs, conds] = await Promise.all(
    ['classes', 'classModules', 'mechanics', 'conditions'].map(grab));

/* A tabela de condições vem do banco. Se uma parar de declarar valor, o assert
   abaixo grita — em vez de a magia silenciosamente valer menos. */
VALOR_CONDICAO = lerCondicoes(conds);
const semValor = conds.map(c => c.nome).filter(n => n && VALOR_CONDICAO[n] == null);
assert.ok(Object.keys(VALOR_CONDICAO).length >= 25,
    `só ${Object.keys(VALOR_CONDICAO).length} condições resolveram valor (esperado ≥25)`);
assert.equal(VALOR_CONDICAO['Atordoado']?.un, 1.32, 'Atordoado tem que bater com o que a frente mediu');
assert.equal(VALOR_CONDICAO['Cego']?.porRodada, true, 'Cego vale por rodada');
/* Trilhas: os três degraus lidos da descrição. Sem isso, quem aplica o nível 1
   é medido pelo topo — 13× no Congelamento, 14× no Acelerado. */
for (const [t, esperado] of [['Congelamento', { 1: 0.10, 2: 1.00, 3: 1.32 }], ['Acelerado', { 1: 0.10, 2: 0.43, 3: 1.43 }]]) {
    assert.deepEqual(VALOR_CONDICAO[t]?.porNivel, esperado, `trilha ${t} mal lida`);
}
{   /* as taxas que existiam e nada acionava */
    assert.equal(medirEfeito('Sucesso: a arma do alvo cai.').unidades, TAXA.desarme, 'desarme aciona a própria taxa');
    /* Sair de perto sem levar o golpe é DUAS coisas: o movimento (1/3) e o
       ataque inimigo negado (1,000 × 0,5 por só valer quando ele revidaria). */
    {
        const r = medirEfeito('Após atacar, move até metade do D. Terrestre, sem provocar contra-ataques.');
        assert.equal(r.unidades, TAXA.reposicionar + TAXA.acaoNegada * 0.5, 'desengajar = mover + negar o contra-ataque');
        assert.equal(r.achados.length, 2, 'as duas parcelas, separadas');
    }
    assert.equal(medirEfeito('Move 3m.').unidades, 0, 'mover sozinho, sem desengajar, não vale nada aqui');
    assert.equal(medirEfeito('Executa Furto como ação gratuita.').unidades, TAXA.acaoNegada, 'ação extra vale 1,000');
    assert.ok(medirEfeito('Cone de 3m: 1 de dano sônico.').unidades > 0, 'dano fixo sem dado tem que contar');
    assert.equal(medirEfeito('1d6 de dano').achados.filter(a => /dano/.test(a)).length, 1,
        'dado e dano fixo não podem contar duas vezes');
}
{   /* remover condição não é aplicá-la — nos dois caminhos */
    const txt = 'Restaura 2 Energia a 1 aliado e remove 1 condição mental (Amedrontado, Ofuscado ou Cego).';
    assert.equal(medirEfeito(txt, '', { condicoesAplicadas: [] }).achados.some(a => /Cego|Ofuscado|Amedrontado/.test(a)), false,
        'campo declarado vazio: nenhuma condição pode ser cobrada');
    assert.equal(medirEfeito(txt).achados.some(a => /Cego|Ofuscado|Amedrontado/.test(a)), false,
        'sem o campo, "remove" ainda tem que proteger');
}
{   /* declarar nivel 1 tem que valer o degrau 1, não o topo */
    const nv1 = medirEfeito('O alvo fica Congelamento.', '', { condicoesAplicadas: [{ condicao: 'Congelamento', portao: 'resistencia', alvos: 1, rodadas: 1, nivel: 1 }] });
    const topo = medirEfeito('O alvo fica Congelamento.', '', { condicoesAplicadas: [{ condicao: 'Congelamento', portao: 'resistencia', alvos: 1, rodadas: 1 }] });
    assert.equal(Math.round(nv1.unidades * 100) / 100, 0.10, 'Congelamento Nv1 = 0,10');
    assert.equal(Math.round(topo.unidades * 100) / 100, 1.32, 'sem nivel, mede pelo topo declarado');
}
/* Agora que a tabela existe, os asserts que dependem dela. */
assert.equal(medirEfeito('Atordoado 1 turno').unidades, 1.32, 'Atordoado = turno roubado + sem Reação');
assert.equal(medirEfeito('Atordoado, Chance 5').unidades, 0.66, 'Chance 5 corta o valor pela metade');
/* A condição declarada manda sobre a duração do ITEM: dano instantâneo com
   Prostrado pendurado valia zero pelo Prostrado antes deste refino. */
{
    const item = { duracaoValor: 0, duracaoUnidade: 'instantaneo',
                   condicoesAplicadas: [{ condicao: 'Atordoado', portao: 'resistencia', alvos: 3, rodadas: 1 }] };
    const semDecl = medirEfeito('Inimigos em 6m ficam Atordoado.', '', { duracaoValor: 0, duracaoUnidade: 'instantaneo', formaArea: 'circulo' });
    const comDecl = medirEfeito('Inimigos em 6m ficam Atordoado.', '', item);
    assert.equal(Math.round(comDecl.unidades * 100) / 100, 3.96, 'Atordoado 1,32 × 3 alvos declarados');
    assert.ok(comDecl.unidades >= semDecl.unidades, 'declarar não pode valer menos que adivinhar');
    /* portão declarado vale sem o texto dizer "Chance N" */
    const comChance = medirEfeito('O alvo fica Atordoado.', '', { condicoesAplicadas: [{ condicao: 'Atordoado', portao: 'chance', chance: 5, alvos: 1, rodadas: 1 }] });
    assert.equal(comChance.unidades, 0.66, 'chance estruturada = 5 corta pela metade sem regex');
}
assert.ok(medirEfeito('Cego por 1 cena').unidades > medirEfeito('Ofuscado por 1 cena').unidades,
    'Cego vale mais que Ofuscado — escuridão total contra parcial');
if (semValor.length) console.log(`⚠ sem valor legível: ${semValor.join(', ')}`);
console.log(`📕 ${Object.keys(VALOR_CONDICAO).length} condições lidas do banco · +3 asserts.\n`);
const VER_NAO = process.argv.includes('--naoclassificadas');

const classeDo = {};
for (const c of cls) for (const e of (c.modulosDaClasse || [])) if (typeof e === 'string') classeDo[e] = c.nome;

/**
 * O campo "Custo:" carrega a LÓGICA (ou / +); os botões carregam os recursos.
 * "1D ou 1G" são duas opções de 1 ponto, não uma de 2 — somar os botões dobra o
 * preço e acusa a magia injustamente. Devolve o total da opção mais barata.
 */
export function pontosDoTexto(txt) {
    const s = String(txt || '').trim();
    if (!s) return null;
    const opcoes = s.split(/\s+ou\s+/i).map(op => {
        const nums = [...op.matchAll(/(\d+)\s*(D\b|G\b|ENER|Energia|Graça|Carga|Sanidade|SAN)/gi)];
        return nums.reduce((t, m) => t + parseInt(m[1], 10), 0);
    }).filter(v => v > 0);
    return opcoes.length ? Math.min(...opcoes) : null;
}

/** Custo real: vem da mecânica atrás do botão, não do texto. */
function custoDoBotao(ids) {
    const out = {};
    for (const id of ids) {
        const me = mecs.find(m => m.id === id);
        for (const c of (me?.config?.calculos || [])) {
            if ((c.operacao || '') !== '-') continue;
            const v = (c.equacao || []).reduce((s, t) => s + (Number(t.valor) || 0), 0);
            const rec = String(c.alvo || '').replace(/ Atual$/, '');
            out[rec] = (out[rec] || 0) + v;
        }
    }
    return out;
}

/* HABILITADORAS — nomeadas no `requer` de outra habilidade. O pagamento delas
   está lá na frente: Passos Sombrios entrega 0,32 sozinho e existe para
   destravar o Golpe pelas Costas, que entrega 2,57. Cobrar 1,00 das duas conta
   o par duas vezes e manda buffar justamente o que já está pago. */
const HABILITADORAS = new Set(mods.flatMap(m => (m.itensPredefinidos || [])
    .map(it => it.requer).filter(Boolean)));

const linhas = [];
for (const m of mods) {
    const lbl = Object.fromEntries((m.schema || []).map(f => [f.key, String(f.label || '')]));
    const botoes = (m.schema || []).filter(f => /botao/.test(f.tipo || '')).map(f => f.key);
    const kEfeito = Object.keys(lbl).find(k => /efeito|o que faz/i.test(lbl[k]));
    const kDur = Object.keys(lbl).find(k => /dura|alcance/i.test(lbl[k]));
    for (const it of (m.itensPredefinidos || [])) {
        const v = it.valores || {};
        /* `descricao` e o campo Efeito quase sempre guardam o MESMO texto. Juntar
           os dois faz cada efeito ser contado duas vezes. Fica o mais completo. */
        const partes = [String(it.descricao || '').trim(), String(v[kEfeito] || '').trim()].filter(Boolean);
        const texto = partes.length === 2 && (partes[0].includes(partes[1]) || partes[1].includes(partes[0]))
            ? partes.reduce((a, b) => (a.length >= b.length ? a : b))
            : partes.join(' ');
        const custo = custoDoBotao(botoes.map(k => v[k]).filter(Boolean));
        const kCusto = Object.keys(lbl).find(k => /^custo/i.test(lbl[k]));
        const pontosTexto = pontosDoTexto(v[kCusto]);
        /* Bardo: o nome do módulo É o custo — "Custo 2" custa 2 de Harmonia OU
           2 de Energia. Não há botão de pagar; o tier é o preço. */
        const tier = /^Custo\s+(\d+)/i.exec(String(m.titulo || ''));
        if (tier && !Object.keys(custo).length) custo['Harmonia/Energia'] = +tier[1];
        const { unidades, achados, alvos, rodadas } = medirEfeito(texto, v[kDur], it);
        linhas.push({ classe: classeDo[m.id] || '—', modulo: m.titulo || m.id, nome: it.nome || '?',
                      unidades, achados, custo, alvos, rodadas, pontosTexto });
    }
}

const preco = c => Object.entries(c).map(([r, q]) => `${q} ${r.replace('Energia', 'ENER').replace('Graça de Palla', 'Graça').replace('Bolha de Sangue', 'Carga').replace('Sanidade', 'SAN')}`).join(' + ') || '—';
const n2 = v => v.toFixed(2);

console.log('═'.repeat(78));
console.log('RÉGUA DE CONTROLE E SUPORTE — 1 unidade = 3,445 = 1 rodada de guerreiro');
console.log('═'.repeat(78));
console.log('  1 ponto de dano ....... 0,290      +1 Blindagem/rodada .... 0,154');
console.log('  1 ponto de cura ....... 0,290      ±1 no Alvo/rodada ...... 0,170');
console.log('  1 turno roubado ....... 1,000      referência: 1 Energia .. 1,000\n');

const medidas = linhas.filter(l => l.achados.length);
const mudas = linhas.filter(l => !l.achados.length);

console.log('─'.repeat(78));
console.log(`MEDIDAS (${medidas.length} de ${linhas.length}) — entrega × preço`);
console.log('─'.repeat(78));
console.log('  classe          magia                       entrega  custo            veredito');
const foraDaFaixa = [];
for (const l of medidas.sort((a, b) => b.unidades - a.unidades)) {
    /* Todo recurso vale 1 unidade por ponto até prova em contrário. Assumir 1
       quando NÃO se leu custo nenhum era o erro da primeira versão: precificava
       uma magia de 4 Cargas como se custasse 1 Energia. */
    /* O texto manda quando existe: ele diz se os recursos são alternativos. */
    const pontos = l.pontosTexto ?? Object.values(l.custo).reduce((s, q) => s + q, 0);
    if (!pontos) { console.log(`  ${l.classe.slice(0, 14).padEnd(15)} ${l.nome.slice(0, 26).padEnd(27)} ${n2(l.unidades).padStart(5)}   ${'—'.padEnd(16)} ⚪ sem custo legível`); continue; }
    const esperado = pontos;
    const razao = l.unidades / esperado;
    /* Regra da casa: razão ≥ 1,00. Abaixo disso o efeito tem que subir. */
    const habilitadora = HABILITADORAS.has(l.nome);
    const ver = razao >= RAZAO_MINIMA ? '✅' : habilitadora ? '🔗 habilitadora' : '🔵 precisa subir';
    if (razao < RAZAO_MINIMA && !habilitadora) foraDaFaixa.push({ ...l, razao, esperado });
    console.log(`  ${l.classe.slice(0, 14).padEnd(15)} ${l.nome.slice(0, 26).padEnd(27)} ${n2(l.unidades).padStart(5)}   ${preco(l.custo).padEnd(16)} ${ver} ${razao.toFixed(2)}×`);
}

/* Taxa implícita dos recursos que não têm preço declarado. */
console.log('\n' + '─'.repeat(78));
console.log('TAXA IMPLÍCITA DOS RECURSOS SEM PREÇO DECLARADO');
console.log('─'.repeat(78));
for (const rec of ['Graça de Palla', 'Bolha de Sangue', 'Sanidade']) {
    const casos = medidas.filter(l => l.custo[rec]);
    if (!casos.length) { console.log(`  ${rec.padEnd(18)} sem caso medido`); continue; }
    const taxas = casos.map(l => (l.unidades - (l.custo['Energia'] || 0)) / l.custo[rec]).sort((a, b) => a - b);
    const mediana = taxas[Math.floor(taxas.length / 2)];
    console.log(`  ${rec.padEnd(18)} ${casos.length} caso(s) · mediana ${n2(mediana)} unidade por ponto` +
        `  (faixa ${n2(taxas[0])} a ${n2(taxas[taxas.length - 1])})`);
}

if (foraDaFaixa.length) {
    console.log('\n' + '─'.repeat(78));
    console.log(`FORA DA FAIXA — ${foraDaFaixa.length} para você decidir`);
    console.log('─'.repeat(78));
    for (const f of foraDaFaixa.sort((a, b) => a.razao - b.razao)) {
        console.log(`  ${f.razao.toFixed(2)}×  ${f.nome}  (${f.classe})`);
        console.log(`     custo ${preco(f.custo)} = ${n2(f.esperado)} · entrega ${n2(f.unidades)}`);
        console.log(`     mede: ${f.achados.join(' · ') || '(nada)'}`);
        for (const r of prescrever(f)) console.log(`     → ${r}`);
    }
}

/* ═══ ESPALHAMENTO POR TIER ═══
 * A regra ≥1,00 só tem PISO. Duas magias do mesmo módulo podem passar as duas e
 * ainda assim uma valer cinco vezes a outra — e aí o jogador que escolheu a
 * fraca está pagando o mesmo por um quinto do efeito.
 *
 * O módulo É o tier nas classes que organizam por custo (Bardo: "Custo N") ou
 * por círculo (Sangral, Pallacerdote). Comparar dentro dele é comparar iguais.
 *
 * Achado que motivou esta seção: o Custo 4 do Bardo tinha 4,73× de
 * espalhamento — RÉQUIEM em 5,25× e MARCHA em 1,11× — e nenhuma reprovava.
 */
console.log('\n' + '─'.repeat(78));
console.log('ESPALHAMENTO POR TIER — o piso não pega desigualdade dentro do módulo');
console.log('─'.repeat(78));
/* O tier é o MÓDULO quando ele organiza por preço — "Custo 3 — Clímax", os
   Círculos. Quando o módulo é só um container de habilidades soltas (Manobras
   guarda 19 de Guerreiro E de Ladino), o tier é o CUSTO. Agrupar Manobras pelo
   módulo compara uma manobra de 1 Energia com uma de 2, que nunca disputaram o
   mesmo preço. */
const moduloEhTier = t => /custo\s*\d|círculo/i.test(t);
const porTier = {};
for (const l of medidas) {
    const pts = l.pontosTexto ?? Object.values(l.custo).reduce((s, q) => s + q, 0);
    if (!pts) continue;
    const chave = moduloEhTier(l.modulo) ? `${l.classe} · ${l.modulo}`
        : `${l.classe} · ${l.modulo} · ${pts} pt`;
    (porTier[chave] ??= []).push({ nome: l.nome, r: l.unidades / pts });
}
const tiers = Object.entries(porTier).filter(([, v]) => v.length >= 2)
    .map(([k, v]) => {
        const rs = v.map(x => x.r).sort((a, b) => a - b);
        return { tier: k, n: v.length, min: rs[0], max: rs[rs.length - 1],
                 esp: rs[rs.length - 1] / rs[0],
                 pior: v.reduce((a, b) => (a.r <= b.r ? a : b)),
                 melhor: v.reduce((a, b) => (a.r >= b.r ? a : b)) };
    }).sort((a, b) => b.esp - a.esp);

console.log('  espalh. │  n │ faixa          │ tier');
for (const t of tiers) {
    const flag = t.esp >= 2.5 ? '🔴' : t.esp >= 1.8 ? '⚠ ' : '✅';
    console.log(`  ${flag} ${t.esp.toFixed(2)}× │ ${String(t.n).padStart(2)} │ ${t.min.toFixed(2)}–${t.max.toFixed(2)}× │ ${t.tier}`);
}
const ruins = tiers.filter(t => t.esp >= 1.8);
if (ruins.length) {
    console.log('\n  Os desiguais, com as duas pontas:');
    for (const t of ruins) {
        console.log(`\n    ${t.tier}   ${t.esp.toFixed(2)}×`);
        console.log(`      ↑ ${t.melhor.r.toFixed(2)}×  ${t.melhor.nome}`);
        console.log(`      ↓ ${t.pior.r.toFixed(2)}×  ${t.pior.nome}`);
    }
}
console.log('\n  Espalhamento até ~1,8× é saudável: magia flexível custa mais que magia');
console.log('  estreita. Acima de 2,5× o tier deixou de significar preço.');

/* ═══ TABELA DE PROJETO ═══
 * O que uma magia PRECISA parecer em cada faixa de custo. Sai da régua, não do
 * gosto: é o mínimo que empata com o guerreiro só sacando a arma de graça.
 */
console.log('\n' + '─'.repeat(78));
console.log('TABELA DE PROJETO — o que cada ponto de recurso é obrigado a comprar');
console.log('─'.repeat(78));
console.log('  A referência é dura: o guerreiro ataca de graça, toda rodada. Uma magia');
console.log('  que entrega menos que uma rodada de espada é pior que sacar a espada.\n');
console.log('  custo │ efeito de referência (qualquer um fecha)');
for (const custo of [1, 2, 3, 5]) {
    const alvoRod = custo / TAXA.alvo, blindRod = custo / TAXA.blindagem, dano = custo / TAXA.dano;
    console.log(`    ${custo}   │ ${dano.toFixed(1).padStart(4)} de dano ou cura num alvo`);
    console.log(`        │ ${alvoRod.toFixed(0).padStart(4)} pontos-rodada-alvo de Alvo  (ex.: ${Math.max(1, Math.round(alvoRod / 6))} pt × 3 alvos × 2 rodadas)`);
    console.log(`        │ ${blindRod.toFixed(0).padStart(4)} pontos-rodada-alvo de Blindagem`);
    console.log(`        │ ${custo.toFixed(0).padStart(4)} turno(s) roubado(s)`);
}
console.log('\n  "pontos-rodada-alvo" = magnitude × rodadas × alvos. É o produto dos três');
console.log('  eixos, e é onde o balanceamento acontece — não na magnitude sozinha.');

/* ═══ TABELA B — INVOCAÇÃO QUE PODE VIRAR CONTRA ═══
 * Um ritual que traz uma criatura de lealdade incerta não é medível pelo texto:
 * o valor é a ficha dela, vezes a chance de ela lutar do seu lado. Com p sendo
 * essa chance, cada rodada em campo rende  (2p − 1) × DPR_criatura  — porque
 * abaixo de p=0,5 ela está fazendo o trabalho do inimigo, não o seu.
 */
export const valorInvocacao = (p, dprCriatura, rodadas) => (2 * p - 1) * dprCriatura * rodadas / DPR_BASE;
assert.equal(valorInvocacao(1.0, DPR_BASE, 5), 5, 'leal e no seu DPR por 5 rodadas = 5 unidades');
assert.equal(valorInvocacao(0.5, DPR_BASE, 5), 0, 'moeda ao ar não vale nada — nem custo nem lucro');
assert.equal(valorInvocacao(0.0, DPR_BASE, 5), -5, 'hostil devolve o prejuízo inteiro');

console.log('\n' + '─'.repeat(78));
console.log('TABELA B — INVOCAÇÃO: quando o ritual sai do escopo');
console.log('─'.repeat(78));
const invoc = linhas.find(l => /Invoca..o Abissal/i.test(l.nome));
const custoInvoc = 4 + 1;   // 4 Sanidade + 1 Energia, do módulo do Invocador
console.log(`  Invocação Abissal custa ${custoInvoc} pontos → precisa render ${custoInvoc.toFixed(2)} unidades.`);
console.log(`  Criatura de DPR igual ao do guerreiro (${DPR_BASE}), 5 rodadas em campo:\n`);
console.log('    Disposição │ p(luta por você) │ rende │ paga o custo?');
for (const [d, p] of [['muito hostil', 0.10], ['hostil', 0.30], ['indócil', 0.50], ['dócil', 0.70], ['leal', 0.90], ['dominada', 1.00]]) {
    const v = valorInvocacao(p, DPR_BASE, 5);
    console.log(`    ${d.padEnd(12)} │      ${(p * 100).toFixed(0).padStart(3)}%       │ ${v.toFixed(2).padStart(5)} │ ${v >= custoInvoc ? '✅' : '❌'}`);
}
console.log(`\n  Com criatura no DPR do guerreiro, só a lealdade total paga — ou seja, a`);
console.log(`  criatura tem que ser MAIS FORTE que um guerreiro. Invertendo a conta, o`);
console.log(`  DPR que a criatura precisa ter para o ritual se pagar em 5 rodadas:\n`);
console.log('    Disposição │ DPR necessário │ × o guerreiro');
for (const [d, p] of [['indócil', 0.50], ['dócil', 0.70], ['leal', 0.90], ['dominada', 1.00]]) {
    if (p <= 0.5) { console.log(`    ${d.padEnd(12)} │   impossível   │  —   (2p−1 = 0)`); continue; }
    const dpr = custoInvoc * DPR_BASE / ((2 * p - 1) * 5);
    console.log(`    ${d.padEnd(12)} │     ${dpr.toFixed(2).padStart(5)}      │ ${(dpr / DPR_BASE).toFixed(1)}×`);
}
console.log(`\n  ESSE é o requisito de projeto das criaturas abissais: uma invocação dócil`);
console.log(`  precisa bater 2,5× o guerreiro para o ritual valer o que custa. Abaixo de`);
console.log(`  50% de Disposição não existe DPR que salve — o Invocador paga para ajudar`);
console.log(`  o inimigo, e é aí que o ritual sai do escopo.`);
console.log(`  → É por isso que "Laço de Nome" (+1 Disposição, 1 Energia) não é conforto:`);
console.log(`    é a magia que move p acima do equilíbrio. Sem ela a Invocação não fecha.`);
console.log(`  → E o desenho fecha: CA alto aumenta o DPR da criatura E baixa a Disposição.`);
console.log(`    A pergunta de balanceamento é em que CA a curva cruza o zero.`);

console.log('\n' + '─'.repeat(78));
console.log(`NÃO CLASSIFICADAS — ${mudas.length} de ${linhas.length} (${(mudas.length / linhas.length * 100).toFixed(0)}%)`);
console.log('─'.repeat(78));
console.log('  A régex não achou efeito medível. NÃO quer dizer que não valem nada —');
console.log('  quer dizer que o efeito não cabe nas cinco categorias, ou está escrito');
console.log('  de um jeito que a máquina não lê. É a lista do que a régua ainda não cobre.');
const porClasse = {};
for (const l of mudas) porClasse[l.classe] = (porClasse[l.classe] || 0) + 1;
console.log('  ' + Object.entries(porClasse).sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c}: ${n}`).join(' · '));
if (VER_NAO) { console.log(); for (const l of mudas) console.log(`    ${l.classe.slice(0, 14).padEnd(15)} ${l.nome}`); }

/* ═══ FOLHA DE PRESCRIÇÃO ═══
 * Markdown com uma linha por magia fraca e o conserto nos três eixos, para o
 * dono do sistema marcar o que aceita antes de qualquer gravação. */
if (process.argv.includes('--folha')) {
    const fs = await import('node:fs/promises');
    const porClasseF = {};
    for (const f of foraDaFaixa) (porClasseF[f.classe] ??= []).push(f);
    let md = `# Folha de prescrição — magias abaixo de 1:1\n\n`
        + `Gerado por \`functions/audit-regua-controle.mjs --folha\`. Régua no livro **Régua de Balanceamento** (não público).\n\n`
        + `Regra: **cada ponto de recurso tem que devolver ≥ 1,00 unidade**. 1 unidade = ${DPR_BASE} = uma rodada de guerreiro no Q0.\n\n`
        + `Uma magia tem três eixos — **magnitude × rodadas × alvos**. O conserto pode vir de qualquer um, ou repartido. `
        + `Marque \`[x]\` no que aceitar, ou escreva o seu no lugar.\n\n`
        + `> A ficção manda. Se "duração 1 → 4 rodadas" não fizer sentido para a magia, diga — o número tem alternativa, o sabor não.\n\n`;
    for (const [classe, itens] of Object.entries(porClasseF).sort()) {
        md += `\n## ${classe}\n\n`;
        for (const f of itens.sort((a, b) => a.razao - b.razao)) {
            md += `### ${f.nome}  \`${f.razao.toFixed(2)}×\`\n\n`
                + `- custo **${preco(f.custo)}** = ${n2(f.esperado)} · entrega **${n2(f.unidades)}** · mede: ${f.achados.join(' · ') || '—'}\n`;
            for (const r of prescrever(f)) md += `- [ ] ${r}\n`;
            md += `- [ ] outro: \n\n`;
        }
    }
    md += `\n---\n\n## Não classificadas (${mudas.length})\n\n`
        + `A régua não achou efeito medível. Pode ser categoria faltando **ou** economia diferente `
        + `(ritual, invocação, receita) — ver capítulo 3 do livro.\n\n`;
    for (const l of mudas.sort((a, b) => a.classe.localeCompare(b.classe))) md += `- ${l.classe} — ${l.nome}\n`;
    await fs.writeFile('FOLHA-PRESCRICAO-MAGIAS.md', md, 'utf8');
    console.log(`\n📄 FOLHA-PRESCRICAO-MAGIAS.md escrita (${foraDaFaixa.length} magias + ${mudas.length} não classificadas).`);
}

console.log('\n' + '═'.repeat(78));
console.log('Só leitura. --naoclassificadas lista as não alcançadas · --folha gera o markdown.');
console.log('═'.repeat(78) + '\n');
process.exit(0);
