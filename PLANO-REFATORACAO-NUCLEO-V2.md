# Plano de refatoração — Núcleo v2 (executável)

Segunda versão do plano, reescrita depois das suas decisões: **sem playtest**, corte agora; a coleção legada `characters` some; tudo continua cadastro e mais coisas viram cadastro; o Criador ganha campos configuráveis; faxina geral de código; e um documento final por página. A ordem abaixo é a ordem em que estou executando, fase a fase, com commit por fase no branch `nucleo-v2`.

**O que já está feito antes deste plano:** branch `nucleo-v2` criado a partir de `with_vscode`; os três documentos e o script do livro commitados; backup completo do Firestore em `D:\Imagem\US - Universo Soberano\RPG\Reliera\Backup Firestore 2026-09-03` (um JSON por coleção, recursivo, mais `MANIFEST.json`, `firestore.rules`, `storage.rules`, `firebase.json`), gerado por `functions/v2-backup-firestore.mjs`, que fica no repositório para repetir antes de qualquer fase destrutiva.

---

## 1. Princípios de execução

1. **Dado antes de código.** As fórmulas moram em `system/data/mechanics`; a maior parte do trabalho é script em `functions/` com `--dry-run`, backup `_backup-*.json` e audit que rodado de novo responde "nada a fazer".
2. **Um corte, sem flag v1/v2.** O export local é o caminho de volta.
3. **Toda migração de ficha cobre `char`, `npcs` e `items`.** A `characters` deixa de existir na Fase A.
4. **Nada se perde.** O que não tem lugar no schema novo vai para um campo `legado` do próprio documento, nunca para o lixo.
5. **Regra que hoje é número no código vira cadastro** (`system/config/regras`). Se falta campo, cria o campo e migra o dado.
6. **Cadastro que hoje é lista fixa de campos vira schema editável** (`system/config/campos/{colecao}`), com um renderizador só.
7. **Versão de cânone sobe** em tudo que o jogador lê.
8. **Faxina só do que está provadamente morto:** o varredor de referências e o censo decidem, não a intuição.
9. Cada fase termina com testes verdes (`node --test`), harness no navegador quando mexe em tela, e commit.

---

## 2. As fases, na ordem de execução

Tamanho: P (horas), M (um dia), G (dois a três dias de trabalho contínuo).

### Fase A — Fundação · M

- **A1** Branch e backup. Feito.
- **A2** `characters` → `char`. São 13 fichas do sistema antigo (v1.6: atributos soltos, `skills` por nome, `containers` e `allies` embutidos), última edição em 2025, nenhuma colisão de id com `char`. Script `v2-migra-characters.mjs`: cria em `char` um documento com o mesmo id, convertendo o que tem equivalente (`fields` nome/idade/jogador/raça/classe/virtude/vício, `dots` de atributos e das perícias que casam por nome, vitais, `ownerUid`/`userEmail`, notas, imagem) e guardando o documento inteiro em `legado`; marca `origem: 'characters'` e `createdVia: 'migracao-characters'`. Depois apaga os 13 de `characters`. Código: `functions/index.js:655` (cai o fallback), `firestore.rules:253` (cai o bloco), rótulos de log em `painel-mestre/js/area-mesas*.js` passam a `'char'`, README.
- **A3** Ferramentas: `v2-censo.mjs` (conta tudo por coleção e imprime o resumo para comparar antes e depois) e `v2-refs.mjs` (varre toda equação de `mechanics`, `derivedValues`, `equipment`, `classModules`, `peculiarities`, `conditions` e lista cada referência a perícia, VD, item e mecânica; acusa órfã).
- **Portão:** censo e varredor commitados e limpos; `characters` com zero documentos; regras sem o bloco.

### Fase B — Cadastro universal · G

É a frente que você pediu: o Criador configurar qualquer regra e qualquer campo.

