---
name: fontes-da-campanha-reliera
description: Onde ficam os materiais da campanha de mesa (pasta Reliera + coleção npcs do Firestore) e como ler cada formato
metadata: 
  node_type: memory
  type: reference
  originSessionId: 5898b59d-2528-423c-985e-d99a793e3a9f
  modified: 2026-07-31T02:20:42.030Z
---

O conteúdo narrativo da campanha **não** está no repositório. Fica em dois lugares:

⚠ **REORGANIZADO em 2026-07-30 (de novo)**: a pasta virou um vault com categorias numeradas —
`00 🗂️ HUB e Menus`, `01 🌍 Worldbuilding` (lore do cenário: calendário, Submundo, Obscurum,
`🗺️ Geografia e Locais` com notas .md de Forkrok/Mirfel/etc. e a subpasta Sereni),
`03 🎲 RPG e Campanhas` (contém `Mestre\Sessões\Mesa1\` — uma pasta por sessão `SessãoN\` com
nota `SessãoN.md` + docx, e `Linha_do_Tempo_Sessoes.md` como índice da Mesa 1), `05 🐉 Bestiário`,
etc. Os caminhos abaixo descrevem a estrutura ANTIGA — os arquivos migraram para dentro dessas categorias.

**1. `D:\Imagem\US - Universo Soberano\RPG\Reliera`** (working dir adicional)

⚠ Reorganizada em 2026-07-30: a Reliera inteira agora é **um único vault de Obsidian**
(o antigo `Cofre_Reliera` foi mesclado na raiz). Estrutura numerada:
`00 🗂️ HUB e Menus`, `01 🌍 Worldbuilding` (calendário, Submundo, Fundamentos das Runas,
Sereni em `🗺️ Geografia e Locais\`), `02 📖 Histórias e Livros` (ex-`0- Lore`),
`03 🎲 RPG e Campanhas`, `04 👥 Personagens`, `05 🐉 Bestiário`, `06 🧝🏻 Raças`,
`07 ⛺ Tribos`, `08 ✨ Magia` (inclui compêndios de Runomancia), `09 📝 Modelos e Templates`,
`10 🗃️ Anexos` (Arte, Mapas, Músicas), `99 🗄️ Arquivo` (Notion exports, versões mortas).
Os nomes de pasta têm emoji — em PowerShell/Bash, usar glob (`03*`) em vez de digitar o nome.

- `03 🎲 RPG e Campanhas\Mestre\` (ex-`0- Mestre`) — reorganizado em 2026-07-28 em 3 categorias + a raiz:
  - `Sessões\` — reorganizada em 2026-07-30:
    - `Mesa1\` — **vault de Obsidian**: uma pasta `Sessão<N>` por sessão (25 a 47), cada uma
      com uma nota `Sessão<N>.md` no mesmo template — frontmatter YAML (`sessao`, `data`,
      `arco`, `local`, `tags`), callout `> [!abstract] Ficha da sessão`, e as seções fixas
      `## Resumo`, `## Relatos dos jogadores`, `## EXP da sessão`, `## Navegação` (wikilinks
      prev/next). O índice é `Linha_do_Tempo_Sessoes.md`. Personagens e NPCs são wikilinks
      não resolvidos de propósito (`[[Cindy Kayane]]`), esperando notas próprias.
      Material bruto por sessão: JSON de log em 25–28 e 30; `.docx` do Ritual do Arauto em
      `Sessão34\`; `RESUMO_Sessao46...docx` em `Sessão46\` (registro canônico, + subpasta
      `SITUACAO B` que é plano alternativo não ocorrido); guias da próxima em `Sessão47\`.
      **Sessões 40, 43 e 44 não têm pasta nem nota** — foram jogadas mas não sobrou nenhuma
      informação sobre elas, e o usuário mandou remover: sessão sem conteúdo real não vira
      arquivo. A numeração pula esses três. Futuras: `Mesa1\Sessão<N>\Sessão<N>.md`.
    - `Mesa2-Sessão0\` — sessão 0 da **Mesa 2** (mesa diferente da que estou acompanhando).
      Contém a subpasta `Mesa 2\` com o dossiê e a carta que abriram aquela campanha.
  - `Lore e Referência\` — `Guia_do_Mestre_Sussurro_Final.docx/pdf` (⚠ **superado** pelo guia
    completo dentro de `Mesa1-Sessão46\`, mas deixado na raiz do Mestre por escolha do usuário,
    fora das 3 categorias) fica **na raiz**, não aqui. Na reorganização de 2026-07-30 o grosso
    do lore saiu daqui pra `01 🌍 Worldbuilding` (Submundo, calendário, `Sereni\`); sobraram só
    referências de mesa (Consulta do mestre, Mensagem Cifrada, Tópicos de Lore do Personagem).
  - `Ferramentas\` — `Geradores\` (criaturas/itens aleatórios) e `Sistema de EXP\`
    (`Prompt_Distribuicao_de_EXP.docx`, a rubrica usada pelo skill `gerar-exp` do repositório
    de código, v3 — recalibrada pra média baixa e com teto de diferença entre jogadores).
    Skill fica em `rpglendasereliquias/.claude/skills/gerar-exp/SKILL.md` — invocar com
    "gera o EXP da sessão N". Ele lê a rubrica + o `RESUMO_SessaoN...docx` da pasta da sessão,
    calcula, mostra pra aprovação, e grava a seção "EXP DA SESSÃO" no final do próprio resumo.
- Livro do sistema e fichas: `03 🎲 RPG e Campanhas\Livro do Sistema\` (v1.7 + versões antigas)
  e `03 🎲 RPG e Campanhas\Fichas\`.

**Contos (obra do autor).** `02 📖 Histórias e Livros\Relatos de Vasteluna\` guarda os
contos em `.docx` — a fonte, melhor que os PDFs espalhados pelas pastas de sessão.
São OBRA, não material de referência: entram no Cânone **na íntegra, um por capítulo,
sem uma palavra alterada**, e nunca picotados em citações. Extrair do .docx em vez de
redigitar. O 1º parágrafo é o título; a assinatura ("~ De Fulano") só existe no PDF.

⚠ **`Talion de Inéria` NÃO é `Thalion Vassek`.** Nomes quase iguais na mesma pasta,
pessoas diferentes. Não misturar, não mexer no Talion.

**2. Firestore, coleção `npcs`** — ~80 NPCs com `rolePlay.{motivacao,segredos,relacoes,frases,trejeitos,historia}`,
que é onde os segredos de mestre realmente vivem (mais atualizado que os PDFs).
Ler com `functions/query-db.js` (`node query-db.js list npcs 100`). Também há
`worldbuilding-submundo-feiras` e `worldbuilding-factions`.

**How to apply:** PDFs leem direto com a tool Read (usar `pages`). `.docx` não —
extrair com PowerShell (`System.IO.Compression.ZipFile` → `word/document.xml`,
trocar `</w:p>` por newline e limpar tags). Para consultas ad-hoc no Firestore,
criar um script temporário ao lado de `query-db.js` e **apagar depois**.

Relacionado: [[padrao-de-cadastro-de-manobras]]
