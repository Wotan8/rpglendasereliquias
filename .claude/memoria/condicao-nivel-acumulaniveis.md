---
name: condicao-nivel-acumulaniveis
description: Condição sem acumulaNiveis:true ignora o nível do cadastro e entra em 1 — falha silenciosa.
metadata: 
  node_type: memory
  type: feedback
  originSessionId: e4c840bb-8c62-4525-902d-2d1c018df429
  modified: 2026-08-16T21:52:26.638Z
---

Declarar `nivel: N` em `condicoesAplicadas` **não basta**. `empilharCondicao`
(`tabuleiro/js/tab-combat.js`) só honra o nível quando a CONDIÇÃO, no cadastro
`system/data/conditions`, tem `acumulaNiveis: true` — e ainda corta por `nivelMaximo`.

Sem a flag, "Célere 5" entra em **1**. A habilidade entrega uma fração do que a
Régua cobrou e **nada na tela avisa**. Já pegou dois casos reais: Passos Sombrios
(Célere 5 → 1) e COMPOSIÇÃO DE BATALHA do Bardo (Fortalecido 2 → 1).

Auditoria pronta: `node functions/audit-condicao-nivel.mjs` (sai com código 1 se achar
divergência). Comportamento do motor travado em `tabuleiro/js/tab-condicao-nivel.test.mjs`.

**Why:** é o modo de falha mais caro do balanceamento — o número no banco está certo,
a régua está certa, e a mesa recebe outra coisa.
**How to apply:** ao cadastrar habilidade com condição de nível, conferir a flag na
condição ANTES de carimbar a régua. Ver [[nunca-hardcodear-regra-de-jogo]].
