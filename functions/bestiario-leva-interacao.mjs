/**
 * Bestiário — leva de criaturas de INTERAÇÃO, e as do cofre que faltavam.
 *
 * Duas frentes num script só, porque as duas entram na mesma coleção e na
 * mesma régua:
 *
 *  A. SEIS CRIATURAS NOVAS que não atacam. O que elas fazem não é dano: é
 *     CONDIÇÃO, aplicada quando alguém encosta, colhe, respira perto, come o
 *     que elas tocaram, ou as assusta. Metade do que elas dão é BOM — o
 *     catálogo de condições tem Simbionte, Serenidade, Célere, Vigorado,
 *     Purificado e Inabalável, e nenhuma criatura do banco usava isso ainda.
 *     Cada uma dá uma coisa boa E uma ruim, pela MESMA porta: é a mesma
 *     biologia que cura e que estraga, e é o jeito de lidar que decide qual.
 *
 *  B. SEIS DO COFRE (`05 🐉 Bestiário` da pasta Reliera) que ainda não
 *     estavam no banco: Salamandra-Musgo, Aranha-Galho, Aracasca,
 *     Javali-Espinhoso, Espectro da Seiva Negra e Avarbus Azire. As fichas do
 *     cofre são de OUTRO sistema (Aspectos/Estresse, atributos CON/PER/VON) —
 *     foram TRADUZIDAS para a régua v3, não copiadas. O que o cofre declara
 *     (habitat, comportamento, façanhas, fraqueza) foi respeitado; os números
 *     são todos recalculados aqui.
 *
 * RÉGUA (v3, unidade 3,90, defensor Defesa 1 / Blindagem 2):
 *     P     = clamp((min(Alvo,9) − 1) ÷ 10, 0 ; 0,9)
 *     líq   = max(1, dado_médio + FOR − 2)
 *     força = P × líq ÷ 3,90
 *     Alvo  = (FOR max DES) + Briga        VIT = (VIG + Altura×3) × 3
 *
 * O script TRAVA se a força computada sair da faixa declarada em `alvo` de
 * cada bicho — número que foge é erro de desenho, não arredondamento.
 *
 * SÓ CONDIÇÃO QUE EXISTE. Todas as condições citadas são conferidas contra
 * `system/data/conditions` antes de gravar; nome que não existir aborta o
 * script. (Achado desta varredura: "Necrose" e "Toxis", citadas no texto de
 * ataque do Fantoche e da Serpente, NÃO existem no catálogo — por isso a
 * mordida do Avarbus Azire usa Chaga, que é a ferida que não fecha.)
 *
 *   node functions/bestiario-leva-interacao.mjs            (dry-run)
 *   node functions/bestiario-leva-interacao.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');
const AUTOR = 'igorestevamalvesdesouza@gmail.com';

const U = 3.90, DEFESA = 1, BLD_REF = 2, VIT_REF = 18;
const medio = d => { const m = /(\d+)d(\d+)/.exec(String(d)); return m ? Number(m[1]) * (Number(m[2]) + 1) / 2 : NaN; };
const GRAUS = [[0.15, 'Inofensiva'], [0.35, 'Praga'], [0.75, 'Comum'], [1.5, 'Séria'], [3.0, 'Grave']];
const grauDe = x => (GRAUS.find(([t]) => x < t) || [null, 'Calamidade'])[1];
const DOMA = { 'Inofensiva': [0, 6, 4, 1], 'Praga': [-1, 5, 5, 1], 'Comum': [-1, 4, 6, 1],
    'Séria': [-3, 3, 8, 2], 'Grave': [-5, 2, 10, 3], 'Calamidade': [-7, 1, 10, 4] };
const br = (x, c = 2) => x.toFixed(c).replace('.', ',');
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

const clausulaDoma = g => {
    const [r, ini, lim, ritmo] = DOMA[g], falta = Math.max(0, lim - ini);
    return `Domável: AUT + Domar, dificuldade ${g} (Redutor ${r === 0 ? '0' : '−' + Math.abs(r)}) · `
        + `Lealdade começa em ${ini}, vínculo exige ${lim}`
        + (falta ? ` — ${falta} ponto${falta > 1 ? 's' : ''} a cada ${ritmo} ${ritmo > 1 ? 'sessões' : 'sessão'}, ${falta * ritmo} sessões ao todo` : ' — já nasce vinculada');
};

/* ═══════════════════════ A LEVA ═══════════════════════
   `alvo` = força-alvo do desenho; o script trava se a conta fugir dela.
   `cond` = condições citadas; todas conferidas contra o catálogo.        */
