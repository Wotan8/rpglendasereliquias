---
name: npc-em-varias-mesas
description: "NPC pode servir várias mesas ao mesmo tempo — vinculos é canônico, mesaId é só espelho da primeira"
metadata: 
  node_type: memory
  type: project
  originSessionId: e8db6e43-5f7e-4e74-bd79-1af64cf65c9b
  modified: 2026-07-31T01:37:00.475Z
---

Decisão do usuário (2026-07-30): **um NPC/criatura pode estar vinculado a várias mesas simultaneamente**. Recusou mover NPCs entre mesas justamente por isso.

`shared/npc-mesas.js` é a fonte única: `npcNaMesa(npc, mesaId)`, `mesasDoNpc`, `comMesa`, `espelhoMesaId`, `patchVinculoMesa`.

- `vinculos: [{tipo:'mesa', id}]` é a lista **canônica** (aceita N mesas).
- `mesaId` é **espelho legado da primeira mesa** — nunca comparar direto, sempre `npcNaMesa()`.
- `vinculosComMesa()` do `tab-state.js` foi **removida**: ela apagava todas as mesas antes de somar a atual, o que impedia multi-mesa. Testes migrados em `tab-state.test.mjs`.
- Normalização do editor promove `mesaId` a vínculo ao abrir o NPC — sem isso o save seguinte desvincularia sozinho.

**Why:** o elenco da Reliera é reaproveitado entre campanhas (Arkrau, Albrix, Thalion e Gertrok servem Bugigangas e Grau Espectro ao mesmo tempo).

**How to apply:** ao ler pertencimento de NPC a mesa em qualquer tela nova, importar `npcNaMesa`; ao ligar/desligar, usar `patchVinculoMesa`. Nunca escrever `mesaId` cru.

Relacionado: [[frentes-e-pagina-de-sessao]], [[fontes-da-campanha-reliera]]
