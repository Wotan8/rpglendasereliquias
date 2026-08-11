# Auditoria de Custos Firestore — Tabuleiro (FASE 7.2)

Estimativas para uma sessão típica: **1 mestre + 4 jogadores, 3 horas**, mesa ativa.

## Throttles e debounces em vigor

| Fluxo | Frequência máx. de escrita | Onde |
|---|---|---|
| Arrasto de token/objeto | 1 write / **100ms** por objeto (`DRAG_THROTTLE`) | tab-tools |
| Cursor ao vivo | 1 write / **200ms** + heartbeat 10s (desligável no botão 👥) | tab-presenca |
| Régua compartilhada | 1 write / **130ms** | tab-tools |
| Exploração do fog | 1 write / **3s** (debounce, só se houver célula nova) | tab-fog |
| Combate (painel mestre) | debounce **600ms** | painel-mestre/combat.js |
| Janela de ficha: vitais/quantidade/nível/módulo | 1 write / **600ms** por doc+campo (`criarFilaDeEscrita`) | tab-ficha-win |
| Janela de ficha: mover p/ contêiner · dropar no mapa | 1 write ou 1 batch por soltar (ação explícita, sem throttle) | tab-ficha-win |
| Ping | 1 write por ping (ação explícita) | tab-presenca |

## Leituras

- **Boot**: mesa (1) + masters (1) + chars da mesa (N≈5) + npcs (N≈10–30) + users (N≈4)
  + canvases (N≈3) + objetos do canvas (N≈50–300) ≈ **100–350 reads** por cliente.
- **Listeners**: cada `onSnapshot` cobra 1 read por documento *alterado*; documentos
  parados não cobram de novo. Custo dominante: objetos alterados durante a sessão.
- **Vitais (F5)**: 1 listener por personagem (≈5 docs) — cobra apenas quando a ficha muda.
- **Janela de ficha de combate**: dados de NPC/char saem dos listeners que JÁ existem
  (coleção `npcs` e vitais por char) — custo zero. O que ela adiciona: 1 listener de
  itens por janela ABERTA (N itens no 1º snapshot, depois só o que mudar) e, uma vez
  por sessão, os registros do sistema (`system/data/*`, ~10 coleções pequenas,
  compartilhados com o modal de NPC via `window._npcSys`).
- **Escrita da janela**: cada edição grava o DELTA no doc da ficha (`updateDoc` de
  campo), com espelho no participante do combate quando o NPC está em cena — mesmo
  padrão de dupla-escrita do painel de combate.

## Escritas (cenário pesado: combate com movimentação intensa)

- Token arrastado por 3s contínuos: ~30 writes (100ms) + 1 final. Um combate com
  40 movimentações ≈ **1.2k writes**. Antes da padronização era ~50% maior (150→100ms
  compensado pelo write final único e pela flag `movendo` que evita writes de fog).
- Cursores: 5 usuários × 3h com uso ativo de ~20min de movimento real ≈ 5 × 6k =
  **até 30k writes** se todos deixarem ligado o tempo todo. Por isso o **toggle 👥
  desliga a publicação** (o heartbeat também para) — recomendo manter desligado fora
  de momentos de "apontar no mapa".
- Exploração: ≤ 1 write / 3s por cliente **público**, apenas quando revela célula nova
  ≈ centenas de writes por sessão de exploração, não milhares.

## Operações em lote (writeBatch)

- `tbLimparDesenhos` → 1 commit a cada 400 exclusões (antes: 1 write por doc).
- `tbExcluirCanvas` → idem para todos os objetos do canvas.

## Documento único vs. subcoleção

- Presença/pings/réguas/legenda usam **1 doc cada** (`tabuleiro-meta/*`) com merge —
  N usuários geram N campos, não N docs, e o listener é 1 read por alteração.
- Exploração vive **dentro do doc do canvas** (base64 ≤ ~190KB por segurança,
  limite do doc é 1MB) — zero docs extras.

## Recomendações de operação

1. Deixe os **cursores desligados** por padrão em mesas grandes (o botão lembra a escolha).
2. Prefira **portas** a redesenhar paredes: abrir/fechar porta é 1 write; parede nova invalida caches.
3. `Resetar exploração` apaga o campo (1 write), não uma coleção.
4. O painel de combate persiste com debounce — cliques rápidos em ± de vida não geram 1 write por clique.
