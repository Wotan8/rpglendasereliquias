---
name: reliera-voz
description: "Escrever prosa de Reliera na voz do autor Igor Estevam — linguagem simples, sem prosa roxa, sem rebuscamento e sem nada genérico. Carregue esta skill SEMPRE que for escrever, reescrever ou revisar qualquer texto ficcional do cenário, junto com reliera-cena, reliera-revisao ou reliera-edicao. Contém o catálogo de tiques de IA proibidos, as taxas medidas na prosa real do autor, e a regra de que prosa se escreve em uma voz só, nunca fundindo rascunhos de vários agentes."
---

# A voz do autor — regra de ferro

Esta skill existe porque prosa gerada com boas intenções sai **genérica, rebuscada e com
cara de IA**, mesmo quando obedece a todas as outras instruções. Ela é a última checagem
antes de entregar qualquer linha de ficção de Reliera.

Leia junto: `~/.claude/skills/reliera-canone/references/perfil-autoral.md` e
`tom-e-genero.md`.

## Regra zero: uma voz, uma mão

**Nunca escreva prosa fundindo rascunhos de vários agentes.**

Isto foi testado neste projeto e falhou de forma mensurável. Três agentes escreveram o
mesmo capítulo e um quarto fundiu as versões. O resultado tinha:

- cinco `como quem` num capítulo, contra **um** no capítulo escrito pelo autor
- cinco ocorrências de `vênia` / `mesura` / `lavor` / `floreio` — palavras que **não
  existem** em nenhum capítulo do autor
- `Calinor sentiu os poros abrirem-se sob a túnica` — detalhe fisiológico que ninguém
  registra na vida real
- uma frase que não significava nada: `O nome viera antes do homem`
- inchaço de 370 palavras acima do teto, porque a fusão enxerta e não corta

Cada agente sozinho escreve razoável. **A fusão empilha os tiques de todos.** Se houver
mais de um rascunho, escolha UM e edite; nunca costure trechos de vários.

Paralelismo serve para **ler, medir e criticar**. Escrever é sempre uma mão só.

## Regra um: nunca contar, sempre mostrar

**Não escreva o que o personagem sente. Escreva o que ele faz, o que o corpo faz sem
licença, e o que o mundo em volta faz — e deixe o leitor concluir.**

Emoção nomeada é uma conclusão entregue pronta. O leitor que recebe a conclusão pronta não
sente nada, porque não teve trabalho nenhum. Todo o efeito de Reliera depende disso: gore
e horror cósmico só funcionam se o leitor **chegar lá sozinho**.

### Como o autor já faz (copie estes padrões)

| Sentimento | Ele NÃO escreve | Ele escreve |
|---|---|---|
| Luto engolido | ficou triste | `Engoliu o nó que lhe subiu à garganta.` |
| Vergonha | sentiu-se humilhado | `O rosto de Calinor esquentou até a raiz das orelhas.` |
| Perda de si | as mãos tremiam de nervoso | `As mãos, antes tão firmes, tremiam.` |
| Mentira | mentiu para ela | `— Prometo.` / `Mentira, e os dois sabiam.` |
| Humilhação | sentiu-se rejeitado pelo tio | `Contou. Perdeu a conta. Endireitou-se sozinho.` / `O tio não tocou sua mão.` |
| Não ter resposta | não soube o que dizer | `Calinor abriu a boca e não achou nada para pôr dentro dela.` |
| Autoengano | ele não acreditava no que dizia | `A frase saiu-lhe firme e não sustentou o próprio peso até o fim.` |
| Medo de encarar | evitou pensar no assunto | `Não releu.` |

Repare no padrão: **mão, garganta, rosto, respiração, temperatura, contagem, ausência de
gesto.** Nunca o nome do sentimento.

### As seis formas de contar — todas proibidas

1. **Nomear a emoção.** `sentiu raiva`, `estava com medo`, `ficou aliviado`, `uma tristeza
   profunda o invadiu`. Troque pelo gesto.
2. **Explicar o que a cena acabou de mostrar.** É o pior, porque some na revisão.
   - ❌ `Calinor abriu a boca e não achou nada para pôr dentro dela. Não porque lhe
     faltasse resposta: porque a única honesta era um silêncio.`
   - ✅ só a primeira frase. Depois de um parágrafo-soco, **nada**.
3. **Resumir uma cena em vez de jogá-la.** Se tem conflito, é cena. Se virou parágrafo de
   resumo, você contou.
   - ❌ `Foi buscar o baú e Rosaro riu das antiquas antes mesmo de vê-las.`
   - ✅ o baú abrindo, o riso às costas, a semente contada na palma, a fala do mercador.
