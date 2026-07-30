# 🜲 Lendas & Relíquias — Manual de Identidade Visual (Design System)

> **Leia este documento antes de criar ou alterar qualquer tela, componente ou estilo.**
> Ele é a fonte única de verdade da identidade visual do sistema. Vale para desenvolvedores
> humanos e para IAs de desenvolvimento. Todo módulo novo deve herdar esta identidade
> automaticamente — sem exceções e sem valores fixos.

---

## 1. Conceito

A interface do Lendas & Relíquias é um **artefato mágico construído por uma civilização
medieval avançadíssima em engenharia arcana**. Não é medieval clássico, não é fantasia
genérica, não é futurista, não é steampunk.

O usuário deve sentir que opera um **grimório vivo / mesa de comando arcana / instrumento
rúnico de precisão**, movido a Runas, Cristais, Relíquias e Essência — nunca eletricidade.

**Materiais de referência:** pedra escura, ferro forjado, aço escovado, bronze envelhecido,
ouro discreto, couro nobre, cristais energizados, vidro fosco, runas gravadas.
Pergaminho **nunca** é a base da interface (apenas detalhe narrativo pontual).

**Personalidade:** elegância, conhecimento, precisão, mistério, sofisticação.
**Proibido:** infantilidade, visual cartunesco, poluição visual, excesso de ornamento,
estética steampunk ou futurista.

---

## 2. Arquitetura do Design System

Três camadas, carregadas **nesta ordem exata** em toda página:

```html
<!-- 1. CSS local da página/módulo -->
<link rel="stylesheet" href="css/minha-pagina.css">

<!-- 2. Tokens (variáveis globais — fonte única de verdade) -->
<link rel="stylesheet" href="../shared/tokens.css">

<!-- 3. Camada de identidade (estiliza componentes globalmente) -->
<link rel="stylesheet" href="../shared/lendas-reliquias.css">
```

| Arquivo | Papel | Pode editar? |
|---|---|---|
| `/shared/tokens.css` | Todas as variáveis: cores, tipografia, espaçamento, raios, sombras, transições, z-index, opacidade. Inclui **aliases legados** (`--bg`, `--paper`, `--ink`, `--accent`, `--primary`…) que fazem o CSS antigo herdar a paleta nova. | Só com aprovação de design. Nunca remover os aliases legados. |
| `/shared/lendas-reliquias.css` | Identidade aplicada a **componentes** (botões, inputs, tabelas, abas, modais, badges, scrollbars, toasts, skeleton…). | Sim, para estender a componentes novos — sempre usando tokens. |
| CSS do módulo | Apenas layout e particularidades do módulo. | Sim — **somente com `var(--lr-…)`**, jamais cores/valores fixos. |

### Regra de ouro
```css
/* ❌ NUNCA */
.card { background: #1F2630; border-radius: 6px; color: #F2F2F2; }

/* ✅ SEMPRE */
.card {
    background: var(--lr-surface);
    border-radius: var(--lr-radius);
    color: var(--lr-text-1);
}
```

---

## 3. Paleta oficial

### Fundos e superfícies (a "pedra" e o "ferro")
| Token | Hex | Uso |
|---|---|---|
| `--lr-bg-0` | `#0E1117` | Fundo principal da página |
| `--lr-bg-1` | `#161B22` | Fundo secundário, campos de formulário, chips |
| `--lr-surface` | `#1F2630` | Cards, painéis, modais |
| `--lr-surface-2` | `#262E3A` | Superfície elevada (hover, elementos aninhados) |
| `--lr-border` | `#30363D` | Bordas padrão |
| `--lr-border-soft` | `#262C33` | Divisores internos discretos |

### Texto
| Token | Hex | Uso |
|---|---|---|
| `--lr-text-1` | `#F2F2F2` | Texto principal |
| `--lr-text-2` | `#A8B3C2` | Texto secundário, rótulos, placeholders |
| `--lr-divine` | `#F6F7FB` | Branco Divino — títulos e destaques máximos |

