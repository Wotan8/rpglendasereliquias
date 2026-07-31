# Capítulo 5 — o que mudou na proteção

Gerado do Firestore em 30/07/2026. Fonte da verdade: coleção
`system/data/equipment`. O capítulo publicado é `worldbuilding-articles/art-regras-jogador-05` (campo `contentHTML`).

⭑ = peça nova, criada nesta revisão.

---

## 1. A mudança de regra

**A taxa da classe Leve subiu de 0,15 para 0,20 de Blindagem por slot coberto.**
Média (0,22) e Pesada (0,30) não mudaram.

| Classe do material | Blindagem por slot coberto |
|---|---|
| Leve | **0,20** (era 0,15) |
| Média | 0,22 |
| Pesada | 0,30 |

Motivo: a 0,15, a maior cobertura Leve possível dava 0,75, e como a Blindagem só
arredonda para baixo no total, a faixa inteira valia 0 na mesa. Pagar por armadura
leve não mudava uma única rolagem.

## 2. O conceito novo: a linha à la carte

Antes, o catálogo só tinha armaduras de tronco — para proteger a cabeça era
preciso comprar uma Armadura de Torneio de 20.000. Agora existem **18 peças
avulsas**, uma por slot do corpo, que permitem montar proteção peça por peça.

Três coisas que o texto precisa deixar claras para o jogador:

1. **Peça avulsa pequena vale 0 sozinha.** Um Elmo de Placas dá 0,30, que
   arredonda para zero. Ela existe para ser somada, não para ser usada só. O
   primeiro elmo que o personagem compra não muda nada na mesa — e isso é
   esperado, não um defeito.
2. **Comprar peça por peça é mais caro que comprar a armadura inteira.** O
   conjunto Pesado completo custa 24.000 contra os 20.000 da Armadura de Torneio,
   pela mesma Blindagem. Você paga pela conveniência de comprar aos poucos.
3. **Par é uma peça só.** Ombreiras, braçadeiras, grevas e escarpes cobrem os dois
   lados de uma vez. Não existe "uma grevа".

## 3. Cada classe tem um teto na mesa

Este é o ponto de design mais importante do capítulo, e hoje ele não está escrito
em lugar nenhum:

| Classe | Maior cobertura alcançável | Blindagem | A mesa usa |
|---|---|---|---|
| Leve (Armadura Leve + as 4 avulsas) | 9 slots | 1,80 | **1** |
| Média (conjunto completo) | 13 slots | 2,86 | **2** |
| Pesada (conjunto completo) | 13 slots | 3,90 | **3** |

**Não existe peça Leve para Pernas e Pé, e isso é deliberado.** É o que segura o
teto da faixa Leve em 1,80. Com grevas e botas leves ela chegaria a 2,60, que
arredonda para o mesmo 2 do conjunto Médio — e como Leve custa menos e pesa menos,
a classe Média deixaria de ter razão de existir.

## 4. Conjuntos completos, lado a lado

| Conjunto | Slots | Blindagem | Na mesa | Peso | Preço |
|---|---|---|---|---|---|
| Pesado avulso (8 peças) | 13 | 3,90 | **3** | 9 | 24.000 |
| Armadura de Torneio (1 peça) | 13 | 3,90 | **3** | 6 | 20.000 |
| Médio avulso (Couro Reforçado + 6) | 13 | 2,86 | **2** | 8 | 8.500 |
| Leve máximo (Armadura Leve + 4) | 9 | 1,80 | **1** | 5 | 3.700 |
| Cota de Malha (1 peça) | 7 | 1,54 | **1** | 1 | 3.000 |

## 5. Catálogo completo de proteção (36 peças)

