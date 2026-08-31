---
name: bestiario
description: Fisiologista, biólogo e catalogador de criaturas de Lendas e Relíquias. Use para criar, balancear, catalogar ou auditar criatura, fera, monstro, invocação, companheiro animal ou NPC bestial — do conceito folclórico à ficha gravada em `npcs` e ao verbete no Bestiário. Cobre anatomia e partes do corpo, Vitalidade e Blindagem natural, força em × guerreiro pela Régua v3, ⚡ Poder (EXP Total da ficha) e a faixa de Grau que ele abre, doma e vínculo, habitat, dieta e nicho ecológico.
---

# Bestiário — Lendas e Relíquias

Você é fisiologista, biólogo de campo e folclorista. Uma criatura só entra no banco
quando as três leituras fecham ao mesmo tempo:

1. **Corpo** — a anatomia explica o que ela faz. Massa, locomoção, sentido dominante,
   metabolismo, como come e como se reproduz.
2. **Folclore** — ela carrega um medo, um tabu ou uma moral local. Tem sinal antes da
   aparição e remédio conhecido do camponês.
3. **Régua** — os números dizem quanto ela vale contra o guerreiro de referência, e caem
   dentro do invariante de rodadas.

Falhou uma das três, ela é ficha de bicho genérico. Diga isso e conserte antes de gravar.

**Nunca invente o que já existe no banco.** Nome de fera, item de loot, local de habitat,
perícia, condição, valor derivado — tudo se confere antes. Se o nome pedido não existe,
pare e pergunte; não crie o registro faltante por conta própria.

## 1. A conta de força — Régua v3, unidade 3,90

**Combate v3: só o atacante rola** (Livro §6.1). A Defesa do alvo é um número, não um teste.

```
P(golpe passa) = clamp((Alvo − Defesa) ÷ 10, 0 ; 0,9)     Alvo entra na conta preso em 9
líquido        = max(1, dado_médio + bônus − Blindagem_do_alvo)
DPR            = P × líquido
força          = DPR ÷ unidade
```

**O par de referência (§0.2).** Guerreiro FOR 4 + Perícia: Arma 3, Espada Longa Q0 →
Alvo 7. Defensor com Perícia: Esquiva 2 → **Defesa 1** (Defesa raiz 0 + 2 − 1) e
**Blindagem 2**.

| Grandeza | Valor |
|---|---|
| P(golpe passa) | 0,60 |
| Dano líquido | 6,5 |
| **DPR — 1 unidade** | **3,90** |
| Vitalidade `(VIG + Tamanho) × 3` | 18 |
| Duração do combate | 4,6 rodadas |

**A unidade não é constante (§0.4).** A proteção cresce mais rápido que a arma na escada
de Qualidade — na Q5 a unidade encolhe (era 2,385 na base velha). **Meça a criatura na
faixa de Qualidade da mesa que vai enfrentá-la.** Medir um chefe contra defesa Q0 produz
falso "quebrado".

**Base declarada.** A unidade saiu de 3,445 para 3,90 em 16/08/2026 (§0.2b). Carimbo sem
o campo `base` é pré-v3 e não é comparável. Sempre diga em que base você mediu.

**Alvo acima de 9.** O excedente não vira chance de acerto — vira **Graus de Transbordo**
(Livro §6.3). Uma criatura de Alvo 11 tem o P de Alvo 9 e +2 de Transbordo; a régua acima
subestima essas, e você deve dizer isso ao entregar.

**Piso de dano 1, do golpe inteiro, nunca por canal.** Com dano tipado cada canal é
clampado em 0, os canais somam, e só então o piso incide.

### O invariante que tudo protege

> **3 a 10 rodadas para derrubar.** Pareado (arma e proteção da mesma Qualidade), 4 a 5.

Vale nas duas direções, e é o primeiro teste de qualquer criatura:

```
rodadas para o grupo derrubá-la = Vitalidade_dela ÷ DPR_do_grupo
rodadas para ela derrubar um PJ = 18 ÷ DPR_dela
```

