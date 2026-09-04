---
name: sangue-e-a-14a-essencia
description: "Em 06/08/2026 Sangue virou a 14ª Essência (Carmesim-Escura); sangue morto é moldável como matéria, mas sem vida."
metadata: 
  node_type: memory
  type: project
  originSessionId: b6d06df6-610a-4dce-a524-8ea449871df6
  modified: 2026-08-07T00:20:56.379Z
---

São **catorze** Essências, não treze. Decisão do dono do mundo em 06/08/2026, resolvendo a contradição entre o compêndio (dizia treze) e o cadastro `runicElements` (tinha 14 aspectus, incluindo `asp_sangue`).

**A lore, nas palavras dele:**
- Sangue vivo carrega **duas** essências ao mesmo tempo, "como um emaranhado de filamentos" — **as cores nunca se misturam**. Nas veias a **Carmesim-Escura** domina; no restante do corpo, a **Azul**.
- A Carmesim "segue a mesma lei que a Água": a essência está **fixa na sua contraparte física**, o próprio sangue. Não paira, não viaja — ela *é* o sangue.
- Entra no **Ciclo Vital** como **produto de Água + Vida + Natureza + Luz** (não é parte da roda, é produto dela).
- **Sangue morto continua Carmesim-Escuro, porém sem vida** — a Azul é que se esvai no ambiente ao perder contato com o corpo. A Verde recolhe a *vida* que partiu; o sangue não "vira Verde".

**Consequência mecânica — mudou regra de classe.** Caiu o "somente sangue de Essência Azul (vivo) pode ser manipulado". Sangue derramado segue **moldável como matéria** (Carmesim), mas não cura, não alimenta a Bolha, não sustenta vínculo nem transfusão, e não dá Ecos. Isso é um buff ao Sangral que **nunca passou pela [[livro-regua-balanceamento]]** — precifique antes de usar ao vivo.

**Onde ficou gravado:** VDs `Blindagem Sanguínea` (bloco `blindagem-essencia`, agora 14) e `Dano Sanguíneo` (bloco `ataque-item`, agora 14 canais); textos em `art-fluxomancia-13-essencias` (o ID ainda diz 13, o título é "As Catorze Essências"), `art_ms3gb90mo6fulz` (Hemomancia), `art_ms3gb93y6turqk` (Totemancia), capítulos 5 e 6 do Livro de Regras, e Régua §2.3.

**Cuidado:** o Sangral tem `usaRunomancia: false` — só o Runimago grava runa. O `asp_sangue` do Laboratorium é alcançável pelo Runimago, não pelo hemomante; a Hemomancia roda no bloco de VDs `hemomancia` (Bolha de Sangue, Moldar Sangue, etc.), que é caminho separado. Ver [[nunca-inventar-lore]].
