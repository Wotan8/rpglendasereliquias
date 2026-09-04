---
name: responsivo-sempre
description: Toda mudança visual no site tem que nascer responsiva (celular + PC) e clicável por toque — não é refinamento posterior.
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 26a18119-ad2a-43ed-8f5e-1c11b3c11290
  modified: 2026-08-14T14:51:25.869Z
---

Toda implementação ou modificação que altere o visual de qualquer página do site
precisa ser responsiva desde a primeira entrega: se adaptar a tela de celular e
de PC, e ter todo controle funcional tanto para clique quanto para toque. Em tela
pequena, TUDO encolhe junto — fonte, ícone, espaçamento, padding, largura de
coluna —, não só o número de colunas.

**Why:** o usuário usa o site no celular de verdade, em mesa. Entregar só a
versão de desktop significa entregar quebrado: em 14/08/2026 a aba Dashboard do
Painel de Criador foi entregue "pronta" e no celular aparecia cortada na
horizontal. Ele considera isso parte do trabalho, não um polimento opcional —
não precisa pedir.

**How to apply:** antes de dar a tarefa por terminada, checar o layout em largura
de celular (~375–412px) e em desktop. Nada pode causar rolagem horizontal da
página. Alvo de toque nunca menor que ~40px. Ver [[medicao-perf-tabuleiro]] para
como abrir uma página do projeto em harness de teste.
