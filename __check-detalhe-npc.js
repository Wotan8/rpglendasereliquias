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
    // Vitalidade e Sanidade sao Status Vitais: todo NPC tem, vinculado ou nao.
    vitalStats: [
        { key: 'VIT', nome: 'Vitalidade' },
        { key: 'SAN', nome: 'Sanidade' },
    ],
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
/* O F que a ficha de NPC mantem aberta. Este NPC tem Blindagem vinculada e
   NAO tem Resistencia de Voo — que e exatamente o caso do pescador que via
   "usado em: Resistencia de Voo" na janela dele. */
window.F = { npc: { valoresDer: { vinculados: ['BLD'] } }, sys: SYS };
new Function(recorte
    + '\nwindow._descritorDoRotulo = _descritorDoRotulo;'
    + '\nwindow._alvoExisteNaFicha = _alvoExisteNaFicha;')();

/* --- o MARKUP REAL do rotulo, tambem recortado do modulo ---------------- */
const molde = src.slice(src.indexOf('<div class="npcv2-dv-label" tabindex'), src.indexOf('${dv.icone ? dv.icone'));
const TEM_ONCLICK = molde.includes('onclick="abrirDetalheNpc(this)"');
const TEM_TECLADO = molde.includes('onkeydown=');

const rotulo = (nome, icone, desc, formula, total) => `
    <div class="npcv2-dv-cell">
        <div class="npcv2-dv-label" tabindex="0" role="button"
             data-tt-title="${nome}" data-tt-icone="${icone}"
             data-tt-desc="${desc}" data-tt-formula="${formula || ''}"
             ${total !== undefined ? `data-tt-total="${total}"` : ''}
             onclick="abrirDetalheNpc(this)"
             onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();abrirDetalheNpc(this)}">
             ${icone} ${nome}</div>
    </div>`;

/* A conta como o motor a entrega: "fonte: passo ⟹ acumulado". */
const PASSOS = [
    'Base de Vitalidade: + VIG + Tamanho ⟹ 3',
    'Porte do Corpo: ×3 ⟹ 9',
    'CORPO FRÁGIL VIT: −2 ⟹ 7',
    'Vitalidade Mínima: no mínimo 1 ⟹ 7',
].join('&#10;');

document.getElementById('chkGrid').innerHTML =
      rotulo('Vitalidade', '❤️', 'A integridade fisica do personagem.', PASSOS, 7)
    + rotulo('Sanidade', '🧠', 'O quanto a mente aguenta.', '')
    + rotulo('Blindagem', '🛡️', 'O que barra o golpe.', '');

window.chkDetalhe = async function () {
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
        teste('mostra a formula desta ficha', txt.includes('VIG + Tamanho'), 'do data-tt-formula');
        teste('mostra a formula do registro', txt.includes('VIG × 3 + Tamanho'), 'de mechanics.equacao');
        teste('mostra ONDE o valor e usado', !!j.querySelector('.lr-det-uso') && txt.includes('Blindagem'));
        teste('o "usado em" nomeia a mecanica', txt.includes('Blindagem Natural'));
        teste('a janela nao repete o convite do hover', !txt.includes('Clique para ver detalhes'));

        // --- didatica da conta ---
        teste('a conta e a regra ficam em blocos separados',
            !!j.querySelector('.lr-det-formula') && !!j.querySelector('.lr-det-regra'));
        const titulos = [...j.querySelectorAll('.lr-det-titulo')].map(t => t.textContent.trim());
        teste('cada bloco diz o que e', titulos.some(t => /conta desta ficha/i.test(t))
            && titulos.some(t => /regra no registro/i.test(t)), titulos.join(' | '));

        const passos = [...j.querySelectorAll('.lr-det-formula .lr-det-passo')];
        teste('um passo por operacao, na ordem', passos.length === 4, passos.length + ' passos');
        teste('cada passo e numerado',
            passos.map(p => p.querySelector('.lr-det-passo-n')?.textContent.trim()).join('') === '1234');
        teste('cada passo mostra o acumulado',
            passos.map(p => p.querySelector('.lr-det-parcial')?.textContent.trim()).join(',') === '3,9,7,7');
        teste('o acumulado nao vira o nome da fonte',
            passos[0].querySelector('.lr-det-fonte').textContent.includes('Base de Vitalidade')
            && !passos[0].querySelector('.lr-det-fonte').textContent.includes('⟹'));
        // Duas mecanicas intrinsecas do mesmo VD tinham o rotulo identico
        // ("Formula (Vitalidade)") e viravam duas linhas indistinguiveis.
        const fontes = passos.map(p => p.querySelector('.lr-det-fonte').textContent.trim());
        teste('passos diferentes tem nomes diferentes',
            new Set(fontes).size === fontes.length, fontes.join(' | '));
        teste('o motor nomeia a intrinseca pela mecanica, nao por "Formula (VD)"',
            /fonte: mech\.nome \|\|/.test(await (await fetch('painel-mestre/js/npc-calc-engine.js')).text()));
        const total = j.querySelector('.lr-det-total');
        teste('a conta fecha com o resultado', !!total && total.textContent.includes('7'));
        teste('a legenda explica a coluna da direita', !!j.querySelector('.lr-det-legenda'));
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

    /* 5) "Usado em" so cita VD que ESTA ficha tem.
       O caso real: a Vitalidade entra na conta da Resistencia de Voo, e o
       pescador — que nao voa e nao tem esse VD vinculado — via isso na janela. */
    fechar();
    SYS.derivedValues.push({ key: 'RVOO', nome: 'Resistencia de Voo', icone: '🕊️', descricao: 'Quanto voa.' });
    SYS.mechanics.push({ id: 'm4', nome: 'Resist. De Voo',
        config: { calculos: [{ operacao: '+', alvo: 'Resistencia de Voo',
            equacao: [{ tipo: 'ficha', ref: 'Vitalidade' }] }] } });
    delete SYS._idx;   // o indice e cacheado por objeto sys
    const sysNovo = { ...SYS };
    window._npcSys = sysNovo;

    const base = { nome: 'Vitalidade', sys: sysNovo, formula: [{ fonte: 'x', texto: '+1' }] };
    const semFiltro = window.LRDetalhe.detalheHTML(base, 'completo');
    teste('sem filtro, o registro cita a Resistencia de Voo',
        semFiltro.includes('Resistencia de Voo'), 'e o que a ficha fazia antes');

    // O filtro REAL da ficha de NPC, recortado do modulo
    const temAlvo = window._alvoExisteNaFicha;
    const comFiltro = window.LRDetalhe.detalheHTML({ ...base, temAlvo }, 'completo');
    teste('com o filtro da ficha, VD nao vinculado some',
        !comFiltro.includes('Resistencia de Voo'));
    teste('o filtro nao derruba VD vinculado', comFiltro.includes('Blindagem'));
    teste('Status Vital passa mesmo sem estar em vinculados', temAlvo('Sanidade'));
    teste('o filtro nao esconde o que nao e Valor Derivado',
        temAlvo('Furtividade') && temAlvo('FOR'), 'pericia e atributo passam direto');
    teste('a ficha de NPC entrega o filtro no descritor',
        typeof window._descritorDoRotulo(rotulos[0]).temAlvo === 'function');

    fechar();
    document.getElementById('chkLog').textContent = log.join('\n');
    document.getElementById('chkResumo').textContent = falhas ? `${falhas} falha(s)` : 'tudo OK';
    return { falhas, log };
};
