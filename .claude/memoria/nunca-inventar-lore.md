---
name: nunca-inventar-lore
description: "Lore é intocável — nunca escrever nome, cultura, governo, economia, militar ou unidade militar sem o usuário fornecer ou aprovar antes"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 987928ce-a4e8-4e2f-86d1-fbd5543bf124
  modified: 2026-07-31T18:11:04.559Z
---

**Nunca inventar lore.** Nome próprio, cultura, governo, economia, estrutura
militar, nome de unidade militar, nome de líder, topônimo — nada disso se
escreve sem o usuário fornecer o texto ou aprovar explicitamente antes.

**Why:** o mundo de Vasteluna já existe e tem canon definido fora do repositório.
Inventar preenchimento cria fatos falsos que entram no banco, vazam para o livro
de regras e para a mesa, e depois têm que ser caçados. Em 30/07/2026 eu inventei
`cultura`, `governo`, `economia`, `militar` e três unidades militares
(MURVAN/TALVEK/KADRUN) para a tribo Muraté porque os campos estavam com `.` —
os nomes reais eram outros e tudo teve que ser revertido.

**How to apply:** campo de lore vazio (`.` ou string vazia) **não é convite para
preencher**. É item a perguntar. Ao cadastrar tribo/raça/classe, escrever só a
parte mecânica e listar quais campos narrativos ficaram faltando, pedindo o
texto. Descrição de peculiaridade que explica uma mecânica é aceitável desde que
não introduza fato novo do mundo (instituição, nome próprio, evento histórico).

Nos scripts `functions/cadastrar-*.mjs`, o bloco de texto fica vazio com
comentário avisando — não repovoar.

**Vale também para MECÂNICA existente:** nunca supor o papel de algo já
cadastrado — ler o worldbuilding/livro antes de propor. Em 31/07/2026 supus que
os 3 VDs do Bardo eram três escolas alternativas de instrumento; errado
(Sonoromancia = escola, Contracanto = defesa musical, Harmonia = energia
musical, tudo descrito no Compêndio de Sonoromancia). O usuário: "lê tudo sobre
a classe e a escola cadastrado no worldbuilding antes de supor alguma coisa.
nunca suponha nada." Os livros ficam em `worldbuilding-books` +
`worldbuilding-articles` (texto no campo `contentHTML`).

Relacionado: [[fontes-da-campanha-reliera]]