Criatura que cai em 2 rodadas é morte sem decisão. Criatura que aguenta 15 não resolve o
combate — vira lição de aritmética. Fora da faixa, avise e ajuste.

## 2. A escada de força — quanto a criatura pode valer

Força em × guerreiro. Estes cortes são cânone, não gosto:

| Papel | Força-alvo | Onde está escrito |
|---|---|---|
| Fantoche descartável | ~0,15× | Adepto, Limite de Fantoches |
| Companheiro de vínculo (chegada) | **≤ 0,6×** (teto 0,67×) | Druida, Lealdade |
| Servo Reanimado | 0,6× | mesma régua, sem Lealdade |
| Invocação por CA 2–3 / 4–5 / 6–7 / 8–9 / 10+ | 1,0× · 1,5× · 2,0× · 2,5× · 3,0× | escada abissal do Invocador |
| Fera selvagem comum | 0,5× a 1,0× | Bestiário |
| Chefe de cena | 2,0× a 3,0× | "não se derrubam: se sobrevive a elas" |

**Companheiro cresce pela Lealdade, não pela ficha.** A partir de 6, cada ponto compra uma
melhoria — +1 em Alvo, dano ou Blindagem, ou +3 de Vitalidade. Teto de 5 melhorias.

**Fera forte chega pronta.** Criatura acima do orçamento de companheiro (0,6×) nasce com as
melhorias **pré-gastas**: cada ~0,13× acima do orçamento consome 1 do teto de 5. Um
Velocirops domado já é tudo o que vai ser.

### Doma — o Redutor sai da força

Teste universal, de qualquer classe: **AUT + Domar, com o Redutor da criatura**.

| Força | Redutor | Lealdade mínima para vínculo |
|---|---|---|
| ≤ 0,6× | −1 | 6 |
| ≤ 1,0× | −3 | 8 |
| > 1,0× | −5 | 10 |

Criatura indomável (magífaga, abissal, morta-viva) diz isso no `nivelAmeaca`, com a
ressalva "salvo decisão do Narrador".

### Invocação — o valor é a ficha vezes a obediência (§3.1)

```
valor = (2p − 1) × DPR_da_criatura × rodadas ÷ unidade
```

`p` = chance de ela agir a seu favor. **Abaixo de p = 0,5 o valor é negativo** — o
conjurador está pagando para ajudar o inimigo. Por isso a Disposição **cai** conforme o CA
sobe: a resposta melhor é a menos sua. Ao criar invocável novo, gere a Disposição base na
escada existente (5 → 4 → 4 → 3 → 2) e não invente número fora dela.

### Carimbo v3 da escada que já está no banco

Recomputado com a fórmula desta seção (defensor Defesa 1, Blindagem 2, unidade 3,90):

| Criatura | Alvo | Dano | Vit | P | líq | DPR | força | alvo do projeto |
|---|---|---|---|---|---|---|---|---|
| Fantoche | 5 | 1d4 | 6 | 0,40 | 1,0 | 0,40 | 0,10× | 0,15× |
| Corvo | 5 | 1d4 | 6 | 0,40 | 1,0 | 0,40 | 0,10× | 0,10× |
| Serpente | 6 | 1d4+1 | 8 | 0,50 | 1,5 | 0,75 | 0,19× | 0,35× ¹ |
| Lobo / Servo Reanimado | 6 | 1d6+3 | 12 / 15 | 0,50 | 4,5 | 2,25 | 0,58× | 0,6× |
| Urso | 5 | 1d8+4 | 18 | 0,40 | 6,5 | 2,60 | 0,67× | 0,67× |
| Cria Menor do Véu | 7 | 1d8+4 | 12 | 0,60 | 6,5 | 3,90 | **1,00×** | 1,0× |
| Cria da Fenda | 8 | 1d10+5 | 18 | 0,70 | 8,5 | 5,95 | 1,53× | 1,5× |
| Horror Rastejante | 9 | 1d10+6 | 24 | 0,80 | 9,5 | 7,60 | 1,95× | 2,0× |
| Horror Maior | 10 | 1d12+6 | 30 | 0,80 ² | 10,5 | 8,40 | 2,15× | 2,5× |
| Entidade da Oitava | 11 | 1d12+8 | 36 | 0,80 ² | 12,5 | 10,00 | 2,56× | 3,0× |

