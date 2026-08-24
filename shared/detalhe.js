/* =====================================================================
   🔎 DETALHE DE UM VALOR — a janelinha que abre ao passar o mouse
   ---------------------------------------------------------------------
   Toda ficha do projeto explica um valor ao pousar o mouse no nome dele:
   Vitalidade, Força, Furtividade, Blindagem, Alcance do Disparo. Cada tela
   montava a sua explicação com um conteúdo diferente — a do personagem não
   mostrava fórmula, a do NPC mostrava fórmula mas não dizia para que o valor
   serve, a do Aliado não tinha explicação nenhuma.

   Aqui está o conteúdo, um só, em quatro blocos e nesta ordem:

     1. NOME       — em ouro, no topo. É a âncora: sem ele o leitor não sabe
                     de que valor a caixa está falando quando ela abre longe
                     do rótulo.
     2. DESCRIÇÃO  — o texto do cadastro, como sempre foi.
     3. FÓRMULA    — TUDO que entra na conta daquele valor.
     4. ONDE É USADO — em que outros valores ele entra. Some quando não é
                     usado em lugar nenhum: seção vazia é ruído.

   O índice de uso (4) sai do MESMO registro que alimenta a conta (3), lido ao
   contrário:
     · mecânica cujo `calculo.alvo` é este valor  → ela ALIMENTA o valor;
     · mecânica cuja `equacao` cita este valor    → o `alvo` dela CONSOME.
   Não há cadastro novo para ninguém preencher: o que já está lá responde.

   ⚠️ DOIS TAMANHOS, e a razão importa:

     · o HOVER mostra só nome + descrição + "clique para ver detalhes";
     · o CLIQUE abre uma janela com a fórmula inteira e o "usado em".

   Foi um bug que ensinou isso. Pôr tudo no hover estourava a tela em valor
   denso — a Sanidade tem doze linhas de fórmula, e uma caixa flutuante não
   tem para onde crescer sem sair do viewport: ela saía por cima e as linhas
   longas vazavam pela direita. Janela tem: ela centraliza, limita a altura e
   rola por dentro.

   Quem desenha a caixa do hover (posição, fundo, borda) continua sendo de
   cada tela. A JANELA é daqui, uma só para todas.
   ===================================================================== */

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* Aliases que o cadastro usa para o MESMO alvo. O TARGET_MAP da ficha aceita
   "Vitalidade", "Vitalidade Máxima" e "Vitalidade (Máximo)" — para o índice,
   os três são o mesmo valor. */
const SUFIXOS = /\s*(\(m[áa]ximo\)|m[áa]xim[ao]|\(atual\)|atual)\s*$/i;
export const chaveDoAlvo = (nome) => String(nome ?? '')
    .replace(SUFIXOS, '').trim().toLowerCase();

/** Termo de equação em texto legível: `[FOR] + 2`. */
function termoEmTexto(t) {
    if (!t) return '?';
    if (t.tipo === 'ficha') return t.ref || '?';
    if (t.tipo === 'sort') return `🎲${t.min ?? '?'}–${t.max ?? '?'}`;
    return String(t.valor ?? '?');
}

/** Equação inteira: `FOR + Atletismo + 2`. */
export function equacaoEmTexto(equacao) {
    if (!Array.isArray(equacao) || !equacao.length) return '';
    return equacao.map((t, i) => (i > 0 && t.op ? `${t.op} ` : '') + termoEmTexto(t)).join(' ');
}

/** Os cálculos de uma mecânica, sempre como lista (o formato antigo tinha um só). */
function calculosDa(mec) {
    const cfg = (mec && mec.config) || {};
    if (Array.isArray(cfg.calculos) && cfg.calculos.length) return cfg.calculos;
    if (cfg.alvo || cfg.valor != null) {
        return [{ operacao: cfg.operacao || '+', alvo: cfg.alvo, equacao: [{ valor: cfg.valor }] }];
    }
    return [];
}

/** Alvos de um cálculo, sempre como lista (o cadastro aceita alvo múltiplo). */
const alvosDe = (c) => (Array.isArray(c.alvo) ? c.alvo : [c.alvo]).filter(Boolean);