4. **Explicar o mundo pela boca de alguém.** Worldbuilding entra por atrito.
   - ❌ `— É um local mercantil dos Grévoras, nas montanhas ao oeste.` (verbete dito a um
     homem do mesmo continente)
   - ✅ a dosagem errada, a moeda recusada, a distância que custa dias.
5. **Resumir o que uma fala diz em vez de pôr a fala.**
   - ❌ `A prece falava de arrependimento e do peso deixado para trás.`
   - ✅ ponha a prece, ou ponha o corpo de quem a ouve: `Ele esperou o arrepio que aquela
     prece sempre lhe dera desde menino.` / `Não veio.`
6. **Comentar a ambiguidade de um personagem.** Com Sylmari isto é fatal: plante o gesto
   de leitura dupla e ofereça, na mesma respiração, a explicação inocente que ela mesma
   aceita. **O narrador nunca sugere que há outra leitura.**
   - ✅ `Ela não levantou a cabeça.` seguido do que Calinor conclui, e ponto.

### A exceção — e ela é estreita

O autor **às vezes** nomeia, num parágrafo-soco de até quatro palavras, e sempre **depois**
de um bloco longo que já mostrou tudo: `Isso também doeu.`

Isso não é contar: é o narrador confirmando um golpe que o leitor já levou. Vale uma vez
por capítulo, no máximo. Se o parágrafo que vem antes não mostrou nada, a frase curta vira
preguiça.

### O teste da câmera

Antes de aprovar qualquer frase sobre estado interno, pergunte:

> **Uma câmera e um microfone captariam isso?**

Se não captariam, ou vira gesto, ou sai. `Estava furioso` não filma. `Fechou a mão até a
unha achar a palma` filma.

Segundo teste, para o parágrafo inteiro: **corte a última frase.** Se o parágrafo continua
funcionando, a última frase era explicação. Isso acerta quatro em cada cinco vezes.

## Regra dois: todo capítulo termina em gancho — e o seguinte pega o gancho

Duas metades da mesma regra. A primeira quase todo mundo cumpre. A segunda é a que
estraga o livro quando falha.

### O gancho (fim do capítulo)

Nenhum capítulo termina resolvido. A última linha tem entre 6 e 16 palavras, é **imagem
concreta ou fala**, e **não explica nada**. O personagem termina sabendo menos, ou devendo
mais, do que quando o capítulo começou.

Dois modos, os dois usados pelo autor:

- **Gancho de fala** — o capítulo acaba na boca do intruso, sem nenhuma narração depois.
  `— Vim de muito longe para lhe fazer uma proposta. Uma que nenhum de nós, creio, poderia
  realizar sozinho.` (fim do Cap. 2)
- **Gancho de imagem** — uma última coisa física que fica pendurada.
  `O cheiro doce e errado ainda lhe subia da própria manga.` (fim do Cap. 3)

Proibido no fecho: anunciar o que vem, confirmar uma profecia que acabou de ser dita,
resumir o capítulo, ou pôr o narrador de lenda (ele entra no **miolo**, nunca no fim).

### O passe (começo do capítulo seguinte)

**Gancho é um passe. Alguém tem que pegar.**

O capítulo seguinte abre **no mesmo lugar, no mesmo instante, com a mesma pergunta
aberta** — e responde ao gesto que ficou pendurado. Não depois. Não em outro cômodo. Não
com o assunto já resolvido nos bastidores.

**Erro cometido neste projeto:** o Cap. 2 termina com o mercador **do lado de fora**, à
porta, oferecendo uma proposta. O Cap. 3 abria com ele **já dentro da cabana**. O leitor
sentiu o pulo, e a correção improvisada foi um remendo retroativo — `A porta ficara aberta
atrás dele` — que explica o que devia ter sido mostrado.

**A correção certa foi cruzar a soleira na página:**

```
— Entre.

Calinor saiu da frente, e o homem passou. Semanas antes fizera o contrário: o enoriano
ficara do lado de fora com o braço estendido, e o pergaminho lacrado ainda dormia no
caixote de descarte.
```

Repare no que isso ganhou de graça: a passagem que só existia para tapar um buraco virou
**caracterização** — no Cap. 1 ele fechou a porta para um estranho; agora abre. O luto
mudou o que ele deixa entrar. E ainda replantou o objeto do fio do envenenamento.

**Lição geral:** quando a costura entre dois capítulos exigir um remendo explicativo, o
remendo está errado. Ache o gesto que faltou e **escreva o gesto**. Costura que precisa de
explicação vira cena que faltava.

### Checagem de costura — rode sempre antes de escrever um capítulo novo