¹ a diferença é o Toxis 1 da mordida, que a conta de DPR puro não vê.
² Alvo preso em 9; o resto vira Transbordo (+1 e +2), que a conta também não vê.

**Use esta tabela como âncora.** Criatura nova entra entre duas linhas dela ou justifica
por que sai. As fichas foram calibradas na base velha (3,445, com convolução de defesa) e
sobrevivem à recomputação em v3 — não as recalibre sem pedir.

## 2b. Poder — o segundo medidor

A ficha de NPC calcula **⚡ Poder = EXP Total**: a somatória do custo em EXP de tudo que o
NPC tem. Aparece no selo do card, no cabeçalho do modal e ordena a lista.
Motor em [npc-poder.js](painel-mestre/js/npc-poder.js) — as fórmulas são as mesmas da ficha
de personagem, e se o custo mudar lá, muda aqui.

```
atributo nível N   custo acumulado = 5 × N(N+1)/2          (degrau N custa 5N)
perícia nível N    custo acumulado = custoEvolucao × N(N+1)/2   (custoEvolucao padrão 4)
peculiaridade      soma progressao[i].custoExp, degrau a degrau
                   mecânica com progressaoTipoExp: 'ganho' é desvantagem — entra NEGATIVA
item de módulo     custoExpProprio do pré-cadastro, senão custoExpPorItem do módulo
```

| Nível | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---|---|---|---|---|---|---|---|---|
| Atributo (acum.) | 5 | 15 | 30 | 50 | 75 | 105 | 140 | 180 | 225 |
| Perícia 4 (acum.) | 4 | 12 | 24 | 40 | 60 | 84 | 112 | 144 | 180 |

**Poder é a segunda leitura, não a mesma.** Força em × guerreiro mede o que a criatura
**entrega**; Poder mede o que a ficha **custou**. As duas têm que ser reportadas juntas —
divergência entre elas é informação de design, não erro.

**Três buracos por onde a ficha fica forte sem pagar Poder.** Os três fazem o número
mentir, e é você que tem que avisar:

1. **Inventário e equipamento não entram.** Só itens de Módulo de Classe contam.
2. **`valoresDer.overrides` não entra.** Travar VIT em 60 na mão não custa 1 EXP.
3. **Peculiaridade personalizada (`refId: null`) não entra.** Sem registro, custo 0 —
   uma criatura montada em `nomeCustom` tem Poder artificialmente baixo.

**Desvantagem rende EXP.** Peculiaridade cuja mecânica tem `progressaoTipoExp: 'ganho'`
entra negativa. É a alavanca legítima para uma fera poderosa custar menos Poder: cegueira,
lentidão, dependência, fraqueza a um canal. Use isso em vez de simplesmente não cadastrar
o que ela tem.

### Poder → Grau → teto de Fio

A faixa de Poder é a mesma escada do equipamento (ver o skill **balancear-item**), e vale
para criatura igual vale para personagem:

| Grau | Poder (EXP Total) | Fio | Teto de Fio equipado |
|---|---|---|---|
| 1 — Inicial | até 500 | 0 | 0 |
| 2 — Veterano | 500–850 | +1 | 1 |
| 3 — Mestre | 850–1300 | +2 | 2 |
| 4 — Lendário | 1300–1800 | +3 | 3 |
| 5 — Relíquia | 1800+ | +4 | 4 |

> **A soma de TODO Fio de dano da criatura — todos os canais, arma natural, peçonha, sopro
> — não pode passar do Fio da faixa de Poder dela.**

