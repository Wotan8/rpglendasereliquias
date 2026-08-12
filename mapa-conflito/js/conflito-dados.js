/* =====================================================================
   ⚔️ MAPA DE CONFLITO — leitura e desenho (sem DOM, sem Firebase)
   ---------------------------------------------------------------------
   O schema de cada módulo de classe é livre: o Criador escolhe os
   rótulos e as chaves. Então NADA aqui pode depender de posição no
   array — só de rótulo, por regex. É por isso que este pedaço mora
   separado e tem teste: quando o casamento rótulo→campo erra, ele erra
   calado (mostra vazio, não quebra).

   Os templates também moram aqui, e são funções puras de string: é o
   que permite gerar a prévia da tela fora do navegador
   (functions/__check-mapa-conflito.mjs). mapa-conflito.js fica só com
   Firebase, DOM e eventos.

   Ver conflito-dados.test.mjs.
   ===================================================================== */

/* Ordem das faixas = quanto o custo pesa no turno, do mais barato ao que
   não cabe numa rodada. Os rótulos são os mesmos do select cadastrado em
   functions/combate-v3-2-custo-acao.mjs — mudou lá, acrescente aqui. */
export const FAIXAS = [
    ['Ação Livre', '⚡', 'não consome as suas 2 ações'],
    ['Ação de Movimento', '👣', 'gasta 1 das 2 ações'],
    ['Ação Padrão', '⚔️', 'gasta 1 das 2 ações'],
    ['Ação Completa (turno inteiro)', '🌀', 'consome as 2 ações'],
    ['Sustentada (1 Padrão/turno)', '♾️', 'custa 1 Padrão a cada turno'],
    ['Fora de combate', '🕯️', 'não cabe numa rodada'],
];
/* `Reação` NÃO entra: não existe mais no sistema. O defensor não rola —
   Defesa é número estático e o limite por rodada é Reflexo − 1. A opção
   ainda aparece no select do Painel do Criador (herança do
   combate-v3-2-custo-acao.mjs); habilidade cadastrada com ela cai na faixa
   marcada, que é exatamente o aviso que se quer. */

export const SEM_ACAO = 'Sem custo de ação no cadastro';

/** Busca sem acento e sem caixa: "colera" acha "Cólera". */
export const norm = (s) => String(s ?? '').normalize('NFD')
    .replace(/[̀-ͯ]/g, '').toLowerCase();

const rotulos = (mod) => Object.fromEntries((mod.schema || []).map(f => [f.key, String(f.label || '')]));

/** Um id cru na tela é ruído: só sai o que dá para resolver em nome. */
const nomePor = (mapa, v) => mapa[String(v?.id ?? v ?? '')] || null;

/**
 * Condições que a habilidade aplica.
 *
 * NÃO é lista de id — é lista de OBJETO, e cada um traz o portão pelo qual a
 * condição passa: `chance` (porta percentual fixa) ou `resistencia` (o alvo
 * rola para escapar). Tratar isso como id devolve "[object Object]", não casa
 * com nada e o chip some sem erro nenhum — foi o que aconteceu.
 *
 *   { condicao:'Atordoado', portao:'chance', chance:10, alvos:1, rodadas:1 }
 */
export function lerCondicoes(it) {
    return (it.condicoesAplicadas || [])
        .filter(c => c && typeof c === 'object' && c.condicao)
        .map(c => ({
            nome: String(c.condicao),
            portao: c.portao === 'chance' ? `chance ${c.chance ?? '?'}` : 'resistência',
            alvos: Number(c.alvos) || 1,
            rodadas: Number(c.rodadas) || 1,
        }));
}

/** O rótulo do chip de condição: o que ela faz, por quanto tempo e como passa. */
export const rotuloCondicao = (c) =>
    `${c.nome} · ${c.rodadas}r${c.alvos > 1 ? ` · ${c.alvos} alvos` : ''} · ${c.portao}`;

/**
 * Uma habilidade pré-cadastrada, achatada no que a tela precisa.
 * @param {object} mod   doc de system/data/classModules
 * @param {object} it    entrada de mod.itensPredefinidos
 * @param {{vds?:object, pericias?:object}} mapas  id → nome
 */
