---
name: task-sentidos-tags-tabuleiro
description: Frente proposta (31/08/2026) para fazer sentidos e visões especiais funcionarem no VTT via tags com potência; brief em TASK-SENTIDOS-E-TAGS-TABULEIRO.md.
metadata:
  type: project
---

> O documento da task foi para `historico/TASK-SENTIDOS-E-TAGS-TABULEIRO.md` (04/09/2026).
Ideia do usuário, ainda **não implementada**, escrita como brief para outro chat em `TASK-SENTIDOS-E-TAGS-TABULEIRO.md` na raiz do repo. Explicitamente aberta a proposta melhor — o problema é fixo, a solução não.

**O problema:** magia de sentido é texto na ficha e o Tabuleiro não sabe que existe. `SENSORES` em `tabuleiro/js/tab-fog.js:27` são 5 ids **hardcoded** e `tokenVisivelParaMim()` decide por `if` de id — viola [[nunca-hardcodear-regra-de-jogo]].

**A ideia:** objetos do Tabuleiro carregam tags com **cor** e **potência**; a skill declara quais tags enxerga; ao ativar, os objetos brilham na cor da tag e na intensidade da potência. Tokens orgânicos nascem com `Essência de Vida` + `Essência de Sangue` por padrão (senão a mesa teria de taguear NPC à mão e a função morre no primeiro uso). Campos propostos na skill: `sentido.tagsQueVe`, `alcanceM`, `atravessaParede`, `exigeLuz`, `potenciaMinima`, `duracao`.

`potenciaMinima` é o parafuso de balanceamento — visão de tier baixo vê só o que brilha forte.

O caso que puxou isso: a **Visão Hemática** do Sangral, que em 31/08 passou a ver criaturas atrás de parede (ver [[frente-dominio-e-magia]]). `tremorsense` já é precedente de `atravessaParede`.

Armadilha registrada no próprio código: `tokenVisivelParaMim` já roda por token a cada quadro testando ponto-em-polígono, com 3 telas pagando — somar varredura de tags por quadro trava a mesa cheia. Ver [[medicao-perf-tabuleiro]].