const LEVA = [
{
    nome: 'Lambe-Ferida', origem: 'nova', alvo: 0.10,
    altura: 0.30, atributos: { FOR: 1, DES: 4, VIG: 2, INT: 1, RAC: 2, PRS: 2, PRE: 3, MAN: 1, AUT: 1 },
    briga: 1, dado: '1d2', bld: 0, desloc: '9m',
    porte: 'Minúsculo', dieta: 'Necrófago de crosta — come sangue seco, casca de ferida e larva de mosca-varejeira',
    ancoras: ['Vale de Silmarela'],
    habitat: 'Vale de Silmarela — curral, redil e chiqueiro; onde houver bicho grande com o couro aberto',
    densidade: 'aos pares, e sempre onde já há ferida',
    cond: ['Simbionte', 'Chaga'],
    corpo: 'Bicho de trinta centímetros, focinho comprido e língua áspera de gato. A saliva dele coalha a borda da ferida e mata o que apodrece — é antisséptico de verdade, não superstição. O preço é que a mesma saliva tem o que impede o sangue de fechar enquanto ele trabalha: ele precisa da ferida aberta para comer, e o corpo dele resolveu isso do jeito mais direto.',
    interacao: 'Deixe lamber até ele parar sozinho: **Simbionte 2** enquanto durar — a ferida limpa e fecha. Puxe o bicho no meio do serviço e a ferida fica como ele a deixou, aberta e sem coagular: **Chaga** até alguém costurar.',
    sinal: 'Ele chega antes de você saber que alguém se feriu. Ver um Lambe-Ferida trotando na direção do pasto é saber que tem bicho — ou gente — sangrando lá.',
    regra: 'Não lambe ferida limpa. Se ele recusa, não é ferida: é osso quebrado, veneno ou coisa pior, e o problema não é de fora.',
    remedio: 'Passar leite na borda para chamá-lo funciona. O que não funciona é o resto do dito: leite também chama o que come Lambe-Ferida, e a Ratazana chega junto.',
    moral: 'O medo de que a cura precise da ferida aberta para existir.',
    rito: { chamariz: 'sangue velho num pano — nunca fresco, ele não vem ao vivo',
        preco: 'deixar que ele termine, sempre; um interrompido não volta',
        prova: 'quando ele lamber a SUA mão em vez da carne oferecida',
        erro: 'puxar a mão. Ele foge e a aldeia inteira sabe que você tem pressa' },
},
{
    nome: 'Veste-Pedra', origem: 'nova', alvo: 0.27,
    altura: 0.50, atributos: { FOR: 3, DES: 1, VIG: 5, INT: 1, RAC: 1, PRS: 1, PRE: 4, MAN: 1, AUT: 2 },
    briga: 1, dado: '1d4', bld: 2.40, desloc: '3m',
    porte: 'Pequeno', dieta: 'Litófago — raspa líquen de rocha calcária e precipita o mineral no próprio dorso',
    ancoras: ['Planície de Silmarela'],
    habitat: 'Planície de Silmarela — afloramentos de calcário e as pedreiras velhas',
    densidade: 'solitária, uma por afloramento',
    cond: ['Inabalável'],
    corpo: 'Meio metro de bicho lento sob uma crosta que ele mesmo fabrica: raspa líquen de pedra, e o cálcio que sobra do que come sai pelo dorso e endurece em placa. A placa cresce a vida inteira e é por isso que ele anda tão devagar — carrega a própria pedreira. Cada vez que se sacode, solta um pó fino de mineral.',
    interacao: 'Respirar o pó que ele solta assenta a pessoa: **Inabalável** — planta quem respirou, dá resistência e tira a mobilidade junto, do mesmo jeito que faz com ele. A condição já cobra o próprio preço; não há versão só boa.',
    sinal: 'O chão range diferente. Onde ele passou, a terra tem uma poeira branca que estala sob a bota.',
    regra: 'Não se sacode se ninguém encostar. O pó é resposta, não hábito — quem não toca não respira nada.',
    remedio: 'Pedreiro segue Veste-Pedra para achar pedra boa, e funciona: ele só come líquen de calcário que presta. Prender a respiração ao passar também funciona. Pano molhado no nariz não — não é o pó que planta a pessoa, e o pano só serve para se sentir esperto.',
    moral: 'A moral do que fica parado porque carrega demais.',
    rito: { chamariz: 'uma pedra de calcário nova, posta onde ele possa ver',
        preco: 'a paciência de um dia inteiro — ele leva esse tempo para atravessar um pátio',
        prova: 'quando ele raspar a pedra que VOCÊ pôs, em vez da que já estava lá',
        erro: 'encostar antes. Ele se sacode, você respira, e passa a tarde plantado olhando ele ir embora a três metros por turno' },
},
{
    nome: 'Bebe-Susto', origem: 'nova', alvo: 0.05,
    altura: 0.20, atributos: { FOR: 1, DES: 3, VIG: 1, INT: 1, RAC: 3, PRS: 1, PRE: 4, MAN: 2, AUT: 1 },
    briga: 0, dado: '1d2', bld: 0, desloc: '6m',
    porte: 'Minúsculo', dieta: 'Detritívoro de Essência — vive do resíduo que o pânico deixa no ar, não da magia',
    ancoras: ['Ruína de Ibirá', 'Vale de Silmarela'],
    habitat: 'Ruína de Ibirá — teto de gruta onde bicho assustado se abriga; e em qualquer caverna do Vale de Silmarela',
    densidade: 'colônia no teto, doze a vinte',
    cond: ['Serenidade', 'Entorpecido'],
    corpo: 'Vinte centímetros de bicho translúcido, sem boca para sólido nenhum: absorve pela membrana das costas. Fica de cabeça para baixo no teto das grutas exatamente onde a caça se esconde do que a persegue, porque é ali que sobra o que ele come. Quando se alimenta, a pulsação dele fica visível através da pele.',
    interacao: 'Dormir sob a colônia limpa a cabeça: **Serenidade 1** por turno de descanso, e é a única fonte de Sanidade que não custa nada a ninguém. Ficar além do que devia é o problema — a calma vira torpor e a pessoa acorda **Entorpecido**, com uma ação só no turno.',
    sinal: 'A gruta é silenciosa demais. Não é ausência de som: é ausência de sobressalto — nem os ratos correm.',
    regra: 'Não desce. Nunca. O que não estiver debaixo dele não é comida, e por isso não há como ser atacado por um.',
    remedio: 'Passar a noite sob a colônia antes de descer numa ruína é hábito de batedor, e é bom. O que a aldeia diz errado é que dá para "encher o estoque" ficando dois dias — quem fica dois dias sai de lá sem conseguir pensar em dois passos seguidos.',
    moral: 'O medo da calma que se paga com a vontade.',
    rito: { chamariz: 'ficar imóvel e com medo debaixo dele — ele não vem ao corajoso',
        preco: 'uma noite de sono ruim no chão da gruta',
        prova: 'quando um deles descer e pousar em você em vez de esperar de cima',
        erro: 'fazer barulho. A colônia inteira sobe e não desce mais naquela lua' },
},
{
    nome: 'Solvina', origem: 'nova', alvo: 0.08,
    altura: 0.25, atributos: { FOR: 1, DES: 2, VIG: 2, INT: 1, RAC: 1, PRS: 2, PRE: 2, MAN: 1, AUT: 1 },
    briga: 1, dado: '1d4', bld: 0, desloc: '4,5m',
    porte: 'Minúsculo', dieta: 'Decompositor — digere por fora, encharca a carniça de enzima e bebe o que sobra',
    ancoras: ['Borda de Silmarela'],
    habitat: 'Borda de Silmarela — a beira do rio, onde a água deixa o que trouxe',
    densidade: 'solitária, mas várias na mesma praia de cheia',
    cond: ['Purificado', 'Hemorragia'],
    corpo: 'Anfíbio de um palmo, pele sempre encharcada. Não tem dente nem estômago que preste: cobre o que vai comer com a própria secreção, espera desmanchar e bebe. A enzima não distingue carniça de outra coisa — desmancha o que for feito de tecido, e é indiferente a qual.',
    interacao: 'Nas mãos de quem sabe, a secreção tira do corpo o que está agarrado nele: **Purificado**, uma condição negativa embora. Nas mãos de quem não sabe, ela desmancha o que estava segurando a pessoa inteira — ponto de sutura, atadura, crosta. Ferida costurada que recebe Solvina abre: **Hemorragia**.',
    sinal: 'O couro amolece. Bota, correia e bainha deixadas na praia amanhecem moles como pano.',
    regra: 'Não sobe em nada seco. Onde não há umidade ela não anda, e um degrau de pedra seca é parede para ela.',
    remedio: 'Guardar em pote de barro cozido ou vidro funciona — nenhum dos dois é tecido. Prata "que resiste" não resiste a nada: a prata está bem porque é metal, e a crença já fez muita gente pagar caro por um pote que o barro fazia igual.',
    moral: 'A moral do remédio que é o mesmo veneno, e a diferença é a mão.',
    rito: { chamariz: 'carne velha na beira, na água rasa',
        preco: 'um pote de barro cozido, e ele nunca mais serve para outra coisa',
        prova: 'quando ela subir na sua mão molhada e NÃO começar a secretar',
        erro: 'pegá-la com a mão seca ou com luva de couro. A luva se vai, e a mão descobre o que é digestão externa' },
},
{
    nome: 'Puxa-Passo', origem: 'nova', alvo: 0.08,
    altura: 0.10, atributos: { FOR: 1, DES: 4, VIG: 1, INT: 1, RAC: 1, PRS: 3, PRE: 2, MAN: 1, AUT: 1 },
    briga: 0, dado: '1d2', bld: 0, desloc: '12m',
    porte: 'Minúsculo', dieta: 'Herbívoro — seiva de capim de beira de estrada',
    ancoras: ['Planície de Velmora'],
    habitat: 'Planície de Velmora — as estradas e as trilhas de gado, do pôr do sol à madrugada',
    densidade: 'coro, cinquenta ou mais; um sozinho não faz nada',
    cond: ['Célere', 'Exaustão'],
    corpo: 'Um palmo de bicho estridulante, abdome oco que funciona como caixa de ressonância. Sozinho é um inseto qualquer. O que importa é o coro: eles se sincronizam entre si ao longo de léguas de estrada, e o corpo de quem caminha acompanha o compasso sem ser consultado.',
    interacao: 'Andar dentro do coro faz o caminho encurtar: **Célere 2** enquanto o compasso segurar. O problema é que o coro não cansa e a pessoa cansa — quem marcha além do pico da noite chega com **Exaustão 1**, e a estrada que encurtou cobra na chegada.',
    sinal: 'Você repara que seus próprios pés estão batendo junto com alguma coisa. Reparar já é tarde: faz meia légua que estão.',
    regra: 'Cala ao amanhecer, sem exceção. Nenhum coro atravessa o nascer do sol, e é por isso que a estrada de dia é honesta.',
    remedio: 'Cera no ouvido funciona — sem o compasso não há entrada. Cantar por cima é o conselho ruim que todo tropeiro dá: acaba-se cantando no ritmo deles, e agora se está sem fôlego também.',
    moral: 'O medo do que ajuda sem pedir licença, e não sabe a hora de parar.',
    rito: { chamariz: 'não há — não se doma o coro, se doma um, e um sozinho é um inseto mudo',
        preco: 'uma gaiola de vime e a aceitação de que ele só vale acompanhado',
        prova: 'quando o que você pegou estridular sozinho na gaiola, longe do coro',
        erro: 'pegar dois. Eles sincronizam entre si dentro da gaiola e você não dorme mais' },
},
{
    nome: 'Adoça-Pão', origem: 'nova', alvo: 0.08,
    altura: 0.15, atributos: { FOR: 1, DES: 3, VIG: 2, INT: 1, RAC: 2, PRS: 1, PRE: 2, MAN: 1, AUT: 1 },
    briga: 1, dado: '1d2', bld: 0, desloc: '7,5m',
    porte: 'Minúsculo', dieta: 'Granívoro — vive no cereal armazenado e carrega no pelo o fungo que o adoça',
    ancoras: ['Sereni'],
    habitat: 'Sereni — celeiro, tulha e paiol; qualquer lugar do Vale onde se guarde grão',
    densidade: 'ninhada, seis a dez por celeiro',
    cond: ['Vigorado', 'Delírio'],
    corpo: 'Roedor de um palmo que não come muito e não estraga quase nada — o que ele faz é carregar. O pelo dele leva um fungo de espiga para dentro da tulha, e o fungo adoça o grão e o deixa mais nutritivo do que era. Isso em ano seco. Em ano úmido o mesmo fungo esporula errado, e o que ele adoça vira outra coisa.',
    interacao: 'Pão do grão que ele visitou em **ano seco**: **Vigorado 2**, Vitalidade Máxima acima do normal enquanto durar. O mesmo pão, do mesmo bicho, do mesmo celeiro em **ano úmido**: **Delírio 1** — e a aldeia inteira come do mesmo forno.',
    sinal: 'O grão fica doce. É esse o sinal, e é o problema: o sinal bom e o sinal ruim são exatamente o mesmo.',
    regra: 'Só entra em grão guardado. Lavoura em pé não interessa a ele — o que ele quer já está na tulha.',
    remedio: 'Espalhar o grão para secar antes de moer funciona, e é o que separa o ano bom do ano ruim. Matar o bicho não: o fungo já está lá dentro e o Adoça-Pão morto não desfaz nada. Matam mesmo assim, todo ano.',
    moral: 'A moral do celeiro: a fome do inverno e a loucura da primavera saem do mesmo saco.',
    rito: { chamariz: 'um punhado de grão fora da tulha',
        preco: 'a decisão de manter um bicho que pode envenenar a aldeia',
        prova: 'quando ele comer da sua mão dentro do celeiro, com a porta aberta',
        erro: 'fechar a porta. Ele passa a noite no grão e o que sai da tulha na manhã seguinte não é escolha sua' },
},
/* ── do cofre da pasta Reliera ── */
{
    nome: 'Salamandra-Musgo', origem: 'cofre', alvo: 0.05,
    altura: 0.12, atributos: { FOR: 1, DES: 3, VIG: 2, INT: 1, RAC: 1, PRS: 1, PRE: 3, MAN: 1, AUT: 1 },
    briga: 0, dado: '1d2', bld: 0, desloc: '3m',
    pericias: { 'Furtividade': 5, 'Sobrevivência': 2 },
    porte: 'Minúsculo', dieta: 'Detritívoro — folha em decomposição e o que cresce no próprio dorso',
    ancoras: ['Floresta de Silmarela'],
    habitat: 'Floresta de Silmarela — o chão úmido e sombreado, longe de clareira',
    densidade: 'espalhadas, nunca em grupo visível',
    cond: ['Serenidade'],
    corpo: 'Um palmo de salamandra sob uma camada espessa de musgo vivo que cresce nela e não sobre ela — a pele viscosa segura a umidade que o musgo precisa, e o musgo devolve cobertura. Olhos verdes, movimento lento, e enquanto descansa não se distingue do chão.',
    interacao: 'Onde uma delas dorme uma noite, o mato responde: no dia seguinte há cobertura onde não havia. Quem faz o Descanso Longo nesse leito recebe **Serenidade 1** por turno de descanso — é o efeito de dormir num lugar que está vivo e não te quer mal.',
    sinal: 'Um trecho de mato mais fechado do que estava ontem, sem que ninguém tenha plantado nada.',
    regra: 'Foge ao primeiro sinal de perigo e não ataca nunca — nem encurralada, nem ferida. Não há como ser atacado por uma.',
    remedio: 'Batedor que quer dormir bem procura o mato novo e é sábio. Levar a salamandra junto para ter o efeito onde quiser não funciona: fora da umidade dela o musgo morre em um dia, e o que sobra é uma salamandra pelada e triste.',
    moral: 'A moral do que melhora o lugar só por estar nele, e não sobrevive a ser levado embora.',
    rito: { chamariz: 'não se chama — encontra-se, e só onde já está úmido',
        preco: 'carregar água suficiente para manter o musgo vivo, todo dia, para sempre',
        prova: 'quando ela não fugir com você a um passo',
        erro: 'pegá-la com a mão seca. O musgo racha e ela leva uma estação para refazer' },
},
{
    nome: 'Aracasca', origem: 'cofre', alvo: 0.19,
    altura: 0.55, atributos: { FOR: 2, DES: 3, VIG: 2, INT: 1, RAC: 2, PRS: 0, PRE: 3, MAN: 0, AUT: 0 },
    briga: 1, dado: '1d4', bld: 0.66, desloc: '8m',
    pericias: { 'Furtividade': 3, 'Sobrevivência': 2 },
    porte: 'Pequeno', dieta: 'Carnívoro de emboscada — o que passar sozinho debaixo do tronco',
    ancoras: ['Floresta de Silmarela', 'Floresta de Silmari'],
    habitat: 'Floresta de Silmarela e Floresta de Silmari — tronco oco e emaranhado de cipó, nas duas matas',
    densidade: 'solitária, uma por tronco',
    cond: ['Entorpecido'],
    corpo: 'Aracnídeo de meio metro de vão, casca dorsal que copia madeira podre. Anda em superfície vertical e passa o dia inteiro imóvel dentro de um tronco oco. A peçonha dela não mata nem paralisa: entorpece, e é só o que ela precisa — presa lenta é presa que não sai andando do tronco.',
    interacao: 'A picada não é para matar. Quem é picado fica **Entorpecido** — uma ação só no turno, e a escolha de qual é dele. É a diferença entre sair do tronco e não sair.',
    sinal: 'Cipó que não balança com o vento junto do resto.',
    regra: 'Só ataca quem está sozinho. Grupo passa debaixo dela e ela não desce — a conta dela é essa, e é a razão de batedor nunca ir sozinho ao emaranhado.',
    remedio: 'Bater no tronco antes de passar funciona: ela se enfia mais para dentro. Fogo na boca do tronco não — o tronco é oco e ela sai pelo outro lado, agora acordada.',
    moral: 'O medo do que espera o que se separou do grupo.',
    rito: { chamariz: 'um bicho pequeno e vivo, deixado na boca do tronco',
        preco: 'a certeza de que você foi sozinho — ela não desce para dois',
        prova: 'no instante em que ela desce e para, antes de picar',
        erro: 'recuar. Ela pica o que recua, porque o que recua é o que ela come' },
},
{
    nome: 'Aranha-Galho', origem: 'cofre', alvo: 0.69,
    altura: 0.90, atributos: { FOR: 3, DES: 4, VIG: 4, INT: 1, RAC: 2, PRS: 2, PRE: 4, MAN: 1, AUT: 2 },
    briga: 3, dado: '1d6', bld: 1.10, desloc: '9m',
    pericias: { 'Furtividade': 4, 'Resiliência': 4, 'Intimidação': 2, 'Observação': 1 },
    porte: 'Médio', dieta: 'Carnívoro de emboscada — o que a teia segurar',
    ancoras: ['Floresta de Silmarela', 'Floresta de Silmari'],
    habitat: 'Floresta de Silmarela e Floresta de Silmari — copa alta e árvore densa, nas duas matas',
    densidade: 'solitária e territorial, uma por trecho de copa',
    cond: ['Imobilizado', 'Desorientado', 'Ofuscado'],
    corpo: 'Pernas longas e finas que passam por galho seco, carapaça marrom-acinzentada irregular como casca, com musgo e líquen crescendo por cima de verdade — a camuflagem não é cor, é um ecossistema pequeno morando nela. Paciente a ponto de ficar dias na mesma posição.',
    interacao: 'A teia dela segura: **Imobilizado** até alguém cortar — e a condição não exige que ela pague ação nenhuma para manter, diferente de agarrar. A peçonha é alucinógena antes de ser paralisante: **Desorientado**, o alvo perde de onde vem o golpe. Em luz solar direta ela mesma fica **Ofuscado**, e é a fraqueza inteira dela.',
    sinal: 'Um galho a mais na árvore, e ele tem musgo do lado errado.',
    regra: 'Não sai da copa. O chão é dela apenas quando a presa já está na teia — quem descer a árvore está fora do alcance dela e ela não persegue.',
    remedio: 'Espelho ou lâmina polida para jogar sol na copa funciona e é o que a aldeia faz. Cortar a teia com faca fria não: a teia é forte demais, e o que resolve é fogo ou uma lâmina serrilhada.',
    moral: 'O medo da paciência — do que espera dias por você e tem tempo de sobra.',
    rito: { chamariz: 'presa viva amarrada na copa, e a disposição de subir até lá',
        preco: 'subir desarmado, porque as duas mãos são para o galho',
        prova: 'quando ela descer até a altura dos seus olhos e ficar parada',
        erro: 'levar tocha. Ela recua para o alto e a copa inteira vira teia entre você e o chão' },
},
{
    nome: 'Javali-Espinhoso', origem: 'cofre', alvo: 1.15,
    altura: 1.10, atributos: { FOR: 5, DES: 3, VIG: 5, INT: 1, RAC: 2, PRS: 2, PRE: 4, MAN: 1, AUT: 2 },
    briga: 2, dado: '1d8', bld: 1.54, desloc: '12m',
    pericias: { 'Resiliência': 3, 'Atletismo': 2, 'Intimidação': 2, 'Observação': 1 },
    porte: 'Grande', dieta: 'Onívoro — raiz, tubérculo, carniça e o que pisar no território errado',
    ancoras: ['Floresta de Silmarela', 'Floresta de Silmari'],
    habitat: 'Floresta de Silmarela e Floresta de Silmari — mata densa e as clareiras de borda, nas duas matas',
    densidade: 'solitário; a fêmea com cria vale por dois',
    cond: ['Hemorragia'],
    corpo: 'Javali de couro grosso e escuro, com uma crista de espinhos queratinosos ao longo do dorso — não é pelo endurecido, é estrutura própria, com raiz na pele e ponta farpada. Olhos vermelhos, presas longas e curvas. O espinho solta e a farpa faz com que não saia sozinho.',
    interacao: 'Ele não caça ninguém, mas o território é dele e ele decide onde ele começa. Sacode o dorso e lança espinho a curta distância; quem leva fica com a farpa dentro: **Hemorragia**, e a farpa tem de ser tirada antes de o sangramento parar.',
    sinal: 'Espinhos no chão, apontando para onde ele foi.',
    regra: 'Investe em linha reta e não corrige a curva. Passo lateral em terreno com árvore resolve; passo lateral em campo aberto não resolve nada.',
    remedio: 'Subir em árvore funciona — ele não sobe e desiste rápido. Fingir-se de morto é o conselho que mata: ele não come quem se deitou, mas passa por cima, e o que passa por cima pesa duzentos quilos.',
    moral: 'A moral da cerca: o que é território de quem, e quem foi avisado.',
    rito: { chamariz: 'raiz e tubérculo na borda do território, nunca dentro',
        preco: 'meses. Um pouco mais para dentro a cada semana, sem pressa',
        prova: 'quando ele comer com você à vista e não sacudir o dorso',
        erro: 'entrar antes do tempo. Ele investe uma vez, e uma vez basta' },
},
{
    nome: 'Espectro da Seiva Negra', origem: 'cofre', alvo: 1.17,
    altura: 1.80, atributos: { FOR: 4, DES: 5, VIG: 3, INT: 2, RAC: 3, PRS: 2, PRE: 5, MAN: 3, AUT: 4 },
    briga: 3, dado: '1d8', bld: 1.00, desloc: '12m',
    pericias: { 'Furtividade': 4, 'Observação': 3, 'Resiliência': 2, 'Abismancia': 2 },
    porte: 'Médio', dieta: 'Predador — vida, e a seiva das árvores que corrompe para atraí-la',
    ancoras: ['Floresta de Velmora'],
    habitat: 'Floresta de Velmora — os trechos de árvore corrompida perto das Ruínas',
    densidade: 'solitário, e o trecho de mata onde ele está fica sem outro predador',
    cond: ['Corrompido', 'Definhado', 'Ofuscado'],
    corpo: 'Alto e esguio, contorno que não fecha — fumaça negra condensada com peso de corpo, gotejando seiva escura por onde passa. Olhos como brasa verde. As extremidades alongam em garra de sombra. Luz fraca atravessa ele sem efeito; luz solar plena e luz mágica forte, não.',
    interacao: 'O golpe deixa a seiva na ferida, e a seiva é o que ele é: **Corrompido**, empilhando até três, e o corpo perde o que a seiva ocupa — **Definhado**, Vitalidade Máxima drenada até o Descanso Longo. O manto dele espessa a sombra em volta e deixa **Ofuscado** quem tentar mirá-lo dentro dela.',
    sinal: 'Seiva escura escorrendo de árvore que não tem corte.',
    regra: 'Não atravessa luz solar plena. Um pedaço de clareira ao meio-dia é parede — e é por isso que ele caça de véspera e nunca à tarde.',
    remedio: 'Andar por clareira em vez de por dentro da mata funciona, e custa o dobro de caminho. Tocha comum não funciona e mata muita gente que confiou nela: luz fraca é o que ele é imune, e a tocha só mostra onde você está.',
    moral: 'O medo da mata que já foi boa — de que o lugar apodreça e continue no mesmo lugar.',
    rito: null, indomavel: 'sombra corrompida — não tem o que domar, e a seiva não faz vínculo',
},
{
    nome: 'Avarbus Azire', origem: 'cofre', alvo: 0.99,
    altura: 1.50, atributos: { FOR: 3, DES: 4, VIG: 5, INT: 2, RAC: 4, PRS: 4, PRE: 4, MAN: 1, AUT: 3 },
    briga: 4, dado: '1d8', bld: 2.20, desloc: '12m',
    pericias: { 'Observação': 4, 'Resiliência': 3, 'Intimidação': 3 },
    porte: 'Médio', dieta: 'Necrófago — cadáver em decomposição, e fonte de trevas, que ele consome como se fosse comida',
    ancoras: ['Ruínas de Velmora'],
    habitat: 'Ruínas de Velmora — ruína, cemitério abandonado e subsolo',
    densidade: 'solitário ou par; atua como alfa sobre os Avarbus comuns do território',
    cond: ['Chaga'],
    corpo: 'Maior que o Avarbus comum e revestido de fibra rígida cintilante, com o dorso inteiro em espinho. O que o separa do irmão menor é o azire pulsando nos olhos: ele consome trevas — fenda, ruptura, resíduo abissal — e devolve luz. Se perde o azire, desmaia de fraqueza, e é a única maneira barata de derrubá-lo.',
    interacao: 'Mordida necrótica: a ferida não fecha enquanto ele estiver de pé — **Chaga**, e nenhuma cura pega até ele cair. O dorso espinhaço é reação, não ataque: quem bate nele de perto se fere nos espinhos. A Repulsão Azire empurra até cinco metros e anula o golpe corpo a corpo que a disparou.',
    sinal: 'Uma ruína que devia estar escura e não está. Onde ele come, a fenda apaga.',
    regra: 'Ataca o vivo que se aproxima, e prefere o já ferido. Deixa outros Avarbus viverem no território dele — mantidos na fronteira, nunca no centro.',
    remedio: 'Deixar um cadáver a distância para ele levar embora funciona, e é o que os coveiros de ruína fazem há gerações. Levar luz sagrada para "expulsá-lo" é o pior conselho que existe: luz é o que ele come.',
    moral: 'A reverência ao guardião dos mortos — e o desconforto de que o que limpa a ruína é o que a deixa infértil.',
    /* DOMÁVEL por decisão do usuário (31/08/2026): a ficha do cofre diz "Domável
       Hostil" e ela vence. É EXCEÇÃO dentro da espécie — o Avarbus comum segue
       marcado indomável no banco, e o alfa é o que se doma. A leitura que fecha:
       o azire é o que o torna abordável; o irmão sem azire não tem com o que
       negociar. ⚠ Se a espécie tiver de ser uniforme, é o Avarbus comum que
       precisa ser revisto, não este. */
    rito: { chamariz: 'um cadáver inteiro, deixado à distância — e a paciência de não acompanhar',
        preco: 'entregar os mortos que você tinha para enterrar, um por um',
        prova: 'quando ele comer sem primeiro empurrar você com a Repulsão Azire',
        erro: 'chegar com luz. Ele come a luz, e o que era um acordo vira alimento' },
},
];

