/* Check do clique no rotulo de valor da ficha de NPC.

   O bug que este check guarda: o hover dizia "Clique para ver detalhes" e o
   clique nao fazia nada — abrirDetalheNpc() existia em area-npcs.js e nenhum
   rotulo tinha onclick. Aqui o markup do rotulo e o handler sao os REAIS
   (recortados do modulo em tempo de carga), e o clique e de verdade. */

/* --- registro de mecanicas de mentira, no formato do Painel de Criador --- */
const SYS = {
    derivedValues: [
        { key: 'VIT', nome: 'Vitalidade', icone: '❤️', descricao: 'A integridade fisica do personagem.' },
        { key: 'SAN', nome: 'Sanidade', icone: '🧠', descricao: 'O quanto a mente aguenta.' },
        { key: 'BLD', nome: 'Blindagem', icone: '🛡️', descricao: 'O que barra o golpe.' },
    ],
    vitalStats: [],
    mechanics: [
        {   // ALIMENTA a Vitalidade: VIG x 3 + Tamanho
            id: 'm1', nome: 'Base de Vitalidade',
            config: { calculos: [{ operacao: '+', alvo: 'Vitalidade', equacao: [
                { tipo: 'ficha', ref: 'VIG' }, { op: '×', valor: 3 }, { op: '+', tipo: 'ficha', ref: 'Tamanho' },
            ] }] },
        },
        {   // tambem alimenta: bonus de peculiaridade
            id: 'm2', nome: 'Couro Endurecido',
            config: { calculos: [{ operacao: '+', alvo: 'Vitalidade Maxima', equacao: [{ valor: 5 }] }] },
        },
        {   // CONSOME a Vitalidade: ela entra na conta da Blindagem
            id: 'm3', nome: 'Blindagem Natural',
            config: { calculos: [{ operacao: '+', alvo: 'Blindagem', equacao: [
                { tipo: 'ficha', ref: 'Vitalidade' }, { op: '÷', valor: 10 },
            ] }] },
        },
    ],
};

/* --- os HANDLERS REAIS, recortados de painel-mestre/js/area-npcs.js --------
   Recortar em vez de copiar: se o modulo mudar, o check acompanha ou quebra
   alto, em vez de passar testando uma copia velha. */
const src = await (await fetch('painel-mestre/js/area-npcs.js')).text();
const recorte = src.slice(
    src.indexOf('function _formulaDoRotulo'),
    src.indexOf('/* O hover mostra RESUMO'));
if (!recorte.includes('abrirDetalheNpc')) {
    throw new Error('nao achei _formulaDoRotulo/_descritorDoRotulo/abrirDetalheNpc em area-npcs.js');
}
window._npcSys = SYS;
window.hideNpcTooltip = () => {};
new Function(recorte + '\nwindow._descritorDoRotulo = _descritorDoRotulo;')();

/* --- o MARKUP REAL do rotulo, tambem recortado do modulo ---------------- */
const molde = src.slice(src.indexOf('<div class="npcv2-dv-label" tabindex'), src.indexOf('${dv.icone ? dv.icone'));
const TEM_ONCLICK = molde.includes('onclick="abrirDetalheNpc(this)"');
const TEM_TECLADO = molde.includes('onkeydown=');

const rotulo = (nome, icone, desc, formula) => `
    <div class="npcv2-dv-cell">
        <div class="npcv2-dv-label" tabindex="0" role="button"
             data-tt-title="${nome}" data-tt-icone="${icone}"
             data-tt-desc="${desc}" data-tt-formula="${formula || ''}"
             onclick="abrirDetalheNpc(this)"
             onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();abrirDetalheNpc(this)}">
             ${icone} ${nome}</div>
    </div>`;

document.getElementById('chkGrid').innerHTML =
      rotulo('Vitalidade', '❤️', 'A integridade fisica do personagem.', 'Base: VIG x 3 + Tamanho&#10;Couro Endurecido: +5')
    + rotulo('Sanidade', '🧠', 'O quanto a mente aguenta.', '')
    + rotulo('Blindagem', '🛡️', 'O que barra o golpe.', '');

window.chkDetalhe = function () {
    const log = [];
    let falhas = 0;
    const teste = (nome, ok, detalhe) => {
        if (!ok) falhas++;
        log.push(`${ok ? 'OK ' : 'NAO'} | ${nome}${detalhe ? '  -> ' + detalhe : ''}`);
    };
    const janela = () => document.querySelector('dialog.lr-det-janela');
    const fechar = () => { const j = janela(); if (j?.open) j.close(); };

    teste('o modulo liga o clique no rotulo', TEM_ONCLICK,
        TEM_ONCLICK ? '' : 'o markup de area-npcs.js esta sem onclick — o bug voltou');
    teste('o rotulo tambem responde ao teclado', TEM_TECLADO);

    const rotulos = [...document.querySelectorAll('.npcv2-dv-label')];

    // 1) Vitalidade: tem formula da tela E do registro, e e usada pela Blindagem
    fechar();
    rotulos[0].click();
    const j = janela();
    teste('o clique abre a janela', !!j?.open);
    if (j?.open) {
        const txt = j.textContent;
        teste('a janela mostra o nome', txt.includes('Vitalidade'));
        teste('mostra a formula desta ficha', txt.includes('VIG x 3 + Tamanho'), 'do data-tt-formula');
        teste('mostra a formula do registro', txt.includes('VIG × 3 + Tamanho'), 'de mechanics.equacao');
        teste('junta as duas fontes de formula', !!j.querySelector('.lr-det-formula'));
        teste('mostra ONDE o valor e usado', !!j.querySelector('.lr-det-uso') && txt.includes('Blindagem'));
        teste('o "usado em" nomeia a mecanica', txt.includes('Blindagem Natural'));
        teste('a janela nao repete o convite do hover', !txt.includes('Clique para ver detalhes'));
    }

    // 2) Teclado abre a mesma janela
    fechar();
    rotulos[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    teste('Enter no rotulo abre a janela', !!janela()?.open);

    // 3) Blindagem: alimentada pela Vitalidade — o outro sentido do indice
    fechar();
    rotulos[2].click();
    teste('valor sem formula na tela ainda abre pelo registro',
        !!janela()?.open && janela().textContent.includes('Vitalidade'));

    // 4) Sanidade nao entra em conta nenhuma: nada a detalhar, nao abre
    fechar();
    rotulos[1].click();
    teste('valor sem formula e sem uso nao abre janela vazia', !janela()?.open);

    fechar();
    document.getElementById('chkLog').textContent = log.join('\n');
    document.getElementById('chkResumo').textContent = falhas ? `${falhas} falha(s)` : 'tudo OK';
    return { falhas, log };
};
