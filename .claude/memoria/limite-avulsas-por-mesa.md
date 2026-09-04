---
name: limite-avulsas-por-mesa
description: "A mesa limita quantas avulsas de cada tipo o jogador pega na criação; convive com o teto de EXP, que é outra coisa"
metadata: 
  node_type: memory
  type: project
  originSessionId: ebc60805-71e3-4c2f-9276-ac72252ea9e0
  modified: 2026-08-05T21:20:09.694Z
---

Desde 05/08/2026 o Mestre configura, em **Painel do Mestre → Mesa → Configurações da
Campanha**, quantas Peculiaridades Avulsas de cada tipo o jogador pode escolher na criação:
`config.maxPecVantagens` e `config.maxPecDesvantagens`, **padrão 3** cada.

**São dois limites diferentes e os dois valem juntos** — não confundir:
- **contagem** → `LIMITE_PADRAO_AVULSAS` / `limiteAvulsas()` em
  `criar-personagem/js/peculiarities-module.js`, barrando em `togglePeculiarity2`.
  Controla *quantas marcas* o personagem tem (sabor).
- **orçamento** → `TETO_GANHO_DESVANTAGENS` (30) em `criar-personagem/js/exp-tracker.js`.
  Controla *quanta EXP* as desvantagens rendem. Limitar a contagem não libera o orçamento:
  Nanismo Nv5 sozinho rende 46 e ainda assim é clampado em 30.

O caminho é `mesas/{id}.config` → `criar-personagem/js/firebase.js` monta
`wizardState.mesaVinculada` → o módulo lê de lá. **Mesa antiga sem os campos cai no padrão 3**
(`?? 3` nas duas pontas), então não houve migração de dados.

**Criação avulsa (sem mesa vinculada) é livre** — `limiteAvulsas` devolve `Infinity`, porque
não existe Mestre para configurar o teto. O contador da seção então mostra só a contagem
("2") em vez de "2/3"; é o que `rotuloContagemAvulsas` resolve. O teto de EXP continua
valendo mesmo sem mesa.

**Cuidado com `|| padrão` nesses campos:** 0 é configuração legítima ("esta mesa não permite
vantagens avulsas") e `||` transformaria 0 no padrão. O `saveMesaConfig` usa um helper
`inteiro(id, padrao)` com `Number.isFinite`. Os campos vizinhos (`expInicial`,
`limitePadraoPersonagens`) ainda usam `||`/`??` e têm esse bug latente — lá 0 não é útil hoje.

Regressão em `criar-personagem/js/limite-avulsas.test.mjs`.
Ver [[peculiaridades-avulsas-rebalanceadas]] e [[economia-de-exp-da-mesa]].
