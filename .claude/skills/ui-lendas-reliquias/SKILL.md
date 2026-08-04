---
name: ui-lendas-reliquias
description: Parceiro de UI/UX e direção de arte para as páginas de Lendas & Relíquias. Use ao redesenhar ou refinar layout, hierarquia, densidade de dado, estados de tela ou aparência de uma página/módulo — e quando o usuário pedir para deixar algo "mais profissional", mais bonito, mais legível ou melhor de usar.
---

# UI/UX — Lendas & Relíquias

Fantasia medieval sombria e RPG. O alvo é **produto profissional que por acaso é
temático** — não site de fã. Em interface amadora o tema é decoração por cima; na
profissional a estrutura obedece disciplina de produto e o tema vive na paleta, na
materialidade e em poucos detalhes caros.

## Leia antes de propor qualquer coisa

`DESIGN-SYSTEM.md` na raiz é normativo — paleta, tipografia, forma, movimento,
responsividade, checklist e a lista do que nunca fazer. Este projeto **já tem
design system fechado**: sua entrega é conformidade e extensão dele, nunca um
sistema paralelo.

Três camadas, nesta ordem em toda página:
`CSS local do módulo` → `shared/tokens.css` → `shared/lendas-reliquias.css`.

| Camada | Pode editar? |
|---|---|
| `shared/tokens.css` | Só com aprovação explícita do usuário. Nunca remover os aliases legados (`--bg`, `--paper`, `--ink`, `--muted`, `--line`, `--soft`, `--chip`, `--accent`, `--primary`, `--success`, `--danger`, `--warning`, `--secondary`). |
| `shared/lendas-reliquias.css` | Sim, para estender a componentes novos — sempre via token. |
| CSS do módulo | Sim, só layout e particularidades — **somente `var(--lr-…)`**. |

Token novo entra primeiro em `tokens.css` + `DESIGN-SYSTEM.md`, nunca direto no
módulo. Cor, fonte, raio, sombra, transição ou z-index em valor fixo: proibido,
nem "só dessa vez".

## Dois temas, sempre

`shared/theme.js` segue a preferência do SO e o usuário alterna. Claro =
pergaminho (papel `#F7F6F1`, tinta escura); escuro = pedra e ferro. **Os dois usam
os mesmos nomes de token**, então toda decisão precisa se sustentar nos dois —
"escurecer o fundo" não é alavanca disponível. Ouro, arcano e abissal têm versões
distintas por tema justamente porque o ouro claro não é legível em papel.

## O que faz parecer profissional

Disciplina, não ornamento: escala de espaçamento única aplicada sem exceção;
hierarquia por tamanho, peso, cor e espaço — nunca por borda ornamentada ou brilho;
um sistema de sombra e um de raio, os que já existem; espaço vazio generoso é sinal
de acabamento; acento usado com parcimônia — se o ouro aparece em tudo, deixa de
significar "importante".

Ornamento escasso e caro: superfícies calmas, com artesanato concentrado em dois ou
três pontos de alta atenção por página. Materialidade vem de ferro oxidado, couro
engraxado, pedra, cera e luz de vela — sugeridos em textura de baixa opacidade,
nunca literais.

**Proibido:** blackletter ou Papyrus fora de um título isolado · *textura* de
pergaminho como papel de parede (papel como superfície é o tema claro — isso é
outra coisa) · borda ornamentada em cada caixa · dourado com bisel · sombra em
texto · gradiente em botão · mais de um elemento decorativo disputando atenção na
mesma tela · cantos muito arredondados · neon futurista, cartoon, steampunk.

O anel de foco dourado (`--lr-glow-gold`) **não** é o "dourado com brilho"
proibido — é estado funcional.

## Duas regras que quebram mais do que parecem

1. **Nunca estilize por conteúdo.** O sistema é data-driven; o conteúdo vem do
   Painel do Criador e muda a qualquer momento. Estilize Card, Campo, Lista,
   Tabela, Badge — nunca "Magia", "Perícia", "Atributo", "Classe".
2. **Abas.** Texto nunca quebra em duas linhas nem é ocultado (`nowrap`); a barra
   (`.tabs`, `.tab-bar`, `[role="tablist"]`) tem rolagem horizontal própria com
   scrollbar oculta. É onde o layout quebra no celular — e a mesa usa celular de
   verdade.

## Layout e densidade

Uma ação primária por tela, posição consistente entre páginas, agrupamento por
proximidade, revelação progressiva em vez de tudo exposto de uma vez. O dado aqui é
denso (ficha, inventário, log de combate, mapa, listas longas): planeje
explicitamente onde cabe tabela, onde cabe card, o que colapsa, o que fica fixo e
como o olho escaneia a tela.

Mobile e desktop entregam **a mesma funcionalidade** — jamais versão simplificada.
A página nunca rola horizontalmente; tabela larga rola dentro do próprio contêiner;
contêiner principal limitado a 1560px, centralizado em monitores ≥1800px. Tema
nunca prejudica leitura de dado: se a ambientação atrapalhar legibilidade, alvo de
toque ou clareza de estado, a ambientação cede.

Especifique sempre os estados que todo mundo esquece: vazio, carregando, erro, sem
permissão e lista longa demais.

## Movimento

Dinamismo é feedback, não enfeite. Toda ação responde em menos de 100ms com algum
sinal visual; transições usam `--lr-t-fast` / `--lr-t-base` / `--lr-t-slow`
(**120–180ms** — não invente durações); movimento comunica origem, destino e
hierarquia. Nada de animação em loop, parallax pesado ou entrada animada em
elemento que a pessoa vê toda vez. `prefers-reduced-motion` **já está global** em
`tokens.css` — não reimplemente.

## Portões antes de entregar

```bash
node shared/contraste.test.mjs
```

Ele varre todo o CSS do repo, resolve a cadeia de `var()` contra a paleta real e
mede contraste nos DOIS temas (mínimo 4,5:1) — é também o que pega hex cravado na
mão. Passou? Então confira o resto:

- [ ] Nenhum valor fixo de cor, fonte, raio, sombra, transição ou z-index — tudo
      via `var(--lr-…)`.
- [ ] Títulos em Cinzel, subtítulos em Cormorant Garamond, resto em Inter — sem
      quarta família.
- [ ] Ação primária = ouro; informação = azul arcano; sucesso = verde natureza;
      perigo = vermelho sangue; místico = roxo abissal.
- [ ] Testado em ~375px, tablet, desktop e ultrawide, sem rolagem horizontal da
      página.
- [ ] Abas com nowrap + rolagem própria, sem quebra no mobile.
- [ ] Mexeu na ficha ou no laboratorium? Confira o `print.css` — layout novo pode
      quebrar a impressão.
- [ ] **Nenhuma lógica, fluxo, regra de negócio ou estrutura de dado foi alterada.**

## Como trabalhar

Uma página por vez. Antes de desenhar, pergunte só o que ainda falta: qual página,
quem usa (mestre ou jogador — a permissão muda a tela) e qual a tarefa principal.

**Não** pergunte stack: é HTML/CSS + ES modules servidos estáticos, sem bundler —
nunca proponha Tailwind, React ou qualquer dependência de build. **Não** pergunte
"mobile ou desktop primeiro": os dois, mesma funcionalidade.

Entregue em nível implementável: estrutura da página, anatomia do componente com
todos os estados, breakpoints e o CSS pronto usando os tokens existentes.

Feche com autocrítica curta: qual regra do `DESIGN-SYSTEM.md` sua proposta chegou
perto de violar, o que ainda parece amador e o que você cortaria.
