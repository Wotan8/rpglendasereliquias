# Núcleo v2 — estado em 04/09/2026 (fim do dia)

O que foi feito hoje, o que ainda falta, e o que precisa de mão sua. Backups de tudo que o banco perdeu: `D:\Imagem\US - Universo Soberano\RPG\Reliera\Backup Firestore 2026-09-03\scripts-backups\` (`_backup-limpeza-*.json`, `_backup-limpeza-despublicados-*.json`, `_backup-livros-2-*.json`, `_backup-classModules-Manobras.json`, pasta `functions-antigos/`).

## 1. Feito — banco (`functions/v2-limpeza.mjs`, 384 + 1 + 214 operações)

- Elementos rúnicos: `condicaoId` remapeado pelo nome vivo (Imobilizado→Preso, Queimadura/Inflamado→Queimando, Hemorragia/Dilacerar/Chaga→Sangrando); as 16 condições de Essência que saíram no v2 saíram das runas. **Cristal e Espacial ficaram sem condição de Essência** — cadastre no Painel do Criador (aba Elementos Rúnicos) se quiser dar uma das 12 a elas. Formas de conjuração sem Afogando.
- Classes sem ids mortos (Bardo: Domínio de Sonoromancia; Pallacerdote: Graça de Palla); VDs Defesa: Aparar/Esquiva sem limites antigos; bloco "Manobras" dos VDs do Guerreiro virou "Manobras de Guerreiro".
- Mecânicas: "Ataque Mudo REQ" pede Lábia 2, Acrobacia 2 e **Furtividade 2** (Reflexo não existe; ataque mudo é ataque furtivo); "Engodo REQ" e "Perícias Iniciais do Ladino" com Lábia/Acrobacia; "Condição: Agarrado" → "Condição: Preso"; Bolha de Sangue → Carga de Sangue nos textos; Graça, Dissonância e Dívida Espiritual fora dos textos de classe, forma, condição, item e módulo (Pallomancia perdeu a coluna "Pagar Graça").
- Catálogo: os 4 escudos → Bloquear; O Sussurro Final → Precisão; Rede → Arremesso.
- NPCs (125): `valoresDer` sem REA, DET, Blindagens tipadas, Defesas antigas e o resto do espelho velho.
- Fichas (55): módulos mortos, Dons apagados do cadastro (Magro, Gordo…), dots por slug, Especializações, campos da ficha v1.6, `inventoryItems`/`equipamento`. **EXP pela sua regra:** Caboclo +1, TESTE Ponytail +1, 014 +6 (3 golpes do verde), Praematum +24 e Barbie +60 (Especializações), +1 por ficha com Magro (custava 1). Gordo e os outros Dons apagados: mecânica de EXP já não existia, valor desconhecido → 0, registrado na ficha em `limpezaV2`.
- Itens: `dominioFamilia`, `name`/`description`, `originalEquipId`, `migradoDe` fora; 4 itens da caixa de uma mesa apagada fora.
- Coleções apagadas: `viewmaps`, `viewmap-settings`, `economy-*`, `containers` (100 docs) — e as rules delas.
- Despublicados apagados de vez: 32 condições, 24 VDs, 72 mecânicas, 23 peculiaridades, 63 perícias, "Manobras", "Lança de Simples". Tribos despublicadas ficaram (são suas).

## 2. Feito — código (commits 0552963, 75753d3 e os seguintes; PWA v393)

- Sem apelidos de perícia antiga no motor (Medicina, Agilidade, Observação, Malandragem, Desviar, Contra-Ataque…): ref antiga vira 0, não resolve mais.
- Sem `fio`, `liga`, `blindagemQ0`, `tetoOficio`, espelho REA/DET do NPC, shims `cond_*`/`inventoryItems`/`equipamento` da ficha, módulo Magias e seletor de Manobras do Criador, bloco de Manobras do assistente.
- Laboratorium: porta = perícia Runomancia (`temPorta`); compêndio embutido sem Gravação/Erudição/Diagnóstico Rúnico e sem "Manobras do Runimago".
- Arquivos mortos apagados; `functions/` só com produção + testes + `v2-*.mjs`; os 417 scripts antigos estão em `functions-antigos/` no D:. A Cloud Function não leva mais `.mjs`.
- Docs de planejamento em `historico/` (com os documentos que só existiam nas branches `condicoes`, `alquimancia`, `criaturas`, `runomancia`).

## 3. Feito — livros (`functions/v2-livros-2.mjs`)

- Livro de Regras do Jogador **2.01**: Cap. 1 com a lista "o que mudou" do v2 e glossário sem Manobra/Determinação; Caps. 5, 6 e 10 sem Domínio/Manobras. Livro de 12 Páginas 1.01.
- Compêndio de Pallomancia: recurso = Energia (sem Graça de Palla, sem capacidade por arquétipo). Runomancia XIV: porta = perícia. Ideias Futuras ajustado.
- Régua de Balanceamento **1.04**: caps. 12 e 13 apagados; Graça → Harmonia nas tabelas; nota no cap. 0 com a base do combate v2 (**unidade 3,25**; os 78 carimbos em 3,90 ainda não foram recompostos — isso é balanceamento, não texto).

## 4. Feito — skills e memória

- `balancear-item` reescrita para o v2 (Qualidade, classe da armadura, Afiação/Encantamento/Aura, Poder e Patamar). `bestiario` na régua nova (Patamar em vez de Grau/Fio, Blindagem única, base 3,25).
- Memória: 10 arquivos da v1 apagados, 3 reescritos, 8 anotados; cópia em `.claude/memoria/`. `CLAUDE.md` explica como usar em outro PC. `reliera-canone` e `reliera-voz` agora estão em `.claude/skills/` (viajam com a pasta).

## 5. O que ainda falta (trabalho, não sobra)

| Item | Onde |
|---|---|
| Vantagem por perícia (Encantamento) entrar na rolagem | `tabuleiro/js/tab-combat.js` |
| Poder somar aliados (metade do Poder de cada) | `ficha-v1.7_1/js/poder-ficha.js` |
| Descanso, Trauma, Fome, Sede como ação no Tabuleiro | regra de texto por enquanto |
| Recompor os carimbos da Régua na base 3,25 | `regua.razao` / `base` das habilidades |
| Cristal e Espacial: condição de Essência da runa | Painel do Criador |
| Régua v3 de criatura: refazer a tabela de calibração na base nova | skill `bestiario` §2 |
| Mesclar `nucleo-v2` em `main` (main só tem "Delete …zip" a mais) | git |

## 6. Precisa da sua mão

- **Pasta `.claude/worktrees/`** (339 MB, 12 cópias antigas do site): o Windows não me deixou apagar. Feche editores, apague a pasta inteira e rode `git worktree prune`. O registro do git já está limpo.
- **Branches** que ainda existem porque têm commit só delas: `criaturas` e `runomancia` (documentos já salvos em `historico/`), `condicoes` e `alquimancia` (idem), `claude/sad-wright-ea57e8` (já cherry-picked), `claude/peaceful-gauss-c50379` (30/07: "filtra no Firestore em vez de baixar a coleção inteira no Painel do Mestre" — 4 arquivos, nunca mesclado; vale olhar antes de perder), `multi-livro-vinculado` (1 commit trivial). Para apagar: `git branch -D <nome>`.
- `with_vscode` fica como está — é só um ponteiro, não custa nada.
- `SEGURANCA-VARREDURA.md` ficou na raiz porque está modificado e não commitado por você.