- **B1 Regras como cadastro.** Doc `system/config/regras` com os números do Livro que hoje estariam no código: botões do Narrador (+2/−2/−4), crítico (+2 Graus), defesas grátis por rodada (1, +1 com escudo), custo da defesa extra (1 Energia), faixas de Ferimento (75/50/25), multiplicadores de EXP (atributo 5, resto 4, Dom 10), fórmula de Carga, tabela de Patamar, teto de Harmonia e de Carga, tempo de morte do sangue. Loader (`system-data-loader.js`) carrega `system/config/*` junto de `system/data/*` e expõe `window.REGRAS`; Tabuleiro e wizard leem de lá. Criador ganha a aba **Regras** (formulário gerado do próprio doc).
- **B2 Campos configuráveis.** Viabilidade: **sim**, porque o projeto já tem um sistema de schema para os itens de módulo de classe (`classModules.schema[]`, com tipos texto, número, select, select_vd, checkbox, redutor com equação, somente-leitura) e o editor desse schema no Criador (`painel-mechanics.js`). O que falta é generalizar: um doc `system/config/campos/{colecao}` por cadastro (npcs, races, classes, tribes, equipment, conditions, escolas, ramos) com a lista de campos {chave, rótulo, tipo, seção, ondeAparece: painel/ficha/tabuleiro/wiki, função: narrativo/mecânico/equação, ordem}, um renderizador único `shared/campos-dinamicos.js` (render e coleta, reaproveitando os tipos do schema de módulo), e a aba **Campos** no Criador para adicionar, fundir, esconder e reordenar campos por coleção. Os campos fixos de hoje viram entradas do schema na migração (nada some); o bloco "Lore" do NPC é o primeiro a usar, depois raças, classes, tribos, itens e condições. Campo com função mecânica aponta para uma mecânica (`mecanicaIds`, padrão que já existe); campo com função equação vira um valor calculado que aparece onde o schema disser.
- **B3 Escola e Ramo como coleções.** `system/data/escolas` (nome, perícia, formas, tributo, desastre, compêndio, leis em texto) e `classModules` com `escolaId` (o ramo). Classe = lista de ramos. Criar escola nova, ramo novo ou classe nova passa a ser cadastro puro.
- **Portão:** Criador cria uma escola, um ramo e um campo novo de NPC sem tocar em código; NPC antigo abre com os mesmos campos de antes.

### Fase C — Sistema v2 no dado e no motor · G (a maior)

Ordem por dependência; cada item é um script com dry-run, backup e audit, mais o código mínimo.

- **C1 Perícias e EXP.** `skills` 102 → 40 (Percepção em RAC, Lábia, Precisão e Prestidigitação gerais, Arremesso, fusões, 8 Perícias de Escola, um atributo por perícia, `custoEvolucao` 4). Equações de Iniciativa, Deslocamento e Percepção reescritas. `v2-migra-dots.mjs` em `char` e `npcs` (fundida leva o maior nível; removida devolve EXP; exclusiva vira Perícia de Escola). Wizard: sai "5ª bolinha custa 2", grupos 8/8/8/8. EXP de habilidade de ramo = Qualidade × 4; Dom com nível 4N.
- **C2 Domínio vira perícia.** 16 Domínios despublicados e fora das classes; `equipment.dominioId` e `classModules.dominioId` viram `periciaId`; `shared/dominio-redutor.js` lê `dots[periciaId]`; EXP de Domínio Nv2+ devolvido.
- **C3 Item.** `equip-campos.js`: saem Liga, Integridade, blindagemQ0; entram `afiacaoArcana` + `essenciaArcana` (uma), `reforcoArcano`, `encantamento`, `aura`. 36 proteções com `blindagem = classe + Q + reforco` e espelho da penalidade de DES em `Defesa: Esquiva`. 31 VDs de canal despublicados; `Blindagem Arcana` único. `inventario-motor.js` troca Integridade por `danificada`. `tab-conflito.js` resolve física contra Blindagem e Essência contra Arcana. Criador: formulário de equipamento.
- **C4 Defesa e combate.** Três VDs de defesa (= perícia; Bloquear + Q do escudo, teto VIG); os outros despublicados; `tab-conflito-calc.js` (defesa gasta ao declarar, 1 grátis, +1 com Bloquear e escudo, contra-ataque pelo Aparar, crítico = Alvo + 2 sem passar Defesa maior, sem Absorver); `tab-conflito.js` (menu de três, Evadir 2 m, Proteger no Bloquear); `derived-values.js` sem o clamp; Ambidestria como Dom de 3 níveis; Desarmar/Derrubar/Agarrar como itens de um módulo "Ações de combate" de todos.
- **C5 Condições.** 61 → 12 + Aflições, com `portao: direto|corpo|mente|nenhum`; sai `chance`; fichas com condição despublicada recebem a equivalente; `tab-turno.js` compara Graus com VIG/PRS do alvo; participante ganha `resistencias` por cena; Aflição com `cura` por potência; Criador: formulário de condição.
- **C6 Energia e contadores de cena.** ENER_MAX = `PRS + AUT + max(Artes)` (operador `max` no motor); Graça despublicada e preces em Energia; Harmonia e Carga viram `classModules.contador` (nome, teto, sobe, desce); `combate-cenas.js` e `skill-custo.js` entendem contador; `tab-turno.js` roda o crescendo do Bardo e as fontes de Carga; `tab-render.js` mostra chip ao lado do token.
- **C7 Escola e Ramo aplicados.** Os módulos viram um por ramo com `escolaId` (Fase B3); Necromancia em linhas por Qualidade com Lealdade no Q5 (reaproveita `shared/moral.js`); peculiaridade de ramo dá o segundo ramo por 10 EXP.
- **C8 Desgaste, Sanidade, Poder.** Ferido/Grave/Beira automáticos pela Vitalidade (`combate-cenas.js`), teste de Beira no início do turno; Fome/Sede/Exaustão/Sobrecarga como condições de 3 níveis (Sobrecarga automática pelo inventário); Trauma como condição com nível, gatilho e origem; tabela de Colapso em `knowledge`; `shared/poder.js` puro com auto-teste, Poder e Patamar na ficha, no card de NPC e no Bestiário; Descanso Curto sai.
- **Portão de cada item:** testes do item verdes, audit da Régua reescrito para aquele número, harness no navegador quando há tela. Portão da fase: um combate inteiro no Tabuleiro com um personagem de cada classe, do início ao fim, sem consulta a código.

