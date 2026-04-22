/* ===== DATA.JS — Constantes hardcoded para Criação de Personagem ===== */
/* Regra de Ouro: Apenas atributos e regras de criação ficam aqui.
   Tudo mais (raças, classes, tribos, peculiaridades, perícias) vem do Firebase. */

const ATRIBUTOS = {
    Mental: [
        { id: "INT", key: "attr_int", nome: "Inteligência", tooltip: "Representa a sabedoria, memória e conhecimento acumulado. Governa perícias mentais como Erudição, Medicina e Investigação." },
        { id: "RAC", key: "attr_rac", nome: "Raciocínio", tooltip: "Velocidade de pensamento, percepção e capacidade de reagir mentalmente. Governa perícias como Alquimancia e Runomancia." },
        { id: "PRS", key: "attr_prs", nome: "Perseverança", tooltip: "Força de vontade prolongada, resistência mental e foco sob pressão. Governa Fluxomancia e Abismo." }
    ],
    Fisico: [
        { id: "FOR", key: "attr_for", nome: "Força", tooltip: "Potência muscular, capacidade de carga e poder de dano corpo-a-corpo." },
        { id: "DES", key: "attr_des", nome: "Destreza", tooltip: "Agilidade, coordenação motora e precisão de movimentos. Governa Agilidade, Furtividade e Disparo." },
        { id: "VIG", key: "attr_vig", nome: "Vigor", tooltip: "Resistência física, saúde e capacidade de suportar dano. Contribui para Vitalidade Máxima." }
    ],
    Social: [
        { id: "PRE", key: "attr_pre", nome: "Presença", tooltip: "Magnetismo pessoal, capacidade de impressionar e intimidar. Governa Liderança, Performance e Intimidação." },
        { id: "MAN", key: "attr_man", nome: "Manipulação", tooltip: "Habilidade de influenciar, persuadir e enganar outros. Governa Barganha, Diplomacia e Sedução." },
        { id: "AUT", key: "attr_aut", nome: "Autocontrole", tooltip: "Domínio sobre as próprias emoções e calma sob pressão. Governa Empatia e Observação." }
    ]
};

const GRUPOS_ATRIBUTOS = ['Mental', 'Fisico', 'Social'];

const REGRAS_CRIACAO = {
    atributos: {
        primario: 5,
        intermediario: 4,
        fraco: 3,
        custo_quinta_bolinha: 2, // A 5ª bolinha custa 2 pontos em vez de 1
        limite_max_por_atributo: 3, // Máximo 3 por atributo na criação (exceto se mecânica altera)
        base_inicial: 1 // Todos começam com 1
    },
    pericias: {
        primario: 6,
        segundo: 4,
        terceiro: 3,
        fraco: 2,
        limite_max_por_pericia: 3 // Máximo 3 por perícia na criação
    },
    peculiaridades_individuais: {
        max_positivas_gratis: 2,
        max_negativas_gratis: 2,
        custo_adicional_positiva: 10, // EXP por positiva extra
        ganho_adicional_negativa: 10  // EXP por negativa extra
    },
    npcs: {
        exp_por_npc: 1,
        max_exp_npcs: 3
    },
    memorias: {
        exp_bonus_completo: 4 // EXP extra se TODAS as memórias obrigatórias forem escritas
    }
};

const NIVEIS_INICIO = [
    { id: "iniciante",    nome: "Iniciante",    exp: 0,   desc: "Recém-desperto. Você é novo neste mundo de perigos e maravilhas." },
    { id: "tardio",       nome: "Tardio",       exp: 10,  desc: "Alguns passos adiante. Você já viu coisas que a maioria não veria." },
    { id: "experiente",   nome: "Experiente",   exp: 35,  desc: "Vivido e marcado. As cicatrizes contam sua história." },
    { id: "especialista", nome: "Especialista",  exp: 75,  desc: "Mestre do que faz. Poucos podem se comparar a você." },
    { id: "heroico",      nome: "Heroico",       exp: 100, desc: "Lendário. Seu nome já é sussurrado em tavernas distantes." }
];

