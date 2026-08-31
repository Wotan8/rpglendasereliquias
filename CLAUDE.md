# Estilo de resposta

Sem preâmbulo, sem títulos, sem repetir a pergunta. Frases curtas e diretas. Mostre o resultado e pare.

# Mapeamento de código

O grafo do projeto já está indexado em `graphify-out/` (fora do git). Consulte-o antes de sair relendo arquivo por arquivo.

Quando vale a pena:

- Pergunta sobre arquitetura, onde algo mora, ou o que depende do quê.
- Antes de editar código compartilhado — para ver quem chama antes de mudar assinatura.
- Quando a resposta exigiria abrir mais de três ou quatro arquivos para descobrir.

Não vale para achar uma string literal, ler um arquivo que você já sabe qual é, ou pergunta que não é sobre código. Nesses casos vá direto no Grep/Read.

```bash
graphify query "como o custo de ação é gasto no turno"   # travessia BFS a partir da pergunta
graphify explain "calcularNpc()"                          # o nó e seus vizinhos
graphify affected "custosDaSkill()"                       # quem quebra se eu mexer nisso
graphify path "tab-turno.js" "skill-custo.js" --undirected  # menor caminho entre dois nós
graphify god-nodes --top 10                               # hubs de arquitetura
```

O grafo é um índice, não a verdade. Confirme no arquivo antes de afirmar ou editar.

Depois de mexer em código, o grafo envelhece — `graphify update .` re-extrai só o que mudou (AST local, sem LLM, sem custo). O `GRAPH_REPORT.md` guarda o commit em que foi construído.

As 686 comunidades têm nome em português (`Tabuleiro — Turno e Economia de Ação`, `Ficha — Motor de Mecânicas`, `Auditoria: Graus`). Os nomes estão versionados em `.graphify/labels.json` — o `graphify-out/` inteiro fica fora do git.

Uma re-extração completa reagrupa as comunidades e devolve todo mundo para `Community N`. Para trazer os nomes de volta:

```bash
python .graphify/labels.py aplicar
```

O casamento é por sobreposição de membros, não por ID — os IDs de comunidade mudam a cada extração. Se você nomear comunidades novas à mão, grave com `python .graphify/labels.py salvar`.

# Versionamento de cânone

Todo cadastro que é cânone — livro e capítulo do Cronista, raça, classe, tribo,
local, NPC, item, magia, peculiaridade, módulo de classe — carrega um número de
versão. **Mexeu no conteúdo, sobe a versão.** Isso vale para você tanto quanto
para o criador editando pela tela.

A escada é decimal e fecha em 99:

```
1.02 → 1.03 → … → 1.98 → 1.99 → 2.00
```

Ou seja: o incremento normal é de **um centésimo**. A casa inteira só vira
quando a decimal estoura (1.99 → 2.00), nunca por decisão de "essa mudança foi
grande". Se o criador quiser marcar uma virada de era, ele digita a versão à
mão — só ele decide pular.

Regras:

- **Sem versão gravada ainda?** A primeira gravação nasce em `1.00`.
- **Alterou por conta própria** (script, migração, edição direta no Firestore,
  patch em massa): incremente. Um cânone que muda sem mudar de versão é a
  forma mais barata de o jogador ler uma coisa e a mesa jogar outra.
- **Correção de digitação ou de acento** também sobe. A régua é "o texto que o
  jogador lê mudou?", não "a mudança foi importante?".
- **Não sobe** quando o que mudou é metadado que ninguém lê: `updatedAt`,
  `updatedBy`, ordem no sumário, estante, marcação de publicação.
- **Migração que toca N documentos** sobe a versão de cada um. Se for grande
  demais para isso fazer sentido, pergunte antes de rodar.
- O formato é texto livre no banco (`versao`), normalizado na exibição por
  `versaoDoLivro()` em `shared/livros-pub.js` — que prefixa `v` quando o autor
  não escreveu letra. Grave `"1.03"`, não `"v1.03"`.