/**
 * Índice do registro inteiro, nos dois sentidos, de uma passada só.
 *
 *   alimenta[chave] = [{ mecanica, operacao, texto }]   o que ENTRA no valor
 *   consome[chave]  = [{ alvo, mecanica, operacao }]    quem USA o valor
 *
 * Recalcular isso a cada mouse seria varrer o registro inteiro por hover; o
 * índice fica preso ao objeto `sys` que o gerou, então troca de personagem ou
 * recarga do registro constrói um novo sozinha.
 */
const _cache = new WeakMap();
export function indiceDeUso(sys) {
    if (!sys) return { alimenta: {}, consome: {} };
    if (_cache.has(sys)) return _cache.get(sys);

    const alimenta = {}, consome = {};
    const pin = (mapa, chave, item) => {
        if (!chave) return;
        (mapa[chave] = mapa[chave] || []).push(item);
    };

    for (const mec of (sys.mechanics || [])) {
        for (const c of calculosDa(mec)) {
            const texto = equacaoEmTexto(c.equacao) || String(c.valor ?? '');
            const op = c.operacao || '+';
            for (const alvo of alvosDe(c)) {
                pin(alimenta, chaveDoAlvo(alvo), { mecanica: mec, operacao: op, texto, alvo });
                // quem a equação cita, é consumido POR este alvo
                for (const t of (Array.isArray(c.equacao) ? c.equacao : [])) {
                    if (t && t.tipo === 'ficha' && t.ref) {
                        pin(consome, chaveDoAlvo(t.ref), { alvo, mecanica: mec, operacao: op });
                    }
                }
            }
        }
    }

    const idx = { alimenta, consome };
    _cache.set(sys, idx);
    return idx;
}

/** Sem repetir o mesmo alvo duas vezes, e sem apontar para si mesmo. */
function usosDe(nome, sys) {
    const chave = chaveDoAlvo(nome);
    const vistos = new Set();
    return (indiceDeUso(sys).consome[chave] || [])
        .filter(u => {
            const k = chaveDoAlvo(u.alvo);
            if (k === chave || vistos.has(k)) return false;
            vistos.add(k);
            return true;
        })
        .map(u => {
            const via = (u.mecanica && u.mecanica.nome) || '';
            // "Carga via Carga" não informa nada: a mecânica costuma ter o
            // nome do próprio alvo, e aí o "via" só ocupa linha.
            return { alvo: u.alvo, via: chaveDoAlvo(via) === chaveDoAlvo(u.alvo) ? '' : via };
        });
}

/** O que entra na conta, vindo do registro. */
function formulasDe(nome, sys) {
    return (indiceDeUso(sys).alimenta[chaveDoAlvo(nome)] || [])
        .map(f => ({ fonte: (f.mecanica && f.mecanica.nome) || 'Mecânica', texto: `${f.operacao} ${f.texto}`.trim() }));
}

/** Há algo além de nome e descrição? Sem isso, o convite mentiria. */
export function temDetalhe(o = {}) {
    if (!o.nome) return false;
    if ((o.formula || []).some(f => f && (f.texto || f.fonte))) return true;
    if (!o.sys) return false;
    const chave = chaveDoAlvo(o.nome);
    const idx = indiceDeUso(o.sys);
    return !!(idx.alimenta[chave] || []).length || !!usosDe(o.nome, o.sys).length;
}

const bloco = (titulo, itens, classe) => !itens.length ? '' : `
    <div class="lr-det-bloco ${classe}">
        <div class="lr-det-titulo">${titulo}</div>
        ${itens.join('')}
    </div>`;

/**
 * O HTML de dentro da janelinha.
 *
 * @param {object} o
 *   nome        obrigatório — vai em ouro, no topo
 *   icone       opcional, antes do nome
 *   descricao   o texto do cadastro
 *   formula     [{fonte, texto}] — o que a TELA já sabe (a conta do NPC, os
 *               previews da ficha). Junta com o que o registro souber.
 *   sys         o registro (window._systemData / _npcSys) para fórmula e uso
 *   nota        linha solta no fim (ex.: "não é Valor Derivado")
 *
 * @param {'completo'|'resumo'} modo
 *   'resumo' é o do hover: nome, descrição e o convite para abrir a janela.
 *   Sem fórmula e sem "usado em" — é justamente o que não cabia lá.
 */