/* ===== VIRTUDES ===== */
const VIRTUDES = [
    {
        id: "caridade",
        nome: "Caridade",
        subtitulo: "Compaixão — Misericórdia — Altruísmo",
        descricao: "Tratar os outros como gostaria de ser tratado. Dividir o que tem com os menos afortunados. Ver a humanidade mesmo nos inimigos.",
        recupera: "Sacrifica algo significativo para ajudar outra pessoa — recursos, segurança, tempo ou oportunidades em benefício de outro, especialmente um desconhecido ou alguém que não pode retribuir.",
        icone: "💛"
    },
    {
        id: "esperanca",
        nome: "Esperança",
        subtitulo: "Otimismo — Sonho — Perseverança",
        descricao: "Acreditar que o mal e o infortúnio não podem vencer para sempre. Manter a fé de que as coisas vão melhorar, mesmo quando tudo parece perdido.",
        recupera: "Sacrifica sua própria segurança ou vantagem para impedir que outros caiam no desespero — arriscar-se para erguer aliados que querem desistir, ou abrir mão de uma saída fácil para manter o grupo unido.",
        icone: "🌟"
    },
    {
        id: "fe",
        nome: "Fé",
        subtitulo: "Convicção — Confiança — Humildade",
        descricao: "Acreditar que existe uma ordem maior no universo — seja divina, cósmica ou natural. Confiar que tudo tem um propósito, mesmo quando esse propósito é incompreensível.",
        recupera: "Sacrifica algo valioso em nome de sua crença — agir contra a lógica ou o interesse próprio porque sua fé exige, ou aceitar uma perda como parte de um plano maior.",
        icone: "🕊️"
    },
    {
        id: "fortaleza",
        nome: "Fortaleza",
        subtitulo: "Coragem — Integridade — Resiliência",
        descricao: "Defender suas convicções independentemente das consequências. Não ceder, não quebrar, não trair seus princípios — mesmo quando seria mais fácil fazê-lo.",
        recupera: "Sofre consequências reais por não abandonar seus princípios — suportar dor, perda ou desvantagem porque ceder seria trair quem você é.",
        icone: "🛡️"
    },
    {
        id: "justica",
        nome: "Justiça",
        subtitulo: "Retidão — Equidade — Responsabilidade",
        descricao: "Acreditar que o errado deve ser corrigido e o certo deve ser defendido. Não há crime sem consequência, não há vítima sem vingador.",
        recupera: "Sacrifica algo para fazer \"a coisa certa\" — punir um culpado mesmo perdendo uma aliança, proteger um inocente mesmo se colocando em perigo, ou aceitar punição por um erro que cometeu.",
        icone: "⚖️"
    },
    {
        id: "prudencia",
        nome: "Prudência",
        subtitulo: "Sabedoria — Paciência — Vigilância",
        descricao: "Colocar a razão acima do impulso. Pensar antes de agir. Evitar riscos desnecessários e moderar as atitudes, mesmo quando a emoção grita o contrário.",
        recupera: "Abre mão de uma vantagem significativa em nome do comedimento — recusar um atalho perigoso perdendo tempo precioso, ou deixar um inimigo escapar para evitar uma armadilha óbvia.",
        icone: "🔮"
    },
    {
        id: "temperanca",
        nome: "Temperança",
        subtitulo: "Equilíbrio — Serenidade — Moderação",
        descricao: "Acreditar que o excesso é sempre destrutivo — seja de bondade ou maldade, prazer ou dor. Buscar o meio-termo em todas as coisas.",
        recupera: "Sacrifica uma recompensa por rejeitar o excesso — recusar vingança satisfatória contra um inimigo derrotado, ou manter a calma perdendo uma oportunidade quando a fúria seria justificada.",
        icone: "☯️"
    }
];