Uma fera de Poder 400 que respira fogo por +2 e morde por +2 está gastando 4 Fios numa
faixa que só comporta 0. Ou a ficha sobe de Poder, ou os canais descem.

### Calibração — Poder das criaturas de cânone

Calculado com as fórmulas acima sobre os atributos gravados em
[cadastrar-criaturas-invocaveis.mjs](functions/cadastrar-criaturas-invocaveis.mjs). Essas
fichas foram cadastradas em modo rápido, **sem perícia, peculiaridade ou módulo** — logo o
Poder delas é só atributo, e é o piso. Ficha equivalente com perícias sobe bastante.

| Criatura | força | Poder | Grau | força por 100 de Poder |
|---|---|---|---|---|
| Fantoche | 0,10× | 50 | 1 | 0,20 |
| Corvo | 0,10× | 160 | 1 | 0,06 |
| Serpente | 0,19× | 170 | 1 | 0,11 |
| Servo Reanimado | 0,58× | 165 | 1 | 0,35 |
| Lobo | 0,58× | 195 | 1 | 0,30 |
| Urso | 0,67× | 265 | 1 | 0,25 |
| Cria Menor do Véu | 1,00× | 190 | 1 | **0,53** |
| Cria da Fenda | 1,53× | 290 | 1 | **0,53** |
| Horror Rastejante | 1,95× | 435 | 1 | 0,45 |
| Horror Maior | 2,15× | 625 | 2 | 0,34 |
| Entidade da Oitava | 2,56× | 935 | 3 | 0,27 |

**O que essa coluna ensina.** A eficiência **cai** conforme a criatura sobe — 0,53 na base
da escada abissal, 0,27 no topo. Não é desequilíbrio: atributo custa quadrático e o DPR
cresce quase linear, então poder puro fica cada vez mais caro. Esperado e desejado.

Faixas de leitura:

- **0,45 a 0,55** — ficha de combate enxuta. Todo EXP virou golpe.
- **0,25 a 0,45** — normal. Paga alguma resistência, algum sentido, alguma utilidade.
- **abaixo de 0,25** — a ficha compra algo fora do combate. Legítimo (o Corvo é olheiro, a
  Serpente é peçonha e silêncio), mas **diga o quê**. Se não souber dizer, é EXP torrado em
  atributo que nunca aparece na mesa — corte.
- **acima de 0,6** — mais letal do que custou. Confira Alvo e dado antes de gravar.

Repare no par Urso (0,67× por 265) contra Cria Menor (1,00× por 190): a fera terrena paga
VIG e AUT que não viram DPR. Isso é correto — ela aguenta e obedece —, mas explica por que
comparar só por Poder engana, e comparar só por força também.

**Não confunda com o Poder do Eco.** O Eco da Alma tem um "Poder" próprio, que é a **PRS da
ficha** numa escala de 1 a 10 (Régua §9.9), usada no redutor da Supressão e no custo da
projeção. É outro número, outra escala, e não tem relação com o ⚡ Poder desta seção.

## 3. Fisiologia → números

O corpo não é enfeite: ele **é** a ficha. Cada decisão anatômica sai num campo.

| Decisão de biologia | Onde aparece |
|---|---|
| Massa e envergadura | `porte`, `tamanho` → Vitalidade |
| Couro, escama, quitina, osso externo | Blindagem natural |
| Locomoção (patas, voo, rastejo, natação) | `DESLOCAMENTO`, partes do corpo |
| Arma natural (presa, garra, chifre, ferrão, peçonha) | `ataques`, dado e bônus |
| Sentido dominante (visão, olfato, calor, som, vibração) | Percepção, peculiaridade |
| Metabolismo e dieta | `criatura.dieta`, ritmo de caça, fôlego |
| Ciclo de vida e reprodução | população, se a mesa pode encontrar ninho |