### Cores de significado (as "Essências")
| Token | Hex | Significado no sistema |
|---|---|---|
| `--lr-gold` / `--lr-gold-2` | `#D4AF37` / `#E5C558` | **Ação primária**, foco, aba ativa, destaque nobre. É a cor da marca — usar com parcimônia ("ouro discreto"). |
| `--lr-bronze` | `#9D6B2F` | Ação secundária, elementos envelhecidos |
| `--lr-arcane` / `--lr-arcane-2` | `#3AA6FF` / `#7CC0FF` | Informação, links, magia arcana |
| `--lr-abyssal` / `--lr-abyssal-2` | `#5B3FB8` / `#8A6FE0` | Místico, raro, abissal |
| `--lr-nature` | `#3FAE6A` | Sucesso, cura, natureza |
| `--lr-blood` / `--lr-blood-2` / `--lr-blood-3` | `#8B1E2D` / `#C94F5C` / `#E08A93` | Perigo/erro. `--lr-blood` para **fundos**; `-2` e `-3` para **texto** (legibilidade em fundo escuro). |

Cada cor de significado tem uma versão translúcida para fundos de chips/alerts:
`--lr-gold-soft`, `--lr-arcane-soft`, `--lr-abyssal-soft`, `--lr-nature-soft`, `--lr-blood-soft`.

⚠️ **As cores nunca dependem de conteúdo.** Não existe "cor da classe Mago" ou "cor de
inventário" — existem cores de *significado de componente* (primário, informação, sucesso,
perigo, místico). O sistema é data-driven: qualquer conteúdo futuro usa as mesmas cores.

---

## 4. Tipografia

| Papel | Fonte | Token | Uso |
|---|---|---|---|
| Títulos (`h1`, `h2`) | **Cinzel** | `--lr-font-title` | Letras "lapidadas em pedra". Sempre com `letter-spacing: var(--lr-track-title)`. |
| Subtítulos (`h3`, `h4`) | **Cormorant Garamond** | `--lr-font-subtitle` | Caligrafia de estudioso. |
| Texto e interface | **Inter** | `--lr-font-body` | Todo o resto: parágrafos, botões, inputs, tabelas, badges. |

Carregadas via Google Fonts (link no `<head>` + `@import` de fallback em
`lendas-reliquias.css`).

**Nunca usar fontes decorativas em textos longos.** Cinzel e Cormorant são exclusivas de
títulos curtos. Escala tipográfica: `--lr-fs-xs` … `--lr-fs-2xl`.

---

## 5. Forma, profundidade e movimento

| Aspecto | Regra | Tokens |
|---|---|---|
| **Raios** | Pouco arredondados, visual robusto de metal forjado. Nunca "pill"/círculos em contêineres. | `--lr-radius-sm` 4px · `--lr-radius` 6px · `--lr-radius-lg` 8px |
| **Sombras** | Profundidade suave, sem exagero. | `--lr-shadow-1/2/3` |
| **Brilhos** | Foco/hover pode "acender a runa" com um anel sutil. | `--lr-glow-gold`, `--lr-glow-arcane` |
| **Animações** | Curtas e discretas: **120–180ms**. Nada chamativo. Respeitar `prefers-reduced-motion` (já tratado em `tokens.css`). | `--lr-t-fast` 120ms · `--lr-t-base` 150ms · `--lr-t-slow` 180ms · `--lr-ease` |
| **Z-index** | Sempre pelos tokens, nunca números mágicos. | `--lr-z-sticky/dropdown/overlay/modal/toast` |
| **Espaçamento** | Escala fixa; nada de valores soltos. | `--lr-space-1` (4px) … `--lr-space-7` (48px) |
| **Ícones** | Linha fina, minimalistas, geométricos, inspiração em símbolos medievais. Sem ícones "cartoon" ou 3D. | — |

---

## 6. Assinaturas visuais dos componentes

Estas convenções já estão implementadas em `lendas-reliquias.css` e devem ser mantidas
em qualquer componente novo:

- **Botão primário:** fundo `--lr-gold` sobre superfície escura; hover clareia para
  `--lr-gold-2`; `:active` desloca 1px para baixo (metal pressionado).
- **Campos de formulário:** fundo `--lr-bg-1`, borda `--lr-border`; no foco a borda vira
  ouro com `--lr-glow-gold` — *a runa desperta*.
- **Aba ativa:** texto `--lr-gold-2`, fundo `--lr-gold-soft` e um **fio dourado inferior**
  (`inset 0 -2px 0 var(--lr-gold)`).
- **Modais:** superfície `--lr-surface` com **filete dourado no topo** (`border-top: 2px
  solid var(--lr-gold)`) e sombra `--lr-shadow-3`.
