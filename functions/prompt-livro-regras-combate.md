# Atualização do livro de regras — Blindagem, Afiações e o modelo de combate

Estas são as regras fechadas na revisão de balanceamento de 29/07/2026. Tudo abaixo é informação de sistema, validada por simulação contra os dados reais do Firestore. O que estiver no livro que contradiga isto está desatualizado.

## As três grandezas do combate

- **Vitalidade Máxima** = (VIG + Tamanho) × 3, onde Tamanho = Altura × 3. Um Humano típico na criação tem 24. Picxi 19, Yotun 56. A Vitalidade NÃO cresce com equipamento — é a única das três grandezas que não escala, e isso é intencional: é o que mantém o combate mortal em qualquer nível de riqueza.
- **Dano** = fórmula de dado da arma (1d4 a 1d12, impresso na arma) + o valor derivado Dano do personagem (base = FOR) + bônus da própria arma (dano natural e afiações).
- **Blindagem** = subtrai diretamente do dano de cada golpe recebido. Não é porcentagem, não é rolagem: é uma subtração seca, feita de cabeça na mesa. Dano 9 contra Blindagem 3 = perde 6 de Vitalidade.

**Piso de dano: todo golpe que acerta causa no mínimo 1 de dano**, não importa quanta Blindagem o alvo tenha. Não existe imunidade — existe demorar 24 golpes. É um procedimento manual de mesa: o jogador subtrai a Blindagem do dano e, se o resultado der zero ou negativo, marca 1 de dano na Vitalidade do alvo. A ficha não faz isso sozinha — o dano recebido já é anotado à mão de qualquer forma.

## Como a Blindagem é calculada: por slot coberto

O corpo tem partes, e cada parte tem slots de equipamento (um Humano: Cabeça 1, Pescoço 1, Torso 1, Costas 1, Ombros 2, Braços 2, Mãos 2, Cintura 1, Pernas 2, Pés 2 — os 6 de Dedos não recebem armadura). **15 slots podem levar proteção** (13 de armadura + as 2 mãos, onde entram escudos).

A Blindagem de uma peça = **classe do material × quantos slots ela cobre**:

| Classe | Blindagem por slot coberto |
|---|---|
| Leve | 0,15 |
| Média | 0,22 |
| Pesada | 0,30 |

Exemplos do modelo: uma Armadura de Torneio (Pesada, cobre os 13 slots do corpo) = 3,9. Uma Cota de Placas (Pesada, 9 slots) = 2,7. Um Peitoral de Aço (Média, 4 slots) = 0,88. Um Gibão Acolchoado (Leve, 2 slots) = 0,3.

Valores fracionados são normais e desejados — peças pequenas valem frações. **Soma-se tudo que está vestido e arredonda-se o total para baixo.** Só o total importa na mesa.

**Escudos ficam fora da tabela de classes** porque são defesa ativa que ocupa uma mão (que competiria com uma arma): Broquel 0,3 · Escudo Médio 0,6 · Escudo Grande 0,9 · Escudo de Torre 1,2.

Um item pode ocupar mais de um slot (uma armadura completa ocupa torso, braços, pernas etc.; uma arma de duas mãos ocupa as duas mãos). Ocupação é exclusiva: não dá para vestir ombreira por cima de uma armadura que já cobre o ombro — o slot já está tomado. É isso que impede empilhar peças de forma absurda.

## Liga: o tier de qualidade do item

Todo equipamento tem uma **Liga** de 0 a 5: 0 Sem Liga (improvisado), 1 Bruta, 2 Justa, 3 Nobre, 4 Pura, 5 Superior. A Liga é o teto de melhoria do item — um item só aceita melhorias até o tier da própria Liga.

## As quatro melhorias: duas oficinas, dois alvos

| Profissional | Em arma | Em armadura/escudo |
|---|---|---|
| **Ferreiro** | Afiação | Reforço |
| **Forjarcanista** (raro) | Afiação Mágica | Resistência Mágica (rara) |

- **Em arma**: cada uma vale **+5 de dano por tier**. As duas empilham na mesma arma — uma arma Liga 3 com as duas afiações no máximo carrega +30 de dano.
- **Em proteção**: cada uma vale **+0,33 de Blindagem por slot coberto por tier** (as duas juntas: +0,67/slot/tier). O ferreiro reforça o arnês inteiro como um trabalho só; o valor vem de quantos slots aquela proteção cobre. Reforçar um arnês de 13 slots rende o mesmo que reforçar 13 peças avulsas de 1 slot cada — não existe vantagem em fatiar.

**Por que os números são esses:** uma arma totalmente melhorada ganha +10 por tier; um corpo totalmente coberto e totalmente melhorado ganha 15 × 0,67 = +10 por tier. **As melhorias se cancelam entre equipamentos do mesmo tier.** Consequência de design que o livro deve transmitir: afiar e reforçar é manutenção para não ficar para trás — o poder real de um item está nos seus valores naturais (dado maior, material melhor, cobertura maior), não na afiação.

## A janela letal (o que o jogador sente na mesa)

Contra um golpe comum de personagem iniciante (1d8 + FOR 3, média 7,5), um Humano de 24 de Vitalidade cai em:

| Proteção | Blindagem | Golpes até cair |
|---|---|---|
| Nu | 0 | ~3 |
| Armadura Leve completa | ~2 | ~4 |
| Armadura Média completa | ~2,9 | ~5 |
| Armadura Pesada completa | ~3,9 | ~7 |
| Pesada + Escudo de Torre | ~5,1 | ~10 |

Armadura nunca torna ninguém imune; torna a diferença entre morrer em 3 golpes e aguentar 10.

**Descasamento de tier é letal, e é proposital**: uma arma dois tiers acima da sua proteção mata em 1–2 golpes; uma proteção dois tiers acima da arma atacante reduz tudo ao piso de 1 (24 golpes para cair). O perigo do jogo está em enfrentar quem tem aço melhor que o seu — não na sorte do dado.

**Duas mãos versus escudo** é uma troca real: a arma de duas mãos entrega cerca do dobro de dano útil; a mão com escudo aguenta mais que o dobro de golpes. E o escudo é a única proteção que segura a deriva ofensiva nos tiers altos, porque adiciona um slot defensivo sem adicionar dano ao inimigo.

## Penalidades de armadura (já existiam, continuam valendo)

Armadura pesada e média penaliza Destreza, Furtividade e Deslocamento conforme a graduação (ex.: Pesada III = −3 DES, −5 Furtividade, −2 Desloc. Terrestre; Escudo Grande = −1 Acerto; Escudo Torre = −2 Acerto, −1 Desloc.). A penalidade mora na peça e vale enquanto ela estiver vestida.
