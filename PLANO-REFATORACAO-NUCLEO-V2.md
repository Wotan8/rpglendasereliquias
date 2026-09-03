# Plano de refatoração — Núcleo v2

Refatoração do projeto inteiro (banco, motor, ficha, criação, Criador, Mestre, Tabuleiro, livros) para o sistema do `LIVRO-DE-12-PAGINAS.md`. O plano foi montado sobre o mapa real do código: onde cada mecânica mora hoje, qual coleção ela lê e qual teste quebra. A maior descoberta desse mapa muda a estratégia inteira: **as fórmulas não estão no código**. Defesa, Blindagem, Sanidade Máxima, Energia Máxima, Iniciativa e Deslocamento moram em `system/data/mechanics` e são resolvidas por equação. Logo, a maior parte desta refatoração é **migração de dado com script**, no padrão que o repositório já usa (`--dry-run`, backup `_backup-*.json`, audit), e o código de verdade se concentra em cinco arquivos.

---

## 1. Princípios

1. **Dado antes de código.** Tudo que for equação, custo, lista ou campo muda por script em `functions/`. Código só onde a regra não é expressável em equação (gasto de defesa, portão de condição, contador de cena, Poder).
2. **Um corte, não dois sistemas.** Não haverá flag "v1/v2" no código: manter dois conjuntos de regras dobra o trabalho e o risco. A mesa joga no v1 até o dia do corte; o corte é um dia com export do Firestore antes.
3. **Toda migração cobre `char`, `characters`, `npcs` e `items`** (instâncias). Já houve migração que esqueceu `npcs` e quebrou um NPC em silêncio.
4. **Despublicar, não apagar** vale para peculiaridade e perícia (ficha antiga precisa resolver o que já tinha). Módulo fundido com dado migrado se apaga.
5. **Todo script tem `--dry-run`, conta ocorrências, grava backup e deixa um audit** que, rodado de novo, responde "nada a fazer".
6. **Versão de cânone sobe** em tudo que o jogador lê (livros, capítulos, itens, condições, classes).
7. **Régua acompanha:** cada fase que mexe em número termina com o audit correspondente recalibrado, não com o audit antigo acusando falso desbalanceamento.
8. **Verificação no navegador** pelos `__check-*.html` existentes, mais um por fase que mexe em tela.

---

## 2. Onde as mecânicas moram hoje