### Fase D — Telas · M

Criador (`painel-criador`): equipamento, condição, contador de módulo, escola, ramo, regras, campos. Mestre (`painel-mestre`): Vulnerável/Resiste, Trauma, Poder no card, NPC com campos dinâmicos. Ficha: Poder e Patamar, contadores de cena, três defesas na aba Combate. Wizard: grupos novos. Corre em paralelo a C, porque cada campo novo precisa de tela no mesmo dia.

### Fase E — Livros e cânone · M

Livro do Jogador 2.00 (caps. 2 a 7 pelo Livro de 12 Páginas; guia do site reescrito); Compêndios sem Dissonância, Dívida, ±1 das Vozes e perícias mortas; Régua §0, §1.1b, §4, §6, §12, §13 e capítulo 14 (contadores e trilhas); Bestiário regenerado com Blindagem única, Vulnerável/Resiste e Poder; varredura de termos mortos (Liga, Reflexo, Domínio, Graça, Chance, Observação, Agilidade, Determinação) em todo capítulo público; livro interno de 12 páginas marcado como aprovado.

### Fase F — Faxina · M

Só o que o censo e o varredor provarem morto: mecânicas órfãs em `mechanics` (343 hoje), VDs sem leitor, coleções vazias ou de um documento (`maneuvers`, `specializations`), `itemRules` e `maximo_itens`, campos que nenhuma tela lê, scripts `functions/__aplica-*`, `__audit-*`, `__diag-*` que já rodaram (ficam no histórico do git, saem da árvore), harness `__check-*.html` que testam código removido, `_backup-*.json` antigos em `functions/` (movidos para a pasta de backup no D:), `temp_path.txt`, `firestore-debug.log`. Nada de "parece inútil": cada remoção cita o varredor ou o grep que provou.

### Fase G — Deploy e documento final · P

Versões de `sw.js` e dos assets; suíte inteira verde; smoke test em ficha, wizard, Criador, Mestre e Tabuleiro; deploy; censo final comparado ao inicial; e o documento `O-QUE-MUDOU.md`: para cada página do site, o que ela faz agora, o que mudou e o que você precisa saber.

---

## 3. Ordem e dependências

```
A (fundação)
└─ B1 regras ─┐
└─ B2 campos ─┼─ C1 → C2 → C3 → C4 → C6 → C7 → C8
└─ B3 escolas ┘          └─ C5 ──┘
D corre junto de B e C · E depois de C · F depois de E · G no fim
```

Caminho crítico: A → B1 → C1 → C3 → C4 → C6 → C7 → C8 → E → F → G.

---

## 4. Riscos e cercas

| Risco | Cerca |
|---|---|
| Referência órfã em equação | `v2-refs.mjs` no fim de cada item da Fase C |
| Ficha perdendo EXP ou perícia | backup por ficha, audit "gasto + livre = total", ficha sintética por classe nos testes |
| Instância de item (`items`) divergindo do catálogo | todo script de item cobre `equipment` e `items` |
| NPC com formato próprio (`modulosClasse`) esquecido | toda migração cobre `char` e `npcs`; censo conta os tocados |
| Campo dinâmico quebrando tela antiga | migração cria o schema a partir dos campos fixos: a tela nova renderiza exatamente o que a antiga mostrava |
| Faxina apagando o que é lido por caminho indireto | remoção só com prova do varredor; tudo fica no git e no export |
| Régua acusando falso desbalanceamento | audit reescrito junto com o número |

---

## 5. O que fica registrado para você decidir depois

Os nomes dos três ramos sem nome (Necromancia, Pallomancia, Sonoromancia) entram como "[ramo]" no cadastro e você renomeia pelo Criador. Os números de playtest do Livro (crítico +2, teto de Carga, Patamar Graal, arco) entram em `system/config/regras`, editáveis pela aba Regras, com os valores recomendados.
