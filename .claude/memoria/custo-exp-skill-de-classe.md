---
name: custo-exp-skill-de-classe
description: Núcleo v2: habilidade de ramo custa Qualidade × exp.habilidadePorQualidade (4); Dom = 10 EXP; ramo opcional = 10 EXP com Perícia de Escola 2
metadata:
  type: project
---

O preço de uma habilidade de módulo de classe com Escola e Qualidade ≥ 1 é **Q × 4 EXP** (`config/regras` → `exp.habilidadePorQualidade`; `shared/skill-custo.js` → `custoExpDaHabilidade`). Módulo sem Escola usa `custoExpProprio`/`custoExpPorItem` do cadastro. Dom individual = 10 EXP (`exp.domSemNivel`) ou o preço da mecânica de EXP da criação; comprar um ramo opcional = 10 EXP com Perícia de Escola ≥ 2.

**Why:** decisão do Núcleo v2 (fase C7). A régua antiga "o nível do módulo é o preço (1..5)" só vale para os predefs sem Escola que ainda trazem o próprio custo.

**How to apply:** nunca hardcodear 4 — ler de `window.REGRAS`. O Poder da ficha conta as habilidades pelo mesmo `custoExpDaHabilidade`.