| Mecânica | Dado (Firestore) | Código | Testes que quebram |
|---|---|---|---|
| Defesa (8 perícias, Reflexo − 1, contra-ataque, Absorver) | `derivedValues` bloco `defesa` + `mechanics` | `tabuleiro/js/tab-conflito-calc.js` (motor puro), `tab-conflito.js`, `ficha-v1.7_1/js/derived-values.js` (clamp piso/teto), `mechanics-engine.js:86-92` | tab-conflito-calc, tab-ajustes-conflito, tab-acerto-portao, piso-defesa |
| Dano tipado, 17 Blindagens, piso 1 | 31 `derivedValues` de canal | `tab-conflito.js:154-168` (`blindagemDe`), `derived-values.js:1157` (`espelhaVD`), `tab-golpes.js` | magia-linha-ataque, tab-postura, teto-de-itens |
| Escada do item (Liga, Q, Afiação, Reforço, Integridade) | `equipment` (253), `items` | `shared/equip-campos.js`, `shared/inventario-motor.js:266-346`, `shared/restaurar-item.js` | equip-campos, integridade, inventario-motor, item-props, projetil-props, equacao-min |
| Domínio e redutor | `peculiarities` (16 Domínios), `classModules.dominioId`, `equipment.dominioId`, `char.dots` | `shared/dominio-redutor.js` (puro), `class-modules-renderer.js:1162`, `tab-ficha-win.js:1328` | auto-teste do dominio-redutor, magia-linha-ataque, runa-em-jogo |
| Slots e Pressão | `bodyParts`, `equipment` (contêiner) | `shared/equip-slots.js`, `inventory.js`, `inventario-motor.js` | equip-slots, conteiner-regras |
| Sanidade | `vitalStats` SAN_MAX → `mechanics` | resolução em `mechanics-engine.js`; cobrança em `tab-turno.js:1391` | sanidade (é auditor de registro, não mecânica) |
| Condições | `conditions` (61) | `tab-combat.js:803-1095`, `shared/combate-cenas.js:296-421`, `tab-turno.js:1121,1650`, `shared/skill-runtime.js`, `shared/runa-em-jogo.js` | combate-cenas, condicao-por-faccao, tab-condicao-nivel, skill-runtime, tab-acerto-portao |
| EXP | `skills.custoEvolucao`, `classModules.custoExpPorItem`, `peculiarities.niveis[].custoExp` | `exp-upgrade.js`, `class-modules-renderer.js:1050`, `criar-personagem/js/peculiarities-module.js`, `data.js:25-45` | exp-*, compra-exp, distribuicoes, teto-desvantagens, avulsa-herdada |
| Energia, Vitalidade | `vitalStats` ENER_MAX / VIT_MAX → `mechanics` | `system-data-loader.js:938`, `mechanics-engine.js:1428` | — |
| Recursos de classe (Graça, Harmonia, Bolha) | `derivedValues` com Atual | `shared/combate-cenas.js:181-214`, `tab-render.js:589`, `shared/skill-custo.js`, `shared/retorno-recurso.js` | skill-custo |
| Skills de classe, mira, custo | `classModules` (schema, itensPredefinidos) | `shared/skill-runtime.js`, `skill-custo.js`, `predef-campos.js`, `tab-turno.js` | skill-runtime, tab-mira-cadastro, predef-campos |
| Iniciativa, Deslocamento, Percepção | `derivedValues` + `mechanics` (Agilidade e Observação entram pela equação) | `tab-state.js:514-884`, `tab-hud.js:327` | tab-state |
| Livros | `worldbuilding-books`, `worldbuilding-articles` | scripts `functions/livro-*.mjs` | — |

Hubs de código, em ordem de quanto vão mudar: `tab-conflito-calc.js`, `tab-conflito.js`, `shared/equip-campos.js`, `shared/inventario-motor.js`, `shared/combate-cenas.js`, `tab-turno.js`, `derived-values.js`, `dominio-redutor.js`, `skill-custo.js`, `painel-criador/js/painel-firebase.js`.

---

## 3. As fases

Ordem por dependência. Cada fase tem entrada (o que precisa estar pronto), saída (o que fica pronto) e um portão (o que prova que fechou). Tamanho: P (um dia), M (dois a três), G (uma semana).

### Fase 0 — Playtest e decisões (sem código) · M

**Entrada:** o Livro de 12 Páginas, já publicado como interno no Cronista.
**Trabalho:** três sessões jogadas só com o livro, ignorando o site onde ele diverge; as 11 decisões do redesenho fechadas em mesa; os números de playtest (crítico +2, teto de Carga, Patamar Graal, arco) validados ou trocados; nomes dos três ramos sem nome; registro em `session-logs`.
**Saída:** `LIVRO-DE-12-PAGINAS.md` v1.01+ com as decisões aplicadas, republicado.
**Portão:** o Livro não tem mais nenhum "[ramo]" nem "número de playtest".

### Fase 1 — Preparação técnica · P

**Trabalho:** branch `nucleo-v2`; `gcloud firestore export` completo; um script `functions/v2-audit-estado.mjs` que imprime o censo do banco (perícias, VDs, mecânicas, condições, itens, pecs, módulos, fichas por coleção) para comparar antes e depois; um `functions/v2-refs.mjs` que varre **todas** as equações de `mechanics`, `derivedValues`, `equipment` e `classModules` e lista cada `Perícia: X`, `Item: X` e nome de VD referenciado. Esse varredor é o que impede a Fase 2 de deixar referência órfã.
**Portão:** o censo e o varredor rodam limpos e estão versionados.

### Fase 2 — Perícias e EXP (dado + duas fichas) · M