export function lerHabilidade(mod, it, mapas = {}) {
    const { vds = {}, pericias = {} } = mapas;
    const lbl = rotulos(mod);
    const val = (re) => {
        const k = Object.keys(lbl).find(x => re.test(lbl[x]));
        const v = k ? it.valores?.[k] : null;
        return v == null || v === '' ? null : String(v);
    };

    /* Duração e alcance têm campo estruturado no item; o schema é o plano B.
       Cuidado: o rótulo "Alcance/Raio/Duração:" casa com /alcance/ E com
       /dura/ — por isso duração usa ^dura, que não pega esse rótulo. */
    const duracao = it.duracaoValor
        ? `${it.duracaoValor} ${it.duracaoUnidade || ''}`.trim()
        : val(/^dura[cç]/i);
    const area = it.formaArea && it.formaArea !== 'nenhuma'
        ? `${it.formaArea} ${it.tamanhoArea || ''}m`.trim() : null;
    const alcance = it.alcance ? `${it.alcance}m` : (area || val(/alcance/i));

    /* O campo "Teste:" guarda id de VALOR DERIVADO, não de perícia: cada
       classe mágica rola o VD dela (Bênção, Moldar Sangue, Cravar Totem).
       `pericias` continua no fallback só para módulo que aponte para lá. */
    const rolagem = nomePor(vds, val(/^teste/i)) || nomePor(pericias, val(/^teste/i));
    const redutor = val(/^redutor/i);

    return {
        nome: it.nome || '(sem nome)',
        modulo: mod.titulo || '',
        acao: it.valores?.acao || null,
        custo: val(/^custo/i),
        teste: rolagem ? (redutor ? `${rolagem} ${redutor}` : rolagem) : null,
        efeito: it.descricao || val(/^efeito/i) || '',
        falha: val(/^falha/i),
        duracao,
        alcance,
        condicoes: lerCondicoes(it),
        razao: it.regua?.razao || null,
        /* A medição da Régua de Balanceamento, como foi gravada no cadastro:
           { razao, unidades, custo, em }. É o único número EXATO que existe
           sobre o que a habilidade entrega — o resto da tela é estimativa. */
        regua: (it.regua && typeof it.regua.razao === 'number') ? it.regua : null,
    };
}

/**
 * Agrupa habilidades pelo custo de ação, na ordem das FAIXAS.
 * Rótulo desconhecido não some: ganha faixa própria no fim, e é assim
 * que o buraco de cadastro fica visível em vez de sumir.
 * @returns {Array<{nome:string, icone:string, glosa:string, conhecida:boolean, lista:object[]}>}
 */
export function agruparPorAcao(habs) {
    const baldes = new Map(FAIXAS.map(([nome]) => [nome, []]));
    for (const h of habs) {
        const k = h.acao || SEM_ACAO;
        if (!baldes.has(k)) baldes.set(k, []);
        baldes.get(k).push(h);
    }
    const glosa = Object.fromEntries(FAIXAS.map(([n, i, g]) => [n, [i, g]]));
    return [...baldes]
        .filter(([, lista]) => lista.length)
        .map(([nome, lista]) => {
            const conhecida = !!glosa[nome];
            const [icone, g] = glosa[nome] || ['⚠️', 'preencha o campo Ação no Painel do Criador'];
            return { nome, icone, glosa: g, conhecida, lista };
        });
}

/** As habilidades de todos os módulos que a classe carrega. */
export function habilidadesDaClasse(classe, modulos, mapas) {
    return (classe.modulosDaClasse || [])
        .map(r => modulos[r?.id ?? r])
        .filter(Boolean)
        .flatMap(m => (m.itensPredefinidos || []).map(it => lerHabilidade(m, it, mapas)));
}

/* ══════════════════ PERFIL — os eixos do mapa ══════════════════════
   Tudo aqui é MEDIDO do cadastro, não escrito à mão. O campo `arquetipo`
   da classe é prosa do Criador e de propósito não entra em nada disto. */

/** As oito vocações. A classificação é HEURÍSTICA sobre o texto do efeito —
    boa para desenhar a silhueta de uma classe, ruim para auditar número. */
