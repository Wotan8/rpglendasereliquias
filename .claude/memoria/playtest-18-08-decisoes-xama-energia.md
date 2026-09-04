---
name: playtest-18-08-decisoes-xama-energia
description: "Decisões do playtest de 18/08/2026 com Abel (Xamã, Bardo, Energia/descansos) e onde estão os MDs da conversa transcrita."
metadata: 
  node_type: memory
  type: project
  originSessionId: e249e533-e5eb-40af-bd11-bac81c237aba
  modified: 2026-08-24T20:51:35.260Z
---

Conversa de balanceamento com o Abel no grupo "[RPG LR] Playtest dos melhores" (18/08/2026). Dois MDs gerados na pasta do export (`D:\Imagem\US - Universo Soberano\RPG\Reliera\99 🗄️ Arquivo\WhatsApp Chat with [RPG LR] Playtest dos melhores\`): `Balanceamento - topicos e decisoes.md` (tópicos + decisões + pendências) e `Conversa completa - Playtest dos melhores.md` (64 áudios transcritos).

Decidido: nerf grande nas magias verdes de ataque do Xamã (matavam em 1–2 hits; viram plano B, Eco é o core); Dádivas reformadas — braço vira atributo físico, nova dádiva mental, herda 1 atributo de cada tipo + perícia SORTEADOS a cada incorporação, sempre pela sobra; teto do herdado = teto da Aura (sem aura máx 5; racial: Yotun 6 FOR, Pogo 3); Xamã com duas vertentes internas (Espiritismo pesca no verde × Voduísmo pesca no azul — NÃO é classe separada nem subclasse); listar magias do Bardo e habilidades ativas do Xamã no livro; ação "recuperar fôlego" (turno inteiro → +1 Energia, só em combate); Descanso Rápido ~30min (1 ponto só Energia/Sanidade), Curto 4–6h, Longo 8h (único que cura Vitalidade); item manual bloqueado em ficha vinculada a mesa.

FEITO em 24/08/2026: ação "Recuperar Fôlego" no Tabuleiro (`tabuleiro/js/tab-turno.js`, `tbTurnoFolego` — Ação Completa, +1 Energia com teto, botão no painel do turno) e nos livros: Livro do Jogador Cap. 6.2 (Fôlego) e 7.1 (linha "Descanso Rápido" na tabela — Curto/Longo antigos mantidos), livro técnico §4.8 (spec + pendências), via `functions/__aplica-descanso-rapido.mjs` e `__aplica-regua-folego.mjs`.

Em aberto: perícia sorteada (uma de todas × uma de cada); herdar módulos/skills do Eco (hoje herda tudo, Igor em dúvida); Blindagem herdável (Abel contra); re-roll de Transcendência; bônus racial 2/1/0 do Abel; números da reforma Curto (4–6h)/Longo (8h); limite de repetição do Descanso Rápido; divergência Runomancia Parte VIII (¼ da Energia no curto); 1ª e 4ª habilidades do Bardo fortes; regra de Defesa v3 (perícia−1, Reflexo−1) mantida PARA TESTE — risco de early "impossível de acertar" e ataque >> defesa no endgame. Ver [[economia-de-acao]] e [[livro-regua-balanceamento]] antes de mexer nos números.
