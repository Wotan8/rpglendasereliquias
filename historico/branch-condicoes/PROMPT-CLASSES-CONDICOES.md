# Recado da frente de condições → frente de classes e rituais

As condições estão fechadas e valem agora. **32 cadastradas em
`system/data/conditions`, e o banco é compartilhado — não precisa de merge
nenhum.** Só o `.md` de repasse e os scripts moram na branch `condicoes`.

Este recado tem três partes: **o que mudou desde a última vez** (e invalida
medição antiga), **as regras que valem** para escrever habilidade nova, e
**o que a leitura de hoje encontrou** no que vocês já entregaram.

Tudo aqui foi conferido contra o banco na hora de escrever, não contra
histórico de conversa — com várias frentes mexendo no mesmo Firestore, o que
eu "lembro" de ter visto vale menos que uma leitura nova.

---

## 1. O que mudou, e o que isso invalida

Se vocês já mediram alguma habilidade contra a régua, estas quatro mudanças
podem ter mudado o resultado.

### Congelamento e Acelerado estavam subcontados 13× e 14×

A régua extrai o valor da condição pela prosa da descrição, e usa o **primeiro
número** que encontra. As duas abriam pelo nível 1:

| Condição | a régua lia | passou a ler |
|---|---|---|
| Congelamento | 0,10 (Nv 1) | **1,32** (Nv 3) |
| Acelerado | 0,10 (Nv 1) | **1,43** (Nv 3) |

Era subcontagem silenciosa — passava com número plausível e errado, sem aviso.
**Trilha agora declara o nível mais alto**, de propósito: errar para cima faz a
régua reclamar e um humano conferir; errar para baixo passa calado.

**Consequência para vocês:** habilidade que conceda *Acelerado 1* vai medir
como se desse *Acelerado 3*. Enquanto o campo `condicoesAplicadas` não carregar
um `nivel`, desconte à mão — a tabela de cada nível está na descrição da
condição.

### Agarrado deixou de ser zero

Estava escrito como "troca 1:1, líquido zero". Errado: o alvo perde o **turno
inteiro** (1,000) porque o Deslocamento vai a zero e a única ação que lhe resta
é tentar escapar, enquanto o agarrador paga só a **Ação Padrão** (0,667 — a de
Movimento é 1/3 do turno) e mantém a própria de Movimento.

```
roubado 1,000 − pago 0,667 = +0,333 por rodada
```

Qualquer manobra ou magia que aplique Agarrado media 0,00 e agora mede 0,33 por
rodada.

### Eletrocutado é condição nova (confluência Raio)

Não existia quando falamos com vocês. Some **metade da Blindagem do alvo ao
dano** (teto de +4), e **a Blindagem não reduz esse dano** — o metal dela é o
que conduz. O alvo não usa Reação, e ao acabar a condição **descarrega** no
aliado adjacente com N−1. Vale **1,77** com N=2 no Q0.

### Repetir condição que rouba turno agora decai

O `[A DEFINIR]` do §6.12 foi fechado. **Atordoado e Congelamento são
repetíveis**, mas cada aplicação anterior no mesmo alvo, na mesma cena, cobra do
**portão da própria habilidade**:

| Portão | Decaimento por aplicação anterior |
|---|---|
| Chance | −1 na Chance |
| Teste de resistência | o alvo ganha **Vantagem**, cumulativa |

Partindo de Chance 8, 5 Energia compram **3,00** turnos em vez de 4,00.

---

## 2. As regras que valem para escrever habilidade

### Chance de Condição — e é desconto, não requisito

Cada habilidade declara, **por condição**, uma **Chance de 1 a 10**. Se o golpe
acertar, rola 1d10: **≤ Chance, a condição pega**. Roll under, como o resto do
sistema.

```
valor da condição = (Chance ÷ 10) × valor cheio
```

É o botão para caber uma condição cara numa habilidade barata. Quer Cego numa
magia de custo 2? Chance 5.

### Um portão só

