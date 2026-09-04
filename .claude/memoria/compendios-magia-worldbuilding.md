---
name: compendios-magia-worldbuilding
description: "Lore e compêndios das escolas de magia moram no Worldbuilding (1 livro por escola), não no código"
metadata: 
  node_type: memory
  type: project
  originSessionId: b84f74d3-53ae-4c6b-9e85-e867d96f7e1e
  modified: 2026-07-27T19:29:17.803Z
---

O conteúdo de lore/regras aprofundadas das escolas de magia mora no **Worldbuilding**,
não hardcoded. Criado em 27/07/2026: **1 livro por escola** em
`worldbuilding-books` + artigos em `worldbuilding-articles` (`contentHTML`, `order`,
`status: rascunho`, `public: false`).

Livros: Compêndio de Alquimancia, Necromancia, Pallomancia, Abismancia, Runomancia,
Hemomancia, Totemancia, Sonoromancia. Os 7 primeiros vieram da extração do
`Livro da Magia – Lendas e Reliquias – v1.7.pdf` (1 artigo cada; tabelas do PDF
viraram texto corrido — vale revisar no editor).

**Runomancia é o caso especial:** seus 15 artigos vieram do `RUNO_COMPENDIO` que
estava hardcoded em `laboratorium-runarum/js/compendium-data.js` — versão curada,
com tabelas HTML, muito melhor que a do PDF.

**Why importa:** o Laboratorium agora lê o compêndio rúnico do Firestore via
`LabFB.loadCompendio()` (busca o livro pelo título "Compêndio de Runomancia" e ordena
os artigos por `order`). `renderCompendio()` em `lab-app.js` é async e cai no
`RUNO_COMPENDIO` local só como fallback. Editar os artigos no Worldbuilding reflete
no Laboratorium sem tocar em código.

**NÃO mover para o Worldbuilding:** `RUNO_TABELAS` no mesmo arquivo (subcarga,
sobrecarga, confluências, intensidade) — a engine de auditoria de runas
(`rune-engine.js`) consome esses dados de verdade; não é texto de consulta.

Relacionado: [[padrao-de-cadastro-de-manobras]]
