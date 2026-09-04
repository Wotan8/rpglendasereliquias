---
name: fechar-sessao-exige-log
description: Fechar uma sessão no Painel só está completo depois de gravar o log dela em session-logs; a aba Sessão esvazia e o registro some se faltar.
metadata:
  type: feedback
---

NUNCA finalizar uma sessão sem salvar ela nos logs. Marcar `fase: 'fechada'` em
`mesas/{id}/sessoes` só tira o card da aba **Sessão** — ele não aparece em lugar
nenhum depois. O registro permanente é outro documento, na coleção **raiz
`session-logs`**, filtrada por `mesaId` e ordenada por `sessionNumber`.

**Why:** as duas coisas são desacopladas no código (`area-mesas-sessao.js` fecha,
`area-mesas-sessoes.js` lista o histórico). Fechar sem gravar o log apaga a sessão
da vista do mestre e some com o resumo, os relatos dos jogadores e a colheita.

**How to apply:** ao fechar uma sessão, gravar na mesma leva um doc em
`session-logs` com `mesaId`, `sessionNumber`, `dateReal`, `gameDate`, `summary`,
`playerSummaries`, `participants`, `npcs`, `locations`, `combats`, `loot`, `hooks`,
`moments`, `dmNotes`. Deixar `participants: []` — esse campo move EXP na ficha do
personagem por delta, e o EXP tem fluxo próprio ([[economia-de-exp-da-mesa]] e o
skill `gerar-exp`).

Relacionado: [[frentes-e-pagina-de-sessao]]