/* ═══════════════════════ conferências e conta ═══════════════════════ */
const grab = async c => (await db.collection(c).get()).docs.map(d => ({ id: d.id, ...d.data() }));
const [npcs, condicoes, skills, geo] = await Promise.all([
    grab('npcs'), grab('system/data/conditions'), grab('system/data/skills'), grab('worldbuilding-geography')]);
const condPorNome = {}; for (const c of condicoes) condPorNome[norm(c.nome)] = c;
const skPorNome = {}; for (const s of skills) skPorNome[norm(s.nome)] = s;
const briga = skPorNome[norm('Briga')];
const nomesGeo = new Set(geo.map(g => norm(g.nome)));

const erros = [];
if (!briga) erros.push('perícia "Briga" não achada no catálogo');

const linhas = [];
for (const c of LEVA) {
    /* colisão de nome */
    if (npcs.some(n => norm(n.nome) === norm(c.nome))) { erros.push(`"${c.nome}": já existe em npcs`); continue; }
    /* condições citadas existem? */
    for (const cd of c.cond) if (!condPorNome[norm(cd)]) erros.push(`"${c.nome}": condição "${cd}" NÃO existe no catálogo`);
    /* habitat aponta para lugares que existem? */
    for (const anc of c.ancoras) if (!nomesGeo.has(norm(anc)))
        erros.push(`"${c.nome}": habitat ancorado em "${anc}", que não existe em worldbuilding-geography`);
    /* perícias citadas existem? */
    for (const p of Object.keys(c.pericias || {})) if (!skPorNome[norm(p)]) erros.push(`"${c.nome}": perícia "${p}" não existe no catálogo`);

    const a = c.atributos, FOR = a.FOR, DES = a.DES, VIG = a.VIG;
    const tamanho = c.altura * 3;
    const vit = (VIG + tamanho) * 3;
    const alvoCru = Math.max(FOR, DES) + c.briga;
    const alvo = Math.min(alvoCru, 9), transb = Math.max(0, alvoCru - 9);
    const P = Math.max(0, Math.min((alvo - DEFESA) / 10, 0.9));
    const dm = medio(c.dado);
    if (!Number.isFinite(dm)) { erros.push(`"${c.nome}": dado ilegível`); continue; }
    const liq = Math.max(1, dm + FOR - BLD_REF);
    const dpr = P * liq, forca = dpr / U, grau = grauDe(forca);

    /* trava de desenho: a conta tem que bater com a força-alvo declarada */
    const desvio = Math.abs(forca - c.alvo) / c.alvo;
    if (desvio > 0.12) erros.push(`"${c.nome}": força ${br(forca, 3)}× foge do alvo de desenho ${br(c.alvo, 3)}× (${br(desvio * 100, 1)}%)`);

    if (c.bld > 3.90) erros.push(`"${c.nome}": Blindagem ${c.bld} passa do teto natural 3,90`);

    const rodadasPraCair = vit / U, rodadasPraMatar = dpr > 0 ? VIT_REF / dpr : Infinity;

    const nivelAmeaca = [
        grau,
        `${br(forca)}×${transb ? ` (+${transb} Transbordo)` : ''}`,
        c.densidade,
        c.rito ? clausulaDoma(grau) : `Indomável: ${c.indomavel} (salvo decisão do Narrador)`,
        c.origem === 'cofre' ? 'do bestiário do cofre, traduzida para a régua v3' : 'criatura de interação: o que ela faz é condição, não dano',
    ].join(' · ');

    const comportamento = [
        c.interacao.replace(/\*\*/g, ''),
        '',
        `O SINAL: ${c.sinal}`,
        `A REGRA: ${c.regra}`,
        `O REMÉDIO: ${c.remedio}`,
        `A MORAL: ${c.moral}`,
        ...(c.rito ? ['', 'RITO DE DOMA',
            `Chamariz: ${c.rito.chamariz}`, `Preço: ${c.rito.preco}`,
            `A prova: ${c.rito.prova}`, `O erro: ${c.rito.erro}`] : []),
    ].join('\n');

    const periciasEstruturadas = [
        { refId: briga.id, nivel: c.briga },
        ...Object.entries(c.pericias || {}).filter(([p]) => skPorNome[norm(p)])
            .map(([p, nv]) => ({ refId: skPorNome[norm(p)].id, nivel: nv })),
    ].filter(p => p.nivel > 0);

    /* ⚡ Poder: atributos + perícias, mesmas fórmulas de npc-poder.js */
    const poderAtr = Object.values(a).reduce((s, v) => s + 5 * v * (v + 1) / 2, 0);
    const poderPer = periciasEstruturadas.reduce((s, p) => {
        const sk = skills.find(x => x.id === p.refId);
        return s + (Number(sk?.custoEvolucao) || 4) * p.nivel * (p.nivel + 1) / 2;
    }, 0);
    const poder = poderAtr + poderPer;

    linhas.push({
        ...c, tamanho, vit, alvo, alvoCru, transb, P, liq, dpr, forca, grau, poder,
        rodadasPraCair, rodadasPraMatar, nivelAmeaca, comportamento, periciasEstruturadas,
        doc: {
            schemaVersion: 2, modoFicha: 'rapido', nome: c.nome, tipo: 'criatura',
            porte: c.porte, tamanho: `${br(c.altura)} m`,
            papel: c.origem === 'cofre' ? 'Criatura do bestiário' : 'Criatura de interação — aplica condição, não dano',
            local: c.ancoras.join(' · '),
            tags: `criatura, bestiário, ${c.origem === 'cofre' ? 'cofre reliera' : 'interação'}`,
            visibilidade: 'secreto', aliadoProprio: false, mesaId: '', vinculos: [],
            racaRef: { refId: null, custom: '' }, classeRef: { refId: null, custom: '' },
            triboRef: { refId: null, custom: '' }, raca: '', classe: '', tribo: '',
            peculiaridades: [], modulosClasse: [], partesDoCorpo: [], funcao: [],
            atributos: a, periciasEstruturadas,
            ataques: `Ataque natural (A. Padrão): Alvo ${alvo}${transb ? ` (+${transb} Transbordo)` : ''}, ${c.dado}+${FOR}.   [Briga ${c.briga} + FOR/DES ${Math.max(FOR, DES)}]`,
            valoresDer: {
                VIT: Number(vit.toFixed(2)), SAN: 0, ENER: 0,
                PERC: (a.PRE || 0) + (a.RAC || 0), INI: (a.DES || 0) + (a.RAC || 0),
                REA: Math.min(a.DES || 0, a.RAC || 0) + 1, BLD: c.bld, DESLOCAMENTO: c.desloc,
                atual: {}, extras: [], vinculados: [], overrides: {},
            },
            criatura: { habitat: c.habitat, comportamento, dieta: c.dieta, nivelAmeaca },
            rolePlay: { personalidade: [], trejeitos: '', motivacao: '', segredos: '',
                frases: '', historia: c.corpo, relacoes: { aliado: '', rival: '', devedor: '' } },
            loot: { itens: '', luns: '', pistas: '', complicacoes: '' },
        },
    });
}