**Dado:**
- `system/data/skills`: 102 → 40. Script `v2-pericias.mjs`: Observação → Percepção (RAC, grupo mental); Malandragem → Lábia (MAN); Arremessar → Arremesso (DES); Precisão e Prestidigitação viram gerais; Agilidade, História e Tradição despublicadas (fundidas em Acrobacia, Erudição, Erudição/Diplomacia); Domar para o grupo Físico; Bloquear para VIG, Aparar para FOR; despublicar Desviar, Evadir, Cobertura, Proteger, Absorver, Reflexo, Contra-Ataque, Desarmar, Ambidestria; as 58 exclusivas viram 8 Perícias de Escola (Hemomancia INT, Abismancia PRS, Necromancia PRS, Pallomancia PRE, Sonoromancia PRE, Totemancia PRE, Runomancia INT, Alquimancia RAC), com as demais despublicadas; um atributo por perícia; `custoEvolucao` = 4 em todas.
- `system/data/mechanics`: reescrever as equações que citam perícia fundida ou removida (o varredor da Fase 1 dá a lista): Iniciativa = `RAC + DES`; Deslocamento Terrestre = `FOR + DES + Tamanho`; Percepção = `RAC + Perícia: Percepção`; Sanidade Máxima continua.
- Fichas (`char`, `characters`, `npcs`): script `v2-migra-dots.mjs` funde `dots` (perícia fundida leva o maior nível; perícia removida devolve o EXP ao `fields.exp` pela tabela nova), converte as exclusivas para a Perícia de Escola (maior nível entre as antigas) e devolve o resto. Backup por ficha.
- EXP: `classModules.itensPredefinidos[].custoExpProprio` = Qualidade × 4; `peculiarities.niveis[].custoExp` = nível × 4; Dom sem nível = 10.

**Código:** `criar-personagem/js/data.js:25-45` (sai "5ª bolinha custa 2"; grupos 8/8/8/8 na tela de perícias); `criar-personagem/js/peculiarities-module.js` (níveis a 4N); `ficha-v1.7_1/js/exp-upgrade.js` não muda (lê `SKILL_COSTS`).
**Testes:** exp-multinivel, exp-restante-total, compra-exp, distribuicoes, avulsa-herdada; novo `v2-migra-dots.test.mjs` com uma ficha sintética de cada classe.
**Portão:** varredor de referências em zero órfãos; audit de EXP das fichas fechando (EXP gasto + EXP livre = EXP total).

### Fase 3 — Domínio vira perícia · P

**Dado:** despublicar os 16 Domínios; tirá-los de `classes.peculiaridadeIds` e `bonusIniciais` (o script `limpa-pec-despublicada-em-classe.mjs` já faz a varredura); `equipment.dominioId` e `classModules.dominioId` passam a apontar para a **chave da perícia** (`sk_combate_arma`, `sk_escola_hemomancia`…), campo renomeado para `periciaId`; devolver às fichas o EXP dos Domínios Nv2+.
**Código:** `shared/dominio-redutor.js`: `nivelDoDominio` lê `dots[periciaId]` em vez de `dots['pec_'+dominioId]`; `focoLiquido` e `redutorDoDominio` não mudam; auto-teste atualizado. Os dois chamadores (`class-modules-renderer.js`, `tab-ficha-win.js`) só trocam o nome do campo.
**Portão:** `node shared/dominio-redutor.js` verde; chip de redutor na ficha mostrando `Alvo − (Q − perícia)` nos dois harness `__check-redutor-*.html`.

### Fase 4 — Item: Qualidade, Afiação, Encantamento, Aura · G

