---
name: sanfona-recolher-expandir
description: "Todo bloco retrátil usa shared/sanfona.{js,css} — nunca desenhar seta nem botão de recolher próprios."
metadata: 
  node_type: memory
  type: project
  originSessionId: 99649d1b-8547-4f54-a23c-954e4bd8166b
  modified: 2026-08-24T23:46:09.246Z
---

Desde 24/08/2026 o projeto tem **uma** gramática de recolher/expandir:
`shared/sanfona.css` (▸ fechado, ▾ aberto, girando 90°) e `shared/sanfona.js`
(o botão "Expandir tudo / Recolher tudo").

**Como usar:**
- `<details class="lr-sanfona">` para dobra nova.
- Dobra por classe (blocos que não podem virar `<details>`): a seta é um
  `<span class="lr-seta">` e a tela declara só o estado aberto, numa linha.
- Grupo com botão: `data-sanfona` no bloco + `data-sanfona-barra` no cabeçalho
  (dispensável se o bloco é `<details>`), e `ligarSanfona(bloco)` depois de cada
  re-render. Para dobra por classe, some `data-sanfona-classe="<classe>"` e
  `data-sanfona-item` nas dobras.

**Why:** havia nove desenhos para a mesma ação (▸/▾ trocando glifo, ▸ girando 90°,
▾ girando 180°, ▼ girando −90°, ▶ por classe, dois botões separados no
formulário de item). O leitor reaprendia a cada tela.

**How to apply:** o botão se mede pelo BLOCO via `@container`, não por `@media`
— o mesmo grupo aparece em coluna estreita e em modal largo. Nunca pôr `color`
numa `transition` dentro de `[data-sanfona]`: a cor fica presa no tema anterior.
`shared/sanfona.test.mjs` falha se alguém desenhar seta fora da folha, usar sem
carregar, ou marcar grupo sem cabeçalho. Conferência visual:
`__check-sanfona.html`.

Relacionadas: [[responsivo-sempre]], [[aba-sanidade-do-criador]].
