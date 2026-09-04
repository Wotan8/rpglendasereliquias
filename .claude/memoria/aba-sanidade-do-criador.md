---
name: aba-sanidade-do-criador
description: "Regra de auditoria que dependa só do `sys` vai em shared/sanidade.js (aba Sanidade), não num script novo em functions/."
metadata: 
  node_type: memory
  type: project
  originSessionId: 99649d1b-8547-4f54-a23c-954e4bd8166b
  modified: 2026-08-24T20:07:26.532Z
---

O Painel do Criador tem a aba **🩺 Sanidade** (desde 24/08/2026). Ela roda
`auditar(sys)` de `shared/sanidade.js` em cima dos caches que o painel já
carregou — sem leitura extra de Firestore, sem DOM.

**Onde escrever regra nova:**
- depende só de `system/data/*` → entra em `REGRAS` de `shared/sanidade.js`, com
  caso novo em `shared/sanidade.test.mjs`. Aparece na aba sozinha.
- precisa de `char`/`npcs`/`items` → aí sim continua sendo script em `functions/`.

**Why:** havia 37 `functions/audit-*.mjs` que o usuário nunca via, e os erros que
elas pegam são silenciosos (o cadastro salva, a ficha não reclama). Script novo
em `functions/` repete esse problema.

**How to apply:** `ALVOS_FIXOS` é cópia da metade estática do `TARGET_MAP` de
`ficha-v1.7_1/js/mechanics-engine.js`; mexeu num, o teste exige mexer no outro.
O parser de custo mora em `shared/parse-custo.js` (`functions/parse-custo.mjs` é
só ponte) — nunca reimplementar, ver [[audit-custo-carimbado]].
Conferência visual: `painel-criador/__check-sanidade.html`.

Relacionadas: [[condicao-nivel-acumulaniveis]], [[prefixo-pericia-em-refs]],
[[vd-reacao-nao-e-orfao]], [[nunca-hardcodear-regra-de-jogo]].
