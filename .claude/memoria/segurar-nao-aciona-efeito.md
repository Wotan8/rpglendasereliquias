---
name: segurar-nao-aciona-efeito
description: "formaEquipar 'segurar' desliga TODO efeito do item; peça de mão que faz algo é sempre 'empunhar'."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: a9f12485-5099-479e-8b34-56bfa7025815
  modified: 2026-08-12T22:12:05.508Z
---

Ao cadastrar equipamento, **nunca** usar `formaEquipar: 'segurar'` em peça que aplica
qualquer efeito. Item de mão que faz alguma coisa é **`'empunhar'`**, sempre.

`'segurar'` só serve para peça inerte — erva, receita, tinta, comida, moeda, papel.

Conta como "aplica efeito": `mecanicaIds`, `valoresDerivadosVinculados`,
`statusVitaisVinculados`, `condicaoIds`, `atributosVinculados`, `periciasVinculadas`,
`formulaDano`, ou `tipo === 'Arma'` (arma se empunha mesmo sem dano cadastrado).

**Why:** `itemFormasAtuais()` (ficha-v1.7_1/js/inventory.js) devolve `['segurando']` e
nunca `'efeitos'` quando `estadoEquip === 'segurar'`. Peça com vínculo cadastrada como
Segurar fica **muda** na ficha: o arco não soma acerto, o escudo não soma Blindagem, o
totem não faz nada — e não há sintoma nenhum na hora do cadastro. Em 12/08/2026 havia 30
peças assim no catálogo (arcos, escudos, adagas, instrumentos, tomos, totens) e 6
instâncias; corrigidas.

**How to apply:** as UIs já travam sozinhas (`normalizaFormaEquipar()` em
`shared/equip-campos.js`, chamada em `coletarCampos`, no save do painel-criador e inline
no save da ficha). O furo é script `.mjs` gravando direto no Firestore — que é como a IA
cadastra. Ao escrever esse script, decidir a forma pela regra acima. Depois de qualquer
lote de itens, rodar `node functions/audit-equip-saude.mjs` (o bloco "🔴 formaEquipar=
segurar COM EFEITO" tem de dar 0) e, se acusar, `node functions/corrigir-forma-segurar.mjs
--aplicar`. Relacionado: [[evitar-mecanica-vinculada-a-item]], [[cura-de-item-via-statusvitais]].
