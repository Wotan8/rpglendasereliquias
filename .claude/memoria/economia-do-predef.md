---
name: economia-do-predef
description: "Campo `economia` nos predefs de classe (§3.3) — só `combate` se mede pela régua de dano."
metadata: 
  node_type: memory
  type: project
  originSessionId: e4c840bb-8c62-4525-902d-2d1c018df429
  modified: 2026-08-16T23:38:26.839Z
---

> **Núcleo v2:** a régua de dano e os carimbos estão na base 3,90; recompor na base 3,25 antes de usar (ver [[regua-base-v2]]).
Desde 16/08/2026 cada `itensPredefinidos[]` de `system/data/classModules` carrega
**`economia`**, o teste de escopo do **§3.3** da Régua ("forçar tudo numa régua só é
erro de categoria"):

- `combate` (80) — dano, cura, Alvo, Blindagem, ação negada, desarme, **furtividade**.
  Só estas se medem pela régua de unidades/DPR.
- `cena` (17) — planos, selos, ocultação, detecção pura, viagem, ritual. **Não tem régua
  nenhuma no sistema** — é o buraco real, o §11 que falta escrever.
- `invocacao` (6) — fantoches, aliados animais, Ecos. Mede pelo §3.1, pela ficha da criatura.
- `receita` (8) — loções e patuás. Régua de item (preço + dificuldade de preparo), §8.
- 6 do Bardo ficaram **sem o campo de propósito**: a descrição delas é o próprio nome
  repetido, e classificar exigiria inventar o que fazem.

Script: `node functions/marcar-economia-predefs.mjs` (idempotente; padrão é `combate`,
as exceções estão listadas por id com o motivo).

Consequência: carimbo `regua` em predef de economia ≠ `combate` é **ruído, não
diagnóstico**. Caso real: Reconsagração do Santuário marcada 0,51× sendo Fora de combate.

"Classe sem régua" era em boa parte artefato de categoria: Druida (12 hab.) e Adepto de
Thannathog (3) não têm **nenhuma** habilidade de combate. O Runimago tem 0 habilidades —
o poder dele vive na Runomancia/Laboratorium, não em classModules.

**Why:** sem o escopo marcado, toda auditoria futura acusa ritual de desbalanceado.
**How to apply:** filtrar por `economia === 'combate'` antes de aplicar a régua de dano.
Ver [[livro-regua-balanceamento]] e [[regua-dano-0154-vs-0290]].
