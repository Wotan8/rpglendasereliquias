---
name: numerador-ataque-extra
description: O numerador 2,75 de Corte de Passagem e Golpe Cruzado não é reproduzível — não mexer nessas duas.
metadata:
  type: feedback
---

**Corte de Passagem** (Ladino) e **Golpe Cruzado** (Guerreiro) carregam o MESMO numerador
carimbado, `2,75 unidades`, para o mesmo tipo de efeito: um ataque extra no turno. Esse
número **não sai** de `1 golpe = 1,000 unidade` (§0.6) por nenhum caminho. Quem carimbou
os dois usou um modelo de "ataque extra" que não está documentado em capítulo nenhum.

Recomputando o Corte de Passagem pelo que a régua sabe: entrega ~1,000 (o ataque extra)
por 1 Energia + Ação de Movimento (1,333) = **0,75×, subdimensionada**.

Registrado em `functions/audit-custo-carimbado.mjs`, no mapa `ACEITAS`.

**Why:** em 16/08/2026 corrigi o denominador do Corte de Passagem, **mantive o numerador
sem verificar**, e a razão inflada (2,06×) me levou a propor SUBIR o custo dela — o que
teria enfraquecido uma habilidade já fraca. O usuário me parou antes de aplicar.
**How to apply:** corrigiu denominador? recomputa o numerador também — a razão só
significa alguma coisa se as duas metades foram verificadas. E não mexer nessas duas até
o modelo de "ataque extra" existir num capítulo. Ver [[audit-custo-carimbado]].
