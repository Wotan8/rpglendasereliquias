# Correções e dados definitivos — complemento ao prompt de Blindagem e Afiações

Este documento corrige e completa o prompt anterior. Onde houver conflito, vale este. Os valores abaixo já estão gravados no banco do sistema — não são mais alvos de projeto, são o catálogo real.

## 1. Correção: as graduações de armadura não existem mais

O prompt anterior dizia que a penalidade de armadura seguia uma graduação (`Pesada III`, `Média II`, etc.). **Essas graduações foram removidas do sistema.** Restaram apenas três classes de material: **Leve**, **Média** e **Pesada**.

A penalidade agora é **própria de cada peça**, não derivada de uma faixa. Cada armadura carrega os seus modificadores individualmente, e eles valem enquanto a peça estiver vestida. Não descreva penalidade como "toda armadura Pesada sofre X" — descreva peça por peça, ou pela tabela da seção 3.

Também não existe mais penalidade de Deslocamento em armadura alguma. Só escudos grandes penalizam Deslocamento.

## 2. Correção: o piso de dano é um procedimento manual de mesa

O piso de dano (todo golpe que acerta causa no mínimo 1) **não é automatizado pela ficha e não será**. O procedimento é: o jogador subtrai a Blindagem do alvo do dano do golpe; se o resultado der zero ou negativo, ele marca **1** de dano na Vitalidade do alvo. A ficha não intercepta isso porque o dano recebido já é anotado à mão de qualquer forma.

Isso é relevante para o texto: o piso precisa ser apresentado como um passo do procedimento de resolver um ataque, não como um efeito que o sistema aplica sozinho.

## 3. O catálogo real: Blindagem, cobertura e penalidade

Blindagem = taxa da classe × slots cobertos. Taxas: **Leve 0,15 · Média 0,22 · Pesada 0,30** por slot. Escudos não usam taxa — têm valor próprio, e ocupam 1 slot de Mão.

Um corpo humano tem **13 slots de armadura** (Cabeça 1, Pescoço 1, Torso 1, Costas 1, Ombros 2, Braços 2, Cintura 1, Pernas 2, Pés 2) e mais 2 de Mão.

| Peça | Classe | Slots | Blindagem | Penalidade |
|---|---|---|---|---|
| Armadura de Torneio | Pesada | 13 | **3,90** | Destreza −3 · Furtividade −5 |
| Armadura Completa | Pesada | 11 | **3,30** | Destreza −2 · Furtividade −4 |
| Cota de Placas | Pesada | 8 | **2,40** | Destreza −1 · Furtividade −3 |
| Meia-Armadura | Pesada | 8 | **2,40** | Destreza −1 · Furtividade −3 |
| Cota de Malha | Média | 7 | **1,54** | Destreza −1 · Furtividade −2 |
| Peitoral de Aço | Média | 6 | **1,32** | Destreza −1 · Furtividade −2 |
| Escudo de Torre | Escudo | 1 (Mão) | **1,20** | Acerto −2 · Desloc. Terrestre −1 |
| Brigandina | Média | 5 | **1,10** | Destreza −1 · Furtividade −1 |
| Escudo Grande | Escudo | 1 (Mão) | **0,90** | Acerto −1 |
| Couro Cravejado | Média | 4 | **0,88** | Furtividade −1 |
| Couro Reforçado | Média | 4 | **0,88** | Furtividade −1 |
| Armadura Leve | Leve | 5 | **0,75** | — |
| Escudo Médio | Escudo | 1 (Mão ou Braço) | **0,60** | — |
| Couro Batido | Leve | 3 | **0,45** | — |
| Gibão Acolchoado | Leve | 2 | **0,30** | — |
| Couro Leve | Leve | 2 | **0,30** | — |
| Manto de Linho | Leve | 2 | **0,30** | — |
| Broquel | Escudo | 1 (Mão) | **0,30** | — |

