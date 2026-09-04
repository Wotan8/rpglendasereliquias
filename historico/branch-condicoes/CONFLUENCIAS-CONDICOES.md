# Confluências → Condições

Tabela para preencher o campo `condicoesAplicadas` das runas. Fonte das
confluências: `laboratorium-runarum/js/compendium-data.js`,
`RUNO_TABELAS.confluencias`. Valores medidos em
`functions/audit-condicoes-fase2.mjs`.

**Vinte e uma confluências, duas condições novas.** A regra da casa — mapear
para existente antes de criar — segurou 19 das 21. As duas que passaram fazem
coisa que nenhuma condição existente fazia: **congelar em trilha** e **punir
quem veste armadura**.

## A tabela

| Confluência | Fusão | Classe | Condições | Nota |
|---|---|---|---|---|
| Vapor | fogo + água | física | **Ofuscado** | nuvem que cega; o calor já é o dano da runa |
| Névoa | água + vento | física | **Ofuscado** | — |
| **Gelo** | água + vento | física | **Congelamento** | ⭐ nova |
| Lava | fogo + terra | física | **Queimadura** | — |
| Metal | terra + fogo | física | *nenhuma* | material, não aflição |
| Areia | terra + vento | física | **Ofuscado** | — |
| Lama/Argila | água + terra | física | **Lento** *ou* **Imobilizado** | por profundidade — nunca os dois: Imobilizado já zera o Deslocamento |
| Sal | água + terra | física | *nenhuma* | material, não aflição |
| Fumaça | fogo + vento | física | **Ofuscado** · **Afogando** | Afogando só em volume fechado |
| Cinzas | fogo + natureza | física | **Ofuscado** | — |
| **Raio** | luz + vento | arcana | **Eletrocutado** | ⭐ nova |
| Plasma | fogo + luz | arcana | **Queimadura** · **Cego** | queima e cega; as duas já existem |
| Gravidade | terra + espacial | arcana | **Prostrado** · **Imobilizado** | Ancorado é positiva, não serve aqui |
| Vácuo | espacial + vento | arcana | **Afogando** | sem ar é a definição de Afogando |
| **Cristal de Gelo** | água + cristal | arcana | **Congelamento** · **Opaco** | o cristal também sufoca a Essência do alvo |
| Miasma | vento + necrótico | proibida | **Definhado** · **Ofuscado** | nuvem que drena |
| Fogo Fátuo | fogo + necrótico | proibida | **Queimadura** · **Definhado** | Queimadura de canal Necrótico |
| Névoa Abissal | vento + abissal | proibida | **Ofuscado** · **Corrompido** | — |
| **Cronogelo** | temporal + água | proibida | **Congelamento** | variante: **não desce com calor**. Somar Atordoado não compraria nada |
| Luz Inversa | luz + abissal | proibida | **Cego** · **Corrompido** | — |
| Chama Eterna | fogo + temporal | proibida | **Queimadura** | variante: não pode ser apagada |

12 condições distintas cobrem as 21 confluências. Duas não aplicam nenhuma —
Metal e Sal são material, não aflição.

## Quatro confluências empilham no mesmo eixo

Pelo §6.11 da Régua, condições que mexem no mesmo eixo somam **subaditivo**: a
soma linear é teto, não estimativa. Desconte antes de precificar a runa.

| Confluência | Empilhamento | Eixo repetido |
|---|---|---|
| Gravidade | Prostrado + Imobilizado | Alvo |
| Névoa Abissal | Ofuscado + Corrompido | Alvo |
| Luz Inversa | Cego + Corrompido | Alvo |
| Fogo Fátuo | Queimadura + Definhado | dano |

As demais combinações atacam eixos diferentes (dano × Alvo, ação × Essência) e
somam linear sem desconto.

## As duas variantes

Não são condições novas. São a mesma condição com uma cláusula removida, e é
assim que devem ser escritas na runa:

- **Chama Eterna** → `Queimadura` **sem a cláusula de apagar**. A ação que
  normalmente extingue não funciona.
- **Cronogelo** → `Congelamento` **sem a descida por calor**. O que está
  congelado é o tempo, não a água; fonte de calor não devolve nível.

Ambas são proibidas no cânone, e é justamente a cláusula removida que
justifica a proibição.

## As quatro novas

### 🧊 Congelamento — trilha de 3 níveis

| Nv | Nome | Efeito | un/rodada |
|---|---|---|---|
| 1 | Enregelado | efeitos de **Lento** (½ Deslocamento, −2 Iniciativa) | 0,10 |
| 2 | Cristalizado | Enregelado + perde **2 de Vitalidade por ação gasta** (Padrão ou Movimento) | 1,00 |
| 3 | Rompente | **não pode agir**. Forçar exige VIG; passando, role 1d10: **1–3 perde um membro**, **10 morre** | 1,32 |

**Sobe:** 1 nível por rodada exposto a frio contínuo; habilidade pontual declara o nível.
**Desce:** 1 nível por rodada junto a fonte de calor, ou com **Queimadura** ativa. Sem calor, 1 nível por cena.

Queimadura e Congelamento se anulam nível a nível — mesma lógica das quatro
oposições do §7.3, e caiu de graça do desenho.

**O Nv 3 dura 1 turno e desce sozinho para o Nv 2.** Sem essa trava, três
rodadas de frio prendem o alvo no Rompente até a cena acabar — a remoção da
luta que o §6.12 registra como invisível para a régua. Segurar alguém ali
exige reaplicar, e reaplicar custa de novo.

**Chance, com o piso de 5 do §6.10:** Nv 2 no piso entrega 2,50 e cabe em
custo 2. Nv 3 no piso entrega **0,66 e não paga nem custo 1** — precisa de
Chance 8, que entrega 1,06.

