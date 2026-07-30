# Criar as peças avulsas de armadura — briefing

O sistema de proteção de Lendas e Relíquias funciona por **slot coberto**, mas o catálogo só tem armaduras de tronco e de corpo inteiro. Falta a linha de peças avulsas. Esta sessão existe para criá-la.

Existe uma skill do projeto chamada `balancear-item` com o modelo completo de combate. Leia antes de calcular qualquer valor.

## 1. O modelo, em uma tela

```
Blindagem da peça = taxa da classe × quantos slots ela cobre
Blindagem do personagem = soma de tudo vestido, ARREDONDADA PARA BAIXO só no total
```

| Classe | Blindagem por slot coberto |
|---|---|
| Leve | 0,15 |
| Média | 0,22 |
| Pesada | 0,30 |

Escudos não usam taxa — têm valor próprio e ocupam 1 slot de Mão.

**Nunca invente um valor de Blindagem.** Ele é sempre `taxa × slots`. Se o número desejado não sair dessa multiplicação, a cobertura ou a classe está errada, não o valor.

## 2. O corpo

Um humano tem **13 slots de armadura** e 2 de Mão:

| Parte | Slots |
|---|---|
| Cabeça | 1 |
| Pescoço | 1 |
| Torso | 1 |
| Costas | 1 |
| Ombro | 2 |
| Braço | 2 |
| Cintura | 1 |
| Pernas | 2 |
| Pé | 2 |
| **Mão** | 2 (arma e escudo, fora dos 13) |

Dedos (6 slots) não recebem armadura.

Um item declara um **slot principal** (`equipavelEm`, onde aparece na ficha) e **slots adicionais** (`slotsAdicionais`, uma lista de `{parte, quantidade}`). A reserva é tudo-ou-nada: se faltar um slot livre, o item não equipa. Slot ocupado está ocupado — é isso que impede empilhar peça sobre armadura que já cobre aquele lugar.

## 3. O que já existe

18 peças, todas centradas no tronco. Blindagem já recalibrada pelo modelo:

| Peça | Classe | Slots | Blindagem | Peso | Preço | Penalidade |
|---|---|---|---|---|---|---|
| Armadura de Torneio | Pesada | 13 | 3,90 | 6 | 20.000 | DES −3 · Furt −5 |
| Armadura Completa | Pesada | 11 | 3,30 | 5 | 12.000 | DES −2 · Furt −4 |
| Cota de Placas | Pesada | 8 | 2,40 | 4 | 5.500 | DES −1 · Furt −3 |
| Meia-Armadura | Pesada | 8 | 2,40 | 4 | 6.500 | DES −1 · Furt −3 |
| Cota de Malha | Média | 7 | 1,54 | 1 | 3.000 | DES −1 · Furt −2 |
| Peitoral de Aço | Média | 6 | 1,32 | 1 | 2.800 | DES −1 · Furt −2 |
| Escudo de Torre | Escudo | 1 | 1,20 | 4 | 1.800 | Acerto −2 · Desloc −1 |
| Brigandina | Média | 5 | 1,10 | 3 | 3.500 | DES −1 · Furt −1 |
| Escudo Grande | Escudo | 1 | 0,90 | 3 | 1.000 | Acerto −1 |
| Couro Cravejado | Média | 4 | 0,88 | 2 | 1.800 | Furt −1 |
| Couro Reforçado | Média | 4 | 0,88 | 2 | 1.500 | Furt −1 |
| Armadura Leve | Leve | 5 | 0,75 | 1 | **sem preço** | — |
| Escudo Médio | Escudo | 1 | 0,60 | 1 | 500 | — |
| Couro Batido | Leve | 3 | 0,45 | 1 | 800 | — |
| Gibão Acolchoado | Leve | 2 | 0,30 | 1 | 300 | — |
| Couro Leve | Leve | 2 | 0,30 | 1 | 400 | — |
| Manto de Linho | Leve | 2 | 0,30 | 1 | **sem preço** | — |
| Broquel | Escudo | 1 | 0,30 | 1 | 200 | — |

**Armadura Leve e Manto de Linho estão sem preço.** Resolver isso faz parte do trabalho.

## 4. O buraco a preencher

Todos os 13 slots são tecnicamente alcançáveis hoje — mas **só comprando uma armadura de corpo**. Não existe nenhuma peça avulsa para Cabeça, Pescoço, Ombro, Braço, Cintura, Pernas ou Pé. Consequência: quem quer proteger a cabeça precisa comprar uma Armadura de Torneio de 20.000, e quem compra uma Cota de Malha (que deixa Cabeça, Pescoço, Pernas e Pés livres) não tem nada para pôr nesses slots.

O que falta é a linha à la carte: elmo, gorjal, ombreira, braçadeira, manopla, faldar/cinturão, greva, bota. Com ela, montar um conjunto peça por peça passa a ser um caminho alternativo à armadura de corpo — e um eixo de progressão para personagem pobre, que compra um elmo hoje e as grevas depois.