export const VOCACOES = [
    ['dano', '💥', /dano|\d\s*d\s*\d|golpe|explos|fere|perfura/i],
    ['controle', '🕸️', /atordo|imobiliz|prostr|agarr|lento|ofusc|amedront|derrub|desarm|prende|banimento/i],
    ['defesa', '🛡️', /blindagem|escudo|absorve|prote(ge|ção)|resist[êe]ncia|armadura/i],
    ['cura', '💚', /cura|recupera|restaur|sara/i],
    ['buff', '⬆️', /\+\s*\d|vantagem|inspira|aumenta|b[ôo]nus|ganha/i],
    ['mobilidade', '💨', /desloc|salta|avanç|recua|escala|voa|teleport/i],
    ['invocação', '👁️', /invoca|convoca|cria (um|uma)|fantoche|totem|manada|eco|lacaio/i],
    ['utilidade', '🔎', /detect|enxerg|sente|marca|rastrea|vis(ã|a)o|comunica/i],
];

/** Peso de cada custo de ação no eixo RITMO. Positivo = sobra turno. */
const PESO_RITMO = {
    'Ação Livre': +1,
    'Ação de Movimento': +1,
    'Ação Padrão': 0,
    'Ação Completa (turno inteiro)': -1,
    'Sustentada (1 Padrão/turno)': -1,
    'Fora de combate': -1,
};

/**
 * O perfil mecânico de uma classe — as coordenadas do mapa.
 *
 *   ritmo  −1…+1  quanto o repertório SOBRA ou CONSOME o turno.
 *                 Ação Livre e de Movimento somam (você empilha coisas);
 *                 Completa, Sustentada e Fora de combate subtraem (você
 *                 aposta o turno ou sai do combate). Padrão é o zero.
 *   portao   0…1  fração que rola um Valor Derivado próprio da classe.
 *                 0 = resolve direto no ataque; 1 = tudo passa por VD.
 */
export function perfilDaClasse(classe, modulos, mapas) {
    const habs = habilidadesDaClasse(classe, modulos, mapas);
    const n = habs.length;
    const perfil = {
        id: classe.id, nome: classe.nome || '?', attr: classe.atributoChave || '', n,
        ritmo: 0, portao: 0, vocacao: {}, acoes: {}, condicoes: 0, ritual: 0,
    };
    if (!n) return perfil;

    for (const h of habs) {
        perfil.acoes[h.acao || SEM_ACAO] = (perfil.acoes[h.acao || SEM_ACAO] || 0) + 1;
        perfil.ritmo += PESO_RITMO[h.acao] || 0;
        if (h.teste) perfil.portao++;
        if (h.acao === 'Fora de combate') perfil.ritual++;
        if (h.condicoes.length) perfil.condicoes++;
        const txt = `${h.efeito} ${h.condicoes.map(c => c.nome).join(' ')}`;
        for (const [nome, , re] of VOCACOES) if (re.test(txt)) perfil.vocacao[nome] = (perfil.vocacao[nome] || 0) + 1;
    }
    perfil.ritmo /= n;
    perfil.portao /= n;
    return perfil;
}

/* ── Templates (string pura — nada de document aqui) ──────────────── */

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function cardHabilidade(h) {
    const chips = [
        h.custo && `<span class="mc-chip mc-chip-custo">${esc(h.custo)}</span>`,
        h.teste && `<span class="mc-chip mc-chip-teste">🎲 ${esc(h.teste)}</span>`,
        h.alcance && `<span class="mc-chip">📏 ${esc(h.alcance)}</span>`,
        h.duracao && `<span class="mc-chip">⏳ ${esc(h.duracao)}</span>`,
        ...h.condicoes.map(c => `<span class="mc-chip mc-chip-cond">${esc(rotuloCondicao(c))}</span>`),
        h.razao && `<span class="mc-chip mc-chip-regua" title="Razão da régua de balanceamento">${h.razao.toFixed(2)}×</span>`,
    ].filter(Boolean).join('');

    return `<article class="mc-card" data-busca="${esc(norm(h.nome + ' ' + h.efeito))}">
        <h3>${esc(h.nome)}</h3>
        <span class="mc-card-modulo">${esc(h.modulo)}</span>
        ${chips ? `<div class="mc-chips">${chips}</div>` : ''}
        ${h.efeito ? `<p>${esc(h.efeito)}</p>` : ''}
        ${h.falha ? `<p class="mc-card-falha">Se falhar: ${esc(h.falha)}</p>` : ''}
    </article>`;
}

