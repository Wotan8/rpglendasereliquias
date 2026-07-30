---
name: Gerar Personagem ou Criatura
description: Gera uma imagem de personagem/criatura de Lendas e Relíquias usando o prompt mestre e salva no destino informado.
---

# Skill: Geração de Personagem/Criatura (Lendas e Relíquias)

Quando o usuário invocar esta skill, ele deve fornecer a **descrição do personagem/criatura** e o **local de destino** para a imagem.

## Passo 1: Geração da Imagem
Use a ferramenta `generate_image`. 
O `Prompt` enviado para a ferramenta deve ser a união do **PROMPT MASTER** (abaixo) com a **Descrição do Usuário**.

**PROMPT MASTER — GERAÇÃO DE PERSONAGENS — LENDAS E RELÍQUIAS**
[ESTILO ARTÍSTICO — OBRIGATÓRIO EM TODA IMAGEM]
Ilustração digital 2D contemporânea em estilo cel-shading estilizado de alto orçamento, mesclando estética de animação com pintura digital semi-realista. Arte conceitual de RPG de fantasia medieval sombria e épica. O mundo é medieval — não existe tecnologia moderna, eletricidade, plástico ou materiais industriais. Tudo é forjado, costurado, esculpido ou colhido. O cenário respira pedra, madeira, couro, metal batido à mão, velas, tochas, fogueiras e luar.
Lineart: Traço limpo, contínuo e bem definido com variação de espessura (line weight) — linhas externas (silhueta) ligeiramente mais grossas para destacar o personagem, linhas internas (detalhes do rosto, dobras de tecido) finas e afiadas. As linhas NÃO são puramente pretas — utilizam tons de marrom escuro ou cores análogas às áreas de sombra, suavizando a transição entre desenho e cor.
Coloração e Sombreamento: Blocos sólidos de sombra com bordas bem marcadas (estilo anime/cel-shading), porém com uma das extremidades levemente suavizada por gradiente sutil para dar volume e tridimensionalidade. Paleta de cores saturada porém harmoniosa, com uso forte de cores complementares entre personagem e cenário. Predominância de subtons naturais e terrosos que conferem aspecto orgânico e medieval — ocres, marrons, verdes profundos, vermelhos queimados, dourados envelhecidos, cinzas de pedra. Oclusão ambiental com sombras mais profundas em fendas, dobras de roupa e sob o pescoço, separando camadas visuais.
Iluminação e Profundidade: Fonte de luz direcional que remete a iluminação medieval — luz de tocha, vela, luar, sol filtrado entre copas de árvores, braseiros ou clareiras. Highlights nos cabelos e bordas das roupas. Rim light sutil nas bordas opostas à luz principal, destacando a silhueta. Fundo com renderização mais simples e leve efeito de desfoque (profundidade de campo), mantendo foco total e nitidez no personagem em primeiro plano. O fundo deve sugerir ambientação medieval: florestas ancestrais, muralhas de pedra, tavernas escuras, estradas de terra, ruínas, acampamentos com fogueira, templos antigos.
Textura e Acabamento: Camada leve de ruído/granulação fina sobre a composição final (grain digital), removendo o aspecto plástico e aproximando de textura de pergaminho/mídia física. Pinceladas suaves visíveis em áreas de degradê, especialmente pele e fundos, conferindo aspecto de pintura manual. Texturas de materiais medievais devem ser visíveis — grão do couro, trama do tecido rústico, brilho fosco do metal batido, aspereza da madeira, poeira e terra.

[FORMATO E ENQUADRAMENTO — OBRIGATÓRIO]
Formato da imagem: RETRATO (vertical/portrait), proporção aproximada 2:3 ou 3:4.
O personagem SEMPRE aparece de corpo inteiro ou quase inteiro (ver exceções raciais abaixo).
O personagem deve parecer vivo — com expressão facial, gesto, postura ou ação que faça sentido com sua personalidade, classe e história descritas pelo usuário.
O personagem é o foco absoluto da imagem, centralizado, com o fundo desfocado e complementar ao contexto narrativo.
Ambientação SEMPRE medieval fantástica — sem elementos modernos de nenhum tipo.
Não há necessidade de responder ao usuário com texto — apenas gerar a imagem do personagem.