- **Toasts:** filete dourado à **esquerda**.
- **Tabelas:** cabeçalho em caixa alta `--lr-text-2`; hover de linha com tinta dourada a 5%.
- **Scrollbars:** finas, cor `--lr-border` — trilhos de ferro.
- **Seleção de texto:** fundo dourado translúcido.
- **Skeleton:** shimmer entre `--lr-surface` e `--lr-surface-2`.
- **Fundo do body:** gradiente de pedra com dois brilhos de Essência quase imperceptíveis
  (roxo abissal e azul arcano em `radial-gradient` de baixíssima opacidade).

---

## 7. Responsividade (prioridade absoluta)

Desktop e mobile oferecem **a mesma funcionalidade** — jamais uma versão simplificada.

**Mobile (≤768px):**
- A página inteira nunca rola horizontalmente (`overflow-x: hidden` no body).
- Tabelas largas rolam dentro do próprio contêiner (`.table-wrap`, `.table-container`).
- Campos de formulário com no mínimo 16px (evita zoom automático do iOS — já em `tokens.css`).
- Barras/toolbars compactas.

**Abas (regra especial):**
- Texto **nunca** quebra em duas linhas nem é ocultado (`white-space: nowrap`).
- A barra de abas (`.tabs`, `.tab-bar`, `[role="tablist"]`) usa **rolagem horizontal suave
  própria**, com scrollbar oculta — o layout nunca quebra.
- Altura consistente em todos os módulos.

**Desktop / ultrawide:**
- Contêineres principais limitados a 1560px e centralizados em monitores ≥1800px.

---

## 8. Temas

A identidade L&R é **escura por natureza**. O alternador de tema existente
(`/shared/theme.js`, classe `html.dark`) continua funcionando: o modo escuro apenas
**aprofunda levemente as superfícies** (`--lr-bg-0` → `#0A0D12` etc.). Ambos os modos
permanecem dentro da identidade oficial. Não criar temas claros de fundo branco.

`<meta name="theme-color">` de toda página é `#0E1117`.

---

## 9. Checklist para novos módulos / manutenção

Antes de dar merge em qualquer mudança de UI, confirme:

- [ ] Nenhuma cor, fonte, raio, sombra, transição ou z-index em valor fixo — tudo via `var(--lr-…)`.
- [ ] Página carrega, nesta ordem: CSS local → `tokens.css` → `lendas-reliquias.css` + link das fontes.
- [ ] Títulos em Cinzel, subtítulos em Cormorant Garamond, todo o resto em Inter.
- [ ] Estilizou **componentes**, não conteúdo (Cards, não "Classe"; Campos, não "Atributo"; Listas, não "Magia"; Tabelas, não "Inventário"; Badges, não "Perícia").
- [ ] Ação primária = ouro; informação = azul arcano; sucesso = verde natureza; perigo = vermelho sangue (texto com `--lr-blood-2/3`); místico = roxo abissal.
- [ ] Abas com `nowrap` + rolagem horizontal própria; sem quebra de layout no mobile.
- [ ] Animações entre 120–180ms; `prefers-reduced-motion` respeitado.
- [ ] Testado em mobile (~375px), tablet, desktop e ultrawide, sem rolagem horizontal da página.
- [ ] Nenhuma lógica, fluxo, regra de negócio ou estrutura de página foi alterada.

---

## 10. O que NUNCA fazer

- Nunca hardcodar cores/valores (nem "só dessa vez").
- Nunca remover os aliases legados de `tokens.css` (`--bg`, `--paper`, `--ink`, `--muted`,
  `--line`, `--soft`, `--chip`, `--accent`, `--primary`, `--success`, `--danger`,
  `--warning`, `--secondary`) — módulos antigos dependem deles.
- Nunca estilizar por conteúdo/dado (o sistema é data-driven; conteúdos vêm do Painel do
  Criador e mudam a qualquer momento).
- Nunca usar pergaminho como base da interface, visual cartoon, neon futurista, steampunk,
  cantos muito arredondados, sombras pesadas ou animações longas/chamativas.
- Nunca esconder ou quebrar o texto de uma aba.
- Nunca criar uma "versão mobile simplificada".

---

*Documento mantido junto ao código. Se a identidade evoluir, atualize **primeiro** este
manual e os tokens — nunca os módulos individualmente.*