/** Uma coluna: a classe e o turno dela, faixa a faixa. */
export function colunaClasse(classe, modulos, mapas) {
    const faixas = agruparPorAcao(habilidadesDaClasse(classe, modulos, mapas)).map(f =>
        `<section class="mc-faixa ${f.conhecida ? '' : 'mc-faixa-alerta'}">
            <div class="mc-faixa-topo">
                <span class="mc-faixa-nome">${f.icone} ${esc(f.nome)}</span>
                <span class="mc-faixa-glosa">${esc(f.glosa)}</span>
                <span class="mc-faixa-conta">${f.lista.length}</span>
            </div>
            <div class="mc-cards">${f.lista.map(cardHabilidade).join('')}</div>
        </section>`).join('');

    /* papelEmCena.combate já está escrito no cadastro — só vira bullets. */
    const papel = (classe.papelEmCena || [])[0]?.combate || '';
    const bullets = papel.split('\n').map(l => l.replace(/^[•\s]+/, '').trim()).filter(Boolean);
    const perics = (classe.pericClasse || []).map(id => mapas.pericias?.[id]).filter(Boolean);

    return `<div class="mc-classe">
        <div class="mc-classe-topo">
            <h2>${esc(classe.nome)}</h2>
            ${classe.arquetipo ? `<span class="mc-arquetipo">${esc(classe.arquetipo)}</span>` : ''}
            ${bullets.length ? `<ul class="mc-papel">${bullets.map(b => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}
            <div class="mc-chips">
                ${classe.atributoChave ? `<span class="mc-chip mc-chip-attr">Atributo-chave: ${esc(classe.atributoChave)}</span>` : ''}
                ${perics.map(p => `<span class="mc-chip">${esc(p)}</span>`).join('')}
            </div>
        </div>
        ${faixas || '<p class="mc-vazio" style="padding:16px">Nenhum módulo com habilidades cadastradas — este módulo é preenchido pelo jogador na ficha.</p>'}
    </div>`;
}

/* ══════════════════ MAPA 2D e RADAR (SVG puro) ═════════════════════
   SVG inline, sem biblioteca: cor vem de var(--lr-*), então os dois
   desenhos acompanham o tema claro/escuro sem uma linha de JS. */

const COR_VOCACAO = {
    dano: 'var(--lr-blood-2)', controle: 'var(--lr-abyssal)', defesa: 'var(--lr-arcane)',
    cura: 'var(--lr-nature)', buff: 'var(--lr-gold)', mobilidade: 'var(--lr-arcane-2)',
    'invocação': 'var(--lr-abyssal-2)', utilidade: 'var(--lr-text-2)',
};

/** A vocação com mais habilidades — dá a cor do ponto no mapa. */
export function vocacaoDominante(perfil) {
    const [top] = Object.entries(perfil.vocacao).sort((a, b) => b[1] - a[1]);
    return top ? top[0] : null;
}

/**
 * MAPA 2D — ritmo (x) × portão (y). Uma bolha por classe, área proporcional
 * ao tamanho do repertório e cor da vocação dominante.
 *
 * As bolhas grandes são desenhadas PRIMEIRO: onde duas classes caem no mesmo
 * ponto (acontece — Bardo e Caçador coincidem), a menor fica por cima e
 * visível, em vez de sumir atrás da maior.
 */
export function mapaSVG(perfis, selecionados = []) {
    /* mt sobra de propósito: cinco classes empatam em 100% de VD e encostam no
       teto — sem folga a bolha e o rótulo saem cortados. */
    const W = 760, H = 560, ml = 96, mr = 28, mt = 76, mb = 68;
    const px = (r) => ml + ((r + 0.5) / 1) * (W - ml - mr);
    const py = (p) => mt + (1 - p) * (H - mt - mb);

    const grade = [];
    for (let i = 0; i <= 4; i++) {
        const p = i / 4, y = py(p);
        grade.push(`<line x1="${ml}" y1="${y}" x2="${W - mr}" y2="${y}" stroke="var(--lr-border-soft)" stroke-width="1"/>`);
        grade.push(`<text x="${ml - 10}" y="${y + 4}" text-anchor="end" font-size="11" fill="var(--lr-text-2)">${Math.round(p * 100)}%</text>`);
    }
    for (const r of [-0.5, -0.25, 0, 0.25, 0.5]) {
        const x = px(r), zero = r === 0;
        grade.push(`<line x1="${x}" y1="${mt}" x2="${x}" y2="${H - mb}" stroke="${zero ? 'var(--lr-border)' : 'var(--lr-border-soft)'}" stroke-width="${zero ? 2 : 1}"/>`);
    }

    /* As regiões vazias são o assunto do mapa: ficam nomeadas, não deduzidas. */
    const vazio = (x1, y1, x2, y2, txt) => `
        <rect x="${x1}" y="${y1}" width="${x2 - x1}" height="${y2 - y1}" fill="var(--lr-blood-soft)" opacity=".35"/>
        <text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2}" text-anchor="middle" font-size="12"
              fill="var(--lr-text-2)" font-style="italic">${txt}</text>`;

    /* Classes empatam nos DOIS eixos (Invocador e Adepto, Bardo e Caçador). As
       bolhas podem se sobrepor — isso é verdade e fica visível —, mas dois
       rótulos no mesmo lugar viram borrão. Então o rótulo sobe até achar
       espaço livre, e um fio liga o texto deslocado à sua bolha. */
    const postos = [];
    const ocupado = (x, y) => postos.some(q => Math.abs(q.x - x) < 78 && Math.abs(q.y - y) < 15);
    /** Sobe procurando espaço; batendo no teto, desce por baixo da bolha. */
    const livre = (x, acima, abaixo) => {
        let y = acima;
        while (y > 16 && ocupado(x, y)) y -= 16;
        if (y <= 16) { y = abaixo; while (ocupado(x, y)) y += 16; }
        postos.push({ x, y });
        return y;
    };

    const bolhas = [...perfis].filter(p => p.n).sort((a, b) => b.n - a.n).map(p => {
        const x = px(p.ritmo), y = py(p.portao);
        const r = 8 + Math.sqrt(p.n) * 3.4;
        const voc = vocacaoDominante(p);
        const sel = selecionados.includes(p.id);
        const yr = livre(x, y - r - 8, y + r + 16);
        const abaixo = yr > y;
        /* Fio ligando rótulo deslocado à sua bolha — sem ele, texto empurrado
           para longe parece pertencer à bolha vizinha. */
        const dist = abaixo ? yr - 12 - (y + r) : (y - r) - (yr + 4);
        const fio = dist > 6
            ? `<line x1="${x}" y1="${abaixo ? y + r + 2 : y - r - 2}" x2="${x}" y2="${abaixo ? yr - 11 : yr + 4}"
                     stroke="var(--lr-border)" stroke-width="1"/>` : '';
        const vocs = Object.entries(p.vocacao).sort((a, b) => b[1] - a[1])
            .map(([k, v]) => `${k} ${Math.round(100 * v / p.n)}%`).join(', ');
        return `<g>
            <circle cx="${x}" cy="${y}" r="${r}" fill="${COR_VOCACAO[voc] || 'var(--lr-text-2)'}"
                    fill-opacity="${sel ? .85 : .45}" stroke="${sel ? 'var(--lr-text-1)' : 'var(--lr-surface)'}"
                    stroke-width="${sel ? 3 : 1.5}"><title>${esc(p.nome)} — ${p.n} habilidades · ritmo ${p.ritmo.toFixed(2)} · VD ${Math.round(p.portao * 100)}%${vocs ? ` · ${vocs}` : ''}</title></circle>
            ${fio}
            <text x="${x}" y="${yr}" text-anchor="middle" font-size="12"
                  font-weight="${sel ? 800 : 600}" fill="var(--lr-text-1)">${esc(p.nome)}</text>
        </g>`;
    }).join('');

    return `<svg viewBox="0 0 ${W} ${H}" class="mc-svg" role="img"
        aria-label="Mapa das classes: ritmo do turno contra portão de acerto">
        ${grade.join('')}
        ${vazio(px(0.08), mt, W - mr, py(0.75), 'ninguém aqui: rola VD e ainda sobra turno')}
        <text x="${ml}" y="${H - mb + 26}" font-size="12" fill="var(--lr-text-2)">◀ aposta o turno inteiro / sai do combate</text>
        <text x="${W - mr}" y="${H - mb + 26}" text-anchor="end" font-size="12" fill="var(--lr-text-2)">empilha ações no turno ▶</text>
        <text x="${(ml + W - mr) / 2}" y="${H - mb + 48}" text-anchor="middle" font-size="13" font-weight="700" fill="var(--lr-text-1)">RITMO DO TURNO</text>
        <text x="26" y="${(mt + H - mb) / 2}" text-anchor="middle" font-size="13" font-weight="700" fill="var(--lr-text-1)"
              transform="rotate(-90 26 ${(mt + H - mb) / 2})">PORTÃO — % que rola VD próprio</text>
        ${bolhas}
    </svg>`;
}

/* Uma cor por série do radar, espalhadas no matiz e todas vindas dos tokens
   (logo, acompanham o tema). Passando de 12 classes a lista recomeça — o
   traço pontilhado das últimas seis é o que evita confundir o par repetido. */
export const PALETA = [
    'var(--lr-gold)', 'var(--lr-arcane)', 'var(--lr-nature)', 'var(--lr-blood-2)',
    'var(--lr-abyssal)', 'var(--lr-bronze)', 'var(--lr-arcane-2)', 'var(--lr-abyssal-2)',
    'var(--lr-gold-2)', 'var(--lr-blood-3)', 'var(--lr-text-2)', 'var(--lr-nature)',
];
const TRACO = (i) => (i >= 6 ? ' stroke-dasharray="6 4"' : '');

/**
 * Preenchimento por número de séries. Duas silhuetas cheias se leem bem;
 * cinco viram lama. A partir daí é só contorno — a forma continua legível,
 * e é a forma que interessa.
 */
export const opacidadeRadar = (n) => (n <= 2 ? 0.22 : n <= 4 ? 0.10 : 0);

/**
 * RADAR de vocação — as oito vocações de N classes, em % do repertório de
 * cada uma. Escala fixa 0–100%: comparar classe com escala móvel mente.
 */
export function radarSVG(perfis) {
    const S = 420, c = S / 2, raio = c - 68;
    const eixos = VOCACOES.map(([nome, emoji]) => ({ nome, emoji }));
    const ang = (i) => (i / eixos.length) * 2 * Math.PI - Math.PI / 2;
    const pt = (i, v) => [c + Math.cos(ang(i)) * raio * v, c + Math.sin(ang(i)) * raio * v];

    const teia = [.25, .5, .75, 1].map(v =>
        `<polygon points="${eixos.map((_, i) => pt(i, v).map(n => n.toFixed(1)).join(',')).join(' ')}"
            fill="none" stroke="var(--lr-border-soft)" stroke-width="1"/>`).join('')
        + eixos.map((_, i) => `<line x1="${c}" y1="${c}" x2="${pt(i, 1)[0]}" y2="${pt(i, 1)[1]}"
            stroke="var(--lr-border-soft)" stroke-width="1"/>`).join('');

    const rotulos = eixos.map((e, i) => {
        const [x, y] = pt(i, 1.17);
        const anchor = Math.abs(x - c) < 6 ? 'middle' : (x > c ? 'start' : 'end');
        return `<text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="${anchor}"
            font-size="11" fill="var(--lr-text-2)">${e.emoji} ${e.nome}</text>`;
    }).join('');

    const series = perfis.filter(p => p.n);
    const op = opacidadeRadar(series.length);
    const cor = (k) => PALETA[k % PALETA.length];

    const formas = series.map((p, k) => {
        const pontos = eixos.map((e, i) => pt(i, (p.vocacao[e.nome] || 0) / p.n).map(n => n.toFixed(1)).join(',')).join(' ');
        return `<polygon points="${pontos}" fill="${cor(k)}" fill-opacity="${op}"
            stroke="${cor(k)}" stroke-width="2.5" stroke-linejoin="round"${TRACO(k)}>
            <title>${esc(p.nome)} — ${eixos.map(e => `${e.nome} ${Math.round(100 * (p.vocacao[e.nome] || 0) / p.n)}%`).join(', ')}</title>
        </polygon>`;
    }).join('');

    const legenda = series.map((p, k) =>
        `<span class="mc-radar-chave"><i style="background:${cor(k)}${k >= 6 ? ';opacity:.75' : ''}"></i>${esc(p.nome)}</span>`).join('');

    return `<div class="mc-radar">
        <svg viewBox="0 0 ${S} ${S}" class="mc-svg" role="img" aria-label="Radar de vocação">
            ${teia}${formas}${rotulos}
            <text x="${c}" y="${c - raio - 30}" text-anchor="middle" font-size="10" fill="var(--lr-text-2)">100%</text>
        </svg>
        <div class="mc-radar-legenda">${legenda || '<span class="mc-vazio">Nenhuma classe marcada.</span>'}</div>
    </div>`;
}

/* ══════════════════ AUDITORIA — só número exato ════════════════════
   O radar de vocação é heurística sobre texto. Isto aqui NÃO é: cada
   número vem de `regua` gravada no próprio cadastro pelo processo de
   balanceamento — { razao, unidades, custo }.

   A régua (livro "Régua de Balanceamento", §0.3 e §4.1):
     1 unidade = o que um guerreiro entrega em 1 rodada (DPR 3,445 em Q0)
     1 Energia = 1,00 unidade — a âncora de todo o resto
     razão = unidades ÷ custo

   Abaixo de 1,00 a habilidade entrega menos que sacar a espada, que é de
   graça (§0.3). O teto de 1,70 é a faixa que os scripts de balanceamento
   usam nos asserts (ver functions/manobra-atordoar.mjs).

   O que NÃO dá para auditar daqui: dano é texto livre no cadastro, então
   nenhuma soma de dano sai estruturada. Por isso a auditoria se apoia na
   régua já medida, e a COBERTURA é a primeira coisa que ela mostra —
   classe sem régua não está aprovada, está sem medição. */

export const FAIXA_REGUA = [1.00, 1.70];

/** @returns {{id,nome,n,medidas,cobertura,foraDaFaixa,unidades,custo}} */
export function auditoriaDaClasse(classe, modulos, mapas) {
    const habs = habilidadesDaClasse(classe, modulos, mapas);
    const medidas = habs.filter(h => h.regua).map(h => ({
        nome: h.nome, modulo: h.modulo,
        razao: h.regua.razao, unidades: h.regua.unidades, custo: h.regua.custo,
    }));
    const [piso, teto] = FAIXA_REGUA;
    return {
        id: classe.id, nome: classe.nome || '?',
        n: habs.length, medidas,
        cobertura: habs.length ? medidas.length / habs.length : 0,
        foraDaFaixa: medidas.filter(m => m.razao < piso || m.razao > teto)
            .sort((a, b) => b.razao - a.razao),
        unidades: medidas.reduce((s, m) => s + (m.unidades || 0), 0),
        custo: medidas.reduce((s, m) => s + (m.custo || 0), 0),
    };
}

const br = (x, casas = 2) => Number(x).toFixed(casas).replace('.', ',');

/**
 * Uma faixa por classe, um ponto por habilidade medida, na escala da razão.
 * A zona aprovada é pintada; o que sai dela salta à vista sem legenda.
 * Razão acima do teto do eixo é fixada na borda com o valor escrito ao lado —
 * cortar o 9,14× do Sangral esconderia justamente o pior caso.
 */
export function auditoriaSVG(auditorias) {
    const linhas = auditorias.filter(a => a.n);
    const ml = 168, mr = 54, mt = 46, alt = 34, MAX = 3;
    const W = 760, H = mt + linhas.length * alt + 44;
    const px = (r) => ml + Math.min(r, MAX) / MAX * (W - ml - mr);
    const [piso, teto] = FAIXA_REGUA;

    const eixo = [0, 1, 1.7, 2, 3].map(v => `
        <line x1="${px(v)}" y1="${mt - 12}" x2="${px(v)}" y2="${H - 40}"
              stroke="var(--lr-border-soft)" stroke-width="1"/>
        <text x="${px(v)}" y="${mt - 18}" text-anchor="middle" font-size="10"
              fill="var(--lr-text-2)">${br(v, v % 1 ? 2 : 0)}×</text>`).join('');

    const corpo = linhas.map((a, i) => {
        const y = mt + i * alt + alt / 2;
        const nunca = a.medidas.length === 0;
        const pontos = a.medidas.map(m => {
            const fora = m.razao < piso || m.razao > teto;
            const estourou = m.razao > MAX;
            return `<g>
                <circle cx="${px(m.razao)}" cy="${y}" r="${fora ? 6 : 5}"
                    fill="${fora ? 'var(--lr-blood-2)' : 'var(--lr-nature)'}" fill-opacity=".8"
                    stroke="var(--lr-surface)" stroke-width="1"><title>${esc(m.nome)} — ${br(m.razao)}× (${br(m.unidades)} unidades ÷ custo ${m.custo}) · ${esc(m.modulo)}</title></circle>
                ${estourou ? `<text x="${px(MAX) + 8}" y="${y + 4}" font-size="10" font-weight="700"
                    fill="var(--lr-blood-2)">${br(m.razao)}×</text>` : ''}
            </g>`;
        }).join('');
        return `<g>
            <rect x="0" y="${mt + i * alt}" width="${W}" height="${alt}"
                  fill="${i % 2 ? 'var(--lr-bg-1)' : 'transparent'}" opacity=".5"/>
            <text x="${ml - 12}" y="${y - 2}" text-anchor="end" font-size="12"
                  font-weight="600" fill="var(--lr-text-1)">${esc(a.nome)}</text>
            <text x="${ml - 12}" y="${y + 11}" text-anchor="end" font-size="10"
                  fill="${nunca ? 'var(--lr-blood-2)' : 'var(--lr-text-2)'}">${nunca
                ? 'nunca auditada'
                : `${a.medidas.length}/${a.n} medidas · ${Math.round(a.cobertura * 100)}%`}</text>
            ${pontos}
        </g>`;
    }).join('');

    return `<svg viewBox="0 0 ${W} ${H}" class="mc-svg" role="img"
        aria-label="Auditoria: razão da régua por habilidade, classe a classe">
        <rect x="${px(piso)}" y="${mt - 12}" width="${px(teto) - px(piso)}" height="${H - 28 - mt}"
              fill="var(--lr-nature-soft)"/>
        <text x="${(px(piso) + px(teto)) / 2}" y="${H - 26}" text-anchor="middle" font-size="10"
              fill="var(--lr-text-2)">faixa aprovada</text>
        <text x="${px(0) + 4}" y="${H - 26}" font-size="10" fill="var(--lr-blood-2)">↤ pior que sacar a espada</text>
        ${eixo}${corpo}
    </svg>`;
}

/** A lista do que está fora da faixa, com a conta aberta. */
export function tabelaAuditoria(auditorias) {
    const fora = auditorias.flatMap(a => a.foraDaFaixa.map(m => ({ ...m, classe: a.nome })))
        .sort((x, y) => y.razao - x.razao);
    const semMedida = auditorias.filter(a => a.n && !a.medidas.length);

    const linhas = fora.map(m => `<tr>
        <td class="mc-num ${m.razao > FAIXA_REGUA[1] ? 'mc-alto' : 'mc-baixo'}">${br(m.razao)}×</td>
        <td>${esc(m.classe)}</td>
        <td>${esc(m.nome)}</td>
        <td class="mc-num">${br(m.unidades)}</td>
        <td class="mc-num">${m.custo}</td>
    </tr>`).join('');

    return `
    ${semMedida.length ? `<p class="mc-aviso">⚠️ Sem régua nenhuma:
        <b>${semMedida.map(a => esc(a.nome)).join(', ')}</b>.
        Não estão aprovadas — estão sem medição.</p>` : ''}
    ${fora.length ? `<table class="mc-tabela">
        <thead><tr><th>razão</th><th>classe</th><th>habilidade</th><th>unid.</th><th>custo</th></tr></thead>
        <tbody>${linhas}</tbody>
    </table>` : '<p class="mc-vazio">Nada fora da faixa entre o que foi medido.</p>'}`;
}

/** O rodapé: as 8 Defesas, iguais para todo personagem. */
export function cardDefesa(d) {
    const nome = String(d.nome || '').replace(/^Defesa:\s*/i, '');
    const [curta] = String(d.descricao || '').split(/(?<=\.)\s/);
    return `<details class="mc-defesa">
        <summary>${esc(d.icone || '🛡️')} ${esc(nome)} — ${esc(curta || '')}</summary>
        <p>${esc(d.descricao || '')}</p>
    </details>`;
}