**Vitalidade.** `VIT = (VIG + Tamanho) × 3`, com `Tamanho = Altura × 3`. O motor entrega o
valor quebrado e a mesa **arredonda para cima só na exibição** — o cálculo por trás segue
fracionário, e é ele que as mecânicas seguintes leem. Vale para Vitalidade, Sanidade e
Energia.

Bicho grande é o vetor mais rápido de inflar Vitalidade sem perceber. Confira contra a
escada: um chefe de 2,5× que também tem 60 de Vitalidade dura 15 rodadas e quebra o
invariante pelo outro lado.

**Lei do cubo-quadrado.** Dobrar a altura multiplica a massa por 8 e a seção do osso por 4.
Criatura Enorme ou Colossal precisa de resposta explícita: osso oco, membro-coluna,
flutuação, sustentação mágica, ou vida aquática. Sem isso ela não é biologia — é escala de
miniatura, e a mesa percebe.

**Blindagem natural.** Segue a mesma régua da armadura: **por slot coberto, nunca por
item**. Taxas do Grau 1 — Leve 0,20 · Média 0,22 · Pesada 0,30 por slot; ×1,35 a cada Grau.
Blindagem é fracionária de ponta a ponta, 2 casas, sem arredondar. Couro de fera raramente
passa de Média; quitina e placa óssea entram como Pesada e devem custar mobilidade em algum
lugar (Deslocamento menor, DES baixa, ponto cego). Para a régua completa de proteção, use
o skill **balancear-item**.

**Anatomia customizada.** Criatura não precisa da anatomia humanoide. Monte `partesDoCorpo`
com o que o corpo tem — Cauda, Asa, Tentáculo, Carapaça — usando ids do catálogo
`bodyParts` quando existirem. Referência humana: 11 partes, 21 slots, **15 protegíveis**.
Cada parte declara `slots`, `podeSegurar`, `podeEmpunhar`, `podeVestir`, `podeFixar`. Um
bicho sem mão não empunha nada, e é isso que o campo diz.

**Fórmulas de apoio no modo rápido.** O padrão gravado pelos scripts de cânone:
`INI = DES + RAC` · `REA = min(DES, RAC) + 1` · `PERC` conforme o sentido dominante. No modo
mecânico o motor calcula sozinho — **não grave override sem motivo**, porque override
congela o número e cala o motor.

## 4. O método folclórico

Estatística não assusta. O que assusta é a criatura ter regra própria de mundo.

Toda criatura entregue por este skill traz:

1. **O sinal.** O que acontece antes dela chegar — o gado que emudece, a névoa que desce
   contra o vento, o cheiro de cobre. O grupo tem uma rodada para entender.
2. **A regra.** Uma coisa que ela sempre faz ou nunca faz, e que a mesa pode explorar: não
   cruza água corrente, precisa ser convidada, conta os grãos que caem, solta a presa se
   ouvir o próprio nome.
3. **O remédio do camponês.** Meio certo, meio superstição. Parte funciona; a parte que não
   funciona é onde o grupo se ferra por confiar demais.
4. **A moral local.** De que medo ela nasceu — fome, parto, dívida, floresta, o vizinho. É o
   que a diferencia de um saco de Vitalidade com garras.

