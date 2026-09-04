---
name: regua-dano-0154-vs-0290
description: Dano garantido 0,256 · +N num golpe 0,154 · e o EXP entra no denominador a 0,10/ponto (§0.6b).
metadata: 
  node_type: memory
  type: reference
  originSessionId: e4c840bb-8c62-4525-902d-2d1c018df429
  modified: 2026-08-16T21:52:41.134Z
---

A tabela do §1.1 (`book-regua-balanceamento`) traz duas taxas que não podem valer juntas
para um bônus de "+N de dano em cada golpe":

- `1 ponto de dano = 0,290 = 1 ÷ 3,445` (dano cru)
- `+1 Blindagem por rodada = 0,154 = 0,53 × 1 ÷ 3,445 — só rende no golpe que entra`

Um "+N de dano por golpe" só rende no golpe que entra, igual à Blindagem — logo **0,154**.
O 0,290 só cabe em dano garantido/entregue (cura, dano automático).

**RESOLVIDO em 16/08/2026 pelo §6.13**, que precifica imposto de dano por ação como
`2 × d × 0,290` (exemplo fechado do Congelamento Nv 2: 4 de dano = 1,16). Esse dano é
**automático** — sem rolagem de acerto nem defesa. Confirma a leitura acima: 0,290 para
dano garantido, 0,154 para +N num golpe que precisa acertar. O §1.1 continua com a
redação ambígua e vale corrigir o capítulo.

Use a **tabela oficial de valor cheio por condição do §6.3** em vez de derivar na mão —
foi de lá que veio a correção do Atordoado (**1,32**, não 1,00: 1,000 de turno roubado +
0,320 de atacar quem não pode reagir). Valores aplicados: Passos Sombrios 1,18×,
Golpe pelas Costas 1,12×, Ataque Mudo 2,17×.

Consequência colateral: **nenhum carimbo `regua` de 13/08/2026 é reproduzível** por nenhuma
das duas taxas (ex.: Postura Ofensiva, +4 de dano, carimbada em 1,56 un — não sai por 1,16
nem por 0,62/3,08). Tratar a leva inteira daquela data como suspeita.

Segunda pergunta em aberto da mesma sessão: **o EXP entra no denominador da régua?**
O §0.6 diz `custo total = recursos + ação` e ignora o EXP. Mas Cólera (Guerreiro) é a única
manobra de 5 EXP do sistema e a única acima do teto (2,15× numa faixa de 1,00–1,70×) — indício
de que a mesa usa o preço em EXP como válvula para capstone que estoura a faixa. Se for
intencional, o §0.6 está incompleto e várias "skills fora da faixa" estão fora de propósito.

**Why:** sem fixar essas duas coisas, todo número de balanceamento é provisório.
**How to apply:** declarar a premissa no início de qualquer auditoria numérica; ver
[[livro-regua-balanceamento]] e [[economia-de-exp-da-mesa]].