1. **Releia a última página do capítulo anterior**, inteira. Não o resumo: o texto.
2. Onde estão os corpos? Dentro, fora, sentados, de pé? O novo capítulo começa **ali**.
3. Que hora é? Quanto tempo passou? Se passou tempo, o salto se faz com **advérbio abrindo
   parágrafo** (`Horas depois,`), nunca com `***`, e o tempo tem de custar alguma coisa.
4. Que pergunta ficou aberta? Ela é respondida, ou pelo menos tocada, na **primeira
   página** do novo capítulo.
5. Alguma promessa foi feita? (`Volto em três dias.`) Anote e pague.
6. Alguém falou por último? Se o capítulo anterior terminou numa fala, o novo abre com a
   **resposta** — é a emenda mais limpa que existe.
7. Você precisou de uma frase para explicar como chegamos aqui? Apague a frase e escreva a
   cena que ela estava resumindo.

## Como se calibra: meça o autor, não o gosto

Antes de julgar se uma construção é excessiva, **conte quantas vezes o autor a usa**.

```bash
# taxa por mil palavras de um padrão nos capítulos prontos
grep -o "como quem" "01 - Saberes Estéreis.md" | wc -l
```

Taxas medidas nos capítulos 1 e 2 (a régua):

| Construção | Cap. 1 | Cap. 2 | Teto por capítulo |
|---|---|---|---|
| `como quem …` | 1 | 0 | **2** |
| `como se …` | 2 | 3 | 3 |
| `pareceu …` | 3 | 1 | 3 |
| `sentiu …` | 0 | 2 | 2 |
| advérbio em `-mente` | 7 | 1 | **1 a cada 400 palavras** |
| itálico e asterisco | 0 | 0 | **0** |
| aspas | 2 | 0 | só para cercar a letra de um brasão: `um "B" estilizado` |
| palavras faladas / total | 19% | 22% | **25%** |

Se o texto novo estourar qualquer uma dessas, corte até caber. Não discuta com o número.

## Catálogo de tiques de IA — proibidos

### 1. Micro-fisiologia que ninguém percebe
Corpo entra pela ação, não pela biologia.

- ❌ `sentiu os poros abrirem-se sob a túnica`
- ❌ `o estômago se contraiu`, `algo se remexeu em seu peito`, `o coração falhou uma batida`
- ❌ `um arrepio percorreu-lhe a espinha` (a não ser que seja **a** espinha da cena, uma vez)
- ✅ `a túnica começou a grudar nas costas`
- ✅ `Engoliu o nó que lhe subiu à garganta.` (do próprio autor)

Teste: uma pessoa contando o dia dela diria isso? Se não, corte.

### 2. Símile formulaico
`como quem …` é uma fôrma. Uma por capítulo, duas no máximo, e só quando a comparação é
específica do mundo.

- ❌ `escolheu as palavras como quem escolhe peso de balança` (genérico, decorativo)
- ✅ `com a mão em concha ao lado da boca, como quem passa mercadoria proibida de um bolso
  para o outro` (específico, revela caráter)

O mesmo vale para `dessas que …`, `desses que …`, `do tipo que …`. Zero ocorrências nos
capítulos do autor.

### 3. Rebuscamento
O autor escreve **português literário simples**. Não escreve português de cartório antigo.

Proibidas, salvo ordem expressa: `vênia`, `mesura`, `lavor`, `floreio`, `alvitre`,
`outrossim`, `posto que`, `conquanto`, `amiúde`, `desiderato`, `nefando`, `insofismável`.

Reverência se escreve assim, e está no Cap. 2 do autor:
> O homem inclinou a cabeça, quase uma reverência.

Se uma palavra parece que foi buscada no dicionário, foi. Troque pela que você usaria
falando.

### 4. Prosa roxa
Imagem existe para carregar informação, não para enfeitar.

- ❌ adjetivo empilhado: `a luz dourada, quente e trêmula, banhava suavemente`
- ❌ abstração poética: `um silêncio pesado como a própria história`
- ❌ o mundo sentindo a emoção do personagem sem motivo mecânico
- ❌ metáfora que não sai do mundo do livro (nada de ralo, engrenagem, relógio, moldura)
- ✅ `como a água que não sabe que tem uma pedra dentro`

**Uma imagem por parágrafo, no máximo.** Duas imagens coladas anulam-se.

### 5. Frases que soam bem e não dizem nada
O pior defeito, porque passa despercebido na revisão.

- ❌ `O nome viera antes do homem` — o quê veio antes de quê?
- ❌ `algo mudou nele`, `alguma coisa se quebrou`, `uma emoção que não sabia nomear`
- ❌ `sem saber o que fazer com aquilo`, `sem saber em que prateleira pôr`
- ❌ `e, no entanto,` como pivô automático

Teste: leia a frase em voz alta e pergunte **o que aconteceu**. Se não der para responder
com um fato, apague.

