---
name: changelog
description: Gera um changelog em PDF do que mudou no sistema de Lendas & Relíquias — regras, valores derivados, módulos de classe, itens, livros ou código. Use quando o usuário pedir "gera o changelog", "changelog dessa mudança", "faz o changelog", "documenta o que mudou", ou invocar /changelog depois de uma alteração.
---

# Changelog

Fecha uma rodada de mudanças num PDF curto que o usuário e os jogadores conseguem ler em dois minutos. **Não é documentação técnica** — para isso existe o `/redator-tecnico-rpg`. Aqui o alvo é: *o que mudou, como era antes, e o que isso muda na mesa.*

## 1. Levantar o que mudou

Junte as fontes nesta ordem. Não invente entradas — cada item precisa de origem verificável.

- **A conversa atual.** É a fonte principal quando a mudança acabou de ser decidida com o usuário.
- **Scripts de migração** em `functions/` criados ou rodados nesta rodada — o cabeçalho de cada um explica o porquê.
- **`git status` e `git diff`** para mudanças de código não commitadas.
- **`git log --oneline -15`** se o usuário pedir o changelog de commits já feitos.
- **O banco**, quando precisar confirmar um número: `node functions/query-db.js get <colecao> <docId>`.

Se algo ficou **decidido mas não implementado**, ou **pendente da decisão do usuário**, isso vai numa seção própria no fim. Nunca escreva como se estivesse pronto.

## 2. Escrever

Grave em `changelogs/AAAA-MM-DD-<assunto-curto>.md`. Crie a pasta se não existir.

Regras de redação, nesta ordem de importância:

1. **Frase curta, palavra comum.** "O defensor não rola mais dado" — não "a resolução defensiva foi convertida para um modelo estático".
2. **Antes → Depois** sempre que houver um número. Tabela de duas ou três colunas resolve melhor que parágrafo.
3. **Diga o efeito na mesa.** Toda mudança de regra ganha uma linha começando por "Na prática:".
4. **Números só quando decidem alguma coisa.** Um DPR ou uma probabilidade que justifique a mudança, sim. A memória de cálculo, não.
5. **Sem emoji no corpo do PDF** — o gerador usa fontes base e eles saem como quadrados.
6. **Uma página é o alvo.** Duas é o teto. Se passar, você está explicando em vez de listar.

Estrutura:

```markdown
# <Título curto do que mudou>
<data> · <versão ou identificador da rodada>

<Um parágrafo, no máximo três frases: o que mudou e por quê.>

## O essencial
| Antes | Depois |
|---|---|
| ... | ... |

## <Área que mudou>
- **<coisa>** — o que mudou. *Na prática:* o que o jogador sente.

## Ficou pendente
- ...
```

## 3. Gerar o PDF

```bash
python .claude/skills/changelog/md2pdf.py changelogs/<arquivo>.md changelogs/<arquivo>.pdf
```

O gerador aceita `#`/`##`/`###`, listas com `-`, tabelas com `|`, `> destaque`, `---`, `**negrito**`, `*itálico*` e `` `código` ``. Nada além disso — se precisar de outra coisa, reescreva o texto, não o gerador.

Se mexer no `md2pdf.py`, rode o autoteste antes de entregar:

```bash
python .claude/skills/changelog/md2pdf.py --autoteste
```

## 4. Entregar

Mande o PDF com a ferramenta `SendUserFile` (`display: "render"`) e resuma em até três linhas no chat o que ele contém. Não repita o changelog inteiro na resposta — o PDF é a entrega.

## Verificações antes de fechar

- Todo número no changelog bate com o banco ou com a conta feita na conversa.
- Toda mudança listada foi de fato aplicada; o que não foi está em "Ficou pendente".
- Nenhum item diz "melhoramos" ou "ajustamos" sem dizer de quanto para quanto.
- O PDF abriu e tem o número de páginas que você esperava.
