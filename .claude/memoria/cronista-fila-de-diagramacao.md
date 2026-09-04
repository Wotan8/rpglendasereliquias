---
name: cronista-fila-de-diagramacao
description: O que sobrou do redesenho do Escritório do Cronista (set/2026) e as duas travas externas.
metadata: 
  node_type: memory
  type: project
  originSessionId: caff94df-de47-4ccf-b131-c355cd07a4fe
  modified: 2026-09-01T03:26:37.831Z
---

Set/2026: o redesenho do Escritório do Cronista ENTREGOU tudo — as sete
frentes (aparência do livro, versionamento+aviso, campo vinculado, imagem
livre, colunas+formato de página, tabelas, trilha) mais os dois blocos do
playtest de Ordem Paranormal 2: **ponto de interesse** (`tm-ponto`) e
**carta/handout** (`tm-carta`). Nada da fila de diagramação está aberto.

**Travas — as duas resolvidas:**

1. ~~Sem pasta de áudio no `storage.rules`.~~ **RESOLVIDO em 01/09/2026:**
   existe `audio/` (leitura de logado, escrita de mestre, 25 MB, contentType
   `audio/*`), e ela serve **os dois** lugares que tocam som — a trilha do
   capítulo e a playlist do Tabuleiro. A playlist subia em
   `tabuleiro-images/`, cuja regra exige imagem: **estava quebrada em
   silêncio**. Peça única: `shared/audio-arquivo.js`.
2. ~~O aviso de versão não alcança jogador de livro só-de-`conhVinculo`.~~
   **RESOLVIDO em 01/09/2026:** a conta saiu para `shared/alcance-livros.js`
   e cada ficha grava o espelho `livrosAlcance` no save. Ficha SEM o campo é
   "não dá para saber", não "não alcança" — e entra no aviso por precaução.

**Why:** o usuário pediu explicitamente para pôr os dois itens na lista, e as
travas foram declaradas em vez de contornadas — quem retomar precisa saber
que não são esquecimento.

**How to apply:** o harness é `__check-livro-modal.html` (271 asserts). RODE
ELE NO `python __check-server.py` (launch.json: `harness-sem-cache`, porta
5412), não no `http.server`: aquele deixa o navegador servir módulo do cache,
e o teste passa contra o código de ontem — custou quatro rodadas de caça a bug
inexistente. A suíte leva ~40s (tem esperas de autosave), então dispare e
consulte `#chkOut` depois em vez de aguardar inline. Relacionado:
[[versionamento-de-canone]], [[campo-vinculado-tres-estados]].
