---
name: estilo-preso-a-ancestral
description: "No Portal, elemento que MUDA de lugar por JS perde estilo escrito com seletor de ancestral — ancorar no que viaja junto, e olhar a tela."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: fc158354-422d-4adf-bbdf-dc27c9eee460
  modified: 2026-09-04T14:03:40.411Z
---

Antes de escrever CSS novo no Portal, duas perguntas: **este elemento é movido
por JS?** e **as classes que estou usando existem numa folha que ESTA página
carrega?**

**Why:** em 03–04/09/2026 o mesmo erro apareceu duas vezes num dia.

1. Botão de push: usei `btn btn-secondary btn-sm`. Essas classes só existem em
   `criar-personagem`, `ficha` e `painel-mestre` — **nenhuma** delas é carregada
   pelo Portal. O botão saiu com a borda crua do navegador, parecendo alerta de
   erro. O usuário: *"Que tipo de botão mais ridiculo do mundo é esse"*.
2. Atalhos de cargo (Mestre/Criador/Worldbuilding/Mapa): o desenho vinha de
   `.portal-topo .toolbar .portal-cargo`, mas `atalhosNoLugar()` MOVE o grupo
   para dentro de `#tabBar` no celular. Ao mudar de casa o seletor deixa de
   casar e eles perdem desenho **e** o alvo de toque de 40px (que vinha de
   `.toolbar button`). O usuário: *"No mobile os botões de paineis... tá
   ridiculo, arruma isso e nunca mais faz uma merda dessa"*.

**How to apply:**

- Ancore no que **viaja junto** com o elemento (o grupo `.portal-atalhos`), não
  no lugar de onde ele sai. Se dois irmãos moram em lugares diferentes (a
  Roleta fica na `.toolbar`, o grupo vai para a faixa), liste as duas âncoras.
- Confira a **especificidade** contra o que já existe: `.toolbar button` pesa
  (0,1,1) e `html.dark .toolbar button` pesa (0,2,2). Um seletor de duas
  classes perde para o segundo — por isso o original tinha três.
- **Olhe a tela.** Os dois defeitos passariam em qualquer teste de
  comportamento; nenhum dos dois sobrevive a um olhar. Desenhe o estado no
  `__check-*` correspondente (`__check-portal-raiz.html` para o cabeçalho,
  `__check-repertorio-loja.html` para as abas) e afirme o ESTILO, não só a
  posição: "mudou de faixa" não basta, tem de "continuar desenhado lá".

⚠️ O painel do navegador desta sessão às vezes mede com viewport ZERO (largura
0) e aí toda asserção de geometria falha de mentira. Antes de acreditar numa
falha de medida, tire um screenshot para acordar o painel e confira
`document.documentElement.clientWidth`.

Relacionado: [[responsivo-sempre]], [[paleta-do-menu-inverte]].
