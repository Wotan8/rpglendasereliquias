/* Check da Caixa de Avisos — monta a janela com o MESMO markup de
   painel-mestre/js/avisos.js e clica em cada botao de verdade.
   Nao importa avisos.js porque ele puxa Firestore na carga; o markup e uma
   copia, e chkCopiaEmDia() avisa quando ela ficar para tras. */

const chamadas = [];
window.avisoMarcarLido = (id) => chamadas.push('avisoMarcarLido(' + id + ')');
window.avisoRecusarItem = (id) => chamadas.push('avisoRecusarItem(' + id + ')');
window.avisoMarcarTudo = () => chamadas.push('avisoMarcarTudo()');
window.avisoIrParaNpc = (id) => chamadas.push('avisoIrParaNpc(' + id + ')');
window.avisoVerTudo = function (bt) {
    chamadas.push('avisoVerTudo()');
    const c = bt.closest('.aviso'); if (!c) return;
    bt.textContent = c.classList.toggle('aberto') ? 'Ver menos' : 'Ver tudo';
};

let janela = null;

/* Copia de separarMensagem()/blocoDoItem() de avisos.js. */
function separarMensagem(msg) {
    const s = String(msg || '').trim();
    const corte = s.lastIndexOf(' — "');
    if (corte < 0 || !s.endsWith('"')) return { aviso: s, item: '' };
    return { aviso: s.slice(0, corte).trim(), item: s.slice(corte + 4, -1).trim() };
}
function blocoDoItem(texto) {
    if (!texto) return '';
    const linhas = texto.split(/\r?\n/);
    const primeira = linhas[0].trim();
    const temNome = linhas.length > 1 && primeira.length <= 120;
    const resto = temNome ? linhas.slice(1).join('\n').replace(/^\s*\n/, '') : texto;
    return `<div class="aviso-item">
                ${temNome ? `<div class="aviso-item-nome">${primeira}</div>` : ''}
                <div class="aviso-item-corpo">${resto}</div>
            </div>`;
}

const CARTAO = (id, titulo, msg) => {
    const { aviso, item } = separarMensagem(msg);
    return `
    <div class="aviso" data-id="${id}">
        <div class="aviso-icone">&#127873;</div>
        <div class="aviso-corpo">
            <div class="aviso-titulo">${titulo}</div>
            <div class="aviso-msg">${aviso}</div>
            ${blocoDoItem(item)}
            ${item.length > 260 ? `<button type="button" class="aviso-mais" onclick="avisoVerTudo(this)">Ver tudo</button>` : ''}
            <div class="aviso-pe"><span>Igor</span><span>26/08, 12:14</span></div>
        </div>
        <div class="aviso-bts">
            <button class="btn btn-secondary btn-small" onclick="avisoMarcarLido('${id}')">Resolvido</button>
            <button class="btn btn-danger btn-small" onclick="avisoRecusarItem('${id}')">Recusar</button>
        </div>
    </div>`;
};

/* A ficha vem de um textarea: as quebras de linha sao do jogador. */
const FICHA = [
    'MEDALHAO DO VIAJANTE ASTUTO (Amuleto +5)',
    'Caracteristicas Base',
    'Tipo: Amuleto/Colar',
    'Tamanho: 0,3 (cabe na palma da mao)',
    'Peso: 1 (Leve)',
    'Dureza: 2 (Bronze e vidro)',
    'Integridade: 2,3',
    'Propriedades Magicas',
    'Sorte do Viajante (Passivo) +2 dados em testes de Sobrevivencia',
    'Linguas Distantes (Passivo) +2 dados em Diplomacia ou Barganha',
    'Total de Bonus: +5',
    'Aparencia',
    'Um medalhao de bronze oxidado com um pequeno compasso de vidro no centro.',
    'Historia',
    'Forjado por mercadores da Guilda dos Caminhos Longos.',
].join('\n');

window.abrirAvisos = function () {
    if (janela) janela.remove();
    janela = document.createElement('dialog');
    janela.className = 'lr-caixa-avisos';
    janela.innerHTML = `
        <div class="avisos-topo">
            <span class="avisos-titulo">Avisos dos jogadores <span class="avisos-conta">2</span>
                <span class="avisos-mesa">Bugigangas</span></span>
            <div class="avisos-acoes">
                <button class="avisos-icone" id="btnLerTudo" onclick="avisoMarcarTudo()" title="Marcar todos como resolvidos">
                    <svg class="lr-ico"><use href="#i-check"/></svg></button>
                <button class="avisos-icone" onclick="this.closest('dialog').close()" title="Fechar">
                    <svg class="lr-ico"><use href="#i-fechar"/></svg></button>
            </div>
        </div>
        <div class="avisos-lista" id="avisosLista">
            ${CARTAO('a1', 'Igor mandou 1x Influencia para a mesa',
                'A peca saiu do Repertorio de Igor e esta na Caixa do Mestre de Bugigangas. '
                + 'Falta voce coloca-la no mundo para o jogador encontrar.')}
            ${CARTAO('a2', 'Igor mandou 1x TEste para a mesa',
                'A peca saiu do Repertorio de Igor e esta na Caixa do Mestre de Bugigangas. '
                + 'Falta voce coloca-la no mundo para o jogador encontrar. — "' + FICHA + '"')}
        </div>`;
    document.body.appendChild(janela);
    janela.addEventListener('click', e => { if (e.target === janela) janela.close(); });
    janela.showModal();
};

