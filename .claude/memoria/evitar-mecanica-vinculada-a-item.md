---
name: evitar-mecanica-vinculada-a-item
description: Nunca propor mecânica cadastrada por item de equipamento — usar campos de dados (valoresDerivadosVinculados etc.)
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 7d7b2f52-99af-447c-8318-eef4f5ea3c76
  modified: 2026-07-31T18:10:52.556Z
---

O usuário vetou vincular mecânicas a itens de equipamento como padrão de design.

**Why:** cada item daquele aspecto exigiria sua própria mecânica no cadastro — polui `system/data/mechanics` e o painel.

**How to apply:** bônus e efeitos de item entram por **dados**: `valoresDerivadosVinculados`, `atributosVinculados`, `periciasVinculadas`, `statusVitaisVinculados`, `quantidade`, tags. Mecânica só quando for UMA, compartilhada e inevitável — e mesmo assim propor alternativa de dados primeiro. Ver também [[cura-de-item-via-statusvitais]] e [[progressao-grau-e-fio]].
