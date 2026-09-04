---
name: totemancia-tres-ramos
description: "Reestruturação da Totemancia em 3 ramos (Espiritismo/Patuísmo/Ferinismo) — decisões fechadas em 01/08/2026; JÁ CADASTRADA (mod_totem com 8 rituais, Ferinismo em ally_animal, Incorporação rodando no Tabuleiro)."
metadata: 
  node_type: memory
  type: project
  originSessionId: 10d0ee8b-c202-45a0-94d8-06aa171ab7e7
  modified: 2026-08-16T11:50:49.360Z
---

O Druida foi movido para dentro da Totemancia como terceiro ramo. Convenção de nomes fechada: **escola termina em `-mancia`, ramo termina em `-ismo`**.

- **Espiritismo** (Xamã) — Ecos dos mortos, Essência Verde.
- **Patuísmo** (Mandingueiro) — vivos à distância, Essência Azul pescada. "Mandinga" sobrevive como nome popular; foi o único ramo nomeado por quem pratica, não pela academia.
- **Ferinismo** (Druida) — aliado animal vivo e vinculado. (O módulo no banco ainda se chama `ally_animal` / "Animalomancia".)

Decisões de design que sustentam a fusão:

- **Lealdade** é o eixo comum: número 0–10, campo do **vínculo** (em `npcs.vinculos`), não do NPC — o mesmo NPC pode ter lealdades diferentes com PCs diferentes. Sobe por narrativa, mas com ritmo limitado (±1/sessão, ±2–3 em eventos marcantes) justamente porque destranca um privilégio mecânico. Não existia nada de "Lealdade" no banco.
- **Vinculado = sem teste de consentimento.** Sem vínculo, consentimento é obrigatório nos dois ramos.
- A assimetria de custo é intencional e deve ser preservada: **Xamã paga custo recorrente** (ritual toda vez, se não tiver Totem de Antiqua), **Druida paga custo inicial** (subir Lealdade até X, sugerido 6). A Antiqua deixa de ser obrigatória e vira o item que compra a saída do custo recorrente.
- Qualidade do totem impõe **teto** na força do Eco vinculável; Ancestral só aceita Antiqua (regra dura, não rolagem).
- Druida ganha Fluxomancia nos testes — que é `todoPersonagem: true`, então entra por mecânica "Perícias Iniciais", não em `pericClasse`. Fórmulas: Fusão Selvagem `PRE + Fluxomancia + Linguagem Animal`, Domar Aliado `PRE + Domar + Fluxomancia`, Convocar Manada `PRE + Liderança + Fluxomancia` (Liderança preservada de propósito — trocá-la deixaria Convocar Manada idêntica a Fusão Selvagem).
- Alquimancia continua com o Druida: ele tem dois caminhos (domar / loções) e por isso precisa de dois livros vinculados.

Limiar de Lealdade pro Druida vincular = **`máx(6, 10 − Linguagem Animal)`**. O piso 6 só é acionado por Aura. Efeito real: trava o Druida de nível 1 (LA 1 → precisa de Lealdade 9), não premia o veterano. Ganho de Lealdade fica **±1 por sessão** para todos — Linguagem Animal abaixa a barra OU acelera a subida, nunca as duas (duplicação da mesma perícia).

**Perícias vão até 5**; acima disso só com Aura, que é muito difícil. Os docs em `system/data/skills` **não têm campo de teto** (`nivelMaximo`/`max`/`limite` ausentes nos 99) — o limite é regra, não dado. Não concluir "ilimitado" a partir da ausência do campo.

Tabela de sorte de Ecos: **uma tabela só, com modificador de local** (Estéril −8 / Fértil +0 / Saturada +8) — as faixas que o modificador não alcança são os resultados que não existem naquele lugar. Topo calibrado pra que **28 (= d20 20 + 8) seja o único Ancestral poderoso**: Antigo 20–25, Ancestral 26–27, Ancestral poderoso 28. É **material de mestre**: não pode entrar no Compêndio de Totemancia, que está `public: true`. Ordem: o jogador testa Buscar Vestígio primeiro (gasta Energia/Sanidade, mais se falhar); só se passar o mestre rola o d20. Regra dura necessária: **local lido é local conhecido** — refazer o ritual no mesmo lugar devolve o mesmo resultado, inclusive "Nada" (senão o farm acontece justamente em quem acerta barato).

**Aliado na ficha ≠ vínculo ≠ obediência** — ter um NPC/criatura como Aliado só significa que ele está com você (interesse, dívida, afeto). Adquirir Aliado é teste universal: animal = `AUT + Domar` − Redutor da criatura; Eco = `AUT + Empatia` − Redutor do Eco. Empatia e Domar são ambas AUT e `todoPersonagem: true`, então qualquer classe já consegue.

Cadeia do Druida (4 etapas, cada uma porta da seguinte): conseguir aliado (`AUT + Domar` − Redutor) → cultivar Lealdade → **Vínculo Animal** (`PRE + Domar + Fluxomancia`, exige Lealdade ≥ X) → Fusão Selvagem (exige vínculo selado). O VD de classe que se chamava `Domar Aliado` **vira `Vínculo Animal`** e muda de função: sela o vínculo, não consegue o bicho. Tetos: Xamã tem `Empatia + Totemismo` aliados e vincula até `Totemismo`; Druida tem `Domar + Aliado Animal` aliados e vincula até `Aliado Animal`. Isso substitui o `Totemismo ÷ 2` que está no item `Vincular Eco (Antiqua)`.

**Poder do Eco** (1–10) sai como coluna da própria tabela, sem segundo dado — o d20 já tem granularidade de sobra. Poder *é* a PRS do Eco, então serve a três coisas com um número: resistência nos testes que já dizem "vs PRS do Eco", bônus no Receptor (~Poder ÷ 2, escala ainda a confirmar) e teto do totem (Ancestral 9–10 só aceita Antiqua, por regra dura, sem rolagem).

Ver [[compendios-magia-worldbuilding]], [[npc-em-varias-mesas]], [[nunca-inventar-lore]].