## 5. As regras que o conjunto novo tem que respeitar

**A. Um conjunto completo de avulsas equivale à armadura de corpo da mesma classe.** 13 slots × taxa. Pesada = 3,90 (igual à Armadura de Torneio), Média = 2,86, Leve = 1,95. Isso sai automaticamente da fórmula — só confira que a soma fecha.

**B. Um conjunto completo de avulsas tem que custar MAIS que a armadura de corpo equivalente, nunca menos.** Hoje o catálogo tem uma distorção grave de eficiência:

| Peça | Blindagem por 1.000 moedas |
|---|---|
| Broquel | 1,50 |
| Escudo Médio | 1,20 |
| Gibão Acolchoado | 1,00 |
| Cota de Malha | 0,51 |
| Armadura Completa | 0,27 |
| Armadura de Torneio | 0,20 |

Peça barata entrega até **7× mais Blindagem por moeda** que placa. Se as avulsas forem precificadas nessa faixa, montar kit fica absurdamente mais barato que comprar armadura e as armaduras grandes morrem. O conjunto Pesado completo de avulsas deve custar na ordem de **20.000 a 25.000** somado — o preço da conveniência de comprar aos poucos, e do ferreiro fazer nove peças em vez de uma.

**C. Peso somado equivalente ou maior.** Armadura de Torneio pesa 6; um conjunto Pesado completo deve pesar 6 ou mais. Peso come Carga, e Carga é um recurso real.

**D. Mais Blindagem custa mais penalidade, sem exceção.** Essa invariante vale hoje em todo degrau do catálogo e não pode quebrar. Penalidades moram na própria peça: `atributosVinculados` para atributo (ex. `attr_des` −1) e `periciasVinculadas` para perícia (ex. Furtividade −1). Peça avulsa pequena provavelmente carrega penalidade fracionada ou nenhuma — mas o **conjunto completo** somado precisa chegar perto da penalidade da armadura equivalente (Pesada completa: DES −3, Furt −5).

**E. Uma peça pequena sozinha vale Blindagem 0.** Um elmo Pesado cobre 1 slot: 0,30, que arredonda para 0. Isso é esperado e não é bug — o arredondamento é só no total, e a peça existe para ser somada. Mas tem consequência de design: **o primeiro elmo que um personagem compra não muda nada na mesa.** Considere isso na precificação e na escolha de quais peças cobrem slots pareados juntos — uma peça que cubra os 2 Pés de uma vez (0,60) chega mais perto de importar sozinha que duas de 1 pé.

**F. Decida os slots pareados.** Ombro, Braço, Pernas e Pé têm 2 slots cada. Uma bota é um item que cobre os 2 Pés, ou dois itens de 1 pé? Ficção sugere par; granularidade sugere avulso. Escolha e seja consistente em todos os pares.

## 6. Quantidade

"Balanceada" aqui significa: peças suficientes para montar um conjunto completo em cada classe de material, sem inflar o catálogo com variação inútil. Um bom alvo é uma linha por slot não-tronco (Cabeça, Pescoço, Ombro, Braço, Cintura, Pernas, Pé) e não necessariamente nas três classes — material pesado pode não ter versão de manto, material leve pode não ter greva. Justifique o que deixar de fora.

## 7. Como gravar

Coleção `system/data/equipment`. Campos que importam:

| Campo | Uso |
|---|---|
| `nome` | nome da peça |
| `tipo` | `Vestimenta` |
| `tags` | inclua `Leve`, `Média` ou `Pesada` (a classe é lida daqui) |
| `equipavelEm` | array de ids de `system/data/bodyParts` — o slot principal |
| `slotsAdicionais` | `[{id: <parteId>, quantidade: N}]` — os slots além do principal |
| `valoresDerivadosVinculados` | `[{id: <id do VD Blindagem>, modificador: N}]` — **busque o id por nome, não hardcode** |
| `atributosVinculados` | `[{id: 'attr_des', modificador: -1}]` |
| `periciasVinculadas` | `[{id: <id da perícia>, modificador: -1}]` |
| `peso`, `tamanho`, `preco`, `liga`, `descricao`, `publicado` | como no resto do catálogo |
| `formaEquipar` | `vestir` |

Padrão de acesso ao Firestore: copie de `functions/recalibrar-blindagem.mjs`. **Dry-run imprimindo tudo antes, gravar só com aprovação explícita.**

## 8. O que reportar ao entregar

1. A tabela das peças novas com classe, slots, Blindagem, peso, preço e penalidade.
2. A soma de um conjunto completo por classe: Blindagem, peso, preço e penalidade totais — comparados lado a lado com a armadura de corpo equivalente.
3. Quais slots ficaram sem peça avulsa e por quê.
4. Se alguma regra da seção 5 não fechou, diga qual e o que você propõe.
