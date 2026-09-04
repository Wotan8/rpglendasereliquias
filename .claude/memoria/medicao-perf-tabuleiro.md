---
name: medicao-perf-tabuleiro
description: Como medir desempenho do Tabuleiro por etapa — ?perf=1 no aparelho real e __check-perf-arrasto.html com a carga da mesa Bugigangas.
metadata: 
  node_type: memory
  type: project
  originSessionId: 1afeec03-045a-48ac-817d-4da4a8756a26
  modified: 2026-07-30T02:57:06.941Z
---

O Tabuleiro tem medição por etapa embutida (2026-07-29): abrir o tabuleiro com
`?perf=1` na URL liga um HUD no canto (ms/s por etapa: frame, base, objetos,
fog, fog.polys, fog.compor, overlay, regua, pointermove) — serve para perfilar
NO CELULAR do jogador. A infraestrutura é `MEDIR`/`medir()` em `tabuleiro/js/tab-perf.js`.

`tabuleiro/__check-perf-arrasto.html` reproduz a carga do canvas "Tabuleiro 1"
da mesa Bugigangas (134 objetos, 78 paredes, 11 luzes, 3 visões) e roda benches
de frame parado, pan, raycast forçado e arrasto real com PointerEvents. Usa
`setTimeout(16)` no lugar de rAF porque o pane/aba oculto congela rAF. Cuidado:
o boot do tab-main roda no DOMContentLoaded e zera `T.mesaId`/`T.mode` — o
harness espera e restaura.

Números de referência (desktop, 2026-07-29, pós-otimização): frame de arrasto
~0,6 ms; passo da visão ~0,8 ms (só a fonte que se move recalcula — memo por
fonte em `criarMemoPorVersao`); fog composto em MEIA resolução (`FOG_ESCALA`
em tab-render.js). Antes: mover 1 token recalculava as 14 fontes e o compose
tinha picos de 13 ms até no desktop.

Armadilha descoberta ao vivo (2026-07-29): o save da exploração (fog
persistente) grava no DOC DO CANVAS, e o snapshot desse doc tratava qualquer
mudança como mudança de configuração — invalidava mapa, hash de paredes, fog e
painéis em todos os aparelhos, a cada ~3s de arrasto público (era o "token
remoto congela por segundos"). Regra desde então: mudança só de `exploracao`
NÃO passa por `notifyCanvasConfigChange` (ver `configDoCanvasMudou` em
tab-state.js), o save espera `T.dragAtivo` soltar, e eco idêntico
(`EXP.ultimoB64`) não faz merge.

Relacionadas: [[fontes-da-campanha-reliera]]