/* As regras do texto: o que separa o recado do sistema da ficha do jogador,
   o que vira nome dourado e o que sobrevive de quebra de linha. */
window.chkTexto = function () {
    const log = [];
    let falhas = 0;
    const teste = (nome, ok, detalhe) => {
        if (!ok) falhas++;
        log.push(`${ok ? 'OK ' : 'NAO'} | ${nome}${detalhe ? '  -> ' + detalhe : ''}`);
    };
    const bloco = (txt) => { const d = document.createElement('div'); d.innerHTML = blocoDoItem(txt); return d; };

    const comFicha = separarMensagem('Recado do sistema. — "NOME DO ITEM\nlinha dois"');
    teste('separa o recado do sistema da ficha', comFicha.aviso === 'Recado do sistema.', comFicha.aviso);
    teste('a ficha sai sem as aspas', comFicha.item === 'NOME DO ITEM\nlinha dois');

    const semFicha = separarMensagem('Personagem entregue, sem ficha colada.');
    teste('aviso sem ficha nao inventa bloco', semFicha.item === '' && !!semFicha.aviso);
    teste('aviso sem ficha nao renderiza bloco', blocoDoItem(semFicha.item) === '');

    const d = bloco('NOME DO ITEM\nCaracteristicas\nTipo: Amuleto');
    teste('a primeira linha vira o nome', d.querySelector('.aviso-item-nome')?.textContent.trim() === 'NOME DO ITEM');
    teste('o nome sai do corpo', !d.querySelector('.aviso-item-corpo').textContent.includes('NOME DO ITEM'));
    teste('as quebras do jogador sobrevivem', d.querySelector('.aviso-item-corpo').textContent.includes('\n'));

    // Ficha colada num paragrafo so: nao ha nome para destacar, e dourar o
    // paredao inteiro seria pior que nao dourar nada.
    const p = bloco('NOME (Amuleto +5) Caracteristicas Base Tipo: Amuleto Peso: 1 Dureza: 2 '
        + 'Propriedades Magicas Sorte do Viajante mais um tanto de texto corrido aqui para passar de cento e vinte.');
    teste('paragrafo unico nao vira nome dourado', !p.querySelector('.aviso-item-nome'));
    teste('paragrafo unico continua inteiro no corpo', p.querySelector('.aviso-item-corpo').textContent.startsWith('NOME (Amuleto +5)'));

    document.getElementById('chkLog').textContent = log.join('\n');
    document.getElementById('chkResumo').textContent = falhas ? `${falhas} regra(s) de texto quebrada(s)` : 'texto OK';
    return { falhas, log };
};

/** A copia do markup acima tem de continuar batendo com a do modulo real. */
async function chkCopiaEmDia() {
    try {
        const src = await (await fetch('painel-mestre/js/avisos.js')).text();
        const faltando = [
            'avisoMarcarLido', 'avisoRecusarItem', 'avisoMarcarTudo', 'avisoVerTudo',
            'avisos-icone', 'aviso-bts', 'aviso-mais', "closest('dialog').close()",
        ].filter(t => !src.includes(t));
        return faltando.length ? 'copia desatualizada, sumiu de avisos.js: ' + faltando.join(', ') : '';
    } catch (e) { return 'nao consegui ler avisos.js: ' + e.message; }
}

/* O teste: para cada botao, quem esta no centro dele (elementFromPoint pega
   overlay invisivel por cima) e se o clique real dispara o handler. */
window.chkClicar = async function () {
    if (!janela?.open) window.abrirAvisos();
    chamadas.length = 0;
    const log = [];
    let falhas = 0;

    const aviso = await chkCopiaEmDia();
    if (aviso) log.push('ATENCAO: ' + aviso, '');

    /* Uma janela NOVA por botao, e o botao localizado por indice dentro dela.
       Reaproveitar a lista entre voltas nao serve: o botao de fechar troca a
       janela, e os botoes da anterior ficam soltos fora do documento — medi-los
       ali acusa uma falha que nao existe. */
    const quantos = janela.querySelectorAll('button').length;

    for (let i = 0; i < quantos; i++) {
        window.abrirAvisos();
        const bt = janela.querySelectorAll('button')[i];
        const rot = (bt.textContent.trim() || bt.title || bt.id || '?').slice(0, 24).padEnd(24);
        const b = bt.getBoundingClientRect();
        const emCima = document.elementFromPoint(
            Math.round(b.left + b.width / 2), Math.round(b.top + b.height / 2));
        const alcanca = bt === emCima || bt.contains(emCima);

        const antes = chamadas.length;
        bt.click();
        const rodou = chamadas.length > antes || !janela.open;   // fechar tambem conta como funcionou

        if (!alcanca || !rodou) falhas++;
        log.push(`${alcanca ? 'OK ' : 'NAO'} alcanca | ${rodou ? 'OK ' : 'NAO'} dispara | ${rot}`
            + (alcanca ? '' : ` <- por cima: ${emCima ? emCima.tagName + '.' + (emCima.className || '') : 'nada'}`));
    }

    log.push('', 'handlers chamados: ' + (chamadas.join(', ') || 'NENHUM'));
    document.getElementById('chkLog').textContent = log.join('\n');
    document.getElementById('chkResumo').textContent = falhas
        ? `${falhas} botao(oes) sem funcionar` : 'todos funcionam';
    return { falhas, log };
};
