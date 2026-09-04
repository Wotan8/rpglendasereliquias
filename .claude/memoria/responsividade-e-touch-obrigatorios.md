---
name: responsividade-e-touch-obrigatorios
description: Regra do usuário — NUNCA entregar nada no projeto sem garantir responsividade e funcionamento em touch/celular.
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 3d04bff0-0ee5-4d37-b080-89576700d7e6
  modified: 2026-08-11T11:28:19.826Z
---

Nunca entregar funcionalidade neste projeto sem garantir responsividade E
funcionamento em touch (celular mediano é o hardware-alvo declarado do
Tabuleiro, e vale para o projeto todo).

**Why:** entreguei arrastar-e-soltar do inventário da janela de ficha de
combate com HTML5 drag-and-drop, que não dispara em touch — o recurso
principal do pedido não funcionava no aparelho-alvo. O usuário devolveu:
"nunca faça algo nesse projeto sem garantir a responsividade".

**How to apply:** interação de arrasto = pointer events (pointerdown/move/up
+ setPointerCapture + touch-action), nunca dragstart/drop do HTML5. Janelas e
painéis novos: testar/clampar dentro do viewport móvel (94vw, alturas em vh,
reclampar no resize). Antes de fechar entrega, perguntar "isso roda no
celular?" para CADA interação nova, não só para o layout. Ver [[medicao-perf-tabuleiro]].
