/* ===== DADOS DE RAÇAS ===== */

const RACES = {
    'Humano': {
        tamanho: 5,
        subtitulo: 'Sem Essência — Os Ungidos — Os Protegidos',
        peculiaridades: [
            {
                key: 'aprendizado_acelerado',
                nome: 'Aprendizado Acelerado',
                nivel: 4,
                tipo: 'fixo',
                descricao: 'A capacidade de aprender novas coisas durante seu crescimento (infância, adolescência) é acima da média. Humanos absorvem conhecimento com velocidade impressionante.',
                efeito: '+4 níveis para distribuir em qualquer Perícia na criação do personagem. (Não pode ser na mesma perícia)',
                icone: '📖'
            },
            {
                key: 'forca_vontade_natural',
                nome: 'Força de Vontade Natural',
                nivel: 1,
                tipo: 'fixo',
                descricao: 'Este usuário tem uma Determinação natural, devido ao seu histórico ou talvez de nascença. Uma fagulha interior que se recusa a apagar.',
                efeito: '+1 ponto de Determinação Máxima na criação de personagem.',
                icone: '🔥'
            },
            {
                key: 'expectativa_vida_curta',
                nome: 'Expectativa de Vida Curta',
                nivel: 1,
                tipo: 'fixo',
                descricao: 'Expectativa de vida curta, envelhecem mais rápido, limitados por linhas temporais curtas. Onde outras raças veem décadas, humanos veem urgência.',
                efeito: 'Desvantagem narrativa: vida mais curta comparada a outras raças.',
                icone: '⏳',
                negativo: true
            },
            {
                key: 'natureza_autodestrutiva',
                nome: 'Natureza Autodestrutiva',
                nivel: 1,
                tipo: 'fixo',
                descricao: 'São inclinados ao vício, conflito interno e corrupção moral. A mesma ambição que os impulsiona pode ser sua ruína.',
                efeito: '−1 no Alvo de testes de interação com o Abismo e para resistir às suas tendências naturais destrutivas.',
                icone: '💀',
                negativo: true
            }
        ]
    },

    'Elorin': {
        tamanho: 5,
        subtitulo: 'Filhos da Floresta — Os Verdes',
        peculiaridades: [
            {
                key: 'resistencia_venenos',
                nome: 'Resistência a Venenos Naturais',
                tipo: 'fixo',
                nivel: 1,
                descricao: 'É fisicamente resistente a venenos provenientes da natureza que não foram modificados ou alterados por alquimia.',
                efeito: '+1 no Alvo de testes contra Venenos Naturais.',
                icone: '🛡️'
            },
            {
                key: 'visao_essencia',
                nome: 'Visão de Essência',
                tipo: 'fixo',
                nivel: null,
                descricao: 'Pode enxergar as essências externalizadas de um corpo ou objeto, difusas no ambiente em suas respectivas cores, "acendendo" seus olhos com um brilho esverdeado.',
                efeito: 'Permite identificar tipos de essência e detectar magia ativa. Não revela detalhes específicos sobre feitiços.',
                icone: '👁️'
            },
            {
                key: 'conexao_natureza',
                nome: 'Conexão com a Natureza',
                tipo: 'fixo',
                nivel: 1,
                descricao: 'Permite controlar pequenas porções de essência verde de algum elemento da natureza, extraindo-o, inserindo-o ou transformando de essência para matéria ou vice-versa.',
                efeito: 'Teste de DES + AUT. Manipulação sutil de plantas e elementos naturais.',
                icone: '🌿'
            },
            {
                key: 'saturacao_verde',
                nome: 'Saturação Verde',
                tipo: 'fixo',
                nivel: 1,
                descricao: 'O usuário tem a capacidade de absorver a essência verde presente na floresta e se sente saciado três quartos (3/4) do dia apenas por estar em meio à natureza verde.',
                efeito: 'Reduz necessidade de alimentação oral quando em ambientes naturais.',
                icone: '🍃'
            },
            {
                key: 'fraqueza_urbana',
                nome: 'Fraqueza Urbana',
                tipo: 'fixo',
                nivel: 1,
                descricao: 'Perdem seu vigor natural ao se afastarem do ambiente verde. Construções de pedra e metal drenam sua energia.',
                efeito: '−1 no Alvo de testes físicos ou de percepção em ambientes urbanos ou construídos. Não se aplica em florestas, cavernas naturais ou locais de forte presença vegetal.',
                icone: '🏙️',
                negativo: true
            }
        ]
    },

    'Karu-Real': {
        tamanho: 5,
        subtitulo: 'Os Ruivos — Os Escolhidos — Os Aristocratas',
        peculiaridades: [
            {
                key: 'linhagem_abencoada',
                nome: 'Linhagem Abençoada',
                tipo: 'fixo',
                nivel: null,
                descricao: 'Os Karu-Reais mantiveram a bênção original dos criadores, sendo reconhecidos como dignos de receber dons divinos e curas sagradas.',
                efeito: '+1 no Alvo de testes para receber bênçãos divinas, curas sagradas ou interagir com relíquias de fé.',
                icone: '✨'
            },
            {
                key: 'presenca_imponente',
                nome: 'Presença Imponente',
                tipo: 'evolutivo',
                nivelAtual: 1,
                nivelMax: 5,
                descricao: 'A postura e o porte natural de um Karu-Real inspiram respeito e, em muitos, temor reverencial. Sua presença domina ambientes sociais.',
                niveis: {
                    1: { efeito: '+1 no Alvo de testes de Intimidação e Liderança.', custo: '—' },
                    2: { efeito: '+2 no Alvo de testes de Intimidação e Liderança.', custo: '5 EXP' },
                    3: { efeito: '+3 no Alvo de testes de Intimidação e Liderança.', custo: '10 EXP' },
                    4: { efeito: '+4 no Alvo de testes de Intimidação e Liderança.', custo: '25 EXP' },
                    5: { efeito: '+5 no Alvo de testes de Intimidação e Liderança.', custo: '40 EXP' }
                },
                icone: '👑'
            },
            {
                key: 'educacao_aristocratica',
                nome: 'Educação Aristocrática',
                tipo: 'fixo',
                nivel: 1,
                descricao: 'Desde a infância, os Karu-Reais são treinados em etiqueta, política, história e artes arcanas. Sua educação é completa e refinada.',
                efeito: '+1 nível em uma Perícia Mental de escolha na criação do personagem.',
                icone: '📚'
            },
            {
                key: 'orgulho_inflexivel',
                nome: 'Orgulho Inflexível',
                tipo: 'fixo',
                nivel: null,
                descricao: 'O orgulho de um Karu-Real é tanto sua força quanto sua fraqueza. Não toleram humilhações e podem agir irracionalmente quando sua honra é questionada.',
                efeito: '−2 no Alvo de testes de AUT para resistir a provocações que ataquem sua honra ou linhagem. Deve fazer teste ou reagir agressivamente.',
                icone: '⚔️',
                negativo: true
            },
            {
                key: 'odio_selvagens',
                nome: 'Ódio dos Karu-Selvagens',
                tipo: 'fixo',
                nivel: null,
                descricao: 'Vistos como opressores por seus primos amaldiçoados, os Karu-Reais são alvos de ódio ancestral.',
                efeito: 'Karu-Selvagens tendem a atacá-los ou dificultar negociações. Pode atrair conflitos automáticos ou rejeição em territórios Selvagens.',
                icone: '🔥',
                negativo: true
            }
        ]
    },

    'Karu-Selvagem': {
        tamanho: 5,
        subtitulo: 'Juba-Vermelha — Os Amaldiçoados — Pés-Contrário',
        peculiaridades: [
            {
                key: 'cabeca_quente',
                nome: 'Cabeça Quente',
                tipo: 'fixo',
                nivel: null,
                descricao: 'Pode incendiar os cabelos voluntariamente, tornando-se mais ágil e perigoso, mas arriscando perder o controle para a fúria.',
                efeito: 'Exige teste de AUT por cena. Falha: sofre dano de sanidade e entra em fúria temporária. Sucesso: +1 no Alvo de testes de RAC, FOR, DES, VIG e PRE enquanto o fogo estiver ativo.',
                icone: '🔥'
            },
            {
                key: 'pes_invertidos',
                nome: 'Pés Invertidos',
                tipo: 'fixo',
                nivel: 1,
                descricao: 'Os movimentos de um Karu-Selvagem são difíceis de prever devido à estrutura invertida de suas pernas. Confundem adversários em combate próximo.',
                efeito: '+1 nível em Briga e Esquiva.',
                icone: '🦶'
            },
            {
                key: 'sangue_impuro',
                nome: 'Sangue Impuro',
                tipo: 'fixo',
                nivel: 1,
                descricao: 'Sofrem discriminação ou exclusão em ambientes religiosos ou espirituais. A maldição em seu sangue repele o sagrado.',
                efeito: 'Podem ser impedidos de acessar bênçãos divinas, curas sagradas ou relíquias de fé. −1 no Alvo de testes envolvendo favores divinos.',
                icone: '🩸',
                negativo: true
            },
            {
                key: 'rebelde',
                nome: 'Rebelde',
                tipo: 'fixo',
                nivel: null,
                descricao: 'Tem dificuldades em seguir ordens e comandos. Tendem a agir por instinto ou por vontade própria, prejudicando estratégias organizadas.',
                efeito: '−1 no Alvo de testes para seguir comandos ou funcionar em equipe estruturada.',
                icone: '⛓️💥',
                negativo: true
            },
            {
                key: 'odio_reais',
                nome: 'Ódio dos Karu-Reais',
                tipo: 'fixo',
                nivel: null,
                descricao: 'Vistos como indignos por seus parentes nobres, os Karu-Selvagens odeiam os Reais da mesma forma.',
                efeito: 'Karu-Reais tendem a atacá-los sem piedade ou dificultar negociações. Pode atrair conflitos automáticos ou rejeição política em territórios Karu.',
                icone: '⚔️',
                negativo: true
            }
        ]
    },

    'Picxi': {
        tamanho: 3,
        subtitulo: 'Douradas — Fadas — Filhas da Rainha Luxis',
        peculiaridades: [
            {
                key: 'descendencia_luxiana',
                nome: 'Descendência Luxiana',
                tipo: 'fixo',
                nivel: null,
                descricao: 'As Asas Luxianas fornecem deslocamento aéreo excepcional enquanto estão batendo. Flutuam a poucos centímetros do chão sem bater asas, mas voam rapidamente quando as utilizam.',
                efeito: 'Aéreo = (FOR+DES+Tamanho+Atletismo)×3. Flutuação passiva lenta (Desloc. 2) ou voo rápido com asas. Fora do voo: −2 em testes de corrida/perseguição. Viagens longas: voa por (DET Máx + VIT Máx)/2 horas.',
                icone: '🧚'
            },
            {
                key: 'aura_levitacao',
                nome: 'Aura de Levitação',
                tipo: 'fixo',
                nivel: null,
                descricao: 'Podem fazer objetos ou pessoas flutuarem por poucos segundos quando aplicam sua aura sobre eles.',
                efeito: 'Teste de PRS + Fluxomancia. Redutor para coisas grandes/pesadas. Falha Crítica: alvo não flutua e perde turno. Falha: flutua 1 turno. Sucesso: flutua por Graus de Sucesso em turnos.',
                icone: '🌀'
            },
            {
                key: 'fragilidade_fisica',
                nome: 'Fragilidade Física',
                tipo: 'fixo',
                nivel: null,
                descricao: 'Seu corpo pequeno e delicado é vulnerável a ataques físicos. Em ambientes sem espaço para voar, são extremamente vulneráveis.',
                efeito: '−1 de Vitalidade Máxima na criação. −2 no Alvo de testes físicos em espaços confinados onde não podem voar.',
                icone: '💔',
                negativo: true
            },
            {
                key: 'brilho_revelador',
                nome: 'Brilho Revelador',
                tipo: 'fixo',
                nivel: null,
                descricao: 'A aura dourada que emana das Picxis é difícil de ocultar, especialmente no escuro.',
                efeito: '−2 no Alvo de testes de Furtividade em ambientes escuros. Podem suprimir o brilho com teste de AUT, mas ficam exaustas se mantiverem por mais de uma cena.',
                icone: '💡',
                negativo: true
            }
        ]
    },

    'Pogo': {
        tamanho: 3,
        subtitulo: 'Carecas — Pequenos Arcanos — Fadas sem Asa',
        peculiaridades: [
            {
                key: 'sangue_pela_vida',
                nome: 'Sangue pela Vida',
                tipo: 'fixo',
                nivel: null,
                descricao: 'Os Pogos podem consumir sangue através de rituais arcanos para prolongar sua vida naturalmente curta. É um processo arriscado que afeta a sanidade.',
                efeito: '2 VIT consumidos = +1 ano de vida. 100 VIT consumidos = rejuvenesce 1 ano. Requer teste de Sanidade ao rejuvenescer.',
                icone: '🩸'
            },
            {
                key: 'talentos_naturais',
                nome: 'Talentos Naturais',
                tipo: 'fixo',
                nivel: null,
                descricao: 'A capacidade de aprender coisas novas durante seu crescimento é muito acima da média. Pogos amadurecem rapidamente e absorvem conhecimento com facilidade impressionante.',
                efeito: '+1 nível para distribuir em 3 Perícias diferentes na criação do personagem.',
                icone: '🧠'
            },
            {
                key: 'sangue_foco_mente',
                nome: 'Sangue, Foco e Mente',
                tipo: 'fixo',
                nivel: null,
                descricao: 'O usuário é capaz de consumir sangue para saciar fome, se sentir mentalmente melhor ou ficar mais motivado. O propósito deve ser declarado antes do consumo.',
                efeito: '8 VIT = sacia fome 1 dia. 3 VIT = recupera 1 Sanidade. 5 VIT = recupera 1 Determinação. Consumir próprio sangue pode prejudicar a sanidade.',
                icone: '🎯'
            },
            {
                key: 'corpo_fragil',
                nome: 'Corpo Frágil',
                tipo: 'fixo',
                nivel: 3,
                descricao: 'Seus corpos são frágeis, delgados e pouco resistentes. Dependem amplamente de proteção mágica ou aliados físicos para sobreviver em combate.',
                efeito: '−3 no Alvo de testes de FOR, resistência física e combate corpo a corpo.',
                icone: '🦴',
                negativo: true
            },
            {
                key: 'dependencia_sangue',
                nome: 'Dependência de Sangue',
                tipo: 'fixo',
                nivel: null,
                descricao: 'A longevidade dos Pogos depende do consumo periódico de sangue por meio de rituais arcanos. Sem esse ritual, envelhecem e adoecem rapidamente.',
                efeito: 'Cada mês sem ritual: aparenta +1 ano de idade e −1 em VIG até realizar novo ritual.',
                icone: '⏰',
                negativo: true
            },
            {
                key: 'ciclo_vida_curto',
                nome: 'Ciclo de Vida Curto',
                tipo: 'fixo',
                nivel: null,
                descricao: 'Sem a intervenção de práticas mágicas, os Pogos têm uma vida extremamente breve. Isso os força a amadurecer cedo e priorizar resultados rápidos.',
                efeito: 'Dificuldade em alcançar sabedoria acumulada naturalmente. Tendem a ser impacientes com processos longos.',
                icone: '⌛',
                negativo: true
            }
        ]
    },

    'Tamano': {
        tamanho: 5,
        subtitulo: 'Língua-Longa — Os Pacientes — Devoradores de Pragas',
        peculiaridades: [
            {
                key: 'lingua_preensil',
                nome: 'Língua Preênsil',
                tipo: 'fixo',
                nivel: null,
                descricao: 'A língua de um Tamano pode se estender até 60cm e é forte o suficiente para agarrar objetos pequenos ou desferir ataques surpresa.',
                efeito: 'Manipula objetos pequenos até 60cm. Ataque de língua como ação livre: DES+Agilidade-2, Dano: 1d4+FOR (não letal).',
                icone: '👅'
            },
            {
                key: 'garras_escavadoras',
                nome: 'Garras Escavadoras',
                tipo: 'evolutivo',
                nivelAtual: 1,
                nivelMax: 3,
                descricao: 'Garras curvas e poderosas que permitem escavar através de terra e madeira apodrecida com facilidade. Também são armas naturais eficientes.',
                niveis: {
                    1: { efeito: '+1 no Alvo de testes para escavar/destruir barreiras de terra/madeira. Ataque desarmado: 1d6 de dano.', custo: '—' },
                    2: { efeito: '+2 no Alvo de testes para escavar/destruir barreiras. Ataque desarmado: 1d8 de dano.', custo: '5 EXP' },
                    3: { efeito: '+3 no Alvo de testes para escavar/destruir barreiras. Ataque desarmado: 1d10 de dano.', custo: '10 EXP' }
                },
                icone: '🦎'
            },
            {
                key: 'olfato_excepcional',
                nome: 'Olfato Excepcional',
                tipo: 'evolutivo',
                nivelAtual: 1,
                nivelMax: 3,
                descricao: 'Compensa a visão limitada com um olfato extraordinário, capaz de rastrear presas, detectar venenos e identificar indivíduos pelo cheiro.',
                niveis: {
                    1: { efeito: '+2 no Alvo de testes de Percepção baseados em olfato. Pode rastrear criaturas pelo cheiro.', custo: '—' },
                    2: { efeito: '+3 no Alvo de testes de Percepção baseados em olfato. Rastreamento aprimorado.', custo: '5 EXP' },
                    3: { efeito: '+4 no Alvo de testes de Percepção olfativa. Identifica emoções pelo cheiro.', custo: '10 EXP' }
                },
                icone: '👃'
            },
            {
                key: 'visao_limitada',
                nome: 'Visão Limitada',
                tipo: 'fixo',
                nivel: null,
                descricao: 'Os olhos pequenos dos Tamanos não são adequados para detalhes visuais ou longas distâncias.',
                efeito: '−2 no Alvo de testes de Percepção visual e testes de Disparo em distâncias Médias ou maiores.',
                icone: '👀',
                negativo: true
            },
            {
                key: 'metabolismo_especializado',
                nome: 'Metabolismo Especializado',
                tipo: 'fixo',
                nivel: null,
                descricao: 'Tamanos se alimentam principalmente de insetos, larvas e pequenos invertebrados. Alimentos convencionais são difíceis de digerir.',
                efeito: 'Precisa de acesso a insetos ou larvas para se alimentar. Sem fauna apropriada: −1 em todos os testes físicos após 3 dias.',
                icone: '🐛',
                negativo: true
            }
        ]
    },

    'Yotun': {
        tamanho: 10,
        subtitulo: 'Os Gigantes — Guardiões dos Caminhos',
        peculiaridades: [
            {
                key: 'guardiao_imponente',
                nome: 'Guardião Imponente',
                tipo: 'evolutivo',
                nivelAtual: 1,
                nivelMax: 5,
                descricao: 'Usam seu tamanho e imponência para intimidar invasores. A mera presença de um Yotun basta para fazer homens crescidos recuarem.',
                niveis: {
                    1: { efeito: '+1 no Alvo de testes de Intimidação e Proteção territorial.', custo: '—' },
                    2: { efeito: '+2 no Alvo de testes de Intimidação e Proteção territorial.', custo: '5 EXP' },
                    3: { efeito: '+3 no Alvo de testes de Intimidação e Proteção territorial.', custo: '10 EXP' },
                    4: { efeito: '+4 no Alvo de testes de Intimidação e Proteção territorial.', custo: '25 EXP' },
                    5: { efeito: '+5 no Alvo de testes de Intimidação e Proteção territorial.', custo: '40 EXP' }
                },
                icone: '🗿'
            },
            {
                key: 'forca_colossal',
                nome: 'Força Colossal',
                tipo: 'fixo',
                nivel: null,
                descricao: 'Capaz de levantar e arremessar objetos enormes. Força descomunal por natureza que ultrapassa os limites de outras raças.',
                efeito: 'Permite alocar mais de 3 pontos em FOR e VIG na criação. Limite máximo de FOR aumenta para 6.',
                icone: '💪'
            },
            {
                key: 'passos_gigante',
                nome: 'Passos de Gigante',
                tipo: 'fixo',
                nivel: null,
                descricao: 'Pode atravessar grandes distâncias com poucas passadas. O que para outros é uma jornada, para um Yotun é um passeio.',
                efeito: 'Dobra o Deslocamento Terrestre para viagens a pé. Não se aplica em combate.',
                icone: '🦶'
            },
            {
                key: 'alta_carga',
                nome: 'Alta Carga',
                tipo: 'fixo',
                nivel: null,
                descricao: 'Pode carregar muito peso sem se incomodar. Um Yotun carrega nas costas o que outros precisariam de carroças.',
                efeito: 'Dobra o valor de Carga Máxima. VIG determina quantas pessoas de tamanho humano pode carregar (1 por ponto de VIG).',
                icone: '🎒'
            },
            {
                key: 'golpe_titanico',
                nome: 'Golpe Titânico',
                tipo: 'evolutivo',
                nivelAtual: 1,
                nivelMax: 5,
                descricao: 'Todo ataque físico afeta não apenas o alvo, mas a área em torno dele. O impacto de um Yotun é como um pequeno terremoto.',
                niveis: {
                    1: { efeito: 'Ataques corpo-a-corpo afetam alvos num raio de até 1,5m do alvo principal, com metade do dano.', custo: '—' },
                    2: { efeito: 'Raio de até 2,0m do alvo, metade do dano.', custo: '5 EXP' },
                    3: { efeito: 'Raio de até 3,0m do alvo, metade do dano.', custo: '10 EXP' },
                    4: { efeito: 'Raio de até 4,5m do alvo, metade do dano.', custo: '25 EXP' },
                    5: { efeito: 'Raio de até 6,0m do alvo, metade do dano.', custo: '40 EXP' }
                },
                icone: '💥'
            },
            {
                key: 'blindagem_natural',
                nome: 'Blindagem Natural',
                tipo: 'evolutivo',
                nivelAtual: 2,
                nivelMax: 5,
                nota: 'Novos níveis só podem ser adicionados na criação de personagem.',
                descricao: 'Sua pele é dura como pedra, oferecendo proteção natural contra ataques físicos.',
                niveis: {
                    2: { efeito: '+2 de Blindagem natural.', custo: '—' },
                    3: { efeito: '+3 de Blindagem natural.', custo: '10 EXP' },
                    4: { efeito: '+4 de Blindagem natural.', custo: '25 EXP' },
                    5: { efeito: '+5 de Blindagem natural.', custo: '40 EXP' }
                },
                icone: '🪨'
            },
            {
                key: 'vuln_projeteis',
                nome: 'Vulnerabilidade a Projéteis',
                tipo: 'fixo',
                nivel: 3,
                descricao: 'Apesar de sua pele resistente, ataques à distância encontram brechas em sua defesa. São alvos grandes demais para esquivar adequadamente.',
                efeito: 'Ataques à distância bem-sucedidos: +1 dano (1-2 Graus), +2 dano (3-4 Graus), +3 dano (5+ Graus).',
                icone: '🏹',
                negativo: true
            },
            {
                key: 'vuln_psiquica',
                nome: 'Vulnerabilidade Psíquica',
                tipo: 'fixo',
                nivel: 1,
                descricao: 'Todo tipo de magia e controle psíquico tem grande influência sobre o Yotun. Suas mentes, embora determinadas, são simples.',
                efeito: '−1 no Alvo de testes de resistência a qualquer tipo de influência mágica ou controle psíquico/mental.',
                icone: '🧿',
                negativo: true
            }
        ]
    }
};
