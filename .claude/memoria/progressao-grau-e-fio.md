---
name: progressao-grau-e-fio
description: Núcleo v2: a escada do item é Qualidade 0–5 (+Aura 6–10), Afiação até Q, 1 Encantamento; Grau/Fio/Liga/Integridade não existem mais
metadata:
  type: project
---

Toda peça tem **Qualidade 0–5**: +Q no dano (arma), Blindagem = Leve 1 / Média 2 / Pesada 3 + Q (armadura), +Q no Bloquear (escudo). Por cima: Afiação/Reforço (comum ou arcano, até Q pontos), Encantamento (1 por peça, 2 no Graal), Aura da peça (Q6–10). Desastre no dado come Afiação e depois marca Danificada (−1 Q).

**Why:** Livro de Regras do Jogador 2.0x, Capítulo 5 (Núcleo v2, 03–04/09/2026). Grau, Fio, Liga, Integridade, Blindagem tipada e Domínio saíram do jogo e do banco.

**How to apply:** a porta é `periciaId` (Perícia de Arte); Q acima da perícia = redutor no Alvo igual à diferença. Poder da peça = (Q + Afiação) × 5 + 10/Encantamento + 25/Aura. Refs de equação: `Item: Qualidade`, `Item: Afiação`, `Item: Afiação Arcana`, `Item: Reforço`, `Item: Aura`. Ver [[economia-de-exp-da-mesa]] e [[redesenho-nucleo-v2]].
