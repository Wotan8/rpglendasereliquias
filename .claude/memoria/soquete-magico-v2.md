---
name: soquete-magico-v2
description: "Decisões fechadas do balanceamento das classes mágicas na v2 — régua de dado por barreira, Transbordo de Dano e Blindagem Arcana." (v2: só Blindagem Arcana e Transbordo seguem)
metadata: 
  node_type: memory
  type: project
  originSessionId: 4a0b7acd-a10c-4f7d-bdc0-f0b5b7338c8b
  modified: 2026-08-16T11:50:47.083Z
---

> **Núcleo v2 (04/09/2026):** ficou a Blindagem Arcana (só ela barra dano de Essência) e o Transbordo; a régua de dado por barreira e os canais tipados saíram com a Blindagem tipada.
Decidido e **implementado por inteiro** (scripts `functions/soquete-1..8-*.mjs`):
CA do Invocador, 6 testes do Sangral, `atributoChave` das 11 classes, Teto+Domínio das 6
escolas com foco, 20 focos vinculados ao Acerto Mágico, campos tipados de mira
(alcance/área/alvos/duração, passos 7 e 7b) e condições tipadas com portão único
(passo 8). A régua de dado por barreira e o Transbordo de Dano estão gravados no
livro técnico (Régua de Balanceamento §2.1 e §2.2) — **está valendo**, não é pendência.
Magia espelha o soquete
de arma (`Acerto Mágico = atributo mental + Perícia: <escola> + Acerto`), não é
subsistema novo. Ver [[progressao-grau-e-fio]] e [[evitar-mecanica-vinculada-a-item]].

**Régua de dado por barreira** — cada ponto de Blindagem que a magia pula custa um
passo de dado. Por 1 Energia: físico geral 1d8 (vs Blindagem 2) · físico tipado 1d6
(vs ~1) · Essência tipada 1d4 (vs Blindagem Arcana 0). Os três dão 6,5 líquido. A
régua se autocorrige quando a BA entrar no catálogo. Magia nem sempre é dano arcano:
pedra arremessada com Essência de Terra é dano físico; gravidade com a mesma Essência
é arcano. Bater em Blindagem Física é sempre mais barato.

**Transbordo de Dano** — `Alvo − 9, mínimo 0`, número fixo impresso na ficha, soma em
todo golpe que acerta. É o Alvo, não a rolagem. A Qualidade do foco vai para Acerto
Mágico (não para dano), e o Transbordo é o que a impede de saturar. Calibrado em +25%
sobre a arma no Q5 — aprovado nesse patamar.

**Blindagem Arcana** — um número só, nunca tipada; usa os marcadores ▼ fraco / ▲
resiste para divergência. É poça de redução gasta **uma vez por golpe**, da maior
parcela para a menor. Sem isso, espalhar dano em parcelas pequenas rende o dobro.

**Custo** — Energia (`= PRS + AUT`, pool ~7) + um recurso próprio da escola. Faixa
útil 1–3 Energia; acima disso o mago desperdiça pool. Referência: 1 Energia ≈ 1d8.

**CA do Invocador** (`Conexão com Abismo`) — `⌊Perícia: Abismancia ÷ 2⌋ + valorDeMesa(10 ×
fração de Sanidade perdida)`. Arredondamento é o do motor (`dvValorDeMesa` em
derived-values.js, Livro §5.4): para baixo, mínimo 1 se maior que zero. Cada ritual tem
CA mínimo de 2 a 8; gastar Sanidade sobe o CA, então a classe é catraca de mão única
dentro da sessão. `Perícia: Resiliência` é armadilha: entra em Sanidade Máxima e só
atrasa o CA.

**Fraqueza N** — divide o dano por 2^N, arredonda **para baixo**, mínimo 1. Contra alvo
abissal: Abissal 0 · Luz 0 (de igual pra igual) · toda outra Essência 1 · físico 1.
Criatura abissal precisa de ~metade da Vitalidade de uma ameaça equivalente. Em efeito
não numérico, fraqueza N vale −N no Alvo do teste.

**Eixo real** — nenhuma classe mágica é nuker (só o Sangral bate de frente, e com dano
**físico**, porque sangue é matéria). O Invocador não tem **nenhum** ritual de dano — os
9 são invocar, selar, ocultar, dominar, abrir plano, teleportar, fechar fenda e anular
evento. Medir essas classes por DPR é lente errada. Runimago fica por último: é
tecnologia, não magia, e toca 6 das 13 Essências.
