---
name: peculiaridades-avulsas-rebalanceadas
description: Rebalanceamento de 02/08/2026 das 28 Peculiaridades Avulsas + teto de EXP de desvantagens no wizard
metadata: 
  node_type: memory
  type: project
  originSessionId: ebc60805-71e3-4c2f-9276-ac72252ea9e0
  modified: 2026-08-05T17:57:09.176Z
---

Em **02/08/2026** as 28 Peculiaridades Avulsas foram reprecificadas contra a régua de
[[economia-de-exp-da-mesa]]. Rodado por `functions/rebalancear-avulsas.mjs` (idempotente;
roda sem flag = dry-run, `--aplicar` grava e deixa backup `functions/_backup-avulsas-*.json`).

**Os três defeitos estruturais que motivaram o passe:**
1. **Vantagens grátis.** Hipermóvel, Sono Leve e Teimoso tinham `mecanicaExpCriacao: []`
   → nível 1 custava 0. Hipermóvel Nv1 dava **+2 situacional** de graça, o maior número
   de nível 1 da lista inteira.
2. **Desvantagens que não pagavam.** Albino e Vegetariano rendiam 0 EXP; Cicatriz
   Notável, Corpulento e Glutão eram evolutivas inteiramente a 0 e ainda com
   `progressaoTipoExp: 'custo'` — apareciam na coluna 🔴 "concedem EXP" sem conceder nada.
3. **Escadas geométricas sobre valor côncavo.** Preços 4→8→12 e 8→12→30 sobre níveis que
   entregam cada vez menos (vários nem mudam de número). Sortudo era o caso extremo:
   Nv1 por 8 (a compra mais eficiente do jogo) e Nv3 por 30 (a pior). Agora **14/14/8**.

**Sem teto, reprecificar desvantagem corretamente piora tudo:** com os preços justos, pegar
todas renderia ~160 EXP contra os ~62 da EXP Inicial. Por isso entrou
`TETO_GANHO_DESVANTAGENS = 20` em `criar-personagem/js/exp-tracker.js` (≈5 sessões de jogo),
aplicado em `getTotal()` e `calcExpTotal()`, só sobre as fontes `pec_` positivas —
`inherited_pec_` (raça/classe/tribo) fica de fora porque não é escolha livre.
Regressão em `criar-personagem/js/teto-desvantagens.test.mjs`.
O `REGRAS_CRIACAO.peculiaridades_individuais` de `criar-personagem/js/data.js`
(2 grátis + ±10 por extra) **é config morta** — nunca foi lida por lugar nenhum.

**03/08/2026 — Gigantismo e Nanismo foram até o Nv5** (±40% e ±50% de Altura), por
`functions/gigantismo-nanismo-nv5.mjs`. Escada de EXP **8/8/8/10/12**: sobe a partir do
Nv4 porque a cascata continua linear mas a penalidade narrativa satura no Nv3 (já não
dá para ser furtivo nem montar). Justificativa da ordem de grandeza: VIG 3→5 custa
45 EXP por +6 de Vitalidade; Gigantismo Nv5 custa 46 por **+7,65** mais Carga,
Deslocamento e D.Vertical — mesmo a 46 o pacote ganha do atributo, e é a penalidade
narrativa que paga a diferença. Dois achados do Nv5:
- **Nanismo Nv5 tem breakpoint de Carga.** Carga = Peso × (0,2 + 0,1×FOR). Com FOR 2
  sobram 6,36 kg — Armadura Completa (5) + Espada Bastarda (2) não cabem. Só é jogável
  com FOR 4+, o que é contraintuitivo e está avisado na descrição do nível.
- **As mecânicas `NANISMO — D.Vertical` não fazem nada** para quem tem D.Vertical 0
  (quase todo mundo): o simulador não acusa mudança em nível nenhum.

**Teto subiu para 30** (o usuário aprovou): paga o Nanismo até quase o Nv4 e deixa o Nv5
como escolha explícita de sabor. Um teto de EXP sozinho já resolve o empilhamento —
limite de *contagem* de desvantagens seria knob redundante e continua não implementado.

