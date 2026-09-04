# Pendente — Núcleo v2 (04/09/2026)

Levantamento completo do que ainda falta, do que o banco ainda carrega da versão antiga e do que sai do código. Cada item traz o que é, onde está e o que se faz. As seções 8 e 9 são o que depende de você.

## 1. Corrigido hoje (já no ar, commit 8d88db5)

- **Regra Pressão → Carga** (`system/data/mechanics/Wi5wJpwjafqlTR6FNfyt`): a faxina F despublicou por "sem citação", mas `itemRules/Pressão Soma Carga` a cita e a ficha aplica. Republicada. Durante 1 dia a Carga Atual não somou a pressão dos equipados.
- **Laboratorium**: a Bancada ainda exigia a Peculiaridade "Domínio de Escripta/Talha/Tatuagem" (despublicada) e uma perícia de ofício que saiu; toda runa nascia rascunho. Agora a porta é a perícia **Runomancia ≥ 1** e o nível dela é o da conta (`bancada.js`).

## 2. O que falta do plano (não é sobra, é trabalho)

| Item | Onde | Estado |
|---|---|---|
| Vantagem por perícia (Encantamento `vantagemPericiaId`) entrar na rolagem | `tabuleiro/js/tab-combat.js` (`tbTesteRolar`) | o teste da cena não sabe qual perícia rolou |
| Poder somar aliados (metade do Poder de cada) | `ficha-v1.7_1/js/poder-ficha.js` + `aliados.js` | precisa das fichas de NPC carregadas |
| Descanso Rápido/Longo, Trauma, Fome, Sede como ação (hoje o Narrador aplica) | Tabuleiro | regra de texto no Livro |
| Mesclar `nucleo-v2` em `main` (main tem 1 commit fora: "Delete lendas-reliquias-rpg-main.zip") e apagar `with_vscode` (15 atrás) | git | decisão sua |
| `graphify update .` (o grafo está no commit anterior ao v2) | `graphify-out/` | 1 comando |

## 3. Banco — dados que o v2 deixou pendurados (adaptar)

**3.1 Elementos rúnicos apontam para condições despublicadas** (13 elementos: campos `condicoesFisicas`, `condicoesEssencia`, `condicaoCritica`).
- 6 fundidas remapeiam: Imobilizado→Preso · Queimadura, Inflamado→Queimando · Hemorragia, Dilacerar, Chaga→Sangrando.
- 16 sem destino: Delírio, Desorientado, Amplificado, Opaco, Fratura, Ancorado, Serenidade, Vigorado, Definhado, Pacto de Sangue, Rejuvenescido, Ligeireza, Envelhecido, Estagnado, Alento, Afogando. **Decisão 9.1.**
- `castingForms` Inst. Sopro e Vocal: `condicoesBloqueiam` → Afogando (mesma decisão).

**3.2 Referências mortas em docs vivos** (limpar):
- `classes/Bardo.peculiaridadeIds` → Domínio de Sonoromancia; `classes/Pallacerdote.derivedValueIds` → Graça de Palla.
- `derivedValues/Defesa: Aparar` e `Defesa: Esquiva` → `mecanicaIds` de limites despublicados.
- VDs Postura Defensiva, Investida, Postura Ofensiva, Cólera: `blocoNome: "Manobras"` (módulo aposentado) → renomear o bloco para "Manobras de Guerreiro".

**3.3 Mecânicas com perícia antiga por nome** (o motor ainda resolve por apelido; reescrever e tirar o apelido):
- "Ataque Mudo REQ": Perícia: Malandragem → Lábia · Agilidade → Acrobacia · **Reflexo → não existe (decisão 9.2)**.
- "Perícias Iniciais do Ladino": alvo Perícia: Agilidade → Acrobacia.
- "Condição: Agarrado" → renomear "Condição: Preso".
- Textos: "Bolha de Sangue" nas mecânicas −1/−2/−3/−4 Cargas e Carga de Sangue; "Graça" em Símbolo Sagrado (forma), módulo Pallomancia, classe Pallacerdote, condição Drenado, item Incenso Consagrado; módulo Rituais do Espiritismo ("Domínio", "Dívida Espiritual"); classe Bardo ("Dissonância"). Cada um sobe a versão.

**3.4 Catálogo sem perícia (porta vazia = redutor 0)**: Escudo de Torre, Escudo Grande, Escudo Médio, Broquel → Bloquear; O Sussurro Final (adaga) → Precisão, como as 12 adagas; Rede → Arremesso.