export function detalheHTML(o = {}, modo = 'completo') {
    const nome = o.nome || '';
    if (!nome) return '';

    if (modo === 'resumo') {
        // `lr-det-resumo` é o que corta a descrição em poucas linhas (CSS)
        return `
    <div class="lr-det lr-det-resumo">
        <div class="lr-det-nome">${o.icone ? esc(o.icone) + ' ' : ''}${esc(nome)}</div>
        ${o.descricao ? `<div class="lr-det-desc">${esc(o.descricao)}</div>` : ''}
        ${temDetalhe(o) ? '<div class="lr-det-mais">🔎 Clique para ver detalhes</div>' : ''}
        ${o.nota ? `<div class="lr-det-nota">${esc(o.nota)}</div>` : ''}
    </div>`;
    }

    const daTela = (o.formula || []).filter(f => f && (f.texto || f.fonte));
    const doRegistro = o.sys ? formulasDe(nome, o.sys) : [];
    // a tela vem primeiro: ela conhece o valor deste personagem, o registro só
    // conhece a regra geral. Sem repetir o mesmo par fonte+texto.
    const formula = [];
    for (const f of [...daTela, ...doRegistro]) {
        if (!formula.some(x => x.fonte === f.fonte && x.texto === f.texto)) formula.push(f);
    }
    const usos = o.sys ? usosDe(nome, o.sys) : [];

    return `
    <div class="lr-det">
        <div class="lr-det-nome">${o.icone ? esc(o.icone) + ' ' : ''}${esc(nome)}</div>
        ${o.descricao ? `<div class="lr-det-desc">${esc(o.descricao)}</div>` : ''}
        ${bloco('🧮 Fórmula', formula.map(f => `
            <div class="lr-det-linha">
                <span class="lr-det-fonte">${esc(f.fonte)}</span>
                <span class="lr-det-valor">${esc(f.texto)}</span>
            </div>`), 'lr-det-formula')}
        ${bloco('🔗 Usado em', usos.map(u => `
            <div class="lr-det-linha">
                <span class="lr-det-fonte">${esc(u.alvo)}</span>
                ${u.via ? `<span class="lr-det-via">via ${esc(u.via)}</span>` : ''}
            </div>`), 'lr-det-uso')}
        ${o.nota ? `<div class="lr-det-nota">${esc(o.nota)}</div>` : ''}
    </div>`;
}

/* =====================================================================
   A JANELA — onde a fórmula inteira cabe

   Aberta pelo clique no rótulo. `<dialog>` nativo: foco preso, Esc e camada
   de topo vêm do navegador, e a altura é limitada com rolagem por dentro —
   que é exatamente o que a caixa flutuante não conseguia dar.
   ===================================================================== */

let _janela = null;
export function abrirDetalhe(o = {}) {
    const html = detalheHTML(o, 'completo');
    if (!html) return;
    if (!_janela) {
        _janela = document.createElement('dialog');
        _janela.className = 'lr-det-janela';
        // clique fora fecha: a janela é de leitura, não pede decisão
        _janela.addEventListener('click', (e) => { if (e.target === _janela) _janela.close(); });
        document.body.appendChild(_janela);
    }
    _janela.innerHTML = `
        <div class="lr-det-janela-corpo">${html}</div>
        <button type="button" class="lr-det-janela-x" aria-label="Fechar">✕</button>`;
    _janela.querySelector('.lr-det-janela-x').addEventListener('click', () => _janela.close());
    if (!_janela.open) _janela.showModal();
}

/* =====================================================================
   A CAIXA — para quem ainda não tem uma

   A Ficha do personagem e a Ficha de NPC já trazem a própria caixa, cada uma
   com o seu jeito (uma encosta no rótulo, a outra segue o cursor). A Ficha de
   Aliado não tinha nenhuma: ela usava `title=`, a caixinha do sistema
   operacional, que no celular ninguém vê e que não mostra fórmula nenhuma.

   `ligarDetalhe(raiz)` resolve isso por delegação: qualquer elemento com
   `data-det-nome` ganha a janelinha, e a lista de campos é a mesma dos outros:
     data-det-nome · data-det-icone · data-det-desc · data-det-formula · data-det-nota
   `data-det-formula` é uma linha por fonte, no formato "fonte: texto".
   ===================================================================== */

let _caixa = null;
function caixa() {
    if (_caixa) return _caixa;
    _caixa = document.createElement('div');
    _caixa.className = 'lr-det-caixa';
    _caixa.setAttribute('role', 'tooltip');
    document.body.appendChild(_caixa);
    return _caixa;
}