### 6. Contar em vez de mostrar
É a forma número dois da **Regra um** — ver a seção acima, que tem as seis formas e os
dois testes. Resumo: depois de um parágrafo-soco, **nada**. O soco é o fim.

- ❌ `Calinor abriu a boca e não achou nada para pôr dentro dela. Não porque lhe faltasse
  resposta: porque a única honesta era um silêncio.`
- ✅ `Calinor abriu a boca e não achou nada para pôr dentro dela.`

### 7. Genérico
Cada cena precisa de **três detalhes concretos**, e ao menos um não-visual.

- ❌ `a mescla de sempre: três raspas de raiz, o pó de folha seca`
- ✅ `Flor-da-Noite, colhida à meia-noite; trevo de cinco folhas; beladona em pó fino`

Nomeie a planta, o ofício, a moeda, a distância em dias, a hora pela luz. Floresta sem
nome de planta é papel de parede. O cofre tem bestiário, raças, tribos e compêndios: use.

### 8. Palavra que o autor não usa
Antes de introduzir um termo incomum, **procure no cofre**. Se não aparece em lugar
nenhum, provavelmente não é dele.

```bash
grep -ril "palavra" "G:\Meu Drive\Reliera"
```

## O que a voz É (não só o que não é)

- Terceira pessoa colada num personagem por vez. O narrador sabe um pouco mais e deixa
  escapar **uma vez por capítulo**, numa frase curta, sempre no miolo — nunca no fecho.
- Narração com ênclise culta (`percorreu-lhe`, `ergueu-se`, `deixou-a`); diálogo coloquial
  com `você`. Os dois registros não se misturam.
- Frase curta por padrão: mediana de 10 palavras. Alonga em três lugares só — inventário
  de decadência, raciocínio em indireto livre, e o instante em que a compreensão cede
  (cadeia de gerúndios separados por vírgula). Depois de qualquer um dos três, um
  parágrafo curtíssimo corta o fôlego.
- Parágrafo-soco de até 6 palavras a cada cinco parágrafos, **sempre depois de bloco
  longo**, nunca dois seguidos: `Bateram à porta.` `Nada.` `Não releu.`
- Dois-pontos como instrumento de revelação: afirma e depois especifica.
- Emoção por mão, garganta, respiração, temperatura e cheiro. Quase nunca nomeada.
- Verbos de fala: só `disse, murmurou, sussurrou, chamou, pediu, soprou, saudou,
  perguntou` — ou nenhum.
- Pensamento sem itálico, sem aspas. `Um enoriano?, perguntou-se.` é a construção da casa.
- Salto de tempo por advérbio abrindo parágrafo. Nunca `***` nem `---`.
- Todo capítulo termina com o personagem sabendo **menos**, ou devendo mais.

## Checagem obrigatória antes de entregar

```bash
# rode no arquivo novo, compare com os capítulos prontos
grep -c "como quem\|dessas que\|vênia\|mesura\|floreio\|lavor" arquivo.md
grep -oE "\w+mente\b" arquivo.md | wc -l
grep -c "[*_\"]" arquivo.md
```

```bash
# emoção nomeada — cada acerto é um candidato a virar gesto
grep -noE "(sentiu|sentia) (raiva|medo|tristeza|alívio|vergonha|culpa|ódio|angústia)|estava (com raiva|triste|assustado|nervoso|ansioso)|(uma|um) (tristeza|raiva|medo|alegria|angústia) [a-zà-ÿ]+ o (invadiu|tomou|dominou)" arquivo.md
```

Depois, a passada humana, nesta ordem:

1. **Teste da câmera:** cada frase sobre estado interno seria captada por uma câmera e um
   microfone? Se não, vira gesto ou sai.
2. **Corte a última frase** de cada parágrafo. Se o parágrafo continua de pé, ela era
   explicação — deixe cortada.
3. Alguma cena virou parágrafo de resumo? Se tem conflito, joga-se como cena.
4. Alguém explica o mundo, ou o que uma fala disse? Troque por atrito, ou ponha a fala.
5. Alguma frase soa bem e não diz nada? Apague.
6. Algum detalhe do corpo é biologia em vez de experiência? Troque.
7. Algum `como quem` além do segundo? Corte.
8. Alguma palavra que você não usaria falando? Troque.
9. Alguma cena tem menos de três detalhes concretos? Preencha com cânone, não com invenção.
10. O texto está acima do alvo de palavras? O excesso mora nas frases decorativas — não nas
    cenas.

## Quando o autor apontar um problema

Ele acerta. Não defenda o texto: **meça**. Conte a ocorrência nos capítulos prontos dele,
conte no texto novo, mostre a diferença e corrija. O defeito que ele viu quase nunca é
único — procure os irmãos dele no arquivo inteiro antes de responder.