**Dado (`equipment` 253 + `items` vivos):** script `v2-item.mjs`: esvaziar `liga`, `integridadeBase`, `blindagemQ0`; `afiacaoArcana` por canal colapsa em `afiacaoArcana` (número) + `essenciaArcana` (uma); `reforco` por região vira `reforco` + `reforcoArcano` do conjunto; campos novos `encantamento` (ref a condição direta ou efeito) e `aura` (0–5); as 36 proteções recebem `blindagem = classe + qualidade + reforco` (tabela 1/2/3 por classe) e um espelho `valoresDerivadosVinculados` de `Defesa: Esquiva` igual à penalidade de DES da peça; despublicar os 31 VDs de canal (17 Blindagens tipadas e 14 Danos por Essência) e criar `Blindagem Arcana` como VD único com Atual 0.
**Código:** `shared/equip-campos.js` (schema: sai Liga/Integridade/blindagemQ0, entram encantamento/aura/essenciaArcana); `shared/inventario-motor.js` (saem `integridadeMax/De/Zerada/perdaFalhaCritica`; entra `danificada` como −1 Q); `ficha-v1.7_1/js/derived-values.js` (sai `espelhaVD` de canal); `tabuleiro/js/tab-golpes.js` (`metaDoGolpe` expõe parcela física + parcela de Essência); `tabuleiro/js/tab-conflito.js` (`blindagemDe` vira: física contra `Blindagem`, Essência contra `Blindagem Arcana`; fraqueza vira tag Vulnerável/Resiste no NPC); Criador: formulário de equipamento em `painel-criador/js/painel-firebase.js`.
**Testes:** equip-campos, inventario-motor, item-props, projetil-props, restaurar-item, magia-linha-ataque; apagar integridade e teto-de-itens; novo `v2-item.test.mjs` (arma Q3 + Afiação 2 + Ígnea 1 contra Blindagem 2 e Arcana 0 dá o dano do livro).
**Régua:** `audit-graus.mjs` reescrito para a escada `classe + Q`; `preco-modelo-protecao.mjs` recalibrado.
**Portão:** curva pareada Q0→Q5 batendo 4,0 / 4,6 / 5,5 rodadas por classe de armadura no audit.

### Fase 5 — Defesa e combate · G

**Dado:** `derivedValues` bloco `defesa`: ficam `Defesa: Esquiva`, `Defesa: Aparar`, `Defesa: Bloquear`, equação = a perícia (sem −1, sem clamp) e Bloquear + `Item: Qualidade` do escudo (teto VIG); os outros cinco VDs de defesa despublicados; `Reação` despublicado; Ambidestria vira peculiaridade com 3 níveis; as manobras Desarmar/Derrubar/Agarrar viram itens de um módulo "Ações de combate" disponível a todos, com `condicoesAplicadas` no portão do corpo.
**Código:** `tabuleiro/js/tab-conflito-calc.js`: `defesasLivres` = 1 (+1 se a defesa for Bloquear com escudo); "declarar gasta" (hoje só o golpe que passa gasta); `podeContraAtacar` exige Aparar declarado, não a perícia Contra-Ataque; sai `absorverResolve`; `golpePassa(critico)` deixa de ser automático: Graus = Alvo + 2 e compara com a Defesa; `tab-conflito.js`: menu de defesa com três opções, botão "Evadir 2 m" após Esquiva bem-sucedida, Proteger só no Bloquear; `derived-values.js` sai o clamp piso 0 / teto min(DES, RAC); `tab-turno.js` penalidade de duas armas lê o Dom Ambidestria.
**Testes:** tab-conflito-calc, tab-ajustes-conflito, tab-acerto-portao, tab-encerrar-conflito; apagar piso-defesa; novo `v2-defesa.test.mjs` com os seis perfis do painel (todos entre 4,0 e 6,5 rodadas).
**Régua:** §0.2 recalibrado (Esquiva 2 em Meia-Armadura = Defesa 1 = 60%, idêntico); `audit-base-regua.mjs` rodado.
**Portão:** `__check-conflito-v2.html` reproduzindo: cercado por três, uma defesa grátis, Energia por extra, Defesa 0 sem Energia; crítico de Alvo 4 não passando Bloquear 5 + Q2.

### Fase 6 — Condições, portões e Aflições · M

