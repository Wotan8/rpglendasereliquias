---
name: frentes-e-pagina-de-sessao
description: Novo modelo de gerenciamento de mesa (frentes com relógio + página única de sessão) — o que já existe e o que falta (etapa 3)
metadata: 
  node_type: memory
  type: project
  originSessionId: e8db6e43-5f7e-4e74-bd79-1af64cf65c9b
  modified: 2026-07-31T01:37:19.885Z
---

Em 2026-07-30 o Painel do Mestre > Mesa ganhou duas sub-abas novas, desenhadas a partir do modelo "três camadas (campanha/frentes/situações) + ciclo semanal (preparo → ao vivo → colheita)":

- **🕰️ Frentes** (`area-mesas-frentes.js`, subcoleção `mesas/{id}/frentes`): ameaças com relógio de fatias (4/6/8/12 ≈ sessões até o desastre), presságios por limiar que disparam ao cruzar, rostos (refs a `npcs`), histórico de movimentos. `computeAvanco` é exportado e compartilhado com a colheita.
- **🎬 Sessão** (`area-mesas-sessao.js`, subcoleção `mesas/{id}/sessoes`): doc único por sessão com `fase: preparo → aoVivo → fechada`. Preparo (início forte, cenas, segredos, encontros salvos no formato de `tabuleiro-meta/combate`); ao vivo (revelar segredo — opcionalmente no teleprompter via `tabuleiro-meta/legenda` —, inbox de captura, iniciar encontro = 1 setDoc no combate); colheita (frentes avançam/recuam, resumo, fecha). Segredos não revelados herdam para a próxima sessão.

Regras de design que o código respeita: recuo de relógio NÃO desfaz presságio ocorrido; avanço de frente só na colheita (ou botão manual na aba Frentes); `frentes` e `sessoes` são só-mestre nas rules (o catch-all de `mesas/{id}` virou `/{sub}/{document=**}` com exclusão explícita — matches sobrepostos são OR no Firestore).

**Etapa 3 entregue (2026-07-30, SW v119):** `tabuleiro/js/tab-sessao.js` — janela 📋 (botão na topbar, só secreto) com cenas/segredos/inbox/encontros/frentes lendo os MESMOS docs do Painel via onSnapshot; relógio de canvas com `frenteId` (mestre lê `T.frentes` ao vivo, público lê `espelho` gravado no objeto pelo cliente do mestre — sem nome; clique vira read-only, avanço só pela colheita); cena→`canvasId` no preparo (select de mapa) com pulo via `transicaoDeCena`. Limitação conhecida: o espelho só atualiza para o público quando o mestre está com o Tabuleiro aberto no canvas (comentário ponytail no código).

**Mesa 1 populada (2026-07-30):** mesa "Grau Espectro" = `7MQKtOpcMt8DCH7r97Fb`. Script idempotente `functions/cadastrar-mesa1-grau-espectro.mjs` (dry-run / `--apply`) importou da pasta Reliera: 19 sessões históricas em `session-logs` (25–46; 40/43/44 não têm registro), a Sessão 47 "Dois Fios" em `sessoes` fase preparo (6 cenas, 12 segredos, 5 encontros com npcId real), e 2 frentes — "A Dívida com Ina" (4 fatias, 4 presságios, todos transcritos de `Consequencias_Pendentes.docx`) e "A Onça" (6 fatias, **sem presságios** — os documentos não trazem escada; o usuário precisa escrever). 30 NPCs vinculados. Faltam: canvases do Tabuleiro (0) e os PCs dos jogadores (só a Sona existe, e vai ser trocada).

Relacionado: [[fontes-da-campanha-reliera]] (o preparo em Word que isto substitui em parte), [[gerar-exp]] — EXP continua pelo fluxo atual, a colheita só aponta para ele.