const linhasDeFormula = (bruto) => String(bruto || '')
    .split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    .map(l => {
        const i = l.indexOf(':');
        return i < 0 ? { fonte: l, texto: '' } : { fonte: l.slice(0, i).trim(), texto: l.slice(i + 1).trim() };
    });

/**
 * Encosta a caixa no rótulo sem deixar NADA dela fora da tela.
 *
 * As três telas tinham cada uma a sua versão disto, e as três erravam do mesmo
 * jeito: quando não cabia embaixo, jogavam a caixa para cima do rótulo — sem
 * conferir se cabia LÁ. Em rótulo perto do topo (a Sanidade, no rodapé da
 * ficha, com descrição de cinco parágrafos) ela saía pelo topo da janela e o
 * começo do texto ficava inalcançável.
 *
 * Aqui a ordem é: escolhe o lado com mais espaço, corta a altura no que couber
 * (a caixa rola por dentro), e só então prende dentro das bordas.
 *
 * Sem requestAnimationFrame de propósito: a medição tem de valer AGORA, e em
 * aba de segundo plano o rAF não chega — a caixa ficava na posição de antes.
 *
 * @param {HTMLElement} c   a caixa
 * @param {HTMLElement} el  o rótulo
 * @param {{margem?:number}} [opts]
 */
export function posicionarCaixa(c, el, opts = {}) {
    const margem = opts.margem ?? 8;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;

    // mede solta, para saber a altura natural
    c.style.maxHeight = '';
    c.style.left = '0px';
    c.style.top = '0px';
    const alturaNatural = c.offsetHeight;
    const largura = c.offsetWidth;

    const espacoAbaixo = vh - r.bottom - margem * 2;
    const espacoAcima = r.top - margem * 2;
    const abaixo = espacoAbaixo >= alturaNatural || espacoAbaixo >= espacoAcima;
    const teto = Math.max(120, abaixo ? espacoAbaixo : espacoAcima);

    // não cabe inteira de nenhum lado: corta e deixa rolar por dentro
    if (alturaNatural > teto) c.style.maxHeight = teto + 'px';
    const altura = Math.min(alturaNatural, teto);

    let top = abaixo ? r.bottom + margem / 2 : r.top - altura - margem / 2;
    let left = r.left;
    left = Math.min(left, vw - largura - margem);
    top = Math.min(top, vh - altura - margem);
    c.style.left = Math.max(margem, left) + 'px';
    c.style.top = Math.max(margem, top) + 'px';
}

/** Encosta no rótulo e puxa de volta se estourar a janela. */
function posicionar(el) {
    posicionarCaixa(caixa(), el);
}

export function ligarDetalhe(raiz, sysDe) {
    if (!raiz || raiz.dataset.detLigado) return;
    raiz.dataset.detLigado = '1';
    const alvo = (e) => e.target.closest && e.target.closest('[data-det-nome]');
    const descritor = (el) => ({
        nome: el.dataset.detNome,
        icone: el.dataset.detIcone || '',
        descricao: el.dataset.detDesc || '',
        formula: linhasDeFormula(el.dataset.detFormula),
        nota: el.dataset.detNota || '',
        sys: (typeof sysDe === 'function' ? sysDe() : sysDe) || null,
    });

    raiz.addEventListener('mouseover', (e) => {
        const el = alvo(e);
        if (!el) return;
        const html = detalheHTML(descritor(el), 'resumo');
        if (!html) return;
        const c = caixa();
        c.innerHTML = html;
        c.style.display = 'block';
        posicionar(el);
    });
    raiz.addEventListener('mouseout', (e) => {
        if (alvo(e) && _caixa) _caixa.style.display = 'none';
    });
    /* O clique abre a janela — e é também como o celular chega aos detalhes,
       onde hover não existe. */
    raiz.addEventListener('click', (e) => {
        const el = alvo(e);
        if (!el) return;
        const o = descritor(el);
        if (!temDetalhe(o)) return;      // sem fórmula nem uso, a janela não diria nada
        if (_caixa) _caixa.style.display = 'none';
        abrirDetalhe(o);
    });
}

if (typeof window !== 'undefined') {
    /* Ponte para os scripts CLÁSSICOS da Ficha, que não importam. */
    window.LRDetalhe = { detalheHTML, indiceDeUso, equacaoEmTexto, chaveDoAlvo,
        ligarDetalhe, abrirDetalhe, temDetalhe, posicionarCaixa };
}