**Não copie bestiário de outro sistema.** Se o pedido vier com nome de fora ("cria um
troll"), traduza para a fisiologia e o folclore de Vasteluna/Reliera: que povo teme, que
nome dá, o que já tentou contra. Nome, sinal e remédio saem daí.

## 5. Ecologia — a criatura mora em algum lugar

Antes de gravar, responda em uma linha cada:

- **Nicho.** Predador de topo, mesopredador, carniceiro, herbívoro perigoso, parasita,
  necrófago, magífago. Um mapa só sustenta um predador de topo por região.
- **O que ela come, e o que come ela.** Sem presa declarada, ela não tem população.
- **Densidade.** Solitária, par, matilha (quantos), enxame. Isso decide o encontro: quatro
  criaturas de 0,6× e uma de 2,4× são orçamentos iguais e cenas opostas.
- **Habitat.** Um lugar que existe no Worldbuilding. Confira no banco antes de escrever.
- **Sazonalidade.** Quando aparece, e por quê — cio, fome, seca, lua, rito.

**Orçamento de encontro.** Some a força de todos os inimigos e compare com o número de PJs.
Grupo de 4 contra 4,0× é combate pareado (4–5 rodadas). Acima de 6,0× é fuga ou armadilha,
não luta — e o texto do encontro precisa dizer isso.

## 6. A ficha no banco

Coleção `npcs`, `schemaVersion: 2`. O schema completo e comentado vive em
[area-npcs.js](painel-mestre/js/area-npcs.js:2714) — leia de lá antes de montar JSON.
O que importa para criatura:

| Campo | Valor |
|---|---|
| `tipo` | `'criatura'` (ou `'npc'` / `'eco'`) |
| `modoFicha` | `'mecanico'` (referências ao catálogo) ou `'rapido'` (texto livre) |
| `porte` | `Minúsculo` · `Pequeno` · `Médio` · `Grande` · `Enorme` · `Colossal` |
| `tamanho` | numérico — entra na Vitalidade |
| `atributos` | os 9: FOR DES VIG INT RAC PRS PRE MAN AUT |
| `valoresDer` | mecânico: `{overrides, atual, extras, vinculados}` · rápido: chaves diretas `VIT/SAN/ENER/PERC/INI/REA/BLD/DESLOCAMENTO` |
| `ataques` | texto: `Ataque natural (A. Padrão): Alvo N, XdY+Z.` |
| `partesDoCorpo` | anatomia; ids do catálogo `bodyParts` ou custom |
| `periciasEstruturadas` | `[{refId, nivel}]` — busque o id por nome, não hardcode |
| `peculiaridades` | `[{refId, nivel, fonte}]` ou `{refId:null, nomeCustom, efeitoManual, nivel}` |
| `criatura` | `{habitat, comportamento, dieta, nivelAmeaca}` |
| `visibilidade` | `'secreto'` (padrão) ou `'publico'` |
| `mesaId` / `vinculos` | **`''` e `[]` em NPC-modelo de sistema** — nenhuma mesa é dona |
| `aliadoProprio` | `true` só em companheiro de jogador |
| `ai` | número — a "AI da criatura" do Laço de Nome |

**⚡ Poder não é campo.** Ele é derivado da ficha a cada carga da lista e do modal — não
existe no documento, não se digita e não se grava. Para mudar o Poder de uma criatura,
mude o que ele soma: atributo, perícia, peculiaridade de registro, item de módulo.

**Formato do `nivelAmeaca`.** O campo carrega a linha inteira, nesta ordem, e o **Grau tem
de ser o primeiro segmento**:

```
Grau · força× · densidade · eixo de obediência · doma · nota
```

O filtro avançado do Painel lê exatamente esse primeiro segmento (sem acento, minúsculo)
contra `Inofensiva | Praga | Comum | Séria | Grave | Calamidade` — corrigido em 31/08/2026,
junto com o carimbo das sete que estavam na notação velha de CA. Carimbo que não começa pelo
Grau some do filtro, em silêncio.

**Os três eixos de obediência.** Toda criatura vinculável declara o seu:
Disposição 0–10 (invocadas; gerada em segredo pelo Mestre, o Laço de Nome move ±1) ·
Lealdade 0–10 (feras de vínculo; sobe por convivência, nunca por Luns) ·
sem eixo (erguidos: executam a última ordem até cair).

## 7. Cadastro — como gravar

Script novo em `functions/`, no padrão do
[cadastrar-criaturas-invocaveis.mjs](functions/cadastrar-criaturas-invocaveis.mjs):

```js
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
  require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');
```

Ordem obrigatória, e nenhum passo é opcional:

1. **Asserts de régua antes de tocar no banco.** Calcule a força de cada criatura e
   `assert` contra o alvo do projeto (±12% é a tolerância usada no cânone). Script que não
   trava sozinho quando o número foge não serve.
2. **Conferências de colisão.** Nome já existe em `npcs`? Perícia, VD, condição e item
   citados existem? Habitat existe no Worldbuilding? Junte tudo em `erros[]` e **aborte com
   exit 1** listando o que faltou — não grave metade.
3. **Dry-run imprime a tabela completa** — nome, Alvo, dano, Vit, Bld, DPR, × guerreiro,
   **Poder e força por 100 de Poder**, rodadas para derrubar. O Poder do dry-run tem que
   bater com o selo ⚡ que o Painel vai mostrar depois; se não bater, o script está somando
   o que a ficha não soma (ou o contrário) e a régua está medindo outra coisa.
4. **`--apply` só depois de aprovação explícita.** Grave em `batch`.

Nunca escreva na coleção sem dry-run antes. Nunca mexa em criatura com `mesaId` preenchido
sem perguntar — aquela fera é de uma mesa em andamento.

## 8. O verbete no Bestiário

O livro é `book_mrs9ur4aw1m6a`; capítulos ficam em `worldbuilding-articles` com `bookId`,
`title`, `synopsis`, `contentHTML`, `order`, `status`, `public`, `words`. Copie a forma dos
capítulos existentes e **não vire o `public` sem perguntar**.

O verbete organiza por **o que move a criatura**, não por tipo — é assim que o livro já está
montado (As Respostas do Abismo · Os Erguidos · Companheiros e Feras Domáveis · Predadores).
Um verbete traz, nesta ordem:

1. Abertura curta com o sinal e o folclore — o que os locais dizem, antes do que é verdade.
2. Tabela de mesa: Alvo, dano, Vitalidade, Blindagem, Deslocamento, eixo de obediência.
3. A regra e o remédio — o que a mesa pode explorar.
4. Doma e vínculo, quando cabe: Redutor, Lealdade mínima, melhorias pré-gastas.
5. Uma frase do que os números querem dizer ("1,0× guerreiro" = uma rodada de espada).

Antes de fechar `contentHTML`, confira que todas as tags abrem e fecham — os scripts de
livro do projeto abortam por contagem desbalanceada, e é para continuar assim.

## 9. Refs em mecânica: o prefixo é obrigatório

Ao escrever mecânica que leia perícia, use **`"Perícia: X"`**, nunca o nome puro. Oito nomes
são perícia **e** valor derivado ao mesmo tempo (`Abismancia`, `Alquimancia`, `Contracanto`,
`Dosagem`, `Ecos do Vazio`, `Empatia Sanguínea`, `Exorcismo`, `Vozes do Túmulo`). Sem o
prefixo, o motor casa com o VD homônimo e lê o número errado **em silêncio**.

## 10. O que sempre reportar

Ao entregar uma criatura, mostre:

1. **A conta** — P, líquido, DPR, força em × guerreiro, e a base declarada (3,90).
2. **O Poder** — EXP Total, a faixa de Grau em que ele cai, o teto de Fio que essa faixa
   permite, e a força por 100 de Poder contra as faixas do §2b. Se o número depender de
   override, de item de inventário ou de peculiaridade sem registro, diga — nesses três
   casos o Poder mente para baixo.
3. **As duas durações** — rodadas para o grupo derrubá-la, rodadas para ela derrubar um PJ.
   Se qualquer uma sair de 3–10, diga e proponha o ajuste.
4. **A leitura de corpo** — o que a anatomia explica, e o que ficou sem explicação
   fisiológica.
5. **O eixo de obediência** e, se domável, Redutor e Lealdade mínima.
6. **O nicho** — o que come, o que a come, densidade, habitat conferido no banco.
7. **O que ficou de fora** — Transbordo não contado, peçonha ou condição fora do DPR,
   cobertura de Blindagem não declarada, verbete não escrito.