[AMBIENTAÇÃO MEDIEVAL — REGRAS DE MATERIALIDADE]
Todo elemento visual deve respeitar a materialidade de um mundo de fantasia medieval:
Tecidos: Linho, lã, seda bruta, algodão rústico, juta, couro curtido, peles de animais, camurça, veludo (apenas para nobreza). Nada de tecidos sintéticos ou com acabamento industrial.
Metais: Ferro forjado, aço batido, bronze, cobre, prata, ouro. Armaduras com rebites visíveis, marcas de martelo, imperfeições artesanais. Nada de metal cromado, polido como espelho ou industrializado.
Armas: Espadas, machados, lanças, arcos de madeira e corda, bestas, maças, cajados, adagas, clavas, martelos de guerra, foices. Tudo feito de madeira, osso, couro e metal forjado.
Acessórios: Fivelas de metal, broches de bronze, cordas de cânhamo, bolsas de couro, cantis de couro ou argila, cintos com tachas, amuletos de osso/pedra/cristal, anéis rústicos, coroas de metal batido.
Iluminação ambiente: Tochas, velas de cera, lamparinas de óleo, fogueiras, braseiros, luar, luz do sol natural. Nunca luz elétrica ou artificial moderna.
Cenários sugeridos no fundo: Florestas densas e ancestrais, montanhas nevadas, desertos abrasadores, vilarejos de pedra e madeira, castelos e fortificações, tavernas com telhado de palha, templos em ruínas, cavernas com cristais, acampamentos com barracas de couro, estradas de terra batida, pontes de pedra sobre rios.

[GUIA RACIAL — APARÊNCIA POR RAÇA]
Quando o usuário informar a raça do personagem, aplicar TODAS as características visuais correspondentes abaixo, combinando-as com a descrição individual fornecida:

HUMANO — "Sem Essência / Os Ungidos / Os Protegidos"
Altura: 1,50m a 1,90m (proporção humana padrão).
Pele: Tons variados — claro, moreno, pardo, negro — variando por região de Vasteluna.
Cabelos: Qualquer cor natural humana (preto, castanho, loiro, ruivo), qualquer textura (liso, ondulado, cacheado, crespo).
Olhos: Castanho, verde, azul ou cinza.
Traços faciais: Diversos, refletindo a variedade de povos do mundo real. Sem marcas raciais fantásticas.
Orelhas: Redondas, humanas normais.
Vestimenta medieval: Túnicas de linho, gibões de couro, calças de tecido rústico, botas de couro curtido, capas de lã, armaduras de cota de malha ou placas de ferro forjado dependendo da classe. Camponeses vestem roupas simples de lã e linho em tons terrosos. Nobres vestem tecidos mais finos com bordados discretos. Guerreiros vestem cota de malha, couro reforçado e placas de aço.
Expressão/Postura: Ambiciosos, determinados, com um brilho de urgência no olhar — como alguém que sabe que tem pouco tempo e quer fazer valer cada segundo.
Enquadramento: Corpo inteiro.

ELORIN — "Filhos da Floresta / Os Verdes"
Altura: 1,70m a 1,90m (porte esbelto e gracioso).
Referência étnica: Traços de indígenas sul-americanos, especialmente índios brasileiros — rosto com maçãs do rosto altas e largas, mandíbula definida porém suave, nariz largo e ligeiramente achatado na ponte com ponta arredondada, lábios cheios e bem delineados, sobrancelhas retas e espessas, olhos levemente amendoados e profundos, testa ampla. Pele com textura lisa e brilho saudável como se nutrida pela terra. Estrutura óssea forte mas elegante, com pescoço longo. Ombros proporcionais, corpo magro e atlético como de um caçador da floresta — musculatura definida mas não volumosa, como alguém que vive escalando árvores, nadando em rios e correndo entre as matas. Mãos firmes com dedos longos, como de alguém que trabalha com a terra.
Pele: Tons de verde — do musgo claro ao esmeralda profundo. A pele verde deve parecer natural e orgânica, como se brotasse da própria floresta.
Olhos: Esmeraldas luminosos que parecem brilhar na penumbra, com um leve brilho sobrenatural esverdeado.
Orelhas: Pontudas, elevando-se acima do crânio (maiores e mais verticais que orelhas élficas tradicionais).
Cabelos: Tons de verde, castanho ou negro. Frequentemente adornados com folhas, flores, cipós, penas ou sementes trançadas naturalmente.
Adornos: Pinturas corporais tribais com pigmentos naturais (padrões geométricos, espirais, formas da fauna e flora), colares de sementes, ossos de animais pequenos, braceletes de cipó trançado, piercings de madeira ou pedra.
Vestimenta medieval-tribal: Roupas de fibra natural e couro animal em tons terrosos e verdes — corseletes de casca de árvore trançada, ombreiras de osso e madeira esculpida, saias de fibra ou couro com franjas, botas altas de couro macio amarradas com cipó, capas de folhagem trançada, tiaras de galhos e flores. Armaduras feitas de casca de árvore endurecida, couro de feras da floresta e osso polido. Armas de madeira petrificada, osso afiado e pedra lascada, arcos de cipó e bambu. Nada de metal pesado — tudo orgânico e da floresta.
Expressão/Postura: Sábios, reflexivos, reservados — olhar que enxerga além do visível, postura serena mas alerta como um predador da mata que observa tudo em silêncio.
Enquadramento: Corpo inteiro.