**3.5 NPCs (125)**: `valoresDer` com chaves de VDs que saíram — REA (112), DET (62), REACAO/DEFESA (3), Blindagens tipadas e Defesa: Absorver/Evadir/Proteger/Cobertura/Desviar (5–6), QUALIDADE_DO_FOCO (5), TETO_DE_OFICIO_DISPARO (1). Limpar e tirar do código o espelho `REA`/`DET` (`tab-state.js` VD_ALIAS_NPC, `area-npcs.js` legacyDv, `combat.js` LEGACY_KEYS). 11 NPCs sem `schemaVersion`.

**3.6 Fichas (55)**:
- `classModuleData` com módulo morto: `Manobras` (9 fichas; Caboclo, Xamã, guarda "Postura Ofensiva" de Guerreiro; TESTE Ponytail guarda "Salto Predatório"), `mod_verde_xama` (014: Toque do Húmus, Mordida Verde, Colheita Antecipada — magia verde arquivada no playtest), `alquimancia_ofensiva` (Joaquino, item sem nome), `lista_estudo`, `Runas-feitas`, `sonoro_c1` (vazios). Apagar as chaves.
- `dots.pec_<slug>` do formato antigo (Praematum, Barbie, Carinha Logo ali: golpe_titanico, guardiao_imponente, blindagem_natural, olfato_excepcional, garras_escavadoras, presenca_imponente) — duplicam os ids ou vêm de raça anterior. Apagar (e os mesmos slugs em `peculiaridadeLevels`, mais `pec_dominio_espiritismo`).
- `dots.pec_<id apagado do cadastro>`: Magro (6 fichas), Gordo (5), NAsryQ5q… (2), 4 ids numa ficha de teste. Entradas em `peculiaridadesIndividuais`: Sona (Magro), TENDE (Gordo), Rosvaldo e Belarminio (undefined). **Decisão 9.3** (apagar sem mexer no EXP).
- `dots.spec_*` + `specs` + `fields.spec_name_*` (Especializações, 6 fichas) → apagar.
- `fields` da ficha v1.6: `wpn_*`, `proj_*`, `arm_*`, `inv_*` (16 fichas), `cond_*` (5 — migrar para `conditions` e apagar), `det_atual` (4), `money_*` (17), `dv_BOLHA_DE_SANGUE_atual` (2), `dv_GRACA_DE_PALLA_atual` (1), `blindagem`/`tamanho` (4) → apagar.
- `inventoryItems` (28) e `equipamento` (33): o shim de `storage.js` escreve em inputs que não existem mais; o assistente não grava mais nenhum dos dois → apagar campos e shim.
- Carimbos de migração (`legado`, `origem`, `migradoEm`, `migracaoPericiasV2`, `migracaoDominioV2`) e `expApplied` vazio: manter como trilha (**9.4** se quiser apagar).

**3.7 Itens (300)**: `dominioFamilia` (29), `name`/`description` (76, iguais a nome/descrição), `originalEquipId` (19, ninguém lê; `modeloId` é o vivo), `migradoDe` (3) → apagar campos. 4 itens da caixa de uma mesa que não existe mais (`__caixa_mestre__TThT6XJyBmY83HXRCEaz`: Lunis, pedra ×2, Armaduraaaa) → apagar.

**3.8 Coleções sem código**: `viewmaps` (2) + `viewmap-settings` (1); `economy-items`/`-coisas`/`-events`/`-locations` (5 docs, só nas rules); `containers` (100 docs — só `painel-mestre/js/repertorio.js` lê, e esse arquivo não é carregado por ninguém). Apagar docs + regras. (`real_logs` e `exp_logs` são vivos: `functions/index.js` grava.)

**3.9 Despublicados com carimbo v2 — apagar de vez** (backup por script, como sempre): conditions 32 · derivedValues 24 · mechanics 68 (+4 antigos sem carimbo: "Ambidestria 5 REQ", "testhjkm,j", "teste", "Reação aposentada") · peculiarities 20 Domínios (+3 antigas: Mestre em Armas, Armas de Punho, Armas de Precisão à Distância) · skills 63 (inclui as duplicatas Lábia, Percepção, Arremesso) · classModules "Manobras" · equipment "Lança de Simples" (grafia). **Fora**: `tribes` 17 despublicadas são lore sua, sem carimbo — não mexo (**9.5**).

## 4. Código — sai

