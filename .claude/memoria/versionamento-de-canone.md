---
name: versionamento-de-canone
description: "Escada decimal 1.02→1.03, vira a casa só em 1.99→2.00; vale para qualquer cânone e também para IA editando direto."
metadata: 
  node_type: memory
  type: project
  originSessionId: caff94df-de47-4ccf-b131-c355cd07a4fe
  modified: 2026-08-31T23:36:34.076Z
---

Decidido em 31/08/2026. Todo cadastro de cânone (livro, capítulo, raça, classe,
tribo, local, NPC, item, magia, peculiaridade) carrega `versao`, e **mexeu no
conteúdo, sobe a versão** — inclusive quando quem mexe é uma IA por script ou
edição direta no Firestore.

Escada decimal: `1.02 → 1.03 → … → 1.99 → 2.00`. Incremento de um centésimo; a
casa inteira só vira quando a decimal estoura, nunca por "essa mudança foi
grande". Só o criador pula versão à mão. Primeira gravação nasce em `1.00`.

Não sobe por metadado que ninguém lê (`updatedAt`, ordem, estante, publicação).
Grava `"1.03"`, sem o `v` — o prefixo é da exibição, em `versaoDoLivro()`.

**Why:** cânone que muda sem mudar de versão faz o jogador ler uma coisa e a
mesa jogar outra, e ninguém descobre até a sessão travar.

**How to apply:** a regra completa está no `CLAUDE.md` do projeto, seção
"Versionamento de cânone" — leia de lá antes de editar cadastro. Pendente de
implementação: perguntar a versão no salvar do Painel do Criador e do
Worldbuilding, e notificar os jogadores quando um livro muda de versão.
Relacionado: [[livro-de-regras-do-jogador]], [[verificar-fonte-nao-historico]].
