---
name: whatsapp-nao-e-registro-de-sessao
description: Mensagem do grupo de WhatsApp não vale como registro de sessão sem checar se foi desmentida ou se é zoeira
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 7d026830-56ae-4988-8544-b06a1d874e1b
  modified: 2026-07-31T00:54:49.208Z
---

Ao reconstruir sessões a partir dos exports de WhatsApp, **uma mensagem isolada não é
registro**. Antes de gravar um fato num arquivo da campanha, ler o que veio depois na mesma
conversa: a mesa desmente, corrige e prega peça em quem faltou o tempo todo.

**Why:** em 30/07/2026 gravei a "Sessão 43" inteira (Onça morta, Cindy domando filhotes,
+9 EXP pra todos) a partir de um anúncio do Mestre. Era trote combinado com quem estava na
mesa para enganar o jogador ausente — 40 minutos depois, na mesma conversa, o próprio Mestre
escreveu "Onça n morreu / Rlx". Entreguei uma sessão inteira que nunca aconteceu, e o
usuário teve que me corrigir.

**How to apply:** para cada fato extraído de chat, varrer as mensagens seguintes (mesmo dia e
dia seguinte) atrás de contradição, "kkk", "zoa", "brincadeira", "conspiração" ou correção do
autor. Se o fato não tiver confirmação independente (log JSON, docx de resumo, relato de
jogador), marcar como não registrado em vez de narrar. Melhor uma sessão vazia que uma
sessão inventada — vale a mesma régua de [[nunca-inventar-lore]].

Relacionado: [[fontes-da-campanha-reliera]]
