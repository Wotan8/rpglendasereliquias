---
name: npc-calc-engine-dois-furos
description: "Motor de NPC: furo de perícia corrigido; o de Vitalidade era script meu sem ordenar sys.derivedValues" (v2: Reação não existe mais)
metadata: 
  node_type: memory
  type: project
  originSessionId: 4ba8f8a7-63d8-46d4-b4fc-74a03d9117fb
  modified: 2026-08-13T21:56:10.760Z
---

> **Núcleo v2 (04/09/2026):** o VD Defesa raiz (ex-Reação) foi apagado; as três defesas são a perícia. O conselho de ordenar `sys.derivedValues` continua valendo.
Descobertos em 09/08/2026 ao montar a dupla do Torneio Famélia em modo mecânico.
`painel-mestre/js/npc-calc-engine.js`, NPC de schema v2:

**1. ~~Nenhuma perícia entra em conta nenhuma~~ — CORRIGIDO em 12/08/2026**
(commit `535606c`, sw v197). `buildTargetMap` agora também mapeia
`'Perícia: ' + s.nome` → `SKILL:id`, espelhando a ficha do jogador
(mechanics-engine.js:131). Equação de arma/mecânica com `"Perícia: X"` resolve o
nível certo no modal do Painel do Mestre E na Ficha de Combate do Tabuleiro
(que passou a usar `calcularNpc` para os golpes). Overrides gravados como
contorno da era do furo continuam vencendo o auto — vale REVISAR os NPCs
travados na mão (Torneio Famélia) e destravar o que só existia por causa disso.
Ver [[prefixo-pericia-em-refs]].

**2. ~~Vitalidade fica uma passada atrás~~ — NÃO ERA BUG DO MOTOR (13/08/2026).**
O diagnóstico anterior estava errado. O motor faz 2 passadas e os `vitalStats`
vêm primeiro, mas **`ensureNpcSystemData` entrega `derivedValues` ORDENADO** por
`blocoOrdem` → `ordem`, e nessa ordem a cadeia Altura → Tamanho → Vitalidade
fecha. O Painel do Mestre sempre acertou. Quem errava era **script meu** que
montava `sys` na ordem crua do Firestore: aí Altura caía depois de Tamanho e o
Yotun saía com VIT 12 em vez de 41.

⚠ **Todo script Node que chama `calcularNpc` tem que ordenar `sys.derivedValues`
igual ao `npc-system-data.js`** — sem isso, o número da ficha e o do script
divergem e a tentação é "consertar" a ficha certa com override errado. Ordenado,
não é preciso override nenhum além de Altura (que é dado de entrada).

**Reação vale 0 de propósito** (combate v3): a mecânica `ebI9tPI7SLT43iHFB5iy`
foi **aposentada** e desvinculada do VD — o nome dela diz isso. O VD continua
publicado porque alimenta as 8 Defesas por ref de nome, ver
[[vd-reacao-nao-e-orfao]]. `todoPersonagem` sem mecânica hoje: Dano, Altura,
Blindagem, Acerto, Qualidade do Foco, Reação. **Nenhum desses é bug.**

**Terceiro detalhe, de design:** `_npcItemFormas` devolve `['segurando']` e sai
antes de `'efeitos'` — item **segurado** nunca concede bônus. Instrumento de
Bardo (formaEquipar `segurar`) não soma Acerto Mágico; vai no texto de `ataques`
na mão. A Ficha de Combate do Tabuleiro espelha essa régua de propósito
(`temEfeitosAtivos` em tab-ficha-win.js).

**How to apply:** perícia agora conta; Vitalidade de criatura grande ainda
precisa de conferência manual + override. Golpes por item (alvo tipado + dano)
saem de `calcularNpc().porItem` — modal e Tabuleiro usam a mesma conta.
