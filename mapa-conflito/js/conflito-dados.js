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
    ['Reação', '🛡️', 'fora do seu turno'],
    ['Sustentada (1 Padrão/turno)', '♾️', 'custa 1 Padrão a cada turno'],
    ['Fora de combate', '🕯️', 'não cabe numa rodada'],
];

export const SEM_ACAO = 'Sem custo de ação no cadastro';

/** Busca sem acento e sem caixa: "colera" acha "Cólera". */
export const norm = (s) => String(s ?? '').normalize('NFD')
    .replace(/[̀-ͯ]/g, '').toLowerCase();

const rotulos = (mod) => Object.fromEntries((mod.schema || []).map(f => [f.key, String(f.label || '')]));

/** Um id cru na tela é ruído: só sai o que dá para resolver em nome. */
const nomePor = (mapa, v) => mapa[String(v?.id ?? v ?? '')] || null;

/**
 * Uma habilidade pré-cadastrada, achatada no que a tela precisa.
 * @param {object} mod   doc de system/data/classModules
 * @param {object} it    entrada de mod.itensPredefinidos
 * @param {{pericias?:object, condicoes?:object}} mapas  id → nome
 */
export function lerHabilidade(mod, it, mapas = {}) {
    const { pericias = {}, condicoes = {} } = mapas;
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

    const pericia = nomePor(pericias, val(/^teste/i));
    const redutor = val(/^redutor/i);

    return {
        nome: it.nome || '(sem nome)',
        modulo: mod.titulo || '',
        acao: it.valores?.acao || null,
        custo: val(/^custo/i),
        teste: pericia ? (redutor ? `${pericia} ${redutor}` : pericia) : null,
        efeito: it.descricao || val(/^efeito/i) || '',
        falha: val(/^falha/i),
        duracao,
        alcance,
        condicoes: (it.condicoesAplicadas || []).map(c => nomePor(condicoes, c)).filter(Boolean),
        razao: it.regua?.razao || null,
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

/* ── Templates (string pura — nada de document aqui) ──────────────── */

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function cardHabilidade(h) {
    const chips = [
        h.custo && `<span class="mc-chip mc-chip-custo">${esc(h.custo)}</span>`,
        h.teste && `<span class="mc-chip mc-chip-teste">🎲 ${esc(h.teste)}</span>`,
        h.alcance && `<span class="mc-chip">📏 ${esc(h.alcance)}</span>`,
        h.duracao && `<span class="mc-chip">⏳ ${esc(h.duracao)}</span>`,
        ...h.condicoes.map(c => `<span class="mc-chip mc-chip-cond">${esc(c)}</span>`),
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

/** O rodapé: as 8 Defesas, iguais para todo personagem. */
export function cardDefesa(d) {
    const nome = String(d.nome || '').replace(/^Defesa:\s*/i, '');
    const [curta] = String(d.descricao || '').split(/(?<=\.)\s/);
    return `<details class="mc-defesa">
        <summary>${esc(d.icone || '🛡️')} ${esc(nome)} — ${esc(curta || '')}</summary>
        <p>${esc(d.descricao || '')}</p>
    </details>`;
}