KARU-REAL — "Os Ruivos / Os Escolhidos / Os Aristocratas"
Altura: 1,70m a 2,00m (porte elegante e altivo).
Referência étnica: Traços de povos claros do norte europeu — pele alva como alabastro ou levemente rosada, estrutura óssea aristocrática e angulosa, mandíbula afiada e queixo proeminente, nariz reto e fino com ponte alta e estreita (nariz nórdico/germânico), maçãs do rosto altas e salientes, sobrancelhas arqueadas com elegância, testa alta e nobre. Lábios finos e bem definidos. Estrutura corporal alta e esbelta com ombros largos, como de realeza escandinava medieval — postura impecável, coluna ereta, queixo levemente erguido em sinal de superioridade. Mãos longas e elegantes, pele sem imperfeições.
Pele: Tons de bronze claro a dourado, branco ou pardo, sempre com subtom luminoso e aristocrático.
Cabelos: Ruivos — tons de dourado, loiro platinado, cobre ou vermelho-ouro. Sempre lisos ou ondulados, brilhantes, fluindo como seda. Penteados elaborados ou soltos com elegância.
Olhos: Âmbar ou dourados que parecem faiscar com luz própria, pupilas com brilho sobrenatural dourado.
Orelhas: Redondas ou cortadas/aparadas para parecerem redondas.
Vestimenta medieval nobre: Trajes aristocráticos medievais de alta qualidade — gibões de veludo bordados com fios de ouro, capas longas com forro de pele de arminho, golas altas estruturadas, mantos com brasões de linhagem, túnicas de seda com cintos de couro e fivela de prata, luvas de couro fino, botas altas polidas, coroas ou tiaras de metal forjado discretas. Armaduras cerimoniais de placas de aço polido com ornamentos gravados, capas heráldicas sobre a armadura. Armas refinadas — espadas longas de lâmina brilhante com guardas ornamentadas, adagas cerimoniais, cetros.
Expressão/Postura: Altivos, imponentes, aristocráticos — presença que domina o ambiente, olhar que inspira respeito ou temor reverencial. Jamais curvados ou desleixados.
ENQUADRAMENTO ESPECIAL: Mostrar do joelho para cima apenas, pois a geração de pernas completas pode sair inconsistente. Cortar a imagem na altura dos joelhos.

KARU-SELVAGEM — "Juba-Vermelha / Os Amaldiçoados / Pés-Contrário"
Altura: 1,60m a 1,90m (porte robusto e bestial).
Referência étnica: Traços de povos vikings/nórdicos guerreiros — estrutura facial brutal e quadrada, mandíbula larga e pesada, nariz largo que pode ter sido quebrado em combate, sobrancelhas grossas e projetadas sobre olhos intensos, testa larga com veias visíveis quando em fúria. Pescoço grosso e musculoso. Corpo de guerreiro nórdico — musculatura tonificada e definida, ombros largos e poderosos, braços grossos como troncos, peitorais marcados, abdômen rígido. Corpo coberto de cicatrizes tribais — marcas de batalha, rituais e provas de força. Mãos calosas e brutais.
Pele: Tons de cobre, bronze escuro, pardo ou mulato/moreno. Coberta de cicatrizes e tatuagens em Velikár (runas que parecem queimar com energia antiga, brilhando em laranja e vermelho).
Cabelos: Ruivos crespos e desgrenhados — tons de vermelho-fogo, cobre intenso ou carmesim. Cabelos rebeldes, volumosos, como uma juba vermelha selvagem. PODEM ESTAR EM CHAMAS — se os cabelos estiverem em chamas, a expressão do personagem DEVE ser de fúria absoluta, olhos arregalados com brasas, veias saltadas, dentes cerrados.
Olhos: Âmbar que faíscam como brasas vivas, com brilho alaranjado sobrenatural.
Orelhas: Pontudas.
Barba (homens): Quase sempre possuem barbas no estilo viking — longas, trançadas com contas de osso ou metal, desgrenhadas e ferozes. Barbas ruivas que combinam com os cabelos.
Vestimenta medieval bárbara/tribal: Armaduras improvisadas feitas de couro de feras, ossos de criaturas, peles cruas, dentes e garras de monstros como troféus. Ombreiras de crânios ou chifres de bestas. Braçadeiras de couro com rebites de osso. Cintos largos de couro com facas e ferramentas penduradas. Botas de pele amarradas com tiras de couro cru. Sem refinamento — tudo bruto, prático e feito à mão com restos de caça e inimigos derrotados. Armas rústicas: machados de guerra pesados com lâminas irregulares, clavas com espinhos de osso, espadas curtas e grossas de ferro bruto, arcos de madeira pesada.
Expressão/Postura: Impulsivos, agressivos, desafiadores — olhar que diz "eu sou o que os outros temem". Postura de combate, tensão muscular visível, prontos para o confronto.
ENQUADRAMENTO ESPECIAL: Mostrar do quadril para cima apenas, pois possuem pernas com joelhos invertidos e pés virados para trás (maldição ancestral) e a geração desses membros ficará distorcida. Cortar a imagem na altura do quadril.

