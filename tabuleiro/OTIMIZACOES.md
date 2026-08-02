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

## 2. Espelho da cena ativa no doc de combate

- **Local:** `shared/combate-cenas.js` → `docDeCenas`.
- **Problema:** os participantes da cena aberta vão duas vezes no mesmo doc
  (dentro de `cenas[]` e soltos em `participantes`). O espelho existe porque o
  painel de combate da FICHA (`ficha-v1.7_1/js/combat-panel.js`, script clássico)
  lê `participantes` direto.
- **Impacto:** ~2 KB a mais por write de combate, com ~10 participantes. Não é
  por frame nem por arrasto — só quando o mestre mexe no combate.
- **Conserto:** ensinar o painel da ficha a ler `cenas`/`cenaAtiva` (ele já usa
  `import()` dinâmico, então dá para importar o shared) e apagar o espelho.
- **Risco:** médio — mexer nele sem atualizar TODOS os leitores tira a
  iniciativa da tela do jogador. O teste `shared/combate-cenas.test.mjs` tranca
  o espelho justamente por isso.
