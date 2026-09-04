// =============================================================
// GAVETAS DOS CADASTROS DO PAINEL DO CRIADOR
//
// Os cadastros grandes (Condição 30, Classe 19, Tribo 13, Valor Derivado 19)
// mostravam tudo numa coluna dupla contínua. Aqui se diz apenas em que GAVETA
// cada chave mora — a lista de campos continua em MODULE_DEFS, que é a fonte
// da verdade; isto é só o mapa de leitura.
//
// O Equipamento não está aqui: as gavetas dele moram em shared/equip-campos.js
// porque a Ficha e o Painel do Mestre desenham o MESMO formulário.
//
// ⚠️ Gaveta cujos campos são TODOS condicionais some da tela quando o
// interruptor está desligado. Por isso toda gaveta com campos escondidos
// carrega o próprio interruptor dentro dela (afetaTabuleiro mora na gaveta do
// Tabuleiro, acumulaNiveis na de níveis, testeParaSair na do teste).
// cadastro-secoes.test.mjs cobra as duas coisas: nenhuma chave perdida e
// nenhuma gaveta sem âncora.
//
// Arquivo sem import de propósito: dado puro, para o teste poder lê-lo sem
// subir o Firebase junto.
// =============================================================

/** 💀 Condição — 30 campos, 11 deles pendurados no interruptor do Tabuleiro. */
export const SECOES_CONDICAO = [
    {
        id: 'identidade', icone: '📜', titulo: 'Identidade', aberta: true,
        dica: 'O que a condição é e quanto tempo dura.',
        campos: ['nome', 'icone', 'descricao', 'duracao', 'removivel', 'portao', 'desvantagem'],
    },
    {
        id: 'efeito', icone: '⚡', titulo: 'Efeito na ficha', aberta: true,
        dica: 'O que ela muda em quem está sob ela. O Alvo só vale em teste — dano não é teste.',
        campos: ['efeitoMecanicaIds', 'modAlvoTestes', 'modVd', 'modVdPorNivel'],
    },
    {
        id: 'niveis', icone: '📈', titulo: 'Acúmulo em níveis',
        dica: 'Condição que empilha em vez de repetir. Sem marcar aqui, o nível fica em 1 — em silêncio.',
        campos: ['acumulaNiveis', 'nivelMaximo', 'efeitoPorNivel', 'desvantagemNoNivel', 'trilha'],
    },
    {
        id: 'teste', icone: '🎲', titulo: 'Teste para sair',
        dica: 'Rolagem de 1d10 contra o Alvo, em Graus. Nada de "CD" — esse número não existe neste sistema.',
        campos: ['testeParaSair', 'testeNome', 'testeMod', 'testeQuando', 'testeSucessoRemove', 'testeFalhaAplica', 'testeFalhaRodadas', 'testeMorte'],
    },
    {
        /* O sangramento por rodada quis ser gaveta própria e não pode: os dois
           campos dele penduram no MESMO afetaTabuleiro, então a gaveta sumiria
           junto com o interruptor que a ligaria de volta. Moram aqui porque é
           aqui que eles vivem no dado. cadastro-secoes.test.mjs pegou isso. */
        id: 'tabuleiro', icone: '🗺️', titulo: 'Tabuleiro (VTT)',
        dica: 'Movimento, visão, alvo e sangramento por rodada no mapa. Ligue o interruptor para o resto aparecer.',
        campos: ['afetaTabuleiro', 'bloqueiaAcoes', 'perdeTurno', 'multiplicadorDeslocamento',
            'deslocamentosBloqueados', 'multiplicadorVisao', 'enxergaNoEscuro', 'deixaInvisivel',
            'naoPodeSerAlvo', 'atraiAlvo', 'faccaoForcada', 'porRodadaEfeito', 'porRodadaValor', 'porRodadaPorNivel'],
    },
    {
        id: 'aflicao', icone: '🔒', titulo: 'Aflição',
        dica: 'Condição com cadeado: piora com o tempo e só sai com cura da potência certa (Livro, p. 9).',
        campos: ['aflicao', 'aflicaoPiora', 'aflicaoCura', 'aflicaoDesfecho'],
    },
];

