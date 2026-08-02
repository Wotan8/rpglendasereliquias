# Tabuleiro — otimizações pendentes

Achados no caminho de outras tarefas. Nada aqui é bug: é custo conhecido com
consertos que não cabiam no escopo da vez.

## 1. `tokenVisivelParaMim` roda por token, por quadro

- **Local:** `js/tab-fog.js` → `tokenVisivelParaMim` / `pontoVisivelAgora`,
  chamado de `drawCamada` (`js/tab-render.js`).
- **Problema:** cada token testa ponto-em-polígono contra todas as visões, e o
  polígono de raycast tem centenas de vértices. Com o mestre agora entrando por
  essa rota também no público (v134), são três telas pagando o custo.
- **Impacto:** ~40 tokens × ~14 fontes × centenas de vértices por quadro; pesa
  no celular durante o arrasto, quando a cena já redesenha.
- **Conserto:** memo por `PERF.fogKey` (só muda quando visão ou parede muda) —
  `criarMemoPorVersao` já serve. Não muda regra nenhuma.
- **Risco:** baixo. Errar a invalidação = token aparecendo/sumindo com atraso.
