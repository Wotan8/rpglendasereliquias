---
name: condicoes-de-participante-formato
description: "p.condicoes no doc de combate aceita string (legado) e objeto {nome, icone, descricao, expiraNaRodada}; ler sempre por condDoParticipante()."
metadata: 
  node_type: memory
  type: project
  originSessionId: 81ddd286-c3c0-48ac-8cad-43efaa006d5a
  modified: 2026-08-13T15:27:33.507Z
---

Desde 13/08/2026, as condições do participante do combate (`mesas/{id}/tabuleiro-meta/combate`, campo `condicoes` de cada participante) têm duas gerações no MESMO array: string solta (legado, sem prazo) e objeto `{ nome, icone, descricao, expiraNaRodada }`. `expiraNaRodada` null/ausente = dura até remover; expira quando `rodada >= expiraNaRodada` (mesma régua dos templates).

**Why:** o Tabuleiro ganhou duração em rodadas, emoji e descrição por condição, com expiração automática na virada de rodada (aviso ao mestre com opção de prolongar). Não houve migração — mesas antigas seguem com strings.

**How to apply:** nunca ler `p.condicoes[i]` cru — normalizar com `condDoParticipante()` de `shared/combate-cenas.js` (a expiração usa `tirarCondicoesExpiradas()`, pura e testada em `shared/combate-cenas.test.mjs`). Leitores conhecidos: tabuleiro/js/tab-combat.js, tab-hud.js e painel-mestre/js/combat.js. As condições da FICHA (`char.conditions` / `npcs.conditions`) continuam objetos com `tempoRestante` em texto — formato antigo, não mudou.