**4.1 Arquivos mortos**: `ficha-v1.7_1/js/equipment.js` (e a linha no precache do `sw.js`), `painel-mestre/js/repertorio.js` (idem), `painel-mestre/css/painel-mestre.css` (0 bytes), `ficha-v1.7_1/minimal.html`, `ficha-v1.7_1/test_data.html`, `mapa-conflito/__previa.html` (2954 linhas de dados v1), `gerar-imagem.mjs` (já apagado, falta commitar), `armador_da_feira.png` e `mordomo.png` na raiz (1,4 MB sem referência), `npcs_sem_imagem.md`.

**4.2 functions/**: 386 `.mjs` de migração já rodada (+41 untracked) vão junto no deploy da Cloud Function. Mover tudo para `D:\…\scripts-backups\functions-antigos`, ficando só `v2-*.mjs`, `audit-texto-vs-motor.mjs` (guarda viva) e os 14 módulos de produção com seus testes. Idem `_regua.txt`, `_totemancia.txt` (111 KB de dump), `_tmp-*` (18), `_find-*`/`_get-*`/`_audit-canone-wiki`/`_export-wiki-json`, `remove-bg.py`, `process_5_items.ps1`, `audit_*.py`, `process_grid*.py`, `reprocess_all_clean.py`, `teste_*.png`, `teste_fatias/`, `get_*.js`, `list_all_missing.js`, `query-db.js`, `upload-image.js`, `prompt-*.md`. E o `firebase.json` passa a ignorar `*.mjs` fora da lista de produção.

**4.3 Shims e resíduos v1** (cada um só sai depois do dado correspondente da seção 3):
- `mechanics-engine.js` TARGET_MAP: apelidos Medicina/História/Tradição/Observação/Agilidade/Malandragem/Desviar/Contra-Ataque/Cobertura + espelho `ALVOS_FIXOS` em `shared/sanidade.js` (depois de 3.3).
- `shared/inventario-motor.js`: `?? item.fio` como Qualidade. `shared/equip-campos.js`: `liga`/`blindagemQ0` em HERDA_DO_MODELO e os dois textos "Liga".
- `shared/runa-em-jogo.js`: ramo `tetoOficio`; parâmetro `temDominio` → `temPorta`; condições `hemorragia`/`agarrado` → `sangrando`/`preso`.
- `tabuleiro/js/tab-state.js` VD_ALIAS_NPC `DEFESA:'REA'`, `DETERMINACAO:'DET'` + espelho REA (depois de 3.5).
- `ficha-v1.7_1/js/storage.js`: shims `cond_*`, `inventoryItems`, `equipamento` (depois de 3.6). `char-logger.js`: dicionário `wpn_*/arm_*` (`rea`, `integ`).
- `shared/campo-vinculado.js`: entrada `spells`. `painel-criador`: módulo + aba "🔮 Magias" (`spells`), `buildManeuverSelectorHTML()` (zero chamadores), `FONTE_LABELS.manobra`, opção `graca` em recursoExp, chip `item.manobras`, `--fonte-manobra`. `criar-personagem/js/race-module.js`: bloco "Manobras/Técnicas" (lê `maneuvers`, que nenhum loader carrega).
- Textos: tooltips do criador (`data.js`: Medicina→Anatomia, Agilidade→Acrobacia, Observação→Percepção), `laboratorium-runarum/js/compendium-data.js` ("hemorragia", "Manobras do Runimago custam DET"), comentários e fixtures de teste (~95 ocorrências, lista no relatório dos agentes: `equacao-min.test.mjs`, `item-props.test.mjs`, `distribuicoes.test.mjs`, `__check-*`).
- `sw.js`: falta pré-cachear `worldbuilding/css/worldbuilding.css`, `wb-ferramentas.css`, `shared/inventario-motor.css` (offline o Cronista abre sem estilo).

**4.4 Duplicações** (faxina, não v1): `_pesoKg`/`_tamanhoM` copiados 7×; `qualidadeEfetiva` inline em 3 motores; `escapeHtml` em 20+ arquivos; `custoAcumulado` de novo em `npc-poder.js`; `exp-upgrade.js` com 5/4 fixos em vez de `config/regras`.

## 5. Livros — texto da versão antiga

| Onde | O que | Fazer |
|---|---|---|
| Livro do Jogador, Cap. 1 Introdução | glossário com Manobra; "diferenças da v1.7" cita Especializações→Domínio, Liga, Determinação | reescrever para o v2 (versão 1.01, livro 2.01) |
| Cap. 5 / Cap. 6 / Páginas 5 e 6 do Livro de 12 | "Não existe Domínio à parte"; "Manobras de classe (posturas…)" | trocar por "a perícia é a porta" e "Habilidades de classe" |
| Cap. 10 Guia da Ficha | aba "Manobras — as manobras da sua classe…" | reescrever a aba como Módulos de classe |
| Compêndio de Pallomancia | 15× Graça (texto antigo mantido "como registro") | reescrever o recurso para Energia |
| Compêndio de Runomancia, Parte XIV | "Domínio (Peculiaridade, 12 EXP por ofício)" | perícia Runomancia |
| Ideias Futuras — Classes futuras | "Domínio, escada de módulo", "Contra-Ataque" | ajustar 2 frases |
| Régua de Balanceamento caps. 12 e 13 | Domínio como porta (41+13 menções), schemas com Graça | **decisão 9.6**: apagar ou manter como histórico |
| Régua caps. 0, 1, 4, 11 | Graça como moeda nas tabelas; "Manobras guarda 19 habilidades" | trocar por Energia / módulo de classe |
| Falsos positivos (ficam) | Necromancia "Reflexo Corporal"; Espiritismo e Régua cap. 9 "Domínio" (estado do Eco); Fluxomancia "Domínio" (cor); "Dívida Espiritual não tem número" (nota da Régua) | — |

## 6. Repositório

- `.claude/worktrees/`: 9 worktrees registrados + 3 pastas órfãs (alquimancia, criaturas, npc-refs-item-projetil, runomancia), 339 MB, cópias inteiras do site que inflam qualquer busca. Branches com commit fora de `nucleo-v2`: `condicoes` (7), `alquimancia` (5), `claude/sad-wright-ea57e8` (1); 19 branches `claude/*`. **Decisão 9.7.**
- Documentos de planejamento já cumprido: `REDESENHO-DO-SISTEMA.md`, `PLANO-REFATORACAO-NUCLEO-V2.md`, `SEGURANCA-VARREDURA.md`, `RELATORIO-PROTECAO.md`, `FOLHA-PRESCRICAO-MAGIAS.md`; untracked `TASK-REDUTOR-COMO-CAMPO-DE-EQUACAO.md`, `TASK-SENTIDOS-E-TAGS-TABULEIRO.md`, `prompts-premios-roleta.md`. **Decisão 9.8.**
- `git status` com 230 entradas: quase tudo imagem untracked em `functions/avulsos-imagens/` e `.obsidian/`. Não mexo.
- `sistema antigo e lore/` (PDFs da v1.7, 4 MB, fora do git): referência sua, fica.

## 7. Ordem de execução proposta

1. Banco (3.2 → 3.7, 3.8) com um script `functions/v2-limpeza.mjs`, dry-run + `--apply` + backup.
2. Apagar os despublicados (3.9) — último passo do banco, depois de nada mais citar nenhum id.
3. Código (4.1 → 4.3), suíte verde, `sw.js` sobe, deploy.
4. Livros (5), com versão.
5. functions/ e repositório (4.2, 6), `graphify update .`, merge em `main`.

## 8. O que é seguro e faço sem perguntar

Tudo de 3.2 a 3.8 (menos 9.1–9.3), 4.1, 4.2, 4.3, 4.4, a parte de livros marcada "fazer", e os passos 1, 3 e 4 da ordem. Sempre com backup no D: e commit por etapa.

## 9. Decisões suas

1. **Condições de Essência das runas** (3.1): tirar dos elementos (as runas ficam só com as 12 + Aflições) ou republicar as 16 como "estados" com portão?
2. **Reflexo** em "Ataque Mudo REQ": trocar por Esquiva, Aparar ou apagar o requisito?
3. **Magro/Gordo e os Dons apagados** nas fichas: apago os dots e as entradas sem mexer no EXP (eles renderam EXP na criação)?
4. Carimbos de migração nas fichas (`legado`, `migracaoPericiasV2`…): manter (recomendo) ou apagar?
5. As 17 tribos despublicadas: são suas, ficam?
6. Régua de Balanceamento caps. 12 e 13: apagar ou manter como histórico interno?
7. Worktrees e branches antigas: posso remover os worktrees e apagar as branches `claude/*` sem commit fora? `condicoes` e `alquimancia` têm commits que não estão em lugar nenhum — olho o que são antes?
8. Documentos de planejamento na raiz: apagar, mover para `docs/historico/` ou deixar?
