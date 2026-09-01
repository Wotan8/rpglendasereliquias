/* ═══════════════════════════════════════════════════════════
   wb-tabela.js — operações de tabela do Escritório do Cronista
   ────────────────────────────────────────────────────────────
   Funções puras sobre o DOM da tabela. Vivem fora do wb-rich.js
   porque são a parte que dá para errar em silêncio: mexer em
   coluna de tabela com célula mesclada é onde toda implementação
   ingênua apaga o dado errado.

   A GRADE. `cellIndex` conta CÉLULAS na linha, não COLUNAS na
   tabela — e as duas coisas deixam de ser a mesma no instante em
   que existe um `colspan`. Uma linha com [A(colspan=2)][B] tem B
   no cellIndex 1 e na coluna 2. Remover "a coluna 1" por
   cellIndex apagaria B.

   Por isso tudo aqui passa por `gradeDaTabela()`, que expande
   colspan e rowspan numa matriz de verdade: cada posição aponta
   para a célula que a ocupa, e a mesma célula aparece em várias
   posições. É a única forma de "coluna 2" significar a mesma
   coisa em todas as linhas.
   ═══════════════════════════════════════════════════════════ */

/**
 * Matriz `[linha][coluna] → <td|th>`. A mesma célula aparece em
 * todas as posições que ela ocupa.
 */
export function gradeDaTabela(tabela) {
    const linhas = [...tabela.rows];
    const grade = linhas.map(() => []);
    linhas.forEach((tr, y) => {
        let x = 0;
        for (const cel of tr.cells) {
            while (grade[y][x]) x++;              // posição já tomada por um rowspan de cima
            const cs = Math.max(1, cel.colSpan || 1);
            const rs = Math.max(1, cel.rowSpan || 1);
            for (let dy = 0; dy < rs; dy++) {
                for (let dx = 0; dx < cs; dx++) {
                    if (grade[y + dy]) grade[y + dy][x + dx] = cel;
                }
            }
            x += cs;
        }
    });
    return grade;
}

/** Onde a célula começa na grade: `{ x, y }`, ou null se não achou. */
export function ondeEsta(tabela, cel) {
    const grade = gradeDaTabela(tabela);
    for (let y = 0; y < grade.length; y++) {
        for (let x = 0; x < grade[y].length; x++) {
            if (grade[y][x] === cel) return { x, y };
        }
    }
    return null;
}

export const tabelaDe = (cel) => cel?.closest?.('table') || null;
export const numColunas = (tabela) => Math.max(0, ...gradeDaTabela(tabela).map(l => l.length));

/** A célula vizinha na grade — não na linha. É o que mescla certo. */
export function vizinha(tabela, cel, dir) {
    const p = ondeEsta(tabela, cel); if (!p) return null;
    const grade = gradeDaTabela(tabela);
    const x = dir === 'dir' ? p.x + (cel.colSpan || 1) : p.x;
    const y = dir === 'baixo' ? p.y + (cel.rowSpan || 1) : p.y;
    const alvo = grade[y]?.[x];
    return alvo && alvo !== cel ? alvo : null;
}

/**
 * Junta a célula com a vizinha à direita ou abaixo. Só mescla quando as
 * duas têm o MESMO tamanho no outro eixo — juntar uma célula de 1 linha
 * com uma de 2 deixaria um buraco na grade, e buraco em tabela é linha que
 * some ao imprimir.
 */
export function mesclar(cel, dir) {
    const tabela = tabelaDe(cel); if (!tabela) return false;
    const outra = vizinha(tabela, cel, dir);
    if (!outra) return false;
    if (dir === 'dir' && (cel.rowSpan || 1) !== (outra.rowSpan || 1)) return false;
    if (dir === 'baixo' && (cel.colSpan || 1) !== (outra.colSpan || 1)) return false;

    const texto = outra.innerHTML.replace(/<br\s*\/?>/gi, '').trim();
    if (texto) cel.innerHTML = (cel.innerHTML.replace(/<br\s*\/?>/gi, '').trim() + ' ' + texto).trim();
    if (dir === 'dir') cel.colSpan = (cel.colSpan || 1) + (outra.colSpan || 1);
    else cel.rowSpan = (cel.rowSpan || 1) + (outra.rowSpan || 1);
    outra.remove();
    return true;
}

/** Desfaz a mesclagem: a célula volta a 1×1 e as vagas viram células. */
export function dividir(cel) {
    const tabela = tabelaDe(cel); if (!tabela) return false;
    const cs = cel.colSpan || 1, rs = cel.rowSpan || 1;
    if (cs === 1 && rs === 1) return false;
    const p = ondeEsta(tabela, cel);
    cel.colSpan = 1; cel.rowSpan = 1;
    /* Reconstrói a grade DEPOIS de encolher: as vagas só existem agora, e
       inserir olhando a grade velha poria a célula nova no lugar errado. */
    for (let dy = 0; dy < rs; dy++) {
        for (let dx = 0; dx < cs; dx++) {
            if (dx === 0 && dy === 0) continue;
            inserirNaVaga(tabela, p.x + dx, p.y + dy, cel.tagName);
        }
    }
    return true;
}

/** Cria uma célula na posição (x, y) da grade, respeitando quem já ocupa. */
function inserirNaVaga(tabela, x, y, tag) {
    const tr = tabela.rows[y]; if (!tr) return;
    const grade = gradeDaTabela(tabela);
    const nova = document.createElement(tag === 'TH' ? 'th' : 'td');
    nova.innerHTML = '<br>';
    // A primeira célula da linha que começa DEPOIS de x é o ponto de inserção.
    let antes = null;
    for (const c of tr.cells) {
        const pos = grade[y].indexOf(c);
        if (pos >= x) { antes = c; break; }
    }
    tr.insertBefore(nova, antes);
}