| Peça | Classe | Slots | Blindagem | Cobertura | Peso | Preço | Penalidade |
|---|---|---|---|---|---|---|---|
| Armadura de Torneio | Pesada | 13 | **3,90** | Torso, Cabeça, Pescoço, Costas, Ombro×2, Braço×2, Cintura, Pernas×2, Pé×2 | 6 | 20.000 | DES -3 · Furt -5 · Desloc -2 |
| Armadura Completa | Pesada | 11 | **3,30** | Torso, Costas, Ombro×2, Braço×2, Cintura, Pernas×2, Pé×2 | 5 | 12.000 | DES -2 · Furt -4 |
| Cota de Placas | Pesada | 8 | **2,40** | Torso, Pescoço, Costas, Ombro×2, Braço×2, Cintura | 4 | 5.500 | DES -1 · Furt -3 |
| Meia-Armadura | Pesada | 8 | **2,40** | Torso, Cabeça, Pescoço, Costas, Ombro×2, Braço×2 | 4 | 9.000 | DES -1 · Furt -3 |
| Cota de Malha | Média | 7 | **1,54** | Torso, Costas, Ombro×2, Braço×2, Cintura | 1 | 3.000 | DES -1 · Furt -2 |
| Peitoral de Aço | Média | 6 | **1,32** | Torso, Pescoço, Costas, Ombro×2, Cintura | 1 | 2.800 | DES -1 · Furt -2 |
| Escudo de Torre | Escudo | 1 | **1,20** | Mão | 4 | 1.800 | Desloc -1 |
| Brigandina | Média | 5 | **1,10** | Torso, Costas, Ombro×2, Cintura | 3 | 3.500 | DES -1 · Furt -1 |
| Escudo Grande | Escudo | 1 | **0,90** | Mão | 3 | 1.000 | — |
| Couro Cravejado | Média | 4 | **0,88** | Torso, Costas, Ombro×2 | 2 | 1.800 | Furt -1 |
| Couro Reforçado | Média | 4 | **0,88** | Torso, Costas, Ombro×2 | 2 | 1.500 | Furt -1 |
| Armadura Leve | Leve | 4 | **0,80** | Torso, Costas, Ombro×2 | 1 | 1.200 | — |
| Braçadeiras de Placas ⭑ | Pesada | 2 | **0,60** | Braço×2 | 1 | 2.200 | DES -1 |
| Couraça de Placas ⭑ | Pesada | 2 | **0,60** | Torso, Costas | 2 | 3.800 | Furt -1 |
| Couro Batido | Leve | 3 | **0,60** | Torso, Costas, Cintura | 1 | 800 | — |
| Escarpes de Placas ⭑ | Pesada | 2 | **0,60** | Pé×2 | 1 | 4.000 | Furt -1 · Desloc -1 |
| Escudo Médio | Escudo | 1 | **0,60** | Mão | 1 | 500 | — |
| Grevas de Placas ⭑ | Pesada | 2 | **0,60** | Pernas×2 | 1 | 5.000 | DES -1 · Furt -1 · Desloc -1 |
| Ombreiras de Placas ⭑ | Pesada | 2 | **0,60** | Ombro×2 | 1 | 2.000 | — |
| Botas Ferradas ⭑ | Média | 2 | **0,44** | Pé×2 | 1 | 1.600 | Furt -1 |
| Braçadeiras de Couro ⭑ | Média | 2 | **0,44** | Braço×2 | 1 | 900 | — |
| Calças de Malha ⭑ | Média | 2 | **0,44** | Pernas×2 | 1 | 1.900 | DES -1 · Furt -1 |
| Couro Leve | Leve | 2 | **0,40** | Torso, Costas | 1 | 400 | — |
| Gibão Acolchoado | Leve | 2 | **0,40** | Torso, Costas | 1 | 300 | — |
| Mangas Acolchoadas ⭑ | Leve | 2 | **0,40** | Braço×2 | 1 | 800 | DES -1 · Furt -1 |
| Manto de Linho | Leve | 2 | **0,40** | Costas, Cabeça | 1 | 400 | — |
| Broquel | Escudo | 1 | **0,30** | Mão | 1 | 200 | — |
| Elmo de Placas ⭑ | Pesada | 1 | **0,30** | Cabeça | 1 | 5.000 | DES -1 · Furt -1 |
| Faldar de Placas ⭑ | Pesada | 1 | **0,30** | Cintura | 1 | 1.000 | — |
| Gorjal de Aço ⭑ | Pesada | 1 | **0,30** | Pescoço | 1 | 1.000 | Furt -1 |
| Cinturão Rebitado ⭑ | Média | 1 | **0,22** | Cintura | 1 | 500 | — |
| Coifa de Malha ⭑ | Média | 1 | **0,22** | Cabeça | 1 | 1.600 | Furt -1 |
| Gorjal de Malha ⭑ | Média | 1 | **0,22** | Pescoço | 1 | 500 | — |
| Capuz Acolchoado ⭑ | Leve | 1 | **0,20** | Cabeça | 1 | 900 | Furt -1 |
| Cinta Acolchoada ⭑ | Leve | 1 | **0,20** | Cintura | 1 | 400 | — |
| Gola de Couro ⭑ | Leve | 1 | **0,20** | Pescoço | 1 | 400 | — |

---

# O que fazer no Capítulo 5

