---
name: campo-vinculado-tres-estados
description: "Token do livro que lê o cadastro tem 3 estados, e offline NUNCA pode acusar \"objeto não encontrado\"."
metadata: 
  node_type: memory
  type: project
  originSessionId: caff94df-de47-4ccf-b131-c355cd07a4fe
  modified: 2026-09-01T00:58:11.155Z
---

Decidido em 31/08/2026, com o usuário. O campo vinculado (`span.tm-campo` em
`shared/campo-vinculado.js`) resolve **na leitura**, e o texto dentro do span é
a **reserva** — o último valor conhecido.

Três estados, e o terceiro é o que importa:

1. achou → escreve o valor fresco
2. **leu** e não achou → reserva + aviso vermelho "objeto não encontrado"
3. **não deu para ler** (offline, rede caiu, permissão negada) → reserva, **sem
   aviso nenhum**

**Why:** offline, "não achei no banco" não é "foi apagado". Acusar objeto
sumido no metrô mente para o leitor sobre o próprio cânone. Por isso o
resolvedor separa `null` (falhou) de `Map` vazio (leu e não tem) — só o
segundo acende.

**How to apply:** ao mexer nisso, o caminho offline precisa **limpar** avisos
antes de sair, senão uma lápide de leitura anterior fica de pé justo no estado
em que não pode aparecer (foi bug real). O aviso é `::after` sobre
`data-sumiu`, e `data-sumiu` está FORA da lista do sanitizador de propósito —
gravado viraria lápide permanente. Relacionado:
[[versionamento-de-canone]], [[verificar-fonte-nao-historico]].