**Regra de leitura da tabela:** mais Blindagem sempre custa mais penalidade. Nenhuma peça do catálogo é estritamente melhor que outra — quem quer proteção paga em Destreza e Furtividade, e essa troca é a decisão real na hora de escolher armadura.

## 4. Onde exatamente cada peça cobre

Isto define o que pode ser combinado com o quê. O slot listado primeiro é onde a peça aparece na ficha; os demais são ocupados junto.

| Peça | Cobre |
|---|---|
| Armadura de Torneio | Torso, Cabeça, Pescoço, Costas, 2 Ombros, 2 Braços, Cintura, 2 Pernas, 2 Pés — **o corpo inteiro** |
| Armadura Completa | Torso, Costas, 2 Ombros, 2 Braços, Cintura, 2 Pernas, 2 Pés (deixa cabeça e pescoço livres) |
| Cota de Placas | Torso, Pescoço, Costas, 2 Ombros, 2 Braços, Cintura |
| Meia-Armadura | Torso, Cabeça, Pescoço, Costas, 2 Ombros, 2 Braços (metade de cima) |
| Cota de Malha | Torso, Costas, 2 Ombros, 2 Braços, Cintura |
| Peitoral de Aço | Torso, Pescoço, Costas, 2 Ombros, Cintura |
| Brigandina | Torso, Costas, 2 Ombros, Cintura |
| Couro Cravejado | Torso, Costas, 2 Ombros |
| Couro Reforçado | Torso, Costas, 2 Ombros |
| Armadura Leve | Torso, Costas, 2 Ombros, Cintura |
| Couro Batido | Torso, Costas, Cintura |
| Gibão Acolchoado | Torso, Costas |
| Couro Leve | Torso, Costas |
| Manto de Linho | Costas, Cabeça |

**Consequência que o livro precisa transmitir:** um slot ocupado está ocupado. A Armadura de Torneio consome os 13 slots do corpo, então quem a veste não pode acrescentar nada — ela já inclui elmo, gorjal, ombreiras, braçadeiras, grevas e botas. A Armadura Completa deixa Cabeça e Pescoço livres, então aceita um elmo. A Cota de Malha deixa Cabeça, Pescoço, Pernas e Pés livres. É assim que se monta proteção: escolhendo uma peça grande e preenchendo o que sobrou, ou juntando peças pequenas.

As duas Mãos são separadas do corpo: ficam livres para arma e escudo independentemente da armadura vestida.

## 5. Somar Blindagem na mesa

Some a Blindagem de tudo que estiver vestido e **arredonde o total para baixo**. Valores fracionados só existem para que peças pequenas tenham peso próprio — o jogador nunca subtrai uma fração de dano.

Exemplo: Cota de Malha (1,54) + Escudo Grande (0,90) = 2,44 → **Blindagem 2**.
Exemplo: Armadura de Torneio (3,90) + Escudo de Torre (1,20) = 5,10 → **Blindagem 5**. É a proteção máxima possível hoje sem melhorias.

## 6. O que a proteção máxima significa em combate

Contra o golpe de um personagem iniciante (1d8 + Força 3, média 7,5), um humano com 24 de Vitalidade cai em:

| Proteção | Blindagem (arredondada) | Golpes até cair |
|---|---|---|
| Nenhuma | 0 | **3** |
| Brigandina | 1 | 4 |
| Cota de Malha | 1 | 4 |
| Cota de Placas | 2 | 4 |
| Armadura de Torneio | 3 | 5 |
| Torneio + Escudo de Torre | 5 | **10** |

**Atenção — ponto aberto, não escreva como regra final ainda:** com arredondamento para baixo, toda peça de classe Leve isolada (0,30 a 0,75) resulta em Blindagem **0** e não protege nada. As peças leves só passam a contar quando somadas a outras — e o catálogo atual não tem peças pequenas (elmo, braçadeira, greva, bota) para somar com elas. Isso está sendo revisto. Não afirme no livro que armadura leve não protege até essa decisão estar fechada.