/* ═══════════════════════ relatório ═══════════════════════ */
console.log(`\n=== Leva de criaturas — ${linhas.length} fichas · base ${br(U)} (Régua v3, defensor Defesa ${DEFESA} / Blindagem ${BLD_REF}) ===\n`);
console.log('nome                     org     Alt   Vit   Bld  Alvo  dado      P    líq   DPR   força    Grau        Poder  f/100   cai em   mata em');
for (const l of linhas) {
    console.log(
        l.nome.padEnd(24) + ' ' + (l.origem === 'cofre' ? 'cofre' : 'nova ').padEnd(7) +
        br(l.altura, 2).padStart(5) + ' ' + br(l.vit, 1).padStart(5) + ' ' + br(l.bld, 2).padStart(5) + '  ' +
        String(l.alvo + (l.transb ? `+${l.transb}` : '')).padStart(4) + '  ' + l.dado.padEnd(6) + ' ' +
        br(l.P).padStart(5) + ' ' + br(l.liq, 1).padStart(5) + ' ' + br(l.dpr).padStart(5) + '  ' +
        (br(l.forca) + '×').padStart(7) + '  ' + l.grau.padEnd(11) + ' ' + String(l.poder).padStart(5) + '  ' +
        br(l.poder ? l.forca / l.poder * 100 : 0).padStart(5) + '  ' +
        (br(l.rodadasPraCair, 1) + ' rod').padStart(8) + ' ' + (br(l.rodadasPraMatar, 1) + ' rod').padStart(9));
}

