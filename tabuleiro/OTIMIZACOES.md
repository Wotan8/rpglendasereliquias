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

## 2. `backdrop-filter: blur()` nos modais injetados

- **Local:** `css/tabuleiro.css` → `.modal`, `.inv-modal`, `.detail-modal`,
  `.tb-cond-picker-overlay`.
- **Problema:** o véu cobre a viewport inteira, então o compositor borra tudo
  que está atrás — inclusive o `#tbCanvas` com o bitmap do mapa. Abrir a ficha
  de um NPC ou o inventário paga isso enquanto o modal estiver aberto.
- **Impacto:** não é por quadro de arrasto nem de fog (o modal só abre com o
  mestre parado), mas num mapa de 8k em celular mediano o primeiro quadro
  depois de abrir engasga.
- **Conserto:** trocar o blur por opacidade um pouco maior no `--tb-scrim`, ou
  aplicar o blur só no cartão do modal. Nenhuma regra muda.
- **Risco:** baixo — é puramente estético.
- **Achado em:** varredura de UI de 03/08/2026 (não foi introduzido por ela).

## 3. Espelho da cena ativa no doc de combate

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

## 4. `tbCombStat` relê o NPC antes de cada write de vital

- **Local:** `js/tab-combat.js` → `tbCombStat`, ramo `p.npcId`.
- **Problema:** cada clique em ± faz um `getDoc(npcs/{id})` antes do
  `updateDoc`, mas a coleção `npcs` inteira já chega ao vivo por `onSnapshot`
  (`carregarNpcs` em tab-main) — `T.npcs` tem o mesmo dado, de graça.
- **Impacto:** 1 read extra por clique de vida/energia/sanidade de NPC. Num
  combate longo com o mestre clicando, dezenas de reads que não precisavam
  existir. Latência também: o write espera a volta do read.
- **Conserto:** montar o patch a partir de `T.npcs` (a janela de ficha nova,
  `tab-ficha-win.js`, já faz assim com a mesma `patchVitalAtualNpc`).
- **Risco:** baixo — o único caso que o `getDoc` cobre a mais é NPC excluído no
  meio do clique, e o `updateDoc` falharia igual, com o mesmo `catch`.