**Chance OU teste de resistência. Nunca os dois** — eles se multiplicam e
esvaziam a condição. Atordoado (1,32) em custo 1, com Chance 10 *e* um teste
que o alvo passa metade das vezes, entrega 0,66: reprovado **pegando sempre**.

### O teste de resistência quase não desconta

Os Graus do conjurador comem o Alvo do defensor **antes** da rolagem. Contra um
conjurador com 2 Graus:

| Alvo resiste com | P(resistir) | equivale a |
|---|---|---|
| AUT 3, sem perícia | 0,10 | **Chance 9** |
| AUT 3 + perícia 2 | 0,30 | **Chance 7** |
| AUT 5 + perícia 3 | 0,60 | **Chance 4** |

"Testa AUT vs GS" é uma **Chance 9 disfarçada** contra alvo comum. Foi assim que
as canções do Bardo estouraram o orçamento sem ninguém ver. Quem quer desconto
previsível usa Chance; o teste serve para premiar quem investiu no atributo
defensivo.

### Piso de Chance 5 (§6.10)

Nenhuma habilidade **declara** Chance abaixo de 5. É regra de projeto, não de
mesa — o decaimento da repetição pode levar abaixo de 5 rolando.

### Somar condição no mesmo eixo é subaditivo (§6.11)

Cego (−4 no Alvo) mais Amedrontado (−1) num defensor de Alvo ~5 não dá −5 de
efeito: a chance de o golpe entrar trava em 0,90, porque o crítico natural na
defesa sempre salva. **A soma linear é teto, não estimativa.**

### Imposto sobre ação tem teto em 1,000 (§6.13)

Condição que cobra por ação gasta nunca vale mais que roubar o turno — o alvo
sempre pode parar. Acima de 1 ponto de dano por ação, o excedente é desperdício.

### Condição que rouba turno não escala com Graus (§6.12)

Os Graus já derrubam o Alvo de defesa. Deixá-los escalar a duração paga duas
vezes pelo mesmo acerto.

---

## 3. O que a leitura de hoje encontrou

As seis habilidades que a frente de condições tinha reprovado **já estão
consertadas** — `condicoesAplicadas` estruturado, portão declarado, e os textos
alinhados com a definição das condições. Isto aqui é o que sobrou, conferido no
banco agora:

### Cegueira da Fé I — o texto e a condição não dizem a mesma coisa

```
texto:     "-2 no Alvo em testes de Percepção e Ataque por 1 cena"
declarado: Ofuscado (portao chance, chance 10, 1 alvo, 5 rodadas)
```

**Ofuscado é Desvantagem em ataques e defesas**, não −2 no Alvo em Percepção e
Ataque. Os dois ficam perto em valor (Desvantagem ≈ −2,15 pontos de Alvo), mas
são mecânicas diferentes na mesa: uma manda rolar 2d10 e pegar o pior, a outra
manda subtrair. Escolham uma — se for a condição, o texto vira "fica Ofuscado
por 1 cena".

### GRITO DISSONANTE — ainda estoura, agora por pouco

Custo 1, Atordoado com Chance 10 e 1 alvo. Atordoado vale **1,32** e o
orçamento de custo 1 é **1,00**. Está 32% acima.

Conserto mais barato: **Chance 7** (0,92) ou **Chance 8** (1,06). Com o piso de
5 do §6.10, qualquer valor de 5 a 8 é legal — 8 encosta no orçamento sem passar.

### TROMBETA DO JULGAMENTO — as duas condições brigam pelo mesmo eixo

Declara `Desorientado` **e** `Atordoado`, ambos portão resistência, 3 alvos,
1 rodada. **Atordoado já tira o turno inteiro** — Desorientado por cima, na
mesma rodada, não compra nada: não há ataque nem defesa para receber a
Desvantagem.

É o §6.11 (soma subaditiva) na forma mais forte, e caiu na mesma armadilha em
que eu caí com o Cronogelo. Duas saídas:

- **Desorientado dura mais que o Atordoado** (ex.: Atordoado 1 turno,
  Desorientado 1 cena) — aí ele rende nas rodadas em que o alvo volta a agir;