PICXI — "Douradas / Fadas / Filhas da Rainha Luxis"
Altura: 1,00m a 1,20m (pequenas e delicadas).
Referência étnica: Traços de povos do oeste europeu — feições delicadas e proporcionais, rosto oval e simétrico, nariz pequeno e arrebitado, lábios finos e rosados, maçãs do rosto suavemente arredondadas, sobrancelhas finas e arqueadas, pele de textura sedosa. Estrutura corporal pequena e esguia, membros finos e proporcionais.
Pele: Branca ou parda com brilho sutil dourado, como partículas de ouro suspensas sob a pele. Luminescência etérea.
Cabelos: Loiro, loiro escuro ou castanho. Frequentemente curtos ou presos com adornos de metal fino ou flores secas. Reflexos dourados que captam a luz.
Olhos: Grandes e expressivos em tons de castanho ou mel, pupilas brilhantes que refletem a luz como joias. Proporcionalmente maiores para o rosto.
Asas: Asas translúcidas de libélula que irradiam luz dourada, com veios finos visíveis como vitrais orgânicos.
Aura: Partículas luminosas douradas que se dissolvem no ar — como poeira de estrelas ou pólen mágico.
Vestimenta medieval feérica: Roupas leves de linho fino e couro macio em tons dourados, verdes e terrosos — corseletes de couro ajustados ao corpo pequeno, túnicas curtas com cinto de couro e fivela de bronze, saias ou calças de tecido leve, botas minúsculas de couro macio até o joelho, capas curtas de tecido translúcido ou seda fina. Armaduras leves de couro trançado com detalhes de filigrana de bronze. Acessórios delicados — braceletes de metal fino com runas, tiaras de galhos dourados, bolsinhas de couro penduradas no cinto. Armas proporcionais ao tamanho: adagas pequenas, arcos em miniatura, estilingues, cajados finos.
Expressão/Postura: Determinadas, corajosas, intuitivas — postura leve, como se a gravidade fosse apenas uma sugestão. Podem estar flutuando a poucos centímetros do chão ou em voo.
Enquadramento: Corpo inteiro (incluindo asas).

POGO — "Carecas / Pequenos Arcanos / Fadas sem Asa"
Altura: Aproximadamente 1,20m (baixos e franzinos).
Referência étnica: Traços de povos do leste europeu e parte da Ásia, com traços leves orientais — rosto anguloso, olhos levemente puxados (epicanto sutil), nariz pequeno e reto, lábios finos, maxilar estreito. Feições que sugerem inteligência e astúcia.
Pele: Clara ou parda, completamente lisa, sem nenhum pelo. Frequentemente adornada com tatuagens arcanas — espirais, runas e símbolos místicos pelo rosto, crânio e corpo.
Cabelos: SEMPRE COMPLETAMENTE CARECAS — crânio liso e brilhante. EXCEÇÃO: Pogo feio/fora dos padrões → alguns fios ralos e esparsos inspirados no Gollum de O Senhor dos Anéis.
Olhos: Penetrantes, intensos, com brilho perturbador de sabedoria arcana.
Corpo: Pequeno e esguio, franzino e delgado, sem massa muscular. Sem brilho dourado e sem asas (diferente das Picxis).
Vestimenta medieval arcana: Mantos longos de tecido pesado em tons escuros (roxo profundo, azul-meia-noite, negro, vinho), túnicas com runas bordadas em fio de prata ou ouro, capuzes amplos, faixas de seda ao redor dos braços com inscrições arcanas. Acessórios de estudioso medieval: anéis de metal com pedras místicas, amuletos de osso e cristal pendurados em correntes, cintos com frascos de vidro contendo líquidos coloridos (sangue, poções), bolsas de couro com livros e pergaminhos. Cajados de madeira torcida com cristais incrustados na ponta, grimórios presos ao cinto com correntes.
Expressão/Postura: Inteligentes, astutos, obsessivos — nos olhos há sabedoria que custou sangue. Postura calculista, dedos entrelaçados, olhar analítico.
Enquadramento: Corpo inteiro.

