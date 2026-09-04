---
name: audit-custo-carimbado
description: Carimbo antigo da régua esqueceu a ação no denominador — a razão sai inflada; audit e parser testado prontos.
metadata:
  type: project
---

A v1 da Régua media `unidades ÷ recurso` e **não contava a ação**. O §0.6 corrigiu para
`custo total = recursos + ação`, mas parte dos carimbos de 13/08/2026 nunca foi refeita.
Denominador pequeno demais = **razão inflada**: a habilidade parece aprovada sem estar.

Pegou 7 de 76 em 16/08/2026. O pior: Luz Reveladora I carimbada `custo 1` onde as cinco
irmãs do mesmo círculo têm 2 — razão real era 0,48×, não 0,96×.

Ferramentas, as duas em `functions/`:

- **`parse-custo.mjs`** — parser puro do campo de custo → unidades, com teste embutido
  (`node functions/parse-custo.mjs`). Regras que ele trava: `"ou"` **escolhe** a
  alternativa mais barata (§4.2) e nunca soma; `"+"` soma dentro da alternativa; campos
  numéricos separados somam entre si (o Invocador tem "Custo Sanidade" e "Custo em
  Energia"); `"3 ENER"` é abreviatura de Energia.
- **`audit-custo-carimbado.mjs`** — compara `regua.custo` com `recursos + ação`.
  Sai com código 1 se achar divergência.

**Why:** a primeira versão da auditoria tinha parser próprio, somava as alternativas de
"ou" e acusou 18 furos onde havia 4. Um deles só apareceu porque o teste do parser
existia: `/de/` sem `\b` comia o "de" de Sani**da**de, a moeda sumia do mapa e caía no
fallback 1,0 — 3,4× de erro em silêncio.
**How to apply:** rodar a auditoria depois de qualquer leva de carimbos; nunca
reimplementar o parse dentro dela. Ver [[livro-regua-balanceamento]] e
[[economia-do-predef]].
