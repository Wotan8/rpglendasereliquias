---
name: redesign-portal-frontend
description: "Reforma do frontend em fase de protótipo — pasta rpglendasereliquias-redesign, Portal = login+menu+wiki numa página só; nada foi ao projeto real ainda."
metadata: 
  node_type: memory
  type: project
  originSessionId: f79cf139-6d0d-48f1-bde8-b88eef4118a0
  modified: 2026-08-09T22:16:07.177Z
---

Em 08/08/2026 começou a reforma do UI/UX de todo o site. Decisões fechadas:

- **Fase 1 é definição, fora do repo**: tudo vive em
  `C:\Users\Soberano\Documents\rpglendasereliquias-redesign\` (SPEC.md + protótipo
  em `portal/index.html`). Só implementar no projeto real após aprovação do usuário.
- **Portal**: `index.html` (login) + `menu/menu.html` viram UMA página com três
  estados — visitante / jogador / criador (role `criador` na coleção `users`).
  Login nunca redireciona; `onAuthStateChanged` troca o estado no lugar.
- **Wiki pública** = livros `worldbuilding-books` com `pub.geral` (função
  `pubDoLivro` de `shared/livros-pub.js`) + capítulos `worldbuilding-articles`
  com `status === 'publicado'`, campo `contentHTML`. Hoje só o Livro de Regras do
  Jogador (10 caps, ~110k chars) é Geral; compêndios são conhVinculo/mestre.
  A Wiki é data-driven: publicar Geral já faz aparecer.
- **Hero com sequência de imagens por scroll** (estilo Apple scrubbing): canvas +
  lerp, config do Criador (upload no Storage, doc `portal-config/hero`); fallback
  procedural (selo rúnico desenhado no canvas) quando não há imagens — a página
  nunca depende de asset. `prefers-reduced-motion` → quadro estático.
- Skills instaladas no projeto: `impeccable` e `ui-ux-pro-max` em
  `.claude/skills/`. O detector do impeccable acusa Inter como "overused font" —
  ignorar, Inter é a fonte de corpo do [[design-system]] (o brief vence).
- Scripts úteis: `functions/_export-wiki-json.mjs` (re-exporta o cânone pub.geral
  para o protótipo) e `functions/_audit-canone-wiki.mjs` (inventário de publicação
  dos livros).
- Anti-referência de pesquisa: World Anvil (poluído). Referência positiva:
  LegendKeeper (limpo, busca rápida). Padrão da página: doc-landing (busca
  proeminente + estante + leitor).

Ajustes de 08/08/2026 (feedback do usuário):
- **Tema claro de verdade** = padrão `.sheet` do menu original: body com
  `--bg-gradient`, conteúdo em folha `--lr-surface` (branca no claro), cards
  como chips `--lr-bg-1` dentro da folha. Botão dourado usa
  `color: var(--lr-bg-0)` (inverte com o tema sozinho).
- **Camada única**: componentes novos vivem em `shared/lr-ext.css` do protótipo;
  na implementação real fundem em `lendas-reliquias.css`. Página nenhuma define
  componente.
- **Fidelidade ao original** (varredura feita): Ficha tem 8 abas (Principal,
  Combate, Inventário, Peculiaridades, Aura, Aliados, Conhecimento, Notas);
  Painel Criador tem 18 módulos em sidebar + filtro busca/ordenar; Painel Mestre
  tem abas mesas/npcs/economica/apoio/livros/historico; Laboratorium é
  construtor de CIRCUITOS (paleta→canvas com nós/NvX→auditoria §6, 3 abas);
  menu tem loja com 2 modos (Frag OU R$ PIX/PagBank+reCAPTCHA) com metas
  atreladas no checkout, criação de personagem exige escolher mesa, exclusão
  com modal permanente.
- Cuidado: NUNCA editar arquivos UTF-8 do protótipo com Set-Content do
  PowerShell (mojibake) — usar as ferramentas Edit/Write.

**FASE 1 IMPLEMENTADA no repo real (09/08/2026)** — Portal = login+menu+wiki em
`menu/menu.html`, preservando 100% do menu-firebase.js (loja PIX/PagBank,
metas, notificações, exclusão, cargos):
- `menu/menu.html`: casca nova (topo fixo + hero + login embutido + mesa +
  wiki), TODOS os ids antigos preservados (createCharModal/lojaCheckoutQuantity
  são dinâmicos — não existem no HTML mesmo).
- `menu/js/menu-firebase.js`: sem redirect no onAuthStateChanged (else mostra
  #secaoLogin; eventos `portal:logado`/`portal:deslogado`); login+cadastro
  portados do index antigo (código de mestre MESTRE5253); `window.db` exposto;
  logout fica na página.
- `menu/js/menu-wiki.js`: wiki pub.geral (livros-pub.js), estante/leitor/busca;
  **rules exigem login para ler worldbuilding-books** → visitante vê convite.
- `menu/css/menu.css` (v14): bloco "PORTAL" no fim — folhas --lr-surface sobre
  gradiente (claro = branco de verdade), tokens only. Portão de contraste: ok.
- `index.html` = redirect para menu/menu.html (links antigos e logout de outras
  páginas continuam funcionando).
- Usuário testou logado e aprovou. Hero com selo rúnico guiado por scroll
  entrou na Fase 1 (`menu/js/menu-hero.js`, procedural, sem assets; logado =
  faixa compacta via body.portal-logado).
- Deploys: 808fd54 (sw v176) e correção e73161e (sw v177) — AO VIVO em
  rpg-lendasereliquias.web.app. Reverter = git revert dos dois + bump sw.
- Lições do hotfix e73161e: (1) atributo `hidden` PERDE para
  `display:grid/flex` de classe — sempre parear `.classe[hidden]{display:none}`;
  (2) a Wiki virou aba **Home** (padrão) DENTRO das tabs do menu; (3) hero
  anima para todos, lê `portal-config/hero` (leitura pública nas rules,
  escrita criador) com imagens em `app-assets/portal-hero/` no Storage —
  aba "Portal" do menu (cargo criador) faz upload/ordem/salvar; (4) o
  usuário exige: "Entrar na CONTA" (não "na mesa"), zero emoji como ícone
  (usar lr-icones.js), botões fantasma quadrados na toolbar.
- Fases seguintes: demais páginas (Ficha → Wizard → Mestre → Criador → WB →
  Laboratorium) seguindo os protótipos da pasta redesign.
