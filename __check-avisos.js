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

const CARTAO = (id, titulo, msg, comprida) => `
    <div class="aviso" data-id="${id}">
        <div class="aviso-icone">&#127873;</div>
        <div class="aviso-corpo">
            <div class="aviso-titulo">${titulo}</div>
            <div class="aviso-msg">${msg}</div>
            ${comprida ? `<button type="button" class="aviso-mais" onclick="avisoVerTudo(this)">Ver tudo</button>` : ''}
            <div class="aviso-pe"><span>Igor</span><span>26/08, 12:14</span></div>
        </div>
        <div class="aviso-bts">
            <button class="btn btn-secondary btn-small" onclick="avisoMarcarLido('${id}')">Resolvido</button>
            <button class="btn btn-danger btn-small" onclick="avisoRecusarItem('${id}')">Recusar</button>
        </div>
    </div>`;

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
                'A peca saiu do Repertorio de Igor e esta na Caixa do Mestre de Bugigangas.', false)}
            ${CARTAO('a2', 'Igor mandou 1x TEste para a mesa',
                'MEDALHAO DO VIAJANTE ASTUTO (Amuleto +5) Caracteristicas Base Tipo: Amuleto/Colar '
                + 'Tamanho: 0,3 (cabe na palma da mao) Peso: 1 (Leve) Dureza: 2 (Bronze e vidro) '
                + 'Integridade: 2,3 Propriedades Magicas Sorte do Viajante (Passivo) +2 dados.', true)}
        </div>`;
    document.body.appendChild(janela);
    janela.addEventListener('click', e => { if (e.target === janela) janela.close(); });
    janela.showModal();
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