/** ⚔️ Classe — identidade, o que concede e como progride. */
export const SECOES_CLASSE = [
    {
        id: 'identidade', icone: '📜', titulo: 'Identidade', aberta: true,
        dica: 'Quem é a classe e como ela se apresenta.',
        campos: ['nome', 'arquetipo', 'especialidade', 'descricao', 'citacao', 'imagemUrl'],
    },
    {
        id: 'papel', icone: '🎭', titulo: 'Papel na mesa', aberta: true,
        dica: 'O que ela faz em cena e de que recurso vive.',
        campos: ['papelEmCena', 'recursosDaClasse'],
    },
    {
        id: 'inicio', icone: '🎒', titulo: 'Com o que começa',
        dica: 'O que o personagem ganha ao escolher esta classe na criação.',
        campos: ['bonusIniciais', 'kitsIniciais'],
    },
    {
        id: 'concede', icone: '🎯', titulo: 'O que a classe concede',
        dica: 'Perícias, peculiaridades, manobras e vínculos que vêm junto.',
        campos: ['pericClasse', 'peculiaridadeIds', 'manobras', 'mecanicaIds', 'derivedValueIds'],
    },
    {
        id: 'progressao', icone: '📦', titulo: 'Progressão',
        dica: 'Módulos comprados por nível e as rolagens próprias da classe.',
        campos: ['modulosDaClasse', 'testesDeClasse', 'usaRunomancia'],
    },
    {
        id: 'mundo', icone: '📖', titulo: 'Mundo',
        dica: 'Onde a classe está escrita no Worldbuilding.',
        campos: ['livrosVinculados'],
    },
];

/** 🏕️ Tribo — povo, o que ele dá ao personagem e como vive. */
export const SECOES_TRIBO = [
    {
        id: 'identidade', icone: '📜', titulo: 'Identidade', aberta: true,
        dica: 'Quem é o povo.',
        campos: ['nome', 'lema', 'descricao', 'imagemUrl'],
    },
    {
        id: 'concede', icone: '🎯', titulo: 'O que a tribo concede', aberta: true,
        dica: 'O que o personagem ganha por nascer nela.',
        campos: ['peculiaridadeIds', 'derivedValueIds', 'pericias'],
    },
    {
        id: 'sociedade', icone: '🏛️', titulo: 'Cultura e sociedade',
        dica: 'Como o povo vive, se governa e se sustenta.',
        campos: ['cultura', 'governo', 'economia'],
    },
    {
        id: 'militar', icone: '⚔️', titulo: 'Força militar',
        dica: 'Como o povo luta e com que unidades.',
        campos: ['militar', 'unidadesMilitares'],
    },
    {
        id: 'mundo', icone: '📖', titulo: 'Mundo',
        dica: 'Onde a tribo está escrita no Worldbuilding.',
        campos: ['livrosVinculados'],
    },
];

/** 📊 Valor Derivado — o número, onde ele aparece e de onde ele sai. */
export const SECOES_VALOR_DERIVADO = [
    {
        id: 'identidade', icone: '📜', titulo: 'Identidade', aberta: true,
        dica: 'Que número é este e quem o possui.',
        campos: ['nome', 'icone', 'descricao', 'todoPersonagem'],
    },
    {
        id: 'exibicao', icone: '🎨', titulo: 'Como aparece na ficha', aberta: true,
        dica: 'Em que bloco fica, em que ordem e com que prefixo/sufixo.',
        campos: ['blocoId', 'blocoNome', 'blocoOrdem', 'ordem', 'prefixo', 'sufixo'],
    },
    {
        id: 'calculo', icone: '🧮', titulo: 'Cálculo e escopo',
        dica: 'De onde o valor sai e se ele é global ou um por item equipado.',
        campos: ['mecanicaIds', 'escopoItem', 'arredondaMesa'],
    },
    {
        id: 'campos', icone: '✍️', titulo: 'Campos editáveis',
        dica: 'Se tem "Atual" ao lado do máximo e quem pode mexer nele.',
        campos: ['campoAtual', 'contadorDeCena', 'climax', 'campoEditavel', 'statusCombate'],
    },
    {
        id: 'criacao', icone: '🧬', titulo: 'Criação de personagem',
        dica: 'A regra que o wizard usa para este valor, com piso e teto.',
        campos: ['characterCreationRule', 'characterCreationMin', 'characterCreationMax'],
    },
];
