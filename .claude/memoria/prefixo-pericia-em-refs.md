---
name: prefixo-pericia-em-refs
description: "Refs de mecânica para perícia SEMPRE levam o prefixo \"Perícia: \" — é o que desambigua de VDs homônimos; nunca remover"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 987928ce-a4e8-4e2f-86d1-fbd5543bf124
  modified: 2026-07-29T14:58:48.178Z
---

Em `equacao` de mecânica, referência a perícia usa **sempre** `ref: "Perícia: X"`.
Nunca o nome puro. O mesmo vale para `alvo`.

**Why:** vários nomes existem como valor derivado **e** como perícia ao mesmo
tempo — Exorcismo, Transcendência, Alquimancia, Dosagem, Contracanto, Empatia
Sanguínea, Bolha, Investida. `getRefValue` procura VD por nome antes de
perícia, então sem o prefixo a mecânica lê o VD homônimo e devolve o número
errado **em silêncio**, sem erro nem aviso. O prefixo é o namespace.

Corrigido pelo usuário em 29/07/2026, depois de eu ter removido o prefixo de
uma mecânica "para funcionar no wizard". O problema real era o simulador do
wizard não tratar o prefixo (a ficha tratava, via `TARGET_MAP`, que registra
`sk.name` e `'Perícia: ' + sk.name`). A correção certa foi no código, não no
dado: `getRefValue` em `criar-personagem/js/mechanics-simulator.js` agora
resolve `Perícia: X` antes de consultar os VDs.

**How to apply:** ao cadastrar mecânica, manter o prefixo. Se um valor não
aparecer no wizard mas aparecer na ficha, o bug é de resolução no simulador —
consertar lá, não tirar o prefixo. Regressão coberta por
`criar-personagem/js/skill-ref-prefix.test.mjs`.

Relacionado: [[limitacao-dano-nao-estruturado]] [[cascata-de-altura-nos-derivados]]
