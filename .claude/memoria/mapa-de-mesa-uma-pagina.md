---
name: mapa-de-mesa-uma-pagina
description: "Toda sessão preparada precisa de um MAPA de UMA página (HTML A4 paisagem + PDF) além do guia longo — o guia é pra preparar, o mapa é pra conduzir"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: fac5c85c-d89b-492c-9b56-fcd6ac47423e
  modified: 2026-07-29T18:51:05.319Z
---

Guias de sessão de 10+ páginas não servem durante a mesa — não dá pra ficar folheando
enquanto se conduz. **Toda pasta de sessão deve ter também um `MAPA_SessaoN_Uma_Pagina.html`**
(+ o `.pdf` gerado), com visão panorâmica de tudo em UMA página só.

**Why:** o guia longo é ferramenta de *preparação*; o mapa é ferramenta de *condução*.
São públicos diferentes do mesmo conteúdo. Pedido textual do usuário: "olhar uma única
página pra saber guiar a sessão é mais prático. Pense em facilitar a vida do mestre.
Quanto melhor a visibilidade, melhor."

**How to apply:**
- Formato: **HTML com `@page { size: A4 landscape; margin:0 }`**, `.page` de `297mm × 210mm`.
  HTML e não .docx porque só assim dá controle real de densidade, colunas e cor.
- Layout que funcionou (Sessão 47): header fino + **4 colunas** (`.cols` grid, `flex:1`).
  Colunas com conteúdo autônomo, `.pin { margin-top:auto }` pra ancorar o item final.
  ⚠ Evitar caixas de altura fixa com `overflow` visível — o conteúdo vaza e **sobrepõe**
  as seções de baixo sem gerar página 2, então a contagem de páginas sozinha não detecta.
- Base ~7,15pt, `line-height` 1.26, stat blocks em Consolas ~6,4pt.
- Codificação por cor: um fio = uma cor · boss/convergência = vinho · 🔑 chave que destrava
  cena = verde · ✕ erro que arruína o grupo = vermelho.
- Conteúdo: estado "AGORA", beats numerados, stat lines de UMA linha, as **frases-chave que
  destravam cenas**, os ramos condicionais, e uma caixa de armadilhas + resumo do sistema.

**Verificar sempre antes de entregar** — não confiar no olho:
```
chrome --headless=new --no-pdf-header-footer "--print-to-pdf=SAIDA.pdf" "file:///..."
```
Contar `/Type /Page` no PDF **e** ler o PDF com a tool Read pra conferir sobreposição
visual. Args com espaço no caminho precisam de aspas dentro do `-ArgumentList`, senão o
Chrome reclama "Multiple targets are not supported in headless mode".

Relacionado: [[fontes-da-campanha-reliera]]
