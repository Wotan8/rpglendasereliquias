---
name: combate-por-turno-formato
description: "Formato do combate mecânico no Tabuleiro — cena.iniciado/acoesTurno, faccao por participante, mira nos itens pré-definidos (mira/custoAcao) e alcanceM nas armas."
metadata: 
  node_type: memory
  type: project
  originSessionId: 81ddd286-c3c0-48ac-8cad-43efaa006d5a
  modified: 2026-08-13T22:31:08.192Z
---

Desde 13/08/2026 o Tabuleiro tem combate por turno mecânico. Formato no doc `tabuleiro-meta/combate` (cena): `iniciado: bool` (o turno 1 só existe depois do ▶️ do mestre), `acoesTurno: { padrao, movimento }` (resetado a cada virada, no MESMO write), e cada participante tem `faccao: 'aliados'|'inimigos'|'neutros'` (default: jogador aliado, resto inimigo — `faccaoDoParticipante()`). Iniciativa rola 1x por cena (`rolarIniciativa` bloqueia re-rolar; o mestre edita o número no Painel).

**Why:** economia do Livro §6.2 (1 Ação Padrão + 1 de Movimento; Livre incidental; Completa = as duas) virou motor puro em `shared/combate-cenas.js` (`podeGastar/gastarAcao`, testado). O painel do turno (`tabuleiro/js/tab-turno.js`) aparece para o controlador da vez; a mira (`T.mira`) é preview local — só a confirmação escreve (1 chat + 1 gasto).

**How to apply:**
- Skills: a mira vem do REGISTRO — item pré-definido de classModule ganhou `mira { tipo: alvos|geometria|cac, forma, origem token|livre, alcanceM, raioM, comprimentoM, larguraM, angGraus, maxAlvos, afeta }` e `custoAcao` (cadastrados no Painel do Criador, bloco "🎯 Mira & Ação"). A instância na ficha aponta por `_predefId`. Skill sem mira → o Tabuleiro pergunta na hora (formulário manual, nada é inventado).
- **Os predefs auditados pela Régua v2 JÁ TÊM mira em formato próprio** (visto no banco, 13/08): `formaArea` ('onda' = área do conjurador), `tamanhoArea` (m), `alcance`, `alvosMax`, `anguloCone`, `faccao` ('inimigo'/'aliado'), `condicoesAplicadas [{condicao, portao, chance, alvos, rodadas}]`, `regua.custo` (ENER auditado) e `valores.acao` ("Ação Padrão"...). O turno converte via `miraDaReguaV2()`/`acaoDoRotulo()` em tab-turno; precedência: `it.mira` > `pd.mira` (bloco novo do Criador) > Régua v2. ⚠️ Nos schemas de módulo as keys são NUMÉRICAS e o label manda: "3" pode ser "Redutor" (penalidade no Alvo, NÃO custo) — custo real = campo com label /custo/ ou `regua.custo`.
- **Doc de NPC não persiste valores finais de VD** — o save (`collectNpcData` em area-npcs) agora espelha os finais dos VDs `vinculados` por `normChave(nome)` dentro de `valoresDer` (onde `valorComponente` procura); `vinculados`/`overrides`/`atual` usam o **id do doc** como chave. NPC antigo precisa ser re-salvo para ganhar o espelho; até lá o card usa fallback `overrides[id]`.
- Golpe CaC: `alcanceGolpe(alcanceM da arma, VD Tamanho) = max(1m, arma + 5%×Tamanho)`; campo novo `alcanceM` em Arma (`shared/equip-campos.js`, aparece no Criador e na ficha de NPC). **Catálogo ainda sem alcances preenchidos** — sem cadastro vale o piso de 1 m. Arco do golpe = 90° (`ARCO_GOLPE_GRAUS` em tab-turno, decisão de UI).
- Todo alcance com o token como eixo conta da BORDA (`tab-mira-calc.js`, testado; hit-test é o `templateAtingeCirculo` dos templates).
- **Guardar Turno = delay** (13/08): guarda as DUAS ações e passa a vez; `p.guardadoNaRodada` + botão "⚡ Agir agora" interrompe (`cena.retomar` guarda turno/ações de quem foi interrompido; `tbCombTurno(1)` com retomar restaura em vez de avançar). Vale só na MESMA rodada (`guardadoValido()`); virou, perdeu.
- **Mira manual é do MESTRE**: jogador com skill sem mira cadastrada usa a ação direto (gasta + loga "efeitos com o mestre") — parâmetro de mecânica não é editável por jogador. A mira (cadastro e formulário do mestre) aceita `condicaoNome`+`condicaoRodadas`: a confirmação aplica a condição nos atingidos via `aplicarCondicaoEmVarios()` (tab-combat).
- **Expiração de condições roda SÓ no cliente do mestre (secreto)**, disparada pelo snapshot da rodada (`checarCondicoesRodada`) — quem vira a rodada pode ser um jogador, e as rules não deixam ele limpar ficha de NPC; nunca voltar a expirar dentro do `tbCombTurno`.
- **Custo vital de skill** (13/08): `custoVital()`/`recursoInsuficiente()` no shared parseiam "2 ENER"/"1 Energia" (só VIT/ENER/SAN, os vitalStats canônicos); o painel do turno desabilita o botão com "Não tem X o suficiente". Texto sem par número+sigla NÃO bloqueia (não inventa). VDs com `statusCombate: true` no Criador aparecem no card do combate (mestre) e sobre o token (`vdsCombateDaFonte` em tab-hud, registro via `ensureNpcSystemData` no boot).
- **Bug consertado no editor de NPC** (area-npcs.js): a normalização de abertura descartava `valoresDer.vinculados` — VD vinculado sem override sumia a cada salvar/abrir. E `deslocamentosDoToken` agora lê `DESLOC_*` de `valoresDer.overrides` do NPC (Pixie com Desloc. Aéreo vinculado ganha a opção de voo no Tabuleiro).
- Relacionado: [[economia-de-acao]] [[condicoes-de-participante-formato]] [[limitacao-dano-nao-estruturado]] (a confirmação de skill anuncia alvos/efeito no chat; dano continua manual).
