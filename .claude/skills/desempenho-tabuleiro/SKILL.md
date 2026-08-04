---
name: desempenho-tabuleiro
description: Implementação no Tabuleiro (VTT) com desempenho como requisito de pronto. Use ao mexer em qualquer coisa de tabuleiro/ — render, fog, luz, grid, arrasto de token, ferramentas do mestre, sincronização entre mestre e jogadores, ou quando o usuário pedir para otimizar/deixar mais fluido o tabuleiro.
---

# Tabuleiro — implementar com desempenho no pronto

Página multiplayer com jogadores agindo ao mesmo tempo. Fluidez é requisito
funcional, não polimento. Ordem: **correto → legível → eficiente**. Só sacrifica
clareza por desempenho com ganho medido.

## Contexto fixo — não pergunte, assuma

1 mestre + 4 jogadores · sessão de 3h · mapa até 8k · ~40 tokens · ~200 desenhos ·
até ~14 fontes de luz · **celular mediano é o hardware-alvo**. Só pergunte se o
pedido sair claramente disso (mesa de 10+, mapa gigante, centenas de luzes).

Stack: ES modules servidos estáticos, sem bundler. Canvas 2D (decisão fechada na
[ADR-001](../../../tabuleiro/ADR-001-motor-render.md) — não proponha PIXI/WebGL sem bater
nos critérios de reversão de lá). Sincronização é Firestore `onSnapshot`: **não
existe servidor de broadcast seu**, então não há custo por conexão a otimizar.

## Duas moedas, não uma

- **ms por frame no celular** — orçamento 16ms. Caminho caro medido: raycast do
  fog e redesenho da cena.
- **writes/reads do Firestore** — é dinheiro real. Fluxo sincronizado novo sem
  throttle é bug de custo, não de latência. Referência: cursor ligado o tempo
  todo chega a ~30k writes numa sessão (ver `CUSTOS-FIRESTORE.md`).

## Antes de escrever: reusar

| Precisa de | Use | Onde |
|---|---|---|
| agrupar writes de arrasto | `criarFilaDeEscrita` | `tabuleiro/js/tab-write-queue.js` |
| cache invalidado por versão | `criarMemoPorVersao` + `PERF.mapVersion` / `wallsVersion` | `tabuleiro/js/tab-perf.js` |
| medir etapa / contar eventos | `medir(nome, fn)` · `contar(nome)` | `tabuleiro/js/tab-perf.js` |
| bitmap grande em zoom-out | `melhorBitmap` (mipmaps manuais) | `tabuleiro/js/tab-perf.js` |
| teste raio × parede | `paredesProximas` (hash espacial) | `tabuleiro/js/tab-perf.js` |
| exclusão/atualização em massa | `writeBatch`, commit a cada 400 | `tab-main.js`, `tab-mostrar.js` |

Nada de throttle, cache ou cronômetro novo enquanto um desses servir.

## Onde o desempenho morre aqui, em ordem

1. **Frame** — desenhe só o que intersecta a viewport; a camada estática
   (mapa + grid) é blit cacheado; o loop só redesenha com `T.dirty`. Nunca
   recalcule fog por frame de câmera — pan/zoom não muda visibilidade.
2. **Invalidação** — cache que não invalida é frame errado, e o sintoma é mudo.
   Propriedade nova que afete mapa, parede, porta, janela ou luz precisa entrar
   em `notifyObjectChange` / `notifyCanvasConfigChange` ou na `fogKey`.
   Diga na entrega qual cache a sua mudança invalida.
3. **Writes** — throttle por fluxo: arrasto 100ms, régua 130ms, cursor 200ms,
   exploração do fog 3s, combate 600ms. Nunca escreva por `pointermove` cru.
   Fluxo sincronizado novo entra na tabela do `CUSTOS-FIRESTORE.md`.
4. **Payload** — `updateDoc` com o delta do que mudou, nunca o estado inteiro.
   Estado de N usuários vira N campos em 1 doc (`tabuleiro-meta/*`) com merge,
   não N docs.
5. **Concorrência** — o write final do arrasto cancela o pendente do mesmo
   objeto (senão o token treme e volta); o eco do próprio write é filtrado por
   `lastWriter`; trocar de canvas ou desmontar solta os `onSnapshot`.

## Verificação (parte do pronto)

- Mexeu em arrasto, fog, luz ou render → abra com `?perf=1` **no celular** e
  reproduza em `tabuleiro/__check-perf-arrasto.html`. Diga o antes/depois em ms.
- Lógica pura (cálculo, fila, rota, custo de movimento) → um `.test.mjs` ao lado,
  no padrão dos que já existem (`tab-write-queue.test.mjs`, `tab-rota.test.mjs`).
- Mexeu em sincronização → rode as linhas de FASE 2 do `QA-CHECKLIST.md` com duas
  abas: uma no modo secreto (mestre), outra no público (jogador).

## Achou coisa mal otimizada no caminho

Não conserte agora. Anexe em `tabuleiro/OTIMIZACOES.md`: local, problema,
impacto estimado, risco. Segue com o que foi pedido.

## Fechamento da entrega

Bloco curto com: decisões de desempenho tomadas · o que ficou simples de
propósito · qual cache/versão a mudança invalida · em que eixo isso quebra
(nº de objetos no canvas, nº de fontes de luz, ou celular fraco) — **não** em
número de jogadores, esse é fixo.
