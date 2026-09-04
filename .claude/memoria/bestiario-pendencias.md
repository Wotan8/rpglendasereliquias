---
name: bestiario-pendencias
description: "Status da frente do Bestiário — todos os itens do handoff fechados em 31/08/2026, exceto a lacuna de lore da Borda de Silmarela, que exige resposta do usuário."
metadata: 
  node_type: memory
  type: project
  originSessionId: ac772b56-3371-4678-a838-c5f783eaa1cd
  modified: 2026-08-31T23:53:22.185Z
---

Todos os itens do handoff de 28-29/08/2026 foram fechados em 31/08/2026 (sessão que apagou o `HANDOFF-BESTIARIO.md` depois de transferir o conteúdo pra cá):

1. ~~`nivelAmeaca` mata o filtro do Painel~~ — **corrigido**: o filtro agora lê só o primeiro segmento (o Grau) do campo, sem acento/minúsculo. `painel-mestre/js/area-npcs.js:368`.
2. ~~6 raças de criatura vazavam na criação de personagem~~ — **corrigido**: `ehRacaDeCriatura()` filtra por `tags` em `criar-personagem/js/race-module.js` e `ficha-v1.7_1/js/system-data-loader.js`.
3. ~~NPCs fora de Sereni em notação legada~~ — **corrigido**: eram 16, não ~50. `functions/npcs-legado-v3.mjs` (10 sem mesa) + `functions/npcs-mesa-legado-v3.mjs` (6 de mesa, autorizado pelo usuário). Nenhuma ficha em `npcs` ficou sem "Alvo N" legível.
4. ~~Inventário dos 46 NPCs de Sereni~~ — **corrigido**: `functions/sereni-npcs-05-inventario.mjs`. Escopo: arma + armadura/escudo declarados + itens pessoais notáveis, tudo equipado ou dentro de contêiner (nada solto — regra do usuário). Vexia Attak fora do escopo (mesa, já tinha inventário correto).
5. ~~`[LACUNA]` que corpo d'água é a Borda de Silmarela~~ — **fechado**. Resposta do usuário (31/08): é um rio, ainda sem nome, que atravessa a Floresta de Silmarela antes de correr pela Borda. Gravado em `worldbuilding-geography` (doc "Borda de Silmarela", campo `descricao`) via `functions/wb-corpo-dagua-silmarela.mjs`. O nome do rio segue em aberto — não inventar quando aparecer a pergunta de novo.
6. ~~Força de criatura não custava ⚡ Poder~~ — **corrigido**: `functions/bestiario-briga-poder.mjs` cadastrou perícia Briga em 24 criaturas, nível derivado do próprio Alvo já escrito (`nível = max(0, Alvo − max(FOR,DES))`). Alvo e força não mudaram, só o registro que o Poder soma.
7. ~~Dádiva de Habilidade vazia pra aliado animal~~ — **confirmado, não é bug**: `tab-turno.js:1410` filtra `d.ganhos.length || d.modulos.length`, então a Dádiva some do resultado em silêncio quando o hóspede não tem módulo. Desenho correto.
8. **Sentinela da Feira sem Grau** (achado nesta sessão, mesa em andamento) — **corrigido**: `functions/bestiario-carimbo-sentinela.mjs`. O combate dela não é condicional (Alvo 9 fixo); só o ALVO da Sentença é (ataca exclusivamente violador das Três Leis). Carimbo normal: Grave, 2,67×.

Geografia: **SILMARI ≠ SILMARELA**. Região de Silmari contém a Floresta de Silmari (mata imensa, longe de Sereni) e o Vale de Silmarela (Sereni, Onéria, Ondúria, Arnavar, Khar Dul, Ermida, as florestas/planícies de Silmarela e Velmora, Borda de Silmarela). Sereni: ~271 hab., chefatura de Morik Varn, planície, **sem muralha** — Thorkan, Burkan e Zorkan são guardas da vila.

**Why:** o handoff original foi apagado depois de transferido; sem esta nota, ninguém saberia que a frente inteira já fechou.

**How to apply:** frente encerrada — os 8 itens do handoff estão fechados, gravados no Firestore e commitados. Ver [[bestiario-regua-v3-e-grau]].