console.log('\n--- o que cada uma FAZ (as condições, todas conferidas no catálogo) ---');
for (const l of linhas) console.log(`\n── ${l.nome}   [${l.cond.join(' · ')}]\n   ${l.interacao.replace(/\*\*/g, '')}`);

console.log('\n--- nivelAmeaca gravado ---');
for (const l of linhas) console.log(`\n${l.nome}\n   ${l.nivelAmeaca}`);

console.log('\n--- amostra do bloco de comportamento (folclore + rito) ---');
console.log(`\n══ ${linhas[0].nome}\n${linhas[0].comportamento.split('\n').map(s => '   ' + s).join('\n')}`);

const fora = linhas.filter(l => l.rodadasPraMatar < 3 || l.rodadasPraCair < 3);
if (fora.length) {
    console.log('\n⚠ Fora do invariante de 3–10 rodadas no duelo 1×1 (reportado, não corrigido):');
    for (const l of fora) console.log(`   ${l.nome}: um guerreiro a derruba em ${br(l.rodadasPraCair, 1)}, ela derruba um PJ em ${br(l.rodadasPraMatar, 1)}`);
    console.log('   (esperado nas de interação: elas não são feitas para trocar golpe — o valor delas é a condição)');
}

if (erros.length) { console.log('\n❌ ERROS — nada foi gravado:'); erros.forEach(e => console.log('   ' + e)); process.exit(1); }
console.log('\n✅ conferências OK: nenhum nome colide, toda condição existe, todo habitat existe, toda perícia existe.');

if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

const iso = new Date().toISOString();
const batch = db.batch();
for (const l of linhas) batch.set(db.collection('npcs').doc(), { ...l.doc, lastUpdate: iso, lastUpdateBy: AUTOR });
await batch.commit();
console.log(`\n✅ ${linhas.length} criaturas gravadas em npcs.`);
process.exit(0);