- ou **fica só o Atordoado**, e o valor sobe pelos outros eixos (§1.3).

### Luz da Vontade I — nomeia condição por apelido

O texto diz *"remove 1 condição mental (ex.: medo, ofuscamento/cegueira leve)"*.
Os nomes exatos existem agora: **Amedrontado**, **Ofuscado**, **Cego**. Trocar
os apelidos pelos nomes deixa a régua e o mestre lerem a mesma coisa.
`condicoesAplicadas` está `[]`, o que é certo — ela remove, não aplica.

### Um pedido de estrutura

`condicoesAplicadas` já carrega `alvos`, `rodadas`, `portao` e `chance`. Falta
**`nivel`**, para as trilhas (Congelamento, Acelerado, Exaustão). Sem ele toda
trilha mede pelo topo — ver a seção 1.

---

## 4. Limitação que muda como vocês escrevem efeito

**Não existe Valor Derivado chamado "Alvo".** Ele é `Atributo + Perícia`,
montado na hora da rolagem. Logo `−2 no Alvo de todos os testes` e
`perde a ação` **não têm onde morar na ficha** — são texto do card, aplicado
pelo mestre.

Das 32 condições, só cinco engatam no motor: Lento, Agarrado, Imobilizado,
Acelerado (Nv 1), Inabalável e Consagrado. Se vocês precisarem que a ficha
aplique algo automaticamente, tem que ser num VD que exista.

---

## 5. Onde ler

| Onde | O quê |
|---|---|
| `CONDICOES.md` (branch `condicoes`) | as 32, a paleta por Essência, o que o motor aplica |
| `CONFLUENCIAS-CONDICOES.md` | as 21 confluências da Runomancia → condição |
| `book-regua-balanceamento` **cap. 6** | Condições e a Chance — tabela de desconto, piso, subaditividade, repetição, imposto sobre ação |
| **cap. 7** | A paleta por Essência — as 14 duplas, as travas, Congelamento e Eletrocutado |
| `functions/audit-condicoes.mjs` | mede qualquer condição contra a Régua. Matemática pura, não toca no banco |
| `functions/audit-valor-legivel.mjs` | confere que toda condição declara valor que a régua consegue ler |

**O valor de cada condição está na própria `descricao`**, e é de lá que a régua
de magias lê. Se vocês criarem condição nova, ela precisa de uma frase no
formato `Vale X,XX un/rodada` — e no **topo** da descrição, porque o parser usa
o primeiro número que encontra.

---

## Regras de trabalho do repo

- Todo script que grava no Firestore tem **`--dry-run` primeiro**, conta
  ocorrências e aborta se não bater o esperado. Scripts em `functions/`.
- Toda lógica não trivial deixa um **assert rodável**.
- Prefixo **`"Perícia: X"`** é obrigatório em ref de perícia — oito nomes são
  perícia *e* valor derivado ao mesmo tempo, e sem o prefixo o motor casa com o
  errado **em silêncio**.
- A equação do motor é **fold sequencial**, esquerda para direita, sem
  parênteses: `[A, ÷2, +B]` é `(A÷2)+B`.
- **Nunca inventar lore.** Nome, instituição, relação entre Essências: nada sem
  o dono do mundo fornecer ou o cânone dizer.
- **Commite só os arquivos da sua frente**, nunca `git add -A` — há outras
  sessões no mesmo repo.
- **Bumpe o `?v=N`** dos assets ao mexer em JS/CSS.
- Livro técnico (`book-regua-balanceamento`) é sempre **não público**. O
  compêndio de Fluxomancia e o Livro de Regras são **públicos** — mexer neles é
  mudar o que o jogador lê.

Qualquer condição nova que vocês precisarem, mandem para a frente de condições
em vez de criar: a regra da casa é **não criar condição de mesmo sentido**, e
mapear para existente vem antes de criar. Das 21 confluências da Runomancia, 19
mapearam para o que já havia.