/* ===== VÍCIOS ===== */
const VICIOS = [
    {
        id: "avareza",
        nome: "Avareza",
        subtitulo: "Cobiça — Ganância — Acumulação",
        descricao: "Querer sempre mais — mais dinheiro, mais poder, mais posses. Nunca estar satisfeito com o que tem. Ver o mundo como uma competição por recursos.",
        recupera: "Sacrifica algo importante (confiança, aliança, segurança) para adquirir algo às custas de outra pessoa — arriscar-se para tomar o que não é seu, ou trair a confiança de alguém por ganho pessoal.",
        icone: "💰",
        especificar: false
    },
    {
        id: "gula",
        nome: "Gula",
        subtitulo: "Dependência — Compulsão — Excesso",
        descricao: "Precisar saciar certos desejos acima de tudo — seja comida, bebida, substâncias, ou qualquer outro vício específico. A necessidade supera a razão.",
        recupera: "Sacrifica sua segurança ou a de outros para saciar seu vício — colocar-se em perigo real para conseguir o que precisa, ou abandonar responsabilidades importantes pela compulsão.",
        icone: "🍷",
        especificar: true,
        especificarLabel: "Especifique seu vício (álcool, jogo, uma substância, etc.)"
    },
    {
        id: "inveja",
        nome: "Inveja",
        subtitulo: "Ressentimento — Insegurança — Paranoia",
        descricao: "Nunca estar satisfeito consigo mesmo. Desprezar-se e cobiçar o que outros têm — seus talentos, suas posses, seu reconhecimento.",
        recupera: "Sacrifica algo para prejudicar um rival ou tomar o que é dele — arriscar sua reputação ou segurança para sabotar alguém, ou destruir algo valioso que não pode ter.",
        icone: "👁️",
        especificar: false
    },
    {
        id: "ira",
        nome: "Ira",
        subtitulo: "Fúria — Violência — Descontrole",
        descricao: "Responder à frustração com raiva desproporcional. Descontar sua fúria em pessoas ou objetos pela menor provocação. Deixar a emoção dominar a razão.",
        recupera: "Sofre consequências reais por liberar sua fúria — atacar alguém mais poderoso, destruir algo importante em um acesso de raiva, ou deixar a violência escalar quando havia alternativa.",
        icone: "🔥",
        especificar: false
    },
    {
        id: "luxuria",
        nome: "Luxúria",
        subtitulo: "Desejo — Obsessão — Impulsividade",
        descricao: "Ser consumido por desejos intensos — geralmente românticos ou sexuais, mas pode ser por experiências, sensações ou qualquer forma de prazer.",
        recupera: "Sacrifica algo valioso para satisfazer seu desejo — colocar-se em perigo, trair confiança ou prejudicar alguém para conseguir o que quer.",
        icone: "❤️‍🔥",
        especificar: true,
        especificarLabel: "Especifique o objeto de sua luxúria, se aplicável"
    },
    {
        id: "orgulho",
        nome: "Orgulho",
        subtitulo: "Arrogância — Vaidade — Teimosia",
        descricao: "Excesso de autoconfiança. Convicção de que suas decisões estão sempre corretas. Incapacidade de admitir erros ou aceitar que outros possam saber mais.",
        recupera: "Sofre consequências por impor seus caprichos — recusar ajuda necessária e pagar o preço, insistir em um plano falho até dar errado, ou humilhar alguém e criar um inimigo.",
        icone: "👑",
        especificar: false
    },
    {
        id: "preguica",
        nome: "Preguiça",
        subtitulo: "Apatia — Covardia — Negligência",
        descricao: "Evitar esforço, responsabilidade e confronto. Esperar que outros resolvam os problemas. Permitir que o mal aconteça por inação.",
        recupera: "Sua inação causa consequências reais — permitir que outros sofram porque agir \"não vale a pena\", ou fugir de uma responsabilidade e ver as consequências depois.",
        icone: "💤",
        especificar: false
    }
];

/* ===== RELAÇÕES DE NPC ===== */
const RELACOES_NPC = [
    "Família", "Amizade", "Mentor/Aprendiz", "Rival", "Amante",
    "Aliado", "Dívida", "Protetor/Protegido", "Parceiro de Negócios",
    "Inimigo", "Desconhecido Marcante", "Outro"
];