**Dado:** `system/data/conditions`: 61 → 12 + Aflições. Script `v2-condicoes.mjs`: as 12 com `portao: 'direto' | 'corpo' | 'mente' | 'nenhum'` e `acumulaNiveis` onde há N; as 49 restantes despublicadas com `viraCondicao` apontando para a equivalente (Congelamento → Lento/Preso/Atordoado por nível); Peçonha e Chaga viram Aflição (`aflicao: true`, `efeito`, `piora`, `cura` com potência, `desfecho`); sai o campo `chance` de `equipment.condicaoChance` e de `condicoesAplicadas[].chance`; fichas e NPCs com condição despublicada recebem a equivalente.
**Código:** `tabuleiro/js/tab-turno.js:1121,1650,1724` (portão: `direto` aplica; `corpo`/`mente` compara Graus com VIG/PRS do alvo via `valorComponente`; crítico sempre aplica); `shared/skill-runtime.js:102-118` e `shared/runa-em-jogo.js:182-197` (sem chance); participante da cena ganha `resistencias: {condicaoId: n}` para o +1 por aplicação, zerado em `encerrarConflito`; `shared/combate-cenas.js` (Aflição não expira por rodada; `cura` com potência); Criador: formulário de condição com portão e bloco de Aflição.
**Testes:** combate-cenas, condicao-por-faccao, tab-condicao-nivel, skill-runtime, tab-acerto-portao; novo `v2-portao.test.mjs` (Alvo 7 contra VIG 2 pega em 50% dos acertos; contra VIG 5, 20%; crítico sempre).
**Régua:** §6 reescrito (Chance sai; tabela de desconto vira coluna por Resistência).
**Portão:** nenhuma condição publicada sem `portao`; audit de fichas sem condição órfã.

### Fase 7 — Energia e contadores de cena · M

**Dado:** `vitalStats` ENER_MAX = `PRS + AUT + max(Perícias de Arte)`; `derivedValues` Graça de Palla despublicado e as 18 preces com custo em Energia; Harmonia e Bolha de Sangue deixam de ser VD com Atual e viram **contador de cena** (`classModules.contador: {nome, teto: equação, sobe, desce}`); as 27 canções com custo = Qualidade, pagável em Energia ou Harmonia; as 13 magias de Hemomancia com `custo: 'N Energia'` e `cargas: M`.
**Código:** `mechanics-engine.js` ganha o operador `max` (hoje só há `min`); `shared/combate-cenas.js:181-214` reconhece contador (`participante.contadores[nome]`, criado no início da cena, apagado no fim); `shared/skill-custo.js` parseia "1 Carga" e "Q em Harmonia"; `tab-turno.js` para a Sonoromancia (+1 no sucesso, opção de pagar com Harmonia, zera na falha, Clímax) e para a Hemomancia (recolher do chão como Movimento, veia como Livre, teto Hemomancia + VIG); `tab-render.js` mostra o contador como chip ao lado do token, não como barra.
**Testes:** skill-custo, combate-cenas, tab-folego; novos `v2-harmonia.test.mjs` (o exemplo de cinco canções por 3 de Energia) e `v2-carga.test.mjs` (sangue no chão vira Carga, morre no fim da cena).
**Régua:** §4.1 com pool 9–15; §4.7 conferindo Harmonia (canção paga com Harmonia constrói) e Carga (sem lucro no dreno).
**Portão:** Pallacerdote, Bardo e Sangral conjurando no Tabuleiro sem barra extra e com o contador aparecendo e sumindo com a cena.

### Fase 8 — Escola e Ramo · M