/** Linha nova, com a mesma contagem de colunas da tabela. */
export function inserirLinha(cel, onde = 'abaixo') {
    const tabela = tabelaDe(cel); if (!tabela) return false;
    const tr = cel.closest('tr'); if (!tr) return false;
    const cols = numColunas(tabela);
    const nova = tr.cloneNode(false);
    for (let i = 0; i < cols; i++) {
        const c = document.createElement('td');
        c.innerHTML = '<br>';
        nova.appendChild(c);
    }
    tr.parentNode.insertBefore(nova, onde === 'acima' ? tr : tr.nextSibling);
    return true;
}

export function removerLinha(cel) {
    const tabela = tabelaDe(cel); if (!tabela) return false;
    const tr = cel.closest('tr'); if (!tr) return false;
    // Tabela sem linha nenhuma é um <table> invisível que ninguém consegue
    // clicar para apagar depois.
    if (tabela.rows.length <= 1) return false;
    /* Um rowspan que atravessava esta linha precisa encolher, senão ele
       passa a invadir a linha de baixo. */
    const grade = gradeDaTabela(tabela);
    const y = [...tabela.rows].indexOf(tr);
    const jaEncolhida = new Set();
    for (const c of grade[y] || []) {
        if (!c || jaEncolhida.has(c) || c.closest('tr') === tr) continue;
        jaEncolhida.add(c);
        c.rowSpan = Math.max(1, (c.rowSpan || 1) - 1);
    }
    tr.remove();
    return true;
}

/** Coluna nova à esquerda ou à direita da coluna onde a célula está. */
export function inserirColuna(cel, onde = 'dir') {
    const tabela = tabelaDe(cel); if (!tabela) return false;
    const p = ondeEsta(tabela, cel); if (!p) return false;
    const x = onde === 'dir' ? p.x + (cel.colSpan || 1) : p.x;
    const grade = gradeDaTabela(tabela);
    const feitas = new Set();
    for (let y = 0; y < tabela.rows.length; y++) {
        const ocupante = grade[y]?.[x - (onde === 'dir' ? 1 : 0)];
        /* Célula mesclada que ATRAVESSA o ponto de inserção não ganha
           vizinha: ela cresce. Inserir ao lado dela empurraria a grade e
           desalinharia todas as linhas de baixo. */
        if (ocupante && (ocupante.colSpan || 1) > 1 && grade[y]?.[x] === ocupante) {
            if (!feitas.has(ocupante)) { ocupante.colSpan++; feitas.add(ocupante); }
            continue;
        }
        const tag = tabela.rows[y].cells[0]?.tagName || 'TD';
        inserirNaVaga(tabela, x, y, tag);
    }
    return true;
}

export function removerColuna(cel) {
    const tabela = tabelaDe(cel); if (!tabela) return false;
    if (numColunas(tabela) <= 1) return false;
    const p = ondeEsta(tabela, cel); if (!p) return false;
    const grade = gradeDaTabela(tabela);
    const vistas = new Set();
    for (let y = 0; y < grade.length; y++) {
        const c = grade[y]?.[p.x];
        if (!c || vistas.has(c)) continue;
        vistas.add(c);
        // Mesclada horizontalmente: encolhe em vez de sumir com o conteúdo
        // das outras colunas que ela também ocupa.
        if ((c.colSpan || 1) > 1) c.colSpan--;
        else c.remove();
    }
    return true;
}

/** Pinta o fundo. `escopo`: 'cel' | 'linha' | 'coluna'. Cor '' limpa. */
export function pintar(cel, cor, escopo = 'cel') {
    const tabela = tabelaDe(cel); if (!tabela) return false;
    let alvos = [cel];
    if (escopo === 'linha') alvos = [...(cel.closest('tr')?.cells || [])];
    if (escopo === 'coluna') {
        const p = ondeEsta(tabela, cel); if (!p) return false;
        const grade = gradeDaTabela(tabela);
        alvos = [...new Set(grade.map(l => l[p.x]).filter(Boolean))];
    }
    for (const c of alvos) {
        if (cor) c.style.backgroundColor = cor;
        else c.style.removeProperty('background-color');
    }
    return true;
}

/**
 * Largura da coluna, em % da tabela. Vai como custom property e não como
 * `width`: `width` está fora do filtro do sanitizador de propósito (é por
 * onde o HTML colado do Word entra com layout em pixel), e reabri-lo para
 * a tabela reabriria para tudo.
 */
export function larguraColuna(cel, pct) {
    const tabela = tabelaDe(cel); if (!tabela) return false;
    const p = ondeEsta(tabela, cel); if (!p) return false;
    const grade = gradeDaTabela(tabela);
    const alvos = [...new Set(grade.map(l => l[p.x]).filter(Boolean))];
    for (const c of alvos) {
        if (pct) c.style.setProperty('--tm-col-larg', Math.min(95, Math.max(3, Math.round(pct))) + '%');
        else c.style.removeProperty('--tm-col-larg');
    }
    return true;
}

/** A largura gravada nesta coluna, ou 0 quando é automática. */
export function larguraDe(cel) {
    return parseFloat(String(cel?.style?.getPropertyValue('--tm-col-larg') || '').replace('%', '')) || 0;
}
