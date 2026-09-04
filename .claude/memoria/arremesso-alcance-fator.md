---
name: arremesso-alcance-fator
description: "Peça arremessável usa alcanceFator (N) — alcance vem do braço, não da peça; N = 0,75 / 1 / 1,5."
metadata: 
  node_type: memory
  type: project
  originSessionId: e4c840bb-8c62-4525-902d-2d1c018df429
  modified: 2026-08-16T21:33:18.428Z
---

Desde 16/08/2026 o catálogo tem o campo **`alcanceFator`** (N) em `system/data/equipment`.
Preenchido = a peça é arremessável, e o alcance é
**(FOR + Atletismo + Arremessar) × N metros** — quem alcança é o braço, não a peça.

É o inverso do `ignoraLimiteForDisparo` da besta, e mora na mesma função pura
`shared/alcance-disparo.js` (`alcanceDeDisparo`, `bracoDeArremesso`). O corte de
`FOR × 10` NÃO se aplica ao arremesso: a Força já está dentro do braço.

Os três N, calibrados contra a Funda (20 m) como teto — arremesso nunca pode bater
arma de disparo:

- **0,75** — machadinha, boleadeira, rede, loções, pós, frascos
- **1,0** — adagas, facas, dardo, porrete
- **1,5** — azagaia, lança curta, lança, tridente

28 itens marcados. O item arremessável guarda **dois** VDs de Acerto (Corpo a Corpo
*e* à Distância, este com `DES + Perícia: Arremessar`) — a mesma peça usada de duas
formas. `tab-ficha-win.js` monta uma coluna por VD de `escopoItem: 'coluna'`, então
as duas aparecem lado a lado na mesma linha de ataque; a linha continua
`distancia: false`, porque a adaga ainda é adaga na mão.

**Why:** o alcance de arremesso é do personagem, não do item — cadastrar metro fixo
no item estava errado por construção.
**How to apply:** peça arremessável nova = preencher `alcanceFator` e vincular o VD
`N1JLG2HeKHOL9UEzrQU4`. Ver [[nunca-hardcodear-regra-de-jogo]] e
[[evitar-mecanica-vinculada-a-item]].