**Dado:** as peculiaridades com tag "Escola de Magia" viram os docs de Escola (campos `periciaId`, `formas` (ids de `castingForms`), `tributo`, `desastre`, `compendioId`); `classModules` ganha `escolaId` e é um por ramo (Sonoromancia, Hemomancia, Pallomancia, Abismancia, Necromancia viram um módulo cada com o nome do ramo, quando você der o nome); `classes.modulosDaClasse` é a lista de ramos; a peculiaridade de ramo (já existe para Espiritismo e Voduísmo) é o que dá o segundo ramo por 10 EXP; Necromancia: os três rituais viram linhas por Qualidade (1, 2 a 4, 5) com Lealdade no Q5, reaproveitando a Lealdade do Ferinismo (`shared/moral.js`); `dominioId` some de vez.
**Código:** `system-data-loader.js` carrega Escola junto da peculiaridade; `class-modules-renderer.js` mostra Forma, Tributo e Desastre no cabeçalho do módulo; Criador: formulário de Escola (três campos de texto e duas refs).
**Testes:** predef-campos, tab-mira-cadastro; novo `v2-escola.test.mjs` (classe sem escola não vê módulo de escola; Xamã com um ramo não vê o outro).
**Portão:** nenhum módulo sem `escolaId`; nenhuma classe sem lista de ramos; auditoria de cap. 13 da Régua reescrita.

### Fase 9 — Desgaste, Sanidade, Poder · M

**Dado:** condições Ferido/Grave/Beira da Morte (auto pela Vitalidade), Fome/Sede/Exaustão/Sobrecarga com 3 níveis; Trauma como condição com `nivel` = Intensidade, `gatilho`, `origem`; tabela de Colapso como doc em `system/data/knowledge` (ferramenta do Mestre); Descanso Curto sai do Tabuleiro.
**Código:** `shared/combate-cenas.js` `trilhaDeFerimento(vit, max)` aplicando a condição certa ao mudar de faixa e disparando o teste de Beira no início do turno (`tab-turno.js`); `inventario-motor.js` `nivelDeSobrecarga(pressao, carga)`; `shared/poder.js` novo e puro (EXP-equivalente de atributos, perícias, Dons, habilidades, itens, Aura, aliados) com auto-teste; ficha e card de NPC mostram Poder e Patamar; script do Bestiário passa a imprimir o Poder por `shared/poder.js`.
**Testes:** tab-state, dadiva; novos `v2-trilha.test.mjs` (Vit 18 → 13/9/4) e `poder.test.mjs` (personagem de criação em Inicial; item Q3 + Afiação 2 = 25).
**Portão:** Vitalidade caindo abaixo de 75% aplica Ferido sozinha no Tabuleiro; Poder aparecendo em ficha, NPC e criatura.

### Fase 10 — Criador e Mestre · M

Corre em paralelo às fases 4 a 9, porque cada campo novo precisa de tela para editar: equipamento (Fase 4), condição e Aflição (6), contador do módulo (7), Escola (8), Trauma (9). Arquivos: `painel-criador/js/painel-firebase.js`, `painel-mechanics.js`, `painel-mestre/js/area-npcs.js` (Vulnerável/Resiste, Trauma, Poder). `npc-calc-engine.js` não precisa de lógica nova: resolve os VDs pelo dado.
**Portão:** cada harness `__check-*.html` do Criador tocado nas fases anteriores verde.

### Fase 11 — Livros e cânone · M

- Livro de Regras do Jogador: caps. 2 a 7 substituídos pelo conteúdo do Livro de 12 Páginas; caps. 8 a 10 (guia do site) reescritos para as telas novas; versão 2.00 (é a virada de era, e só você decide pular).
- Compêndios: Sonoromancia perde Dissonância e os ±1 das Vozes; Totemancia perde Dívida Espiritual; Necromancia e Hemomancia perdem as perícias mortas; Voduísmo troca "Totemancia Xamânica nível 2" por "Totemancia 2"; cada um sobe um centésimo.
- Régua de Balanceamento: §0 (pool de Energia, linha de base), §1.1b (sem Blindagem tipada), §6 (portões), §12 (a perícia é a porta), §13 (schema com `qualidade`, `cargas`, `contador`); capítulo novo "14 — Contadores de cena e trilhas".
- Bestiário: Blindagem única, Vulnerável/Resiste, Poder por `shared/poder.js`; verbetes regenerados pelos scripts `bestiario-*.mjs`.
- Um script por livro em `functions/livro-*.mjs`, como hoje; varredura de termos mortos (Liga, Reflexo, Domínio, Graça, Chance, Observação, Agilidade) em todos os capítulos públicos.
**Portão:** `grep` dos termos mortos em zero nos capítulos públicos.