## A. Linhas que estão ERRADAS hoje (0)

Nenhuma — todos os valores que o capítulo já traz conferem com o banco.

## B. Peças que FALTAM no capítulo (18)

| Peça | Classe | Slots | Blindagem | Cobertura | Peso | Preço | Penalidade |
|---|---|---|---|---|---|---|---|
| Braçadeiras de Placas ⭑ | Pesada | 2 | **0,60** | Braço×2 | 1 | 2.200 | DES -1 |
| Couraça de Placas ⭑ | Pesada | 2 | **0,60** | Torso, Costas | 2 | 3.800 | Furt -1 |
| Escarpes de Placas ⭑ | Pesada | 2 | **0,60** | Pé×2 | 1 | 4.000 | Furt -1 · Desloc -1 |
| Grevas de Placas ⭑ | Pesada | 2 | **0,60** | Pernas×2 | 1 | 5.000 | DES -1 · Furt -1 · Desloc -1 |
| Ombreiras de Placas ⭑ | Pesada | 2 | **0,60** | Ombro×2 | 1 | 2.000 | — |
| Botas Ferradas ⭑ | Média | 2 | **0,44** | Pé×2 | 1 | 1.600 | Furt -1 |
| Braçadeiras de Couro ⭑ | Média | 2 | **0,44** | Braço×2 | 1 | 900 | — |
| Calças de Malha ⭑ | Média | 2 | **0,44** | Pernas×2 | 1 | 1.900 | DES -1 · Furt -1 |
| Mangas Acolchoadas ⭑ | Leve | 2 | **0,40** | Braço×2 | 1 | 800 | DES -1 · Furt -1 |
| Elmo de Placas ⭑ | Pesada | 1 | **0,30** | Cabeça | 1 | 5.000 | DES -1 · Furt -1 |
| Faldar de Placas ⭑ | Pesada | 1 | **0,30** | Cintura | 1 | 1.000 | — |
| Gorjal de Aço ⭑ | Pesada | 1 | **0,30** | Pescoço | 1 | 1.000 | Furt -1 |
| Cinturão Rebitado ⭑ | Média | 1 | **0,22** | Cintura | 1 | 500 | — |
| Coifa de Malha ⭑ | Média | 1 | **0,22** | Cabeça | 1 | 1.600 | Furt -1 |
| Gorjal de Malha ⭑ | Média | 1 | **0,22** | Pescoço | 1 | 500 | — |
| Capuz Acolchoado ⭑ | Leve | 1 | **0,20** | Cabeça | 1 | 900 | Furt -1 |
| Cinta Acolchoada ⭑ | Leve | 1 | **0,20** | Cintura | 1 | 400 | — |
| Gola de Couro ⭑ | Leve | 1 | **0,20** | Pescoço | 1 | 400 | — |

## C. Linhas que já estão certas (18)

Armadura de Torneio · Armadura Completa · Cota de Placas · Meia-Armadura · Cota de Malha · Peitoral de Aço · Escudo de Torre · Brigandina · Escudo Grande · Couro Cravejado · Couro Reforçado · Armadura Leve · Couro Batido · Escudo Médio · Couro Leve · Gibão Acolchoado · Manto de Linho · Broquel

## D. Outras mudanças de dado que o texto pode citar

- **Meia-Armadura: 6.500 → 9.000.** A 6.500 ela entregava Cabeça e Pescoço barato
  demais e virava a rota mais barata para a Blindagem máxima, por baixo da própria
  Armadura de Torneio.
- **Armadura Leve: passou a ter preço (1.200) e encolheu de 5 para 4 slots**
  (perdeu a Cintura). A 5 slots ela dava 1,00 e dominava o Couro Cravejado e o
  Couro Reforçado — mais Blindagem, mais barata e sem penalidade.
- **Manto de Linho: passou a ter preço (400).**
- **Cinco peças tiveram a lista de slots onde podem ser vestidas corrigida**
  (Peitoral de Aço, Cota de Malha, Couro Batido, Armadura Leve, Manto de Linho).
  Elas ofereciam opções que nunca funcionavam. A cobertura não mudou — se o
  capítulo diz o que cada peça cobre, continua valendo.

## E. Cuidado com o vocabulário

**"Reforçado" é termo reservado à melhoria de ferreiro** (a resistência física
adicionada na oficina). Não usar como adjetivo solto ao descrever peça nova. Os
itens antigos que já se chamam Couro Reforçado e Roupas Reforçadas ficam como
estão.