**03/08/2026 — quatro extensões de nível**, por `functions/avulsas-extensoes-niveis.mjs`:
Corpulento 3→5 (Peso ×1,8/×2,0), Manco 2→4 (D.Terr até −5), Franzino 3→4 (Peso ×0,45 —
**parou no 4 de propósito**, ×0,35 cairia no beco de Carga do Nanismo Nv5) e Caolho
1→3 níveis (a mecânica de VD virou evolutiva, −1/−2/−3, e ganhou uma narrativa irmã
"Caolho (Níveis)"). **Resistente à Dor** foi de 2/4/4 para **12/8/7** agora que a escada
de ferimento existe no Cap. 6. Dois saturamentos achados na verificação:
- **`Percepção Visual` não tem piso.** = RAC + Perícia: Observação; Caolho Nv3 leva o
  personagem de referência (RAC 2, sem Observação) a **−1**.
- **`CORPULENTO — D.Aquático` satura em 0 no Nv3** — os termos de Nv4/Nv5 não fazem nada.
  Mesmo caso das mecânicas `NANISMO — D.Vertical`.

**Bug corrigido de passagem:** Caolho não tinha `Percepção Visual` em `derivedValueIds`
e o VD é `todoPersonagem: false` — a mecânica calculava mas **o campo não aparecia na
ficha**. Ao criar avulsa que mexe em VD raro, conferir sempre as duas pontas.

**Conferência de integridade:** `functions/audit-niveis-avulsas.mjs` replica o
`_resolvePeculiaridade` e acusa os dois jeitos silenciosos de quebrar um nível novo —
`nivelMaximo` divergente entre mecânicas irmãs (o `Math.max` vence e a atrasada aplica a
equação BASE naquele nível) e `progressao` faltando dentro do `nivelMax`. Rodar sempre
depois de mexer em nível de avulsa.

**São 32 avulsas, não 28.** As quatro `Domínio de …` (Armas de Braço, Armas de Precisão,
Disparo, Proteção) entraram em 04/08/2026 com o CAP de itens, custam 12 EXP fixos, 1 nível,
e **nunca passaram por auditoria numérica** — elas removem o teto de atributo sobre o bônus
de Ofício/Blindagem da peça, então o valor cresce junto com o equipamento por um preço fixo.

**05/08/2026 — os ajustes de design fecharam** (`functions/avulsas-ajustes-design.mjs`):
Cicatriz Notável trocou o −1 permanente em Diplomacia/Sedução por **Desvantagem** e virou
+4/+4/+6; Roncador passou a penalizar o **próprio** descanso em vez do dos aliados;
Veterano de Guerra corrigiu a Iniciativa +1/**+1**/+3 → +1/+2/+3; `Percepção` ganhou piso 0.
A lição da Cicatriz vale para qualquer desvantagem futura: **subtrair ponto de perícia é
grátis para quem dumpa a perícia** — o piso do Alvo 1 protege o min-maxer. Desvantagem
(2d10 pior) é proporcional e cobra ~80% relativos de todo mundo, inclusive dele.

**Não apagar** `NANISMO — D.Vertical` nem `CORPULENTO — D.Aquático` (Nv4-5): são inertes
só para quem parte de 0/baixo. Numa raça aquática ou com deslocamento vertical elas mordem.

**Duas coisas ficaram sinalizadas, não resolvidas:**
- **Resistente à Dor** promete "ignora o redutor do Nº nível de condição por VIT baixa/dor",
  mas **essa escada de redutor não existe no Livro de Regras v1.7**. Foi precificada só pelo
  que está escrito (+1/+2/+3 situacional em VIG). Se a regra for escrita, o preço justo do
  Nv1 sobe de 2 para ~12.
- **Cicatriz Notável** inverte de sinal ao longo dos níveis (Nv1-2 são vantagem leve, o Nv3
  aplica −1 permanente em Diplomacia e Sedução). Como `progressaoTipoExp` tem que ser
  uniforme na peculiaridade inteira, ficou 0/0/+12 como ganho — o Nv1 continua sendo um
  +1 situacional de Intimidação de graça.