### 🩸 Hemorragia N — a negativa do Sangue

· **N de dano por rodada**, no fim do turno do alvo
· **dobra** se o alvo gastar a Ação de Movimento
· **estanca** com 1 Ação Padrão + teste de **Perícia: Anatomia**, ou qualquer cura

| N | parado | movendo |
|---|---|---|
| 1 | 0,29 | 0,58 |
| 2 | 0,58 | 1,16 |
| 3 | 0,87 | 1,74 |

Única condição que pune **movimento** em específico. A Queimadura cobra a ação
de apagar; a Hemorragia cobra a fuga. E sai diferente: apagar fogo é automático
se você gastar a ação, estancar exige um teste que pode falhar.

### 🤝 Pacto de Sangue — a positiva do Sangue

Dois alvos dispostos ficam ligados; o dano que um sofrer é **dividido entre os
dois**, metade para cada, arredondando para cima.

**0,00 un em dano bruto**, e ligeiramente negativo com o arredondamento: 7 de
dano viram 4 e 4. Não reduz dano — redistribui. Troca pico por média, que é
variância, e a Régua §4.6 registra que variância não aparece no valor esperado.

**É de propósito que não seja bônus de Alvo nem de dano.** O Sangral já é a
classe mais física do elenco, e somar potência a ele exige medir a classe
inteira antes — está registrado como risco aberto e ficou fora desta encomenda.

### ⚡ Eletrocutado N — a armadura vira o problema

· dano por rodada = **N + metade da Blindagem do alvo** (arredonda para baixo; o acréscimo nunca passa de **+4**)
· **a Blindagem não reduz esse dano** — é o metal dela que conduz
· o alvo **não pode usar a Reação**
· **Descarga:** ao acabar, salta para o aliado adjacente mais próximo com **N−1**. Em N=0, para.

| Faixa | Blindagem | N=1 | N=2 | N=3 |
|---|---|---|---|---|
| Q0 | 2 | 2 | 3 | 4 |
| Q3 | 5 | 3 | 4 | 5 |
| Q5 | 9 | 5 | 6 | 7 |

**Valor no Q0 com N=2:** 3 × 0,290 = 0,87 de dano + 0,320 por não reagir =
**1,19/rodada**, mais 0,58 da descarga = **1,77**. No piso de Chance 5 entrega
0,89 e não paga custo 1 — precisa de **Chance 8** (1,42).

**O teto de +4 é o que segura a régua.** Sem ele o acréscimo seria a Blindagem
inteira e cresceria com a escada de Qualidade, o mesmo defeito que o
Amplificado tem (§7.4). Com o teto, o Q5 paga 5 em vez de 10.

**Por que não é Atordoado renomeado.** Atordoado rouba o turno e não olha para
o equipamento. Eletrocutado deixa o alvo agir, cobra dano que a própria
armadura amplifica, e salta para quem estiver colado. Muda a decisão de três
jogadores — o alvo pensa em largar a armadura, o aliado em sair de perto, e o
conjurador mira no couraçado em vez de no mago.

## Repetir condição que rouba turno

**Atordoado e Congelamento são repetíveis**, mas cada aplicação anterior na
mesma cena cobra do **portão da habilidade** (§6.1) — nunca dos dois, porque a
habilidade só tem um:

| Portão | Decaimento |
|---|---|
| **Chance** | −1 na Chance por aplicação anterior |
| **Teste de resistência** | o alvo ganha **Vantagem**, cumulativa por aplicação anterior |

```
via Chance (partindo de 8)        via Vantagem (alvo resiste 10%)
1ª  C8  →  0,80                   1ª  0,90
2ª  C7  →  0,70                   2ª  0,81
3ª  C6  →  0,60                   3ª  0,73
4ª  C5  →  0,50                   4ª  0,66
5ª  C4  →  0,40                   5ª  0,59
    5 Energia = 3,00 turnos           5 Energia = 3,69 turnos
```

Sem decaimento, 5 Energia comprariam 4,00. A via da Vantagem decai mais devagar
contra alvo comum — dobrar 10% ainda é pouco — e muito mais rápido contra alvo
treinado, que é o comportamento certo: o inimigo resistente resiste mesmo.

O piso de Chance 5 do §6.10 é regra de **projeto**, não de mesa. O decaimento
pode levar a Chance abaixo de 5 em jogo; o piso limita o que a habilidade
declara no cadastro, não onde ela chega rolando.

## O princípio novo que a encomenda 1 produziu

O Nv 2 do Congelamento cobra Vitalidade por ação gasta. A conta ingênua diz
1,16 un (duas ações × 2 de dano × 0,290). **O valor real é 1,00**, porque o
alvo sempre pode ficar parado, e ficar parado custa exatamente um turno:

```
dano/ação   agindo   parado   vale
1           0,58     1,00     0,58   → o alvo age e sangra
2           1,16     1,00     1,00   → o alvo fica parado
3           1,74     1,00     1,00   → o alvo fica parado
4           2,32     1,00     1,00   → o alvo fica parado
```

**Imposto sobre ação tem teto em 1,000.** Acima de 1 de dano por ação, o
excedente é desperdício — o alvo já parou. Vale para qualquer condição futura
que cobre para agir. Está registrado no §6.13 da Régua.

## Consumo

- `condicoesAplicadas` das runas — esta tabela
- loções da Alquimancia — "As Oito da Bancada", Compêndio de Alquimancia
- canal Necrótico em ingredientes — Fungo-do-Véu, Flor-Cadáver

Total no catálogo: **32 condições** em `system/data/conditions`. O valor de cada
uma está na própria `descricao`, que é de onde a régua de magias lê.
