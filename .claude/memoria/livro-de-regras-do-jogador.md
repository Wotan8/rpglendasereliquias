---
name: livro-de-regras-do-jogador
description: "Livro-guia público no Escritório do Cronista (book-regras-jogador-v17) — 10 capítulos, IDs determinísticos, é a versão viva das regras"
metadata: 
  node_type: memory
  type: project
  originSessionId: 90bc9ee3-351e-44c5-a969-7a4474df3e04
  modified: 2026-08-12T02:17:04.068Z
---

Publicado em 29/07/2026 o **"Lendas & Relíquias — Livro de Regras do Jogador"** no
Escritório do Cronista: `worldbuilding-books/book-regras-jogador-v17` + 10 capítulos
`worldbuilding-articles/art-regras-jogador-01..10`, todos `public: true`, `order` 0–9.

Conteúdo: caps 1–7 adaptam os caps 0,1,2,5,6,7,8 do PDF v1.7 (cap 8 "Exploração"
estava vazio no PDF e foi preenchido com o "Mecânicas do Jogo" da v1.6.4, convertido
de parada de dados para Roll Under: sucessos → Graus). Caps 8–10 ensinam o site
(Menu/criação, Ficha, Tabuleiro/Biblioteca/Laboratorium).

**Regra editorial:** este livro descreve o sistema COMO ESTÁ NO SITE, não como está
no PDF — Energia (não Determinação), Carga em kg via Pressão, sem Especializações,
perícias em 4 grupos (6-4-3-2), Sanidade = (INT+AUT+PRS+Resiliência)×2 − Abismancia×2.
Ao mudar mecânica no banco, atualizar o capítulo correspondente.

**Revisão 30/07/2026** (fonte: `functions/prompt-livro-regras-combate.md`): Blindagem
por slot coberto (Leve 0,15 / Média 0,22 / Pesada 0,30 por slot; 15 slots; soma
arredonda p/ baixo), piso de dano 1, escudos 0,3/0,6/0,9/1,2, **Liga 0–5** (Sem
Liga/Bruta/Justa/Nobre/Pura/Superior) como teto de melhorias, Afiação/Reforço
(Ferreiro) e Afiação Mágica/Resistência Mágica (Forjarcanista): arma +5 dano/tier
cada, proteção +0,33/slot/tier cada. Atualizados caps 1, 2, 4, 5 (novo 5.5), 6 e 9.

**Correção 30/07/2026** (fonte: `functions/prompt-livro-regras-combate-correcoes.md`,
que SUBSTITUI o prompt anterior onde conflitar): graduações de armadura (Pesada III
etc.) NÃO existem — penalidade é própria de cada peça, e armadura nenhuma penaliza
Deslocamento (só Escudo de Torre). Piso de dano 1 é procedimento MANUAL de mesa, não
automação da ficha. Corpo = 13 slots de armadura + 2 de Mão (separados). Cap 5.4 agora
carrega o catálogo real e a cobertura por peça.

**Revisão 2 em 30/07/2026** (fonte: `RELATORIO-PROTECAO.md`, gerado do Firestore —
fecha o ponto aberto anterior): taxa Leve subiu 0,15 → **0,20**/slot; catálogo agora
tem **36 peças** (18 avulsas novas, uma por slot — linha "à la carte"). Cap 5.4
carrega o catálogo completo (com cobertura, peso e preço), os 3 avisos de compra
(avulsa pequena vale 0 sozinha e é esperado; peça a peça custa mais que o conjunto,
24k vs 20k; par é uma peça só) e os **tetos por classe na mesa: Leve 1 · Média 2 ·
Pesada 3** — não existe peça Leve de Pernas/Pés de propósito, é o que segura o teto
Leve. A Torneio tem Desloc −2. Armadura Leve: 4 slots/0,80/1.200 L$.

**Correção 30/07 (2ª):** o RELATORIO-PROTECAO tinha um bug — só lia penalidade em
`atributosVinculados`/`periciasVinculadas` e perdia as que moram como
`valoresDerivadosVinculados` negativos (Acerto e Desloc. Terrestre são VD). Os
escudos SEMPRE tiveram Acerto: Grande −1, Torre −2 (+Desloc −1). O Escudo Médio
nunca esteve dominado (é o maior escudo sem penalidade e o único equipável no
Braço). Livro re-corrigido; nada mudou no banco. Ao auditar penalidade de item,
SEMPRE varrer também os VDs vinculados negativos.

**Revisão 11/08/2026 (Combate v3):** reescrita grande mudou só o Capítulo 6 (`combate-v3-4-livro-cap6.mjs` e seguintes) — Defesa virou número fixo (não teste), Contra-Ataque, escada de Ambidestria etc. Como cada capítulo é um doc separado, os Caps 2 e 4 falam do mesmo combate só que na versão antiga e não foram tocados pelo script principal: sobraram 5 contradições diretas (Aumentar Reação vs. Defesa que não usa mais Reação como teste; Contra-Ataque descrito como "após defesa crítica" em vez do erro do atacante; Ambidestria e Reflexo com texto pré-v3; Contra-Ataque ausente da tabela de Usos da Energia). Corrigidas em `combate-v3-7-livro-desalinhos.mjs` e `combate-v3-8-livro-desalinhos-2.mjs`.

**Why:** o jogador consulta este livro pela aba Conhecimento/Biblioteca; se divergir
da ficha, a ficha vence — manter o livro sincronizado evita disputa de regras na mesa.

**How to apply:** IDs são determinísticos — o script de publicação pode ser rodado de
novo que atualiza em vez de duplicar; ou editar direto no Escritório do Cronista
(fonte da verdade pós-publicação). Ao reescrever regra de combate/mecânica que toca
mais de um capítulo, grep o termo antigo em TODOS os capítulos do livro (não só o
capítulo "dono" do assunto) — capítulos vizinhos costumam citar o mesmo conceito e
não recebem o patch sozinhos. Relacionado: [[especializacoes-removidas-do-sistema]],
[[padrao-de-cadastro-de-manobras]], [[compendios-magia-worldbuilding]].
