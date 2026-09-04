---
name: skill-gerar-arte
description: "Skill /gerar-arte gera imagens via Gemini API usando os 4 prompts-master fixos do usuário (Personagem, Item, Local, Terror)."
metadata: 
  node_type: memory
  type: project
  originSessionId: 06c5bf2a-cd8f-48bf-a7c7-70f648ceeea4
  modified: 2026-07-30T22:44:22.327Z
---

Criada a skill `.claude/skills/gerar-arte/` (2026-07-30) para gerar arte do RPG via Gemini API (`gemini-3.1-flash-image-preview`, apelido "Nano Banana 2"), chamando o script standalone [gerar-imagem.mjs](../../../../rpglendasereliquias/gerar-imagem.mjs) na raiz do projeto (sem dependência nova, só `fetch` nativo do Node 22).

O usuário tem 4 prompts-master próprios e extensos, salvos verbatim em `references/`. Pra economizar token (pedido do usuário: 40-60% de cada prompt era guia de raça/tribo/categoria que não se aplica ao pedido específico), cada categoria foi dividida em `estilo.md` (sempre enviado — a parte de arte/formato que mantém o visual consistente) + um arquivo por raça/tribo/categoria (só o pedido é lido e enviado):
- `personagens/estilo.md` + `personagens/racas/{humano,elorin,karu-real,karu-selvagem,picxi,pogo,tamano,yotun}.md`
- `locais/estilo.md` + `locais/tribos/{arn,comuno,famo,ganute,laqueus,latebra,mani,momo,murate,pogtara,tulo,tunder,uqata}.md`
- `terror/estilo.md` + `terror/categorias/{cosmico,psicologico,grotesco,ambiental}.md`
- `itens.md` — curto, sem divisão.

**Por quê**: usuário já tinha esses 4 prompts prontos e usados manualmente — a skill existe pra evitar repetir/colar o template toda vez e decidir automaticamente qual usar + onde salvar (itens vão pra `functions/avulsos-imagens/`, que já era a convenção existente de ícone de item).

**Como aplicar**: nunca resumir ou reescrever os templates — usá-los verbatim + a descrição do usuário no final, igual [[nunca-inventar-lore]]. Se o usuário disser que mudou algum dos 4 prompts, atualizar o arquivo de referência correspondente, não o SKILL.md.