/* ===== FASES DO WIZARD ===== */
const FASES_WIZARD = [
    { id: 0,   key: "convite",        titulo: "O Convite",                icon: "📜", desc: "Nome e nível de início" },
    { id: 1,   key: "linhagem",       titulo: "A Linhagem",              icon: "🧬", desc: "Raça e Classe" },
    { id: 2,   key: "origens",        titulo: "As Origens",              icon: "🏕️", desc: "Tribo" },
    { id: 2.5, key: "peculiaridades", titulo: "Peculiaridades",          icon: "✨", desc: "Peculiaridades Individuais" },
    { id: 3,   key: "corpo",          titulo: "O Corpo e a Mente",       icon: "💪", desc: "Atributos" },
    { id: 4,   key: "habilidades",    titulo: "As Habilidades",          icon: "📚", desc: "Perícias" },
    { id: 5,   key: "alma",           titulo: "A Alma",                  icon: "💫", desc: "Virtude e Vício" },
    { id: 6,   key: "lacos",          titulo: "Os Laços",                icon: "🤝", desc: "NPCs" },
    { id: 7,   key: "equipamento",    titulo: "O Equipamento",           icon: "⚔️", desc: "Equipamento inicial" },
    { id: 8,   key: "vespera",        titulo: "A Véspera da Partida",    icon: "🌅", desc: "Finalização" },
    { id: 9,   key: "resumo",         titulo: "Resumo Final",            icon: "📋", desc: "Revisão e criação" }
];

/* ===== TEXTOS DO NARRADOR ===== */
const NARRADOR_TEXTOS = {
    convite: `Toda grande lenda começa com uma escolha. E a sua começa agora.\n\nAntes de existir como herói — ou vilão — você era apenas uma possibilidade. Um nome sussurrado pelo destino. Um par de olhos que se abriram pela primeira vez para um mundo cheio de perigos, maravilhas e segredos antigos.\n\nDiga-me: como devo chamá-lo?`,

    linhagem_raca: `Seu sangue carrega histórias mais antigas que qualquer reino. Antes mesmo de dar o primeiro passo, sua raça já moldou seus ossos, seus instintos, suas fraquezas.\n\nDe qual povo você descende?`,

    linhagem_classe: `Todo aventureiro caminha por um caminho — uma vocação que define como ele enfrenta o mundo. Alguns empunham espadas, outros decifram runas. Alguns curam, outros destroem.\n\nQual caminho chamou você?`,

    origens: `Ninguém nasce no vazio. Você cresceu entre rostos, rituais e paisagens que marcaram sua alma para sempre. Sua tribo não é apenas de onde você vem — é quem você é.\n\nDe qual povo você veio?`,

    peculiaridades: `Nem tudo sobre você pode ser explicado pela sua raça ou pelo seu treinamento. Há algo mais — algo único, inexplicável talvez — que faz de você quem é.\n\nAlgumas dessas marcas são dons. Outras, fardos. Todas fazem parte da sua história.`,

    corpo: `Agora precisamos falar do que você é feito. Não de sonhos ou linhagens — mas de músculo, mente e presença. De como o mundo te sente quando você entra em uma sala.\n\nDistribua seus atributos com sabedoria. Escolha seu ponto forte — e aceite suas fraquezas.`,

    habilidades: `Atributos mostram do que você é feito. Mas perícias mostram o que você APRENDEU a fazer. São horas de treino, noites em claro, cicatrizes de tentativa e erro.\n\nO que você passou anos aperfeiçoando?`,

    alma: `Agora chegamos ao que nenhuma perícia pode medir. Ao que nenhum atributo pode quantificar.\n\nSua alma. O que te move? E o que te corrompe?`,

    lacos: `Ninguém caminha sozinho. Mesmo os lobos solitários têm uma matilha que deixaram para trás — ou que ainda procuram.\n\nQuem são as pessoas que marcaram sua vida?`,

    equipamento: `Antes de partir, você precisa escolher o que levar consigo. As ferramentas do seu ofício, as armas da sua classe, e talvez... um objeto que não tem preço em ouro.\n\nO que você carrega?`,

    vespera: `Esta é a última noite antes de tudo mudar. Amanhã, quando o sol nascer, você não será mais quem era. Será um aventureiro — para o bem ou para o mal.\n\nMas esta noite... esta noite ainda é sua.`,

    resumo: `E assim, sua história começa. Não com um estrondo, mas com uma escolha — a escolha de se levantar quando o mundo diz para ficar de joelhos.\n\nRevisite quem você é. E quando estiver pronto... dê o primeiro passo.`
};