### Fase 12 — Limpeza e deploy · P

Apagar os módulos fundidos (não despublicar), as mecânicas órfãs (o varredor da Fase 1 lista as que nenhum VD/perícia/pec cita), a regra `maximo_itens` e o `itemRules`; subir versão de `sw.js` e dos assets; rodar a suíte inteira (`node --test` em `shared/`, `ficha-v1.7_1/js`, `tabuleiro/js`, `criar-personagem/js`); smoke test nos `__check-*.html`; deploy; comparar o censo da Fase 1 com o censo final.

---

## 4. O dia do corte

1. Congelar sessões (aviso no Painel do Mestre).
2. `gcloud firestore export` e `git tag v1-final`.
3. Rodar os scripts na ordem: Fase 2 → 3 → 4 → 6 → 7 → 8 → 9 (cada um com `--dry-run` primeiro, conferindo a contagem contra o censo).
4. Deploy do branch `nucleo-v2`.
5. Abrir uma ficha de cada classe, um NPC e uma cena de combate salva; rodar os harness.
6. Descongelar. O export fica guardado até três sessões depois.

Se algo falhar no passo 5, o caminho de volta é o import do export e o deploy da tag: uma hora, não um fim de semana.

---

## 5. Ordem, dependências e tamanho

| Fase | Depende de | Tamanho | Muda código? |
|---|---|---|---|
| 0 Playtest | Livro publicado | M | não |
| 1 Preparação | 0 | P | scripts |
| 2 Perícias e EXP | 1 | M | pouco (wizard) |
| 3 Domínio → perícia | 2 | P | um arquivo |
| 4 Item | 2 | G | cinco arquivos |
| 5 Defesa e combate | 2, 4 | G | três arquivos |
| 6 Condições | 2 | M | quatro arquivos |
| 7 Energia e contadores | 2, 6 | M | cinco arquivos |
| 8 Escola e Ramo | 3, 7 | M | três arquivos |
| 9 Desgaste, Sanidade, Poder | 6, 7 | M | três arquivos + um novo |
| 10 Criador e Mestre | paralela a 4–9 | M | telas |
| 11 Livros | 2–9 | M | scripts |
| 12 Limpeza e deploy | tudo | P | — |

Caminho crítico: 0 → 1 → 2 → 4 → 5 → 7 → 8 → 11 → 12. As fases 3, 6, 9 e 10 cabem nos intervalos. Em sessões de trabalho de um dia, são cerca de 25 a 30 dias úteis, dos quais os três de playtest são os que mais economizam: cada decisão fechada em mesa é um script a menos reescrito.

---

## 6. Riscos e como cada um está cercado

| Risco | Cerca |
|---|---|
| Referência órfã em equação (perícia que sumiu citada por mecânica) | varredor da Fase 1, rodado no fim de cada fase |
| Ficha viva perdendo EXP ou perícia na migração | backup por ficha, audit "EXP gasto + livre = total", teste com ficha sintética por classe |
| Instância de item (`items`) divergindo do catálogo | o script de item cobre `equipment` **e** `items`, como o de remoção do Teto de Ofício precisou |
| NPC esquecido (formato `modulosClasse` diferente do `classModuleData`) | toda migração cobre as três coleções; o censo conta NPCs tocados |
| Régua acusando falso desbalanceamento com a linha de base antiga | cada fase numérica termina com o audit reescrito, nunca com o antigo |
| Livro contradizendo a ficha | varredura de termos mortos em todos os capítulos, não só no capítulo dono |
| Dois sistemas convivendo no código | não há flag: um corte, com export e tag para voltar |

---

## 7. O que este plano não decide

Os nomes dos três ramos, o atributo de Totemancia e Hemomancia, e se Bloquear fica em VIG: são decisões suas da Fase 0, e os scripts das fases 2 e 8 levam esses valores como parâmetro. Nada nas fases 1 a 12 precisa começar antes de o playtest terminar, e é assim de propósito.