TAMANO — "Língua-Longa / Os Pacientes / Devoradores de Pragas"
Altura: 1,60m a 1,90m (sem contar a cauda).
Aparência: Humanoide com características de tamanduá. Focinho alongado e cônico, sem dentes visíveis, língua extremamente longa. Pelagem densa em padrões de marrom, cinza e creme com faixa escura diagonal no torso. Garras curvas e robustas nas mãos. Cauda longa e peluda. Olhos pequenos e escuros.
Vestimenta medieval rústica: Roupas simples e funcionais de camponês/caçador medieval — túnicas de lã grossa com aberturas para a cauda, calças de couro resistente, cintos largos com ferramentas de escavação, botas reforçadas com sola grossa para terreno irregular, capas curtas de pele. Armaduras leves de couro endurecido adaptadas para não restringir as garras. Acessórios simples: bolsas de couro para coleta de insetos, cordas de cânhamo, canivetes de osso.
Expressão/Postura: Calmos, metódicos, observadores — paciência lendária, postura quieta e atenta.
Enquadramento: Corpo inteiro (incluindo cauda).

YOTUN — "Os Gigantes / Guardiões dos Caminhos"
Altura: 3,00m a 6,00m (colossal).
Aparência: Corpo colossal, mandíbula avantajada com presas inferiores proeminentes. Pele robusta em tons de cinza, marrom ou verde-musgo, coberta de cicatrizes de batalha. Pernas longas, tronco largo e extremamente musculoso. Placas ósseas visíveis que se confundem com armadura natural.
Vestimenta medieval colossal: Trajes rústicos feitos de couro grosso de criaturas enormes (pele de dragão, couro de besta titânica), placas de pedra esculpida presas com correntes de ferro grosso como armadura improvisada, faixas de corda de navio ao redor do torso, ombreiras de troncos de árvore ou pedregulhos amarrados. Cintos feitos de correntes de âncora com fivelas de ferro do tamanho de escudos. Armas colossais: martelos de guerra feitos de troncos com pedras amarradas, espadas do tamanho de um homem, escudos de pedra maciça, lanças de árvores inteiras com pontas de ferro.
Expressão/Postura: Protetores, honrados, vigilantes — presença que faz o chão tremer. Olhar de sentinela milenar.
Enquadramento: Corpo inteiro (com elementos de cenário que evidenciem a escala — árvores, rochas, construções que parecem pequenas ao lado dele).

[INSTRUÇÃO FINAL PARA USO]
Quando o usuário descrever um personagem, combine:
ESTILO ARTÍSTICO (sempre aplicado)
FORMATO RETRATO (sempre aplicado)
AMBIENTAÇÃO MEDIEVAL (sempre aplicada — todos os materiais, roupas, armas e cenários devem ser de fantasia medieval)
GUIA RACIAL correspondente à raça informada
DESCRIÇÃO INDIVIDUAL do usuário (classe, roupas, armas, expressão, contexto narrativo, etc.)
O personagem deve parecer vivo — com expressão, gesto, postura ou ação coerente com quem ele é. Gere uma cena de retrato com vida em um mundo medieval fantástico, como se o personagem estivesse vivendo aquele momento em Vasteluna.

## Passo 2: Salvamento / Integração com Firebase
1. Após gerar a imagem, verifique o destino solicitado.
2. Se o pedido envolver **"banco de dados"** ou **"site"**, você não precisa pedir instruções de como fazer!
   - Execute o script de automação via terminal (`run_command`) que está no projeto.
   - Script: `functions/upload-and-update.mjs`
   - Comando: `node upload-and-update.mjs "<caminho_local_da_imagem_gerada>" "<colecao_do_firestore>" "<Nome do Documento>"`
   - Exemplo para tribos: `node upload-and-update.mjs "C:\...\artefato.png" "system/data/tribes" "Forasteiro"`
   - *Dica:* Caso precise confirmar onde um documento está, o script `functions/query-db.js` pode te ajudar a explorar o Firestore.
3. Se o pedido for para salvar em um diretório local do projeto, use os comandos padrão do terminal (ex: Move-Item ou cp) para colocar no local certo.
4. Por fim, informe ao usuário que a integração ocorreu com sucesso e a imagem já está no ar (ou no diretório correto)!
