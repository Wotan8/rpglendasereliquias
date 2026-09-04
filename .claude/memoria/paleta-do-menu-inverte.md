---
name: paleta-do-menu-inverte
description: "No Portal (menu/css/menu.css) --ink é claro nos DOIS temas; escolher o token pela cor da superfície, não pelo tema."
metadata: 
  node_type: memory
  type: reference
  originSessionId: 99649d1b-8547-4f54-a23c-954e4bd8166b
  modified: 2026-08-25T20:11:20.274Z
---

`menu/css/menu.css` tem uma paleta própria que **não** segue a lógica dos tokens
globais:

- `--ink` é **claro nos dois temas** (`--lr-bg-1` no claro, `--lr-text-1` no
  escuro).
- `--chip` é **escuro nos dois** (`--lr-text-1` no claro, `--lr-surface` no
  escuro).
- `--paper` é **claro nos dois** (`--lr-divine` / `--lr-surface`).
- `--muted` **não** inverte: é sempre `--lr-text-2`.

**Como escolher:**
- Texto sobre `--chip` (cartão de personagem) → `--ink`; secundário →
  `--ink` com `opacity`.
- Texto sobre `--paper` (cartão da Loja, da Meta) → `--lr-text-1`.
- Texto sobre arte/véu (nome no retrato, quantidade no item) → **literal**
  (`--lr-divine`, `#D4AF37`), porque o véu é escuro literal.

**Why:** usar o token "óbvio" dá tinta clara sobre papel claro (ou escura sobre
cartão escuro) em UM dos temas, e passa despercebido em quem só testa o outro.
Aconteceu três vezes em 24/08/2026, inclusive numa "correção" anterior que
produzia o defeito que dizia evitar.

**How to apply:** `node shared/contraste.test.mjs` pega — rode antes de commitar
CSS do Portal. Exceção consciente (branco sobre gradiente) vai em `PERMITIDAS`,
no topo do teste, com o motivo.

Relacionadas: [[responsivo-sempre]], [[sanfona-recolher-expandir]].
