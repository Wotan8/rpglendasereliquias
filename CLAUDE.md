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
