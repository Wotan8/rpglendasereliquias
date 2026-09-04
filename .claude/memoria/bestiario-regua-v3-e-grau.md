---
name: bestiario-regua-v3-e-grau
description: Como se mede uma criatura no v3 — força em x guerreiro, os seis Graus de Ameaça, os dois testes de encontro e a doma que sai do Grau.
metadata:
  type: project
---

> **Núcleo v2 (04/09/2026):** a unidade é 3,25 e a faixa é Patamar (0–5) com Qualidade, não Grau/Fio; a skill `bestiario` já está na régua nova.
Cânone fechado na sessão de 28-29/08/2026, gravado no Bestiário (`book_mrs9ur4aw1m6a`) e nos scripts `functions/bestiario-*.mjs`.

```
P(golpe passa) = clamp((Alvo − Defesa) ÷ 10, 0 ; 0,9)   Alvo preso em 9
líquido        = max(1, dado_médio + bônus − Blindagem_do_alvo)
DPR            = P × líquido        força = DPR ÷ 3,90
```

Defensor de referência: Defesa 1, Blindagem 2. Unidade 3,90 ([[regua-base-390]]). Excedente de Alvo acima de 9 vira Transbordo e tem de estar escrito na ficha. `Dano = FOR`, `Alvo = (FOR max DES) + perícia da arma natural`, `Vitalidade = (VIG + Tamanho) × 3` com `Tamanho = Altura × 3`, Blindagem natural teto 3,90.

Graus por força (= quantos personagens a criatura ocupa): Inofensiva <0,15 · Praga 0,15–0,35 · Comum 0,35–0,75 · Séria 0,75–1,5 · Grave 1,5–3,0 · Calamidade ≥3,0.

Encontro são DOIS testes lineares, não a lei do quadrado de Lanchester (erro que já cometi e corrigi — o pool de Vitalidade já modela a atrição): `N × f ≈ P` E `N × v ≈ P × 18`. Passar só no dano é vidro; só na carne é esponja.

A doma sai do Grau — Redutor 0/−1/−1/−3/−5/−7 e Lealdade inicial 6/5/4/3/2/1: fera perigosa começa mais desconfiada E sobe mais devagar. O rito de doma mora em `criatura.comportamento` (4 linhas: Chamariz, Preço, A prova, O erro) porque é o único campo do bloco `criatura` que sobrevive a um save do Painel.

**Why:** a régua toda é derivável, mas redescobri-la custa uma sessão inteira e o erro de Lanchester é atraente.

**How to apply:** antes de criar ou auditar bicho, rode `/bestiario`; todo número de verbete é GERADO da ficha em `npcs`, então mudou a ficha, roda o script de novo. Ver também [[nunca-hardcodear-regra-de-jogo]] e [[livro-regua-balanceamento]].
